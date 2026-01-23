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

  if (loading) return <div style={{textAlign: 'center', marginTop: '50px'}}>Loading Chart...</div>;
  if (error) return <div style={{textAlign: 'center', marginTop: '50px', color: 'red'}}>{error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>Success Duration Analysis</h2>
      <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
        X-Axis: Duration (Weeks) | Y-Axis: Number of Successful Companies (&gt;=20% growth)
      </p>
      
      <div style={{ width: '100%', height: 600 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 40,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            
            {/* X-Axis: Duration */}
            <XAxis dataKey="duration">
                <Label value="Duration" offset={-10} position="insideBottom" />
            </XAxis>
            
            {/* Y-Axis: Count of companies */}
            <YAxis label={{ value: 'No. of Successes', angle: -90, position: 'insideLeft' }}/>
            
            <Tooltip cursor={{fill: 'transparent'}} />
            <Legend verticalAlign="top" height={36}/>
            
            {/* STACKED BARS: 
               stackId="a" ensures they stack on top of each other.
               We map through our known categories to create the bars.
            */}
            <Bar dataKey="20-40%" stackId="a" fill={categoryColors['20-40%']} name="20-40% Growth" />
            <Bar dataKey="40-60%" stackId="a" fill={categoryColors['40-60%']} name="40-60% Growth" />
            <Bar dataKey="60-80%" stackId="a" fill={categoryColors['60-80%']} name="60-80% Growth" />
            <Bar dataKey="80-100%" stackId="a" fill={categoryColors['80-100%']} name="80-100% Growth" />
            <Bar dataKey=">100%" stackId="a" fill={categoryColors['>100%']} name=">100% Growth" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StaggeredChart;