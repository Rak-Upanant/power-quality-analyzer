# backend/models/schemas.py
"""
Pydantic models for request validation and response documentation.
FastAPI uses these for OpenAPI schema generation and automatic validation.
"""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    """Query parameters passed as URL params to POST /analyze/"""
    nominal_voltage: float = Field(
        ..., gt=0, description="Nominal voltage at PCC in volts (e.g. 690)"
    )
    isc: float = Field(
        ..., gt=0, description="Maximum short-circuit current at PCC in amperes"
    )
    il: float = Field(
        ..., gt=0, description="Maximum demand load current IL in amperes (IEEE 519 §3.1)"
    )

    @model_validator(mode="after")
    def isc_must_exceed_il(self) -> "AnalyzeRequest":
        if self.isc < self.il:
            raise ValueError("Isc must be greater than or equal to IL")
        return self


# ---------------------------------------------------------------------------
# Response (lightweight — full data is dict-typed for flexibility)
# ---------------------------------------------------------------------------

class SummaryStats(BaseModel):
    u1_rms_avg: float; u2_rms_avg: float; u3_rms_avg: float
    v1_rms_avg: float; v2_rms_avg: float; v3_rms_avg: float
    a1_rms_avg: float; a2_rms_avg: float; a3_rms_avg: float
    a1_rms_max: float; a2_rms_max: float; a3_rms_max: float
    active_power_avg: float; reactive_power_avg: float; apparent_power_avg: float
    active_energy_total: float; reactive_energy_total: float; apparent_energy_total: float
    thdv_percent_avg: float; thdi_percent_avg: float; power_factor_avg: float


class AnalyzeResponse(BaseModel):
    fileName: str
    thdv_percent: float
    tdd_percent: float
    isc_il_ratio: float
    v_thd_prefix_used: str
    voltage_compliance: str
    current_compliance: str
    summary_stats: SummaryStats
    failing_points: dict[str, Any]
    compliance_detail: dict[str, Any]
    bar_chart_data: dict[str, Any]
    trend_data: dict[str, Any]
    recommendations: list[str]
