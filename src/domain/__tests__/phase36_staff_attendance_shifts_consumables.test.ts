import { PersistentSQLiteStorage } from '../../server/storage';

async function runPhase36Tests() {
  console.log('======================================================');
  console.log('PHASE 36 — STAFF ATTENDANCE, SHIFTS, CONSUMABLES & PAYROLL');
  console.log('======================================================');

  const storage = new PersistentSQLiteStorage(':memory:');
  await storage.initialize();

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(`FAIL: ${msg}`);
  }

  async function runTest(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(` ✓ [PASS] ${name}`);
      testPassed++;
    } catch (err: any) {
      console.error(` ❌ [FAIL] ${name}:`, err.message);
      testFailed++;
    }
  }

  const businessId = 'BIZ_TEST_36';
  const branchId = 'BR_TEST_36';
  const staffId = 'stf_36_01';
  const staffName = 'မစုစု (Senior Therapist)';
  const userId = 'usr_mgr_36';
  const userName = 'ဒေါ်အေးအေး (Manager)';

  // Seed business and branch
  (storage as any).db.run(`
    INSERT INTO businesses (id, name, owner_name, phone, created_at, updated_at)
    VALUES (?, 'Shwe Thiri Wellness Lounge', 'Daw Aye Aye', '095000002', datetime('now'), datetime('now'))
  `, [businessId]);

  (storage as any).db.run(`
    INSERT INTO branches (id, business_id, name, code, is_active, created_at)
    VALUES (?, ?, 'Downtown Spa & Lounge', 'DT-01', 1, datetime('now'))
  `, [branchId, businessId]);

  // Seed staff member
  (storage as any).db.run(`
    INSERT INTO staff (id, business_id, branch_id, name, role, phone, base_salary_mmk, commission_rate, is_active, created_at)
    VALUES (?, ?, ?, ?, 'Therapist', '0912345678', 300000, 0.1, 1, datetime('now'))
  `, [staffId, businessId, branchId, staffName]);

  // Seed inventory products for consumables
  const prodOilId = 'prod_oil_01';
  const prodTowelId = 'prod_towel_02';

  (storage as any).db.run(`
    INSERT INTO products (id, business_id, branch_id, name, category, price_mmk, cost_mmk, stock_qty, is_active, updated_at)
    VALUES 
      (?, ?, ?, 'Lavender Aromatherapy Oil (100ml)', 'Spa Supplies', 15000, 8000, 50, 1, datetime('now')),
      (?, ?, ?, 'Disposable Spa Towel Sheet', 'Spa Supplies', 2000, 1000, 200, 1, datetime('now'))
  `, [prodOilId, businessId, branchId, prodTowelId, businessId, branchId]);

  // 1. Staff Clock-In
  let attendanceRecordId = 'att_36_001';
  await runTest('1. Staff Clock-In (Attendance tracking)', async () => {
    const res = await storage.executeStaffClockIn({
      attendanceId: attendanceRecordId,
      businessId,
      branchId,
      staffId,
      staffName,
      date: '2026-09-24',
      checkInTime: '2026-09-24T08:55:00.000Z',
      status: 'checked_in',
      notes: 'Morning shift on time',
      userId,
      userName,
    });

    assert(res.attendanceId === attendanceRecordId, 'Attendance ID matches');
    assert(res.status === 'checked_in', 'Status is checked_in');

    const list = storage.getStaffAttendance(businessId, branchId, '2026-09-24', staffId);
    assert(list.length === 1, 'Attendance record found in query');
    assert(list[0].staff_name === staffName, 'Staff name matches');
  });

  // 2. Staff Clock-Out
  await runTest('2. Staff Clock-Out (Shift completion)', async () => {
    const res = await storage.executeStaffClockOut({
      attendanceId: attendanceRecordId,
      businessId,
      branchId,
      checkOutTime: '2026-09-24T18:05:00.000Z',
      notes: 'Completed full 9-hour shift',
      userId,
      userName,
    });

    assert(res.status === 'checked_out', 'Status updated to checked_out');
    assert(res.checkOutTime.includes('18:05'), 'Check-out time recorded');

    const list = storage.getStaffAttendance(businessId, branchId, '2026-09-24', staffId);
    assert(list[0].status === 'checked_out', 'Query shows checked_out');
  });

  // 3. Shift Open with Opening Float
  const shiftId = 'shf_36_001';
  await runTest('3. Shift Open with Opening Cash Float', async () => {
    const res = await storage.executeShiftOpen({
      shiftId,
      businessId,
      branchId,
      shiftCode: 'SHF-260924-01',
      staffId,
      staffName,
      openingFloatMMK: 100000,
      notes: 'Morning register float',
      userId,
      userName,
    });

    assert(res.shiftId === shiftId, 'Shift created');
    assert(res.openingFloatMMK === 100000, 'Opening float 100,000 MMK recorded');
    assert(res.status === 'open', 'Shift status open');

    const shifts = storage.getShiftHandovers(businessId, branchId, 'open');
    assert(shifts.length === 1, '1 open shift found');
  });

  // 4. Record transactions during shift & Shift Close Reconciliation
  await runTest('4. Shift Cash Reconciliation & Shift Close (Float + Sales - Expenses)', async () => {
    // Record a cash sale of 80,000 MMK
    const txNow = new Date().toISOString();
    (storage as any).db.run(`
      INSERT INTO cash_transactions (id, business_id, branch_id, type, category, amount_mmk, reference_type, reference_id, notes, transaction_time, created_by)
      VALUES 
        ('ctx_sale_1', ?, ?, 'cash_in', 'sales', 80000, 'invoice', 'inv_36_01', 'Cash massage sale', ?, 'usr_cashier'),
        ('ctx_exp_1', ?, ?, 'cash_out', 'expense', 20000, 'expense', 'exp_36_01', 'Cleaning supplies expense', ?, 'usr_cashier')
    `, [businessId, branchId, txNow, businessId, branchId, txNow]);

    // Expected Cash = 100,000 (float) + 80,000 (sale) - 20,000 (expense) = 160,000 MMK
    // Actual Cash counted = 160,000 MMK (0 discrepancy)
    const closeRes = await storage.executeShiftClose({
      shiftId,
      businessId,
      branchId,
      actualCashMMK: 160000,
      notes: 'Even cash drawer at handover',
      handedOverToId: 'usr_stf_02',
      handedOverToName: 'Ko Tun (Evening Cashier)',
      userId,
      userName,
    });

    assert(closeRes.status === 'closed', 'Shift successfully closed');
    assert(closeRes.expectedCashMMK === 160000, `Expected cash is 160,000 MMK (got ${closeRes.expectedCashMMK})`);
    assert(closeRes.discrepancyMMK === 0, 'Discrepancy is 0 MMK (perfect match)');
  });

  // 5. Service Consumable Link (Recipe / BOM)
  const serviceId = 'srv_aroma_90';
  await runTest('5. Configure Service Consumables Recipe (BOM)', async () => {
    await storage.executeServiceConsumableLink({
      businessId,
      branchId,
      serviceId,
      serviceName: '90-min Aromatherapy Relaxation',
      productId: prodOilId,
      productName: 'Lavender Aromatherapy Oil (100ml)',
      quantity: 1, // 1 bottle per session
      unit: 'bottle',
      userId,
      userName,
    });

    await storage.executeServiceConsumableLink({
      businessId,
      branchId,
      serviceId,
      serviceName: '90-min Aromatherapy Relaxation',
      productId: prodTowelId,
      productName: 'Disposable Spa Towel Sheet',
      quantity: 2, // 2 sheets per session
      unit: 'sheet',
      userId,
      userName,
    });

    const recipes = storage.getServiceConsumables(businessId, serviceId);
    assert(recipes.length === 2, '2 consumable recipe items configured for aromatherapy');
  });

  // 6. Service Consumable Automatic Stock Deduction & Audit Trail
  await runTest('6. Atomic Service Consumable Deduction on Service Completion', async () => {
    // Initial stocks: Oil = 50, Towel = 200
    // Service performed for 2 clients (multiplier = 2) => Oil deducted: 2, Towel deducted: 4
    const deductRes = await storage.executeServiceConsumablesDeduct({
      serviceId,
      businessId,
      branchId,
      multiplier: 2,
      sessionId: 'sess_36_01',
      invoiceId: 'inv_36_01',
      customerName: 'Daw Thida (VIP)',
      staffId,
      staffName,
      userId,
      userName,
    });

    assert(deductRes.deductedItems.length === 2, '2 inventory items deducted');

    const oilDeduction = deductRes.deductedItems.find((d: any) => d.productId === prodOilId);
    assert(oilDeduction.previousStock === 50, 'Oil previous stock was 50');
    assert(oilDeduction.newStock === 48, 'Oil new stock is 48 (-2 bottles)');

    const towelDeduction = deductRes.deductedItems.find((d: any) => d.productId === prodTowelId);
    assert(towelDeduction.previousStock === 200, 'Towel previous stock was 200');
    assert(towelDeduction.newStock === 196, 'Towel new stock is 196 (-4 sheets)');

    // Verify stock movements table audit
    const movements = storage.getStockMovements(businessId, branchId);
    assert(movements.length === 2, '2 stock movement audit records created');
    assert(movements[0].type === 'consumption', 'Movement type is consumption');
  });

  // 7. Advanced Staff Payroll & Commission Settlement
  await runTest('7. Advanced Staff Payroll & Settlement (Base + Commissions - Advances)', async () => {
    // Seed staff earnings into staff_ledger:
    // Commission from 2 sessions: 15,000 MMK + 25,000 MMK = 40,000 MMK
    // Staff salary advance taken earlier: -20,000 MMK
    (storage as any).db.run(`
      INSERT INTO staff_ledger (id, business_id, branch_id, staff_id, type, amount_mmk, notes, date, is_settled, created_at)
      VALUES
        ('ldg_com_1', ?, ?, ?, 'commission', 15000, 'Commission for Aromatherapy 90m', '2026-09-20', 0, datetime('now')),
        ('ldg_com_2', ?, ?, ?, 'commission', 25000, 'Commission for VIP Package', '2026-09-22', 0, datetime('now')),
        ('ldg_adv_1', ?, ?, ?, 'advance', 20000, 'Mid-month cash advance', '2026-09-10', 0, datetime('now'))
    `, [businessId, branchId, staffId, businessId, branchId, staffId, businessId, branchId, staffId]);

    // Base salary = 300,000 MMK
    // Bonus = 10,000 MMK
    // Total Earnings = 300,000 (base) + 40,000 (commissions) + 10,000 (bonus) = 350,000 MMK
    // Deductions = 20,000 (advance)
    // Net Payout = 330,000 MMK
    const stlRes = await storage.executeStaffSettlementCreate({
      businessId,
      branchId,
      staffId,
      staffName,
      baseSalaryMMK: 300000,
      bonusMMK: 10000,
      notes: 'September 2026 Monthly Payroll Settlement',
      payImmediately: true,
      userId,
      userName,
    });

    assert(stlRes.totalEarnings === 350000, `Total earnings is 350,000 MMK (got ${stlRes.totalEarnings})`);
    assert(stlRes.totalDeductions === 20000, `Total deductions is 20,000 MMK (got ${stlRes.totalDeductions})`);
    assert(stlRes.netPayout === 330000, `Net payout is 330,000 MMK (got ${stlRes.netPayout})`);
    assert(stlRes.settledLedgerCount === 3, 'All 3 ledger entries marked settled');
  });

  console.log('======================================================');
  console.log(`PHASE 36 COMPLETED: ${testPassed}/${testPassed + testFailed} TESTS PASSED`);
  console.log('======================================================');

  if (testFailed > 0) {
    throw new Error(`Phase 36 tests failed with ${testFailed} failures.`);
  }
}

runPhase36Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
