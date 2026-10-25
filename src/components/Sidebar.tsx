import React, { useState, useEffect } from 'react';
import {
  Users,
  FolderGit2,
  Settings,
  Plus,
  ArrowRight,
  Shield,
  Copy,
  Check,
  RotateCcw,
  Globe,
  Lock,
  Search,
  Hash,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Participant, RoomMeta } from '../hooks/useRealtimeRoom.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface SavedVersionItem {
  id: number;
  roomId: string;
  versionNumber: number;
  label: string;
  content: string;
  language: string;
  authorUid: string;
  authorName: string;
  createdAt: string;
}

interface RoomListItem {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  defaultLanguage: string;
  hasPassword?: boolean;
  createdAt: string;
}

interface SidebarProps {
  currentRoomId: string | null;
  roomInfo: RoomMeta | null;
  activeUsers: Participant[];
  theme: 'vs-dark' | 'light';
  onSelectRoom: (roomId: string) => void;
  onOpenCreateModal: () => void;
  onRestoreVersion?: (version: SavedVersionItem) => void;
  myRole: 'owner' | 'editor' | 'viewer';
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoomId,
  roomInfo,
  activeUsers,
  theme,
  onSelectRoom,
  onOpenCreateModal,
  onRestoreVersion,
  myRole,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'rooms' | 'users' | 'versions' | 'settings'>('rooms');
  const [roomsList, setRoomsList] = useState<RoomListItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joinInputId, setJoinInputId] = useState('');
  const [versions, setVersions] = useState<SavedVersionItem[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedSetting, setCopiedSetting] = useState<'link' | 'readonly' | null>(null);

  const isDark = theme === 'vs-dark';

  // Load available rooms
  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRoomsList(data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to fetch rooms list:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Load version history when versions tab is selected
  const fetchVersions = async () => {
    if (!currentRoomId) return;
    try {
      setLoadingVersions(true);
      const res = await fetch(`/api/rooms/${currentRoomId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (activeTab === 'versions') {
      fetchVersions();
    }
  }, [activeTab, currentRoomId]);

  const handleJoinById = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = joinInputId.trim();
    if (cleanId) {
      onSelectRoom(cleanId);
      setJoinInputId('');
    }
  };

  const handleRestore = async (version: SavedVersionItem) => {
    if (!currentRoomId || myRole === 'viewer') return;
    const confirm = window.confirm(
      `Rollback current code to Snapshot #${version.versionNumber} ("${version.label}")?`
    );
    if (!confirm) return;

    try {
      setRestoringId(version.id);
      const res = await fetch(`/api/rooms/${currentRoomId}/versions/${version.id}/restore`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        if (onRestoreVersion) {
          onRestoreVersion(version);
        }
        alert(`Successfully restored to Snapshot #${version.versionNumber}`);
      } else {
        alert('Failed to restore snapshot');
      }
    } catch (err) {
      console.error('Restore error:', err);
    } finally {
      setRestoringId(null);
    }
  };

  const copyUrl = (readonly = false) => {
    const url = new URL(window.location.origin);
    url.searchParams.set('room', currentRoomId || '');
    if (readonly) {
      url.searchParams.set('readonly', 'true');
    }
    navigator.clipboard.writeText(url.toString());
    setCopiedSetting(readonly ? 'readonly' : 'link');
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  const filteredRooms = roomsList.filter(
    (r) =>
      r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <aside
      className={`w-80 h-full border-r flex flex-col transition-colors flex-shrink-0 select-none ${
        isDark ? 'bg-zinc-900/95 border-zinc-800 text-zinc-200' : 'bg-zinc-50/95 border-zinc-200 text-zinc-800'
      }`}
    >
      {/* Navigation Tabs */}
      <div className={`flex border-b text-xs font-semibold ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'rooms'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FolderGit2 className="h-4 w-4" />
          <span>Rooms</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all relative ${
            activeTab === 'users'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Users</span>
          {activeUsers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500 text-white">
              {activeUsers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('versions')}
          className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'versions'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          <span>History</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === 'settings'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Access</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* ROOMS TAB */}
        {activeTab === 'rooms' && (
          <div className="space-y-4">
            {/* Create Room Button */}
            <button
              onClick={onOpenCreateModal}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Collaboration Room</span>
            </button>

            {/* Quick Join by ID Form */}
            <form onSubmit={handleJoinById} className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Direct Room Join
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Hash className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Enter Room ID"
                    value={joinInputId}
                    onChange={(e) => setJoinInputId(e.target.value)}
                    className={`w-full text-xs pl-8 pr-2.5 py-1.5 rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      isDark
                        ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200'
                        : 'bg-white border-zinc-300 text-zinc-800'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!joinInputId.trim()}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>

            {/* Room List Search */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Available Rooms
                </span>
                <button
                  onClick={fetchRooms}
                  className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter rooms..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className={`w-full text-xs pl-8 pr-2 py-1.5 rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                  }`}
                />
              </div>

              {loadingRooms ? (
                <div className="text-center py-6 text-xs text-zinc-400">Loading rooms...</div>
              ) : filteredRooms.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500">
                  No rooms found. Create the first room above!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {filteredRooms.map((r) => {
                    const isSelected = r.id === currentRoomId;
                    return (
                      <div
                        key={r.id}
                        onClick={() => onSelectRoom(r.id)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-300'
                            : isDark
                            ? 'bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800/90 text-zinc-300'
                            : 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="truncate max-w-[170px]">{r.name}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                            {r.defaultLanguage}
                          </span>
                        </div>

                        {r.description && (
                          <p className="text-[11px] text-zinc-400 truncate mt-1">{r.description}</p>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-800/40 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-1 font-mono">
                            {r.hasPassword ? (
                              <Lock className="h-3 w-3 text-amber-400" />
                            ) : (
                              <Globe className="h-3 w-3 text-emerald-400" />
                            )}
                            {r.id.substring(0, 14)}...
                          </span>
                          <ChevronRight className="h-3 w-3 text-zinc-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* USERS / PRESENCE TAB */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Connected Peers ({activeUsers.length})
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Sync
              </span>
            </div>

            {activeUsers.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500">
                No collaborators connected in this room yet.
              </div>
            ) : (
              <div className="space-y-2">
                {activeUsers.map((p) => {
                  const isMe = p.uid === user?.uid;
                  return (
                    <div
                      key={p.socketId}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                        isMe
                          ? 'border-indigo-500/40 bg-indigo-500/10'
                          : isDark
                          ? 'border-zinc-800 bg-zinc-800/40'
                          : 'border-zinc-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-sm"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.displayName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className="truncate max-w-[120px]">{p.displayName}</span>
                            {isMe && (
                              <span className="text-[10px] text-indigo-400 font-semibold">(You)</span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                            {p.cursor ? (
                              <span>
                                Line {p.cursor.lineNumber}:{p.cursor.column}
                              </span>
                            ) : (
                              <span>Idle in editor</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                          p.role === 'owner'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : p.role === 'viewer'
                            ? 'bg-zinc-700/30 text-zinc-400 border-zinc-700'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {p.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VERSIONS / ROLLBACK TAB */}
        {activeTab === 'versions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                PostgreSQL Checkpoints
              </span>
              <button
                onClick={fetchVersions}
                className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {loadingVersions ? (
              <div className="text-center py-6 text-xs text-zinc-400">Loading version history...</div>
            ) : versions.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500">
                No saved snapshot versions yet. Click "Save Snapshot" in the navbar to create a milestone!
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 transition-colors ${
                      isDark ? 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-400 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Snapshot #{ver.versionNumber}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(ver.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-300 font-medium">{ver.label}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-400">
                      <span>By {ver.authorName}</span>
                      <button
                        onClick={() => handleRestore(ver)}
                        disabled={restoringId === ver.id || myRole === 'viewer'}
                        className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 disabled:opacity-40 font-medium cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{restoringId === ver.id ? 'Restoring...' : 'Rollback'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACCESS & SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Room Access & Sharing
            </span>

            {/* Room ID Badge */}
            <div
              className={`p-3 rounded-lg border text-xs space-y-2 ${
                isDark ? 'bg-zinc-800/40 border-zinc-800' : 'bg-white border-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Room Identifier</span>
                <span className="font-mono text-zinc-200 font-semibold">{currentRoomId}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Access Mode</span>
                <span className="flex items-center gap-1 font-semibold text-zinc-200">
                  {roomInfo?.isPublic ? (
                    <>
                      <Globe className="h-3.5 w-3.5 text-emerald-400" />
                      Public
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 text-amber-400" />
                      Protected
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Your Permission</span>
                <span className="font-semibold uppercase text-indigo-400">{myRole}</span>
              </div>
            </div>

            {/* Share Links */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Collaboration Links
              </span>

              {/* Full Editor Link */}
              <button
                onClick={() => copyUrl(false)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-400" />
                  <span>Copy Editor Link (Read/Write)</span>
                </div>
                {copiedSetting === 'link' ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 text-zinc-400" />
                )}
              </button>

              {/* Read-Only Link */}
              <button
                onClick={() => copyUrl(true)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-amber-400" />
                  <span>Copy Read-Only Sharing Link</span>
                </div>
                {copiedSetting === 'readonly' ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4 text-zinc-400" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
