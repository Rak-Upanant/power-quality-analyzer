# backend/services/analyzer.py
"""
Core analysis orchestrator — no FastAPI or HTTP imports.
Calls core modules and returns a plain Python dict.
"""
import numpy as np
import pandas as pd

from core.excel_parser import build_trend_index
from core.statistics import (
    to_numeric_safe, nan_to_zero, get_last_value_safe,
    calculate_percentiles, calculate_individual_harmonic_percentiles,
)
from core.compliance import evaluate_compliance
from core.limits import get_current_limit_for_harmonic, get_current_limit_row


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------

def _generate_recommendations(result: dict) -> list[str]:
    recs = []
    if result.get("voltage_compliance") == "Fail":
        recs.append(
            "Voltage harmonic distortion exceeds IEEE 519-2022 limits. "
            "Investigate harmonic sources at the PCC and consider passive or active harmonic filters."
        )
    if result.get("current_compliance") == "Fail":
        recs.append(
            "Current distortion (TDD or individual harmonics) exceeds IEEE 519-2022 limits. "
            "Identify non-linear loads (VFDs, rectifiers) and install appropriate harmonic filters "
            "or use multi-pulse transformer arrangements."
        )
    pf = result.get("summary_stats", {}).get("power_factor_avg", 1.0)
    if pf < 0.95:
        recs.append(
            f"Average power factor is {pf:.3f} — below the recommended 0.95. "
            "Consider installing capacitor banks or active power factor correction (PFC)."
        )
    if not recs:
        recs.append(
            "System power quality is within IEEE 519-2022 limits. "
            "Continue periodic monitoring to detect emerging distortion trends."
        )
    return recs


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def analyze_full_data(dfs: dict, nominal_voltage: float, isc: float, il: float) -> dict:
    """
    Orchestrate the full IEEE 519-2022 analysis pipeline.

    Parameters
    ----------
    dfs             : dict of DataFrames from excel_parser.load_sheets()
    nominal_voltage : PCC nominal voltage in volts
    isc             : Maximum short-circuit current at PCC (A)
    il              : Maximum demand load current IL (A)

    Returns
    -------
    Plain Python dict suitable for JSON serialisation.
    """
    df_trend        = dfs.get("Trend")
    df_vh_harmonics = dfs.get("Vh Harmonic %")
    df_ah_harmonics = dfs.get("Ah Harmonic %")

    if df_trend is None or df_vh_harmonics is None or df_ah_harmonics is None:
        raise ValueError("Missing required worksheets: 'Trend', 'Vh Harmonic %', 'Ah Harmonic %'.")

    # ── 1. Build time-indexed DataFrame ──────────────────────────────────────
    clean_df = build_trend_index(df_trend)

    # Measurement duration — IEEE 519-2022 §4.4 requires a 7-day window for
    # weekly statistics. Surface this so the UI can warn for short captures.
    if len(clean_df.index) >= 2:
        span = clean_df.index.max() - clean_df.index.min()
        measurement_duration_days = round(span.total_seconds() / 86400.0, 2)
    else:
        measurement_duration_days = 0.0
    weekly_window_satisfied = measurement_duration_days >= 7.0

    # ── 2. Compute per-phase TDD ──────────────────────────────────────────────
    # TDD = (Ih_rms / IL) × 100  where  I1 = Irms / √(1 + THDi²),  Ih = I1 × THDi
    if il > 0:
        for p in (1, 2, 3):
            thdi_pct = to_numeric_safe(clean_df.get(f"A{p} THD", pd.Series([])))
            irms     = to_numeric_safe(clean_df.get(f"A{p} RMS", pd.Series([])))
            thdi_pu  = thdi_pct / 100.0
            i1       = irms / np.sqrt(1 + thdi_pu ** 2)
            ih_rms   = i1 * thdi_pu
            clean_df[f"TDD{p}"] = (ih_rms / il) * 100.0
    else:
        for p in (1, 2, 3):
            clean_df[f"TDD{p}"] = 0.0

    # ── 3. Statistical metrics ────────────────────────────────────────────────
    # Use V-prefix (line-to-neutral) for voltage THD per IEEE §5.1; fall back to U
    v_thd_prefix = "V" if any(f"V{p} THD" in clean_df.columns for p in (1, 2, 3)) else "U"

    voltage_thd_pct = calculate_percentiles(clean_df, v_thd_prefix, column_suffix=" THD")
    current_thd_pct = calculate_percentiles(clean_df, "A",          column_suffix=" THD")
    tdd_pct         = calculate_percentiles(clean_df, "TDD",        column_suffix="")

    thdv_overall = max(voltage_thd_pct.get(f"{v_thd_prefix}{p} THD_95th_10min", 0.0) for p in (1, 2, 3))
    thdi_overall = max(current_thd_pct.get(f"A{p} THD_95th_10min",               0.0) for p in (1, 2, 3))
    tdd_overall  = max(tdd_pct.get(        f"TDD{p}_95th_10min",                 0.0) for p in (1, 2, 3))

    # ── 4. Individual harmonic percentiles ────────────────────────────────────
    vh_indiv = calculate_individual_harmonic_percentiles(df_vh_harmonics, "V", 95)
    ah_indiv = calculate_individual_harmonic_percentiles(df_ah_harmonics, "A", 95)

    # ── 5. Summary statistics ─────────────────────────────────────────────────
    def cm(name): return nan_to_zero(to_numeric_safe(clean_df.get(name, pd.Series([]))).mean())
    def cx(name): return nan_to_zero(to_numeric_safe(clean_df.get(name, pd.Series([]))).max())

    active_power   = to_numeric_safe(clean_df.get("W Total",  pd.Series([0])))
    apparent_power = to_numeric_safe(clean_df.get("VA Total", pd.Series([0])))
    pf_series      = active_power / apparent_power.where(apparent_power != 0, np.nan)

    summary_stats = {
        "u1_rms_avg": cm("U1 RMS"), "u2_rms_avg": cm("U2 RMS"), "u3_rms_avg": cm("U3 RMS"),
        "v1_rms_avg": cm("V1 RMS"), "v2_rms_avg": cm("V2 RMS"), "v3_rms_avg": cm("V3 RMS"),
        "a1_rms_avg": cm("A1 RMS"), "a2_rms_avg": cm("A2 RMS"), "a3_rms_avg": cm("A3 RMS"),
        "a1_rms_max": cx("A1 RMS"), "a2_rms_max": cx("A2 RMS"), "a3_rms_max": cx("A3 RMS"),
        "active_power_avg":      cm("W Total"),
        "reactive_power_avg":    cm("var Total"),
        "apparent_power_avg":    cm("VA Total"),
        "active_energy_total":   nan_to_zero(get_last_value_safe(to_numeric_safe(clean_df.get("Wh Total",   pd.Series([0]))))),
        "reactive_energy_total": nan_to_zero(get_last_value_safe(to_numeric_safe(clean_df.get("varh Total", pd.Series([0]))))),
        "apparent_energy_total": nan_to_zero(get_last_value_safe(to_numeric_safe(clean_df.get("VAh Total",  pd.Series([0]))))),
        "thdv_percent_avg": nan_to_zero(thdv_overall),
        "thdi_percent_avg": nan_to_zero(thdi_overall),
        "power_factor_avg": nan_to_zero(pf_series.mean()),
    }

    # ── 6. Compliance evaluation ──────────────────────────────────────────────
    compliance = evaluate_compliance(
        nominal_voltage=nominal_voltage,
        isc=isc, il=il,
        v_thd_prefix=v_thd_prefix,
        voltage_thd_percentiles=voltage_thd_pct,
        tdd_percentiles=tdd_pct,
        vh_indiv=vh_indiv,
        ah_indiv=ah_indiv,
        tdd_overall=tdd_overall,
    )

    # ── 7. Bar chart data ─────────────────────────────────────────────────────
    harmonic_orders = list(range(2, 51))
    vh_bar_data, ah_bar_data = [], []
    for h in harmonic_orders:
        vh_vals = [vh_indiv.get(f"V{p}h{h}_95th", 0.0) for p in (1, 2, 3)]
        ah_vals = [ah_indiv.get(f"A{p}h{h}_95th", 0.0) for p in (1, 2, 3)]
        vh_bar_data.append(nan_to_zero(float(np.mean(vh_vals))))
        ah_bar_data.append(nan_to_zero(float(np.mean(ah_vals))))

    # ── 8. Trend data ─────────────────────────────────────────────────────────
    def tl(col): return to_numeric_safe(clean_df.get(col, pd.Series([]))).fillna(0).tolist()

    trend_data = {
        "timestamps":      clean_df.index.strftime("%Y-%m-%d %H:%M:%S").tolist(),
        "voltage_ll":      {"U1 RMS": tl("U1 RMS"), "U2 RMS": tl("U2 RMS"), "U3 RMS": tl("U3 RMS")},
        "voltage_ln":      {"V1 RMS": tl("V1 RMS"), "V2 RMS": tl("V2 RMS"), "V3 RMS": tl("V3 RMS")},
        "current":         {"A1 RMS": tl("A1 RMS"), "A2 RMS": tl("A2 RMS"), "A3 RMS": tl("A3 RMS")},
        "active_power":    {"W Total":    tl("W Total")},
        "reactive_power":  {"var Total":  tl("var Total")},
        "apparent_power":  {"VA Total":   tl("VA Total")},
        "active_energy":   {"Wh Total":   tl("Wh Total")},
        "reactive_energy": {"varh Total": tl("varh Total")},
        "apparent_energy": {"VAh Total":  tl("VAh Total")},
        "thdv_percent": {
            "V1 THD": tl("V1 THD"), "V2 THD": tl("V2 THD"), "V3 THD": tl("V3 THD"),
            "U1 THD": tl("U1 THD"), "U2 THD": tl("U2 THD"), "U3 THD": tl("U3 THD"),
        },
        "thdi_percent":  {"A1 THD": tl("A1 THD"), "A2 THD": tl("A2 THD"), "A3 THD": tl("A3 THD")},
        "power_factor":  {"PF1": tl("PF1"), "PF2": tl("PF2"), "PF3": tl("PF3"), "PF Mean": tl("PF Mean")},
        "unbalance":     {"Vunb": tl("Vunb"), "Aunb": tl("Aunb")},
        "tdd": {
            "TDD1": to_numeric_safe(clean_df.get("TDD1", pd.Series([]))).fillna(0).tolist(),
            "TDD2": to_numeric_safe(clean_df.get("TDD2", pd.Series([]))).fillna(0).tolist(),
            "TDD3": to_numeric_safe(clean_df.get("TDD3", pd.Series([]))).fillna(0).tolist(),
        },
        "frequency": {"Frequency": tl("Frequency")},
    }

    # ── 9. Assemble result ────────────────────────────────────────────────────
    result = {
        "thdv_percent":             nan_to_zero(thdv_overall),
        "tdd_percent":              nan_to_zero(tdd_overall),
        "isc_il_ratio":             compliance["isc_il_ratio"],
        "v_thd_prefix_used":        v_thd_prefix,
        "measurement_duration_days": measurement_duration_days,
        "weekly_window_satisfied":  weekly_window_satisfied,
        "summary_stats":            summary_stats,
        "voltage_compliance": compliance["voltage_compliance"],
        "current_compliance": compliance["current_compliance"],
        "failing_points":     compliance["failing_points"],
        "compliance_detail":  compliance["compliance_detail"],
        "bar_chart_data":     {"labels": harmonic_orders, "vh_data": vh_bar_data, "ah_data": ah_bar_data},
        "trend_data":         trend_data,
    }
    result["recommendations"] = _generate_recommendations(result)
    return result
