import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchArtifacts } from '../api/client';
import type { AgentMission } from '../api/client';
import StatusPill from './StatusPill';
import ReactMarkdown from 'react-markdown';

const TYPE_ICON: Record<string, string> = {
  SCREENSHOT: '🖼️',
  RECORDING_URL: '🎥',
  PLAN_MD: '📝',
  LOG: '📄',
};

export default function MissionDetailDrawer({ mission, onClose }: { mission: AgentMission | null; onClose: () => void }) {
  const { data: artifacts = [] } = useQuery({
    queryKey: ['artifacts', mission?.id],
    queryFn: () => fetchArtifacts(mission!.id),
    enabled: mission !== null && mission.status !== 'PENDING_APPROVAL',
    refetchInterval: 4000,
  });

  // Close on Escape key
  useEffect(() => {
    if (!mission) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mission, onClose]);

  if (!mission) return null;

  return (
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full overflow-y-auto drawer-animate"
        style={{ width: 480, background: '#141416', borderLeft: '1px solid #262626' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0" style={{ background: '#141416', zIndex: 10 }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-bold">Mission #{mission.id}</span>
              <StatusPill status={mission.status} />
            </div>
            <span className="text-xs font-semibold" style={{ color: mission.missionType === 'RESTOCK' ? '#FF3B30' : '#FF8A00' }}>
              {mission.missionType} MISSION
            </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl">×</button>
        </div>

        {/* Meta */}
        <div className="p-5 border-b border-border">
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <p className="text-gray-600 mb-0.5">Triggered By</p>
              <p className="text-gray-300">Event #{mission.triggeredByEventId}</p>
            </div>
            <div>
              <p className="text-gray-600 mb-0.5">Created</p>
              <p className="text-gray-300">{new Date(mission.createdAt).toLocaleTimeString()}</p>
            </div>
            {mission.startedAt && (
              <div>
                <p className="text-gray-600 mb-0.5">Started</p>
                <p className="text-gray-300">{new Date(mission.startedAt).toLocaleTimeString()}</p>
              </div>
            )}
            {mission.completedAt && (
              <div>
                <p className="text-gray-600 mb-0.5">Completed</p>
                <p className="text-gray-300">{new Date(mission.completedAt).toLocaleTimeString()}</p>
              </div>
            )}
          </div>
          {mission.summary && (
            <div className="mt-3">
              <p className="text-xs text-gray-600 mb-1">Summary</p>
              <p className="text-xs text-gray-400 leading-relaxed">{mission.summary}</p>
            </div>
          )}
        </div>

        {/* Artifact Timeline */}
        <div className="p-5">
          <p className="section-title">Artifact Trail</p>
          {artifacts.length === 0 ? (
            <div className="text-center text-gray-600 py-8 font-mono text-sm">
              {mission.status === 'PENDING_APPROVAL' ? 'Awaiting approval...' : 'No artifacts yet'}
            </div>
          ) : (
            <div className="space-y-4">
              {artifacts.map((artifact, idx) => (
                <div key={artifact.id} className="relative">
                  {idx < artifacts.length - 1 && (
                    <div className="absolute left-3 top-8 bottom-0 w-px" style={{ background: '#262626' }} />
                  )}
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-1" style={{ background: '#262626' }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 panel p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{TYPE_ICON[artifact.artifactType] ?? '📁'}</span>
                        <span className="text-xs font-mono text-gray-400">{artifact.artifactType}</span>
                        <span className="text-xs text-gray-600 ml-auto">{new Date(artifact.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {artifact.artifactType === 'PLAN_MD' ? (
                        <div className="text-xs text-gray-400 leading-relaxed">
                          <ReactMarkdown>{artifact.storagePath}</ReactMarkdown>
                        </div>
                      ) : artifact.artifactType === 'SCREENSHOT' ? (
                        <img src={artifact.storagePath} alt="Screenshot" className="max-w-full rounded" style={{ maxHeight: 180 }} />
                      ) : (
                        <p className="text-xs font-mono text-gray-500 break-all">{artifact.storagePath}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
