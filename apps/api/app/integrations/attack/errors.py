"""Safe failure reasons for ATT&CK ingestion. Reasons are codes, not response bodies."""


class AttackIngestError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)
