import React from 'react';
import { fmtVal } from '../constants/reportConstants';

const SummaryInfoModal = ({open,onClose,analysisResult,systemInfo}) => {
    if(!open || !analysisResult) return null;
    const {summary_stats:s,voltage_compliance:vc,current_compliance:cc,thdv_percent,tdd_percent,isc_il_ratio} = analysisResult;
    
    const groups = [
        {title:'⚙ System Parameters', rows:[
            ['Nominal Voltage', `${(systemInfo.nominal_voltage/1000).toFixed(3)} kV`],
            ['Short-Circuit Isc', `${(systemInfo.isc/1000).toFixed(2)} kA`],
            ['Max Demand IL', `${systemInfo.il.toFixed(0)} A`],
            ['Isc/IL Ratio', String(isc_il_ratio)],
        ]},
        {title:'⚡ Compliance', rows:[
            ['Voltage Compliance', vc],
            ['Current Compliance', cc],
            ['THDv 95th/10min (LN)', `${thdv_percent.toFixed(2)} %`],
            ['TDD 95th/10min', `${tdd_percent.toFixed(2)} %`],
        ]},
        {title:'🔋 Voltage (avg)', rows:[
            ['U1/U2/U3 RMS (LL)', `${s.u1_rms_avg.toFixed(1)} / ${s.u2_rms_avg.toFixed(1)} / ${s.u3_rms_avg.toFixed(1)} V`],
            ['V1/V2/V3 RMS (LN)', `${s.v1_rms_avg.toFixed(1)} / ${s.v2_rms_avg.toFixed(1)} / ${s.v3_rms_avg.toFixed(1)} V`],
        ]},
        {title:'🔌 Current (avg/max)', rows:[
            ['A1 avg/max', `${s.a1_rms_avg.toFixed(1)} A / ${s.a1_rms_max.toFixed(1)} A`],
            ['A2 avg/max', `${s.a2_rms_avg.toFixed(1)} A / ${s.a2_rms_max.toFixed(1)} A`],
            ['A3 avg/max', `${s.a3_rms_avg.toFixed(1)} A / ${s.a3_rms_max.toFixed(1)} A`],
        ]},
        {title:'⚡ Power & Energy', rows:[
            ['Avg. Active Power',    fmtVal(s.active_power_avg,'W')],
            ['Avg. Reactive Power',  fmtVal(s.reactive_power_avg,'var')],
            ['Avg. Apparent Power',  fmtVal(s.apparent_power_avg,'VA')],
            ['Avg. Power Factor',    s.power_factor_avg.toFixed(3)],
            ['Total Active Energy',  fmtVal(s.active_energy_total,'Wh')],
            ['Total Reactive Energy',fmtVal(s.reactive_energy_total,'varh')],
            ['Total Apparent Energy',fmtVal(s.apparent_energy_total,'VAh')],
        ]},
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box sim-modal-box" onClick={e => e.stopPropagation()}>
                <div className="sim-modal-header">
                    <h3 className="sim-modal-title">📊 Full Measurement Summary</h3>
                    <p className="sim-modal-subtitle">{analysisResult.fileName}</p>
                </div>
                <div className="sim-modal-body">
                    {groups.map(g => (
                        <div key={g.title} className="sim-group">
                            <div className="sim-group-title">{g.title}</div>
                            <table className="sim-table"><tbody>
                                {g.rows.map(([label,value]) => {
                                    const isPass = value === 'Pass'; 
                                    const isFail = value === 'Fail';
                                    return (
                                        <tr key={label}>
                                            <td className="sim-label">{label}</td>
                                            <td className={`sim-value ${isPass?'sim-pass':isFail?'sim-fail':''}`}>{value}</td>
                                        </tr>
                                    );
                                })}
                            </tbody></table>
                        </div>
                    ))}
                </div>
                <div className="sim-modal-footer">
                    <button className="modal-btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default SummaryInfoModal;