"""S3-compatible object storage (SeaweedFS locally, Cloudflare R2 hosted)."""

from __future__ import annotations

from collections.abc import Iterator
from typing import BinaryIO

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from app.api.errors import ApiError
from app.storage.protocol import ObjectStorage, StoredObjectInfo


class S3ObjectStorage:
    """Private S3-compatible storage backend."""

    def __init__(
        self,
        *,
        endpoint_url: str | None,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        region: str,
        provider_label: str,
    ) -> None:
        self._bucket = bucket
        self._provider_label = provider_label
        self._client: BaseClient = boto3.client(
            "s3",
            endpoint_url=endpoint_url or None,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
        )

    @property
    def provider_label(self) -> str:
        return self._provider_label

    @property
    def bucket(self) -> str:
        return self._bucket

    def put_file(
        self,
        *,
        object_key: str,
        fileobj: BinaryIO,
        content_type: str | None,
        size_bytes: int,
    ) -> StoredObjectInfo:
        extra: dict[str, str] = {}
        if content_type:
            extra["ContentType"] = content_type
        try:
            fileobj.seek(0)
            response = self._client.put_object(
                Bucket=self._bucket,
                Key=object_key,
                Body=fileobj,
                ContentLength=size_bytes,
                **extra,
            )
        except ClientError as exc:
            raise ApiError(
                503,
                "storage_unavailable",
                "Evidence object storage is temporarily unavailable.",
            ) from exc
        return StoredObjectInfo(
            bucket=self._bucket,
            object_key=object_key,
            size_bytes=size_bytes,
            content_type=content_type,
            etag=response.get("ETag"),
        )

    def get_stream(self, *, object_key: str) -> tuple[Iterator[bytes], StoredObjectInfo]:
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=object_key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in {"NoSuchKey", "404", "NotFound"}:
                raise ApiError(
                    404,
                    "not_found",
                    "Evidence object was not found in storage.",
                ) from exc
            raise ApiError(
                503,
                "storage_unavailable",
                "Evidence object storage is temporarily unavailable.",
            ) from exc

        body = response["Body"]
        content_type = response.get("ContentType")
        size_bytes = int(response.get("ContentLength") or 0)
        info = StoredObjectInfo(
            bucket=self._bucket,
            object_key=object_key,
            size_bytes=size_bytes,
            content_type=content_type,
            etag=response.get("ETag"),
        )

        def iterate() -> Iterator[bytes]:
            try:
                while True:
                    chunk = body.read(64 * 1024)
                    if not chunk:
                        break
                    yield chunk
            finally:
                body.close()

        return iterate(), info

    def delete(self, *, object_key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=object_key)
        except ClientError as exc:
            raise ApiError(
                503,
                "storage_unavailable",
                "Evidence object storage is temporarily unavailable.",
            ) from exc

    def exists(self, *, object_key: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=object_key)
            return True
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise ApiError(
                503,
                "storage_unavailable",
                "Evidence object storage is temporarily unavailable.",
            ) from exc

    def ping(self) -> bool:
        try:
            self._client.head_bucket(Bucket=self._bucket)
            return True
        except ClientError:
            try:
                self._client.list_objects_v2(Bucket=self._bucket, MaxKeys=1)
                return True
            except ClientError:
                return False


def ensure_protocol(storage: S3ObjectStorage) -> ObjectStorage:
    return storage
