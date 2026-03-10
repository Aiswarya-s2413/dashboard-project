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
  ZAxis,
  LineChart,
  Line
} from 'recharts';

const StaggeredSectorPerformance = ({ onNavigate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('average'); // 'average', 'sector'
  const [viewMode, setViewMode] = useState('mcap_graph'); // 'chart', 'table', 'sector_bubble', 'heatmap', 'nrb_heatmap', 'mcap_graph', 'trust_score'
  const [heatmapData, setHeatmapData] = useState([]);
  const [nrbHeatmapData, setNrbHeatmapData] = useState([]);
  const [successThreshold, setSuccessThreshold] = useState(20);
  const [minWinRate, setMinWinRate] = useState(0);
  const [showSuccessDef, setShowSuccessDef] = useState(false);
  const [showWinRateDef, setShowWinRateDef] = useState(false);
  const [kpis, setKpis] = useState({

    bestSector: { name: '-', rate: 0 },
    overallConfidence: { score: 0, strength: '-', total: 0 },
    mcapAverages: { 'Mega': 0, 'Large': 0, 'Mid': 0, 'Small': 0 },
    mostReliable: { name: '-', details: '-' },
    leastReliable: { name: '-', details: '-' }
  });

  const [selectedCell, setSelectedCell] = useState(null);
  const [cellTrades, setCellTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  const chartContainerRef = useRef(null);
  const successDefRef = useRef(null);
  const winRateDefRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (successDefRef.current && !successDefRef.current.contains(event.target)) {
        setShowSuccessDef(false);
      }
      if (winRateDefRef.current && !winRateDefRef.current.contains(event.target)) {
        setShowWinRateDef(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const mcapColors = {
    'Mega': '#8b5cf6',  // Purple
    'Large': '#10b981', // Green
    'Mid': '#f59e0b',   // Amber
    'Small': '#ef4444'  // Red
  };

  const handleCellClick = (sector, duration, rate, count) => {
    if (count === 0 || rate === null) return;
    setSelectedCell({ sector, duration, rate, count });
    setLoadingTrades(true);
    axios.get(`https://dashboard.aiswaryasathyan.space/api/sector-trades/?sector=${encodeURIComponent(sector)}&duration=${duration}&success_threshold=${successThreshold}`)
      .then(res => {
        setCellTrades(res.data || []);
      })
      .catch(err => console.error("Error fetching trades:", err))
      .finally(() => setLoadingTrades(false));
  };

  const handleNrbCellClick = (sector, duration, rate, count) => {
    if (count === 0 || rate === null) return;
    setSelectedCell({ sector, duration: `${duration} Weeks`, rate, count });
    setLoadingTrades(true);
    axios.get(`https://dashboard.aiswaryasathyan.space/api/sector-nrb-trades/?sector=${encodeURIComponent(sector)}&duration=${duration}&success_threshold=${successThreshold}`)
      .then(res => {
        setCellTrades(res.data || []);
      })
      .catch(err => console.error("Error fetching trades:", err))
      .finally(() => setLoadingTrades(false));
  };

  useEffect(() => {
    setLoading(true);
    axios.get(`https://dashboard.aiswaryasathyan.space/api/sector-performance/?success_threshold=${successThreshold}`)
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
          
          setKpis({
            bestSector: { name: bestSector.sector, rate: bestSector.average.toFixed(1) },
            mcapAverages: mcapAverages,
            overallConfidence: overallMetrics,
            
            validSamples: (() => {
              let count = 0;
              processedData.forEach(s => {
                Object.entries(s.sample_counts || {}).forEach(([m, c]) => {
                  if (s[m] !== undefined && s[m] > 0) { // Assuming if there's a non-zero success rate or sample data logged, it matches filters
                    count += c;
                  }
                });
              });
              return count;
            })(),

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
    axios.get(`https://dashboard.aiswaryasathyan.space/api/sector-duration/?success_threshold=${successThreshold}`)
      .then(response => {
        setHeatmapData(response.data || []);
      })
      .catch(err => console.error("Error fetching heatmap data:", err));

    // Fetch NRB Heatmap Data
    axios.get(`https://dashboard.aiswaryasathyan.space/api/sector-nrb-duration/?success_threshold=${successThreshold}`)
      .then(response => {
        setNrbHeatmapData(response.data || []);
      })
      .catch(err => console.error("Error fetching nrb heatmap data:", err));

  }, [successThreshold]);

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
      <div ref={chartContainerRef} style={{ width: '100%', minHeight: chartHeight + 100 }}>
        <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', border: '1px outset rgba(148, 163, 184, 0.2)'}}>
          <h4 style={{ margin: '0 0 8px 0', color: '#e5e7eb', fontSize: '15px', fontWeight: 'bold' }}>What is Trust Score?</h4>
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '13px', lineHeight: '1.6' }}>
            The <b>Trust Score</b> measures the overall reliability of a sector across different market cap sizes (Mega, Large, Mid, Small). It evaluates historical performance consistency (Win Rate) specifically combined with data availability (Sample Size). A higher cumulative score (up to a maximum of 4.0) means the sector consistently and predictably performs well across all market sizes without relying on lucky, low-sample trades.
          </p>
        </div>
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
      
      // Green Shades (Success)
      if (rate >= 90) return 'rgba(21, 128, 61, 0.9)';   // Deep Green
      if (rate >= 75) return 'rgba(22, 163, 74, 0.85)';  // Green
      if (rate >= 60) return 'rgba(101, 163, 13, 0.8)';  // Lime/Yellow-Green
      
      // Amber Shades (Mixed)
      if (rate >= 45) return 'rgba(202, 138, 4, 0.8)';   // Dark Yellow/Amber
      
      // Red Shades (Failure - Darker red = lower score)
      if (rate >= 30) return 'rgba(234, 88, 12, 0.8)';   // Orange-Red
      if (rate >= 15) return 'rgba(220, 38, 38, 0.85)';  // Red
      return 'rgba(153, 27, 27, 0.9)';                   // Deep Red (Lowest)
    };

    return (
      <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: '16px' }}>Sector Performance vs Holding Duration Heatmap</h3>
          <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '12px' }}>
            Scale: Deep Red (0%) &rarr; Red &rarr; Amber &rarr; Lime &rarr; Deep Green (100%).
          </p>
        </div>
        
        <div style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${durations.length}, 1fr)`, gap: '8px' }}>
             {/* Header Row */}
             <div style={{ padding: '12px', color: '#9ca3af', fontWeight: 'bold', fontSize: '12px' }}>Sector / Holding Duration</div>
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
                   const rawRate = dataPoint ? dataPoint.success_rate : null;
                   
                   const meetsThreshold = rawRate !== null && rawRate >= minWinRate;
                   const rate = meetsThreshold ? rawRate : null;
                   
                   return (
                     <div 
                       key={`${sector}-${duration}`}
                       title={meetsThreshold ? `Success: ${rate}%\nSamples: ${dataPoint.sample_size}` : 'No Data or Below Min Win Rate'}
                       style={{ 
                         backgroundColor: getCellColor(rate),
                         borderRadius: '6px',
                         padding: '12px',
                         display: 'flex',
                         flexDirection: 'column',
                         justifyContent: 'center',
                         alignItems: 'center',
                         minHeight: '60px',
                         cursor: dataPoint ? 'pointer' : 'default',
                         transition: 'transform 0.2s',
                         border: '1px solid rgba(255,255,255,0.05)'
                       }}
                       onClick={() => handleCellClick(sector, duration, rate, (meetsThreshold && dataPoint) ? dataPoint.sample_size : 0)}
                       onMouseEnter={(e) => { if (meetsThreshold) e.currentTarget.style.transform = 'scale(1.05)' }}
                       onMouseLeave={(e) => { if (meetsThreshold) e.currentTarget.style.transform = 'scale(1)' }}
                     >
                       {meetsThreshold ? (
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

  const renderNRBHeatmap = () => {
    if (nrbHeatmapData.length === 0) return <div style={{ color: '#9ca3af', padding: '24px' }}>No NRB data available to calculate heatmap.</div>;

    const nrbDurations = ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-100", "100-150", "150-200", "200-300", "300-500", ">500"];
    const sectors = [...new Set(nrbHeatmapData.map(d => d.sector))].sort();

    // Create lookup map
    const lookup = {};
    nrbHeatmapData.forEach(d => {
      lookup[`${d.sector}-${d.duration}`] = d;
    });

    const getCellColor = (rate) => {
      if (!rate && rate !== 0) return 'rgba(30, 41, 59, 0.5)'; // Empty
      
      if (rate >= 90) return 'rgba(21, 128, 61, 0.9)';   // Deep Green
      if (rate >= 75) return 'rgba(22, 163, 74, 0.85)';  // Green
      if (rate >= 60) return 'rgba(101, 163, 13, 0.8)';  // Lime/Yellow-Green
      
      if (rate >= 45) return 'rgba(202, 138, 4, 0.8)';   // Dark Yellow/Amber
      
      if (rate >= 30) return 'rgba(234, 88, 12, 0.8)';   // Orange-Red
      if (rate >= 15) return 'rgba(220, 38, 38, 0.85)';  // Red
      return 'rgba(153, 27, 27, 0.9)';                   // Deep Red (Lowest)
    };

    return (
      <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: '16px' }}>Sector Performance vs NRB Duration Heatmap</h3>
          <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '12px' }}>
            Scale: Deep Red (0%) &rarr; Red &rarr; Amber &rarr; Lime &rarr; Deep Green (100%).
          </p>
        </div>
        
        <div style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${nrbDurations.length}, 1fr)`, gap: '8px' }}>
             {/* Header Row */}
             <div style={{ padding: '12px', color: '#9ca3af', fontWeight: 'bold', fontSize: '12px' }}>Sector / NRB Duration</div>
             {nrbDurations.map(d => (
               <div key={d} style={{ padding: '12px', textAlign: 'center', color: '#c4b5fd', fontWeight: 'bold', fontSize: '12px', backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                 {d} Weeks
               </div>
             ))}

             {/* Data Rows */}
             {sectors.map(sector => (
               <React.Fragment key={sector}>
                 <div style={{ padding: '12px', color: '#e5e7eb', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center' }}>
                   {sector}
                 </div>
                 {nrbDurations.map(duration => {
                   const dataPoint = lookup[`${sector}-${duration}`];
                   const rawRate = dataPoint ? dataPoint.success_rate : null;
                   
                   const meetsThreshold = rawRate !== null && rawRate >= minWinRate;
                   const rate = meetsThreshold ? rawRate : null;
                   
                   return (
                     <div 
                       key={`${sector}-${duration}`}
                       title={meetsThreshold ? `Success: ${rate}%\nSamples: ${dataPoint.sample_size}` : 'No Data or Below Min Win Rate'}
                       style={{ 
                         backgroundColor: getCellColor(rate),
                         borderRadius: '6px',
                         padding: '12px',
                         display: 'flex',
                         flexDirection: 'column',
                         justifyContent: 'center',
                         alignItems: 'center',
                         minHeight: '60px',
                         cursor: (meetsThreshold && dataPoint) ? 'pointer' : 'default',
                         transition: 'transform 0.2s',
                         border: '1px solid rgba(255,255,255,0.05)'
                       }}
                       onClick={() => handleNrbCellClick(sector, duration, rate, (meetsThreshold && dataPoint) ? dataPoint.sample_size : 0)}
                       onMouseEnter={(e) => { if (meetsThreshold) e.currentTarget.style.transform = 'scale(1.05)' }}
                       onMouseLeave={(e) => { if (meetsThreshold) e.currentTarget.style.transform = 'scale(1)' }}
                     >
                       {meetsThreshold ? (
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

  const renderMcapGraph = () => {
    const scatterData = [];
    const mcaps = ['Mega', 'Large', 'Mid', 'Small'];
    const mcapIndex = { 'Mega': 1, 'Large': 2, 'Mid': 3, 'Small': 4 };
    
    let seed = 1;
    const stableRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    data.forEach((item) => {
      mcaps.forEach(mcap => {
        const count = item.sample_counts?.[mcap] || 0;
        if (count > 0) {
          const rate = item[mcap];
          const conf = (item.confidence_scores?.[mcap] || 0) * 100;
          
          let color = '#f59e0b'; // amber
          if (conf >= 80) color = '#10b981'; // green
          else if (conf < 40) color = '#ef4444'; // red

          // Add jitter to avoid perfect overlaps 
          const jitter = (stableRandom() - 0.5) * 0.5;

          scatterData.push({
            sector: item.sector,
            mcapName: mcap + ' Cap',
            x: mcapIndex[mcap] + jitter,
            rate: rate,
            samples: count,
            fill: color,
            conf: conf
          });
        }
      });
    });

    const CustomScatterTooltip = ({ active, payload }) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
          <div style={{ backgroundColor: 'rgba(2, 6, 23, 0.95)', border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: '8px', padding: '12px', minWidth: '180px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ color: '#e5e7eb', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid rgba(148,163,184,0.2)', paddingBottom: '4px' }}>
              {data.sector} <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>({data.mcapName})</span>
            </div>
            <div style={{ color: '#6ee7b7', fontSize: '12px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span>Success Rate:</span> <strong>{data.rate.toFixed(1)}%</strong>
            </div>
            <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span>Trades:</span> <strong>{data.samples}</strong>
            </div>
            <div style={{ color: data.fill, fontSize: '12px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span>Trust Score:</span> <strong>{data.conf.toFixed(0)}%</strong>
            </div>
          </div>
        );
      }
      return null;
    };

    return (
      <div style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: '16px' }}>Sector Distribution by Market Cap (52 Weeks)</h3>
          <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '12px' }}>
            A clustered scatter plot showing the distribution of sector success rates within each Market Cap tier. Bubble size indicates sample count, and color indicates trust level.
          </p>
        </div>
        
        <div style={{ width: '100%', height: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
              
              <XAxis 
                 type="number" 
                 dataKey="x" 
                 domain={[0.5, 4.5]}
                 ticks={[1, 2, 3, 4]}
                 tickFormatter={(val) => {
                   const labels = { 1: 'Mega Cap', 2: 'Large Cap', 3: 'Mid Cap', 4: 'Small Cap' };
                   return labels[val] || '';
                 }}
                 tick={{ fill: '#e5e7eb', fontSize: 13, fontWeight: 600 }} 
                 axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }} 
                 tickLine={false} 
                 dy={10}
              />
              
              <YAxis 
                 type="number" 
                 dataKey="rate" 
                 domain={[0, 100]} 
                 tick={{ fill: '#9ca3af', fontSize: 11 }}
                 axisLine={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
                 tickLine={false}
                 label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft', offset: 5, style: { fill: '#6b7280', fontSize: 12 } }}
              />
              
              <ZAxis 
                 type="number" 
                 dataKey="samples" 
                 range={[30, 600]} 
              />
              
              <Tooltip 
                 content={<CustomScatterTooltip />} 
                 cursor={{ strokeDasharray: '3 3', stroke: 'rgba(148,163,184,0.3)', strokeWidth: 1 }} 
              />
              
              <Legend 
                 wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} 
                 payload={[
                   { value: 'High Trust (≥80%)', type: 'circle', color: '#10b981' },
                   { value: 'Conviction (40-79%)', type: 'circle', color: '#f59e0b' },
                   { value: 'Low Trust (<40%)', type: 'circle', color: '#ef4444' }
                 ]}
              />
              
              <Scatter data={scatterData} opacity={0.85}>
                {scatterData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
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
           <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div ref={successDefRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
               <label style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '500', marginRight: '6px' }}>Success Rate Threshold:</label>
               <button 
                 onClick={() => setShowSuccessDef(!showSuccessDef)}
                 title="What is Success Rate?"
                 style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginRight: '6px' }}
               >
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
               </button>
               {showSuccessDef && (
                 <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0', width: '300px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 100 }}>
                    <div style={{ fontWeight: '700', marginBottom: '4px', color: '#f8fafc' }}>Success Rate</div>
                    The percentage of total generated predictions that successfully reached the selected target (WIN). Setting this higher filters out sectors with too many failures.
                 </div>
               )}
             </div>
             <select 
               value={successThreshold} 
               onChange={(e) => setSuccessThreshold(Number(e.target.value))}
               style={{ 
                 backgroundColor: 'rgba(15, 23, 42, 0.6)', 
                 color: '#e5e7eb', 
                 border: '1px solid rgba(148, 163, 184, 0.3)', 
                 borderRadius: '6px', 
                 padding: '8px 12px', 
                 fontSize: '14px',
                 outline: 'none',
                 cursor: 'pointer'
               }}
             >
               <option value={0}>&gt; 0%</option>
               <option value={10}>&gt;= 10%</option>
               <option value={15}>&gt;= 15%</option>
               <option value={20}>&gt;= 20%</option>
               <option value={25}>&gt;= 25%</option>
               <option value={30}>&gt;= 30%</option>
               <option value={40}>&gt;= 40%</option>
               <option value={50}>&gt;= 50%</option>
               <option value={60}>&gt;= 60%</option>
               <option value={70}>&gt;= 70%</option>
               <option value={80}>&gt;= 80%</option>
               <option value={90}>&gt;= 90%</option>
               <option value={100}>&gt;= 100%</option>
             </select>
             
            </div>
            
            {/* View Mode Filters */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(viewMode === 'heatmap' || viewMode === 'nrb_heatmap') && (
                <React.Fragment>
                  <div ref={winRateDefRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <label style={{ fontSize: '14px', color: '#9ca3af', fontWeight: '500', marginRight: '6px' }}>Min Win Rate:</label>
                    <button 
                      onClick={() => setShowWinRateDef(!showWinRateDef)}
                      title="What is Win Rate?"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginRight: '6px' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    {showWinRateDef && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0', width: '300px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', zIndex: 100 }}>
                        <div style={{ fontWeight: '700', marginBottom: '4px', color: '#f8fafc' }}>Win Rate</div>
                        The ratio of profitable trades over the total number of trades taken. A high win rate indicates fewer false breakouts and highly reliable performance.
                      </div>
                    )}
                  </div>
                  <select 
                    value={minWinRate} 
                    onChange={(e) => setMinWinRate(Number(e.target.value))}
                    style={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.6)', 
                      color: '#e5e7eb', 
                      border: '1px solid rgba(148, 163, 184, 0.3)', 
                      borderRadius: '6px', 
                      padding: '8px 12px', 
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={0}>Any</option>
                    <option value={10}>&ge; 10%</option>
                    <option value={20}>&ge; 20%</option>
                    <option value={30}>&ge; 30%</option>
                    <option value={40}>&ge; 40%</option>
                    <option value={50}>&ge; 50%</option>
                    <option value={60}>&ge; 60%</option>
                    <option value={70}>&ge; 70%</option>
                    <option value={80}>&ge; 80%</option>
                    <option value={90}>&ge; 90%</option>
                  </select>
                </React.Fragment>
              )}
            </div>
         </div>
        
        {/* View Selection & Sort Controls */}
        <div style={{ display: 'flex', gap: '8px', marginRight: '16px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.2)', marginRight: '12px' }}>
            {/*
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
            */}
            <button 
              onClick={() => setViewMode('mcap_graph')}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: 'none',
                backgroundColor: viewMode === 'mcap_graph' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', 
                color: viewMode === 'mcap_graph' ? '#c4b5fd' : '#6b7280', 
                fontSize: '11px', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              MCAP GRAPH
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
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              HLD HEATMAP
            </button>
            <button 
              onClick={() => setViewMode('nrb_heatmap')}
              style={{ 
                padding: '6px 12px', 
                borderRadius: '6px', 
                border: 'none',
                backgroundColor: viewMode === 'nrb_heatmap' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', 
                color: viewMode === 'nrb_heatmap' ? '#c4b5fd' : '#6b7280', 
                fontSize: '11px', 
                fontWeight: '600', 
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              NRB HEATMAP
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            
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

            {/* Total Samples */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(59, 130, 246, 0.3)',
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Total Samples
              </div>
              <div style={{ fontSize: '18px', color: '#3b82f6', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.validSamples?.toLocaleString() || 0} / {kpis.overallConfidence?.total?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                Matching / Total Samples
              </div>
            </div>

            {/* Mega Cap */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(139, 92, 246, 0.3)', // Purple
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Mega Cap
              </div>
              <div style={{ fontSize: '18px', color: '#8b5cf6', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.mcapAverages?.Mega?.toFixed(1) || 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                Avg Success
              </div>
            </div>

            {/* Large Cap */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(16, 185, 129, 0.3)', // Green
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Large Cap
              </div>
              <div style={{ fontSize: '18px', color: '#10b981', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.mcapAverages?.Large?.toFixed(1) || 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                Avg Success
              </div>
            </div>

            {/* Mid Cap */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(245, 158, 11, 0.3)', // Amber
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Mid Cap
              </div>
              <div style={{ fontSize: '18px', color: '#f59e0b', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.mcapAverages?.Mid?.toFixed(1) || 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                Avg Success
              </div>
            </div>

            {/* Small Cap */}
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '12px', 
              padding: '16px', 
              border: '1px solid rgba(239, 68, 68, 0.3)', // Red
              backdropFilter: 'blur(12px)'
            }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: '600' }}>
                Small Cap
              </div>
              <div style={{ fontSize: '18px', color: '#ef4444', fontWeight: '700', marginBottom: '4px' }}>
                {kpis.mcapAverages?.Small?.toFixed(1) || 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#e5e7eb', fontWeight: '500' }}>
                Avg Success
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
        ) : viewMode === 'mcap_graph' ? (
          renderMcapGraph()
        ) : viewMode === 'nrb_heatmap' ? (
          renderNRBHeatmap()
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
      
      {/* TRADE LIST MODAL */}
      {selectedCell && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: '18px' }}>Trade History</h3>
                <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '13px' }}>
                  {selectedCell.sector} <span style={{ color: '#6366f1' }}>•</span> {selectedCell.duration} Weeks Holding
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase' }}>Win Rate</div>
                    <div style={{ color: '#10b981', fontSize: '15px', fontWeight: 'bold' }}>{selectedCell.rate.toFixed(1)}%</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase' }}>Trades</div>
                    <div style={{ color: '#e5e7eb', fontSize: '15px', fontWeight: 'bold' }}>{selectedCell.count}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCell(null)}
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '24px', padding: '0 8px' }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {loadingTrades ? (
                <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>Loading trades...</div>
              ) : cellTrades.length === 0 ? (
                <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>No trades found.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)', color: '#9ca3af' }}>
                      <th style={{ padding: '10px 8px', fontWeight: '500' }}>Symbol</th>
                      <th style={{ padding: '10px 8px', fontWeight: '500' }}>Breakout Date</th>
                      <th style={{ padding: '10px 8px', fontWeight: '500' }}>Market Cap</th>
                      <th style={{ padding: '10px 8px', fontWeight: '500', textAlign: 'right' }}>12M Return</th>
                      <th style={{ padding: '10px 8px', fontWeight: '500', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cellTrades.filter(trade => trade.return_percentage !== 0).map((trade, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)', color: '#e5e7eb' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontWeight: '600' }}>{trade.symbol}</span>
                        </td>
                        <td style={{ padding: '12px 8px', color: '#9ca3af' }}>{trade.breakout_date}</td>
                        <td style={{ padding: '12px 8px' }}>{trade.mcap_category} Cap</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '500', color: trade.return_percentage >= 0 ? '#10b981' : '#ef4444' }}>
                          {trade.return_percentage > 0 ? '+' : ''}{trade.return_percentage.toFixed(2)}%
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {trade.successful ? (
                            <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>WIN</span>
                          ) : (
                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>LOSS</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      )}

    </div>

  );
};

export default StaggeredSectorPerformance;
