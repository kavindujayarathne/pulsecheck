# Builder stage — installs Python dependencies into an isolated user prefix
FROM python:3.12-slim AS builder
WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Dev stage — full image with reload, used by docker-compose.yml
FROM python:3.12-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY db/ ./db/
COPY parsers/ ./parsers/
COPY api/ .
RUN chmod +x entrypoint.sh
EXPOSE 8000
CMD ["./entrypoint.sh", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Prod stage — same runtime, no reload
FROM python:3.12-slim AS prod
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY db/ ./db/
COPY parsers/ ./parsers/
COPY api/ .
RUN chmod +x entrypoint.sh
EXPOSE 8000
CMD ["./entrypoint.sh", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
