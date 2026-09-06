import React, { useRef, useState, useEffect } from 'react';
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

  const chartData = [...events].reverse().slice(-30).map((e: TelemetryEvent) => ({
    time: formatTime(e.recordedAt),
    occupancy: e.zoneOccupancyCount,
    fill: e.shelfFillRatio,
  }));

  const latest = events[0];

  const surgeFiring = latest?.surgeFlag;
  const lowStockFiring = latest?.lowStockFlag;

  const occupancyFlash = useFlash(latest?.zoneOccupancyCount);
  const fillFlash = useFlash(latest ? Math.round(latest.shelfFillRatio * 10) : undefined);

  return (
    <div className="panel p-5">
      <p className="section-title">Live Telemetry</p>

      {/* Big numbers */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className={`panel p-4 ${surgeFiring ? 'border-red-accent' : ''}`}
             style={{ borderColor: surgeFiring ? '#FF3B30' : undefined, boxShadow: surgeFiring ? '0 0 16px rgba(255,59,48,0.2)' : undefined }}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Zone Occupancy</p>
          <p className={`font-mono text-5xl font-bold ${occupancyFlash ? 'value-flash' : ''}`} style={{ color: surgeFiring ? '#FF3B30' : '#F5F5F5', display: 'inline-block' }}>
            {latest?.zoneOccupancyCount ?? '—'}
          </p>
          {surgeFiring && <p className="text-xs text-red-accent mt-1 font-mono">⚡ SURGE DETECTED</p>}
          <p className="text-xs text-gray-600 mt-1">threshold: {SURGE_THRESHOLD}</p>
        </div>
        <div className={`panel p-4 ${lowStockFiring ? 'border-amber-accent' : ''}`}
             style={{ borderColor: lowStockFiring ? '#FF8A00' : undefined, boxShadow: lowStockFiring ? '0 0 16px rgba(255,138,0,0.2)' : undefined }}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Shelf Fill Ratio</p>
          <p className={`font-mono text-5xl font-bold ${fillFlash ? 'value-flash' : ''}`} style={{ color: lowStockFiring ? '#FF8A00' : '#F5F5F5', display: 'inline-block' }}>
            {latest ? `${latest.shelfFillRatio.toFixed(1)}%` : '—'}
          </p>
          {lowStockFiring && <p className="text-xs text-amber-accent mt-1 font-mono">⚠ LOW STOCK</p>}
          <p className="text-xs text-gray-600 mt-1">threshold: {LOW_STOCK_THRESHOLD}%</p>
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
