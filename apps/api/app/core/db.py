"""SQLAlchemy engine and session foundation."""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings
from app.db.database_target import runtime_database_url


def create_db_engine(settings: Settings | None = None) -> Engine:
    cfg = settings or get_settings()
    return create_engine(
        runtime_database_url(cfg),
        pool_pre_ping=True,
        future=True,
    )


engine = create_db_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def reset_engine(settings: Settings | None = None) -> Engine:
    """Dispose the process engine and rebind the existing session factory.

    Pytest calls this after selecting ``APP_ENV=test`` so importers of
    ``SessionLocal`` follow the test database. Production startup does not call it.
    """
    global engine
    engine.dispose()
    engine = create_db_engine(settings)
    SessionLocal.configure(bind=engine)
    return engine


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
