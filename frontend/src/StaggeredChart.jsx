// src/StaggeredChart.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label
} from 'recharts';

const StaggeredChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define colors for your success categories
  const categoryColors = {
    '20-40%': '#8884d8',  // Purple
    '40-60%': '#82ca9d',  // Green
    '60-80%': '#ffc658',  // Yellow
    '80-100%': '#ff8042', // Orange
    '>100%': '#d0ed57'    // Lime
  };

  useEffect(() => {
    // 1. Fetch data from the Django API
    axios.get('https://dashboard.aiswaryasathyan.space/api/chart-data/')
      .then(response => {
        setData(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Could not load data. Ensure Backend is running.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="status-message">
        Loading chart data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-message">
        {error}
      </div>
    );
  }

  return (
    <>
      <div style={{ width: '100%', height: '100%', flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 24,
              left: 4,
              bottom: 32,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(148, 163, 184, 0.25)"
              vertical={false}
            />

            {/* X-Axis: Duration */}
            <XAxis
              dataKey="duration"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
            >
              <Label
                value="Holding duration (weeks)"
                offset={-20}
                position="insideBottom"
                style={{ fill: '#6b7280', fontSize: 11 }}
              />
            </XAxis>

            {/* Y-Axis: Count of companies */}
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
              label={{
                value: 'Number of successful companies',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#6b7280', fontSize: 11 },
              }}
            />

            <Tooltip
              cursor={{ fill: 'rgba(15, 23, 42, 0.8)' }}
              contentStyle={{
                backgroundColor: '#020617',
                border: '1px solid rgba(148, 163, 184, 0.5)',
                borderRadius: 10,
                padding: '10px 12px',
                boxShadow: '0 18px 45px rgba(15, 23, 42, 0.9)',
                fontSize: 11,
              }}
              labelStyle={{ color: '#e5e7eb', marginBottom: 4 }}
              itemStyle={{ color: '#e5e7eb' }}
            />

            <Legend
              verticalAlign="top"
              height={30}
              wrapperStyle={{
                paddingBottom: 4,
              }}
            />

            {/* STACKED BARS */}
            <Bar dataKey="20-40%" stackId="a" fill={categoryColors['20-40%']} name="20–40% growth" />
            <Bar dataKey="40-60%" stackId="a" fill={categoryColors['40-60%']} name="40–60% growth" />
            <Bar dataKey="60-80%" stackId="a" fill={categoryColors['60-80%']} name="60–80% growth" />
            <Bar dataKey="80-100%" stackId="a" fill={categoryColors['80-100%']} name="80–100% growth" />
            <Bar dataKey=">100%" stackId="a" fill={categoryColors['>100%']} name=">100% growth" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

export default StaggeredChart;