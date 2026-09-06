import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchArtifacts } from '../api/client';
import type { AgentMission, MissionArtifact } from '../api/client';
import ReactMarkdown from 'react-markdown';

const TYPE_ICON: Record<string, string> = {
  SCREENSHOT: '🖼️',
  RECORDING_URL: '🎥',
  PLAN_MD: '📝',
  LOG: '📄',
};

function ArtifactCard({ artifact }: { artifact: MissionArtifact }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TYPE_ICON[artifact.artifactType] ?? '📁';

  return (
    <div className="panel p-3 mb-2" style={{ borderLeft: '2px solid #262626' }}>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-gray-400">{artifact.artifactType}</span>
            <span className="text-xs text-gray-600">mission #{artifact.missionId}</span>
          </div>
          <p className="text-xs font-mono text-gray-500 truncate">{artifact.storagePath}</p>
        </div>
        <span className="text-xs text-gray-600">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="mt-3 pl-7">
          {artifact.artifactType === 'PLAN_MD' ? (
            <div className="text-xs text-gray-400 leading-relaxed prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{artifact.storagePath}</ReactMarkdown>
            </div>
          ) : artifact.artifactType === 'SCREENSHOT' ? (
            <img src={artifact.storagePath} alt="Screenshot" className="max-w-full rounded border border-border" style={{ maxHeight: 200 }} />
          ) : artifact.artifactType === 'RECORDING_URL' ? (
            <a href={artifact.storagePath} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-accent hover:underline font-mono">
              ▶ Open Recording
            </a>
          ) : (
            <pre className="text-xs text-gray-500 overflow-auto max-h-32">{artifact.storagePath}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function MissionArtifactGroup({ mission }: { mission: AgentMission }) {
  const { data: artifacts = [] } = useQuery({
    queryKey: ['artifacts', mission.id],
    queryFn: () => fetchArtifacts(mission.id),
    refetchInterval: 5000,
    enabled: mission.status !== 'PENDING_APPROVAL',
  });

  if (artifacts.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500">Mission #{mission.id}</span>
        <span className="text-xs" style={{ color: mission.missionType === 'RESTOCK' ? '#FF3B30' : '#FF8A00' }}>{mission.missionType}</span>
      </div>
      {artifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)}
    </div>
  );
}

export default function AgentActivityFeed({ missions }: { missions: AgentMission[] }) {
  const activeMissions = missions.filter(m => m.status !== 'PENDING_APPROVAL');

  return (
    <div className="panel p-5">
      <p className="section-title">Agent Activity Feed</p>
      {activeMissions.length === 0 ? (
        <div className="text-center py-10">
          <svg className="mx-auto mb-3 radar-pulse" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <p className="font-mono text-sm text-gray-600 mb-1">No agent activity yet</p>
          <p className="text-xs text-gray-700">Approve a mission to activate agents</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {activeMissions.map(m => <MissionArtifactGroup key={m.id} mission={m} />)}
        </div>
      )}
    </div>
  );
}
