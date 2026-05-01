// src/ComplianceDetailPanel.jsx
import React from 'react';

const pct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);

const PassBadge = ({ pass }) => (
  <span className={`cdp-badge ${pass ? 'cdp-badge--pass' : 'cdp-badge--fail'}`}>
    {pass ? '✅ Pass' : '❌ Fail'}
  </span>
);

const OverPill = ({ measured, limit }) => {
  if (!limit || limit === 0 || measured <= limit) return null;
  const r = measured / limit;
  return (
    <span className="cdp-over-pill">{r.toFixed(1)}× limit</span>
  );
};

const VoltageContent = ({ voltage, is5min }) => {
  const { thd_limit, individual_limit, per_phase, top_harmonics } = voltage;
  return (
    <div className="cdp-section">
      <div className="cdp-section-meta">
        Columns: <strong>Line-to-Neutral (V1/V2/V3)</strong> · THD limit: <strong>{thd_limit}%</strong> · Individual: <strong>{individual_limit}%</strong>
        {is5min && <span className="cdp-5min-note">⚠ 5-min data — 3-second criterion not applicable</span>}
      </div>

      <p className="cdp-table-caption">THD per phase — Weekly short-time percentiles (IEEE §5.1)</p>
      <div className="cdp-table-wrap">
        <table className="cdp-table">
          <thead>
            <tr><th>Phase</th><th>Criterion</th><th>Measured</th><th>Limit</th><th>Result</th></tr>
          </thead>
          <tbody>
            {per_phase.map((p) => (
              <React.Fragment key={p.phase}>
                <tr className={p.pass_t95 ? '' : 'cdp-row--fail'}>
                  <td className="cdp-cell-ph" rowSpan={2}>{p.phase}</td>
                  <td>Weekly 95th / 10 min</td>
                  <td className="cdp-cell-value">{pct(p.t95_10min)}</td>
                  <td className="cdp-cell-limit">{pct(p.limit_thd)}</td>
                  <td className="cdp-cell-status"><PassBadge pass={p.pass_t95} /><OverPill measured={p.t95_10min} limit={p.limit_thd} /></td>
                </tr>
                <tr className={p.pass_t99 ? '' : 'cdp-row--fail'}>
                  <td>Weekly 99th / 10 min</td>
                  <td className="cdp-cell-value">{pct(p.t99_10min)}</td>
                  <td className="cdp-cell-limit">{pct(p.limit_thd_99)}</td>
                  <td className="cdp-cell-status"><PassBadge pass={p.pass_t99} /><OverPill measured={p.t99_10min} limit={p.limit_thd_99} /></td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {top_harmonics.length > 0 && (
        <>
          <p className="cdp-table-caption" style={{ marginTop: 16 }}>Individual voltage harmonics (95th pct) — limit: {individual_limit}%</p>
          <div className="cdp-table-wrap">
            <table className="cdp-table">
              <thead>
                <tr><th>Order</th><th>V1</th><th>V2</th><th>V3</th><th>Worst</th><th>Limit</th><th>Result</th></tr>
              </thead>
              <tbody>
                {top_harmonics.map((h) => (
                  <tr key={h.order} className={h.pass ? '' : 'cdp-row--fail'}>
                    <td className="cdp-cell-ph">H{h.order}</td>
                    <td>{pct(h.V1)}</td><td>{pct(h.V2)}</td><td>{pct(h.V3)}</td>
                    <td className="cdp-cell-value"><strong>{pct(h.worst)}</strong></td>
                    <td className="cdp-cell-limit">{pct(h.limit)}</td>
                    <td className="cdp-cell-status"><PassBadge pass={h.pass} /><OverPill measured={h.worst} limit={h.limit} /></td>
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

const CurrentContent = ({ current, isc_il_ratio, is5min }) => {
  const { tdd_limit, h_lt11_limit, per_phase_tdd, top_harmonics } = current;
  let bracket = isc_il_ratio < 20 ? '< 20' : isc_il_ratio < 50 ? '20 – 50' : isc_il_ratio < 100 ? '50 – 100' : isc_il_ratio < 1000 ? '100 – 1000' : '> 1000';

  return (
    <div className="cdp-section">
      <div className="cdp-section-meta">
        Isc/IL = <strong>{isc_il_ratio}</strong> → Bracket: <strong>{bracket}</strong> · TDD limit: <strong>{tdd_limit}%</strong> · h&lt;11: <strong>{h_lt11_limit}%</strong>
        {is5min && <span className="cdp-5min-note">⚠ 5-min data — 3-second criterion not applicable</span>}
      </div>

      <p className="cdp-table-caption">TDD per phase — Weekly short-time percentiles (IEEE §5.3)</p>
      <div className="cdp-table-wrap">
        <table className="cdp-table">
          <thead>
            <tr><th>Phase</th><th>Criterion</th><th>Measured</th><th>Limit</th><th>Result</th></tr>
          </thead>
          <tbody>
            {per_phase_tdd.map((p) => (
              <React.Fragment key={p.phase}>
                <tr className={p.pass_t95 ? '' : 'cdp-row--fail'}>
                  <td className="cdp-cell-ph" rowSpan={2}>{p.phase}</td>
                  <td>Weekly 95th / 10 min</td>
                  <td className="cdp-cell-value">{pct(p.t95_10min)}</td>
                  <td className="cdp-cell-limit">{pct(p.limit_tdd)}</td>
                  <td className="cdp-cell-status"><PassBadge pass={p.pass_t95} /><OverPill measured={p.t95_10min} limit={p.limit_tdd} /></td>
                </tr>
                <tr className={p.pass_t99 ? '' : 'cdp-row--fail'}>
                  <td>Weekly 99th / 10 min</td>
                  <td className="cdp-cell-value">{pct(p.t99_10min)}</td>
                  <td className="cdp-cell-limit">{pct(p.limit_tdd_99)}</td>
                  <td className="cdp-cell-status"><PassBadge pass={p.pass_t99} /><OverPill measured={p.t99_10min} limit={p.limit_tdd_99} /></td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {top_harmonics.length > 0 && (
        <>
          <p className="cdp-table-caption" style={{ marginTop: 16 }}>Individual current harmonics (95th pct, % of IL)</p>
          <div className="cdp-table-wrap">
            <table className="cdp-table">
              <thead>
                <tr><th>Order</th><th>A1</th><th>A2</th><th>A3</th><th>Worst</th><th>Limit</th><th>Result</th></tr>
              </thead>
              <tbody>
                {top_harmonics.map((h) => (
                  <tr key={h.order} className={h.pass ? '' : 'cdp-row--fail'}>
                    <td className="cdp-cell-ph">H{h.order}</td>
                    <td>{pct(h.A1)}</td><td>{pct(h.A2)}</td><td>{pct(h.A3)}</td>
                    <td className="cdp-cell-value"><strong>{pct(h.worst)}</strong></td>
                    <td className="cdp-cell-limit">{pct(h.limit)}</td>
                    <td className="cdp-cell-status"><PassBadge pass={h.pass} /><OverPill measured={h.worst} limit={h.limit} /></td>
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

// ── Modal popup ──────────────────────────────────────────────────────────────
export const ComplianceModal = ({ open, onClose, type, analysisResult }) => {
  if (!open || !analysisResult?.compliance_detail) return null;
  const d = analysisResult.compliance_detail;
  const isV = type === 'voltage';
  const pass = isV ? analysisResult.voltage_compliance === 'Pass' : analysisResult.current_compliance === 'Pass';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box cdp-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className={`cdp-modal-header ${pass ? 'cdp-mh--pass' : 'cdp-mh--fail'}`}>
          <div>
            <h3 className="cdp-modal-title">
              {isV ? '⚡ Voltage Distortion' : '🔌 Current Distortion'} — Criteria Detail
            </h3>
            <p className="cdp-modal-subtitle">
              IEEE 519-2022 §{isV ? '5.1' : '5.3'} · System: <strong>{d.nominal_voltage_kv} kV</strong> · Isc/IL: <strong>{d.isc_il_ratio}</strong>
            </p>
          </div>
          <span className={`cdp-modal-result ${pass ? 'cdp-mr--pass' : 'cdp-mr--fail'}`}>
            {pass ? '✅ Pass' : '❌ Fail'}
          </span>
        </div>

        <div className="cdp-modal-body">
          {isV
            ? <VoltageContent voltage={d.voltage} is5min={d.data_is_5min} />
            : <CurrentContent current={d.current} isc_il_ratio={d.isc_il_ratio} is5min={d.data_is_5min} />
          }
        </div>

        <div className="cdp-modal-footer">
          <button className="modal-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ── Inline / PDF version ─────────────────────────────────────────────────────
export const ComplianceDetailInline = ({ analysisResult }) => {
  const d = analysisResult?.compliance_detail;
  if (!d) return null;

  return (
    <div className="cdp-inline-card">
      <h3 className="cdp-inline-title">🔍 Compliance Criteria Detail</h3>
      <div className="cdp-context-bar">
        <span>System: <strong>{d.nominal_voltage_kv} kV</strong></span>
        <span>Isc/IL = <strong>{d.isc_il_ratio}</strong></span>
        <span>Voltage ref: <strong>{d.v_thd_prefix}-prefix (LN)</strong></span>
        {d.data_is_5min && <span className="cdp-5min-note">⚠ 5-min interval data</span>}
      </div>

      <div className="cdp-inline-section-header">
        <span>⚡ Voltage Distortion — IEEE §5.1</span>
        <PassBadge pass={analysisResult.voltage_compliance === 'Pass'} />
      </div>
      <VoltageContent voltage={d.voltage} is5min={d.data_is_5min} />

      <hr className="cdp-divider" />

      <div className="cdp-inline-section-header">
        <span>🔌 Current Distortion — IEEE §5.3</span>
        <PassBadge pass={analysisResult.current_compliance === 'Pass'} />
      </div>
      <CurrentContent current={d.current} isc_il_ratio={d.isc_il_ratio} is5min={d.data_is_5min} />
    </div>
  );
};

export default ComplianceDetailInline;