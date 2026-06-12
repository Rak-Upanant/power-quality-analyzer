# backend/tests/test_api.py
"""HTTP-level tests for POST /analyze/ via FastAPI's TestClient."""
import pytest
from fastapi.testclient import TestClient

import routers.analysis as analysis_router
from main import app

client = TestClient(app)


def _upload(file_bytes, filename="data.xlsx", **params):
    return client.post(
        "/analyze/",
        params=params,
        files={"file": (filename, file_bytes,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )


# ── Happy paths ─────────────────────────────────────────────────────────────

def test_full_mode_sn210210_ok(sn210210_bytes):
    r = _upload(sn210210_bytes, mode="full", meter_format="auto",
                nominal_voltage=400, isc=10000, il=500)
    assert r.status_code == 200
    body = r.json()
    assert body["fileName"] == "data.xlsx"
    assert body["mode"] == "full"


def test_power_only_sn3007_auto_ok(sn3007_bytes):
    r = _upload(sn3007_bytes, mode="power_only", meter_format="auto")
    assert r.status_code == 200
    assert r.json()["mode"] == "power_only"


def test_explicit_sn3007_format_ok(sn3007_bytes):
    r = _upload(sn3007_bytes, mode="power_only", meter_format="sn3007")
    assert r.status_code == 200


# ── Error paths ─────────────────────────────────────────────────────────────

def test_wrong_format_override_rejected(sn3007_bytes):
    # Forcing the SN210210 reader on an SN3007 file → 'Trend' sheet missing.
    r = _upload(sn3007_bytes, mode="power_only", meter_format="sn210210")
    assert r.status_code == 400


def test_non_xlsx_rejected(sn210210_bytes):
    r = _upload(sn210210_bytes, filename="data.csv", mode="power_only")
    assert r.status_code == 400


def test_full_mode_requires_parameters(sn210210_bytes):
    # No nominal_voltage / isc / il in full mode → 422.
    r = _upload(sn210210_bytes, mode="full")
    assert r.status_code == 422


def test_oversize_upload_rejected(sn210210_bytes, monkeypatch):
    # Shrink the cap so the fixture exceeds it → 413, without a 30 MB payload.
    monkeypatch.setattr(analysis_router, "MAX_UPLOAD_BYTES", 100)
    r = _upload(sn210210_bytes, mode="power_only")
    assert r.status_code == 413
