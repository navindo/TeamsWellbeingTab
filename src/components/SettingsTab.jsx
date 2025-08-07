// (NO CHANGE TO IMPORTS)
import React, { useState, useEffect } from "react";
import * as microsoftTeams from "@microsoft/teams-js";
import "./SettingsTab.css";

export default function SettingsTab() {
  const [objectId, setObjectId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [originalNotifications, setOriginalNotifications] = useState(true);
  const [dndFrom, setDndFrom] = useState("22:00");
  const [dndTo, setDndTo] = useState("07:00");
  const [snoozedUntil, setSnoozedUntil] = useState(null);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [snoozeLoading, setSnoozeLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [debugLog, setDebugLog] = useState("");

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
              setDndFrom(data.dndStart || "22:00");
              setDndTo(data.dndEnd || "07:00");
              setDebugLog((prev) => prev + "\n[Init] Settings loaded successfully");
            })
            .catch((err) => {
              const errorDetails = [
                "[Error] Failed to load settings",
                `Message: ${err.message}`,
                `Stack: ${err.stack}`,
                `Location: ${window.location.href}`,
                `Navigator Online: ${navigator.onLine}`,
                `ObjectId: ${objectId}`
              ].join("\n");
              setDebugLog((prev) => prev + "\n" + errorDetails);
            })
            .finally(() => setSettingsLoading(false));
        },
        failureCallback: (err) => {
          setDebugLog((prev) => prev + `\n[Error] getAuthToken failed: ${err}`);
        }
      });
    });
  }, []);

  const showToastMessage = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const updateSettings = async (newSettings) => {
    if (!objectId) {
      setDebugLog((prev) => prev + "\n[Error] No objectId. Cannot update settings.");
      return false;
    }

    const payload = {
      objectId,
      notificationsEnabled,
      snoozedUntilUtc: snoozedUntil,
      dndStart: dndFrom,
      dndEnd: dndTo,
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
      setDebugLog((prev) => prev +
        `\n[Response Status] ${res.status}` +
        `\n[Response Headers]\n${JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2)}` +
        `\n[Response Body]\n${responseText}`);

      if (!res.ok) throw new Error(`HTTP ${res.status} - ${responseText}`);
      return true;
    } catch (err) {
      const errorDetails = [
        "[Error] Update failed",
        `Message: ${err.message}`,
        `Stack: ${err.stack}`,
        `Location: ${window.location.href}`,
        `Navigator Online: ${navigator.onLine}`,
        `Payload: ${JSON.stringify(payload, null, 2)}`
      ].join("\n");

      setDebugLog((prev) => prev + "\n" + errorDetails);
      return false;
    }
  };

  const handleSaveNotifications = async () => {
    setDebugLog((prev) => prev + "\n[UI] Save Notification clicked");
    setToggleLoading(true);
    const success = await updateSettings({ notificationsEnabled });
    if (success) {
      setOriginalNotifications(notificationsEnabled);
      showToastMessage("Notification setting updated.");
      setDebugLog((prev) => prev + "\n[UI] Notifications saved successfully");
    } else {
      setDebugLog((prev) => prev + "\n[UI] Notification update failed");
    }
    setToggleLoading(false);
  };

  const handleSaveSnooze = async () => {
    setDebugLog((prev) => prev + `\n[UI] Save Snooze clicked`);
    setSnoozeLoading(true);
    const success = await updateSettings({ snoozedUntilUtc: snoozedUntil });
    if (success) {
      showToastMessage(`Snooze updated.`);
      setDebugLog((prev) => prev + `\n[UI] Snooze updated successfully`);
    } else {
      setDebugLog((prev) => prev + "\n[UI] Snooze update failed");
    }
    setSnoozeLoading(false);
  };

  const handleSnooze = (hours) => {
    const snoozeTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    setSnoozedUntil(snoozeTime);
    setDebugLog((prev) => prev + `\n[UI] SnoozedUntilUtc set to ${snoozeTime}`);
  };

  const handleSaveDND = async () => {
    setDebugLog((prev) => prev + "\n[UI] Save DND clicked");
    const success = await updateSettings({});
    if (success) {
      showToastMessage("DND settings updated.");
      setDebugLog((prev) => prev + "\n[UI] DND settings updated successfully");
    } else {
      setDebugLog((prev) => prev + "\n[UI] DND update failed");
    }
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

  if (settingsLoading) {
    return <div className="settings-loading">Loading settings...</div>;
  }

  return (
    <div className="settings-container">
      <h2 className="settings-title">🔔 My Alert Settings</h2>

      <div className="card">
        <h3>Notifications</h3>
        <p>Toggle all alerts on or off.</p>
        <button
          className={`toggle-button ${notificationsEnabled ? "on" : "off"}`}
          onClick={() => {
            setDebugLog((prev) => prev + "\n[UI] Toggle clicked");
            setNotificationsEnabled((prev) => !prev);
          }}
        >
          {notificationsEnabled ? "Enabled" : "Disabled"}
        </button>
        <button
          className="save-button"
          onClick={handleSaveNotifications}
          disabled={toggleLoading || notificationsEnabled === originalNotifications}
        >
          {toggleLoading ? "Saving..." : "Save Notification"}
        </button>
      </div>

      <div className="card">
        <h3>Do Not Disturb</h3>
        <p>Set quiet hours to suppress alerts automatically.</p>
        <div className="time-selectors">
          <select value={dndFrom} onChange={(e) => setDndFrom(e.target.value)}>{generateTimeOptions()}</select>
          <span>to</span>
          <select value={dndTo} onChange={(e) => setDndTo(e.target.value)}>{generateTimeOptions()}</select>
        </div>
        <button className="save-button" onClick={handleSaveDND}>Save</button>
      </div>

      <div className="card">
        <h3>Snooze Alerts</h3>
        <p>Pause notifications temporarily.</p>
        <div className="snooze-buttons">
          <button onClick={() => handleSnooze(1)}>1h</button>
          <button onClick={() => handleSnooze(4)}>4h</button>
          <button onClick={() => handleSnooze(24)}>24h</button>
        </div>
        {snoozedUntil && <p className="info-text">Snoozed until: {formatDateTime(snoozedUntil)}</p>}
        <button className="save-button" onClick={handleSaveSnooze} disabled={snoozeLoading}>
          {snoozeLoading ? "Saving..." : "Save Snooze"}
        </button>
      </div>

      {showToast && <div className="toast">{toastMessage}</div>}
      {debugLog && <pre className="debug-log">{debugLog}</pre>}
    </div>
  );
}

function generateTimeOptions() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    const value = `${h.toString().padStart(2, "0")}:00`;
    options.push(<option value={value} key={value}>{value}</option>);
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
