// frontend/src/utils/csvExport.js
// Flatten the (filtered) trend_data shape into one CSV with a row per
// timestamp and one column per parameter — easy to open in Excel.

const escapeCsvField = (value) => {
    if (value == null) return '';
    const s = String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
};

/**
 * Convert the trend-data object (timestamps + nested groups) into a CSV string.
 * @param {Object} trendData     — { timestamps: [...], <group>: { <channel>: [...] }, ... }
 * @returns {string|null}        — CSV text, or null if no rows
 */
export const trendDataToCsv = (trendData) => {
    if (!trendData?.timestamps || trendData.timestamps.length === 0) return null;
    const ts = trendData.timestamps;

    // Walk every nested {group: {channel: [array]}} pair, deterministic order.
    const columns = []; // [{ label, values }]
    Object.keys(trendData).forEach(groupKey => {
        if (groupKey === 'timestamps') return;
        const group = trendData[groupKey];
        if (!group || typeof group !== 'object') return;
        Object.keys(group).forEach(ch => {
            const values = group[ch];
            if (Array.isArray(values)) {
                columns.push({ label: ch, values });
            }
        });
    });

    const headerRow = ['timestamp', ...columns.map(c => c.label)];
    const lines = [headerRow.map(escapeCsvField).join(',')];

    for (let i = 0; i < ts.length; i++) {
        const row = [ts[i], ...columns.map(c => (c.values[i] ?? ''))];
        lines.push(row.map(escapeCsvField).join(','));
    }
    return lines.join('\r\n');
};

/**
 * Trigger a browser download of `csv` as `<basename>.csv`.
 */
export const downloadCsv = (csv, basename = 'trend-data') => {
    if (!csv) return;
    // BOM so Excel detects UTF-8 correctly (esp. for Thai / accented characters)
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${basename.replace(/\.xlsx$/i, '')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};
