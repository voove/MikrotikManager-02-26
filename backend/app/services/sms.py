from twilio.rest import Client
from twilio.request_validator import RequestValidator
from app.core.config import settings

_client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
_validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)

# Command map: SMS text → script name
SMS_COMMANDS = {
    "SIM": "sim_info",
    "SIGNAL": "signal_strength",
    "REBOOT": "reboot",
    "INFO": "system_info",
    "STATUS": "signal_strength",  # alias
}


def parse_sms_command(body: str) -> tuple[str | None, str | None]:
    """
    Parse SMS body like 'SIGNAL R01' or 'REBOOT router-name'
    Returns (script_name, router_identifier) or (None, None)
    """
    parts = body.strip().upper().split(maxsplit=1)
    if not parts:
        return None, None

    command = parts[0]
    router_id = parts[1].strip() if len(parts) > 1 else None
    script_name = SMS_COMMANDS.get(command)
    return script_name, router_id


def send_sms(to: str, message: str):
    _client.messages.create(
        body=message[:1600],  # SMS limit
        from_=settings.TWILIO_PHONE_NUMBER,
        to=to,
    )


def is_whitelisted(phone: str) -> bool:
    if not settings.sms_whitelist:
        return False
    return phone in settings.sms_whitelist


def validate_twilio_request(url: str, params: dict, signature: str) -> bool:
    return _validator.validate(url, params, signature)


HELP_MESSAGE = (
    "MikroTik Manager Commands:\n"
    "SIGNAL [router] - LTE signal metrics\n"
    "SIM [router] - SIM card info\n"
    "REBOOT [router] - Reboot router\n"
    "INFO [router] - System info\n"
    "\nExample: SIGNAL R01"
)
