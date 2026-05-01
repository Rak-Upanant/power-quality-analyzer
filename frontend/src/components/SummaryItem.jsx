import React from 'react';

const SummaryItem = ({label,value,unit=''}) => (
    <div className="summary-item">
        <span className="summary-label">{label}</span>
        <span className="summary-value">{value} {unit}</span>
    </div>
);

export default SummaryItem;