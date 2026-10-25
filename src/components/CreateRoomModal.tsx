import React, { useState } from 'react';
import { X, Lock, Globe, Sparkles } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string) => void;
  theme: 'vs-dark' | 'light';
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
  theme,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<'javascript' | 'python'>('javascript');
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a room title');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          defaultLanguage: language,
          isPublic,
          accessPassword: !isPublic && password.trim() ? password.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create room');
      }

      onRoomCreated(data.room.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const isDark = theme === 'vs-dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Create New Collaboration Room</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Room Title *</label>
            <input
              type="text"
              placeholder="e.g. Distributed Systems Lab / Pair Session"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-zinc-50 border-zinc-300 text-zinc-800'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Description (Optional)</label>
            <input
              type="text"
              placeholder="Brief summary of room purpose or project"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-zinc-50 border-zinc-300 text-zinc-800'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Starter Language</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('javascript')}
                className={`py-2 px-3 rounded-lg border font-medium text-center transition-all ${
                  language === 'javascript'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400 font-bold'
                    : isDark
                    ? 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                }`}
              >
                JavaScript (Node)
              </button>
              <button
                type="button"
                onClick={() => setLanguage('python')}
                className={`py-2 px-3 rounded-lg border font-medium text-center transition-all ${
                  language === 'python'
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400 font-bold'
                    : isDark
                    ? 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                }`}
              >
                Python 3
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-800/60">
            <label className="font-semibold text-zinc-300">Access Control</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs transition-all ${
                  isPublic
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold'
                    : isDark
                    ? 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Public Room
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs transition-all ${
                  !isPublic
                    ? 'border-amber-500 bg-amber-500/15 text-amber-400 font-bold'
                    : isDark
                    ? 'border-zinc-800 bg-zinc-800/40 text-zinc-400'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                Password Protected
              </button>
            </div>

            {!isPublic && (
              <div className="pt-2">
                <input
                  type="password"
                  placeholder="Set room password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-zinc-50 border-zinc-300 text-zinc-800'
                  }`}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all disabled:opacity-50"
            >
              {submitting ? 'Creating Room...' : 'Launch Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
