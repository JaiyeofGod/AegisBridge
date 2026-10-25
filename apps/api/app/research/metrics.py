"""Thresholded classification counts. The positive class is phish (1)."""

from __future__ import annotations

from typing import TypedDict

import numpy as np


class Confusion(TypedDict):
    labels: list[str]
    matrix: list[list[int]]
    true_negative: int
    false_positive: int
    false_negative: int
    true_positive: int


class ClassificationMetrics(TypedDict):
    accuracy: float
    precision: float
    recall: float
    f1: float
    true_positive: int
    true_negative: int
    false_positive: int
    false_negative: int
    phishing_caught: int
    phishing_support: int
    benign_false_positives: int
    benign_support: int
    threshold: float
    confusion_matrix: Confusion


def classify(probabilities: np.ndarray, threshold: float) -> np.ndarray:
    return (probabilities >= threshold).astype(np.int64)


def classification_metrics(
    labels: np.ndarray,
    probabilities: np.ndarray,
    *,
    threshold: float,
) -> ClassificationMetrics:
    predicted = classify(probabilities, threshold)
    actual = labels.astype(np.int64)
    true_positive = int(np.sum((actual == 1) & (predicted == 1)))
    true_negative = int(np.sum((actual == 0) & (predicted == 0)))
    false_positive = int(np.sum((actual == 0) & (predicted == 1)))
    false_negative = int(np.sum((actual == 1) & (predicted == 0)))
    total = true_positive + true_negative + false_positive + false_negative
    accuracy = (true_positive + true_negative) / total if total else 0.0
    precision = _ratio(true_positive, true_positive + false_positive)
    recall = _ratio(true_positive, true_positive + false_negative)
    f1 = _ratio(2 * precision * recall, precision + recall) if precision + recall else 0.0
    matrix: list[list[int]] = [
        [true_negative, false_positive],
        [false_negative, true_positive],
    ]
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "true_positive": true_positive,
        "true_negative": true_negative,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "phishing_caught": true_positive,
        "phishing_support": int(np.sum(actual == 1)),
        "benign_false_positives": false_positive,
        "benign_support": int(np.sum(actual == 0)),
        "threshold": threshold,
        "confusion_matrix": {
            "labels": ["benign", "phish"],
            "matrix": matrix,
            "true_negative": true_negative,
            "false_positive": false_positive,
            "false_negative": false_negative,
            "true_positive": true_positive,
        },
    }


def _ratio(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator
