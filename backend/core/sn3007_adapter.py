# backend/core/sn3007_adapter.py
"""
Adapter that converts Chauvin Arnoux C.A 8335 SN3007 exports into the SN210210
in-memory schema consumed by the rest of the pipeline.

Why this exists
---------------
The two meters in the department export workbooks with different sheet names,
header offsets and column naming conventions. Rather than dual-path the entire
analyser, this module produces DataFrames that look exactly like what
`excel_parser.load_sheets()` returns for an SN210210 file. Downstream code
(`build_trend_index`, `services.analyzer.*`) is therefore untouched.

Sheet-name mapping
------------------
SN3007 worksheet        ->  SN210210 equivalent
  Recording             ->  Trend          (merged with the Energy sheet)
  V H Harmonic %        ->  Vh Harmonic %
  A H Harmonic %        ->  Ah Harmonic %

Column-name policy
------------------
Only columns the analyser actually consumes are kept. Everything else is dropped
to keep the frame slim. THDf (fundamental-referenced, per IEEE 519-2022 §3.1.69)
is preferred over THDr.
"""
from __future__ import annotations

import io
import re
import warnings
from typing import Literal

import numpy as np
import openpyxl
import pandas as pd


# ---------------------------------------------------------------------------
# Column rename map: SN3007 -> SN210210
# ---------------------------------------------------------------------------

_TREND_COLUMN_MAP: dict[str, str] = {
    # Timestamp + frequency
    "Date:": "Date",
    "Time:": "Time",
    "F": "Frequency",

    # Voltage RMS (line-neutral)
    "V1 RMS": "V1 RMS",
    "V2 RMS": "V2 RMS",
    "V3 RMS": "V3 RMS",

    # Voltage RMS (line-line) — SN3007 uses U12/U23/U31, SN210210 uses U1/U2/U3
    "U12 RMS": "U1 RMS",
    "U23 RMS": "U2 RMS",
    "U31 RMS": "U3 RMS",

    # Current RMS
    "A1 RMS": "A1 RMS",
    "A2 RMS": "A2 RMS",
    "A3 RMS": "A3 RMS",

    # THD — use THDf (fundamental-referenced)
    "V1 THDf": "V1 THD",
    "V2 THDf": "V2 THD",
    "V3 THDf": "V3 THD",
    "U12 THDf": "U1 THD",
    "U23 THDf": "U2 THD",
    "U31 THDf": "U3 THD",
    "A1 THDf": "A1 THD",
    "A2 THDf": "A2 THD",
    "A3 THDf": "A3 THD",

    # Unbalance — SN3007 reports IEC u2 method
    "Vunb (u2)": "Vunb",
    "Aunb (u2)": "Aunb",

    # Flicker
    "Pst1": "Pst1", "Pst2": "Pst2", "Pst3": "Pst3",
    "Plt1": "Plt1", "Plt2": "Plt2", "Plt3": "Plt3",

    # K-factor
    "FK1": "KF1", "FK2": "KF2", "FK3": "KF3",

    # Active power
    "P1 (W)": "W1", "P2 (W)": "W2", "P3 (W)": "W3", "PT (W)": "W Total",

    # Reactive power
    "N1 (var)": "var1", "N2 (var)": "var2", "N3 (var)": "var3", "NT (var)": "var Total",

    # Apparent power
    "S1 (VA)": "VA1", "S2 (VA)": "VA2", "S3 (VA)": "VA3", "ST (VA)": "VA Total",

    # Power factor
    "PF1": "PF1", "PF2": "PF2", "PF3": "PF3", "PFT": "PF Mean",

    # Displacement power factor (Cos φ)
    "Cos φ1 (DPF)": "DPF1",
    "Cos φ2 (DPF)": "DPF2",
    "Cos φ3 (DPF)": "DPF3",
    "Cos φT (DPF)": "DPF Mean",

    # Tan φ
    "Tan φ1": "Tan1",
    "Tan φ2": "Tan2",
    "Tan φ3": "Tan3",
    "Tan φT": "Tan Mean",
}

# Energy sheet — joined onto Trend by Date+Time
_ENERGY_COLUMN_MAP: dict[str, str] = {
    "Ep1 (Wh)": "Wh1", "Ep2 (Wh)": "Wh2", "Ep3 (Wh)": "Wh3", "EpT (Wh)": "Wh Total",
    "En1 (varh)": "varh1", "En2 (varh)": "varh2", "En3 (varh)": "varh3", "EnT (varh)": "varh Total",
    "Es1 (VAh)": "VAh1", "Es2 (VAh)": "VAh2", "Es3 (VAh)": "VAh3", "EsT (VAh)": "VAh Total",
}

# Harmonic column rename: "V1 H0" -> "V1h0", "A2 H17" -> "A2h17"
_HARMONIC_RX = re.compile(r"^([VA])(\d)\s*H(\d+)$")


# ---------------------------------------------------------------------------
# Format detection
# ---------------------------------------------------------------------------

def detect_format(file_bytes: bytes) -> Literal["sn3007", "sn210210", "unknown"]:
    """Peek at workbook sheet names. SN3007 ships a `Recording` sheet;
    SN210210 ships a `Trend` sheet. Returns "unknown" if neither is present."""
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        names = set(wb.sheetnames)
        wb.close()
    except Exception:
        return "unknown"

    if "Trend" in names:
        return "sn210210"
    if "Recording" in names:
        return "sn3007"
    return "unknown"


# ---------------------------------------------------------------------------
# Adapter loader
# ---------------------------------------------------------------------------

def _rename_harmonic_column(col: object) -> object:
    """V1 H0 -> V1h0. Leaves Date/Time and unrelated columns untouched."""
    if not isinstance(col, str):
        return col
    if col in ("Date:", "Date"):
        return "Date"
    if col in ("Time:", "Time"):
        return "Time"
    m = _HARMONIC_RX.match(col.strip())
    if m:
        prefix, phase, order = m.group(1), m.group(2), m.group(3)
        return f"{prefix}{phase}h{order}"
    return col


def _read_trend(file_bytes: bytes) -> pd.DataFrame:
    """Read SN3007 `Recording` + `Energy` sheets, merge by Date+Time, return
    a DataFrame whose columns match the SN210210 `Trend` schema."""
    # Recording: header row 1 (0-indexed), units in row 2 (skip), blank row 3 (skip)
    rec = pd.read_excel(
        io.BytesIO(file_bytes),
        sheet_name="Recording",
        header=1,
        skiprows=[2, 3],
        engine="openpyxl",
    )
    rec = rec.rename(columns=_TREND_COLUMN_MAP)
    keep = [c for c in rec.columns if c in _TREND_COLUMN_MAP.values()]
    rec = rec[keep].copy()

    # Energy: same layout. Best-effort — if missing, Wh/varh/VAh totals stay NaN.
    try:
        en = pd.read_excel(
            io.BytesIO(file_bytes),
            sheet_name="Energy",
            header=1,
            skiprows=[2, 3],
            engine="openpyxl",
        )
        en = en.rename(columns={"Date:": "Date", "Time:": "Time", **_ENERGY_COLUMN_MAP})
        en_keep = ["Date", "Time"] + [v for v in _ENERGY_COLUMN_MAP.values() if v in en.columns]
        en = en[en_keep].copy()
        # Stringify Date/Time so the merge key types match `rec` exactly.
        for col in ("Date", "Time"):
            en[col] = en[col].astype(str)
            rec[col] = rec[col].astype(str)
        merged = rec.merge(en, on=["Date", "Time"], how="left")
    except ValueError:
        merged = rec

    return merged


def _read_harmonic(file_bytes: bytes, sheet: str) -> pd.DataFrame:
    """Read SN3007 harmonic sheet (header row 1, units row 2). Drops the
    title row, the units row, renames Date/Time + H-numbered columns,
    and replaces SN3007's '- - -' placeholder with NaN."""
    df = pd.read_excel(
        io.BytesIO(file_bytes),
        sheet_name=sheet,
        header=1,
        skiprows=[2],
        engine="openpyxl",
    )
    df = df.rename(columns=_rename_harmonic_column)
    # Drop columns that didn't match a known harmonic pattern (e.g. trailing NaN cols).
    keep = [c for c in df.columns if c in ("Date", "Time") or _HARMONIC_RX.match(str(c).replace("h", " H"))]
    df = df[keep].copy()
    # SN3007 writes the literal "- - -" placeholder when a harmonic order is
    # not applicable (e.g. DC component on a current channel). Replace with NaN.
    # Pandas >= 2.2 emits a FutureWarning about downcasting behaviour on bare
    # .replace(); the recommended fix is the global option below — applied here
    # narrowly so we don't mutate global pandas state.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        df = df.replace({"- - -": np.nan}).infer_objects(copy=False)
    return df


def load_sheets_sn3007(
    file_bytes: bytes,
    required: tuple[str, ...] | None = None,
) -> dict[str, pd.DataFrame]:
    """
    Drop-in replacement for `excel_parser.load_sheets()` for SN3007 workbooks.

    Returns DataFrames keyed by SN210210 sheet names ("Trend", "Vh Harmonic %",
    "Ah Harmonic %") so downstream code (`build_trend_index`, analyser) sees
    the same shape it does for native SN210210 files.

    Parameters
    ----------
    required : optional tuple of SN210210 sheet names that MUST be present.
               Defaults to all three. Pass ("Trend",) for power-only mode.
    """
    if required is None:
        required = ("Trend", "Vh Harmonic %", "Ah Harmonic %")

    out: dict[str, pd.DataFrame] = {}
    for sheet in required:
        try:
            if sheet == "Trend":
                out[sheet] = _read_trend(file_bytes)
            elif sheet == "Vh Harmonic %":
                out[sheet] = _read_harmonic(file_bytes, "V H Harmonic %")
            elif sheet == "Ah Harmonic %":
                out[sheet] = _read_harmonic(file_bytes, "A H Harmonic %")
            else:
                raise ValueError(f"Unknown sheet '{sheet}'.")
        except ValueError as exc:
            # Mirror excel_parser.load_sheets() error wording so the router's
            # 400 response stays consistent across formats.
            raise ValueError(
                f"Required worksheet '{sheet}' not found in the uploaded file."
            ) from exc

    return out
