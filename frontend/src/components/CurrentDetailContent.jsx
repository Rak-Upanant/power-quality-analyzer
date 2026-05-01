import React from 'react';
import PassBadge from './PassBadge';
import OverPill from './OverPill';
import { pct } from '../constants/reportConstants';

const CurrentDetailContent = ({current,isc_il_ratio,is5min}) => {
    const {applicable=true,not_applicable_reason,tdd_limit,h_lt11_limit,per_phase_tdd,top_harmonics} = current;
    if (!applicable) {
        return (
            <div className="cdp-section">
                <p className="cdp-section-meta cdp-na-note">
                    Current distortion compliance: <strong>N/A</strong>
                </p>
                <p>{not_applicable_reason || 'Current limit table not available for this system voltage.'}</p>
            </div>
        );
    }
    const bracket = isc_il_ratio<20?'<20':isc_il_ratio<50?'20–50':isc_il_ratio<100?'50–100':isc_il_ratio<1000?'100–1000':'>1000';
    return (
        <div className="cdp-section">
            <p className="cdp-section-meta">
                Isc/IL=<strong>{isc_il_ratio}</strong> → <strong>{bracket}</strong> · TDD: <strong>{tdd_limit}%</strong> · h&lt;11: <strong>{h_lt11_limit}%</strong>
                {is5min && <span className="cdp-5min-note">⚠ 5-min data</span>}
            </p>
            <p className="cdp-table-caption">TDD per phase — Weekly percentiles (§5.3)</p>
            <div className="cdp-table-wrap">
                <table className="cdp-table">
                    <thead><tr><th>Phase</th><th>Criterion</th><th>Measured</th><th>Limit</th><th>Result</th></tr></thead>
                    <tbody>
                        {per_phase_tdd.map(p => (
                            <React.Fragment key={p.phase}>
                                <tr className={p.pass_t95?'':'cdp-row--fail'}>
                                    <td className="cdp-cell-ph" rowSpan={2}>{p.phase}</td>
                                    <td>Weekly 95th/10min</td>
                                    <td className="cdp-cell-value">{pct(p.t95_10min)}</td>
                                    <td className="cdp-cell-limit">{pct(p.limit_tdd)}</td>
                                    <td className="cdp-cell-status">
                                        <PassBadge pass={p.pass_t95}/>
                                        <OverPill measured={p.t95_10min} limit={p.limit_tdd}/>
                                    </td>
                                </tr>
                                <tr className={p.pass_t99?'':'cdp-row--fail'}>
                                    <td>Weekly 99th/10min</td>
                                    <td className="cdp-cell-value">{pct(p.t99_10min)}</td>
                                    <td className="cdp-cell-limit">{pct(p.limit_tdd_99)}</td>
                                    <td className="cdp-cell-status">
                                        <PassBadge pass={p.pass_t99}/>
                                        <OverPill measured={p.t99_10min} limit={p.limit_tdd_99}/>
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            {top_harmonics.length > 0 && (
                <>
                    <p className="cdp-table-caption" style={{marginTop:14}}>Individual harmonics (95th pct, % of IL)</p>
                    <div className="cdp-table-wrap">
                        <table className="cdp-table">
                            <thead><tr><th>Order</th><th>A1</th><th>A2</th><th>A3</th><th>Worst</th><th>Limit</th><th>Result</th></tr></thead>
                            <tbody>
                                {top_harmonics.map(h => (
                                    <tr key={h.order} className={h.pass?'':'cdp-row--fail'}>
                                        <td className="cdp-cell-ph">H{h.order}</td>
                                        <td>{pct(h.A1)}</td>
                                        <td>{pct(h.A2)}</td>
                                        <td>{pct(h.A3)}</td>
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

export default CurrentDetailContent;