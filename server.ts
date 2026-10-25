import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import roomsRouter from './src/routes/rooms.ts';
import { setupSocketHandlers } from './src/realtime/socketHandler.ts';
import { authenticateRequest, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// JSON and URL-encoded parsers with sensible limits
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CodeTogether',
    timestamp: new Date().toISOString(),
    postgresConnected: Boolean(process.env.SQL_HOST),
  });
});

// User sync endpoint (records authenticated user in Postgres)
app.post('/api/auth/sync', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const savedUser = await getOrCreateUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
    res.json({ user: savedUser });
  } catch (err: any) {
    console.error('Failed to sync user with database:', err);
    res.status(500).json({ error: 'Failed to synchronize user account' });
  }
});

// Room routes
app.use('/api/rooms', roomsRouter);

// Initialize Socket.IO with WebSocket transports
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  maxHttpBufferSize: 2e6, // 2MB
});

setupSocketHandlers(io);

// Development mode: attach Vite dev server middleware
// Production mode: serve built assets from dist
const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[CodeTogether] Server running on http://0.0.0.0:${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('[CodeTogether] Fatal startup error:', err);
  process.exit(1);
});

export { app, server, io };
