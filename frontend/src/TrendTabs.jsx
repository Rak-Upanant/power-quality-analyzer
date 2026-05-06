import React from 'react';

const ALL_TABS = [
  { id: 'rms',          label: 'RMS Trends' },
  { id: 'power',        label: 'Power Trends' },
  { id: 'energy',       label: 'Energy Trends' },
  { id: 'harmonic',     label: 'Harmonic Trends' },
  { id: 'power_factor', label: 'Power Factor Trends' },
  { id: 'unbalance',    label: 'Unbalance Trends' },
];

// Tabs that are meaningful when only power consumption was analyzed.
const POWER_ONLY_TABS = new Set(['rms', 'power', 'energy', 'power_factor']);

const TrendTabs = ({ activeTrendTab, setActiveTrendTab, isPowerOnly = false }) => {
  const tabs = isPowerOnly ? ALL_TABS.filter(t => POWER_ONLY_TABS.has(t.id)) : ALL_TABS;
  return (
    <div className="tabs-container">
      {tabs.map(t => (
        <button key={t.id}
          className={`tab-button ${activeTrendTab === t.id ? 'active' : ''}`}
          onClick={() => setActiveTrendTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
};

export default TrendTabs;
