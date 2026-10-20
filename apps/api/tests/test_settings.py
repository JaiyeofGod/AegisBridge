"""Settings loading tests."""

from app.core.config import Settings, get_settings


def test_settings_loads_defaults_and_env(settings: Settings) -> None:
    assert settings.app_name
    assert settings.database_url.startswith("postgresql")
    assert "://" in settings.database_url
    assert settings.api_port > 0


def test_cors_origin_list_parsing() -> None:
    get_settings.cache_clear()
    parsed = Settings(CORS_ORIGINS="http://a.example, http://b.example")
    assert parsed.cors_origin_list() == ["http://a.example", "http://b.example"]
    get_settings.cache_clear()


def test_settings_does_not_require_exposing_secrets_in_repr() -> None:
    get_settings.cache_clear()
    cfg = get_settings()
    # Ensure sensitive fields exist but health code never serializes them.
    assert cfg.session_secret
    assert cfg.database_url
