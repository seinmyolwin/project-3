/**
 * ============================================================================
 * PHASE 22: PRODUCTION STANDALONE ENTRY POINT & RUNTIME SERVER
 * ============================================================================
 * 100% Offline Standalone LAN Shop Server
 * - Serves production React/Vite SPA from dist/
 * - Persistent ACID SQLite database in dedicated data/ directory
 * - Real-time WebSocket LAN event bus on /ws
 * - Graceful shutdown on SIGINT/SIGTERM
 * - Zero cloud / zero external telemetry
 */

import http from 'http';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { runtimeConfig } from './src/server/config';
import { logger } from './src/server/logger';
import { healthManager } from './src/server/health';
import { lifecycleController } from './src/server/lifecycle';
import { serverStorage } from './src/server/storage';
import { createApiRouter } from './src/server/routes';
import { realtimeEventBus } from './src/server/realtime/eventBus';

async function startServer() {
  healthManager.setState('STARTING');
  logger.info('Server', `Initializing ${runtimeConfig.appName} (v${runtimeConfig.appVersion})...`, {
    env: runtimeConfig.env,
    port: runtimeConfig.port,
    dataDir: runtimeConfig.dataDir,
  });

  const app = express();
  const server = http.createServer(app);

  // Register with lifecycle controller for graceful shutdown
  lifecycleController.registerServer(server);
  lifecycleController.setupSignalHandlers();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 1. Initialize Data Directories
  healthManager.setState('DATA_DIR_INITIALIZING');
  logger.info('Server', 'Ensuring data directories are prepared...');

  // 2. Initialize Persistent SQLite Storage & Run Migrations
  healthManager.setState('DATABASE_INITIALIZING');
  try {
    logger.info('Server', `Initializing SQLite database at: ${runtimeConfig.databasePath}`);
    healthManager.setState('MIGRATING');
    await serverStorage.initialize();
    logger.info('Server', 'SQLite database initialized and migrations verified.');
  } catch (dbErr: any) {
    logger.fatal('Server', 'Database initialization failed!', { error: dbErr.message });
    healthManager.setState('FATAL_ERROR', `Database initialization failed: ${dbErr.message}`);

    // Render friendly user-facing error screen
    app.get('*', (req: Request, res: Response) => {
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${runtimeConfig.appName} - Startup Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 520px; width: 100%; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            h1 { margin-top: 0; color: #f43f5e; font-size: 20px; display: flex; align-items: center; gap: 10px; }
            p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
            .badge { background: #0f172a; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; color: #cbd5e1; border: 1px solid #334155; word-break: break-all; margin: 16px 0; }
            .btn { display: inline-block; background: #3b82f6; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Application Could Not Start</h1>
            <p><strong>${runtimeConfig.appName}</strong> encountered an error during database initialization.</p>
            <div class="badge">Error: ${dbErr.message}</div>
            <p>Please check file permissions on the application data directory:</p>
            <div class="badge">${runtimeConfig.dataDir}</div>
            <p>Ensure no other instance of the server is locking the database file.</p>
          </div>
        </body>
        </html>
      `);
    });

    server.listen(runtimeConfig.port, runtimeConfig.host, () => {
      logger.warn('Server', `Server listening in error state on http://${runtimeConfig.host}:${runtimeConfig.port}`);
    });
    return;
  }

  // 3. API Routes
  app.use('/api', createApiRouter(serverStorage));

  // 4. Attach Real-Time WebSocket LAN Event Bus
  realtimeEventBus.setStorage(serverStorage);
  realtimeEventBus.attach(server);

  // 5. Static Frontend Asset Serving / SPA Fallback
  if (process.env.NODE_ENV === 'production') {
    // Production static serving from dist/
    const distPath = runtimeConfig.distPath;
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Application frontend build index.html not found. Please run: npm run build');
        }
      });
    } else {
      logger.warn('Server', `Warning: Production dist directory not found at ${distPath}`);
      app.get('*', (req: Request, res: Response) => {
        res.status(503).send(`
          <h2>${runtimeConfig.appName}</h2>
          <p>Application frontend is currently compiling or not yet built.</p>
          <p>Please run <code>npm run build</code></p>
        `);
      });
    }
  } else {
    // Development dynamic Vite middleware (only when dev requested)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  healthManager.setState('SERVER_READY');

  server.listen(runtimeConfig.port, runtimeConfig.host, () => {
    healthManager.setState('READY');
    logger.info('Server', `================================================================`);
    logger.info('Server', `${runtimeConfig.appName} is running! (100% Offline LAN Host)`);
    logger.info('Server', `Localhost Access: http://localhost:${runtimeConfig.port}`);
    
    const lanInterfaces = healthManager.getLANInterfaces();
    lanInterfaces.forEach((iface) => {
      logger.info('Server', `LAN Client Access (${iface.name}): http://${iface.ip}:${runtimeConfig.port}`);
    });
    logger.info('Server', `Database Path: ${runtimeConfig.databasePath}`);
    logger.info('Server', `Backups Directory: ${runtimeConfig.backupDir}`);
    logger.info('Server', `Logs Directory: ${runtimeConfig.logsDir}`);
    logger.info('Server', `================================================================`);
  });
}

startServer().catch((err) => {
  logger.fatal('Server', 'Fatal startup exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
