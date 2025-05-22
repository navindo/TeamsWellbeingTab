import React from 'react';
import './ResourcesTab.css';

export default function ResourcesTab() {
  return (
    <div className="resources-container">
      <h2 className="resources-title">🧘‍♀️ Well-being Resources</h2>

      <div className="resource-card">
        <h3>5-Minute Desk Meditation</h3>
        <p>Quick mindfulness to reset between meetings.</p>
        <a href="https://www.youtube.com/watch?v=inpok4MKVLM" target="_blank" rel="noreferrer">
          Watch on YouTube →
        </a>
      </div>

      <div className="resource-card">
        <h3>UBS Wellness Portal</h3>
        <p>Explore company-provided resources, EAP, and more.</p>
        <a href="https://www.ubs.com/global/en/our-firm/wellbeing.html" target="_blank" rel="noreferrer">
          Open UBS Portal →
        </a>
      </div>

      <div className="resource-card">
        <h3>Breathing Exercise</h3>
        <p>A guided visual tool to regulate your breath.</p>
        <a href="https://www.xhalr.com/" target="_blank" rel="noreferrer">
          Try Breathing Tool →
        </a>
      </div>
    </div>
  );
}
