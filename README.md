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

## Deployment & Automation

The application is packaged as container images and deployed to Kubernetes via Helm. Local development is supported through Docker Compose. A `Makefile` automates the full lifecycle of a multi-node Kind cluster for local Kubernetes evaluation.

### Helm chart (`helm/pulsecheck/`)

The chart deploys the full stack with:

- **Deployments** for frontend (Nginx + static SPA), api (FastAPI), worker (background poller), and redis
- **StatefulSet** for postgres backed by a PersistentVolumeClaim
- **Services** for each component (ClusterIP)
- **Ingress** routing `/api/*` to the api Service and `/*` to the frontend Service
- **Secret** for OAuth credentials, JWT signing key, and database password
- **ConfigMap** for non-sensitive runtime configuration
- **NetworkPolicies** enforcing a default-deny baseline with explicit per-component allow rules
- **HorizontalPodAutoscaler** for the api Deployment (CPU-based, 1–3 replicas)
- **TopologySpreadConstraints** distributing pods across nodes
- **Init containers** ensuring postgres and redis are ready before api and worker start

Pod security defaults across every workload: non-root execution, dropped Linux capabilities, no privilege escalation, seccomp `RuntimeDefault`, read-only root filesystem where the runtime supports it.

### Local cluster topology (Kind)

The local Kind cluster runs four nodes with deliberate role separation:

- 1 control plane (no application pods)
- 2 app workers (`role=app`) hosting the application Deployments and the StatefulSet
- 1 dedicated edge worker (`role=edge`) running only ingress-nginx, isolated via a `NoSchedule` taint

In production on a single-node K3s cluster, the same Helm chart deploys all workloads onto the single node; the multi-node topology above is local-only.

### Make targets

| Target | Description |
|---|---|
| `make help` | List all targets with descriptions |
| `make cluster-up` | Create the Kind cluster and deploy the full app |
| `make cluster-down` | Destroy the cluster |
| `make cluster-pause` | Stop the cluster node containers without destroying state |
| `make cluster-resume` | Resume the paused cluster |
| `make build-images` | Build the frontend, api, and worker images |
| `make load-images` | Load the built images into the Kind cluster |
| `make deploy` | Run `helm upgrade --install` after chart or values changes |
| `make redeploy` | Rebuild images, reload, and restart the deployments |

`make cluster-up` is the end-to-end target: it creates the Kind cluster, installs ingress-nginx pinned to the edge node, patches CoreDNS scheduling, installs metrics-server, builds the app images, loads them into the cluster, and Helm-installs the chart.

### Development with Docker Compose

`docker-compose.yml` builds every service at `target: dev` with source mounted for hot reload. `docker-compose.prod.yml` overrides to `target: prod`, drops dev ports, and exposes only the Nginx frontend on port 80 with `/api/*` proxied internally to the api container.

## Project Structure

```
.
├── api/                      # FastAPI backend
├── worker/                   # Background health checker
├── frontend/                 # React dashboard (Vite dev / Nginx prod)
├── db/                       # Shared SQLAlchemy models (used by api + worker)
├── parsers/                  # Status page parsers (used by api + worker)
├── helm/pulsecheck/          # Helm chart for Kubernetes deployment
├── k8s/                      # Kind cluster config and supporting manifests
├── Makefile                  # Local Kubernetes cluster lifecycle
├── docker-compose.yml        # Development stack
├── docker-compose.prod.yml   # Production override (target: prod, ports trimmed)
└── .env.example              # Environment variable template
```
