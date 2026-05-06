// frontend/src/components/TariffPanel.jsx
// Small inline tariff input that estimates billing cost from total active energy.
// Persists rate + currency in localStorage so the user does not need to retype.
import React, { useEffect, useMemo } from 'react';

const STORAGE_KEY = 'pqa_tariff_v1';

const formatCost = (currency, value) => {
    if (!Number.isFinite(value)) return `${currency} —`;
    if (Math.abs(value) >= 1e6) return `${currency} ${(value / 1e6).toFixed(2)} M`;
    if (Math.abs(value) >= 1e3) return `${currency} ${(value / 1e3).toFixed(2)} k`;
    return `${currency} ${value.toFixed(2)}`;
};

export const useTariff = () => {
    const [tariff, setTariff] = React.useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return {
                        currency: parsed.currency || '฿',
                        ratePerKwh: Number(parsed.ratePerKwh) || 4.5,
                    };
                }
            }
        } catch { /* ignore malformed storage */ }
        return { currency: '฿', ratePerKwh: 4.5 };
    });

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tariff)); } catch { /* ignore */ }
    }, [tariff]);

    return [tariff, setTariff];
};

const TariffPanel = ({ tariff, setTariff, activeEnergyWh }) => {
    const kWh = (activeEnergyWh || 0) / 1000;
    const cost = useMemo(() => kWh * (Number(tariff.ratePerKwh) || 0), [kWh, tariff.ratePerKwh]);

    return (
        <div className="tariff-panel" role="group" aria-label="Billing estimate">
            <div className="tariff-panel-row">
                <label className="tariff-label">💰 Tariff</label>
                <input
                    className="tariff-input tariff-input--currency"
                    type="text"
                    inputMode="text"
                    maxLength={4}
                    value={tariff.currency}
                    onChange={e => setTariff(t => ({ ...t, currency: e.target.value.slice(0, 4) || '฿' }))}
                    aria-label="Currency symbol"
                />
                <input
                    className="tariff-input tariff-input--rate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={tariff.ratePerKwh}
                    onChange={e => setTariff(t => ({ ...t, ratePerKwh: parseFloat(e.target.value) || 0 }))}
                    aria-label="Rate per kWh"
                />
                <span className="tariff-unit">/ kWh</span>
            </div>
            <div className="tariff-result">
                <span className="tariff-result-label">Estimated cost</span>
                <span className="tariff-result-value">{formatCost(tariff.currency, cost)}</span>
                <span className="tariff-result-detail">({kWh.toFixed(0)} kWh × {tariff.ratePerKwh}/kWh)</span>
            </div>
        </div>
    );
};

export default TariffPanel;
