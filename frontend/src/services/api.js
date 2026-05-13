import axios from 'axios';
import { API_BASE_URL } from '../constants';

export const analyzePowerQuality = async (file, systemInfo, mode = 'full', meterFormat = 'auto') => {
  const formData = new FormData();
  formData.append('file', file);

  // Power-only mode does not need nominal_voltage / isc / il — omit them so
  // users can analyze a file without filling system parameters.
  const query = { mode, meter_format: meterFormat };
  if (mode === 'full') {
    query.nominal_voltage = systemInfo.nominal_voltage;
    query.isc = systemInfo.isc;
    query.il = systemInfo.il;
  }
  const params = new URLSearchParams(query);
  const API_URL = `${API_BASE_URL}/analyze/?${params.toString()}`;

  try {
    const response = await axios.post(API_URL, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (err) {
    console.error('[ERROR] Analysis failed:', err);
    throw new Error(err.response?.data?.detail || 'An unexpected error occurred during analysis.');
  }
};