"""Authenticated policy lifecycle, versioning, and self-acknowledgement."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.identity import User
from app.models.policy import Policy, PolicyAcknowledgement, PolicyVersion
from app.schemas.common import Page
from app.schemas.policies import (
    POLICY_SEMANTICS,
    PolicyAcknowledgementSummary,
    PolicyAcknowledgeResult,
    PolicyCreate,
    PolicyDetail,
    PolicyListItem,
    PolicyTransition,
    PolicyUpdate,
    PolicyVersionCreate,
    PolicyVersionDetail,
    PolicyVersionSummary,
    PolicyVersionUpdate,
)
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import PageParams, next_human_id, page, paginate, person

# (from_status, to_status) → required permission
_POLICY_TRANSITIONS: dict[tuple[str, str], str] = {
    ("draft", "in_review"): "policy.manage",
    ("in_review", "draft"): "policy.manage",
    ("in_review", "approved"): "policy.approve",
    ("approved", "in_review"): "policy.manage",
    ("approved", "published"): "policy.approve",
    # Publish a replacement draft while retaining published history.
    ("published", "published"): "policy.approve",
    ("published", "retired"): "policy.approve",
}


def list_policies(session: Session, page_params: PageParams) -> Page[PolicyListItem]:
    statement = (
        select(Policy)
        .options(
            selectinload(Policy.owner),
            selectinload(Policy.versions).selectinload(PolicyVersion.acknowledgements),
        )
        .order_by(Policy.human_id)
    )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_list_item(row) for row in rows])


def get_policy(
    session: Session,
    policy_id: str,
    *,
    principal: AuthenticatedPrincipal | None = None,
) -> PolicyDetail:
    policy = _load_policy(session, policy_id, for_update=False)
    return _detail(policy, principal=principal)


def list_policy_versions(session: Session, policy_id: str) -> list[PolicyVersionSummary]:
    policy = _load_policy(session, policy_id, for_update=False)
    return [_version_summary(version) for version in policy.versions]


def get_policy_version(
    session: Session,
    policy_id: str,
    version_label: str,
) -> PolicyVersionDetail:
    policy = _load_policy(session, policy_id, for_update=False)
    version = _find_version(policy, version_label)
    return _version_detail(policy, version)


def create_policy(
    session: Session,
    principal: AuthenticatedPrincipal,
    body: PolicyCreate,
) -> PolicyDetail:
    actor = session.get(User, principal.user_id)
    if actor is None:
        raise ApiError(401, "unauthenticated", "Authentication is required.")

    owner_id = (
        principal.user_id if body.owner is None else _resolve_user_id(session, body.owner, "owner")
    )
    human_id = next_human_id(session, Policy.human_id, "POL")
    now = datetime.now(UTC)
    policy = Policy(
        organization_id=actor.organization_id,
        owner_user_id=owner_id,
        human_id=human_id,
        title=body.title.strip(),
        status="draft",
        updated_at=now,
    )
    session.add(policy)
    session.flush()
    version = PolicyVersion(
        policy_id=policy.id,
        version_label=body.initial_version_label.strip(),
        body_summary=body.initial_content,
        change_summary=body.change_summary,
        status="draft",
        is_current=False,
        updated_at=now,
    )
    session.add(version)
    session.flush()

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=actor.organization_id,
        action="POLICY_CREATE",
        object_type="policy",
        object_id=human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Created policy draft with initial version {version.version_label}.",
    )
    record_audit_event(
        session,
        organization_id=actor.organization_id,
        action="POLICY_VERSION_CREATE",
        object_type="policy_version",
        object_id=f"{human_id}:{version.version_label}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Created draft version {version.version_label} for {human_id}.",
    )
    session.commit()
    return get_policy(session, human_id, principal=principal)


def update_policy(
    session: Session,
    principal: AuthenticatedPrincipal,
    policy_id: str,
    patch: PolicyUpdate,
) -> PolicyDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one policy field is required.")

    policy = _load_policy(session, policy_id, for_update=True)
    if policy.status == "retired":
        raise ApiError(409, "conflict", "Retired policies cannot be updated.")
    if expected is not None:
        _assert_fresh(policy.updated_at, expected, "The policy was modified by another request.")

    changed: list[str] = []
    if "title" in payload and policy.title != payload["title"].strip():
        policy.title = payload["title"].strip()
        changed.append("title")
    if "owner" in payload:
        new_owner = _resolve_user_id(session, payload["owner"], "owner")
        if policy.owner_user_id != new_owner:
            policy.owner_user_id = new_owner
            changed.append("owner")

    policy.updated_at = datetime.now(UTC)
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=policy.organization_id,
        action="POLICY_UPDATE",
        object_type="policy",
        object_id=policy.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Updated policy fields: {', '.join(changed) if changed else 'none'}.",
    )
    session.commit()
    return get_policy(session, policy.human_id, principal=principal)


def create_policy_version(
    session: Session,
    principal: AuthenticatedPrincipal,
    policy_id: str,
    body: PolicyVersionCreate,
) -> PolicyVersionDetail:
    policy = _load_policy(session, policy_id, for_update=True)
    if policy.status == "retired":
        raise ApiError(409, "conflict", "Retired policies cannot gain new versions.")

    label = body.version_label.strip()
    if any(version.version_label == label for version in policy.versions):
        raise ApiError(409, "conflict", f"Version {label} already exists for this policy.")

    now = datetime.now(UTC)
    version = PolicyVersion(
        policy_id=policy.id,
        version_label=label,
        body_summary=body.content,
        change_summary=body.change_summary,
        status="draft",
        is_current=False,
        updated_at=now,
    )
    session.add(version)
    policy.updated_at = now
    session.flush()

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=policy.organization_id,
        action="POLICY_VERSION_CREATE",
        object_type="policy_version",
        object_id=f"{policy.human_id}:{label}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Created draft version {label} for {policy.human_id}.",
    )
    session.commit()
    return get_policy_version(session, policy.human_id, label)


def update_policy_version(
    session: Session,
    principal: AuthenticatedPrincipal,
    policy_id: str,
    version_label: str,
    patch: PolicyVersionUpdate,
) -> PolicyVersionDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one version field is required.")

    policy = _load_policy(session, policy_id, for_update=True)
    version = _find_version(policy, version_label, for_update=True)
    if version.status != "draft":
        raise ApiError(
            409,
            "conflict",
            "Only draft versions can be edited. Create a new draft version instead.",
        )
    if expected is not None:
        _assert_fresh(
            version.updated_at,
            expected,
            "The policy version was modified by another request.",
        )

    changed: list[str] = []
    if "content" in payload and version.body_summary != payload["content"]:
        version.body_summary = payload["content"]
        changed.append("content")
    if "change_summary" in payload and version.change_summary != payload["change_summary"]:
        version.change_summary = payload["change_summary"]
        changed.append("change_summary")

    now = datetime.now(UTC)
    version.updated_at = now
    policy.updated_at = now
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=policy.organization_id,
        action="POLICY_VERSION_UPDATE",
        object_type="policy_version",
        object_id=f"{policy.human_id}:{version.version_label}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Updated draft version fields: {', '.join(changed) if changed else 'none'}.",
    )
    session.commit()
    return get_policy_version(session, policy.human_id, version.version_label)


def transition_policy(
    session: Session,
    principal: AuthenticatedPrincipal,
    policy_id: str,
    body: PolicyTransition,
) -> PolicyDetail:
    policy = _load_policy(session, policy_id, for_update=True)
    if body.expected_updated_at is not None:
        _assert_fresh(
            policy.updated_at,
            body.expected_updated_at,
            "The policy was modified by another request.",
        )

    required = _POLICY_TRANSITIONS.get((policy.status, body.to_status))
    if required is None:
        raise ApiError(
            422,
            "validation_error",
            f"Transition from {policy.status} to {body.to_status} is not allowed.",
        )
    if not principal.has_permission(required):
        raise ApiError(403, "forbidden", "You do not have access to this resource.")

    old_status = policy.status
    publish_label: str | None = None
    if body.to_status == "published":
        if not body.version_label or not body.version_label.strip():
            raise ApiError(
                422,
                "validation_error",
                "version_label is required when publishing a policy.",
            )
        publish_label = body.version_label.strip()
        version = _find_version(policy, publish_label, for_update=True)
        if version.status != "draft":
            raise ApiError(
                409,
                "conflict",
                "Only a draft version can be published.",
            )
        _publish_version(policy, version)
    else:
        policy.status = body.to_status

    policy.updated_at = datetime.now(UTC)
    settings = get_settings()
    action = "POLICY_PUBLISH" if body.to_status == "published" else "POLICY_STATUS_TRANSITION"
    if body.to_status == "retired":
        action = "POLICY_RETIRE"
    detail = f"Policy status {old_status} -> {policy.status}."
    if publish_label:
        detail += f" Published version {publish_label}."
    record_audit_event(
        session,
        organization_id=policy.organization_id,
        action=action,
        object_type="policy",
        object_id=policy.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=detail,
    )
    session.commit()
    return get_policy(session, policy.human_id, principal=principal)


def acknowledge_policy(
    session: Session,
    principal: AuthenticatedPrincipal,
    policy_id: str,
) -> PolicyAcknowledgeResult:
    policy = _load_policy(session, policy_id, for_update=True)
    if policy.status != "published":
        raise ApiError(
            409,
            "conflict",
            "Only the currently published policy can be acknowledged.",
        )
    current = next((version for version in policy.versions if version.is_current), None)
    if current is None or current.status != "published":
        raise ApiError(
            409,
            "conflict",
            "No current published version is available for acknowledgement.",
        )

    existing = session.scalar(
        select(PolicyAcknowledgement).where(
            PolicyAcknowledgement.policy_version_id == current.id,
            PolicyAcknowledgement.user_id == principal.user_id,
        )
    )
    if existing is not None:
        return PolicyAcknowledgeResult(
            policy_id=policy.human_id,
            version_label=current.version_label,
            acknowledged=True,
            acknowledged_at=existing.acknowledged_at,
            already_acknowledged=True,
        )

    now = datetime.now(UTC)
    row = PolicyAcknowledgement(
        policy_version_id=current.id,
        user_id=principal.user_id,
        acknowledged_at=now,
    )
    session.add(row)
    try:
        session.flush()
    except IntegrityError as exc:
        raise ApiError(
            409,
            "conflict",
            "Acknowledgement was already recorded for this version.",
        ) from exc

    settings = get_settings()
    record_audit_event(
        session,
        organization_id=policy.organization_id,
        action="POLICY_ACKNOWLEDGE",
        object_type="policy_acknowledgement",
        object_id=f"{policy.human_id}:{current.version_label}",
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"User acknowledged published version {current.version_label}.",
    )
    session.commit()
    return PolicyAcknowledgeResult(
        policy_id=policy.human_id,
        version_label=current.version_label,
        acknowledged=True,
        acknowledged_at=now,
        already_acknowledged=False,
    )


def _publish_version(policy: Policy, version: PolicyVersion) -> None:
    for other in policy.versions:
        if other.id == version.id:
            continue
        if other.is_current or other.status == "published":
            other.is_current = False
            other.status = "superseded"
            other.updated_at = datetime.now(UTC)
    version.status = "published"
    version.is_current = True
    version.updated_at = datetime.now(UTC)
    policy.status = "published"


def _load_policy(session: Session, policy_id: str, *, for_update: bool) -> Policy:
    statement = (
        select(Policy)
        .where(Policy.human_id == policy_id)
        .options(
            selectinload(Policy.owner),
            selectinload(Policy.versions).selectinload(PolicyVersion.acknowledgements),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    policy = session.scalar(statement)
    if policy is None:
        raise not_found("Policy", policy_id)
    return policy


def _find_version(
    policy: Policy,
    version_label: str,
    *,
    for_update: bool = False,
) -> PolicyVersion:
    version = next(
        (item for item in policy.versions if item.version_label == version_label),
        None,
    )
    if version is None:
        raise not_found("Policy version", f"{policy.human_id}/{version_label}")
    if for_update:
        # Row already locked via policy FOR UPDATE; identity map holds the instance.
        pass
    return version


def _list_item(policy: Policy) -> PolicyListItem:
    current = next((version for version in policy.versions if version.is_current), None)
    return PolicyListItem(
        id=policy.human_id,
        title=policy.title,
        status=policy.status,  # type: ignore[arg-type]
        owner=person(policy.owner),
        current_version=None if current is None else current.version_label,
        acknowledgement_count=0 if current is None else len(current.acknowledgements),
        updated_at=policy.updated_at,
    )


def _detail(
    policy: Policy,
    *,
    principal: AuthenticatedPrincipal | None,
) -> PolicyDetail:
    current = next((version for version in policy.versions if version.is_current), None)
    user_ack_at: datetime | None = None
    user_acked = False
    if principal is not None and current is not None:
        match = next(
            (ack for ack in current.acknowledgements if ack.user_id == principal.user_id),
            None,
        )
        if match is not None:
            user_acked = True
            user_ack_at = match.acknowledged_at
    return PolicyDetail(
        id=policy.human_id,
        title=policy.title,
        status=policy.status,  # type: ignore[arg-type]
        owner=person(policy.owner),
        current_version=None if current is None else current.version_label,
        versions=[_version_summary(version) for version in policy.versions],
        acknowledgements=PolicyAcknowledgementSummary(
            current_version_label=None if current is None else current.version_label,
            acknowledgement_count=0 if current is None else len(current.acknowledgements),
            current_user_acknowledged=user_acked,
            current_user_acknowledged_at=user_ack_at,
        ),
        created_at=policy.created_at,
        updated_at=policy.updated_at,
        control_mappings=[],
        semantics=POLICY_SEMANTICS,
    )


def _version_summary(version: PolicyVersion) -> PolicyVersionSummary:
    return PolicyVersionSummary(
        version_label=version.version_label,
        status=version.status,  # type: ignore[arg-type]
        is_current=version.is_current,
        change_summary=version.change_summary,
        acknowledgement_count=len(version.acknowledgements),
        updated_at=version.updated_at,
    )


def _version_detail(policy: Policy, version: PolicyVersion) -> PolicyVersionDetail:
    return PolicyVersionDetail(
        policy_id=policy.human_id,
        version_label=version.version_label,
        status=version.status,  # type: ignore[arg-type]
        is_current=version.is_current,
        content=version.body_summary,
        change_summary=version.change_summary,
        acknowledgement_count=len(version.acknowledgements),
        created_at=version.created_at,
        updated_at=version.updated_at,
    )


def _resolve_user_id(session: Session, human_id: str | None, field: str) -> UUID | None:
    if human_id is None:
        return None
    user = session.scalar(select(User).where(User.human_id == human_id.strip()))
    if user is None:
        raise ApiError(422, "validation_error", f"{field.capitalize()} user was not found.")
    return user.id


def _assert_fresh(current: datetime, expected: datetime, message: str) -> None:
    left = current if current.tzinfo is not None else current.replace(tzinfo=UTC)
    right = expected if expected.tzinfo is not None else expected.replace(tzinfo=UTC)
    if left != right:
        raise ApiError(409, "conflict", message)
