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
