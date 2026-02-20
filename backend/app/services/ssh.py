import asyncssh
import asyncio
import time
from typing import Optional
from app.core.config import settings


class SSHResult:
    def __init__(self, stdout: str, stderr: str, exit_code: int, duration_ms: int):
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code
        self.duration_ms = duration_ms
        self.success = exit_code == 0

    def __repr__(self):
        return f"<SSHResult exit={self.exit_code} duration={self.duration_ms}ms>"


async def run_ssh_command(
    ip: str,
    command: str,
    port: int = None,
    username: str = None,
    password: Optional[str] = None,
    private_key: Optional[str] = None,
    timeout: int = None,
) -> SSHResult:
    port = port or settings.SSH_DEFAULT_PORT
    username = username or settings.SSH_DEFAULT_USER
    timeout = timeout or settings.SSH_TIMEOUT

    connect_kwargs = dict(
        host=ip,
        port=port,
        username=username,
        known_hosts=None,  # Internal network - skip host key check
        connect_timeout=timeout,
    )

    if private_key:
        connect_kwargs["client_keys"] = [asyncssh.import_private_key(private_key)]
    elif password:
        connect_kwargs["password"] = password
        connect_kwargs["preferred_auth"] = "password"

    start = time.monotonic()
    try:
        async with asyncssh.connect(**connect_kwargs) as conn:
            result = await asyncio.wait_for(
                conn.run(command, check=False),
                timeout=timeout,
            )
        duration_ms = int((time.monotonic() - start) * 1000)
        return SSHResult(
            stdout=result.stdout or "",
            stderr=result.stderr or "",
            exit_code=result.exit_status or 0,
            duration_ms=duration_ms,
        )
    except asyncio.TimeoutError:
        duration_ms = int((time.monotonic() - start) * 1000)
        return SSHResult("", "Connection timed out", 1, duration_ms)
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        return SSHResult("", str(e), 1, duration_ms)


async def test_connectivity(ip: str, **kwargs) -> tuple[bool, int]:
    """Quick ping via SSH. Returns (is_online, latency_ms)."""
    result = await run_ssh_command(ip, ":put ok", timeout=10, **kwargs)
    return result.success, result.duration_ms
