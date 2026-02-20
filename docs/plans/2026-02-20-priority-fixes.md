# Priority Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix six security and reliability issues — auth middleware, Flux injection, nginx config, asyncio deprecation, shared sync engine, frontend auth guard.

**Architecture:** FastAPI backend with Celery workers, Next.js frontend, nginx reverse proxy. All fixes are isolated changes to existing files with one new dependency file and one new React component.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, Celery, Next.js 14, Tailwind CSS

---

### Task 1: Fix nginx config

**Files:**
- Modify: `nginx/nginx.conf`

**Step 1: Fix the config**

Replace the entire file with:

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:8000;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name _;

        client_max_body_size 10M;

        # API
        location /api/ {
            proxy_pass http://api;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 120s;
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

The fix: `worker_processes auto;` moved out of `events {}` to the main context. `worker_connections 1024;` added inside `events {}` (required directive).

**Step 2: Validate syntax**

Run: `docker run --rm -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t`
Expected: `nginx: configuration file /etc/nginx/nginx.conf syntax is ok`

**Step 3: Commit**

```bash
git add nginx/nginx.conf
git commit -m "fix: move worker_processes to main context in nginx config"
```

---

### Task 2: Create shared sync engine for Celery tasks

**Files:**
- Modify: `backend/app/core/database.py`

**Step 1: Add get_sync_engine() to database.py**

Add these imports and the function at the bottom of the file:

```python
from sqlalchemy import create_engine as _create_sync_engine

_sync_engine = None

def get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
        _sync_engine = _create_sync_engine(sync_url, pool_pre_ping=True)
    return _sync_engine
```

**Step 2: Commit**

```bash
git add backend/app/core/database.py
git commit -m "feat: add shared sync engine for Celery tasks"
```

---

### Task 3: Replace asyncio.get_event_loop() and use shared sync engine

**Files:**
- Modify: `backend/app/tasks/tasks.py`
- Modify: `backend/app/api/sms.py`

**Step 1: Fix tasks.py**

Replace the `run_async` helper:

```python
# Old
def run_async(coro):
    """Run an async function from sync Celery task."""
    return asyncio.get_event_loop().run_until_complete(coro)

# New
def run_async(coro):
    """Run an async function from sync Celery task."""
    return asyncio.run(coro)
```

Replace all inline engine creation in `heartbeat_all_routers`:

```python
# Old (remove these lines in each task)
sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
from sqlalchemy import create_engine as sync_engine_create
engine = sync_engine_create(sync_url)

# New (add import at top of file, use in each task)
from app.core.database import get_sync_engine
# Then in each task:
engine = get_sync_engine()
```

Do this for all three tasks: `heartbeat_all_routers`, `poll_signal_metrics`, `execute_script`.

Also remove the unused inline imports of `create_engine` and `select` from inside each function body — move `select` to the top-level imports (it's used everywhere). Keep `Session` imported from `sqlalchemy.orm` at the top too.

Clean top-of-file imports for tasks.py:

```python
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.tasks.celery_app import celery_app
from app.services.ssh import run_ssh_command, test_connectivity
from app.scripts.routeros import get_script, parse_kv_output
from app.core.config import settings
from app.core.database import get_sync_engine
from app.models.models import Router, ScriptExecution, Alert
from app.core.influx import get_write_api
from influxdb_client import Point
```

Then remove the per-function inline imports of these same modules.

**Step 2: Fix sms.py `execute_script_with_sms_reply`**

Same changes — replace `asyncio.get_event_loop()` with `asyncio.run()`, use `get_sync_engine()` instead of inline engine creation.

In the Celery task at the bottom of `sms.py`:

```python
# Old
def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)

# Replace the engine creation:
sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
from sqlalchemy import create_engine as sync_engine_create
engine = sync_engine_create(sync_url)

# New
from app.core.database import get_sync_engine
engine = get_sync_engine()
```

And replace the `run_async` call:

```python
# Old
result = run_async(run_ssh_command(...))

# New
result = asyncio.run(run_ssh_command(...))
```

**Step 3: Commit**

```bash
git add backend/app/tasks/tasks.py backend/app/api/sms.py
git commit -m "fix: replace deprecated asyncio.get_event_loop with asyncio.run, use shared sync engine"
```

---

### Task 4: Add pytest and create auth dependency with tests

**Files:**
- Modify: `backend/requirements.txt` (add pytest, httpx)
- Create: `backend/app/api/deps.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_auth_dependency.py`

**Step 1: Add test dependencies**

Add to `backend/requirements.txt`:

```
# Testing
pytest==8.3.3
pytest-asyncio==0.24.0
```

**Step 2: Install dependencies**

Run: `cd backend && pip install -r requirements.txt`

**Step 3: Write the failing test**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/test_auth_dependency.py`:

```python
import pytest
from unittest.mock import patch
from fastapi import HTTPException
from app.api.deps import get_current_user


def _make_request(auth_header=None):
    """Create a mock request with the given Authorization header."""
    from starlette.requests import Request
    from starlette.datastructures import Headers

    headers = {}
    if auth_header:
        headers["authorization"] = auth_header

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(k.encode(), v.encode()) for k, v in headers.items()],
    }
    return Request(scope)


def test_missing_auth_header_raises_401():
    request = _make_request()
    with pytest.raises(HTTPException) as exc:
        get_current_user(request)
    assert exc.value.status_code == 401


def test_malformed_auth_header_raises_401():
    request = _make_request("Token abc")
    with pytest.raises(HTTPException) as exc:
        get_current_user(request)
    assert exc.value.status_code == 401


def test_invalid_token_raises_401():
    request = _make_request("Bearer invalid.token.here")
    with pytest.raises(HTTPException) as exc:
        get_current_user(request)
    assert exc.value.status_code == 401


@patch("app.api.deps.decode_session_token")
def test_valid_token_returns_payload(mock_decode):
    mock_decode.return_value = {"sub": "1", "email": "test@example.com", "is_admin": False}
    request = _make_request("Bearer valid.token")
    result = get_current_user(request)
    assert result["email"] == "test@example.com"
    mock_decode.assert_called_once_with("valid.token")
```

**Step 4: Run tests — they should fail (deps.py doesn't exist)**

Run: `cd backend && python -m pytest tests/test_auth_dependency.py -v`
Expected: `ModuleNotFoundError: No module named 'app.api.deps'`

**Step 5: Create the auth dependency**

Create `backend/app/api/deps.py`:

```python
from fastapi import HTTPException, Request
from app.services.auth import decode_session_token


def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = auth.removeprefix("Bearer ")
    payload = decode_session_token(token)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload
```

**Step 6: Run tests — they should pass**

Run: `cd backend && python -m pytest tests/test_auth_dependency.py -v`
Expected: 4 passed

**Step 7: Commit**

```bash
git add backend/requirements.txt backend/app/api/deps.py backend/tests/
git commit -m "feat: add get_current_user auth dependency with tests"
```

---

### Task 5: Protect backend routes with auth dependency

**Files:**
- Modify: `backend/app/api/routers.py`
- Modify: `backend/app/api/metrics.py`
- Modify: `backend/app/api/sms.py`
- Modify: `backend/app/api/auth.py`

**Step 1: Protect routers.py**

Add import at top:

```python
from app.api.deps import get_current_user
```

Add `user: dict = Depends(get_current_user)` parameter to every route handler:

- `list_routers` — add param
- `create_router` — add param
- `get_router` — add param
- `update_router` — add param
- `delete_router` — add param
- `get_executions` — add param
- `run_script` — add param, and set `triggered_by_user=user["email"]` instead of relying on the request body
- `get_scripts` — add param

Example for `list_routers`:

```python
@router.get("/", response_model=list[RouterResponse])
async def list_routers(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Router).order_by(Router.name))
    return result.scalars().all()
```

For `run_script`, also use the user payload:

```python
@router.post("/{router_id}/execute", response_model=ExecutionResponse)
async def run_script(router_id: int, req: ExecuteScriptRequest, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ...
    execution = ScriptExecution(
        router_id=router_id,
        script_name=req.script_name,
        triggered_by="ui",
        triggered_by_user=user["email"],
        status="pending",
    )
    ...
```

**Step 2: Protect metrics.py**

Add import and `user` param to all three endpoints:

```python
from fastapi import APIRouter, Query, Depends, Request
from app.api.deps import get_current_user
```

```python
@router.get("/{router_id}/signal")
async def get_signal_metrics(
    router_id: int,
    user: dict = Depends(get_current_user),
    range: str = Query("24h", description="Time range e.g. 1h, 6h, 24h, 7d"),
):
```

Same for `get_heartbeat_metrics` and `get_all_routers_summary`.

**Step 3: Protect sms.py broadcast endpoint only**

Add import and `user` param to `broadcast_sms` only. Leave `inbound_sms` unprotected (Twilio signature validation is its auth):

```python
from app.api.deps import get_current_user

@router.post("/broadcast")
async def broadcast_sms(
    message: str,
    phone_numbers: list[str],
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
```

**Step 4: Clean up auth.py /me endpoint**

Replace the manual token parsing in `/auth/me` with the dependency:

```python
from app.api.deps import get_current_user

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user
```

**Step 5: Commit**

```bash
git add backend/app/api/routers.py backend/app/api/metrics.py backend/app/api/sms.py backend/app/api/auth.py
git commit -m "feat: protect all routes with JWT auth dependency"
```

---

### Task 6: Add Flux range validation with tests

**Files:**
- Modify: `backend/app/api/metrics.py`
- Create: `backend/tests/test_flux_validation.py`

**Step 1: Write the failing test**

Create `backend/tests/test_flux_validation.py`:

```python
import pytest
from app.api.metrics import validate_range


def test_valid_ranges():
    for r in ["1m", "5m", "30m", "1h", "6h", "24h", "1d", "7d", "1w", "2w"]:
        assert validate_range(r) == r


def test_invalid_ranges_raise():
    for r in [
        "abc",
        "1h) |> drop()",
        "-1h",
        "24h; rm -rf /",
        "",
        "1x",
        "1h\n|> drop()",
        "999999999h",
    ]:
        with pytest.raises(ValueError):
            validate_range(r)
```

**Step 2: Run test — should fail (validate_range doesn't exist)**

Run: `cd backend && python -m pytest tests/test_flux_validation.py -v`
Expected: `ImportError: cannot import name 'validate_range'`

**Step 3: Add validate_range to metrics.py**

Add at the top of `metrics.py`, below imports:

```python
import re

_RANGE_PATTERN = re.compile(r"^[1-9][0-9]{0,3}(m|h|d|w)$")

def validate_range(range_: str) -> str:
    if not _RANGE_PATTERN.match(range_):
        raise ValueError(f"Invalid range: {range_}")
    return range_
```

Then use it in `_flux_query` and each endpoint:

```python
def _flux_query(router_id: int, measurement: str, field: str, range_: str) -> list[dict]:
    range_ = validate_range(range_)
    ...
```

Also add validation in `get_signal_metrics` and `get_heartbeat_metrics` before calling `_flux_query`:

```python
@router.get("/{router_id}/signal")
async def get_signal_metrics(
    router_id: int,
    user: dict = Depends(get_current_user),
    range: str = Query("24h", description="Time range e.g. 1h, 6h, 24h, 7d"),
):
    try:
        validate_range(range)
    except ValueError:
        raise HTTPException(400, "Invalid range format. Use: 1h, 6h, 24h, 7d, etc.")
    ...
```

Add `HTTPException` to the fastapi imports if not already there.

**Step 4: Run tests — should pass**

Run: `cd backend && python -m pytest tests/test_flux_validation.py -v`
Expected: all passed

**Step 5: Commit**

```bash
git add backend/app/api/metrics.py backend/tests/test_flux_validation.py
git commit -m "fix: validate Flux query range parameter to prevent injection"
```

---

### Task 7: Add frontend AuthGuard component

**Files:**
- Create: `frontend/src/components/auth/AuthGuard.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/router/[id]/page.tsx`

**Step 1: Create the AuthGuard component**

Create `frontend/src/components/auth/AuthGuard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/auth/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-mono text-accent text-sm animate-pulse">
          Authenticating...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
```

**Step 2: Wrap the dashboard page**

In `frontend/src/app/page.tsx`, add import and wrap the return:

```tsx
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardPage() {
  // ... existing state and logic ...

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* ... existing JSX ... */}
      </div>
    </AuthGuard>
  );
}
```

**Step 3: Wrap the router detail page**

In `frontend/src/app/router/[id]/page.tsx`, add import and wrap the return.

Note: this page has an early return for the loading state. Wrap the entire component output:

```tsx
import AuthGuard from "@/components/auth/AuthGuard";

export default function RouterDetailPage() {
  // ... existing state and logic ...

  if (!router) {
    return (
      <AuthGuard>
        <div className="flex h-screen bg-background">
          {/* loading state */}
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* ... existing JSX ... */}
      </div>
    </AuthGuard>
  );
}
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add frontend/src/components/auth/AuthGuard.tsx frontend/src/app/page.tsx frontend/src/app/router/\[id\]/page.tsx
git commit -m "feat: add frontend auth guard redirecting unauthenticated users to login"
```

---

### Task 8: Run all tests and verify

**Step 1: Run full backend test suite**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All tests pass.

**Step 2: Verify frontend builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Final commit (if any cleanup needed)**

Only if tests or build revealed issues that need fixing.
