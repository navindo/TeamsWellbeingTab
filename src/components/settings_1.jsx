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
  const [loadingStatus, setLoadingStatus] = useState({ notifications: "idle", snooze: "idle", dnd: "idle" });

  const [debugLog, setDebugLog] = useState("");
  const [apiBase, setApiBase] = useState("");

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

  async function loadSettings(finalBase, oid, token) {
    const url = `${finalBase}/api/user/settings?objectId=${encodeURIComponent(oid)}`;
    addLog(`[GET] ${url}`);
    try {
      const res = await fetch(url, { method: "GET" });
      const bodyPrev = await previewText(res);
      addLog(`[GET] status=${res.status} ${res.statusText}`);
      addLog(`[GET] bodyPreview:\n${bodyPrev}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
  }

  useEffect(() => {
    const baked = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");
    fetch("/config.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((cfg) => {
        const runtimeBase = (cfg?.API_BASE_URL || "").replace(/\/+$/, "");
        const finalBase = runtimeBase || baked;
        setApiBase(finalBase);
        if (runtimeBase) addLog(`[Config] Using runtime API_BASE_URL: ${runtimeBase}`);
        else if (baked) addLog(`[Config] Using baked REACT_APP_API_BASE_URL: ${baked}`);
        else addLog("[Config][Error] No API base URL found (runtime or baked).");
        return finalBase;
      })
      .then(async (finalBase) => {
        if (!finalBase) {
          setSettingsLoading(false);
          return;
        }
        try {
          await microsoftTeams.app.initialize();
          addLog("[Teams] SDK initialized. Reading app context...");
          try {
            const ctx = await microsoftTeams.app.getContext();
            const ctxOid = ctx?.user?.id || ctx?.user?.aadObjectId || ctx?.userObjectId || null;
            if (ctxOid) {
              setObjectId(ctxOid);
              addLog(`[Teams] Context OID detected: ${ctxOid}`);
              await loadSettings(finalBase, ctxOid, null);
              return;
            }
          } catch (e) {
            addLog(`[Teams] getContext failed: ${e?.message || e}`);
          }
          addLog("[Teams] Context OID not available; requesting auth token...");
          let tokenTimeout = setTimeout(() => {
            addLog("[Error] getAuthToken timed out (are you running outside Teams?)");
            setSettingsLoading(false);
          }, 8000);
          microsoftTeams.authentication.getAuthToken({
            successCallback: async (token) => {
              clearTimeout(tokenTimeout);
              setAuthToken(token);
              const decoded = parseJwt(token);
              const oid = decoded?.oid || null;
              setObjectId(oid);
              addLog(`[Teams] SSO token received. ObjectId=${oid || "<missing>"}`);
              if (oid) {
                await loadSettings(finalBase, oid, token);
              } else {
                addLog("[Error] OID missing in token; cannot load settings.");
                setSettingsLoading(false);
              }
            },
            failureCallback: (err) => {
              clearTimeout(tokenTimeout);
              addLog(`[Error] getAuthToken failed: ${err}`);
              setSettingsLoading(false);
            }
          });
        } catch (e) {
          addLog(`[Error] Teams initialize failed: ${e?.message || e}`);
          setSettingsLoading(false);
        }
      });
  }, []);

  const updateSettings = async (newSettings) => {
    if (!objectId || !apiBase) return false;
    const payload = {
      objectId,
      notificationsEnabled,
      snoozedUntilUtc: snoozedUntil,
      dndStart: dndEnabled ? dndFrom : "00:00",
      dndEnd: dndEnabled ? dndTo : "00:00",
      ...newSettings
    };
    addLog("[Request] " + JSON.stringify(payload, null, 2));
    try {
      const res = await fetch(`${apiBase}/api/user/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const responseText = await res.text();
      addLog(`[Response Status] ${res.status} ${res.statusText}`);
      addLog(`[Response Body]\n${responseText.length > 1200 ? responseText.slice(0, 1200) + "...<truncated>" : responseText}`);
      if (!res.ok || responseText.includes("Please try again later")) throw new Error("Backend rejected update");
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

  return (
    <div className="settings-container">
      {settingsLoading && <div className="settings-loading">Loading settings...</div>}
      {!settingsLoading && (
        <>
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
        </>
      )}
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
