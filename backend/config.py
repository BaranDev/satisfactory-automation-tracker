import os
from dotenv import load_dotenv

load_dotenv()

# S3/RustFS Configuration
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "satisfactory-tracker")
ASSETS_BUCKET = os.getenv("ASSETS_BUCKET", "satisfactory-assets")
ASSETS_BASE_URL = os.getenv("ASSETS_BASE_URL", "http://localhost:9000/satisfactory-assets")

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
