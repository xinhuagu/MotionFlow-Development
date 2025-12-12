# ML (offline only)

This folder is for **offline** model training:
- Dataset preprocessing
- Training temporal gesture classifiers
- Exporting models to TensorFlow.js format for the browser

## Quick Start

### 1. Setup Python Environment

```bash
cd ml
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Record Training Data

Use the frontend recorder (click "NEW MODEL" button) to record dynamic gestures:
- Record at least **2 different gesture types** (e.g., `swipe_left`, `swipe_right`)
- Record **20+ samples per gesture** for better accuracy
- Download the JSON dataset and place it in `ml/data/raw/`

### 3. Train the Model

```bash
cd ml
source venv/bin/activate
python -m train.train --data "data/raw/*.json" --epochs 50
```

Output: `ml/models/saved_model/` (TensorFlow SavedModel)

### 4. Export to TensorFlow.js

```bash
python -m export.export_tfjs \
  --input models/saved_model \
  --output ../frontend/public/models/dynamic_gesture
```

Output: `frontend/public/models/dynamic_gesture/` (model.json + weights)

### 5. Use in Frontend

```typescript
import { createTFJSClassifier, DynamicGestureEngine } from './dynamicGesture';

// Load the model
const classifier = await createTFJSClassifier(
  '/models/dynamic_gesture/model.json',
  '/models/dynamic_gesture/labels.json'
);

// Create engine
const engine = new DynamicGestureEngine(classifier, { timeSteps: 30 });

// In your frame loop:
const prediction = await engine.push(landmarks);
if (prediction) {
  const gestureName = classifier.getLabelName(prediction.gestureId);
  console.log(`Detected: ${gestureName} (${prediction.confidence.toFixed(2)})`);
}
```

## Directory Structure

```
ml/
├── data/
│   ├── raw/          # Raw JSON datasets from frontend recorder
│   └── processed/    # (optional) Preprocessed data
├── train/
│   └── train.py      # Training script
├── export/
│   └── export_tfjs.py # TensorFlow.js export script
├── models/           # (created after training)
│   └── saved_model/  # TensorFlow SavedModel
└── requirements.txt
```

## Runtime Constraints

- The real-time app runs in `frontend/` (TypeScript + MediaPipe)
- Do **not** add runtime communication (HTTP/WebSocket) between `frontend/` and `ml/`
- Models are shared by exporting TFJS artifacts into `frontend/public/models/`
