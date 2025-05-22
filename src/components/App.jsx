import React, { useState } from 'react';
import SettingsTab from './SettingsTab';
import ResourcesTab from './ResourcesTab';
import HistoryTab from './HistoryTab';
import './App.css'; // Include the stylesheet

export default function App() {
  const [activeTab, setActiveTab] = useState('settings');

  const renderTab = () => {
    switch (activeTab) {
      case 'settings':
        return <SettingsTab />;
      case 'resources':
        return <ResourcesTab />;
      case 'history':
        return <HistoryTab />;
      default:
        return <SettingsTab />;
    }
  };

  return (
    <div>
      <header className="app-header">
        <div className="header-inner">
          <img src="/logo.png" alt="UBS Logo" className="header-logo" />
          <h1 className="header-title">Well-being Hub</h1>
        </div>
        <nav className="app-nav">
          <button
            className={activeTab === 'settings' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('settings')}
          >
            My Alerts
          </button>
          <button
            className={activeTab === 'resources' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('resources')}
          >
            Well-being Resources
          </button>
          <button
            className={activeTab === 'history' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </nav>
      </header>
      <main className="app-main">{renderTab()}</main>
    </div>
  );
}
