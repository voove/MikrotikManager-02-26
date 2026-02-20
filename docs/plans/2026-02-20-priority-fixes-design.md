# Priority Fixes Design

Six security and reliability fixes for the MikroTik Manager application.

## 1. Auth Middleware on Protected Routes

**Problem:** Only `/auth/me` checks Bearer tokens. All router CRUD, script execution, metrics, and SMS broadcast endpoints are completely unauthenticated.

**Solution:** Create a `get_current_user` FastAPI dependency that extracts the Bearer token from the `Authorization` header, decodes the JWT via `decode_session_token`, and returns the user payload. Inject it via `Depends(get_current_user)` into every protected route.

**Route protection map:**

| Route | Auth |
|-------|------|
| `POST /auth/magic-link` | Public |
| `POST /auth/verify` | Public |
| `GET /auth/me` | Protected (already) |
| `GET/POST/PATCH/DELETE /routers/*` | Protected |
| `GET /metrics/*` | Protected |
| `POST /sms/inbound` | Public (Twilio signature) |
| `POST /sms/broadcast` | Protected |
| `GET /api/health` | Public |

**File:** `backend/app/api/deps.py` (new) - contains `get_current_user` dependency.
**Modified:** `routers.py`, `metrics.py`, `sms.py` - add `Depends(get_current_user)`.

## 2. Flux Query Range Validation

**Problem:** The `range` query parameter in `/metrics/{id}/signal` and `/metrics/{id}/heartbeat` is interpolated directly into Flux queries without validation. This is a Flux injection vulnerability.

**Solution:** Validate `range` against the pattern `^[0-9]+(m|h|d|w)$` before use. Return 400 on invalid input.

**File:** `backend/app/api/metrics.py` - add validation at the top of `_flux_query` or in the endpoint handlers.

## 3. Nginx Config Fix

**Problem:** `worker_processes auto;` is incorrectly placed inside the `events {}` block. This is invalid nginx syntax.

**Fix:**
```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    ...
}
```

**File:** `nginx/nginx.conf`

## 4. Replace asyncio.get_event_loop()

**Problem:** `asyncio.get_event_loop().run_until_complete(coro)` is deprecated in Python 3.10+. Used in `tasks.py` and `sms.py` Celery tasks.

**Solution:** Replace all instances with `asyncio.run(coro)`.

**Files:** `backend/app/tasks/tasks.py`, `backend/app/api/sms.py`

## 5. Shared Sync Engine for Celery Tasks

**Problem:** Every Celery task invocation creates a new `create_engine()` call, wasting connection pool resources and creating engine objects that are never disposed.

**Solution:** Add a `get_sync_engine()` function to `backend/app/core/database.py` that creates the sync engine once at module level and returns it. All Celery tasks import from there.

```python
_sync_engine = None

def get_sync_engine():
    global _sync_engine
    if _sync_engine is None:
        sync_url = settings.DATABASE_URL.replace("+asyncpg", "")
        _sync_engine = create_engine(sync_url, pool_pre_ping=True)
    return _sync_engine
```

**Files:** `backend/app/core/database.py` (add function), `backend/app/tasks/tasks.py` and `backend/app/api/sms.py` (use it).

## 6. Frontend Auth Guard

**Problem:** Dashboard (`/`) and router detail (`/router/[id]`) pages render without checking authentication. Any unauthenticated user can view the app.

**Solution:** Create an `AuthGuard` component that checks for the `mm_token` cookie. If missing, redirect to `/auth/login`. Wrap protected pages.

**File:** `frontend/src/components/auth/AuthGuard.tsx` (new)
**Modified:** `frontend/src/app/page.tsx`, `frontend/src/app/router/[id]/page.tsx` - wrap content with `<AuthGuard>`.
