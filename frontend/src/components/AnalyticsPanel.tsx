import { useQuery } from '@tanstack/react-query';
import { fetchAnalytics, type AnalyticsSnapshot } from '../api/client';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function fmt(n: number | null, decimals = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(decimals);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'default' | 'green' | 'red' | 'amber';
}

function StatCard({ label, value, sub, accent = 'default' }: StatCardProps) {
  const accentColor =
    accent === 'green'  ? '#22C55E' :
    accent === 'red'    ? '#FF3B30' :
    accent === 'amber'  ? '#FF8A00' :
    '#E8E8E8';

  return (
    <div style={{
      background: '#141416',
      border: '1px solid #242428',
      borderRadius: 8,
      padding: '14px 18px',
      minWidth: 140,
      flex: '1 1 140px',
    }}>
      <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: accentColor, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

interface MiniBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

function MiniBar({ label, count, total, color }: MiniBarProps) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ccc' }}>{count}</span>
      </div>
      <div style={{ background: '#1e1e22', borderRadius: 3, height: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsPanel() {
  const { data, isLoading, isError } = useQuery<AnalyticsSnapshot>({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    refetchInterval: 10_000,   // matches server Cache-Control max-age
    staleTime: 8_000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: '16px 0', color: '#444', fontSize: 12 }}>
        Loading analytics…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: '16px 0', color: '#FF3B30', fontSize: 12 }}>
        Analytics unavailable
      </div>
    );
  }

  const { missions, telemetry } = data;
  const total = missions.total;

  const successAccent =
    missions.successRate === null   ? 'default' :
    missions.successRate >= 90      ? 'green'   :
    missions.successRate >= 70      ? 'amber'   : 'red';

  const STATUS_COLORS: Record<string, string> = {
    COMPLETED:        '#22C55E',
    RUNNING:          '#FF8A00',
    APPROVED:         '#3B82F6',
    PENDING_APPROVAL: '#6B7280',
    FAILED:           '#FF3B30',
  };

  return (
    <section style={{ marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', color: '#555', textTransform: 'uppercase' }}>
          SYSTEM ANALYTICS
        </span>
        <div style={{ flex: 1, height: 1, background: '#242428' }} />
        <span style={{ fontSize: 10, color: '#444', fontFamily: 'JetBrains Mono, monospace' }}>
          {telemetry.totalEvents} events recorded
        </span>
      </div>

      {/* Stat cards row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatCard
          label="Total Missions"
          value={total.toString()}
          sub={`${missions.byType['RESTOCK'] ?? 0} restock · ${missions.byType['REPRICE'] ?? 0} reprice`}
        />
        <StatCard
          label="Success Rate"
          value={missions.successRate !== null ? `${missions.successRate}%` : '—'}
          sub={`${missions.byStatus['COMPLETED'] ?? 0} completed · ${missions.byStatus['FAILED'] ?? 0} failed`}
          accent={successAccent}
        />
        <StatCard
          label="Avg Approval Time"
          value={formatDuration(missions.avgApprovalTimeSeconds)}
          sub="creation → agent start"
          accent={
            missions.avgApprovalTimeSeconds === null             ? 'default' :
            missions.avgApprovalTimeSeconds <= 120               ? 'green'   :
            missions.avgApprovalTimeSeconds <= 300               ? 'amber'   : 'red'
          }
        />
        <StatCard
          label="Avg Agent Time"
          value={formatDuration(missions.avgCompletionTimeSeconds)}
          sub="start → completion"
          accent="green"
        />
        <StatCard
          label="Surges (24h)"
          value={telemetry.surgeEventsLast24h.toString()}
          sub={`${telemetry.lowStockEventsLast24h} low-stock events`}
          accent={telemetry.surgeEventsLast24h > 5 ? 'amber' : 'default'}
        />
        <StatCard
          label="Avg Occupancy"
          value={fmt(telemetry.avgOccupancy)}
          sub={`avg shelf fill ${fmt(telemetry.avgShelfFill)}%`}
        />
      </div>

      {/* Mission status breakdown */}
      {total > 0 && (
        <div style={{
          background: '#141416',
          border: '1px solid #242428',
          borderRadius: 8,
          padding: '14px 18px',
        }}>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
            MISSION BREAKDOWN
          </div>
          {Object.entries(missions.byStatus)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <MiniBar
                key={status}
                label={status.replace('_', ' ')}
                count={count}
                total={total}
                color={STATUS_COLORS[status] ?? '#444'}
              />
            ))}
        </div>
      )}
    </section>
  );
}
