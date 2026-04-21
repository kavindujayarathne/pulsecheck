# PulseCheck

A self-hosted, multi-user service monitoring dashboard. PulseCheck pings HTTP endpoints on configurable intervals and tracks uptime, response time, and incidents in real time. Each user gets their own dashboard with services organized by custom categories.

## Architecture

```
Browser
  |
  v
Frontend (React + Nginx)  -->  API (Python FastAPI)  -->  PostgreSQL
                                      |                       ^
                                      v                       |
                                    Redis  <-----------  Worker (Python)
                                                            |
                                                            v
                                                    Pings external URLs
```

## Tech Stack

| Service    | Tech                       | Purpose                                    |
|------------|----------------------------|--------------------------------------------|
| Frontend   | React + Nginx              | Dashboard UI                               |
| API        | Python FastAPI             | REST endpoints, auth, data serving         |
| Worker     | Python                     | Pings endpoints, records results           |
| PostgreSQL | postgres:16-alpine         | Stores services, checks, incidents, users  |
| Redis      | redis:7-alpine             | Caches latest status per service           |

## Prerequisites

- Docker
- Docker Compose

## Quick Start

```bash
cp .env.example .env
# Edit .env with your values (OAuth credentials, etc.)
docker compose up
```

## Services

| Service  | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3000   |
| API      | http://localhost:8000   |
| API Docs | http://localhost:8000/docs |

## Project Structure

```
.
├── api/                  # FastAPI backend
├── worker/               # Background health checker
├── frontend/             # React dashboard
├── db/                   # Shared database models (used by api + worker)
├── helm/pulsecheck/      # Kubernetes Helm chart
├── docker-compose.yml    # Local development setup
└── .env.example          # Environment variable template
```
