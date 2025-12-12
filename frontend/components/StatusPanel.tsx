
import React from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, LineChart, Line } from 'recharts';

const cpuData = [
  { name: 'Node-1', usage: 45 },
  { name: 'Node-2', usage: 62 },
  { name: 'Node-3', usage: 28 },
  { name: 'Node-4', usage: 75 },
];

const trafficData = [
  { time: '10:00', req: 400 },
  { time: '10:05', req: 300 },
  { time: '10:10', req: 550 },
  { time: '10:15', req: 480 },
  { time: '10:20', req: 620 },
];

export const StatusPanel: React.FC = React.memo(() => {
  return (
    <div className="bg-black/90 backdrop-blur-md border border-purple-900/50 rounded-lg p-4 h-full flex flex-col gap-4 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
       <div className="border-b border-purple-900/30 pb-2 mb-2">
         <h3 className="text-white font-bold uppercase tracking-widest text-sm">&gt; CLUSTER METRICS</h3>
       </div>

       <div className="flex-1 min-h-[60px]">
         <div className="text-xs text-purple-400 mb-1 font-mono">CPU DISTRIBUTION</div>
         <ResponsiveContainer width="100%" height="100%">
           <BarChart data={cpuData}>
             <XAxis dataKey="name" hide />
             <Bar dataKey="usage" fill="#A100FF" radius={[0, 0, 0, 0]} />
           </BarChart>
         </ResponsiveContainer>
       </div>

       <div className="flex-1 min-h-[60px]">
         <div className="text-xs text-purple-400 mb-1 font-mono">THROUGHPUT (RPS)</div>
         <ResponsiveContainer width="100%" height="100%">
           <LineChart data={trafficData}>
             <Line type="monotone" dataKey="req" stroke="#d8b4fe" strokeWidth={3} dot={false} />
           </LineChart>
         </ResponsiveContainer>
       </div>

       <div className="mt-auto grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-purple-950/20 p-2 rounded border border-purple-900/30">
            <div className="text-purple-400">UPTIME</div>
            <div className="text-white text-lg">99.99%</div>
          </div>
          <div className="bg-purple-950/20 p-2 rounded border border-purple-900/30">
            <div className="text-purple-400">ERROR RATE</div>
            <div className="text-white text-lg">0.02%</div>
          </div>
       </div>
    </div>
  );
});
