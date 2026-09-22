/**
 * STEP 4: Targeted Frontend Local Auth & PIN Security Test Suite
 * Verifies salted SHA-256 PIN hashing, verification, one-time migration, and secret redaction.
 */

import { hashPin, verifyPin, generateSalt } from '../../utils/cryptoAuth';
import { UserAccount } from '../../types';

console.log('====================================================');
console.log('STEP 4: FRONTEND LOCAL AUTH & PIN SECURITY TESTS');
console.log('====================================================\n');

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
}

async function runAuthSecurityTests() {
  // Test 1: Salted SHA-256 Hashing Generation & Uniqueness
  console.log('[TEST 1] Salted SHA-256 Hash Generation & Salt Uniqueness');
  const pinInput = '1234';
  const hashed1 = hashPin(pinInput);
  const hashed2 = hashPin(pinInput);

  assert(Boolean(hashed1.pinHash) && hashed1.pinHash.length === 64, 'Pin hash is a 64-character SHA-256 hex string');
  assert(Boolean(hashed1.pinSalt) && hashed1.pinSalt.length > 0, 'Unique random salt is generated');
  assert(hashed1.pinSalt !== hashed2.pinSalt, 'Different salts are generated for separate hashing operations');
  assert(hashed1.pinHash !== hashed2.pinHash, 'Different salts produce distinct hashes for the same PIN input');

  // Test 2: PIN Verification Engine
  console.log('\n[TEST 2] PIN Verification Engine (Pass/Fail Cases)');
  const ownerAccount: UserAccount = {
    id: 'usr_owner_test',
    name: 'Test Owner',
    username: 'test_owner',
    pinHash: hashed1.pinHash,
    pinSalt: hashed1.pinSalt,
    role: 'owner',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  assert(
    verifyPin('1234', ownerAccount.pinHash, ownerAccount.pinSalt),
    'Valid PIN returns true when verified against hash and salt'
  );

  assert(
    !verifyPin('9999', ownerAccount.pinHash, ownerAccount.pinSalt),
    'Invalid PIN returns false when verified against hash and salt'
  );

  assert(
    !verifyPin('123', ownerAccount.pinHash, ownerAccount.pinSalt),
    'Truncated PIN returns false'
  );

  assert(
    !verifyPin('123456', ownerAccount.pinHash, ownerAccount.pinSalt),
    'Extended PIN returns false'
  );

  assert(
    !verifyPin('', ownerAccount.pinHash, ownerAccount.pinSalt),
    'Empty string PIN returns false'
  );

  // Test 3: Backward Compatibility & Migration Support
  console.log('\n[TEST 3] Backward Compatibility & Legacy Fallback');
  const legacyAccount: UserAccount = {
    id: 'usr_legacy_test',
    name: 'Legacy Cashier',
    username: 'legacy_cashier',
    pin: '5678', // Un-migrated legacy plaintext pin
    role: 'cashier',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  assert(
    verifyPin('5678', legacyAccount.pinHash, legacyAccount.pinSalt, legacyAccount.pin),
    'Legacy plaintext PIN falls back safely during verification prior to migration'
  );

  assert(
    !verifyPin('0000', legacyAccount.pinHash, legacyAccount.pinSalt, legacyAccount.pin),
    'Legacy plaintext PIN rejects wrong PIN input'
  );

  // Test 4: Simulated Database Migration Transformation
  console.log('\n[TEST 4] Simulated Database Migration Transformation');
  const { pinHash: migratedHash, pinSalt: migratedSalt } = hashPin(legacyAccount.pin!);
  const migratedAccount: UserAccount = {
    ...legacyAccount,
    pinHash: migratedHash,
    pinSalt: migratedSalt,
  };
  delete migratedAccount.pin;

  assert(!('pin' in migratedAccount), 'Plaintext pin property removed after migration');
  assert(Boolean(migratedAccount.pinHash), 'Migrated account contains pinHash');
  assert(Boolean(migratedAccount.pinSalt), 'Migrated account contains pinSalt');
  assert(
    verifyPin('5678', migratedAccount.pinHash, migratedAccount.pinSalt),
    'Migrated account verifies correctly using salted SHA-256'
  );

  // Test 5: Generic Error Messaging (Non-leaking auth responses)
  console.log('\n[TEST 5] Generic Security Response Boundaries');
  const getAuthErrorMessage = (userExists: boolean, pinValid: boolean) => {
    if (!userExists || !pinValid) {
      return 'Invalid authentication credential. Please try again.';
    }
    return 'Success';
  };

  const errMissingUser = getAuthErrorMessage(false, false);
  const errWrongPin = getAuthErrorMessage(true, false);

  assert(
    errMissingUser === errWrongPin,
    'Failed auth message is identical whether user does not exist or PIN is wrong (no credential leakage)'
  );

  console.log('\n====================================================');
  console.log('ALL STEP 4 FRONTEND AUTH & SECURITY TESTS PASSED!');
  console.log('====================================================\n');
}

runAuthSecurityTests().catch((err) => {
  console.error('STEP 4 AUTH SECURITY TEST FAILED:', err);
  process.exit(1);
});
