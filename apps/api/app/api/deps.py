"""Shared API dependencies."""

from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.services.support import PageParams

DbSession = Annotated[Session, Depends(get_db)]


def get_page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


PageQuery = Annotated[PageParams, Depends(get_page_params)]
