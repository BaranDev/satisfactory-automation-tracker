from fastapi import APIRouter, HTTPException, Header, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import secrets

import storage
from models import ProjectUpdateRequest
import config
import auth
from limits import limiter

router = APIRouter(prefix="/api", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str = "New Project"


def generate_project_id() -> str:
    """Generate a random URL-safe project ID."""
    return secrets.token_urlsafe(6)  # ~8 characters


@router.post("/project")
@limiter.limit("10/minute")
async def create_project(
    request: Request,
    body: CreateProjectRequest = CreateProjectRequest(),
):
    """Create a new project with a random ID. Returns the project plus a
    write token the client must keep to mutate it later."""
    del request  # only used by the rate-limit decorator
    project_id = generate_project_id()
    write_token = auth.issue_write_token(project_id)

    project = {
        "project_id": project_id,
        "name": body.name,
        "version": 1,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "assets_base_url": config.ASSETS_BASE_URL,
        "items": {},
    }

    _, success = storage.put_project(project_id, project)
    if not success:
        raise HTTPException(
            status_code=503,
            detail="Storage service unavailable. Please try again later.",
        )
    return {**project, "write_token": write_token}


@router.get("/project/{project_id}")
async def get_project(project_id: str):
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/project/{project_id}")
@limiter.limit("60/minute")
async def update_project(
    project_id: str,
    request: Request,
    body: ProjectUpdateRequest,
    if_match: Optional[str] = Header(None, alias="If-Match"),
    _auth: None = Depends(auth.require_write_token),
):
    """Update a project. Optimistic-locked unless `force=True`.

    `Authorization: Bearer <write_token>` is verified by
    `auth.require_write_token`. During rollout, missing tokens are
    accepted; bogus tokens are always rejected.
    """
    del request, if_match  # reserved; not currently consulted
    existing = storage.get_project(project_id)

    if not body.force and existing:
        existing_version = existing.get("version", 1)
        if body.expected_version is not None:
            if existing_version != body.expected_version:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Version conflict",
                        "cloud_version": existing_version,
                        "cloud_last_updated": existing.get("last_updated"),
                        "your_version": body.expected_version,
                    },
                )

    project_data = body.project.model_dump()
    project_data["project_id"] = project_id
    project_data["version"] = (existing.get("version", 0) if existing else 0) + 1
    project_data["last_updated"] = datetime.now(timezone.utc).isoformat()

    _, success = storage.put_project(project_id, project_data)
    if not success:
        raise HTTPException(
            status_code=503,
            detail="Storage service unavailable. Please try again later.",
        )

    return {"success": True, "project": project_data}


@router.head("/project/{project_id}")
async def get_project_metadata(project_id: str):
    metadata = storage.get_project_metadata(project_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return metadata


@router.get("/project/{project_id}/write-token")
async def reissue_write_token(project_id: str, request: Request):
    """Diagnostic helper for the canonical write token. Restricted to
    localhost callers so we don't leak tokens to the public internet."""
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=404, detail="Not found")
    if storage.get_project(project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project_id": project_id, "write_token": auth.issue_write_token(project_id)}
