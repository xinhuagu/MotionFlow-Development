"""
Export TensorFlow SavedModel to TensorFlow.js format.

Usage:
    cd ml
    python -m export.export_tfjs --input models/saved_model --output ../frontend/public/models/dynamic_gesture
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

import tensorflowjs as tfjs


def main() -> None:
    parser = argparse.ArgumentParser(description="Export SavedModel to TensorFlow.js")
    parser.add_argument(
        "--input",
        type=str,
        default="models/saved_model",
        help="Path to TensorFlow SavedModel directory",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="../frontend/public/models/dynamic_gesture",
        help="Output directory for TFJS model",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"Error: SavedModel not found at {input_path}")
        print("Run training first: python -m train.train")
        sys.exit(1)

    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"Converting {input_path} to TensorFlow.js format...")

    # Convert SavedModel to TFJS
    tfjs.converters.convert_tf_saved_model(
        str(input_path),
        str(output_path),
        skip_op_check=False,
        strip_debug_ops=True,
    )

    print(f"TFJS model exported to: {output_path}")

    # Copy labels.json if it exists
    labels_src = input_path / "labels.json"
    if labels_src.exists():
        labels_dst = output_path / "labels.json"
        shutil.copy(labels_src, labels_dst)
        print(f"Labels copied to: {labels_dst}")

        # Print labels for reference
        with open(labels_src) as f:
            labels_data = json.load(f)
        print(f"Gesture labels: {labels_data.get('labels', [])}")

    print("\nDone! The model is ready to use in the frontend.")
    print("Load it with: await tf.loadGraphModel('/models/dynamic_gesture/model.json')")


if __name__ == "__main__":
    main()
