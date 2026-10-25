"""Small CPU feed-forward network. NumPy only; no CUDA and no pretrained weights."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

_BETA1 = 0.9
_BETA2 = 0.999
_EPS = 1e-8


@dataclass(slots=True)
class FeedForwardModel:
    w1: np.ndarray
    b1: np.ndarray
    w2: np.ndarray
    b2: np.ndarray
    seed: int

    @property
    def parameter_count(self) -> int:
        return int(self.w1.size + self.b1.size + self.w2.size + self.b2.size)

    @property
    def input_dim(self) -> int:
        return int(self.w1.shape[0])


def seed_generators(seed: int) -> np.random.Generator:
    np.random.seed(seed)
    return np.random.default_rng(seed)


def new_model(input_dim: int, hidden_units: int, seed: int) -> FeedForwardModel:
    generator = seed_generators(seed)
    scale = 1.0 / np.sqrt(input_dim)
    return FeedForwardModel(
        w1=generator.normal(0.0, scale, size=(input_dim, hidden_units)),
        b1=np.zeros(hidden_units, dtype=np.float64),
        w2=generator.normal(0.0, 1.0 / np.sqrt(hidden_units), size=(hidden_units, 1)),
        b2=np.zeros(1, dtype=np.float64),
        seed=seed,
    )


def _sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(values, -40.0, 40.0)))


def predict_proba(model: FeedForwardModel, features: np.ndarray) -> np.ndarray:
    hidden = np.maximum(0.0, features @ model.w1 + model.b1)
    logits = hidden @ model.w2 + model.b2
    return _sigmoid(logits).reshape(-1)


def train_model(
    features: np.ndarray,
    labels: np.ndarray,
    *,
    hidden_units: int,
    seed: int,
    epochs: int,
    batch_size: int,
    learning_rate: float,
) -> FeedForwardModel:
    """Adam and mean binary cross-entropy. The row order is shuffled with ``seed``."""
    if features.ndim != 2 or features.shape[0] != labels.shape[0]:
        raise ValueError("feature and label rows must match")
    if features.shape[0] == 0 or features.shape[1] == 0:
        raise ValueError("training features are empty")
    model = new_model(int(features.shape[1]), hidden_units, seed)
    generator = seed_generators(seed)
    moment_1 = [
        np.zeros_like(model.w1),
        np.zeros_like(model.b1),
        np.zeros_like(model.w2),
        np.zeros_like(model.b2),
    ]
    moment_2 = [np.zeros_like(array) for array in moment_1]
    step = 0
    count = features.shape[0]
    for _epoch in range(epochs):
        order = generator.permutation(count)
        for start in range(0, count, batch_size):
            batch = order[start : start + batch_size]
            step += 1
            _adam_step(
                model,
                features[batch],
                labels[batch],
                moment_1,
                moment_2,
                step,
                learning_rate,
            )
    return model


def _adam_step(
    model: FeedForwardModel,
    features: np.ndarray,
    labels: np.ndarray,
    moment_1: list[np.ndarray],
    moment_2: list[np.ndarray],
    step: int,
    learning_rate: float,
) -> None:
    hidden_pre = features @ model.w1 + model.b1
    hidden = np.maximum(0.0, hidden_pre)
    logits = hidden @ model.w2 + model.b2
    probabilities = _sigmoid(logits)
    delta_out = (probabilities - labels.reshape(-1, 1)) / labels.shape[0]
    grad_w2 = hidden.T @ delta_out
    grad_b2 = delta_out.sum(axis=0)
    delta_hidden = delta_out @ model.w2.T
    delta_hidden[hidden_pre <= 0.0] = 0.0
    grad_w1 = features.T @ delta_hidden
    grad_b1 = delta_hidden.sum(axis=0)
    gradients = (grad_w1, grad_b1, grad_w2, grad_b2)
    parameters = (model.w1, model.b1, model.w2, model.b2)
    correction_1 = 1.0 - _BETA1**step
    correction_2 = 1.0 - _BETA2**step
    for index, (parameter, gradient) in enumerate(zip(parameters, gradients, strict=True)):
        moment_1[index] = _BETA1 * moment_1[index] + (1.0 - _BETA1) * gradient
        moment_2[index] = _BETA2 * moment_2[index] + (1.0 - _BETA2) * np.square(gradient)
        first = moment_1[index] / correction_1
        second = moment_2[index] / correction_2
        parameter -= learning_rate * first / (np.sqrt(second) + _EPS)
