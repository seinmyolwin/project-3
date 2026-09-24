/**
 * ============================================================================
 * PHASE 22: PRODUCTION RUNTIME CONFIGURATION & PATH RESOLUTION
 * ============================================================================
 * Manages runtime directories and ensures complete separation between:
 * - Immutable application binaries (code, dist/ assets)
 * - Mutable persistent business data (database, backups, logs, configs)
 * 100% offline, zero cloud dependencies.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

export interface ServerRuntimeConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  host: string;
  dataDir: string;
  databasePath: string;
  backupDir: string;
  logsDir: string;
  configDir: string;
  distPath: string;
  appVersion: string;
  appName: string;
  isPackaged: boolean;
}

function resolveDataDirectory(): string {
  // 1. Explicit environment override
  if (process.env.APP_DATA_DIR && process.env.APP_DATA_DIR.trim().length > 0) {
    return path.resolve(process.env.APP_DATA_DIR.trim());
  }

  if (process.env.KARAOKE_DATA_DIR && process.env.KARAOKE_DATA_DIR.trim().length > 0) {
    return path.resolve(process.env.KARAOKE_DATA_DIR.trim());
  }

  // 2. Default relative data directory inside workspace / execution root
  const localDataDir = path.join(process.cwd(), 'data');
  return localDataDir;
}

export function getRuntimeConfig(): ServerRuntimeConfig {
  const env = (process.env.NODE_ENV === 'production' ? 'production' : (process.env.NODE_ENV === 'test' ? 'test' : 'development'));
  const portArgIndex = process.argv.indexOf('--port');
  const hostArgIndex = process.argv.indexOf('--host');
  const cliPort = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
  const cliHost = hostArgIndex !== -1 && process.argv[hostArgIndex + 1] ? process.argv[hostArgIndex + 1] : null;

  const port = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
  const host = cliHost || process.env.HOST || '0.0.0.0';
  const dataDir = resolveDataDirectory();

  const databasePath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(dataDir, 'karaoke_ps5_server_db.sqlite');

  const backupDir = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.join(dataDir, 'backups');

  const logsDir = path.join(dataDir, 'logs');
  const configDir = path.join(dataDir, 'config');
  
  // In bundled / packaged standalone executable, dist may be relative to __dirname or process.cwd()
  let distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distPath) && typeof __dirname !== 'undefined') {
    const candidate = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(candidate)) {
      distPath = candidate;
    } else if (fs.existsSync(path.join(__dirname, 'dist'))) {
      distPath = path.join(__dirname, 'dist');
    }
  }

  // Ensure directories exist synchronously
  [dataDir, backupDir, logsDir, configDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn(`[Config] Notice: Failed creating directory ${dir}:`, err);
      }
    }
  });

  return {
    env,
    port,
    host,
    dataDir,
    databasePath,
    backupDir,
    logsDir,
    configDir,
    distPath,
    appVersion: '1.0.0',
    appName: 'Shwe Thiri Spa & KTV ERP',
    isPackaged: Boolean(process.env.IS_PACKAGED || (process as any).pkg),
  };
}

export const runtimeConfig = getRuntimeConfig();
