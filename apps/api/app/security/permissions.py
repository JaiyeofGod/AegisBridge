"""Deterministic permission catalog and seven-role mapping.

Capability codes are the authorization source of truth for domain route
enforcement via ``require_permissions`` / ``require_any_permission``.
`access_entitlements` remain stored labels aligned to this catalog; they are not
an independent policy engine.
"""

from __future__ import annotations

from typing import Final

# Sensitive action codes required by SECURITY_REQUIREMENTS.md / master §103.
SENSITIVE_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        "risk.accept",
        "control.update",
        "evidence.download",
        "incident.close",
        "integration.manage",
        "user.role.manage",
        "detection.manage",
        "policy.approve",
    }
)

PERMISSION_CATALOG: Final[dict[str, str]] = {
    "asset.read": "Read asset inventory records.",
    "risk.read": "Read risk register records.",
    "risk.manage": "Create or update risk treatments outside acceptance.",
    "risk.accept": "Accept residual risk.",
    "control.read": "Read control catalog and implementations.",
    "control.manage": "Update control implementations outside dedicated update.",
    "control.update": "Update control status and implementation fields.",
    "policy.read": "Read policy library metadata and versions.",
    "policy.manage": "Create and edit policy drafts and metadata.",
    "policy.approve": "Approve, publish, or retire policies.",
    "evidence.read": "Read evidence metadata.",
    "evidence.manage": "Upload or link evidence metadata.",
    "evidence.download": "Download evidence objects.",
    "vulnerability.read": "Read vulnerability findings and factors.",
    "vulnerability.manage": "Update remediation and exception workflows.",
    "alert.read": "Read SOC alert references.",
    "detection.read": "Read detection catalog metadata.",
    "detection.manage": "Manage detection configuration.",
    "incident.read": "Read incident records.",
    "incident.manage": "Update incident tasks and timeline entries.",
    "incident.close": "Close incidents.",
    "directory.read": "Read active users in the caller's organization for operational selection.",
    "threat_intel.read": "Read threat-intelligence catalog rows.",
    "administration.read": "Read administration catalogs.",
    "administration.manage": "Manage platform administration settings.",
    "integration.read": "Read integration catalog status.",
    "integration.manage": "Configure integrations.",
    "user.role.manage": "Assign roles to users.",
    "report.read": "Read report definitions.",
    "report.manage": "Manage report definitions.",
    "dataset.read": "Read dataset registry metadata.",
    "dataset.manage": "Manage dataset registry metadata.",
    "cyber_range.read": "Read cyber-range catalog metadata.",
    "cyber_range.manage": "Create, update, or delete documented cyber-range catalog relationships.",
    "audit.read": "Read audit history.",
}

ROLE_PERMISSIONS: Final[dict[str, frozenset[str]]] = {
    "Administrator": frozenset(PERMISSION_CATALOG.keys()),
    "CISO": frozenset(
        {
            "asset.read",
            "risk.read",
            "control.read",
            "policy.read",
            "policy.approve",
            "evidence.read",
            "vulnerability.read",
            "alert.read",
            "detection.read",
            "incident.read",
            "threat_intel.read",
            "administration.read",
            "integration.read",
            "report.read",
            "dataset.read",
            "cyber_range.read",
            "audit.read",
        }
    ),
    "GRC Analyst": frozenset(
        {
            "asset.read",
            "risk.read",
            "risk.manage",
            "risk.accept",
            "control.read",
            "control.manage",
            "control.update",
            "policy.read",
            "policy.manage",
            "evidence.read",
            "evidence.manage",
            "evidence.download",
            "vulnerability.read",
            "directory.read",
            "report.read",
            "report.manage",
            "dataset.read",
            "audit.read",
        }
    ),
    "SOC Analyst": frozenset(
        {
            "asset.read",
            "policy.read",
            "alert.read",
            "detection.read",
            "incident.read",
            "incident.manage",
            "incident.close",
            "directory.read",
            "threat_intel.read",
            "vulnerability.read",
            "cyber_range.read",
            "report.read",
        }
    ),
    "Security Engineer": frozenset(
        {
            "asset.read",
            "policy.read",
            "vulnerability.read",
            "vulnerability.manage",
            "detection.read",
            "detection.manage",
            "alert.read",
            "incident.read",
            "directory.read",
            "threat_intel.read",
            "evidence.read",
            "integration.read",
            "integration.manage",
            "cyber_range.read",
            "cyber_range.manage",
            "dataset.read",
            "dataset.manage",
            "report.read",
            "administration.read",
        }
    ),
    "Auditor": frozenset(
        {
            "asset.read",
            "risk.read",
            "control.read",
            "policy.read",
            "evidence.read",
            "evidence.download",
            "vulnerability.read",
            "incident.read",
            "report.read",
            "dataset.read",
            "audit.read",
            "administration.read",
        }
    ),
    "Read Only": frozenset(
        {
            "asset.read",
            "risk.read",
            "control.read",
            "policy.read",
            "vulnerability.read",
            "alert.read",
            "detection.read",
            "incident.read",
            "threat_intel.read",
            "report.read",
            "dataset.read",
            "cyber_range.read",
        }
    ),
}

PRIVILEGED_ROLES: Final[frozenset[str]] = frozenset({"Administrator", "Security Engineer"})

SEVEN_ROLES: Final[tuple[str, ...]] = (
    "Administrator",
    "CISO",
    "GRC Analyst",
    "SOC Analyst",
    "Security Engineer",
    "Auditor",
    "Read Only",
)


def permissions_for_roles(role_names: list[str] | set[str] | tuple[str, ...]) -> list[str]:
    granted: set[str] = set()
    for name in role_names:
        granted.update(ROLE_PERMISSIONS.get(name, frozenset()))
    return sorted(granted)


def is_privileged(role_names: list[str] | set[str] | tuple[str, ...]) -> bool:
    names = {name.lower() for name in role_names}
    return any(role.lower() in names for role in PRIVILEGED_ROLES)


def role_has_permission(role_name: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role_name, frozenset())
