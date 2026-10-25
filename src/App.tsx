/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { EditorPanel } from './components/EditorPanel.tsx';
import { CreateRoomModal } from './components/CreateRoomModal.tsx';
import { SaveSnapshotModal } from './components/SaveSnapshotModal.tsx';
import { ShareModal } from './components/ShareModal.tsx';
import { PasswordModal } from './components/PasswordModal.tsx';
import { useRealtimeRoom } from './hooks/useRealtimeRoom.ts';
import { Code2, Plus, Sparkles, Terminal, Users, Shield, ArrowRight } from 'lucide-react';

function EditorContainer() {
  const { user, loading: authLoading } = useAuth();
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [roomPassword, setRoomPassword] = useState<string>('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(null);

  // Initialize room ID from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const readOnlyParam = params.get('readonly') === 'true';

    setIsReadOnly(readOnlyParam);

    if (roomParam) {
      setCurrentRoomId(roomParam);
    } else {
      // Fetch default/recent public room or create initial demo room
      fetchDefaultRoom();
    }
  }, []);

  const fetchDefaultRoom = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (data.rooms && data.rooms.length > 0) {
          selectRoom(data.rooms[0].id);
        }
      }
    } catch (e) {
      console.warn('Could not auto-fetch rooms:', e);
    }
  };

  const selectRoom = (roomId: string, password?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url.toString());
    if (password) setRoomPassword(password);
    setCurrentRoomId(roomId);
  };

  // Real-time synchronization hook
  const {
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
  } = useRealtimeRoom(currentRoomId, user, {
    password: roomPassword,
    readOnly: isReadOnly,
  });

  // Watch for join errors (e.g. password required)
  useEffect(() => {
    if (joinError && joinError.toLowerCase().includes('password')) {
      setPasswordModalOpen(true);
    }
  }, [joinError]);

  const handlePasswordSubmit = (pass: string) => {
    setRoomPassword(pass);
    setPasswordModalOpen(false);
    if (pendingJoinRoomId) {
      selectRoom(pendingJoinRoomId, pass);
      setPendingJoinRoomId(null);
    } else if (currentRoomId) {
      selectRoom(currentRoomId, pass);
    }
  };

  const handleRoomCreated = (newRoomId: string) => {
    selectRoom(newRoomId);
  };

  const handleThemeToggle = () => {
    setTheme((prev) => (prev === 'vs-dark' ? 'light' : 'vs-dark'));
  };

  const handleManualSaveSnapshot = (label: string) => {
    saveSnapshot(label);
  };

  const isDark = theme === 'vs-dark';

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-3">
        <Code2 className="h-10 w-10 text-indigo-500 animate-pulse" />
        <p className="text-sm font-medium text-zinc-400">Loading CodeTogether workspace...</p>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden font-sans ${isDark ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-100 text-zinc-900'}`}>
      {/* Top Navbar */}
      <Navbar
        roomInfo={roomInfo}
        language={language}
        onLanguageChange={sendLanguageChange}
        connected={connected}
        reconnecting={reconnecting}
        syncStatus={syncStatus}
        saveStatus={saveStatus}
        saveMessage={saveMessage}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onOpenSnapshotModal={() => setSnapshotModalOpen(true)}
        onOpenShareModal={() => setShareModalOpen(true)}
        isReadOnly={isReadOnly || role === 'viewer'}
      />

      {/* Main Workspace: Sidebar + Monaco Code Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation / Room / Collaborator / History Sidebar */}
        <Sidebar
          currentRoomId={currentRoomId}
          roomInfo={roomInfo}
          activeUsers={activeUsers}
          theme={theme}
          onSelectRoom={selectRoom}
          onOpenCreateModal={() => setCreateModalOpen(true)}
          myRole={role}
        />

        {/* Editor Area or Welcome Empty State */}
        {currentRoomId ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <EditorPanel
              code={code}
              language={language}
              theme={theme}
              isReadOnly={isReadOnly || role === 'viewer'}
              rateLimited={rateLimited}
              activeUsers={activeUsers}
              currentUserUid={user?.uid || ''}
              onCodeChange={sendCodeChange}
              onCursorMove={sendCursorMove}
            />

            {/* Bottom Status Bar */}
            <div
              className={`h-7 px-4 border-t flex items-center justify-between text-[11px] select-none font-mono ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Room: {currentRoomId}</span>
                </span>
                <span className="hidden sm:inline">Version: #{version}</span>
                <span className="hidden md:inline">Language: {language}</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: myColor }} />
                  <span>{user?.displayName}</span>
                </span>
                <span className="text-zinc-500">UTF-8</span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State when no room is open */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
            <div className="max-w-md space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl">
                <Code2 className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Welcome to CodeTogether
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A high-performance real-time collaborative code editor powered by Monaco Editor, WebSockets, and PostgreSQL persistence. Join a room or start a new pair programming session.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Room</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onRoomCreated={handleRoomCreated}
        theme={theme}
      />

      <SaveSnapshotModal
        isOpen={snapshotModalOpen}
        onClose={() => setSnapshotModalOpen(false)}
        onSave={handleManualSaveSnapshot}
        theme={theme}
      />

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        roomInfo={roomInfo}
        theme={theme}
      />

      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSubmit={handlePasswordSubmit}
        theme={theme}
        errorMessage={joinError}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <EditorContainer />
    </AuthProvider>
  );
}
