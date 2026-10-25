import React, { useState } from 'react';
import { X, Copy, Check, Shield, Globe, Users } from 'lucide-react';
import { RoomMeta } from '../hooks/useRealtimeRoom.ts';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomInfo: RoomMeta | null;
  theme: 'vs-dark' | 'light';
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  roomInfo,
  theme,
}) => {
  const [copiedType, setCopiedType] = useState<'editor' | 'readonly' | 'id' | null>(null);

  if (!isOpen || !roomInfo) return null;

  const getUrl = (readOnly = false) => {
    const url = new URL(window.location.origin);
    url.searchParams.set('room', roomInfo.id);
    if (readOnly) {
      url.searchParams.set('readonly', 'true');
    }
    return url.toString();
  };

  const copyToClipboard = (text: string, type: 'editor' | 'readonly' | 'id') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const isDark = theme === 'vs-dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Users className="h-4 w-4 text-indigo-400" />
            <span>Invite Collaborators to {roomInfo.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Quick instructions for manual 2-browser testing */}
          <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <span>💡 Multi-User Testing Tip:</span>
            </p>
            <p className="text-[11px] leading-relaxed text-indigo-200/90">
              Open the link below in an <strong>Incognito window</strong> or a second browser tab. You will immediately see both collaborators in the room with live cursor tracking and instant two-way synchronization!
            </p>
          </div>

          {/* Full Collaboration (Read/Write) Link */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span>Full Collaboration Link (Read & Write)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={getUrl(false)}
                className={`flex-1 px-3 py-2 rounded-lg border font-mono text-[11px] select-all ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-zinc-50 border-zinc-300 text-zinc-700'
                }`}
              />
              <button
                onClick={() => copyToClipboard(getUrl(false), 'editor')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
              >
                {copiedType === 'editor' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedType === 'editor' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Read-Only Sharing Link */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>Read-Only Sharing Link (View Only)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={getUrl(true)}
                className={`flex-1 px-3 py-2 rounded-lg border font-mono text-[11px] select-all ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-zinc-50 border-zinc-300 text-zinc-700'
                }`}
              />
              <button
                onClick={() => copyToClipboard(getUrl(true), 'readonly')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium border border-zinc-700 transition-all"
              >
                {copiedType === 'readonly' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedType === 'readonly' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Room ID */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            <label className="font-semibold text-zinc-400">Direct Room ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={roomInfo.id}
                className={`flex-1 px-3 py-1.5 rounded-lg border font-mono text-[11px] ${
                  isDark ? 'bg-zinc-800/60 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                }`}
              />
              <button
                onClick={() => copyToClipboard(roomInfo.id, 'id')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs border border-zinc-700"
              >
                {copiedType === 'id' ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
