"""Normalized Wazuh alert fields. This is not a raw indexer document."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


class NormalizedWazuhAlert:
    """Selected security metadata copied from one indexer hit."""

    __slots__ = (
        "agent_id",
        "agent_name",
        "decoder_name",
        "description",
        "destination_ip",
        "groups",
        "manager_name",
        "observed_at",
        "rule_id",
        "rule_level",
        "source_alert_id",
        "source_ip",
        "tactics",
        "technique_ids",
        "username",
    )

    def __init__(
        self,
        *,
        source_alert_id: str,
        observed_at: datetime,
        rule_id: str | None,
        rule_level: int | None,
        description: str,
        groups: tuple[str, ...],
        agent_id: str | None,
        agent_name: str | None,
        manager_name: str | None,
        source_ip: str | None,
        destination_ip: str | None,
        username: str | None,
        decoder_name: str | None,
        technique_ids: tuple[str, ...],
        tactics: tuple[str, ...],
    ) -> None:
        self.source_alert_id = source_alert_id
        self.observed_at = observed_at
        self.rule_id = rule_id
        self.rule_level = rule_level
        self.description = description
        self.groups = groups
        self.agent_id = agent_id
        self.agent_name = agent_name
        self.manager_name = manager_name
        self.source_ip = source_ip
        self.destination_ip = destination_ip
        self.username = username
        self.decoder_name = decoder_name
        self.technique_ids = technique_ids
        self.tactics = tactics


@dataclass(frozen=True)
class RawAlertPage:
    """Indexer hits before field normalization. `_source` objects only."""

    hits: tuple[dict[str, Any], ...]
    total: int
    omitted: int = 0


class WazuhAlertClient(Protocol):
    def search(self, *, since: datetime, limit: int) -> RawAlertPage: ...

    def close(self) -> None: ...
