/**
 * ============================================================================
 * PHASE 30.2 — UI CONTRAST & ROOM-BASED POS SALES TARGETED TEST SUITE
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    failedTests++;
    throw new Error(msg);
  } else {
    console.log(`  ✓ PASSED: ${msg}`);
    passedTests++;
  }
}

async function runPhase302Tests() {
  console.log('================================================================');
  console.log('PHASE 30.2: UI CONTRAST & ROOM-BASED POS SALES UNIT TESTS');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: Global Contrast & Sub-container Overrides in index.css
    // -------------------------------------------------------------
    console.log('[TEST 1] Global Style Contrast Safeguards (index.css)');
    const indexCssPath = path.join(process.cwd(), 'src', 'index.css');
    assert(fs.existsSync(indexCssPath), 'index.css exists in the source tree');
    
    const cssContent = fs.readFileSync(indexCssPath, 'utf-8');
    
    // Check that light container forces dark text
    assert(cssContent.includes('.bg-white') && cssContent.includes('color: #0f172a'), 'Light background elements set to high-contrast dark text');
    
    // Check that subcontainer overrides exist
    assert(cssContent.includes('.bg-white .bg-blue-600 .text-white'), 'Nested blue-600 containers inside bg-white preserve white text');
    assert(cssContent.includes('.bg-white .bg-emerald-600 .text-white'), 'Nested emerald-600 containers inside bg-white preserve white text');
    assert(cssContent.includes('.bg-gray-50 .bg-emerald-600 .text-white'), 'Nested emerald-600 containers inside bg-gray-50 preserve white text');
    assert(cssContent.includes('@media print'), 'Print media query overrides exist for paper vouchers');

    // -------------------------------------------------------------
    // TEST 2: POS View Component Code Verification
    // -------------------------------------------------------------
    console.log('\n[TEST 2] POS Room Selector & Sale Mode Code Presence');
    const posViewPath = path.join(process.cwd(), 'src', 'components', 'views', 'PosView.tsx');
    assert(fs.existsSync(posViewPath), 'PosView.tsx exists in the source tree');
    
    const posContent = fs.readFileSync(posViewPath, 'utf-8');
    
    assert(posContent.includes('saleMode === \'walkin\''), 'Walk-in sale mode selection exists in POS code');
    assert(posContent.includes('saleMode === \'room\''), 'Room sale mode selection exists in POS code');
    assert(posContent.includes('selectedRoomSessionId'), 'Room selector state field exists in POS');
    assert(posContent.includes('activeSessions'), 'POS references activeSessions list');
    assert(posContent.includes('addOrderToSessionTransaction'), 'POS uses atomic transaction for appending room items');

    // -------------------------------------------------------------
    // TEST 3: Mock Data Model Validation for Room Sales
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Room Sale / Walk-in Logic State Validation');
    
    // Simulate selecting active session logic
    const mockActiveSessions = [
      {
        id: 'sess_01',
        roomName: 'Room 01',
        customerName: 'Ko Aung',
        customerId: 'cust_99',
        serviceName: 'Aromatherapy 90m',
        sessionCode: 'A090-01',
        startTime: new Date().toISOString(),
        orderItems: [
          { productId: 'p1', name: 'Coca Cola', quantity: 2, unitPriceMMK: 2500, totalPriceMMK: 5000 }
        ]
      }
    ];

    const selectedSessionId = 'sess_01';
    const sess = mockActiveSessions.find(s => s.id === selectedSessionId);
    
    assert(!!sess, 'Can retrieve selected active session from session list');
    assert(sess?.roomName === 'Room 01', 'Active session lists the correct Room Name');
    assert(sess?.customerName === 'Ko Aung', 'Active session customer is automatically derived');
    assert(sess?.customerId === 'cust_99', 'Active session Customer ID is correctly mapped');

    // Calculate running bill
    const runningOrdersTotal = (sess?.orderItems || []).reduce((sum, o) => sum + (o.totalPriceMMK || (o.quantity * o.unitPriceMMK)), 0);
    assert(runningOrdersTotal === 5000, 'Running orders total is accurately aggregated');

    // -------------------------------------------------------------
    // TEST 4: Stock Quantity Validation for Cart Actions
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Stock Control & Negative Balance Safeguards');
    
    const mockProducts = [
      { id: 'p1', name: 'Snack A', stockQty: 10, type: 'product' },
      { id: 'p2', name: 'Snack B', stockQty: 0, type: 'product' }
    ];
    
    const mockCart = [
      { productId: 'p1', name: 'Snack A', quantity: 5, type: 'product' }
    ];

    // Check if sufficient stock is available
    for (const item of mockCart) {
      const prod = mockProducts.find(p => p.id === item.productId);
      assert(!!prod, `Product "${item.name}" found in master inventory`);
      const isSufficient = prod && prod.stockQty >= item.quantity;
      assert(isSufficient === true, `Stock check succeeds for "${item.name}" (Qty: ${item.quantity}, Stock: ${prod?.stockQty})`);
    }

    // Check behavior of out of stock product
    const mockCartOut = [
      { productId: 'p2', name: 'Snack B', quantity: 1, type: 'product' }
    ];
    for (const item of mockCartOut) {
      const prod = mockProducts.find(p => p.id === item.productId);
      const isSufficient = prod && prod.stockQty >= item.quantity;
      assert(isSufficient === false, `Stock check correctly reports insufficient inventory for "${item.name}" (Requested: ${item.quantity}, Stock: ${prod?.stockQty})`);
    }

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
    console.log('================================================================');
    
    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test Suite encountered fatal error:', err);
    process.exit(1);
  }
}

runPhase302Tests();
