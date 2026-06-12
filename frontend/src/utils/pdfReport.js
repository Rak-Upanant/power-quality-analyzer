// frontend/src/utils/pdfReport.js
//
// PDF report generation, extracted from AnalysisReport.jsx so the component
// stays focused on rendering. Every function here is PURE with respect to React
// state: all data (analysisResult, systemInfo, tariff, chart refs, the selected
// section list) is passed in as arguments rather than closed over.
//
// Entry point: buildAnalysisPdf({...}) — builds the document and triggers the
// browser download. Branches between the full IEEE 519 report and the slim
// power-consumption report based on `isPowerOnly`.

import jsPDF from 'jspdf';
import { PARAM_GROUPS, fmtVal } from '../constants/reportConstants';

// ─── Low-level table row ───────────────────────────────────────────────────
// Draws one bordered row of cells. Optionally fills a highlight background.
function pdfRow(doc, margin, tW, cH, cols, widths, rowY, bold, hl, hlColor = [255, 243, 205]) {
    if (hl) { doc.setFillColor(...hlColor); doc.rect(margin, rowY - 5, tW, cH, 'F'); }
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    let x = margin; cols.forEach((t, i) => { doc.text(String(t), x + 1, rowY); x += widths[i]; });
    doc.setDrawColor(200, 200, 200); doc.rect(margin, rowY - 5, tW, cH, 'S');
}

// ─── Footer + page numbers (NEW) ───────────────────────────────────────────
// Runs after all content is laid out: stamps every page with a thin rule and a
// footer line (file name · tool name · "Page X / N"). jsPDF only knows the
// final page count once drawing is complete, so this is a separate pass.
function addFootersAndPageNumbers(doc, fileName) {
    const total = doc.internal.getNumberOfPages();
    const dW = doc.internal.pageSize.getWidth();
    const dH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const yLine = dH - 11;
    const yText = dH - 7;

    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.2);
        doc.line(margin, yLine, dW - margin, yLine);

        doc.setFontSize(7.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(120, 120, 120);
        // Left: file name (truncated so it never collides with the centre text)
        const name = (fileName || '').slice(0, 48);
        doc.text(name, margin, yText);
        // Centre: tool identity
        doc.text('Power Quality Analyzer — IEEE 519-2022', dW / 2, yText, { align: 'center' });
        // Right: page X / N
        doc.text(`Page ${i} / ${total}`, dW - margin, yText, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0);
}

// ─── Full-report sections ──────────────────────────────────────────────────

function drawSystemParamsSection(doc, margin, dW, y, systemInfo) {
    const { nominal_voltage, isc, il } = systemInfo;
    const kv = nominal_voltage / 1000; const ratio = il > 0 ? isc / il : 0; const tW = dW - margin * 2; const cH = 7; const W = [80, tW - 80];
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('System Parameters at PCC', margin, y); y += 8;
    doc.setFontSize(9);
    [
        ['Nominal Voltage', `${kv.toFixed(3)} kV  (${nominal_voltage} V)`],
        ['Short-Circuit Current Isc', `${(isc / 1000).toFixed(2)} kA  (${isc.toFixed(0)} A)`],
        ['Max Demand Load Current IL', `${il.toFixed(0)} A`],
        ['Isc / IL Ratio', `${ratio.toFixed(2)}`],
    ].forEach(([l, v]) => { pdfRow(doc, margin, tW, cH, [l, v], W, y, false, false); y += cH; });
    return y + 4;
}

function drawIEEETablesSection(doc, margin, dW, y, systemInfo) {
    const { nominal_voltage, isc, il } = systemInfo; const kv = nominal_voltage / 1000; const ratio = il > 0 ? isc / il : 0;
    const tW = dW - margin * 2; const cH = 7;
    const row = (cols, widths, rY, bold, hl) => pdfRow(doc, margin, tW, cH, cols, widths, rY, bold, hl);
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('IEEE 519-2022 Table 1 - Voltage Distortion Limits', margin, y); y += 6;
    doc.setFontSize(9);
    const vW = [65, 55, 60];
    [['Bus Voltage at PCC', 'Individual (%)', 'THD (%)'], ['<= 1 kV', '5.0', '8.0'], ['> 1 kV - 69 kV', '3.0', '5.0'], ['> 69-161 kV', '1.5', '2.5'], ['> 161 kV', '1.0', '1.5']].forEach((r, i) => {
        const a = i > 0 && ((i === 1 && kv <= 1) || (i === 2 && kv > 1 && kv <= 69) || (i === 3 && kv > 69 && kv <= 161) || (i === 4 && kv > 161));
        row(r, vW, y, i === 0, a); y += cH;
    });
    y += 6;
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('IEEE 519-2022 Table 2 - Current Distortion Limits (120V-69kV)', margin, y); y += 6;
    doc.setFontSize(9);
    const cW = [28, 26, 26, 26, 26, 26, 22];
    [['Isc/IL', '<11h', '11-17h', '17-23h', '23-35h', '>35h', 'TDD'], ['<20', '4.0', '2.0', '1.5', '0.6', '0.3', '5.0'], ['20-50', '7.0', '3.5', '2.5', '1.0', '0.5', '8.0'], ['50-100', '10.0', '4.5', '4.0', '1.5', '0.7', '12.0'], ['100-1000', '12.0', '5.5', '5.0', '2.0', '1.0', '15.0'], ['>1000', '15.0', '7.0', '6.0', '2.5', '1.4', '20.0']].forEach((r, i) => {
        const a = i > 0 && ((i === 1 && ratio < 20) || (i === 2 && ratio >= 20 && ratio < 50) || (i === 3 && ratio >= 50 && ratio < 100) || (i === 4 && ratio >= 100 && ratio < 1000) || (i === 5 && ratio >= 1000));
        row(r, cW, y, i === 0, a); y += cH;
    });
    doc.setFontSize(8); doc.setFont(undefined, 'italic');
    doc.text(`Isc/IL=${ratio.toFixed(1)} | ${kv.toFixed(3)} kV | Highlighted = active limit`, margin, y + 3);
    return y + 10;
}

function drawComplianceCriteria(doc, margin, dW, y, analysisResult) {
    const d = analysisResult.compliance_detail; if (!d) return y;
    const tW = dW - margin * 2; const cH = 7;
    const row = (cols, widths, rY, bold, hl, hlC) => pdfRow(doc, margin, tW, cH, cols, widths, rY, bold, hl, hlC || [255, 243, 205]);

    // Voltage
    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text('Voltage Distortion (IEEE Section 5.1) - Line-to-Neutral', margin, y); y += 7;
    doc.setFontSize(8.5);
    const vW = [28, 58, 26, 26, 26]; row(['Phase', 'Criterion', 'Measured', 'Limit', 'Result'], vW, y, true, false); y += cH;
    d.voltage.per_phase.forEach(p => {
        const f95 = !p.pass_t95; row([p.phase, 'Weekly 95th/10min', `${p.t95_10min}%`, `${p.limit_thd}%`, f95 ? 'FAIL' : 'Pass'], vW, y, false, f95, f95 ? [255, 210, 210] : null); y += cH;
        const f99 = !p.pass_t99; row(['', 'Weekly 99th/10min', `${p.t99_10min}%`, `${p.limit_thd_99}%`, f99 ? 'FAIL' : 'Pass'], vW, y, false, f99, f99 ? [255, 210, 210] : null); y += cH;
    });
    if (d.voltage.top_harmonics.length > 0) {
        y += 2; const hW = [18, 20, 20, 20, 22, 22, 42]; row(['Order', 'V1', 'V2', 'V3', 'Worst', 'Limit', 'Result'], hW, y, true, false); y += cH;
        d.voltage.top_harmonics.forEach(h => { const f = !h.pass; row([`H${h.order}`, `${h.V1}%`, `${h.V2}%`, `${h.V3}%`, `${h.worst}%`, `${h.limit}%`, f ? `FAIL (${(h.worst / h.limit).toFixed(1)}x)` : 'Pass'], hW, y, false, f, f ? [255, 210, 210] : null); y += cH; });
    }
    y += 6;

    // Page break before Current
    doc.addPage();
    y = margin;

    // Current
    const r = d.isc_il_ratio; const br = r < 20 ? '<20' : r < 50 ? '20-50' : r < 100 ? '50-100' : r < 1000 ? '100-1000' : '>1000';
    doc.setFontSize(11); doc.setFont(undefined, 'bold');
    doc.text(`Current Distortion (IEEE Section 5.3) - Isc/IL=${r} Bracket ${br}`, margin, y); y += 7;
    doc.setFontSize(8.5);
    const cW = [28, 58, 26, 26, 26]; row(['Phase', 'Criterion', 'Measured', 'Limit', 'Result'], cW, y, true, false); y += cH;
    d.current.per_phase_tdd.forEach(p => {
        const f95 = !p.pass_t95; row([p.phase, 'Weekly 95th/10min', `${p.t95_10min}%`, `${p.limit_tdd}%`, f95 ? 'FAIL' : 'Pass'], cW, y, false, f95, f95 ? [255, 210, 210] : null); y += cH;
        const f99 = !p.pass_t99; row(['', 'Weekly 99th/10min', `${p.t99_10min}%`, `${p.limit_tdd_99}%`, f99 ? 'FAIL' : 'Pass'], cW, y, false, f99, f99 ? [255, 210, 210] : null); y += cH;
    });
    if (d.current.top_harmonics.length > 0) {
        y += 2; const hW = [18, 20, 20, 20, 22, 22, 42]; row(['Order', 'A1', 'A2', 'A3', 'Worst', 'Limit', 'Result'], hW, y, true, false); y += cH;
        d.current.top_harmonics.forEach(h => { const f = !h.pass; row([`H${h.order}`, `${h.A1}%`, `${h.A2}%`, `${h.A3}%`, `${h.worst}%`, `${h.limit}%`, f ? `FAIL (${(h.worst / h.limit).toFixed(1)}x)` : 'Pass'], hW, y, false, f, f ? [255, 210, 210] : null); y += cH; });
    }
    return y + 6;
}

function drawParamGuide(doc, margin, dW, y) {
    const tW = dW - margin * 2; const cH = 7; const W = [50, 75, tW - 125];
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('Parameter Reference Guide', margin, y); y += 8;
    doc.setFontSize(8);
    pdfRow(doc, margin, tW, cH, ['Group', 'Parameters', 'Purpose'], W, y, true, false); y += cH;
    PARAM_GROUPS.forEach(r => {
        const lines = doc.splitTextToSize(r.params, W[1] - 2); const rH = Math.max(cH, lines.length * 4.5 + 2);
        if (y + rH > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        doc.setDrawColor(220, 220, 220); doc.rect(margin, y - 5, tW, rH, 'S');
        doc.setFont(undefined, 'bold'); doc.text(r.group, margin + 1, y, { maxWidth: W[0] - 2 });
        doc.setFont(undefined, 'normal'); doc.text(lines, margin + W[0] + 1, y);
        doc.text(r.purpose, margin + W[0] + W[1] + 1, y, { maxWidth: W[2] - 2 });
        y += rH;
    });
    doc.addPage();
    y = margin;
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('Calculation Methodology', margin, y); y += 8;
    doc.setFontSize(9); doc.setFont(undefined, 'normal');
    const formulas = [
        ['THDv (Voltage Total Harmonic Distortion)',
            'THDv = sqrt(sum(Vh^2, h=2..50)) / V1 × 100%',
            'Ratio of total harmonic RMS voltage to fundamental. Measured on line-to-neutral (V1/V2/V3) per IEEE 519-2022 §5.1. Compliance: Weekly 95th pct of 10-min values < Table 1 limit.'],
        ['THDi (Current Total Harmonic Distortion)',
            'THDi = sqrt(sum(Ih^2, h=2..50)) / I1 × 100%',
            'Ratio of harmonic current RMS to fundamental. Measured by instrument per IEC 61000-4-7. Used to derive TDD.'],
        ['TDD (Total Demand Distortion)',
            'TDD = Ih_rms / IL × 100%   where  I1 = Irms/sqrt(1+(THDi/100)^2),  Ih_rms = I1 × (THDi/100)',
            'Normalises harmonic current to maximum demand current IL (12-month avg of 15/30-min peaks per IEEE §3.1). This is the primary current compliance metric — compare with Table 2 TDD limit.'],
        ['10-min Short-Time Value (IEC 61000-4-30 eq.2)',
            'F_sh = sqrt((1/N) × sum(F_i^2))   [N=200 for 3-s values; approximated by RMS of 5-min window]',
            'RMS aggregation of consecutive very-short-time values. With 5-min CA8335 data, approximated as window RMS.'],
        ['Statistical Evaluation (IEEE 519-2022 §4.4)',
            'Compliance: Weekly 95th pct < Table limit  AND  Weekly 99th pct < 1.5× Table limit',
            'Short-time values accumulated over one week (7 days). Percentiles computed by linear interpolation across all 10-min values in the measurement period.'],
    ];
    formulas.forEach(([title, formula, desc]) => {
        if (y + 30 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        doc.setFont(undefined, 'bold'); doc.text(title, margin, y); y += 5;
        doc.setFillColor(240, 248, 255); doc.rect(margin, y - 4, tW, 8, 'F');
        doc.setFont(undefined, 'normal'); doc.text(formula, margin + 2, y); y += 7;
        const dL = doc.splitTextToSize(desc, tW - 4); doc.text(dL, margin, y); y += dL.length * 5 + 4;
    });
    y += 4;
    doc.setFontSize(8.5); doc.setFont(undefined, 'italic');
    const note = 'Instrument: Chauvin Arnoux CA8335 (IEC 61000-4-30 Class B) - suitable for engineering assessment. For formal compliance per IEEE 519-2022 Section 4, a Class A instrument (e.g. CA8345) is required.';
    const nL = doc.splitTextToSize(note, tW);
    doc.setFillColor(255, 253, 230); doc.rect(margin, y - 4, tW, nL.length * 5 + 6, 'F');
    doc.text(nL, margin + 2, y);
    return y + nL.length * 5 + 10;
}

// ─── Power-consumption sections ────────────────────────────────────────────

function periodInfo(analysisResult) {
    const ts = analysisResult?.trend_data?.timestamps || [];
    if (ts.length === 0) return null;
    const start = ts[0];
    const end = ts[ts.length - 1];
    const days = analysisResult.measurement_duration_days ?? 0;
    const totalSec = Math.max(0, Math.round(days * 86400));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return { start, end, days, interval: `${days} days (${h} h ${m} min)` };
}

function drawPowerSummarySection(doc, mg, dW, y, analysisResult, tariff) {
    const s = analysisResult.summary_stats;
    const tW = dW - mg * 2; const cH = 7; const W = [80, tW - 80];
    doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text('Power Consumption Summary', mg, y); y += 8;
    doc.setFontSize(9);
    const kWh = (s.active_energy_total || 0) / 1000;
    const cost = kWh * (Number(tariff.ratePerKwh) || 0);
    const rows = [
        ['Total Active Energy', fmtVal(s.active_energy_total, 'Wh')],
        ['Total Reactive Energy', fmtVal(s.reactive_energy_total, 'varh')],
        ['Total Apparent Energy', fmtVal(s.apparent_energy_total, 'VAh')],
        ['Estimated Cost', `${tariff.currency} ${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}  (${kWh.toFixed(0)} kWh @ ${tariff.currency}${tariff.ratePerKwh}/kWh)`],
        ['Avg. Active Power', fmtVal(s.active_power_avg, 'W')],
        ['Avg. Reactive Power', fmtVal(s.reactive_power_avg, 'var')],
        ['Avg. Apparent Power', fmtVal(s.apparent_power_avg, 'VA')],
        ['Avg. Power Factor', s.power_factor_avg.toFixed(3)],
        ['Max A1 / A2 / A3 RMS', `${s.a1_rms_max.toFixed(1)} / ${s.a2_rms_max.toFixed(1)} / ${s.a3_rms_max.toFixed(1)} A`],
        ['Avg. V1 / V2 / V3 RMS', `${s.v1_rms_avg.toFixed(1)} / ${s.v2_rms_avg.toFixed(1)} / ${s.v3_rms_avg.toFixed(1)} V`],
        ['THDv 95th (LN, max)', `${analysisResult.thdv_percent.toFixed(2)} %`],
        ['THDi 95th (max)', `${(s.thdi_percent_avg || 0).toFixed(2)} %`],
    ];
    const pd = analysisResult.peak_demand;
    if (pd) {
        rows.splice(4, 0, [
            `Peak ${pd.window_minutes}-min Demand`,
            `${(pd.avg_w / 1000).toFixed(1)} kW (${pd.start} → ${pd.end})`,
        ]);
    }
    rows.forEach(([l, v]) => { pdfRow(doc, mg, tW, cH, [l, v], W, y, false, false); y += cH; });
    return y + 4;
}

function drawPowerCover(doc, mg, dW, analysisResult, tariff) {
    let y = mg;
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('Power Consumption Report', dW / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(11); doc.setFont(undefined, 'normal');
    doc.text(analysisResult.fileName || '', dW / 2, y, { align: 'center' }); y += 12;

    const period = periodInfo(analysisResult);
    if (period) {
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text('Measurement Period', mg, y); y += 7;
        doc.setFontSize(9); doc.setFont(undefined, 'normal');
        const tW = dW - mg * 2;
        const W = [40, tW - 40];
        [
            ['Started', period.start],
            ['Ended', period.end],
            ['Time Interval', period.interval],
        ].forEach(([l, v]) => { pdfRow(doc, mg, tW, 7, [l, v], W, y, false, false); y += 7; });
        y += 6;
    }

    y = drawPowerSummarySection(doc, mg, dW, y, analysisResult, tariff);

    if (analysisResult.recommendations?.length > 0) {
        y += 2;
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text('Recommendations', mg, y); y += 7;
        doc.setFontSize(10); doc.setFont(undefined, 'normal');
        analysisResult.recommendations.forEach(r => {
            const lines = doc.splitTextToSize(`- ${r}`, dW - mg * 2);
            doc.text(lines, mg, y);
            y += lines.length * 5 + 2;
        });
    }
    return y;
}

// ─── Entry point ───────────────────────────────────────────────────────────

/**
 * Build and download the analysis PDF.
 *
 * @param {object}   opts
 * @param {object}   opts.analysisResult   API result object
 * @param {object}   opts.systemInfo       { nominal_voltage, isc, il }
 * @param {object}   opts.tariff           { currency, ratePerKwh }
 * @param {string[]} opts.selectedSections section ids chosen in the export modal
 * @param {boolean}  opts.isPowerOnly      power-consumption mode flag
 * @param {object[]} opts.chartGroups      chart group descriptors (for trend pages)
 * @param {object}   opts.refs             { vhChartRef, ahChartRef, demandProfileRef, trendChartRefs }
 */
export async function buildAnalysisPdf({
    analysisResult, systemInfo, tariff, selectedSections, isPowerOnly, chartGroups, refs,
}) {
    const { vhChartRef, ahChartRef, demandProfileRef, trendChartRefs } = refs;

    const doc = new jsPDF('p', 'mm', 'a4'); const mg = 15;
    const dW = doc.internal.pageSize.getWidth(); const dH = doc.internal.pageSize.getHeight();
    let y = mg; const has = id => selectedSections.includes(id);
    const brk = h => { if (y + h > dH - mg) { doc.addPage(); y = mg; } };
    const secTitle = t => { brk(15); doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text(t, mg, y); y += 8; doc.setFont(undefined, 'normal'); };
    const drawChart = (refOrChart, w, h) => { if (refOrChart?.current) { const img = refOrChart.current.toBase64Image('image/png', 1); brk(h + 10); doc.addImage(img, 'PNG', (dW - w) / 2, y, w, h); y += h + 10; } };

    if (isPowerOnly) {
        // ── Power-consumption PDF ────────────────────────────────────────
        y = drawPowerCover(doc, mg, dW, analysisResult, tariff);

        if (has('demand_profile') && demandProfileRef.current) {
            doc.addPage(); y = mg;
            secTitle('Demand Profile (Load Duration Curve)');
            drawChart(demandProfileRef, 185, 95);
        }

        if (has('harmonics') && analysisResult.bar_chart_data) {
            doc.addPage(); y = mg;
            secTitle('Harmonic Spectrums');
            drawChart(vhChartRef, 180, 90);
            drawChart(ahChartRef, 180, 90);
        }

        [
            { key: 'rms', label: 'RMS Trends' },
            { key: 'power', label: 'Power Trends' },
            { key: 'energy', label: 'Energy Trends' },
            { key: 'harmonic', label: 'Harmonic Trends' },
            { key: 'power_factor', label: 'Power Factor Trends' },
        ].forEach(({ key, label }) => {
            if (!has(key)) return;
            const grp = chartGroups.filter(g => g.type === key);
            const hasC = grp.some(g => trendChartRefs.has(g.title) && trendChartRefs.get(g.title)?.current);
            if (!hasC) return;
            doc.addPage(); y = mg; secTitle(label);
            grp.forEach(g => { const r = trendChartRefs.get(g.title); if (r?.current) drawChart(r, 185, 70); });
        });

        addFootersAndPageNumbers(doc, analysisResult.fileName);
        doc.save(`power-consumption-${analysisResult.fileName?.replace('.xlsx', '') || 'report'}.pdf`);
        return;
    }

    // ── Full IEEE 519 PDF ────────────────────────────────────────────────
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('Power Quality Analysis', dW / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(11); doc.setFont(undefined, 'normal');
    doc.text(analysisResult.fileName || '', dW / 2, y, { align: 'center' }); y += 12;

    if (has('system_params')) { secTitle('System Parameters'); y = drawSystemParamsSection(doc, mg, dW, y, systemInfo); }

    if (has('summary')) {
        secTitle('Compliance Summary');
        const { summary_stats: s, voltage_compliance: vc, current_compliance: cc, thdv_percent, tdd_percent } = analysisResult;
        [
            ['Voltage Compliance:', vc, vc === 'Pass' ? [0, 128, 0] : [180, 0, 0]],
            ['Current Compliance:', cc, cc === 'Pass' ? [0, 128, 0] : cc === 'N/A' ? [100, 116, 139] : [180, 0, 0]],
            ['THDv 95th/10min (LN):', `${thdv_percent.toFixed(2)} %`, null],
            ['TDD 95th/10min:', `${tdd_percent.toFixed(2)} %`, null],
            ['Avg. Power Factor:', s.power_factor_avg.toFixed(3), null],
            ['Avg. Active Power:', fmtVal(s.active_power_avg, 'W'), null],
            ['Total Active Energy:', fmtVal(s.active_energy_total, 'Wh'), null],
        ].forEach(([l, v, c]) => {
            brk(7); doc.setFontSize(10);
            doc.setFont(undefined, 'bold'); doc.setTextColor(0, 0, 0); doc.text(l, mg, y);
            doc.setFont(undefined, 'normal'); if (c) doc.setTextColor(...c);
            doc.text(v, mg + 90, y); doc.setTextColor(0, 0, 0); y += 7;
        });
        y += 4;
    }

    // criteria before ieee_table
    if (has('criteria') && analysisResult.compliance_detail) {
        doc.addPage();
        y = mg;
        secTitle('Compliance Criteria Detail');
        y = drawComplianceCriteria(doc, mg, dW, y, analysisResult);
    }
    if (has('recommendations') && analysisResult.recommendations?.length > 0) {
        doc.addPage(); y = mg; secTitle('Recommendations');
        doc.setFontSize(10); doc.setFont(undefined, 'normal');
        analysisResult.recommendations.forEach(r => { const l = doc.splitTextToSize(`- ${r}`, dW - mg * 2); brk(l.length * 5 + 2); doc.text(l, mg, y); y += l.length * 5 + 3; });
    }

    if (has('ieee_table')) {
        brk(20);
        secTitle('IEEE 519-2022 Limit Tables');
        y = drawIEEETablesSection(doc, mg, dW, y, systemInfo);
    }

    if (has('issues') && Object.keys(analysisResult.failing_points).length > 0) {
        brk(20); secTitle('Key Compliance Issues'); doc.setFontSize(10);
        Object.entries(analysisResult.failing_points).forEach(([cat, details]) => {
            brk(8); doc.setFont(undefined, 'bold'); doc.text(cat, mg, y); y += 6; doc.setFont(undefined, 'normal');
            Object.entries(details).forEach(([desc, data]) => {
                const t = `  - ${desc}${data.phases.length > 0 ? ` (${data.phases.join(', ')})` : ''}`;
                const l = doc.splitTextToSize(t, dW - mg * 2 - 5); brk(l.length * 5); doc.text(l, mg + 2, y); y += l.length * 5 + 1;
            });
        });
    }

    if (has('harmonics')) { doc.addPage(); y = mg; secTitle('Harmonic Spectrums'); drawChart(vhChartRef, 180, 90); drawChart(ahChartRef, 180, 90); }

    [{ key: 'rms', label: 'RMS Trends' }, { key: 'power', label: 'Power Trends' }, { key: 'energy', label: 'Energy Trends' },
    { key: 'harmonic', label: 'Harmonic Trends' }, { key: 'tdd', label: 'TDD Trends' },
    { key: 'power_factor', label: 'Power Factor Trends' }, { key: 'unbalance', label: 'Unbalance Trends' }
    ].forEach(({ key, label }) => {
        if (!has(key)) return;
        const grp = chartGroups.filter(g => g.type === key);
        const hasC = grp.some(g => trendChartRefs.has(g.title) && trendChartRefs.get(g.title)?.current);
        if (!hasC) return;
        doc.addPage(); y = mg; secTitle(label);
        grp.forEach(g => { const r = trendChartRefs.get(g.title); if (r?.current) drawChart(r, 185, 70); });
    });

    if (has('param_guide')) { doc.addPage(); y = mg; y = drawParamGuide(doc, mg, dW, y); }

    addFootersAndPageNumbers(doc, analysisResult.fileName);
    doc.save(`analysis-report-${analysisResult.fileName?.replace('.xlsx', '') || 'report'}.pdf`);
}
