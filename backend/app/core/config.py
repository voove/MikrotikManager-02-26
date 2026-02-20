from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # DB
    DATABASE_URL: str
    
    # InfluxDB
    INFLUX_URL: str
    INFLUX_TOKEN: str
    INFLUX_ORG: str
    INFLUX_BUCKET: str

    # Redis
    REDIS_URL: str

    # API
    SECRET_KEY: str
    ENVIRONMENT: str = "production"

    # Auth
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    MAGIC_LINK_EXPIRE_MINUTES: int = 15
    ALLOWED_EMAIL_DOMAINS: str = ""  # comma-separated, empty = allow all

    # Twilio
    TWILIO_ACCOUNT_SID: str
    TWILIO_AUTH_TOKEN: str
    TWILIO_PHONE_NUMBER: str
    SMS_WHITELIST: str = ""  # comma-separated phone numbers

    # SSH
    SSH_DEFAULT_USER: str = "admin"
    SSH_DEFAULT_PORT: int = 22
    SSH_TIMEOUT: int = 30

    # Frontend
    NEXT_PUBLIC_API_URL: str = "http://localhost/api"

    @property
    def allowed_domains(self) -> list[str]:
        return [d.strip() for d in self.ALLOWED_EMAIL_DOMAINS.split(",") if d.strip()]

    @property
    def sms_whitelist(self) -> list[str]:
        return [n.strip() for n in self.SMS_WHITELIST.split(",") if n.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
