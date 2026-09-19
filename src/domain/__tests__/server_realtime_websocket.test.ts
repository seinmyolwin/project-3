/**
 * ============================================================================
 * PHASE 21: LOCAL WEBSOCKET REAL-TIME EVENT BUS & OUTBOX TEST SUITE
 * ============================================================================
 */

import http from 'http';
import express from 'express';
import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';
import { PersistentSQLiteStorage } from '../../server/storage';
import { createApiRouter, activeSessions } from '../../server/routes';
import { LocalRealtimeEventBus } from '../../server/realtime/eventBus';
import { ServerToClientMessage } from '../../server/realtime/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`FAIL: ${msg}`);
  }
}

let testPassed = 0;
let testFailed = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      testPassed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message);
      testFailed++;
    }
  })();
}

class TestClient {
  public ws: WebSocket;
  private messageQueue: ServerToClientMessage[] = [];
  private waiters: { predicate: (msg: ServerToClientMessage) => boolean; resolve: (msg: ServerToClientMessage) => void; reject: (err: any) => void; timer: any }[] = [];
  public closeCode: number | null = null;
  public closeReason: string | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as ServerToClientMessage;
        let handled = false;
        for (let i = 0; i < this.waiters.length; i++) {
          if (this.waiters[i].predicate(parsed)) {
            const waiter = this.waiters.splice(i, 1)[0];
            clearTimeout(waiter.timer);
            waiter.resolve(parsed);
            handled = true;
            break;
          }
        }
        if (!handled) {
          this.messageQueue.push(parsed);
        }
      } catch {}
    });

    this.ws.on('close', (code, reason) => {
      this.closeCode = code;
      this.closeReason = reason.toString();
    });
  }

  public nextMessage(timeout = 3000): Promise<ServerToClientMessage> {
    return this.waitFor(() => true, timeout);
  }

  public waitFor(predicate: (msg: ServerToClientMessage) => boolean, timeout = 3000): Promise<ServerToClientMessage> {
    for (let i = 0; i < this.messageQueue.length; i++) {
      if (predicate(this.messageQueue[i])) {
        return Promise.resolve(this.messageQueue.splice(i, 1)[0]);
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error('Timeout waiting for WebSocket message'));
      }, timeout);

      this.waiters.push({ predicate, resolve, reject, timer });
    });
  }

  public waitForType(type: string, eventType?: string, timeout = 3000): Promise<ServerToClientMessage> {
    return this.waitFor((msg) => {
      if (msg.type !== type) return false;
      if (eventType && msg.event?.eventType !== eventType) return false;
      return true;
    }, timeout);
  }

  public send(data: any) {
    this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
  }

  public close() {
    this.ws.close();
  }
}

function connectClient(wsUrl: string, token?: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const url = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;
    const ws = new WebSocket(url);
    const client = new TestClient(ws);
    ws.on('open', () => resolve(client));
    ws.on('error', (err) => reject(err));
  });
}

async function runAllTests() {
  console.log('======================================================');
  console.log('PHASE 21 — LOCAL WEBSOCKET REAL-TIME EVENT BUS & OUTBOX');
  console.log('======================================================');

  const testDbPath = path.join(process.cwd(), 'data', `test_ws_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);
  const storage = new PersistentSQLiteStorage(testDbPath);
  await storage.initialize();

  const businessId = 'BIZ_SHOP_001';
  const branchId = 'BRANCH_MDY_001';

  // Seed test business, branch, room
  (storage as any).db.run(`
    INSERT OR REPLACE INTO businesses (id, name, owner_name, phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `, [businessId, 'MDY Family Karaoke', 'ကိုအောင်မင်း', '0912345678']);

  (storage as any).db.run(`
    INSERT OR REPLACE INTO branches (id, business_id, name, code, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, datetime('now'))
  `, [branchId, businessId, 'Main Branch', 'MAIN']);

  (storage as any).db.run(`
    INSERT OR REPLACE INTO rooms (id, business_id, branch_id, name, status, hourly_rate_mmk, surcharge_mmk, updated_at)
    VALUES (?, ?, ?, ?, 'available', ?, 0, datetime('now'))
  `, ['ROOM_001', businessId, branchId, 'VIP Room 1', 15000]);

  const eventBus = new LocalRealtimeEventBus(storage);

  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(storage));

  const server = http.createServer(app);
  eventBus.attach(server);

  let port = 0;
  let wsUrl = '';

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      wsUrl = `ws://127.0.0.1:${port}/ws`;
      resolve();
    });
  });

  // Register devices
  storage.registerDevice({
    deviceId: 'DEV_OWNER_PHONE',
    businessId,
    branchId,
    deviceName: 'Owner Phone',
    deviceRole: 'OWNER',
    appVersion: '1.0.0',
    databaseVersion: 3,
  });

  storage.registerDevice({
    deviceId: 'DEV_CASHIER_TABLET',
    businessId,
    branchId,
    deviceName: 'Cashier Tablet',
    deviceRole: 'CASHIER',
    appVersion: '1.0.0',
    databaseVersion: 3,
  });

  storage.registerDevice({
    deviceId: 'DEV_FRONT_DESK',
    businessId,
    branchId,
    deviceName: 'Front Desk',
    deviceRole: 'FRONT_DESK',
    appVersion: '1.0.0',
    databaseVersion: 3,
  });

  const ownerToken = 'token_owner_' + Date.now();
  activeSessions.set(ownerToken, {
    token: ownerToken,
    user: {
      id: 'usr_owner_01',
      businessId,
      branchId,
      username: 'aungmin_owner',
      name: 'ကိုအောင်မင်း',
      role: 'owner',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    deviceId: 'DEV_OWNER_PHONE',
    expiresAt: Date.now() + 24 * 3600 * 1000,
  });

  const cashierToken = 'token_cashier_' + Date.now();
  activeSessions.set(cashierToken, {
    token: cashierToken,
    user: {
      id: 'usr_cashier_01',
      businessId,
      branchId,
      username: 'kyawkyaw_cashier',
      name: 'ကျော်ကျော်',
      role: 'cashier',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    deviceId: 'DEV_CASHIER_TABLET',
    expiresAt: Date.now() + 24 * 3600 * 1000,
  });

  const receptionistToken = 'token_receptionist_' + Date.now();
  activeSessions.set(receptionistToken, {
    token: receptionistToken,
    user: {
      id: 'usr_rec_01',
      businessId,
      branchId,
      username: 'su_reception',
      name: 'မစုစု',
      role: 'receptionist',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    deviceId: 'DEV_FRONT_DESK',
    expiresAt: Date.now() + 24 * 3600 * 1000,
  });

  // TEST 1: WebSocket Query Authentication
  await runTest('WebSocket Connection: Authenticate with Token in Query Param', async () => {
    const client = await connectClient(wsUrl, ownerToken);
    const msg = await client.waitForType('AUTH_SUCCESS');
    assert(msg.type === 'AUTH_SUCCESS', `Expected AUTH_SUCCESS, got ${msg.type}`);
    assert(msg.connectionContext?.userId === 'usr_owner_01', 'User ID matches');
    assert(msg.connectionContext?.role === 'owner', 'Role matches');
    assert(msg.connectionContext?.deviceId === 'DEV_OWNER_PHONE', 'Device matches');
    client.close();
  });

  // TEST 2: WebSocket In-band AUTH Message
  await runTest('WebSocket Connection: Authenticate with AUTH Control Message', async () => {
    const client = await connectClient(wsUrl); // connect without token in URL
    client.send({ type: 'AUTH', token: cashierToken });
    const msg = await client.waitForType('AUTH_SUCCESS');
    assert(msg.type === 'AUTH_SUCCESS', `Expected AUTH_SUCCESS, got ${msg.type}`);
    assert(msg.connectionContext?.userId === 'usr_cashier_01', 'User ID matches');
    assert(msg.connectionContext?.role === 'cashier', 'Role matches');
    client.close();
  });

  // TEST 3: Invalid Token Rejection
  await runTest('WebSocket Connection: Reject Invalid Authentication Token', async () => {
    const client = await connectClient(wsUrl, 'invalid_fake_token_999');
    const msg = await client.waitForType('AUTH_ERROR');
    assert(msg.type === 'AUTH_ERROR', `Expected AUTH_ERROR, got ${msg.type}`);
    assert(msg.code === 'INVALID_TOKEN', `Expected INVALID_TOKEN, got ${msg.code}`);
    client.close();
  });

  // TEST 4: Revoked Device Rejection
  await runTest('WebSocket Connection: Reject Revoked Device Connection', async () => {
    storage.updateDeviceStatus('DEV_CASHIER_TABLET', 'REVOKED');
    const client = await connectClient(wsUrl, cashierToken);
    const msg = await client.waitForType('AUTH_ERROR');
    assert(msg.type === 'AUTH_ERROR', `Expected AUTH_ERROR, got ${msg.type}`);
    assert(msg.code === 'DEVICE_REVOKED', `Expected DEVICE_REVOKED, got ${msg.code}`);
    storage.updateDeviceStatus('DEV_CASHIER_TABLET', 'ACTIVE');
    client.close();
  });

  // TEST 5: Heartbeat Ping/Pong
  await runTest('WebSocket Protocol: Heartbeat Ping and Pong', async () => {
    const client = await connectClient(wsUrl, ownerToken);
    await client.waitForType('AUTH_SUCCESS');
    client.send({ type: 'PING' });
    const msg = await client.waitForType('PONG');
    assert(msg.type === 'PONG', `Expected PONG response, got ${msg.type}`);
    client.close();
  });

  // TEST 6: Outbox Sequence Monotonicity
  await runTest('Outbox Pattern: Monotonic Sequence Numbering per Branch', async () => {
    const evt1 = storage.recordOutboxEvent({
      businessId,
      branchId,
      eventType: 'SESSION_STARTED',
      entityType: 'SESSION',
      entityId: 'sess_test_1',
      payload: { roomId: 'ROOM_001', roomName: 'VIP 1' },
    });

    const evt2 = storage.recordOutboxEvent({
      businessId,
      branchId,
      eventType: 'PAYMENT_CREATED',
      entityType: 'INVOICE',
      entityId: 'inv_test_1',
      payload: { totalMMK: 50000, paidMMK: 50000 },
    });

    assert(evt1.sequence === 1, `Expected sequence 1, got ${evt1.sequence}`);
    assert(evt2.sequence === 2, `Expected sequence 2, got ${evt2.sequence}`);
    assert(evt1.status === 'PENDING', 'Initial outbox status is PENDING');

    const pending = storage.getPendingOutboxEvents();
    assert(pending.length >= 2, 'Pending outbox events exist');
  });

  // TEST 7: Atomic Transaction Real-time Event Publishing
  await runTest('Publish-After-Commit: Session Start Broadcasts to Owner & Cashier', async () => {
    const clientOwner = await connectClient(wsUrl, ownerToken);
    await clientOwner.waitForType('AUTH_SUCCESS');

    const clientCashier = await connectClient(wsUrl, cashierToken);
    await clientCashier.waitForType('AUTH_SUCCESS');

    // Authoritative atomic financial operation
    await storage.executeSessionStart({
      sessionId: 'sess_atomic_001',
      businessId,
      branchId,
      roomId: 'ROOM_001',
      hourlyRateMMK: 15000,
      userId: 'usr_cashier_01',
    });

    // Drain outbox to connected sockets
    await eventBus.drainOutbox();

    // Owner receives SESSION_STARTED
    const msg1 = await clientOwner.waitForType('EVENT', 'SESSION_STARTED');
    assert(msg1.type === 'EVENT', `Received EVENT, got ${msg1.type}`);
    assert(msg1.event?.eventType === 'SESSION_STARTED', `Received SESSION_STARTED, got ${msg1.event?.eventType}`);

    // Owner receives ROOM_STATUS_CHANGED
    const msg2 = await clientOwner.waitForType('EVENT', 'ROOM_STATUS_CHANGED');
    assert(msg2.type === 'EVENT', `Received EVENT, got ${msg2.type}`);
    assert(msg2.event?.eventType === 'ROOM_STATUS_CHANGED', `Received ROOM_STATUS_CHANGED, got ${msg2.event?.eventType}`);

    // Cashier also receives SESSION_STARTED
    const cashierMsg1 = await clientCashier.waitForType('EVENT', 'SESSION_STARTED');
    assert(cashierMsg1.type === 'EVENT' && cashierMsg1.event?.eventType === 'SESSION_STARTED', 'Cashier received SESSION_STARTED');

    clientOwner.close();
    clientCashier.close();
  });

  // TEST 8: Role Visibility Filtering (Sensitive Cash Closing)
  await runTest('Role Visibility: Cash Closing Hidden from Receptionist', async () => {
    const clientOwner = await connectClient(wsUrl, ownerToken);
    await clientOwner.waitForType('AUTH_SUCCESS');

    const clientRec = await connectClient(wsUrl, receptionistToken);
    await clientRec.waitForType('AUTH_SUCCESS');

    await storage.executeCashClosing({
      closingId: 'ccl_realtime_001',
      businessId,
      branchId,
      date: '2026-09-19',
      openingCashMMK: 500000,
      cashSalesMMK: 200000,
      debtRepaymentsMMK: 0,
      cashExpensesMMK: 50000,
      actualCashMMK: 650000,
      closedBy: 'ကိုအောင်မင်း',
    });

    await eventBus.drainOutbox();

    const ownerMsg = await clientOwner.waitForType('EVENT', 'CASH_CLOSING_CREATED');
    assert(ownerMsg.type === 'EVENT' && ownerMsg.event?.eventType === 'CASH_CLOSING_CREATED', 'Owner received CASH_CLOSING_CREATED');

    let recReceived = false;
    try {
      const recMsg = await clientRec.waitForType('EVENT', 'CASH_CLOSING_CREATED', 300);
      if (recMsg.type === 'EVENT' && recMsg.event?.eventType === 'CASH_CLOSING_CREATED') {
        recReceived = true;
      }
    } catch {
      // Expected timeout
    }
    assert(!recReceived, 'Receptionist did not receive sensitive cash closing event');

    clientOwner.close();
    clientRec.close();
  });

  // TEST 9: Dynamic Device Revocation Force-Close
  await runTest('Security: Immediate WebSocket Disconnection on Device Revocation', async () => {
    const clientCashier = await connectClient(wsUrl, cashierToken);
    await clientCashier.waitForType('AUTH_SUCCESS');

    storage.updateDeviceStatus('DEV_CASHIER_TABLET', 'REVOKED');
    eventBus.revokeDeviceConnections('DEV_CASHIER_TABLET');

    await new Promise(r => setTimeout(r, 200));
    assert(clientCashier.ws.readyState === WebSocket.CLOSED, 'WebSocket connection terminated');
    assert(clientCashier.closeCode === 4003, `Expected close code 4003, got ${clientCashier.closeCode}`);
    storage.updateDeviceStatus('DEV_CASHIER_TABLET', 'ACTIVE');
  });

  // TEST 10: HTTP Catch-up Sync via Sequence Numbers
  await runTest('Sync Engine: Query Missed Events Since Sequence', async () => {
    storage.recordOutboxEvent({
      businessId,
      branchId,
      eventType: 'CUSTOMER_CREDIT_CREATED',
      entityType: 'CUSTOMER_LEDGER',
      entityId: 'cldg_1',
      payload: { amountMMK: 15000 },
    });

    storage.recordOutboxEvent({
      businessId,
      branchId,
      eventType: 'CUSTOMER_BALANCE_UPDATED',
      entityType: 'CUSTOMER',
      entityId: 'cust_1',
      payload: { outstandingBalanceMMK: 15000 },
    });

    const latestSeq = storage.getLatestSequence(businessId, branchId);
    assert(latestSeq >= 2, `Latest sequence is ${latestSeq}`);

    const missedEvents = storage.getOutboxEventsSince(businessId, branchId, latestSeq - 2);
    assert(missedEvents.length === 2, `Retrieved exactly 2 missed events, got ${missedEvents.length}`);
    assert(missedEvents[0].sequence === latestSeq - 1, 'First missed sequence is sequential');
    assert(missedEvents[1].sequence === latestSeq, 'Second missed sequence is sequential');
  });

  // Clean shutdown
  await eventBus.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch {}
  }

  console.log('------------------------------------------------------');
  console.log(`TEST SUMMARY: ${testPassed} Passed, ${testFailed} Failed, Total: ${testPassed + testFailed}`);
  console.log('------------------------------------------------------');

  if (testFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
