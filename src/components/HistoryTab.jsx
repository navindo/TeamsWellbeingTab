import React, { useEffect, useState } from 'react';
import './HistoryTab.css';

export default function HistoryTab() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory([
      { time: '2025-05-20T21:45:00Z', type: 'Alert Sent', status: 'Delivered' },
      { time: '2025-05-21T11:15:00Z', type: 'Suppressed', status: 'Snoozed' },
      { time: '2025-05-21T14:05:00Z', type: 'Alert Sent', status: 'Delivered' },
    ]);
  }, []);

  return (
    <div className="history-container">
      <h2 className="history-title">📊 Notification History</h2>

      <div className="history-table">
        <div className="table-header">
          <span className="col-time">Time</span>
          <span className="col-type">Type</span>
          <span className="col-status">Status</span>
        </div>
        {history.map((entry, index) => (
          <div key={index} className="table-row">
            <span className="col-time">{formatDateTime(entry.time)}</span>
            <span className="col-type">{entry.type}</span>
            <span className="col-status" style={{ color: getStatusColor(entry.status) }}>
              {entry.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateTime(datetime) {
  const date = new Date(datetime);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusColor(status) {
  switch (status) {
    case 'Delivered':
      return '#0c7b28';
    case 'Snoozed':
      return '#e0001b';
    default:
      return '#555';
  }
}
