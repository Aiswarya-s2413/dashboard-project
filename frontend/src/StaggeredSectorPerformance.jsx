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
  Cell,
  LabelList,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';

const StaggeredSectorPerformance = ({ onNavigate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('average'); // 'average', 'sector'
  const [viewMode, setViewMode] = useState('chart'); // 'chart', 'table', 'sector_bubble', 'heatmap', 'trust_score'
  const [heatmapData, setHeatmapData] = useState([]);
  const [kpis, setKpis] = useState({

    bestSector: { name: '-', rate: 0 },
    worstSector: { name: '-', rate: 0 },
    bestMcap: { name: '-', rate: 0 },
    worstMcap: { name: '-', rate: 0 },
    overallConfidence: { score: 0, strength: '-', total: 0 },
    mostReliable: { name: '-', details: '-' },
    leastReliable: { name: '-', details: '-' }
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
        const apiData = response.data.data || [];
        const overallMetrics = {
          score: response.data.overall_confidence || 0,
          strength: response.data.relationship_strength || '-',
          total: response.data.total_samples || 0
        };

        let processedData = apiData.map(item => ({
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
            worstMcap: { name: worstMcap[0], rate: worstMcap[1].toFixed(1) },
            overallConfidence: overallMetrics,

            mostReliable: (() => {
              let max = { count: -1, sector: '', mcap: '' };
              processedData.forEach(s => {
                Object.entries(s.sample_counts || {}).forEach(([m, c]) => {
                  if (c > max.count) max = { count: c, sector: s.sector, mcap: m };
                });
              });
              return { name: `${max.sector} (${max.mcap})`, details: `${max.count} samples` };
            })(),
            leastReliable: (() => {
              let min = { count: Infinity, sector: '', mcap: '' };
              processedData.forEach(s => {
                Object.entries(s.sample_counts || {}).forEach(([m, c]) => {
                  if (c > 0 && c < min.count) min = { count: c, sector: s.sector, mcap: m };
                });
              });
              return min.count === Infinity ? { name: '-', details: '-' } : 
                     { name: `${min.sector} (${min.mcap})`, details: `${min.count} samples` };
            })()
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

    // Fetch Heatmap Data
    axios.get('https://dashboard.aiswaryasathyan.space/api/sector-duration/')
      .then(response => {
        setHeatmapData(response.data || []);
      })
      .catch(err => console.error("Error fetching heatmap data:", err));

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

  const downloadCSV = () => {
    const headers = ['Sector', 'Mega Performance', 'Mega Confidence', 'Large Performance', 'Large Confidence', 'Mid Performance', 'Mid Confidence', 'Small Performance', 'Small Confidence'];
    const rows = data.map(item => [
      item.sector,
      item.Mega, (item.confidence_scores?.Mega * 100).toFixed(0) + '%',
      item.Large, (item.confidence_scores?.Large * 100).toFixed(0) + '%',
      item.Mid, (item.confidence_scores?.Mid * 100).toFixed(0) + '%',
      item.Small, (item.confidence_scores?.Small * 100).toFixed(0) + '%'
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'sector_confidence_report.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
            <div key={index} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ color: entry.color, fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: entry.color, borderRadius: '50%', marginRight: '6px', display: 'inline-block' }}></span>
                  {entry.name} Cap:
                </span>
                <span style={{ color: '#e5e7eb', fontWeight: '600', marginLeft: '12px', fontSize: '12px' }}>{entry.value.toFixed(1)}%</span>
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '14px', display: 'flex', gap: '8px' }}>
                <span>Conf: {(entry.payload.confidence_scores?.[entry.name] * 100).toFixed(0)}%</span>
                <span>•</span>
                <span>{entry.payload.sample_counts?.[entry.name]} trades</span>
              </div>
            </div>
          ))}


          <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '11px', color: '#9ca3af' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Sector trades:</span>
              <span style={{ color: '#e5e7eb' }}>
                {payload[0]?.payload?.sample_counts ? 
                  Object.values(payload[0].payload.sample_counts).reduce((a, b) => a + b, 0) : 0}
              </span>
            </div>
          </div>

        </div>
      );

    }
    return null;
  };

  // Calculate dynamic height based on number of sectors
  const chartHeight = Math.max(600, data.length * 35);

  const renderSectorBubbleChart = () => {
    // 1. Transform data into flat list of bubbles
    const bubbleData = [];
    data.forEach(item => {
      ['Mega', 'Large', 'Mid', 'Small'].forEach(mcap => {
        if (item[mcap] > 0) { // Only show if success rate > 0 (or implies data exists)
           // Actually, we should check sample count to be sure
           const samples = item.sample_counts?.[mcap] || 0;
           if (samples > 0) {
             bubbleData.push({
               sector: item.sector,
               mcap: mcap,
               success_rate: item[mcap],
               samples: samples,
               avg_duration: item.avg_durations?.[mcap] || 0,
               fill: mcapColors[mcap]
             });
           }
        }
      });
    });

    return (
      <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: '16px' }}>Sector Performance Deep Dive</h3>
          <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '12px' }}>
            X-Axis: Success Rate (%). Y-Axis: Sector. Bubble Size: Sample Count. Text: Avg Duration (Weeks).
          </p>
        </div>
        
        <div style={{ height: chartHeight + 100, width: '100%', minHeight: '600px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 150 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={true} vertical={true} />
              <XAxis 
                type="number" 
                dataKey="success_rate" 
                name="Success Rate" 
                unit="%" 
                domain={[0, 100]}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                label={{ value: 'Success Rate (%)', position: 'insideBottom', offset: -10, style: { fill: '#6b7280', fontSize: 12 } }}
              />
              <YAxis 
                type="category" 
                dataKey="sector" 
                name="Sector" 
                width={140}
                tick={{ fill: '#e5e7eb', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
              />
              <ZAxis type="number" dataKey="samples" range={[100, 1000]} name="Samples" />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div style={{ backgroundColor: 'rgba(2, 6, 23, 0.95)', border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: '8px', padding: '12px' }}>
                        <p style={{ color: '#e5e7eb', fontWeight: '600', margin: '0 0 8px 0' }}>{d.sector} ({d.mcap})</p>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
                            <span>Success Rate:</span>
                            <span style={{ color: '#10b981', fontWeight: '600' }}>{d.success_rate.toFixed(1)}%</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
                            <span>Avg Duration:</span>
                            <span style={{ color: '#c4b5fd', fontWeight: '600' }}>{d.avg_duration.toFixed(1)}w</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                            <span>Sample Size:</span>
                            <span style={{ color: '#e5e7eb' }}>{d.samples}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend verticalAlign="top" height={40} />
              
              {/* We render 4 Scatters, one for each Mcap to maintain Legend/Color consistency */}
              {['Mega', 'Large', 'Mid', 'Small'].map(mcap => (
                 <Scatter 
                   key={mcap} 
                   name={`${mcap} Cap`} 
                   data={bubbleData.filter(d => d.mcap === mcap)} 
                   fill={mcapColors[mcap]}
                 >
                   <LabelList dataKey="avg_duration" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold', textShadow: '0px 0px 3px #000' }} formatter={(val) => Math.round(val) + 'w'} />
                 </Scatter>
              ))}

            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTrustChart = () => {
    // Transform data for stacked chart
    const trustData = data.map(item => ({
      sector: item.sector,
      Mega: (item.confidence_scores?.Mega || 0),
      Large: (item.confidence_scores?.Large || 0),
      Mid: (item.confidence_scores?.Mid || 0),
      Small: (item.confidence_scores?.Small || 0),
      // For tooltip display
      Mega_Raw: (item.confidence_scores?.Mega || 0).toFixed(2),
      Large_Raw: (item.confidence_scores?.Large || 0).toFixed(2),
      Mid_Raw: (item.confidence_scores?.Mid || 0).toFixed(2),
      Small_Raw: (item.confidence_scores?.Small || 0).toFixed(2),
    }));

    return (
      <div ref={chartContainerRef} style={{ width: '100%', minHeight: chartHeight }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart 
            data={trustData} 
            layout="vertical"
            margin={{ top: 20, right: 40, left: 150, bottom: 20 }}
            barGap={2}
            barCategoryGap="15%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" horizontal={true} vertical={false} />
            <XAxis 
              type="number"
              domain={[0, 4]} // Max possible score is 4 (1.0 * 4 caps)
              tick={{ fill: '#9ca3af', fontSize: 11 }} 
              tickLine={false} 
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
              label={{ value: 'Cumulative Trust Score (Max 4.0)', position: 'insideBottom', offset: -10, style: { fill: '#6b7280', fontSize: 12, fontWeight: '600' } }}
            />
            <YAxis 
              type="category"
              dataKey="sector" 
              tick={{ fill: '#e5e7eb', fontSize: 11 }} 
              tickLine={false} 
              axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
              width={140}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div style={{ backgroundColor: 'rgba(2, 6, 23, 0.95)', border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: '8px', padding: '12px' }}>
                      <p style={{ color: '#e5e7eb', fontWeight: '600', marginBottom: '8px', fontSize: '13px' }}>{label}</p>
                      {payload.reverse().map((entry, index) => (
                         <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '12px', marginBottom: '4px' }}>
                           <span style={{ color: entry.color }}>{entry.name}:</span>
                           <span style={{ color: '#e5e7eb', fontWeight: 'bold' }}>{entry.payload[entry.name + '_Raw']}</span>
                         </div>
                      ))}
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', color: '#9ca3af' }}>
                        Total Score: {payload.reduce((sum, p) => sum + (p.value || 0), 0).toFixed(2)} / 4.0
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign="top" 
              height={40}
              iconType="circle"
              formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '500' }}>{value} Cap Trust</span>} 
            />
            <Bar dataKey="Mega" stackId="a" fill={mcapColors['Mega']} name="Mega" />
            <Bar dataKey="Large" stackId="a" fill={mcapColors['Large']} name="Large" />
            <Bar dataKey="Mid" stackId="a" fill={mcapColors['Mid']} name="Mid" />
            <Bar dataKey="Small" stackId="a" fill={mcapColors['Small']} name="Small" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderHeatmap = () => {
    // Get unique durations and sectors
    const durations = [...new Set(heatmapData.map(d => d.duration))].sort((a,b) => a-b);
    const sectors = [...new Set(heatmapData.map(d => d.sector))].sort();

    // Create lookup map
    const lookup = {};
    heatmapData.forEach(d => {
      lookup[`${d.sector}-${d.duration}`] = d;
    });

    // Color scale helper
    const getCellColor = (rate) => {
      if (!rate && rate !== 0) return 'rgba(30, 41, 59, 0.5)'; // Empty
      if (rate >= 70) return 'rgba(16, 185, 129, 0.8)'; // High success
      if (rate >= 50) return 'rgba(52, 211, 153, 0.6)';
      if (rate >= 30) return 'rgba(251, 191, 36, 0.6)'; // Medium
      return 'rgba(239, 68, 68, 0.6)'; // Low
    };

    return (
      <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: '16px' }}>Sector Performance vs Duration Heatmap</h3>
          <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '12px' }}>
            Green: High Success Rate (&gt;70%). Red: Low Success Rate. Intensity indicates reliability.
          </p>
        </div>
        
        <div style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${durations.length}, 1fr)`, gap: '8px' }}>
             {/* Header Row */}
             <div style={{ padding: '12px', color: '#9ca3af', fontWeight: 'bold', fontSize: '12px' }}>Sector / Duration</div>
             {durations.map(d => (
               <div key={d} style={{ padding: '12px', textAlign: 'center', color: '#c4b5fd', fontWeight: 'bold', fontSize: '12px', backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px' }}>
                 {d} Weeks
               </div>
             ))}

             {/* Data Rows */}
             {sectors.map(sector => (
               <React.Fragment key={sector}>
                 <div style={{ padding: '12px', color: '#e5e7eb', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center' }}>
                   {sector}
                 </div>
                 {durations.map(duration => {
                   const dataPoint = lookup[`${sector}-${duration}`];
                   const rate = dataPoint ? dataPoint.success_rate : null;
                   
                   return (
                     <div 
                       key={`${sector}-${duration}`}
                       title={dataPoint ? `Success: ${rate}%\nSamples: ${dataPoint.sample_size}` : 'No Data'}
                       style={{ 
                         backgroundColor: getCellColor(rate),
                         borderRadius: '6px',
                         padding: '12px',
                         display: 'flex',
                         flexDirection: 'column',
                         justifyContent: 'center',
                         alignItems: 'center',
                         minHeight: '60px',
                         cursor: 'default',
                         transition: 'transform 0.2s',
                         border: '1px solid rgba(255,255,255,0.05)'
                       }}
                       onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                       onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                     >
                       {dataPoint ? (
                         <>
                           <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px', textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}>
                             {rate.toFixed(0)}%
                           </span>
                           <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', marginTop: '4px' }}>
                             {dataPoint.sample_size} trades
                           </span>
                         </>
                       ) : (
                         <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '12px' }}>-</span>
                       )}
                     </div>
                   );
                 })}
               </React.Fragment>
             ))}
          </div>
        </div>
      </div>
    );
  };

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
        
        {/* View Selection & Sort Controls */}
        <div style={{ display: 'flex', gap: '8px', marginRight: '16px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.2)', marginRight: '12px' }}>
            <button 
              onClick={() => setViewMode('chart')}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: 'none',
                backgroundColor: viewMode === 'chart' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', 
                color: viewMode === 'chart' ? '#c4b5fd' : '#6b7280', 
                fontSize: '11px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              CHART
            </button>
            <button 
              onClick={() => setViewMode('table')}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: 'none',
                backgroundColor: viewMode === 'table' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', 
                color: viewMode === 'table' ? '#c4b5fd' : '#6b7280', 
                fontSize: '11px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              TABLE
            </button>
            <button 
              onClick={() => setViewMode('sector_bubble')}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: 'none',
                backgroundColor: viewMode === 'sector_bubble' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', 
                color: viewMode === 'sector_bubble' ? '#c4b5fd' : '#6b7280', 
                fontSize: '11px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              SECTOR BUBBLE
            </button>
            <button 
              onClick={() => setViewMode('heatmap')}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: 'none',
                backgroundColor: viewMode === 'heatmap' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', 
                color: viewMode === 'heatmap' ? '#c4b5fd' : '#6b7280', 
                fontSize: '11px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              HEATMAP
            </button>
            <button 
              onClick={() => setViewMode('trust_score')}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: 'none',
                backgroundColor: viewMode === 'trust_score' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', 
                color: viewMode === 'trust_score' ? '#c4b5fd' : '#6b7280', 
                fontSize: '11px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              TRUST SCORE
            </button>
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(148, 163, 184, 0.2)', marginRight: '12px' }}></div>

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
            
            {/* Row 1 */}


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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginTop: '16px' }}>
            {/* Most Reliable */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.4)', 
              borderRadius: '12px', 
              padding: '12px 16px', 
              border: '1px solid rgba(148, 163, 184, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Most Reliable Data Point</div>
                <div style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: '600' }}>{kpis.mostReliable.name}</div>
              </div>
              <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>{kpis.mostReliable.details}</div>
            </div>

            {/* Least Reliable */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.4)', 
              borderRadius: '12px', 
              padding: '12px 16px', 
              border: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Least Reliable Data Point</div>
                <div style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: '600' }}>{kpis.leastReliable.name}</div>
              </div>
              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '700' }}>{kpis.leastReliable.details}</div>
            </div>
          </div>
        </div>
      )}


      <div style={{ flex: 1, minHeight: 0, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        
        {/* Confidence Legend */}
        {!loading && !error && (
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Confidence Hint:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#94a3b8', opacity: 1, borderRadius: '2px' }}></div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>High (30+ trades)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#94a3b8', opacity: 0.5, borderRadius: '2px' }}></div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Medium</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#94a3b8', opacity: 0.2, borderRadius: '2px' }}></div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Low (1-2 trades)</span>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#9ca3af', fontSize: '14px' }}>
            Loading sector performance data...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#f87171', fontSize: '14px' }}>{error}</div>
        ) : viewMode === 'sector_bubble' ? (
          renderSectorBubbleChart()
        ) : viewMode === 'heatmap' ? (
          renderHeatmap()
        ) : viewMode === 'trust_score' ? (
          renderTrustChart()
        ) : viewMode === 'table' ? (
          <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px', fontWeight: '600' }}>Confidence & Performance Matrix</span>
              <button 
                onClick={downloadCSV}
                style={{ 
                  padding: '6px 14px', 
                  borderRadius: '6px', 
                  border: '1px solid rgba(16, 185, 129, 0.4)', 
                  backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                  color: '#10b981', 
                  fontSize: '11px', 
                  fontWeight: '600', 
                  cursor: 'pointer' 
                }}
              >
                CSV Export
              </button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', zIndex: 5 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 20px', color: '#9ca3af', fontWeight: '600', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>Sector</th>
                    {['Mega', 'Large', 'Mid', 'Small'].map(mcap => (
                      <th key={mcap} style={{ textAlign: 'center', padding: '12px 20px', color: '#9ca3af', fontWeight: '600', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                        <div style={{ color: mcapColors[mcap], fontSize: '11px', textTransform: 'uppercase' }}>{mcap}</div>
                        <div style={{ fontSize: '10px', opacity: 0.7 }}>Perf / Conf</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(148, 163, 184, 0.02)' }}>
                      <td style={{ padding: '12px 20px', color: '#e5e7eb', fontWeight: '500' }}>{item.sector}</td>
                      {['Mega', 'Large', 'Mid', 'Small'].map(mcap => {
                        const score = item[mcap] || 0;
                        const conf = (item.confidence_scores?.[mcap] || 0) * 100;
                        const samples = item.sample_counts?.[mcap] || 0;
                        return (
                          <td key={mcap} style={{ padding: '12px 20px', textAlign: 'center' }}>
                            <div style={{ color: '#e5e7eb', fontWeight: '600', fontSize: '13px' }}>{score.toFixed(1)}%</div>
                            <div style={{ 
                              fontSize: '10px', 
                              color: conf >= 80 ? '#10b981' : conf >= 40 ? '#f59e0b' : '#ef4444',
                              marginTop: '2px',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>{conf.toFixed(0)}% trust</span>
                              <span style={{ opacity: 0.5 }}>({samples})</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                <Bar dataKey="Mega" fill={mcapColors['Mega']} name="Mega" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-mega-${index}`} fillOpacity={entry.confidence_scores?.Mega || 0.3} />
                  ))}
                </Bar>
                <Bar dataKey="Large" fill={mcapColors['Large']} name="Large" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-large-${index}`} fillOpacity={entry.confidence_scores?.Large || 0.3} />
                  ))}
                </Bar>
                <Bar dataKey="Mid" fill={mcapColors['Mid']} name="Mid" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-mid-${index}`} fillOpacity={entry.confidence_scores?.Mid || 0.3} />
                  ))}
                </Bar>
                <Bar dataKey="Small" fill={mcapColors['Small']} name="Small" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-small-${index}`} fillOpacity={entry.confidence_scores?.Small || 0.3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </div>

  );
};

export default StaggeredSectorPerformance;
