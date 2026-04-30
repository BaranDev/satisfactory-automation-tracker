import logging
from typing import Awaitable, Callable

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

import config
import storage
from limits import limiter
from routes import projects, assets


# ─── Optional /health log silencer ───────────────────────────────
class _SkipHealthFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "GET /health" not in record.getMessage()


if config.SILENCE_HEALTH_LOGS:
    logging.getLogger("uvicorn.access").addFilter(_SkipHealthFilter())


# ─── App ─────────────────────────────────────────────────────────
app = FastAPI(
    title="Satisfactory Automation Tracker API",
    description="Backend API for tracking automated items in Satisfactory factories",
    version="1.1.0",
)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _ratelimit_handler(_request: Request, _exc: RateLimitExceeded) -> Response:
    return Response(
        content='{"detail":"Rate limited. Try again later."}',
        media_type="application/json",
        status_code=429,
    )


# ─── Body size cap ───────────────────────────────────────────────
@app.middleware("http")
async def _enforce_body_cap(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    cl = request.headers.get("content-length")
    if cl is not None:
        try:
            n = int(cl)
        except ValueError:
            n = 0
        if n > config.MAX_BODY_BYTES:
            return Response(
                content='{"detail":"Request body too large."}',
                media_type="application/json",
                status_code=413,
            )
    return await call_next(request)


# ─── CORS ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "HEAD", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "If-Match"],
)

# ─── Routers ─────────────────────────────────────────────────────
app.include_router(projects.router)
app.include_router(assets.router)


@app.get("/")
async def root():
    return {"message": "Satisfactory Automation Tracker API", "version": "1.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/storage-status")
async def storage_status(request: Request):
    """Diagnostic. Localhost-only — leaks bucket + endpoint metadata."""
    client_host = request.client.host if request.client else ""
    if client_host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(status_code=404, detail="Not found")
    s3_available = storage.is_s3_available()
    return {
        "s3_available": s3_available,
        "s3_endpoint": config.S3_ENDPOINT,
        "s3_bucket": config.S3_BUCKET,
        "assets_bucket": config.ASSETS_BUCKET,
    }
