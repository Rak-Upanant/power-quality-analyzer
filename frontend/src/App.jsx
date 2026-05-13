import React, { useState, useRef } from 'react';

import SystemInfoForm from './SystemInfoForm';
import AnalysisReport from './AnalysisReport';
import { trendChartConfigs } from './constants';
import { getVoltageLimit, generateColorFromString } from './utils';
import { analyzePowerQuality } from './services/api';
import { useTimeRange } from './hooks/useTimeRange';
import { useFilteredTrendData } from './hooks/useFilteredTrendData';

import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [systemInfo, setSystemInfo] = useState({
    nominal_voltage: 690,
    isc: 10000,
    il: 500,
  });
  const [analysisMode, setAnalysisMode] = useState('full'); // 'full' | 'power_only'
  const [meterFormat, setMeterFormat] = useState('auto'); // 'auto' | 'sn3007' | 'sn210210'
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTrendTab, setActiveTrendTab] = useState('rms');
  const reportRef = useRef();

  const {
    startDate, setStartDate,
    endDate, setEndDate,
    startTime, setStartTime,
    endTime, setEndTime,
    timeInterval,
    handleResetTime,
  } = useTimeRange(analysisResult);

  const filteredTrendData = useFilteredTrendData(analysisResult, startDate, endDate, startTime, endTime);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSystemInfo(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setIsLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      const result = await analyzePowerQuality(file, systemInfo, analysisMode, meterFormat);
      setAnalysisResult(result);
      // In power-only mode the 'rms' tab is fine, but harmonic-related tabs
      // are not rendered — pre-select 'power' so users land on relevant data.
      if (analysisMode === 'power_only') setActiveTrendTab('power');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  

  return (
    <div className="container">
      <h1>Power Quality Analyzer (IEEE519-2022)</h1>

      <SystemInfoForm
        systemInfo={systemInfo}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        handleFileChange={handleFileChange}
        isLoading={isLoading}
        analysisMode={analysisMode}
        setAnalysisMode={setAnalysisMode}
        meterFormat={meterFormat}
        setMeterFormat={setMeterFormat}
      />

      {error && <div className="error-message">{error}</div>}

      {analysisResult && (
        <AnalysisReport 
          ref={reportRef}
          analysisResult={analysisResult}
          systemInfo={systemInfo} // Pass systemInfo to AnalysisReport
          getVoltageLimit={() => getVoltageLimit(systemInfo.nominal_voltage)}
          filteredTrendData={filteredTrendData}
          activeTrendTab={activeTrendTab}
          trendChartConfigs={trendChartConfigs}
          chartKey={analysisResult.fileName} // Use a unique key
          startDate={startDate}
          endDate={endDate}
          startTime={startTime}
          endTime={endTime}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          setStartTime={setStartTime}
          setEndTime={setEndTime}
          handleResetTime={handleResetTime}
          timeInterval={timeInterval}
          setActiveTrendTab={setActiveTrendTab}
          generateColorFromString={generateColorFromString}
        />
      )}
    </div>
  );
}

export default App;
