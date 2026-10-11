import { useEffect, useRef } from 'react';
import type { TelemetryEvent } from '../api/client';

interface UseAlertNotificationsOptions {
  enabled: boolean;
  latestEvent: TelemetryEvent | null | undefined;
}

/**
 * Fires desktop notifications when surge, low-stock, or anomaly alerts trigger.
 * Debounces to prevent notification spam — minimum 30s between same-type alerts.
 */
export function useAlertNotifications({ enabled, latestEvent }: UseAlertNotificationsOptions) {
  const lastSurgeNotif = useRef(0);
  const lastLowStockNotif = useRef(0);
  const lastAnomalyNotif = useRef(0);
  const prevSurge = useRef(false);
  const prevLowStock = useRef(false);
  const prevAnomaly = useRef(false);

  useEffect(() => {
    if (!enabled || !latestEvent) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = Date.now();
    const COOLDOWN_MS = 30_000; // 30 seconds between same-type notifications

    // Surge alert — fire only on rising edge
    if (latestEvent.surgeFlag && !prevSurge.current && now - lastSurgeNotif.current > COOLDOWN_MS) {
      new Notification('⚡ Surge Detected — Project Singularity', {
        body: `Zone occupancy: ${latestEvent.zoneOccupancyCount} people detected at ${latestEvent.deviceId}`,
        icon: '/favicon.ico',
        tag: 'singularity-surge',
        requireInteraction: false,
      });
      lastSurgeNotif.current = now;
    }

    // Low-stock alert — fire only on rising edge
    if (latestEvent.lowStockFlag && !prevLowStock.current && now - lastLowStockNotif.current > COOLDOWN_MS) {
      new Notification('⚠ Low Stock Alert — Project Singularity', {
        body: `Shelf fill ratio: ${latestEvent.shelfFillRatio.toFixed(1)}% at ${latestEvent.deviceId}`,
        icon: '/favicon.ico',
        tag: 'singularity-lowstock',
        requireInteraction: false,
      });
      lastLowStockNotif.current = now;
    }

    // Anomaly alert — fire only on rising edge
    if (latestEvent.anomalyFlag && !prevAnomaly.current && now - lastAnomalyNotif.current > COOLDOWN_MS) {
      const conf = latestEvent.anomalyConfidence != null ? ` (${Math.round(latestEvent.anomalyConfidence * 100)}% conf)` : '';
      new Notification('🚨 Statistical Anomaly — Project Singularity', {
        body: `Anomalous pattern detected at ${latestEvent.deviceId}${conf}`,
        icon: '/favicon.ico',
        tag: 'singularity-anomaly',
        requireInteraction: false,
      });
      lastAnomalyNotif.current = now;
    }

    prevSurge.current = latestEvent.surgeFlag;
    prevLowStock.current = latestEvent.lowStockFlag;
    prevAnomaly.current = !!latestEvent.anomalyFlag;
  }, [enabled, latestEvent]);
}
