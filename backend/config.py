import os
import secrets
from dotenv import load_dotenv

load_dotenv()

# ─── S3 / RustFS / MinIO ──────────────────────────────────────────────
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_BUCKET = os.getenv("S3_BUCKET", "satisfactory-tracker")
ASSETS_BUCKET = os.getenv("ASSETS_BUCKET", "satisfactory-assets")
ASSETS_BASE_URL = os.getenv(
    "ASSETS_BASE_URL", "http://localhost:9000/satisfactory-assets"
)

if not S3_ACCESS_KEY or not S3_SECRET_KEY:
    raise RuntimeError(
        "S3_ACCESS_KEY and S3_SECRET_KEY must be set. "
        "Refusing to start with default/blank credentials."
    )

# ─── CORS ─────────────────────────────────────────────────────────────
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",")
    if o.strip()
]

# ─── Auth + abuse ─────────────────────────────────────────────────────
# Server-side secret used to derive per-project write tokens via HMAC.
# Generated once at first start; persist via env so tokens survive restarts.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_urlsafe(48)
    print(
        "WARN: SECRET_KEY not set; generated an ephemeral one. "
        "Existing project write tokens will be invalidated on restart. "
        "Set SECRET_KEY in env to persist."
    )

# When True, PUT /project/{id} requires a valid write token.
# Defaults False during the rollout so existing clients keep working;
# flip to True after the frontend has had time to cache tokens.
REQUIRE_WRITE_TOKEN = os.getenv("REQUIRE_WRITE_TOKEN", "false").lower() in (
    "1",
    "true",
    "yes",
)

# Hard cap on inbound request body size (bytes). Nginx may also enforce
# this upstream; this is the FastAPI fallback.
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(256 * 1024)))

# ─── Logging ──────────────────────────────────────────────────────────
# Suppress /health access log lines (the healthcheck spams them).
SILENCE_HEALTH_LOGS = os.getenv("SILENCE_HEALTH_LOGS", "true").lower() in (
    "1",
    "true",
    "yes",
)
