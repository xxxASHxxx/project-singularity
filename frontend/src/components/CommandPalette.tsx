import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export default function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands
      .map((cmd) => {
        let score = 0;
        const label = cmd.label.toLowerCase();
        const desc = (cmd.description || '').toLowerCase();
        const cat = cmd.category.toLowerCase();

        if (label === q) score = 100;
        else if (label.startsWith(q)) score = 80;
        else if (label.includes(q)) score = 60;
        else if (desc.includes(q)) score = 40;
        else if (cat.includes(q)) score = 20;
        else return null;

        return { ...cmd, score };
      })
      .filter(Boolean)
      .sort((a, b) => (b as any).score - (a as any).score) as Command[];
  }, [query, commands]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const selectedEl = listEl.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        animation: 'shortcuts-fade-in 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'linear-gradient(180deg, #161618 0%, #111113 100%)',
          border: '1px solid #2a2a2e',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow:
            '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 80px rgba(255,59,48,0.03)',
          animation: 'shortcuts-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #222226',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ color: '#555', fontSize: 16, flexShrink: 0 }}>⚡</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e8e8e8',
              fontSize: 15,
              fontFamily: "'Inter', system-ui, sans-serif",
              caretColor: '#FF3B30',
            }}
          />
          <kbd
            style={{
              padding: '2px 8px',
              background: '#1a1a1e',
              border: '1px solid #2a2a2e',
              borderRadius: 5,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#444',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            padding: '6px 8px',
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 0',
                color: '#444',
                fontSize: 13,
              }}
            >
              No matching commands
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: i === selectedIndex ? 'rgba(255,59,48,0.08)' : 'transparent',
                  borderLeft: i === selectedIndex ? '2px solid #FF3B30' : '2px solid transparent',
                  transition: 'all 0.1s',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: 'center' }}>
                  {cmd.icon || '▸'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: i === selectedIndex ? '#e8e8e8' : '#aaa',
                      fontWeight: i === selectedIndex ? 600 : 400,
                      transition: 'color 0.1s',
                    }}
                  >
                    {cmd.label}
                  </div>
                  {cmd.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#555',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {cmd.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 9,
                      color: '#444',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                    }}
                  >
                    {cmd.category}
                  </span>
                  {cmd.shortcut && (
                    <kbd
                      style={{
                        padding: '1px 6px',
                        background: '#1a1a1e',
                        border: '1px solid #2a2a2e',
                        borderRadius: 4,
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: '#555',
                      }}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid #1a1a1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 10,
                color: '#333',
                fontFamily: "'JetBrains Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <kbd
                style={{
                  padding: '1px 4px',
                  background: '#1a1a1e',
                  border: '1px solid #222',
                  borderRadius: 3,
                  fontSize: 9,
                }}
              >
                ↑↓
              </kbd>
              navigate
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#333',
                fontFamily: "'JetBrains Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <kbd
                style={{
                  padding: '1px 4px',
                  background: '#1a1a1e',
                  border: '1px solid #222',
                  borderRadius: 3,
                  fontSize: 9,
                }}
              >
                ↵
              </kbd>
              run
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              color: '#333',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {filtered.length} command{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
