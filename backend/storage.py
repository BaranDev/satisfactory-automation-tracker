import json
import boto3
from botocore.exceptions import ClientError, EndpointConnectionError, NoCredentialsError
from botocore.config import Config
import config

# Track S3 availability
_s3_available = None

# Create S3 client with path-style addressing for MinIO/RustFS compatibility
s3_client = boto3.client(
    "s3",
    endpoint_url=config.S3_ENDPOINT,
    aws_access_key_id=config.S3_ACCESS_KEY,
    aws_secret_access_key=config.S3_SECRET_KEY,
    config=Config(s3={"addressing_style": "path"}, connect_timeout=5, read_timeout=5),
    region_name="us-east-1"  # Required but ignored by MinIO/RustFS
)


def is_s3_available() -> bool:
    """Check if S3 is reachable."""
    global _s3_available
    if _s3_available is not None:
        return _s3_available
    try:
        s3_client.list_buckets()
        _s3_available = True
    except (EndpointConnectionError, NoCredentialsError, ClientError):
        _s3_available = False
    return _s3_available


def ensure_bucket_exists(bucket_name: str) -> None:
    """Create bucket if it doesn't exist."""
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
    """Retrieve project JSON from S3."""
    if not is_s3_available():
        return None
    try:
        response = s3_client.get_object(
            Bucket=config.S3_BUCKET,
            Key=f"project-{project_id}.json"
        )
        return json.loads(response["Body"].read().decode("utf-8"))
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return None
        raise
    except EndpointConnectionError:
        return None


def put_project(project_id: str, data: dict) -> dict:
    """Write project JSON to S3. Returns data regardless of S3 status."""
    if not is_s3_available():
        return data  # Return data even if S3 is unavailable
    
    ensure_bucket_exists(config.S3_BUCKET)
    
    json_data = json.dumps(data, indent=2)
    try:
        s3_client.put_object(
            Bucket=config.S3_BUCKET,
            Key=f"project-{project_id}.json",
            Body=json_data.encode("utf-8"),
            ContentType="application/json"
        )
    except (ClientError, EndpointConnectionError):
        pass  # Silently fail - project still works locally
    return data


def get_project_metadata(project_id: str) -> dict | None:
    """Get project metadata (last_updated) without full content."""
    try:
        response = s3_client.head_object(
            Bucket=config.S3_BUCKET,
            Key=f"project-{project_id}.json"
        )
        return {
            "last_modified": response["LastModified"].isoformat(),
            "etag": response["ETag"].strip('"')
        }
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return None
        raise


def list_assets() -> list[str]:
    """List all asset keys in the assets bucket."""
    try:
        ensure_bucket_exists(config.ASSETS_BUCKET)
        response = s3_client.list_objects_v2(Bucket=config.ASSETS_BUCKET)
        return [obj["Key"] for obj in response.get("Contents", [])]
    except ClientError:
        return []


def get_asset_url(key: str) -> str:
    """Generate a presigned URL for an asset."""
    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": config.ASSETS_BUCKET, "Key": key},
            ExpiresIn=3600  # 1 hour
        )
        return url
    except ClientError:
        return ""
