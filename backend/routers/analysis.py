# backend/routers/analysis.py
"""
/analyze/ endpoint.
Handles file upload, delegates to services/analyzer.py, returns JSON.
"""
import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, HTTPException, UploadFile

from core.excel_parser import load_sheets
from models.schemas import AnalyzeResponse
from services.analyzer import analyze_full_data

router = APIRouter()
_executor = ThreadPoolExecutor()


@router.post("/analyze/", response_model=AnalyzeResponse)
async def analyze_power_data(
    nominal_voltage: float,
    isc: float,
    il: float,
    file: UploadFile = File(...),
):
    """
    Upload a Chauvin Arnoux CA8335 .xlsx export and receive IEEE 519-2022 analysis.

    Query params
    ------------
    nominal_voltage : float  — PCC nominal voltage in volts
    isc             : float  — Maximum short-circuit current (A)
    il              : float  — Maximum demand load current IL (A)
    """
    # ── 1. File-type guard ────────────────────────────────────────────────────
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an .xlsx file.",
        )

    # ── 2. Parameter sanity ───────────────────────────────────────────────────
    if nominal_voltage <= 0 or isc <= 0 or il <= 0:
        raise HTTPException(status_code=422, detail="nominal_voltage, isc, and il must be > 0.")

    try:
        contents = await file.read()

        # ── 3. Parse sheets ───────────────────────────────────────────────────
        try:
            all_sheets = load_sheets(contents)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # ── 4. Run CPU-bound analysis in thread pool ───────────────────────────
        loop = asyncio.get_event_loop()
        analysis_results = await loop.run_in_executor(
            _executor, analyze_full_data, all_sheets, nominal_voltage, isc, il
        )

        return {"fileName": file.filename, **analysis_results}

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
