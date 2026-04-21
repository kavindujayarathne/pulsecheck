from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from auth import router as auth_router
from db.base import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection verified.")
    except Exception as e:
        print(f"ERROR: Cannot connect to database: {e}")
        raise
    yield


app = FastAPI(title="PulseCheck API", lifespan=lifespan)

app.include_router(auth_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "pulsecheck-api"}
