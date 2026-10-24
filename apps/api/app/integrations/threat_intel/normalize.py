"""Conservative indicator normalization. Invalid values are rejected, not coerced."""

from __future__ import annotations

import ipaddress
import re
from datetime import UTC, datetime
from urllib.parse import urlsplit, urlunsplit

_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
_RECORD_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")
_STATUS = re.compile(r"[a-z0-9_-]{1,32}")
_HASH_LENGTH = {"md5": 32, "sha1": 40, "sha256": 64}
_COARSE = {
    "ipv4": "ip",
    "ipv6": "ip",
    "domain": "domain",
    "hostname": "domain",
    "url": "url",
    "md5": "file_hash",
    "sha1": "file_hash",
    "sha256": "file_hash",
}
MAX_VALUE = 2048
MAX_TAGS = 16
MAX_TAG = 64


def coarse_type(subtype: str) -> str:
    return _COARSE[subtype]


def parse_source_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S UTC", "%Y-%m-%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return parsed.replace(tzinfo=UTC)
    return None


def bounded_text(value: object, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = "".join(char for char in value if ord(char) >= 32).strip()
    if not cleaned:
        return None
    return cleaned[:limit]


def source_tags(value: object) -> tuple[str, ...]:
    raw: list[str] = []
    if isinstance(value, str):
        if not value.strip() or value.strip().lower() == "none":
            return ()
        raw = [part.strip() for part in value.split(",")]
    elif isinstance(value, list):
        raw = [item.strip() for item in value if isinstance(item, str)]
    kept: list[str] = []
    for item in raw:
        if not item or len(item) > MAX_TAG or any(ord(char) < 32 for char in item):
            continue
        kept.append(item)
        if len(kept) == MAX_TAGS:
            break
    return tuple(kept)


def source_confidence(value: object) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int) and 0 <= value <= 100:
        return value
    if isinstance(value, str) and value.strip().isdigit():
        number = int(value.strip())
        if 0 <= number <= 100:
            return number
    return None


def source_record_id(value: object) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and 0 <= value < 10**18:
        return str(value)
    if isinstance(value, str) and _RECORD_ID.fullmatch(value.strip()):
        return value.strip()
    return None


def public_https_url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text or len(text) > 500:
        return None
    parts = urlsplit(text)
    host = parts.hostname
    if parts.scheme != "https" or parts.username or parts.password or host is None:
        return None
    if not host.isascii():
        return None
    return text


def source_status(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip().lower()
    if _STATUS.fullmatch(text):
        return text
    return None


def normalize_domain(value: str) -> str | None:
    text = value.strip().lower().rstrip(".")
    if not text or len(text) > 253 or "." not in text:
        return None
    labels = text.split(".")
    if any(not _LABEL.fullmatch(label) for label in labels):
        return None
    return text


def normalize_ip(value: str) -> tuple[str, str] | None:
    try:
        parsed = ipaddress.ip_address(value.strip())
    except ValueError:
        return None
    subtype = "ipv4" if parsed.version == 4 else "ipv6"
    return subtype, str(parsed)


def normalize_ip_port(value: str) -> tuple[str, str] | None:
    text = value.strip()
    if text.startswith("["):
        end = text.find("]")
        if end < 2 or not text[end:].startswith("]:"):
            return None
        host = text[1:end]
        port_text = text[end + 2 :]
    elif text.count(":") == 1:
        host, port_text = text.split(":", 1)
    else:
        return None
    if not port_text.isdigit():
        return None
    port = int(port_text)
    if port < 1 or port > 65535:
        return None
    parsed = normalize_ip(host)
    if parsed is None:
        return None
    subtype, address = parsed
    if subtype == "ipv6":
        return subtype, f"[{address}]:{port}"
    return subtype, f"{address}:{port}"


def normalize_hash(value: str, subtype: str) -> str | None:
    text = value.strip().lower()
    expected = _HASH_LENGTH.get(subtype)
    if expected is None or len(text) != expected:
        return None
    if any(char not in "0123456789abcdef" for char in text):
        return None
    return text


def normalize_url(value: str) -> str | None:
    text = value.strip()
    if not text or len(text) > MAX_VALUE or any(ord(char) < 32 for char in text):
        return None
    parts = urlsplit(text)
    host = parts.hostname
    if parts.scheme.lower() not in {"http", "https"} or parts.username or parts.password:
        return None
    if host is None or not host.isascii():
        return None
    normalized_host = host.lower().rstrip(".")
    if normalize_domain(normalized_host) is None and normalize_ip(normalized_host) is None:
        return None
    port = f":{parts.port}" if parts.port else ""
    bracketed = f"[{normalized_host}]{port}"
    plain = f"{normalized_host}{port}"
    netloc = bracketed if ":" in normalized_host else plain
    normalized = urlunsplit((parts.scheme.lower(), netloc, parts.path, parts.query, parts.fragment))
    if len(normalized) > MAX_VALUE:
        return None
    return normalized
