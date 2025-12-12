
import React, { useRef, useState, useCallback } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { VideoHUD } from './components/VideoHUD';
import { Terminal } from './components/Terminal';
import { StatusPanel } from './components/StatusPanel';
import { FileSystemInterface } from './components/FileSystemInterface';
import { LogEntry } from './types';
import { Power, ChevronRight, Hand, MousePointer2, X, FileText, Save, ZoomIn, Lock, MoveHorizontal, RotateCcw, ThumbsDown, ThumbsUp, Edit2, FolderOpen, Video, VideoOff, Disc3 } from 'lucide-react';
import { FILES_DB } from './constants';

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState(FILES_DB); // Local state for file DB to allow editing
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudContainerRef = useRef<HTMLDivElement>(null);

  // File Viewer State
  const [activeFile, setActiveFile] = useState<{id: string, name: string, content: string} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(14); // Font Size in PX
  const [isZoomLocked, setIsZoomLocked] = useState(false);

  // Rename File State
  const [renamingFile, setRenamingFile] = useState<{id: string, name: string} | null>(null);
  const [newFileName, setNewFileName] = useState('');

  // Video Display Mode: true = show video, false = show only hand tracking points
  const [showVideo, setShowVideo] = useState(true);

  // Number Mode State: German number gesture recognition
  const [isNumberMode, setIsNumberMode] = useState(false);
  const [recognizedNumber, setRecognizedNumber] = useState<number | null>(null);

  // Dial Mode State: Rotation dial for 1-100
  const [isDialMode, setIsDialMode] = useState(false);
  const [dialValue, setDialValue] = useState(1);
  const [dialAngle, setDialAngle] = useState(0); // Current rotation angle for visual
  const [dialLocked, setDialLocked] = useState(false); // Locked state when second hand opens
  const [dialLockTimer, setDialLockTimer] = useState<number | null>(null); // Lock countdown

  const handleLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  }, []);

  const { connect, disconnect, isConnected, gestures, landmarks } = useLiveSession({ 
    onLog: handleLog, 
    videoRef,
    canvasRef
  });

  const handleFileSystemAction = (action: string, detail?: string) => {
    if (action === 'OPEN_FILE' && detail) {
       try {
         const fileData = JSON.parse(detail);
         // Find current content from state in case it was edited
         const currentFile = files.find(f => f.id === fileData.id);
         setActiveFile({
             id: fileData.id,
             name: fileData.name,
             content: currentFile?.content || fileData.content
         });
         setZoomLevel(14); // Reset zoom on open
         setIsZoomLocked(false);
         handleLog(`Opened ${fileData.name}`, 'success');
       } catch (e) {
         handleLog(`Error opening file: ${e}`, 'error');
       }
    } else if (action === 'SAVE_FILE') {
        if (activeFile) {
            setIsSaving(true);
            setTimeout(() => {
                setFiles(prev => prev.map(f => 
                    f.id === activeFile.id ? { ...f, content: activeFile.content } : f
                ));
                handleLog(`Saved changes to ${activeFile.name}`, 'success');
                setIsSaving(false);
            }, 500);
        }
    } else if (action === 'CLOSE_FILE') {
        setActiveFile(null);
        handleLog('File viewer closed', 'warning');
    } else if (action === 'REVERT_FILE') {
        if (activeFile) {
            setIsReverting(true);
            const savedVersion = files.find(f => f.id === activeFile.id);
            if (savedVersion) {
                setTimeout(() => {
                    setActiveFile({ ...activeFile, content: savedVersion.content });
                    handleLog(`Reverted changes to ${activeFile.name}`, 'warning');
                    setIsReverting(false);
                }, 500);
            }
        }
    } else if (action === 'ZOOM_FILE' && detail) {
        const size = parseInt(detail);
        setZoomLevel(size);
    } else if (action === 'ZOOM_STATUS') {
        setIsZoomLocked(detail === 'LOCKED');
    } else if (action === 'NAVIGATE') {
        handleLog(`${action}: ${detail}`, 'cmd');
    } else if (action === 'CREATE_FILE' && detail) {
        // Create a new file in the current folder
        const parentId = detail === 'root' ? null : detail;
        const newFileId = `file_${Date.now()}`;
        const existingFiles = files.filter(f => f.parentId === parentId && f.name.startsWith('untitled'));
        const newFileNameStr = existingFiles.length === 0 ? 'untitled.txt' : `untitled_${existingFiles.length + 1}.txt`;

        const newFile = {
            id: newFileId,
            name: newFileNameStr,
            type: 'file' as const,
            parentId: parentId,
            content: '// New file created with gesture\n'
        };

        setFiles(prev => [...prev, newFile]);
        handleLog(`Created new file: ${newFileNameStr}`, 'success');

        // Automatically open the new file
        setActiveFile({
            id: newFileId,
            name: newFileNameStr,
            content: newFile.content
        });
        setZoomLevel(14);
        setIsZoomLocked(false);
    } else if (action === 'RENAME_FILE' && detail) {
        try {
            const fileData = JSON.parse(detail);
            setRenamingFile(fileData);
            setNewFileName(fileData.name);
            handleLog(`Renaming ${fileData.name}...`, 'info');
        } catch (e) {
            handleLog(`Error opening rename dialog: ${e}`, 'error');
        }
    } else if (action === 'RENAME_OPEN_FILE') {
        // Rename the currently open file
        if (activeFile) {
            setRenamingFile({ id: activeFile.id, name: activeFile.name });
            setNewFileName(activeFile.name);
            handleLog(`Renaming ${activeFile.name}...`, 'info');
        }
    } else if (action === 'CONFIRM_RENAME') {
        if (renamingFile && newFileName.trim()) {
            setFiles(prev => prev.map(f =>
                f.id === renamingFile.id ? { ...f, name: newFileName.trim() } : f
            ));
            // Also update activeFile name if it's the one being renamed
            if (activeFile && activeFile.id === renamingFile.id) {
                setActiveFile({ ...activeFile, name: newFileName.trim() });
            }
            handleLog(`Renamed to ${newFileName.trim()}`, 'success');
        }
        setRenamingFile(null);
        setNewFileName('');
    } else if (action === 'CANCEL_RENAME') {
        setRenamingFile(null);
        setNewFileName('');
        handleLog('Rename cancelled', 'warning');
    } else if (action === 'DELETE_FILE' && detail) {
        try {
            const fileData = JSON.parse(detail);
            const itemToDelete = files.find(f => f.id === fileData.id);

            if (itemToDelete?.type === 'folder') {
                // Recursively collect all descendant IDs
                const getDescendantIds = (parentId: string): string[] => {
                    const children = files.filter(f => f.parentId === parentId);
                    let ids: string[] = [];
                    for (const child of children) {
                        ids.push(child.id);
                        if (child.type === 'folder') {
                            ids = ids.concat(getDescendantIds(child.id));
                        }
                    }
                    return ids;
                };
                const idsToDelete = [fileData.id, ...getDescendantIds(fileData.id)];
                setFiles(prev => prev.filter(f => !idsToDelete.includes(f.id)));
                handleLog(`Deleted folder ${fileData.name} and its contents`, 'warning');

                // Close any open file that was inside the deleted folder
                if (activeFile && idsToDelete.includes(activeFile.id)) {
                    setActiveFile(null);
                }
            } else {
                setFiles(prev => prev.filter(f => f.id !== fileData.id));
                handleLog(`Deleted ${fileData.name}`, 'warning');
                // Close file if it was open
                if (activeFile?.id === fileData.id) {
                    setActiveFile(null);
                }
            }

            // Close rename modal if it was for the deleted item
            if (renamingFile?.id === fileData.id) {
                setRenamingFile(null);
                setNewFileName('');
            }
        } catch (e) {
            handleLog(`Error deleting file: ${e}`, 'error');
        }
    } else if (action === 'NUMBER_DETECTED' && detail) {
        const num = Number.parseInt(detail);
        if (num !== recognizedNumber) {
            setRecognizedNumber(num);
            handleLog(`Number detected: ${num}`, 'success');
        }
    } else if (action === 'DIAL_ROTATE' && detail) {
        const data = JSON.parse(detail);
        setDialValue(data.value);
        setDialAngle(data.angle);
    } else if (action === 'DIAL_LOCK') {
        if (!dialLocked) {
            setDialLocked(true);
            handleLog(`Dial locked at ${dialValue}`, 'success');
            // Start 3 second countdown
            let remaining = 3;
            setDialLockTimer(remaining);
            const interval = setInterval(() => {
                remaining -= 1;
                setDialLockTimer(remaining);
                if (remaining <= 0) {
                    clearInterval(interval);
                    setDialLocked(false);
                    setDialLockTimer(null);
                    handleLog('Dial unlocked', 'info');
                }
            }, 1000);
        }
    } else {
       handleLog(`${action}: ${detail}`, 'cmd');
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (activeFile) {
          setActiveFile({ ...activeFile, content: e.target.value });
      }
  };

  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
      setActiveFile(null);
    } else {
      connect();
    }
  };

  return (
    <div className="h-screen bg-black text-purple-50 p-4 lg:p-6 flex flex-col overflow-hidden relative selection:bg-purple-500/30 font-sans">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] bg-fuchsia-900/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="flex-none flex justify-between items-center mb-4 z-10 border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-1">
          <ChevronRight className="w-6 h-6 text-[#A100FF] stroke-[4px]" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              ACCENTURE <span className="text-[#A100FF]">SOFTWARE</span>
            </h1>
            <p className="text-[10px] text-neutral-400 tracking-[0.2em] uppercase font-mono">SPATIAL ORCHESTRATOR</p>
          </div>
        </div>
        
        <button
          onClick={toggleConnection}
          className={`
            flex items-center gap-2 px-6 py-2 rounded font-bold tracking-wide transition-all duration-300 text-sm
            ${isConnected 
              ? 'bg-neutral-900 text-red-400 border border-red-500/50 hover:bg-neutral-800' 
              : 'bg-[#A100FF] text-white hover:bg-[#8a00db] shadow-[0_0_15px_rgba(161,0,255,0.4)]'}
          `}
        >
          <Power className="w-4 h-4" />
          {isConnected ? 'TERMINATE' : 'INITIALIZE'}
        </button>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 z-10 min-h-0 overflow-hidden">
        
        {/* Left Column: Video & Instructions (9 cols) */}
        <div className="lg:col-span-9 flex flex-col gap-4 h-full min-h-0 relative">
          
          {/* Main HUD Container - Holds Video + Spatial UI */}
          <div ref={hudContainerRef} className="relative w-full flex-1 min-h-0 bg-black rounded-xl overflow-hidden border border-purple-900/50">
             <div className="absolute inset-0">
                <VideoHUD
                videoRef={videoRef}
                canvasRef={canvasRef}
                isConnected={isConnected}
                gestureName={gestures.join(' + ')}
                showVideo={showVideo}
                />
             </div>
             
             {/* Spatial File System Overlay */}
             {isConnected && (
               <FileSystemInterface
                 landmarks={landmarks}
                 gestures={gestures}
                 containerRef={hudContainerRef}
                 onAction={handleFileSystemAction}
                 isFileOpen={!!activeFile}
                 isRenaming={!!renamingFile}
                 files={files}
                 isNumberMode={isNumberMode}
                 isDialMode={isDialMode}
                 dialLocked={dialLocked}
               />
             )}

             {/* Video Toggle Button - Bottom right */}
             {isConnected && (
               <button
                 onClick={() => setShowVideo(prev => !prev)}
                 className={`
                   absolute bottom-4 right-4 z-[80] flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300
                   ${showVideo
                     ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300 hover:bg-purple-500/40'
                     : 'bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/40'}
                 `}
                 title={showVideo ? 'Hide camera video' : 'Show camera video'}
               >
                 {showVideo ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                 <span className="text-xs font-mono tracking-wider">
                   {showVideo ? 'HIDE FACE' : 'SHOW FACE'}
                 </span>
               </button>
             )}

             {/* NUMBER MODE OVERLAY */}
             {isNumberMode && (
               <div className="absolute inset-0 z-[90] pointer-events-none">
                 {/* Left Side Number Display */}
                 <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center">
                   {/* Mode Indicator */}
                   <div className="bg-amber-500/90 text-black px-4 py-1.5 rounded-full font-bold text-xs tracking-wider animate-pulse mb-4">
                     NUMBER MODE (0-10)
                   </div>

                   {/* Number Display */}
                   <div className={`
                     text-[120px] font-bold leading-none transition-all duration-200
                     ${recognizedNumber !== null && recognizedNumber > 0 ? 'text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]' : 'text-neutral-500'}
                   `}>
                     {recognizedNumber !== null ? recognizedNumber : 0}
                   </div>

                   {/* Status Text */}
                   <div className="text-neutral-400 text-sm mt-2 font-mono">
                     {recognizedNumber !== null && recognizedNumber > 0 ? `Both hands sum` : 'Show gesture(s)'}
                   </div>
                 </div>
               </div>
             )}

             {/* DIAL MODE OVERLAY */}
             {isDialMode && (
               <div className="absolute inset-0 z-[90] pointer-events-none flex items-center justify-center">
                 {/* Vertical Volume Bar - Far Left */}
                 <div className="absolute left-8 top-1/2 -translate-y-1/2 w-8 h-72 rounded-full bg-neutral-800/80 border border-neutral-600 overflow-hidden">
                   {/* Gradient fill based on value */}
                   <div
                     className="absolute bottom-0 left-0 right-0 transition-all duration-150 rounded-b-full"
                     style={{
                       height: `${dialValue}%`,
                       background: `linear-gradient(to top,
                         #ef4444 0%,
                         #f97316 20%,
                         #eab308 40%,
                         #84cc16 60%,
                         #22c55e 80%,
                         #10b981 100%)`
                     }}
                   />
                   {/* Scale marks */}
                   {[0, 25, 50, 75, 100].map((mark) => (
                     <div
                       key={mark}
                       className="absolute left-0 right-0 h-px bg-white/30"
                       style={{ bottom: `${mark}%` }}
                     />
                   ))}
                   {/* Glow effect when locked */}
                   {dialLocked && (
                     <div className="absolute inset-0 bg-amber-500/20 animate-pulse" />
                   )}
                 </div>

                 {/* Radio Dial Interface */}
                 <div className="flex flex-col items-center">
                   {/* Mode Indicator */}
                   <div className="bg-emerald-500/90 text-black px-4 py-1.5 rounded-full font-bold text-xs tracking-wider animate-pulse mb-6">
                     DIAL MODE (1-100)
                   </div>

                   {/* Dial Container */}
                   <div className="relative w-72 h-72">
                     {/* Outer Ring with tick marks */}
                     <svg className="absolute inset-0 w-full h-full" viewBox="0 0 288 288">
                       {/* Background circle */}
                       <circle cx="144" cy="144" r="140" fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="4" />

                       {/* Tick marks - major every 10 */}
                       {Array.from({ length: 100 }, (_, i) => {
                         const angle = (i / 100) * 360 - 90;
                         const rad = (angle * Math.PI) / 180;
                         const isMajor = i % 10 === 0;
                         const innerR = isMajor ? 118 : 125;
                         const outerR = 135;
                         const x1 = 144 + innerR * Math.cos(rad);
                         const y1 = 144 + innerR * Math.sin(rad);
                         const x2 = 144 + outerR * Math.cos(rad);
                         const y2 = 144 + outerR * Math.sin(rad);
                         return (
                           <line
                             key={i}
                             x1={x1} y1={y1} x2={x2} y2={y2}
                             stroke={i < dialValue ? '#10b981' : 'rgba(255,255,255,0.2)'}
                             strokeWidth={isMajor ? 3 : 1}
                           />
                         );
                       })}

                       {/* Number labels */}
                       {[0, 25, 50, 75, 100].map((num) => {
                         const angle = (num / 100) * 360 - 90;
                         const rad = (angle * Math.PI) / 180;
                         const r = 100;
                         const x = 144 + r * Math.cos(rad);
                         const y = 144 + r * Math.sin(rad);
                         return (
                           <text
                             key={num}
                             x={x} y={y}
                             fill={dialValue >= num ? '#10b981' : 'rgba(255,255,255,0.4)'}
                             fontSize="12"
                             fontFamily="monospace"
                             textAnchor="middle"
                             dominantBaseline="middle"
                           >
                             {num === 0 ? '1' : num}
                           </text>
                         );
                       })}
                     </svg>

                     {/* Rotating Knob */}
                     <div
                       className={`absolute inset-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border-4 transition-all duration-100 ${
                         dialLocked
                           ? 'border-amber-500 shadow-[0_0_40px_rgba(251,191,36,0.5)]'
                           : 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                       }`}
                       style={{ transform: `rotate(${dialAngle}deg)` }}
                     >
                       {/* Knob indicator line */}
                       <div className={`absolute top-4 left-1/2 -translate-x-1/2 w-1 h-8 rounded-full ${
                         dialLocked ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]' : 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                       }`} />

                       {/* Center cap */}
                       <div className="absolute inset-12 rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 border border-neutral-600 flex items-center justify-center">
                         <Disc3 className={`w-8 h-8 ${dialLocked ? 'text-amber-400/50' : 'text-emerald-400/50'}`} />
                       </div>
                     </div>

                     {/* Value Display */}
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <div className={`bg-black/80 px-6 py-3 rounded-lg border transition-colors ${
                         dialLocked ? 'border-amber-500/50' : 'border-emerald-500/30'
                       }`}>
                         <div className={`text-5xl font-bold font-mono tabular-nums ${
                           dialLocked ? 'text-amber-400' : 'text-emerald-400'
                         }`}>
                           {dialValue}
                         </div>
                       </div>
                     </div>

                     {/* Lock indicator */}
                     {dialLocked && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="absolute top-2 bg-amber-500 text-black px-4 py-1 rounded-full font-bold text-sm animate-pulse">
                           LOCKED {dialLockTimer !== null ? `(${dialLockTimer}s)` : ''}
                         </div>
                       </div>
                     )}
                   </div>

                 </div>
               </div>
             )}

             {/* CODE VIEWER MODAL */}
             {activeFile && (
               <div className="absolute inset-0 z-[60] flex items-center justify-center p-8 bg-black/5 backdrop-blur-sm animate-in zoom-in-95 duration-200">
                  <div className={`
                    w-full h-full max-w-4xl bg-neutral-900/10 backdrop-blur-md border rounded-lg shadow-2xl flex flex-col overflow-hidden transition-colors duration-300
                    ${isSaving ? 'border-green-500' : isReverting ? 'border-amber-500' : 'border-cyan-500/50'}
                  `}>
                     {/* Modal Header */}
                     <div className="h-10 flex-none bg-black/20 border-b border-cyan-900/20 flex items-center justify-between px-4">
                        <div className="flex items-center gap-2 text-cyan-400">
                           <FileText size={16} />
                           <span className="font-mono text-xs font-bold">{activeFile.name}</span>
                           <span className="text-[10px] text-neutral-400 ml-2 bg-neutral-800/40 px-1 rounded">EDITABLE</span>
                           <span className="text-[10px] text-purple-400 ml-2">ZOOM: {zoomLevel}px</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isSaving && <span className="text-green-500 text-xs font-bold animate-pulse">SAVING...</span>}
                            {isReverting && <span className="text-amber-500 text-xs font-bold animate-pulse">REVERTING...</span>}
                            <button 
                            onClick={() => setActiveFile(null)}
                            className="hover:bg-red-500/20 hover:text-red-400 p-1 rounded transition-colors"
                            >
                            <X size={16} />
                            </button>
                        </div>
                     </div>
                     
                     <textarea 
                        value={activeFile.content}
                        onChange={handleContentChange}
                        style={{ fontSize: `${zoomLevel}px`, lineHeight: '1.5', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
                        className="flex-1 w-full bg-transparent text-white font-mono p-4 resize-none focus:outline-none transition-all placeholder-neutral-600"
                        spellCheck={false}
                     />
                     
                     <div className="h-8 flex-none bg-black/20 border-t border-cyan-900/20 flex items-center justify-between px-4 text-[10px] text-neutral-400 font-mono">
                         <div className="flex items-center gap-4">
                             {isZoomLocked ? (
                                <div className="flex items-center gap-1 text-green-400 font-bold">
                                    <Lock size={10} />
                                    <span>ZOOM AUTO-LOCKED (2s)</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-cyan-400">
                                    <MoveHorizontal size={10} />
                                    <span>SPREAD TO ZOOM</span>
                                </div>
                            )}
                         </div>

                         <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-purple-400">
                                <Edit2 size={10} />
                                <span>POINT UP RENAME</span>
                            </div>
                            <div className="flex items-center gap-1 text-amber-500">
                                <ThumbsDown size={10} />
                                <span>THUMB DOWN REVERT</span>
                            </div>
                            <div className="flex items-center gap-1 text-cyan-400">
                                <ThumbsUp size={10} />
                                <span>THUMB UP SAVE</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-400">
                                <RotateCcw size={10} />
                                <span>FIST CLOSE</span>
                            </div>
                         </div>
                     </div>
                  </div>
               </div>
             )}

             {/* RENAME FILE MODAL */}
             {renamingFile && (
               <div className="absolute inset-0 z-[70] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm animate-in zoom-in-95 duration-200">
                  <div className="w-full max-w-md bg-neutral-900/95 backdrop-blur-md border border-amber-500/50 rounded-lg shadow-2xl flex flex-col overflow-hidden">
                     {/* Modal Header */}
                     <div className="h-12 flex-none bg-black/30 border-b border-amber-900/30 flex items-center justify-between px-4">
                        <div className="flex items-center gap-2 text-amber-400">
                           <Edit2 size={16} />
                           <span className="font-mono text-sm font-bold">RENAME FILE</span>
                        </div>
                        <button
                          onClick={() => { setRenamingFile(null); setNewFileName(''); handleLog('Rename cancelled', 'warning'); }}
                          className="hover:bg-red-500/20 hover:text-red-400 p-1 rounded transition-colors"
                        >
                          <X size={16} />
                        </button>
                     </div>

                     {/* Input Section */}
                     <div className="p-6 flex flex-col gap-4">
                        <div className="text-sm text-neutral-400">
                          Current name: <span className="text-white font-mono">{renamingFile.name}</span>
                        </div>
                        <input
                          type="text"
                          value={newFileName}
                          onChange={e => setNewFileName(e.target.value)}
                          className="w-full bg-black/50 border border-amber-500/30 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-colors"
                          placeholder="Enter new file name..."
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newFileName.trim()) {
                              handleFileSystemAction('CONFIRM_RENAME');
                            } else if (e.key === 'Escape') {
                              handleFileSystemAction('CANCEL_RENAME');
                            }
                          }}
                        />
                     </div>

                     {/* Footer with gesture hints */}
                     <div className="h-10 flex-none bg-black/30 border-t border-amber-900/30 flex items-center justify-between px-4 text-[10px] text-neutral-400 font-mono">
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-1 text-cyan-400">
                              <ThumbsUp size={10} />
                              <span>THUMB UP SAVE</span>
                           </div>
                           <div className="flex items-center gap-1 text-red-400">
                              <RotateCcw size={10} />
                              <span>FIST CANCEL</span>
                           </div>
                        </div>
                        <span className="text-neutral-500">or use keyboard: Enter / Esc</span>
                     </div>
                  </div>
               </div>
             )}
          </div>
          
          {/* Mode Switch Buttons */}
          <div className="flex-none flex items-center justify-center gap-2 h-12">
               {/* File System Mode Button */}
               <button
                 onClick={() => {
                   setIsNumberMode(false);
                   setIsDialMode(false);
                   setRecognizedNumber(null);
                   handleLog('Switched to File System mode', 'info');
                 }}
                 className={`
                   flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 text-[10px] font-medium tracking-wide
                   ${!isNumberMode && !isDialMode
                     ? 'bg-purple-500/20 border border-purple-400/80 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                     : 'bg-transparent border border-purple-500/20 text-purple-400/60 hover:border-purple-400/40 hover:text-purple-300 hover:bg-purple-500/10'}
                 `}
               >
                 <FolderOpen className="w-3.5 h-3.5" />
                 <span>FILE SYSTEM</span>
               </button>

               {/* Number Mode Button */}
               <button
                 onClick={() => {
                   setIsNumberMode(true);
                   setIsDialMode(false);
                   setRecognizedNumber(0);
                   handleLog('Switched to Number Mode', 'info');
                 }}
                 className={`
                   flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 text-[10px] font-medium tracking-wide
                   ${isNumberMode
                     ? 'bg-amber-500/20 border border-amber-400/80 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                     : 'bg-transparent border border-amber-500/20 text-amber-400/60 hover:border-amber-400/40 hover:text-amber-300 hover:bg-amber-500/10'}
                 `}
               >
                 <Hand className="w-3.5 h-3.5" />
                 <span>NUMBER</span>
               </button>

               {/* Dial Mode Button */}
               <button
                 onClick={() => {
                   setIsDialMode(true);
                   setIsNumberMode(false);
                   setDialValue(1);
                   setDialAngle(0);
                   handleLog('Switched to Dial Mode (1-100)', 'info');
                 }}
                 className={`
                   flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 text-[10px] font-medium tracking-wide
                   ${isDialMode
                     ? 'bg-emerald-500/20 border border-emerald-400/80 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                     : 'bg-transparent border border-emerald-500/20 text-emerald-400/60 hover:border-emerald-400/40 hover:text-emerald-300 hover:bg-emerald-500/10'}
                 `}
               >
                 <Disc3 className="w-3.5 h-3.5" />
                 <span>DIAL</span>
               </button>

          </div>
        </div>

        {/* Right Column: Status & Logs (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0 overflow-hidden">
           <div className="flex-none h-48">
             <StatusPanel />
           </div>
           <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
             <Terminal logs={logs} />
           </div>
        </div>

      </main>

      {/* Footer / Status Bar */}
      <footer className="flex-none mt-4 border-t border-neutral-800 pt-2 flex justify-between items-center text-[10px] font-mono text-neutral-500 z-10">
        <div>&copy; 2025 ACCENTURE. ALL RIGHTS RESERVED.</div>
        <div className="flex gap-4">
           <span>HIGH PERFORMANCE DELIVERED</span>
           <span className={isConnected ? "text-green-500" : "text-neutral-500"}>
             SYSTEM: {isConnected ? 'ONLINE' : 'OFFLINE'}
           </span>
        </div>
      </footer>
    </div>
  );
}
