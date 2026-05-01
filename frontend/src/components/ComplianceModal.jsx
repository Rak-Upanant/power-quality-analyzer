import React from 'react';
import VoltageDetailContent from './VoltageDetailContent';
import CurrentDetailContent from './CurrentDetailContent';

const ComplianceModal = ({open,onClose,type,analysisResult}) => {
    if(!open || !analysisResult?.compliance_detail) return null;
    const d = analysisResult.compliance_detail;
    const isV = type === 'voltage';
    const pass = isV 
        ? analysisResult.voltage_compliance === 'Pass' 
        : analysisResult.current_compliance === 'Pass';
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box cdp-modal-box" onClick={e => e.stopPropagation()}>
                <div className={`cdp-modal-header ${pass?'cdp-mh--pass':'cdp-mh--fail'}`}>
                    <div>
                        <h3 className="cdp-modal-title">
                            {isV ? '⚡ Voltage Distortion' : '🔌 Current Distortion'} — Criteria Detail
                        </h3>
                        <p className="cdp-modal-subtitle">
                            IEEE §{isV?'5.1':'5.3'} · {d.nominal_voltage_kv} kV · Isc/IL: {d.isc_il_ratio}
                        </p>
                    </div>
                    <span className={`cdp-modal-result ${pass?'cdp-mr--pass':'cdp-mr--fail'}`}>
                        {pass?'✅ Pass':'❌ Fail'}
                    </span>
                </div>
                <div className="cdp-modal-body">
                    {isV 
                        ? <VoltageDetailContent voltage={d.voltage} is5min={d.data_is_5min} />
                        : <CurrentDetailContent current={d.current} isc_il_ratio={d.isc_il_ratio} is5min={d.data_is_5min} />
                    }
                </div>
                <div className="cdp-modal-footer">
                    <button className="modal-btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default ComplianceModal;