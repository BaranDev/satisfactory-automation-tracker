from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ItemData(BaseModel):
    label: str
    icon: Optional[str] = None
    automated: bool = False
    machines: int = 1
    overclock: float = 1.0


class ConnectionRef(BaseModel):
    machineId: str
    slot: int


class ConnectionPoint(BaseModel):
    slot: int
    connectedTo: Optional[ConnectionRef] = None
    itemType: Optional[str] = None
    actualRate: float = 0
    maxRate: float = 780


class MachineInstance(BaseModel):
    id: str
    machineType: str
    recipe: Optional[str] = None
    overclock: float = 1.0
    position: dict[str, float] = {"x": 0, "y": 0}
    inputs: list[ConnectionPoint] = []
    outputs: list[ConnectionPoint] = []


class ProjectData(BaseModel):
    project_id: str
    name: str
    version: int = 1
    last_updated: str
    assets_base_url: Optional[str] = None
    items: dict[str, ItemData] = {}
    factory_machines: list[MachineInstance] = []

    class Config:
        extra = "allow"  # Allow additional fields


class ProjectUpdateRequest(BaseModel):
    project: ProjectData
    force: bool = False  # If true, overwrite even on conflict
    expected_version: Optional[int] = None  # For optimistic locking
