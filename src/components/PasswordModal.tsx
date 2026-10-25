import React, { useState } from 'react';
import { Lock, X, ArrowRight } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  theme: 'vs-dark' | 'light';
  errorMessage?: string | null;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  theme,
  errorMessage,
}) => {
  const [password, setPassword] = useState('');
  const isDark = theme === 'vs-dark';

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm rounded-xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Lock className="h-4 w-4 text-amber-400" />
            <span>Protected Room Access</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <p className="text-zinc-400 leading-relaxed">
            This collaboration room is private. Please enter the room access password to join.
          </p>

          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Password</label>
            <input
              type="password"
              placeholder="Enter room password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-zinc-50 border-zinc-300 text-zinc-800'
              }`}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-md transition-all"
            >
              <span>Unlock Room</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
