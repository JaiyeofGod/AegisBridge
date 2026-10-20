"""Asset read queries."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.assets import Asset, AssetOwner, AssetSoftware, AssetType
from app.models.evidence import Evidence, EvidenceControlLink, EvidenceRiskLink
from app.models.grc import Control
from app.models.risk import Risk
from app.models.soc import AlertReference
from app.models.vulnerability import AssetVulnerability
from app.schemas.assets import AssetDetail, AssetListItem
from app.schemas.common import Page, PersonRef, RelatedRecord
from app.services.support import PageParams, like_pattern, page, paginate, person


def list_assets(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    asset_type: str | None = None,
    criticality: str | None = None,
    environment: str | None = None,
    telemetry_status: str | None = None,
) -> Page[AssetListItem]:
    statement = (
        select(Asset)
        .join(Asset.asset_type)
        .options(
            selectinload(Asset.asset_type),
            selectinload(Asset.owners).selectinload(AssetOwner.user),
        )
        .order_by(Asset.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                Asset.hostname.ilike(term, escape="\\"),
                Asset.name.ilike(term, escape="\\"),
                Asset.human_id.ilike(term, escape="\\"),
            )
        )
    if asset_type:
        token = asset_type.strip().lower()
        statement = statement.where(
            or_(func.lower(AssetType.code) == token, func.lower(AssetType.name) == token)
        )
    if criticality:
        statement = statement.where(func.lower(Asset.criticality) == criticality.strip().lower())
    if environment:
        statement = statement.where(
            func.lower(Asset.environment_name) == environment.strip().lower()
        )
    if telemetry_status:
        statement = statement.where(
            func.lower(Asset.telemetry_status) == telemetry_status.strip().lower()
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_list_item(row) for row in rows])


def get_asset(session: Session, asset_id: str) -> AssetDetail:
    asset = session.scalar(
        select(Asset)
        .where(Asset.human_id == asset_id)
        .options(
            selectinload(Asset.asset_type),
            selectinload(Asset.owners).selectinload(AssetOwner.user),
            selectinload(Asset.software_links).selectinload(AssetSoftware.software_product),
        )
    )
    if asset is None:
        raise not_found("Asset", asset_id)
    findings = session.scalars(
        select(AssetVulnerability)
        .where(AssetVulnerability.asset_id == asset.id)
        .options(selectinload(AssetVulnerability.vulnerability))
        .order_by(AssetVulnerability.status)
    ).all()
    alerts = session.scalars(
        select(AlertReference)
        .where(AlertReference.asset_id == asset.id)
        .order_by(AlertReference.human_id)
    ).all()
    risks = session.scalars(
        select(Risk).where(Risk.asset_id == asset.id).order_by(Risk.human_id)
    ).all()
    evidence_rows = (
        session.scalars(
            select(Evidence)
            .join(EvidenceRiskLink, EvidenceRiskLink.evidence_id == Evidence.id)
            .join(Risk, Risk.id == EvidenceRiskLink.risk_id)
            .where(Risk.asset_id == asset.id)
            .order_by(Evidence.human_id)
        )
        .unique()
        .all()
    )
    controls = (
        session.scalars(
            select(Control)
            .join(EvidenceControlLink, EvidenceControlLink.control_id == Control.id)
            .join(Evidence, Evidence.id == EvidenceControlLink.evidence_id)
            .join(EvidenceRiskLink, EvidenceRiskLink.evidence_id == Evidence.id)
            .join(Risk, Risk.id == EvidenceRiskLink.risk_id)
            .where(Risk.asset_id == asset.id)
            .order_by(Control.human_id)
        )
        .unique()
        .all()
    )
    item = _list_item(asset)
    software = [
        f"{link.software_product.name} {link.software_product.version_label}"
        for link in asset.software_links
    ]
    return AssetDetail(
        **item.model_dump(),
        os_version=asset.os_version,
        ip_address=asset.ip_address,
        data_classification=asset.data_classification,
        software=software,
        vulnerabilities=[
            RelatedRecord(
                id=finding.vulnerability.human_id,
                title=finding.vulnerability.title,
                status=finding.status,
                summary=f"Exposure {finding.exposure}; criticality {finding.asset_criticality}.",
            )
            for finding in findings
        ],
        alerts=[
            RelatedRecord(id=alert.human_id, title=alert.summary, status=alert.status)
            for alert in alerts
        ],
        risks=[
            RelatedRecord(id=risk.human_id, title=risk.title, status=risk.status) for risk in risks
        ],
        controls=[
            RelatedRecord(
                id=control.human_id,
                title=f"{control.control_code} {control.title}",
                summary="Linked through evidence on a risk for this asset.",
            )
            for control in controls
        ],
        evidence=[
            RelatedRecord(
                id=item_evidence.human_id,
                title=item_evidence.title,
                summary="Metadata only. File bytes are not stored in the API.",
            )
            for item_evidence in evidence_rows
        ],
    )


def _list_item(asset: Asset) -> AssetListItem:
    primary = next((owner for owner in asset.owners if owner.owner_role == "business"), None)
    if primary is None and asset.owners:
        primary = asset.owners[0]
    owner: PersonRef | None = None
    if primary is not None and primary.user is not None:
        owner = person(primary.user)
    elif primary is not None:
        owner = PersonRef(id=primary.owner_label, display_name=primary.owner_label)
    return AssetListItem(
        id=asset.human_id,
        hostname=asset.hostname,
        name=asset.name,
        asset_type=asset.asset_type.name,
        asset_type_code=asset.asset_type.code,
        criticality=asset.criticality,
        exposure=asset.exposure,
        environment=asset.environment_name,
        telemetry_status=asset.telemetry_status,
        lifecycle=asset.lifecycle,
        platform=asset.platform,
        last_seen_at=asset.last_seen_at,
        owner=owner,
    )
