import React, { useState } from 'react';
import { useMissions } from './hooks/usePolling';
import TopBar from './components/TopBar';
import TelemetryPanel from './components/TelemetryPanel';
import MissionQueue from './components/MissionQueue';
import AgentActivityFeed from './components/AgentActivityFeed';
import MissionDetailDrawer from './components/MissionDetailDrawer';
import AnalyticsPanel from './components/AnalyticsPanel';
import type { AgentMission } from './api/client';

export default function App() {
  const { data: missions = [], isError } = useMissions();
  const [selectedMission, setSelectedMission] = useState<AgentMission | null>(null);

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0B' }}>
      <TopBar apiOk={!isError} />

      <div className="p-4 lg:p-6">
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
            <TelemetryPanel />
            <AgentActivityFeed missions={missions} />
          </div>

          {/* Right: missions */}
          <div className="space-y-4">
            <MissionQueue onSelectMission={setSelectedMission} />

            {/* System status */}
            <div className="panel p-5">
              <p className="section-title">System Status</p>
              <div className="space-y-3">
                {[
                  { label: 'Edge Node', status: 'STREAMING' },
                  { label: 'Spring Boot API', status: isError ? 'OFFLINE' : 'ONLINE' },
                  { label: 'MySQL', status: isError ? 'UNKNOWN' : 'ONLINE' },
                  { label: 'Mock Supplier', status: 'ONLINE' },
                  { label: 'Safety Rail', status: 'AUTO_APPROVE=false' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-mono" style={{
                      color: item.status === 'OFFLINE' || item.status === 'UNKNOWN' ? '#FF3B30' :
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
    </div>
  );
}
