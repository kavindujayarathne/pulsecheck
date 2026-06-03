# Builder stage — installs Python dependencies into an isolated user prefix
FROM python:3.12-slim AS builder
WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Dev stage — full image with reload, used by docker-compose.yml
FROM python:3.12-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 app
COPY --from=builder --chown=app:app /root/.local /home/app/.local
ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY --chown=app:app db/ ./db/
COPY --chown=app:app parsers/ ./parsers/
COPY --chown=app:app api/ .
RUN chmod +x entrypoint.sh
USER app
EXPOSE 8000
CMD ["./entrypoint.sh", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Prod stage — same runtime, no reload
FROM python:3.12-slim AS prod
LABEL org.opencontainers.image.source=https://github.com/kavindujayarathne/pulsecheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 app
COPY --from=builder --chown=app:app /root/.local /home/app/.local
ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY --chown=app:app db/ ./db/
COPY --chown=app:app parsers/ ./parsers/
COPY --chown=app:app api/ .
RUN chmod +x entrypoint.sh
USER app
EXPOSE 8000
CMD ["./entrypoint.sh", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
