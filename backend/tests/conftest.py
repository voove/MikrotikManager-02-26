"""
Test configuration: mocks heavy external dependencies and sets env vars
so the app can be imported without running external services.
"""
import os
import sys
from unittest.mock import MagicMock

# --- Set required env vars before any app imports ---
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/testdb")
os.environ.setdefault("INFLUX_URL", "http://localhost:8086")
os.environ.setdefault("INFLUX_TOKEN", "test-token")
os.environ.setdefault("INFLUX_ORG", "test-org")
os.environ.setdefault("INFLUX_BUCKET", "test-bucket")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("SMTP_HOST", "localhost")
os.environ.setdefault("SMTP_USER", "test@test.com")
os.environ.setdefault("SMTP_PASSWORD", "test-password")
os.environ.setdefault("TWILIO_ACCOUNT_SID", "ACtest")
os.environ.setdefault("TWILIO_AUTH_TOKEN", "test-auth-token")
os.environ.setdefault("TWILIO_PHONE_NUMBER", "+10000000000")

# --- Mock binary/service modules that can't be imported locally ---
_write_api_mock = MagicMock()
_write_api_mock.SYNCHRONOUS = MagicMock()

_influx_mock = MagicMock()
_influx_client_mock = MagicMock()
_influx_client_mock.write_api = _write_api_mock

sys.modules.setdefault("jwt", MagicMock())
sys.modules.setdefault("influxdb_client", _influx_mock)
sys.modules.setdefault("influxdb_client.client", _influx_client_mock)
sys.modules.setdefault("influxdb_client.client.write_api", _write_api_mock)
sys.modules.setdefault("asyncssh", MagicMock())
sys.modules.setdefault("aiosmtplib", MagicMock())
sys.modules.setdefault("celery", MagicMock())
sys.modules.setdefault("celery.schedules", MagicMock())
sys.modules.setdefault("redis", MagicMock())
sys.modules.setdefault("redbeat", MagicMock())
sys.modules.setdefault("twilio", MagicMock())
sys.modules.setdefault("twilio.request_validator", MagicMock())
sys.modules.setdefault("passlib", MagicMock())
sys.modules.setdefault("passlib.context", MagicMock())
sys.modules.setdefault("kombu", MagicMock())
