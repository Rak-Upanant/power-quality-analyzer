# backend/routers/analysis.py
"""
/analyze/ endpoint.
Handles file upload, delegates to services/analyzer.py, returns JSON.
"""
import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Literal

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from core.excel_parser import load_sheets
from services.analyzer import analyze_full_data, analyze_power_only

router = APIRouter()
_executor = ThreadPoolExecutor()


@router.post("/analyze/")
async def analyze_power_data(
    file: UploadFile = File(...),
    nominal_voltage: float | None = None,
    isc: float | None = None,
    il: float | None = None,
    mode: Literal["full", "power_only"] = Query("full"),
):
    """
    Upload a Chauvin Arnoux CA8335 .xlsx export and receive analysis.

    Query params
    ------------
    nominal_voltage : float (optional) — PCC nominal voltage in volts; required for `mode=full`
    isc             : float (optional) — Max short-circuit current (A); required for `mode=full`
    il              : float (optional) — Max demand load current IL (A); required for `mode=full`
    mode            : "full" | "power_only" — Defaults to "full" (IEEE 519 compliance).
                                              "power_only" runs a slim pipeline focused on
                                              power consumption / energy / RMS trends and skips
                                              compliance and TDD. Vh / Ah harmonic sheets are
                                              loaded opportunistically so the harmonic spectrum
                                              and THD trends can still be reported when present.
    """
    # ── 1. File-type guard ────────────────────────────────────────────────────
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an .xlsx file.",
        )

    # ── 2. Parameter sanity ───────────────────────────────────────────────────
    if mode == "full":
        if nominal_voltage is None or nominal_voltage <= 0:
            raise HTTPException(status_code=422, detail="In 'full' mode, nominal_voltage is required and must be > 0.")
        if isc is None or il is None or isc <= 0 or il <= 0:
            raise HTTPException(
                status_code=422,
                detail="In 'full' mode, isc and il are required and must be > 0.",
            )

    try:
        contents = await file.read()

        # ── 3. Parse sheets ───────────────────────────────────────────────────
        try:
            if mode == "power_only":
                # Trend is required; harmonic sheets are best-effort.
                all_sheets = load_sheets(contents, required=("Trend",))
                try:
                    extra = load_sheets(contents, required=("Vh Harmonic %", "Ah Harmonic %"))
                    all_sheets.update(extra)
                except ValueError:
                    pass
            else:
                all_sheets = load_sheets(contents)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # ── 4. Run CPU-bound analysis in thread pool ───────────────────────────
        loop = asyncio.get_event_loop()
        if mode == "power_only":
            analysis_results = await loop.run_in_executor(
                _executor, analyze_power_only, all_sheets
            )
        else:
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
