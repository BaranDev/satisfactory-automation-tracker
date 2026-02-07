from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ItemData(BaseModel):
    label: str
    icon: Optional[str] = None
    automated: bool = False
    machines: int = 1
    overclock: float = 1.0


class ProjectData(BaseModel):
    project_id: str
    name: str
    version: int = 1
    last_updated: str
    assets_base_url: Optional[str] = None
    items: dict[str, ItemData] = {}

    class Config:
        extra = "allow"  # Allow additional fields


class ProjectUpdateRequest(BaseModel):
    project: ProjectData
    force: bool = False  # If true, overwrite even on conflict
    expected_version: Optional[int] = None  # For optimistic locking
