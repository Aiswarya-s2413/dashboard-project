// src/App.jsx
import React, { useState } from 'react';
import StaggeredChart from './StaggeredChart';
import StaggeredSectorPerformance from './StaggeredSectorPerformance';

function App() {
  const [currentView, setCurrentView] = useState('default'); // 'default' or 'sector-performance'

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  return (
    <div className="App">
      <div className="app-shell">
        <div className="app-shell-inner">
          <header className="app-header">
            <h1 className="app-title">
              {currentView === 'default' ? 'Success Duration Analysis' : 'Sector Performance Analysis'}
            </h1>
          </header>

          <main className="app-main">
            <div className="chart-card">
              <div className="chart-card-inner">
                {currentView === 'default' ? (
                  <StaggeredChart onNavigate={() => handleNavigate('sector-performance')} />
                ) : (
                  <StaggeredSectorPerformance onNavigate={() => handleNavigate('default')} />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;