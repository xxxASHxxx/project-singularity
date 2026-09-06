import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMissions } from '../hooks/usePolling';
import { approveMission } from '../api/client';
import StatusPill from './StatusPill';
import type { AgentMission } from '../api/client';

function formatRelative(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function MissionQueue({ onSelectMission }: { onSelectMission: (m: AgentMission) => void }) {
  const { data: missions = [] } = useMissions();
  const qc = useQueryClient();

  const approve = useMutation({
    mutationFn: approveMission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });

  // Force re-render every second so relative timestamps tick live
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const pendingCount = missions.filter(m => m.status === 'PENDING_APPROVAL').length;

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Mission Queue</p>
        {pendingCount > 0 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-accent/10 text-amber-accent border border-amber-accent/30">
            {pendingCount} PENDING
          </span>
        )}
      </div>

      {missions.length === 0 ? (
        <div className="text-center py-10">
          <svg className="mx-auto mb-3 radar-pulse" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
            <line x1="12" y1="2" x2="12" y2="6" />
          </svg>
          <p className="font-mono text-sm text-gray-600 mb-1">No missions yet</p>
          <p className="text-xs text-gray-700">Waiting for edge telemetry to trigger events…</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {missions.map(mission => (
            <div
              key={mission.id}
              id={`mission-${mission.id}`}
              className="flex items-center gap-3 p-3 rounded cursor-pointer hover:bg-white/5 transition-colors border border-transparent hover:border-border"
              style={{ background: 'rgba(255,255,255,0.02)' }}
              onClick={() => onSelectMission(mission)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-gray-500">#{mission.id}</span>
                  <span className="text-xs font-semibold" style={{ color: mission.missionType === 'RESTOCK' ? '#FF3B30' : '#FF8A00' }}>
                    {mission.missionType}
                  </span>
                  <StatusPill status={mission.status} />
                </div>
                <div className="text-xs text-gray-600 font-mono">
                  event #{mission.triggeredByEventId} · {formatRelative(mission.createdAt)}
                </div>
              </div>

              {mission.status === 'PENDING_APPROVAL' && (
                <button
                  id={`approve-btn-${mission.id}`}
                  className="px-3 py-1.5 text-xs font-mono font-semibold rounded border transition-all shrink-0"
                  style={{
                    background: 'rgba(34,197,94,0.1)',
                    color: '#22C55E',
                    border: '1px solid rgba(34,197,94,0.3)',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(34,197,94,0.2)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(34,197,94,0.1)'; }}
                  onClick={e => { e.stopPropagation(); approve.mutate(mission.id); }}
                  disabled={approve.isPending}
                >
                  ✓ APPROVE
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
