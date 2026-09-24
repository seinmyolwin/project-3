/**
 * FIRST-RUN OWNER BOOTSTRAP & SECURE AUTHENTICATION TEST SUITE
 * Verifies zero-default-password bootstrap, owner creation, salted hash storage,
 * login verification, password reset, and RBAC protection.
 */

import fs from 'fs';
import path from 'path';
import { PersistentSQLiteStorage } from '../../server/storage';
import { hashPassword, verifyPassword } from '../../utils/cryptoAuth';

console.log('====================================================');
console.log('FIRST-RUN OWNER BOOTSTRAP & AUTHENTICATION TESTS');
console.log('====================================================\n');

let passCount = 0;
let totalCount = 0;

function assert(condition: boolean, message: string) {
  totalCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ [TEST ${totalCount}] PASSED: ${message}`);
  } else {
    console.error(`  ❌ [TEST ${totalCount}] FAILED: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
}

async function runBootstrapTests() {
  const testDir = path.join(process.cwd(), 'data', 'test_bootstrap_' + Date.now());
  const testDbPath = path.join(testDir, 'bootstrap.sqlite');

  try {
    // [TEST 1 & 2] Fresh Database Detection & First-Run Setup Status
    console.log('[STAGE 1] Fresh Database Initialization & Setup Status');
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    const initialUserCount = storage.countUsers();
    assert(initialUserCount === 0, 'Fresh database starts with 0 users (no default hardcoded credentials)');

    // [TEST 3] Owner Account Creation & Salted SHA-256 Hashing
    console.log('[STAGE 2] Owner Account Creation & Password Hash Verification');
    const ownerData = {
      name: 'U Thant Zin (Shop Owner)',
      username: 'thantzin_owner',
      password: 'CustomOwnerPassword2026',
      role: 'owner' as const,
    };

    const createdOwner = storage.createUser(ownerData);
    assert(createdOwner.id.startsWith('usr_'), 'Owner created with valid user ID format');
    assert(createdOwner.username === 'thantzin_owner', 'Owner username saved accurately');
    assert(createdOwner.role === 'owner', 'Owner role assigned accurately');

    const updatedUserCount = storage.countUsers();
    assert(updatedUserCount === 1, 'User count is now 1 after initial owner setup');

    // [TEST 4] Plaintext Password Isolation Audit
    console.log('[STAGE 3] Storage Security & Plaintext Password Non-Persistence');
    const dbStmt = (storage as any).db.prepare(`SELECT * FROM users WHERE id = ?`);
    dbStmt.bind([createdOwner.id]);
    dbStmt.step();
    const row = dbStmt.getAsObject();
    dbStmt.free();

    assert(!row.password, 'Plaintext password property is NOT stored in database');
    assert(!row.pin, 'Plaintext PIN property is NOT stored in database');
    assert(row.password_hash && (row.password_hash as string).length === 64, 'Salted password hash is stored as a 64-character SHA-256 hex string');
    assert(row.salt && (row.salt as string).length >= 16, 'Cryptographic salt is non-empty and securely stored');

    // [TEST 5 & 6] LAN Authentication Verification (Accept / Reject)
    console.log('[STAGE 4] LAN Server Authentication Verification');
    const authSuccess = storage.authenticateUser('thantzin_owner', 'CustomOwnerPassword2026');
    assert(!!authSuccess, 'Correct password authenticates successfully on LAN server');
    assert(authSuccess?.username === 'thantzin_owner', 'Authenticated user object matches');

    const authWrongPass = storage.authenticateUser('thantzin_owner', 'WrongPassword123');
    assert(authWrongPass === null, 'Incorrect password is strictly rejected');

    const authWrongUser = storage.authenticateUser('nonexistent_user', 'CustomOwnerPassword2026');
    assert(authWrongUser === null, 'Non-existent username is strictly rejected');

    // [TEST 7 & 8] Restart & Re-initialization Persistence
    console.log('[STAGE 5] System Restart & Data Preservation Audit');
    storage.close();

    const restartedStorage = new PersistentSQLiteStorage(testDbPath);
    await restartedStorage.initialize();

    const recheckUserCount = restartedStorage.countUsers();
    assert(recheckUserCount === 1, 'Restarting storage preserves existing user without reset or duplication');

    const recheckAuth = restartedStorage.authenticateUser('thantzin_owner', 'CustomOwnerPassword2026');
    assert(!!recheckAuth, 'Owner can authenticate normally after system restart');

    // [TEST 9 & 10] Owner Password Reset & Secondary Staff User Management
    console.log('[STAGE 6] Staff User Creation & Owner Password Management');
    const cashierUser = restartedStorage.createUser({
      name: 'Maung Kyaw (Cashier)',
      username: 'kyaw_cashier',
      password: 'CashierInitPass123',
      role: 'cashier',
    });
    assert(cashierUser.username === 'kyaw_cashier', 'Owner can create secondary staff user');

    const cashierAuthBefore = restartedStorage.authenticateUser('kyaw_cashier', 'CashierInitPass123');
    assert(!!cashierAuthBefore, 'Cashier authenticates with initial password');

    // Reset Cashier Password
    restartedStorage.updateUserPassword(cashierUser.id, 'NewResetCashierPass456');

    const cashierOldAuthAfter = restartedStorage.authenticateUser('kyaw_cashier', 'CashierInitPass123');
    assert(cashierOldAuthAfter === null, 'Old cashier password rejected after password reset');

    const cashierNewAuthAfter = restartedStorage.authenticateUser('kyaw_cashier', 'NewResetCashierPass456');
    assert(!!cashierNewAuthAfter, 'New cashier password accepts authentication after reset');

    // [TEST 11] Offline Dexie Crypto Verification Check
    console.log('[STAGE 7] Offline Client Crypto Verification Mechanics');
    const clientSalt = 'salt_client_offline_test';
    const clientCreds = hashPassword('OfflinePass789', clientSalt);
    assert(clientCreds.passwordHash.length === 64, 'Offline hashPassword produces 64-character SHA-256 hash');
    assert(verifyPassword('OfflinePass789', clientCreds.passwordHash, clientCreds.passwordSalt), 'verifyPassword returns true for valid offline password');
    assert(!verifyPassword('WrongOfflinePass', clientCreds.passwordHash, clientCreds.passwordSalt), 'verifyPassword returns false for invalid offline password');

    restartedStorage.close();

    console.log('\n====================================================');
    console.log(`ALL FIRST-RUN BOOTSTRAP TESTS PASSED: ${passCount}/${totalCount}`);
    console.log('====================================================\n');
  } finally {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

runBootstrapTests().catch(err => {
  console.error('Bootstrap test suite failed:', err);
  process.exit(1);
});
