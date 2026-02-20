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
