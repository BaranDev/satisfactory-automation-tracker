import json
import time
import logging
import boto3
from botocore.exceptions import ClientError, EndpointConnectionError, NoCredentialsError
from botocore.config import Config
import config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# S3 availability cache with TTL
_s3_available: bool | None = None
_s3_check_time: float = 0
_S3_CHECK_TTL = 30  # Re-check every 30 seconds if unavailable

s3_client = boto3.client(
    "s3",
    endpoint_url=config.S3_ENDPOINT,
    aws_access_key_id=config.S3_ACCESS_KEY,
    aws_secret_access_key=config.S3_SECRET_KEY,
    config=Config(s3={"addressing_style": "path"}, connect_timeout=5, read_timeout=10),
    region_name="us-east-1",
)


def is_s3_available() -> bool:
    """Check if S3 is reachable, with TTL cache."""
    global _s3_available, _s3_check_time
    now = time.time()

    # If previously available, trust it (fast path)
    if _s3_available is True:
        return True

    # If unavailable, retry after TTL
    if _s3_available is False and (now - _s3_check_time) < _S3_CHECK_TTL:
        return False

    try:
        logger.info(f"Checking S3 connectivity to {config.S3_ENDPOINT}...")
        s3_client.list_buckets()
        _s3_available = True
        logger.info("S3 is available")
    except (EndpointConnectionError, NoCredentialsError, ClientError) as e:
        logger.error(f"S3 not available: {type(e).__name__}: {e}")
        _s3_available = False
    _s3_check_time = now
    return _s3_available


def ensure_bucket_exists(bucket_name: str) -> None:
    if not is_s3_available():
        return
    try:
        s3_client.head_bucket(Bucket=bucket_name)
    except ClientError:
        try:
            s3_client.create_bucket(Bucket=bucket_name)
        except ClientError:
            pass


def get_project(project_id: str) -> dict | None:
    logger.info(f"Getting project {project_id} from bucket {config.S3_BUCKET}")
    if not is_s3_available():
        logger.warning(f"Cannot get project {project_id}: S3 not available")
        return None
    try:
        response = s3_client.get_object(
            Bucket=config.S3_BUCKET,
            Key=f"project-{project_id}.json",
        )
        data = json.loads(response["Body"].read().decode("utf-8"))
        logger.info(f"Successfully retrieved project {project_id}")
        return data
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            logger.warning(f"Project {project_id} not found in S3")
            return None
        logger.error(f"ClientError getting project {project_id}: {e}")
        raise
    except EndpointConnectionError as e:
        logger.error(f"Connection error getting project {project_id}: {e}")
        return None


def put_project(project_id: str, data: dict) -> tuple[dict, bool]:
    """Store a project. Returns (data, success) tuple."""
    logger.info(f"Putting project {project_id} to bucket {config.S3_BUCKET}")
    if not is_s3_available():
        logger.error(f"Cannot save project {project_id}: S3 not available")
        return data, False

    ensure_bucket_exists(config.S3_BUCKET)

    json_data = json.dumps(data, indent=2)
    try:
        s3_client.put_object(
            Bucket=config.S3_BUCKET,
            Key=f"project-{project_id}.json",
            Body=json_data.encode("utf-8"),
            ContentType="application/json",
        )
        logger.info(f"Successfully saved project {project_id}")
        return data, True
    except (ClientError, EndpointConnectionError) as e:
        logger.error(f"Failed to save project {project_id}: {type(e).__name__}: {e}")
        return data, False


def get_project_metadata(project_id: str) -> dict | None:
    if not is_s3_available():
        return None
    try:
        response = s3_client.head_object(
            Bucket=config.S3_BUCKET,
            Key=f"project-{project_id}.json",
        )
        return {
            "last_modified": response["LastModified"].isoformat(),
            "etag": response["ETag"].strip('"'),
        }
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
            return None
        raise


def list_assets() -> list[str]:
    if not is_s3_available():
        return []
    try:
        ensure_bucket_exists(config.ASSETS_BUCKET)
        keys = []
        paginator = s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=config.ASSETS_BUCKET):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])
        return keys
    except ClientError:
        return []


def get_asset_url(key: str) -> str:
    """Generate a presigned URL for an asset."""
    if not is_s3_available():
        return ""
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": config.ASSETS_BUCKET, "Key": key},
            ExpiresIn=3600,
        )
        return url
    except ClientError:
        return ""