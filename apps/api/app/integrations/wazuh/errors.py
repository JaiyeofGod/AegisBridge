"""Wazuh adapter failures. Messages stay free of credentials and response bodies."""


class WazuhError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)
