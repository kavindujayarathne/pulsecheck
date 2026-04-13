from fastapi import FastAPI

app = FastAPI(title="PulseCheck API")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "pulsecheck-api"}
