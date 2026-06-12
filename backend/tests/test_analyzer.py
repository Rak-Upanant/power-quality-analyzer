# backend/tests/test_analyzer.py
"""End-to-end pipeline smoke tests on synthetic workbooks."""
from core.excel_parser import load_sheets
from core.sn3007_adapter import load_sheets_sn3007
from services.analyzer import analyze_full_data, analyze_power_only


# ── SN210210 native ────────────────────────────────────────────────────────

def test_full_analysis_sn210210(sn210210_bytes):
    sheets = load_sheets(sn210210_bytes)
    r = analyze_full_data(sheets, nominal_voltage=400, isc=10000, il=500)
    assert r["mode"] == "full"
    assert r["voltage_compliance"] in ("Pass", "Fail")
    assert r["current_compliance"] in ("Pass", "Fail", "N/A")
    assert r["trend_data"]["timestamps"]                 # non-empty
    assert r["summary_stats"]["active_energy_total"] >= 0
    assert "bar_chart_data" in r


def test_power_only_analysis_sn210210(sn210210_bytes):
    sheets = load_sheets(sn210210_bytes, required=("Trend",))
    r = analyze_power_only(sheets)
    assert r["mode"] == "power_only"
    assert r["voltage_compliance"] == "N/A"
    assert r["peak_demand"] is not None
    assert r["summary_stats"]["power_factor_avg"] > 0


def test_energy_total_is_delta_not_last(sn210210_bytes):
    # Fixture Wh Total runs 1000 + 50*i for 12 rows → delta = 50*11 = 550.
    sheets = load_sheets(sn210210_bytes, required=("Trend",))
    r = analyze_power_only(sheets)
    assert abs(r["summary_stats"]["active_energy_total"] - 550.0) < 1e-6


# ── SN3007 legacy via adapter ───────────────────────────────────────────────

def test_full_analysis_sn3007(sn3007_bytes):
    sheets = load_sheets_sn3007(sn3007_bytes)
    r = analyze_full_data(sheets, nominal_voltage=400, isc=10000, il=500)
    assert r["mode"] == "full"
    assert r["trend_data"]["timestamps"]
    assert r["summary_stats"]["active_power_avg"] > 0


def test_power_only_analysis_sn3007(sn3007_bytes):
    sheets = load_sheets_sn3007(sn3007_bytes, required=("Trend",))
    r = analyze_power_only(sheets)
    assert r["mode"] == "power_only"
    assert r["peak_demand"] is not None
