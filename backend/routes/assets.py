from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

import storage

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("")
async def list_assets():
    """List all uploaded asset keys."""
    assets = storage.list_assets()
    return {"assets": assets}


@router.get("/{key:path}")
async def get_asset(key: str):
    """Redirect to presigned URL for asset."""
    url = storage.get_asset_url(key)
    
    if not url:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return RedirectResponse(url=url)
