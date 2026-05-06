import axios from 'axios';
import { API_BASE_URL } from '../constants';

export const analyzePowerQuality = async (file, systemInfo, mode = 'full') => {
  const formData = new FormData();
  formData.append('file', file);

  // In power-only mode, isc/il are not used by the backend — omit them so the
  // request is accepted even when the user has not supplied valid values.
  const query = { nominal_voltage: systemInfo.nominal_voltage, mode };
  if (mode === 'full') {
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