import type { Landmark } from './types';

export type NormalizeOptions = {
  landmarksPerHand?: number;
  scaleLandmarkA?: number;
  scaleLandmarkB?: number;
  epsilon?: number;
};

export function normalizeLandmarksFrame(
  landmarks: ReadonlyArray<Landmark>,
  options: NormalizeOptions = {}
): number[] | null {
  const landmarksPerHand = options.landmarksPerHand ?? 21;
  if (landmarks.length < landmarksPerHand) return null;

  const base = landmarks[0];
  const baseZ = base.z ?? 0;

  const aIndex = options.scaleLandmarkA ?? 0;
  const bIndex = options.scaleLandmarkB ?? 9;
  const epsilon = options.epsilon ?? 1e-6;

  const a = landmarks[aIndex] ?? base;
  const b = landmarks[bIndex] ?? base;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.z ?? 0) - (a.z ?? 0);
  const scale = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), epsilon);

  const out: number[] = [];
  for (let i = 0; i < landmarksPerHand; i++) {
    const p = landmarks[i];
    out.push((p.x - base.x) / scale, (p.y - base.y) / scale, ((p.z ?? 0) - baseZ) / scale);
  }

  return out;
}

