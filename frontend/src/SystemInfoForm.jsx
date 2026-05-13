// src/SystemInfoForm.jsx
// Requires: npm install react-dropzone
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

// ─── IEEE 519 bracket lookup ──────────────────────────────────────────────────
const getBracket = (ratio) => {
    if (ratio <= 0)   return null;
    if (ratio < 20)   return { label: '< 20',       color: '#854d0e', bg: '#fef9c3', tdd: '5%',  h11: '4%'  };
    if (ratio < 50)   return { label: '20 – 50',    color: '#14532d', bg: '#dcfce7', tdd: '8%',  h11: '7%'  };
    if (ratio < 100)  return { label: '50 – 100',   color: '#1e3a8a', bg: '#dbeafe', tdd: '12%', h11: '10%' };
    if (ratio < 1000) return { label: '100 – 1000', color: '#581c87', bg: '#f3e8ff', tdd: '15%', h11: '12%' };
    return              { label: '> 1000',           color: '#7f1d1d', bg: '#fee2e2', tdd: '20%', h11: '15%' };
};

const getVoltageClass = (v) => {
    if (v <= 1000)   return { label: '≤ 1 kV',       thd: '8%', indiv: '5%',   color: '#0369a1', bg: '#e0f2fe' };
    if (v <= 69000)  return { label: '1 – 69 kV',    thd: '5%', indiv: '3%',   color: '#065f46', bg: '#d1fae5' };
    if (v <= 161000) return { label: '69 – 161 kV',  thd: '2.5%',indiv: '1.5%',color: '#581c87', bg: '#f3e8ff' };
    return             { label: '> 161 kV',           thd: '1.5%',indiv: '1%',  color: '#7f1d1d', bg: '#fee2e2' };
};

// ─── Isc reference table ──────────────────────────────────────────────────────
// Verified ranges based on IEC 60909 short-circuit calculations
// at 400 V LV busbars, impedance voltage Uk = 4–6%
const ISC_REFERENCE = [
    { size: '160 – 250 kVA',  range: '4 – 10 kA',   note: 'Small industrial / commercial' },
    { size: '400 – 630 kVA',  range: '10 – 18 kA',  note: 'Medium commercial / light industry' },
    { size: '800 – 1,000 kVA',range: '16 – 25 kA',  note: 'Industrial feeder' },
    { size: '1,250 – 1,600 kVA',range:'22 – 35 kA', note: 'Large industrial' },
    { size: '2,000 – 2,500 kVA',range:'32 – 48 kA', note: 'Main LV distribution board' },
    { size: '3,150 – 4,000 kVA',range:'45 – 65 kA', note: 'Large substation' },
    { size: '5,000 kVA +',    range: '60 – 80 kA',  note: 'HV/LV substation, smelter, data centre' },
];

// ─── Drop Zone ────────────────────────────────────────────────────────────────
const DropZone = ({ onFileAccepted, currentFile }) => {
    const [rejected, setRejected] = useState(false);

    const onDrop = useCallback((accepted, bad) => {
        setRejected(bad.length > 0);
        if (accepted.length > 0) onFileAccepted(accepted[0]);
    }, [onFileAccepted]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        multiple: false,
        maxSize: 50 * 1024 * 1024,
    });

    const isError = isDragReject || rejected;
    const state   = isError ? 'error' : currentFile ? 'ready' : isDragActive ? 'hover' : 'idle';

    const cfg = {
        idle:  { border: '#94a3b8', bg: '#f8fafc', icon: '📊', text: 'Drag & drop your .xlsx file here', sub: 'or click to browse — max 50 MB' },
        hover: { border: '#3b82f6', bg: '#eff6ff', icon: '📂', text: 'Release to upload…',               sub: '' },
        error: { border: '#ef4444', bg: '#fef2f2', icon: '❌', text: 'Only .xlsx files are supported',   sub: 'Please try again' },
        ready: { border: '#22c55e', bg: '#f0fdf4', icon: '✅', text: currentFile?.name || '',             sub: `${((currentFile?.size || 0) / 1024).toFixed(1)} KB — click to replace` },
    }[state];

    return (
        <div {...getRootProps()} className="sif-dropzone" style={{ borderColor: cfg.border, background: cfg.bg }}>
            <input {...getInputProps()} />
            <span className="sif-drop-icon">{cfg.icon}</span>
            <span className="sif-drop-text" style={{ color: state === 'error' ? '#dc2626' : state === 'ready' ? '#15803d' : '#334155' }}>
                {cfg.text}
            </span>
            {cfg.sub && <span className="sif-drop-sub">{cfg.sub}</span>}
        </div>
    );
};

// ─── Isc reference popover ────────────────────────────────────────────────────
const IscReferenceTable = () => (
    <div className="sif-isc-ref">
        <p className="sif-isc-ref-title">📋 Typical Isc at 400 V LV busbar (IEC 60909)</p>
        <table className="sif-isc-table">
            <thead>
                <tr><th>Transformer Size</th><th>Typical Isc</th><th>Application</th></tr>
            </thead>
            <tbody>
                {ISC_REFERENCE.map(r => (
                    <tr key={r.size}>
                        <td>{r.size}</td>
                        <td><strong>{r.range}</strong></td>
                        <td>{r.note}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <p className="sif-isc-ref-note">
            ⚠ Actual Isc depends on transformer impedance (Uk%), cable length, and upstream impedance.
            Use power system software or utility data for precise values.
        </p>
    </div>
);

// ─── Main form ────────────────────────────────────────────────────────────────
const SystemInfoForm = ({ systemInfo, handleInputChange, handleSubmit, handleFileChange, isLoading,
                          analysisMode = 'full', setAnalysisMode,
                          meterFormat = 'auto', setMeterFormat }) => {
    const [file,       setFile]       = useState(null);
    const [showIscRef, setShowIscRef] = useState(false);

    const onFileAccepted = (f) => {
        setFile(f);
        handleFileChange({ target: { files: [f] } });
    };

    const ratio    = systemInfo.il > 0 ? systemInfo.isc / systemInfo.il : 0;
    const bracket  = getBracket(ratio);
    const vClass   = getVoltageClass(systemInfo.nominal_voltage);
    const isPowerOnly = analysisMode === 'power_only';

    return (
        <form className="sif-form" onSubmit={handleSubmit}>
            <div className="sif-header">
                <h2 className="sif-title">⚙ System Parameters at PCC</h2>
                <p className="sif-subtitle">
                    {isPowerOnly
                        ? 'Power-consumption mode: only the Trend sheet is required. Compliance / harmonic analysis is skipped.'
                        : 'Enter the Point of Common Coupling (PCC) parameters — IEEE 519-2022 limits are applied automatically.'}
                </p>
            </div>

            {/* ── Mode toggle ─────────────────────────────────────────── */}
            {setAnalysisMode && (
                <div className="sif-mode-toggle" role="radiogroup" aria-label="Analysis mode">
                    <button type="button" role="radio" aria-checked={!isPowerOnly}
                        className={`sif-mode-btn ${!isPowerOnly ? 'sif-mode-btn--active' : ''}`}
                        onClick={() => setAnalysisMode('full')}>
                        ⚡ Full IEEE 519 analysis
                    </button>
                    <button type="button" role="radio" aria-checked={isPowerOnly}
                        className={`sif-mode-btn ${isPowerOnly ? 'sif-mode-btn--active' : ''}`}
                        onClick={() => setAnalysisMode('power_only')}>
                        🔌 Power consumption
                    </button>
                </div>
            )}

            {/* ── Three input cards (hidden entirely in power-only mode) ─── */}
            {!isPowerOnly && (
            <div className="sif-inputs">

                {/* Nominal Voltage */}
                <div className="sif-card">
                    <div className="sif-card-label">
                        <span className="sif-card-icon">🔋</span>
                        <label htmlFor="nominal_voltage">
                            Nominal Voltage <span className="sif-unit">(V, line-to-line)</span>
                        </label>
                    </div>
                    <input id="nominal_voltage" type="number" name="nominal_voltage"
                        value={systemInfo.nominal_voltage} onChange={handleInputChange}
                        className="sif-input" min="1" />
                    <div className="sif-chip" style={{ background: vClass.bg, color: vClass.color }}>
                        {vClass.label} — THD {vClass.thd} / Individual {vClass.indiv}
                    </div>
                    <p className="sif-hint">Common: 380 / 400 / 415 V (LV) · 6,600 / 11,000 V (MV)</p>
                </div>

                {/* Short-Circuit Current */}
                <div className="sif-card">
                    <div className="sif-card-label">
                        <span className="sif-card-icon">⚡</span>
                        <label htmlFor="isc">
                            Short-Circuit I<sub>sc</sub> <span className="sif-unit">(A)</span>
                        </label>
                        <button type="button" className="sif-ref-btn" onClick={() => setShowIscRef(v => !v)}
                            title="Show reference table">
                            {showIscRef ? '▲ Hide ref' : '📋 Ref table'}
                        </button>
                    </div>
                    <input id="isc" type="number" name="isc"
                        value={systemInfo.isc} onChange={handleInputChange}
                        className="sif-input" min="1" />
                    <div className="sif-chip" style={{ background: '#fef3c7', color: '#92400e' }}>
                        Max short-circuit current at PCC
                    </div>
                    <p className="sif-hint">
                        500–1,000 kVA: ~10–25 kA · 1.5–2.5 MVA: ~25–45 kA · 3–5 MVA: ~45–80 kA
                    </p>
                    {showIscRef && <IscReferenceTable />}
                </div>

                {/* Max Demand IL */}
                <div className="sif-card">
                    <div className="sif-card-label">
                        <span className="sif-card-icon">📈</span>
                        <label htmlFor="il">
                            Max Demand I<sub>L</sub> <span className="sif-unit">(A)</span>
                        </label>
                    </div>
                    <input id="il" type="number" name="il"
                        value={systemInfo.il} onChange={handleInputChange}
                        className="sif-input" min="1" />
                    <div className="sif-chip" style={{ background: '#f3e8ff', color: '#581c87' }}>
                        12-month avg of 15/30-min peak demands
                    </div>
                    <p className="sif-hint">
                        Per IEEE 519-2022 §3.1 · Use max monthly 15-min demand ÷ 12
                    </p>
                </div>
            </div>
            )}

            {/* ── Isc/IL result banner ───────────────────────────────── */}
            {!isPowerOnly && bracket && (
                <div className="sif-ratio-banner" style={{ background: bracket.bg, borderColor: bracket.color }}>
                    <div className="sif-ratio-left">
                        <span className="sif-ratio-label">Isc / IL</span>
                        <span className="sif-ratio-value" style={{ color: bracket.color }}>
                            {ratio.toFixed(1)}
                        </span>
                    </div>
                    <div className="sif-ratio-right" style={{ color: bracket.color }}>
                        <span>Table 2 bracket: <strong>{bracket.label}</strong></span>
                        <span>TDD limit: <strong>{bracket.tdd}</strong> · h&lt;11 limit: <strong>{bracket.h11}</strong></span>
                    </div>
                </div>
            )}

            {/* ── File upload ────────────────────────────────────────── */}
            <div className="sif-file-section">
                <p className="sif-file-label">📁 Upload XLSX Data File (Chauvin Arnoux CA8335 export)</p>

                {/* Meter-format selector — auto-detects by sheet names; override forces a specific schema. */}
                {setMeterFormat && (
                    <label className="sif-meter-format">
                        <span className="sif-meter-format-label">Meter S/N</span>
                        <select
                            className="sif-meter-format-select"
                            value={meterFormat}
                            onChange={(e) => setMeterFormat(e.target.value)}
                            aria-label="Meter format / serial number"
                        >
                            <option value="auto">Auto-detect</option>
                            <option value="sn210210">C.A 8335 — SN 210210</option>
                            <option value="sn3007">C.A 8335 — SN 3007</option>
                        </select>
                    </label>
                )}

                <DropZone onFileAccepted={onFileAccepted} currentFile={file} />
            </div>

            {/* ── Submit ─────────────────────────────────────────────── */}
            <button type="submit" className="sif-submit" disabled={isLoading || !file}>
                {isLoading
                    ? <><span className="loading-spinner" /> Analyzing…</>
                    : isPowerOnly ? '🔌 Analyze Power Consumption' : '⚡ Analyze Power Quality'
                }
            </button>
        </form>
    );
};

export default SystemInfoForm;