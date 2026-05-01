import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement, // Import LineElement
  PointElement, // Import PointElement
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register necessary Chart.js components.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement, // Register LineElement
  PointElement, // Register PointElement
  Title,
  Tooltip,
  Legend
);

/**
 * HarmonicBarChart component renders a bar chart for harmonic spectrum data.
 * @param {object} props - The component props.
 * @param {object} props.chartData - Contains labels and data for the chart.
 * @param {string} props.title - The title of the chart.
 * @param {string} props.yAxisLabel - The label for the y-axis.
 * @param {number[]} [props.limitData] - Optional array of limit values to draw a line.
 */
const HarmonicBarChart = React.forwardRef(({ chartData, title, yAxisLabel, limitData, isPrinting }, ref) => {

  const datasets = [
    {
      type: 'bar',
      label: yAxisLabel,
      data: chartData.data,
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 2,
      order: 2,
    },
  ];

  if (limitData) {
    datasets.push({
      type: 'line',
      label: 'IEEE 519 Limit',
      data: limitData,
      borderColor: 'red',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      order: 1,
    });
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: !isPrinting,
    plugins: {
      legend: { 
        display: true, // Show legend for the limit line
        position: 'top',
      },
      title: { 
        display: true, 
        text: title, 
        font: { size: 16 } 
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Harmonic Order',
          font: { size: 14 }
        },
        ticks: {
          font: { size: 12 },
          callback: function(value) {
            const label = this.getLabelForValue(value);
            if (label % 2 !== 0) {
              return label;
            }
            return null;
          },
          autoSkip: false,
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        title: {
          display: true,
          text: yAxisLabel,
          font: { size: 14 }
        },
        ticks: {
          font: { size: 12 }
        },
        beginAtZero: true
      }
    }
  };

  const data = {
    labels: chartData.labels,
    datasets: datasets,
  };

  const handleSnapshot = () => {
    const chart = ref?.current;
    if (!chart) return;
    // 2x white-background PNG named after the chart title
    const src = typeof chart.toBase64Image === 'function'
      ? chart.toBase64Image('image/png', 1)
      : null;
    if (!src) return;
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

  return (
    <div className="chart-wrapper" style={{ height: '300px' }}>
      {!isPrinting && (
        <button type="button" className="chart-snapshot-btn"
          onClick={handleSnapshot} aria-label={`Save ${title} as PNG`} title="Save chart as PNG">
          📷
        </button>
      )}
      <Bar ref={ref} key={title} options={options} data={data} />
    </div>
  );
});

export default HarmonicBarChart;
