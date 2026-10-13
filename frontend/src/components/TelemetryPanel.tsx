import React, { useRef, useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { useTelemetry } from '../hooks/usePolling';
import type { TelemetryEvent } from '../api/client';

const SURGE_THRESHOLD = 4;
const LOW_STOCK_THRESHOLD = 20;

function formatTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
  catch { return ts.substring(11, 19); }
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const isAnomaly = !!point?.anomaly;

  return (
    <div className="panel p-3 text-xs font-mono shadow-xl border border-[#2e2e32]">
      <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-border/60">
        <span className="text-gray-400">{label}</span>
        {isAnomaly && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold border"
            style={{
              background: 'rgba(139, 92, 246, 0.2)',
              borderColor: '#8B5CF6',
              color: '#C4B5FD',
            }}
          >
            ⚠ ANOMALY
          </span>
        )}
      </div>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-3">
          <span>{p.name}:</span>
          <strong>{p.value?.toFixed?.(1) ?? p.value}</strong>
        </p>
      ))}
      {isAnomaly && point?.confidence != null && (
        <div className="mt-1.5 pt-1.5 border-t border-purple-500/20 text-[10px] text-purple-300">
          <div>Confidence: {Math.round(point.confidence * 100)}%</div>
          {point.occZ != null && <div>Occupancy Z: {point.occZ > 0 ? '+' : ''}{point.occZ.toFixed(2)}</div>}
          {point.fillZ != null && <div>Shelf Fill Z: {point.fillZ > 0 ? '+' : ''}{point.fillZ.toFixed(2)}</div>}
        </div>
      )}
    </div>
  );
};

const renderAnomalyDot = (props: any) => {
  const { cx, cy, payload, key } = props;
  if (!payload?.anomaly) {
    return <circle key={key ?? `dot-${cx}-${cy}`} cx={cx} cy={cy} r={0} opacity={0} />;
  }
  return (
    <circle
      key={key ?? `anom-${cx}-${cy}`}
      cx={cx}
      cy={cy}
      r={4.5}
      fill="#A78BFA"
      stroke="#7C3AED"
      strokeWidth={2}
    />
  );
};

/** Hook that returns true for 350ms whenever `value` changes. */
function useFlash(value: any): boolean {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value && value !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 350);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return flash;
}

interface TelemetryPanelProps {
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export default function TelemetryPanel({ isPaused, onTogglePause }: TelemetryPanelProps = {}) {
  const { data: events = [], isError } = useTelemetry();
  const [timeWindow, setTimeWindow] = useState<15 | 30 | 60>(30);
  const [internalPaused, setInternalPaused] = useState(false);

  const paused = isPaused ?? internalPaused;
  const togglePause = onTogglePause ?? (() => setInternalPaused(p => !p));

  // Maintain frozen events buffer when stream is paused
  const frozenEventsRef = useRef<TelemetryEvent[]>([]);
  useEffect(() => {
    if (!paused) {
      frozenEventsRef.current = events;
    }
  }, [events, paused]);

  const activeEvents = paused && frozenEventsRef.current.length > 0 ? frozenEventsRef.current : events;
  const queuedCount = paused ? Math.max(0, events.length - frozenEventsRef.current.length) : 0;

  const chartData = useMemo(() => {
    return [...activeEvents].reverse().slice(-timeWindow).map((e: TelemetryEvent) => ({
      time: formatTime(e.recordedAt),
      occupancy: e.zoneOccupancyCount,
      fill: e.shelfFillRatio,
      anomaly: !!e.anomalyFlag,
      confidence: e.anomalyConfidence,
      occZ: e.anomalyOccupancyZ,
      fillZ: e.anomalyFillZ,
    }));
  }, [activeEvents, timeWindow]);

  const latest = activeEvents[0];

  const surgeFiring = latest?.surgeFlag;
  const lowStockFiring = latest?.lowStockFlag;

  const occupancyFlash = useFlash(latest?.zoneOccupancyCount);
  const fillFlash = useFlash(latest ? Math.round(latest.shelfFillRatio * 10) : undefined);

  // Velocity and depletion runway estimation
  const velocityInfo = useMemo(() => {
    if (activeEvents.length < 2) return null;
    const sampleCount = Math.min(6, activeEvents.length);
    const recent = activeEvents.slice(0, sampleCount);
    const latestFill = recent[0].shelfFillRatio;
    const oldestFill = recent[sampleCount - 1].shelfFillRatio;
    const tLatest = new Date(recent[0].recordedAt).getTime();
    const tOldest = new Date(recent[sampleCount - 1].recordedAt).getTime();
    const deltaMin = Math.max(0.08, (tLatest - tOldest) / 60000);
    const velocity = Number(((latestFill - oldestFill) / deltaMin).toFixed(1));

    let stockoutEta: number | null = null;
    if (velocity <= -0.5 && latestFill > 0) {
      const target = latestFill > LOW_STOCK_THRESHOLD ? LOW_STOCK_THRESHOLD : 0;
      stockoutEta = Math.max(0.1, Number(((latestFill - target) / Math.abs(velocity)).toFixed(1)));
    }

    return {
      velocity,
      stockoutEta,
      isRapid: velocity <= -10.0,
      isRestocking: velocity >= 3.0,
    };
  }, [activeEvents]);

  // Real-time statistics across visible events buffer
  const stats = useMemo(() => {
    if (!activeEvents.length) return null;
    let peakOcc = 0;
    let minOcc = 999;
    let peakFill = 0;
    let minFill = 100;

    for (const e of activeEvents) {
      if (e.zoneOccupancyCount > peakOcc) peakOcc = e.zoneOccupancyCount;
      if (e.zoneOccupancyCount < minOcc) minOcc = e.zoneOccupancyCount;
      if (e.shelfFillRatio > peakFill) peakFill = e.shelfFillRatio;
      if (e.shelfFillRatio < minFill) minFill = e.shelfFillRatio;
    }

    // Velocity / trend over recent 3 samples
    const recentSpan = Math.min(3, activeEvents.length - 1);
    const occDelta = recentSpan > 0 ? activeEvents[0].zoneOccupancyCount - activeEvents[recentSpan].zoneOccupancyCount : 0;
    const fillDelta = recentSpan > 0 ? Number((activeEvents[0].shelfFillRatio - activeEvents[recentSpan].shelfFillRatio).toFixed(1)) : 0;

    return {
      peakOcc,
      minOcc: minOcc === 999 ? 0 : minOcc,
      peakFill,
      minFill,
      occDelta,
      fillDelta,
    };
  }, [activeEvents]);

  const handleExportCSV = () => {
    if (!activeEvents.length) return;
    const headers = ['RecordedAt', 'DeviceId', 'ZoneOccupancyCount', 'ShelfFillRatio', 'SurgeFlag', 'LowStockFlag', 'AnomalyFlag', 'AnomalyConfidence', 'AnomalyOccupancyZ', 'AnomalyFillZ'];
    const rows = activeEvents.map(e => [
      `"${e.recordedAt}"`,
      `"${e.deviceId}"`,
      e.zoneOccupancyCount,
      e.shelfFillRatio.toFixed(2),
      e.surgeFlag,
      e.lowStockFlag,
      e.anomalyFlag ?? false,
      e.anomalyConfidence != null ? e.anomalyConfidence.toFixed(3) : '',
      e.anomalyOccupancyZ != null ? e.anomalyOccupancyZ.toFixed(2) : '',
      e.anomalyFillZ != null ? e.anomalyFillZ.toFixed(2) : '',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `singularity-telemetry-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel p-5">
      {/* Header bar with device status, controls, and CSV export */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="section-title mb-0">Live Telemetry</p>
          {latest && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border"
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderColor: '#262626',
                color: '#9CA3AF',
              }}
              title="Active ingest source"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {latest.deviceId}
            </span>
          )}
          {events.length > 0 && (
            <span className="text-[10px] font-mono text-gray-500 hidden sm:inline">
              ({events.length} buffered)
            </span>
          )}
          {paused && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border font-semibold"
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                borderColor: '#F59E0B',
                color: '#FCD34D',
              }}
            >
              ⏸ FROZEN {queuedCount > 0 ? `(+${queuedCount})` : ''}
            </span>
          )}
          {velocityInfo && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border"
              style={{
                background: velocityInfo.isRapid
                  ? 'rgba(239, 68, 68, 0.15)'
                  : velocityInfo.velocity < -0.5
                  ? 'rgba(245, 158, 11, 0.12)'
                  : velocityInfo.isRestocking
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(255, 255, 255, 0.03)',
                borderColor: velocityInfo.isRapid
                  ? '#EF4444'
                  : velocityInfo.velocity < -0.5
                  ? '#F59E0B'
                  : velocityInfo.isRestocking
                  ? '#22C55E'
                  : '#262626',
                color: velocityInfo.isRapid
                  ? '#FCA5A5'
                  : velocityInfo.velocity < -0.5
                  ? '#FCD34D'
                  : velocityInfo.isRestocking
                  ? '#86EFAC'
                  : '#9CA3AF',
                boxShadow: velocityInfo.isRapid ? '0 0 10px rgba(239, 68, 68, 0.3)' : undefined,
              }}
              title={
                velocityInfo.isRapid
                  ? `Rapid stock depletion: ${velocityInfo.velocity}%/min`
                  : velocityInfo.velocity < -0.5
                  ? `Depletion rate: ${velocityInfo.velocity}%/min${velocityInfo.stockoutEta != null ? ` (ETA: ~${velocityInfo.stockoutEta}m)` : ''}`
                  : velocityInfo.isRestocking
                  ? `Restocking rate: +${velocityInfo.velocity}%/min`
                  : 'Shelf fill rate stable'
              }
            >
              <span>
                {velocityInfo.isRapid
                  ? '⚡ RAPID'
                  : velocityInfo.velocity < -0.5
                  ? '📉'
                  : velocityInfo.isRestocking
                  ? '📦 RESTOCK'
                  : '⚡'}
              </span>
              <span>
                {velocityInfo.velocity > 0 ? `+${velocityInfo.velocity}` : `${velocityInfo.velocity}`}%/min
              </span>
              {velocityInfo.stockoutEta != null && (
                <span className="opacity-80 text-[10px]">
                  (~{velocityInfo.stockoutEta}m)
                </span>
              )}
            </span>
          )}
          {latest?.anomalyFlag && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border font-bold"
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
                borderColor: '#8B5CF6',
                color: '#C4B5FD',
                boxShadow: '0 0 12px rgba(139, 92, 246, 0.3)',
              }}
              title={`Statistical anomaly detected${
                latest.anomalyConfidence != null ? ` (${Math.round(latest.anomalyConfidence * 100)}% conf` : ''
              }${latest.anomalyOccupancyZ != null ? `, occ Z: ${latest.anomalyOccupancyZ > 0 ? '+' : ''}${latest.anomalyOccupancyZ.toFixed(2)}` : ''}${
                latest.anomalyFillZ != null ? `, fill Z: ${latest.anomalyFillZ > 0 ? '+' : ''}${latest.anomalyFillZ.toFixed(2)}` : ''
              }${latest.anomalyConfidence != null ? ')' : ''}`}
            >
              ⚠ ANOMALY
              {latest.anomalyConfidence != null && (
                <span className="text-[10px] font-normal opacity-85">
                  ({Math.round(latest.anomalyConfidence * 100)}%)
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Resume toggle button */}
          <button
            type="button"
            onClick={togglePause}
            className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-colors flex items-center gap-1.5 ${
              paused
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'text-gray-400 hover:text-gray-200 border-[#262626] bg-white/[0.03]'
            }`}
            title="Freeze / resume live telemetry chart (shortcut: P)"
          >
            <span>{paused ? '▶' : '⏸'}</span>
            <span className="hidden sm:inline">{paused ? 'Resume' : 'Freeze'}</span>
          </button>

          {/* Time window selector */}
          <div className="flex items-center border border-border rounded overflow-hidden p-0.5 bg-black/40">
            {([15, 30, 60] as const).map(win => (
              <button
                key={win}
                type="button"
                onClick={() => setTimeWindow(win)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  timeWindow === win
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                title={`Show last ${win} samples`}
              >
                {win}s
              </button>
            ))}
          </div>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!events.length}
            className="px-2.5 py-1 text-[11px] font-mono rounded border transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: '#262626',
              color: '#9CA3AF',
            }}
            title="Download active telemetry buffer as CSV"
          >
            <span>↓</span>
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Big numbers */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div
          className={`panel p-4 transition-all duration-300 ${surgeFiring ? 'border-red-accent' : ''}`}
          style={{ borderColor: surgeFiring ? '#FF3B30' : undefined, boxShadow: surgeFiring ? '0 0 16px rgba(255,59,48,0.2)' : undefined }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Zone Occupancy</p>
            {stats && stats.occDelta !== 0 && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                style={{
                  color: stats.occDelta > 0 ? '#FF3B30' : '#22C55E',
                  background: stats.occDelta > 0 ? 'rgba(255,59,48,0.1)' : 'rgba(34,197,94,0.1)',
                  borderColor: stats.occDelta > 0 ? 'rgba(255,59,48,0.3)' : 'rgba(34,197,94,0.3)',
                }}
              >
                {stats.occDelta > 0 ? `▲ +${stats.occDelta}` : `▼ ${stats.occDelta}`}
              </span>
            )}
          </div>
          <p
            className={`font-mono text-5xl font-bold ${occupancyFlash ? 'value-flash' : ''}`}
            style={{ color: surgeFiring ? '#FF3B30' : '#F5F5F5', display: 'inline-block' }}
          >
            {latest?.zoneOccupancyCount ?? '—'}
          </p>
          {surgeFiring && <p className="text-xs text-red-accent mt-1 font-mono">⚡ SURGE DETECTED</p>}
          <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
            <span>threshold: {SURGE_THRESHOLD}</span>
            {stats && (
              <span className="font-mono text-[11px] text-gray-500" title="Session peak occupancy">
                peak: {stats.peakOcc}
              </span>
            )}
          </div>
        </div>

        <div
          className={`panel p-4 transition-all duration-300 ${lowStockFiring ? 'border-amber-accent' : ''}`}
          style={{ borderColor: lowStockFiring ? '#FF8A00' : undefined, boxShadow: lowStockFiring ? '0 0 16px rgba(255,138,0,0.2)' : undefined }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Shelf Fill Ratio</p>
            {stats && stats.fillDelta !== 0 && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                style={{
                  color: stats.fillDelta < 0 ? '#FF8A00' : '#22C55E',
                  background: stats.fillDelta < 0 ? 'rgba(255,138,0,0.1)' : 'rgba(34,197,94,0.1)',
                  borderColor: stats.fillDelta < 0 ? 'rgba(255,138,0,0.3)' : 'rgba(34,197,94,0.3)',
                }}
              >
                {stats.fillDelta > 0 ? `▲ +${stats.fillDelta}%` : `▼ ${stats.fillDelta}%`}
              </span>
            )}
          </div>
          <p
            className={`font-mono text-5xl font-bold ${fillFlash ? 'value-flash' : ''}`}
            style={{ color: lowStockFiring ? '#FF8A00' : '#F5F5F5', display: 'inline-block' }}
          >
            {latest ? `${latest.shelfFillRatio.toFixed(1)}%` : '—'}
          </p>
          {lowStockFiring && <p className="text-xs text-amber-accent mt-1 font-mono">⚠ LOW STOCK</p>}
          <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
            <span>threshold: {LOW_STOCK_THRESHOLD}%</span>
            {stats && (
              <span className="font-mono text-[11px] text-gray-500" title="Session lowest shelf fill recorded">
                lowest: {stats.minFill.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {isError ? (
        <div className="text-center text-gray-600 py-8 font-mono text-sm">API unavailable — waiting for connection</div>
      ) : chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
            <XAxis dataKey="time" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} />
            <YAxis yAxisId="left" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} domain={[0, 10]} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'monospace' }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#6B7280' }} />
            <ReferenceLine yAxisId="left" y={SURGE_THRESHOLD} stroke="#FF3B30" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'SURGE', fill: '#FF3B30', fontSize: 9 }} />
            <ReferenceLine yAxisId="right" y={LOW_STOCK_THRESHOLD} stroke="#FF8A00" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'LOW', fill: '#FF8A00', fontSize: 9 }} />
            <Line yAxisId="left" type="monotone" dataKey="occupancy" name="Zone Occupancy" stroke="#FF3B30" strokeWidth={2} dot={renderAnomalyDot} activeDot={{ r: 4 }} />
            <Line yAxisId="right" type="monotone" dataKey="fill" name="Shelf Fill %" stroke="#FF8A00" strokeWidth={2} dot={renderAnomalyDot} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center text-gray-600 py-8 font-mono text-sm">Awaiting telemetry data...</div>
      )}
    </div>
  );
}
