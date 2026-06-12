# backend/tests/test_sn3007_adapter.py
"""Format detection and SN3007 → SN210210 column mapping."""
import numpy as np

from core.sn3007_adapter import detect_format, load_sheets_sn3007


def test_detect_format(sn3007_bytes, sn210210_bytes):
    assert detect_format(sn3007_bytes) == "sn3007"
    assert detect_format(sn210210_bytes) == "sn210210"


def test_detect_unknown_on_garbage():
    assert detect_format(b"not a workbook") == "unknown"


def test_trend_columns_renamed(sn3007_bytes):
    sheets = load_sheets_sn3007(sn3007_bytes)
    trend = sheets["Trend"]
    # Line-to-line RMS: U12/U23/U31 → U1/U2/U3
    for col in ("U1 RMS", "U2 RMS", "U3 RMS"):
        assert col in trend.columns
    # Power / energy / k-factor / DPF / THD renames
    for col in ("W Total", "Wh Total", "KF1", "DPF Mean", "V1 THD", "Frequency", "PF Mean"):
        assert col in trend.columns
    # Old SN3007 names must NOT leak through
    for col in ("U12 RMS", "PT (W)", "FK1", "Cos φT (DPF)", "V1 THDf"):
        assert col not in trend.columns


def test_energy_merged_into_trend(sn3007_bytes):
    trend = load_sheets_sn3007(sn3007_bytes)["Trend"]
    # Energy sheet values should be present and increasing.
    assert "Wh Total" in trend.columns
    assert trend["Wh Total"].notna().any()


def test_harmonic_placeholder_becomes_nan(sn3007_bytes):
    sheets = load_sheets_sn3007(sn3007_bytes)
    ah = sheets["Ah Harmonic %"]
    # '- - -' placeholders for A*h7 must be NaN, not the literal string.
    assert "A1h7" in ah.columns
    assert ah["A1h7"].isna().any()
    assert not (ah == "- - -").any().any()


def test_harmonic_columns_renamed(sn3007_bytes):
    vh = load_sheets_sn3007(sn3007_bytes)["Vh Harmonic %"]
    assert "V1h3" in vh.columns          # "V1 H3" → "V1h3"
    assert "Date" in vh.columns and "Time" in vh.columns


def test_required_subset_only_trend(sn3007_bytes):
    # Power-only mode passes required=("Trend",); harmonic sheets not required.
    sheets = load_sheets_sn3007(sn3007_bytes, required=("Trend",))
    assert set(sheets.keys()) == {"Trend"}
