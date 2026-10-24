"""Official Hugging Face dataset API for the approved PhreshPhish repository."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from app.core.config import Settings
from app.integrations.datasets.catalog import HUGGINGFACE_HOSTS, PHRESHPHISH_REPO
from app.integrations.datasets.errors import DatasetError
from app.integrations.datasets.hashing import file_sha256
from app.integrations.datasets.models import LocalArtifact, RemoteFile, SourceManifest

_REVISION = re.compile(r"^[0-9a-f]{40}$")
_PARQUET = re.compile(r"^data/[A-Za-z0-9._-]+\.parquet$")


class HuggingFacePhreshPhishSource:
    """Pinned PhreshPhish files. The repository id is fixed in code."""

    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        self._settings = settings
        self._http = httpx.Client(timeout=60.0, follow_redirects=False, transport=transport)
        self._manifest: SourceManifest | None = None

    def close(self) -> None:
        self._http.close()

    def describe(self) -> SourceManifest:
        payload = self._json(f"https://huggingface.co/api/datasets/{PHRESHPHISH_REPO}")
        if not isinstance(payload, dict):
            raise DatasetError("malformed_response")
        info = payload
        revision = info.get("sha")
        if not isinstance(revision, str) or _REVISION.fullmatch(revision) is None:
            raise DatasetError("malformed_revision")
        tree = self._json(
            f"https://huggingface.co/api/datasets/{PHRESHPHISH_REPO}/tree/{revision}/data"
        )
        if not isinstance(tree, list):
            raise DatasetError("malformed_response")
        files: list[RemoteFile] = []
        total = 0
        for item in tree:
            if not isinstance(item, dict):
                continue
            path = item.get("path")
            size = item.get("size")
            if not isinstance(path, str) or _PARQUET.fullmatch(path) is None:
                continue
            if isinstance(size, bool) or not isinstance(size, int) or size < 1:
                raise DatasetError("malformed_response")
            total += size
            files.append(RemoteFile(path=path, size_bytes=size))
        if not files:
            raise DatasetError("no_files")
        manifest = SourceManifest(
            source_type="huggingface",
            repository=PHRESHPHISH_REPO,
            revision=revision,
            files=tuple(files),
            license_label="CC BY 4.0",
            reference=f"https://huggingface.co/datasets/{PHRESHPHISH_REPO}/tree/{revision}",
        )
        if total > self._settings.dataset_max_download_bytes:
            raise DatasetError(
                "too_large",
                revision=revision,
                reference=manifest.reference,
                byte_size=total,
                file_count=len(files),
            )
        self._manifest = manifest
        return manifest

    def download(self, directory: Path) -> tuple[LocalArtifact, ...]:
        manifest = self._manifest or self.describe()
        artifacts: list[LocalArtifact] = []
        remaining = self._settings.dataset_max_download_bytes
        for remote in manifest.files:
            target = directory / Path(remote.path).name
            self._download_one(manifest.revision, remote, target, remaining)
            digest, size = file_sha256(target)
            remaining -= size
            if remaining < 0:
                raise DatasetError("too_large", revision=manifest.revision)
            artifacts.append(
                LocalArtifact(
                    path=target,
                    source_filename=Path(remote.path).name,
                    sha256=digest,
                    size_bytes=size,
                )
            )
        return tuple(artifacts)

    def _download_one(
        self,
        revision: str,
        remote: RemoteFile,
        target: Path,
        remaining: int,
    ) -> None:
        url = f"https://huggingface.co/datasets/{PHRESHPHISH_REPO}/resolve/{revision}/{remote.path}"
        headers = _headers(self._settings.huggingface_token)
        for _ in range(4):
            _require_host(url)
            with self._http.stream("GET", url, headers=headers) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise DatasetError("endpoint_rejected")
                    url = location
                    continue
                if response.status_code != 200:
                    raise DatasetError("http_error")
                size = 0
                with target.open("wb") as handle:
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > remaining:
                            raise DatasetError("too_large")
                        handle.write(chunk)
                return
        raise DatasetError("endpoint_rejected")

    def _json(self, url: str) -> dict[str, object] | list[object]:
        headers = _headers(self._settings.huggingface_token)
        for _ in range(4):
            _require_host(url)
            response = self._http.get(url, headers=headers)
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location")
                if not location:
                    raise DatasetError("endpoint_rejected")
                url = location
                continue
            if response.status_code != 200:
                raise DatasetError("http_error")
            if len(response.content) > 5_000_000:
                raise DatasetError("response_too_large")
            try:
                parsed = json.loads(response.content)
            except json.JSONDecodeError as exc:
                raise DatasetError("malformed_response") from exc
            if not isinstance(parsed, dict | list):
                raise DatasetError("malformed_response")
            return parsed
        raise DatasetError("endpoint_rejected")


def _require_host(url: str) -> None:
    if urlsplit(url).hostname not in HUGGINGFACE_HOSTS:
        raise DatasetError("endpoint_rejected")


def _headers(token: str | None) -> dict[str, str]:
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}
