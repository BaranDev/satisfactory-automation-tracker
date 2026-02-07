from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
import storage
from routes import projects, assets

app = FastAPI(
    title="Satisfactory Automation Tracker API",
    description="Backend API for tracking automated items in Satisfactory factories",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router)
app.include_router(assets.router)


@app.get("/")
async def root():
    return {"message": "Satisfactory Automation Tracker API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/storage-status")
async def storage_status():
    """Diagnostic endpoint to check storage connectivity."""
    s3_available = storage.is_s3_available()
    return {
        "s3_available": s3_available,
        "s3_endpoint": config.S3_ENDPOINT,
        "s3_bucket": config.S3_BUCKET,
        "assets_bucket": config.ASSETS_BUCKET,
    }
