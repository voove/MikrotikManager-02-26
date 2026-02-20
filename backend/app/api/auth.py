from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.schemas import MagicLinkRequest, MagicLinkVerify, TokenResponse
from app.services.auth import (
    get_or_create_user,
    create_magic_link,
    verify_magic_link,
    create_session_token,
    send_magic_link_email,
    decode_session_token,
)
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/magic-link")
async def request_magic_link(data: MagicLinkRequest, db: AsyncSession = Depends(get_db)):
    email = data.email.lower()

    # Enforce domain allowlist if configured
    if settings.allowed_domains:
        domain = email.split("@")[1]
        if domain not in settings.allowed_domains:
            raise HTTPException(403, "Email domain not allowed")

    user = await get_or_create_user(db, email)
    if not user.is_active:
        raise HTTPException(403, "Account disabled")

    token = await create_magic_link(db, user)
    await send_magic_link_email(email, token)

    return {"message": "Login link sent to your email"}


@router.post("/verify", response_model=TokenResponse)
async def verify_token(data: MagicLinkVerify, db: AsyncSession = Depends(get_db)):
    user = await verify_magic_link(db, data.token)
    if not user:
        raise HTTPException(401, "Invalid or expired link")

    session_token = create_session_token(user)
    return TokenResponse(access_token=session_token)


@router.get("/me")
async def get_me(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = auth.removeprefix("Bearer ")
    payload = decode_session_token(token)
    if not payload:
        raise HTTPException(401, "Invalid token")
    return payload
