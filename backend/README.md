# Backend

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Environment Variables

```
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=satisfactory-tracker
ASSETS_BASE_URL=http://localhost:9000/satisfactory-assets
```
