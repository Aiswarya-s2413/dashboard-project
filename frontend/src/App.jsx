// src/App.jsx
import React from 'react';
import StaggeredChart from './StaggeredChart';

function App() {
  return (
    <div className="App">
      <div className="app-shell">
        <div className="app-shell-inner">
          <header className="app-header">
            <div className="app-title-block">
              <div className="app-eyebrow">GROWTH ANALYTICS</div>
              <div className="app-title-row">
                <h1 className="app-title">Success Duration Analysis</h1>
                <span className="app-pill">Dark mode dashboard</span>
              </div>
              <p className="app-subtitle">
                Distribution of companies achieving at least 20% 12‑month growth, segmented by holding duration.
              </p>
              <div className="app-meta">
                <span>Updated from NRB_Without_MicroCap.xlsx</span>
                <span className="app-meta-dot" />
                <span>Backend: Django · Frontend: React &amp; Recharts</span>
              </div>
            </div>

            <div className="app-kpi">
              <span className="app-kpi-value">&ge; 20%</span>
              <span className="app-kpi-label">12‑month return threshold</span>
            </div>
          </header>

          <main className="app-main">
            <div className="chart-card">
              <div className="chart-card-inner">
                <StaggeredChart />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;