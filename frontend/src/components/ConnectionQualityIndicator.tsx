import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api/client';

interface ConnectionStats {
  latencyMs: number | null;
  avgLatencyMs: number | null;
  status: 'excellent' | 'good' | 'degraded' | 'offline';
  lastCheck: number;
  uptimePercent: number;
  consecutiveFailures: number;
}

const PING_INTERVAL = 8000; // 8 seconds
const HISTORY_SIZE = 30;

/**
 * Measures real-time API connection quality by periodically pinging
 * the telemetry endpoint and tracking response latency.
 */
export function useConnectionQuality(): ConnectionStats {
  const [stats, setStats] = useState<ConnectionStats>({
    latencyMs: null,
    avgLatencyMs: null,
    status: 'offline',
    lastCheck: 0,
    uptimePercent: 100,
    consecutiveFailures: 0,
  });

  const latencyHistory = useRef<number[]>([]);
  const successCount = useRef(0);
  const totalCount = useRef(0);
  const consecutiveFailures = useRef(0);

  useEffect(() => {
    let mounted = true;

    const ping = async () => {
      const start = performance.now();
      totalCount.current++;

      try {
        await api.get('/api/v1/telemetry/latest?n=1', { timeout: 5000 });
        const latency = Math.round(performance.now() - start);

        successCount.current++;
        consecutiveFailures.current = 0;

        latencyHistory.current.push(latency);
        if (latencyHistory.current.length > HISTORY_SIZE) {
          latencyHistory.current.shift();
        }

        const avg = Math.round(
          latencyHistory.current.reduce((a, b) => a + b, 0) / latencyHistory.current.length
        );

        const uptime = totalCount.current > 0
          ? Math.round((successCount.current / totalCount.current) * 100)
          : 100;

        let status: ConnectionStats['status'] = 'excellent';
        if (avg > 500) status = 'degraded';
        else if (avg > 200) status = 'good';

        if (mounted) {
          setStats({
            latencyMs: latency,
            avgLatencyMs: avg,
            status,
            lastCheck: Date.now(),
            uptimePercent: uptime,
            consecutiveFailures: 0,
          });
        }
      } catch {
        consecutiveFailures.current++;

        if (mounted) {
          const uptime = totalCount.current > 0
            ? Math.round((successCount.current / totalCount.current) * 100)
            : 0;

          setStats({
            latencyMs: null,
            avgLatencyMs: latencyHistory.current.length > 0
              ? Math.round(latencyHistory.current.reduce((a, b) => a + b, 0) / latencyHistory.current.length)
              : null,
            status: 'offline',
            lastCheck: Date.now(),
            uptimePercent: uptime,
            consecutiveFailures: consecutiveFailures.current,
          });
        }
      }
    };

    // Initial ping immediately
    ping();
    const interval = setInterval(ping, PING_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return stats;
}

// ── Visual component ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  excellent: { color: '#22C55E', label: 'EXCELLENT', dotShadow: '0 0 6px #22C55E' },
  good:      { color: '#3B82F6', label: 'GOOD',      dotShadow: '0 0 6px #3B82F6' },
  degraded:  { color: '#FF8A00', label: 'DEGRADED',  dotShadow: '0 0 6px #FF8A00' },
  offline:   { color: '#FF3B30', label: 'OFFLINE',   dotShadow: '0 0 6px #FF3B30' },
};

export default function ConnectionQualityIndicator() {
  const stats = useConnectionQuality();
  const config = STATUS_CONFIG[stats.status];

  return (
    <div
      className="panel p-5"
      style={{
        borderColor: stats.status === 'offline' ? 'rgba(255,59,48,0.3)' : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Connection Quality</p>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: config.color,
              boxShadow: config.dotShadow,
              animation: stats.status === 'offline' ? 'pulse-glow 1.5s ease-in-out infinite' : undefined,
            }}
          />
          <span
            className="text-xs font-mono font-semibold"
            style={{ color: config.color, letterSpacing: '0.05em' }}
          >
            {config.label}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Latency */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Latency</span>
          <span className="text-xs font-mono" style={{ color: stats.latencyMs ? config.color : '#FF3B30' }}>
            {stats.latencyMs !== null ? `${stats.latencyMs}ms` : '—'}
          </span>
        </div>

        {/* Avg Latency */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Avg Latency (30)</span>
          <span className="text-xs font-mono text-gray-400">
            {stats.avgLatencyMs !== null ? `${stats.avgLatencyMs}ms` : '—'}
          </span>
        </div>

        {/* Uptime */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Session Uptime</span>
          <span
            className="text-xs font-mono"
            style={{
              color: stats.uptimePercent >= 95 ? '#22C55E' :
                     stats.uptimePercent >= 80 ? '#FF8A00' : '#FF3B30',
            }}
          >
            {stats.uptimePercent}%
          </span>
        </div>

        {/* Latency bar visualization */}
        {stats.latencyMs !== null && (
          <div>
            <div
              style={{
                background: '#1e1e22',
                borderRadius: 3,
                height: 4,
                overflow: 'hidden',
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: `${Math.min((stats.latencyMs / 1000) * 100, 100)}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${config.color} 0%, ${config.color}88 100%)`,
                  borderRadius: 3,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-mono text-gray-700">0ms</span>
              <span className="text-[9px] font-mono text-gray-700">1000ms</span>
            </div>
          </div>
        )}

        {/* Failures */}
        {stats.consecutiveFailures > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Consecutive Failures</span>
            <span className="text-xs font-mono text-red-accent">
              {stats.consecutiveFailures}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
