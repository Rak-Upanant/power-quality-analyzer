export const EXPORT_SECTIONS = [
    { id:'system_params',  label:'System Parameters' },
    { id:'summary',        label:'Compliance Summary' },
    { id:'criteria',       label:'Compliance Criteria Detail' },
    { id:'ieee_table',     label:'IEEE 519 Limit Tables' },
    { id:'recommendations',label:'Recommendations' },
    { id:'issues',         label:'Key Compliance Issues' },
    { id:'harmonics',      label:'Harmonic Spectrums' },
    { id:'rms',            label:'RMS Trends' },
    { id:'power',          label:'Power Trends' },
    { id:'energy',         label:'Energy Trends' },
    { id:'harmonic',       label:'Harmonic Trends' },
    { id:'tdd',            label:'TDD Trends' },
    { id:'power_factor',   label:'Power Factor Trends' },
    { id:'unbalance',      label:'Unbalance Trends' },
    { id:'param_guide',    label:'Parameter Reference Guide' },
];

export const PARAM_GROUPS = [
    {group:'Voltage (LL/LN)',            params:'U1/U2/U3 RMS, V1/V2/V3 RMS',           purpose:'Basic voltage levels + sag/swell detection'},
    {group:'Voltage Quality',            params:'U1/U2/U3 THD, V1/V2/V3 THD, Vunb',     purpose:'Harmonic distortion, unbalance'},
    {group:'Current',                    params:'A1 RMS, A2 RMS, A3 RMS',               purpose:'Load monitoring, phase loading'},
    {group:'Current Quality',            params:'A1/A2/A3 THD, Aunb, KF1/KF2/KF3',      purpose:'Nonlinear load impact (VSD, rectifier)'},
    {group:'Active Power',               params:'W1, W2, W3, W Total',                  purpose:'Real power consumption'},
    {group:'Active Energy',              params:'Wh1, Wh2, Wh3, Wh Total',              purpose:'Billing / energy tracking'},
    {group:'Reactive Power',             params:'var1, var2, var3, var Total',          purpose:'Capacitor bank / PF correction'},
    {group:'Reactive Energy',            params:'varh1, varh2, varh3, varh Total',      purpose:'Utility penalty analysis'},
    {group:'Apparent Power',             params:'VA1, VA2, VA3, VA Total',              purpose:'Transformer loading'},
    {group:'Apparent Energy',            params:'VAh1, VAh2, VAh3, VAh Total',          purpose:'Capacity usage tracking'},
    {group:'Power Factor',               params:'PF1, PF2, PF3, PF Mean',               purpose:'Efficiency / penalty'},
    {group:'Displacement PF',            params:'DPF1, DPF2, DPF3, DPF Mean',           purpose:'Fundamental PF (without harmonics)'},
    {group:'Phase Angle',                params:'Tan1, Tan2, Tan3, Tan Mean',           purpose:'Capacitive / inductive behavior'},
    {group:'Flicker',                    params:'Pst1, Pst2, Pst3, Plt1, Plt2, Plt3',   purpose:'Lighting disturbance / arc furnace / large motor'},
    {group:'Unbalance',                  params:'Vunb, Aunb',                           purpose:'Phase imbalance detection'},
    {group:'Extremes (Voltage LN)',      params:'V1/V2/V3 RMS MAX/MIN',                 purpose:'Sag / swell event detection'},
    {group:'Extremes (Current)',         params:'A1/A2/A3 RMS MAX/MIN',                 purpose:'Peak load / overload'},
    {group:'Extremes (Voltage LL)',      params:'U1/U2/U3 RMS MAX/MIN',                 purpose:'System-level disturbance'},
    {group:'General',                    params:'Date, Time, Frequency',                purpose:'Timestamp + system frequency health'},
];

// Corrected formatters (fixed broken logic from current AnalysisReport.jsx)
export const fmtEnergy = v => { 
    if(Math.abs(v)>=1e9) return `${(v/1e9).toFixed(1)} GWh`; 
    if(Math.abs(v)>=1e6) return `${(v/1e6).toFixed(1)} MWh`; 
    if(Math.abs(v)>=1e3) return `${(v/1e3).toFixed(1)} kWh`; 
    return `${v.toFixed(0)} Wh`; 
};

export const fmtPower  = v => { 
    if(Math.abs(v)>=1e6) return `${(v/1e6).toFixed(2)} MW`; 
    if(Math.abs(v)>=1e3) return `${(v/1e3).toFixed(1)} kW`; 
    return `${v.toFixed(0)} W`; 
};

export const fmtVal = (v,u) => { 
    if(v==null) return `0.00 ${u}`; 
    if(v>999999) return `${(v/1e6).toFixed(2)} M${u}`; 
    if(v>999) return `${(v/1e3).toFixed(2)} k${u}`; 
    return `${v.toFixed(2)} ${u}`; 
};

export const pct = v => v==null ? '—' : `${Number(v).toFixed(2)}%`;