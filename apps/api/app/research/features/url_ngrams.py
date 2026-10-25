"""Deterministic URL character n-gram features.

The stored URL string is the feature text. This module does not resolve names,
open URLs, or lowercase the text.

The released PhreshPhish ``make_ngrams`` loop used ``range(len(text) - n)``, which
drops the final character n-gram. ``reduce_feat_file`` then dropped the most
frequent feature because its new index was 0 and the code tested the index with
truthiness. Both behaviors are corrected here: every window is kept, index 0 is
a real column, and columns are assigned from the training URLs only.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True, slots=True)
class Vocabulary:
    tokens: tuple[str, ...]
    counts: tuple[int, ...]

    def index_of(self) -> dict[str, int]:
        return {token: index for index, token in enumerate(self.tokens)}


def character_ngrams(text: str, ngram_length: int) -> list[str]:
    """Contiguous character windows, including the final window."""
    if ngram_length < 1:
        raise ValueError("ngram_length must be positive")
    if len(text) < ngram_length:
        return []
    last = len(text) - ngram_length
    return [text[start : start + ngram_length] for start in range(last + 1)]


def fit_vocabulary(
    urls: list[str],
    *,
    ngram_length: int,
    min_count_exclusive: int,
    max_features: int,
) -> Vocabulary:
    """Count n-grams on training URLs and assign stable columns.

    Frequency ties break by token text, so the column order does not depend on
    row order. The most frequent token is column 0 and is retained.
    """
    if max_features < 1:
        raise ValueError("max_features must be positive")
    counts: Counter[str] = Counter()
    for url in urls:
        counts.update(character_ngrams(url, ngram_length))
    ranked = [(token, count) for token, count in counts.items() if count > min_count_exclusive]
    ranked.sort(key=lambda item: (-item[1], item[0]))
    kept = ranked[:max_features]
    return Vocabulary(
        tokens=tuple(token for token, _ in kept),
        counts=tuple(count for _, count in kept),
    )


def transform(urls: list[str], vocabulary: Vocabulary, *, ngram_length: int) -> np.ndarray:
    """Binary bag-of-words. Unknown n-grams do not create columns."""
    index = vocabulary.index_of()
    width = len(vocabulary.tokens)
    matrix = np.zeros((len(urls), width), dtype=np.float64)
    for row, url in enumerate(urls):
        for token in set(character_ngrams(url, ngram_length)):
            column = index.get(token)
            if column is not None:
                matrix[row, column] = 1.0
    return matrix
