"""Import a pinned ATT&CK Enterprise bundle after the download has finished."""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import TypedDict
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.integrations.attack.errors import AttackIngestError
from app.integrations.attack.http import fetch_attack_bundle
from app.integrations.attack.parse import ParsedCatalog, parse_enterprise_bundle
from app.models.attack_catalog import (
    AttackCatalogTactic,
    AttackCatalogTacticLink,
    AttackCatalogTechnique,
    AttackRelease,
)

logger = logging.getLogger(__name__)

DOMAIN = "enterprise"
SessionFactory = Callable[[], Session]


class AttackSyncResult(TypedDict):
    status: str
    reason: str | None
    release_version: str | None
    fetched_at: str | None
    bundle_sha256: str | None
    tactics_processed: int
    techniques_processed: int
    subtechniques_processed: int
    relationships_processed: int
    revoked_count: int
    deprecated_count: int


def sync_attack_enterprise(
    *,
    session_factory: SessionFactory = SessionLocal,
    payload: bytes | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> AttackSyncResult:
    """Fetch or accept a bundle, then replace the normalized release in one transaction."""
    runtime = settings or get_settings()
    fetched_at = now or datetime.now(UTC)
    try:
        body = payload if payload is not None else fetch_attack_bundle(runtime)
        document = json.loads(body)
        catalog = parse_enterprise_bundle(document, runtime.attack_enterprise_version)
    except AttackIngestError as exc:
        logger.error("ATT&CK Enterprise ingestion failed")
        return _failed(exc.reason)
    except UnicodeDecodeError, json.JSONDecodeError:
        logger.error("ATT&CK Enterprise bundle was not JSON")
        return _failed("malformed_bundle")
    digest = hashlib.sha256(body).hexdigest()
    try:
        _persist(session_factory, catalog, digest, fetched_at)
    except Exception:
        logger.error("ATT&CK Enterprise persistence failed")
        return _failed("persist_error")
    techniques = [item for item in catalog.techniques if not item.is_subtechnique]
    subtechniques = [item for item in catalog.techniques if item.is_subtechnique]
    revoked = _flag_count(catalog, revoked=True)
    deprecated = _flag_count(catalog, revoked=False)
    return {
        "status": "completed",
        "reason": None,
        "release_version": catalog.release_version,
        "fetched_at": fetched_at.isoformat(),
        "bundle_sha256": digest,
        "tactics_processed": len(catalog.tactics),
        "techniques_processed": len(techniques),
        "subtechniques_processed": len(subtechniques),
        "relationships_processed": catalog.relationship_count,
        "revoked_count": revoked,
        "deprecated_count": deprecated,
    }


def _persist(
    session_factory: SessionFactory,
    catalog: ParsedCatalog,
    digest: str,
    fetched_at: datetime,
) -> None:
    with session_factory() as session:
        release = session.scalar(
            select(AttackRelease).where(
                AttackRelease.domain == DOMAIN,
                AttackRelease.version == catalog.release_version,
            )
        )
        if release is None:
            release = AttackRelease(
                domain=DOMAIN,
                version=catalog.release_version,
                source=catalog.source,
                stix_version=catalog.stix_version,
                bundle_sha256=digest,
                fetched_at=fetched_at,
                active=False,
            )
            session.add(release)
            session.flush()
        release.source = catalog.source
        release.stix_version = catalog.stix_version
        release.bundle_sha256 = digest
        release.fetched_at = fetched_at
        _replace_catalog(session, release.id, catalog)
        current = session.scalars(
            select(AttackRelease).where(
                AttackRelease.domain == DOMAIN,
                AttackRelease.active.is_(True),
                AttackRelease.id != release.id,
            )
        )
        for row in current:
            row.active = False
        session.flush()
        release.active = True
        session.commit()


def _replace_catalog(session: Session, release_id: UUID, catalog: ParsedCatalog) -> None:
    technique_ids = select(AttackCatalogTechnique.id).where(
        AttackCatalogTechnique.release_id == release_id
    )
    session.execute(
        update(AttackCatalogTechnique)
        .where(AttackCatalogTechnique.release_id == release_id)
        .values(parent_technique_id=None)
    )
    session.execute(
        delete(AttackCatalogTacticLink).where(
            AttackCatalogTacticLink.technique_id.in_(technique_ids)
        )
    )
    session.execute(
        delete(AttackCatalogTechnique).where(AttackCatalogTechnique.release_id == release_id)
    )
    session.execute(delete(AttackCatalogTactic).where(AttackCatalogTactic.release_id == release_id))
    session.flush()
    tactics = {
        item.short_name: AttackCatalogTactic(
            release_id=release_id,
            stix_id=item.stix_id,
            external_id=item.external_id,
            name=item.name,
            short_name=item.short_name,
            description=item.description,
            object_version=item.object_version,
            modified_at=item.modified_at,
            revoked=item.revoked,
            deprecated=item.deprecated,
        )
        for item in catalog.tactics
    }
    session.add_all(tactics.values())
    technique_rows = {
        item.stix_id: AttackCatalogTechnique(
            release_id=release_id,
            stix_id=item.stix_id,
            external_id=item.external_id,
            name=item.name,
            description=item.description,
            is_subtechnique=item.is_subtechnique,
            platforms=list(item.platforms),
            object_version=item.object_version,
            modified_at=item.modified_at,
            revoked=item.revoked,
            deprecated=item.deprecated,
        )
        for item in catalog.techniques
    }
    session.add_all(technique_rows.values())
    session.flush()
    for item in catalog.techniques:
        if item.parent_stix_id is None:
            continue
        parent = technique_rows.get(item.parent_stix_id)
        if parent is not None:
            technique_rows[item.stix_id].parent_technique_id = parent.id
    for item in catalog.techniques:
        technique = technique_rows[item.stix_id]
        for short_name in item.tactic_short_names:
            tactic = tactics.get(short_name)
            if tactic is None:
                continue
            session.add(AttackCatalogTacticLink(technique_id=technique.id, tactic_id=tactic.id))
    session.flush()


def _flag_count(catalog: ParsedCatalog, *, revoked: bool) -> int:
    if revoked:
        return sum(item.revoked for item in catalog.tactics) + sum(
            item.revoked for item in catalog.techniques
        )
    return sum(item.deprecated for item in catalog.tactics) + sum(
        item.deprecated for item in catalog.techniques
    )


def _failed(reason: str) -> AttackSyncResult:
    return {
        "status": "failed",
        "reason": reason,
        "release_version": None,
        "fetched_at": None,
        "bundle_sha256": None,
        "tactics_processed": 0,
        "techniques_processed": 0,
        "subtechniques_processed": 0,
        "relationships_processed": 0,
        "revoked_count": 0,
        "deprecated_count": 0,
    }
