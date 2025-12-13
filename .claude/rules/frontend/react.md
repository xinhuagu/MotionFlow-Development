---
paths: frontend/**/*.tsx
---

# React Component Guidelines

## Component Structure

```typescript
// 1. Imports
import { useState, useEffect } from 'react';

// 2. Types
interface Props {
  // ...
}

// 3. Component
export function ComponentName({ prop1, prop2 }: Props) {
  // 3a. Hooks (useState, useRef, custom hooks)
  // 3b. Derived state / computed values
  // 3c. Effects
  // 3d. Event handlers
  // 3e. Render
}
```

## State Management

- Keep state as local as possible
- Lift state up only when needed by siblings
- Use refs for values that don't trigger re-renders (e.g., gesture buffers)
- Group related state into objects when they change together

## Hooks Best Practices

- List all dependencies in useEffect dependency arrays
- Use cleanup functions for subscriptions and timers
- Extract complex logic into custom hooks (e.g., `useLiveSession`)
- Avoid excessive re-renders by memoizing callbacks with useCallback

## Gesture Interaction Patterns

- Use refs for continuous tracking data (landmarks, buffers)
- Use state for UI updates (detected gesture, similarity score)
- Throttle state updates for performance (not every frame)
- Clear gesture state when mode changes or hand is lost

## Styling

- Use Tailwind CSS utility classes
- Keep class strings readable with template literals for conditionals
- Avoid inline style objects unless dynamic values are required

## Performance

- Avoid creating new objects/arrays in render
- Use key props correctly in lists
- Prefer conditional rendering over hidden elements for heavy components
