import type { Landmark } from './types';

export type GestureBufferOptions = {
  timeSteps: number;
  landmarksPerHand?: number;
};

export class GestureBuffer {
  private readonly timeSteps: number;
  private readonly landmarksPerHand: number;
  private frames: number[][] = [];

  constructor(options: GestureBufferOptions) {
    this.timeSteps = options.timeSteps;
    this.landmarksPerHand = options.landmarksPerHand ?? 21;
  }

  clear(): void {
    this.frames = [];
  }

  addFrame(landmarks: ReadonlyArray<Landmark>): void {
    if (landmarks.length < this.landmarksPerHand) return;

    const base = landmarks[0];
    const frame: number[] = [];

    for (let i = 0; i < this.landmarksPerHand; i++) {
      const p = landmarks[i];
      frame.push(p.x - base.x, p.y - base.y, (p.z ?? 0) - (base.z ?? 0));
    }

    this.frames.push(frame);
    if (this.frames.length > this.timeSteps) this.frames.shift();
  }

  isReady(): boolean {
    return this.frames.length === this.timeSteps;
  }

  getSequence(): ReadonlyArray<ReadonlyArray<number>> {
    return this.frames;
  }
}

