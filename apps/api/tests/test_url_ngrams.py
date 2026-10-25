"""URL n-gram indexing. These tests do not read a real dataset."""

from __future__ import annotations

from app.research.features.url_ngrams import character_ngrams, fit_vocabulary, transform


def test_same_ngram_keeps_the_same_index() -> None:
    urls = ["abcdefghij"] * 3
    vocabulary = fit_vocabulary(urls, ngram_length=4, min_count_exclusive=0, max_features=20)
    first = transform(urls[:1], vocabulary, ngram_length=4)
    second = transform(urls[1:2], vocabulary, ngram_length=4)
    assert first.shape == second.shape
    assert (first == second).all()
    assert vocabulary.index_of()["abcd"] == vocabulary.tokens.index("abcd")


def test_vocabulary_is_deterministic_and_independent_of_row_order() -> None:
    left = ["abcdefghij", "wxyzabcdefgh"]
    right = list(reversed(left))
    kwargs = {"ngram_length": 4, "min_count_exclusive": 0, "max_features": 50}
    assert fit_vocabulary(left, **kwargs).tokens == fit_vocabulary(right, **kwargs).tokens
    assert fit_vocabulary(left, **kwargs).tokens == fit_vocabulary(left, **kwargs).tokens


def test_final_character_ngram_is_kept() -> None:
    assert character_ngrams("abcdef", 4) == ["abcd", "bcde", "cdef"]


def test_index_zero_is_a_real_column() -> None:
    urls = ["aaaa" * 4] * 3 + ["bbbb"]
    vocabulary = fit_vocabulary(urls, ngram_length=4, min_count_exclusive=0, max_features=10)
    assert vocabulary.tokens[0] == "aaaa"
    matrix = transform(urls[:1], vocabulary, ngram_length=4)
    assert matrix.shape == (1, len(vocabulary.tokens))
    assert matrix[0, 0] == 1.0


def test_test_rows_do_not_expand_the_vocabulary() -> None:
    train = ["abcdefghij"] * 4
    test = ["zzzzzzzzzz"]
    vocabulary = fit_vocabulary(train, ngram_length=4, min_count_exclusive=0, max_features=20)
    assert "zzzz" not in vocabulary.tokens
    matrix = transform(test, vocabulary, ngram_length=4)
    assert matrix.shape == (1, len(vocabulary.tokens))
    assert float(matrix.sum()) == 0.0


def test_frequency_ties_use_token_order() -> None:
    vocabulary = fit_vocabulary(
        ["bbbb", "aaaa"],
        ngram_length=4,
        min_count_exclusive=0,
        max_features=10,
    )
    assert vocabulary.tokens == ("aaaa", "bbbb")
