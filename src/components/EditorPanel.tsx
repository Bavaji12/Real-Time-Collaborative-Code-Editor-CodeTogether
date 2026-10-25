import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { Participant } from '../hooks/useRealtimeRoom.ts';
import { ShieldAlert, Zap } from 'lucide-react';

interface EditorPanelProps {
  code: string;
  language: string;
  theme: 'vs-dark' | 'light';
  isReadOnly: boolean;
  rateLimited: boolean;
  activeUsers: Participant[];
  currentUserUid: string;
  onCodeChange: (newCode: string) => void;
  onCursorMove: (cursor: { lineNumber: number; column: number }) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  code,
  language,
  theme,
  isReadOnly,
  rateLimited,
  activeUsers,
  currentUserUid,
  onCodeChange,
  onCursorMove,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const isUpdatingRef = useRef(false);

  // Handle Monaco editor mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor changes and emit to collaborators
    editor.onDidChangeCursorPosition((e) => {
      onCursorMove({
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Configure editor layout
    editor.focus();
  };

  // Sync external code updates into editor without clobbering cursor
  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const currentEditorValue = model.getValue();
    if (code !== currentEditorValue) {
      isUpdatingRef.current = true;
      const selections = editorRef.current.getSelections();
      model.setValue(code);
      if (selections) {
        editorRef.current.setSelections(selections);
      }
      isUpdatingRef.current = false;
    }
  }, [code]);

  // Render remote collaborative cursors in Monaco
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    // Remote users excluding current client
    const remoteUsers = activeUsers.filter((u) => u.uid !== currentUserUid && u.cursor);

    const newDecorations = remoteUsers.map((user) => {
      const pos = user.cursor!;
      return {
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column + 1),
        options: {
          className: `remote-cursor cursor-${user.socketId.replace(/[^a-zA-Z0-9]/g, '')}`,
          hoverMessage: { value: `**${user.displayName}** (${user.role})` },
          before: {
            content: ` ${user.displayName} `,
            inlineClassName: `remote-cursor-label label-${user.socketId.replace(/[^a-zA-Z0-9]/g, '')}`,
          },
        },
      };
    });

    // Inject dynamic CSS rules for remote cursor colors
    const styleId = 'codetogether-dynamic-cursors';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    let cssRules = '';
    remoteUsers.forEach((u) => {
      const safeId = u.socketId.replace(/[^a-zA-Z0-9]/g, '');
      cssRules += `
        .cursor-${safeId} {
          border-left: 2px solid ${u.color} !important;
        }
        .label-${safeId} {
          background-color: ${u.color} !important;
          color: #ffffff !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          border-radius: 3px !important;
          padding: 1px 4px !important;
          margin-right: 2px !important;
          opacity: 0.85 !important;
        }
      `;
    });
    styleEl.innerHTML = cssRules;

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [activeUsers, currentUserUid]);

  return (
    <div className="relative flex-1 h-full w-full overflow-hidden bg-zinc-950">
      {/* Read-only notification badge */}
      {isReadOnly && (
        <div className="absolute top-2 right-4 z-20 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-md">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <span>Read-only mode active. Edits are disabled for viewers.</span>
        </div>
      )}

      {/* Rate limit badge */}
      {rateLimited && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs px-3 py-1 rounded-full shadow-lg backdrop-blur-md animate-bounce">
          <Zap className="h-3.5 w-3.5 text-rose-400" />
          <span>Typing fast! Sync rate limited.</span>
        </div>
      )}

      {/* Active Monaco Editor Instance */}
      <Editor
        height="100%"
        width="100%"
        language={language === 'python' ? 'python' : 'javascript'}
        theme={theme}
        value={code}
        onChange={(val) => {
          if (!isUpdatingRef.current && val !== undefined) {
            onCodeChange(val);
          }
        }}
        onMount={handleEditorDidMount}
        options={{
          readOnly: isReadOnly,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontLigatures: true,
          tabSize: 2,
          minimap: { enabled: true, maxColumn: 90 },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
};
