import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
});

// Types
export interface TelemetryEvent {
  id: number;
  deviceId: string;
  recordedAt: string;
  zoneOccupancyCount: number;
  shelfFillRatio: number;
  surgeFlag: boolean;
  lowStockFlag: boolean;
}

export interface AgentMission {
  id: number;
  triggeredByEventId: number;
  missionType: 'RESTOCK' | 'REPRICE';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  createdAt: string;
}

export interface MissionArtifact {
  id: number;
  missionId: number;
  artifactType: 'SCREENSHOT' | 'RECORDING_URL' | 'PLAN_MD' | 'LOG';
  storagePath: string;
  createdAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  currentPrice: number;
  stockQty: number;
}

// API functions
export const fetchTelemetry = (n = 60) =>
  api.get<TelemetryEvent[]>(`/api/v1/telemetry/latest?n=${n}`).then(r => r.data);

export const fetchMissions = () =>
  api.get<AgentMission[]>('/api/v1/missions').then(r => r.data);

export const approveMission = (id: number) =>
  api.patch<AgentMission>(`/api/v1/missions/${id}/approve`).then(r => r.data);

export const fetchArtifacts = (missionId: number) =>
  api.get<MissionArtifact[]>(`/api/v1/missions/${missionId}/artifacts`).then(r => r.data);

export const fetchProducts = () =>
  api.get<Product[]>('/api/v1/products').then(r => r.data);

// Analytics
export interface AnalyticsSnapshot {
  missions: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    avgApprovalTimeSeconds: number | null;
    avgCompletionTimeSeconds: number | null;
    successRate: number | null;
  };
  telemetry: {
    totalEvents: number;
    surgeEventsLast24h: number;
    lowStockEventsLast24h: number;
    avgOccupancy: number | null;
    avgShelfFill: number | null;
  };
}

export const fetchAnalytics = () =>
  api.get<AnalyticsSnapshot>('/api/v1/analytics').then(r => r.data);
