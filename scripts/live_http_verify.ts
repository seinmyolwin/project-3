/**
 * ============================================================================
 * LIVE HTTP ENDPOINT AUDIT & VERIFICATION
 * ============================================================================
 */

const BASE_URL = 'http://127.0.0.1:3000/api';

async function request(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`LIVE HTTP AUDIT FAILED: ${message}`);
}

async function runLiveVerification() {
  console.log('\n======================================================');
  console.log('LIVE HTTP VERIFICATION — LOCAL SERVER & DB BOUNDARY');
  console.log('======================================================\n');

  // 1. Health Check
  console.log('1. Testing GET /api/health...');
  const healthRes = await request('/health');
  assert(healthRes.status === 200, `Health status must be 200, got ${healthRes.status}`);
  assert(healthRes.data?.status === 'ok', 'Health status field must be "ok"');
  console.log('   ✓ Health response:', JSON.stringify(healthRes.data));

  // 2. Authentication Rejection (Invalid Credentials)
  console.log('2. Testing POST /api/auth/login (Invalid credentials)...');
  const invalidLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'aungmin', password: 'wrongpassword' }),
  });
  assert(invalidLogin.status === 401, `Invalid login should return 401, got ${invalidLogin.status}`);
  console.log('   ✓ Rejected correctly:', JSON.stringify(invalidLogin.data));

  // 3. Authentication Success (Valid Owner Credentials)
  console.log('3. Testing POST /api/auth/login (Valid credentials)...');
  const validLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'aungmin', password: 'aungmin123', deviceId: 'DEV_TEST_CLIENT' }),
  });
  assert(validLogin.status === 200, `Login should succeed with 200, got ${validLogin.status}`);
  const token = validLogin.data?.token;
  assert(Boolean(token), 'Login should return session token');
  console.log('   ✓ Token acquired:', token.substring(0, 18) + '...');

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 4. Authorization Enforcement (Unauthenticated Access)
  console.log('4. Testing Protected Endpoint without Token...');
  const unauthRes = await request('/devices/list');
  assert(unauthRes.status === 401, `Unauthenticated request should return 401, got ${unauthRes.status}`);
  console.log('   ✓ Unauthenticated request blocked');

  // 5. Device Registration
  console.log('5. Testing POST /api/devices/register...');
  const regRes = await request('/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: 'DEV_LIVE_TAB_01',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      deviceName: 'Live Cashier Tablet 01',
      deviceRole: 'CASHIER',
    }),
  });
  assert(regRes.status === 200, `Device registration should return 200, got ${regRes.status}`);
  console.log('   ✓ Registered device:', regRes.data?.device?.deviceName);

  // 6. Dynamic Pairing Code Generation & Use
  console.log('6. Testing Dynamic Pairing Code Flow...');
  const pairCodeRes = await request('/devices/pairing-codes', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ roleAllowed: 'CASHIER', expiresInMinutes: 30 }),
  });
  assert(pairCodeRes.status === 200, `Pairing code generation should return 200, got ${pairCodeRes.status}`);
  const pairingCode = pairCodeRes.data?.pairingCode;
  console.log('   ✓ Dynamic Pairing Code generated:', pairingCode);

  const pairExecRes = await request('/devices/pair', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: 'DEV_LIVE_PAIRED_02',
      pairingCode,
      deviceInfo: { deviceName: 'Paired Front Tablet' },
    }),
  });
  assert(pairExecRes.status === 200, `Pairing execution should return 200, got ${pairExecRes.status}`);
  console.log('   ✓ Device paired successfully:', pairExecRes.data?.device?.deviceName);

  // 7. Business Isolation Verification
  console.log('7. Testing Business Isolation Guard...');
  const bizIsoRes = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: 'op_biz_iso_001',
      businessId: 'BIZ_ATTACKER_FOREIGN',
      branchId: 'BR_MAIN',
      operationType: 'EXPENSE',
      payload: { amountMMK: 1000 },
    }),
  });
  assert(bizIsoRes.status === 403, `Cross-business operation must return 403, got ${bizIsoRes.status}`);
  console.log('   ✓ Business isolation enforced:', bizIsoRes.data?.error);

  // 8. Financial Operation: Session Start & Concurrency Lock
  console.log('8. Testing POST /api/operations/process (SESSION_START)...');
  const sessionOpId = 'op_sess_' + Date.now();
  const sessionRes = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: sessionOpId,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'SESSION_START',
      entityType: 'SESSION',
      entityId: 'sess_live_http_01',
      payload: { roomId: 'room_ps5_1', customerName: 'Gaming Player 1', hourlyRateMMK: 15000 },
    }),
  });
  assert(sessionRes.status === 200, `Session start should return 200, got ${sessionRes.status}`);
  console.log('   ✓ Session started:', JSON.stringify(sessionRes.data?.result));

  // Concurrency Conflict Test on Same Room
  console.log('9. Testing Concurrency Conflict on Occupied Room...');
  const collideSessRes = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: 'op_sess_collide_' + Date.now(),
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'SESSION_START',
      entityType: 'SESSION',
      entityId: 'sess_live_http_02_collision',
      payload: { roomId: 'room_ps5_1', customerName: 'Colliding Player', hourlyRateMMK: 15000 },
    }),
  });
  assert(collideSessRes.status === 409, `Concurrent session on occupied room must return 409, got ${collideSessRes.status}`);
  console.log('   ✓ Collision rejected with 409:', collideSessRes.data?.error);

  // 10. Financial Operation: Payment & Idempotency Replay
  console.log('10. Testing POST /api/operations/process (PAYMENT & IDEMPOTENCY)...');
  const payOpId = 'op_pay_' + Date.now();
  const payPayload = {
    invoiceNumber: 'INV-LIVE-001',
    subtotalMMK: 45000,
    discountMMK: 0,
    totalMMK: 45000,
    paidMMK: 45000,
    paymentMethod: 'kpay',
    customerId: 'cust_101',
  };

  const payRes1 = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: payOpId,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'PAYMENT',
      entityType: 'INVOICE',
      entityId: 'inv_live_http_01',
      payload: payPayload,
    }),
  });
  assert(payRes1.status === 200, `Payment must return 200, got ${payRes1.status}`);
  assert(payRes1.data?.status === 'PROCESSED', 'Status should be PROCESSED');
  console.log('   ✓ Payment processed:', JSON.stringify(payRes1.data?.result));

  // Replay Identical Request
  console.log('11. Testing Idempotent Replay (Same ID + Same Payload)...');
  const payRes2 = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: payOpId,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'PAYMENT',
      entityType: 'INVOICE',
      entityId: 'inv_live_http_01',
      payload: payPayload,
    }),
  });
  assert(payRes2.status === 200, `Replay must return 200, got ${payRes2.status}`);
  assert(payRes2.data?.status === 'ALREADY_PROCESSED', 'Status should be ALREADY_PROCESSED');
  console.log('   ✓ Idempotent replay verified (No duplicate charge):', payRes2.data?.status);

  // Conflict on Differing Payload
  console.log('12. Testing Idempotency Conflict (Same ID + Different Payload)...');
  const payResConflict = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: payOpId,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'PAYMENT',
      entityType: 'INVOICE',
      entityId: 'inv_live_http_01',
      payload: { ...payPayload, totalMMK: 999999 }, // Conflicting amount
    }),
  });
  assert(payResConflict.status === 409, `Payload conflict must return 409, got ${payResConflict.status}`);
  assert(payResConflict.data?.error === 'IDEMPOTENCY_CONFLICT', 'Error should be IDEMPOTENCY_CONFLICT');
  console.log('   ✓ Idempotency conflict detected & blocked:', payResConflict.data?.error);

  // 13. Financial Operation: Customer Credit & Policy
  console.log('13. Testing POST /api/operations/process (CUSTOMER_CREDIT)...');
  const creditRes = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: 'op_credit_' + Date.now(),
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'CUSTOMER_CREDIT',
      entityType: 'CUSTOMER',
      entityId: 'cust_101',
      payload: { customerId: 'cust_101', amountMMK: 30000, notes: 'VIP Bill on Tab' },
    }),
  });
  assert(creditRes.status === 200, `Customer credit should return 200, got ${creditRes.status}`);
  console.log('   ✓ Customer credit posted:', JSON.stringify(creditRes.data?.result));

  // 14. Financial Operation: Cash Closing & Double Close Protection
  console.log('14. Testing POST /api/operations/process (CASH_CLOSING)...');
  const todayStr = new Date().toISOString().split('T')[0];
  const closeOpId = 'op_close_' + Date.now();
  const closeRes = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: closeOpId,
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'CASH_CLOSING',
      entityType: 'CASH_CLOSING',
      entityId: 'ccl_live_http_01',
      payload: {
        date: todayStr,
        openingCashMMK: 100000,
        cashSalesMMK: 350000,
        debtRepaymentsMMK: 20000,
        cashExpensesMMK: 15000,
        actualCashMMK: 455000,
      },
    }),
  });
  assert(closeRes.status === 200, `Cash closing should return 200, got ${closeRes.status}`);
  console.log('   ✓ Cash closing completed:', JSON.stringify(closeRes.data?.result));

  // Attempt duplicate closing for same date
  console.log('15. Testing Duplicate Cash Closing Prevention...');
  const dupCloseRes = await request('/operations/process', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operationId: 'op_close_dup_' + Date.now(),
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'CASH_CLOSING',
      entityType: 'CASH_CLOSING',
      entityId: 'ccl_live_http_02',
      payload: {
        date: todayStr,
        openingCashMMK: 100000,
        cashSalesMMK: 350000,
        debtRepaymentsMMK: 20000,
        cashExpensesMMK: 15000,
        actualCashMMK: 455000,
      },
    }),
  });
  assert(dupCloseRes.status === 409, `Duplicate cash closing must return 409, got ${dupCloseRes.status}`);
  console.log('   ✓ Duplicate cash closing prevented:', dupCloseRes.data?.error);

  // 16. Audit Logs Query
  console.log('16. Testing GET /api/audit/logs...');
  const auditRes = await request('/audit/logs', { headers: authHeaders });
  assert(auditRes.status === 200, `Audit logs query should return 200, got ${auditRes.status}`);
  console.log('   ✓ Total audit entries recorded:', auditRes.data?.count);

  // 17. Backup Export
  console.log('17. Testing POST /api/system/backup...');
  const backupRes = await request('/system/backup', { method: 'POST', headers: authHeaders });
  assert(backupRes.status === 200, `Backup should return 200, got ${backupRes.status}`);
  console.log('   ✓ Backup exported successfully to:', backupRes.data?.backupPath);

  console.log('\n======================================================');
  console.log('ALL LIVE HTTP VERIFICATION STEPS PASSED SUCCESSFULLY (17/17)');
  console.log('======================================================\n');
}

runLiveVerification().catch(err => {
  console.error('LIVE HTTP VERIFICATION FAILED:', err);
  process.exit(1);
});
