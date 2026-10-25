project live link:[https://codetogether-real-time-collaborative-code-editor.ai.studio/?room=room-5u1o5g-vw1n](https://codetogether-real-time-collaborative-code-editor.ai.studio/?room=room-5u1o5g-vw1n)
# CodeTogether — Real-Time Collaborative Code Editor

**CodeTogether** is a production-grade, full-stack collaborative code editor designed for real-time pair programming, team coding interviews, and multi-user educational sessions. Connected collaborators edit in the same room, see each other's live cursor positions and selections, switch programming languages, and save revision snapshots backed by PostgreSQL.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Web Browsers / Clients               │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ User A (Editor)      │    │ User B (Peer/Viewer) │  │
│  │ Monaco Code Editor   │    │ Monaco Code Editor   │  │
│  │ Live Remote Cursors  │    │ Live Remote Cursors  │  │
│  └──────────┬───────────┘    └──────────┬───────────┘  │
└─────────────┼───────────────────────────┼──────────────┘
              │ WebSocket / Socket.IO     │
              ▼                           ▼
┌────────────────────────────────────────────────────────┐
│                   Node.js Express Server               │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Socket.IO Real-Time Event Engine                 │  │
│  │  - Room Isolation (`room:roomId`)                │  │
│  │  - Rate Limiter (Max 40 edits/sec)               │  │
│  │  - Presence & Live Cursor Tracking               │  │
│  │  - Optimistic Concurrency & Conflict Detection   │  │
│  │  - Debounced Write-Behind Persistence            │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │ REST API Router (`/api/rooms`)                   │  │
│  │  - Room Lifecycle & Access Control               │  │
│  │  - Password Verification                         │  │
│  │  - Milestone Snapshot Versioning                 │  │
│  └──────────────────────────┬───────────────────────┘  │
└─────────────────────────────┼──────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────┐
│                 PostgreSQL Relational DB               │
│  ┌─────────────────┐ ┌───────────────┐ ┌────────────┐  │
│  │ rooms           │ │ source_files  │ │ users      │  │
│  └─────────────────┘ └───────────────┘ └────────────┘  │
│  ┌─────────────────┐ ┌───────────────┐                 │
│  │ saved_versions  │ │ room_members  │                 │
│  └─────────────────┘ └───────────────┘                 │
└────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Code Editor**: Monaco Editor (`@monaco-editor/react`) with syntax highlighting for JavaScript (Node.js) and Python 3
- **Backend**: Node.js, Express, TypeScript (`tsx`)
- **Real-Time Communication**: Socket.IO / WebSockets with multi-room isolation and reconnection recovery
- **Database & ORM**: PostgreSQL (Cloud SQL / Neon) using Drizzle ORM and `pg` connection pooling
- **Authentication**: Firebase Authentication (Google OAuth & Guest developer sessions)
- **Automated Testing**: Vitest, Supertest, and Socket.IO client integration test suite
- **Containerization**: Multi-stage Dockerfile and Docker Compose

---

## 3. Database Schema

The database is structured into 5 normalized relational tables with foreign keys and cascade deletions:

1. **`users`**:
   - `id`: Serial primary key
   - `uid`: Unique Firebase Auth UID or session guest identifier
   - `email`: User email
   - `display_name`: Collaborator display name
   - `photo_url`: Avatar URL
   - `created_at`, `updated_at`: Timestamps

2. **`rooms`**:
   - `id`: Varchar(64) primary key (e.g., `room-abc123-x9z`)
   - `name`: Title of collaboration room
   - `description`: Optional project description
   - `owner_uid`: UID of creator
   - `is_public`: Boolean visibility toggle
   - `access_password`: Optional password for protected rooms
   - `default_language`: `javascript` or `python`
   - `created_at`, `updated_at`: Timestamps

3. **`room_members`**:
   - `id`: Serial primary key
   - `room_id`: Foreign key referencing `rooms.id`
   - `user_uid`: Collaborator UID
   - `display_name`: Name displayed in room
   - `role`: `'owner' | 'editor' | 'viewer'`
   - `joined_at`, `last_seen_at`: Timestamps

4. **`source_files`**:
   - `id`: Serial primary key
   - `room_id`: Foreign key referencing `rooms.id` (Unique per room)
   - `file_name`: File name (e.g. `main.js`, `main.py`)
   - `language`: Current programming language
   - `content`: Complete active source code
   - `version`: Monotonically increasing integer version counter
   - `yjs_state`: Optional CRDT state vector
   - `updated_by_uid`, `updated_by_name`: Last modifier
   - `updated_at`: Last write timestamp

5. **`saved_versions`**:
   - `id`: Serial primary key
   - `room_id`: Foreign key referencing `rooms.id`
   - `version_number`: Incremental snapshot milestone number
   - `label`: Human-readable commit milestone (e.g., "Added binary search")
   - `content`: Code buffer at snapshot time
   - `language`: Language at snapshot time
   - `author_uid`, `author_name`: Author who took snapshot
   - `created_at`: Creation timestamp

---

## 4. Concurrency & Synchronization Strategy

### 4.1 Real-Time Editing Mechanics
CodeTogether pairs **in-memory authoritative server routing** with **debounced write-behind database persistence**:

1. **In-Memory Low Latency Broadcast**:
   - When a user types in Monaco, an edit event is fired to Socket.IO.
   - The server maintains the authoritative document text and an incrementing `version` counter in memory.
   - Edits are validated (rate limits, message size, role permissions) and broadcast immediately to all peers in the room.
2. **Conflict & Stale Update Detection**:
   - Clients send their current `version` along with edits.
   - If a client packet arrives with an outdated version (`version < serverVersion - 1`), the server flags a conflict and transmits the authoritative state (`code:sync_conflict`), preventing stale updates from clobbering recent edits.
3. **Debounced PostgreSQL Persistence**:
   - Writing to PostgreSQL on every single keystroke causes disk I/O thrashing and connection pool exhaustion.
   - The server queues edits into a 2500ms debounce timer. Once typing pauses for 2.5s, the current state is committed to PostgreSQL in an atomic `UPDATE` query.
4. **CRDT / Yjs Integration**:
   - The system is architected with `yjsState` vector support in the database and message contracts. For advanced concurrent character insertions, Yjs CRDT vectors guarantee convergent eventual consistency across asynchronous distributed networks.

### 4.2 Limitations & Trade-offs
- **Full Text vs Delta Updates**: At document sizes under 1.5MB, sending updated text with version counters provides sub-10ms latency. For massive repositories (>10MB), operational transforms or chunked diffs are preferred.
- **Network Partitions**: During an extended offline network partition, reconnecting clients request a fresh snapshot from the server.

---

## 5. API Endpoints & WebSocket Events

### REST API
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check and DB status |
| `GET` | `/api/rooms` | List public and accessible rooms |
| `POST` | `/api/rooms` | Create a new collaboration room |
| `GET` | `/api/rooms/:id` | Get room metadata and current source code |
| `POST` | `/api/rooms/:id/verify-password` | Verify password for private rooms |
| `GET` | `/api/rooms/:id/versions` | List snapshot version history |
| `POST` | `/api/rooms/:id/versions` | Create an immutable snapshot checkpoint |
| `POST` | `/api/rooms/:id/versions/:vid/restore` | Roll back code to selected snapshot |

### WebSocket Events (Socket.IO)
| Event | Direction | Payload |
|---|---|---|
| `room:join` | Client → Server | `{ roomId, user: { uid, displayName }, password, readOnly }` |
| `room:joined` | Server → Client | `{ room, file, role, participants, myColor }` |
| `code:change` | Client ↔ Server | `{ roomId, content, version, yjsUpdate }` |
| `cursor:move` | Client → Server | `{ roomId, cursor: { lineNumber, column } }` |
| `cursor:update` | Server → Peers | `{ socketId, uid, displayName, color, cursor }` |
| `language:change` | Client ↔ Server | `{ roomId, language }` |
| `code:save_snapshot`| Client → Server | `{ roomId, label }` |
| `save:status` | Server → Clients | `{ status: 'saving' \| 'saved' \| 'error' }` |
| `code:sync_conflict`| Server → Client | `{ serverVersion, currentContent, message }` |

---

## 6. Testing Guide

### 6.1 Automated Test Suite
Run the comprehensive automated test suite with Vitest:
```bash
npm test
```
The test suite validates:
- Room creation with default starter templates in PostgreSQL
- Invalid payload rejections (empty title, oversized inputs)
- Password-protected room security (unauthorized rejection, valid unlock)
- Real-time two-client WebSocket message propagation
- Stale update conflict detection
- Disconnect and full state reconnection recovery
- PostgreSQL milestone snapshot persistence and one-click rollback

### 6.2 Manual Multi-User Test Walkthrough
To verify real-time collaboration with two browser sessions:

1. **Session A**:
   - Open CodeTogether in your primary browser window.
   - Click **Create Collaboration Room**, name it `Pair Programming Lab`, select **Python**, and click **Launch Room**.
   - Note the room URL or click the **Share** button in the navbar.
2. **Session B**:
   - Open a new **Incognito Window** (or a separate browser like Chrome/Firefox).
   - Paste the room URL into the incognito window.
3. **Verify Collaboration**:
   - In Session A, move your cursor through the Python file. In Session B, you will see Session A's name tag and cursor position moving live!
   - In Session B, type a function `def fibonacci(n):`. The code updates instantly in Session A without page reloads.
   - In Session A, click **Save Snapshot**, enter `Implemented Fibonacci`, and save.
   - In Session B, open the **History** tab in the sidebar: snapshot #2 will appear in real time!
   - Click **Copy Read-Only Link** in the Settings tab, open it in a third tab, and confirm that editing is cleanly restricted.

---

## 7. Deployment Instructions

### 7.1 Running with Docker Compose
To run CodeTogether locally with its own dedicated PostgreSQL container:
```bash
# 1. Clone repository
git clone <repo-url>
cd codetogether

# 2. Build and launch services
docker-compose up --build
```
The application will be live at `http://localhost:3000`.

### 7.2 Production Hosting (Cloud Run / VPS)
1. Set the runtime environment variables in `.env`:
   - `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`
2. Run database migrations:
   - `npx drizzle-kit push`
3. Build and launch:
   - `npm run build && npm start`

---

## 8. Software Engineering Intern Interview Discussion Guide

When discussing CodeTogether during an engineering interview, highlight these key design decisions:

1. **Why connection pooling with the Object Method instead of raw connection strings?**
   - Object configuration enables connection reuse across Express requests and background Socket.IO worker jobs without hitting PostgreSQL max-client limits or leaking credentials in logs.
2. **Write-behind caching vs synchronous database writes:**
   - Keystrokes generate 5–20 events per second per active typist. Writing synchronously to disk would introduce latency spikes and database lock contention. An in-memory authoritative state with a 2.5s debounce ensures sub-millisecond editor responsiveness while providing guaranteed persistence.
3. **Optimistic Versioning vs CRDTs:**
   - Explain that last-write-wins with monotonically increasing version numbers provides clean conflict detection for standard pair programming, while Yjs CRDT update vectors enable character-level commutative merging without central locking.
4. **Resilience to Network Drops:**
   - Socket.IO reconnects with exponential backoff and jitter. On reconnection, the client issues a `room:join` packet, pulling the authoritative server snapshot to seamlessly reconcile any edits missed while disconnected.
