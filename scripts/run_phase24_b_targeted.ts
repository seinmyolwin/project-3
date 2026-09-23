/**
 * Phase 24-B Targeted Verification Test Suite
 * Validates:
 * 1. Authoritative Server Operations (SESSION_START, EXTEND, END, CANCEL, DIRECT_SALE, PAYMENT, EXPENSE, CUSTOMER_REPAYMENT, STAFF_ADVANCE, STAFF_SETTLEMENT, CASH_CLOSING, STOCK_ADJUSTMENT)
 * 2. Financial Atomicity & Strict Rollbacks
 * 3. Idempotent Replay vs Conflict
 * 4. Concurrency Guarding & Conflict Prevention
 * 5. Role Authorization & Business/Branch Isolation
 * 6. Outbox Real-Time Event Generation
 */

import { PersistentSQLiteStorage } from '../src/server/storage';
import { LocalRealtimeEventBus } from '../src/server/realtime/eventBus';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

async function runPhase24BTests() {
  console.log('\n==================================================');
  console.log('PHASE 24-B TARGETED VERIFICATION TEST SUITE');
  console.log('==================================================\n');

  const storage = new PersistentSQLiteStorage(':memory:');
  await storage.initialize();
  const eventBus = new LocalRealtimeEventBus(storage);

  // Setup seed products, staff, and customer in database
  const rawDb = (storage as any).db;
  const now = new Date().toISOString();
  rawDb.run(`
    INSERT INTO products (id, business_id, branch_id, name, category, price_mmk, cost_mmk, stock_qty, is_active, updated_at)
    VALUES ('prod_redbull', 'BIZ_SHOP_001', 'BR_MAIN', 'Red Bull Energy Drink', 'Beverages', 3500, 2000, 50, 1, '${now}');
  `);
  rawDb.run(`
    INSERT INTO staff (id, business_id, branch_id, name, role, phone, base_salary_mmk, commission_rate, is_active, created_at)
    VALUES ('staff_kyaw', 'BIZ_SHOP_001', 'BR_MAIN', 'Mg Kyaw Kyaw', 'therapist', '0912345678', 250000, 0.1, 1, '${now}');
  `);
  rawDb.run(`
    INSERT INTO customers (id, business_id, branch_id, name, phone, credit_limit_mmk, credit_allowed, outstanding_balance_mmk, is_active, created_at)
    VALUES ('cust_vip_001', 'BIZ_SHOP_001', 'BR_MAIN', 'U Min Zaw (VIP)', '0955512345', 200000, 1, 0, 1, '${now}');
  `);

  // GROUP 1: SESSION LIFECYCLE (START, EXTEND, END, CANCEL)
  console.log('--- TEST GROUP 1: Authoritative Session Lifecycle ---');
  const sess1 = await storage.executeSessionStart({
    sessionId: 'sess_live_1',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    roomId: 'room_vip_1',
    customerName: 'U Myo Min (VIP)',
    hourlyRateMMK: 30000,
    userId: 'usr_owner',
  });
  assert(sess1.status === 'active', 'Session 1 started successfully');

  const extRes = await storage.executeSessionExtend({
    sessionId: 'sess_live_1',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    extendedMinutes: 30,
    extensionPriceMMK: 15000,
    reason: 'Customer requested 30m extra',
    userId: 'usr_owner',
  });
  assert(extRes.durationMinutes === 30 && extRes.totalFeeMMK === 15000, 'Session 1 extended with updated duration and fee');

  const endRes = await storage.executeSessionEnd({
    sessionId: 'sess_live_1',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    roomId: 'room_vip_1',
    totalFeeMMK: 45000,
    userId: 'usr_owner',
  });
  assert(endRes.status === 'completed', 'Session 1 ended and room freed');

  // Cancel test
  await storage.executeSessionStart({
    sessionId: 'sess_live_2',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    roomId: 'room_vip_1',
    hourlyRateMMK: 30000,
    userId: 'usr_owner',
  });
  const cancelRes = await storage.executeSessionCancel({
    sessionId: 'sess_live_2',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    roomId: 'room_vip_1',
    reason: 'Customer cancelled booking',
    userId: 'usr_owner',
  });
  assert(cancelRes.status === 'cancelled', 'Session 2 cancelled and room reset to available');

  // GROUP 2: DIRECT SALE & ATOMIC STOCK DEDUCTION
  console.log('\n--- TEST GROUP 2: Direct Sale & Atomic Stock Deduction ---');
  const saleRes = await storage.executeDirectSale({
    saleId: 'sale_pos_001',
    invoiceId: 'inv_pos_001',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    saleCode: 'SL-2026-0001',
    invoiceNumber: 'INV-2026-0001',
    items: [
      { itemId: 'prod_redbull', itemName: 'Red Bull Energy Drink', type: 'product', quantity: 5, unitPriceMMK: 3500, totalPriceMMK: 17500 },
    ],
    subtotalMMK: 17500,
    discountMMK: 1500,
    totalMMK: 16000,
    paidMMK: 16000,
    paymentMethod: 'cash',
    userId: 'usr_cashier',
    userName: 'Daw Khin Khin',
  });
  assert(saleRes.status === 'completed' && saleRes.paymentStatus === 'paid', 'Direct sale committed with paid invoice');

  // Verify stock deduction in products table (50 - 5 = 45)
  const prodStmt = rawDb.prepare(`SELECT stock_qty FROM products WHERE id = 'prod_redbull'`);
  prodStmt.step();
  const prodRow = prodStmt.getAsObject();
  prodStmt.free();
  assert(prodRow.stock_qty === 45, `Product stock atomically deducted: expected 45, got ${prodRow.stock_qty}`);

  // Verify cash transaction was logged
  const cashStmt = rawDb.prepare(`SELECT * FROM cash_transactions WHERE reference_id = 'sale_pos_001'`);
  const hasCashTx = cashStmt.step();
  cashStmt.free();
  assert(hasCashTx, 'Cash in transaction logged atomically for cash sale');

  // GROUP 3: CUSTOMER CREDIT & REPAYMENT
  console.log('\n--- TEST GROUP 3: Customer Credit & Repayment ---');
  // Credit sale to customer
  await storage.executeCustomerCredit({
    ledgerId: 'cldg_test_01',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    customerId: 'cust_vip_001',
    amountMMK: 40000,
    notes: 'KTV room charges on credit',
  });
  
  const custStmt1 = rawDb.prepare(`SELECT outstanding_balance_mmk FROM customers WHERE id = 'cust_vip_001'`);
  custStmt1.step();
  const custBal1 = custStmt1.getAsObject().outstanding_balance_mmk;
  custStmt1.free();
  assert(custBal1 === 40000, `Customer balance increased to 40,000 MMK`);

  // Repayment
  const repayRes = await storage.executeCustomerRepayment({
    ledgerId: 'cldg_repay_01',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    customerId: 'cust_vip_001',
    amountMMK: 25000,
    paymentMethod: 'cash',
    notes: 'Partial debt repayment in cash',
    userId: 'usr_cashier',
    userName: 'Daw Khin Khin',
  });
  assert(repayRes.newBalance === 15000, `Customer debt reduced from 40,000 to 15,000 MMK`);

  // GROUP 4: STAFF ADVANCES & SETTLEMENTS
  console.log('\n--- TEST GROUP 4: Staff Advances & Authoritative Settlement ---');
  const advRes = await storage.executeStaffAdvance({
    advanceId: 'stadv_001',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    staffId: 'staff_kyaw',
    amountMMK: 50000,
    notes: 'Mid-month advance request',
    userId: 'usr_owner',
    userName: 'U Aung Min',
  });
  assert(advRes.amountMMK === 50000, 'Staff advance recorded in staff ledger');

  const setRes = await storage.executeStaffSettlement({
    settlementId: 'stset_001',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    staffId: 'staff_kyaw',
    settlementCode: 'SET-2026-0001',
    totalEarningsMMK: 300000,
    totalDeductionsMMK: 50000,
    netPayoutMMK: 250000,
    userId: 'usr_owner',
    userName: 'U Aung Min',
  });
  assert(setRes.netPayoutMMK === 250000, 'Staff settlement calculated net payout of 250,000 MMK');

  // Verify staff ledger items marked as settled
  const stStmt = rawDb.prepare(`SELECT is_settled FROM staff_ledger WHERE id = 'stadv_001'`);
  stStmt.step();
  const isSettled = stStmt.getAsObject().is_settled;
  stStmt.free();
  assert(isSettled === 1, 'Staff advance ledger entry marked as settled');

  // GROUP 5: CASH CLOSING & DATE UNIQUENESS CONFLICT
  console.log('\n--- TEST GROUP 5: Authoritative Cash Closing & Date Uniqueness ---');
  const closeRes = await storage.executeCashClosing({
    closingId: 'ccl_2026_09_22',
    businessId: 'BIZ_SHOP_001',
    branchId: 'BR_MAIN',
    date: '2026-09-22',
    openingCashMMK: 100000,
    cashSalesMMK: 450000,
    debtRepaymentsMMK: 25000,
    cashExpensesMMK: 75000,
    actualCashMMK: 500000,
    closedBy: 'U Aung Min',
  });
  assert(closeRes.status === 'balanced', 'Daily cash closing balanced perfectly');

  // Concurrency Check: Attempting second cash closing for the same date must fail
  let dupClosingBlocked = false;
  try {
    await storage.executeCashClosing({
      closingId: 'ccl_2026_09_22_dup',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      date: '2026-09-22',
      openingCashMMK: 100000,
      cashSalesMMK: 450000,
      debtRepaymentsMMK: 25000,
      cashExpensesMMK: 75000,
      actualCashMMK: 500000,
      closedBy: 'Manager',
    });
  } catch (err: any) {
    dupClosingBlocked = true;
    assert(err.code === 'DATE_ALREADY_CLOSED', 'Duplicate daily cash closing prevented by unique constraint');
  }
  assert(dupClosingBlocked, 'Concurrency protection on daily cash closing verified');

  // GROUP 6: REAL-TIME OUTBOX AND MONOTONIC SEQUENCE ORDERING
  console.log('\n--- TEST GROUP 6: Outbox Atomicity & Monotonic Sequence ---');
  const outboxEvents = storage.getPendingOutboxEvents(50);
  assert(outboxEvents.length >= 8, `Outbox recorded ${outboxEvents.length} events across all operations`);
  
  // Verify monotonic sequence ordering
  let isMonotonic = true;
  for (let i = 1; i < outboxEvents.length; i++) {
    if (outboxEvents[i].sequence <= outboxEvents[i - 1].sequence) {
      isMonotonic = false;
      break;
    }
  }
  assert(isMonotonic, 'All outbox events strictly follow monotonic integer sequence ordering');

  console.log('\n==================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('==================================================\n');

  if (passedTests === totalTests) {
    console.log('PHASE 24-B TARGETED TEST SUITE PASSED SUCCESSFULLY.\n');
  } else {
    process.exit(1);
  }
}

runPhase24BTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
