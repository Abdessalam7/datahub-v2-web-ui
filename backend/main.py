from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from cache import cache
from cos_client import fetch_status_from_cos

app = FastAPI(title="Datahub v2 Smoke Tests API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

SUPPORTED_TECHS = {"airflow", "spark", "starburst"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/status")
def get_status(tech: str = Query(..., description="Technology: airflow or spark")):
    if tech not in SUPPORTED_TECHS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported tech '{tech}'. Must be one of: {sorted(SUPPORTED_TECHS)}"
        )

    cached = cache.get(tech)
    if cached is not None:
        return {"source": "cache", "data": cached}

    try:
        data = fetch_status_from_cos(tech)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    cache.set(tech, data)
    return {"source": "cos", "data": data}
