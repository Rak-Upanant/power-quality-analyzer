import React, { useState, useRef, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import HarmonicBarChart from './HarmonicBarChart';
import TrendChart from './TrendChart';
import TrendTabs from './TrendTabs';
import jsPDF from 'jspdf';
import { getVoltageLimit, getCurrentLimitData } from './utils';
// Import extracted constants and components
import { EXPORT_SECTIONS, PARAM_GROUPS, fmtEnergy, fmtPower, fmtVal, pct } from './constants/reportConstants';
import ComplianceModal from './components/ComplianceModal';
import SummaryInfoModal from './components/SummaryInfoModal';
import ExportModal from './components/ExportModal';
import SummaryItem from './components/SummaryItem';

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
    const [selectedSections, setSelectedSections] = useState(EXPORT_SECTIONS.map(s=>s.id));

    const vhChartRef     = useRef(null);
    const ahChartRef     = useRef(null);
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

    // ─── PDF draw helpers ─────────────────────────────────────────────────────
    const pdfRow = (doc,margin,tW,cH,cols,widths,rowY,bold,hl,hlColor=[255,243,205]) => {
        if(hl){doc.setFillColor(...hlColor);doc.rect(margin,rowY-5,tW,cH,'F');}
        doc.setFont(undefined,bold?'bold':'normal');
        let x=margin; cols.forEach((t,i)=>{doc.text(String(t),x+1,rowY);x+=widths[i];});
        doc.setDrawColor(200,200,200);doc.rect(margin,rowY-5,tW,cH,'S');
    };

    const drawSystemParamsSection = (doc, margin, dW, y) => {
        const {nominal_voltage,isc,il}=systemInfo;
        const kv=nominal_voltage/1000; const ratio=il>0?isc/il:0; const tW=dW-margin*2; const cH=7; const W=[80,tW-80];
        doc.setFontSize(11);doc.setFont(undefined,'bold');doc.text('System Parameters at PCC',margin,y);y+=8;
        doc.setFontSize(9);
        [
            ['Nominal Voltage',          `${kv.toFixed(3)} kV  (${nominal_voltage} V)`],
            ['Short-Circuit Current Isc',`${(isc/1000).toFixed(2)} kA  (${isc.toFixed(0)} A)`],
            ['Max Demand Load Current IL',`${il.toFixed(0)} A`],
            ['Isc / IL Ratio',           `${ratio.toFixed(2)}`],
        ].forEach(([l,v])=>{ pdfRow(doc,margin,tW,cH,[l,v],W,y,false,false);y+=cH; });
        return y+4;
    };

    const drawIEEETablesSection = (doc, margin, dW, y) => {
        const {nominal_voltage,isc,il}=systemInfo; const kv=nominal_voltage/1000; const ratio=il>0?isc/il:0;
        const tW=dW-margin*2; const cH=7;
        const row=(cols,widths,rY,bold,hl)=>pdfRow(doc,margin,tW,cH,cols,widths,rY,bold,hl);
        doc.setFontSize(11);doc.setFont(undefined,'bold');doc.text('IEEE 519-2022 Table 1 - Voltage Distortion Limits',margin,y);y+=6;
        doc.setFontSize(9);
        const vW=[65,55,60];
        [['Bus Voltage at PCC','Individual (%)','THD (%)'],['<= 1 kV','5.0','8.0'],['> 1 kV - 69 kV','3.0','5.0'],['> 69-161 kV','1.5','2.5'],['> 161 kV','1.0','1.5']].forEach((r,i)=>{
            const a=i>0&&((i===1&&kv<=1)||(i===2&&kv>1&&kv<=69)||(i===3&&kv>69&&kv<=161)||(i===4&&kv>161));
            row(r,vW,y,i===0,a);y+=cH;
        });
        y+=6;
        doc.setFontSize(11);doc.setFont(undefined,'bold');doc.text('IEEE 519-2022 Table 2 - Current Distortion Limits (120V-69kV)',margin,y);y+=6;
        doc.setFontSize(9);
        const cW=[28,26,26,26,26,26,22];
        [['Isc/IL','<11h','11-17h','17-23h','23-35h','>35h','TDD'],['<20','4.0','2.0','1.5','0.6','0.3','5.0'],['20-50','7.0','3.5','2.5','1.0','0.5','8.0'],['50-100','10.0','4.5','4.0','1.5','0.7','12.0'],['100-1000','12.0','5.5','5.0','2.0','1.0','15.0'],['>1000','15.0','7.0','6.0','2.5','1.4','20.0']].forEach((r,i)=>{
            const a=i>0&&((i===1&&ratio<20)||(i===2&&ratio>=20&&ratio<50)||(i===3&&ratio>=50&&ratio<100)||(i===4&&ratio>=100&&ratio<1000)||(i===5&&ratio>=1000));
            row(r,cW,y,i===0,a);y+=cH;
        });
        doc.setFontSize(8);doc.setFont(undefined,'italic');
        doc.text(`Isc/IL=${ratio.toFixed(1)} | ${kv.toFixed(3)} kV | Highlighted = active limit`,margin,y+3);
        return y+10;
    }; 

    const drawComplianceCriteria = (doc,margin,dW,y) => {
        const d=analysisResult.compliance_detail; if(!d)return y;
        const tW=dW-margin*2; const cH=7;
        const row=(cols,widths,rY,bold,hl,hlC)=>pdfRow(doc,margin,tW,cH,cols,widths,rY,bold,hl,hlC||[255,243,205]);

        // Voltage
        doc.setFontSize(11);doc.setFont(undefined,'bold');
        doc.text('Voltage Distortion (IEEE Section 5.1) - Line-to-Neutral',margin,y);y+=7;
        doc.setFontSize(8.5);
        const vW=[28,58,26,26,26]; row(['Phase','Criterion','Measured','Limit','Result'],vW,y,true,false);y+=cH;
        d.voltage.per_phase.forEach(p=>{
            const f95=!p.pass_t95; row([p.phase,'Weekly 95th/10min',`${p.t95_10min}%`,`${p.limit_thd}%`,f95?'FAIL':'Pass'],vW,y,false,f95,f95?[255,210,210]:null);y+=cH;
            const f99=!p.pass_t99; row(['','Weekly 99th/10min',`${p.t99_10min}%`,`${p.limit_thd_99}%`,f99?'FAIL':'Pass'],vW,y,false,f99,f99?[255,210,210]:null);y+=cH;
        });
        if(d.voltage.top_harmonics.length>0){
            y+=2; const hW=[18,20,20,20,22,22,42]; row(['Order','V1','V2','V3','Worst','Limit','Result'],hW,y,true,false);y+=cH;
            d.voltage.top_harmonics.forEach(h=>{ const f=!h.pass; row([`H${h.order}`,`${h.V1}%`,`${h.V2}%`,`${h.V3}%`,`${h.worst}%`,`${h.limit}%`,f?`FAIL (${(h.worst/h.limit).toFixed(1)}x)`:'Pass'],hW,y,false,f,f?[255,210,210]:null);y+=cH; });
        }
        y+=6;

        // Page break before Current
        doc.addPage();
        y = margin;

        // Current
        const r=d.isc_il_ratio; const br=r<20?'<20':r<50?'20-50':r<100?'50-100':r<1000?'100-1000':'>1000';
        doc.setFontSize(11);doc.setFont(undefined,'bold');
        doc.text(`Current Distortion (IEEE Section 5.3) - Isc/IL=${r} Bracket ${br}`,margin,y);y+=7;
        doc.setFontSize(8.5);
        const cW=[28,58,26,26,26]; row(['Phase','Criterion','Measured','Limit','Result'],cW,y,true,false);y+=cH;
        d.current.per_phase_tdd.forEach(p=>{
            const f95=!p.pass_t95; row([p.phase,'Weekly 95th/10min',`${p.t95_10min}%`,`${p.limit_tdd}%`,f95?'FAIL':'Pass'],cW,y,false,f95,f95?[255,210,210]:null);y+=cH;
            const f99=!p.pass_t99; row(['','Weekly 99th/10min',`${p.t99_10min}%`,`${p.limit_tdd_99}%`,f99?'FAIL':'Pass'],cW,y,false,f99,f99?[255,210,210]:null);y+=cH;
        });
        if(d.current.top_harmonics.length>0){
            y+=2; const hW=[18,20,20,20,22,22,42]; row(['Order','A1','A2','A3','Worst','Limit','Result'],hW,y,true,false);y+=cH;
            d.current.top_harmonics.forEach(h=>{ const f=!h.pass; row([`H${h.order}`,`${h.A1}%`,`${h.A2}%`,`${h.A3}%`,`${h.worst}%`,`${h.limit}%`,f?`FAIL (${(h.worst/h.limit).toFixed(1)}x)`:'Pass'],hW,y,false,f,f?[255,210,210]:null);y+=cH; });
        }
        return y+6;
    };

    const drawParamGuide = (doc,margin,dW,y) => {
        const tW=dW-margin*2; const cH=7; const W=[50,75,tW-125];
        doc.setFontSize(11);doc.setFont(undefined,'bold');doc.text('Parameter Reference Guide',margin,y);y+=8;
        doc.setFontSize(8);
        pdfRow(doc,margin,tW,cH,['Group','Parameters','Purpose'],W,y,true,false);y+=cH;
        PARAM_GROUPS.forEach(r=>{
            const lines=doc.splitTextToSize(r.params,W[1]-2); const rH=Math.max(cH,lines.length*4.5+2);
            if(y+rH>doc.internal.pageSize.getHeight()-margin){doc.addPage();y=margin;}
            doc.setDrawColor(220,220,220);doc.rect(margin,y-5,tW,rH,'S');
            doc.setFont(undefined,'bold');doc.text(r.group,margin+1,y,{maxWidth:W[0]-2});
            doc.setFont(undefined,'normal');doc.text(lines,margin+W[0]+1,y);
            doc.text(r.purpose,margin+W[0]+W[1]+1,y,{maxWidth:W[2]-2});
            y+=rH;
        });
        doc.addPage();
        y = margin;
        doc.setFontSize(11);doc.setFont(undefined,'bold');doc.text('Calculation Methodology',margin,y);y+=8;
        doc.setFontSize(9);doc.setFont(undefined,'normal');
        const formulas=[
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
        formulas.forEach(([title,formula,desc])=>{
            if(y+30>doc.internal.pageSize.getHeight()-margin){doc.addPage();y=margin;}
            doc.setFont(undefined,'bold');doc.text(title,margin,y);y+=5;
            doc.setFillColor(240,248,255);doc.rect(margin,y-4,tW,8,'F');
            doc.setFont(undefined,'normal');doc.text(formula,margin+2,y);y+=7;
            const dL=doc.splitTextToSize(desc,tW-4);doc.text(dL,margin,y);y+=dL.length*5+4;
        });
        y+=4;
        doc.setFontSize(8.5);doc.setFont(undefined,'italic');
        const note='Instrument: Chauvin Arnoux CA8335 (IEC 61000-4-30 Class B) - suitable for engineering assessment. For formal compliance per IEEE 519-2022 Section 4, a Class A instrument (e.g. CA8345) is required.';
        const nL=doc.splitTextToSize(note,tW);
        doc.setFillColor(255,253,230);doc.rect(margin,y-4,tW,nL.length*5+6,'F');
        doc.text(nL,margin+2,y);
        return y+nL.length*5+10;
    };

    // ─── Export handler ───────────────────────────────────────────────────────
    const handleExportPDF = () => {
        setShowExportModal(false); setIsPrinting(true);
        setTimeout(()=>{
            const go = async () => {
                const doc=new jsPDF('p','mm','a4'); const mg=15;
                const dW=doc.internal.pageSize.getWidth(); const dH=doc.internal.pageSize.getHeight();
                let y=mg; const has=id=>selectedSections.includes(id);
                const brk=h=>{if(y+h>dH-mg){doc.addPage();y=mg;}};
                const secTitle=t=>{brk(15);doc.setFontSize(14);doc.setFont(undefined,'bold');doc.text(t,mg,y);y+=8;doc.setFont(undefined,'normal');};
                const drawChart=(ref,w,h)=>{if(ref?.current){const img=ref.current.toBase64Image('image/png',1);brk(h+10);doc.addImage(img,'PNG',(dW-w)/2,y,w,h);y+=h+10;}};

                doc.setFontSize(18);doc.setFont(undefined,'bold');
                doc.text('Power Quality Analysis',dW/2,y,{align:'center'});y+=7;
                doc.setFontSize(11);doc.setFont(undefined,'normal');
                doc.text(analysisResult.fileName||'',dW/2,y,{align:'center'});y+=12;

                if(has('system_params')){secTitle('System Parameters');y=drawSystemParamsSection(doc,mg,dW,y);}

                if(has('summary')){
                    secTitle('Compliance Summary');
                    const {summary_stats:s,voltage_compliance:vc,current_compliance:cc,thdv_percent,tdd_percent}=analysisResult;
                    [
                        ['Voltage Compliance:', vc, vc==='Pass'?[0,128,0]:[180,0,0]],
                        ['Current Compliance:', cc, cc==='Pass'?[0,128,0]:cc==='N/A'?[100,116,139]:[180,0,0]],
                        ['THDv 95th/10min (LN):', `${thdv_percent.toFixed(2)} %`, null],
                        ['TDD 95th/10min:', `${tdd_percent.toFixed(2)} %`, null],
                        ['Avg. Power Factor:', s.power_factor_avg.toFixed(3), null],
                        ['Avg. Active Power:', fmtVal(s.active_power_avg,'W'), null],
                        ['Total Active Energy:', fmtVal(s.active_energy_total,'Wh'), null],
                    ].forEach(([l,v,c])=>{
                        brk(7); doc.setFontSize(10);
                        doc.setFont(undefined,'bold');doc.setTextColor(0,0,0);doc.text(l,mg,y);
                        doc.setFont(undefined,'normal');if(c)doc.setTextColor(...c);
                        doc.text(v,mg+90,y);doc.setTextColor(0,0,0);y+=7;
                    });
                    y+=4;
                }

                // [FIX-16] criteria before ieee_table
                if(has('criteria')&&analysisResult.compliance_detail){
                    doc.addPage();
                    y = mg;
                    secTitle('Compliance Criteria Detail');
                    y = drawComplianceCriteria(doc,mg,dW,y);
                }
                if(has('recommendations')&&analysisResult.recommendations?.length>0){
                    doc.addPage();y=mg;secTitle('Recommendations');
                    doc.setFontSize(10);doc.setFont(undefined,'normal');
                    analysisResult.recommendations.forEach(r=>{const l=doc.splitTextToSize(`- ${r}`,dW-mg*2);brk(l.length*5+2);doc.text(l,mg,y);y+=l.length*5+3;});
                }

                if(has('ieee_table')){
                    brk(20);
                    secTitle('IEEE 519-2022 Limit Tables');
                    y = drawIEEETablesSection(doc,mg,dW,y);
                }

                if(has('issues')&&Object.keys(analysisResult.failing_points).length>0){
                    brk(20);secTitle('Key Compliance Issues');doc.setFontSize(10);
                    Object.entries(analysisResult.failing_points).forEach(([cat,details])=>{
                        brk(8);doc.setFont(undefined,'bold');doc.text(cat,mg,y);y+=6;doc.setFont(undefined,'normal');
                        Object.entries(details).forEach(([desc,data])=>{
                            const t=`  - ${desc}${data.phases.length>0?` (${data.phases.join(', ')})`:''}`;
                            const l=doc.splitTextToSize(t,dW-mg*2-5);brk(l.length*5);doc.text(l,mg+2,y);y+=l.length*5+1;
                        });
                    });
                }

                if(has('harmonics')){doc.addPage();y=mg;secTitle('Harmonic Spectrums');drawChart(vhChartRef,180,90);drawChart(ahChartRef,180,90);}

                [{key:'rms',label:'RMS Trends'},{key:'power',label:'Power Trends'},{key:'energy',label:'Energy Trends'},
                 {key:'harmonic',label:'Harmonic Trends'},{key:'tdd',label:'TDD Trends'},
                 {key:'power_factor',label:'Power Factor Trends'},{key:'unbalance',label:'Unbalance Trends'}
                ].forEach(({key,label})=>{
                    if(!has(key))return;
                    const grp=chartGroups.filter(g=>g.type===key);
                    const hasC=grp.some(g=>trendChartRefs.has(g.title)&&trendChartRefs.get(g.title)?.current);
                    if(!hasC)return;
                    doc.addPage();y=mg;secTitle(label);
                    grp.forEach(g=>{const r=trendChartRefs.get(g.title);if(r?.current)drawChart(r,185,70);});
                });

                if(has('param_guide')){doc.addPage();y=mg;y=drawParamGuide(doc,mg,dW,y);}

                doc.save(`analysis-report-${analysisResult.fileName?.replace('.xlsx','')||'report'}.pdf`);
            };
            // [FIX-15] Catch PDF errors — prevents silent swallow
            go().catch(err=>console.error('PDF generation error:',err)).finally(()=>setIsPrinting(false));
        },500);
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
            onExport={handleExportPDF} selectedSections={selectedSections} setSelectedSections={setSelectedSections}/>
        <ComplianceModal open={complianceModal!==null} onClose={()=>setComplianceModal(null)}
            type={complianceModal} analysisResult={analysisResult}/>
        <SummaryInfoModal open={showSummaryModal} onClose={()=>setShowSummaryModal(false)}
            analysisResult={analysisResult} systemInfo={systemInfo}/>

        <div className="report-header">
            <h2>Analysis Results for: {analysisResult.fileName}</h2>
            <button className="export-button" onClick={()=>setShowExportModal(true)} disabled={isPrinting}>
                {isPrinting?'Generating…':'📄 Export as PDF'}
            </button>
        </div>

        {analysisResult.weekly_window_satisfied===false&&(
            <div className="duration-warning" role="status">
                ⚠ Measurement spans <strong>{analysisResult.measurement_duration_days} days</strong>.
                IEEE 519-2022 §4.4 weekly statistics assume a 7-day window — treat compliance verdicts as indicative only.
            </div>
        )}

        {/* Compliance Summary */}
        <div className="summary-card">
            <div className="summary-header">
                <h3>Compliance Summary</h3>
                <button className="summary-info-btn" onClick={()=>setShowSummaryModal(true)} title="View full summary">
                    📋 Full Details
                </button>
            </div>
            <div className="summary-grid-new">
                <div className="summary-col">
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

        {analysisResult.bar_chart_data&&<div className="details-card">
            <h3>Harmonic Spectrum Analysis</h3>
            <div className="harmonic-charts-container">
                <HarmonicBarChart ref={vhChartRef} isPrinting={isPrinting} key={`vh-${chartKey}`}
                    title="Average Voltage Harmonic Spectrum (Overall)" yAxisLabel="THDv (%)"
                    chartData={{labels:analysisResult.bar_chart_data.labels,data:analysisResult.bar_chart_data.vh_data}} limitData={voltageLimitData}/>
                <HarmonicBarChart ref={ahChartRef} isPrinting={isPrinting} key={`ah-${chartKey}`}
                    title="Average Current Harmonic Spectrum (Overall)" yAxisLabel="THDi (%)"
                    chartData={{labels:analysisResult.bar_chart_data.labels,data:analysisResult.bar_chart_data.ah_data}} limitData={currentLimitData}/>
            </div>
        </div>}

        <div style={{display:isPrinting?'none':'block'}}>
            {analysisResult.recommendations&&<div className="details-card recommendations-card">
                <h3>Recommendations</h3>
                <ul>{analysisResult.recommendations.map((r,i)=><li key={i}>{r}</li>)}</ul>
            </div>}
            {Object.keys(analysisResult.failing_points).length>0&&<div className="details-card">
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
            <TrendTabs activeTrendTab={activeTrendTab} setActiveTrendTab={setActiveTrendTab}/>
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