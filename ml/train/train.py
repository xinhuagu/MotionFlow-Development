"""
Placeholder training entrypoint.

This will train a temporal gesture classifier on sequences shaped like:
  X: (N, T, 63)  where 63 = 21 landmarks * (x,y,z)
  y: (N,)

Export should produce a TF SavedModel, then converted to TFJS:
  tensorflowjs_converter --input_format=tf_saved_model saved_model_dir output_dir
"""

def main() -> None:
    raise SystemExit("TODO: implement training pipeline in ml/train/")


if __name__ == "__main__":
    main()

