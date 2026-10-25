import React, { useState } from 'react';
import {
  Code2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Moon,
  Sun,
  Camera,
  Share2,
  Lock,
  Globe,
  Radio,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { RoomMeta, SaveStatus, SyncStatus } from '../hooks/useRealtimeRoom.ts';

interface NavbarProps {
  roomInfo: RoomMeta | null;
  language: string;
  onLanguageChange: (lang: string) => void;
  connected: boolean;
  reconnecting: boolean;
  syncStatus: SyncStatus;
  saveStatus: SaveStatus;
  saveMessage: string;
  theme: 'vs-dark' | 'light';
  onThemeToggle: () => void;
  onOpenSnapshotModal: () => void;
  onOpenShareModal: () => void;
  isReadOnly?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomInfo,
  language,
  onLanguageChange,
  connected,
  reconnecting,
  syncStatus,
  saveStatus,
  saveMessage,
  theme,
  onThemeToggle,
  onOpenSnapshotModal,
  onOpenShareModal,
  isReadOnly,
}) => {
  const { user, signInWithGoogle, logout } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isDark = theme === 'vs-dark';

  return (
    <header
      className={`h-14 border-b px-4 flex items-center justify-between transition-colors select-none ${
        isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
      }`}
    >
      {/* Brand & Room Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Code2 className="h-5 w-5" />
          </div>
          <span className="hidden sm:inline bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent font-extrabold">
            CodeTogether
          </span>
        </div>

        {roomInfo && (
          <div className="flex items-center gap-2 pl-3 border-l border-zinc-700/50">
            <div className="flex items-center gap-1.5 font-medium text-sm">
              {roomInfo.isPublic ? (
                <Globe className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-amber-400" />
              )}
              <span className="max-w-[140px] truncate">{roomInfo.name}</span>
            </div>

            <button
              onClick={handleCopyLink}
              title="Copy Room Link"
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
              }`}
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Link'}</span>
            </button>

            {isReadOnly && (
              <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">
                Read Only
              </span>
            )}
          </div>
        )}
      </div>

      {/* Middle Status Indicators */}
      <div className="hidden lg:flex items-center gap-4 text-xs">
        {/* Real-time Connection status */}
        <div className="flex items-center gap-1.5">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Connected
            </span>
          ) : reconnecting ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Radio className="h-3.5 w-3.5 animate-spin" />
              Reconnecting...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Disconnected
            </span>
          )}
        </div>

        {/* Database Persistence Status */}
        <div
          className="flex items-center gap-1.5 text-zinc-400"
          title={saveMessage}
        >
          {saveStatus === 'saving' ? (
            <>
              <Clock className="h-3.5 w-3.5 text-blue-400 animate-spin" />
              <span className="text-blue-400">Saving to DB...</span>
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>PostgreSQL Synced</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
              <span className="text-rose-400">Sync Error</span>
            </>
          )}
        </div>
      </div>

      {/* Controls & Actions */}
      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div className="flex items-center">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={isReadOnly}
            className={`text-xs font-medium px-2.5 py-1.5 rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                : 'bg-zinc-50 border-zinc-300 text-zinc-700'
            }`}
          >
            <option value="javascript">JavaScript (Node)</option>
            <option value="python">Python 3</option>
          </select>
        </div>

        {/* Snapshot Save Button */}
        <button
          onClick={onOpenSnapshotModal}
          disabled={!roomInfo || isReadOnly}
          title="Save manual snapshot version to database"
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded transition-all shadow-sm ${
            isDark
              ? 'bg-indigo-600/90 hover:bg-indigo-600 text-white disabled:bg-zinc-800 disabled:text-zinc-600'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-zinc-200 disabled:text-zinc-400'
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Save Snapshot</span>
        </button>

        {/* Share Modal Trigger */}
        <button
          onClick={onOpenShareModal}
          title="Share room or copy read-only access link"
          className={`p-1.5 rounded transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
          }`}
        >
          <Share2 className="h-4 w-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
          className={`p-1.5 rounded transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
          }`}
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-zinc-600" />}
        </button>

        {/* User Account / Profile */}
        <div className="relative">
          {user ? (
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-indigo-500/50 transition-all"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="h-7 w-7 rounded-full object-cover border border-indigo-400/30"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white text-xs font-semibold flex items-center justify-center">
                  {user.displayName.substring(0, 2).toUpperCase()}
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="text-xs px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 font-medium"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* User popup dropdown */}
          {userMenuOpen && user && (
            <div
              className={`absolute right-0 mt-2 w-56 rounded-lg shadow-xl border p-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-800'
              }`}
            >
              <div className="px-2 py-1.5 border-b border-zinc-700/50 mb-1">
                <p className="text-xs font-semibold truncate">{user.displayName}</p>
                <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                {user.isGuest && (
                  <span className="inline-block mt-1 text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Guest Session
                  </span>
                )}
              </div>

              {user.isGuest ? (
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    signInWithGoogle();
                  }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white flex items-center gap-2 transition-colors font-medium text-indigo-400"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  Sign In with Google
                </button>
              ) : (
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-rose-600 hover:text-white flex items-center gap-2 transition-colors text-rose-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
