# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
npm install    # Install dependencies
npm run dev    # Start development server (port 3000)
npm run build  # Production build to frontend/dist/
npm run preview # Preview production build
```

### ML Training (Optional)

```bash
cd ml
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m train.train --data "data/raw/*.json" --epochs 50
```

## Architecture Overview

A **hand gesture interaction system** with four modes:

1. **File System** - Spatial navigation and file operations
2. **Number Recognition** - Dual-hand counting (0-10)
3. **Dial Control** - Rotational value selection (1-100)
4. **Gesture Test** - Debug custom trained gestures with DTW

## Repo Layout

```
├── frontend/                    # TypeScript + React runtime
│   ├── App.tsx                  # Main app, state, mode switching
│   ├── hooks/useLiveSession.ts  # MediaPipe integration
│   ├── components/              # UI components
│   ├── dynamicGesture/          # DTW gesture recognition module
│   │   ├── dtw.ts               # DTW algorithm
│   │   ├── DTWClassifier.ts     # Template-based classifier
│   │   ├── normalize.ts         # Landmark normalization
│   │   └── GestureBuffer.ts     # Frame sequence buffer
│   └── public/models/           # Gesture templates JSON
└── ml/                          # Python offline training
    ├── train/train.py           # LSTM training script
    ├── export/export_tfjs.py    # TensorFlow.js export
    └── data/raw/                # Training datasets
```

## Core Data Flow

```
                    ┌─────────────────────────────────────┐
                    │           MediaPipe WASM            │
Webcam ────────────►│  • 21 landmarks per hand            │
                    │  • Static gesture classification    │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │         useLiveSession hook         │
                    │  • landmarks: hand positions        │
                    │  • gestures: MediaPipe gestures     │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
     │ Static Gesture │  │ Dynamic Gesture│  │  Mode-Specific │
     │   Detection    │  │  (DTW Module)  │  │     Logic      │
     │                │  │                │  │                │
     │ Open_Palm      │  │ normalize →    │  │ File Browser   │
     │ Closed_Fist    │  │ buffer →       │  │ Number Count   │
     │ Thumb_Up, etc  │  │ DTW match      │  │ Dial Rotation  │
     └────────────────┘  └────────────────┘  └────────────────┘
```

## Key Components

### Frontend

| Component | Purpose |
|-----------|---------|
| `App.tsx` | State management, mode switching, DTW integration |
| `useLiveSession.ts` | MediaPipe webcam stream and gesture detection |
| `FileSystemInterface.tsx` | Spatial UI, cursor mapping, gesture actions |
| `dynamicGesture/` | DTW-based temporal gesture recognition |

### Gesture Recognition

**Static (MediaPipe)**: `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Up`, `Thumb_Down`, `Victory`, `ILoveYou`

**Dynamic (DTW)**: Custom gestures recorded via NEW MODEL button. Uses 30-frame sequences with wrist-relative + scale normalization.

### DTW Configuration (in App.tsx)

```typescript
const DTW_TIME_STEPS = 30;        // Frames per gesture
const DTW_THRESHOLD = 0.35;       // Minimum similarity (0-1)
const DTW_DISTANCE_SCALE = 0.8;   // Similarity conversion scale
```

## Recording New Gestures

1. Click **NEW MODEL** in header
2. Set label name and time steps
3. Record 20+ samples
4. Download JSON → place in `ml/data/raw/`
5. Copy to `frontend/public/models/gesture_templates.json` for DTW use

## Code Style

See `.claude/rules/` for detailed guidelines:

```
.claude/rules/
├── frontend/
│   ├── typescript.md      # frontend/**/*.{ts,tsx}
│   ├── react.md           # frontend/**/*.tsx
│   └── gesture-module.md  # frontend/dynamicGesture/**/*.ts
└── ml/
    └── python.md          # ml/**/*.py
```

### Quick Reference

- No Chinese in code or comments
- Tailwind CSS for styling
- TypeScript strict mode enabled
- Use `normalizeLandmarksFrame()` for DTW input (not raw landmarks)
