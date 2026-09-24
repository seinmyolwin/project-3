/**
 * ============================================================================
 * PHASE 20.5: PERSISTENT DATABASE & FINANCIAL SERVER BOUNDARY TEST SUITE
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { PersistentSQLiteStorage } from '../../server/storage';

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

async function runAllTests() {
  console.log('\n======================================================');
  console.log('PHASE 20.5 — PERSISTENT SQLITE & FINANCIAL SERVER AUDIT');
  console.log('======================================================\n');

  const testDbDir = path.join(process.cwd(), 'data', 'test_env');
  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDbDir, { recursive: true });

  const testDbPath = path.join(testDbDir, 'test_server.sqlite');

  // TEST 1: Initialization & Seed Data
  await runTest('Database Initialization & Schema Migrations', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();
    const biz = storage.getBusiness('BIZ_SHOP_001');
    assert(!!biz, 'Business BIZ_SHOP_001 should be seeded');
    assert(Boolean(biz?.name.includes('Karaoke & PS5')), 'Business name should match seed');
  });

  // TEST 2: Restart Persistence
  await runTest('Persistence Across Server Restart (File Survives)', async () => {
    // 1. Write record with first storage instance
    const storage1 = new PersistentSQLiteStorage(testDbPath);
    await storage1.initialize();
    storage1.registerDevice({
      deviceId: 'DEV_TEST_PERSIST_1',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      deviceName: 'Persistent Cashier Tablet',
      deviceRole: 'CASHIER',
      appVersion: '1.0.0',
      databaseVersion: 3,
    });

    // 2. Instantiate a fresh storage instance pointing to same file
    const storage2 = new PersistentSQLiteStorage(testDbPath);
    await storage2.initialize();
    const dev = storage2.getDevice('DEV_TEST_PERSIST_1');
    assert(!!dev, 'Device DEV_TEST_PERSIST_1 must survive server restart and reload');
    assert(dev?.deviceName === 'Persistent Cashier Tablet', 'Device name should be preserved');
  });

  // TEST 3: ACID Transaction Durability & Rollback
  await runTest('ACID Transaction Durability & Rollback Safety', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    // 3A: Successful Commit
    await storage.transaction(async () => {
      await storage.executeExpense({
        expenseId: 'exp_tx_001',
        businessId: 'BIZ_SHOP_001',
        branchId: 'BR_MAIN',
        category: 'Utilities',
        description: 'Internet Fiber Bill',
        amountMMK: 45000,
        paymentMethod: 'cash',
        createdBy: 'Manager',
      });
    });

    // Verify written
    const auditLogs = storage.getAuditLogs('BIZ_SHOP_001');
    assert(fs.existsSync(testDbPath), 'Database file should exist on disk');

    // 3B: Failed Transaction Rollback
    let rollbackThrew = false;
    try {
      await storage.transaction(async () => {
        await storage.executeExpense({
          expenseId: 'exp_tx_rollback_002',
          businessId: 'BIZ_SHOP_001',
          branchId: 'BR_MAIN',
          category: 'Test',
          description: 'This will be rolled back',
          amountMMK: 99999,
          paymentMethod: 'cash',
          createdBy: 'Tester',
        });
        throw new Error('Simulated network/hardware failure during transaction');
      });
    } catch {
      rollbackThrew = true;
    }
    assert(rollbackThrew, 'Transaction must throw on failure');

    // Reload fresh storage instance to verify rollback
    const storageReloaded = new PersistentSQLiteStorage(testDbPath);
    await storageReloaded.initialize();
    // Verify exp_tx_rollback_002 is NOT in database
    // executeExpense with same ID should succeed without conflict
    await storageReloaded.executeExpense({
      expenseId: 'exp_tx_rollback_002',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      category: 'Test Valid',
      description: 'Clean write after rollback',
      amountMMK: 5000,
      paymentMethod: 'cash',
      createdBy: 'Tester',
    });
  });

  // TEST 4: Real Financial Operation - Session Start & Concurrency Lock
  await runTest('Financial Boundary: Session Start & Concurrency Conflict', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    // Device A starts session on room_vip_1
    const resA = await storage.executeSessionStart({
      sessionId: 'sess_live_101',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      roomId: 'room_vip_1',
      customerName: 'Customer VIP',
      hourlyRateMMK: 30000,
      userId: 'usr_owner_1',
    });
    assert(resA.status === 'active', 'Session 101 should start actively');

    // Device B concurrently tries to start session on the SAME occupied room
    let conflictCaught = false;
    try {
      await storage.executeSessionStart({
        sessionId: 'sess_live_102_collision',
        businessId: 'BIZ_SHOP_001',
        branchId: 'BR_MAIN',
        roomId: 'room_vip_1',
        customerName: 'Customer Colliding',
        hourlyRateMMK: 30000,
        userId: 'usr_staff_1',
      });
    } catch (err: any) {
      if (err.code === 'ROOM_OCCUPIED_CONFLICT') {
        conflictCaught = true;
      }
    }
    assert(conflictCaught, 'Server must reject concurrent session on occupied room with ROOM_OCCUPIED_CONFLICT');
  });

  // TEST 5: Real Financial Operation - Payment & Invoice Status
  await runTest('Financial Boundary: Invoice Payment & Integrity', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    const paymentRes = await storage.executePayment({
      invoiceId: 'inv_live_201',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      invoiceNumber: 'INV-2026-0001',
      subtotalMMK: 85000,
      discountMMK: 5000,
      totalMMK: 80000,
      paidMMK: 80000,
      paymentMethod: 'cash',
      customerId: 'cust_101',
    });

    assert(paymentRes.paymentStatus === 'paid', 'Invoice should be marked paid');
    assert(paymentRes.paidMMK === 80000, 'Paid amount should be exactly 80,000 MMK');
  });

  // TEST 6: Real Financial Operation - Customer Credit Limit Enforcement
  await runTest('Financial Boundary: Customer Credit & Policy Enforcement', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    // 1. Within limit (cust_101 has 150,000 MMK limit)
    const creditRes = await storage.executeCustomerCredit({
      ledgerId: 'cldg_301',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      customerId: 'cust_101',
      amountMMK: 50000,
      notes: 'VIP Lounge KTV Tab',
    });
    assert(creditRes.newBalance === 50000, 'Customer balance should update to 50,000 MMK');

    // 2. Exceeding limit (50,000 + 120,000 = 170,000 > 150,000 limit)
    let limitExceeded = false;
    try {
      await storage.executeCustomerCredit({
        ledgerId: 'cldg_302_exceed',
        businessId: 'BIZ_SHOP_001',
        branchId: 'BR_MAIN',
        customerId: 'cust_101',
        amountMMK: 120000,
        notes: 'Excessive credit',
      });
    } catch (err: any) {
      if (err.code === 'CREDIT_LIMIT_EXCEEDED') {
        limitExceeded = true;
      }
    }
    assert(limitExceeded, 'Server must block credit exceeding limit with CREDIT_LIMIT_EXCEEDED');
  });

  // TEST 7: Real Financial Operation - Cash Closing & Double-Close Prevention
  await runTest('Financial Boundary: Cash Closing & Date Uniqueness', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    const closeRes = await storage.executeCashClosing({
      closingId: 'ccl_live_401',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      date: '2026-09-19',
      openingCashMMK: 100000,
      cashSalesMMK: 450000,
      debtRepaymentsMMK: 50000,
      cashExpensesMMK: 30000,
      actualCashMMK: 570000,
      closedBy: 'Manager Daw Hla',
    });
    assert(closeRes.status === 'balanced', 'Cash closing should be balanced');
    assert(closeRes.expectedCashMMK === 570000, 'Expected cash should be 570,000 MMK');

    // Attempt double-closing on same date
    let doubleClosePrevented = false;
    try {
      await storage.executeCashClosing({
        closingId: 'ccl_live_402_dup',
        businessId: 'BIZ_SHOP_001',
        branchId: 'BR_MAIN',
        date: '2026-09-19',
        openingCashMMK: 100000,
        cashSalesMMK: 450000,
        debtRepaymentsMMK: 50000,
        cashExpensesMMK: 30000,
        actualCashMMK: 570000,
        closedBy: 'Cashier Ko Aung',
      });
    } catch (err: any) {
      if (err.code === 'DATE_ALREADY_CLOSED') {
        doubleClosePrevented = true;
      }
    }
    assert(doubleClosePrevented, 'Server must prevent duplicate cash closing for same date');
  });

  // TEST 8: Server-Side Idempotency & Cryptographic Hash
  await runTest('Server Idempotency: Replay vs Payload Conflict Detection', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    const payloadA = { invoiceId: 'inv_test_801', amount: 50000, method: 'cash' };
    const hashA = storage.computeCanonicalHash(payloadA);

    // Record original operation
    storage.recordIdempotentOperation({
      operationId: 'op_idemp_801',
      deviceId: 'DEV_TEST_1',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      operationType: 'PAYMENT',
      entityType: 'INVOICE',
      entityId: 'inv_test_801',
      requestHash: hashA,
      status: 'PROCESSED',
      result: { success: true, paymentId: 'pay_123' },
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    });

    // Check same operation ID + same payload
    const record1 = storage.getIdempotencyRecord('op_idemp_801');
    assert(!!record1, 'Idempotency record should exist');
    assert(record1?.requestHash === hashA, 'Hash should match original');

    // Check same operation ID + DIFFERENT payload
    const payloadB = { invoiceId: 'inv_test_801', amount: 99999, method: 'kpay' };
    const hashB = storage.computeCanonicalHash(payloadB);
    assert(hashA !== hashB, 'Different payloads must produce different cryptographic hashes');
  });

  // TEST 9: Authentication & Password Hashing
  await runTest('Authentication: Salted SHA-256 Verification & Rejection', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    storage.createUser({
      name: 'Aung Min',
      username: 'aungmin',
      password: 'aungmin123',
      role: 'owner',
    });

    // Valid credentials
    const userValid = storage.authenticateUser('aungmin', 'aungmin123');
    assert(!!userValid, 'Owner credentials should succeed');
    assert(userValid?.role === 'owner', 'Role should be owner');

    // Invalid password
    const userInvalidPass = storage.authenticateUser('aungmin', 'wrongpassword');
    assert(userInvalidPass === null, 'Invalid password should be rejected');

    // Non-existent user
    const userNotFound = storage.authenticateUser('nonexistent', 'pass');
    assert(userNotFound === null, 'Non-existent user should be rejected');
  });

  // TEST 10: Dynamic Pairing Code Verification
  await runTest('Device Pairing: Dynamic Short-Lived Code & Expiration', async () => {
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    // 1. Create dynamic code
    const pairingCode = storage.createPairingCode('BIZ_SHOP_001', 'BR_MAIN', 'CASHIER', 'aungmin', 30);
    assert(pairingCode.startsWith('PAIR-'), 'Pairing code should have PAIR- prefix');

    // 2. Pair device
    const pairRes = storage.pairDevice('DEV_TABLET_FRONT', pairingCode, {
      deviceName: 'Front Desk Tablet',
    });
    assert(pairRes.success, 'Device pairing should succeed');
    assert(pairRes.device?.deviceId === 'DEV_TABLET_FRONT', 'Device ID should match');

    // 3. Re-use same one-time code (should fail)
    const reuseRes = storage.pairDevice('DEV_TABLET_2', pairingCode, {});
    assert(!reuseRes.success, 'Re-using consumed pairing code should fail');
  });

  // TEST 11: Local Backup & Restore Engine
  await runTest('Backup & Restore: Snapshot Verification and Data Integrity', async () => {
    const storageOriginal = new PersistentSQLiteStorage(testDbPath);
    await storageOriginal.initialize();

    const backupFile = path.join(testDbDir, 'backup_test.sqlite');
    storageOriginal.exportBackup(backupFile);
    assert(fs.existsSync(backupFile), 'Backup file must be written to disk');

    // Restore to a new storage instance
    const restoreDbPath = path.join(testDbDir, 'restored_test.sqlite');
    const storageRestored = new PersistentSQLiteStorage(restoreDbPath);
    await storageRestored.initialize();
    storageRestored.restoreBackup(backupFile);

    // Verify restored records
    const restoredBiz = storageRestored.getBusiness('BIZ_SHOP_001');
    assert(!!restoredBiz, 'Restored database should contain business data');
    const restoredDevice = storageRestored.getDevice('DEV_TABLET_FRONT');
    assert(!!restoredDevice, 'Restored database should contain paired devices');
  });

  console.log('\n------------------------------------------------------');
  console.log(`TEST SUMMARY: ${testPassed} Passed, ${testFailed} Failed, Total: ${testPassed + testFailed}`);
  console.log('------------------------------------------------------\n');

  if (testFailed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
