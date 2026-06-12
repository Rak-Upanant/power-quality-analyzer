# backend/core/statistics.py
"""
IEEE 519-2022 statistical aggregation helpers.

§4.2  Very-short-time (3 s)  : daily 99th percentile
§4.3  Short-time (10 min)    : weekly 95th and 99th percentile
§4.4  Statistical evaluation periods

NOTE: With 5-minute interval data from the CA8335 (Class B), exact IEC 61000-4-30
3-second aggregates are unavailable.  The daily-99th-of-5min values are retained
internally as a conservative compliance check, but labelled as approximations in
the API response (`data_is_5min: true`).
"""
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Low-level safe helpers
# ---------------------------------------------------------------------------

def nan_to_zero(value) -> float:
    try:
        if pd.isna(value) or np.isnan(float(value)):
            return 0.0
    except (TypeError, ValueError):
        return 0.0
    return float(value)


def to_numeric_safe(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0)


def get_percentile_safe(series: pd.Series, percentile: float = 95) -> float:
    if series.empty or series.isnull().all():
        return 0.0
    return float(series.quantile(percentile / 100.0))


def get_last_value_safe(series: pd.Series) -> float:
    s = series.dropna()
    return float(s.iloc[-1]) if not s.empty else 0.0


def get_energy_delta_safe(series: pd.Series) -> float:
    """
    Period energy consumption = last − first cumulative reading.

    Meter energy columns (Wh / varh / VAh) are running counters. Using only the
    last value over-reports when an export continues a counter that did not start
    at zero. The delta is the true consumption over the captured window.

    Guards against a negative result (counter reset or rollover mid-capture) by
    falling back to the last value.
    """
    s = series.dropna()
    if s.empty:
        return 0.0
    delta = float(s.iloc[-1]) - float(s.iloc[0])
    return delta if delta >= 0 else float(s.iloc[-1])


# ---------------------------------------------------------------------------
# Main percentile calculator
# ---------------------------------------------------------------------------

def calculate_percentiles(
    df: pd.DataFrame,
    column_prefix: str,
    phases: tuple = (1, 2, 3),
    column_suffix: str = "",
) -> dict[str, float]:
    """
    Compute IEEE 519 statistical metrics for time-indexed trend data.

    Returns dict with keys:
      '<col>_99th_3s'      – max of daily 99th percentiles (approx. very-short-time)
      '<col>_95th_10min'   – weekly 95th percentile of resampled 10-min values
      '<col>_99th_10min'   – weekly 99th percentile of resampled 10-min values
    """
    results: dict[str, float] = {}
    cols = [f"{column_prefix}{p}{column_suffix}" for p in phases]

    for col in cols:
        if col not in df.columns:
            continue
        # Keep NaN here (do NOT zero-fill): missing/blank readings must be
        # DROPPED before computing percentiles, not turned into 0. Zeros would
        # drag the 95th/99th percentile down and could turn a true Fail into a
        # false Pass. `to_numeric_safe` is still used elsewhere (e.g. trend
        # arrays for charts) where 0-fill is the desired behaviour.
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty:
            continue

        # Daily 99th (approximate 3-second very-short-time with 5-min data)
        daily_99th = series.groupby(series.index.date).apply(
            lambda x: get_percentile_safe(x, 99)
        )
        results[f"{col}_99th_3s"] = float(daily_99th.max()) if not daily_99th.empty else 0.0

        # 10-minute short-time: RMS aggregation then weekly statistics
        resampled_10min = (
            series.resample("10min")
            .apply(lambda x: float(np.sqrt(np.mean(x**2))) if not x.empty else np.nan)
            .dropna()
        )
        if not resampled_10min.empty:
            results[f"{col}_95th_10min"] = get_percentile_safe(resampled_10min, 95)
            results[f"{col}_99th_10min"] = get_percentile_safe(resampled_10min, 99)

    return results


def calculate_individual_harmonic_percentiles(
    df: pd.DataFrame, prefix: str, percentile: float = 95
) -> dict[str, float]:
    """
    Compute the given percentile for each harmonic order H2–H50, per phase.

    Returns dict: {'<prefix><phase>h<order>_<pct>th': float, ...}
    """
    results: dict[str, float] = {}
    for h in range(2, 51):
        for p in (1, 2, 3):
            col = f"{prefix}{p}h{h}"
            if col in df.columns:
                # Drop NaN (not zero-fill) so blank / '- - -' harmonic cells do
                # not bias the percentile downward. See note in calculate_percentiles.
                series = pd.to_numeric(df[col], errors="coerce").dropna()
                if not series.empty:
                    results[f"{col}_{int(percentile)}th"] = get_percentile_safe(series, percentile)
    return results
