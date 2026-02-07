# Satisfactory Automation Tracker

Track automated items in your Satisfactory factory, simulate production rates, and get improvement suggestions. Share your project with friends via a simple URL — no accounts needed.

## Features

- ✅ Track which items are automated
- ⚡ Real-time production simulation
- 🔍 Bottleneck detection
- 💡 Improvement suggestions
- 🔗 Shareable project links
- ☁️ Cloud sync (push/pull)
- 📄 PDF export
- 🌐 No authentication required

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: FastAPI (Python), boto3
- **Storage**: RustFS/MinIO (S3-compatible)
- **Containerization**: Docker, Docker Compose

## Quick Start (Local Development)

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Using Docker Compose

```bash
# Start all services (MinIO, backend, frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Access the app at http://localhost:3000

### Local Development (Without Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt

# Set environment variables
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=satisfactory-tracker

# Run
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Access the app at http://localhost:5173

### MinIO (Local S3)

If running locally without Docker Compose, start MinIO separately:

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

MinIO Console: http://localhost:9001

## Image Scraper

The scraper is a standalone Python script that fetches item images from the Satisfactory Wiki, converts them to WebP, and uploads to S3.

```bash
cd scraper
pip install -r requirements.txt

# Set environment variables
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=satisfactory-assets

# Run once
python scraper.py
```

⚠️ **Note**: The scraper is rate-limited (1 request/second) to be polite to the wiki.

## Production Deployment (Dokploy)

1. Push your code to a Git repository

2. Create a new project in Dokploy

3. Add services:
   - **Backend**: Docker deployment from `./backend`
   - **Frontend**: Docker deployment from `./frontend`
   - **RustFS**: See [RustFS installation](https://docs.rustfs.com/installation/)

4. Set environment variables for backend:
   ```
   S3_ENDPOINT=https://your-rustfs-endpoint
   S3_ACCESS_KEY=your-access-key
   S3_SECRET_KEY=your-secret-key
   S3_BUCKET=satisfactory-tracker
   ASSETS_BUCKET=satisfactory-assets
   ASSETS_BASE_URL=https://your-rustfs-endpoint/satisfactory-assets
   CORS_ORIGINS=https://your-frontend-domain
   ```

5. Configure domain/SSL in Dokploy

## Project Structure

```
satisfactory-automation-tracker/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── store/            # Zustand state
│   │   ├── lib/              # Utilities, API, simulation
│   │   ├── data/             # Static recipe data
│   │   └── types/            # TypeScript types
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                  # FastAPI backend
│   ├── routes/               # API routes
│   ├── main.py               # App entry
│   ├── config.py             # Environment config
│   ├── storage.py            # S3 client
│   ├── models.py             # Pydantic models
│   └── Dockerfile
├── scraper/                  # Standalone image scraper
│   ├── scraper.py
│   └── requirements.txt
├── docker-compose.yml        # Local dev setup
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/project` | Create new project |
| GET | `/api/project/{id}` | Get project by ID |
| PUT | `/api/project/{id}` | Update project |
| GET | `/api/assets` | List asset keys |
| GET | `/api/assets/{key}` | Get asset URL |

## License

MIT
