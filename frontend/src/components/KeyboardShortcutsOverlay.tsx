import { useState, useEffect, useCallback } from 'react';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['?'], description: 'Toggle this help overlay' },
  { keys: ['Esc'], description: 'Close drawer / overlay' },
  { keys: ['E'], description: 'Export telemetry as CSV' },
  { keys: ['1'], description: 'Set telemetry window to 15 samples' },
  { keys: ['2'], description: 'Set telemetry window to 30 samples' },
  { keys: ['3'], description: 'Set telemetry window to 60 samples' },
];

export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key;
      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

export default function KeyboardShortcutsOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="shortcuts-overlay-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'shortcuts-fade-in 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#141416',
          border: '1px solid #262626',
          borderRadius: 12,
          padding: '28px 32px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          animation: 'shortcuts-scale-in 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⌨</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
                color: '#9CA3AF',
              }}
            >
              Keyboard Shortcuts
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#555',
              cursor: 'pointer',
              fontSize: 18,
              padding: '2px 6px',
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Shortcuts list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 4px',
                borderBottom: i < SHORTCUTS.length - 1 ? '1px solid #1e1e22' : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: '#aaa' }}>{shortcut.description}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 28,
                      height: 26,
                      padding: '0 8px',
                      background: '#1e1e22',
                      border: '1px solid #333',
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      color: '#ccc',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid #1e1e22',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: '#444',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Press <kbd style={{
              padding: '1px 5px',
              background: '#1e1e22',
              border: '1px solid #333',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
            }}>?</kbd> or <kbd style={{
              padding: '1px 5px',
              background: '#1e1e22',
              border: '1px solid #333',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
            }}>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
