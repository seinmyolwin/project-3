import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './src/server/routes';
import { serverStorage } from './src/server/storage';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize Persistent SQLite Storage
  await serverStorage.initialize();

  // API Routes
  app.use('/api', createApiRouter(serverStorage));

  // Vite middleware for development / static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Shop Server] Running on http://0.0.0.0:${PORT} (ACID SQLite Persistent Database)`);
  });
}

startServer().catch(err => {
  console.error('[Shop Server] Failed to start:', err);
  process.exit(1);
});
