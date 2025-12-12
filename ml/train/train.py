"""
Training script for dynamic gesture classifier.

Input: JSON dataset from frontend recorder (motionflow.dynamic_gesture.v1 format)
Output: TensorFlow SavedModel in ml/models/saved_model/

Usage:
    cd ml
    python -m train.train --data data/raw/motionflow_dynamic_gesture_dataset_*.json
"""

import argparse
import glob
import json
import os
import sys
from pathlib import Path

import numpy as np

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def load_dataset(data_paths: list[str]) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Load and merge multiple dataset JSON files."""
    all_samples = []

    for path in data_paths:
        with open(path, "r") as f:
            data = json.load(f)
        if data.get("format") != "motionflow.dynamic_gesture.v1":
            print(f"Warning: {path} has unknown format, skipping")
            continue
        all_samples.extend(data.get("samples", []))

    if not all_samples:
        raise ValueError("No samples found in dataset files")

    # Extract unique labels and create mapping
    unique_labels = sorted(set(s["label"] for s in all_samples))
    label_to_idx = {label: i for i, label in enumerate(unique_labels)}

    print(f"Found {len(all_samples)} samples with {len(unique_labels)} classes: {unique_labels}")

    # Build arrays
    X_list = []
    y_list = []

    for sample in all_samples:
        seq = np.array(sample["sequence"], dtype=np.float32)
        X_list.append(seq)
        y_list.append(label_to_idx[sample["label"]])

    X = np.stack(X_list, axis=0)  # (N, T, 63)
    y = np.array(y_list, dtype=np.int32)  # (N,)

    return X, y, unique_labels


def build_model(time_steps: int, features: int, num_classes: int) -> keras.Model:
    """Build LSTM-based gesture classifier."""
    model = keras.Sequential([
        layers.Input(shape=(time_steps, features)),
        layers.LSTM(64, return_sequences=True),
        layers.Dropout(0.3),
        layers.LSTM(32),
        layers.Dropout(0.3),
        layers.Dense(32, activation="relu"),
        layers.Dense(num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def main() -> None:
    parser = argparse.ArgumentParser(description="Train dynamic gesture classifier")
    parser.add_argument(
        "--data",
        type=str,
        default="data/raw/*.json",
        help="Glob pattern for dataset JSON files",
    )
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size")
    parser.add_argument(
        "--output",
        type=str,
        default="models/saved_model",
        help="Output directory for SavedModel",
    )
    parser.add_argument(
        "--validation-split",
        type=float,
        default=0.2,
        help="Fraction of data for validation",
    )
    args = parser.parse_args()

    # Find dataset files
    data_paths = glob.glob(args.data)
    if not data_paths:
        print(f"Error: No files found matching pattern: {args.data}")
        sys.exit(1)

    print(f"Loading data from {len(data_paths)} file(s)...")
    X, y, labels = load_dataset(data_paths)

    num_classes = len(labels)
    if num_classes < 2:
        print(f"Error: Need at least 2 classes for classification, found {num_classes}: {labels}")
        print("Record more gesture types using the frontend recorder.")
        sys.exit(1)

    _, time_steps, features = X.shape
    print(f"Data shape: X={X.shape}, y={y.shape}")
    print(f"Time steps: {time_steps}, Features: {features}, Classes: {num_classes}")

    # Build and train model
    model = build_model(time_steps, features, num_classes)
    model.summary()

    print(f"\nTraining for {args.epochs} epochs...")
    history = model.fit(
        X,
        y,
        epochs=args.epochs,
        batch_size=args.batch_size,
        validation_split=args.validation_split,
        callbacks=[
            keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=10, restore_best_weights=True
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss", factor=0.5, patience=5, min_lr=1e-6
            ),
        ],
    )

    # Save model
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    model.save(output_dir)
    print(f"\nSavedModel exported to: {output_dir}")

    # Save label mapping
    labels_path = output_dir / "labels.json"
    with open(labels_path, "w") as f:
        json.dump({"labels": labels}, f, indent=2)
    print(f"Labels saved to: {labels_path}")

    # Print final metrics
    final_loss = history.history["loss"][-1]
    final_acc = history.history["accuracy"][-1]
    val_loss = history.history.get("val_loss", [None])[-1]
    val_acc = history.history.get("val_accuracy", [None])[-1]

    print(f"\nFinal metrics:")
    print(f"  Train - Loss: {final_loss:.4f}, Accuracy: {final_acc:.4f}")
    if val_loss is not None:
        print(f"  Val   - Loss: {val_loss:.4f}, Accuracy: {val_acc:.4f}")

    print(f"\nNext step: Run export script to convert to TensorFlow.js format:")
    print(f"  python -m export.export_tfjs --input {args.output} --output ../frontend/public/models/dynamic_gesture")


if __name__ == "__main__":
    main()
