# Power Quality Analyzer (IEEE 519-2022)

A local web application for analyzing Power Quality (PQ) Excel records from Chauvin Arnoux CA8335 meters and generating IEEE 519-2022 compliance reports.

Designed for plant engineering use: upload PQ meter data, enter PCC parameters, review voltage/current distortion compliance, view trend charts, and export a professional PDF report.

---

## 1. Data Flow

```
Excel PQ Data (.xlsx)
        ↓
SystemInfoForm / Dropzone
        ↓
frontend/src/services/api.js  (Axios POST)
        ↓
backend/routers/analysis.py   (FastAPI endpoint)
        ↓
backend/services/analyzer.py  (pipeline orchestrator)
        ↓
backend/core/*                 (parse → statistics → compliance)
        ↓
AnalysisReport.jsx + TrendChart.jsx
        ↓
PDF Report (jsPDF)
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
│   │   ├── limits.py               # Voltage/current limit tables (Table 1, Table 2)
│   │   ├── statistics.py           # Percentile aggregation, 10-min resampling
│   │   └── __init__.py
│   │
│   ├── models/
│   │   ├── schemas.py              # Pydantic request/response models
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
        ├── SystemInfoForm.jsx      # PCC input form + drag-and-drop upload
        ├── TrendChart.jsx          # Time-series line chart with date/time x-axis
        ├── TrendTabs.jsx           # Tab selector for trend chart groups
        ├── constants.js            # App-level constants (API URL, chart colours)
        ├── utils.js                # getVoltageLimit, getCurrentLimitData, colour helpers
        │
        ├── components/
        │   ├── ComplianceModal.jsx       # Popup: voltage or current criteria detail
        │   ├── CurrentDetailContent.jsx  # Current TDD + harmonic table content
        │   ├── ExportModal.jsx           # PDF section selector popup
        │   ├── OverPill.jsx              # "4.7× limit" pill badge
        │   ├── PassBadge.jsx             # ✅ Pass / ❌ Fail badge
        │   ├── SummaryInfoModal.jsx      # Full measurement summary popup
        │   ├── SummaryItem.jsx           # Single label+value row in summary card
        │   └── VoltageDetailContent.jsx  # Voltage THD + harmonic table content
        │
        ├── constants/
        │   └── reportConstants.js        # EXPORT_SECTIONS, PARAM_GROUPS, formatters
        │
        ├── hooks/
        │   ├── useFilteredTrendData.js   # Filters trend data by selected date/time range
        │   └── useTimeRange.js           # Manages start/end date-time state
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
| `backend/routers/analysis.py` | `POST /analyze/` — receives upload, returns JSON |
| `backend/services/analyzer.py` | Orchestrates: parse → TDD calc → stats → compliance → trend data |
| `backend/core/excel_parser.py` | `load_sheets()`, `build_trend_index()`, Thai/Gregorian date detection |
| `backend/core/limits.py` | `VOLTAGE_LIMITS`, `CURRENT_LIMITS_120V_to_69kV`, lookup helpers |
| `backend/core/compliance.py` | `evaluate_compliance()` — §5.1 voltage + §5.3 current checks |
| `backend/core/statistics.py` | `calculate_percentiles()`, 10-min RMS resampling, harmonic percentiles |
| `backend/models/schemas.py` | `AnalyzeRequest`, `AnalyzeResponse`, `SummaryStats` Pydantic models |

### Frontend

| File | Responsibility |
|---|---|
| `App.jsx` | File + systemInfo state, result state, calls `analyzePowerQuality()` |
| `AnalysisReport.jsx` | Renders compliance summary, charts, modals; generates PDF |
| `SystemInfoForm.jsx` | Nominal voltage / Isc / IL inputs with smart hints + dropzone |
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

The uploaded `.xlsx` file must contain these sheets from a Chauvin Arnoux CA8335 (or compatible) export:

| Sheet | Purpose |
|---|---|
| `Trend` | Time-series RMS, power, energy, THD, PF — header at row 7 |
| `Vh Harmonic %` | Voltage harmonic % per order (H0–H50), per phase |
| `Ah Harmonic %` | Current harmonic % per order (H0–H50), per phase |

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

The export modal allows selecting any combination of these sections:

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

1. Export PQ trend data from CA8335 meter as `.xlsx`.
2. Open the app at `http://localhost:5173`.
3. Enter PCC parameters: nominal voltage, Isc, IL.
4. Drop the `.xlsx` file into the upload zone and click **Analyze**.
5. Review compliance summary — click **Voltage Compliance** or **Current Compliance** to see per-phase criteria detail.
6. Browse trend charts by tab (RMS / Power / Energy / Harmonics / TDD / PF / Unbalance).
7. Click **Export as PDF** and select the sections to include.
8. Use the report for maintenance decisions, filter sizing, or abnormal load investigation.

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