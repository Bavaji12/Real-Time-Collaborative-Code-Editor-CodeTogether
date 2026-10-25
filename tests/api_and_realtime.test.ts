import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import roomsRouter from '../src/routes/rooms.ts';
import { setupSocketHandlers } from '../src/realtime/socketHandler.ts';
import { pool } from '../src/db/index.ts';

let server: http.Server;
let ioServer: SocketIOServer;
let serverPort: number;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/rooms', roomsRouter);

  server = http.createServer(app);
  ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
  setupSocketHandlers(ioServer);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      serverPort = addr.port;
      baseUrl = `http://127.0.0.1:${serverPort}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (ioServer) ioServer.close();
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await pool.end();
});

describe('1. Room Creation, Listing, and Validation', () => {
  let createdRoomId: string;

  it('creates a new public collaboration room with default starter code in PostgreSQL', async () => {
    const res = await request(baseUrl)
      .post('/api/rooms')
      .send({
        name: 'Distributed Systems Pair Session',
        description: 'Testing live sync with multiple nodes',
        defaultLanguage: 'javascript',
        isPublic: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.room).toBeDefined();
    expect(res.body.room.name).toBe('Distributed Systems Pair Session');
    expect(res.body.file).toBeDefined();
    expect(res.body.file.language).toBe('javascript');
    expect(res.body.file.version).toBe(1);
    expect(res.body.file.content).toContain('calculateMetrics');

    createdRoomId = res.body.room.id;
  });

  it('rejects invalid payloads with appropriate error status', async () => {
    // Missing room name
    const resEmpty = await request(baseUrl).post('/api/rooms').send({ name: '' });
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error).toContain('Room name is required');

    // Excessively long name
    const resLong = await request(baseUrl).post('/api/rooms').send({ name: 'A'.repeat(120) });
    expect(resLong.status).toBe(400);
  });

  it('returns 404 for non-existent room queries', async () => {
    const res = await request(baseUrl).get('/api/rooms/non_existent_room_999');
    expect(res.status).toBe(404);
  });
});

describe('2. Security, Access Controls, and Password Protection', () => {
  let privateRoomId: string;

  beforeAll(async () => {
    const res = await request(baseUrl)
      .post('/api/rooms')
      .send({
        name: 'Confidential Architecture Room',
        isPublic: false,
        accessPassword: 'SuperSecret123!',
      });
    privateRoomId = res.body.room.id;
  });

  it('rejects unauthorized websocket join to private room with wrong password', async () => {
    const client = ClientIO(baseUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.emit('room:join', {
          roomId: privateRoomId,
          user: { uid: 'guest_unauth', displayName: 'Intruder' },
          password: 'wrong_password',
        });
      });

      client.on('room:error', (err) => {
        expect(err.code).toBe('UNAUTHORIZED');
        client.disconnect();
        resolve();
      });

      client.on('room:joined', () => {
        client.disconnect();
        reject(new Error('Should not have joined private room with wrong password'));
      });
    });
  });

  it('allows access to protected room when correct password is provided', async () => {
    const client = ClientIO(baseUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.emit('room:join', {
          roomId: privateRoomId,
          user: { uid: 'guest_auth', displayName: 'Alice' },
          password: 'SuperSecret123!',
        });
      });

      client.on('room:joined', (data) => {
        expect(data.room.id).toBe(privateRoomId);
        client.disconnect();
        resolve();
      });

      client.on('room:error', (err) => {
        client.disconnect();
        reject(new Error(err.message));
      });
    });
  });
});

describe('3. Real-Time Multi-User Collaboration & Synchronization', () => {
  let testRoomId: string;

  beforeAll(async () => {
    const res = await request(baseUrl)
      .post('/api/rooms')
      .send({
        name: 'Concurrent Collab Room',
        defaultLanguage: 'python',
        isPublic: true,
      });
    testRoomId = res.body.room.id;
  });

  it('synchronizes real-time code changes between multiple clients', async () => {
    const clientA = ClientIO(baseUrl, { transports: ['websocket'] });
    const clientB = ClientIO(baseUrl, { transports: ['websocket'] });

    // Join room for both clients
    await Promise.all([
      new Promise<void>((resolve) => {
        clientA.on('connect', () => {
          clientA.emit('room:join', {
            roomId: testRoomId,
            user: { uid: 'user_a', displayName: 'Developer A' },
          });
        });
        clientA.on('room:joined', () => resolve());
      }),
      new Promise<void>((resolve) => {
        clientB.on('connect', () => {
          clientB.emit('room:join', {
            roomId: testRoomId,
            user: { uid: 'user_b', displayName: 'Developer B' },
          });
        });
        clientB.on('room:joined', () => resolve());
      }),
    ]);

    // Client A sends a code update
    const updatedCode = `# Updated live by Client A\ndef solve(x):\n    return x ** 2\n`;

    const receivedPromise = new Promise<void>((resolve) => {
      clientB.on('code:change', (data) => {
        expect(data.content).toBe(updatedCode);
        expect(data.senderUid).toBe('user_a');
        expect(data.version).toBeGreaterThan(1);
        resolve();
      });
    });

    clientA.emit('code:change', {
      roomId: testRoomId,
      content: updatedCode,
      version: 1,
    });

    await receivedPromise;

    clientA.disconnect();
    clientB.disconnect();
  });

  it('detects stale updates and triggers conflict resolution', async () => {
    const client = ClientIO(baseUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        client.emit('room:join', {
          roomId: testRoomId,
          user: { uid: 'user_c', displayName: 'Late Comer' },
        });
      });
      client.on('room:joined', () => resolve());
    });

    // Send intentionally obsolete/stale version (e.g. version 0 when server is on version > 2)
    const conflictPromise = new Promise<void>((resolve) => {
      client.on('code:sync_conflict', (data) => {
        expect(data.serverVersion).toBeGreaterThan(1);
        expect(data.currentContent).toBeDefined();
        resolve();
      });
    });

    client.emit('code:change', {
      roomId: testRoomId,
      content: 'STALE OBSOLETE OVERWRITE',
      version: 0,
    });

    await conflictPromise;
    client.disconnect();
  });

  it('recovers full state on reconnection', async () => {
    const client = ClientIO(baseUrl, { transports: ['websocket'] });

    // Initial connection
    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        client.emit('room:join', {
          roomId: testRoomId,
          user: { uid: 'user_reconn', displayName: 'Reconnecting User' },
        });
      });
      client.on('room:joined', () => resolve());
    });

    // Simulate disconnect and reconnect
    client.disconnect();
    client.connect();

    const recovered = await new Promise<any>((resolve) => {
      client.on('connect', () => {
        client.emit('room:join', {
          roomId: testRoomId,
          user: { uid: 'user_reconn', displayName: 'Reconnecting User' },
        });
      });
      client.on('room:joined', (data) => resolve(data));
    });

    expect(recovered.room.id).toBe(testRoomId);
    expect(recovered.file.content).toContain('solve(x)');
    client.disconnect();
  });
});

describe('4. PostgreSQL Persistence and Snapshot History', () => {
  let persistRoomId: string;

  beforeAll(async () => {
    const res = await request(baseUrl)
      .post('/api/rooms')
      .send({
        name: 'Persistence Room',
        defaultLanguage: 'javascript',
      });
    persistRoomId = res.body.room.id;
  });

  it('saves an explicit snapshot to PostgreSQL and verifies in database', async () => {
    const snapshotLabel = 'Milestone: Add LRU Cache';
    const snapshotCode = 'class LRUCache { constructor(capacity) { this.cap = capacity; } }';

    const saveRes = await request(baseUrl)
      .post(`/api/rooms/${persistRoomId}/versions`)
      .send({
        label: snapshotLabel,
        content: snapshotCode,
        language: 'javascript',
      });

    expect(saveRes.status).toBe(201);
    expect(saveRes.body.version.label).toBe(snapshotLabel);
    expect(saveRes.body.version.content).toBe(snapshotCode);

    // Verify version list endpoint
    const listRes = await request(baseUrl).get(`/api/rooms/${persistRoomId}/versions`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.versions.length).toBeGreaterThanOrEqual(1);
    const found = listRes.body.versions.find((v: any) => v.label === snapshotLabel);
    expect(found).toBeDefined();

    // Verify rollback / restore
    const restoreRes = await request(baseUrl)
      .post(`/api/rooms/${persistRoomId}/versions/${found.id}/restore`)
      .send();

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.file.content).toBe(snapshotCode);
  });
});
