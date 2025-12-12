# ML (offline only)

This folder is for **offline** model work:
- dataset preprocessing / labeling
- training & evaluation
- exporting models for the browser runtime

Runtime constraints:
- The real-time app runs in `frontend/` (TypeScript + MediaPipe).
- Do **not** add any runtime communication (HTTP/WebSocket) between `frontend/` and `ml/`.
- Models are shared by exporting artifacts (e.g. `model.json` + `.bin`) into the frontend.

Recommended workflow (planned):
1) Collect sequences from the frontend (landmarks over time).
2) Train a temporal classifier in Python (e.g. GRU/LSTM on `(T, 63)` sequences).
3) Export to TensorFlow.js format into `frontend/models/` (or `frontend/public/models/` depending on bundling).

