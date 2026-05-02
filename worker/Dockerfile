# Builder stage — installs Python dependencies into an isolated user prefix
FROM python:3.12-slim AS builder
WORKDIR /app
COPY worker/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Dev stage — used by docker-compose.yml with source mounts for hot reload
FROM python:3.12-slim AS dev
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY db/ ./db/
COPY parsers/ ./parsers/
COPY worker/ .
CMD ["python", "main.py"]

# Prod stage — same runtime, immutable image
FROM python:3.12-slim AS prod
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY db/ ./db/
COPY parsers/ ./parsers/
COPY worker/ .
CMD ["python", "main.py"]
