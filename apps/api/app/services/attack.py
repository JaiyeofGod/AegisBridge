"""Read the active ATT&CK Enterprise release."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.errors import ApiError, not_found
from app.models.attack_catalog import (
    AttackCatalogTactic,
    AttackCatalogTacticLink,
    AttackCatalogTechnique,
    AttackRelease,
)
from app.schemas.attack import (
    AttackTacticItem,
    AttackTechniqueDetail,
    AttackTechniqueListItem,
    AttackTechniqueParent,
)
from app.schemas.common import ErrorDetail, Page
from app.services.support import PageParams, like_pattern, page, paginate

DOMAIN = "enterprise"
QUERY_LIMIT = 80


def list_tactics(
    session: Session,
    *,
    include_deprecated: bool = False,
) -> list[AttackTacticItem]:
    release = _active_release(session)
    if release is None:
        return []
    statement = select(AttackCatalogTactic).where(AttackCatalogTactic.release_id == release.id)
    if not include_deprecated:
        statement = statement.where(
            AttackCatalogTactic.revoked.is_(False),
            AttackCatalogTactic.deprecated.is_(False),
        )
    rows = session.scalars(statement.order_by(AttackCatalogTactic.external_id)).all()
    return [
        AttackTacticItem(
            id=row.external_id,
            name=row.name,
            short_name=row.short_name,
            release=release.version,
        )
        for row in rows
    ]


def list_techniques(
    session: Session,
    page_params: PageParams,
    *,
    q: str | None = None,
    tactic: str | None = None,
    include_subtechniques: bool = True,
    include_deprecated: bool = False,
) -> Page[AttackTechniqueListItem]:
    release = _active_release(session)
    if release is None:
        return page(page_params, 0, [])
    statement = select(AttackCatalogTechnique).where(
        AttackCatalogTechnique.release_id == release.id
    )
    if not include_deprecated:
        statement = statement.where(
            AttackCatalogTechnique.revoked.is_(False),
            AttackCatalogTechnique.deprecated.is_(False),
        )
    if not include_subtechniques:
        statement = statement.where(AttackCatalogTechnique.is_subtechnique.is_(False))
    if q is not None and q.strip():
        term = _bounded_query(q)
        pattern = like_pattern(term)
        statement = statement.where(
            or_(
                AttackCatalogTechnique.external_id.ilike(pattern, escape="\\"),
                AttackCatalogTechnique.name.ilike(pattern, escape="\\"),
            )
        )
    if tactic is not None and tactic.strip():
        label = tactic.strip().lower()
        statement = (
            statement.join(
                AttackCatalogTacticLink,
                AttackCatalogTacticLink.technique_id == AttackCatalogTechnique.id,
            )
            .join(
                AttackCatalogTactic,
                AttackCatalogTactic.id == AttackCatalogTacticLink.tactic_id,
            )
            .where(
                or_(
                    AttackCatalogTactic.short_name == label,
                    AttackCatalogTactic.external_id.ilike(label),
                    AttackCatalogTactic.name.ilike(label),
                )
            )
        )
    statement = statement.order_by(
        AttackCatalogTechnique.external_id,
        AttackCatalogTechnique.stix_id,
    )
    total, rows = paginate(session, statement, page_params)
    parents = _parents(session, rows)
    tactic_names = _tactic_names(session, rows)
    items = [
        AttackTechniqueListItem(
            id=row.external_id,
            name=row.name,
            is_subtechnique=row.is_subtechnique,
            parent_technique_id=None
            if row.parent_technique_id is None
            else parents.get(row.parent_technique_id),
            tactics=tactic_names.get(row.id, []),
            release=release.version,
        )
        for row in rows
    ]
    return page(page_params, total, items)


def get_technique(session: Session, technique_id: str) -> AttackTechniqueDetail:
    external_id = technique_id.strip().upper()
    release = _active_release(session)
    if release is None:
        raise not_found("ATT&CK technique", external_id)
    row = session.scalar(
        select(AttackCatalogTechnique).where(
            AttackCatalogTechnique.release_id == release.id,
            AttackCatalogTechnique.external_id == external_id,
        )
    )
    if row is None:
        raise not_found("ATT&CK technique", external_id)
    parent = None
    if row.parent_technique_id is not None:
        parent_row = session.get(AttackCatalogTechnique, row.parent_technique_id)
        if parent_row is not None:
            parent = AttackTechniqueParent(id=parent_row.external_id, name=parent_row.name)
    tactics = session.scalars(
        select(AttackCatalogTactic)
        .join(
            AttackCatalogTacticLink,
            AttackCatalogTacticLink.tactic_id == AttackCatalogTactic.id,
        )
        .where(AttackCatalogTacticLink.technique_id == row.id)
        .order_by(AttackCatalogTactic.external_id)
    ).all()
    return AttackTechniqueDetail(
        id=row.external_id,
        name=row.name,
        description=row.description,
        tactics=[
            AttackTacticItem(
                id=tactic.external_id,
                name=tactic.name,
                short_name=tactic.short_name,
                release=release.version,
            )
            for tactic in tactics
        ],
        platforms=list(row.platforms),
        is_subtechnique=row.is_subtechnique,
        parent=parent,
        revoked=row.revoked,
        deprecated=row.deprecated,
        release=release.version,
        modified_at=row.modified_at,
    )


def _active_release(session: Session) -> AttackRelease | None:
    return session.scalar(
        select(AttackRelease).where(
            AttackRelease.domain == DOMAIN,
            AttackRelease.active.is_(True),
        )
    )


def _parents(
    session: Session,
    rows: Sequence[AttackCatalogTechnique],
) -> dict[UUID, str]:
    parent_ids = [row.parent_technique_id for row in rows if row.parent_technique_id is not None]
    if not parent_ids:
        return {}
    parents = session.scalars(
        select(AttackCatalogTechnique).where(AttackCatalogTechnique.id.in_(parent_ids))
    ).all()
    return {row.id: row.external_id for row in parents}


def _tactic_names(
    session: Session,
    rows: Sequence[AttackCatalogTechnique],
) -> dict[UUID, list[str]]:
    technique_ids = [row.id for row in rows]
    if not technique_ids:
        return {}
    pairs = session.execute(
        select(AttackCatalogTacticLink.technique_id, AttackCatalogTactic.short_name)
        .join(
            AttackCatalogTactic,
            AttackCatalogTactic.id == AttackCatalogTacticLink.tactic_id,
        )
        .where(AttackCatalogTacticLink.technique_id.in_(technique_ids))
        .order_by(AttackCatalogTactic.external_id)
    ).all()
    grouped: dict[UUID, list[str]] = {}
    for technique_id, short_name in pairs:
        grouped.setdefault(technique_id, []).append(short_name)
    return grouped


def _bounded_query(value: str) -> str:
    term = value.strip()
    if len(term) > QUERY_LIMIT:
        raise ApiError(
            422,
            "validation_error",
            "q is too long.",
            [ErrorDetail(loc=["query", "q"], message=f"Use at most {QUERY_LIMIT} characters.")],
        )
    return term
