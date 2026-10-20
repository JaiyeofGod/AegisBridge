"""Consistent error bodies. Responses never include stack traces."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.schemas.common import ErrorBody, ErrorDetail

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: list[ErrorDetail] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def not_found(record: str, record_id: str) -> ApiError:
    return ApiError(
        404,
        "not_found",
        f"{record} {record_id} was not found.",
    )


def _body(
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
) -> dict[str, Any]:
    return ErrorBody(code=code, message=message, details=details, request_id=None).model_dump()


def register_exception_handlers(application: FastAPI) -> None:
    @application.exception_handler(ApiError)
    async def api_error_handler(_request: object, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(exc.code, exc.message, exc.details),
        )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(_request: object, exc: HTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        message = exc.detail if isinstance(exc.detail, str) else "The request was rejected."
        return JSONResponse(status_code=exc.status_code, content=_body(code, message))

    @application.exception_handler(RequestValidationError)
    async def validation_handler(_request: object, exc: RequestValidationError) -> JSONResponse:
        details = [
            ErrorDetail(
                loc=[str(part) for part in error.get("loc", ())],
                message=str(error.get("msg", "Invalid value.")),
            )
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_body("validation_error", "Request validation failed.", details),
        )

    @application.exception_handler(Exception)
    async def unhandled_handler(_request: object, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content=_body("internal_error", "The request could not be completed."),
        )
