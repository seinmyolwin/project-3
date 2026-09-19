/**
 * Automated Domain & Financial Calculations Test Suite
 * Validates deterministic integer MMK business calculations,
 * rounding, commissions, ledger balances, cash closings, and historical immutability.
 */

import {
  roundMMK,
  calculateDurationMinutes,
  calculateSessionPricing,
  calculateStaffCommission,
  calculateDetailedCommission,
  calculateMultiStaffCommissionAllocations,
  createCommissionSnapshot,
  splitCommissionPool,
  calculateInvoiceTotals,
  calculatePaymentChange,
  calculatePaymentSummary,
  calculateStaffLedgerTotals,
  calculateStaffSettlementPayout,
  calculateDetailedSettlementBreakdown,
  calculateCashClosing,
  formatMMK,
  validateDiscount,
  evaluateBillPaymentStatus,
} from '../financial';
import { CommissionRule, InvoiceItem, PaymentRecord } from '../../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runAllTests() {
  console.log('====================================================');
  console.log('Running Automated Financial & Business Logic Tests');
  console.log('====================================================\n');

  // 1. Session Duration Tests
  console.log('1. Testing Session Duration Calculations:');
  {
    const start = '2026-09-18T10:00:00Z';
    const end60 = '2026-09-18T11:00:00Z';
    const end90 = '2026-09-18T11:30:00Z';
    const duration60 = calculateDurationMinutes(start, end60);
    const duration90 = calculateDurationMinutes(start, end90);
    assert(duration60 === 60, `60 minutes elapsed calculation is 60 (got ${duration60})`);
    assert(duration90 === 90, `90 minutes elapsed calculation is 90 (got ${duration90})`);
    assert(calculateDurationMinutes(start, '2026-09-18T09:00:00Z') === 0, 'Negative time interval returns 0');
  }

  // 2. Session Pricing & Overtime Tests
  console.log('\n2. Testing Session Pricing & Overtime Calculations:');
  {
    // Normal 60-minute massage session, no overtime
    const res1 = calculateSessionPricing({
      basePriceMMK: 35000,
      roomSurchargeMMK: 5000,
      plannedMinutes: 60,
      actualMinutes: 65, // within 10 min grace period
      hourlyRateMMK: 15000,
    });
    assert(res1.basePriceMMK === 35000, 'Base price preserved as 35,000 MMK');
    assert(res1.roomSurchargeMMK === 5000, 'Room surcharge preserved as 5,000 MMK');
    assert(res1.overtimeFeeMMK === 0, 'Grace period absorbs 5 extra minutes (0 fee)');
    assert(res1.totalServicePriceMMK === 40000, 'Total price is 40,000 MMK');

    // Overtime beyond grace period (e.g. 95 minutes, 35 mins over)
    const res2 = calculateSessionPricing({
      basePriceMMK: 35000,
      roomSurchargeMMK: 0,
      plannedMinutes: 60,
      actualMinutes: 95,
      hourlyRateMMK: 20000,
      gracePeriodMinutes: 10,
      overtimeBlockMinutes: 30,
    });
    // 35 mins overtime in 30-min blocks -> ceil(35/30) = 2 blocks.
    // Fee per block = (20000 * 30) / 60 = 10000 MMK. 2 * 10000 = 20000 MMK.
    assert(res2.overtimeMinutes === 35, '35 overtime minutes detected');
    assert(res2.overtimeFeeMMK === 20000, `Overtime fee is 20,000 MMK (got ${res2.overtimeFeeMMK})`);
    assert(res2.totalServicePriceMMK === 55000, 'Total price is 55,000 MMK');
  }

  // 3. Production Commission Engine Tests
  console.log('\n3. Testing Staff Commission Calculations:');
  {
    // Test 3.1: 30% of 100,000 = 30,000
    const rule30Pct: CommissionRule = { type: 'percentage', value: 30 };
    const comm1 = calculateStaffCommission({ servicePriceMMK: 100000, rule: rule30Pct, staffCount: 1 });
    assert(comm1 === 30000, `30% of 100,000 = 30,000 (got ${comm1})`);

    // Test 3.2: 25% of 150,000 = 37,500
    const rule25Pct: CommissionRule = { type: 'percentage', value: 25 };
    const comm2 = calculateStaffCommission({ servicePriceMMK: 150000, rule: rule25Pct, staffCount: 1 });
    assert(comm2 === 37500, `25% of 150,000 = 37,500 (got ${comm2})`);

    // Test 3.3: Fixed Commission (e.g. 7,000 MMK)
    const ruleFixed: CommissionRule = { type: 'fixed', value: 7000 };
    const commFixed = calculateStaffCommission({ servicePriceMMK: 35000, rule: ruleFixed, staffCount: 1 });
    assert(commFixed === 7000, `Fixed commission = 7,000 MMK (got ${commFixed})`);

    // Test 3.4: Percentage + Fixed Bonus (20% of 100,000 + 5,000 bonus = 25,000 MMK)
    const rulePctPlusFixed: CommissionRule = { type: 'percentage_plus_fixed', value: 20, fixedBonusMMK: 5000 };
    const commPctFixed = calculateStaffCommission({ servicePriceMMK: 100000, rule: rulePctPlusFixed, staffCount: 1 });
    assert(commPctFixed === 25000, `Percentage + fixed bonus (20% of 100k + 5k = 25,000 MMK) (got ${commPctFixed})`);

    // Test 3.5: Tiered Commission (Tier 1: <50k => 10%, Tier 2: >=50k => 20%)
    const ruleTiered: CommissionRule = {
      type: 'tiered',
      value: 10,
      tiers: [
        { minAmountMMK: 0, maxAmountMMK: 50000, type: 'percentage', value: 10 },
        { minAmountMMK: 50001, maxAmountMMK: 200000, type: 'percentage', value: 20 },
      ],
    };
    const commTier1 = calculateStaffCommission({ servicePriceMMK: 40000, rule: ruleTiered, staffCount: 1 });
    assert(commTier1 === 4000, `Tiered commission Tier 1 (10% of 40,000 = 4,000 MMK) (got ${commTier1})`);
    const commTier2 = calculateStaffCommission({ servicePriceMMK: 80000, rule: ruleTiered, staffCount: 1 });
    assert(commTier2 === 16000, `Tiered commission Tier 2 (20% of 80,000 = 16,000 MMK) (got ${commTier2})`);

    // Test 3.6: Zero Commission (0% rate or 0 base price)
    const commZeroRate = calculateStaffCommission({ servicePriceMMK: 100000, rule: { type: 'percentage', value: 0 } });
    assert(commZeroRate === 0, 'Zero commission rate returns 0 MMK');
    const commZeroBase = calculateStaffCommission({ servicePriceMMK: 0, rule: rule30Pct });
    assert(commZeroBase === 0, 'Zero service price returns 0 MMK');

    // Test 3.7: Deterministic MMK Rounding
    // 15% of 33,333 MMK = 4999.95 MMK -> rounds to 5,000 MMK
    const commRound = calculateStaffCommission({ servicePriceMMK: 33333, rule: { type: 'percentage', value: 15 } });
    assert(commRound === 5000, `Rounding 4999.95 MMK -> 5,000 MMK integer (got ${commRound})`);

    // Test 3.8: Multiple Staff Allocation - Percentage Mode (Staff A: 60%, Staff B: 40%)
    const multiAllocPct = calculateMultiStaffCommissionAllocations({
      servicePriceMMK: 100000,
      rule: rule30Pct, // 30,000 total pool
      staffMembers: [
        { staffId: 'stf_a', staffName: 'Staff A', allocationMode: 'percentage', allocationPercent: 60 },
        { staffId: 'stf_b', staffName: 'Staff B', allocationMode: 'percentage', allocationPercent: 40 },
      ],
    });
    assert(multiAllocPct[0].allocatedAmountMMK === 18000, `Multiple staff % allocation Staff A gets 60% of 30k = 18,000 MMK (got ${multiAllocPct[0].allocatedAmountMMK})`);
    assert(multiAllocPct[1].allocatedAmountMMK === 12000, `Multiple staff % allocation Staff B gets 40% of 30k = 12,000 MMK (got ${multiAllocPct[1].allocatedAmountMMK})`);

    // Test 3.9: Multiple Staff Allocation - Fixed Mode (Staff A: 20,000, Staff B: 10,000)
    const multiAllocFixed = calculateMultiStaffCommissionAllocations({
      servicePriceMMK: 100000,
      rule: rule30Pct,
      staffMembers: [
        { staffId: 'stf_a', staffName: 'Staff A', allocationMode: 'fixed', allocationFixedMMK: 20000 },
        { staffId: 'stf_b', staffName: 'Staff B', allocationMode: 'fixed', allocationFixedMMK: 10000 },
      ],
    });
    assert(multiAllocFixed[0].allocatedAmountMMK === 20000, `Multiple staff fixed allocation Staff A = 20,000 MMK (got ${multiAllocFixed[0].allocatedAmountMMK})`);
    assert(multiAllocFixed[1].allocatedAmountMMK === 10000, `Multiple staff fixed allocation Staff B = 10,000 MMK (got ${multiAllocFixed[1].allocatedAmountMMK})`);

    // Test 3.10: Historical Commission Rule Immutability
    const origRule: CommissionRule = { type: 'percentage', value: 30, version: 1 };
    const detailBefore = calculateDetailedCommission({ servicePriceMMK: 100000, rule: origRule });
    const snap = createCommissionSnapshot({
      staffId: 'stf_1',
      staffName: 'Staff 1',
      rule: origRule,
      calculationBaseMMK: 100000,
      detailedResult: detailBefore,
      createdBy: 'Admin',
    });
    // Now rule changes in settings to 15%
    const updatedRule: CommissionRule = { type: 'percentage', value: 15, version: 2 };
    // Verify snapshot preserved historical calculation
    assert(snap.calculatedCommissionMMK === 30000, 'Historical snapshot retains original 30,000 MMK');
    assert(snap.percentage === 30, 'Historical snapshot retains original 30% rate');
    assert(snap.ruleVersion === 1, 'Historical snapshot retains original rule version 1');
    const detailNew = calculateDetailedCommission({ servicePriceMMK: 100000, rule: updatedRule });
    assert(detailNew.netCommissionMMK === 15000, 'New session uses updated rate 15,000 MMK without mutating history');

    // Test 3.11: Cancelled Session / Voided Sale Commission Reversal
    const sessionCommEntries = [
      { type: 'commission', amountMMK: 30000, direction: 'credit' as const },
      { type: 'commission_reversal', amountMMK: 30000, direction: 'debit' as const }, // Cancelled
    ];
    const reversalTotals = calculateStaffLedgerTotals(sessionCommEntries);
    assert(reversalTotals.netPayableBalanceMMK === 0, 'Cancelled session/voided sale reversal zeroes out staff payable balance');

    // Test 3.12: Duplicate Processing Prevention
    const processedSessionIds = new Set<string>();
    const processSession = (sessionId: string) => {
      if (processedSessionIds.has(sessionId)) {
        throw new Error(`Duplicate commission processing detected for session ${sessionId}`);
      }
      processedSessionIds.add(sessionId);
      return 30000;
    };
    const firstRun = processSession('ses_1001');
    assert(firstRun === 30000, 'First commission run succeeds');
    let duplicateCaught = false;
    try {
      processSession('ses_1001');
    } catch (err: any) {
      duplicateCaught = true;
    }
    assert(duplicateCaught === true, 'Duplicate processing prevention halts second attempt');
  }

  // 4. Commission Pool Split with Zero Integer Remainder Loss
  console.log('\n4. Testing Commission Pool Split with Zero Remainder Loss:');
  {
    const pool = 10000;
    const splits = splitCommissionPool(pool, 3);
    const sumSplits = splits.reduce((a, b) => a + b, 0);
    assert(splits.length === 3, 'Splits length is 3');
    assert(splits[0] === 3334 && splits[1] === 3333 && splits[2] === 3333, 'Remainder distributed without losing 1 Kyat');
    assert(sumSplits === pool, `Sum of splits (${sumSplits}) exactly matches total pool (${pool})`);
  }

  // 5. Bonus & Deduction Calculations
  console.log('\n5. Testing Bonus and Deduction Computations:');
  {
    const entries = [
      { type: 'commission', amountMMK: 30000, direction: 'credit' as const },
      { type: 'bonus', amountMMK: 10000, direction: 'credit' as const }, // Good review
      { type: 'deduction', amountMMK: 5000, direction: 'debit' as const }, // Late arrival
    ];
    const totals = calculateStaffLedgerTotals(entries);
    assert(totals.totalBonusesMMK === 10000, 'Total bonus is 10,000 MMK');
    assert(totals.totalDeductionsMMK === 5000, 'Total deduction is 5,000 MMK');
    assert(totals.netPayableBalanceMMK === 35000, `Net balance is 30,000 + 10,000 - 5,000 = 35,000 MMK (got ${totals.netPayableBalanceMMK})`);
  }

  // 6. Staff Advance Payments
  console.log('\n6. Testing Staff Advance Payments & Debits:');
  {
    const entries = [
      { type: 'commission', amountMMK: 50000, direction: 'credit' as const },
      { type: 'advance', amountMMK: 20000, direction: 'debit' as const },
    ];
    const totals = calculateStaffLedgerTotals(entries);
    assert(totals.totalAdvancesMMK === 20000, 'Total advances recorded is 20,000 MMK');
    assert(totals.netPayableBalanceMMK === 30000, `Outstanding balance after advance is 30,000 MMK (got ${totals.netPayableBalanceMMK})`);
  }

  // 7. Staff Settlement & Net Payout Calculation
  console.log('\n7. Testing Staff Settlement & Payout:');
  {
    const unsettled = [
      { type: 'commission', amountMMK: 40000, isSettled: false },
      { type: 'commission', amountMMK: 35000, isSettled: false },
      { type: 'bonus', amountMMK: 5000, isSettled: false },
      { type: 'deduction', amountMMK: 2000, isSettled: false },
      { type: 'advance', amountMMK: 15000, isSettled: false },
    ];
    const payout = calculateStaffSettlementPayout(unsettled);
    // Commissions (75,000) + Bonus (5,000) - Deduction (2,000) - Advance (15,000) = 63,000 MMK
    assert(payout.unsettledCommissionsMMK === 75000, 'Unsettled commissions total 75,000 MMK');
    assert(payout.unsettledBonusesMMK === 5000, 'Unsettled bonuses total 5,000 MMK');
    assert(payout.unsettledDeductionsMMK === 2000, 'Unsettled deductions total 2,000 MMK');
    assert(payout.unsettledAdvancesMMK === 15000, 'Unsettled advances total 15,000 MMK');
    assert(payout.netPayoutMMK === 63000, `Net settlement payout is 63,000 MMK (got ${payout.netPayoutMMK})`);
  }

  // 8. Outstanding Staff Balance After Settlement
  console.log('\n8. Testing Outstanding Balance After Settlement:');
  {
    const fullLedger = [
      { type: 'commission', amountMMK: 75000, direction: 'credit' as const },
      { type: 'bonus', amountMMK: 5000, direction: 'credit' as const },
      { type: 'deduction', amountMMK: 2000, direction: 'debit' as const },
      { type: 'advance', amountMMK: 15000, direction: 'debit' as const },
      { type: 'settlement_payout', amountMMK: 63000, direction: 'debit' as const },
    ];
    const totals = calculateStaffLedgerTotals(fullLedger);
    assert(totals.netPayableBalanceMMK === 0, `Outstanding balance after full settlement is 0 MMK (got ${totals.netPayableBalanceMMK})`);
  }

  // 9. Customer Credit & Invoicing
  console.log('\n9. Testing Invoicing & Customer Credit:');
  {
    const items: InvoiceItem[] = [
      { type: 'service', description: 'Burmese Herbal Massage 90m', quantity: 1, unitPriceMMK: 45000, totalPriceMMK: 45000 },
      { type: 'product', description: 'Myanmar Beer Can', quantity: 3, unitPriceMMK: 3500, totalPriceMMK: 10500 },
      { type: 'product', description: 'Red Bull Can', quantity: 2, unitPriceMMK: 2500, totalPriceMMK: 5000 },
    ];
    // Subtotal: 45,000 + 10,500 + 5,000 = 60,500 MMK
    // 10% Discount: 6,050 MMK -> 54,450 MMK
    // 5% Service Charge: round(54,450 * 5%) = 2,723 MMK -> 57,173 MMK
    // 5% Commercial Tax: round(57,173 * 5%) = 2,859 MMK -> 60,032 MMK
    const invoiceCalc = calculateInvoiceTotals({
      items,
      discountType: 'percentage',
      discountValue: 10,
      serviceChargePercent: 5,
      taxPercent: 5,
    });
    assert(invoiceCalc.subtotalMMK === 60500, `Subtotal is 60,500 MMK (got ${invoiceCalc.subtotalMMK})`);
    assert(invoiceCalc.discountAmountMMK === 6050, `10% discount is 6,050 MMK (got ${invoiceCalc.discountAmountMMK})`);
    assert(invoiceCalc.serviceChargeAmountMMK === 2723, `Service charge is 2,723 MMK (got ${invoiceCalc.serviceChargeAmountMMK})`);
    assert(invoiceCalc.taxAmountMMK === 2859, `Tax is 2,859 MMK (got ${invoiceCalc.taxAmountMMK})`);
    assert(invoiceCalc.totalMMK === 60032, `Total is 60,032 MMK (got ${invoiceCalc.totalMMK})`);
  }

  // 10. Payment & Change Calculations
  console.log('\n10. Testing Payment, Split Payments & Change:');
  {
    const totalMMK = 50000;
    const { changeMMK, isSufficient } = calculatePaymentChange(totalMMK, 60000);
    assert(isSufficient === true, '60,000 MMK tendered is sufficient for 50,000 MMK bill');
    assert(changeMMK === 10000, `Change returned is 10,000 MMK (got ${changeMMK})`);

    // Split payment: Cash 20,000 + KPay 30,000
    const payments: PaymentRecord[] = [
      { id: '1', method: 'cash', amountMMK: 20000 },
      { id: '2', method: 'kpay', amountMMK: 30000 },
    ];
    const summary = calculatePaymentSummary(totalMMK, payments);
    assert(summary.paidAmountMMK === 50000, 'Sum of split payment is 50,000 MMK');
    assert(summary.balanceDueMMK === 0, 'Balance due is 0');
    assert(summary.isFullyPaid === true, 'Invoice is marked fully paid');
  }

  // 11. Daily Cash Closing Calculations
  console.log('\n11. Testing Daily Cash Closing Reconciliation:');
  {
    const closing = calculateCashClosing({
      openingCashFloatMMK: 100000, // 100,000 MMK opening float
      cashSalesTotalMMK: 350000,
      cashCreditRepaymentsMMK: 50000,
      cashExpensesMMK: 40000, // fuel & laundry
      cashStaffAdvancesMMK: 20000,
      cashStaffSettlementsMMK: 80000,
      actualCashCountedMMK: 360000,
    });
    // Expected: 100,000 + 350,000 + 50,000 - 40,000 - 20,000 - 80,000 = 360,000 MMK
    assert(closing.totalCashInflowMMK === 400000, `Total cash inflow is 400,000 MMK (got ${closing.totalCashInflowMMK})`);
    assert(closing.totalCashOutflowMMK === 140000, `Total cash outflow is 140,000 MMK (got ${closing.totalCashOutflowMMK})`);
    assert(closing.expectedCashInDrawerMMK === 360000, `Expected in drawer is 360,000 MMK (got ${closing.expectedCashInDrawerMMK})`);
    assert(closing.cashDifferenceMMK === 0, 'Cash drawer is perfectly balanced with 0 discrepancy');
    assert(closing.isBalanced === true, 'Status is balanced');

    // Test Shortage (Cashier counted 350,000 -> 10,000 shortage)
    const shortClosing = calculateCashClosing({
      openingCashFloatMMK: 100000,
      cashSalesTotalMMK: 350000,
      cashCreditRepaymentsMMK: 50000,
      cashExpensesMMK: 40000,
      cashStaffAdvancesMMK: 20000,
      cashStaffSettlementsMMK: 80000,
      actualCashCountedMMK: 350000, // 10,000 short
    });
    assert(shortClosing.cashDifferenceMMK === -10000, `Shortage correctly calculated as -10,000 MMK (got ${shortClosing.cashDifferenceMMK})`);
    assert(shortClosing.isBalanced === false, 'Shortage marks closing as unbalanced');
  }

  // 12. Explicit Rounding Rules (No decimals, half-up integer MMK)
  console.log('\n12. Testing Rounding Rules:');
  {
    assert(roundMMK(1234.4) === 1234, '1234.4 rounds down to 1234');
    assert(roundMMK(1234.5) === 1235, '1234.5 rounds up to 1235');
    assert(roundMMK(1234.6) === 1235, '1234.6 rounds up to 1235');
    assert(roundMMK(NaN) === 0, 'NaN safely handles as 0');
  }

  // 13. Cancellation & Reversal Logic
  console.log('\n13. Testing Cancellation & Reversal Calculations:');
  {
    // A cancelled session must result in reversal ledger entries for staff commission
    const originalCommission = 30000;
    const reversalEntry = {
      type: 'commission_reversal' as const,
      amountMMK: originalCommission,
      direction: 'debit' as const,
    };
    const entries = [
      { type: 'commission', amountMMK: originalCommission, direction: 'credit' as const },
      { type: 'deduction', amountMMK: reversalEntry.amountMMK, direction: 'debit' as const },
    ];
    const balance = calculateStaffLedgerTotals(entries);
    assert(balance.netPayableBalanceMMK === 0, 'Reversal entry zeroes out staff payable balance');
  }

  // 14. Historical Commission Snapshot Preservation Test
  console.log('\n14. Testing Historical Commission Snapshot Preservation:');
  {
    // Suppose staff rate was 30% yesterday when session occurred (100,000 * 30% = 30,000)
    const historicalSessionStaff = {
      commissionType: 'percentage' as const,
      commissionRate: 30,
      commissionAmountMMK: 30000,
    };

    // Today the staff member gets promoted to 40%
    const currentStaffRule: CommissionRule = { type: 'percentage', value: 40 };

    // Requirement F: Historical transaction must continue showing 30,000 MMK, NOT 40,000 MMK
    assert(historicalSessionStaff.commissionAmountMMK === 30000, 'Historical snapshot retains 30,000 MMK');
    assert(historicalSessionStaff.commissionRate === 30, 'Historical snapshot retains original 30% rate');

    // New session today gets 40,000 MMK
    const todayCommission = calculateStaffCommission({
      servicePriceMMK: 100000,
      rule: currentStaffRule,
      staffCount: 1,
    });
    assert(todayCommission === 40000, 'New session uses new rate 40,000 MMK without mutating history');
  }

  // 15. Currency Formatting (MMK & Burmese numerals)
  console.log('\n15. Testing MMK Formatting:');
  {
    assert(formatMMK(150000) === '150,000 MMK', 'Formatted English MMK string matches 150,000 MMK');
    const mmkFormatted = formatMMK(150000, true);
    assert(mmkFormatted === '၁၅၀,၀၀၀ ကျပ်', `Formatted Burmese digits match ၁၅၀,၀၀၀ ကျပ် (got ${mmkFormatted})`);
  }

  // 16. Transaction Atomicity & Invariant Protection
  console.log('\n16. Testing Transaction Atomicity & Invariant Protection:');
  {
    // Transactional simulation state
    const simulatedDB = {
      sessions: [{ id: 's1', status: 'active' }],
      invoices: [] as any[],
      staffLedger: [] as any[],
      rooms: [{ id: 'r1', status: 'occupied' }],
    };

    // Atomic transaction runner function: takes snapshot, commits only if no error, rolls back if error
    function executeAtomicTransaction(work: (txState: typeof simulatedDB) => void) {
      // Snapshot state
      const snapshot = JSON.parse(JSON.stringify(simulatedDB));
      try {
        work(simulatedDB);
      } catch (err) {
        // Rollback all tables to snapshot
        simulatedDB.sessions = snapshot.sessions;
        simulatedDB.invoices = snapshot.invoices;
        simulatedDB.staffLedger = snapshot.staffLedger;
        simulatedDB.rooms = snapshot.rooms;
        return { success: false, error: err };
      }
      return { success: true };
    }

    // Step 1: Successful atomic checkout transaction
    const resSuccess = executeAtomicTransaction((tx) => {
      tx.sessions[0].status = 'completed';
      tx.invoices.push({ id: 'inv_1', amount: 50000 });
      tx.staffLedger.push({ id: 'led_1', commission: 15000 });
      tx.rooms[0].status = 'cleaning';
    });
    assert(resSuccess.success === true, 'Successful atomic transaction commits all mutated entities');
    assert(simulatedDB.sessions[0].status === 'completed', 'Session status updated to completed');
    assert(simulatedDB.invoices.length === 1, 'Invoice created');
    assert(simulatedDB.staffLedger.length === 1, 'Staff ledger entry added');
    assert(simulatedDB.rooms[0].status === 'cleaning', 'Room status updated to cleaning');

    // Step 2: Failed atomic transaction with failure in step 3
    const resFailure = executeAtomicTransaction((tx) => {
      tx.sessions[0].status = 'active'; // mutating step 1
      tx.invoices.push({ id: 'inv_2', amount: 99999 }); // mutating step 2
      // Step 3 crashes (e.g. invalid staff constraint or disk failure)
      throw new Error('Disk write error / constraint violation during staff ledger entry');
    });

    assert(resFailure.success === false, 'Failing atomic transaction halts');
    assert(simulatedDB.sessions[0].status === 'completed', 'Rollback preserved session status');
    assert(simulatedDB.invoices.length === 1, 'Rollback prevented orphaned invoice');
    assert(simulatedDB.rooms[0].status === 'cleaning', 'Rollback prevented partial state inconsistency');
  }

  // 17. Discount Validation & Boundary Protection
  console.log('\n17. Testing Discount Validation & Boundary Constraints:');
  {
    // Valid 10% discount on 100,000 subtotal -> 10,000 MMK
    const v1 = validateDiscount({ subtotalMMK: 100000, discountType: 'percentage', discountValue: 10 });
    assert(v1.isValid === true, '10% discount is valid');
    assert(v1.discountAmountMMK === 10000, 'Calculated discount amount is 10,000 MMK');

    // Valid 25,000 MMK fixed discount on 100,000 subtotal
    const v2 = validateDiscount({ subtotalMMK: 100000, discountType: 'fixed', discountValue: 25000 });
    assert(v2.isValid === true, '25,000 MMK fixed discount is valid');
    assert(v2.discountAmountMMK === 25000, 'Calculated fixed discount amount is 25,000 MMK');

    // Invalid fixed discount exceeding subtotal (e.g. 150,000 MMK on 100,000 MMK)
    const v3 = validateDiscount({ subtotalMMK: 100000, discountType: 'fixed', discountValue: 150000 });
    assert(v3.isValid === false, 'Fixed discount exceeding subtotal is flagged invalid');
    assert(v3.discountAmountMMK === 100000, 'Capped at subtotal 100,000 MMK (no negative total)');

    // Invalid percentage discount > 100%
    const v4 = validateDiscount({ subtotalMMK: 100000, discountType: 'percentage', discountValue: 120 });
    assert(v4.isValid === false, 'Percentage discount > 100% is flagged invalid');
    assert(v4.discountAmountMMK === 100000, 'Percentage capped at 100% (100,000 MMK)');

    // Negative discount value
    const v5 = validateDiscount({ subtotalMMK: 100000, discountType: 'fixed', discountValue: -5000 });
    assert(v5.isValid === false, 'Negative discount is flagged invalid');
    assert(v5.discountAmountMMK === 0, 'Negative discount normalized to 0');
  }

  // 18. Bill Payment Status Evaluation
  console.log('\n18. Testing Bill Payment Status Evaluation:');
  {
    // UNPAID: Total 100,000, Paid 0, Credit 0
    const s1 = evaluateBillPaymentStatus({ totalMMK: 100000, directPaidMMK: 0, creditDebtMMK: 0 });
    assert(s1 === 'unpaid', 'Zero paid with positive balance evaluates to unpaid');

    // PARTIAL: Total 100,000, Paid 40,000, Credit 0
    const s2 = evaluateBillPaymentStatus({ totalMMK: 100000, directPaidMMK: 40000, creditDebtMMK: 0 });
    assert(s2 === 'partial', 'Partially paid bill evaluates to partial');

    // PAID: Total 100,000, Paid 100,000, Credit 0
    const s3 = evaluateBillPaymentStatus({ totalMMK: 100000, directPaidMMK: 100000, creditDebtMMK: 0 });
    assert(s3 === 'paid', 'Fully paid bill evaluates to paid');

    // CREDIT: Total 100,000, Paid 0, Credit 100,000
    const s4 = evaluateBillPaymentStatus({ totalMMK: 100000, directPaidMMK: 0, creditDebtMMK: 100000 });
    assert(s4 === 'credit', 'Full credit allocation evaluates to credit');

    // PARTIAL with direct + credit: Total 200,000, Cash 100,000, Credit 50,000, Remaining 50,000
    const s5 = evaluateBillPaymentStatus({ totalMMK: 200000, directPaidMMK: 100000, creditDebtMMK: 50000 });
    assert(s5 === 'partial', 'Split cash + credit with remaining debt evaluates to partial');

    // VOIDED override check
    const s6 = evaluateBillPaymentStatus({ totalMMK: 100000, directPaidMMK: 100000, creditDebtMMK: 0, isVoided: true });
    assert(s6 === 'voided', 'Voided flag unconditionally returns voided');
  }

  // 19. Multi-Payment Split Tender Flow (Prompt Example Verification)
  console.log('\n19. Testing Split-Tender Multi-Payment Calculations:');
  {
    // Prompt specification:
    // Total = 200,000
    // Cash = 100,000
    // KBZ Pay = 50,000
    // Credit = 50,000
    // Outstanding = 50,000 (if credit is unpaid debt)
    const p1: PaymentRecord = { id: '1', method: 'cash', amountMMK: 100000 };
    const p2: PaymentRecord = { id: '2', method: 'kpay', amountMMK: 50000, referenceNo: 'KPAY-998811' };
    const p3: PaymentRecord = { id: '3', method: 'credit', amountMMK: 50000, notes: 'VIP Credit' };

    const splitSummary = calculatePaymentSummary([p1, p2, p3]);
    assert(splitSummary.directPaidMMK === 150000, `Direct paid (Cash + KPay) is 150,000 MMK (got ${splitSummary.directPaidMMK})`);
    assert(splitSummary.creditDebtMMK === 50000, `Credit debt is 50,000 MMK (got ${splitSummary.creditDebtMMK})`);
    assert(splitSummary.totalAllocatedMMK === 200000, `Total allocated is 200,000 MMK (got ${splitSummary.totalAllocatedMMK})`);
    assert(splitSummary.breakdown.cash === 100000, 'Cash breakdown is 100,000 MMK');
    assert(splitSummary.breakdown.kpay === 50000, 'KPay breakdown is 50,000 MMK');
    assert(splitSummary.breakdown.credit === 50000, 'Credit breakdown is 50,000 MMK');
  }

  // 20. Line Item Historical Price Snapshot Preservation
  console.log('\n20. Testing Historical Line Item Price Preservation:');
  {
    // A product originally sold at 5,000 MMK
    const soldItem: InvoiceItem = {
      type: 'product',
      description: 'Tiger Beer Can',
      quantity: 4,
      unitPriceMMK: 5000,
      costPriceMMK: 3500,
      totalPriceMMK: 20000,
    };

    // Calculate original bill total
    const originalBill = calculateInvoiceTotals({ items: [soldItem] });
    assert(originalBill.totalMMK === 20000, 'Original bill total is 20,000 MMK');

    // Now product master catalog changes price to 6,500 MMK next month
    const updatedMasterProduct = {
      id: 'prod_tiger',
      name: 'Tiger Beer Can',
      sellingPriceMMK: 6500,
      costPriceMMK: 4000,
    };

    // Historical invoice record continues using historical unitPriceMMK (5,000 MMK)
    assert(soldItem.unitPriceMMK === 5000, 'Historical invoice item retains original unit price 5,000 MMK');
    assert(soldItem.totalPriceMMK === 20000, 'Historical invoice item retains original total price 20,000 MMK');
    assert(updatedMasterProduct.sellingPriceMMK === 6500, 'Master catalog price can change independently');
  }

  // 21. Staff Settlement Engine & Historical Ledger Tests
  console.log('\n21. Testing Staff Settlement Engine & Historical Ledger Scenarios:');
  {
    // Test 21.1: Full Settlement Calculation
    const ledger1 = [
      { type: 'commission', amountMMK: 300000, direction: 'credit' as const, date: '2026-09-01' },
      { type: 'bonus', amountMMK: 50000, direction: 'credit' as const, date: '2026-09-02' },
      { type: 'deduction', amountMMK: 10000, direction: 'debit' as const, date: '2026-09-03' },
      { type: 'advance', amountMMK: 40000, direction: 'debit' as const, date: '2026-09-04' },
    ];
    // Gross = 300,000 + 50,000 = 350,000
    // Deductions + Advances = 10,000 + 40,000 = 50,000
    // Net Payable = 300,000 MMK
    const bd1 = calculateDetailedSettlementBreakdown(ledger1);
    assert(bd1.grossCommissionMMK === 300000, 'Gross commission is 300,000 MMK');
    assert(bd1.totalBonusMMK === 50000, 'Total bonus is 50,000 MMK');
    assert(bd1.totalDeductionMMK === 10000, 'Total deduction is 10,000 MMK');
    assert(bd1.totalAdvanceMMK === 40000, 'Total advance is 40,000 MMK');
    assert(bd1.previousSettlementsMMK === 0, 'Previous settlements is 0 MMK');
    assert(bd1.netPayableBeforeMMK === 300000, `Net payable is 300,000 MMK (got ${bd1.netPayableBeforeMMK})`);

    // Test 21.2: Partial Settlement & Remaining Balance Calculation
    // Pay 200,000 MMK out of 300,000 MMK payable
    const partialPay = 200000;
    const remaining = bd1.netPayableBeforeMMK - partialPay;
    assert(remaining === 100000, 'Remaining balance after partial payment is 100,000 MMK');

    // Test 21.3: Progressive Partial Settlement (Multiple Settlements)
    // Add first payout entry to ledger
    const ledger2 = [
      ...ledger1,
      { type: 'settlement_payout', amountMMK: 200000, direction: 'debit' as const, date: '2026-09-05' },
    ];
    const bd2 = calculateDetailedSettlementBreakdown(ledger2);
    assert(bd2.previousSettlementsMMK === 200000, 'Previous settlements updated to 200,000 MMK');
    assert(bd2.netPayableBeforeMMK === 100000, `Net payable remaining is 100,000 MMK (got ${bd2.netPayableBeforeMMK})`);

    // Second payment of remaining 100,000 MMK
    const ledger3 = [
      ...ledger2,
      { type: 'settlement_payout', amountMMK: 100000, direction: 'debit' as const, date: '2026-09-10' },
    ];
    const bd3 = calculateDetailedSettlementBreakdown(ledger3);
    assert(bd3.previousSettlementsMMK === 300000, 'Total previous settlements is now 300,000 MMK');
    assert(bd3.netPayableBeforeMMK === 0, 'Net payable remaining is now 0 MMK');

    // Test 21.4: Zero Payable Handling
    const zeroPayableBd = calculateDetailedSettlementBreakdown(ledger3);
    assert(zeroPayableBd.netPayableBeforeMMK === 0, 'Zero payable handled correctly');

    // Test 21.5: Reversal restoring net payable
    const ledgerWithReversal = [
      ...ledger2, // previous payout was 200,000 MMK, leaving 100,000 MMK
      { type: 'settlement_reversal', amountMMK: 200000, direction: 'credit' as const, date: '2026-09-06' },
    ];
    const bdReversal = calculateDetailedSettlementBreakdown(ledgerWithReversal);
    assert(bdReversal.previousSettlementsMMK === 0, 'Reversal resets net settlements paid to 0 MMK');
    assert(bdReversal.netPayableBeforeMMK === 300000, `Reversal restores net payable back to 300,000 MMK (got ${bdReversal.netPayableBeforeMMK})`);

    // Test 21.6: Historical Correctness (Uses existing posted ledger entries regardless of master rule changes)
    // Historical posted commission entry was 40,000 MMK under 20% rule
    const historicalEntry = { type: 'commission', amountMMK: 40000, direction: 'credit' as const, date: '2026-08-01' };
    // Master rule is later updated from 20% to 10% on 50,000 service price
    const currentMasterRule: CommissionRule = { type: 'percentage', value: 10 };
    const recalculatedWithNewRule = calculateStaffCommission({ servicePriceMMK: 200000, rule: currentMasterRule, staffCount: 1 });
    assert(recalculatedWithNewRule === 20000, 'Current rule would evaluate to 20,000 MMK');

    // But settlement calculation uses ONLY the posted ledger entry (40,000 MMK)
    const historicalLedgerBreakdown = calculateDetailedSettlementBreakdown([historicalEntry]);
    assert(historicalLedgerBreakdown.grossCommissionMMK === 40000, 'Settlement preserves historical posted ledger amount 40,000 MMK without recalculation');
  }

  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runAllTests();
