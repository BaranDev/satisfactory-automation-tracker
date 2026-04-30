"""HMAC-based per-project write tokens.

Stateless: every project_id maps to exactly one write_token derived from
the server-side SECRET_KEY. Verifying just recomputes and uses
`secrets.compare_digest` to avoid timing leaks.
"""

import base64
import hashlib
import hmac
import secrets
from typing import Optional

from fastapi import Header, HTTPException

import config


def _derive(project_id: str) -> bytes:
    return hmac.new(
        config.SECRET_KEY.encode("utf-8"),
        project_id.encode("utf-8"),
        hashlib.sha256,
    ).digest()


def issue_write_token(project_id: str) -> str:
    """Return the canonical write token for a project_id."""
    return base64.urlsafe_b64encode(_derive(project_id)).rstrip(b"=").decode("ascii")


def verify_write_token(project_id: str, token: str) -> bool:
    """Constant-time check that `token` matches the canonical write token."""
    expected = issue_write_token(project_id)
    return secrets.compare_digest(expected, token)


def require_write_token(
    project_id: str,
    authorization: Optional[str] = Header(None),
) -> None:
    """FastAPI dependency. Enforces the write token only when REQUIRE_WRITE_TOKEN is on.

    During the rollout phase we accept missing tokens (so old clients keep
    working) but always reject *invalid* ones — that way attackers can't
    set a bogus token to bypass detection while we transition.
    """
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if token is None:
        if config.REQUIRE_WRITE_TOKEN:
            raise HTTPException(status_code=401, detail="Missing write token")
        return

    if not verify_write_token(project_id, token):
        raise HTTPException(status_code=403, detail="Invalid write token")
