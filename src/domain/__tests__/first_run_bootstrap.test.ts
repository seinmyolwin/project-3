/**
 * FIRST-RUN OWNER BOOTSTRAP & SECURE AUTHENTICATION TEST SUITE (PHASE 40 - ZERO DEFAULT CREDENTIALS)
 * Verifies:
 * 1. Fresh database starts with 0 users (zero hardcoded/default accounts).
 * 2. Absolute absence of any working demo credentials on clean install.
 * 3. First user creates Owner account directly with 4-6 char password (mustChangePassword: false).
 * 4. Subsequent reloads detect user count > 0 and display normal login screen.
 * 5. Owner creates staff accounts (Cashier, Waiter, Receptionist) with active credentials.
 */

import fs from 'fs';
import path from 'path';
import { PersistentSQLiteStorage } from '../../server/storage';
import { hashPassword, verifyPassword, verifyPin } from '../../utils/cryptoAuth';

console.log('====================================================');
console.log('PHASE 40: ZERO DEFAULT CREDENTIALS & FIRST-RUN OWNER CREATION');
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
    // [STAGE 1] Fresh Database Initialization - Absolute Zero Users
    console.log('[STAGE 1] Fresh Database Initialization (Zero Pre-configured Accounts)');
    const storage = new PersistentSQLiteStorage(testDbPath);
    await storage.initialize();

    const initialUserCount = storage.countUsers();
    assert(initialUserCount === 0, 'Fresh database starts with exactly 0 users (zero hardcoded/default credentials)');

    // [STAGE 2] Hardcoded Demo Credentials Strict Rejection Audit
    console.log('[STAGE 2] Demo Credentials Absence Audit');
    const demoAccountsToCheck = [
      { username: 'owner', pin: '1234' },
      { username: 'owner', pin: '0000' },
      { username: 'manager', pin: '5678' },
      { username: 'cashier', pin: '0000' },
      { username: 'aungmin', pin: 'aungmin123' },
      { username: 'dawhla', pin: 'dawhla123' },
      { username: 'koaung', pin: 'koaung123' },
    ];

    for (const demo of demoAccountsToCheck) {
      const failedAuth = storage.authenticateUser(demo.username, demo.pin);
      assert(failedAuth === null, `Demo credentials (${demo.username} / ${demo.pin}) fail on fresh install`);
    }

    // [STAGE 3] First-Run Owner Account Creation
    console.log('[STAGE 3] First-Run Owner Account Creation');
    const ownerData = {
      name: 'U Zaw Min (ဦးဇော်မင်း - ဆိုင်ရှင်)',
      username: 'zawmin_owner',
      password: '5555', // 4-digit PIN/Password
      role: 'owner' as const,
      mustChangePassword: false,
    };

    const createdOwner = storage.createUser(ownerData);
    assert(createdOwner.id.startsWith('usr_'), 'Owner created with valid ID format');
    assert(createdOwner.username === 'zawmin_owner', 'Owner username saved accurately');
    assert(createdOwner.role === 'owner', 'Owner role assigned accurately');
    assert(createdOwner.mustChangePassword === false, 'Owner mustChangePassword is false (active immediately)');

    const countAfterOwner = storage.countUsers();
    assert(countAfterOwner === 1, 'Exactly one user exists after first-run owner creation');

    // [STAGE 4] Owner Authentication
    console.log('[STAGE 4] Owner Authentication Validation');
    const authOwner = storage.authenticateUser('zawmin_owner', '5555');
    assert(!!authOwner, 'Owner authenticates successfully with chosen credentials');
    assert(authOwner?.mustChangePassword === false, 'Owner account is active without forced password reset');

    // [STAGE 5] Persistence Across Restart (Normal Login State)
    console.log('[STAGE 5] Persistence Across System Restart');
    storage.close();

    const restartedStorage = new PersistentSQLiteStorage(testDbPath);
    await restartedStorage.initialize();

    const restartCount = restartedStorage.countUsers();
    assert(restartCount === 1, 'Restarting storage preserves existing owner account (count = 1)');
    assert(restartCount > 0, 'Server reports userCount > 0 so normal login screen will be shown');

    const recheckAuth = restartedStorage.authenticateUser('zawmin_owner', '5555');
    assert(!!recheckAuth, 'Owner authenticates normally after system restart');

    // [STAGE 6] Owner Provisions Staff Accounts (Cashier & Waiter with 4-6 char passwords)
    console.log('[STAGE 6] Staff User Provisioning & 4 to 6 Char Password Support');
    const cashierUser = restartedStorage.createUser({
      name: 'Maung Kyaw (ငွေကိုင်)',
      username: 'kyaw_cashier',
      password: '1234', // 4 chars
      role: 'cashier',
      mustChangePassword: false,
    });
    assert(cashierUser.username === 'kyaw_cashier', 'Owner successfully provisions Cashier account');

    const waiterUser = restartedStorage.createUser({
      name: 'Ko Hla (စားပွဲထိုး)',
      username: 'hla_waiter',
      password: '654321', // 6 chars
      role: 'waiter' as any,
      mustChangePassword: false,
    });
    assert(waiterUser.username === 'hla_waiter', 'Owner successfully provisions Waiter account');

    // [STAGE 7] Staff Immediate Authentication Verification
    console.log('[STAGE 7] Staff Immediate Authentication Verification');
    const cashierAuth = restartedStorage.authenticateUser('kyaw_cashier', '1234');
    assert(!!cashierAuth, 'Cashier authenticates immediately with owner-assigned password');
    assert(cashierAuth?.role === 'cashier', 'Cashier has cashier role');

    const waiterAuth = restartedStorage.authenticateUser('hla_waiter', '654321');
    assert(!!waiterAuth, 'Waiter authenticates immediately with 6-digit password');
    assert(waiterAuth?.role === 'waiter', 'Waiter has waiter role');

    // [STAGE 8] Offline Crypto Verification (verifyPin & verifyPassword)
    console.log('[STAGE 8] Offline Crypto Hash and Salt Verification');
    const offlineSalt = 'salt_offline_test_456';
    const offlineCreds = hashPassword('5555', offlineSalt);
    assert(offlineCreds.passwordHash.length === 64, 'SHA-256 hash length is 64 hex chars');
    assert(verifyPassword('5555', offlineCreds.passwordHash, offlineCreds.passwordSalt), 'verifyPassword succeeds with correct PIN');
    assert(verifyPin('5555', offlineCreds.passwordHash, offlineCreds.passwordSalt), 'verifyPin succeeds with correct PIN');
    assert(!verifyPassword('9999', offlineCreds.passwordHash, offlineCreds.passwordSalt), 'verifyPassword rejects wrong PIN');

    restartedStorage.close();

    console.log('\n====================================================');
    console.log(`ALL PHASE 40 TESTS PASSED: ${passCount}/${totalCount}`);
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
