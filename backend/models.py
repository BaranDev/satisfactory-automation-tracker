from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional


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
    kind: Optional[Literal["item", "fluid"]] = None
    connectedTo: Optional[ConnectionRef] = None
    itemType: Optional[str] = None
    actualRate: float = 0
    beltTier: Optional[str] = None
    pipeTier: Optional[str] = None
    maxRate: Optional[float] = None


class MachineInstance(BaseModel):
    id: str
    machineType: str
    recipe: Optional[str] = None
    overclock: float = 1.0
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})
    extractionItem: Optional[str] = None
    nodePurity: Optional[Literal["impure", "normal", "pure"]] = None
    somersloops: int = 0
    inputs: list[ConnectionPoint] = Field(default_factory=list)
    outputs: list[ConnectionPoint] = Field(default_factory=list)


class ProjectData(BaseModel):
    project_id: str
    name: str
    version: int = 1
    last_updated: str
    assets_base_url: Optional[str] = None
    items: dict[str, ItemData] = Field(default_factory=dict)
    factory_machines: list[MachineInstance] = Field(default_factory=list)

    # Be lenient on unknown top-level fields to absorb future client schema
    # extensions without breaking saved projects mid-upgrade. We still cap
    # body size (config.MAX_BODY_BYTES) so this can't bloat unbounded.
    model_config = ConfigDict(extra="allow")


class ProjectUpdateRequest(BaseModel):
    project: ProjectData
    force: bool = False
    expected_version: Optional[int] = None
