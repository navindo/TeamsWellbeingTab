import React, { useState, useEffect } from "react";
import * as microsoftTeams from "@microsoft/teams-js";
import "./SettingsTab.css";

export default function SettingsTab() {
  const [objectId, setObjectId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dndFrom, setDndFrom] = useState("22:00");
  const [dndTo, setDndTo] = useState("07:00");
  const [snoozedUntil, setSnoozedUntil] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toggleLoading, setToggleLoading] = useState(false);
  const [debugLog, setDebugLog] = useState("");

  useEffect(() => {
    microsoftTeams.app
      .initialize()
      .then(() => {
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
                setSnoozedUntil(data.snoozedUntilUtc);
                setDndFrom(data.dndStart || "22:00");
                setDndTo(data.dndEnd || "07:00");
                setDebugLog((prev) => prev + "\n[Init] Settings loaded successfully");
              })
              .catch((err) => {
                setDebugLog((prev) => prev + "\n[Error] Failed to load settings: " + err.message);
              });
          },
          failureCallback: (err) => {
            setDebugLog((prev) => prev + `\n[Error] getAuthToken failed: ${err}`);
          }
        });
      })
      .catch((err) => {
        setDebugLog((prev) => prev + "\n[Error] Teams SDK init failed: " + err.message);
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      setDebugLog((prev) => prev + `\n[Response ${res.status}]\n${responseText}`);

      if (!res.ok) throw new Error(`HTTP ${res.status} - ${responseText}`);
      return true;
    } catch (err) {
      setDebugLog((prev) => prev + "\n[Error] Update failed: " + err.message);
      return false;
    }
  };

  const handleToggleNotifications = async () => {
    setDebugLog((prev) => prev + "\n[UI] Toggle Notifications button clicked");
    const newValue = !notificationsEnabled;
    setToggleLoading(true);

    const success = await updateSettings({ notificationsEnabled: newValue });
    if (success) {
      setNotificationsEnabled(newValue);
      showToastMessage("Notification setting updated.");
      setDebugLog((prev) => prev + "\n[UI] Notifications toggled successfully");
    } else {
      setDebugLog((prev) => prev + "\n[UI] Notification toggle failed");
    }

    setToggleLoading(false);
  };

  const handleSnooze = async (hours) => {
    setDebugLog((prev) => prev + `\n[UI] Snooze ${hours}h clicked`);

    const snoozeTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    setSnoozedUntil(snoozeTime);

    const success = await updateSettings({ snoozedUntilUtc: snoozeTime });
    if (success) {
      showToastMessage(`Snoozed for ${hours}h`);
      setDebugLog((prev) => prev + `\n[UI] Snoozed until ${snoozeTime}`);
    } else {
      setDebugLog((prev) => prev + "\n[UI] Snooze failed");
    }
  };

  const handleSave = async () => {
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

  return (
    <div className="settings-container">
      <h2 className="settings-title">🔔 My Alert Settings</h2>

      <div className="card">
        <h3>Notifications</h3>
        <p>Toggle all alerts on or off.</p>
        <button
          className={`toggle-button ${notificationsEnabled ? "on" : "off"} ${toggleLoading ? "loading" : ""}`}
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
          <select value={dndFrom} onChange={(e) => {
            setDndFrom(e.target.value);
            setDebugLog((prev) => prev + `\n[UI] DND From changed to ${e.target.value}`);
          }}>
            {generateTimeOptions()}
          </select>
          <span>to</span>
          <select value={dndTo} onChange={(e) => {
            setDndTo(e.target.value);
            setDebugLog((prev) => prev + `\n[UI] DND To changed to ${e.target.value}`);
          }}>
            {generateTimeOptions()}
          </select>
        </div>
        <button className="save-button" onClick={handleSave}>
          Save
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
      {debugLog && <pre className="debug-log">{debugLog}</pre>}
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

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch (e) {
    return {};
  }
}
