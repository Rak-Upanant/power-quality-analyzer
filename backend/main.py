# backend/main.py
"""
FastAPI application entry point.
Only responsibilities: create the app, configure CORS, register routers.
All business logic lives in services/ and core/.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.analysis import router as analysis_router

app = FastAPI(
    title="Power Quality Analyzer",
    description="IEEE 519-2022 harmonic compliance analysis for Chauvin Arnoux CA8335 exports.",
    version="2.0.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://power-quality-analyzer.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(analysis_router)


@app.get("/")
def health_check():
    return {"message": "Power Quality Analyzer API is running.", "version": "2.0.0"}
