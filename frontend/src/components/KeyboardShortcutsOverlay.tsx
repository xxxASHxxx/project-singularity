import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface Shortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'telemetry' | 'actions' | 'system';
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { keys: ['D'], description: 'Focus dashboard overview', category: 'navigation' },
  { keys: ['T'], description: 'Jump to telemetry panel', category: 'navigation' },
  { keys: ['M'], description: 'Jump to mission queue', category: 'navigation' },
  { keys: ['A'], description: 'Jump to agent activity feed', category: 'navigation' },

  // Telemetry
  { keys: ['1'], description: 'Set telemetry window to 15 samples', category: 'telemetry' },
  { keys: ['2'], description: 'Set telemetry window to 30 samples', category: 'telemetry' },
  { keys: ['3'], description: 'Set telemetry window to 60 samples', category: 'telemetry' },
  { keys: ['E'], description: 'Export telemetry as CSV', category: 'telemetry' },
  { keys: ['R'], description: 'Refresh telemetry data now', category: 'telemetry' },

  // Actions
  { keys: ['Ctrl', 'K'], description: 'Open command palette', category: 'actions' },
  { keys: ['N'], description: 'Toggle desktop notifications', category: 'actions' },
  { keys: ['F'], description: 'Toggle fullscreen mode', category: 'actions' },

  // System
  { keys: ['?'], description: 'Toggle this help overlay', category: 'system' },
  { keys: ['Esc'], description: 'Close overlay / drawer / palette', category: 'system' },
];

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  navigation: { label: 'Navigation', icon: '🧭', color: '#3B82F6' },
  telemetry: { label: 'Telemetry', icon: '📡', color: '#FF3B30' },
  actions: { label: 'Actions', icon: '⚡', color: '#FF8A00' },
  system: { label: 'System', icon: '⚙️', color: '#22C55E' },
};

export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Check for Ctrl+key combos
      if (e.ctrlKey || e.metaKey) {
        const comboKey = `Ctrl+${e.key.toUpperCase()}`;
        if (handlers[comboKey]) {
          e.preventDefault();
          handlers[comboKey]();
          return;
        }
      }

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
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when overlay opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredShortcuts = useMemo(() => {
    if (!search.trim()) return SHORTCUTS;
    const q = search.toLowerCase();
    return SHORTCUTS.filter(
      s =>
        s.description.toLowerCase().includes(q) ||
        s.keys.join(' ').toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [search]);

  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, Shortcut[]> = {};
    for (const s of filteredShortcuts) {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    }
    return groups;
  }, [filteredShortcuts]);

  if (!isOpen) return null;

  return (
    <div
      className="shortcuts-overlay-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.80)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'shortcuts-fade-in 0.2s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #161618 0%, #111113 100%)',
          border: '1px solid #2a2a2e',
          borderRadius: 16,
          padding: '24px 28px 20px',
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
          animation: 'shortcuts-scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(255,59,48,0.15) 0%, rgba(255,138,0,0.15) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              ⌨
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  color: '#e8e8e8',
                }}
              >
                Keyboard Shortcuts
              </div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>
                {SHORTCUTS.length} shortcuts available
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid #333',
              borderRadius: 8,
              color: '#666',
              cursor: 'pointer',
              fontSize: 12,
              padding: '4px 8px',
              lineHeight: 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
              (e.target as HTMLButtonElement).style.color = '#aaa';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              (e.target as HTMLButtonElement).style.color = '#666';
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            position: 'relative',
            marginBottom: 20,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#444',
              fontSize: 14,
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search shortcuts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: '#1a1a1e',
              border: '1px solid #2a2a2e',
              borderRadius: 10,
              color: '#ccc',
              fontSize: 13,
              fontFamily: "'Inter', system-ui, sans-serif",
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#444')}
            onBlur={(e) => (e.target.style.borderColor = '#2a2a2e')}
          />
        </div>

        {/* Grouped shortcuts */}
        {Object.keys(groupedShortcuts).length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              color: '#444',
              fontSize: 13,
            }}
          >
            No matching shortcuts
          </div>
        ) : (
          Object.entries(groupedShortcuts).map(([category, shortcuts]) => {
            const meta = CATEGORY_META[category];
            return (
              <div key={category} style={{ marginBottom: 18 }}>
                {/* Category header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: '1px solid #1e1e22',
                  }}
                >
                  <span style={{ fontSize: 12 }}>{meta.icon}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase' as const,
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: '#444',
                      marginLeft: 'auto',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {shortcuts.length}
                  </span>
                </div>

                {/* Shortcut rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 8px',
                        borderRadius: 6,
                        transition: 'background 0.15s',
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = 'transparent')
                      }
                    >
                      <span style={{ fontSize: 12.5, color: '#aaa' }}>
                        {shortcut.description}
                      </span>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        {shortcut.keys.map((key, ki) => (
                          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            {ki > 0 && (
                              <span style={{ fontSize: 9, color: '#444' }}>+</span>
                            )}
                            <kbd
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: 26,
                                height: 24,
                                padding: '0 7px',
                                background: 'linear-gradient(180deg, #222226 0%, #1a1a1e 100%)',
                                border: '1px solid #333',
                                borderRadius: 5,
                                fontSize: 10.5,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 600,
                                color: '#bbb',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.05) inset',
                                letterSpacing: '0.02em',
                              }}
                            >
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 14,
            borderTop: '1px solid #1e1e22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: '#3a3a3a',
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <kbd style={{
              padding: '1px 5px',
              background: '#1e1e22',
              border: '1px solid #2a2a2e',
              borderRadius: 4,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
            }}>?</kbd>
            <span>or</span>
            <kbd style={{
              padding: '1px 5px',
              background: '#1e1e22',
              border: '1px solid #2a2a2e',
              borderRadius: 4,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
            }}>Esc</kbd>
            <span>to close</span>
          </span>
          <span style={{ color: '#222', fontSize: 10 }}>·</span>
          <span
            style={{
              fontSize: 10,
              color: '#3a3a3a',
              fontFamily: "'JetBrains Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <kbd style={{
              padding: '1px 5px',
              background: '#1e1e22',
              border: '1px solid #2a2a2e',
              borderRadius: 4,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
            }}>Ctrl</kbd>
            <span>+</span>
            <kbd style={{
              padding: '1px 5px',
              background: '#1e1e22',
              border: '1px solid #2a2a2e',
              borderRadius: 4,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
            }}>K</kbd>
            <span>command palette</span>
          </span>
        </div>
      </div>
    </div>
  );
}
