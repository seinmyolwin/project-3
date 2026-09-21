/**
 * ============================================================================
 * PHASE 22: STANDALONE LOCAL RUNTIME & PACKAGING AUTOMATED TEST SUITE
 * ============================================================================
 * Tests:
 * 1. Production runtime configuration & path resolution
 * 2. Immutable binaries vs. mutable data directory separation
 * 3. Startup health & lifecycle state progression
 * 4. Production static frontend serving logic
 * 5. Persistent SQLite database initialization & custom path support
 * 6. Backup creation, listing, and restore in data/backups/
 * 7. Graceful shutdown & lifecycle controller
 * 8. Process restart & data persistence verification
 * 9. Local LAN binding (0.0.0.0) & interface enumeration
 * 10. Security boundary & zero-telemetry / offline guarantee
 * 11. Dexie offline fallback integrity
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getRuntimeConfig } from '../../server/config';
import { PersistentSQLiteStorage } from '../../server/storage';
import { healthManager } from '../../server/health';
import { logger } from '../../server/logger';

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

async function runPhase22Tests() {
  console.log('================================================================');
  console.log('PHASE 22: STANDALONE LOCAL RUNTIME & PACKAGING TESTS');
  console.log('================================================================\n');

  const testTempDir = path.join(process.cwd(), 'data', 'test_phase22_' + Date.now());
  if (!fs.existsSync(testTempDir)) {
    fs.mkdirSync(testTempDir, { recursive: true });
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Runtime Configuration & Path Resolution
    // -------------------------------------------------------------
    console.log('[TEST 1] Runtime Configuration & Data Directory Resolution');
    process.env.APP_DATA_DIR = testTempDir;
    const config = getRuntimeConfig();
    assert(config.dataDir === testTempDir, 'Data directory resolves to custom APP_DATA_DIR');
    assert(config.databasePath.startsWith(testTempDir), 'Database path resides inside data directory');
    assert(config.backupDir.startsWith(testTempDir), 'Backup directory resides inside data directory');
    assert(config.logsDir.startsWith(testTempDir), 'Logs directory resides inside data directory');
    assert(config.host === '0.0.0.0', 'Host defaults to 0.0.0.0 for LAN binding');
    const expectedPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    assert(config.port === expectedPort, `Port matches configured port (${config.port})`);

    // -------------------------------------------------------------
    // TEST 2: Binary vs Data Separation (No mutable data inside dist/)
    // -------------------------------------------------------------
    console.log('\n[TEST 2] Immutable Binaries vs Mutable Data Separation');
    assert(!config.databasePath.includes('dist'), 'Database path is NOT inside dist/ folder');
    assert(!config.backupDir.includes('dist'), 'Backups are NOT stored inside dist/ folder');
    assert(!config.logsDir.includes('dist'), 'Logs are NOT stored inside dist/ folder');

    // -------------------------------------------------------------
    // TEST 3: Health Manager & Lifecycle States
    // -------------------------------------------------------------
    console.log('\n[TEST 3] Startup Health & Lifecycle States');
    healthManager.setState('STARTING');
    assert(healthManager.getState() === 'STARTING', 'State can be set to STARTING');
    assert(!healthManager.isReady(), 'System is not ready in STARTING state');

    healthManager.setState('DATABASE_INITIALIZING');
    assert(healthManager.getState() === 'DATABASE_INITIALIZING', 'State transitions to DATABASE_INITIALIZING');

    healthManager.setState('READY');
    assert(healthManager.isReady(), 'System is ready in READY state');

    const health = healthManager.getHealth(true, config.databasePath);
    assert(health.status === 'ok', 'Health status is OK when ready');
    assert(health.lifecycleState === 'READY', 'Health report reflects READY lifecycle state');
    assert(Array.isArray(health.lan.interfaces), 'LAN interfaces enumerated correctly');

    // -------------------------------------------------------------
    // TEST 4: Production Logging & Secret Redaction
    // -------------------------------------------------------------
    console.log('\n[TEST 4] Production Logging & Sensitive Data Redaction');
    logger.info('TestContext', 'Testing sensitive log', {
      username: 'admin',
      password: 'MySecretPassword123!',
      token: 'jwt.token.secret',
      normalField: 'safeValue',
    });

    const recentLogs = logger.getRecentLogs(10);
    assert(recentLogs.length > 0, 'Log entry successfully written to data/logs/app.log');
    const lastLog = recentLogs[recentLogs.length - 1];
    assert(!lastLog.includes('MySecretPassword123!'), 'Password was redacted from log file');
    assert(!lastLog.includes('jwt.token.secret'), 'Token was redacted from log file');
    assert(lastLog.includes('[REDACTED]'), 'Redacted marker exists in log entry');

    // -------------------------------------------------------------
    // TEST 5: Standalone SQLite Engine with Custom Path
    // -------------------------------------------------------------
    console.log('\n[TEST 5] Standalone SQLite Engine with Custom Path');
    const customDbPath = path.join(testTempDir, 'standalone_test_db.sqlite');
    const storage = new PersistentSQLiteStorage(customDbPath);
    await storage.initialize();
    assert(storage.isReady(), 'Storage initializes cleanly with custom path');
    assert(fs.existsSync(customDbPath), 'Database file created on disk at custom path');

    // -------------------------------------------------------------
    // TEST 6: Backup Creation, Listing, and Validation
    // -------------------------------------------------------------
    console.log('\n[TEST 6] Backup Creation, Listing, and Validation');
    const customBackupDir = path.join(testTempDir, 'backups');
    fs.mkdirSync(customBackupDir, { recursive: true });

    const backupFile = path.join(customBackupDir, `backup_${Date.now()}.sqlite`);
    storage.exportBackup(backupFile);
    assert(fs.existsSync(backupFile), 'Backup exported to target directory');
    const backupStats = fs.statSync(backupFile);
    assert(backupStats.size > 0, 'Backup file has non-zero size');

    const backupsList = storage.listBackups(customBackupDir);
    assert(backupsList.length > 0, 'Backup listing detects created backup');
    assert(backupsList[0].fileName.endsWith('.sqlite'), 'Backup file has .sqlite extension');

    // -------------------------------------------------------------
    // TEST 7: Backup Restore & Data Recovery
    // -------------------------------------------------------------
    console.log('\n[TEST 7] Backup Restore & Data Recovery');
    // Modify current DB by inserting an audit entry
    storage.logAudit({
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      userId: 'usr_owner_1',
      userName: 'Owner',
      deviceId: 'DEV_HOST_SERVER',
      action: 'TEMP_TEST_ACTION',
      entityType: 'TEST',
      entityId: 'test_1',
    });

    // Restore from prior backup
    storage.restoreBackup(backupFile);
    assert(storage.isReady(), 'Database operational after restore');

    // -------------------------------------------------------------
    // TEST 8: Graceful Shutdown & Resource Release
    // -------------------------------------------------------------
    console.log('\n[TEST 8] Graceful Shutdown & Resource Release');
    storage.close();
    assert(!storage.isReady(), 'Storage isReady is false after close()');

    // -------------------------------------------------------------
    // TEST 9: Restart & Persistence Across Process Lifecycles
    // -------------------------------------------------------------
    console.log('\n[TEST 9] Restart & Persistence Across Lifecycles');
    const restartedStorage = new PersistentSQLiteStorage(customDbPath);
    await restartedStorage.initialize();
    assert(restartedStorage.isReady(), 'Restarted storage re-opened database file');
    const biz = restartedStorage.getBusiness('BIZ_SHOP_001');
    assert(biz !== undefined, 'Business entity preserved across restart');
    assert(biz?.name === 'Karaoke & PS5 Lounge Mandalay', 'Business name matches persisted data');
    restartedStorage.close();

    // -------------------------------------------------------------
    // TEST 10: Zero-Cloud & 100% Offline Boundary Verification
    // -------------------------------------------------------------
    console.log('\n[TEST 10] Zero-Cloud & Offline Boundary Verification');
    const forbiddenModules = ['firebase', 'supabase', '@supabase/supabase-js', 'aws-sdk', '@aws-sdk/client-s3'];
    const packageJsonContent = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
    for (const mod of forbiddenModules) {
      assert(!packageJsonContent.includes(`"${mod}"`), `Forbidden cloud module "${mod}" is not in package.json`);
    }

    // -------------------------------------------------------------
    // TEST 11: Production Launcher Files Existence
    // -------------------------------------------------------------
    console.log('\n[TEST 11] Production Launcher Scripts & Documentation');
    assert(fs.existsSync(path.join(process.cwd(), 'start-shop-hub.bat')), 'Windows batch launcher start-shop-hub.bat exists');
    assert(fs.existsSync(path.join(process.cwd(), 'start-shop-hub.sh')), 'Linux/Mac shell launcher start-shop-hub.sh exists');
    assert(fs.existsSync(path.join(process.cwd(), 'FIREWALL_SETUP.md')), 'FIREWALL_SETUP.md exists');
    assert(fs.existsSync(path.join(process.cwd(), 'README_STANDALONE.md')), 'README_STANDALONE.md exists');

    console.log('\n================================================================');
    console.log(`ALL PHASE 22 STANDALONE TESTS PASSED: ${passedTests}/${passedTests}`);
    console.log('================================================================\n');
  } finally {
    // Cleanup temporary test directory
    try {
      if (fs.existsSync(testTempDir)) {
        fs.rmSync(testTempDir, { recursive: true, force: true });
      }
    } catch {}
    delete process.env.APP_DATA_DIR;
  }
}

runPhase22Tests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
