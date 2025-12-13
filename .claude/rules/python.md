---
paths: ml/**/*.py
---

# Python Code Style (ML Module)

## General

- Follow PEP 8 style guide
- Use Python 3.8+ features
- No Chinese in code or comments - use English only
- Use type hints for function signatures

## Naming Conventions

- **Functions/Variables**: snake_case (e.g., `load_dataset`, `batch_size`)
- **Classes**: PascalCase (e.g., `GestureClassifier`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_EPOCHS`, `TIME_STEPS`)
- **Private**: Single underscore prefix (e.g., `_preprocess_frame`)

## Imports

```python
# Standard library
import os
import json
from pathlib import Path

# Third-party
import numpy as np
import tensorflow as tf

# Local
from .utils import normalize_landmarks
```

## Type Hints

```python
def train_model(
    data_path: str,
    epochs: int = 50,
    batch_size: int = 32
) -> tf.keras.Model:
    ...
```

## Documentation

- Use docstrings for public functions and classes
- Document parameters, return values, and exceptions
- Include usage examples for complex functions

```python
def load_dataset(path: str) -> tuple[np.ndarray, np.ndarray]:
    """Load gesture dataset from JSON file.

    Args:
        path: Path to the JSON dataset file.

    Returns:
        Tuple of (features, labels) as numpy arrays.

    Raises:
        FileNotFoundError: If dataset file doesn't exist.
    """
```

## ML Best Practices

- Set random seeds for reproducibility
- Log training metrics and hyperparameters
- Save model checkpoints during training
- Validate data shapes before training
- Handle edge cases (empty datasets, single class)

## Data Handling

- Use pathlib.Path for file paths
- Validate JSON structure before processing
- Normalize landmarks consistently (wrist-relative + scale)
- Document expected data format in comments

## Error Handling

```python
# Be explicit about error cases
if len(labels) < 2:
    raise ValueError(
        f"Need at least 2 gesture classes, got {len(labels)}: {labels}"
    )
```
