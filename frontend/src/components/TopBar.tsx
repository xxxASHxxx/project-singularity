import React, { useState, useEffect } from 'react';

export default function TopBar({ apiOk }: { apiOk: boolean }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="border-b border-border bg-panel px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-accent" style={{ boxShadow: '0 0 8px #FF3B30' }} />
          <span className="font-mono text-sm font-semibold tracking-widest uppercase text-red-accent">Project Singularity</span>
        </div>
        <span className="text-border">|</span>
        <span className="text-xs text-gray-500 uppercase tracking-widest">Command Center</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${apiOk ? 'bg-green-accent' : 'bg-red-accent'}`}
               style={{ boxShadow: apiOk ? '0 0 6px #22C55E' : '0 0 6px #FF3B30' }} />
          <span className="text-xs font-mono text-gray-500">{apiOk ? 'API ONLINE' : 'API OFFLINE'}</span>
        </div>
        <span className="font-mono text-xs text-gray-500">{time.toLocaleTimeString('en-US', { hour12: false })}</span>
      </div>
    </div>
  );
}
