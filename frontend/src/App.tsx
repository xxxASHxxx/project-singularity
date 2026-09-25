import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMissions, useTelemetry } from './hooks/usePolling';
import { useAlertNotifications } from './hooks/useAlertNotifications';
import TopBar from './components/TopBar';
import TelemetryPanel from './components/TelemetryPanel';
import MissionQueue from './components/MissionQueue';
import AgentActivityFeed from './components/AgentActivityFeed';
import MissionDetailDrawer from './components/MissionDetailDrawer';
import AnalyticsPanel from './components/AnalyticsPanel';
import KeyboardShortcutsOverlay, { useKeyboardShortcuts } from './components/KeyboardShortcutsOverlay';
import CommandPalette from './components/CommandPalette';
import type { Command } from './components/CommandPalette';
import type { AgentMission } from './api/client';

export default function App() {
  const { data: missions = [], isError } = useMissions();
  const { data: telemetryEvents = [] } = useTelemetry();
  const [selectedMission, setSelectedMission] = useState<AgentMission | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Desktop notifications for surge/low-stock alerts
  const latestTelemetry = telemetryEvents.length > 0 ? telemetryEvents[0] : null;
  useAlertNotifications({ enabled: notificationsEnabled, latestEvent: latestTelemetry });

  // Session uptime
  const [sessionStart] = useState(() => Date.now());
  const [, setUptimeTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setUptimeTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Track API offline state for connection-lost banner with exit animation
  const [showBanner, setShowBanner] = useState(false);
  const [bannerExiting, setBannerExiting] = useState(false);
  const wasError = useRef(false);

  useEffect(() => {
    if (isError && !wasError.current) {
      setShowBanner(true);
      setBannerExiting(false);
    } else if (!isError && wasError.current) {
      setBannerExiting(true);
      setTimeout(() => { setShowBanner(false); setBannerExiting(false); }, 350);
    }
    wasError.current = isError;
  }, [isError]);

  const pendingCount = (missions || []).filter(m => m.status === 'PENDING_APPROVAL').length;

  // Section refs for keyboard navigation
  const telemetryRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const scrollToRef = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Command palette commands
  const paletteCommands: Command[] = useMemo(() => [
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'Scroll to the top of the dashboard',
      icon: '🏠',
      category: 'Navigation',
      shortcut: 'D',
      action: () => scrollToRef(dashboardRef),
    },
    {
      id: 'nav-telemetry',
      label: 'Go to Telemetry',
      description: 'Jump to the live telemetry panel',
      icon: '📡',
      category: 'Navigation',
      shortcut: 'T',
      action: () => scrollToRef(telemetryRef),
    },
    {
      id: 'nav-missions',
      label: 'Go to Mission Queue',
      description: 'Jump to the mission queue panel',
      icon: '🎯',
      category: 'Navigation',
      shortcut: 'M',
      action: () => scrollToRef(missionRef),
    },
    {
      id: 'nav-activity',
      label: 'Go to Agent Activity',
      description: 'Jump to the agent activity feed',
      icon: '⚡',
      category: 'Navigation',
      shortcut: 'A',
      action: () => scrollToRef(activityRef),
    },
    {
      id: 'toggle-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all available keyboard shortcuts',
      icon: '⌨️',
      category: 'System',
      shortcut: '?',
      action: () => setShowShortcuts(true),
    },
    {
      id: 'toggle-notifications',
      label: notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications',
      description: 'Toggle desktop notifications for surge/low-stock alerts',
      icon: notificationsEnabled ? '🔕' : '🔔',
      category: 'Actions',
      shortcut: 'N',
      action: () => {
        if (!notificationsEnabled && 'Notification' in window) {
          Notification.requestPermission().then((perm) => {
            setNotificationsEnabled(perm === 'granted');
          });
        } else {
          setNotificationsEnabled(!notificationsEnabled);
        }
      },
    },
    {
      id: 'toggle-fullscreen',
      label: document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen',
      description: 'Toggle browser fullscreen mode',
      icon: '🖥️',
      category: 'Actions',
      shortcut: 'F',
      action: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      },
    },
    {
      id: 'refresh-data',
      label: 'Refresh Data',
      description: 'Force refresh all telemetry and mission data',
      icon: '🔄',
      category: 'Telemetry',
      shortcut: 'R',
      action: () => window.location.reload(),
    },
  ], [notificationsEnabled, scrollToRef]);

  // Global keyboard shortcuts
  const shortcutHandlers = useMemo(() => ({
    '?': () => { if (!showPalette) setShowShortcuts(prev => !prev); },
    'Escape': () => {
      if (showPalette) setShowPalette(false);
      else if (showShortcuts) setShowShortcuts(false);
      else if (selectedMission) setSelectedMission(null);
    },
    'Ctrl+K': () => {
      if (showShortcuts) setShowShortcuts(false);
      setShowPalette(prev => !prev);
    },
    'D': () => { if (!showShortcuts && !showPalette) scrollToRef(dashboardRef); },
    'T': () => { if (!showShortcuts && !showPalette) scrollToRef(telemetryRef); },
    'M': () => { if (!showShortcuts && !showPalette) scrollToRef(missionRef); },
    'A': () => { if (!showShortcuts && !showPalette) scrollToRef(activityRef); },
    'N': () => {
      if (!showShortcuts && !showPalette) {
        if (!notificationsEnabled && 'Notification' in window) {
          Notification.requestPermission().then((perm) => {
            setNotificationsEnabled(perm === 'granted');
          });
        } else {
          setNotificationsEnabled(prev => !prev);
        }
      }
    },
    'F': () => {
      if (!showShortcuts && !showPalette) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    },
    'R': () => {
      if (!showShortcuts && !showPalette) {
        window.location.reload();
      }
    },
  }), [showShortcuts, showPalette, selectedMission, notificationsEnabled, scrollToRef]);
  useKeyboardShortcuts(shortcutHandlers);

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0B' }}>
      {/* Connection-lost banner */}
      {showBanner && (
        <div
          className={`${bannerExiting ? 'connection-banner-exit' : 'connection-banner'}`}
          style={{
            background: 'linear-gradient(90deg, rgba(255,59,48,0.15) 0%, rgba(255,59,48,0.25) 50%, rgba(255,59,48,0.15) 100%)',
            borderBottom: '1px solid rgba(255,59,48,0.3)',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, letterSpacing: '0.05em' }}>
            ⚠ API CONNECTION LOST
          </span>
          <span style={{ color: '#666', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
            — Retrying automatically…
          </span>
          <span className="inline-block w-2 h-2 rounded-full bg-red-accent" style={{ animation: 'pulse-glow 1.5s ease-in-out infinite' }} />
        </div>
      )}

      <TopBar apiOk={!isError} pendingCount={pendingCount} notificationsEnabled={notificationsEnabled} />

      <div className="p-4 lg:p-6" ref={dashboardRef}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#F5F5F5' }}>
            Intelligence Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">Edge telemetry → Agent missions → Commerce automation</p>
        </div>

        {/* Analytics strip — full width, above main grid */}
        <AnalyticsPanel />

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left: telemetry (wide) */}
          <div className="xl:col-span-2 space-y-4">
            <div ref={telemetryRef}>
              <TelemetryPanel />
            </div>
            <div ref={activityRef}>
              <AgentActivityFeed missions={missions} />
            </div>
          </div>

          {/* Right: missions */}
          <div className="space-y-4">
            <div ref={missionRef}>
              <MissionQueue onSelectMission={setSelectedMission} />
            </div>

            {/* System status */}
            <div className="panel p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="section-title mb-0">System Status</p>
                <span className="text-xs font-mono text-gray-600" title="Session uptime">
                  ▲ {(() => {
                    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
                    const h = Math.floor(elapsed / 3600);
                    const m = Math.floor((elapsed % 3600) / 60);
                    const s = elapsed % 60;
                    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
                  })()}
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Edge Node', status: 'STREAMING' },
                  { label: 'Spring Boot API', status: isError ? 'OFFLINE' : 'ONLINE' },
                  { label: 'MySQL', status: isError ? 'UNKNOWN' : 'ONLINE' },
                  { label: 'Mock Supplier', status: 'ONLINE' },
                  { label: 'Safety Rail', status: 'AUTO_APPROVE=false' },
                  { label: 'Notifications', status: notificationsEnabled ? 'ENABLED' : 'DISABLED' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-mono" style={{
                      color: item.status === 'OFFLINE' || item.status === 'UNKNOWN' ? '#FF3B30' :
                             item.status === 'DISABLED' ? '#555' :
                             item.status.includes('false') ? '#FF8A00' : '#22C55E'
                    }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mission detail drawer */}
      <MissionDetailDrawer mission={selectedMission} onClose={() => setSelectedMission(null)} />

      {/* Keyboard shortcuts overlay */}
      <KeyboardShortcutsOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Command palette */}
      <CommandPalette isOpen={showPalette} onClose={() => setShowPalette(false)} commands={paletteCommands} />
    </div>
  );
}
