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
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartHeight, setChartHeight] = useState(600);
  const chartContainerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  
  const [kpiData, setKpiData] = useState({
    total_samples: 0,
    most_profitable: { name: 'N/A', return: 0 },
    average_duration: 0,
    success_rate: 0
  });

  const [dateRange, setDateRange] = useState({
    min_date: null,
    max_date: null
  });

  // Filter State - Changed to null instead of empty strings
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    sector: 'All',
    mcap: 'All',
    cooldownWeeks: 52, 
    weeks: 52 
  });

  const categoryColors = {
    '20-40%': '#8884d8',
    '40-60%': '#82ca9d',
    '60-80%': '#ffc658',
    '80-100%': '#ff8042',
    '>100%': '#d0ed57'
  };

  // --- API CALLS ---

  // 1. Fetch Sectors once on mount
  useEffect(() => {
    axios.get('https://dashboard.aiswaryasathyan.space/api/sectors/')
      .then(response => {
        setSectors(['All', ...response.data]);
      })
      .catch(err => console.error("Error fetching sectors:", err));
  }, []);

  // 2. Update Date Range whenever Weeks or Cooldown changes
  useEffect(() => {
    axios.get('https://dashboard.aiswaryasathyan.space/api/date-range/', {
      params: { 
        cooldown_weeks: filters.cooldownWeeks,
        weeks: filters.weeks 
      }
    })
      .then(response => {
        const min = response.data.min_date;
        const max = response.data.max_date;
        
        console.log('Date range received:', { min, max });
        
        if (min && max) {
          setDateRange({ min_date: min, max_date: max });
          
          // Only set dates if they're not already set
          setFilters(prev => ({
            ...prev,
            startDate: prev.startDate || min,
            endDate: prev.endDate || max
          }));
          
          setInitialized(true);
        }
      })
      .catch(err => console.error("Error fetching date range:", err));
  }, [filters.cooldownWeeks, filters.weeks]);

  // 3. Fetch Chart and KPI Data - Only after initialization
  useEffect(() => {
    // Don't fetch until we have valid dates and are initialized
    if (!initialized || !filters.startDate || !filters.endDate) {
      console.log('Skipping fetch - not initialized yet or missing dates');
      return;
    }

    console.log('Fetching data with filters:', filters);
    
    setLoading(true);
    
    const params = {
      start_date: filters.startDate,
      end_date: filters.endDate,
      sector: filters.sector,
      mcap: filters.mcap,
      cooldown_weeks: filters.cooldownWeeks,
      weeks: filters.weeks
    };

    Promise.allSettled([
      axios.get('https://dashboard.aiswaryasathyan.space/api/chart-data/', { params }),
      axios.get('https://dashboard.aiswaryasathyan.space/api/kpi-data/', { params })
    ])
      .then(([chartResult, kpiResult]) => {
        if (chartResult.status === 'fulfilled') {
          console.log('Chart data received');
          setData(chartResult.value.data);
          setError(null);
        } else {
          console.error('Chart error:', chartResult.reason);
          setError("Could not load chart data.");
        }

        if (kpiResult.status === 'fulfilled') {
          const res = kpiResult.value.data;
          console.log('KPI data received:', res);
          setKpiData({
            total_samples: res.total_samples || 0,
            most_profitable: {
              name: res.most_profitable?.name || 'N/A',
              return: res.most_profitable?.return || 0
            },
            average_duration: res.average_duration || 0,
            success_rate: res.success_rate || 0
          });
        } else {
          console.error('KPI error:', kpiResult.reason);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setError("Error fetching data.");
        setLoading(false);
      });
  }, [initialized, filters.startDate, filters.endDate, filters.sector, filters.mcap, filters.cooldownWeeks, filters.weeks]);

  // --- UI LOGIC ---

  useEffect(() => {
    const updateHeight = () => {
      if (chartContainerRef.current) {
        const height = chartContainerRef.current.clientHeight;
        if (height > 0) setChartHeight(height);
      }
    };
    const timeoutId = setTimeout(updateHeight, 100);
    window.addEventListener('resize', updateHeight);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateHeight);
    };
  }, [loading, data]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFilters({ 
      startDate: dateRange.min_date, 
      endDate: dateRange.max_date, 
      sector: 'All', 
      mcap: 'All', 
      cooldownWeeks: 52,
      weeks: 52
    });
  };

  // --- STYLES ---

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#e5e7eb',
    fontSize: '13px',
    outline: 'none',
    minWidth: '130px',
    backdropFilter: 'blur(8px)'
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

  const weekOptions = [26, 52, 78, 104, 156, 208];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden', backgroundColor: '#020617' }}>
      
      {/* 1. FILTER BAR SECTION */}
      <div style={{ padding: '20px 24px', backgroundColor: 'rgba(15, 23, 42, 0.4)', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-end', backdropFilter: 'blur(12px)', position: 'relative', zIndex: 10 }}>
        
        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>Weeks</label>
          <select name="weeks" value={filters.weeks} onChange={handleFilterChange} style={inputStyle}>
            {weekOptions.map(wk => (
              <option key={wk} value={wk} style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>{wk} weeks</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>Cooldown</label>
          <select name="cooldownWeeks" value={filters.cooldownWeeks} onChange={handleFilterChange} style={inputStyle}>
            {Array.from({ length: 104 - 20 + 1 }, (_, i) => i + 20).map(week => (
              <option key={week} value={week} style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>{week} setting</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>From Date</label>
          <input 
            type="date" 
            name="startDate" 
            value={filters.startDate || ''} 
            min={dateRange.min_date || ''} 
            max={dateRange.max_date || ''} 
            onChange={handleFilterChange} 
            style={inputStyle} 
          />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>To Date</label>
          <input 
            type="date" 
            name="endDate" 
            value={filters.endDate || ''} 
            min={dateRange.min_date || ''} 
            max={dateRange.max_date || ''} 
            onChange={handleFilterChange} 
            style={inputStyle} 
          />
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>Sector</label>
          <select name="sector" value={filters.sector} onChange={handleFilterChange} style={inputStyle}>
            {sectors.map(sect => (
              <option key={sect} value={sect} style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>{sect}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <label style={labelStyle}>Market Cap</label>
          <select name="mcap" value={filters.mcap} onChange={handleFilterChange} style={inputStyle}>
            <option value="All" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>All Categories</option>
            <option value="Mega" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Mega Cap</option>
            <option value="Large" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Large Cap</option>
            <option value="Mid" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Mid Cap</option>
            <option value="Small" style={{ backgroundColor: '#020617', color: '#e5e7eb' }}>Small Cap</option>
          </select>
        </div>

        <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
          <button onClick={handleReset} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.3)', backgroundColor: 'rgba(15, 23, 42, 0.6)', color: '#9ca3af', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reset
          </button>
        </div>
      </div>

      {/* 2. KPI BOXES SECTION */}
      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', backgroundColor: 'rgba(15, 23, 42, 0.3)', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)' }}>
          <div style={labelStyle}>Total Samples</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#e5e7eb' }}>{kpiData.total_samples.toLocaleString()}</div>
        </div>
        <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)' }}>
          <div style={labelStyle}>Most Profitable</div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#e5e7eb', marginBottom: '4px' }}>{kpiData.most_profitable.name}</div>
          <div style={{ fontSize: '14px', color: '#82ca9d' }}>{kpiData.most_profitable.return}%</div>
        </div>
        <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)' }}>
          <div style={labelStyle}>Average Duration</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#e5e7eb' }}>{kpiData.average_duration}</div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>weeks</div>
        </div>
        <div style={{ padding: '16px 20px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', backdropFilter: 'blur(8px)' }}>
          <div style={labelStyle}>Average Return</div>
          <div style={{ fontSize: '24px', fontWeight: '600', color: '#82ca9d' }}>{kpiData.success_rate}%</div>
        </div>
      </div>

      {/* 3. CHART SECTION */}
      <div style={{ flex: 1, minHeight: 0, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#9ca3af', fontSize: '14px' }}>
            Loading data...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#f87171', fontSize: '14px' }}>{error}</div>
        ) : (
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%', flex: 1, minHeight: 400 }}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={data} margin={{ top: 10, right: 24, left: 4, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" vertical={false} />
                <XAxis dataKey="duration" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}>
                  <Label value="Holding duration (weeks)" offset={-20} position="insideBottom" style={{ fill: '#6b7280', fontSize: 11 }} />
                </XAxis>
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }} label={{ value: 'Successful Companies', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: 10, fontSize: 11 }} />
                <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '11px' }}>{value}</span>} />
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