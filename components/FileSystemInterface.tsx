
import React, { useEffect, useState, useRef } from 'react';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FileCode, Folder, Server, CornerLeftUp, Hand, FilePlus } from 'lucide-react';
import { FILES_DB } from '../constants';

interface FileSystemInterfaceProps {
  landmarks: NormalizedLandmark[][] | null;
  gestures: string[];
  containerRef: React.RefObject<HTMLDivElement>;
  onAction?: (action: string, detail?: string) => void;
  isFileOpen: boolean;
}

export const FileSystemInterface: React.FC<FileSystemInterfaceProps> = ({ landmarks, gestures, containerRef, onAction, isFileOpen }) => {
  const [currentPath, setCurrentPath] = useState<string[]>([]); // Stack of folder IDs
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activationProgress, setActivationProgress] = useState(0); // 0 to 100
  
  // File Action Progress States
  const [closeProgress, setCloseProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [revertProgress, setRevertProgress] = useState(0);
  const [createFileProgress, setCreateFileProgress] = useState(0);
  const [fingerTouchPos, setFingerTouchPos] = useState<{x: number, y: number} | null>(null);
  
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [floatingFile, setFloatingFile] = useState<{id: string, x: number, y: number, scale: number} | null>(null);
  const [actionStatus, setActionStatus] = useState<'idle' | 'ready' | 'executing'>('idle');

  // Logic State
  const stateRef = useRef({
    cursorX: 0,
    cursorY: 0,
    activationStartTime: 0,
    closeStartTime: 0,
    saveStartTime: 0,
    revertStartTime: 0,
    triggerStartTime: 0,
    createFileStartTime: 0,
    lastHoverId: null as string | null,
    // Drag Hysteresis State
    pinchStartX: 0,
    pinchStartY: 0,
    wasPinching: false,
    potentialTargetId: null as string | null,
    triggerDebounceTime: 0,
    // Zoom State
    lastRawZoomDist: 0,
    smoothedZoomDist: 0,
    zoomStableStart: 0,
    isZoomLocked: false,
    dropCooldownUntil: 0,
  });

  const getDistance = (p1: NormalizedLandmark, p2: NormalizedLandmark) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  // Filter files for current view
  const currentFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
  const visibleFiles = FILES_DB.filter(f => f.parentId === currentFolderId);

  useEffect(() => {
    if (!landmarks || landmarks.length === 0 || !containerRef.current) return;
    const now = Date.now();

    // --- 0. FILE INTERACTION LOGIC (When Open) ---
    if (isFileOpen) {
        
        // 1. SAVE ACTION (Thumb_Up)
        const isThumbUp = gestures.includes('Thumb_Up');
        if (isThumbUp) {
            if (stateRef.current.saveStartTime === 0) {
                stateRef.current.saveStartTime = now;
            }
            const elapsed = now - stateRef.current.saveStartTime;
            const progress = Math.min(100, (elapsed / 1000) * 100); // 1s hold
            setSaveProgress(progress);

            if (progress >= 100) {
                onAction?.("SAVE_FILE");
                setSaveProgress(0);
                stateRef.current.saveStartTime = now + 2000; // Cooldown
            }
        } else {
            setSaveProgress(0);
            stateRef.current.saveStartTime = 0;
        }

        // 2. CLOSE ACTION (Closed_Fist)
        const isFist = gestures.includes('Closed_Fist');
        if (isFist) {
            if (stateRef.current.closeStartTime === 0) {
                stateRef.current.closeStartTime = now;
            }
            const elapsed = now - stateRef.current.closeStartTime;
            const progress = Math.min(100, (elapsed / 1000) * 100); // 1s hold
            setCloseProgress(progress);

            if (progress >= 100) {
                onAction?.("CLOSE_FILE");
                setCloseProgress(0);
                stateRef.current.closeStartTime = now + 2000; // Cooldown
            }
        } else {
            setCloseProgress(0);
            stateRef.current.closeStartTime = 0;
        }

        // 3. REVERT ACTION (Thumb_Down)
        const isThumbDown = gestures.includes('Thumb_Down');
        if (isThumbDown) {
            if (stateRef.current.revertStartTime === 0) {
                 stateRef.current.revertStartTime = now;
            }
            const elapsed = now - stateRef.current.revertStartTime;
            const progress = Math.min(100, (elapsed / 1000) * 100); // 1s hold
            setRevertProgress(progress);

            if (progress >= 100) {
                onAction?.("REVERT_FILE");
                setRevertProgress(0);
                stateRef.current.revertStartTime = now + 2000; // Cooldown
            }
        } else {
            setRevertProgress(0);
            stateRef.current.revertStartTime = 0;
        }

        // 4. ZOOM LOGIC
        // If we are locked, skip all zoom calculations
        if (stateRef.current.isZoomLocked) {
             return; 
        }

        if (landmarks.length >= 2) {
            const leftIdx = landmarks[0][8];
            const rightIdx = landmarks[1][8];
            // Raw distance
            const rawDist = getDistance(leftIdx, rightIdx);
            
            // Initialization
            if (stateRef.current.lastRawZoomDist === 0) {
                stateRef.current.lastRawZoomDist = rawDist;
                stateRef.current.smoothedZoomDist = rawDist;
            }

            // VELOCITY CHECK (Drop Protection)
            const velocity = Math.abs(rawDist - stateRef.current.lastRawZoomDist);
            const DROP_VELOCITY_THRESHOLD = 0.08; 
            
            if (velocity > DROP_VELOCITY_THRESHOLD) {
                stateRef.current.dropCooldownUntil = now + 1000;
                stateRef.current.lastRawZoomDist = rawDist;
                return;
            }

            if (now < stateRef.current.dropCooldownUntil) {
                stateRef.current.lastRawZoomDist = rawDist;
                return;
            }

            // SMOOTHING
            const SMOOTH_FACTOR = 0.2; 
            stateRef.current.smoothedZoomDist = 
                (stateRef.current.smoothedZoomDist * (1 - SMOOTH_FACTOR)) + 
                (rawDist * SMOOTH_FACTOR);

            const dist = stateRef.current.smoothedZoomDist;

            // Stability Check for Lock (2s hold)
            if (velocity < 0.005) {
                if (stateRef.current.zoomStableStart === 0) {
                    stateRef.current.zoomStableStart = now;
                } else {
                    const stableDuration = now - stateRef.current.zoomStableStart;
                    if (stableDuration > 2000) { // 2.0 Seconds -> HARD LOCK
                        stateRef.current.isZoomLocked = true;
                        onAction?.("ZOOM_STATUS", "LOCKED");
                        // Hard lock for 2 seconds, then auto-release
                        setTimeout(() => {
                            stateRef.current.isZoomLocked = false;
                            stateRef.current.zoomStableStart = 0;
                            stateRef.current.lastRawZoomDist = 0; // Reset tracking
                            onAction?.("ZOOM_STATUS", "UNLOCKED");
                        }, 2000);
                    }
                }
            } else {
                stateRef.current.zoomStableStart = 0;
            }

            stateRef.current.lastRawZoomDist = dist;

            // Map Distance to Pixel Font Size
            const minInput = 0.05;
            const maxInput = 0.5;
            const minPx = 12;
            const maxPx = 36;
            
            const normalized = Math.min(Math.max((dist - minInput) / (maxInput - minInput), 0), 1);
            const sizePx = minPx + (normalized * (maxPx - minPx));
            
            onAction?.("ZOOM_FILE", sizePx.toFixed(0));
        } else {
            stateRef.current.lastRawZoomDist = 0;
            stateRef.current.zoomStableStart = 0;
        }

        return; // Skip file system interactions while file is open
    }

    // --- 1. TRACK CURSOR (Primary Hand) ---
    const primaryHand = landmarks[0];
    const rect = containerRef.current.getBoundingClientRect();
    
    // Map Coords (Mirror Mode: x = 1 - x)
    const indexTip = primaryHand[8];
    const thumbTip = primaryHand[4];
    
    const targetX = (1 - indexTip.x) * rect.width;
    const targetY = indexTip.y * rect.height;

    // Smoothing
    stateRef.current.cursorX = stateRef.current.cursorX + (targetX - stateRef.current.cursorX) * 0.10;
    stateRef.current.cursorY = stateRef.current.cursorY + (targetY - stateRef.current.cursorY) * 0.10;

    const cursorX = stateRef.current.cursorX;
    const cursorY = stateRef.current.cursorY;

    // --- 1.5 TWO-FINGER TOUCH DETECTION (Create New File) ---
    if (landmarks.length >= 2 && !floatingFile) {
      const hand1IndexTip = landmarks[0][8];
      const hand2IndexTip = landmarks[1][8];
      const fingerDistance = getDistance(hand1IndexTip, hand2IndexTip);
      const TOUCH_THRESHOLD = 0.05;

      if (fingerDistance < TOUCH_THRESHOLD) {
        // Calculate touch position (midpoint between two fingers)
        const touchX = ((1 - hand1IndexTip.x) + (1 - hand2IndexTip.x)) / 2 * rect.width;
        const touchY = (hand1IndexTip.y + hand2IndexTip.y) / 2 * rect.height;
        setFingerTouchPos({ x: touchX, y: touchY });

        if (stateRef.current.createFileStartTime === 0) {
          stateRef.current.createFileStartTime = now;
        }

        const elapsed = now - stateRef.current.createFileStartTime;
        const progress = Math.min(100, (elapsed / 1000) * 100); // 1s hold
        setCreateFileProgress(progress);

        if (progress >= 100) {
          // Trigger create file action with current folder ID
          onAction?.("CREATE_FILE", currentFolderId || 'root');
          setCreateFileProgress(0);
          setFingerTouchPos(null);
          stateRef.current.createFileStartTime = now + 2000; // Cooldown
        }
      } else {
        setCreateFileProgress(0);
        setFingerTouchPos(null);
        stateRef.current.createFileStartTime = 0;
      }
    } else {
      setCreateFileProgress(0);
      setFingerTouchPos(null);
      stateRef.current.createFileStartTime = 0;
    }

    // --- 2. HIT TEST ---
    let hitId: string | null = null;
    
    // Check Sidebar Area
    if (cursorX < 280) { 
        const headerHeight = 60;
        const itemHeight = 56;
        
        if (currentPath.length > 0 && cursorY > 0 && cursorY < headerHeight) {
            hitId = 'BACK_BUTTON';
        } else {
            const listY = cursorY - headerHeight;
            if (listY > 0) {
                const index = Math.floor(listY / itemHeight);
                if (index >= 0 && index < visibleFiles.length) {
                    hitId = visibleFiles[index].id;
                }
            }
        }
    }
    setHoveredId(hitId);

    // --- 3. GESTURE DETECTION ---
    const primaryPinchDist = getDistance(indexTip, thumbTip);
    const PINCH_GRAB_THRESHOLD = 0.05;
    const PINCH_DROP_THRESHOLD = 0.10;
    
    let isPrimaryPinching = stateRef.current.wasPinching; 
    
    if (stateRef.current.wasPinching) {
         if (primaryPinchDist > PINCH_DROP_THRESHOLD) isPrimaryPinching = false;
    } else {
         if (primaryPinchDist < PINCH_GRAB_THRESHOLD) isPrimaryPinching = true;
    }

    if (isPrimaryPinching && !stateRef.current.wasPinching) {
        stateRef.current.pinchStartX = cursorX;
        stateRef.current.pinchStartY = cursorY;
        stateRef.current.potentialTargetId = hitId;
    } else if (!isPrimaryPinching && stateRef.current.wasPinching) {
        stateRef.current.potentialTargetId = null;
    }
    stateRef.current.wasPinching = isPrimaryPinching;


    // Detect Secondary Hand Pinch
    let isSecondaryPinching = false;
    if (landmarks.length > 1) {
       const secHand = landmarks[1];
       const secIndex = secHand[8];
       const secThumb = secHand[4];
       isSecondaryPinching = getDistance(secIndex, secThumb) < 0.05;
    }

    // --- 4. NAVIGATION LOGIC ---
    const isInteracting = (isPrimaryPinching || isSecondaryPinching) && hitId;
    const hitFile = hitId === 'BACK_BUTTON' ? null : visibleFiles.find(f => f.id === hitId);
    const isNavigable = hitId === 'BACK_BUTTON' || (hitFile && hitFile.type === 'folder');

    if (hitId !== stateRef.current.lastHoverId) {
        setActivationProgress(0);
        stateRef.current.activationStartTime = 0;
        stateRef.current.lastHoverId = hitId;
    }

    if (isInteracting && isNavigable && !floatingFile) {
        if (stateRef.current.activationStartTime === 0) {
            stateRef.current.activationStartTime = now;
        }

        const requiredTime = isSecondaryPinching ? 100 : 1000; // 1s Hold
        const elapsed = now - stateRef.current.activationStartTime;
        const progress = Math.min(100, (elapsed / requiredTime) * 100);
        setActivationProgress(progress);

        if (progress >= 100) {
            if (hitId === 'BACK_BUTTON') {
                setCurrentPath(prev => prev.slice(0, -1));
                onAction?.("NAVIGATE", "Went up one level");
            } else if (hitFile) {
                setCurrentPath(prev => [...prev, hitFile.id]);
                onAction?.("NAVIGATE", `Opened ${hitFile.name}`);
            }
            setActivationProgress(0);
            stateRef.current.activationStartTime = now + 1000;
        }

    } else {
        setActivationProgress(0);
        stateRef.current.activationStartTime = 0;
    }


    // --- 5. DRAG LOGIC ---
    if (isPrimaryPinching && !floatingFile && stateRef.current.potentialTargetId) {
        const target = visibleFiles.find(f => f.id === stateRef.current.potentialTargetId);
        if (target && target.type !== 'folder') {
            const moveDist = Math.sqrt(
                Math.pow(cursorX - stateRef.current.pinchStartX, 2) + 
                Math.pow(cursorY - stateRef.current.pinchStartY, 2)
            );
            const DRAG_THRESHOLD = 40; 
            
            if (moveDist > DRAG_THRESHOLD) {
                setDraggedFileId(target.id);
                setFloatingFile({
                    id: target.id,
                    x: cursorX,
                    y: cursorY,
                    scale: 1
                });
                stateRef.current.triggerStartTime = 0;
            }
        }
    }

    if (!isPrimaryPinching && floatingFile) {
        setFloatingFile(null);
        setDraggedFileId(null);
        setActionStatus('idle');
        stateRef.current.triggerStartTime = 0;
    }

    if (floatingFile && isPrimaryPinching) {
        setFloatingFile(prev => prev ? ({...prev, x: cursorX, y: cursorY}) : null);

        // TRIGGER OPEN: Secondary Hand Open Palm
        const secondaryGesture = gestures.length > 1 ? gestures[1] : 'None';
        const isReady = landmarks.length > 1 && secondaryGesture === 'Open_Palm';

        if (isReady) {
            if (actionStatus !== 'ready') setActionStatus('ready');
            if (stateRef.current.triggerStartTime === 0) stateRef.current.triggerStartTime = now;
            stateRef.current.triggerDebounceTime = now; 

            const elapsed = now - stateRef.current.triggerStartTime;
            if (elapsed > 300) {
                const file = FILES_DB.find(f => f.id === floatingFile.id);
                if (file) {
                    onAction?.("OPEN_FILE", JSON.stringify({ id: file.id, name: file.name, content: file.content }));
                }
                setFloatingFile(null);
                setDraggedFileId(null);
                setActionStatus('idle');
                stateRef.current.triggerStartTime = 0;
            }
        } else {
             const timeSinceLastDetection = now - stateRef.current.triggerDebounceTime;
             if (timeSinceLastDetection > 150) {
                 if (actionStatus !== 'idle') setActionStatus('idle');
                 stateRef.current.triggerStartTime = 0;
             }
        }
    }

  }, [landmarks, gestures, currentPath, visibleFiles, floatingFile, actionStatus, onAction, isFileOpen]);

  // --- RENDERING HELPERS ---

  const renderCursor = (hand: NormalizedLandmark[], idx: number) => {
    if (!containerRef.current) return null;
    const indexTip = hand[8];
    const isPrimary = idx === 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = isPrimary ? stateRef.current.cursorX : (1 - indexTip.x) * rect.width;
    const y = isPrimary ? stateRef.current.cursorY : indexTip.y * rect.height;

    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    
    // Determine progress source
    let progress = 0;
    let ringColor = '#ffffff';

    if (isFileOpen) {
        if (closeProgress > 0) {
            progress = closeProgress;
            ringColor = '#ef4444'; // Red for Close
        } else if (saveProgress > 0) {
            progress = saveProgress;
            ringColor = '#22d3ee'; // Cyan (Greenish) for Save
        } else if (revertProgress > 0) {
            progress = revertProgress;
            ringColor = '#f59e0b'; // Amber for Revert
        }
    } else {
        progress = activationProgress;
        ringColor = '#22d3ee';
    }

    const offset = circumference - (progress / 100) * circumference;

    return (
      <div 
        key={idx}
        className="absolute w-12 h-12 pointer-events-none z-50 flex items-center justify-center"
        style={{
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)'
        }}
      >
        {isPrimary && (
            <>
                <div className={`w-2 h-2 rounded-full ${progress > 0 ? '' : 'bg-white/80'}`} style={{ backgroundColor: progress > 0 ? ringColor : undefined }} />
                {stateRef.current.wasPinching && !floatingFile && (
                    <div className="absolute w-8 h-8 border-2 border-white/50 rounded-full animate-ping opacity-50"></div>
                )}
                
                <svg className="absolute w-full h-full -rotate-90">
                    <circle 
                        cx="24" cy="24" r={radius} 
                        fill="none" 
                        stroke={ringColor} 
                        strokeWidth="3" 
                        strokeDasharray={circumference} 
                        strokeDashoffset={offset}
                        className="transition-all duration-75"
                        strokeLinecap="round"
                    />
                </svg>
            </>
        )}
        {!isPrimary && (
          <div className="w-8 h-8 rounded-full border border-blue-400/50 flex items-center justify-center">
             <div className="w-1 h-1 bg-blue-400 rounded-full" />
             <div className="absolute top-8 text-[9px] text-blue-300 bg-black/60 px-1 rounded whitespace-nowrap">
                {gestures[idx]}
             </div>
             {/* Show Icon for Open Palm Trigger */}
             {gestures[idx] === 'Open_Palm' && floatingFile && (
                 <Hand size={20} className="text-cyan-400 animate-pulse absolute -top-8" />
             )}
          </div>
        )}
      </div>
    );
  };

  const getActionProgress = () => {
    if (stateRef.current.triggerStartTime === 0) return 0;
    const elapsed = Date.now() - stateRef.current.triggerStartTime;
    return Math.min(100, (elapsed / 300) * 100);
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-none font-sans select-none">
      
      {/* Sidebar - Hidden when file is open */}
      <div className={`
        absolute left-0 top-0 bottom-0 w-[280px] bg-neutral-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col transition-all duration-300
        ${isFileOpen ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}>
        
        {/* Header */}
        <div 
            className={`
               h-[60px] flex items-center px-6 gap-3 transition-colors duration-300
               ${hoveredId === 'BACK_BUTTON' ? 'bg-purple-900/40' : 'bg-transparent'}
               ${currentPath.length > 0 ? 'text-white' : 'text-neutral-500'}
            `}
        >
          {currentPath.length > 0 ? (
             <>
               <CornerLeftUp size={20} className={hoveredId === 'BACK_BUTTON' ? 'text-cyan-400' : 'text-neutral-400'} />
               <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-wide">RETURN</span>
                  <span className="text-[10px] text-neutral-400 font-mono">/..</span>
               </div>
             </>
          ) : (
             <>
               <Server size={20} className="text-purple-500" />
               <span className="text-sm font-bold tracking-wide">ROOT</span>
             </>
          )}
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto py-2">
          {visibleFiles.map(file => (
            <div 
               key={file.id} 
               className={`
                 relative flex items-center gap-4 px-6 h-[56px] transition-all duration-200 border-l-2
                 ${hoveredId === file.id ? 'bg-white/5 border-cyan-500 pl-8' : 'border-transparent'}
                 ${draggedFileId === file.id ? 'opacity-30' : 'opacity-100'}
               `}
            >
              {file.type === 'folder' ? (
                  <div className={`p-2 rounded ${hoveredId === file.id ? 'bg-purple-500/20' : 'bg-neutral-800'}`}>
                      <Folder size={18} className="text-purple-400" />
                  </div>
              ) : (
                  <div className={`p-2 rounded ${hoveredId === file.id ? 'bg-cyan-500/20' : 'bg-neutral-800'}`}>
                      <FileCode size={18} className="text-cyan-400" />
                  </div>
              )}
              
              <div className="flex flex-col">
                  <span className={`text-sm ${hoveredId === file.id ? 'text-white font-semibold' : 'text-neutral-300'}`}>
                      {file.name}
                  </span>
                  {file.type === 'folder' && (
                      <span className="text-[9px] text-neutral-500 font-mono">DIR</span>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating File */}
      {floatingFile && (
        <div 
          className="absolute flex flex-col items-center justify-center z-50"
          style={{
             left: floatingFile.x,
             top: floatingFile.y,
             transform: `translate(-50%, -50%) scale(${actionStatus === 'executing' ? 1.5 : 1})`,
             opacity: actionStatus === 'executing' ? 0 : 1,
             transition: 'transform 0.3s, opacity 0.3s'
          }}
        >
           <div className={`
             w-48 h-20 bg-neutral-900/90 backdrop-blur border-2 rounded-xl flex items-center gap-4 px-4 shadow-2xl overflow-hidden relative
             ${actionStatus === 'ready' ? 'border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.4)]' : 'border-purple-500'}
           `}>
             {actionStatus === 'ready' && (
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-cyan-500/20 transition-all duration-75"
                  style={{ width: `${getActionProgress()}%` }}
                />
             )}

             <FileCode size={32} className={actionStatus === 'ready' ? 'text-cyan-400' : 'text-purple-400'} />
             <div className="flex flex-col min-w-0 z-10">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                   {FILES_DB.find(f => f.id === floatingFile.id)?.name}
                </span>
                <span className="text-[9px] text-neutral-400 font-mono">
                  {actionStatus === 'ready' ? 'OPENING...' : 'DRAGGING'}
                </span>
             </div>
           </div>
           {actionStatus === 'ready' && (
             <div className="absolute -bottom-8 bg-cyan-500 text-black font-bold text-[10px] px-3 py-1 rounded-full animate-pulse whitespace-nowrap">
               🖐️ HOLDING FOR OPEN...
             </div>
           )}
        </div>
      )}

      {/* Create File Touch Indicator */}
      {fingerTouchPos && createFileProgress > 0 && (
        <div
          className="absolute z-50 flex flex-col items-center justify-center pointer-events-none"
          style={{
            left: fingerTouchPos.x,
            top: fingerTouchPos.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* Progress Ring */}
            <svg className="absolute w-full h-full -rotate-90">
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke="rgba(34, 211, 238, 0.2)"
                strokeWidth="4"
              />
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="4"
                strokeDasharray={2 * Math.PI * 36}
                strokeDashoffset={2 * Math.PI * 36 * (1 - createFileProgress / 100)}
                strokeLinecap="round"
                className="transition-all duration-75"
              />
            </svg>
            {/* Icon */}
            <FilePlus size={28} className="text-cyan-400 animate-pulse" />
          </div>
          <div className="mt-2 bg-cyan-500 text-black font-bold text-[10px] px-3 py-1 rounded-full whitespace-nowrap">
            CREATING NEW FILE...
          </div>
        </div>
      )}

      {/* Render Cursors */}
      {landmarks?.map((hand, idx) => renderCursor(hand, idx))}
    </div>
  );
};
