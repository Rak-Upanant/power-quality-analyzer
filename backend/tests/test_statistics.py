# backend/tests/test_statistics.py
"""Unit tests for the statistical helpers — the P0 correctness fixes."""
import numpy as np
import pandas as pd

from core.statistics import (
    get_energy_delta_safe,
    get_last_value_safe,
    calculate_percentiles,
    calculate_individual_harmonic_percentiles,
)


# ── Energy delta (last − first, with reset guard) ──────────────────────────

def test_energy_delta_counter_starting_nonzero():
    # A running counter that did not start at 0 → consumption is the delta.
    s = pd.Series([1000.0, 1100.0, 1250.0, 1400.0])
    assert get_energy_delta_safe(s) == 400.0


def test_energy_delta_starting_at_zero_matches_last():
    s = pd.Series([0.0, 150.0, 300.0])
    assert get_energy_delta_safe(s) == 300.0


def test_energy_delta_reset_falls_back_to_last():
    # Counter reset mid-capture: delta would be negative, so fall back to last.
    s = pd.Series([1400.0, 50.0, 120.0])
    assert get_energy_delta_safe(s) == 120.0


def test_energy_delta_empty_is_zero():
    assert get_energy_delta_safe(pd.Series([], dtype=float)) == 0.0


def test_energy_delta_ignores_nan_endpoints():
    s = pd.Series([np.nan, 200.0, 500.0, np.nan])
    assert get_energy_delta_safe(s) == 300.0


def test_get_last_value_safe_basic():
    assert get_last_value_safe(pd.Series([1.0, 2.0, np.nan])) == 2.0
    assert get_last_value_safe(pd.Series([], dtype=float)) == 0.0


# ── Percentiles drop NaN instead of zero-filling ───────────────────────────

def _series(values):
    idx = pd.date_range("2026-01-01 00:00", periods=len(values), freq="5min")
    return pd.DataFrame({"V1 THD": values}, index=idx)


def test_percentile_drops_nan_not_zero_fill():
    # 19 readings at 5.0 and one missing. The 95th percentile must stay ~5.0,
    # NOT be dragged toward 0 by a zero-filled gap.
    df = _series([5.0] * 19 + [np.nan])
    res = calculate_percentiles(df, "V", column_suffix=" THD")
    assert abs(res["V1 THD_95th_10min"] - 5.0) < 0.01


def test_percentile_missing_column_skipped():
    df = _series([1.0, 2.0, 3.0])
    res = calculate_percentiles(df, "A", column_suffix=" THD")  # no A* columns
    assert res == {}


def test_individual_harmonic_drops_nan():
    idx = pd.date_range("2026-01-01", periods=4, freq="5min")
    df = pd.DataFrame({"V1h5": [4.0, 4.0, np.nan, 4.0]}, index=idx)
    res = calculate_individual_harmonic_percentiles(df, "V", 95)
    assert abs(res["V1h5_95th"] - 4.0) < 0.01
