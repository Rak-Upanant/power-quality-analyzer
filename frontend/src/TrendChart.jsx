// src/TrendChart.jsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns'; // Required for time-based scales

// Register necessary Chart.js components for a line chart with time scales.
ChartJS.register(
  CategoryScale, // For categorical data (though time scale is used here, it's a base)
  LinearScale,   // For numerical y-axis
  PointElement,  // For rendering data points on the line
  LineElement,   // For rendering the lines connecting data points
  Title,         // For displaying the chart title
  Tooltip,       // For interactive tooltips on hover
  Legend,        // For displaying dataset legends
  TimeScale      // Crucial for handling time-series data on the x-axis
);

/**
 * TrendChart component renders a line chart for time-series trend data.
 * It displays various RMS, Power, or Energy trends over time.
 * @param {object} props - The component props.
 * @param {object} props.trendData - Contains timestamps and data for different trend lines.
 * @param {string} props.title - The title of the chart.
 * @param {string} props.yAxisLabel - The label for the y-axis.
 */
const TrendChart = React.forwardRef(({ datasets, title, yAxisLabel, timestamps }, ref) => {
  // Enhanced guard against invalid data structures.
  if (!datasets || !Array.isArray(datasets) || datasets.length === 0 || !timestamps || timestamps.length === 0) {
    return (
      <div className="chart-container" style={{ height: '400px', textAlign: 'center', paddingTop: '20px' }}>
        <p>No valid trend data to display for "{title}".</p>
      </div>
    );
  }

  const handleSnapshot = () => {
    const chart = ref?.current;
    if (!chart || typeof chart.toBase64Image !== 'function') return;
    const src = chart.toBase64Image('image/png', 1);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * 2;
      c.height = img.height * 2;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const link = document.createElement('a');
      link.href = c.toDataURL('image/png');
      link.download = `${title.replace(/[^\w]+/g, '_')}.png`;
      link.click();
    };
    img.src = src;
  };

  const chartData = { datasets: datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false, // Disable animation for PDF generation
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: title },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
          displayFormats: { minute: 'HH:mm', hour: 'HH:mm' },
        },
        ticks: {
          // Render two-line tick labels: time on top, date below.
          // Returning an array from callback creates multi-line labels.
          autoSkip: true,
          maxRotation: 0,
          source: 'auto',
          callback: function(value) {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return value;
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const yy = String(d.getFullYear()).slice(-2);
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            // Compact dd/mm/yy below the time keeps tick widths small.
            return [`${hh}:${mm}`, `${dd}/${mo}/${yy}`];
          },
        },
        title: { display: true, text: 'Time' },
      },
      y: {
        title: { display: true, text: yAxisLabel },
      },
    },
  };

  return (
    <div className="chart-container chart-wrapper" style={{ height: '400px' }}>
      <button type="button" className="chart-snapshot-btn"
        onClick={handleSnapshot} aria-label={`Save ${title} as PNG`} title="Save chart as PNG">
        📷
      </button>
      <Line ref={ref} options={options} data={chartData} />
    </div>
  );
});

export default TrendChart; // Export the component for use in other files