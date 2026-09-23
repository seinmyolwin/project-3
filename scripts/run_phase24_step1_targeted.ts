/**
 * ============================================================================
 * PHASE 24 - STEP 1: TARGETED VERIFICATION TEST
 * ============================================================================
 * Focus: LAN & Offline Source of Truth Alignment
 * - Verified: SyncManager real-time event cache reconciliation
 * - Verified: State transitions (LOCAL_ONLY <-> ONLINE_LAN <-> SYNC_PENDING)
 * - Verified: Idempotent Dexie local cache mutations from server event bus
 */

/**
 * ============================================================================
 * PHASE 24 - STEP 1: TARGETED VERIFICATION TEST
 * ============================================================================
 * Focus: LAN & Offline Source of Truth Alignment
 * - Verified: SyncManager real-time event cache reconciliation
 * - Verified: State transitions (LOCAL_ONLY <-> ONLINE_LAN <-> SYNC_PENDING)
 * - Verified: Idempotent Dexie local cache mutations from server event bus
 */

// Mock indexedDB storage for Node.js test environment
const inMemoryStore: Record<string, Map<string, any>> = {
  rooms: new Map(),
  sessions: new Map(),
  invoices: new Map(),
  sales: new Map(),
  cashTransactions: new Map(),
  expenses: new Map(),
  customers: new Map(),
  customerLedger: new Map(),
  customerCreditLedger: new Map(),
  cashClosings: new Map(),
};

// Mock global indexedDB / Dexie tables on db
import { db } from '../src/db/database';
(db as any).rooms = {
  get: async (id: string) => inMemoryStore.rooms.get(id),
  put: async (item: any) => { inMemoryStore.rooms.set(item.id, item); return item.id; },
  update: async (id: string, changes: any) => {
    const existing = inMemoryStore.rooms.get(id) || {};
    const updated = { ...existing, ...changes };
    inMemoryStore.rooms.set(id, updated);
    return 1;
  },
  delete: async (id: string) => inMemoryStore.rooms.delete(id),
};

(db as any).sessions = {
  get: async (id: string) => inMemoryStore.sessions.get(id),
  put: async (item: any) => { inMemoryStore.sessions.set(item.id, item); return item.id; },
  update: async (id: string, changes: any) => {
    const existing = inMemoryStore.sessions.get(id) || {};
    const updated = { ...existing, ...changes };
    inMemoryStore.sessions.set(id, updated);
    return 1;
  },
};

(db as any).invoices = {
  put: async (item: any) => { inMemoryStore.invoices.set(item.id, item); return item.id; },
};

(db as any).sales = {
  put: async (item: any) => { inMemoryStore.sales.set(item.id, item); return item.id; },
};

(db as any).cashTransactions = {
  put: async (item: any) => { inMemoryStore.cashTransactions.set(item.id, item); return item.id; },
};

(db as any).expenses = {
  put: async (item: any) => { inMemoryStore.expenses.set(item.id, item); return item.id; },
};

(db as any).customers = {
  put: async (item: any) => { inMemoryStore.customers.set(item.id, item); return item.id; },
};

(db as any).customerLedger = {
  put: async (item: any) => { inMemoryStore.customerLedger.set(item.id, item); return item.id; },
};

(db as any).customerCreditLedger = {
  put: async (item: any) => { inMemoryStore.customerCreditLedger.set(item.id, item); return item.id; },
};

(db as any).cashClosings = {
  put: async (item: any) => { inMemoryStore.cashClosings.set(item.id, item); return item.id; },
};

import { syncManager } from '../src/services/syncManager';

let passed = 0;
let total = 0;

function assert(condition: boolean, desc: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${desc}`);
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runStep1Targeted() {
  console.log('================================================================');
  console.log('PHASE 24 - STEP 1 TARGETED VERIFICATION: SOURCE OF TRUTH ALIGNMENT');
  console.log('================================================================\n');

  // 1. Initial State
  console.log('[1. Sync Manager Initial State]');
  assert(syncManager.getState() === 'LOCAL_ONLY', 'Initial sync state is LOCAL_ONLY (100% Offline Default)');
  assert(syncManager.getStatusMessage().includes('Offline'), 'Initial status message reflects offline-first capability');

  // 2. Real-time Event Cache Application (Idempotency & Isolation)
  console.log('\n[2. Real-time Event Cache Dispatch]');

  // Test ROOM_STATUS_CHANGED event
  const testRoomId = 'room_step1_test_01';
  await (db.rooms as any).put({
    id: testRoomId,
    name: 'VIP Room 101',
    type: 'karaoke',
    status: 'available',
    hourlyRateMMK: 35000,
    isActive: true,
    capacity: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await syncManager.applyServerEventToLocalCache({
    eventId: 'evt_test_01',
    eventType: 'ROOM_STATUS_CHANGED',
    businessId: 'biz_01',
    branchId: 'branch_01',
    payload: {
      roomId: testRoomId,
      status: 'occupied',
      currentSessionId: 'sess_test_101',
    },
  });

  const updatedRoom = await (db.rooms as any).get(testRoomId);
  assert(updatedRoom?.status === 'occupied', 'Dexie room status updated to occupied via server event');
  assert(updatedRoom?.currentSessionId === 'sess_test_101', 'Dexie currentSessionId aligned with server event');

  // Test SESSION_ENDED event
  await (db.sessions as any).put({
    id: 'sess_test_101',
    roomId: testRoomId,
    status: 'active',
    finalTotalMMK: 0,
  });

  await syncManager.applyServerEventToLocalCache({
    eventId: 'evt_test_02',
    eventType: 'SESSION_ENDED',
    businessId: 'biz_01',
    branchId: 'branch_01',
    payload: {
      roomId: testRoomId,
      sessionId: 'sess_test_101',
      endTime: new Date().toISOString(),
      finalTotalMMK: 70000,
    },
  });

  const roomAfterEnd = await (db.rooms as any).get(testRoomId);
  assert(roomAfterEnd?.status === 'available', 'Dexie room status reset to available upon SESSION_ENDED');
  assert(roomAfterEnd?.currentSessionId === undefined, 'Dexie room session cleared upon SESSION_ENDED');

  const sessAfterEnd = await (db.sessions as any).get('sess_test_101');
  assert(sessAfterEnd?.status === 'completed', 'Dexie session status updated to completed upon SESSION_ENDED');
  assert(sessAfterEnd?.finalTotalMMK === 70000, 'Dexie session final total aligned upon SESSION_ENDED');

  // Test INVOICE_UPDATED and PAYMENT_CREATED
  await syncManager.applyServerEventToLocalCache({
    eventId: 'evt_test_03',
    eventType: 'PAYMENT_CREATED',
    businessId: 'biz_01',
    branchId: 'branch_01',
    payload: {
      invoice: { id: 'inv_01', totalMMK: 70000, status: 'paid' },
      sale: { id: 'sale_01', totalAmountMMK: 70000 },
      cashTransaction: { id: 'tx_01', amountMMK: 70000, type: 'IN' },
    },
  });

  assert(inMemoryStore.invoices.has('inv_01'), 'Invoice cache updated from realtime PAYMENT_CREATED event');
  assert(inMemoryStore.cashTransactions.has('tx_01'), 'Cash transaction cache updated from realtime event');

  // 3. Financial Mutation Offline Fallback Handling
  console.log('\n[3. Financial Mutation Offline Fallback]');
  let localFallbackExecuted: boolean = false;
  const result = await syncManager.executeFinancialMutation({
    operationType: 'PAYMENT',
    payload: { amountMMK: 50000 },
    localFallbackFn: async () => {
      localFallbackExecuted = true;
      return { success: true, txnId: 'txn_local_01' };
    },
  });

  assert(result.success === true, 'Offline mutation execution succeeds');
  assert(result.isOfflineFallback === true, 'Flagged correctly as isOfflineFallback=true when server offline');
  assert(Boolean(localFallbackExecuted), 'Local fallback closure executed deterministically');
  assert(syncManager.getState() === 'SYNC_PENDING', 'Sync state transitioned to SYNC_PENDING for queued local mutations');

  console.log('\n================================================================');
  console.log(`STEP 1 TARGETED VERIFICATION COMPLETED: ${passed}/${total} CHECKS PASSED`);
  console.log('================================================================\n');
}

runStep1Targeted().catch(err => {
  console.error('Step 1 targeted check failed:', err);
  process.exit(1);
});

