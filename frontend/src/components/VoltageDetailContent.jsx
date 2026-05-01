import React from 'react';
import PassBadge from './PassBadge';
import OverPill from './OverPill';
import { pct } from '../constants/reportConstants';

const VoltageDetailContent = ({voltage,is5min}) => {
    const {thd_limit,individual_limit,per_phase,top_harmonics} = voltage;
    return (
        <div className="cdp-section">
            <p className="cdp-section-meta">
                Columns: <strong>LN (V1/V2/V3)</strong> · THD limit: <strong>{thd_limit}%</strong> · Individual: <strong>{individual_limit}%</strong>
                {is5min && <span className="cdp-5min-note">⚠ 5-min data</span>}
            </p>
            <p className="cdp-table-caption">THD per phase — Weekly percentiles (§5.1)</p>
            <div className="cdp-table-wrap">
                <table className="cdp-table">
                    <thead><tr><th>Phase</th><th>Criterion</th><th>Measured</th><th>Limit</th><th>Result</th></tr></thead>
                    <tbody>
                        {per_phase.map(p => (
                            <React.Fragment key={p.phase}>
                                <tr className={p.pass_t95?'':'cdp-row--fail'}>
                                    <td className="cdp-cell-ph" rowSpan={2}>{p.phase}</td>
                                    <td>Weekly 95th/10min</td>
                                    <td className="cdp-cell-value">{pct(p.t95_10min)}</td>
                                    <td className="cdp-cell-limit">{pct(p.limit_thd)}</td>
                                    <td className="cdp-cell-status">
                                        <PassBadge pass={p.pass_t95}/>
                                        <OverPill measured={p.t95_10min} limit={p.limit_thd}/>
                                    </td>
                                </tr>
                                <tr className={p.pass_t99?'':'cdp-row--fail'}>
                                    <td>Weekly 99th/10min</td>
                                    <td className="cdp-cell-value">{pct(p.t99_10min)}</td>
                                    <td className="cdp-cell-limit">{pct(p.limit_thd_99)}</td>
                                    <td className="cdp-cell-status">
                                        <PassBadge pass={p.pass_t99}/>
                                        <OverPill measured={p.t99_10min} limit={p.limit_thd_99}/>
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            {top_harmonics.length > 0 && (
                <>
                    <p className="cdp-table-caption" style={{marginTop:14}}>Individual harmonics (95th pct) — limit {individual_limit}%</p>
                    <div className="cdp-table-wrap">
                        <table className="cdp-table">
                            <thead><tr><th>Order</th><th>V1</th><th>V2</th><th>V3</th><th>Worst</th><th>Limit</th><th>Result</th></tr></thead>
                            <tbody>
                                {top_harmonics.map(h => (
                                    <tr key={h.order} className={h.pass?'':'cdp-row--fail'}>
                                        <td className="cdp-cell-ph">H{h.order}</td>
                                        <td>{pct(h.V1)}</td>
                                        <td>{pct(h.V2)}</td>
                                        <td>{pct(h.V3)}</td>
                                        <td className="cdp-cell-value"><strong>{pct(h.worst)}</strong></td>
                                        <td className="cdp-cell-limit">{pct(h.limit)}</td>
                                        <td className="cdp-cell-status">
                                            <PassBadge pass={h.pass}/>
                                            <OverPill measured={h.worst} limit={h.limit}/>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default VoltageDetailContent;