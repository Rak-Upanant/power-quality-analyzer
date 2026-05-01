# backend/core/excel_parser.py
"""
Excel sheet ingestion and timestamp parsing.
Handles Thai Buddhist (DD/MM/BYYY) and Gregorian (M/D/YYYY 12-hr) date formats.
"""
import io
import pandas as pd


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def thai_to_gregorian_year(date_str: str) -> str:
    """Convert Thai Buddhist calendar date string to Gregorian."""
    if pd.isna(date_str):
        return date_str
    try:
        parts = str(date_str).split("/")
        day, month, thai_year = int(parts[0]), int(parts[1]), int(parts[2])
        return f"{day:02d}/{month:02d}/{thai_year - 543}"
    except (ValueError, IndexError):
        return date_str


def parse_timestamps(df: pd.DataFrame) -> pd.Series:
    """
    Auto-detect date format and return a DatetimeSeries.

    Supported formats:
      - Thai Buddhist: DD/MM/BYYY (year > 2400), 24-hr time
      - Gregorian M/D/YYYY, 12-hr AM/PM  (Chauvin Arnoux CA8335 export)
      - ISO / European: fallback via dateutil
    """
    date_raw = pd.Series(df.get("Date", pd.Series([]))).astype(str)
    time_raw = pd.Series(df.get("Time", pd.Series([]))).astype(str)

    sample = date_raw.dropna()
    sample = sample[sample != "nan"]
    if sample.empty:
        return pd.to_datetime([])

    first = sample.iloc[0]
    parts = first.split("/")

    if len(parts) == 3:
        try:
            year_val = int(parts[2])
        except ValueError:
            year_val = 0

        if year_val > 2400:
            # Thai Buddhist
            date_str = date_raw.apply(thai_to_gregorian_year)
            combined = date_str + " " + time_raw
            ts = pd.to_datetime(combined, format="%d/%m/%Y %H:%M:%S", errors="coerce")
        else:
            # Gregorian M/D/YYYY 12-hr
            combined = date_raw + " " + time_raw
            ts = pd.to_datetime(combined, format="%m/%d/%Y %I:%M:%S %p", errors="coerce")
            if ts.isna().all():
                ts = pd.to_datetime(combined, format="%m/%d/%Y %H:%M:%S", errors="coerce")
    else:
        combined = date_raw + " " + time_raw
        ts = pd.to_datetime(combined, errors="coerce")

    return ts


# ---------------------------------------------------------------------------
# Sheet loader
# ---------------------------------------------------------------------------

SHEET_HEADER_MAP = {
    "Trend": 6,
    "Vh Harmonic %": 0,
    "Ah Harmonic %": 0,
}


def load_sheets(file_bytes: bytes) -> dict[str, pd.DataFrame]:
    """
    Load all required worksheets from the uploaded .xlsx bytes.
    Returns a dict keyed by sheet name.
    Raises ValueError if a required sheet is missing.
    """
    sheets: dict[str, pd.DataFrame] = {}
    for sheet_name, header_row in SHEET_HEADER_MAP.items():
        try:
            sheets[sheet_name] = pd.read_excel(
                io.BytesIO(file_bytes),
                sheet_name=sheet_name,
                header=header_row,
                skiprows=list(range(header_row + 1, 9)) if sheet_name == "Trend" else None,
                engine="openpyxl",
            )
        except ValueError:
            raise ValueError(f"Required worksheet '{sheet_name}' not found in the uploaded file.")
    return sheets


def build_trend_index(df_trend: pd.DataFrame) -> pd.DataFrame:
    """
    Parse timestamps, set as index, and deduplicate.
    Raises ValueError if no valid timestamps found.
    """
    clean = df_trend.copy()
    clean["Timestamp"] = parse_timestamps(clean)
    clean.dropna(subset=["Timestamp"], inplace=True)
    clean.set_index("Timestamp", inplace=True)
    clean = clean[~clean.index.duplicated(keep="first")]
    clean.sort_index(inplace=True)

    if clean.empty:
        raise ValueError(
            "No valid timestamps could be parsed from the 'Trend' sheet. "
            "Check that the Date and Time columns contain recognisable values."
        )
    return clean
