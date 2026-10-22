"""Authenticated governance mutations for control implementations and tests."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import ApiError, not_found
from app.core.config import get_settings
from app.models.evidence import EvidenceControlLink
from app.models.grc import Control, ControlImplementation, ControlTest, FrameworkVersion
from app.models.identity import User
from app.models.policy import Policy, PolicyControlMapping
from app.schemas.common import Page
from app.schemas.governance import (
    ControlDetail,
    ControlEvidenceItem,
    ControlImplementationDetail,
    ControlImplementationUpdate,
    ControlListItem,
    ControlMappedPolicy,
    ControlTestCreate,
    ControlTestItem,
    ControlTestUpdate,
)
from app.security.rbac import AuthenticatedPrincipal
from app.services.audit_write import record_audit_event
from app.services.support import PageParams, next_human_id, page, paginate, person


def list_controls(session: Session, page_params: PageParams) -> Page[ControlListItem]:
    statement = (
        select(Control)
        .options(
            selectinload(Control.framework_version).selectinload(FrameworkVersion.framework),
            selectinload(Control.implementations),
            selectinload(Control.tests),
        )
        .order_by(Control.human_id)
    )
    total, rows = paginate(session, statement, page_params)
    evidence_counts = _evidence_counts(session, [row.id for row in rows])
    return page(
        page_params,
        total,
        [_list_item(row, evidence_counts.get(row.id, 0)) for row in rows],
    )


def get_control(session: Session, control_id: str) -> ControlDetail:
    control = _load_control(session, control_id, for_update=False)
    return _detail(session, control)


def update_control_implementation(
    session: Session,
    principal: AuthenticatedPrincipal,
    control_id: str,
    patch: ControlImplementationUpdate,
) -> ControlDetail:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one implementation field is required.")

    control = _load_control(session, control_id, for_update=True)
    implementation = _current_implementation(session, control, for_update=True)
    if expected is not None:
        _assert_fresh(
            implementation.updated_at,
            expected,
            "The control implementation was modified by another request.",
        )

    changed: list[str] = []
    old_status = implementation.status
    if "status" in payload and implementation.status != payload["status"]:
        implementation.status = payload["status"]
        changed.append("status")
    if "notes" in payload and implementation.notes != payload["notes"]:
        implementation.notes = payload["notes"]
        changed.append("notes")
    if "owner" in payload:
        new_owner_id = _resolve_user_id(session, payload["owner"], field="owner")
        if implementation.owner_user_id != new_owner_id:
            implementation.owner_user_id = new_owner_id
            changed.append("owner")

    implementation.updated_at = datetime.now(UTC)
    control.updated_at = implementation.updated_at
    settings = get_settings()
    detail_parts = [
        f"Updated control implementation fields: {', '.join(changed) if changed else 'none'}."
    ]
    if "status" in changed:
        detail_parts.append(f"status {old_status} -> {implementation.status}.")
    record_audit_event(
        session,
        organization_id=control.organization_id,
        action="CONTROL_IMPLEMENTATION_UPDATE",
        object_type="control",
        object_id=control.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=" ".join(detail_parts),
    )
    session.commit()
    return get_control(session, control_id)


def create_control_test(
    session: Session,
    principal: AuthenticatedPrincipal,
    control_id: str,
    body: ControlTestCreate,
) -> ControlTestItem:
    control = _load_control(session, control_id, for_update=True)
    tester_id = (
        principal.user_id
        if body.tester is None
        else _resolve_user_id(session, body.tester, field="tester")
    )
    if tester_id is None:
        raise ApiError(422, "validation_error", "Tester user was not found.")

    tested_at = body.tested_at or datetime.now(UTC)
    human_id = next_human_id(session, ControlTest.human_id, "CTEST")
    notes = body.notes
    if notes:
        notes = f"[manual development recording] {notes}"
    else:
        notes = "[manual development recording] Manually recorded control test."

    row = ControlTest(
        control_id=control.id,
        tester_user_id=tester_id,
        human_id=human_id,
        result=body.result,
        tested_at=tested_at,
        notes=notes,
    )
    session.add(row)
    session.flush()
    settings = get_settings()
    record_audit_event(
        session,
        organization_id=control.organization_id,
        action="CONTROL_TEST_CREATE",
        object_type="control_test",
        object_id=human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=f"Created manual control test for {control.human_id} with result {body.result}.",
    )
    session.commit()
    return get_control_test(session, human_id)


def update_control_test(
    session: Session,
    principal: AuthenticatedPrincipal,
    test_id: str,
    patch: ControlTestUpdate,
) -> ControlTestItem:
    payload = patch.model_dump(exclude_unset=True)
    expected = payload.pop("expected_updated_at", None)
    if not payload:
        raise ApiError(422, "validation_error", "At least one control-test field is required.")

    row = _load_control_test(session, test_id, for_update=True)
    if expected is not None:
        _assert_fresh(
            row.updated_at,
            expected,
            "The control test was modified by another request.",
        )

    changed: list[str] = []
    old_result = row.result
    if "result" in payload and row.result != payload["result"]:
        row.result = payload["result"]
        changed.append("result")
    if "tested_at" in payload and row.tested_at != payload["tested_at"]:
        row.tested_at = payload["tested_at"]
        changed.append("tested_at")
    if "tester" in payload:
        new_tester = _resolve_user_id(session, payload["tester"], field="tester")
        if row.tester_user_id != new_tester:
            row.tester_user_id = new_tester
            changed.append("tester")
    if "notes" in payload:
        notes = payload["notes"]
        if notes and "[manual development recording]" not in notes:
            notes = f"[manual development recording] {notes}"
        if row.notes != notes:
            row.notes = notes
            changed.append("notes")

    row.updated_at = datetime.now(UTC)
    settings = get_settings()
    detail = f"Updated control test fields: {', '.join(changed) if changed else 'none'}."
    if "result" in changed:
        detail += f" result {old_result} -> {row.result}."
    record_audit_event(
        session,
        organization_id=row.control.organization_id,
        action="CONTROL_TEST_UPDATE",
        object_type="control_test",
        object_id=row.human_id,
        result="success",
        actor_user_id=principal.user_id,
        actor_label=principal.human_id,
        environment_name=settings.app_env,
        detail=detail,
    )
    session.commit()
    return get_control_test(session, test_id)


def get_control_test(session: Session, test_id: str) -> ControlTestItem:
    row = _load_control_test(session, test_id, for_update=False)
    return _test_item(row)


def _load_control(session: Session, control_id: str, *, for_update: bool) -> Control:
    statement = (
        select(Control)
        .where(Control.human_id == control_id)
        .options(
            selectinload(Control.framework_version).selectinload(FrameworkVersion.framework),
            selectinload(Control.implementations).selectinload(ControlImplementation.owner),
            selectinload(Control.tests).selectinload(ControlTest.tester),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    control = session.scalar(statement)
    if control is None:
        raise not_found("Control", control_id)
    return control


def _load_control_test(session: Session, test_id: str, *, for_update: bool) -> ControlTest:
    statement = (
        select(ControlTest)
        .where(ControlTest.human_id == test_id)
        .options(
            selectinload(ControlTest.tester),
            selectinload(ControlTest.control),
        )
    )
    if for_update:
        statement = statement.with_for_update()
    row = session.scalar(statement)
    if row is None:
        raise not_found("Control test", test_id)
    return row


def _current_implementation(
    session: Session, control: Control, *, for_update: bool
) -> ControlImplementation:
    statement = (
        select(ControlImplementation)
        .where(ControlImplementation.control_id == control.id)
        .order_by(ControlImplementation.updated_at.desc(), ControlImplementation.created_at.desc())
        .limit(1)
    )
    if for_update:
        statement = statement.with_for_update()
    implementation = session.scalar(statement)
    if implementation is None:
        raise ApiError(
            404,
            "not_found",
            f"Control {control.human_id} has no implementation record.",
        )
    return implementation


def _list_item(control: Control, evidence_count: int) -> ControlListItem:
    implementation = _latest_impl(control.implementations)
    framework = control.framework_version
    return ControlListItem(
        id=control.human_id,
        control_code=control.control_code,
        title=control.title,
        family=control.family,
        framework_code=None if framework is None else framework.framework.code,
        framework_version=None if framework is None else framework.version_label,
        implementation_status=None if implementation is None else implementation.status,
        test_count=len(control.tests),
        evidence_count=evidence_count,
    )


def _detail(session: Session, control: Control) -> ControlDetail:
    evidence_count = _evidence_counts(session, [control.id]).get(control.id, 0)
    base = _list_item(control, evidence_count)
    implementation = _latest_impl(control.implementations)
    evidence_rows = session.scalars(
        select(EvidenceControlLink)
        .where(EvidenceControlLink.control_id == control.id)
        .options(selectinload(EvidenceControlLink.evidence))
        .order_by(EvidenceControlLink.created_at)
    ).all()
    policy_rows = session.scalars(
        select(PolicyControlMapping)
        .where(PolicyControlMapping.control_id == control.id)
        .options(
            selectinload(PolicyControlMapping.policy).selectinload(Policy.versions),
        )
        .order_by(PolicyControlMapping.created_at)
    ).all()
    return ControlDetail(
        **base.model_dump(),
        implementation=(
            None
            if implementation is None
            else ControlImplementationDetail(
                status=implementation.status,
                notes=implementation.notes,
                owner=person(implementation.owner),
                updated_at=implementation.updated_at,
            )
        ),
        tests=[_test_item(test) for test in sorted(control.tests, key=lambda row: row.tested_at)],
        evidence=[
            ControlEvidenceItem(
                id=link.evidence.human_id,
                title=link.evidence.title,
                sha256=link.evidence.sha256,
                collected_at=link.evidence.collected_at,
            )
            for link in evidence_rows
            if link.evidence is not None
        ],
        policies=[_mapped_policy(link.policy) for link in policy_rows if link.policy is not None],
        licensed_text_included=False,
        updated_at=control.updated_at,
    )


def _mapped_policy(policy: Policy) -> ControlMappedPolicy:
    current = next(
        (version for version in policy.versions if version.is_current),
        None,
    )
    return ControlMappedPolicy(
        id=policy.human_id,
        title=policy.title,
        status=policy.status,
        current_version=None if current is None else current.version_label,
    )


def _test_item(row: ControlTest) -> ControlTestItem:
    return ControlTestItem(
        id=row.human_id,
        control_id=row.control.human_id if row.control is not None else "",
        result=row.result,
        tested_at=row.tested_at,
        tester=person(row.tester),
        notes=row.notes,
        updated_at=row.updated_at,
        recording_mode="manual",
    )


def _latest_impl(rows: list[ControlImplementation]) -> ControlImplementation | None:
    if not rows:
        return None
    return sorted(rows, key=lambda row: (row.updated_at, row.created_at), reverse=True)[0]


def _evidence_counts(session: Session, control_ids: list[UUID]) -> dict[UUID, int]:
    if not control_ids:
        return {}
    rows = session.execute(
        select(EvidenceControlLink.control_id, func.count())
        .where(EvidenceControlLink.control_id.in_(control_ids))
        .group_by(EvidenceControlLink.control_id)
    ).all()
    return {control_id: int(count) for control_id, count in rows}


def _resolve_user_id(session: Session, human_id: str | None, *, field: str) -> UUID | None:
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
