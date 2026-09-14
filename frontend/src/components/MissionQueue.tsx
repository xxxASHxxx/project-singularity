import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMissions } from '../hooks/usePolling';
import { approveMission, rejectMission } from '../api/client';
import StatusPill from './StatusPill';
import type { AgentMission } from '../api/client';

type FilterTab = 'ALL' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

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

  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const approve = useMutation({
    mutationFn: approveMission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });

  const reject = useMutation({
    mutationFn: rejectMission,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['missions'] }),
  });

  // Force re-render every second so relative timestamps tick live
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    const pending = missions.filter(m => m.status === 'PENDING_APPROVAL').length;
    const running = missions.filter(m => m.status === 'RUNNING' || m.status === 'APPROVED').length;
    const completed = missions.filter(m => m.status === 'COMPLETED').length;
    const failed = missions.filter(m => m.status === 'FAILED').length;
    return {
      all: missions.length,
      pending,
      running,
      completed,
      failed,
    };
  }, [missions]);

  const filteredMissions = useMemo(() => {
    return missions.filter(mission => {
      // Status filter
      if (filterTab === 'PENDING' && mission.status !== 'PENDING_APPROVAL') return false;
      if (filterTab === 'RUNNING' && mission.status !== 'RUNNING' && mission.status !== 'APPROVED') return false;
      if (filterTab === 'COMPLETED' && mission.status !== 'COMPLETED') return false;
      if (filterTab === 'FAILED' && mission.status !== 'FAILED') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = mission.id.toString().includes(q) || `#${mission.id}`.includes(q);
        const matchesEvent = mission.triggeredByEventId.toString().includes(q);
        const matchesType = mission.missionType.toLowerCase().includes(q);
        const matchesStatus = mission.status.toLowerCase().includes(q);
        const matchesSummary = (mission.summary || '').toLowerCase().includes(q);
        if (!matchesId && !matchesEvent && !matchesType && !matchesStatus && !matchesSummary) {
          return false;
        }
      }

      return true;
    });
  }, [missions, filterTab, searchQuery]);

  const tabs: { key: FilterTab; label: string; count: number; accent?: string }[] = [
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'PENDING', label: 'Pending', count: counts.pending, accent: counts.pending > 0 ? '#FF8A00' : undefined },
    { key: 'RUNNING', label: 'Running', count: counts.running, accent: counts.running > 0 ? '#FF3B30' : undefined },
    { key: 'COMPLETED', label: 'Done', count: counts.completed },
  ];

  if (counts.failed > 0) {
    tabs.push({ key: 'FAILED', label: 'Failed', count: counts.failed, accent: '#B3261E' });
  }

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="section-title mb-0">Mission Queue</p>
        {counts.pending > 0 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-accent/10 text-amber-accent border border-amber-accent/30">
            {counts.pending} PENDING
          </span>
        )}
      </div>

      {missions.length > 0 && (
        <div className="space-y-2 mb-3">
          {/* Quick search input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by ID, type, or event…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && searchQuery) {
                  e.stopPropagation();
                  setSearchQuery('');
                }
              }}
              className="w-full text-xs font-mono bg-black/40 border border-border rounded px-3 py-1.5 pl-7 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
            />
            <span className="absolute left-2.5 top-1.5 text-xs text-gray-600 select-none">/</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1.5 text-xs text-gray-500 hover:text-gray-300"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none text-xs font-mono">
            {tabs.map(tab => {
              const active = filterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    active
                      ? 'bg-white/10 text-white font-medium border border-white/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className="text-[10px] px-1 rounded"
                    style={{
                      color: tab.accent ? tab.accent : active ? '#E5E7EB' : '#6B7280',
                      background: tab.accent && tab.count > 0 ? `${tab.accent}20` : undefined,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
      ) : filteredMissions.length === 0 ? (
        <div className="text-center py-8 text-xs text-gray-500 font-mono">
          <p className="mb-2">No missions matching current filter</p>
          <button
            type="button"
            onClick={() => {
              setFilterTab('ALL');
              setSearchQuery('');
            }}
            className="text-amber-accent hover:underline text-[11px]"
          >
            Clear filters ({counts.all} total)
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredMissions.map(mission => (
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
                <div className="flex gap-1.5 shrink-0">
                  <button
                    id={`approve-btn-${mission.id}`}
                    title="Approve mission"
                    className="px-3 py-1.5 text-xs font-mono font-semibold rounded border transition-all"
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
                    ✓
                  </button>
                  <button
                    id={`reject-btn-${mission.id}`}
                    title="Reject mission"
                    className="px-3 py-1.5 text-xs font-mono font-semibold rounded border transition-all"
                    style={{
                      background: 'rgba(255,59,48,0.1)',
                      color: '#FF3B30',
                      border: '1px solid rgba(255,59,48,0.3)',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,59,48,0.2)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,59,48,0.1)'; }}
                    onClick={e => { e.stopPropagation(); reject.mutate(mission.id); }}
                    disabled={reject.isPending}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

