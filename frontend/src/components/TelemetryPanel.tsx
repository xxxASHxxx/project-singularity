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
  return (
    <div className="panel p-3 text-xs font-mono">
      <p className="text-gray-500 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value?.toFixed?.(1) ?? p.value}</strong></p>
      ))}
    </div>
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

export default function TelemetryPanel() {
  const { data: events = [], isError } = useTelemetry();
  const [timeWindow, setTimeWindow] = useState<15 | 30 | 60>(30);

  const chartData = useMemo(() => {
    return [...events].reverse().slice(-timeWindow).map((e: TelemetryEvent) => ({
      time: formatTime(e.recordedAt),
      occupancy: e.zoneOccupancyCount,
      fill: e.shelfFillRatio,
    }));
  }, [events, timeWindow]);

  const latest = events[0];

  const surgeFiring = latest?.surgeFlag;
  const lowStockFiring = latest?.lowStockFlag;

  const occupancyFlash = useFlash(latest?.zoneOccupancyCount);
  const fillFlash = useFlash(latest ? Math.round(latest.shelfFillRatio * 10) : undefined);

  // Real-time statistics across visible events buffer
  const stats = useMemo(() => {
    if (!events.length) return null;
    let peakOcc = 0;
    let minOcc = 999;
    let peakFill = 0;
    let minFill = 100;

    for (const e of events) {
      if (e.zoneOccupancyCount > peakOcc) peakOcc = e.zoneOccupancyCount;
      if (e.zoneOccupancyCount < minOcc) minOcc = e.zoneOccupancyCount;
      if (e.shelfFillRatio > peakFill) peakFill = e.shelfFillRatio;
      if (e.shelfFillRatio < minFill) minFill = e.shelfFillRatio;
    }

    // Velocity / trend over recent 3 samples
    const recentSpan = Math.min(3, events.length - 1);
    const occDelta = recentSpan > 0 ? events[0].zoneOccupancyCount - events[recentSpan].zoneOccupancyCount : 0;
    const fillDelta = recentSpan > 0 ? Number((events[0].shelfFillRatio - events[recentSpan].shelfFillRatio).toFixed(1)) : 0;

    return {
      peakOcc,
      minOcc: minOcc === 999 ? 0 : minOcc,
      peakFill,
      minFill,
      occDelta,
      fillDelta,
    };
  }, [events]);

  const handleExportCSV = () => {
    if (!events.length) return;
    const headers = ['RecordedAt', 'DeviceId', 'ZoneOccupancyCount', 'ShelfFillRatio', 'SurgeFlag', 'LowStockFlag'];
    const rows = events.map(e => [
      `"${e.recordedAt}"`,
      `"${e.deviceId}"`,
      e.zoneOccupancyCount,
      e.shelfFillRatio.toFixed(2),
      e.surgeFlag,
      e.lowStockFlag,
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
        <div className="flex items-center gap-2.5">
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
        </div>

        <div className="flex items-center gap-2">
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
            <Line yAxisId="left" type="monotone" dataKey="occupancy" name="Zone Occupancy" stroke="#FF3B30" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line yAxisId="right" type="monotone" dataKey="fill" name="Shelf Fill %" stroke="#FF8A00" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center text-gray-600 py-8 font-mono text-sm">Awaiting telemetry data...</div>
      )}
    </div>
  );
}
