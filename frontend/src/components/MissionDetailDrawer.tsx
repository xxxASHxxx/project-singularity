import React, { useState, useEffect } from 'react';
import { useMissionArtifacts } from '../hooks/usePolling';
import type { AgentMission, MissionArtifact } from '../api/client';
import StatusPill from './StatusPill';
import ReactMarkdown from 'react-markdown';

const TYPE_ICON: Record<string, string> = {
  SCREENSHOT: '🖼️',
  RECORDING_URL: '🎥',
  PLAN_MD: '📝',
  LOG: '📄',
};

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const sec = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function formatBytes(bytes?: number | null): string | null {
  if (bytes === null || bytes === undefined || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function MissionDetailDrawer({ mission, onClose }: { mission: AgentMission | null; onClose: () => void }) {
  const { data: artifacts = [] } = useMissionArtifacts(mission?.id, mission?.status);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedArtifactId, setCopiedArtifactId] = useState<number | null>(null);

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

  const handleCopySummary = async () => {
    const text = [
      `Project Singularity - Mission #${mission.id}`,
      `Type: ${mission.missionType}`,
      `Status: ${mission.status}`,
      `Trigger Event: #${mission.triggeredByEventId}`,
      `Created: ${new Date(mission.createdAt).toLocaleString()}`,
      mission.startedAt ? `Started: ${new Date(mission.startedAt).toLocaleString()}` : null,
      mission.completedAt ? `Completed: ${new Date(mission.completedAt).toLocaleString()}` : null,
      formatDuration(mission.startedAt, mission.completedAt) ? `Duration: ${formatDuration(mission.startedAt, mission.completedAt)}` : null,
      mission.summary ? `\nSummary:\n${mission.summary}` : null,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch (err) {
      console.warn('Failed to copy summary', err);
    }
  };

  const handleCopyArtifact = async (artifact: MissionArtifact) => {
    try {
      await navigator.clipboard.writeText(artifact.storagePath);
      setCopiedArtifactId(artifact.id);
      setTimeout(() => setCopiedArtifactId(null), 2000);
    } catch (err) {
      console.warn('Failed to copy artifact', err);
    }
  };

  const handleExportDossier = () => {
    const dossier = {
      mission,
      duration: formatDuration(mission.startedAt, mission.completedAt),
      artifacts,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(dossier, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `singularity-mission-${mission.id}-dossier.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportDossier}
              title="Download mission dossier JSON"
              className="px-2.5 py-1 text-xs font-mono rounded border transition-colors flex items-center gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderColor: '#262626',
                color: '#9CA3AF',
              }}
            >
              <span>↓</span>
              <span>Dossier</span>
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              title="Copy mission summary to clipboard"
              className="px-2.5 py-1 text-xs font-mono rounded border transition-colors flex items-center gap-1.5"
              style={{
                background: copiedSummary ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: copiedSummary ? 'rgba(34,197,94,0.4)' : '#262626',
                color: copiedSummary ? '#22C55E' : '#9CA3AF',
              }}
            >
              <span>{copiedSummary ? '✓' : '📋'}</span>
              <span>{copiedSummary ? 'Copied' : 'Copy Info'}</span>
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl p-1 leading-none">×</button>
          </div>
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
            {formatDuration(mission.startedAt, mission.completedAt) && (
              <div>
                <p className="text-gray-600 mb-0.5">Duration</p>
                <p className="text-gray-300">{formatDuration(mission.startedAt, mission.completedAt)}</p>
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
                        {formatBytes(artifact.fileSizeBytes) && (
                          <span className="text-xs font-mono text-gray-500">
                            ({formatBytes(artifact.fileSizeBytes)})
                          </span>
                        )}
                        <span className="text-xs text-gray-600 ml-auto">{new Date(artifact.createdAt).toLocaleTimeString()}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyArtifact(artifact)}
                          title="Copy artifact path"
                          className="text-xs text-gray-500 hover:text-gray-300 p-0.5 rounded transition-colors font-mono"
                        >
                          {copiedArtifactId === artifact.id ? (
                            <span className="text-green-500 text-[10px]">✓ copied</span>
                          ) : (
                            <span className="text-[11px]">⧉</span>
                          )}
                        </button>
                      </div>

                      {artifact.artifactType === 'PLAN_MD' ? (
                        <div className="text-xs text-gray-400 leading-relaxed prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{artifact.storagePath}</ReactMarkdown>
                        </div>
                      ) : artifact.artifactType === 'SCREENSHOT' ? (
                        artifact.storagePath.startsWith('http') || artifact.storagePath.startsWith('data:') ? (
                          <img src={artifact.storagePath} alt="Screenshot" className="max-w-full rounded border border-border" style={{ maxHeight: 180 }} />
                        ) : (
                          <p className="text-xs font-mono text-gray-400 break-all">{artifact.storagePath}</p>
                        )
                      ) : artifact.artifactType === 'RECORDING_URL' ? (
                        <div className="space-y-1.5">
                          {artifact.storagePath.startsWith('http://') || artifact.storagePath.startsWith('https://') ? (
                            <a
                              href={artifact.storagePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors"
                              style={{
                                background: 'rgba(255,138,0,0.1)',
                                borderColor: 'rgba(255,138,0,0.3)',
                                color: '#FF8A00',
                              }}
                            >
                              <span>▶</span>
                              <span>Open Recording</span>
                              <span className="text-[10px] text-gray-500">↗</span>
                            </a>
                          ) : (
                            <p className="text-xs font-mono text-gray-400 break-all">{artifact.storagePath}</p>
                          )}
                        </div>
                      ) : artifact.artifactType === 'LOG' ? (
                        <pre className="text-xs font-mono text-gray-300 bg-black/40 p-2.5 rounded border border-border overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                          {artifact.storagePath}
                        </pre>
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

        {/* Raw Payload Inspector */}
        <div className="p-5 border-t border-border">
          <details className="group">
            <summary className="text-xs font-mono text-gray-500 cursor-pointer hover:text-gray-300 transition-colors flex items-center justify-between select-none">
              <span>Raw Mission Payload</span>
              <span className="text-[10px] group-open:rotate-90 transition-transform">▸</span>
            </summary>
            <pre className="mt-3 text-[11px] font-mono text-gray-400 bg-black/60 p-3 rounded border border-border overflow-x-auto whitespace-pre">
              {JSON.stringify({ mission, artifacts }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

