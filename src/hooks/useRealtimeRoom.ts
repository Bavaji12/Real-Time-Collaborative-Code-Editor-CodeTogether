import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { UserState } from '../context/AuthContext.tsx';

export interface Participant {
  socketId: string;
  uid: string;
  displayName: string;
  color: string;
  role: 'owner' | 'editor' | 'viewer';
  cursor?: { lineNumber: number; column: number };
}

export interface RoomMeta {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  ownerUid: string;
  defaultLanguage: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'conflict';
export type SaveStatus = 'saved' | 'saving' | 'error' | 'idle';

export function useRealtimeRoom(
  roomId: string | null,
  user: UserState | null,
  options?: {
    password?: string;
    readOnly?: boolean;
    onRemoteChange?: (content: string) => void;
  }
) {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveMessage, setSaveMessage] = useState<string>('All changes saved to PostgreSQL');
  const [activeUsers, setActiveUsers] = useState<Participant[]>([]);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('javascript');
  const [version, setVersion] = useState<number>(1);
  const [role, setRole] = useState<'owner' | 'editor' | 'viewer'>('editor');
  const [roomInfo, setRoomInfo] = useState<RoomMeta | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [myColor, setMyColor] = useState<string>('#3B82F6');
  const [rateLimited, setRateLimited] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const isLocalUpdateRef = useRef(false);
  const currentVersionRef = useRef(1);

  currentVersionRef.current = version;

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!roomId || !user) return;

    setJoinError(null);
    setReconnecting(false);

    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      setJoinError(null);

      // Join the specified room
      socket.emit('room:join', {
        roomId,
        user: {
          uid: user.uid,
          displayName: user.displayName,
        },
        password: options?.password,
        readOnly: options?.readOnly || false,
      });
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect') {
        socket.connect();
      } else {
        setReconnecting(true);
      }
    });

    socket.on('connect_error', () => {
      setConnected(false);
      setReconnecting(true);
    });

    socket.on('reconnect', () => {
      setReconnecting(false);
      setConnected(true);
      // Re-join room to re-sync authoritative state
      socket.emit('room:join', {
        roomId,
        user: {
          uid: user.uid,
          displayName: user.displayName,
        },
        password: options?.password,
        readOnly: options?.readOnly,
      });
    });

    // Room joined acknowledgment
    socket.on('room:joined', (data: {
      room: RoomMeta;
      file: { content: string; language: string; version: number };
      role: 'owner' | 'editor' | 'viewer';
      participants: Participant[];
      myColor: string;
    }) => {
      setRoomInfo(data.room);
      setCode(data.file.content);
      setLanguage(data.file.language);
      setVersion(data.file.version);
      setRole(data.role);
      setActiveUsers(data.participants);
      setMyColor(data.myColor);
      setSyncStatus('synced');
      setSaveStatus('saved');
    });

    // Participant joined
    socket.on('user:joined', (data: { participant: Participant; participants: Participant[] }) => {
      setActiveUsers(data.participants);
    });

    // Participant left
    socket.on('user:left', (data: { socketId: string; participants: Participant[] }) => {
      setActiveUsers(data.participants);
    });

    // Remote code change
    socket.on('code:change', (data: {
      content: string;
      version: number;
      senderUid: string;
      senderName: string;
    }) => {
      // Ignore echo if we were the sender
      if (data.senderUid === user.uid) return;

      isLocalUpdateRef.current = false;
      setCode(data.content);
      setVersion(data.version);
      setSyncStatus('synced');

      if (options?.onRemoteChange) {
        options.onRemoteChange(data.content);
      }
    });

    // Cursor position update from a peer
    socket.on('cursor:update', (data: {
      socketId: string;
      cursor: { lineNumber: number; column: number };
    }) => {
      setActiveUsers((prev) =>
        prev.map((u) => (u.socketId === data.socketId ? { ...u, cursor: data.cursor } : u))
      );
    });

    // Remote language change
    socket.on('language:change', (data: { language: string }) => {
      setLanguage(data.language);
    });

    // Save status from server
    socket.on('save:status', (data: { status: SaveStatus; version?: number; message?: string }) => {
      setSaveStatus(data.status);
      if (data.status === 'saved') {
        setSaveMessage('Saved to PostgreSQL');
      } else if (data.status === 'saving') {
        setSaveMessage('Saving to PostgreSQL...');
      } else if (data.status === 'error') {
        setSaveMessage(data.message || 'Error saving to database');
      }
    });

    // Version conflict notification
    socket.on('code:sync_conflict', (data: { serverVersion: number; currentContent: string; message: string }) => {
      setSyncStatus('conflict');
      setCode(data.currentContent);
      setVersion(data.serverVersion);
      setTimeout(() => setSyncStatus('synced'), 2500);
    });

    // Rate limit warning
    socket.on('rate:limit', () => {
      setRateLimited(true);
      setTimeout(() => setRateLimited(false), 2000);
    });

    // Errors
    socket.on('room:error', (data: { message: string; code?: string }) => {
      setJoinError(data.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, user?.uid, options?.password, options?.readOnly]);

  // Send local code change to server
  const sendCodeChange = useCallback((newContent: string) => {
    if (!socketRef.current || role === 'viewer') return;
    isLocalUpdateRef.current = true;
    setCode(newContent);
    setSyncStatus('syncing');

    socketRef.current.emit('code:change', {
      roomId,
      content: newContent,
      version: currentVersionRef.current,
    });
  }, [roomId, role]);

  // Send cursor movement
  const sendCursorMove = useCallback((cursor: { lineNumber: number; column: number }) => {
    if (!socketRef.current) return;
    socketRef.current.emit('cursor:move', {
      roomId,
      cursor,
    });
  }, [roomId]);

  // Change room language
  const sendLanguageChange = useCallback((newLang: string) => {
    if (!socketRef.current || role === 'viewer') return;
    setLanguage(newLang);
    socketRef.current.emit('language:change', {
      roomId,
      language: newLang,
    });
  }, [roomId, role]);

  // Trigger manual snapshot checkpoint
  const saveSnapshot = useCallback((label?: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('code:save_snapshot', {
      roomId,
      label,
    });
  }, [roomId]);

  return {
    connected,
    reconnecting,
    syncStatus,
    saveStatus,
    saveMessage,
    activeUsers,
    code,
    language,
    version,
    role,
    roomInfo,
    joinError,
    myColor,
    rateLimited,
    sendCodeChange,
    sendCursorMove,
    sendLanguageChange,
    saveSnapshot,
  };
}
