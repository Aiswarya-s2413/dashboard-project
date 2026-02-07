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
  Cell
} from 'recharts';

const StaggeredSectorPerformance = ({ onNavigate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('average'); // 'average', 'sector'
  const [kpis, setKpis] = useState({
    bestSector: { name: '-', rate: 0 },
    worstSector: { name: '-', rate: 0 },
    bestMcap: { name: '-', rate: 0 },
    worstMcap: { name: '-', rate: 0 }
  });
  const chartContainerRef = useRef(null);

  const mcapColors = {
    'Mega': '#8b5cf6',  // Purple
    'Large': '#10b981', // Green
    'Mid': '#f59e0b',   // Amber
    'Small': '#ef4444'  // Red
  };

  useEffect(() => {
    setLoading(true);
    axios.get('https://dashboard.aiswaryasathyan.space/api/sector-performance/')
      .then(response => {
        let processedData = response.data.map(item => ({
          ...item,
          average: ((item.Mega || 0) + (item.Large || 0) + (item.Mid || 0) + (item.Small || 0)) / 4
        }));
        
        // Sort by average success rate by default
        processedData.sort((a, b) => b.average - a.average);
        
        // Calculate KPIs
        if (processedData.length > 0) {
          // Best and worst sectors (by average)
          const bestSector = processedData[0];
          const worstSector = processedData[processedData.length - 1];
          
          // Calculate average success rate per market cap across all sectors
          const mcapAverages = {};
          const mcapCategories = ['Mega', 'Large', 'Mid', 'Small'];
          
          mcapCategories.forEach(mcap => {
            const values = processedData
              .map(item => item[mcap] || 0)
              .filter(val => val > 0); // Only count sectors that have this mcap
            
            if (values.length > 0) {
              mcapAverages[mcap] = values.reduce((sum, val) => sum + val, 0) / values.length;
            }
          });
          
          // Find best and worst market cap
          const mcapEntries = Object.entries(mcapAverages).sort((a, b) => b[1] - a[1]);
          const bestMcap = mcapEntries[0];
          const worstMcap = mcapEntries[mcapEntries.length - 1];
          
          setKpis({
            bestSector: { name: bestSector.sector, rate: bestSector.average.toFixed(1) },
            worstSector: { name: worstSector.sector, rate: worstSector.average.toFixed(1) },
            bestMcap: { name: bestMcap[0], rate: bestMcap[1].toFixed(1) },
            worstMcap: { name: worstMcap[0], rate: worstMcap[1].toFixed(1) }
          });
        }
        
        setData(processedData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching sector performance:", err);
        setError("Error fetching data.");
        setLoading(false);
      });
  }, []);

  const handleSort = (type) => {
    setSortBy(type);
    const sorted = [...data];
    if (type === 'average') {
      sorted.sort((a, b) => b.average - a.average);
    } else {
      sorted.sort((a, b) => a.sector.localeCompare(b.sector));
    }
    setData(sorted);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ 
          backgroundColor: 'rgba(2, 6, 23, 0.95)', 
          border: '1px solid rgba(148, 163, 184, 0.5)', 
          borderRadius: '8px', 
          padding: '12px',
          minWidth: '200px'
        }}>
          <p style={{ color: '#e5e7eb', fontWeight: '600', marginBottom: '8px', fontSize: '13px' }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: entry.color, fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: entry.color, borderRadius: '50%', marginRight: '6px', display: 'inline-block' }}></span>
                {entry.name} Cap:
              </span>
              <span style={{ color: '#e5e7eb', fontWeight: '600', marginLeft: '12px', fontSize: '12px' }}>{entry.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Calculate dynamic height based on number of sectors
  const chartHeight = Math.max(600, data.length * 35);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden', backgroundColor: '#020617' }}>
      
      {/* HEADER SECTION with Navigation */}
      <div style={{ padding: '20px 24px', backgroundColor: 'rgba(15, 23, 42, 0.4)', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(12px)', position: 'relative', zIndex: 10 }}>
        <div style={{ flex: 1 }}>
           <h2 style={{ margin: 0, color: '#e5e7eb', fontSize: '18px', fontWeight: '600' }}>Sector Performance Analysis</h2>
           <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
             Fixed Parameters: 52 Weeks holding, 52 Weeks cooldown (Excluding Micro Cap)
           </div>
        </div>
        
        {/* Sort Controls */}
        <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
          <button 
            onClick={() => handleSort('average')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              border: sortBy === 'average' ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)', 
              backgroundColor: sortBy === 'average' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)', 
              color: sortBy === 'average' ? '#c4b5fd' : '#9ca3af', 
              fontSize: '12px', 
              fontWeight: '600', 
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            By Performance
          </button>
          <button 
            onClick={() => handleSort('sector')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              border: sortBy === 'sector' ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)', 
              backgroundColor: sortBy === 'sector' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)', 
              color: sortBy === 'sector' ? '#c4b5fd' : '#9ca3af', 
              fontSize: '12px', 
              fontWeight: '600', 
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Alphabetical
          </button>
        </div>
        
        <button 
          onClick={() => onNavigate('default')}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '8px', 
            border: '1px solid rgba(148, 163, 184, 0.3)', 
            backgroundColor: 'rgba(59, 130, 246, 0.2)', 
            color: '#93c5fd', 
            fontSize: '13px', 
            fontWeight: '600', 
            cursor: 'pointer', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap'
          }}
        >
          ← Back to Duration
        </button>
      </div>

      {/* KPI BOXES SECTION */}
      {!loading && !error && (
        <div style={{ padding: '20px 24px 0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            
            {/* Best Sector */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Best Sector
              </div>
              <div style={{ fontSize: '18px', color: '#10b981', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.bestSector.rate}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                {kpis.bestSector.name}
              </div>
            </div>

            {/* Worst Sector */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Worst Sector
              </div>
              <div style={{ fontSize: '18px', color: '#ef4444', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.worstSector.rate}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                {kpis.worstSector.name}
              </div>
            </div>

            {/* Best Market Cap */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Best Market Cap
              </div>
              <div style={{ fontSize: '18px', color: '#10b981', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.bestMcap.rate}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                {kpis.bestMcap.name} Cap
              </div>
            </div>

            {/* Worst Market Cap */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Worst Market Cap
              </div>
              <div style={{ fontSize: '18px', color: '#ef4444', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.worstMcap.rate}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                {kpis.worstMcap.name} Cap
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CHART SECTION */}
      <div style={{ flex: 1, minHeight: 0, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#9ca3af', fontSize: '14px' }}>
            Loading sector performance data...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#f87171', fontSize: '14px' }}>{error}</div>
        ) : (
          <div ref={chartContainerRef} style={{ width: '100%', minHeight: chartHeight }}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart 
                data={data} 
                layout="vertical"
                margin={{ top: 20, right: 40, left: 150, bottom: 20 }}
                barGap={2}
                barCategoryGap="15%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" horizontal={true} vertical={false} />
                <XAxis 
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: '#9ca3af', fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
                  label={{ value: 'Success Rate (%)', position: 'insideBottom', offset: -10, style: { fill: '#6b7280', fontSize: 12, fontWeight: '600' } }}
                />
                <YAxis 
                  type="category"
                  dataKey="sector" 
                  tick={{ fill: '#e5e7eb', fontSize: 11 }} 
                  tickLine={false} 
                  axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
                  width={140}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }} />
                <Legend 
                  verticalAlign="top" 
                  height={40}
                  iconType="circle"
                  formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '500' }}>{value} Cap</span>} 
                />
                <Bar dataKey="Mega" fill={mcapColors['Mega']} name="Mega" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Large" fill={mcapColors['Large']} name="Large" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Mid" fill={mcapColors['Mid']} name="Mid" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Small" fill={mcapColors['Small']} name="Small" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaggeredSectorPerformance;
