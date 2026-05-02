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

# Development (hot reload, ports 3000 and 8000 exposed)
docker compose up

# Production stack locally (Nginx on port 80, api reachable only via Nginx proxy)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## Services (development)

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000      |
| API      | http://localhost:8000      |
| API Docs | http://localhost:8000/docs |

In production mode, only the frontend is published (port 80). All `/api/` traffic is proxied to the api container internally by Nginx.

## Project Structure

```
.
├── api/                      # FastAPI backend
├── worker/                   # Background health checker
├── frontend/                 # React dashboard (Vite dev / Nginx prod)
├── db/                       # Shared SQLAlchemy models (used by api + worker)
├── parsers/                  # Status page parsers (used by api + worker)
├── docker-compose.yml        # Development stack
├── docker-compose.prod.yml   # Production override (target: prod, ports trimmed)
└── .env.example              # Environment variable template
```
