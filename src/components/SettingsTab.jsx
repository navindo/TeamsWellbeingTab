import React, { useState, useEffect } from "react";
import * as microsoftTeams from "@microsoft/teams-js";
import "./SettingsTab.css";

export default function SettingsTab() {
  const [objectId, setObjectId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [originalNotifications, setOriginalNotifications] = useState(true);
  const [dndEnabled, setDndEnabled] = useState(true);
  const [dndFrom, setDndFrom] = useState("09:00");
  const [dndTo, setDndTo] = useState("18:00");
  const [snoozedUntil, setSnoozedUntil] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [debugLog, setDebugLog] = useState("");
  const [loadingStatus, setLoadingStatus] = useState({ notifications: "idle", snooze: "idle", dnd: "idle" });

  useEffect(() => {
    microsoftTeams.app.initialize().then(() => {
      setDebugLog((prev) => prev + "\n[Teams] SDK initialized. Requesting auth token...");
      microsoftTeams.authentication.getAuthToken({
        successCallback: (token) => {
          const decoded = parseJwt(token);
          const objectId = decoded.oid;
          setObjectId(objectId);
          setAuthToken(token);
          setDebugLog((prev) => prev + `\n[Teams] SSO token received. ObjectId=${objectId}`);
          fetch(`https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net/api/user/settings?objectId=${objectId}`)
            .then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
            .then((data) => {
              setNotificationsEnabled(data.notificationsEnabled);
              setOriginalNotifications(data.notificationsEnabled);
              setSnoozedUntil(data.snoozedUntilUtc);
              const start = data.dndStart || "09:00";
              const end = data.dndEnd || "18:00";
              setDndFrom(start);
              setDndTo(end);
              setDndEnabled(!(start === "00:00" && end === "00:00"));
              setDebugLog((prev) => prev + "\n[Init] Settings loaded successfully");
            })
            .catch((err) => setDebugLog((prev) => prev + `\n[Error] Failed to load settings: ${err.message}`))
            .finally(() => setSettingsLoading(false));
        },
        failureCallback: (err) => setDebugLog((prev) => prev + `\n[Error] getAuthToken failed: ${err}`),
      });
    });
  }, []);

  const updateSettings = async (newSettings) => {
    if (!objectId) return false;
    const payload = {
      objectId,
      notificationsEnabled,
      snoozedUntilUtc: snoozedUntil,
      dndStart: dndEnabled ? dndFrom : "00:00",
      dndEnd: dndEnabled ? dndTo : "00:00",
      ...newSettings,
    };
    setDebugLog((prev) => prev + "\n[Request] Sending settings:\n" + JSON.stringify(payload, null, 2));
    try {
      const res = await fetch("https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseText = await res.text();
      setDebugLog((prev) => prev + `\n[Response Status] ${res.status}\n[Response Body]\n${responseText}`);
      if (!res.ok || responseText.includes("Please try again later")) throw new Error("Backend rejected update");
      return true;
    } catch (err) {
      setDebugLog((prev) => prev + `\n[Error] Update failed: ${err.message}`);
      return false;
    }
  };

  const updateSettingsWithRetry = async (settings, key) => {
    const success = await updateSettings(settings);
    if (success) return true;
    const lastLog = debugLog.split('\n').pop();
    if (lastLog.includes("Please try again later")) {
      setDebugLog((prev) => prev + `\n[Retry] Waiting 2 mins and retrying update...`);
      await new Promise((resolve) => setTimeout(resolve, 120000));
      return await updateSettings(settings);
    }
    return false;
  };

  const runSave = async (key, newSettings) => {
    setLoadingStatus((s) => ({ ...s, [key]: "loading" }));
    const success = await updateSettingsWithRetry(newSettings, key);
    if (key === "notifications" && success) setOriginalNotifications(notificationsEnabled);
    if (success) {
      setTimeout(() => setLoadingStatus((s) => ({ ...s, [key]: "success" })), 10);
      setTimeout(() => setLoadingStatus((s) => ({ ...s, [key]: "idle" })), 1500);
    } else {
      setTimeout(() => setLoadingStatus((s) => ({ ...s, [key]: "idle" })), 10000);
    }
  };

  const handleSnooze = (hours) => {
    const snoozeTime = new Date(Date.now() + hours * 3600000).toISOString();
    setSnoozedUntil(snoozeTime);
    setDebugLog((prev) => prev + `\n[UI] SnoozedUntilUtc set to ${snoozeTime}`);
  };

  const formatDateTime = (dt) => new Date(dt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  if (settingsLoading) return <div className="settings-loading">Loading settings...</div>;

  return (
    <div className="settings-container">
      <h2 className="settings-title">🔔 My Alert Settings</h2>

      <div className="card">
        <h3>Notifications</h3>
        <p>Toggle all alerts on or off.</p>
        <button className={`toggle-button ${notificationsEnabled ? "on" : "off"}`} onClick={() => setNotificationsEnabled((prev) => !prev)} disabled={loadingStatus.notifications === "loading"}>
          {notificationsEnabled ? "Enabled" : "Disabled"}
        </button>
        <button className={`save-button ${loadingStatus.notifications}`} disabled={loadingStatus.notifications === "loading" || notificationsEnabled === originalNotifications} onClick={() => runSave("notifications", { notificationsEnabled })}>
          {loadingStatus.notifications === "loading" && <span className="loading-spinner"></span>}
          {loadingStatus.notifications === "success" && "✅ Updated"}
          {loadingStatus.notifications === "idle" && "Save"}
          {loadingStatus.notifications === "loading" && "Updating..."}
        </button>
      </div>

      <div className="card">
        <h3>Do Not Disturb</h3>
        <p>Enable quiet hours to suppress alerts.</p>
        <div className="dnd-toggle">
          <label><input type="radio" checked={dndEnabled} onChange={() => setDndEnabled(true)} /> Enable</label>
          <label style={{ marginLeft: "20px" }}><input type="radio" checked={!dndEnabled} onChange={() => setDndEnabled(false)} /> Disable</label>
        </div>
        <div className="time-selectors">
          <select value={dndFrom} onChange={(e) => setDndFrom(e.target.value)} disabled={!dndEnabled}>{generateTimeOptions()}</select>
          <span>to</span>
          <select value={dndTo} onChange={(e) => setDndTo(e.target.value)} disabled={!dndEnabled}>{generateTimeOptions()}</select>
        </div>
        <button className={`save-button ${loadingStatus.dnd}`} onClick={() => runSave("dnd", { dndStart: dndEnabled ? dndFrom : "00:00", dndEnd: dndEnabled ? dndTo : "00:00" })} disabled={loadingStatus.dnd !== "idle"}>
          {loadingStatus.dnd === "loading" && <span className="loading-spinner"></span>}
          {loadingStatus.dnd === "success" && "✅ Updated"}
          {loadingStatus.dnd === "idle" && "Save"}
        </button>
      </div>

      <div className="card">
        <h3>Snooze Alerts</h3>
        <p>Temporarily pause all alerts.</p>
        <div className="snooze-buttons">
          <button onClick={() => handleSnooze(1)}>1h</button>
          <button onClick={() => handleSnooze(4)}>4h</button>
          <button onClick={() => handleSnooze(24)}>24h</button>
        </div>
        {snoozedUntil && <p className="info-text">Snoozed until: {formatDateTime(snoozedUntil)}</p>}
        <button className={`save-button ${loadingStatus.snooze}`} onClick={() => runSave("snooze", { snoozedUntilUtc: snoozedUntil })} disabled={loadingStatus.snooze !== "idle"}>
          {loadingStatus.snooze === "loading" && <span className="loading-spinner"></span>}
          {loadingStatus.snooze === "success" && "✅ Updated"}
          {loadingStatus.snooze === "idle" && "Save"}
        </button>
      </div>

      {debugLog && <pre className="debug-log">{debugLog}</pre>}
    </div>
  );
}

function generateTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    const v = `${h.toString().padStart(2, "0")}:00`;
    options.push(<option key={v} value={v}>{v}</option>);
  }
  return options;
}

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch {
    return {};
  }
}