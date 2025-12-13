---
paths: frontend/**/*.{ts,tsx}
---

# TypeScript Code Style

## General

- Use strict mode (already enabled in tsconfig)
- No Chinese in code or comments - use English only
- Prefer `const` over `let`; never use `var`
- Use explicit return types for exported functions
- Avoid `any` type; use `unknown` or proper typing instead

## Naming Conventions

- **Components**: PascalCase (e.g., `FileSystemInterface`, `VideoHUD`)
- **Hooks**: camelCase with `use` prefix (e.g., `useLiveSession`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DTW_TIME_STEPS`, `FILES_DB`)
- **Types/Interfaces**: PascalCase (e.g., `GestureTemplate`, `Landmark`)
- **Files**: Match the primary export name (e.g., `DTWClassifier.ts`)

## Imports

- Group imports: React first, then external libraries, then local modules
- Use named exports for utilities; default exports for components
- Avoid circular dependencies

## Type Definitions

```typescript
// Prefer interfaces for object shapes
interface GestureConfig {
  threshold: number;
  timeSteps: number;
}

// Use type for unions, intersections, or simple aliases
type HandSide = 'Left' | 'Right';
```

## Error Handling

- Handle null/undefined with optional chaining (`?.`) and nullish coalescing (`??`)
- Provide fallback values for array access (e.g., `arr[i] ?? 0`)
- Use early returns to avoid deep nesting
