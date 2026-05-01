import React from 'react';

const PassBadge = ({pass}) => (
    <span className={`cdp-badge ${pass?'cdp-badge--pass':'cdp-badge--fail'}`}>
        {pass?'✅ Pass':'❌ Fail'}
    </span>
);

export default PassBadge;