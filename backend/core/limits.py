# backend/core/limits.py
"""
IEEE 519-2022 Harmonic Limit Tables
=====================================
Single source of truth — imported by compliance.py and services/analyzer.py.
"""

# ---------------------------------------------------------------------------
# Table 1 — Voltage distortion limits (line-to-neutral at PCC)
# ---------------------------------------------------------------------------
VOLTAGE_LIMITS: dict[str, dict] = {
    "V_le_1kV":        {"individual": 5.0, "thd": 8.0},
    "V_1kV_to_69kV":   {"individual": 3.0, "thd": 5.0},
    "V_69kV_to_161kV": {"individual": 1.5, "thd": 2.5},
    "V_gt_161kV":      {"individual": 1.0, "thd": 1.5},
}

# ---------------------------------------------------------------------------
# Table 2 — Current distortion limits for 120 V – 69 kV systems (% of IL)
# Keys: (Isc/IL_min, Isc/IL_max) — lower bound inclusive, upper bound exclusive
# ---------------------------------------------------------------------------
CURRENT_LIMITS_120V_to_69kV: dict[tuple, dict] = {
    (0,    20):           {"h_lt_11": 4.0,  "h_11_17": 2.0, "h_17_23": 1.5, "h_23_35": 0.6, "h_gt_35": 0.3, "tdd": 5.0},
    (20,   50):           {"h_lt_11": 7.0,  "h_11_17": 3.5, "h_17_23": 2.5, "h_23_35": 1.0, "h_gt_35": 0.5, "tdd": 8.0},
    (50,   100):          {"h_lt_11": 10.0, "h_11_17": 4.5, "h_17_23": 4.0, "h_23_35": 1.5, "h_gt_35": 0.7, "tdd": 12.0},
    (100,  1000):         {"h_lt_11": 12.0, "h_11_17": 5.5, "h_17_23": 5.0, "h_23_35": 2.0, "h_gt_35": 1.0, "tdd": 15.0},
    (1000, float("inf")): {"h_lt_11": 15.0, "h_11_17": 7.0, "h_17_23": 6.0, "h_23_35": 2.5, "h_gt_35": 1.4, "tdd": 20.0},
}

# ---------------------------------------------------------------------------
# Limit lookup helpers
# ---------------------------------------------------------------------------

def get_voltage_limit_table(nominal_voltage_v: float) -> dict:
    """Return the correct voltage limit row for a nominal voltage (in volts)."""
    if nominal_voltage_v <= 1_000:
        return VOLTAGE_LIMITS["V_le_1kV"]
    elif nominal_voltage_v <= 69_000:
        return VOLTAGE_LIMITS["V_1kV_to_69kV"]
    elif nominal_voltage_v <= 161_000:
        return VOLTAGE_LIMITS["V_69kV_to_161kV"]
    else:
        return VOLTAGE_LIMITS["V_gt_161kV"]


def get_current_limit_row(nominal_voltage_v: float, isc_il_ratio: float) -> dict | None:
    """
    Return the Table 2 current limit row for a given voltage and Isc/IL ratio.
    Returns None for systems > 69 kV (Tables 3/4 not yet implemented).
    """
    if nominal_voltage_v > 69_000:
        return None
    for (mn, mx), lims in CURRENT_LIMITS_120V_to_69kV.items():
        if mn <= isc_il_ratio < mx:
            return lims
    return None


def get_current_limit_for_harmonic(order: int, limit_row: dict | None) -> float:
    """
    Return the individual harmonic current limit (%) for a given order.

    IEEE 519-2022 Table 2 footnote (a):
      For h ≤ 6, even harmonics are limited to 50% of the table values.
    """
    if not limit_row:
        return float("inf")

    if order < 11:
        base = limit_row.get("h_lt_11", float("inf"))
    elif order < 17:
        base = limit_row.get("h_11_17", float("inf"))
    elif order < 23:
        base = limit_row.get("h_17_23", float("inf"))
    elif order < 35:
        base = limit_row.get("h_23_35", float("inf"))
    else:
        base = limit_row.get("h_gt_35", float("inf"))

    # 50% reduction for even harmonics h ≤ 6
    if order <= 6 and order % 2 == 0:
        base *= 0.5

    return base
