export type Landmark = {
  x: number;
  y: number;
  z?: number;
};

export type DynamicGesturePrediction = {
  gestureId: number;
  confidence: number;
  probabilities: ReadonlyArray<number>;
};

export interface DynamicGestureClassifier {
  predict(sequence: ReadonlyArray<ReadonlyArray<number>>): Promise<ReadonlyArray<number>>;
}

