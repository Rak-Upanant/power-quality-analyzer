import React from 'react';

const OverPill = ({measured,limit}) => 
    (!limit || measured <= limit) ? null : 
    <span className="cdp-over-pill">{(measured/limit).toFixed(1)}× limit</span>;

export default OverPill;