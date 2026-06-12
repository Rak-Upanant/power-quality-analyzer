import React, { useState, useRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import HarmonicBarChart from './HarmonicBarChart';
import TrendChart from './TrendChart';
import TrendTabs from './TrendTabs';
import { getVoltageLimit, getCurrentLimitData } from './utils';
// Import extracted constants and components
import { EXPORT_SECTIONS, POWER_ONLY_EXPORT_SECTIONS, fmtEnergy, fmtPower, fmtVal } from './constants/reportConstants';
import { buildAnalysisPdf } from './utils/pdfReport';
import ComplianceModal from './components/ComplianceModal';
import SummaryInfoModal from './components/SummaryInfoModal';
import ExportModal from './components/ExportModal';
import SummaryItem from './components/SummaryItem';
import TariffPanel, { useTariff } from './components/TariffPanel';
import DemandProfileChart from './components/DemandProfileChart';
import { trendDataToCsv, downloadCsv } from './utils/csvExport';

// ─── Export sections ──────────────────────────────────────────────────────────
// Removed: inline EXPORT_SECTIONS definition

// ─── Parameter groups (from CA8335 export) ───────────────────────────────────
// Removed: inline PARAM_GROUPS definition

// ─── Formatters ───────────────────────────────────────────────────────────────
// Removed: inline fmtEnergy, fmtPower, fmtVal, pct definitions

// ─── CDP helpers ──────────────────────────────────────────────────────────────
// Removed: inline PassBadge, OverPill, VoltageDetailContent, CurrentDetailContent definitions

// ─── Compliance criteria modal ────────────────────────────────────────────────
// Removed: inline ComplianceModal definition

// ─── Summary info popup ───────────────────────────────────────────────────────
// Removed: inline SummaryInfoModal definition

// ─── Export PDF selector ──────────────────────────────────────────────────────
// Removed: inline ExportModal definition

// Removed: inline SummaryItem definition

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const AnalysisReport = React.forwardRef(({
    analysisResult,filteredTrendData,activeTrendTab,chartKey,
    startDate,endDate,startTime,endTime,
    setStartDate,setEndDate,setStartTime,setEndTime,
    handleResetTime,timeInterval,setActiveTrendTab,
    generateColorFromString,systemInfo
},ref) => {

    const [isPrinting,       setIsPrinting]       = useState(false);
    const [showExportModal,  setShowExportModal]  = useState(false);
    const [complianceModal,  setComplianceModal]  = useState(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // Power-consumption mode hides compliance / IEEE sections.
    const isPowerOnly      = analysisResult?.mode === 'power_only';
    const exportSections   = isPowerOnly ? POWER_ONLY_EXPORT_SECTIONS : EXPORT_SECTIONS;
    const [selectedSections, setSelectedSections] = useState(exportSections.map(s=>s.id));

    // When the result mode changes (new file analyzed), reset the selection
    // to the full default for the active mode.
    React.useEffect(() => {
        setSelectedSections(exportSections.map(s => s.id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPowerOnly]);

    const vhChartRef     = useRef(null);
    const ahChartRef     = useRef(null);
    const demandProfileRef = useRef(null);

    // Tariff state (currency + ฿/kWh) — persisted in localStorage.
    const [tariff, setTariff] = useTariff();
    // [FIX-2] Add chartKey dep so ref Map resets when a new file is analyzed
    const trendChartRefs = useMemo(()=>new Map(),[chartKey]);

    const chartGroups = [
        {type:'rms',         title:'Line-to-Line Voltage Trends',        yAxisLabel:'Voltage (V)',   parentDataKey:'voltage_ll',    childDataKeys:['U1 RMS','U2 RMS','U3 RMS']},
        {type:'rms',         title:'Line-to-Neutral Voltage Trends',      yAxisLabel:'Voltage (V)',   parentDataKey:'voltage_ln',    childDataKeys:['V1 RMS','V2 RMS','V3 RMS']},
        {type:'rms',         title:'Current RMS Trends',                  yAxisLabel:'Current (A)',   parentDataKey:'current',       childDataKeys:['A1 RMS','A2 RMS','A3 RMS']},
        {type:'power',       title:'Active Power Trend',                  yAxisLabel:'Power',         parentDataKey:'active_power',  childDataKeys:['W Total'],   yFormatter:fmtPower},
        {type:'power',       title:'Reactive Power Trend',                yAxisLabel:'Reactive',      parentDataKey:'reactive_power',childDataKeys:['var Total'], yFormatter:fmtPower},
        {type:'power',       title:'Apparent Power Trend',                yAxisLabel:'Apparent',      parentDataKey:'apparent_power',childDataKeys:['VA Total'],  yFormatter:fmtPower},
        {type:'energy',      title:'Active Energy Trend',                 yAxisLabel:'Energy',        parentDataKey:'active_energy', childDataKeys:['Wh Total'],   yFormatter:fmtEnergy},
        {type:'energy',      title:'Reactive Energy Trend',               yAxisLabel:'Energy',        parentDataKey:'reactive_energy',childDataKeys:['varh Total'],yFormatter:fmtEnergy},
        {type:'energy',      title:'Apparent Energy Trend',               yAxisLabel:'Energy',        parentDataKey:'apparent_energy',childDataKeys:['VAh Total'], yFormatter:fmtEnergy},
        {type:'harmonic',    title:'Voltage THD Trends (LN — V1/V2/V3)', yAxisLabel:'THD (%)',        parentDataKey:'thdv_percent',  childDataKeys:['V1 THD','V2 THD','V3 THD']},
        {type:'harmonic',    title:'Voltage THD Trends (LL — U1/U2/U3)', yAxisLabel:'THD (%)',        parentDataKey:'thdv_percent',  childDataKeys:['U1 THD','U2 THD','U3 THD']},
        {type:'harmonic',    title:'Current THD Trends',                  yAxisLabel:'THD (%)',        parentDataKey:'thdi_percent',  childDataKeys:['A1 THD','A2 THD','A3 THD']},
        {type:'tdd',         title:'TDD Trends',                          yAxisLabel:'TDD (%)',        parentDataKey:'tdd',           childDataKeys:['TDD1','TDD2','TDD3']},
        {type:'power_factor',title:'Power Factor Trends',                 yAxisLabel:'Power Factor',   parentDataKey:'power_factor',  childDataKeys:['PF1','PF2','PF3','PF Mean']},
        {type:'unbalance',   title:'Unbalance Trends',                    yAxisLabel:'Unbalance (%)',  parentDataKey:'unbalance',     childDataKeys:['Vunb','Aunb']},
    ];

    // [FIX-10] Memoize visible chart groups — only recompute when tab or print state changes
    // MUST be declared AFTER chartGroups to avoid temporal dead zone
    const visibleChartGroups = useMemo(
        () => chartGroups.filter(g => isPrinting || g.type === activeTrendTab),
        [activeTrendTab, isPrinting] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // ─── PDF generation lives in utils/pdfReport.js (buildAnalysisPdf) ────────

    // ─── CSV export handler ──────────────────────────────────────────────────
    const handleExportCSV = () => {
        const csv = trendDataToCsv(filteredTrendData);
        if (!csv) return;
        const base = (analysisResult.fileName || 'trend-data').replace(/\.xlsx$/i, '') + '-trend';
        downloadCsv(csv, base);
    };

    // ─── Export handler ───────────────────────────────────────────────────
    const handleExportPDF = () => {
        setShowExportModal(false); setIsPrinting(true);
        // Defer so the printing overlay paints and the off-screen charts mount
        // before buildAnalysisPdf snapshots them.
        setTimeout(() => {
            buildAnalysisPdf({
                analysisResult, systemInfo, tariff, selectedSections, isPowerOnly, chartGroups,
                refs: { vhChartRef, ahChartRef, demandProfileRef, trendChartRefs },
            })
                .catch(err => console.error('PDF generation error:', err))
                .finally(() => setIsPrinting(false));
        }, 500);
    };

    if(!analysisResult)return null;

    // [FIX-11] Memoize derived limit arrays
    const voltageLimit    = useMemo(()=>getVoltageLimit(systemInfo.nominal_voltage),[systemInfo.nominal_voltage]);
    const harmonicOrders  = useMemo(()=>analysisResult?.bar_chart_data?.labels||[],[analysisResult]);
    const voltageLimitData= useMemo(()=>new Array(harmonicOrders.length).fill(voltageLimit),[harmonicOrders,voltageLimit]);
    const currentLimitData= useMemo(()=>getCurrentLimitData(systemInfo,harmonicOrders),[systemInfo,harmonicOrders]);

    return <div className="results-container" ref={ref}>
        {isPrinting&&<div className="printing-overlay"><div className="loading-spinner"/><p>Generating PDF…</p></div>}

        <ExportModal isOpen={showExportModal} onClose={()=>setShowExportModal(false)}
            onExport={handleExportPDF} selectedSections={selectedSections} setSelectedSections={setSelectedSections}
            sections={exportSections}
            subtitle={isPowerOnly ? 'Power-consumption export — cover, summary, recommendations and the period are always included.' : undefined}/>
        <ComplianceModal open={complianceModal!==null} onClose={()=>setComplianceModal(null)}
            type={complianceModal} analysisResult={analysisResult}/>
        <SummaryInfoModal open={showSummaryModal} onClose={()=>setShowSummaryModal(false)}
            analysisResult={analysisResult} systemInfo={systemInfo}/>

        <div className="report-header">
            <h2>Analysis Results for: {analysisResult.fileName}</h2>
            <div className="export-buttons">
                <button className="export-csv-button" onClick={handleExportCSV}
                    disabled={isPrinting||!filteredTrendData?.timestamps?.length}
                    title="Download the filtered trend data as a CSV (opens in Excel)">
                    📊 Export CSV
                </button>
                <button className="export-button" onClick={()=>setShowExportModal(true)} disabled={isPrinting}>
                    {isPrinting?'Generating…':'📄 Export as PDF'}
                </button>
            </div>
        </div>

        {!isPowerOnly && analysisResult.weekly_window_satisfied===false&&(
            <div className="duration-warning" role="status">
                ⚠ Measurement spans <strong>{analysisResult.measurement_duration_days} days</strong>.
                IEEE 519-2022 §4.4 weekly statistics assume a 7-day window — treat compliance verdicts as indicative only.
            </div>
        )}

        {/* Compliance Summary */}
        <div className="summary-card">
            <div className="summary-header">
                <h3>{isPowerOnly ? 'Power Consumption Summary' : 'Compliance Summary'}</h3>
                <button className="summary-info-btn" onClick={()=>setShowSummaryModal(true)} title="View full summary">
                    📋 Full Details
                </button>
            </div>

            {isPowerOnly && (
                <TariffPanel tariff={tariff} setTariff={setTariff}
                    activeEnergyWh={analysisResult.summary_stats.active_energy_total}/>
            )}

            {analysisResult.peak_demand && (
                <div className="peak-demand-chip">
                    📈 <strong>Peak {analysisResult.peak_demand.window_minutes}-min demand:</strong>
                    <span>{(analysisResult.peak_demand.avg_w/1000).toFixed(1)} kW</span>
                    <span style={{color:'#9a3412',opacity:.85}}>·</span>
                    <span>{analysisResult.peak_demand.start} → {analysisResult.peak_demand.end}</span>
                </div>
            )}
            <div className="summary-grid-new">
                <div className="summary-col">
                    {isPowerOnly ? (
                        <div className="summary-item">
                            <span className="summary-label">Mode</span>
                            <span className="compliance-btn compliance-btn--na">🔌 Power consumption</span>
                        </div>
                    ) : (
                        <>
                            <div className="summary-item">
                                <span className="summary-label">Voltage Compliance</span>
                                <button className={`compliance-btn ${analysisResult.voltage_compliance==='Pass'?'compliance-btn--pass':'compliance-btn--fail'}`}
                                    onClick={()=>setComplianceModal('voltage')}>
                                    {analysisResult.voltage_compliance==='Pass'?'✅ Pass':'❌ Fail'}
                                    <span className="compliance-btn-hint">→ details</span>
                                </button>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Current Compliance</span>
                                <button className={`compliance-btn ${analysisResult.current_compliance==='Pass'?'compliance-btn--pass':analysisResult.current_compliance==='N/A'?'compliance-btn--na':'compliance-btn--fail'}`}
                                    onClick={()=>setComplianceModal('current')}>
                                    {analysisResult.current_compliance==='Pass'?'✅ Pass':analysisResult.current_compliance==='N/A'?'— N/A':'❌ Fail'}
                                    <span className="compliance-btn-hint">→ details</span>
                                </button>
                            </div>
                            <SummaryItem label="THDv 95th/10min (LN)" value={analysisResult.thdv_percent.toFixed(2)} unit="%"/>
                            <SummaryItem label="TDD 95th/10min"        value={analysisResult.tdd_percent.toFixed(2)}  unit="%"/>
                        </>
                    )}
                </div>
                <div className="summary-col">
                    <SummaryItem label="Avg. U1 RMS (LL)" value={analysisResult.summary_stats.u1_rms_avg.toFixed(2)} unit="V"/>
                    <SummaryItem label="Avg. U2 RMS (LL)" value={analysisResult.summary_stats.u2_rms_avg.toFixed(2)} unit="V"/>
                    <SummaryItem label="Avg. U3 RMS (LL)" value={analysisResult.summary_stats.u3_rms_avg.toFixed(2)} unit="V"/>
                    <SummaryItem label="Avg. V1 RMS (LN)" value={analysisResult.summary_stats.v1_rms_avg.toFixed(2)} unit="V"/>
                    <SummaryItem label="Avg. V2 RMS (LN)" value={analysisResult.summary_stats.v2_rms_avg.toFixed(2)} unit="V"/>
                    <SummaryItem label="Avg. V3 RMS (LN)" value={analysisResult.summary_stats.v3_rms_avg.toFixed(2)} unit="V"/>
                </div>
                <div className="summary-col">
                    <SummaryItem label="Avg. A1 RMS" value={analysisResult.summary_stats.a1_rms_avg.toFixed(2)} unit="A"/>
                    <SummaryItem label="Avg. A2 RMS" value={analysisResult.summary_stats.a2_rms_avg.toFixed(2)} unit="A"/>
                    <SummaryItem label="Avg. A3 RMS" value={analysisResult.summary_stats.a3_rms_avg.toFixed(2)} unit="A"/>
                    <SummaryItem label="Max A1 RMS"  value={analysisResult.summary_stats.a1_rms_max.toFixed(2)} unit="A"/>
                    <SummaryItem label="Max A2 RMS"  value={analysisResult.summary_stats.a2_rms_max.toFixed(2)} unit="A"/>
                    <SummaryItem label="Max A3 RMS"  value={analysisResult.summary_stats.a3_rms_max.toFixed(2)} unit="A"/>
                </div>
                <div className="summary-col">
                    <SummaryItem label="Avg. P"  value={fmtVal(analysisResult.summary_stats.active_power_avg,'W')}/>
                    <SummaryItem label="Avg. Q"  value={fmtVal(analysisResult.summary_stats.reactive_power_avg,'var')}/>
                    <SummaryItem label="Avg. S"  value={fmtVal(analysisResult.summary_stats.apparent_power_avg,'VA')}/>
                    <SummaryItem label="Avg. PF" value={analysisResult.summary_stats.power_factor_avg.toFixed(3)}/>
                </div>
                <div className="summary-col">
                    <SummaryItem label="Total Ep" value={fmtVal(analysisResult.summary_stats.active_energy_total,'Wh')}/>
                    <SummaryItem label="Total Eq" value={fmtVal(analysisResult.summary_stats.reactive_energy_total,'varh')}/>
                    <SummaryItem label="Total Es" value={fmtVal(analysisResult.summary_stats.apparent_energy_total,'VAh')}/>
                </div>
            </div>
        </div>

        {isPowerOnly && filteredTrendData?.active_power?.['W Total']?.length > 0 && (
            <div className="details-card">
                <h3>Demand Profile</h3>
                <DemandProfileChart ref={demandProfileRef} isPrinting={isPrinting}
                    activePowerSeries={filteredTrendData.active_power['W Total']}/>
            </div>
        )}

        {analysisResult.bar_chart_data&&<div className="details-card">
            <h3>Harmonic Spectrum Analysis{isPowerOnly && <span className="cdp-na-note"> — limits hidden in power-consumption mode</span>}</h3>
            <div className="harmonic-charts-container">
                <HarmonicBarChart ref={vhChartRef} isPrinting={isPrinting} key={`vh-${chartKey}`}
                    title="Average Voltage Harmonic Spectrum (Overall)" yAxisLabel="THDv (%)"
                    chartData={{labels:analysisResult.bar_chart_data.labels,data:analysisResult.bar_chart_data.vh_data}}
                    limitData={isPowerOnly ? null : voltageLimitData}/>
                <HarmonicBarChart ref={ahChartRef} isPrinting={isPrinting} key={`ah-${chartKey}`}
                    title="Average Current Harmonic Spectrum (Overall)" yAxisLabel="THDi (%)"
                    chartData={{labels:analysisResult.bar_chart_data.labels,data:analysisResult.bar_chart_data.ah_data}}
                    limitData={isPowerOnly ? null : currentLimitData}/>
            </div>
        </div>}

        <div style={{display:isPrinting?'none':'block'}}>
            {analysisResult.recommendations&&<div className="details-card recommendations-card">
                <h3>Recommendations</h3>
                <ul>{analysisResult.recommendations.map((r,i)=><li key={i}>{r}</li>)}</ul>
            </div>}
            {!isPowerOnly && Object.keys(analysisResult.failing_points).length>0&&<div className="details-card">
                <h3>Key Compliance Issues</h3>
                {Object.entries(analysisResult.failing_points).map(([cat,details])=><div key={cat} className="compliance-category">
                    <h4>{cat}</h4>
                    <ul>{Object.entries(details).map(([desc,data])=><li key={desc}>{desc}{data.phases.length>0&&<span> ({data.phases.join(', ')})</span>}</li>)}</ul>
                </div>)}
            </div>}
        </div>

        <div style={{display:isPrinting?'none':'block'}}>
            <div className="date-picker-container">
                <h3 className="section-title">Filter Trends by Date &amp; Time</h3>
                <div className="date-time-pickers">
                    <div className="date-picker-group"><label>Start:</label>
                        <div className="datetime-picker">
                            <DatePicker selected={startDate} onChange={setStartDate} selectsStart startDate={startDate} endDate={endDate} dateFormat="yyyy-MM-dd"/>
                            <input type="time" step="1" value={startTime} onChange={e=>setStartTime(e.target.value)}/>
                        </div>
                    </div>
                    <div className="date-picker-group"><label>End:</label>
                        <div className="datetime-picker">
                            <DatePicker selected={endDate} onChange={setEndDate} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate} dateFormat="yyyy-MM-dd"/>
                            <input type="time" step="1" value={endTime} onChange={e=>setEndTime(e.target.value)}/>
                        </div>
                    </div>
                    <button onClick={handleResetTime} className="reset-button">Reset</button>
                </div>
                {timeInterval&&<p className="time-interval-display"><strong>Time Interval:</strong> {timeInterval}</p>}
            </div>
            <TrendTabs activeTrendTab={activeTrendTab} setActiveTrendTab={setActiveTrendTab} isPowerOnly={isPowerOnly}/>
        </div>

        {filteredTrendData?(
            <div className="trend-chart-container">
                {visibleChartGroups.map(group=>{
                    const datasets=group.childDataKeys.map(key=>{
                        const data=filteredTrendData[group.parentDataKey]?.[key]; if(!data)return null;
                        return {label:key.replace(/_/g,' ').toUpperCase(),data:data.map((v,i)=>({x:filteredTrendData.timestamps[i],y:v})),borderColor:generateColorFromString(key),tension:0.1,pointRadius:0};
                    }).filter(Boolean);
                    if(datasets.length===0)return null;
                    if(!trendChartRefs.has(group.title))trendChartRefs.set(group.title,React.createRef());
                    return <div key={`${group.title}-${chartKey}-w`} className="trend-chart-grid" style={{display:isPrinting||group.type===activeTrendTab?'grid':'none'}}>
                        <TrendChart ref={trendChartRefs.get(group.title)} key={`${group.title}-${chartKey}`}
                            title={group.title} yAxisLabel={group.yAxisLabel} datasets={datasets}
                            timestamps={filteredTrendData.timestamps} yFormatter={group.yFormatter}/>
                    </div>;
                })}
            </div>
        ):(analysisResult&&<p className="no-data-message">No data available for the selected time range.</p>)}
    </div>;
});

export default AnalysisReport;