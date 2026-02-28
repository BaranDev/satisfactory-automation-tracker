# Contributing to Satisfactory Automation Tracker

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Follow the setup instructions in [README.md](README.md)

## Development Workflow

1. Create a branch from `main` for your changes
2. Make your changes with clear, descriptive commits
3. Test your changes locally (both frontend and backend)
4. Open a pull request against `main`

## Pull Requests

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Update documentation if your change affects setup, configuration, or usage
- Ensure the app builds and runs without errors

## Reporting Issues

- Use GitHub Issues to report bugs or request features
- Include steps to reproduce for bug reports
- Check existing issues before opening a new one

## Code Style

- **Frontend**: Follow existing TypeScript/React patterns. Use the project's ESLint configuration (`npm run lint`)
- **Backend**: Follow existing Python/FastAPI patterns

## Local Development

See [README.md](README.md) for full setup instructions. Quick start:

```bash
# Start all services with Docker
docker-compose up --build

# Or run individually:
# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
```

## Questions?

Open a GitHub Issue for any questions about contributing.
