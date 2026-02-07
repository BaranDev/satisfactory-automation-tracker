# Satisfactory Automation Tracker

Track automated items in your Satisfactory factory, simulate production rates, and get improvement suggestions. Share your project with friends via a simple URL, no accounts needed.

## Features

- **Automation Tracking** - Mark items as automated with machine counts and overclock settings
- **Real-time Simulation** - Calculate production rates from recipes
- **Bottleneck Detection** - Find limiting factors in production chains
- **Improvement Suggestions** - Get optimization recommendations
- **Shareable Links** - Share via URL, no accounts needed
- **Cloud Sync** - Push/pull with automatic conflict resolution
- **Live Updates** - Auto-detects when collaborators make changes
- **Undo Support** - Restore previous state after pulling remote changes
- **AI Assistant** - FICSIT AI for factory tips

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Zustand |
| **Backend** | FastAPI (Python), boto3 |
| **Storage** | MinIO (S3-compatible) |

---

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy and edit environment file
cp .env.example .env
# Edit .env with your S3 credentials

# Run server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Optional: customize poll interval
echo "VITE_POLL_INTERVAL_MS=5000" > .env

# Run dev server
npm run dev
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Environment Variables

### Backend (.env)

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | MinIO/S3 endpoint URL |
| `S3_ACCESS_KEY` | S3 access key |
| `S3_SECRET_KEY` | S3 secret key |
| `S3_BUCKET` | Bucket for project data |
| `ASSETS_BUCKET` | Bucket for item icons |
| `ASSETS_BASE_URL` | Public URL for assets |
| `CORS_ORIGINS` | Allowed origins (comma-separated) |

### Frontend (.env)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_POLL_INTERVAL_MS` | Update check interval (ms) | `5000` |

---

## Sync and Collaboration

1. **Save** - Push local changes to cloud
2. **Live Detection** - App polls for remote updates (configurable interval)
3. **Conflict Resolution** - Choose "Use Remote" or "Overwrite" when conflicts occur
4. **Undo** - Restore previous state after pulling remote changes

---

## Project Structure

```
├── frontend/           # React app
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── store/      # Zustand state
│   │   ├── hooks/      # Custom hooks
│   │   └── lib/        # API, utils
│   └── Dockerfile
├── backend/            # FastAPI server
│   ├── routes/         # API endpoints
│   ├── storage.py      # S3 client
│   └── Dockerfile
├── scraper/            # Image scraper
└── docker-compose.yml
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/project` | Create project |
| `GET` | `/api/project/{id}` | Get project |
| `PUT` | `/api/project/{id}` | Update project |
| `GET` | `/api/storage-status` | Check S3 connectivity |
| `GET` | `/api/assets` | List assets |

---

## Production Deployment

Use `docker-compose.dokploy.yml` with your S3 credentials set as environment variables.

---

## License

MIT
