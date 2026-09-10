import { useQuery } from '@tanstack/react-query';
import { fetchTelemetry, fetchMissions, fetchProducts, fetchAnalytics } from '../api/client';
import type { AnalyticsSnapshot } from '../api/client';

const POLL_INTERVAL = 4000;

export function useTelemetry() {
  return useQuery({
    queryKey: ['telemetry'],
    queryFn: () => fetchTelemetry(60),
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
