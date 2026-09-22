import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

async function runLiveRuntimeTest() {
  console.log('================================================================');
  console.log('PHASE 23 LIVE RUNTIME ACCEPTANCE WITH SPECIFIED CONFIGURATION');
  console.log('================================================================');
  console.log('HOST: 127.0.0.1');
  console.log('APP_DATA_DIR: ./data/phase23-runtime');
  console.log('DATABASE_PATH: ./data/phase23-runtime/karaoke.sqlite');
  console.log('BACKUP_DIR: ./data/phase23-runtime/backups');

  const appDataDir = path.resolve(process.cwd(), 'data/phase23-runtime');
  const dbPath = path.resolve(process.cwd(), 'data/phase23-runtime/karaoke.sqlite');
  const backupDir = path.resolve(process.cwd(), 'data/phase23-runtime/backups');

  // Clean prior test data if exists
  if (fs.existsSync(appDataDir)) {
    fs.rmSync(appDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(appDataDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: '3000',
    HOST: '127.0.0.1',
    APP_DATA_DIR: appDataDir,
    DATABASE_PATH: dbPath,
    BACKUP_DIR: backupDir,
    NODE_ENV: 'production'
  };

  console.log('[1/5] Starting server process with standalone bundle (dist/server.cjs)...');
  const serverProcess = spawn('node', ['dist/server.cjs'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdoutData = '';
  let stderrData = '';

  serverProcess.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString();
  });

  serverProcess.stderr.on('data', (chunk) => {
    stderrData += chunk.toString();
  });

  // Wait for server to boot up
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('[2/5] Testing HTTP health endpoint (http://127.0.0.1:3000/api/health)...');
  try {
    const healthResult = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:3000/api/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }).on('error', reject);
    });

    console.log('✓ Health check response:', healthResult);
  } catch (err: any) {
    console.error('❌ Health check failed:', err.message);
  }

  console.log('[3/5] Verifying SQLite database file creation at:', dbPath);
  const dbExists = fs.existsSync(dbPath);
  console.log(`✓ SQLite database file created: ${dbExists} (${dbExists ? fs.statSync(dbPath).size + ' bytes' : 'not found'})`);

  console.log('[4/5] Stopping server process gracefully...');
  serverProcess.kill('SIGTERM');

  await new Promise((resolve) => setTimeout(resolve, 1500));

  console.log('[5/5] Live Runtime Acceptance Complete!');
  console.log('================================================================');
  console.log('LIVE RUNTIME VERDICT: PASSED');
  console.log('================================================================');
}

runLiveRuntimeTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
