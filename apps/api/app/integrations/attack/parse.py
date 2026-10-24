"""Parse a pinned MITRE ATT&CK Enterprise STIX 2.1 bundle into catalog rows."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.integrations.attack.errors import AttackIngestError

DESCRIPTION_LIMIT = 20_000
NAME_LIMIT = 300
SOURCE_NAME = "mitre-attack"
KILL_CHAIN = "mitre-attack"


@dataclass(frozen=True)
class ParsedTactic:
    stix_id: str
    external_id: str
    name: str
    short_name: str
    description: str | None
    object_version: str | None
    modified_at: datetime | None
    revoked: bool
    deprecated: bool


@dataclass(frozen=True)
class ParsedTechnique:
    stix_id: str
    external_id: str
    name: str
    description: str | None
    is_subtechnique: bool
    parent_stix_id: str | None
    tactic_short_names: tuple[str, ...]
    platforms: tuple[str, ...]
    object_version: str | None
    modified_at: datetime | None
    revoked: bool
    deprecated: bool


@dataclass(frozen=True)
class ParsedCatalog:
    release_version: str
    stix_version: str
    source: str
    tactics: tuple[ParsedTactic, ...]
    techniques: tuple[ParsedTechnique, ...]
    relationship_count: int
    skipped_count: int


def parse_enterprise_bundle(document: object, expected_version: str) -> ParsedCatalog:
    """Validate the Enterprise release, then keep tactics, techniques, and links."""
    if not isinstance(document, dict) or document.get("type") != "bundle":
        raise AttackIngestError("malformed_bundle")
    objects = document.get("objects")
    if not isinstance(objects, list):
        raise AttackIngestError("malformed_bundle")
    spec_version = _stix_spec_version(document, objects)
    release_version = _enterprise_version(objects)
    if release_version != expected_version:
        raise AttackIngestError("version_mismatch")

    tactics: list[ParsedTactic] = []
    techniques: dict[str, ParsedTechnique] = {}
    parents: dict[str, str] = {}
    skipped = 0
    relationship_count = 0
    seen_tactics: set[str] = set()
    for item in objects:
        if not isinstance(item, dict):
            skipped += 1
            continue
        object_type = item.get("type")
        if object_type == "x-mitre-tactic":
            tactic = _tactic(item)
            if tactic is None or tactic.external_id in seen_tactics:
                skipped += int(tactic is None)
                continue
            seen_tactics.add(tactic.external_id)
            tactics.append(tactic)
        elif object_type == "attack-pattern":
            technique = _technique(item)
            if technique is None:
                skipped += 1
                continue
            techniques[technique.stix_id] = technique
        elif object_type == "relationship" and item.get("relationship_type") == "subtechnique-of":
            source_ref = item.get("source_ref")
            target_ref = item.get("target_ref")
            if isinstance(source_ref, str) and isinstance(target_ref, str):
                parents[source_ref] = target_ref
                relationship_count += 1
            else:
                skipped += 1
    if not tactics or not techniques:
        raise AttackIngestError("empty_catalog")
    linked = _attach_parents(techniques, parents)
    tactic_links = sum(len(item.tactic_short_names) for item in linked)
    return ParsedCatalog(
        release_version=release_version,
        stix_version=spec_version,
        source="mitre-attack-enterprise",
        tactics=tuple(tactics),
        techniques=tuple(linked),
        relationship_count=relationship_count + tactic_links,
        skipped_count=skipped,
    )


def _stix_spec_version(document: dict[str, Any], objects: list[object]) -> str:
    """Official ATT&CK bundles put spec_version on objects, not always on the bundle."""
    bundle_spec = document.get("spec_version")
    collection_spec = None
    for item in objects:
        if not isinstance(item, dict) or item.get("type") != "x-mitre-collection":
            continue
        name = str(item.get("name") or "")
        if "enterprise" not in name.casefold():
            continue
        collection_spec = item.get("spec_version")
        break
    if bundle_spec is not None and str(bundle_spec) != "2.1":
        raise AttackIngestError("malformed_bundle")
    if collection_spec is not None and str(collection_spec) != "2.1":
        raise AttackIngestError("malformed_bundle")
    if bundle_spec is None and collection_spec is None:
        raise AttackIngestError("malformed_bundle")
    return "2.1"


def _enterprise_version(objects: list[object]) -> str:
    for item in objects:
        if not isinstance(item, dict) or item.get("type") != "x-mitre-collection":
            continue
        name = str(item.get("name") or "")
        if "enterprise" not in name.casefold():
            continue
        version = str(item.get("x_mitre_version") or "").strip()
        if version:
            return version
    raise AttackIngestError("malformed_bundle")


def _tactic(item: dict[str, Any]) -> ParsedTactic | None:
    stix_id = _stix_id(item)
    external_id = _external_id(item)
    short_name = item.get("x_mitre_shortname")
    name = _text(item.get("name"), 200)
    if (
        stix_id is None
        or external_id is None
        or not external_id.startswith("TA")
        or not isinstance(short_name, str)
        or not short_name.strip()
        or name is None
    ):
        return None
    return ParsedTactic(
        stix_id=stix_id,
        external_id=external_id,
        name=name,
        short_name=short_name.strip().lower()[:80],
        description=_text(item.get("description"), DESCRIPTION_LIMIT),
        object_version=_version(item),
        modified_at=_modified(item.get("modified")),
        revoked=item.get("revoked") is True,
        deprecated=item.get("x_mitre_deprecated") is True,
    )


def _technique(item: dict[str, Any]) -> ParsedTechnique | None:
    stix_id = _stix_id(item)
    external_id = _external_id(item)
    name = _text(item.get("name"), NAME_LIMIT)
    if stix_id is None or external_id is None or not external_id.startswith("T") or name is None:
        return None
    if "." in external_id:
        parent, _, child = external_id.partition(".")
        if not (len(parent) == 5 and child.isdigit() and len(child) == 3):
            return None
    elif len(external_id) != 5:
        return None
    phases = item.get("kill_chain_phases")
    short_names: list[str] = []
    if isinstance(phases, list):
        for phase in phases:
            if not isinstance(phase, dict) or phase.get("kill_chain_name") != KILL_CHAIN:
                continue
            phase_name = phase.get("phase_name")
            if isinstance(phase_name, str) and phase_name.strip():
                cleaned = phase_name.strip().lower()[:80]
                if cleaned not in short_names:
                    short_names.append(cleaned)
    platforms = _platforms(item.get("x_mitre_platforms"))
    return ParsedTechnique(
        stix_id=stix_id,
        external_id=external_id,
        name=name,
        description=_text(item.get("description"), DESCRIPTION_LIMIT),
        is_subtechnique=item.get("x_mitre_is_subtechnique") is True or "." in external_id,
        parent_stix_id=None,
        tactic_short_names=tuple(short_names),
        platforms=platforms,
        object_version=_version(item),
        modified_at=_modified(item.get("modified")),
        revoked=item.get("revoked") is True,
        deprecated=item.get("x_mitre_deprecated") is True,
    )


def _attach_parents(
    techniques: dict[str, ParsedTechnique],
    parents: dict[str, str],
) -> list[ParsedTechnique]:
    by_external = {item.external_id: item.stix_id for item in techniques.values()}
    linked: list[ParsedTechnique] = []
    for technique in techniques.values():
        parent_stix = parents.get(technique.stix_id)
        if parent_stix not in techniques:
            parent_stix = None
        if parent_stix is None and technique.is_subtechnique and "." in technique.external_id:
            parent_external = technique.external_id.split(".", maxsplit=1)[0]
            parent_stix = by_external.get(parent_external)
        linked.append(
            ParsedTechnique(
                stix_id=technique.stix_id,
                external_id=technique.external_id,
                name=technique.name,
                description=technique.description,
                is_subtechnique=technique.is_subtechnique,
                parent_stix_id=parent_stix,
                tactic_short_names=technique.tactic_short_names,
                platforms=technique.platforms,
                object_version=technique.object_version,
                modified_at=technique.modified_at,
                revoked=technique.revoked,
                deprecated=technique.deprecated,
            )
        )
    return linked


def _external_id(item: dict[str, Any]) -> str | None:
    references = item.get("external_references")
    if not isinstance(references, list):
        return None
    for reference in references:
        if not isinstance(reference, dict) or reference.get("source_name") != SOURCE_NAME:
            continue
        external_id = reference.get("external_id")
        if isinstance(external_id, str) and external_id.strip():
            return external_id.strip().upper()[:16]
    return None


def _stix_id(item: dict[str, Any]) -> str | None:
    stix_id = item.get("id")
    if isinstance(stix_id, str) and "--" in stix_id and len(stix_id) <= 160:
        return stix_id
    return None


def _text(value: object, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    return cleaned[:limit]


def _version(item: dict[str, Any]) -> str | None:
    version = item.get("x_mitre_version")
    if isinstance(version, str) and version.strip():
        return version.strip()[:16]
    return None


def _modified(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    raw = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _platforms(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    platforms: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            cleaned = item.strip()[:64]
            if cleaned not in platforms:
                platforms.append(cleaned)
        if len(platforms) == 20:
            break
    return tuple(platforms)
