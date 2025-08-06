import React, { useState, useEffect } from "react";
import * as microsoftTeams from "@microsoft/teams-js";
import "./SettingsTab.css";

export default function SettingsTab() {
  const [objectId, setObjectId] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dndFrom, setDndFrom] = useState("22:00");
  const [dndTo, setDndTo] = useState("07:00");
  const [snoozedUntil, setSnoozedUntil] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toggleLoading, setToggleLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    microsoftTeams.app
      .initialize()
      .then(() => microsoftTeams.app.getContext())
      .then((context) => {
        const id = context.user?.aadObjectId;
        setObjectId(id);

        if (id) {
          fetch(`https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net/api/user/settings?objectId=${id}`)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((data) => {
              setNotificationsEnabled(data.notificationsEnabled);
              setSnoozedUntil(data.snoozedUntilUtc);
              setDndFrom(data.dndStart || "22:00");
              setDndTo(data.dndEnd || "07:00");
            })
            .catch((err) => {
              console.error("Failed to fetch settings:", err);
              showToastMessage("Failed to load settings.");
            });
        }
      })
      .catch((err) => console.error("Teams SDK error:", err));
  }, []);

  const showToastMessage = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const updateSettings = async (newSettings) => {
    if (!objectId) return;

    const payload = {
      objectId,
      notificationsEnabled,
      snoozedUntilUtc: snoozedUntil,
      dndStart: dndFrom,
      dndEnd: dndTo,
      ...newSettings,
    };

    const res = await fetch("https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  };

  const handleToggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setToggleLoading(true);

    try {
      await updateSettings({ notificationsEnabled: newValue });
      setNotificationsEnabled(newValue);
      showToastMessage("Notification setting updated.");
    } catch (err) {
      console.error("Update failed:", err);
      showToastMessage("Failed to update.");
    }

    setToggleLoading(false);
  };

  const handleSnooze = async (hours) => {
    const snoozeTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    setSnoozedUntil(snoozeTime);
    try {
      await updateSettings({ snoozedUntilUtc: snoozeTime });
      showToastMessage(`Snoozed for ${hours}h.`);
    } catch {
      showToastMessage("Snooze failed.");
    }
  };

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      await updateSettings({});
      showToastMessage("Saved.");
    } catch (err) {
      console.error("Save error:", err);
      showToastMessage("Save failed.");
    }
    setSaveLoading(false);
  };

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="settings-container">
      <h2 className="settings-title">🔔 My Alert Settings</h2>

      <div className="card">
        <h3>Notifications</h3>
        <p>Toggle all alerts on or off.</p>
        <button
          className={`toggle-button ${notificationsEnabled ? "on" : "off"}`}
          onClick={handleToggleNotifications}
          disabled={toggleLoading}
        >
          {toggleLoading ? "Updating..." : notificationsEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="card">
        <h3>Do Not Disturb</h3>
        <p>Set quiet hours to suppress alerts automatically.</p>
        <div className="time-selectors">
          <select value={dndFrom} onChange={(e) => setDndFrom(e.target.value)}>
            {generateTimeOptions()}
          </select>
          <span>to</span>
          <select value={dndTo} onChange={(e) => setDndTo(e.target.value)}>
            {generateTimeOptions()}
          </select>
        </div>
        <button className="save-button" onClick={handleSave} disabled={saveLoading}>
          {saveLoading ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="card">
        <h3>Snooze Alerts</h3>
        <p>Pause notifications temporarily.</p>
        <div className="snooze-buttons">
          <button onClick={() => handleSnooze(1)}>1h</button>
          <button onClick={() => handleSnooze(4)}>4h</button>
          <button onClick={() => handleSnooze(24)}>24h</button>
        </div>
        {snoozedUntil && (
          <p className="info-text">Snoozed until: {formatDateTime(snoozedUntil)}</p>
        )}
      </div>

      {showToast && <div className="toast">{toastMessage}</div>}
    </div>
  );
}

function generateTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    const value = `${h.toString().padStart(2, "0")}:00`;
    options.push(
      <option value={value} key={value}>
        {value}
      </option>
    );
  }
  return options;
}
