import secrets
import jwt
from datetime import datetime, timezone, timedelta
from aiosmtplib import SMTP
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import User, MagicLink
from app.core.config import settings


async def get_or_create_user(db: AsyncSession, email: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        user = User(email=email)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def create_magic_link(db: AsyncSession, user: User) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.MAGIC_LINK_EXPIRE_MINUTES)
    link = MagicLink(user_id=user.id, token=token, expires_at=expires)
    db.add(link)
    await db.commit()
    return token


async def verify_magic_link(db: AsyncSession, token: str) -> User | None:
    result = await db.execute(
        select(MagicLink).where(MagicLink.token == token, MagicLink.used == False)
    )
    link = result.scalar_one_or_none()
    if not link:
        return None
    if link.expires_at < datetime.now(timezone.utc):
        return None

    link.used = True
    user = await db.get(User, link.user_id)
    if user:
        user.last_login = datetime.now(timezone.utc)
    await db.commit()
    return user


def create_session_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "is_admin": user.is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_session_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


async def send_magic_link_email(email: str, token: str):
    magic_url = f"{settings.NEXT_PUBLIC_API_URL.replace('/api', '')}/auth/verify?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "🔐 Your MikroTik Manager Login Link"
    msg["From"] = settings.SMTP_USER
    msg["To"] = email

    html = f"""
    <html><body style="font-family: monospace; background: #0a0a0a; color: #e0e0e0; padding: 40px;">
      <div style="max-width: 480px; margin: auto; border: 1px solid #333; padding: 32px; border-radius: 8px;">
        <h2 style="color: #00ff88; margin: 0 0 8px 0;">MikroTik Manager</h2>
        <p style="color: #888; margin: 0 0 24px 0;">Your login link is ready</p>
        <a href="{magic_url}" style="display: inline-block; background: #00ff88; color: #0a0a0a;
           padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Login to Dashboard →
        </a>
        <p style="color: #555; font-size: 12px; margin: 24px 0 0 0;">
          This link expires in {settings.MAGIC_LINK_EXPIRE_MINUTES} minutes.<br>
          If you didn't request this, ignore this email.
        </p>
      </div>
    </body></html>
    """
    msg.attach(MIMEText(html, "html"))

    async with SMTP(hostname=settings.SMTP_HOST, port=settings.SMTP_PORT, start_tls=True) as smtp:
        await smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        await smtp.send_message(msg)
