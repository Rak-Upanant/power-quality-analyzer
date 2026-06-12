# backend/tests/test_limits.py
"""IEEE 519-2022 limit-table lookups."""
from core.limits import (
    get_voltage_limit_table,
    get_current_limit_row,
    get_current_limit_for_harmonic,
)


# ── Table 1: voltage limits by nominal voltage ─────────────────────────────

def test_voltage_limit_brackets():
    assert get_voltage_limit_table(400)["thd"] == 8.0       # ≤ 1 kV
    assert get_voltage_limit_table(11_000)["thd"] == 5.0    # 1–69 kV
    assert get_voltage_limit_table(120_000)["thd"] == 2.5   # 69–161 kV
    assert get_voltage_limit_table(230_000)["thd"] == 1.5   # > 161 kV


# ── Table 2: current limits by Isc/IL ratio ────────────────────────────────

def test_current_limit_row_by_ratio():
    assert get_current_limit_row(400, 10)["tdd"] == 5.0     # ratio < 20
    assert get_current_limit_row(400, 35)["tdd"] == 8.0     # 20–50
    assert get_current_limit_row(400, 75)["tdd"] == 12.0    # 50–100
    assert get_current_limit_row(400, 500)["tdd"] == 15.0   # 100–1000
    assert get_current_limit_row(400, 5000)["tdd"] == 20.0  # > 1000


def test_current_limit_none_above_69kv():
    # Tables 3/4 (> 69 kV) are not implemented → None, not a wrong row.
    assert get_current_limit_row(115_000, 50) is None


def test_even_harmonic_50pct_rule():
    # IEEE 519-2022 Table 2 footnote (a): even harmonics h ≤ 6 limited to 50%.
    row = get_current_limit_row(400, 10)        # h_lt_11 base = 4.0
    odd5 = get_current_limit_for_harmonic(5, row)
    even4 = get_current_limit_for_harmonic(4, row)
    assert odd5 == 4.0
    assert even4 == 2.0                          # 50% of 4.0


def test_harmonic_limit_none_row_is_inf():
    assert get_current_limit_for_harmonic(5, None) == float("inf")
