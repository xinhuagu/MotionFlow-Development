import type { DynamicGestureClassifier } from './types';
import { dtwDistance } from './dtw';

export type GestureTemplate = {
  label: string;
  sequence: number[][];
};

export type DTWClassifierOptions = {
  /** Similarity threshold (0-1). Default: 0.6 */
  threshold?: number;
  /** Max templates per label to use (for speed). Default: 10 */
  maxTemplatesPerLabel?: number;
  /** DTW window size constraint. Default: unlimited */
  windowSize?: number;
  /** Distance scale for similarity conversion. Default: 0.5 */
  distanceScale?: number;
};

export class DTWClassifier implements DynamicGestureClassifier {
  private templates: GestureTemplate[] = [];
  private labels: string[] = [];
  private readonly threshold: number;
  private readonly maxTemplatesPerLabel: number;
  private readonly windowSize: number | undefined;
  private readonly distanceScale: number;

  constructor(options: DTWClassifierOptions = {}) {
    this.threshold = options.threshold ?? 0.6;
    this.maxTemplatesPerLabel = options.maxTemplatesPerLabel ?? 10;
    this.windowSize = options.windowSize;
    this.distanceScale = options.distanceScale ?? 0.5;
  }

  /**
   * Load templates from the frontend recorder JSON format.
   */
  loadFromDataset(data: {
    samples: Array<{
      label: string;
      sequence: number[][];
    }>;
  }): void {
    // Group by label
    const byLabel = new Map<string, number[][]>();

    for (const sample of data.samples) {
      const existing = byLabel.get(sample.label) ?? [];
      existing.push(sample.sequence);
      byLabel.set(sample.label, existing);
    }

    // Build labels list and select templates
    this.labels = Array.from(byLabel.keys()).sort();
    this.templates = [];

    for (const label of this.labels) {
      const sequences = byLabel.get(label) ?? [];
      // Take evenly spaced samples if we have more than max
      const step = Math.max(1, Math.floor(sequences.length / this.maxTemplatesPerLabel));
      for (let i = 0; i < sequences.length && this.templates.filter(t => t.label === label).length < this.maxTemplatesPerLabel; i += step) {
        this.templates.push({ label, sequence: sequences[i]! });
      }
    }

    console.log(`DTWClassifier loaded: ${this.templates.length} templates, ${this.labels.length} labels: [${this.labels.join(', ')}]`);
  }

  /**
   * Load templates from a URL (JSON file).
   */
  async loadFromUrl(url: string): Promise<void> {
    const response = await fetch(url);
    const data = await response.json();
    this.loadFromDataset(data);
  }

  getLabels(): ReadonlyArray<string> {
    return this.labels;
  }

  getLabelName(gestureId: number): string {
    return this.labels[gestureId] ?? `gesture_${gestureId}`;
  }

  getTemplateCount(): number {
    return this.templates.length;
  }

  /**
   * Predict gesture from input sequence.
   * Returns probabilities (actually similarity scores) for each label.
   */
  async predict(sequence: ReadonlyArray<ReadonlyArray<number>>): Promise<ReadonlyArray<number>> {
    if (this.templates.length === 0 || sequence.length === 0) {
      return this.labels.map(() => 0);
    }

    // Compute min distance to each label
    const minDistanceByLabel = new Map<string, number>();

    for (const template of this.templates) {
      const distance = dtwDistance(sequence, template.sequence, {
        windowSize: this.windowSize,
      });

      const current = minDistanceByLabel.get(template.label) ?? Infinity;
      if (distance < current) {
        minDistanceByLabel.set(template.label, distance);
      }
    }

    // Convert distances to similarity scores
    const similarities = this.labels.map(label => {
      const distance = minDistanceByLabel.get(label) ?? Infinity;
      // Exponential decay: closer distance = higher similarity
      return Math.exp(-distance / this.distanceScale);
    });

    return similarities;
  }

  /**
   * Quick check if a sequence matches any gesture above threshold.
   */
  async match(sequence: ReadonlyArray<ReadonlyArray<number>>): Promise<{
    label: string;
    similarity: number;
  } | null> {
    const similarities = await this.predict(sequence);

    let bestIdx = 0;
    let bestScore = 0;

    for (let i = 0; i < similarities.length; i++) {
      if ((similarities[i] ?? 0) > bestScore) {
        bestScore = similarities[i] ?? 0;
        bestIdx = i;
      }
    }

    if (bestScore >= this.threshold) {
      return {
        label: this.labels[bestIdx] ?? 'unknown',
        similarity: bestScore,
      };
    }

    return null;
  }
}

/**
 * Create and load a DTW classifier from a dataset URL.
 */
export async function createDTWClassifier(
  datasetUrl: string,
  options?: DTWClassifierOptions
): Promise<DTWClassifier> {
  const classifier = new DTWClassifier(options);
  await classifier.loadFromUrl(datasetUrl);
  return classifier;
}
