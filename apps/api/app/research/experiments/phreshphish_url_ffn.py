"""PhreshPhish URL n-gram feed-forward experiment."""

from __future__ import annotations

from app.research.profiles import PROFILE_NAME
from app.research.runner import ExperimentRunResult, run_experiment


def run() -> ExperimentRunResult:
    return run_experiment(PROFILE_NAME)
