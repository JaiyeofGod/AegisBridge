"""Shared read-only API shapes."""

from pydantic import BaseModel, Field


class PersonRef(BaseModel):
    id: str
    display_name: str


class RelatedRecord(BaseModel):
    id: str
    title: str
    status: str | None = None
    summary: str | None = None


class Page[T](BaseModel):
    page: int
    page_size: int
    total: int
    items: list[T]


class ErrorDetail(BaseModel):
    loc: list[str] = Field(default_factory=list)
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None
    request_id: str | None = None
