"""Stable failure codes for threat-feed clients. Messages stay free of payloads."""


class ThreatFeedError(Exception):
    """A source failed before any indicator was accepted."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)
