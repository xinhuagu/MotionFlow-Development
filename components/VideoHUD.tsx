import React from 'react';
import { Scan, Fingerprint, Activity } from 'lucide-react';

interface VideoHUDProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isConnected: boolean;
  gestureName?: string;
}

export const VideoHUD: React.FC<VideoHUDProps> = ({ videoRef, canvasRef, isConnected, gestureName }) => {
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-purple-900/50 shadow-[0_0_30px_rgba(168,85,247,0.15)] group">
      {/* Video Element - Mirrored */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-80 scale-x-[-1]"
        autoPlay
        playsInline
        muted
      />
      
      {/* MediaPipe Canvas Overlay - Mirrored */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* HUD Corners */}
      <div className="absolute top-4 left-4 w-12 h-12 border-l-4 border-t-4 border-purple-500/80 rounded-tl-sm"></div>
      <div className="absolute top-4 right-4 w-12 h-12 border-r-4 border-t-4 border-purple-500/80 rounded-tr-sm"></div>
      <div className="absolute bottom-4 left-4 w-12 h-12 border-l-4 border-b-4 border-purple-500/80 rounded-bl-sm"></div>
      <div className="absolute bottom-4 right-4 w-12 h-12 border-r-4 border-b-4 border-purple-500/80 rounded-br-sm"></div>

      {/* Status Badges */}
      <div className="absolute top-6 left-8 flex flex-col gap-2 pointer-events-none">
         <div className="flex items-center gap-2 bg-black/80 px-3 py-1 rounded border-l-2 border-purple-500 text-xs text-white tracking-wider">
            <Activity className="w-3 h-3 text-purple-400" />
            <span>OPTICAL SENSORS: {isConnected ? 'ONLINE' : 'OFFLINE'}</span>
         </div>
         <div className="flex items-center gap-2 bg-black/80 px-3 py-1 rounded border-l-2 border-purple-500 text-xs text-white tracking-wider">
            <Fingerprint className="w-3 h-3 text-purple-400" />
            <span>RECOGNITION: {isConnected ? 'ACTIVE' : 'STANDBY'}</span>
         </div>
      </div>
      
      {/* Detected Gesture Alert */}
      {gestureName && isConnected && (
        <div className="absolute top-6 right-8 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 bg-purple-950/90 px-6 py-3 rounded border border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
             <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping" />
             <span className="text-white font-mono font-bold tracking-widest text-lg">
               &gt; {gestureName} DETECTED
             </span>
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-10">
          <div className="text-purple-400 font-mono text-xl animate-pulse flex flex-col items-center gap-2">
            <Scan className="w-12 h-12" />
            <span>AWAITING CONNECTION</span>
          </div>
        </div>
      )}
    </div>
  );
};