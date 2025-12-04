
import React, { useRef, useState, useCallback } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { VideoHUD } from './components/VideoHUD';
import { Terminal } from './components/Terminal';
import { StatusPanel } from './components/StatusPanel';
import { FileSystemInterface } from './components/FileSystemInterface';
import { LogEntry } from './types';
import { Power, ChevronRight, Hand, MousePointer2, X, FileText, Save, ZoomIn, Lock, MoveHorizontal, RotateCcw, ThumbsDown, ThumbsUp, Edit2 } from 'lucide-react';
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
            setFiles(prev => prev.filter(f => f.id !== fileData.id));
            handleLog(`Deleted ${fileData.name}`, 'warning');
            // Close file if it was open
            if (activeFile?.id === fileData.id) {
                setActiveFile(null);
            }
            // Close rename modal if it was for this file
            if (renamingFile?.id === fileData.id) {
                setRenamingFile(null);
                setNewFileName('');
            }
        } catch (e) {
            handleLog(`Error deleting file: ${e}`, 'error');
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
               />
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
          
          {/* Gesture Control Legend */}
          <div className="flex-none grid grid-cols-2 md:grid-cols-5 gap-4 h-20">
               <div className="bg-neutral-900/50 border border-purple-500/30 px-3 rounded flex items-center gap-2">
                  <div className="bg-purple-500/20 p-1.5 rounded text-purple-400"><MousePointer2 size={14} /></div>
                  <div>
                    <div className="text-[10px] font-bold text-white">NAVIGATE</div>
                    <div className="text-[9px] text-neutral-400">Pinch & Hold</div>
                  </div>
               </div>

               <div className="bg-neutral-900/50 border border-purple-500/30 px-3 rounded flex items-center gap-2">
                  <div className="bg-purple-500/20 p-1.5 rounded text-purple-400"><Hand size={14} /></div>
                  <div>
                    <div className="text-[10px] font-bold text-white">DRAG</div>
                    <div className="text-[9px] text-neutral-400">Pinch & Move</div>
                  </div>
               </div>

               <div className="bg-neutral-900/50 border border-cyan-500/30 px-3 rounded flex items-center gap-2">
                  <div className="bg-cyan-500/20 p-1.5 rounded text-cyan-400"><FileText size={14} /></div>
                  <div>
                    <div className="text-[10px] font-bold text-white">OPEN</div>
                    <div className="text-[9px] text-neutral-400">Drag + Hand 2 Palm</div>
                  </div>
               </div>

               <div className="bg-neutral-900/50 border border-cyan-500/30 px-3 rounded flex items-center gap-2">
                  <div className="bg-cyan-500/20 p-1.5 rounded text-cyan-400"><Save size={14} /></div>
                  <div>
                    <div className="text-[10px] font-bold text-white">SAVE</div>
                    <div className="text-[9px] text-neutral-400">Thumb Up (Hold)</div>
                  </div>
               </div>

               <div className="bg-neutral-900/50 border border-amber-500/30 px-3 rounded flex items-center gap-2">
                  <div className="bg-amber-500/20 p-1.5 rounded text-amber-400"><RotateCcw size={14} /></div>
                  <div>
                    <div className="text-[10px] font-bold text-white">REVERT</div>
                    <div className="text-[9px] text-neutral-400">Thumb Down (Hold)</div>
                  </div>
               </div>
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
