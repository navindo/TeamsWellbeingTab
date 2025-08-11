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

  const API_BASE = "https://wellbeingbot-dfcreretembra9bm.southeastasia-01.azurewebsites.net";

  const addLog = (msg) => setDebugLog((prev) => (prev ? prev + "\n" : "") + msg);

  const previewText = async (res) => {
    try {
      const t = await res.clone().text();
      if (!t) return "<empty>";
      return t.length > 1200 ? t.slice(0, 1200) + "...<truncated>" : t;
    } catch {
      return "<non-text response>";
    }
  };

  const headersToObj = (headers) => {
    const o = {};
    try { headers.forEach((v, k) => (o[k] = v)); } catch {}
    return o;
  };

  useEffect(() => {
    microsoftTeams.app.initialize().then(() => {
      addLog("[Teams] SDK initialized. Requesting auth token...");
      microsoftTeams.authentication.getAuthToken({
        successCallback: async (token) => {
          const decoded = parseJwt(token);
          const oid = decoded.oid;
          setObjectId(oid);
          setAuthToken(token);
          addLog(`[Teams] SSO token received. objectId=${oid || "(missing)"}`);

          const url = `${API_BASE}/api/user/settings?objectId=${encodeURIComponent(oid || "")}`;
          const started = performance.now();
          addLog(`[GET] ${url}`);

          try {
            const res = await fetch(url, {
              method: "GET"
              // If your API expects the Teams SSO token, uncomment:
              // headers: { Authorization: `Bearer ${token}` }
            });

            const dur = Math.round(performance.now() - started);
            const headers = headersToObj(res.headers);
            const bodyPrev = await previewText(res);

            addLog(`[GET] status=${res.status} ${res.statusText} (${dur}ms)`);
            addLog(`[GET] headers=${JSON.stringify(headers)}`);
            addLog(`[GET] bodyPreview:\n${bodyPrev}`);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // Only parse JSON after we know it's OK
            let data;
            try {
              data = await res.json();
            } catch {
              throw new Error("Response is not valid JSON");
            }

            setNotificationsEnabled(data.notificationsEnabled);
            setOriginalNotifications(data.notificationsEnabled);
            setSnoozedUntil(data.snoozedUntilUtc);

            const start = data.dndStart || "09:00";
            const end = data.dndEnd || "18:00";
            setDndFrom(start);
            setDndTo(end);
            setDndEnabled(!(start === "00:00" && end === "00:00"));

            addLog("[Init] Settings loaded successfully");
          } catch (err) {
            addLog(`[Error] Failed to load settings: ${err?.message || err}`);
          } finally {
            setSettingsLoading(false);
          }
        },
        failureCallback: (err) => addLog(`[Error] getAuthToken failed: ${err}`)
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = async (newSettings) => {
    if (!objectId) return false;

    const payload = {
      objectId,
      notificationsEnabled,
      snoozedUntilUtc: snoozedUntil,
      dndStart: dndEnabled ? dndFrom : "00:00",
      dndEnd: dndEnabled ? dndTo : "00:00",
      ...newSettings
    };

    const url = `${API_BASE}/api/user/settings`;
    addLog(`[POST] ${url}`);
    addLog("[Request] " + JSON.stringify(payload, null, 2));

    const started = performance.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // If your API accepts SSO token, you can also send it:
        // headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });

      const dur = Math.round(performance.now() - started);
      const body = await res.text();
      addLog(`[Response] status=${res.status} ${res.statusText} (${dur}ms)`);
      addLog(`[Response Body]\n${body.length > 1200 ? body.slice(0, 1200) + "...<truncated>" : body}`);

      if (!res.ok || body.includes("Please try again later")) throw new Error("Backend rejected update");
      return true;
    } catch (err) {
      addLog(`[Error] Update failed: ${err?.message || err}`);
      return false;
    }
  };

  const updateSettingsWithRetry = async (settings, key) => {
    setLoadingStatus((s) => ({ ...s, [key]: "loading" }));
    let success = await updateSettings(settings);
    if (!success) {
      addLog("[Retry] Waiting 2 mins and retrying update...");
      await new Promise((resolve) => setTimeout(resolve, 120000));
      success = await updateSettings(settings);
    }

    if (success) {
      setLoadingStatus((s) => ({ ...s, [key]: "success" }));
      setTimeout(() => setLoadingStatus((s) => ({ ...s, [key]: "idle" })), 1500);
    } else {
      setLoadingStatus((s) => ({ ...s, [key]: "idle" }));
    }

    return success;
  };

  const runSave = async (key, newSettings) => {
    const success = await updateSettingsWithRetry(newSettings, key);
    if (key === "notifications" && success) setOriginalNotifications(notificationsEnabled);
  };

  const handleSnooze = (hours) => {
    const snoozeTime = new Date(Date.now() + hours * 3600000).toISOString();
    setSnoozedUntil(snoozeTime);
    addLog(`[UI] SnoozedUntilUtc set to ${snoozeTime}`);
  };

  const formatDateTime = (dt) =>
    new Date(dt).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

  if (settingsLoading) return <div className="settings-loading">Loading settings...</div>;

  return (
    <div className="settings-container">
      <h2 className="settings-title">My Alert Settings</h2>

      <div className="card">
        <h3>Notifications</h3>
        <p>Toggle all alerts on or off.</p>
        <button
          className={`toggle-button ${notificationsEnabled ? "on" : "off"}`}
          onClick={() => setNotificationsEnabled((prev) => !prev)}
          disabled={loadingStatus.notifications === "loading"}
        >
          {notificationsEnabled ? "Enabled" : "Disabled"}
        </button>
        <div>
          <button
            className={`save-button ${loadingStatus.notifications}`}
            disabled={loadingStatus.notifications === "loading" || notificationsEnabled === originalNotifications}
            onClick={() => runSave("notifications", { notificationsEnabled })}
          >
            {loadingStatus.notifications === "loading" && <span className="loading-spinner"></span>}
            {loadingStatus.notifications === "success" && "Updated"}
            {loadingStatus.notifications === "idle" && "Save"}
            {loadingStatus.notifications === "loading" && "Updating..."}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Do Not Disturb</h3>
        <p>Enable quiet hours to suppress alerts.</p>
        <div className="dnd-toggle">
          <label>
            <input type="radio" checked={dndEnabled} onChange={() => setDndEnabled(true)} /> Enable
          </label>
          <label>
            <input type="radio" checked={!dndEnabled} onChange={() => setDndEnabled(false)} /> Disable
          </label>
        </div>
        <div className="time-selectors">
          <select value={dndFrom} onChange={(e) => setDndFrom(e.target.value)} disabled={!dndEnabled}>
            {generateTimeOptions()}
          </select>
          <span>to</span>
          <select value={dndTo} onChange={(e) => setDndTo(e.target.value)} disabled={!dndEnabled}>
            {generateTimeOptions()}
          </select>
        </div>
        <button
          className={`save-button ${loadingStatus.dnd}`}
          onClick={() => runSave("dnd", { dndStart: dndEnabled ? dndFrom : "00:00", dndEnd: dndEnabled ? dndTo : "00:00" })}
          disabled={loadingStatus.dnd === "loading"}
        >
          {loadingStatus.dnd === "loading" && <span className="loading-spinner"></span>}
          {loadingStatus.dnd === "success" && "Updated"}
          {loadingStatus.dnd === "idle" && "Save"}
          {loadingStatus.dnd === "loading" && "Updating..."}
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
        <button
          className={`save-button ${loadingStatus.snooze}`}
          onClick={() => runSave("snooze", { snoozedUntilUtc: snoozedUntil })}
          disabled={loadingStatus.snooze === "loading"}
        >
          {loadingStatus.snooze === "loading" && <span className="loading-spinner"></span>}
          {loadingStatus.snooze === "success" && "Updated"}
          {loadingStatus.snooze === "idle" && "Save"}
          {loadingStatus.snooze === "loading" && "Updating..."}
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
    options.push(
      <option key={v} value={v}>
        {v}
      </option>
    );
  }
  return options;
}

function parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}
