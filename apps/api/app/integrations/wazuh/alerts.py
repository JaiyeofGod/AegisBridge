"""Map one Wazuh indexer hit onto selected security fields.

Unknown ATT&CK ids are kept when they match the T-id shape. Techniques are never
inferred from rule text. Missing optional fields do not reject the alert.
"""

from __future__ import annotations

import ipaddress
import re
from datetime import UTC, datetime
from typing import Any

from app.integrations.wazuh.models import NormalizedWazuhAlert

_TECHNIQUE = re.compile(r"^T\d{4}(?:\.\d{3})?$")
_SUMMARY_LIMIT = 500
_SHORT = 64
_NAME = 128
_AGENT = 16
_RULE = 32
_ID = 64
_LIST = 16
_PLACEHOLDER = "Wazuh security alert"


def normalize_hits(
    hits: tuple[dict[str, Any], ...],
) -> tuple[tuple[NormalizedWazuhAlert, ...], int]:
    alerts: list[NormalizedWazuhAlert] = []
    malformed = 0
    for hit in hits:
        alert = normalize_hit(hit)
        if alert is None:
            malformed += 1
        else:
            alerts.append(alert)
    return tuple(alerts), malformed


def normalize_hit(hit: dict[str, Any]) -> NormalizedWazuhAlert | None:
    source = hit.get("_source")
    if not isinstance(source, dict):
        return None
    source_alert_id = _identity(source.get("id"))
    observed_at = _timestamp(source.get("timestamp"))
    if source_alert_id is None or observed_at is None:
        return None
    rule = source.get("rule")
    rule_body = rule if isinstance(rule, dict) else {}
    description = _text(rule_body.get("description"), _SUMMARY_LIMIT) or _PLACEHOLDER
    return NormalizedWazuhAlert(
        source_alert_id=source_alert_id,
        observed_at=observed_at,
        rule_id=_text(rule_body.get("id"), _RULE),
        rule_level=_level(rule_body.get("level")),
        description=description,
        groups=_strings(rule_body.get("groups"), _SHORT),
        agent_id=_agent_id(source.get("agent")),
        agent_name=_nested_text(source.get("agent"), "name", _NAME),
        manager_name=_nested_text(source.get("manager"), "name", _NAME),
        source_ip=_ip(_nested(source.get("data"), "srcip")),
        destination_ip=_ip(_nested(source.get("data"), "dstip")),
        username=_username(source.get("data")),
        decoder_name=_nested_text(source.get("decoder"), "name", _SHORT),
        technique_ids=_techniques(rule_body.get("mitre")),
        tactics=_tactics(rule_body.get("mitre")),
    )


def _identity(value: object) -> str | None:
    text = _text(value, _ID)
    if text is None or any(char.isspace() for char in text):
        return None
    return text


def _timestamp(value: object) -> datetime | None:
    if not isinstance(value, str) or len(value) > 40:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    if len(text) >= 5 and text[-5] in "+-" and ":" not in text[-5:]:
        text = f"{text[:-2]}:{text[-2:]}"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _level(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if value < 0 or value > 100:
        return None
    return value


def _text(value: object, limit: int) -> str | None:
    if isinstance(value, int) and not isinstance(value, bool):
        value = str(value)
    if not isinstance(value, str):
        return None
    cleaned = "".join(char for char in value if char in "\n\t" or ord(char) >= 32)
    cleaned = " ".join(cleaned.split())
    if not cleaned:
        return None
    return cleaned[:limit]


def _strings(value: object, limit: int) -> tuple[str, ...]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return ()
    items: list[str] = []
    for entry in value:
        text = _text(entry, limit)
        if text is not None and text not in items:
            items.append(text)
        if len(items) == _LIST:
            break
    return tuple(items)


def _nested(value: object, key: str) -> object:
    if not isinstance(value, dict):
        return None
    return value.get(key)


def _nested_text(value: object, key: str, limit: int) -> str | None:
    return _text(_nested(value, key), limit)


def _agent_id(agent: object) -> str | None:
    return _text(_nested(agent, "id"), _AGENT)


def _ip(value: object) -> str | None:
    text = _text(value, 45)
    if text is None:
        return None
    try:
        return str(ipaddress.ip_address(text))
    except ValueError:
        return None


def _username(data: object) -> str | None:
    for key in ("dstuser", "srcuser", "user"):
        text = _text(_nested(data, key), _NAME)
        if text is not None:
            return text
    return None


def _techniques(mitre: object) -> tuple[str, ...]:
    raw = _nested(mitre, "id")
    values = [raw] if isinstance(raw, str) else raw
    if not isinstance(values, list):
        return ()
    found: list[str] = []
    for entry in values:
        text = _text(entry, 16)
        if text is None:
            continue
        token = text.upper()
        if _TECHNIQUE.fullmatch(token) and token not in found:
            found.append(token)
        if len(found) == _LIST:
            break
    return tuple(found)


def _tactics(mitre: object) -> tuple[str, ...]:
    return _strings(_nested(mitre, "tactic"), 80)
