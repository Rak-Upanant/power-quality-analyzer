import { CURRENT_LIMITS_120V_to_69kV } from './constants';

export const generateColorFromString = (str) => {
  if (!str) return 'hsl(0, 70%, 50%)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 70%, 50%)`;
};

export const getVoltageLimit = (nominalVoltage) => {
    if (nominalVoltage <= 1000) return 5.0;
    if (nominalVoltage <= 69000) return 3.0;
    if (nominalVoltage <= 161000) return 1.5;
    return 1.0;
};

export const calculateTimeInterval = (startDate, endDate, startTime, endTime) => {
    if (!startDate || !endDate) return '';
    
    const startDateTime = new Date(`${startDate.toDateString()} ${startTime}`);
    const endDateTime = new Date(`${endDate.toDateString()} ${endTime}`);
    const diff = Math.abs(endDateTime - startDateTime);

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor(((diff % 3600000) % 60000) / 1000);

    return `${hours} hours ${minutes} min ${seconds} sec`;
};

export const getCurrentLimitData = (systemInfo, harmonicOrders) => {
    const { isc, il } = systemInfo;
    if (!isc || !il || il === 0) return null;

    const ratio = isc / il;
    let limitRow;

    if (ratio < 20) limitRow = CURRENT_LIMITS_120V_to_69kV.r_le_20;
    else if (ratio < 50) limitRow = CURRENT_LIMITS_120V_to_69kV.r_20_to_50;
    else if (ratio < 100) limitRow = CURRENT_LIMITS_120V_to_69kV.r_50_to_100;
    else if (ratio < 1000) limitRow = CURRENT_LIMITS_120V_to_69kV.r_100_to_1000;
    else limitRow = CURRENT_LIMITS_120V_to_69kV.r_gt_1000;

    if (!limitRow) return null;

    return harmonicOrders.map(h => {
        let base;
        if (h < 11) base = limitRow.h_lt_11;
        else if (h < 17) base = limitRow.h_11_17;
        else if (h < 23) base = limitRow.h_17_23;
        else if (h < 35) base = limitRow.h_23_35;
        else base = limitRow.h_gt_35;
        // IEEE 519-2022 Table 2 footnote (a): even harmonics h ≤ 6 limited to 50%
        if (h <= 6 && h % 2 === 0) base *= 0.5;
        return base;
    });
};