"""Public ATT&CK catalog shapes. Identifiers are ATT&CK ids, not database keys."""

from datetime import datetime

from pydantic import BaseModel, Field


class AttackTacticItem(BaseModel):
    id: str
    name: str
    short_name: str
    release: str


class AttackTechniqueListItem(BaseModel):
    id: str
    name: str
    is_subtechnique: bool
    parent_technique_id: str | None = None
    tactics: list[str] = Field(default_factory=list)
    release: str


class AttackTechniqueParent(BaseModel):
    id: str
    name: str


class AttackTechniqueDetail(BaseModel):
    id: str
    name: str
    description: str | None
    tactics: list[AttackTacticItem]
    platforms: list[str]
    is_subtechnique: bool
    parent: AttackTechniqueParent | None
    revoked: bool
    deprecated: bool
    release: str
    modified_at: datetime | None
