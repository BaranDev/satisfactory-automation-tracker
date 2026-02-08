"""
Satisfactory Wiki Image Scraper

Fetches item images from satisfactory.wiki.gg individual item pages,
extracts the infobox (pi-media) image, converts to optimized WebP,
and uploads to RustFS/S3.

Modes:
  1. --test       Scrape a single item (default: Copper_Ore) to verify setup
  2. --machines   Scrape all known machines only
  3. --items-only Scrape all known items only
  4. --discover   Discover unknown items from wiki and scrape them
  5. (no flag)    Scrape all known items and machines

Environment Variables:
    S3_ENDPOINT   - S3/RustFS endpoint URL
    S3_ACCESS_KEY - Access key
    S3_SECRET_KEY - Secret key
    S3_BUCKET     - Bucket name for assets (default: satisfactory-assets)

Usage:

    # Test with a single item
    python scraper.py --test

    # Test with a specific item
    python scraper.py --test --item "Iron Plate"

    # Scrape all items and machines
    python scraper.py

    # Scrape all items and machines, skip already uploaded
    python scraper.py --skip-existing

    # Scrape all machines only
    python scraper.py --machines

    # Scrape all items only
    python scraper.py --items-only

    # Scrape all items and machines, discover unknown items from wiki
    python scraper.py --discover

    # Dry run (no upload)
    python scraper.py --dry-run
"""

import os
import sys
import time
import re
import argparse
from io import BytesIO
from urllib.parse import urljoin, quote

import requests
from bs4 import BeautifulSoup
from PIL import Image
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

WIKI_BASE_URL = "https://satisfactory.wiki.gg"
DELAY_SECONDS = 1.0  # Rate limit: 1 req/sec (be polite)
MAX_IMAGE_SIZE = 256  # Max dimension for output icons
WEBP_QUALITY = 85

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_BUCKET = os.getenv("S3_BUCKET", "satisfactory-assets")

USER_AGENT = "SatisfactoryTrackerBot/1.0 (Educational project; one-time scrape)"

# ──────────────────────────────────────────────
# Comprehensive item list
# Key: sanitized filename key
# Value: wiki page path (after /wiki/)
# ──────────────────────────────────────────────

ITEMS = {
    # ── Raw Resources ──
    "iron_ore": "Iron_Ore",
    "copper_ore": "Copper_Ore",
    "limestone": "Limestone",
    "coal": "Coal",
    "caterium_ore": "Caterium_Ore",
    "raw_quartz": "Raw_Quartz",
    "sulfur": "Sulfur",
    "bauxite": "Bauxite",
    "uranium": "Uranium",
    "sam": "SAM",
    "nitrogen_gas": "Nitrogen_Gas",
    "water": "Water",
    "crude_oil": "Crude_Oil",

    # ── Ingots ──
    "iron_ingot": "Iron_Ingot",
    "copper_ingot": "Copper_Ingot",
    "caterium_ingot": "Caterium_Ingot",
    "steel_ingot": "Steel_Ingot",
    "aluminum_ingot": "Aluminum_Ingot",
    "ficsite_ingot": "Ficsite_Ingot",

    # ── Basic Parts ──
    "iron_plate": "Iron_Plate",
    "iron_rod": "Iron_Rod",
    "screw": "Screw",
    "wire": "Wire",
    "cable": "Cable",
    "concrete": "Concrete",
    "quartz_crystal": "Quartz_Crystal",
    "silica": "Silica",
    "copper_sheet": "Copper_Sheet",
    "steel_beam": "Steel_Beam",
    "steel_pipe": "Steel_Pipe",
    "quickwire": "Quickwire",
    "aluminum_casing": "Aluminum_Casing",
    "alclad_aluminum_sheet": "Alclad_Aluminum_Sheet",
    "plastic": "Plastic",
    "rubber": "Rubber",
    "empty_canister": "Empty_Canister",
    "empty_fluid_tank": "Empty_Fluid_Tank",
    "ficsite_trigon": "Ficsite_Trigon",

    # ── Intermediate Parts ──
    "reinforced_iron_plate": "Reinforced_Iron_Plate",
    "modular_frame": "Modular_Frame",
    "heavy_modular_frame": "Heavy_Modular_Frame",
    "fused_modular_frame": "Fused_Modular_Frame",
    "rotor": "Rotor",
    "stator": "Stator",
    "motor": "Motor",
    "turbo_motor": "Turbo_Motor",
    "encased_industrial_beam": "Encased_Industrial_Beam",
    "circuit_board": "Circuit_Board",
    "ai_limiter": "AI_Limiter",
    "high_speed_connector": "High-Speed_Connector",
    "computer": "Computer",
    "supercomputer": "Supercomputer",
    "crystal_oscillator": "Crystal_Oscillator",
    "battery": "Battery",
    "electromagnetic_control_rod": "Electromagnetic_Control_Rod",
    "cooling_system": "Cooling_System",
    "radio_control_unit": "Radio_Control_Unit",
    "sam_fluctuator": "SAM_Fluctuator",
    "pressure_conversion_cube": "Pressure_Conversion_Cube",
    "neural_quantum_processor": "Neural-Quantum_Processor",
    "superposition_oscillator": "Superposition_Oscillator",
    "assembly_director_system": "Assembly_Director_System",

    # ── Fluids & Packaged ──
    "heavy_oil_residue": "Heavy_Oil_Residue",
    "fuel": "Fuel",
    "turbofuel": "Turbofuel",
    "liquid_biofuel": "Liquid_Biofuel",
    "alumina_solution": "Alumina_Solution",
    "sulfuric_acid": "Sulfuric_Acid",
    "nitric_acid": "Nitric_Acid",
    "dissolved_silica": "Dissolved_Silica",
    "rocket_fuel": "Rocket_Fuel",
    "ionized_fuel": "Ionized_Fuel",
    "packaged_water": "Packaged_Water",
    "packaged_oil": "Packaged_Oil",
    "packaged_fuel": "Packaged_Fuel",
    "packaged_heavy_oil_residue": "Packaged_Heavy_Oil_Residue",
    "packaged_turbofuel": "Packaged_Turbofuel",
    "packaged_liquid_biofuel": "Packaged_Liquid_Biofuel",
    "packaged_alumina_solution": "Packaged_Alumina_Solution",
    "packaged_sulfuric_acid": "Packaged_Sulfuric_Acid",
    "packaged_nitrogen_gas": "Packaged_Nitrogen_Gas",
    "packaged_nitric_acid": "Packaged_Nitric_Acid",
    "packaged_rocket_fuel": "Packaged_Rocket_Fuel",
    "packaged_ionized_fuel": "Packaged_Ionized_Fuel",

    # ── Biomass & Fuel ──
    "biomass": "Biomass",
    "solid_biofuel": "Solid_Biofuel",
    "compacted_coal": "Compacted_Coal",
    "petroleum_coke": "Petroleum_Coke",
    "polymer_resin": "Polymer_Resin",
    "fabric": "Fabric",

    # ── Nuclear ──
    "encased_uranium_cell": "Encased_Uranium_Cell",
    "uranium_fuel_rod": "Uranium_Fuel_Rod",
    "uranium_waste": "Uranium_Waste",
    "non_fissile_uranium": "Non-fissile_Uranium",
    "plutonium_pellet": "Plutonium_Pellet",
    "encased_plutonium_cell": "Encased_Plutonium_Cell",
    "plutonium_fuel_rod": "Plutonium_Fuel_Rod",
    "plutonium_waste": "Plutonium_Waste",
    "ficsonium": "Ficsonium",
    "ficsonium_fuel_rod": "Ficsonium_Fuel_Rod",

    # ── Advanced & Alien ──
    "dark_matter_crystal": "Dark_Matter_Crystal",
    "dark_matter_residue": "Dark_Matter_Residue",
    "diamonds": "Diamonds",
    "time_crystal": "Time_Crystal",
    "excited_photonic_matter": "Excited_Photonic_Matter",
    "reanimated_sam": "Reanimated_SAM",
    "power_shard": "Power_Shard",

    # ── Space Elevator Parts ──
    "smart_plating": "Smart_Plating",
    "versatile_framework": "Versatile_Framework",
    "automated_wiring": "Automated_Wiring",
    "modular_engine": "Modular_Engine",
    "adaptive_control_unit": "Adaptive_Control_Unit",
    "magnetic_field_generator": "Magnetic_Field_Generator",
    "thermal_propulsion_rocket": "Thermal_Propulsion_Rocket",
    "nuclear_pasta": "Nuclear_Pasta",
    "biochemical_sculptor": "Biochemical_Sculptor",
    "ballistic_warp_drive": "Ballistic_Warp_Drive",

    # ── Ammo & Equipment Parts ──
    "black_powder": "Black_Powder",
    "smokeless_powder": "Smokeless_Powder",
    "iron_rebar": "Iron_Rebar",
    "stun_rebar": "Stun_Rebar",
    "shatter_rebar": "Shatter_Rebar",
    "explosive_rebar": "Explosive_Rebar",
    "nobelisk": "Nobelisk",
    "gas_nobelisk": "Gas_Nobelisk",
    "pulse_nobelisk": "Pulse_Nobelisk",
    "cluster_nobelisk": "Cluster_Nobelisk",
    "nuke_nobelisk": "Nuke_Nobelisk",
    "rifle_ammo": "Rifle_Ammo",
    "homing_rifle_ammo": "Homing_Rifle_Ammo",
    "turbo_rifle_ammo": "Turbo_Rifle_Ammo",
    "gas_filter": "Gas_Filter",
    "iodine_infused_filter": "Iodine-Infused_Filter",

    # ── Misc ──
    "color_cartridge": "Color_Cartridge",
    "beacon": "Beacon",
    "portable_miner": "Portable_Miner",
    "medicinal_inhaler": "Medicinal_Inhaler",
}

# ──────────────────────────────────────────────
# Machine list for factory builder images
# Key: machine type key (matches frontend MACHINES dict)
# Value: wiki page path (after /wiki/)
# ──────────────────────────────────────────────

MACHINES = {
    "smelter": "Smelter",
    "foundry": "Foundry",
    "constructor": "Constructor",
    "assembler": "Assembler",
    "manufacturer": "Manufacturer",
    "packager": "Packager",
    "refinery": "Refinery",
    "blender": "Blender",
    "particle_accelerator": "Particle_Accelerator",
    "quantum_encoder": "Quantum_Encoder",
    "converter": "Converter",
    "miner_mk1": "Miner",
    "miner_mk2": "Miner",
    "miner_mk3": "Miner",
    "oil_extractor": "Oil_Extractor",
    "water_extractor": "Water_Extractor",
    "resource_well_pressurizer": "Resource_Well_Pressurizer",
    "coal_generator": "Coal-Powered_Generator",
    "fuel_generator": "Fuel-Powered_Generator",
    "nuclear_power_plant": "Nuclear_Power_Plant",
    "biomass_burner": "Biomass_Burner",
    "geothermal_generator": "Geothermal_Generator",
    "alien_power_augmenter": "Alien_Power_Augmenter",
}


# ──────────────────────────────────────────────
# S3 / Minio Client
# ──────────────────────────────────────────────


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(s3={"addressing_style": "path"}, connect_timeout=10, read_timeout=30),
        region_name="us-east-1",
    )


def ensure_bucket(s3):
    try:
        s3.head_bucket(Bucket=S3_BUCKET)
        print(f"  Bucket '{S3_BUCKET}' exists")
    except ClientError:
        print(f"  Creating bucket '{S3_BUCKET}'...")
        s3.create_bucket(Bucket=S3_BUCKET)


def list_existing_keys(s3) -> set[str]:
    """Return set of existing object keys in the bucket."""
    keys = set()
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=S3_BUCKET):
            for obj in page.get("Contents", []):
                keys.add(obj["Key"])
    except ClientError:
        pass
    return keys


# ──────────────────────────────────────────────
# Wiki Fetching
# ──────────────────────────────────────────────

_session = requests.Session()
_session.headers.update({"User-Agent": USER_AGENT})


def fetch_page(path: str) -> BeautifulSoup | None:
    """Fetch a wiki page and return parsed soup. Rate-limited."""
    url = f"{WIKI_BASE_URL}/wiki/{quote(path, safe='/:')}"
    time.sleep(DELAY_SECONDS)
    try:
        resp = _session.get(url, timeout=30)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        print(f"    WARN: Failed to fetch {url}: {e}")
        return None


def extract_infobox_image_url(soup: BeautifulSoup) -> str | None:
    """
    Extract the main item image URL from the wiki infobox.
    Looks for <figure class="pi-item pi-media pi-image"> → <img src="...">
    Falls back to other common patterns.
    """
    # Strategy 1: Portable infobox figure (most items)
    figure = soup.find("figure", class_="pi-media")
    if figure:
        img = figure.find("img")
        if img:
            src = img.get("src") or img.get("data-src")
            if src:
                return _normalize_image_url(src)

    # Strategy 2: Infobox image class
    img = soup.find("img", class_="pi-image-thumbnail")
    if img:
        src = img.get("src") or img.get("data-src")
        if src:
            return _normalize_image_url(src)

    # Strategy 3: First image in infobox div
    infobox = soup.find("aside", class_="portable-infobox")
    if infobox:
        img = infobox.find("img")
        if img:
            src = img.get("src") or img.get("data-src")
            if src:
                return _normalize_image_url(src)

    return None


def _normalize_image_url(src: str) -> str:
    """Convert relative/thumbnail URLs to full-size absolute URLs."""
    # Strip query params for cleaner URL (they're cache busters)
    # but keep them as the wiki might need them
    if src.startswith("//"):
        src = f"https:{src}"
    elif src.startswith("/"):
        src = f"{WIKI_BASE_URL}{src}"

    # If it's a thumbnail URL (/thumb/..../NNpx-File.png), get original
    thumb_match = re.match(r"(.*/images/)thumb/(.*)/\d+px-.*$", src)
    if thumb_match:
        src = f"{thumb_match.group(1)}{thumb_match.group(2)}"

    return src


def download_image(url: str) -> bytes | None:
    """Download image bytes from URL. Rate-limited."""
    time.sleep(DELAY_SECONDS)
    try:
        resp = _session.get(url, timeout=30)
        resp.raise_for_status()
        if len(resp.content) < 100:
            print(f"    WARN: Suspiciously small image ({len(resp.content)} bytes)")
            return None
        return resp.content
    except requests.RequestException as e:
        print(f"    WARN: Failed to download {url}: {e}")
        return None


# ──────────────────────────────────────────────
# Image Processing
# ──────────────────────────────────────────────

def convert_to_webp(image_bytes: bytes) -> bytes | None:
    """Convert image to optimized WebP, resize if needed."""
    try:
        img = Image.open(BytesIO(image_bytes))

        # Convert to RGBA for transparency support
        if img.mode not in ("RGBA", "RGB"):
            img = img.convert("RGBA")

        # Resize if larger than MAX_IMAGE_SIZE, keep aspect ratio
        if max(img.size) > MAX_IMAGE_SIZE:
            img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(output, format="WEBP", quality=WEBP_QUALITY, optimize=True)
        output.seek(0)
        return output.getvalue()
    except Exception as e:
        print(f"    WARN: Image conversion failed: {e}")
        return None


# ──────────────────────────────────────────────
# Upload
# ──────────────────────────────────────────────

def upload_to_s3(s3, key: str, data: bytes, dry_run: bool = False) -> bool:
    if dry_run:
        print(f"    DRY RUN: Would upload {key} ({len(data)} bytes)")
        return True
    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=data,
            ContentType="image/webp",
        )
        return True
    except ClientError as e:
        print(f"    ERROR: Upload failed for {key}: {e}")
        return False


# ──────────────────────────────────────────────
# Scrape Pipeline
# ──────────────────────────────────────────────

def scrape_item(s3, item_key: str, wiki_page: str, dry_run: bool = False) -> bool:
    """Scrape a single item: fetch page → extract image → convert → upload."""
    webp_key = f"{item_key}.webp"
    label = wiki_page.replace("_", " ")
    print(f"  [{item_key}] {label}")

    # 1. Fetch wiki page
    soup = fetch_page(wiki_page)
    if not soup:
        print(f"    SKIP: Could not fetch wiki page")
        return False

    # 2. Extract image URL
    image_url = extract_infobox_image_url(soup)
    if not image_url:
        print(f"    SKIP: No infobox image found")
        return False
    print(f"    Image URL: {image_url}")

    # 3. Download image
    raw_bytes = download_image(image_url)
    if not raw_bytes:
        print(f"    SKIP: Download failed")
        return False
    print(f"    Downloaded: {len(raw_bytes)} bytes")

    # 4. Convert to WebP
    webp_bytes = convert_to_webp(raw_bytes)
    if not webp_bytes:
        print(f"    SKIP: Conversion failed")
        return False
    print(f"    Converted to WebP: {len(webp_bytes)} bytes")

    # 5. Upload
    if upload_to_s3(s3, webp_key, webp_bytes, dry_run=dry_run):
        print(f"    Uploaded: {webp_key}")
        return True
    return False


# ──────────────────────────────────────────────
# Dynamic Discovery (optional enhancement)
# ──────────────────────────────────────────────

def discover_items_from_wiki() -> dict[str, str]:
    """
    Try to discover item pages from the wiki's Items page.
    Returns dict of {sanitized_key: wiki_page_path}.
    Falls back to ITEMS constant if this fails.
    """
    print("Attempting to discover items from wiki...")
    discovered = {}

    for page_path in ["Items", "Category:Items", "Category:Parts", "Category:Resources"]:
        soup = fetch_page(page_path)
        if not soup:
            continue

        # Find all links to item pages
        for link in soup.find_all("a", href=True):
            href = link["href"]
            # Match /wiki/ItemName patterns, exclude special pages
            match = re.match(r"^/wiki/([A-Z][A-Za-z0-9_\-]+)$", href)
            if not match:
                continue
            page_name = match.group(1)
            # Skip non-item pages
            if any(skip in page_name for skip in [
                "Category:", "File:", "Template:", "Special:", "Help:",
                "Tutorial:", "User:", "Talk:", "Satisfactory_Wiki",
            ]):
                continue
            key = _sanitize_key(page_name)
            if key:
                discovered[key] = page_name

    if discovered:
        print(f"  Discovered {len(discovered)} potential items from wiki")
    else:
        print("  Discovery failed, using built-in item list")

    return discovered


def _sanitize_key(page_name: str) -> str:
    """Convert wiki page name to a safe key."""
    key = page_name.lower()
    key = key.replace("-", "_")
    key = re.sub(r"[^a-z0-9_]", "_", key)
    key = re.sub(r"_+", "_", key)
    return key.strip("_")


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Satisfactory Wiki Image Scraper")
    parser.add_argument("--test", action="store_true", help="Test mode: scrape one item only")
    parser.add_argument("--item", type=str, default="Copper_Ore", help="Item wiki page name for --test mode")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually upload to S3")
    parser.add_argument("--skip-existing", action="store_true", help="Skip items already in S3")
    parser.add_argument("--discover", action="store_true", help="Also discover items from wiki (slower)")
    parser.add_argument("--machines", action="store_true", help="Scrape machine images only (not items)")
    parser.add_argument("--items-only", action="store_true", help="Scrape item images only (not machines)")
    args = parser.parse_args()

    print("=" * 60)
    print("Satisfactory Wiki Image Scraper")
    print("=" * 60)
    print(f"S3 Endpoint: {S3_ENDPOINT}")
    print(f"S3 Bucket:   {S3_BUCKET}")
    print(f"Dry Run:     {args.dry_run}")
    print()

    # Init S3
    s3 = get_s3_client()
    if not args.dry_run:
        ensure_bucket(s3)

    # Determine items to scrape
    if args.test:
        # Test mode: single item
        key = _sanitize_key(args.item)
        items = {key: args.item}
        print(f"TEST MODE: Scraping '{args.item}' only")
    elif args.machines:
        # Machine images only - prefix keys with "machine_" for S3
        items = {f"machine_{k}": v for k, v in MACHINES.items()}
        print(f"Scraping {len(items)} machine images only")
    elif args.items_only:
        # Items only (original behavior)
        items = dict(ITEMS)
        if args.discover:
            discovered = discover_items_from_wiki()
            for k, v in discovered.items():
                if k not in items:
                    items[k] = v
        print(f"Scraping {len(items)} items only")
    else:
        # Default: scrape both items AND machines
        items = dict(ITEMS)
        if args.discover:
            discovered = discover_items_from_wiki()
            for k, v in discovered.items():
                if k not in items:
                    items[k] = v
        # Add machines with prefix
        machines = {f"machine_{k}": v for k, v in MACHINES.items()}
        items.update(machines)
        print(f"Scraping {len(items)} total ({len(ITEMS)} items + {len(MACHINES)} machines)")

    # Check existing keys
    existing_keys = set()
    if args.skip_existing and not args.dry_run:
        print("Checking existing uploads...")
        existing_keys = list_existing_keys(s3)
        print(f"  Found {len(existing_keys)} existing objects")

    print("-" * 60)

    # Scrape
    success = 0
    skipped = 0
    failed = 0

    for item_key, wiki_page in items.items():
        webp_key = f"{item_key}.webp"

        if args.skip_existing and webp_key in existing_keys:
            print(f"  [{item_key}] SKIP: Already exists in S3")
            skipped += 1
            continue

        if scrape_item(s3, item_key, wiki_page, dry_run=args.dry_run):
            success += 1
        else:
            failed += 1

    print()
    print("=" * 60)
    print(f"Results: {success} uploaded, {failed} failed, {skipped} skipped")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()