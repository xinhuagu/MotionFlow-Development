import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, GestureRecognizer, DrawingUtils, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { LogEntry } from '../types';

interface UseLiveSessionProps {
  onLog: (message: string, type?: LogEntry['type']) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const useLiveSession = ({ onLog, videoRef, canvasRef }: UseLiveSessionProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  // Expose raw landmarks for spatial UI - Array of Arrays (Multi-hand)
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[][] | null>(null);
  // Expose gestures per hand
  const [gestures, setGestures] = useState<string[]>([]);

  // Refs for video/vision processing
  const requestRef = useRef<number>();
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize MediaPipe Gesture Recognizer
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2 // Enable Dual Hand Tracking
        });
        onLog("Vision Module calibrated (Dual-Hand).", 'success');
      } catch (error) {
        onLog(`Vision system failure: ${error}`, 'error');
      }
    };
    initMediaPipe();
  }, [onLog]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    onLog('Session terminated.', 'info');

    // Stop Video Loop
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsStreaming(false);

    // Clear Canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setLandmarks(null);
    setGestures([]);
  }, [onLog, videoRef, canvasRef]);

  const predictWebcam = useCallback(() => {
    if (!gestureRecognizerRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      // Setup Canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Ensure strictly increasing timestamp to prevent MediaPipe errors
      let nowInMs = Date.now();
      if (nowInMs <= lastVideoTimeRef.current) {
        nowInMs = lastVideoTimeRef.current + 1;
      }
      lastVideoTimeRef.current = nowInMs;

      let results;
      try {
        results = gestureRecognizerRef.current.recognizeForVideo(video, nowInMs);
      } catch (error) {
        // Suppress timestamp errors
        console.warn("MediaPipe Frame Error (Ignored):", error);
        if (isStreaming) {
           requestRef.current = requestAnimationFrame(predictWebcam);
        }
        return;
      }

      // Clear & Draw
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawingUtils = new DrawingUtils(ctx);

      const currentGestures: string[] = [];

      if (results.landmarks && results.landmarks.length > 0) {
        setLandmarks(results.landmarks);

        // Draw ALL hands
        results.landmarks.forEach((handLandmarks, index) => {
            drawingUtils.drawConnectors(handLandmarks, GestureRecognizer.HAND_CONNECTIONS, {
              color: "#A100FF", // Accenture Purple
              lineWidth: 2
            });
            drawingUtils.drawLandmarks(handLandmarks, {
              color: "#ffffff",
              lineWidth: 1,
              radius: 3
            });

            // Extract gesture for this hand
            let handGesture = 'None';
            if (results.gestures.length > index && results.gestures[index].length > 0) {
               const topGesture = results.gestures[index][0];
               if (topGesture.score > 0.5) {
                 handGesture = topGesture.categoryName;
               }
            }
            currentGestures.push(handGesture);
        });
        setGestures(currentGestures);

      } else {
        setLandmarks(null);
        setGestures([]);
      }
      ctx.restore();
    }

    if (isStreaming) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  }, [isStreaming, videoRef, canvasRef]);

  // Start prediction loop when streaming starts
  useEffect(() => {
    if (isStreaming) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isStreaming, predictWebcam]);


  const connect = useCallback(async () => {
    try {
      onLog('Initializing Vision System...', 'info');

      // Only request video, no audio needed
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsConnected(true);
      setIsStreaming(true);
      onLog('Vision system online. Gesture tracking active.', 'success');

    } catch (err) {
      onLog(`Initialization failed: ${err}`, 'error');
      setIsConnected(false);
    }
  }, [onLog, videoRef]);

  return { connect, disconnect, isConnected, isStreaming, gestures, landmarks };
};
