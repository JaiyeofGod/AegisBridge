"""Server-side Wazuh indexer adapter. Persistence stays outside this package."""

from app.integrations.wazuh.alerts import normalize_hit, normalize_hits
from app.integrations.wazuh.client import HttpxWazuhClient, RawAlertPage
from app.integrations.wazuh.errors import WazuhError
from app.integrations.wazuh.models import NormalizedWazuhAlert

__all__ = [
    "HttpxWazuhClient",
    "NormalizedWazuhAlert",
    "RawAlertPage",
    "WazuhError",
    "normalize_hit",
    "normalize_hits",
]
