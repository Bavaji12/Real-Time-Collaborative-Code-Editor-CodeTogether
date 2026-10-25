import { Server as SocketIOServer, Socket } from 'socket.io';
import { getRoomById, recordRoomMember, saveSnapshotVersion, updateSourceFileContent } from '../db/rooms.ts';

export interface RoomParticipant {
  socketId: string;
  uid: string;
  displayName: string;
  color: string;
  role: 'owner' | 'editor' | 'viewer';
  cursor?: { lineNumber: number; column: number };
  joinedAt: number;
}

interface RoomRuntimeState {
  roomId: string;
  currentContent: string;
  language: string;
  version: number;
  yjsState?: string;
  participants: Map<string, RoomParticipant>;
  saveTimeout?: NodeJS.Timeout;
  isSaving: boolean;
}

// In-memory active room runtime states for microsecond latency
const roomStates = new Map<string, RoomRuntimeState>();

// Distinct modern avatar/cursor colors
const PARTICIPANT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
];

function getRandomColor(index: number) {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}

// Rate limiting map: socketId -> count of edits in current window
const editRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(socketId: string, maxPerSecond = 40): boolean {
  const now = Date.now();
  const record = editRateLimits.get(socketId);
  if (!record || now > record.resetAt) {
    editRateLimits.set(socketId, { count: 1, resetAt: now + 1000 });
    return true;
  }
  if (record.count >= maxPerSecond) {
    return false;
  }
  record.count++;
  return true;
}

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;
    let currentUserUid: string | null = null;

    // 1. Join room event
    socket.on('room:join', async (payload: {
      roomId: string;
      user: { uid: string; displayName: string };
      password?: string;
      readOnly?: boolean;
    }) => {
      try {
        const { roomId, user, password, readOnly } = payload;
        if (!roomId || !user?.uid) {
          socket.emit('room:error', { message: 'Invalid room or user identifier' });
          return;
        }

        // Fetch room info from PostgreSQL
        const room = await getRoomById(roomId);
        if (!room) {
          socket.emit('room:error', { message: 'Room not found' });
          return;
        }

        // Check password protection if private
        if (!room.isPublic && room.accessPassword) {
          if (!password || password !== room.accessPassword) {
            socket.emit('room:error', {
              code: 'UNAUTHORIZED',
              message: 'Incorrect password for this protected room',
            });
            return;
          }
        }

        currentRoomId = roomId;
        currentUserUid = user.uid;

        // Determine user role
        let role: 'owner' | 'editor' | 'viewer' = 'editor';
        if (room.ownerUid === user.uid) {
          role = 'owner';
        } else if (readOnly) {
          role = 'viewer';
        }

        // Initialize or get room runtime state
        let state = roomStates.get(roomId);
        if (!state) {
          state = {
            roomId,
            currentContent: room.file?.content || '',
            language: room.file?.language || room.defaultLanguage || 'javascript',
            version: room.file?.version || 1,
            yjsState: room.file?.yjsState || undefined,
            participants: new Map(),
            isSaving: false,
          };
          roomStates.set(roomId, state);
        }

        // Assign participant color
        const color = getRandomColor(state.participants.size);
        const participant: RoomParticipant = {
          socketId: socket.id,
          uid: user.uid,
          displayName: user.displayName || 'Collaborator',
          color,
          role,
          joinedAt: Date.now(),
        };

        state.participants.set(socket.id, participant);
        socket.join(`room:${roomId}`);

        // Persist membership in DB asynchronously
        recordRoomMember({
          roomId,
          userUid: user.uid,
          displayName: participant.displayName,
          role,
        }).catch((err) => console.error('Failed to log room member in DB:', err));

        // Prepare participants list for clients
        const participantsList = Array.from(state.participants.values());

        // Emit initial room state to joining client
        socket.emit('room:joined', {
          room: {
            id: room.id,
            name: room.name,
            description: room.description,
            isPublic: room.isPublic,
            ownerUid: room.ownerUid,
            defaultLanguage: room.defaultLanguage,
          },
          file: {
            content: state.currentContent,
            language: state.language,
            version: state.version,
          },
          role,
          participants: participantsList,
          myColor: color,
        });

        // Broadcast presence to all other peers in room
        socket.to(`room:${roomId}`).emit('user:joined', {
          participant,
          participants: participantsList,
        });

        console.log(`[Socket] User ${user.displayName} (${socket.id}) joined room ${roomId} as ${role}`);
      } catch (err: any) {
        console.error('[Socket] room:join error:', err);
        socket.emit('room:error', { message: err.message || 'Failed to join room' });
      }
    });

    // 2. Real-time code change event
    socket.on('code:change', async (payload: {
      roomId: string;
      content: string;
      version: number;
      yjsUpdate?: string;
    }) => {
      try {
        const { roomId, content, version, yjsUpdate } = payload;
        if (!roomId || content === undefined) return;

        // Rate limiting
        if (!checkRateLimit(socket.id)) {
          socket.emit('rate:limit', { message: 'Typing rate limit exceeded. Please slow down.' });
          return;
        }

        // Payload size safety limit: 1.5MB
        if (content.length > 1500000) {
          socket.emit('room:error', { message: 'Document exceeds maximum supported size (1.5MB)' });
          return;
        }

        const state = roomStates.get(roomId);
        if (!state) return;

        const participant = state.participants.get(socket.id);
        if (!participant || participant.role === 'viewer') {
          socket.emit('room:error', { message: 'You are in read-only mode and cannot edit this document' });
          return;
        }

        // Stale update check
        if (version !== undefined && version < state.version - 1) {
          // Stale edit warning - provide current server content for client reconciliation
          socket.emit('code:sync_conflict', {
            serverVersion: state.version,
            currentContent: state.currentContent,
            message: 'Conflict detected: your local version was out of date. Syncing server state.',
          });
          return;
        }

        // Update server runtime state
        state.currentContent = content;
        state.version += 1;
        if (yjsUpdate) {
          state.yjsState = yjsUpdate;
        }

        // Broadcast live change to all other peers in the room
        socket.to(`room:${roomId}`).emit('code:change', {
          content: state.currentContent,
          version: state.version,
          yjsUpdate,
          senderUid: participant.uid,
          senderName: participant.displayName,
        });

        // Debounce persistence to PostgreSQL database (auto-save every 2.5s of inactivity)
        if (state.saveTimeout) clearTimeout(state.saveTimeout);
        state.saveTimeout = setTimeout(async () => {
          try {
            state.isSaving = true;
            io.to(`room:${roomId}`).emit('save:status', { status: 'saving' });

            await updateSourceFileContent({
              roomId,
              content: state.currentContent,
              language: state.language,
              yjsState: state.yjsState,
              userUid: participant.uid,
              userName: participant.displayName,
            });

            state.isSaving = false;
            io.to(`room:${roomId}`).emit('save:status', {
              status: 'saved',
              version: state.version,
              timestamp: Date.now(),
            });
          } catch (dbErr) {
            state.isSaving = false;
            console.error('[DB Auto-Save Error]:', dbErr);
            io.to(`room:${roomId}`).emit('save:status', {
              status: 'error',
              message: 'Failed to persist updates to PostgreSQL database',
            });
          }
        }, 2500);
      } catch (err: any) {
        console.error('[Socket] code:change error:', err);
      }
    });

    // 3. Cursor movement event
    socket.on('cursor:move', (payload: {
      roomId: string;
      cursor: { lineNumber: number; column: number };
    }) => {
      const { roomId, cursor } = payload;
      if (!roomId || !cursor) return;

      const state = roomStates.get(roomId);
      if (!state) return;

      const participant = state.participants.get(socket.id);
      if (!participant) return;

      participant.cursor = cursor;

      // Broadcast to other collaborators
      socket.to(`room:${roomId}`).emit('cursor:update', {
        socketId: socket.id,
        uid: participant.uid,
        displayName: participant.displayName,
        color: participant.color,
        cursor,
      });
    });

    // 4. Language selection change
    socket.on('language:change', async (payload: { roomId: string; language: string }) => {
      try {
        const { roomId, language } = payload;
        if (!['javascript', 'python'].includes(language)) return;

        const state = roomStates.get(roomId);
        if (!state) return;

        const participant = state.participants.get(socket.id);
        if (participant?.role === 'viewer') return;

        state.language = language;

        // Persist language to DB
        await updateSourceFileContent({
          roomId,
          content: state.currentContent,
          language,
        });

        // Broadcast to all clients in room
        io.to(`room:${roomId}`).emit('language:change', {
          language,
          changedBy: participant?.displayName || 'User',
        });
      } catch (err) {
        console.error('[Socket] language:change error:', err);
      }
    });

    // 5. Manual Snapshot Save
    socket.on('code:save_snapshot', async (payload: { roomId: string; label?: string }) => {
      try {
        const { roomId, label } = payload;
        const state = roomStates.get(roomId);
        if (!state) return;

        const participant = state.participants.get(socket.id);
        const authorUid = participant?.uid || 'system';
        const authorName = participant?.displayName || 'Collaborator';

        const saved = await saveSnapshotVersion({
          roomId,
          label: label || `Snapshot saved by ${authorName}`,
          content: state.currentContent,
          language: state.language,
          authorUid,
          authorName,
        });

        io.to(`room:${roomId}`).emit('snapshot:saved', {
          version: saved,
          message: `Saved snapshot #${saved.versionNumber}: ${saved.label}`,
        });
      } catch (err: any) {
        console.error('[Socket] code:save_snapshot error:', err);
        socket.emit('room:error', { message: 'Failed to create snapshot version' });
      }
    });

    // 6. Handle client disconnect
    socket.on('disconnect', () => {
      editRateLimits.delete(socket.id);

      if (currentRoomId) {
        const state = roomStates.get(currentRoomId);
        if (state) {
          const departing = state.participants.get(socket.id);
          state.participants.delete(socket.id);

          const remaining = Array.from(state.participants.values());

          socket.to(`room:${currentRoomId}`).emit('user:left', {
            socketId: socket.id,
            uid: currentUserUid,
            displayName: departing?.displayName,
            participants: remaining,
          });

          // Clean up empty room states after 1 hour of zero participants
          if (state.participants.size === 0) {
            // Persist final code state to PostgreSQL before disposing
            updateSourceFileContent({
              roomId: currentRoomId,
              content: state.currentContent,
              language: state.language,
              yjsState: state.yjsState,
            }).catch((e) => console.error('Final persist on room empty failed:', e));
          }
        }
      }
    });
  });
}
