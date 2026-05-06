// frontend/src/components/DemandProfileChart.jsx
// Load duration curve: active power samples sorted descending against
// percentile-of-time. Tells the user "what fraction of the period was the
// plant above X kW". Useful for sizing peak-demand contracts.
import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

const fmtPower = v => {
    if (v == null || !Number.isFinite(v)) return '—';
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)} MW`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)} kW`;
    return `${v.toFixed(0)} W`;
};

const DemandProfileChart = React.forwardRef(({ activePowerSeries, isPrinting }, ref) => {
    const data = useMemo(() => {
        const arr = (activePowerSeries || []).map(Number).filter(v => Number.isFinite(v));
        if (arr.length === 0) return null;
        arr.sort((a, b) => b - a); // descending
        // Build {x: pct of time, y: power}
        const points = arr.map((v, i) => ({
            x: ((i + 1) / arr.length) * 100,
            y: v,
        }));
        return points;
    }, [activePowerSeries]);

    if (!data) {
        return (
            <div className="demand-profile-wrap" style={{ textAlign: 'center', paddingTop: 40 }}>
                <p>No active-power data available for demand profile.</p>
            </div>
        );
    }

    const peak = data[0]?.y ?? 0;
    const median = data[Math.floor(data.length / 2)]?.y ?? 0;
    const baseload = data[data.length - 1]?.y ?? 0;

    const chartData = {
        datasets: [{
            label: 'Active Power',
            data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.15)',
            fill: true,
            pointRadius: 0,
            tension: 0,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: !isPrinting,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: `Demand Profile (Load Duration Curve) — Peak ${fmtPower(peak)} · Median ${fmtPower(median)} · Baseload ${fmtPower(baseload)}`,
                font: { size: 13 },
            },
            tooltip: {
                callbacks: {
                    label: ctx => `${ctx.parsed.x.toFixed(1)}% of time → ${fmtPower(ctx.parsed.y)}`,
                },
            },
        },
        scales: {
            x: {
                type: 'linear',
                min: 0,
                max: 100,
                title: { display: true, text: '% of measurement period above this power' },
                ticks: { callback: v => `${v}%` },
            },
            y: {
                title: { display: true, text: 'Active Power' },
                ticks: { callback: v => fmtPower(v) },
            },
        },
    };

    return (
        <div className="demand-profile-wrap chart-wrapper">
            <Line ref={ref} data={chartData} options={options} />
        </div>
    );
});

export default DemandProfileChart;
