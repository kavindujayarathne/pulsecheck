# Builder stage — installs Python dependencies into an isolated user prefix
FROM python:3.12-slim AS builder
WORKDIR /app
COPY worker/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Dev stage — used by docker-compose.yml with source mounts for hot reload
FROM python:3.12-slim AS dev
RUN useradd --create-home --uid 1000 app
COPY --from=builder --chown=app:app /root/.local /home/app/.local
ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY --chown=app:app db/ ./db/
COPY --chown=app:app parsers/ ./parsers/
COPY --chown=app:app worker/ .
USER app
CMD ["python", "main.py"]

# Prod stage — same runtime, immutable image
FROM python:3.12-slim AS prod
LABEL org.opencontainers.image.source=https://github.com/kavindujayarathne/pulsecheck
RUN useradd --create-home --uid 1000 app
COPY --from=builder --chown=app:app /root/.local /home/app/.local
ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY --chown=app:app db/ ./db/
COPY --chown=app:app parsers/ ./parsers/
COPY --chown=app:app worker/ .
USER app
CMD ["python", "main.py"]
