"""Cyber-range reads. Catalog only; Lenovo stays private and disconnected."""

from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.errors import not_found
from app.models.cyber_range import (
    LabScenario,
    LabScenarioAttackMapping,
    LabScenarioDetection,
    LabScenarioSystem,
    LabSystem,
    LabSystemRelationship,
    LabZone,
)
from app.models.detection import AttackTechnique, Detection, DetectionAttackMapping
from app.models.integration import Integration, SyncState
from app.schemas.common import Page, RelatedRecord
from app.schemas.cyber_range import (
    AttackTechniqueRef,
    CyberRangeSummary,
    LabDetectionItem,
    LabScenarioDetail,
    LabScenarioListItem,
    LabSystemDetail,
    LabSystemListItem,
    LabSystemRelationshipItem,
    LabTelemetryItem,
    LabZoneItem,
)
from app.services.support import PageParams, like_pattern, page, paginate, require_choice

SUMMARY_SEMANTICS = (
    "DEVELOPMENT / SEEDED cyber-range catalog. "
    "MacBook is the development machine. Lenovo is the private cyber-range host. "
    "There is no public inbound access to Lenovo and no remote-control capability in this API. "
    "A future Lab Bridge is outbound-only from the lab to the hosted AegisBridge API. "
    "The hosted app works when the lab is unavailable. "
    "Simulated observed/telemetry labels are hypothetical seed metadata, not live reachability. "
    "Wazuh and Suricata stay not_connected or reference_only unless a stored row says otherwise."
)

RELATIONSHIP_KINDS = frozenset({"connected_to", "depends_on", "manages", "monitors"})
SYSTEM_OBSERVED = frozenset(
    {"not_observed", "simulated_reporting", "simulated_stopped", "reference_only"}
)
TELEMETRY_STATUSES = frozenset({"not_connected", "not_reporting", "simulated", "reference_only"})
SCENARIO_STATUSES = frozenset({"planned", "ready", "simulated", "validated", "retired"})
VALIDATION_STATES = frozenset(
    {"not_validated", "not_run", "partial", "validated", "reference_only"}
)
READY_SCENARIO = frozenset({"ready", "validated"})
ACTIVE_OBSERVED = frozenset({"simulated_reporting"})
ACTIVE_TELEMETRY = frozenset({"simulated"})


def get_summary(session: Session) -> CyberRangeSummary:
    zones = int(session.scalar(select(func.count()).select_from(LabZone)) or 0)
    expected = int(session.scalar(select(func.count()).select_from(LabSystem)) or 0)
    active = int(
        session.scalar(
            select(func.count())
            .select_from(LabSystem)
            .where(LabSystem.observed_state.in_(ACTIVE_OBSERVED))
        )
        or 0
    )
    telemetry_expected = int(
        session.scalar(
            select(func.count())
            .select_from(LabSystem)
            .where(LabSystem.telemetry_expected.is_(True))
        )
        or 0
    )
    telemetry_active = int(
        session.scalar(
            select(func.count())
            .select_from(LabSystem)
            .where(LabSystem.telemetry_status.in_(ACTIVE_TELEMETRY))
        )
        or 0
    )
    scenarios_total = int(session.scalar(select(func.count()).select_from(LabScenario)) or 0)
    scenarios_ready = int(
        session.scalar(
            select(func.count())
            .select_from(LabScenario)
            .where(LabScenario.status.in_(READY_SCENARIO))
        )
        or 0
    )
    detections = int(session.scalar(select(func.count()).select_from(Detection)) or 0)
    bridge_status, bridge_freshness, last_sync = _lab_bridge(session)
    freshness = bridge_freshness or "not_connected"
    if last_sync is None and bridge_status in {"not_connected", "reference_only"}:
        freshness = "not_connected"
    return CyberRangeSummary(
        zone_count=zones,
        expected_system_count=expected,
        active_observed_system_count=active,
        telemetry_active_count=telemetry_active,
        telemetry_expected_count=telemetry_expected,
        scenarios_ready_count=scenarios_ready,
        scenarios_total_count=scenarios_total,
        scenarios_running_count=0,
        detection_coverage_count=detections,
        lab_bridge_status=bridge_status,
        lab_bridge_freshness=bridge_freshness,
        last_successful_lab_sync_at=last_sync,
        freshness_state=freshness,
        data_origin="DEVELOPMENT / SEEDED",
        semantics=SUMMARY_SEMANTICS,
    )


def list_zones(session: Session, page_params: PageParams) -> Page[LabZoneItem]:
    statement = select(LabZone).order_by(LabZone.human_id)
    total, rows = paginate(session, statement, page_params)
    counts = {
        zone_id: count
        for zone_id, count in session.execute(
            select(LabSystem.zone_id, func.count()).group_by(LabSystem.zone_id)
        ).all()
    }
    return page(
        page_params,
        total,
        [
            LabZoneItem(
                id=row.human_id,
                name=row.name,
                cidr=row.cidr,
                gateway=row.gateway,
                purpose=row.purpose,
                status=row.status,
                observed_state=row.observed_state,
                isolation_notes=row.isolation_notes,
                system_count=int(counts.get(row.id, 0)),
                notes=row.notes,
            )
            for row in rows
        ],
    )


def list_systems(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    zone: str | None = None,
    role: str | None = None,
    telemetry_status: str | None = None,
    observed_state: str | None = None,
) -> Page[LabSystemListItem]:
    telemetry_status = require_choice("telemetry_status", telemetry_status, TELEMETRY_STATUSES)
    observed_state = require_choice("observed_state", observed_state, SYSTEM_OBSERVED)
    statement = select(LabSystem).options(selectinload(LabSystem.zone)).order_by(LabSystem.human_id)
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                LabSystem.human_id.ilike(term, escape="\\"),
                LabSystem.hostname.ilike(term, escape="\\"),
                LabSystem.role.ilike(term, escape="\\"),
                LabSystem.ip_address.ilike(term, escape="\\"),
            )
        )
    if zone:
        statement = statement.join(LabZone).where(
            or_(
                func.lower(LabZone.human_id) == zone.strip().lower(),
                func.lower(LabZone.name) == zone.strip().lower(),
            )
        )
    if role:
        statement = statement.where(func.lower(LabSystem.role) == role.strip().lower())
    if telemetry_status:
        statement = statement.where(LabSystem.telemetry_status == telemetry_status)
    if observed_state:
        statement = statement.where(LabSystem.observed_state == observed_state)
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_system_list(row) for row in rows])


def list_system_relationships(
    session: Session, page_params: PageParams
) -> Page[LabSystemRelationshipItem]:
    statement = (
        select(LabSystemRelationship)
        .options(
            selectinload(LabSystemRelationship.source_system),
            selectinload(LabSystemRelationship.target_system),
        )
        .where(LabSystemRelationship.relationship_kind.in_(RELATIONSHIP_KINDS))
        .order_by(LabSystemRelationship.human_id)
    )
    total, rows = paginate(session, statement, page_params)
    return page(
        page_params,
        total,
        [
            LabSystemRelationshipItem(
                id=row.human_id,
                source_system_id=row.source_system.human_id,
                target_system_id=row.target_system.human_id,
                relationship_kind=row.relationship_kind,
            )
            for row in rows
        ],
    )


def get_system(session: Session, system_id: str) -> LabSystemDetail:
    row = session.scalar(
        select(LabSystem)
        .where(LabSystem.human_id == system_id)
        .options(selectinload(LabSystem.zone))
    )
    if row is None:
        raise not_found("Lab system", system_id)
    base = _system_list(row)
    return LabSystemDetail(
        **base.model_dump(),
        telemetry_source=row.telemetry_source,
        telemetry_expected=row.telemetry_expected,
        telemetry_freshness=row.telemetry_freshness,
        telemetry_semantics=row.telemetry_semantics,
    )


def list_scenarios(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    attack_technique: str | None = None,
) -> Page[LabScenarioListItem]:
    status = require_choice("status", status, SCENARIO_STATUSES)
    statement = (
        select(LabScenario)
        .options(
            selectinload(LabScenario.systems).selectinload(LabScenarioSystem.lab_system),
            selectinload(LabScenario.detections).selectinload(LabScenarioDetection.detection),
            selectinload(LabScenario.attack_mappings).selectinload(
                LabScenarioAttackMapping.attack_technique
            ),
        )
        .order_by(LabScenario.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                LabScenario.human_id.ilike(term, escape="\\"),
                LabScenario.name.ilike(term, escape="\\"),
                LabScenario.objective.ilike(term, escape="\\"),
                LabScenario.category.ilike(term, escape="\\"),
            )
        )
    if status:
        statement = statement.where(LabScenario.status == status)
    if category:
        statement = statement.where(func.lower(LabScenario.category) == category.strip().lower())
    if attack_technique:
        technique = attack_technique.strip().upper()
        statement = (
            statement.join(LabScenario.attack_mappings)
            .join(LabScenarioAttackMapping.attack_technique)
            .where(func.upper(AttackTechnique.technique_id) == technique)
            .distinct()
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_scenario_list(row) for row in rows])


def get_scenario(session: Session, scenario_id: str) -> LabScenarioDetail:
    row = session.scalar(
        select(LabScenario)
        .where(LabScenario.human_id == scenario_id)
        .options(
            selectinload(LabScenario.systems).selectinload(LabScenarioSystem.lab_system),
            selectinload(LabScenario.detections).selectinload(LabScenarioDetection.detection),
            selectinload(LabScenario.attack_mappings).selectinload(
                LabScenarioAttackMapping.attack_technique
            ),
        )
    )
    if row is None:
        raise not_found("Lab scenario", scenario_id)
    base = _scenario_list(row)
    return LabScenarioDetail(
        **base.model_dump(),
        expected_telemetry=row.expected_telemetry,
        notes=row.notes,
    )


def list_telemetry(session: Session, page_params: PageParams) -> Page[LabTelemetryItem]:
    statement = select(LabSystem).order_by(LabSystem.human_id)
    total, rows = paginate(session, statement, page_params)
    return page(
        page_params,
        total,
        [
            LabTelemetryItem(
                system_id=row.human_id,
                hostname=row.hostname,
                telemetry_source=row.telemetry_source,
                expected=row.telemetry_expected,
                status=row.telemetry_status,
                last_seen_at=row.last_seen_at,
                freshness=row.telemetry_freshness,
                semantics=row.telemetry_semantics,
            )
            for row in rows
        ],
    )


def list_detections(
    session: Session,
    page_params: PageParams,
    *,
    search: str | None = None,
    validation_state: str | None = None,
    attack_technique: str | None = None,
    data_source: str | None = None,
) -> Page[LabDetectionItem]:
    validation_state = require_choice("validation_state", validation_state, VALIDATION_STATES)
    statement = (
        select(Detection)
        .options(
            selectinload(Detection.attack_mappings).selectinload(
                DetectionAttackMapping.attack_technique
            )
        )
        .order_by(Detection.human_id)
    )
    if search:
        term = like_pattern(search.strip())
        statement = statement.where(
            or_(
                Detection.human_id.ilike(term, escape="\\"),
                Detection.name.ilike(term, escape="\\"),
                Detection.description.ilike(term, escape="\\"),
                Detection.data_source.ilike(term, escape="\\"),
            )
        )
    if validation_state:
        statement = statement.where(Detection.validation_state == validation_state)
    if data_source:
        statement = statement.where(
            func.lower(Detection.data_source) == data_source.strip().lower()
        )
    if attack_technique:
        technique = attack_technique.strip().upper()
        statement = (
            statement.join(Detection.attack_mappings)
            .join(DetectionAttackMapping.attack_technique)
            .where(func.upper(AttackTechnique.technique_id) == technique)
            .distinct()
        )
    total, rows = paginate(session, statement, page_params)
    return page(page_params, total, [_detection(row) for row in rows])


def _lab_bridge(session: Session) -> tuple[str, str | None, datetime | None]:
    row = session.scalar(
        select(Integration)
        .where(Integration.human_id == "INT-0003")
        .options(selectinload(Integration.sync_state))
    )
    if row is None:
        return "not_connected", "not_connected", None
    sync: SyncState | None = row.sync_state
    freshness = None if sync is None else sync.freshness
    last_success = None if sync is None else sync.last_success_at
    return row.status, freshness, last_success


def _system_list(row: LabSystem) -> LabSystemListItem:
    zone = row.zone
    return LabSystemListItem(
        id=row.human_id,
        hostname=row.hostname,
        zone=RelatedRecord(
            id=zone.human_id,
            title=zone.name,
            status=zone.status,
            summary=zone.cidr,
        ),
        ip_address=row.ip_address,
        role=row.role,
        platform=row.platform,
        expected_state=row.expected_state,
        observed_state=row.observed_state,
        telemetry_status=row.telemetry_status,
        last_seen_at=row.last_seen_at,
        source_origin=row.source_origin,
        notes=row.notes,
    )


def _scenario_list(row: LabScenario) -> LabScenarioListItem:
    return LabScenarioListItem(
        id=row.human_id,
        name=row.name,
        objective=row.objective,
        status=row.status,
        category=row.category,
        attack_techniques=[
            AttackTechniqueRef(
                id=link.attack_technique.technique_id,
                name=link.attack_technique.name,
                tactic=link.attack_technique.tactic,
            )
            for link in row.attack_mappings
        ],
        expected_system_ids=sorted(link.lab_system.human_id for link in row.systems),
        expected_detection_ids=sorted(link.detection.human_id for link in row.detections),
        last_run_at=row.last_run_at,
        safety_notes=row.safety_notes,
    )


def _detection(row: Detection) -> LabDetectionItem:
    return LabDetectionItem(
        id=row.human_id,
        name=row.name,
        description=row.description,
        status=row.status,
        data_source=row.data_source,
        sigma_reference=row.sigma_reference,
        wazuh_mapping_status=row.wazuh_mapping_status,
        validation_state=row.validation_state,
        last_validated_at=row.last_validated_at,
        attack_techniques=[
            AttackTechniqueRef(
                id=link.attack_technique.technique_id,
                name=link.attack_technique.name,
                tactic=link.attack_technique.tactic,
            )
            for link in row.attack_mappings
        ],
        notes=row.notes,
    )
