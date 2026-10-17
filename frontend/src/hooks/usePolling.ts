import { useQuery } from '@tanstack/react-query';
import { fetchTelemetry, fetchMissions, fetchProducts, fetchAnalytics, fetchArtifacts } from '../api/client';
import type { AnalyticsSnapshot, MissionArtifact } from '../api/client';

const POLL_INTERVAL = 4000;

export function useTelemetry(limit = 60) {
  return useQuery({
    queryKey: ['telemetry', limit],
    queryFn: () => fetchTelemetry(limit),
    refetchInterval: POLL_INTERVAL,
  });
}

export function useMissions() {
  return useQuery({
    queryKey: ['missions'],
    queryFn: fetchMissions,
    refetchInterval: POLL_INTERVAL,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
    refetchInterval: POLL_INTERVAL * 2,
  });
}

export function useAnalytics() {
  return useQuery<AnalyticsSnapshot>({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
}

export function useMissionArtifacts(missionId?: number | null, status?: string | null) {
  const isTerminal = status === 'COMPLETED' || status === 'FAILED';
  return useQuery<MissionArtifact[]>({
    queryKey: ['artifacts', missionId],
    queryFn: () => fetchArtifacts(missionId!),
    enabled: missionId !== undefined && missionId !== null,
    refetchInterval: isTerminal || status === 'PENDING_APPROVAL' ? false : POLL_INTERVAL,
  });
}

