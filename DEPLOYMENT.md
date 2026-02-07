# Deploying to Dokploy (VPS) - Step by Step Guide

This guide walks you through deploying the Satisfactory Automation Tracker to your VPS using Dokploy with custom services.

## Prerequisites

- Dokploy installed on your VPS
- Git repository with the project pushed (GitHub, GitLab, etc.)
- Domain name (optional but recommended)

---

## Option A: Deploy as Docker Compose (Recommended)

### Step 1: Create a Compose Project

1. In Dokploy dashboard, click **"Create Project"**
2. Name it `satisfactory-tracker`

### Step 2: Add Compose Service

1. Inside your project, click **"Add Service" → "Compose"**
2. Connect your Git repository
3. Set the **Compose Path** to: `docker-compose.prod.yml`

### Step 3: Configure Environment Variables

In the Compose service settings, add these environment variables:

```env
S3_ENDPOINT=https://your-rustfs-or-minio-endpoint
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=satisfactory-tracker
ASSETS_BUCKET=satisfactory-assets
ASSETS_BASE_URL=https://your-rustfs-endpoint/satisfactory-assets
CORS_ORIGINS=https://your-frontend-domain.com
```

### Step 4: Deploy

Click **"Deploy"** and wait for containers to build and start.

---

## Option B: Deploy as Separate Services

If you prefer more control, deploy backend and frontend as separate services.

### Step 1: Create Project

1. In Dokploy, click **"Create Project"**
2. Name it `satisfactory-tracker`

### Step 2: Deploy Backend Service

1. Click **"Add Service" → "Application"**
2. Name: `backend`
3. **Source**: Git repository
4. **Build Path**: `./backend`
5. **Dockerfile Path**: `./backend/Dockerfile`
6. **Port**: `8000`

**Environment Variables:**
```env
S3_ENDPOINT=https://your-rustfs-endpoint
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=satisfactory-tracker
ASSETS_BUCKET=satisfactory-assets
ASSETS_BASE_URL=https://your-assets-url
CORS_ORIGINS=https://your-frontend-domain.com
```

### Step 3: Deploy Frontend Service

1. Click **"Add Service" → "Application"**
2. Name: `frontend`
3. **Source**: Same Git repository
4. **Build Path**: `./frontend`
5. **Dockerfile Path**: `./frontend/Dockerfile`
6. **Port**: `80`

### Step 4: Configure Domain & SSL

1. Go to each service → **Domains**
2. Add your domain (e.g., `tracker.yourdomain.com` for frontend)
3. Add API subdomain (e.g., `api.tracker.yourdomain.com` for backend)
4. Enable **Let's Encrypt SSL**

### Step 5: Update Frontend API URL

The frontend needs to know the backend URL. Edit `frontend/src/lib/api.ts` to use your backend domain, OR set it via nginx proxy (already configured in `nginx.conf`).

---

## Setting Up RustFS/MinIO Storage

### Option 1: Use Dokploy's Built-in S3

If Dokploy has S3 storage configured, get the credentials from settings.

### Option 2: Deploy MinIO Service

1. Add Service → **Docker** (not Compose)
2. Image: `minio/minio:latest`
3. Command: `server /data --console-address :9001`
4. Ports: `9000`, `9001`
5. Environment:
   ```
   MINIO_ROOT_USER=your-user
   MINIO_ROOT_PASSWORD=your-secure-password
   ```
6. Add persistent volume for `/data`

### Option 3: External RustFS

Use your existing RustFS installation and just configure the S3 credentials.

---

## Post-Deployment: Run the Scraper

After deployment, populate images by running the scraper:

```bash
# SSH into your VPS or run locally
cd scraper
pip install -r requirements.txt

export S3_ENDPOINT=https://your-rustfs-endpoint
export S3_ACCESS_KEY=your-access-key
export S3_SECRET_KEY=your-secret-key
export S3_BUCKET=satisfactory-assets

python scraper.py
```

---

## Troubleshooting

### Container won't start
- Check logs in Dokploy dashboard
- Verify environment variables are set correctly
- Ensure ports are not conflicting

### CORS errors in browser
- Add your frontend domain to `CORS_ORIGINS`
- Format: `https://yourdomain.com` (no trailing slash)

### S3 connection errors
- Verify S3_ENDPOINT is reachable from your VPS
- Check credentials are correct
- Ensure buckets exist or can be auto-created

### Frontend shows blank page
- Check browser console for errors
- Verify backend is reachable at the API URL
- Check nginx.conf proxy settings

---

## Quick Reference

| Service | Internal Port | Path |
|---------|--------------|------|
| Frontend | 80 | `/` |
| Backend | 8000 | `/api/*` |
| MinIO API | 9000 | - |
| MinIO Console | 9001 | - |

### Key Files
- `docker-compose.prod.yml` - Production compose (no MinIO)
- `docker-compose.yml` - Local dev with MinIO
- `backend/.env.example` - Backend env template
- `frontend/nginx.conf` - Frontend proxy config
