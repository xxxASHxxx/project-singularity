import { useMemo, useState, useEffect } from 'react';
import { useTelemetry } from '../hooks/usePolling';
import type { TelemetryEvent } from '../api/client';

// ── Constants ────────────────────────────────────────────────────────────────

const GRID_COLS = 12;  // 12 time buckets (5-min each = last hour)
const GRID_ROWS = 4;   // 4 occupancy tiers: 0, 1-2, 3-4, 5+
const TIER_LABELS = ['Empty (0)', 'Low (1-2)', 'Moderate (3-4)', 'High (5+)'];
const BUCKET_MINUTES = 5;

// Color scale from cool → hot
function intensityColor(ratio: number): string {
  // ratio is 0-1 representing how much of the bucket had this tier
  if (ratio === 0) return 'rgba(255,255,255,0.02)';
  if (ratio < 0.2) return 'rgba(34,197,94,0.15)';
  if (ratio < 0.4) return 'rgba(34,197,94,0.35)';
  if (ratio < 0.6) return 'rgba(255,138,0,0.35)';
  if (ratio < 0.8) return 'rgba(255,138,0,0.55)';
  return 'rgba(255,59,48,0.6)';
}

function intensityBorder(ratio: number): string {
  if (ratio === 0) return 'rgba(255,255,255,0.04)';
  if (ratio < 0.4) return 'rgba(34,197,94,0.3)';
  if (ratio < 0.7) return 'rgba(255,138,0,0.3)';
  return 'rgba(255,59,48,0.3)';
}

function getOccupancyTier(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  return 3;
}

interface HeatmapCell {
  /** Number of events in this tier for this time bucket */
  count: number;
  /** Ratio of events in this tier vs all events in this time bucket */
  ratio: number;
  /** Total events in this time bucket */
  bucketTotal: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OccupancyHeatmap() {
  const { data: events = [] } = useTelemetry();
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Tick to keep time labels fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(k => k + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Build the heatmap grid
  const { grid, bucketLabels, peakBucket, totalEvents } = useMemo(() => {
    const now = Date.now();
    const newGrid: HeatmapCell[][] = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => ({ count: 0, ratio: 0, bucketTotal: 0 }))
    );
    const bucketTotals = new Array(GRID_COLS).fill(0);

    // Assign events to time buckets and occupancy tiers
    for (const event of events) {
      const eventTime = new Date(event.recordedAt).getTime();
      const minutesAgo = (now - eventTime) / 60_000;
      const bucketIdx = Math.floor(minutesAgo / BUCKET_MINUTES);

      if (bucketIdx >= 0 && bucketIdx < GRID_COLS) {
        const colIdx = GRID_COLS - 1 - bucketIdx; // Newest on the right
        const tier = getOccupancyTier(event.zoneOccupancyCount);
        newGrid[tier][colIdx].count += 1;
        bucketTotals[colIdx] += 1;
      }
    }

    // Calculate ratios
    let peak = 0;
    let peakIdx = 0;
    for (let col = 0; col < GRID_COLS; col++) {
      if (bucketTotals[col] > peak) {
        peak = bucketTotals[col];
        peakIdx = col;
      }
      for (let row = 0; row < GRID_ROWS; row++) {
        newGrid[row][col].bucketTotal = bucketTotals[col];
        newGrid[row][col].ratio = bucketTotals[col] > 0
          ? newGrid[row][col].count / bucketTotals[col]
          : 0;
      }
    }

    // Generate time labels
    const labels: string[] = [];
    for (let i = 0; i < GRID_COLS; i++) {
      const minsAgo = (GRID_COLS - 1 - i) * BUCKET_MINUTES;
      if (minsAgo === 0) {
        labels.push('now');
      } else {
        labels.push(`-${minsAgo}m`);
      }
    }

    return {
      grid: newGrid,
      bucketLabels: labels,
      peakBucket: peakIdx,
      totalEvents: events.length,
    };
  }, [events]);

  if (events.length < 3) return null;

  // Summary stats
  const avgOccupancy = events.length > 0
    ? (events.reduce((sum, e) => sum + e.zoneOccupancyCount, 0) / events.length).toFixed(1)
    : '—';

  const peakOccupancy = events.length > 0
    ? Math.max(...events.map(e => e.zoneOccupancyCount))
    : 0;

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="section-title mb-0">Occupancy Heatmap</p>
          <span className="text-[10px] font-mono text-gray-600">
            last {GRID_COLS * BUCKET_MINUTES}min · {totalEvents} events
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500">
          <span>avg: <span className="text-gray-400">{avgOccupancy}</span></span>
          <span>peak: <span style={{ color: peakOccupancy >= 4 ? '#FF3B30' : '#F5F5F5' }}>{peakOccupancy}</span></span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${GRID_COLS}, 1fr)`, gap: 2 }}>
          {/* Empty corner */}
          <div />

          {/* Time labels */}
          {bucketLabels.map((label, col) => (
            <div
              key={`header-${col}`}
              className="text-center text-[9px] font-mono text-gray-600 pb-1"
            >
              {label}
            </div>
          ))}

          {/* Grid rows (reversed so highest tier is at top) */}
          {[...Array(GRID_ROWS)].map((_, rowIdx) => {
            const displayRow = GRID_ROWS - 1 - rowIdx; // High at top
            return (
              <div key={`row-${displayRow}`} style={{ display: 'contents' }}>
                {/* Row label */}
                <div className="flex items-center text-[10px] font-mono text-gray-600 pr-2 justify-end">
                  {TIER_LABELS[displayRow]}
                </div>

                {/* Cells */}
                {grid[displayRow].map((cell, col) => {
                  const isHovered = hoveredCell?.row === displayRow && hoveredCell?.col === col;
                  return (
                    <div
                      key={`cell-${displayRow}-${col}`}
                      className="heatmap-cell"
                      onMouseEnter={() => setHoveredCell({ row: displayRow, col })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        background: intensityColor(cell.ratio),
                        border: `1px solid ${intensityBorder(cell.ratio)}`,
                        borderRadius: 3,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'default',
                        transition: 'all 0.2s ease',
                        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                        zIndex: isHovered ? 10 : 1,
                        position: 'relative',
                      }}
                      title={`${TIER_LABELS[displayRow]}: ${cell.count} events (${Math.round(cell.ratio * 100)}% of bucket)`}
                    >
                      {cell.count > 0 && (
                        <span
                          className="text-[9px] font-mono font-bold"
                          style={{
                            color: cell.ratio > 0.5 ? '#fff' : '#999',
                          }}
                        >
                          {cell.count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Color legend */}
      <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-gray-600">
        <div className="flex items-center gap-2">
          <span>Intensity:</span>
          {[0, 0.15, 0.35, 0.55, 0.8, 1.0].map((v, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 10,
                background: intensityColor(v),
                border: `1px solid ${intensityBorder(v)}`,
                borderRadius: 2,
              }}
            />
          ))}
          <span>low → high</span>
        </div>
        <span className="text-gray-700">
          {BUCKET_MINUTES}min buckets × {GRID_ROWS} tiers
        </span>
      </div>
    </div>
  );
}
