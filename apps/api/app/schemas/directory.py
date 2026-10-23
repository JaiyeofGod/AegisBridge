"""Operational directory contracts. Administration fields stay off this response."""

from pydantic import BaseModel, Field


class DirectoryUser(BaseModel):
    """Active same-organization user that can be selected as an operational assignee."""

    id: str = Field(description="User human id, such as USR-0004.")
    display_name: str
    account_status: str
    department: str | None = None
    job_title: str | None = None
