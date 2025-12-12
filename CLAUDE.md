# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
npm install    # Install dependencies
npm run dev    # Start development server (port 3000)
npm run build  # Production build to frontend/dist/
npm run preview # Preview production build
```

## Architecture Overview

This is a **spatial file system interface** using hand gesture recognition. Users interact with a virtual file browser through webcam-tracked hand gestures.

## Repo Layout

- `frontend/`: TypeScript + React + MediaPipe runtime (real-time).
- `ml/`: Python-only offline training/export (no runtime integration).

### Core Data Flow

```
Webcam → MediaPipe (hand tracking) → useLiveSession hook → gesture/landmark state
                                                              ↓
App.tsx ← FileSystemInterface ← gesture-based navigation/actions
```

### Key Components

- **`frontend/hooks/useLiveSession.ts`**: Core hook managing MediaPipe gesture recognition and webcam stream. Exposes `landmarks` (hand positions) and `gestures` (recognized gestures like "Closed_Fist", "Open_Palm").

- **`frontend/components/FileSystemInterface.tsx`**: Spatial UI layer. Translates hand landmarks to cursor positions and implements gesture-based interactions. See README.md for current gesture controls.

- **`frontend/constants.ts`**: Contains `FILES_DB` - the mock file system data structure with folders and file contents.

### Gesture Recognition

Uses MediaPipe's `GestureRecognizer` with dual-hand tracking. Gestures are mapped from `@mediapipe/tasks-vision` and include: `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `Victory`, `ILoveYou`.

### State Management

All state is local React state in `frontend/App.tsx`. File edits modify local `files` state (cloned from `FILES_DB`). The `activeFile` state controls the code viewer modal.

## Code Style Notes

- Do not use Chinese in code or comments
- Tailwind CSS for styling (loaded via CDN in index.html)
- TypeScript with strict mode
