// src/App.jsx
import React from 'react';
import StaggeredChart from './StaggeredChart';

function App() {
  return (
    <div className="App">
      <div className="app-shell">
        <div className="app-shell-inner">
          <header className="app-header">
            <h1 className="app-title">Success Duration Analysis</h1>
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