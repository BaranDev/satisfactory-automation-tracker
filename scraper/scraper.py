"""
Satisfactory Wiki Image Scraper

One-time script to fetch item images from satisfactory.wiki.gg,
convert them to WebP format, and upload to RustFS/S3.

Environment Variables:
    S3_ENDPOINT: S3/RustFS endpoint URL
    S3_ACCESS_KEY: Access key
    S3_SECRET_KEY: Secret key
    S3_BUCKET: Bucket name for assets

Usage:
    python scraper.py
"""

import os
import time
import re
from io import BytesIO
from urllib.parse import urljoin, unquote

import requests
from bs4 import BeautifulSoup
from PIL import Image
import boto3
from botocore.config import Config

# Configuration
WIKI_BASE_URL = "https://satisfactory.wiki.gg"
ITEMS_PAGE = "/wiki/Items"
DELAY_SECONDS = 1  # Rate limiting: 1 request per second
MAX_IMAGE_SIZE = 256  # Max dimension for icons

# S3 Configuration from environment
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "satisfactory-assets")


def get_s3_client():
    """Create S3 client for RustFS/MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(s3={"addressing_style": "path"}),
        region_name="us-east-1"
    )


def ensure_bucket_exists(s3_client, bucket_name):
    """Create bucket if it doesn't exist."""
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"Bucket '{bucket_name}' exists")
    except Exception:
        print(f"Creating bucket '{bucket_name}'...")
        s3_client.create_bucket(Bucket=bucket_name)


def fetch_page(url):
    """Fetch a page with rate limiting."""
    print(f"Fetching: {url}")
    time.sleep(DELAY_SECONDS)
    
    try:
        response = requests.get(url, timeout=30, headers={
            "User-Agent": "SatisfactoryTrackerBot/1.0 (Educational project)"
        })
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None


def extract_item_images(html_content):
    """Extract item image URLs from the wiki page."""
    soup = BeautifulSoup(html_content, "html.parser")
    images = {}
    
    # Find all item tables/galleries
    # The wiki typically has item icons in tables or galleries
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        alt = img.get("alt", "")
        
        if not src:
            continue
            
        # Skip non-item images
        if any(skip in src.lower() for skip in ["icon", "logo", "banner", "thumb"]):
            # These might actually be what we want, so let's check the alt text
            pass
        
        # Convert thumbnail URLs to full-size
        if "/thumb/" in src:
            # Wiki thumbnail format: /thumb/path/to/file.png/120px-file.png
            # We want: /path/to/file.png
            parts = src.split("/thumb/")
            if len(parts) > 1:
                path_parts = parts[1].rsplit("/", 1)
                if len(path_parts) > 1:
                    src = f"/images/{path_parts[0]}"
        
        # Normalize URL
        if src.startswith("//"):
            src = f"https:{src}"
        elif src.startswith("/"):
            src = urljoin(WIKI_BASE_URL, src)
        
        # Generate a clean key from alt text or filename
        if alt:
            key = sanitize_filename(alt)
        else:
            # Extract filename from URL
            filename = src.rsplit("/", 1)[-1]
            key = sanitize_filename(filename.rsplit(".", 1)[0])
        
        if key and src and ".png" in src.lower() or ".jpg" in src.lower():
            images[key] = src
    
    return images


def sanitize_filename(name):
    """Convert a name to a safe filename key."""
    # Remove file extension if present
    name = re.sub(r'\.(png|jpg|jpeg|gif|webp|svg)$', '', name, flags=re.IGNORECASE)
    # Convert to lowercase and replace spaces/special chars with underscores
    name = name.lower()
    name = re.sub(r'[^a-z0-9]+', '_', name)
    name = re.sub(r'_+', '_', name)
    name = name.strip('_')
    return name


def download_and_convert_image(url):
    """Download an image and convert to WebP format."""
    print(f"  Downloading: {url}")
    time.sleep(DELAY_SECONDS)
    
    try:
        response = requests.get(url, timeout=30, headers={
            "User-Agent": "SatisfactoryTrackerBot/1.0 (Educational project)"
        })
        response.raise_for_status()
        
        # Open image
        img = Image.open(BytesIO(response.content))
        
        # Convert to RGBA if necessary
        if img.mode in ("P", "L"):
            img = img.convert("RGBA")
        elif img.mode == "RGB":
            img = img.convert("RGBA")
        
        # Resize if too large, maintaining aspect ratio
        if max(img.size) > MAX_IMAGE_SIZE:
            img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS)
        
        # Convert to WebP
        output = BytesIO()
        img.save(output, format="WEBP", quality=85, optimize=True)
        output.seek(0)
        
        return output.getvalue()
    
    except Exception as e:
        print(f"  Error processing {url}: {e}")
        return None


def upload_to_s3(s3_client, bucket, key, data):
    """Upload data to S3."""
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType="image/webp"
        )
        print(f"  Uploaded: {key}")
        return True
    except Exception as e:
        print(f"  Error uploading {key}: {e}")
        return False


def main():
    print("=" * 60)
    print("Satisfactory Wiki Image Scraper")
    print("=" * 60)
    print(f"S3 Endpoint: {S3_ENDPOINT}")
    print(f"S3 Bucket: {S3_BUCKET}")
    print("")
    
    # Initialize S3 client
    s3_client = get_s3_client()
    ensure_bucket_exists(s3_client, S3_BUCKET)
    
    # Fetch main items page
    html = fetch_page(urljoin(WIKI_BASE_URL, ITEMS_PAGE))
    if not html:
        print("Failed to fetch items page")
        return
    
    # Extract image URLs
    images = extract_item_images(html)
    print(f"\nFound {len(images)} potential item images")
    
    # Also try some known item pages for more complete coverage
    known_categories = [
        "/wiki/Category:Items",
        "/wiki/Category:Parts",
        "/wiki/Category:Resources",
    ]
    
    for category in known_categories:
        cat_html = fetch_page(urljoin(WIKI_BASE_URL, category))
        if cat_html:
            cat_images = extract_item_images(cat_html)
            images.update(cat_images)
    
    print(f"\nTotal unique images: {len(images)}")
    print("-" * 40)
    
    # Download, convert, and upload each image
    successful = 0
    failed = 0
    
    for key, url in images.items():
        webp_key = f"{key}.webp"
        
        # Download and convert
        webp_data = download_and_convert_image(url)
        
        if webp_data:
            # Upload to S3
            if upload_to_s3(s3_client, S3_BUCKET, webp_key, webp_data):
                successful += 1
            else:
                failed += 1
        else:
            failed += 1
    
    print("")
    print("=" * 60)
    print(f"Completed: {successful} uploaded, {failed} failed")
    print("=" * 60)


if __name__ == "__main__":
    main()
