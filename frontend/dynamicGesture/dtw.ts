/**
 * Dynamic Time Warping (DTW) implementation for gesture sequence comparison.
 */

export type DTWOptions = {
  /** Distance function between two frames. Default: Euclidean */
  distanceFn?: (a: ReadonlyArray<number>, b: ReadonlyArray<number>) => number;
  /** Window constraint (Sakoe-Chiba band). Default: unlimited */
  windowSize?: number;
};

/** Euclidean distance between two feature vectors */
export function euclideanDistance(
  a: ReadonlyArray<number>,
  b: ReadonlyArray<number>
): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Compute DTW distance between two sequences.
 * Lower distance = more similar.
 */
export function dtwDistance(
  seq1: ReadonlyArray<ReadonlyArray<number>>,
  seq2: ReadonlyArray<ReadonlyArray<number>>,
  options: DTWOptions = {}
): number {
  const distanceFn = options.distanceFn ?? euclideanDistance;
  const n = seq1.length;
  const m = seq2.length;

  if (n === 0 || m === 0) return Infinity;

  // Create cost matrix
  const dtw: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(Infinity)
  );
  dtw[0]![0] = 0;

  const windowSize = options.windowSize ?? Math.max(n, m);

  for (let i = 1; i <= n; i++) {
    const jStart = Math.max(1, i - windowSize);
    const jEnd = Math.min(m, i + windowSize);

    for (let j = jStart; j <= jEnd; j++) {
      const cost = distanceFn(seq1[i - 1]!, seq2[j - 1]!);
      dtw[i]![j] = cost + Math.min(
        dtw[i - 1]![j]!,     // insertion
        dtw[i]![j - 1]!,     // deletion
        dtw[i - 1]![j - 1]!  // match
      );
    }
  }

  // Normalize by path length
  return dtw[n]![m]! / (n + m);
}

/**
 * Compute similarity score (0-1) from DTW distance.
 * Uses exponential decay: similarity = exp(-distance / scale)
 */
export function dtwSimilarity(
  seq1: ReadonlyArray<ReadonlyArray<number>>,
  seq2: ReadonlyArray<ReadonlyArray<number>>,
  options: DTWOptions & { scale?: number } = {}
): number {
  const distance = dtwDistance(seq1, seq2, options);
  const scale = options.scale ?? 1.0;
  return Math.exp(-distance / scale);
}
