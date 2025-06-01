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

  useEffect(() => {
    console.log("[INIT] Initializing Teams SDK...");
    microsoftTeams.app
      .initialize()
      .then(() => {
        console.log("[INIT] Teams SDK initialized.");
        return microsoftTeams.app.getContext();
      })
      .then((context) => {
        const id = context.user?.aadObjectId;
        console.log("[TeamsContext] Retrieved AAD objectId:", id);
        setObjectId(id);

        if (id) {
          const url = `https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net/api/user/settings?objectId=${id}`;
          console.log("[API][GET] Fetching user settings from:", url);
          fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((data) => {
              console.log("[API][GET] Settings received:", data);
              setNotificationsEnabled(data.notificationsEnabled);
              setSnoozedUntil(data.snoozedUntilUtc);
            })
            .catch((err) =>
              console.error("[API][GET] Failed to fetch settings:", err)
            );
        }
      })
      .catch((err) => console.error("[INIT] Teams SDK error:", err));
  }, []);

  const handleSnooze = (hours) => {
    const snoozeTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    console.log(`[SNOOZE] Setting snooze for ${hours} hours → ${snoozeTime}`);
    setSnoozedUntil(snoozeTime);

    if (objectId) {
      const payload = {
        objectId,
        notificationsEnabled,
        snoozedUntilUtc: snoozeTime,
      };

      console.log("[API][POST] Sending snooze payload:", payload);
      fetch(
        "https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net/api/user/settings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          console.log("[API][POST] Snooze updated successfully");
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        })
        .catch((err) => console.error("[API][POST] Failed to update snooze:", err));
    }
  };

  const handleSave = () => {
    if (!objectId) {
      console.warn("[SAVE] objectId is missing. Cannot save.");
      return;
    }

    const payload = {
      objectId,
      notificationsEnabled,
      snoozedUntilUtc: snoozedUntil,
    };

    console.log("[API][POST] Saving settings:", payload);
    fetch(
      "https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net/api/user/settings",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log("[API][POST] Settings saved successfully");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      })
      .catch((err) => console.error("[API][POST] Failed to save settings:", err));
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
          className={
            notificationsEnabled ? "toggle-button on" : "toggle-button off"
          }
          onClick={() => {
            console.log(
              "[TOGGLE] Notifications toggled to",
              !notificationsEnabled
            );
            setNotificationsEnabled(!notificationsEnabled);
          }}
        >
          {notificationsEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      <div className="card" style={{ position: "relative" }}>
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

        <button className="save-button" onClick={handleSave}>
          Save
        </button>

        {showToast && <div className="toast">Settings saved successfully</div>}
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
          <p className="info-text">
            Snoozed until: {formatDateTime(snoozedUntil)}
          </p>
        )}
      </div>
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
