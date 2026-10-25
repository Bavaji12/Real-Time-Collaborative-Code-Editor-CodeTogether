import React, { useState } from 'react';
import { X, Camera, Sparkles } from 'lucide-react';

interface SaveSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (label: string) => void;
  theme: 'vs-dark' | 'light';
}

export const SaveSnapshotModal: React.FC<SaveSnapshotModalProps> = ({
  isOpen,
  onClose,
  onSave,
  theme,
}) => {
  const [label, setLabel] = useState('');
  const isDark = theme === 'vs-dark';

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(label.trim() || 'Manual revision snapshot');
    setLabel('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Camera className="h-4 w-4 text-indigo-400" />
            <span>Save Code Snapshot to PostgreSQL</span>
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
            Snapshots save an immutable milestone of the current code buffer directly to the PostgreSQL database, enabling instant rollbacks at any point.
          </p>

          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-300">Commit / Milestone Label</label>
            <input
              type="text"
              placeholder="e.g., Added recursive quicksort algorithm and edge cases"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              autoFocus
              className={`w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-zinc-50 border-zinc-300 text-zinc-800'
              }`}
            />
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Record Snapshot</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
