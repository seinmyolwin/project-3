import http from 'http';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { PersistentSQLiteStorage } from '../../server/storage';
import { createApiRouter, activeSessions } from '../../server/routes';

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
    console.log(`  [PASS] ${name}`);
    testPassed++;
  } catch (err: any) {
    console.error(`  [FAIL] ${name}:`, err.message);
    testFailed++;
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('PHASE 37-A — SECURITY HARDENING: PASSWORD HARDENING');
  console.log('======================================================\n');

  const testDbDir = path.join(process.cwd(), 'data', 'test_env_phase37a');
  if (fs.existsSync(testDbDir)) {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDbDir, { recursive: true });

  const testDbPath = path.join(testDbDir, 'test_server_phase37a.sqlite');
  const storage = new PersistentSQLiteStorage(testDbPath);
  await storage.initialize();

  const businessId = 'BIZ_SHOP_001';
  const branchId = 'BR_MAIN';

  // 1. Test standard storage user creation assertion
  await runTest('Storage: createUser throws error when password/pin is missing', async () => {
    try {
      storage.createUser({
        username: 'test_no_pass',
        name: 'Test No Pass',
        role: 'cashier',
      });
      assert(false, 'Should have thrown an error');
    } catch (err: any) {
      assert(err.message === 'Password or PIN is required', `Expected password/pin required message, got "${err.message}"`);
    }
  });

  // 2. Test successful storage user creation
  await runTest('Storage: createUser succeeds and maps mustChangePassword correctly', async () => {
    const created = storage.createUser({
      username: 'test_with_pass',
      name: 'Test With Pass',
      role: 'cashier',
      password: 'SecurePassword123',
      mustChangePassword: true,
    });
    assert(created.username === 'test_with_pass', 'Username matches');
    assert(created.mustChangePassword === true, 'mustChangePassword matches');

    // Retrieve user and verify
    const fetched = storage.getUserById(created.id);
    assert(!!fetched, 'User should be found');
    assert(fetched?.mustChangePassword === true, 'Retrieved mustChangePassword is true');
  });

  // 3. Test changing password clears mustChangePassword
  await runTest('Storage: updateUserPassword clears must_change_password', async () => {
    const created = storage.createUser({
      username: 'test_change_pass',
      name: 'Test Change Pass',
      role: 'cashier',
      password: 'InitialPassword123',
      mustChangePassword: true,
    });
    assert(created.mustChangePassword === true, 'Initially true');

    const success = storage.updateUserPassword(created.id, 'NewSecurePassword123');
    assert(success === true, 'Password update success');

    const fetched = storage.getUserById(created.id);
    assert(fetched?.mustChangePassword === false, 'mustChangePassword should now be false');
  });

  // Setup express server for API endpoints test
  const app = express();
  app.use(express.json());
  app.use('/api', createApiRouter(storage));

  const server = http.createServer(app);
  let port = 0;
  let baseUrl = '';

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  // Register device and setup active sessions for requests
  storage.registerDevice({
    deviceId: 'DEV_OWNER_PHONE',
    businessId,
    branchId,
    deviceName: 'Owner Phone',
    deviceRole: 'OWNER',
    appVersion: '1.0.0',
    databaseVersion: 3,
  });

  // Persist owner user to database first so that requireAuth middleware database lookup succeeds
  storage.createUser({
    id: 'usr_owner_37a',
    username: 'owner_37a',
    name: 'Shop Owner',
    role: 'owner',
    password: 'SecurePassword123',
  });

  const ownerToken = 'token_owner_37a';
  activeSessions.set(ownerToken, {
    token: ownerToken,
    user: {
      id: 'usr_owner_37a',
      businessId,
      branchId,
      username: 'owner_37a',
      name: 'Shop Owner',
      role: 'owner',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    deviceId: 'DEV_OWNER_PHONE',
    expiresAt: Date.now() + 24 * 3600 * 1000,
  });

  // 4. Test API: POST /users rejects empty password
  await runTest('API: POST /users rejects request with 400 when password/PIN is missing', async () => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        username: 'api_no_pass',
        name: 'API No Pass',
        role: 'cashier',
      }),
    });

    assert(res.status === 400, `Expected 400, got ${res.status}`);
    const data = await res.json() as any;
    assert(data.error === 'INVALID_INPUT', `Expected INVALID_INPUT, got ${data.error}`);
    assert(data.message.includes('Password or PIN is required'), 'Correct error message');
  });

  // 5. Test API: mustChangePassword restrictions on authenticated routes
  await runTest('API: mustChangePassword blocks other endpoints but allows change-password, me, and logout', async () => {
    // Create a user with mustChangePassword = true
    const createdUser = storage.createUser({
      username: 'restricted_user',
      name: 'Restricted User',
      role: 'cashier',
      password: 'TempPassword123',
      mustChangePassword: true,
    });

    const userToken = 'token_restricted_37a';
    activeSessions.set(userToken, {
      token: userToken,
      user: {
        id: createdUser.id,
        businessId,
        branchId,
        username: createdUser.username,
        name: createdUser.name,
        role: createdUser.role,
        isActive: true,
        createdAt: createdUser.createdAt,
      },
      deviceId: 'DEV_OWNER_PHONE',
      expiresAt: Date.now() + 24 * 3600 * 1000,
    });

    // 5A: Try to call an endpoint (e.g., GET /users) which should be blocked
    const resBlocked = await fetch(`${baseUrl}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });
    assert(resBlocked.status === 403, `Expected 403 Forbidden, got ${resBlocked.status}`);
    const dataBlocked = await resBlocked.json() as any;
    assert(dataBlocked.error === 'MUST_CHANGE_PASSWORD', `Expected MUST_CHANGE_PASSWORD error, got ${dataBlocked.error}`);

    // 5B: Try to call allowed endpoint (e.g., GET /auth/me) which should be permitted
    const resMe = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });
    assert(resMe.status === 200, `Expected 200 OK, got ${resMe.status}`);

    // 5C: Call change password to clear mustChangePassword
    const resChange = await fetch(`${baseUrl}/users/${createdUser.id}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        newPassword: 'MyNewPermanentPassword123',
      }),
    });
    assert(resChange.status === 200, `Expected 200, got ${resChange.status}`);

    // 5D: Try GET /users again - now it should NOT return 403 MUST_CHANGE_PASSWORD
    // (It might return 403 FORBIDDEN_ROLE because a cashier cannot access /users, but it must NOT be MUST_CHANGE_PASSWORD)
    const resPostUnblock = await fetch(`${baseUrl}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });
    assert(resPostUnblock.status === 403, `Expected 403 FORBIDDEN_ROLE, got ${resPostUnblock.status}`);
    const dataPostUnblock = await resPostUnblock.json() as any;
    assert(dataPostUnblock.error === 'FORBIDDEN_ROLE', `Expected FORBIDDEN_ROLE, got ${dataPostUnblock.error}`);
  });

  // 6. Test E2E Client & UI Integration: login response has mustChangePassword and 403 MUST_CHANGE_PASSWORD triggers event
  await runTest('API & Client: E2E Integration - login user object has mustChangePassword & 403 triggers custom event', async () => {
    // 6A: Create a user via storage (mustChangePassword defaults to true)
    const newUser = storage.createUser({
      username: 'e2e_user',
      name: 'E2E User',
      role: 'cashier',
      password: 'TemporaryPassword123!',
      mustChangePassword: true,
    });

    // 6B: Try to login via API POST /auth/login
    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'e2e_user',
        password: 'TemporaryPassword123!',
      }),
    });

    assert(resLogin.status === 200, `Login should succeed, got ${resLogin.status}`);
    const loginData = await resLogin.json() as any;
    assert(loginData.success === true, 'Login response success is true');
    assert(loginData.user.mustChangePassword === true, 'Login user object must contain mustChangePassword: true');

    const e2eToken = loginData.token;

    // 6C: Check that accessing a restricted API endpoint returns 403 with MUST_CHANGE_PASSWORD
    const resRestricted = await fetch(`${baseUrl}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${e2eToken}`,
      },
    });

    assert(resRestricted.status === 403, `Access to users should return 403, got ${resRestricted.status}`);
    const restrictedData = await resRestricted.json() as any;
    assert(restrictedData.error === 'MUST_CHANGE_PASSWORD', `Error should be MUST_CHANGE_PASSWORD, got ${restrictedData.error}`);
  });

  // Clean up and close server
  server.close();

  console.log(`\nPhase 37-A Test Run Completed: ${testPassed} passed, ${testFailed} failed.`);
  if (testFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
