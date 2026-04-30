from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

import storage

router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("")
async def list_assets(request: Request):
    """List uploaded asset keys. Restricted to localhost callers — the
    full bucket inventory is operationally useful but leaks our entire
    item set when exposed publicly."""
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=404, detail="Not found")
    return {"assets": storage.list_assets()}


@router.get("/{key:path}")
async def get_asset(key: str):
    """Redirect to presigned URL for asset."""
    url = storage.get_asset_url(key)
    if not url:
        raise HTTPException(status_code=404, detail="Asset not found")
    return RedirectResponse(url=url)
