"""Approved dataset source descriptions. Callers do not supply URLs."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class RemoteFile:
    path: str
    size_bytes: int


@dataclass(frozen=True)
class SourceManifest:
    source_type: str
    repository: str
    revision: str
    files: tuple[RemoteFile, ...]
    license_label: str | None
    reference: str


@dataclass(frozen=True)
class LocalArtifact:
    path: Path
    source_filename: str
    sha256: str
    size_bytes: int


class DatasetSource(Protocol):
    def describe(self) -> SourceManifest: ...

    def download(self, directory: Path) -> tuple[LocalArtifact, ...]: ...
