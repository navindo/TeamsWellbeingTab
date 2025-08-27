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

      const fetchSettings = async (base, oid, token) => {
        const url = `${base}/api/user/settings?objectId=${encodeURIComponent(oid)}`;
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
      };

      try {
        await microsoftTeams.app.initialize();
        addLog("[Teams] SDK initialized. Reading app context...");
        try {
          const ctx = await microsoftTeams.app.getContext();
          const ctxOid = ctx?.user?.id || ctx?.user?.aadObjectId || ctx?.userObjectId || null;
          if (ctxOid) {
            setObjectId(ctxOid);
            addLog(`[Teams] Context OID detected: ${ctxOid}`);
            await fetchSettings(finalBase, ctxOid, null);
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
              await fetchSettings(finalBase, oid, token);
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