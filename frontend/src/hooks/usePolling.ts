import { useQuery } from '@tanstack/react-query';
import { fetchTelemetry, fetchMissions, fetchProducts } from '../api/client';

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
