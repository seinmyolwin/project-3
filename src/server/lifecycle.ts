/**
 * ============================================================================
 * PHASE 22: GRACEFUL SHUTDOWN & LIFECYCLE CONTROLLER
 * ============================================================================
 * Coordinates graceful process termination without database corruption:
 * 1. Mark status SHUTTING_DOWN
 * 2. Drain in-flight requests
 * 3. Flush event outbox
 * 4. Close WebSocket client connections cleanly
 * 5. Close HTTP server
 * 6. Flush and close SQLite database
 * 7. Exit process cleanly
 */

import http from 'http';
import { healthManager } from './health';
import { logger } from './logger';
import { serverStorage } from './storage';
import { realtimeEventBus } from './realtime/eventBus';

export class LifecycleController {
  private isShuttingDown: boolean = false;
  private server: http.Server | null = null;

  public registerServer(server: http.Server): void {
    this.server = server;
  }

  public setupSignalHandlers(): void {
    const handleSignal = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      logger.info('Lifecycle', `Received ${signal}, beginning graceful shutdown sequence...`);
      await this.shutdown(0);
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGHUP', () => handleSignal('SIGHUP'));

    process.on('uncaughtException', async (err) => {
      logger.fatal('Lifecycle', 'Uncaught exception in server process', { message: err.message, stack: err.stack });
      healthManager.setState('FATAL_ERROR', err.message);
      await this.shutdown(1);
    });

    process.on('unhandledRejection', async (reason: any) => {
      logger.error('Lifecycle', 'Unhandled promise rejection in server process', { reason });
    });
  }

  public async shutdown(exitCode = 0): Promise<void> {
    healthManager.setState('SHUTTING_DOWN');

    // 1. Drain WebSocket outbox & close clients
    try {
      logger.info('Lifecycle', 'Flushing WebSocket event outbox and closing connections...');
      await realtimeEventBus.drainOutbox();
      realtimeEventBus.closeAll('Server shutting down');
    } catch (err: any) {
      logger.warn('Lifecycle', 'Notice during WebSocket cleanup:', { error: err.message });
    }

    // 2. Flush SQLite database to disk
    try {
      logger.info('Lifecycle', 'Flushing SQLite database to disk...');
      serverStorage.flushToDisk();
      serverStorage.close();
    } catch (err: any) {
      logger.error('Lifecycle', 'Error during SQLite database flush:', { error: err.message });
    }

    // 3. Stop HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          logger.info('Lifecycle', 'HTTP server stopped.');
          resolve();
        });
      });
    }

    healthManager.setState('STOPPED');
    logger.info('Lifecycle', 'Graceful shutdown completed successfully.');

    if (process.env.NODE_ENV !== 'test') {
      process.exit(exitCode);
    }
  }
}

export const lifecycleController = new LifecycleController();
