"""Alert reference queries. Rows are selected metadata, not raw SIEM events."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.assets import Asset
from app.models.attack_catalog import AttackCatalogTechnique, AttackRelease
from app.models.detection import AttackTechnique, Detection, DetectionAttackMapping
from app.models.soc import AlertReference, Investigation
from app.schemas.alerts import AlertDetail, AlertListItem, SourceTechniqueRef
from app.schemas.common import Page
from app.services.support import PageParams, like_pattern, page, paginate, person

SOURCE_OF_RECORD = "wazuh"
STORED_SCOPE = "selected_metadata"


def list_alerts(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    asset: str | None = None,
    attack_technique: str | None = None,
    data_origin: str | None = None,
) -> Page[AlertListItem]:
    statement = (
        select(AlertReference)
        .options(
            selectinload(AlertReference.asset),
            selectinload(AlertReference.detection)
            .selectinload(Detection.attack_mappings)
            .selectinload(DetectionAttackMapping.attack_technique),
            selectinload(AlertReference.investigations).selectinload(Investigation.assignee),
        )
        .order_by(AlertReference.observed_at.desc(), AlertReference.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                AlertReference.summary.ilike(term, escape="\\"),
                AlertReference.human_id.ilike(term, escape="\\"),
                AlertReference.wazuh_alert_id.ilike(term, escape="\\"),
                AlertReference.source_rule_id.ilike(term, escape="\\"),
                AlertReference.detection.has(Detection.name.ilike(term, escape="\\")),
            )
        )
    if severity:
        statement = statement.where(func.lower(AlertReference.severity) == severity.strip().lower())
    if status:
        statement = statement.where(func.lower(AlertReference.status) == status.strip().lower())
    if asset:
        token = asset.strip().lower()
        statement = statement.where(
            AlertReference.asset.has(
                or_(func.lower(Asset.hostname) == token, func.lower(Asset.human_id) == token)
            )
        )
    if data_origin:
        statement = statement.where(
            func.lower(AlertReference.data_origin) == data_origin.strip().lower()
        )
    if attack_technique:
        token = attack_technique.strip()
        statement = statement.where(
            or_(
                AlertReference.detection.has(
                    Detection.attack_mappings.any(
                        DetectionAttackMapping.attack_technique.has(
                            func.lower(AttackTechnique.technique_id) == token.lower()
                        )
                    )
                ),
                AlertReference.attack_technique_ids.contains([token.upper()]),
            )
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_list_item(session, row) for row in rows])


def get_alert(session: Session, alert_id: str) -> AlertDetail:
    alert = session.scalar(
        select(AlertReference)
        .where(AlertReference.human_id == alert_id)
        .options(
            selectinload(AlertReference.asset),
            selectinload(AlertReference.detection).selectinload(Detection.versions),
            selectinload(AlertReference.detection)
            .selectinload(Detection.attack_mappings)
            .selectinload(DetectionAttackMapping.attack_technique),
            selectinload(AlertReference.investigations).selectinload(Investigation.assignee),
        )
    )
    if alert is None:
        raise not_found("Alert", alert_id)
    item = _list_item(session, alert)
    detection = alert.detection
    technique = _technique(session, detection)
    version = _current_version(detection)
    investigation = _investigation(alert)
    return AlertDetail(
        **item.model_dump(),
        detection_status=None if detection is None else detection.status,
        detection_version=None if version is None else version.version_label,
        detection_logic_summary=None if version is None else version.logic_summary,
        attack_version=None if technique is None else technique.attack_version,
        investigation_status=None if investigation is None else investigation.status,
        investigation_summary=None if investigation is None else investigation.summary,
        source_rule_id=alert.source_rule_id,
        source_rule_level=alert.source_rule_level,
        source_agent_id=alert.source_agent_id,
        source_agent_name=alert.source_agent_name,
        source_fetched_at=alert.source_fetched_at,
        source_src_ip=alert.source_src_ip,
        source_dst_ip=alert.source_dst_ip,
        source_username=alert.source_username,
        attack_technique_ids=_source_techniques(session, list(alert.attack_technique_ids or [])),
    )


def _list_item(session: Session, alert: AlertReference) -> AlertListItem:
    detection = alert.detection
    technique = _technique(session, detection)
    investigation = _investigation(alert)
    asset = alert.asset
    return AlertListItem(
        id=alert.human_id,
        severity=alert.severity,
        status=alert.status,
        summary=alert.summary,
        observed_at=alert.observed_at,
        telemetry_source=alert.telemetry_source,
        wazuh_alert_id=alert.wazuh_alert_id,
        source_of_record=SOURCE_OF_RECORD,
        stored_scope=STORED_SCOPE,
        asset_id=None if asset is None else asset.human_id,
        asset_hostname=None if asset is None else asset.hostname,
        detection_id=None if detection is None else detection.human_id,
        detection_name=None if detection is None else detection.name,
        attack_technique_id=None if technique is None else technique.technique_id,
        attack_technique_name=None if technique is None else technique.name,
        attack_tactic=None if technique is None else technique.tactic,
        investigation_id=None if investigation is None else investigation.human_id,
        assignee=None if investigation is None else person(investigation.assignee),
        data_origin=alert.data_origin,
    )


def _technique(session: Session, detection: Detection | None) -> AttackTechnique | None:
    if detection is None or not detection.attack_mappings:
        return None
    mapping = detection.attack_mappings[0]
    if mapping.attack_technique is not None:
        return mapping.attack_technique
    return session.get(AttackTechnique, mapping.attack_technique_id)


def _current_version(detection: Detection | None):
    if detection is None or not detection.versions:
        return None
    current = [item for item in detection.versions if item.is_current]
    return current[0] if current else detection.versions[0]


def _source_techniques(session: Session, identifiers: list[str]) -> list[SourceTechniqueRef]:
    names: dict[str, str] = {}
    if identifiers:
        rows = session.execute(
            select(AttackCatalogTechnique.external_id, AttackCatalogTechnique.name)
            .join(AttackRelease, AttackRelease.id == AttackCatalogTechnique.release_id)
            .where(
                AttackRelease.active.is_(True),
                AttackCatalogTechnique.external_id.in_(identifiers),
            )
        ).all()
        names = {external_id: name for external_id, name in rows}
    return [
        SourceTechniqueRef(id=identifier, name=names.get(identifier)) for identifier in identifiers
    ]


def _investigation(alert: AlertReference) -> Investigation | None:
    if not alert.investigations:
        return None
    return sorted(alert.investigations, key=lambda item: item.opened_at)[-1]
