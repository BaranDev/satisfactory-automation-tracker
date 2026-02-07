from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import secrets

import storage
from models import ProjectData, ProjectUpdateRequest
import config

router = APIRouter(prefix="/api", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str = "New Project"


def generate_project_id() -> str:
    """Generate a random 8-character project ID."""
    return secrets.token_urlsafe(6)  # ~8 characters


@router.post("/project")
async def create_project(request: CreateProjectRequest = CreateProjectRequest()):
    """Create a new project with a random ID."""
    project_id = generate_project_id()
    
    project = {
        "project_id": project_id,
        "name": request.name,
        "version": 1,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "assets_base_url": config.ASSETS_BASE_URL,
        "items": {}
    }
    
    _, success = storage.put_project(project_id, project)
    if not success:
        raise HTTPException(
            status_code=503,
            detail="Storage service unavailable. Please try again later."
        )
    return project


@router.get("/project/{project_id}")
async def get_project(project_id: str):
    """Get a project by ID."""
    project = storage.get_project(project_id)
    
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project


@router.put("/project/{project_id}")
async def update_project(
    project_id: str,
    request: ProjectUpdateRequest,
    if_match: Optional[str] = Header(None, alias="If-Match")
):
    """
    Update a project. 
    
    If force=False and If-Match header is provided, will check version.
    Returns 409 Conflict if versions don't match and force=False.
    """
    existing = storage.get_project(project_id)
    
    # Check for conflicts if not forcing
    if not request.force and existing:
        existing_version = existing.get("version", 1)
        
        if request.expected_version is not None:
            if existing_version != request.expected_version:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Version conflict",
                        "cloud_version": existing_version,
                        "cloud_last_updated": existing.get("last_updated"),
                        "your_version": request.expected_version
                    }
                )
    
    # Update the project
    project_data = request.project.model_dump()
    project_data["project_id"] = project_id
    project_data["version"] = (existing.get("version", 0) if existing else 0) + 1
    project_data["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    _, success = storage.put_project(project_id, project_data)
    if not success:
        raise HTTPException(
            status_code=503,
            detail="Storage service unavailable. Please try again later."
        )
    
    return {
        "success": True,
        "project": project_data
    }


@router.head("/project/{project_id}")
async def get_project_metadata(project_id: str):
    """Get project metadata without full content."""
    metadata = storage.get_project_metadata(project_id)
    
    if metadata is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return metadata
