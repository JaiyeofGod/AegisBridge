"""Tiny CPU model checks. No dataset files and no long training."""

from __future__ import annotations

import numpy as np

from app.research.artifacts import pack_model
from app.research.metrics import classification_metrics, classify
from app.research.model import predict_proba, train_model


def test_model_output_shape_and_seed() -> None:
    features = np.asarray(
        [[1.0, 0.0], [1.0, 0.0], [0.0, 1.0], [0.0, 1.0]],
        dtype=np.float64,
    )
    labels = np.asarray([0.0, 0.0, 1.0, 1.0])
    kwargs = {
        "hidden_units": 4,
        "seed": 7,
        "epochs": 3,
        "batch_size": 2,
        "learning_rate": 0.05,
    }
    first = train_model(features, labels, **kwargs)
    second = train_model(features, labels, **kwargs)
    assert first.parameter_count == 2 * 4 + 4 + 4 * 1 + 1
    probabilities = predict_proba(first, features)
    assert probabilities.shape == (4,)
    assert np.array_equal(first.w1, second.w1)
    assert np.array_equal(first.w2, second.w2)
    assert pack_model(first) == pack_model(second)


def test_threshold_and_confusion_counts() -> None:
    labels = np.asarray([0, 0, 1, 1])
    probabilities = np.asarray([0.2, 0.8, 0.4, 0.9])
    assert classify(probabilities, 0.5).tolist() == [0, 1, 0, 1]
    metrics = classification_metrics(labels, probabilities, threshold=0.5)
    assert metrics["true_negative"] == 1
    assert metrics["false_positive"] == 1
    assert metrics["false_negative"] == 1
    assert metrics["true_positive"] == 1
    assert metrics["confusion_matrix"]["matrix"] == [[1, 1], [1, 1]]
    assert metrics["phishing_caught"] == 1
    assert metrics["phishing_support"] == 2
    assert metrics["benign_false_positives"] == 1
    assert metrics["accuracy"] == 0.5
