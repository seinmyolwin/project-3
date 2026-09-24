/**
 * ============================================================================
 * PHASE 34: MEMBERSHIP, PACKAGES, GIFT CARDS & TIPS COMPREHENSIVE TEST SUITE
 * ============================================================================
 */

import path from 'path';
import fs from 'fs';
import { PersistentSQLiteStorage } from '../../server/storage';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

let testPassed = 0;
let testFailed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    testPassed++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    testFailed++;
  }
}

async function runPhase34Tests() {
  console.log('======================================================');
  console.log('PHASE 34 — MEMBERSHIP, PACKAGE, GIFT CARD & TIPS TESTS');
  console.log('======================================================');

  const testDbPath = path.join(process.cwd(), 'data', `test_p34_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);
  const storage = new PersistentSQLiteStorage(testDbPath);
  await storage.initialize();

  const businessId = 'BIZ_TEST_34';
  const branchId = 'BRANCH_TEST_34';
  const userId = 'usr_owner_34';
  const userName = 'Owner U Aung';

  // Seed business & branch
  (storage as any).db.run(`
    INSERT INTO businesses (id, name, owner_name, phone, created_at, updated_at)
    VALUES (?, 'Shwe Thiri Lounge', 'U Aung', '0912345678', datetime('now'), datetime('now'))
  `, [businessId]);

  (storage as any).db.run(`
    INSERT INTO branches (id, business_id, name, code, is_active, created_at)
    VALUES (?, ?, 'Main Branch', 'MAIN', 1, datetime('now'))
  `, [branchId, businessId]);

  // Seed customer
  (storage as any).db.run(`
    INSERT INTO customers (id, business_id, branch_id, name, phone, credit_limit_mmk, outstanding_balance_mmk, is_active, created_at)
    VALUES ('cust_34_01', ?, ?, 'Daw Hla', '09987654321', 100000, 0, 1, datetime('now'))
  `, [businessId, branchId]);

  // Seed staff
  (storage as any).db.run(`
    INSERT INTO staff (id, business_id, branch_id, name, phone, role, is_active, created_at)
    VALUES ('staff_34_01', ?, ?, 'Ko Zaw', '0911223344', 'THERAPIST', 1, datetime('now'))
  `, [businessId, branchId]);

  // 1. Service Package Creation & Update
  await runTest('1. Create Service Package template', async () => {
    const pkg = await storage.executeServicePackageCreate({
      packageId: 'spkg_aroma_10',
      businessId,
      branchId,
      name: 'Aroma 10 Sessions Package',
      nameMm: 'အနံ့ကုထုံး ၁၀ ကြိမ် အထူးအစီအစဉ်',
      serviceId: 'srv_spa_01',
      serviceName: 'Aroma Body Massage',
      totalQty: 10,
      priceMMK: 200000,
      validityDays: 90,
      isActive: true,
      userId,
    });
    assert(pkg.packageId === 'spkg_aroma_10', 'Package ID match');
    assert(pkg.totalQty === 10, 'Total Qty match');
    assert(pkg.priceMMK === 200000, 'Price match');
  });

  // 2. Customer Package Purchase
  let custPkgId = 'cpkg_dawhla_01';
  await runTest('2. Customer Purchases Service Package with Cash', async () => {
    const res = await storage.executePackagePurchase({
      customerPackageId: custPkgId,
      businessId,
      branchId,
      customerId: 'cust_34_01',
      customerName: 'Daw Hla',
      customerPhone: '09987654321',
      packageId: 'spkg_aroma_10',
      paymentMethod: 'cash',
      userId,
      userName,
    });
    assert(res.customerPackageId === custPkgId, 'Customer package created');
    assert(res.remainingQty === 10, 'Initial remaining quantity is 10');
    assert(res.status === 'active', 'Status active');
  });

  // 3. Customer Package Redemption
  await runTest('3. Redeem 2 Sessions from Customer Package', async () => {
    const redRes = await storage.executePackageRedeem({
      customerPackageId: custPkgId,
      quantity: 2,
      businessId,
      branchId,
      notes: 'Session 1 & 2 used',
      userId,
      userName,
    });
    assert(redRes.quantityRedeemed === 2, 'Redeemed 2');
    assert(redRes.remainingQty === 8, 'Remaining 8');
    assert(redRes.usedQty === 2, 'Used 2');
    assert(redRes.status === 'active', 'Status active');
  });

  // 4. Over-Redemption Prevention
  await runTest('4. Prevent Over-Redemption beyond remaining balance', async () => {
    let errorThrown = false;
    try {
      await storage.executePackageRedeem({
        customerPackageId: custPkgId,
        quantity: 9, // only 8 remaining
        businessId,
        branchId,
        userId,
        userName,
      });
    } catch (err: any) {
      errorThrown = true;
      assert(err.message.includes('Over-redemption prevented'), 'Correct error message');
    }
    assert(errorThrown, 'Must throw error on over-redemption');
  });

  // 5. Package Exhaustion
  await runTest('5. Redeem remaining 8 sessions to exhaust package', async () => {
    const redRes = await storage.executePackageRedeem({
      customerPackageId: custPkgId,
      quantity: 8,
      businessId,
      branchId,
      userId,
      userName,
    });
    assert(redRes.remainingQty === 0, 'Remaining 0');
    assert(redRes.usedQty === 10, 'Used 10');
    assert(redRes.status === 'exhausted', 'Status set to exhausted');
  });

  // 6. Package Cancellation
  await runTest('6. Owner/Manager Package Cancellation', async () => {
    const cancelRes = await storage.executePackageCancel({
      customerPackageId: custPkgId,
      businessId,
      branchId,
      reason: 'Customer requested cancellation/refund',
      userId,
      userName,
    });
    assert(cancelRes.status === 'cancelled', 'Package cancelled');
  });

  // 7. Membership Plan Creation & Update
  await runTest('7. Create VIP Membership Plan', async () => {
    const plan = await storage.executeMembershipPlanCreate({
      planId: 'mplan_vip_gold',
      businessId,
      branchId,
      name: 'Gold VIP Membership (30 Days)',
      nameMm: 'ရွှေအဆင့် VIP အသင်းဝင်',
      durationDays: 30,
      priceMMK: 50000,
      discountPercent: 15,
      benefitsSummary: '15% discount on all services and rooms',
      isActive: true,
      userId,
    });
    assert(plan.planId === 'mplan_vip_gold', 'Plan ID match');
    assert(plan.discountPercent === 15, 'Discount percent match');
  });

  // 8. Membership Purchase
  let memId = 'cmem_dawhla_01';
  await runTest('8. Customer Purchases Membership', async () => {
    const memRes = await storage.executeMembershipPurchase({
      membershipId: memId,
      businessId,
      branchId,
      customerId: 'cust_34_01',
      customerName: 'Daw Hla',
      customerPhone: '09987654321',
      planId: 'mplan_vip_gold',
      paymentMethod: 'cash',
      userId,
      userName,
    });
    assert(memRes.membershipId === memId, 'Membership ID match');
    assert(memRes.discountPercent === 15, 'Discount applied');
    assert(memRes.status === 'active', 'Status active');
  });

  // 9. Membership Cancellation
  await runTest('9. Owner Cancels Membership', async () => {
    const cancelRes = await storage.executeMembershipCancel({
      membershipId: memId,
      businessId,
      branchId,
      reason: 'Member requested early termination',
      userId,
      userName,
    });
    assert(cancelRes.status === 'cancelled', 'Membership cancelled');
  });

  // 10. Gift Card Issue
  let giftCardId = 'gc_34_001';
  let cardNumber = 'GC-2026-998877';
  await runTest('10. Issue Gift Card with 100,000 MMK', async () => {
    const card = await storage.executeGiftCardIssue({
      giftCardId,
      cardNumber,
      businessId,
      branchId,
      initialAmountMMK: 100000,
      customerId: 'cust_34_01',
      customerName: 'Daw Hla',
      paymentMethod: 'cash',
      notes: 'Gift card for holiday',
      userId,
      userName,
    });
    assert(card.cardNumber === cardNumber, 'Card number match');
    assert(card.initialAmountMMK === 100000, 'Initial amount 100,000');
    assert(card.currentBalanceMMK === 100000, 'Current balance 100,000');
  });

  // 11. Gift Card Partial Redemption
  await runTest('11. Redeem 40,000 MMK from Gift Card', async () => {
    const redRes = await storage.executeGiftCardRedeem({
      giftCardIdOrNumber: cardNumber,
      amountMMK: 40000,
      businessId,
      branchId,
      notes: 'Partial payment on checkout',
      userId,
      userName,
    });
    assert(redRes.amountMMK === 40000, 'Redeemed 40,000');
    assert(redRes.balanceBeforeMMK === 100000, 'Balance before was 100,000');
    assert(redRes.balanceAfterMMK === 60000, 'Balance after is 60,000');
    assert(redRes.status === 'active', 'Still active');
  });

  // 12. Gift Card Overdraft Prevention
  await runTest('12. Prevent Gift Card Overdraft', async () => {
    let errCaught = false;
    try {
      await storage.executeGiftCardRedeem({
        giftCardIdOrNumber: cardNumber,
        amountMMK: 70000, // only 60,000 left
        businessId,
        branchId,
        userId,
        userName,
      });
    } catch (err: any) {
      errCaught = true;
      assert(err.message.includes('Insufficient gift card balance'), 'Throws overdraft error');
    }
    assert(errCaught, 'Overdraft blocked');
  });

  // 13. Gift Card Exhaustion
  await runTest('13. Redeem remaining 60,000 MMK to exhaust Gift Card', async () => {
    const redRes = await storage.executeGiftCardRedeem({
      giftCardIdOrNumber: cardNumber,
      amountMMK: 60000,
      businessId,
      branchId,
      userId,
      userName,
    });
    assert(redRes.balanceAfterMMK === 0, 'Balance 0');
    assert(redRes.status === 'exhausted', 'Card status set to exhausted');
  });

  // 14. Gift Card Void
  await runTest('14. Void Gift Card', async () => {
    const voidRes = await storage.executeGiftCardVoid({
      giftCardIdOrNumber: cardNumber,
      businessId,
      branchId,
      reason: 'Customer void request',
      userId,
      userName,
    });
    assert(voidRes.status === 'cancelled', 'Card voided/cancelled');
  });

  // 15. Staff Tip Recording
  await runTest('15. Record Staff Tip (attributing to staff ledger bonus & cash inflow)', async () => {
    const tipRes = await storage.executeTipRecord({
      tipId: 'tip_34_001',
      businessId,
      branchId,
      staffId: 'staff_34_01',
      staffName: 'Ko Zaw',
      amountMMK: 10000,
      paymentMethod: 'cash',
      receivedBy: 'Cashier 1',
      notes: 'Great massage service tip',
      userId,
      userName,
    });
    assert(tipRes.tipId === 'tip_34_001', 'Tip ID match');
    assert(tipRes.amountMMK === 10000, 'Tip amount 10,000 MMK');
    assert(tipRes.staffName === 'Ko Zaw', 'Staff attribution match');
  });

  // 16. Atomic Mixed Payment
  await runTest('16. Atomic Mixed Payment (Cash + KBZPay + Customer Credit)', async () => {
    // Seed test invoice
    const invoiceId = 'inv_mix_34_01';
    (storage as any).db.run(`
      INSERT INTO invoices (
        id, business_id, branch_id, invoice_number, customer_id, customer_name, subtotal_mmk, discount_mmk,
        total_mmk, paid_mmk, payment_method, payment_status, date, created_at
      ) VALUES (?, ?, ?, 'INV-MIX-001', 'cust_34_01', 'Daw Hla', 100000, 0, 100000, 0, 'mixed', 'unpaid', date('now'), datetime('now'))
    `, [invoiceId, businessId, branchId]);

    const mixedRes = await storage.executeMixedPayment({
      invoiceId,
      businessId,
      branchId,
      payments: [
        { method: 'cash', amountMMK: 50000, tenderedMMK: 50000, changeMMK: 0 },
        { method: 'kbzpay', amountMMK: 30000, referenceNo: 'KPAY123456' },
        { method: 'credit', amountMMK: 20000, notes: 'Remaining 20k to ledger debt' },
      ],
      userId,
      userName,
    });

    assert(mixedRes.invoiceId === invoiceId, 'Invoice ID match');
    assert(mixedRes.totalPaidMMK === 100000, 'Total paid 100,000 MMK');
    assert(mixedRes.status === 'credit' || mixedRes.status === 'paid', 'Status completed');
  });

  // Clean up
  await storage.close();
  try {
    fs.unlinkSync(testDbPath);
  } catch {}

  console.log('======================================================');
  console.log(`PHASE 34 COMPLETED: ${testPassed}/${testPassed + testFailed} TESTS PASSED`);
  console.log('======================================================');

  if (testFailed > 0) {
    throw new Error(`Phase 34 tests failed with ${testFailed} failures.`);
  }
}

runPhase34Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
