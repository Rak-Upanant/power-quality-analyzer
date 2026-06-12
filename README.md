# Power Quality Analyzer (IEEE 519-2022)

A local web application for analyzing Power Quality (PQ) Excel records from Chauvin Arnoux CA8335 meters and generating IEEE 519-2022 compliance reports.

Designed for plant engineering use: upload PQ meter data, enter PCC parameters, review voltage/current distortion compliance, view trend charts, and export a professional PDF report.

**Two analysis modes:**

| Mode | What it does | Required inputs |
|---|---|---|
| ⚡ Full IEEE 519 analysis | Compliance evaluation + all trends | Nominal voltage, Isc, IL |
| 🔌 Power consumption | Energy / power / cost / demand analysis, no compliance | File only |

**Two supported meter export formats** — selected via the "Meter S/N" dropdown (default: Auto-detect):

| Format | Sheets | Handling |
|---|---|---|
| C.A 8335 **SN210210** | `Trend`, `Vh Harmonic %`, `Ah Harmonic %` | Native format, parsed directly |
| C.A 8335 **SN3007** | `Recording`, `Energy`, `V H Harmonic %`, `A H Harmonic %` | Converted in-memory to the SN210210 schema by `backend/core/sn3007_adapter.py` |

---

## 1. Data Flow

```
Excel PQ Data (.xlsx)  — SN210210 or SN3007 export
        ↓
SystemInfoForm  (mode toggle + Meter S/N selector + dropzone)
        ↓
frontend/src/services/api.js   (Axios POST ?mode=&meter_format=)
        ↓
backend/routers/analysis.py    (FastAPI endpoint — detects meter format)
        ↓
backend/core/sn3007_adapter.py (SN3007 only: convert to SN210210 schema)
        ↓
backend/services/analyzer.py   (full or power-only pipeline)
        ↓
backend/core/*                 (parse → statistics → compliance)
        ↓
AnalysisReport.jsx + TrendChart.jsx
        ↓
PDF Report (jsPDF)  /  CSV export
```

---

## 2. Project Structure

```
power-quality-analyzer/
│
├── README.md
├── .gitignore
├── package.json
├── package-lock.json
│
├── backend/
│   ├── main.py                     # FastAPI app entry — CORS + router registration only
│   ├── requirements.txt
│   ├── __init__.py
│   │
│   ├── core/
│   │   ├── compliance.py           # IEEE 519-2022 pass/fail evaluation (§5.1, §5.3)
│   │   ├── excel_parser.py         # Sheet ingestion + Thai/Gregorian timestamp parsing
│   │   ├── sn3007_adapter.py       # SN3007 → SN210210 in-memory format conversion
│   │   ├── limits.py               # Voltage/current limit tables (Table 1, Table 2)
│   │   ├── statistics.py           # Percentile aggregation, 10-min resampling
│   │   └── __init__.py
│   │
│   ├── routers/
│   │   ├── analysis.py             # POST /analyze/ — file upload, HTTP error handling
│   │   └── __init__.py
│   │
│   └── services/
│       ├── analyzer.py             # Full analysis pipeline (no HTTP imports)
│       └── __init__.py
│
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── vite.config.js
    ├── eslint.config.js
    │
    └── src/
        ├── main.jsx
        ├── App.jsx                 # Main state and page flow
        ├── App.css                 # All global and component styles
        ├── index.css
        │
        ├── AnalysisReport.jsx      # Report UI + PDF export orchestration
        ├── HarmonicBarChart.jsx    # Harmonic spectrum bar chart (Chart.js)
        ├── SystemInfoForm.jsx      # Mode toggle + meter selector + inputs + dropzone
        ├── TrendChart.jsx          # Time-series line chart with date/time x-axis
        ├── TrendTabs.jsx           # Tab selector for trend chart groups
        ├── Dropzone.jsx            # Drag-and-drop .xlsx upload zone (react-dropzone)
        ├── ComplianceDetailPanel.jsx # Inline voltage/current criteria detail panel
        ├── constants.js            # App-level constants (API URL, chart colours)
        ├── utils.js                # getVoltageLimit, getCurrentLimitData, colour helpers
        │
        ├── components/
        │   ├── ComplianceModal.jsx       # Popup: voltage or current criteria detail
        │   ├── CurrentDetailContent.jsx  # Current TDD + harmonic table content
        │   ├── DemandProfileChart.jsx    # Load duration curve (sorted demand profile)
        │   ├── ExportModal.jsx           # PDF section selector popup
        │   ├── OverPill.jsx              # "4.7× limit" pill badge
        │   ├── PassBadge.jsx             # ✅ Pass / ❌ Fail badge
        │   ├── SummaryInfoModal.jsx      # Full measurement summary popup
        │   ├── SummaryItem.jsx           # Single label+value row in summary card
        │   ├── TariffPanel.jsx           # Tariff rate input + cost estimate (localStorage)
        │   └── VoltageDetailContent.jsx  # Voltage THD + harmonic table content
        │
        ├── constants/
        │   └── reportConstants.js        # EXPORT_SECTIONS, PARAM_GROUPS, formatters
        │
        ├── hooks/
        │   ├── useFilteredTrendData.js   # Filters trend data by selected date/time range
        │   └── useTimeRange.js           # Manages start/end date-time state
        │
        ├── utils/
        │   └── csvExport.js              # trendDataToCsv() + downloadCsv() (UTF-8 BOM)
        │
        └── services/
            └── api.js                    # analyzePowerQuality() — Axios POST to backend
```

---

## 3. File Responsibilities

### Backend

| File | Responsibility |
|---|---|
| `backend/main.py` | Creates FastAPI app, registers CORS, includes router |
| `backend/routers/analysis.py` | `POST /analyze/` — upload, `mode` + `meter_format` params, format dispatch |
| `backend/services/analyzer.py` | `analyze_full_data()` + `analyze_power_only()` pipelines |
| `backend/core/excel_parser.py` | `load_sheets()`, `build_trend_index()`, Thai/Gregorian date detection |
| `backend/core/sn3007_adapter.py` | `detect_format()`, `load_sheets_sn3007()` — SN3007 → SN210210 conversion |
| `backend/core/limits.py` | `VOLTAGE_LIMITS`, `CURRENT_LIMITS_120V_to_69kV`, lookup helpers |
| `backend/core/compliance.py` | `evaluate_compliance()` — §5.1 voltage + §5.3 current checks |
| `backend/core/statistics.py` | `calculate_percentiles()`, 10-min RMS resampling, harmonic percentiles, energy delta |

### Frontend

| File | Responsibility |
|---|---|
| `App.jsx` | File + systemInfo + analysisMode + meterFormat state, calls `analyzePowerQuality()` |
| `AnalysisReport.jsx` | Renders compliance summary, charts, modals; generates PDF + CSV |
| `SystemInfoForm.jsx` | Mode toggle, Meter S/N selector, Isc / IL inputs with smart hints + dropzone |
| `components/TariffPanel.jsx` | `useTariff()` hook — ฿/kWh rate + currency, persisted in localStorage |
| `components/DemandProfileChart.jsx` | Load duration curve with Peak / Median / Baseload stats |
| `utils/csvExport.js` | Flattens trend data to RFC-4180 CSV with UTF-8 BOM for Excel |
| `TrendChart.jsx` | Chart.js `Line` wrapper — time axis, date labels, y-formatter |
| `HarmonicBarChart.jsx` | Chart.js `Bar` for H2–H50 spectrum with IEEE limit line |
| `components/ComplianceModal.jsx` | Click-triggered detail popup (voltage or current) |
| `components/SummaryInfoModal.jsx` | "Full Details" popup with all KPIs grouped |
| `components/ExportModal.jsx` | PDF section checkbox selector |
| `constants/reportConstants.js` | `EXPORT_SECTIONS`, `PARAM_GROUPS`, `fmtEnergy`, `fmtPower`, `fmtVal`, `pct` |
| `hooks/useFilteredTrendData.js` | Slices `trend_data` arrays by selected date/time range |
| `hooks/useTimeRange.js` | Derives `startDate`, `endDate`, `timeInterval` from `analysisResult` |
| `services/api.js` | Posts `FormData` to `POST /analyze/`, returns result or throws |

---

## 4. Input Requirements

### SN210210 format (native)

The uploaded `.xlsx` file must contain these sheets from a Chauvin Arnoux CA8335 (or compatible) export:

| Sheet | Purpose |
|---|---|
| `Trend` | Time-series RMS, power, energy, THD, PF — header at row 7 |
| `Vh Harmonic %` | Voltage harmonic % per order (H0–H50), per phase |
| `Ah Harmonic %` | Current harmonic % per order (H0–H50), per phase |

In **Power consumption** mode only `Trend` is required — the harmonic sheets are used when present.

### SN3007 format (auto-converted)

SN3007 exports are recognised by their `Recording` sheet and converted in-memory — no manual editing of the workbook is needed. Worksheet and column mapping:

| SN3007 | → SN210210 equivalent |
|---|---|
| `Recording` (+ `Energy`, merged by timestamp) | `Trend` |
| `V H Harmonic %` | `Vh Harmonic %` |
| `A H Harmonic %` | `Ah Harmonic %` |
| `U12/U23/U31 RMS`, `P1..PT (W)`, `Cos φ (DPF)`, `FK1-3`, `THDf` | `U1/U2/U3 RMS`, `W1..W Total`, `DPF1..Mean`, `KF1-3`, `THD` |

Notes: THDf (fundamental-referenced, per IEEE 519-2022 §3.1.69) is used, not THDr. MIN/MAX half-cycle columns are not mapped (not consumed by the analyzer). `- - -` placeholders become empty values.

### Key columns used from `Trend`

| Category | Columns |
|---|---|
| Timestamp | `Date`, `Time` |
| Voltage LL | `U1/U2/U3 RMS`, `U1/U2/U3 THD` |
| Voltage LN | `V1/V2/V3 RMS`, `V1/V2/V3 THD` |
| Current | `A1/A2/A3 RMS`, `A1/A2/A3 THD` |
| Power | `W Total`, `var Total`, `VA Total` |
| Energy | `Wh Total`, `varh Total`, `VAh Total` |
| Power Factor | `PF1`, `PF2`, `PF3`, `PF Mean` |
| Unbalance | `Vunb`, `Aunb` |
| Frequency | `Frequency` |

---

## 5. Required User Inputs

> These inputs are required only in **Full IEEE 519 analysis** mode. **Power consumption** mode needs no parameters — just drop the file.

| Input | Meaning | Example |
|---|---|---|
| Nominal Voltage (V) | PCC system voltage, line-to-line | 400, 690, 11000 |
| Short-Circuit Current Isc (A) | Maximum fault current at PCC | 45000 |
| Max Demand IL (A) | 12-month average of 15/30-min peak demand (IEEE §3.1) | 2000 |

The `Isc / IL` ratio selects the applicable IEEE 519-2022 Table 2 current distortion bracket.

### Typical Isc values (400 V LV busbar, IEC 60909)

| Transformer | Typical Isc |
|---|---|
| 160 – 250 kVA | 4 – 10 kA |
| 400 – 630 kVA | 10 – 18 kA |
| 800 – 1,000 kVA | 16 – 25 kA |
| 1,250 – 1,600 kVA | 22 – 35 kA |
| 2,000 – 2,500 kVA | 32 – 48 kA |
| 3,150 – 4,000 kVA | 45 – 65 kA |
| 5,000 kVA + | 60 – 80 kA |

> Actual Isc depends on transformer impedance (Uk%), cable length, and upstream network. Use power system software or utility data for precise values.

---

## 6. IEEE 519-2022 Compliance Logic

### Voltage (§5.1) — Line-to-Neutral

| Criterion | Rule |
|---|---|
| Weekly 95th pct / 10 min | < Table 1 THD limit |
| Weekly 99th pct / 10 min | < 1.5 × Table 1 THD limit |
| Individual harmonics H2–H50 | 95th pct < Table 1 individual limit |

### Current (§5.3) — 120 V to 69 kV

| Criterion | Rule |
|---|---|
| Weekly 95th pct / 10 min | < Table 2 TDD limit |
| Weekly 99th pct / 10 min | < 1.5 × Table 2 TDD limit |
| Individual harmonics H2–H50 | 95th pct < Table 2 individual limit (×0.5 for even h ≤ 6) |

### Note on 5-minute data

The CA8335 records at 5-minute intervals. The IEEE §4.2 very-short-time (3-second) criterion requires raw 200 ms FFT windows not available from 5-min exports. This tool computes weekly percentiles from 10-min RMS-aggregated values, which is valid for engineering assessment. A `data_is_5min` flag is included in the API response.

---

## 7. How to Run Locally

### 7.1 Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Unix/macOS
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API runs at: `http://localhost:8000`
Interactive docs at: `http://localhost:8000/docs`

### 7.2 Frontend

```powershell
cd frontend
npm install
npm run dev
```

App runs at: `http://localhost:5173`

---

## 8. PDF Export Sections

The export modal allows selecting any combination of these sections.

In **Power consumption** mode the PDF uses a dedicated cover (Power Consumption Summary, estimated cost, peak demand window, measurement period, recommendations) and offers only: Demand Profile, Harmonic Spectrums (no IEEE limit line), RMS / Power / Energy / Harmonic / PF Trends. A **CSV export** of the filtered trend data is also available in both modes.

Full-mode sections:

| Section | Contents |
|---|---|
| System Parameters | Nominal voltage, Isc, IL, Isc/IL, applicable limits |
| Compliance Summary | Pass/fail + THDv, TDD, PF, power, energy |
| Compliance Criteria Detail | Per-phase measured vs limit tables (red = fail) |
| IEEE 519 Limit Tables | Table 1 + Table 2 with active row highlighted |
| Recommendations | Auto-generated based on compliance result |
| Key Compliance Issues | Category + phase breakdown of failures |
| Harmonic Spectrums | Bar charts H2–H50 for voltage and current |
| RMS / Power / Energy / Harmonic / TDD / PF / Unbalance Trends | Time-series charts |
| Parameter Reference Guide | CA8335 column groups + THDv/THDi/TDD formula reference |

---

## 9. Maintenance

### Recommended cleanup before commit

```powershell
Get-ChildItem -Recurse -Directory -Filter __pycache__ | Remove-Item -Recurse -Force
Get-ChildItem -Recurse -Filter *.pyc | Remove-Item -Force
```

### Clean tree export (excludes build artifacts)

```powershell
Get-ChildItem -Recurse -Force |
Where-Object {
    $_.FullName -notmatch "\\.git|node_modules|dist|public|__pycache__|venv|\.venv"
} |
Select-Object FullName |
Out-File "$env:USERPROFILE\Desktop\tree.txt"
```

### `.gitignore` essentials

```gitignore
# Python
venv/
.venv/
__pycache__/
*.pyc

# Node
node_modules/
frontend/node_modules/

# Build
frontend/dist/
dist/
build/

# Env
.env
.env.local

# OS
.DS_Store
Thumbs.db
```

---

## 10. Engineering Notes

- This tool is suitable for **internal engineering analysis, troubleshooting, and filter sizing decisions**.
- For **formal IEEE 519 compliance submission** to a utility or regulatory authority, measurement must use a **Class A instrument** (e.g. Chauvin Arnoux CA8345) and match the required aggregation method per IEC 61000-4-30.
- The CA8335 is **Class B** — results from this tool should be labelled as engineering assessment only.

---

## 11. Practical Plant Workflow

1. Export PQ trend data from the CA8335 meter (SN210210 or SN3007) as `.xlsx`.
2. Open the app at `http://localhost:5173`.
3. Pick the analysis mode: **⚡ Full IEEE 519** or **🔌 Power consumption**.
4. Leave **Meter S/N** on *Auto-detect* (or force SN3007 / SN210210 if needed).
5. Full mode only: enter PCC parameters — nominal voltage, Isc, IL.
6. Drop the `.xlsx` file into the upload zone and click **Analyze**.
7. Review compliance summary — click **Voltage Compliance** or **Current Compliance** to see per-phase criteria detail.
8. Browse trend charts by tab (RMS / Power / Energy / Harmonics / TDD / PF / Unbalance).
9. Click **Export as PDF** (and/or **Export CSV**) and select the sections to include.
10. Use the report for maintenance decisions, filter sizing, or abnormal load investigation.

---

## 12. Difficulty Reference

| Area | Level |
|---|---|
| Running frontend | Easy |
| Running backend | Easy – Medium |
| Understanding IEEE 519 compliance logic | Medium – Hard |
| Modifying PDF export sections | Medium |
| Adding new trend chart groups | Easy |
| Modifying compliance evaluation | Hard |
| Refactoring backend core modules | Hard |

---

## 13. Backlog / Roadmap

Ideas that are NOT yet implemented. Listed roughly in priority order — useful guidance for the next contributor or for future work on the **Power consumption** mode.

### Priority 0 — correctness & hygiene (from June 2026 code review)

✅ **Done** (June 2026):
- **NaN → 0 bias in percentile stats** — `calculate_percentiles()` and `calculate_individual_harmonic_percentiles()` now drop NaN instead of zero-filling before computing 95th/99th percentiles, so missing/blank readings no longer drag the percentile down toward a false Pass.
- **Energy totals** — now `last − first` via `get_energy_delta_safe()` (with a guard against counter resets), instead of the raw last value.
- **Upload size cap** — `routers/analysis.py` rejects uploads over 30 MB before reading them into memory.
- **`schemas.py` deleted** — was dead code never wired to the route.
- **Repo hygiene** — removed stray `frontend/test.txt` + empty root `package.json`/lock; `.gitignore` now uses `__pycache__/` so nested caches are ignored.

⬜ **Remaining:**

| Item | Notes |
|---|---|
| **Automated tests + CI** | Zero tests today. Start with pytest fixtures from the two dummy workbooks: `detect_format()`, `load_sheets_sn3007()` column mapping, `analyze_full_data()` smoke, compliance edge cases (>69 kV, Isc/IL brackets). Add a GitHub Action: `pytest` + `npm run build`. |

### Priority 1 — PDF report overhaul (designed, not yet built)

Extract PDF generation from `AnalysisReport.jsx` (~350 lines) into `frontend/src/utils/pdfReport.js` with small named helpers, adopting **jspdf-autotable** for tables. Then add: cover page with headline stat cards, page numbers + footer on every page, PASS/FAIL pill badges, plain-language executive summary, traffic-light metric dashboard, 2× resolution chart export. Stretch: table of contents (needs two-pass page numbering). **Thai font embedding** (e.g. Sarabun) is the natural companion — jsPDF built-in fonts cannot render Thai text.

### Power-consumption mode enhancements

| Idea | Notes |
|---|---|
| **Time-of-day energy heatmap** | 24×7 grid coloured by avg active power — instantly shows day/night and weekend vs weekday behaviour. Pure frontend computation from `trend_data.active_power["W Total"]`. |
| **Phase load balance score** | Compare avg `A1/A2/A3 RMS`; flag any phase >15% off the mean. Big efficiency win for facilities managers. Surface as a chip in the summary card. |
| **Reactive energy ratio + capacitor sizing** | Compute `varh_total / Wh_total` (≈ tan φ). If >0.5, recommend specific kvar of capacitors to reach a target PF (e.g. 0.95). |
| **Anomaly markers on trend charts** | Auto-detect step changes / outliers in Active Power (>3σ deviation), highlight them with a label. Spots stuck loads, scheduling issues, etc. |
| **Frequency stats in summary** | Add min/max/avg of `Frequency` column (already in `trend_data`). One-line addition to the summary card. |
| **Compare two files (delta report)** | Drop two CA8335 exports, get an energy / cost / PF delta. Useful for "before vs after we installed VFDs". Bigger feature — needs a second-file UI flow. |
| **Peak / off-peak tariff** | Extend the tariff panel to support time-of-use (peak hours / weekend rates) instead of a single flat rate. |
| **XLSX multi-sheet export** | The current "Export CSV" emits a single flat CSV. A multi-sheet `.xlsx` (one sheet per group: Voltage / Current / Power / Energy / Harmonics) would map better to the report structure. Use SheetJS / xlsx with dynamic import to keep the initial bundle small. |
| **Top-N harmonic order summary** | A small table on the cover: "Worst voltage harmonic: H5 @ 4.2%". Powers from the existing `bar_chart_data`. |
| **kVA capacity utilisation** | If transformer rating is known (optional input), show `apparent_power_avg / rated_kVA` over time — sizing / overload risk indicator. |

### General UX / engineering follow-ups

| Idea | Notes |
|---|---|
| **Single source of truth for limit tables** | `frontend/src/constants.js` and `backend/core/limits.py` both hold IEEE 519 Table 2. Have the backend ship the per-order limit array in the `/analyze/` response so the frontend never duplicates them. |
| **Compliance Summary information hierarchy** | Today the verdict is visually equal to "Avg. U2 RMS (LL)". Promote the verdicts into a hero band; collapse per-phase RMS averages into the "Full Details" modal. |
| **A11y on modals** | `.modal-overlay` lacks `role="dialog"`, `aria-modal`, focus trap, and ESC handler. Compliance / summary buttons lack `:focus-visible` styles. |
| **Replace emoji glyphs with an icon set** | Heavy use of 📄 📋 ✅ ❌ ⚡ 🔌 etc. for primary affordances. Inconsistent across OS / browser; not predictable for screen readers. Swap to `lucide-react` (already a common companion to recharts/chart.js). |
| **Print stylesheet (`@media print`)** | The PDF export uses jsPDF, but there's no fallback for native browser Print. Adding `@media print` rules would let users print directly without going through PDF generation. |
| **Bundle size** | The single `index-*.js` chunk is >1 MB. Code-split jsPDF + html2canvas + chart.js with `manualChunks` so the initial paint is faster. |