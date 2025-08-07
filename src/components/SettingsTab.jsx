import React, { useEffect, useState } from "react";
import * as microsoftTeams from "@microsoft/teams-js";

const SettingsTab = () => {
  const [objectId, setObjectId] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [snoozedUntilUtc, setSnoozedUntilUtc] = useState(null);
  const [dndStart, setDndStart] = useState("22:00");
  const [dndEnd, setDndEnd] = useState("07:00");
  const [loading, setLoading] = useState(true);
  const [isSavingSnooze, setIsSavingSnooze] = useState(false);
  const [isSavingDnd, setIsSavingDnd] = useState(false);
  const [isNotificationSaving, setIsNotificationSaving] = useState(false);
  const [snoozeSuccess, setSnoozeSuccess] = useState(false);
  const [dndSuccess, setDndSuccess] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    microsoftTeams.app.initialize().then(() => {
      microsoftTeams.authentication.getAuthToken({
        successCallback: (token) => {
          const decoded = JSON.parse(atob(token.split(".")[1]));
          const objId = decoded.oid;
          setObjectId(objId);
          fetchSettings(objId);
        },
        failureCallback: (err) => {
          console.error("[Teams] Auth failed", err);
          setLoading(false);
        },
      });
    });
  }, []);

  const fetchSettings = async (id) => {
    try {
      const res = await fetch(`/api/usersettings/${id}`);
      const data = await res.json();
      setNotificationsEnabled(data.notificationsEnabled);
      setSnoozedUntilUtc(data.snoozedUntilUtc);
      setDndStart(data.dndStart);
      setDndEnd(data.dndEnd);
    } catch (err) {
      console.error("[Error] Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (payload) => {
    const res = await fetch("/api/usersettings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update");
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleToggleNotifications = () => {
    setNotificationsEnabled((prev) => !prev);
  };

  const handleSaveNotification = async () => {
    setIsNotificationSaving(true);
    setNotificationSuccess(false);
    try {
      await saveSettings({ objectId, notificationsEnabled, snoozedUntilUtc, dndStart, dndEnd });
      setTimeout(() => {
        setIsNotificationSaving(false);
        setNotificationSuccess(true);
        setTimeout(() => setNotificationSuccess(false), 3000);
      }, 10000);
    } catch (err) {
      console.error("[Error] Failed to save notifications", err);
      setIsNotificationSaving(false);
      showToast("Failed to save notification settings.");
    }
  };

  const handleSaveSnooze = async () => {
    setIsSavingSnooze(true);
    setSnoozeSuccess(false);
    try {
      await saveSettings({ objectId, notificationsEnabled, snoozedUntilUtc, dndStart, dndEnd });
      setTimeout(() => {
        setIsSavingSnooze(false);
        setSnoozeSuccess(true);
        setTimeout(() => setSnoozeSuccess(false), 3000);
      }, 10000);
    } catch (err) {
      console.error("[Error] Failed to save snooze", err);
      setIsSavingSnooze(false);
      showToast("Failed to save snooze settings.");
    }
  };

  const handleSaveDnd = async () => {
    setIsSavingDnd(true);
    setDndSuccess(false);
    try {
      await saveSettings({ objectId, notificationsEnabled, snoozedUntilUtc, dndStart, dndEnd });
      setTimeout(() => {
        setIsSavingDnd(false);
        setDndSuccess(true);
        setTimeout(() => setDndSuccess(false), 3000);
      }, 10000);
    } catch (err) {
      console.error("[Error] Failed to save DND", err);
      setIsSavingDnd(false);
      showToast("Failed to save DND settings.");
    }
  };

  if (loading) return <div className="settings-loading">Loading settings...</div>;

  return (
    <div className="settings-container">
      <h2 className="settings-title">Notification Settings</h2>

      <div className="card">
        <h3>Notifications</h3>
        <p>Enable or disable notifications from the wellbeing bot.</p>
        <button
          className={`toggle-button ${notificationsEnabled ? "on" : "off"} ${isNotificationSaving ? "loading" : ""}`}
          onClick={handleToggleNotifications}
          disabled={isNotificationSaving}
        >
          {notificationsEnabled ? "Enabled" : "Disabled"}
        </button>
        <div style={{ marginTop: "12px" }}>
          <button
            className={`save-button ${isNotificationSaving ? "loading" : ""}`}
            onClick={handleSaveNotification}
            disabled={isNotificationSaving}
          >
            {isNotificationSaving ? <span className="loading-spinner" /> : "Save"}
          </button>
          {notificationSuccess && <span className="success-checkmark">✔ Updated</span>}
        </div>
      </div>

      <div className="card">
        <h3>Snooze</h3>
        <p>Temporarily stop receiving alerts for a few hours.</p>
        <div className="snooze-buttons">
          {[2, 4, 8, 24].map((h) => (
            <button key={h} onClick={() => setSnoozedUntilUtc(new Date(Date.now() + h * 3600000).toISOString())}>
              Snooze {h}h
            </button>
          ))}
        </div>
        <button
          className={`save-button ${isSavingSnooze ? "loading" : ""}`}
          onClick={handleSaveSnooze}
          disabled={isSavingSnooze}
        >
          {isSavingSnooze ? <span className="loading-spinner" /> : "Save"}
        </button>
        {snoozeSuccess && <span className="success-checkmark">✔ Updated</span>}
      </div>

      <div className="card">
        <h3>Do Not Disturb</h3>
        <p>Set a daily time range to avoid alerts.</p>
        <div className="time-selectors">
          <label>
            From:
            <select value={dndStart} onChange={(e) => setDndStart(e.target.value)}>
              {generateTimeOptions()}
            </select>
          </label>
          <label>
            To:
            <select value={dndEnd} onChange={(e) => setDndEnd(e.target.value)}>
              {generateTimeOptions()}
            </select>
          </label>
        </div>
        <button
          className={`save-button ${isSavingDnd ? "loading" : ""}`}
          onClick={handleSaveDnd}
          disabled={isSavingDnd}
        >
          {isSavingDnd ? <span className="loading-spinner" /> : "Save"}
        </button>
        {dndSuccess && <span className="success-checkmark">✔ Updated</span>}
      </div>

      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
};

const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    const hh = h.toString().padStart(2, "0");
    times.push(`${hh}:00`);
    times.push(`${hh}:30`);
  }
  return times.map((time) => (
    <option key={time} value={time}>{time}</option>
  ));
};

export default SettingsTab;
