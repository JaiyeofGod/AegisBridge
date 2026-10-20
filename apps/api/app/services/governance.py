"""Governance summary queries. Licensed control text is not stored or returned."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.evidence import Evidence
from app.models.grc import Control, ControlImplementation, ControlTest, FrameworkVersion
from app.models.identity import AccessReview
from app.models.policy import Policy, PolicyVersion
from app.schemas.governance import (
    AccessReviewStatusItem,
    AssessmentWork,
    ControlImplementationCounts,
    EvidenceFreshness,
    FrameworkSummary,
    GovernanceSummary,
    PolicyStatusItem,
)
from app.services.support import person

NOT_APPLICABLE = "not_applicable"
PASS_RESULTS = frozenset({"pass", "passed"})


def get_governance_summary(session: Session) -> GovernanceSummary:
    return GovernanceSummary(
        frameworks=_frameworks(session),
        control_implementations=_implementations(session),
        evidence_freshness=_evidence(session),
        assessment_work=_assessments(session),
        policies=_policies(session),
        access_reviews=_reviews(session),
    )


def _frameworks(session: Session) -> list[FrameworkSummary]:
    versions = session.scalars(
        select(FrameworkVersion)
        .options(
            selectinload(FrameworkVersion.framework),
            selectinload(FrameworkVersion.controls),
        )
        .order_by(FrameworkVersion.version_label)
    ).all()
    return [
        FrameworkSummary(
            code=version.framework.code,
            name=version.framework.name,
            version=version.version_label,
            control_count=len(version.controls),
            licensed_text_included=False,
        )
        for version in versions
    ]


def _implementations(session: Session) -> ControlImplementationCounts:
    statuses = session.scalars(select(ControlImplementation.status)).all()
    results = session.scalars(select(ControlTest.result)).all()
    counts: dict[str, int] = {}
    for status in statuses:
        counts[status] = counts.get(status, 0) + 1
    assessed = sum(1 for status in statuses if status.lower() != NOT_APPLICABLE)
    if not statuses:
        assessed = int(session.scalar(select(func.count()).select_from(Control)) or 0)
    return ControlImplementationCounts(
        by_status=counts,
        tests_passed=sum(1 for result in results if result.lower() in PASS_RESULTS),
        tests_recorded=len(results),
        assessed_applicable=assessed,
    )


def _evidence(session: Session) -> EvidenceFreshness:
    rows = session.scalars(select(Evidence)).all()
    return EvidenceFreshness(
        recorded=len(rows),
        with_sha256=sum(1 for row in rows if row.sha256),
        missing_collected_at=sum(1 for row in rows if row.collected_at is None),
        semantics=(
            "Freshness is collected_at plus SHA-256 presence. "
            "No evidence due date is stored, and file bytes are not returned."
        ),
    )


def _assessments(session: Session) -> AssessmentWork:
    results = session.scalars(select(ControlTest.result).order_by(ControlTest.tested_at)).all()
    return AssessmentWork(tests_recorded=len(results), items=list(results))


def _policies(session: Session) -> list[PolicyStatusItem]:
    policies = session.scalars(
        select(Policy)
        .options(
            selectinload(Policy.owner),
            selectinload(Policy.versions).selectinload(PolicyVersion.acknowledgements),
        )
        .order_by(Policy.human_id)
    ).all()
    items: list[PolicyStatusItem] = []
    for policy in policies:
        current = next((version for version in policy.versions if version.is_current), None)
        if current is None and policy.versions:
            current = policy.versions[0]
        items.append(
            PolicyStatusItem(
                id=policy.human_id,
                title=policy.title,
                status=policy.status,
                current_version=None if current is None else current.version_label,
                acknowledgement_count=0 if current is None else len(current.acknowledgements),
                owner=person(policy.owner),
            )
        )
    return items


def _reviews(session: Session) -> list[AccessReviewStatusItem]:
    reviews = session.scalars(
        select(AccessReview)
        .options(selectinload(AccessReview.findings))
        .order_by(AccessReview.human_id)
    ).all()
    return [
        AccessReviewStatusItem(
            id=review.human_id,
            name=review.name,
            status=review.status,
            open_findings=sum(1 for finding in review.findings if finding.status.lower() == "open"),
            total_findings=len(review.findings),
        )
        for review in reviews
    ]
