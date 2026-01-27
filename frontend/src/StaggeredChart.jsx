// src/StaggeredChart.jsx
import React, { useEffect, useState, useRef } from 'react';
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
  // --- STATE MANAGEMENT ---
  const [data, setData] = useState([]);
  const [sectors, setSectors] = useState([]); // List of sectors from backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartHeight, setChartHeight] = useState(600); // Default height
  const chartContainerRef = useRef(null);
  const [kpiData, setKpiData] = useState({
    total_samples: 0,
    most_profitable: { name: 'N/A', return: 0 },
    average_duration: 0,
    success_rate: 0
  });

  // Filter State
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sector: 'All',
    mcap: 'All'
  });

  // Define colors for your success categories (Your original colors)
  const categoryColors = {
    '20-40%': '#8884d8',  // Purple
    '40-60%': '#82ca9d',  // Green
    '60-80%': '#ffc658',  // Yellow
    '80-100%': '#ff8042', // Orange
    '>100%': '#d0ed57'    // Lime
  };

  // --- API CALLS ---

  // 1. Fetch Sector List (Run once on mount)
  useEffect(() => {
    // Assuming the sector endpoint is relative to your base URL
    axios.get('http://dashboard.aiswaryasathyan.space/api/sectors/')
      .then(response => {
        setSectors(['All', ...response.data]);
      })
      .catch(err => console.error("Error fetching sectors:", err));
  }, []);

  // 2. Fetch Chart Data and KPI Data (Run whenever filters change)
  useEffect(() => {
    setLoading(true);
    
    // map state to backend query params
    const params = {
      start_date: filters.startDate,
      end_date: filters.endDate,
      sector: filters.sector,
      mcap: filters.mcap
    };

    // Fetch chart data and KPI data in parallel
    Promise.allSettled([
      axios.get('https://dashboard.aiswaryasathyan.space/api/chart-data/', { params }),
      axios.get('https://dashboard.aiswaryasathyan.space/api/kpi-data/', { params })
    ])
      .then(([chartResult, kpiResult]) => {
        // Handle chart data
        let chartData = [];
        if (chartResult.status === 'fulfilled') {
          chartData = chartResult.value.data;
          setData(chartData);
        } else {
          console.error("Error fetching chart data:", chartResult.reason);
          setError("Could not load chart data. Ensure Backend is running.");
        }

        // Handle KPI data (optional - don't break if it fails)
        if (kpiResult.status === 'fulfilled') {
          const kpiResponse = kpiResult.value.data;
          console.log("KPI data received:", kpiResponse);
          // Verify the data structure
          if (kpiResponse && typeof kpiResponse === 'object') {
            setKpiData({
              total_samples: kpiResponse.total_samples || 0,
              most_profitable: kpiResponse.most_profitable || { name: 'N/A', return: 0 },
              average_duration: kpiResponse.average_duration || 0,
              success_rate: kpiResponse.success_rate || 0
            });
          } else {
            console.warn("Invalid KPI data structure, using fallback");
            calculateKPIsFromChartData(chartData);
          }
        } else {
          console.warn("KPI endpoint not available:", kpiResult.reason?.response?.status);
          console.warn("KPI error details:", kpiResult.reason);
          // Calculate KPIs from chart data as fallback
          calculateKPIsFromChartData(chartData);
        }

        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError("Could not load data. Ensure Backend is running.");
        setLoading(false);
      });
  }, [filters]); // Re-run when 'filters' state changes

  // 3. Calculate chart container height
  useEffect(() => {
    const updateHeight = () => {
      if (chartContainerRef.current) {
        const height = chartContainerRef.current.clientHeight;
        if (height > 0) {
          setChartHeight(height);
        }
      }
    };

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(updateHeight, 100);
    window.addEventListener('resize', updateHeight);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateHeight);
    };
  }, [loading, error, data]); // Recalculate when loading/error/data changes

  // --- HANDLERS ---
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Calculate KPIs from chart data as fallback
  const calculateKPIsFromChartData = (chartData) => {
    if (!chartData || chartData.length === 0) {
      setKpiData({
        total_samples: 0,
        most_profitable: { name: 'N/A', return: 0 },
        average_duration: 0,
        success_rate: 0
      });
      return;
    }

    // Calculate total samples (sum of all bars)
    const totalSamples = chartData.reduce((sum, item) => {
      return sum + (item['20-40%'] || 0) + (item['40-60%'] || 0) + 
             (item['60-80%'] || 0) + (item['80-100%'] || 0) + (item['>100%'] || 0);
    }, 0);

    // Calculate average duration (weighted by count)
    let totalWeightedDuration = 0;
    chartData.forEach(item => {
      const count = (item['20-40%'] || 0) + (item['40-60%'] || 0) + 
                    (item['60-80%'] || 0) + (item['80-100%'] || 0) + (item['>100%'] || 0);
      totalWeightedDuration += item.duration * count;
    });
    const avgDuration = totalSamples > 0 ? (totalWeightedDuration / totalSamples).toFixed(1) : 0;

    // Average return - we can't calculate this accurately from chart data alone
    // since chart only shows successful companies, so we'll estimate or show 0
    const avgReturn = 0; // Can't calculate from grouped chart data

    // We can't determine most profitable from chart data alone, so keep default
    setKpiData({
      total_samples: totalSamples,
      most_profitable: { name: 'N/A', return: 0 },
      average_duration: parseFloat(avgDuration),
      success_rate: avgReturn // Average return percentage
    });
  };

  // --- STYLES ---
  // Dark theme styles for filter inputs
  const inputStyle = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#e5e7eb',
    fontSize: '13px',
    outline: 'none',
    minWidth: '150px',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(8px)'
  };

  const inputHoverStyle = {
    ...inputStyle,
    border: '1px solid rgba(148, 163, 184, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)'
  };

  const labelStyle = {
    fontSize: '11px', 
    fontWeight: '600', 
    color: '#9ca3af',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: '6px',
    display: 'block'
  };

  // --- RENDER ---

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      width: '100%',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      
      {/* 1. FILTER BAR SECTION */}
      <div style={{ 
        padding: '20px 24px', 
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        backdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Date Filters */}
        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>From Date</label>
          <input 
            type="date" 
            name="startDate" 
            value={filters.startDate} 
            onChange={handleFilterChange} 
            style={inputStyle}
            onMouseEnter={(e) => Object.assign(e.target.style, inputHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.target.style, inputStyle)}
          />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>To Date</label>
          <input 
            type="date" 
            name="endDate" 
            value={filters.endDate} 
            onChange={handleFilterChange} 
            style={inputStyle}
            onMouseEnter={(e) => Object.assign(e.target.style, inputHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.target.style, inputStyle)}
          />
        </div>

        {/* Sector Dropdown */}
        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>Sector</label>
          <select 
            name="sector" 
            value={filters.sector} 
            onChange={handleFilterChange} 
            style={inputStyle}
            onMouseEnter={(e) => Object.assign(e.target.style, inputHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.target.style, inputStyle)}
          >
            {sectors.map(sect => (
              <option key={sect} value={sect} style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>{sect}</option>
            ))}
          </select>
        </div>

        {/* Market Cap Dropdown */}
        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>Market Cap</label>
          <select 
            name="mcap" 
            value={filters.mcap} 
            onChange={handleFilterChange} 
            style={inputStyle}
            onMouseEnter={(e) => Object.assign(e.target.style, inputHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.target.style, inputStyle)}
          >
            <option value="All" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>All Categories</option>
            <option value="Mega" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Mega Cap</option>
            <option value="Large" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Large Cap</option>
            <option value="Mid" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Mid Cap</option>
            <option value="Small" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Small Cap</option>
          </select>
        </div>

        {/* Reset Button */}
        <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
          <button 
            onClick={() => setFilters({ startDate: '', endDate: '', sector: 'All', mcap: 'All' })}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              color: '#9ca3af',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
            onMouseEnter={(e) => {
              e.target.style.border = '1px solid rgba(148, 163, 184, 0.5)';
              e.target.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
              e.target.style.color = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.target.style.border = '1px solid rgba(148, 163, 184, 0.3)';
              e.target.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
              e.target.style.color = '#9ca3af';
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* 2. KPI BOXES SECTION */}
      <div style={{
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
      }}>
        {/* Total Samples */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Total Samples
          </div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#e5e7eb' }}>
            {kpiData.total_samples.toLocaleString()}
          </div>
        </div>

        {/* Most Profitable */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Most Profitable
          </div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#e5e7eb', marginBottom: '4px' }}>
            {kpiData.most_profitable.name}
          </div>
          <div style={{ fontSize: '14px', color: '#82ca9d' }}>
            {kpiData.most_profitable.return}%
          </div>
        </div>

        {/* Average Duration */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Average Duration
          </div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#e5e7eb' }}>
            {kpiData.average_duration}
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            weeks
          </div>
        </div>

        {/* Average Return Rate */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Average Return
          </div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#82ca9d' }}>
            {kpiData.success_rate}%
          </div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            12-month average
          </div>
        </div>
      </div>

      {/* 3. CHART SECTION */}
      <div style={{ flex: 1, minHeight: 0, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {loading && (
          <div className="status-message" style={{ 
            textAlign: 'center', 
            marginTop: '50px', 
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            Loading chart data...
          </div>
        )}

        {error && (
          <div className="status-message" style={{ 
            textAlign: 'center', 
            marginTop: '50px', 
            color: '#f87171',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <div 
            ref={chartContainerRef}
            style={{ width: '100%', height: '100%', flex: 1, minHeight: 400 }}
          >
            <ResponsiveContainer width="100%" height={chartHeight}>
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
                height={36}
                wrapperStyle={{
                  paddingBottom: 8,
                }}
                iconType="square"
                formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '11px' }}>{value}</span>}
              />

              <Bar dataKey="20-40%" stackId="a" fill={categoryColors['20-40%']} name="20–40% growth" />
              <Bar dataKey="40-60%" stackId="a" fill={categoryColors['40-60%']} name="40–60% growth" />
              <Bar dataKey="60-80%" stackId="a" fill={categoryColors['60-80%']} name="60–80% growth" />
              <Bar dataKey="80-100%" stackId="a" fill={categoryColors['80-100%']} name="80–100% growth" />
              <Bar dataKey=">100%" stackId="a" fill={categoryColors['>100%']} name=">100% growth" />
            </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaggeredChart;