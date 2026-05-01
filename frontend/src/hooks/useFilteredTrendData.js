import { useMemo } from 'react';

export const useFilteredTrendData = (analysisResult, startDate, endDate, startTime, endTime) => {
    return useMemo(() => {
        const originalTrendData = analysisResult?.trend_data;
        if (!originalTrendData?.timestamps || !startDate || !endDate) {
            return null;
        }

        const startDateTime = new Date(`${startDate.toDateString()} ${startTime}`);
        const endDateTime = new Date(`${endDate.toDateString()} ${endTime}`);

        const indicesToKeep = originalTrendData.timestamps
            .map((ts, index) => ({ ts: new Date(ts), index }))
            .filter(({ ts }) => ts >= startDateTime && ts <= endDateTime)
            .map(({ index }) => index);

        if (indicesToKeep.length === 0) {
            const emptyData = { timestamps: [] };
            for (const key in originalTrendData) {
                if (key !== 'timestamps' && typeof originalTrendData[key] === 'object' && originalTrendData[key] !== null) {
                    emptyData[key] = {};
                    for (const subKey in originalTrendData[key]) {
                        emptyData[key][subKey] = [];
                    }
                }
            }
            return emptyData;
        }

        const filterArray = (arr) => (arr ? indicesToKeep.map((i) => arr[i]) : []);

        const filteredData = { timestamps: filterArray(originalTrendData.timestamps) };
        for (const key in originalTrendData) {
            if (key !== 'timestamps') {
                const dataGroup = originalTrendData[key];
                const filteredGroup = {};
                if (dataGroup) {
                    for (const subKey in dataGroup) {
                        filteredGroup[subKey] = filterArray(dataGroup[subKey]);
                    }
                }
                filteredData[key] = filteredGroup;
            }
        }
        
        return filteredData;
    }, [analysisResult, startDate, endDate, startTime, endTime]);
};