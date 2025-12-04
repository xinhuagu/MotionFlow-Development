
import React from 'react';
import { LogEntry } from '../types';

interface TerminalProps {
  logs: LogEntry[];
}

export const Terminal: React.FC<TerminalProps> = React.memo(({ logs }) => {
  // Create a reversed copy for display so newest logs appear at the top
  const displayLogs = [...logs].reverse();

  return (
    <div className="bg-black/90 backdrop-blur-md border border-purple-900/50 rounded-lg p-4 h-full flex flex-col font-mono text-sm shadow-[0_0_20px_rgba(168,85,247,0.1)] overflow-hidden">
      <div className="flex-none flex items-center justify-between mb-2 border-b border-purple-900/30 pb-2">
        <span className="text-purple-400 font-bold tracking-widest uppercase">System Logs</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
          <div className="w-2 h-2 rounded-full bg-purple-800"></div>
          <div className="w-2 h-2 rounded-full bg-purple-900"></div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent">
        {displayLogs.length === 0 && (
          <div className="text-purple-800 italic">Waiting for uplink...</div>
        )}
        {displayLogs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="text-purple-700 shrink-0">[{log.timestamp}]</span>
            <span className={`${
              log.type === 'error' ? 'text-red-500 font-bold' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'cmd' ? 'text-white font-bold' :
              log.type === 'warning' ? 'text-orange-400' :
              'text-purple-300'
            }`}>
              {log.type === 'cmd' && '> '}
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
