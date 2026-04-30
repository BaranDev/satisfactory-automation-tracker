import logging
from typing import Awaitable, Callable

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

import config
import storage
from rate_limit import limiter
from routes import projects, assets


# ─── Optional /health log silencer ───────────────────────────────
# Uvicorn formats access logs as `(client, method, path, version, status)`
# in `record.args`. Match the path slot directly so reformatting can't
# silently disable the filter.
class _SkipHealthFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        args = getattr(record, "args", None)
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            return args[2] != "/health"
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
# Reject early when Content-Length exceeds MAX_BODY_BYTES. Chunked
# uploads (no Content-Length) bypass this check at the FastAPI layer,
# but nginx upstream enforces `client_max_body_size` (frontend/nginx.conf)
# so the public path is still bounded. Backend is only reachable from
# the dokploy-network overlay.
@app.middleware("http")
async def _enforce_body_cap(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    cap = config.MAX_BODY_BYTES
    cl = request.headers.get("content-length")
    if cl is not None:
        try:
            if int(cl) > cap:
                return Response(
                    content='{"detail":"Request body too large."}',
                    media_type="application/json",
                    status_code=413,
                )
        except ValueError:
            return Response(
                content='{"detail":"Bad Content-Length."}',
                media_type="application/json",
                status_code=400,
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
