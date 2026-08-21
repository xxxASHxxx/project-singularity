import React from 'react';

const STATUS_CONFIG: Record<string, { cls: string; dot: string; label: string }> = {
  PENDING_APPROVAL: { cls: 'status-pending', dot: '●', label: 'PENDING' },
  APPROVED:         { cls: 'status-approved', dot: '●', label: 'APPROVED' },
  RUNNING:          { cls: 'status-running',  dot: '◉', label: 'RUNNING' },
  COMPLETED:        { cls: 'status-completed', dot: '✓', label: 'DONE' },
  FAILED:           { cls: 'status-failed',   dot: '✕', label: 'FAILED' },
};

export default function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { cls: 'status-approved', dot: '●', label: status };
  return (
    <span className={`status-pill ${cfg.cls}`}>
      <span>{cfg.dot}</span>
      <span>{cfg.label}</span>
    </span>
  );
}
