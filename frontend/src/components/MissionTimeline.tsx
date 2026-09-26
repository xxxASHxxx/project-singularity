import { useState, useEffect, useMemo } from 'react';
import { useMissions } from '../hooks/usePolling';
import StatusPill from './StatusPill';
import type { AgentMission } from '../api/client';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function stageColor(stage: string): string {
  switch (stage) {
    case 'waiting': return '#6B7280';
    case 'approved': return '#3B82F6';
    case 'running': return '#FF3B30';
    case 'completed': return '#22C55E';
    case 'failed': return '#B3261E';
    default: return '#444';
  }
}

interface TimelineStage {
  label: string;
  key: string;
  startMs: number;
  endMs: number;
  color: string;
  active: boolean;
}

function buildStages(mission: AgentMission): TimelineStage[] {
  const created = new Date(mission.createdAt).getTime();
  const started = mission.startedAt ? new Date(mission.startedAt).getTime() : null;
  const completed = mission.completedAt ? new Date(mission.completedAt).getTime() : null;
  const now = Date.now();

  const stages: TimelineStage[] = [];

  if (mission.status === 'PENDING_APPROVAL') {
    stages.push({
      label: 'Awaiting Approval',
      key: 'waiting',
      startMs: created,
      endMs: now,
      color: stageColor('waiting'),
      active: true,
    });
  } else if (started) {
    // Approval wait phase
    stages.push({
      label: 'Approval Wait',
      key: 'waiting',
      startMs: created,
      endMs: started,
      color: stageColor('waiting'),
      active: false,
    });

    if (completed) {
      // Execution phase (finished)
      stages.push({
        label: mission.status === 'FAILED' ? 'Execution (Failed)' : 'Execution',
        key: mission.status === 'FAILED' ? 'failed' : 'completed',
        startMs: started,
        endMs: completed,
        color: stageColor(mission.status === 'FAILED' ? 'failed' : 'completed'),
        active: false,
      });
    } else {
      // Execution phase (running)
      stages.push({
        label: 'Running',
        key: 'running',
        startMs: started,
        endMs: now,
        color: stageColor('running'),
        active: true,
      });
    }
  }

  return stages;
}

// ── Mission Row ──────────────────────────────────────────────────────────────

function MissionRow({ mission }: { mission: AgentMission }) {
  const stages = buildStages(mission);
  const totalMs = stages.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
  const totalDuration = totalMs > 0 ? formatDuration(totalMs) : '—';

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded transition-colors hover:bg-white/5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Mission ID + Type */}
      <div className="w-24 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-gray-500">#{mission.id}</span>
          <span
            className="text-[10px] font-semibold"
            style={{ color: mission.missionType === 'RESTOCK' ? '#FF3B30' : '#FF8A00' }}
          >
            {mission.missionType}
          </span>
        </div>
        <StatusPill status={mission.status} />
      </div>

      {/* Duration bar */}
      <div className="flex-1 min-w-0">
        <div className="flex h-5 rounded overflow-hidden bg-black/40 border border-white/5">
          {stages.map((stage, i) => {
            const widthPct = totalMs > 0 ? ((stage.endMs - stage.startMs) / totalMs) * 100 : 100 / stages.length;
            return (
              <div
                key={i}
                title={`${stage.label}: ${formatDuration(stage.endMs - stage.startMs)}`}
                className={stage.active ? 'timeline-bar-active' : ''}
                style={{
                  width: `${Math.max(widthPct, 3)}%`,
                  background: stage.active
                    ? `repeating-linear-gradient(90deg, ${stage.color}40, ${stage.color}60 50%, ${stage.color}40)`
                    : `${stage.color}50`,
                  borderRight: i < stages.length - 1 ? '1px solid rgba(0,0,0,0.3)' : undefined,
                  transition: 'width 0.4s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  className="text-[9px] font-mono font-semibold truncate px-1"
                  style={{ color: stage.color, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Total elapsed */}
      <div className="w-16 text-right shrink-0">
        <span className="font-mono text-[11px] text-gray-400">{totalDuration}</span>
      </div>
    </div>
  );
}

// ── Main Timeline Component ──────────────────────────────────────────────────

export default function MissionTimeline() {
  const { data: missions = [] } = useMissions();

  // Tick every second so active timers update
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Show most recent 10 missions in chronological order (newest first)
  const recentMissions = useMemo(() => {
    return [...missions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 10);
  }, [missions]);

  // Calculate stats
  const stats = useMemo(() => {
    const completed = missions.filter(m => m.status === 'COMPLETED' && m.startedAt && m.completedAt);
    if (completed.length === 0) return null;

    const durations = completed.map(m =>
      new Date(m.completedAt!).getTime() - new Date(m.startedAt!).getTime()
    );
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const fastest = Math.min(...durations);
    const slowest = Math.max(...durations);

    return { avg, fastest, slowest, count: completed.length };
  }, [missions]);

  if (missions.length === 0) return null;

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="section-title mb-0">Mission Timeline</p>
          <span className="text-[10px] font-mono text-gray-600">
            {recentMissions.length} recent
          </span>
        </div>

        {/* Execution stats */}
        {stats && (
          <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
            <span title="Average execution time">
              avg: <span className="text-gray-400">{formatDuration(stats.avg)}</span>
            </span>
            <span title="Fastest completed mission">
              fastest: <span style={{ color: '#22C55E' }}>{formatDuration(stats.fastest)}</span>
            </span>
            <span title="Slowest completed mission">
              slowest: <span style={{ color: '#FF8A00' }}>{formatDuration(stats.slowest)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-[10px] font-mono text-gray-600">
        {[
          { label: 'Waiting', color: stageColor('waiting') },
          { label: 'Running', color: stageColor('running') },
          { label: 'Completed', color: stageColor('completed') },
          { label: 'Failed', color: stageColor('failed') },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: `${item.color}60` }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline rows */}
      <div className="space-y-0.5 max-h-72 overflow-y-auto">
        {recentMissions.map(mission => (
          <MissionRow key={mission.id} mission={mission} />
        ))}
      </div>
    </div>
  );
}
