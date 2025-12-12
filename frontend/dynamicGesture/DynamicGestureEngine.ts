import type { DynamicGestureClassifier, DynamicGesturePrediction, Landmark } from './types';
import { GestureBuffer } from './GestureBuffer';

export type DynamicGestureEngineOptions = {
  timeSteps: number;
  minConfidence?: number;
  cooldownMs?: number;
};

export class DynamicGestureEngine {
  private readonly buffer: GestureBuffer;
  private readonly classifier: DynamicGestureClassifier;
  private readonly minConfidence: number;
  private readonly cooldownMs: number;
  private lastTriggerAt = 0;

  constructor(classifier: DynamicGestureClassifier, options: DynamicGestureEngineOptions) {
    this.classifier = classifier;
    this.buffer = new GestureBuffer({ timeSteps: options.timeSteps });
    this.minConfidence = options.minConfidence ?? 0.8;
    this.cooldownMs = options.cooldownMs ?? 600;
  }

  clear(): void {
    this.buffer.clear();
  }

  async push(landmarks: ReadonlyArray<Landmark>): Promise<DynamicGesturePrediction | null> {
    this.buffer.addFrame(landmarks);
    if (!this.buffer.isReady()) return null;

    const now = Date.now();
    if (now - this.lastTriggerAt < this.cooldownMs) return null;

    const probabilities = await this.classifier.predict(this.buffer.getSequence());
    if (probabilities.length === 0) return null;

    let gestureId = 0;
    let confidence = -Infinity;
    for (let i = 0; i < probabilities.length; i++) {
      const value = probabilities[i] ?? -Infinity;
      if (value > confidence) {
        confidence = value;
        gestureId = i;
      }
    }

    if (confidence < this.minConfidence) return null;

    this.lastTriggerAt = now;
    this.buffer.clear();
    return { gestureId, confidence, probabilities };
  }
}

