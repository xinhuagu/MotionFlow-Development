---
paths: frontend/dynamicGesture/**/*.ts
---

# Dynamic Gesture Module Guidelines

## Module Purpose

This module handles temporal gesture recognition using DTW (Dynamic Time Warping). It is separate from MediaPipe's built-in static gesture recognition.

## Core Components

| File | Responsibility |
|------|----------------|
| `dtw.ts` | DTW algorithm implementation |
| `DTWClassifier.ts` | Template-based gesture matching |
| `GestureBuffer.ts` | Frame sequence collection |
| `normalize.ts` | Landmark normalization |
| `types.ts` | Shared type definitions |

## Data Flow

```
Raw Landmarks → normalizeLandmarksFrame() → Buffer → DTWClassifier.predict()
                     ↓
              [x, y, z] × 21 landmarks → 63-dim vector per frame
```

## Normalization Standard

All sequences must use consistent normalization:

1. **Wrist-relative**: Subtract wrist (landmark 0) position
2. **Scale-normalized**: Divide by palm width (distance between landmarks 0 and 9)
3. **Flatten**: Convert 21 landmarks to 63-dimensional vector [x0,y0,z0,x1,y1,z1,...]

```typescript
// Correct: Use normalizeLandmarksFrame for DTW
const frame = normalizeLandmarksFrame(landmarks);

// Wrong: Don't use raw landmarks directly
const frame = landmarks.flatMap(l => [l.x, l.y, l.z]); // Missing normalization!
```

## DTW Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `threshold` | 0.35 | Minimum similarity to trigger detection |
| `distanceScale` | 0.8 | Scale for similarity conversion |
| `maxTemplatesPerLabel` | 10 | Templates to keep per gesture type |
| `windowSize` | unlimited | Sakoe-Chiba band constraint |

## Adding New Algorithms

When adding alternative classifiers:

1. Implement `DynamicGestureClassifier` interface from `types.ts`
2. Ensure compatible input format (normalized sequences)
3. Export from `index.ts`
4. Document configuration options
