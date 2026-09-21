/**
 * ============================================================================
 * PHASE 22: STARTUP HEALTH & LIFECYCLE STATE MANAGER
 * ============================================================================
 * Tracks system lifecycle states and provides health metrics for local LAN operation.
 */

import os from 'os';
import { runtimeConfig } from './config';

export type SystemLifecycleState =
  | 'STARTING'
  | 'DATA_DIR_INITIALIZING'
  | 'DATABASE_INITIALIZING'
  | 'MIGRATING'
  | 'SERVER_READY'
  | 'READY'
  | 'SHUTTING_DOWN'
  | 'STOPPED'
  | 'FATAL_ERROR';

export interface HealthStatusResponse {
  status: 'ok' | 'degraded' | 'initializing' | 'error' | 'shutting_down';
  lifecycleState: SystemLifecycleState;
  app: string;
  version: string;
  env: string;
  uptimeSeconds: number;
  timestamp: string;
  database: {
    initialized: boolean;
    path: string;
  };
  lan: {
    host: string;
    port: number;
    interfaces: { name: string; ip: string }[];
  };
  details?: string;
}

class SystemHealthManager {
  private currentState: SystemLifecycleState = 'STARTING';
  private startedAt: number = Date.now();
  private lastError: string | null = null;

  public setState(state: SystemLifecycleState, detail?: string): void {
    this.currentState = state;
    if (detail) {
      this.lastError = detail;
    }
  }

  public getState(): SystemLifecycleState {
    return this.currentState;
  }

  public isReady(): boolean {
    return this.currentState === 'READY' || this.currentState === 'SERVER_READY';
  }

  public getLANInterfaces(): { name: string; ip: string }[] {
    const interfaces = os.networkInterfaces();
    const results: { name: string; ip: string }[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          results.push({ name, ip: addr.address });
        }
      }
    }

    if (results.length === 0) {
      results.push({ name: 'localhost', ip: '127.0.0.1' });
    }

    return results;
  }

  public getHealth(dbInitialized: boolean, dbPath: string): HealthStatusResponse {
    let status: HealthStatusResponse['status'] = 'ok';

    if (this.currentState === 'FATAL_ERROR') {
      status = 'error';
    } else if (this.currentState === 'SHUTTING_DOWN' || this.currentState === 'STOPPED') {
      status = 'shutting_down';
    } else if (!this.isReady()) {
      status = 'initializing';
    }

    return {
      status,
      lifecycleState: this.currentState,
      app: runtimeConfig.appName,
      version: runtimeConfig.appVersion,
      env: runtimeConfig.env,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      database: {
        initialized: dbInitialized,
        path: dbPath,
      },
      lan: {
        host: runtimeConfig.host,
        port: runtimeConfig.port,
        interfaces: this.getLANInterfaces(),
      },
      details: this.lastError || undefined,
    };
  }
}

export const healthManager = new SystemHealthManager();
