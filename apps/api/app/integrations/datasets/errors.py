"""Dataset ingestion failures. Messages stay free of file contents and tokens."""


class DatasetError(Exception):
    def __init__(
        self,
        reason: str,
        *,
        revision: str | None = None,
        reference: str | None = None,
        byte_size: int | None = None,
        file_count: int | None = None,
    ) -> None:
        self.reason = reason
        self.revision = revision
        self.reference = reference
        self.byte_size = byte_size
        self.file_count = file_count
        super().__init__(reason)
