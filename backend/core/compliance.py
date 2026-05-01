# backend/core/compliance.py
"""
IEEE 519-2022 compliance evaluation.

Evaluates measured percentile statistics against Table 1 (voltage) and
Table 2 (current) limits.  Returns structured dicts consumed by the
API response schema and the PDF export.
"""
import numpy as np

from core.limits import (
    get_voltage_limit_table,
    get_current_limit_row,
    get_current_limit_for_harmonic,
)
from core.statistics import nan_to_zero


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _f(v) -> float:
    return round(nan_to_zero(v), 3)


def _add_fail(failing_points: dict, category: str, description: str,
              phase: str = None, harmonic: int = None):
    if category not in failing_points:
        failing_points[category] = {}
    if description not in failing_points[category]:
        failing_points[category][description] = {"phases": [], "harmonics": []}
    entry = failing_points[category][description]
    if phase and phase not in entry["phases"]:
        entry["phases"].append(phase)
    if harmonic and harmonic not in entry["harmonics"]:
        entry["harmonics"].append(harmonic)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate_compliance(
    nominal_voltage: float,
    isc: float,
    il: float,
    v_thd_prefix: str,
    voltage_thd_percentiles: dict,
    tdd_percentiles: dict,
    vh_indiv: dict,
    ah_indiv: dict,
    tdd_overall: float,
) -> dict:
    """
    Run all IEEE 519-2022 compliance checks.

    Returns:
      {
        "voltage_compliance": "Pass" | "Fail",
        "current_compliance": "Pass" | "Fail",
        "failing_points": {...},
        "compliance_detail": {...},
        "isc_il_ratio": float,
      }
    """
    failing_points: dict = {}
    voltage_compliance = "Pass"
    # >69 kV systems: Tables 3/4 not implemented — report N/A instead of false-Pass/Fail
    current_compliance = "Pass" if nominal_voltage <= 69_000 else "N/A"

    v_limit_table = get_voltage_limit_table(nominal_voltage)
    isc_il_ratio  = isc / il if il > 0 else 0.0
    c_limit_row   = get_current_limit_row(nominal_voltage, isc_il_ratio)

    # ── Voltage THD (§5.1) ──────────────────────────────────────────────────
    # The IEEE 519-2022 1.5× envelope applies to *very-short-time* (3-s) values.
    # CA8335 5-min data cannot produce a true 3-s aggregate, so we skip that check
    # and rely on the weekly 95th-percentile criterion.
    for phase in (1, 2, 3):
        col = f"{v_thd_prefix}{phase} THD"
        t95_10m = voltage_thd_percentiles.get(f"{col}_95th_10min", 0.0)

        if t95_10m > v_limit_table["thd"]:
            voltage_compliance = "Fail"
            _add_fail(failing_points, "Voltage THD", "Weekly 95th pct (10min) > THD limit",
                      phase=f"{v_thd_prefix}{phase}")

    # ── Individual voltage harmonics (§5.1) ─────────────────────────────────
    for h in range(2, 51):
        failed = []
        for phase in (1, 2, 3):
            val = vh_indiv.get(f"V{phase}h{h}_95th", 0.0)
            if val > v_limit_table["individual"]:
                voltage_compliance = "Fail"
                failed.append(f"V{phase}")
        if failed:
            _add_fail(failing_points, "Individual Voltage Harmonics",
                      f"H{h} 95th pct > individual limit", phase=", ".join(failed))

    # ── Current TDD (§5.3) ──────────────────────────────────────────────────
    if c_limit_row:
        tdd_limit = c_limit_row["tdd"]

        if tdd_overall > tdd_limit:
            current_compliance = "Fail"
            _add_fail(failing_points, "Current TDD", "Weekly 95th pct (10min) TDD > limit")

        # Skip the 2.0× very-short-time (3-s) envelope on 5-min data — see voltage note.
        for phase in (1, 2, 3):
            t_99  = tdd_percentiles.get(f"TDD{phase}_99th_10min", 0.0)
            if t_99 > tdd_limit * 1.5:
                current_compliance = "Fail"
                _add_fail(failing_points, "Current TDD",
                          "Weekly 99th pct (10min) > 1.5× TDD limit", phase=f"A{phase}")

        # ── Individual current harmonics (§5.3) ─────────────────────────────
        for h in range(2, 51):
            failed = []
            for phase in (1, 2, 3):
                val   = ah_indiv.get(f"A{phase}h{h}_95th", 0.0)
                limit = get_current_limit_for_harmonic(h, c_limit_row)
                if val > limit:
                    current_compliance = "Fail"
                    failed.append(f"A{phase}")
            if failed:
                _add_fail(failing_points, "Individual Current Harmonics",
                          f"H{h} 95th pct > limit", phase=", ".join(failed))

    # ── Build compliance_detail for UI/PDF ──────────────────────────────────
    v_thd_limit   = v_limit_table["thd"]
    v_indiv_limit = v_limit_table["individual"]
    c_tdd_limit   = c_limit_row["tdd"]    if c_limit_row else 0.0
    c_h_lt11      = c_limit_row["h_lt_11"] if c_limit_row else 0.0

    voltage_per_phase = []
    for phase in (1, 2, 3):
        t95 = _f(voltage_thd_percentiles.get(f"{v_thd_prefix}{phase} THD_95th_10min", 0.0))
        t99 = _f(voltage_thd_percentiles.get(f"{v_thd_prefix}{phase} THD_99th_10min", 0.0))
        voltage_per_phase.append({
            "phase": f"V{phase}",
            "t95_10min": t95, "t99_10min": t99,
            "limit_thd": v_thd_limit, "limit_thd_99": round(v_thd_limit * 1.5, 2),
            "pass_t95": t95 <= v_thd_limit, "pass_t99": t99 <= v_thd_limit * 1.5,
        })

    vh_indiv_detail = []
    for h in [3, 5, 7, 9, 11, 13, 15, 17, 19, 23, 25]:
        vals  = [_f(vh_indiv.get(f"V{p}h{h}_95th", 0.0)) for p in (1, 2, 3)]
        worst = max(vals)
        if worst > 0.05:
            vh_indiv_detail.append({
                "order": h, "V1": vals[0], "V2": vals[1], "V3": vals[2],
                "worst": worst, "limit": v_indiv_limit, "pass": worst <= v_indiv_limit,
            })

    tdd_per_phase = []
    ah_indiv_detail = []
    if c_limit_row:
        for phase in (1, 2, 3):
            t95 = _f(tdd_percentiles.get(f"TDD{phase}_95th_10min", 0.0))
            t99 = _f(tdd_percentiles.get(f"TDD{phase}_99th_10min", 0.0))
            tdd_per_phase.append({
                "phase": f"A{phase}",
                "t95_10min": t95, "t99_10min": t99,
                "limit_tdd": c_tdd_limit, "limit_tdd_99": round(c_tdd_limit * 1.5, 2),
                "pass_t95": t95 <= c_tdd_limit, "pass_t99": t99 <= c_tdd_limit * 1.5,
            })

        for h in [3, 5, 7, 9, 11, 13, 15, 17, 19, 23, 25]:
            vals  = [_f(ah_indiv.get(f"A{p}h{h}_95th", 0.0)) for p in (1, 2, 3)]
            worst = max(vals)
            limit = get_current_limit_for_harmonic(h, c_limit_row)
            if worst > 0.05:
                ah_indiv_detail.append({
                    "order": h, "A1": vals[0], "A2": vals[1], "A3": vals[2],
                    "worst": worst, "limit": round(limit, 2), "pass": worst <= limit,
                })

    compliance_detail = {
        "data_is_5min":       True,
        "isc_il_ratio":       round(isc_il_ratio, 2),
        "nominal_voltage_kv": round(nominal_voltage / 1000, 3),
        "v_thd_prefix":       v_thd_prefix,
        "voltage": {
            "thd_limit": v_thd_limit, "individual_limit": v_indiv_limit,
            "per_phase": voltage_per_phase, "top_harmonics": vh_indiv_detail,
        },
        "current": {
            "applicable":     c_limit_row is not None,
            "not_applicable_reason": (
                None if c_limit_row is not None
                else "IEEE 519-2022 Tables 3/4 (> 69 kV) not implemented in this analyzer."
            ),
            "tdd_limit": c_tdd_limit, "h_lt11_limit": c_h_lt11,
            "per_phase_tdd": tdd_per_phase, "top_harmonics": ah_indiv_detail,
        },
    }

    return {
        "voltage_compliance": voltage_compliance,
        "current_compliance": current_compliance,
        "failing_points":     failing_points,
        "compliance_detail":  compliance_detail,
        "isc_il_ratio":       round(isc_il_ratio, 2),
    }
