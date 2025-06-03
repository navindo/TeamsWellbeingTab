import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SettingsTab from './SettingsTab';
import ResourcesTab from './ResourcesTab';
import HistoryTab from './HistoryTab';
import { app as teamsApp } from '@microsoft/teams-js';

export default function App() {
  const [isInTeams, setIsInTeams] = useState(true);

  useEffect(() => {
    teamsApp.initialize()
      .then(() => teamsApp.getContext())
      .catch(() => setIsInTeams(false));
  }, []);

  if (!isInTeams) {
    return (
      <div style={{ padding: '2rem', fontSize: '1.2rem', color: 'darkred' }}>
        ⚠️ This app must be opened inside Microsoft Teams.<br />
        Please open the Wellbeing app from the Teams sidebar.
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/alerts" element={<SettingsTab />} />
        <Route path="/resources" element={<ResourcesTab />} />
        <Route path="/history" element={<HistoryTab />} />
        <Route path="*" element={<SettingsTab />} />
      </Routes>
    </BrowserRouter>
  );
}
