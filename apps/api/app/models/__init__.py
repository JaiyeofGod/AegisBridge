"""Domain model registry. Importing this package loads every table into metadata."""

from app.models.assets import (
    Asset,
    AssetDataRelationship,
    AssetOwner,
    AssetSoftware,
    AssetType,
    DataAsset,
    SoftwareProduct,
)
from app.models.audit import AuditEvent
from app.models.auth import AuthSession, UserCredential
from app.models.base import Base
from app.models.cyber_range import (
    LabScenario,
    LabScenarioAttackMapping,
    LabScenarioDetection,
    LabScenarioSystem,
    LabSystem,
    LabZone,
)
from app.models.dataset import Dataset, DatasetExperiment, DatasetFile, DatasetVersion
from app.models.detection import (
    AttackTechnique,
    Detection,
    DetectionAttackMapping,
    DetectionVersion,
    ValidationRun,
)
from app.models.evidence import Evidence, EvidenceControlLink, EvidenceRiskLink
from app.models.grc import (
    Control,
    ControlImplementation,
    ControlMapping,
    ControlTest,
    Framework,
    FrameworkVersion,
)
from app.models.identity import (
    AccessEntitlement,
    AccessReview,
    AccessReviewFinding,
    Permission,
    Role,
    User,
    UserRole,
)
from app.models.incident import (
    Incident,
    IncidentEvent,
    IncidentEvidence,
    IncidentIndicator,
    IncidentTask,
)
from app.models.integration import Integration, SyncJob, SyncState
from app.models.organization import BusinessProcess, Department, Organization
from app.models.policy import Policy, PolicyAcknowledgement, PolicyVersion
from app.models.preferences import UserPreferences
from app.models.report import ReportDefinition
from app.models.risk import Risk, RiskAssessment, RiskReview, RiskTreatment
from app.models.soc import AlertReference, Investigation
from app.models.threat_intel import ThreatAdvisory, ThreatIndicator, ThreatIntelSource
from app.models.vendor import Vendor, VendorAssessment, VendorFinding, VendorService
from app.models.vulnerability import (
    AssetVulnerability,
    CveRecord,
    EpssSnapshot,
    KevRecord,
    RemediationTask,
    SsvcAssessment,
    Vulnerability,
    VulnerabilityException,
)

__all__ = [
    "AccessEntitlement",
    "AccessReview",
    "AccessReviewFinding",
    "AlertReference",
    "AuthSession",
    "Asset",
    "AssetDataRelationship",
    "AssetOwner",
    "AssetSoftware",
    "AssetType",
    "AssetVulnerability",
    "AttackTechnique",
    "AuditEvent",
    "Base",
    "BusinessProcess",
    "Control",
    "ControlImplementation",
    "ControlMapping",
    "ControlTest",
    "CveRecord",
    "DataAsset",
    "Dataset",
    "DatasetExperiment",
    "DatasetFile",
    "DatasetVersion",
    "Department",
    "Detection",
    "DetectionAttackMapping",
    "DetectionVersion",
    "EpssSnapshot",
    "Evidence",
    "EvidenceControlLink",
    "EvidenceRiskLink",
    "Framework",
    "FrameworkVersion",
    "Incident",
    "IncidentEvent",
    "IncidentEvidence",
    "IncidentIndicator",
    "IncidentTask",
    "Integration",
    "Investigation",
    "KevRecord",
    "LabScenario",
    "LabScenarioAttackMapping",
    "LabScenarioDetection",
    "LabScenarioSystem",
    "LabSystem",
    "LabZone",
    "Organization",
    "Permission",
    "Policy",
    "PolicyAcknowledgement",
    "PolicyVersion",
    "RemediationTask",
    "ReportDefinition",
    "Risk",
    "RiskAssessment",
    "RiskReview",
    "RiskTreatment",
    "Role",
    "SoftwareProduct",
    "SsvcAssessment",
    "SyncJob",
    "SyncState",
    "ThreatAdvisory",
    "ThreatIndicator",
    "ThreatIntelSource",
    "User",
    "UserCredential",
    "UserPreferences",
    "UserRole",
    "ValidationRun",
    "Vendor",
    "VendorAssessment",
    "VendorFinding",
    "VendorService",
    "Vulnerability",
    "VulnerabilityException",
]
