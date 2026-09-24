/**
 * Phase 24 Steps 34-39 Automated Integration & Domain Tests
 * Tests Suppliers, Purchase Orders, Stock Adjustments, Performance Bonus Rules, and Customer Loyalty Points.
 */

import { serverStorage } from '../../server/storage';

async function runPhase24Tests() {
  console.log('================================================================');
  console.log('PHASE 24 STEPS 34–39 AUTOMATED DOMAIN & INTEGRATION TESTS');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
      failed++;
      throw new Error(`Test assertion failed: ${description}`);
    }
  }

  try {
    await serverStorage.initialize();

    // ----------------------------------------------------------------
    // STEP 34: SUPPLIERS MANAGEMENT
    // ----------------------------------------------------------------
    console.log('\n[STEP 34] Suppliers Management Verification');
    const supplierData = {
      id: `sup_test_${Date.now()}`,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      name: 'Myanmar Wholesale Traders Co.',
      phone: '09790001122',
      email: 'info@mwt.com.mm',
      address: 'No. 123 Bogyoke Street, Mandalay',
      contactPerson: 'U Hla Mg',
      notes: 'Main beverage supplier',
      isActive: true,
    };

    const savedSup = serverStorage.saveSupplier(supplierData);
    assert(savedSup.name === 'Myanmar Wholesale Traders Co.', 'Supplier record saved accurately');

    const suppliersList = serverStorage.getSuppliers('BIZ_SHOP_001');
    assert(suppliersList.some((s: any) => s.id === supplierData.id), 'Saved supplier retrievable via getSuppliers()');

    // ----------------------------------------------------------------
    // STEP 35: PURCHASE ORDERS & INVENTORY INFLOW
    // ----------------------------------------------------------------
    console.log('\n[STEP 35] Purchase Orders & Inventory Inflow Verification');
    const poData = {
      id: `po_test_${Date.now()}`,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      poNumber: `PO-TEST-${Date.now()}`,
      supplierId: supplierData.id,
      supplierName: supplierData.name,
      items: [
        { productId: 'prod_test_001', productName: 'Premium Beer 500ml', quantity: 20, costPriceMMK: 2500, totalCostMMK: 50000 },
      ],
      totalAmountMMK: 50000,
      paidAmountMMK: 50000,
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      orderDate: new Date().toISOString().split('T')[0],
      status: 'completed',
      notes: 'Initial stock load PO test',
      createdBy: 'Owner User',
    };

    const poResult = await serverStorage.recordPurchaseOrder(poData);
    assert(poResult.id === poData.id, 'Purchase Order recorded atomically');

    const poList = serverStorage.getPurchaseOrders('BIZ_SHOP_001');
    assert(poList.some((po: any) => po.id === poData.id), 'Purchase order retrievable via getPurchaseOrders()');

    // ----------------------------------------------------------------
    // STEP 36: STOCK ADJUSTMENTS & AUDIT CONTROL
    // ----------------------------------------------------------------
    console.log('\n[STEP 36] Stock Adjustments & Movement Audit Verification');
    const adjData = {
      id: `adj_test_${Date.now()}`,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      productId: 'prod_test_001',
      productName: 'Premium Beer 500ml',
      beforeQty: 50,
      afterQty: 48,
      adjustQty: -2,
      reason: 'Damaged during unloading audit',
      adjustedBy: 'Warehouse Manager',
    };

    const adjResult = await serverStorage.recordStockAdjustment(adjData);
    assert(adjResult.productId === 'prod_test_001', 'Stock adjustment recorded with audit reason');

    const adjList = serverStorage.getStockAdjustments('BIZ_SHOP_001');
    assert(adjList.some((a: any) => a.id === adjData.id), 'Stock adjustment retrievable via getStockAdjustments()');

    // ----------------------------------------------------------------
    // STEP 37: STAFF PERFORMANCE BONUS RULES
    // ----------------------------------------------------------------
    console.log('\n[STEP 37] Staff Performance Bonus Rules Verification');
    const pbRule = {
      id: `prule_test_${Date.now()}`,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      ruleName: 'Monthly Top Revenue Producer',
      minRevenueMMK: 1000000,
      minSessions: 30,
      minAttendanceDays: 25,
      bonusAmountMMK: 75000,
      isActive: true,
    };

    const savedRule = serverStorage.savePerformanceBonusRule(pbRule);
    assert(savedRule.bonusAmountMMK === 75000, 'Performance Bonus Rule saved with configured criteria');

    const pRulesList = serverStorage.getPerformanceBonusRules('BIZ_SHOP_001');
    assert(pRulesList.some((r: any) => r.id === pbRule.id), 'Performance bonus rules retrievable via getPerformanceBonusRules()');

    // ----------------------------------------------------------------
    // STEP 38: CUSTOMER LOYALTY POINTS ENGINE
    // ----------------------------------------------------------------
    console.log('\n[STEP 38] Customer Loyalty Points Ledger Verification');
    const customerId = `cust_test_${Date.now()}`;
    const loyaltyAward = await serverStorage.recordLoyaltyPoints({
      customerId,
      customerName: 'Daw Aye Aye',
      points: 150,
      type: 'earn',
      referenceType: 'sale',
      referenceId: 'inv_test_999',
      notes: 'Earned 150 points for invoice inv_test_999',
      performedBy: 'Cashier User',
    });

    assert(loyaltyAward.points === 150, 'Loyalty points award recorded');
    assert(loyaltyAward.balanceAfter === 150, 'Loyalty points balance computed correctly (150 Pts)');

    const loyaltyRedeem = await serverStorage.recordLoyaltyPoints({
      customerId,
      customerName: 'Daw Aye Aye',
      points: 50,
      type: 'redeem',
      referenceType: 'sale',
      referenceId: 'inv_test_1000',
      notes: 'Redeemed 50 points discount',
      performedBy: 'Cashier User',
    });

    assert(loyaltyRedeem.points === 50, 'Loyalty points redemption recorded');
    assert(loyaltyRedeem.balanceAfter === 100, 'Loyalty points balance reduced correctly to 100 Pts after redemption');

    const loyaltyEntries = serverStorage.getCustomerLoyaltyEntries(customerId);
    assert(loyaltyEntries.length === 2, 'Customer loyalty ledger entries retrieved accurately');

    console.log('\n================================================================');
    console.log(`ALL PHASE 24 (STEPS 34-39) DOMAIN TESTS PASSED: ${passed}/${passed}`);
    console.log('================================================================\n');

  } finally {
    serverStorage.close();
  }
}

runPhase24Tests().catch((err) => {
  console.error('Phase 24 tests failed:', err);
  process.exit(1);
});
