"""SQLAlchemy engine and session foundation."""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings


def create_db_engine(settings: Settings | None = None) -> Engine:
    cfg = settings or get_settings()
    return create_engine(
        cfg.database_url,
        pool_pre_ping=True,
        future=True,
    )


engine = create_db_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_ready(db_engine: Engine | None = None) -> bool:
    """Return True when a simple SELECT 1 succeeds against PostgreSQL."""
    target = db_engine or engine
    try:
        with target.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
