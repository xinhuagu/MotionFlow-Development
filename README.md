# MotionFlow-Development  ( v0.0.1)

**Reshaping the Future of Software Development**

A spatial file system interface powered by hand gesture recognition. Navigate, browse, and edit code using natural hand movements — no mouse or keyboard required.

<video src="docs/images/demo.mp4" controls autoplay loop muted width="100%"></video>

## Features

- **Gesture-Based Navigation** — Point and pinch to browse folders
- **Dual-Hand Interaction** — Drag files with one hand, trigger actions with the other
- **Code Viewer** — Open, edit, and save files using intuitive gestures
- **Real-Time Hand Tracking** — Powered by MediaPipe with dual-hand support

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and allow camera access.

## Gesture Controls

| Gesture | Action |
|---------|--------|
| Point + Pinch Hold | Navigate into folder |
| Drag + Open Palm | Open file viewer |
| Thumb Up (hold) | Save file |
| Thumb Down (hold) | Revert changes |
| Closed Fist (hold) | Close file |

## Tech Stack

```mermaid
flowchart TB
    subgraph Frontend["Frontend"]
        A[React 19 + TypeScript + Vite + Tailwind CSS]
    end

    subgraph Vision["Vision Processing"]
        B[MediaPipe GestureRecognizer]
        B1[Dual-hand tracking]
        B2[Real-time gesture classification]
        B3[GPU-accelerated WASM]
    end

    subgraph Spatial["Spatial UI Layer"]
        C1[Landmark to Cursor mapping]
        C2[Gesture to Action translation]
        C3[Progress-based activation]
    end

    Frontend --> Vision --> Spatial
```

## Architecture

```mermaid
graph LR
    subgraph Hooks
        H1[useLiveSession.ts]
    end

    subgraph Components
        C1[FileSystemInterface]
        C2[VideoHUD]
        C3[Terminal]
        C4[StatusPanel]
    end

    subgraph Core
        K1[constants.ts]
        K2[App.tsx]
    end

    H1 -->|landmarks, gestures| K2
    K2 --> C1
    K2 --> C2
    K2 --> C3
    K2 --> C4
    K1 -->|FILES_DB| C1
```

## License

MIT
