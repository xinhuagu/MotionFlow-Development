
import React, { useEffect, useState, useRef } from 'react';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FileCode, Folder, Server, CornerLeftUp, Hand, FilePlus, Edit2, Scissors } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  content?: string;
}

interface FileSystemInterfaceProps {
  landmarks: NormalizedLandmark[][] | null;
  gestures: string[];
  containerRef: React.RefObject<HTMLDivElement>;
  onAction?: (action: string, detail?: string) => void;
  isFileOpen: boolean;
  isRenaming: boolean;
  files: FileItem[];
  isNumberMode?: boolean;
}

export const FileSystemInterface: React.FC<FileSystemInterfaceProps> = ({ landmarks, gestures, containerRef, onAction, isFileOpen, isRenaming, files, isNumberMode = false }) => {
  const [currentPath, setCurrentPath] = useState<string[]>([]); // Stack of folder IDs
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activationProgress, setActivationProgress] = useState(0); // 0 to 100
  
  // File Action Progress States
  const [closeProgress, setCloseProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [revertProgress, setRevertProgress] = useState(0);
  const [renameProgress, setRenameProgress] = useState(0);
  const [createFileProgress, setCreateFileProgress] = useState(0);
  const [fingerTouchPos, setFingerTouchPos] = useState<{x: number, y: number} | null>(null);
  
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [floatingFile, setFloatingFile] = useState<{id: string, x: number, y: number, scale: number} | null>(null);
  const [actionStatus, setActionStatus] = useState<'idle' | 'ready' | 'ready_rename' | 'ready_delete' | 'executing'>('idle');


  // Logic State
  const stateRef = useRef({
    cursorX: 0,
    cursorY: 0,
    activationStartTime: 0,
    closeStartTime: 0,
    saveStartTime: 0,
    revertStartTime: 0,
    triggerStartTime: 0,
    renameStartTime: 0,
    deleteStartTime: 0,
    scissorsOpenDist: 0, // Track scissors finger distance
    scissorsMode: false, // Track if we're in scissors cutting mode
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
    // Shake Detection State (for number mode toggle)
    lastWristX: 0,
    lastWristY: 0,
    shakeDirectionChanges: 0,
    lastShakeDirection: 0, // -1 = negative, 1 = positive
    shakeStartTime: 0,
    lastShakeToggleTime: 0,
    // Number detection stability
    lastDetectedNumber: 0,
    numberStableStartTime: 0,
    confirmedNumber: 0,
  });

  const getDistance = (p1: NormalizedLandmark, p2: NormalizedLandmark) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };


  // Detect horizontal pointing gesture (index finger pointing sideways)
  const isHorizontalPointing = (hand: NormalizedLandmark[]) => {
    const indexTip = hand[8];   // Index finger tip
    const indexMcp = hand[5];   // Index finger base (MCP)
    const middleTip = hand[12]; // Middle finger tip
    const middleMcp = hand[9];  // Middle finger base

    // Check index finger is extended
    const indexExtended = Math.abs(indexTip.y - indexMcp.y) > 0.05 ||
                          Math.abs(indexTip.x - indexMcp.x) > 0.08;

    // Check middle finger is curled (tip close to MCP)
    const middleCurled = getDistance(middleTip, middleMcp) < 0.12;

    // Check pointing direction is more horizontal than vertical
    const xDiff = Math.abs(indexTip.x - indexMcp.x);
    const yDiff = Math.abs(indexTip.y - indexMcp.y);
    const isHorizontal = xDiff > yDiff * 1.2; // X movement > 1.2x Y movement

    return indexExtended && middleCurled && isHorizontal;
  };

  // Detect number gesture (supports both German and American styles)
  // Logic: If thumb is tucked in (curled), use American style; otherwise use German style
  // German: 1=thumb, 2=thumb+index, 3=thumb+index+middle, 4=thumb+index+middle+ring, 5=all
  // American: 1=index, 2=index+middle (V), 3=index+middle+ring, 4=index+middle+ring+pinky, 5=all
  const detectNumberGesture = (hand: NormalizedLandmark[]): number | null => {
    const thumbTip = hand[4];
    const thumbMcp = hand[2];
    const indexTip = hand[8];
    const indexPip = hand[6];
    const indexMcp = hand[5];
    const middleTip = hand[12];
    const middlePip = hand[10];
    const middleMcp = hand[9];
    const ringTip = hand[16];
    const ringPip = hand[14];
    const ringMcp = hand[13];
    const pinkyTip = hand[20];
    const pinkyPip = hand[18];
    const pinkyMcp = hand[17];
    const wrist = hand[0];

    // Calculate hand span (distance from thumb tip to pinky tip)
    // Open palm has large span, closed hand has small span
    const handSpan = getDistance(thumbTip, pinkyTip);
    const isOpenPalm = handSpan > 0.2; // Lower threshold for open palm detection

    // For thumb: check if it's extended outward (away from palm)
    // Use lower threshold - thumb just needs to be slightly open
    const thumbToIndexMcp = getDistance(thumbTip, indexMcp);
    const thumbExtended = thumbToIndexMcp > 0.06; // Lowered from 0.1 to 0.06

    // Check if each finger is curled (tip close to MCP = curled)
    const CURL_THRESHOLD = 0.07;
    const indexCurled = getDistance(indexTip, indexMcp) < CURL_THRESHOLD;
    const middleCurled = getDistance(middleTip, middleMcp) < CURL_THRESHOLD;
    const ringCurled = getDistance(ringTip, ringMcp) < CURL_THRESHOLD;
    const pinkyCurled = getDistance(pinkyTip, pinkyMcp) < 0.06; // Pinky is shorter

    // Finger is extended if NOT curled
    const indexExtended = !indexCurled;
    const middleExtended = !middleCurled;
    const ringExtended = !ringCurled;
    const pinkyExtended = !pinkyCurled;

    // Count extended fingers (excluding thumb)
    const extendedFingers = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

    // PRIORITY 1: Open palm detection (hand span method)
    // If hand span is large, it's definitely 5
    if (isOpenPalm && thumbExtended) {
      return 5;
    }

    // PRIORITY 2: Check specific patterns
    if (thumbExtended) {
      // German style: thumb participates in counting
      if (extendedFingers === 0) return 1; // Only thumb
      if (extendedFingers === 1 && indexExtended) return 2; // thumb + index
      if (extendedFingers === 2 && indexExtended && middleExtended) return 3; // thumb + index + middle
      // For 4: need exactly index+middle+ring extended, pinky curled
      if (indexExtended && middleExtended && ringExtended && pinkyCurled) return 4;
      // Otherwise if 3+ fingers, assume 5
      if (extendedFingers >= 3) return 5;
    } else {
      // American style: thumb is tucked, only count other fingers
      if (extendedFingers === 0) return null;
      if (extendedFingers === 1 && indexExtended) return 1; // index only
      if (extendedFingers === 2 && indexExtended && middleExtended) return 2; // V sign
      if (extendedFingers === 3 && indexExtended && middleExtended && ringExtended) return 3;
      if (extendedFingers >= 4) return 4; // four fingers (no thumb)
    }

    return null;
  };

  // Filter files for current view
  const currentFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;
  const visibleFiles = files.filter(f => f.parentId === currentFolderId);

  useEffect(() => {
    if (!landmarks || landmarks.length === 0 || !containerRef.current) return;
    const now = Date.now();
    const primaryHand = landmarks[0];
    const primaryGesture = gestures[0] || 'None';

    // --- SHAKE DETECTION (for number mode toggle) ---
    // Works with both palm-facing and back-facing fist by detecting movement in any direction
    const SHAKE_COOLDOWN = 1500; // 1.5s cooldown between toggles
    const SHAKE_WINDOW = 1000; // 1 second window for shake detection
    const SHAKE_THRESHOLD = 0.025; // Minimum movement to count as direction change
    const SHAKE_COUNT_NEEDED = 3; // Need 3-4 direction changes

    // Custom fist detection: all fingers curled (tips close to palm/MCP)
    // This works regardless of hand orientation (palm or back facing camera)
    const detectClosedFist = (hand: NormalizedLandmark[]): boolean => {
      const wrist = hand[0];
      const indexTip = hand[8], indexMcp = hand[5];
      const middleTip = hand[12], middleMcp = hand[9];
      const ringTip = hand[16], ringMcp = hand[13];
      const pinkyTip = hand[20], pinkyMcp = hand[17];
      const thumbTip = hand[4], thumbIp = hand[3];

      // Check all fingers are curled: tip is close to MCP or wrist
      const CURL_THRESHOLD = 0.08;
      const indexCurled = getDistance(indexTip, indexMcp) < CURL_THRESHOLD || getDistance(indexTip, wrist) < 0.15;
      const middleCurled = getDistance(middleTip, middleMcp) < CURL_THRESHOLD || getDistance(middleTip, wrist) < 0.15;
      const ringCurled = getDistance(ringTip, ringMcp) < CURL_THRESHOLD || getDistance(ringTip, wrist) < 0.15;
      const pinkyCurled = getDistance(pinkyTip, pinkyMcp) < CURL_THRESHOLD || getDistance(pinkyTip, wrist) < 0.15;
      const thumbCurled = getDistance(thumbTip, thumbIp) < 0.05 || getDistance(thumbTip, indexMcp) < 0.1;

      // At least 4 fingers must be curled for a fist
      const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
      return curledCount >= 3; // Allow some tolerance
    };

    const isFist = primaryGesture === 'Closed_Fist' || detectClosedFist(primaryHand);

    if (isFist && now - stateRef.current.lastShakeToggleTime > SHAKE_COOLDOWN) {
      const wristX = primaryHand[0].x;
      const wristY = primaryHand[0].y;

      // Initialize on first fist detection
      if (stateRef.current.shakeStartTime === 0) {
        stateRef.current.shakeStartTime = now;
        stateRef.current.lastWristX = wristX;
        stateRef.current.lastWristY = wristY;
        stateRef.current.shakeDirectionChanges = 0;
        stateRef.current.lastShakeDirection = 0;
      }

      // Check if still within shake window
      if (now - stateRef.current.shakeStartTime < SHAKE_WINDOW) {
        const deltaX = wristX - stateRef.current.lastWristX;
        const deltaY = wristY - stateRef.current.lastWristY;

        // Use whichever axis has more movement (supports horizontal or vertical shake)
        const useXAxis = Math.abs(deltaX) > Math.abs(deltaY);
        const delta = useXAxis ? deltaX : deltaY;

        if (Math.abs(delta) > SHAKE_THRESHOLD) {
          const newDirection = delta > 0 ? 1 : -1;

          // Count direction change
          if (stateRef.current.lastShakeDirection !== 0 && newDirection !== stateRef.current.lastShakeDirection) {
            stateRef.current.shakeDirectionChanges++;
          }

          stateRef.current.lastShakeDirection = newDirection;
          stateRef.current.lastWristX = wristX;
          stateRef.current.lastWristY = wristY;

          // Check if shake detected
          if (stateRef.current.shakeDirectionChanges >= SHAKE_COUNT_NEEDED) {
            if (isNumberMode) {
              onAction?.("EXIT_NUMBER_MODE");
            } else {
              onAction?.("ENTER_NUMBER_MODE");
            }
            stateRef.current.lastShakeToggleTime = now;
            stateRef.current.shakeStartTime = 0;
            stateRef.current.shakeDirectionChanges = 0;
          }
        }
      } else {
        // Reset shake detection if window expired
        stateRef.current.shakeStartTime = now;
        stateRef.current.shakeDirectionChanges = 0;
        stateRef.current.lastShakeDirection = 0;
        stateRef.current.lastWristX = wristX;
        stateRef.current.lastWristY = wristY;
      }
    } else if (!isFist) {
      // Reset when not fist
      stateRef.current.shakeStartTime = 0;
      stateRef.current.shakeDirectionChanges = 0;
      stateRef.current.lastShakeDirection = 0;
    }

    // --- NUMBER MODE ---
    if (isNumberMode) {
      // Detect numbers from both hands and sum them (allows 0-10)
      const leftHandNumber = detectNumberGesture(primaryHand) ?? 0;
      const rightHandNumber = landmarks.length > 1 ? (detectNumberGesture(landmarks[1]) ?? 0) : 0;
      const totalNumber = leftHandNumber + rightHandNumber;

      // Number stability detection - only report when stable for 300ms
      const NUMBER_STABLE_TIME = 300; // ms to hold before confirming

      if (totalNumber === stateRef.current.lastDetectedNumber) {
        // Same number detected, check if stable long enough
        if (stateRef.current.numberStableStartTime === 0) {
          stateRef.current.numberStableStartTime = now;
        }

        const stableDuration = now - stateRef.current.numberStableStartTime;
        if (stableDuration >= NUMBER_STABLE_TIME && totalNumber !== stateRef.current.confirmedNumber) {
          // Number has been stable long enough, confirm it
          stateRef.current.confirmedNumber = totalNumber;
          onAction?.("NUMBER_DETECTED", totalNumber.toString());
        }
      } else {
        // Different number detected, reset stability timer
        stateRef.current.lastDetectedNumber = totalNumber;
        stateRef.current.numberStableStartTime = now;
      }

      return; // Skip all other interactions in number mode
    }

    // --- RENAME MODE GESTURE HANDLING ---
    if (isRenaming) {
        // Thumb_Up -> Confirm rename
        const isThumbUp = gestures.includes('Thumb_Up');
        if (isThumbUp) {
            if (stateRef.current.saveStartTime === 0) {
                stateRef.current.saveStartTime = now;
            }
            const elapsed = now - stateRef.current.saveStartTime;
            const progress = Math.min(100, (elapsed / 800) * 100); // 800ms hold
            setSaveProgress(progress);

            if (progress >= 100) {
                onAction?.("CONFIRM_RENAME");
                setSaveProgress(0);
                stateRef.current.saveStartTime = now + 2000; // Cooldown
            }
        } else {
            setSaveProgress(0);
            stateRef.current.saveStartTime = 0;
        }

        // Closed_Fist -> Cancel rename
        const isFist = gestures.includes('Closed_Fist');
        if (isFist) {
            if (stateRef.current.closeStartTime === 0) {
                stateRef.current.closeStartTime = now;
            }
            const elapsed = now - stateRef.current.closeStartTime;
            const progress = Math.min(100, (elapsed / 800) * 100); // 800ms hold
            setCloseProgress(progress);

            if (progress >= 100) {
                onAction?.("CANCEL_RENAME");
                setCloseProgress(0);
                stateRef.current.closeStartTime = now + 2000; // Cooldown
            }
        } else {
            setCloseProgress(0);
            stateRef.current.closeStartTime = 0;
        }

        return; // Skip other interactions while renaming
    }

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

        // 4. RENAME ACTION (Horizontal Pointing) - Rename current open file
        const isHorizontalPoint = landmarks.length > 0 && isHorizontalPointing(landmarks[0]);
        if (isHorizontalPoint) {
            if (stateRef.current.renameStartTime === 0) {
                stateRef.current.renameStartTime = now;
            }
            const elapsed = now - stateRef.current.renameStartTime;
            const progress = Math.min(100, (elapsed / 800) * 100); // 800ms hold
            setRenameProgress(progress);

            if (progress >= 100) {
                onAction?.("RENAME_OPEN_FILE");
                setRenameProgress(0);
                stateRef.current.renameStartTime = now + 2000; // Cooldown
            }
        } else {
            setRenameProgress(0);
            stateRef.current.renameStartTime = 0;
        }

        // 5. ZOOM LOGIC
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
    // primaryHand already declared at top of useEffect
    const rect = containerRef.current.getBoundingClientRect();

    // Map Coords (Mirror Mode: x = 1 - x)
    const indexTip = primaryHand[8];
    const thumbTip = primaryHand[4];
    const wrist = primaryHand[0];

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
        // Only set potential target if it's an actual file/folder, not BACK_BUTTON
        stateRef.current.potentialTargetId = (hitId && hitId !== 'BACK_BUTTON') ? hitId : null;
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

    // --- 4. BACK BUTTON NAVIGATION ---
    // Pinch + Hold on BACK_BUTTON to go up one level
    const hitFile = hitId === 'BACK_BUTTON' ? null : visibleFiles.find(f => f.id === hitId);

    if (hitId !== stateRef.current.lastHoverId) {
        setActivationProgress(0);
        stateRef.current.activationStartTime = 0;
        stateRef.current.lastHoverId = hitId;
    }

    // Back button navigation only
    if (isPrimaryPinching && !floatingFile && hitId === 'BACK_BUTTON' && currentPath.length > 0) {
        if (stateRef.current.activationStartTime === 0) {
            stateRef.current.activationStartTime = now;
        }
        const elapsed = now - stateRef.current.activationStartTime;
        const progress = Math.min(100, (elapsed / 500) * 100); // 500ms hold
        setActivationProgress(progress);

        if (progress >= 100) {
            setCurrentPath(prev => prev.slice(0, -1));
            onAction?.("NAVIGATE", "Went up one level");
            setActivationProgress(0);
            stateRef.current.activationStartTime = now + 1000;
            // Reset drag state so user can drag again after navigation
            stateRef.current.potentialTargetId = null;
            stateRef.current.wasPinching = false;
        }
    } else if (!isPrimaryPinching || hitId !== 'BACK_BUTTON') {
        setActivationProgress(0);
        stateRef.current.activationStartTime = 0;
    }


    // --- 5. DRAG LOGIC (Files AND Folders) ---
    if (isPrimaryPinching && !floatingFile && stateRef.current.potentialTargetId) {
        const target = visibleFiles.find(f => f.id === stateRef.current.potentialTargetId);
        if (target) {
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
        stateRef.current.scissorsMode = false;
        stateRef.current.scissorsOpenDist = 0;
    }

    if (floatingFile && isPrimaryPinching) {
        setFloatingFile(prev => prev ? ({...prev, x: cursorX, y: cursorY}) : null);

        // TRIGGER ACTIONS: Secondary Hand Gestures
        const secondaryGesture = gestures.length > 1 ? gestures[1] : 'None';
        const isReadyOpen = landmarks.length > 1 && secondaryGesture === 'Open_Palm';
        const isReadyRename = landmarks.length > 1 && isHorizontalPointing(landmarks[1]);
        // Detect horizontal scissors gesture (index and middle fingers extended horizontally)
        const isHorizontalScissors = (hand: NormalizedLandmark[]) => {
            const indexTip = hand[8];
            const indexMcp = hand[5];
            const middleTip = hand[12];
            const middleMcp = hand[9];
            const ringTip = hand[16];
            const ringMcp = hand[13];

            // Check index and middle fingers are extended
            const indexExtended = getDistance(indexTip, indexMcp) > 0.1;
            const middleExtended = getDistance(middleTip, middleMcp) > 0.1;

            // Check ring finger is curled
            const ringCurled = getDistance(ringTip, ringMcp) < 0.08;

            // Check fingers are more horizontal than vertical
            const indexHorizontal = Math.abs(indexTip.x - indexMcp.x) > Math.abs(indexTip.y - indexMcp.y);
            const middleHorizontal = Math.abs(middleTip.x - middleMcp.x) > Math.abs(middleTip.y - middleMcp.y);

            return indexExtended && middleExtended && ringCurled && (indexHorizontal || middleHorizontal);
        };
        const isReadyDelete = landmarks.length > 1 && (secondaryGesture === 'Victory' || isHorizontalScissors(landmarks[1]));

        if (isReadyOpen) {
            if (actionStatus !== 'ready') setActionStatus('ready');
            if (stateRef.current.triggerStartTime === 0) stateRef.current.triggerStartTime = now;
            stateRef.current.triggerDebounceTime = now;
            stateRef.current.renameStartTime = 0; // Reset rename timer
            stateRef.current.deleteStartTime = 0; // Reset delete timer

            const elapsed = now - stateRef.current.triggerStartTime;
            if (elapsed > 300) {
                const item = files.find(f => f.id === floatingFile.id);
                if (item) {
                    if (item.type === 'folder') {
                        // ENTER FOLDER: Palm gesture on dragged folder
                        setCurrentPath(prev => [...prev, item.id]);
                        onAction?.("NAVIGATE", `Entered ${item.name}`);
                    } else {
                        // OPEN FILE: Palm gesture on dragged file
                        onAction?.("OPEN_FILE", JSON.stringify({ id: item.id, name: item.name, content: item.content }));
                    }
                }
                setFloatingFile(null);
                setDraggedFileId(null);
                setActionStatus('idle');
                stateRef.current.triggerStartTime = 0;
                // Reset drag state so user can drag again after navigation
                stateRef.current.potentialTargetId = null;
                stateRef.current.wasPinching = false;
            }
        } else if (isReadyRename) {
            // TRIGGER RENAME: Secondary Hand Horizontal Pointing
            if (actionStatus !== 'ready_rename') setActionStatus('ready_rename');
            if (stateRef.current.renameStartTime === 0) stateRef.current.renameStartTime = now;
            stateRef.current.triggerDebounceTime = now;
            stateRef.current.triggerStartTime = 0; // Reset open timer
            stateRef.current.deleteStartTime = 0; // Reset delete timer

            const elapsed = now - stateRef.current.renameStartTime;
            if (elapsed > 500) { // 500ms hold for rename
                const file = files.find(f => f.id === floatingFile.id);
                if (file) {
                    onAction?.("RENAME_FILE", JSON.stringify({ id: file.id, name: file.name }));
                }
                setFloatingFile(null);
                setDraggedFileId(null);
                setActionStatus('idle');
                stateRef.current.renameStartTime = 0;
            }
        } else if (isReadyDelete || stateRef.current.scissorsMode) {
            // TRIGGER DELETE: Secondary Hand Victory (Scissors) + Cutting Motion
            // Track finger distance for cutting motion
            const secHand = landmarks[1];
            const indexTip = secHand[8];  // Index finger tip
            const middleTip = secHand[12]; // Middle finger tip
            const fingerDist = getDistance(indexTip, middleTip);

            const SCISSORS_OPEN_THRESHOLD = 0.04;  // Fingers spread apart
            const SCISSORS_CLOSE_THRESHOLD = 0.02; // Fingers closed together

            // Enter scissors mode when Victory detected with fingers spread
            if (isReadyDelete && fingerDist > SCISSORS_OPEN_THRESHOLD) {
                if (!stateRef.current.scissorsMode) {
                    stateRef.current.scissorsMode = true;
                    stateRef.current.scissorsOpenDist = fingerDist;
                }
            }

            if (stateRef.current.scissorsMode) {
                if (actionStatus !== 'ready_delete') setActionStatus('ready_delete');
                stateRef.current.triggerDebounceTime = now;
                stateRef.current.triggerStartTime = 0;
                stateRef.current.renameStartTime = 0;

                // Check if fingers closed (cut motion)
                if (fingerDist < SCISSORS_CLOSE_THRESHOLD) {
                    // Scissors cut motion detected!
                    const file = files.find(f => f.id === floatingFile.id);
                    if (file) {
                        onAction?.("DELETE_FILE", JSON.stringify({ id: file.id, name: file.name }));
                    }
                    setFloatingFile(null);
                    setDraggedFileId(null);
                    setActionStatus('idle');
                    stateRef.current.scissorsMode = false;
                    stateRef.current.scissorsOpenDist = 0;
                }
            }
        } else {
             const timeSinceLastDetection = now - stateRef.current.triggerDebounceTime;
             if (timeSinceLastDetection > 150) {
                 if (actionStatus !== 'idle') setActionStatus('idle');
                 stateRef.current.triggerStartTime = 0;
                 stateRef.current.renameStartTime = 0;
                 stateRef.current.deleteStartTime = 0;
                 stateRef.current.scissorsOpenDist = 0;
                 stateRef.current.scissorsMode = false;
             }
        }
    }

  }, [landmarks, gestures, currentPath, visibleFiles, floatingFile, actionStatus, onAction, isFileOpen, isRenaming, isNumberMode]);

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
            ringColor = '#22d3ee'; // Cyan for Save
        } else if (revertProgress > 0) {
            progress = revertProgress;
            ringColor = '#f59e0b'; // Amber for Revert
        } else if (renameProgress > 0) {
            progress = renameProgress;
            ringColor = '#a855f7'; // Purple for Rename
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

  const getRenameProgress = () => {
    if (stateRef.current.renameStartTime === 0) return 0;
    const elapsed = Date.now() - stateRef.current.renameStartTime;
    return Math.min(100, (elapsed / 500) * 100); // 500ms for rename
  };

  const getDeleteProgress = () => {
    if (stateRef.current.deleteStartTime === 0) return 0;
    const elapsed = Date.now() - stateRef.current.deleteStartTime;
    return Math.min(100, (elapsed / 800) * 100); // 800ms for delete
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-none font-sans select-none">

      {/* Sidebar - Hidden when file is open or in number mode */}
      <div className={`
        absolute left-0 top-0 bottom-0 w-[280px] bg-neutral-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col transition-all duration-300
        ${isFileOpen || isNumberMode ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
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
             ${actionStatus === 'ready' ? 'border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.4)]' :
               actionStatus === 'ready_rename' ? 'border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.4)]' :
               actionStatus === 'ready_delete' ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)]' : 'border-purple-500'}
           `}>
             {actionStatus === 'ready' && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-cyan-500/20 transition-all duration-75"
                  style={{ width: `${getActionProgress()}%` }}
                />
             )}
             {actionStatus === 'ready_rename' && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-amber-500/20 transition-all duration-75"
                  style={{ width: `${getRenameProgress()}%` }}
                />
             )}
             {actionStatus === 'ready_delete' && (
                <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
             )}

             {(() => {
               const item = files.find(f => f.id === floatingFile.id);
               const isFolder = item?.type === 'folder';
               const iconColor = actionStatus === 'ready' ? 'text-cyan-400' :
                                 actionStatus === 'ready_rename' ? 'text-amber-400' :
                                 actionStatus === 'ready_delete' ? 'text-red-500' : 'text-purple-400';
               return isFolder ? <Folder size={32} className={iconColor} /> : <FileCode size={32} className={iconColor} />;
             })()}
             <div className="flex flex-col min-w-0 z-10">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">
                   {files.find(f => f.id === floatingFile.id)?.name}
                </span>
                <span className="text-[9px] text-neutral-400 font-mono">
                  {(() => {
                    const item = files.find(f => f.id === floatingFile.id);
                    const isFolder = item?.type === 'folder';
                    if (actionStatus === 'ready') return isFolder ? 'ENTERING...' : 'OPENING...';
                    if (actionStatus === 'ready_rename') return 'RENAMING...';
                    if (actionStatus === 'ready_delete') return 'SCISSORS READY';
                    return 'DRAGGING';
                  })()}
                </span>
             </div>
           </div>
           {actionStatus === 'ready' && (
             <div className="absolute -bottom-8 bg-cyan-500 text-black font-bold text-[10px] px-3 py-1 rounded-full animate-pulse whitespace-nowrap">
               {files.find(f => f.id === floatingFile.id)?.type === 'folder' ? 'HOLDING TO ENTER...' : 'HOLDING FOR OPEN...'}
             </div>
           )}
           {actionStatus === 'ready_rename' && (
             <div className="absolute -bottom-8 bg-amber-500 text-black font-bold text-[10px] px-3 py-1 rounded-full animate-pulse whitespace-nowrap flex items-center gap-1">
               <Edit2 size={10} /> HOLDING FOR RENAME...
             </div>
           )}
           {actionStatus === 'ready_delete' && (
             <div className="absolute -bottom-8 bg-red-500 text-white font-bold text-[10px] px-3 py-1 rounded-full animate-pulse whitespace-nowrap flex items-center gap-1">
               <Scissors size={10} /> CUT TO DELETE
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
