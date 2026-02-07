# Backend Documentation

The backend is a FastAPI application that provides a RESTful API for managing Satisfactory factory projects. It uses S3-compatible object storage (MinIO) for persistence.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Configuration](#configuration)
4. [Storage Layer](#storage-layer)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
7. [Error Handling](#error-handling)
8. [Running Locally](#running-locally)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FastAPI Application                      │
├─────────────────────────────────────────────────────────────────┤
│  main.py (Entry Point)                                           │
│  ├── CORS Middleware (configurable origins)                      │
│  ├── Router: /api/project/* (projects.py)                        │
│  └── Router: /api/assets/* (assets.py)                           │
├─────────────────────────────────────────────────────────────────┤
│  storage.py                                                       │
│  └── boto3 S3 Client → MinIO/S3 Object Storage                   │
├─────────────────────────────────────────────────────────────────┤
│  config.py                                                        │
│  └── Environment Variables (dotenv)                              │
└─────────────────────────────────────────────────────────────────┘
```

The backend is stateless. All project data is stored in S3 as JSON files. This allows horizontal scaling and simple deployment.

---

## File Structure

```
backend/
├── main.py              # FastAPI app entry point, routers, middleware
├── config.py            # Environment variable loading
├── storage.py           # S3/MinIO client and operations
├── models.py            # Pydantic request/response models
├── routes/
│   ├── __init__.py
│   ├── projects.py      # Project CRUD endpoints
│   └── assets.py        # Asset URL endpoints
├── requirements.txt     # Python dependencies
├── Dockerfile           # Container build
├── .env.example         # Environment variable template
└── .dockerignore
```

---

## Configuration

Configuration is loaded from environment variables using python-dotenv.

### config.py

```python
import os
from dotenv import load_dotenv

load_dotenv()

# S3/MinIO Configuration
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "satisfactory-tracker")
ASSETS_BUCKET = os.getenv("ASSETS_BUCKET", "satisfactory-assets")
ASSETS_BASE_URL = os.getenv("ASSETS_BASE_URL", "http://localhost:9000/satisfactory-assets")

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
```

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_ENDPOINT` | S3/MinIO server URL | `http://localhost:9000` |
| `S3_ACCESS_KEY` | S3 access key ID | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret access key | `minioadmin` |
| `S3_BUCKET` | Bucket name for project data | `satisfactory-tracker` |
| `ASSETS_BUCKET` | Bucket name for item icons | `satisfactory-assets` |
| `ASSETS_BASE_URL` | Public URL prefix for assets | `http://localhost:9000/satisfactory-assets` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,http://localhost:5173` |

---

## Storage Layer

### storage.py

The storage layer provides an abstraction over S3 operations with automatic error handling and connection caching.

#### S3 Client Configuration

```python
s3_client = boto3.client(
    "s3",
    endpoint_url=config.S3_ENDPOINT,
    aws_access_key_id=config.S3_ACCESS_KEY,
    aws_secret_access_key=config.S3_SECRET_KEY,
    config=Config(s3={"addressing_style": "path"}, connect_timeout=5, read_timeout=10),
    region_name="us-east-1",
)
```

Key configuration:
- `addressing_style: path` - Required for MinIO compatibility
- `connect_timeout: 5` - Fast failure on connection issues
- `read_timeout: 10` - Reasonable timeout for read operations

#### S3 Availability Check with TTL Cache

The backend caches S3 availability status to avoid hammering a failing storage service:

```python
_s3_available: bool | None = None
_s3_check_time: float = 0
_S3_CHECK_TTL = 30  # Re-check every 30 seconds if unavailable

def is_s3_available() -> bool:
    # If previously available, trust it (fast path)
    if _s3_available is True:
        return True
    
    # If unavailable, retry after TTL
    if _s3_available is False and (now - _s3_check_time) < _S3_CHECK_TTL:
        return False
    
    # Actually check S3
    try:
        s3_client.list_buckets()
        _s3_available = True
    except (EndpointConnectionError, NoCredentialsError, ClientError):
        _s3_available = False
    
    return _s3_available
```

#### Storage Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `is_s3_available()` | Check S3 connectivity with TTL cache | `bool` |
| `ensure_bucket_exists(bucket_name)` | Create bucket if it doesn't exist | `None` |
| `get_project(project_id)` | Fetch project JSON from S3 | `dict \| None` |
| `put_project(project_id, data)` | Store project JSON to S3 | `tuple[dict, bool]` |
| `get_project_metadata(project_id)` | Get LastModified and ETag via HEAD request | `dict \| None` |
| `list_assets()` | List all keys in assets bucket | `list[str]` |
| `get_asset_url(key)` | Generate presigned URL for asset | `str` |

#### Project Storage Format

Projects are stored as JSON files in the S3 bucket with the key pattern:

```
project-{project_id}.json
```

Example:
```
s3://satisfactory-tracker/project-Abc123.json
```

---

## Data Models

### models.py

Pydantic models for request validation and response serialization.

#### ItemData

Represents the state of a single item in the factory:

```python
class ItemData(BaseModel):
    label: str              # Display name (e.g., "Iron Plate")
    icon: Optional[str]     # Icon filename (e.g., "iron_plate.webp")
    automated: bool = False # Whether the item is automated
    machines: int = 1       # Number of machines producing this item
    overclock: float = 1.0  # Overclock multiplier (0.01-2.5)
```

#### ProjectData

The complete project state:

```python
class ProjectData(BaseModel):
    project_id: str                        # Unique 8-character ID
    name: str                              # User-defined project name
    version: int = 1                       # Version counter for conflict detection
    last_updated: str                      # ISO 8601 timestamp
    assets_base_url: Optional[str] = None  # URL prefix for loading icons
    items: dict[str, ItemData] = {}        # Map of item_key -> ItemData

    class Config:
        extra = "allow"  # Allow additional fields for forward compatibility
```

#### ProjectUpdateRequest

Request body for updating a project:

```python
class ProjectUpdateRequest(BaseModel):
    project: ProjectData
    force: bool = False                    # If true, overwrite even on conflict
    expected_version: Optional[int] = None # For optimistic locking
```

---

## API Endpoints

### main.py - Root Endpoints

#### GET /

Health check and version info.

Response:
```json
{
  "message": "Satisfactory Automation Tracker API",
  "version": "1.0.0"
}
```

#### GET /health

Simple health check for load balancers.

Response:
```json
{
  "status": "healthy"
}
```

#### GET /storage-status

Diagnostic endpoint to check S3 connectivity.

Response:
```json
{
  "s3_available": true,
  "s3_endpoint": "https://s3.example.com",
  "s3_bucket": "satisfactory-tracker",
  "assets_bucket": "satisfactory-assets"
}
```

---

### routes/projects.py - Project Endpoints

All project endpoints are prefixed with `/api`.

#### POST /api/project

Create a new project with a randomly generated ID.

Request Body (optional):
```json
{
  "name": "My Factory"
}
```

Response:
```json
{
  "project_id": "Abc123xy",
  "name": "My Factory",
  "version": 1,
  "last_updated": "2026-02-07T15:30:00Z",
  "assets_base_url": "https://s3.example.com/satisfactory-assets",
  "items": {}
}
```

Error Responses:
- `503 Service Unavailable` - S3 storage is not available

Implementation Details:
- Project ID is generated using `secrets.token_urlsafe(6)` (approximately 8 characters)
- The project is immediately saved to S3 upon creation

---

#### GET /api/project/{project_id}

Retrieve a project by ID.

Response:
```json
{
  "project_id": "Abc123xy",
  "name": "My Factory",
  "version": 5,
  "last_updated": "2026-02-07T16:45:00Z",
  "assets_base_url": "https://s3.example.com/satisfactory-assets",
  "items": {
    "iron_plate": {
      "label": "Iron Plate",
      "icon": "iron_plate.webp",
      "automated": true,
      "machines": 4,
      "overclock": 1.0
    }
  }
}
```

Error Responses:
- `404 Not Found` - Project does not exist

---

#### PUT /api/project/{project_id}

Update a project with optimistic locking.

Request Body:
```json
{
  "project": {
    "project_id": "Abc123xy",
    "name": "My Factory",
    "version": 5,
    "last_updated": "2026-02-07T16:45:00Z",
    "items": { ... }
  },
  "force": false,
  "expected_version": 5
}
```

Parameters:
- `project` - The complete project data to save
- `force` - If `true`, skip version checking and overwrite
- `expected_version` - The version number you expect the cloud to have

Success Response:
```json
{
  "success": true,
  "project": {
    "project_id": "Abc123xy",
    "name": "My Factory",
    "version": 6,
    "last_updated": "2026-02-07T17:00:00Z",
    "items": { ... }
  }
}
```

Conflict Response (409):
```json
{
  "detail": {
    "message": "Version conflict",
    "cloud_version": 6,
    "cloud_last_updated": "2026-02-07T16:55:00Z",
    "your_version": 5
  }
}
```

Error Responses:
- `409 Conflict` - Version mismatch (someone else saved first)
- `503 Service Unavailable` - S3 storage is not available

Implementation Details:
- The `version` field is auto-incremented on each successful save
- The `last_updated` timestamp is set server-side to prevent clock skew issues
- If `force=true`, the version check is skipped and the save proceeds

---

#### HEAD /api/project/{project_id}

Get project metadata without the full content. Useful for lightweight version checking.

Response Headers:
- Returns S3 `LastModified` and `ETag` values

Error Responses:
- `404 Not Found` - Project does not exist

---

### routes/assets.py - Asset Endpoints

All asset endpoints are prefixed with `/api/assets`.

#### GET /api/assets

List all asset keys in the assets bucket.

Response:
```json
{
  "assets": [
    "iron_plate.webp",
    "iron_ingot.webp",
    "copper_ore.webp"
  ]
}
```

---

#### GET /api/assets/{key}

Redirect to a presigned URL for the requested asset.

Response:
- `302 Redirect` to presigned S3 URL (valid for 1 hour)

Error Responses:
- `404 Not Found` - Asset does not exist

Implementation Details:
- Uses S3 presigned URLs to avoid exposing credentials
- URLs expire after 3600 seconds (1 hour)

---

## Error Handling

The API uses standard HTTP status codes:

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `302` | Redirect (for asset URLs) |
| `404` | Resource not found |
| `409` | Conflict (version mismatch) |
| `422` | Validation error (invalid request body) |
| `503` | Service unavailable (S3 down) |

All error responses include a `detail` field with more information:

```json
{
  "detail": "Project not found"
}
```

Or for structured errors:
```json
{
  "detail": {
    "message": "Version conflict",
    "cloud_version": 6,
    "your_version": 5
  }
}
```

---

## Running Locally

### Prerequisites

- Python 3.11+
- Access to MinIO/S3 storage

### Setup

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your S3 credentials
```

### Run Development Server

```bash
uvicorn main:app --reload --port 8000
```

The server will start at `http://localhost:8000`.

### API Documentation

FastAPI automatically generates interactive API documentation:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Docker Build

```bash
docker build -t satisfactory-tracker-backend .
docker run -p 8000:8000 --env-file .env satisfactory-tracker-backend
```

---

## Dependencies

From `requirements.txt`:

| Package | Purpose |
|---------|---------|
| `fastapi` | Web framework |
| `uvicorn` | ASGI server |
| `boto3` | AWS/S3 SDK |
| `pydantic` | Data validation |
| `python-dotenv` | Environment variable loading |
