// modules/sync/ScenarioSync.js
// Real-time two-way scenario collaboration via Supabase Realtime Broadcast
// Modes: "exploring" (both edit freely) | "agreed" (borrower read-only, PQ letter excepted)

const { useState, useEffect, useRef, useCallback } = React;
const SYNC_DEBOUNCE_MS = 300;

// ── useSyncSession ──────────────────────────────────────────────────────────
// Call unconditionally (safe no-op when scenarioId is null).
function useSyncSession(scenarioId, isLO, displayName) {
  const [connected,     setConnected]     = useState(false);
  const [mode,          setModeState]     = useState("exploring");
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerName,      setPeerName]      = useState("");

  const channelRef      = useRef(null);
  const applyingRef     = useRef(false);   // true while applying remote changes → suppress outbound broadcast
  const queueRef        = useRef({});      // pending outbound changes (batched)
  const timerRef        = useRef(null);    // debounce timer
  const origSetItemRef  = useRef(null);    // original localStorage.setItem

  // ── Apply incoming changes from remote peer ──────────────────────────────
  const applyChanges = useCallback((changes) => {
    if (!changes || typeof changes !== "object") return;
    applyingRef.current = true;
    try {
      const orig = origSetItemRef.current || localStorage.setItem.bind(localStorage);
      Object.entries(changes).forEach(([shortKey, value]) => {
        try { orig("mtk_" + shortKey, value); } catch {}
      });
      window.dispatchEvent(new Event("mtk_propagated"));
      window.dispatchEvent(new Event("mtk_values_changed"));
    } finally {
      // Use setTimeout so any synchronous state updates from the events finish first
      setTimeout(() => { applyingRef.current = false; }, 0);
    }
  }, []);

  // ── Broadcast a batch of key→value changes ───────────────────────────────
  const broadcastBatch = useCallback((changes) => {
    if (!channelRef.current || !Object.keys(changes).length) return;
    try {
      channelRef.current.send({ type: "broadcast", event: "state_patch", payload: { changes } });
    } catch {}
  }, []);

  // ── Intercept localStorage.setItem while session is active ───────────────
  useEffect(() => {
    if (!scenarioId) return;
    // Guard against double-install (React StrictMode)
    if (localStorage._mtkSyncActive) return;
    localStorage._mtkSyncActive = true;

    const orig = localStorage.setItem.bind(localStorage);
    origSetItemRef.current = orig;

    localStorage.setItem = function (key, value) {
      orig(key, value);
      if (key.startsWith("mtk_") && !applyingRef.current && channelRef.current) {
        queueRef.current[key.slice(4)] = value;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          broadcastBatch({ ...queueRef.current });
          queueRef.current = {};
        }, SYNC_DEBOUNCE_MS);
      }
    };

    return () => {
      if (origSetItemRef.current) {
        localStorage.setItem = origSetItemRef.current;
        origSetItemRef.current = null;
      }
      delete localStorage._mtkSyncActive;
      clearTimeout(timerRef.current);
      queueRef.current = {};
    };
  }, [scenarioId, broadcastBatch]);

  // ── Connect to Supabase Realtime channel ─────────────────────────────────
  useEffect(() => {
    if (!scenarioId) return;
    const client = window._supabaseClient;
    if (!client) return;

    const ch = client.channel("live_" + scenarioId, {
      config: { broadcast: { self: false } },
    });

    // Remote peer changed calculator state
    ch.on("broadcast", { event: "state_patch" }, function ({ payload }) {
      if (payload && payload.changes) applyChanges(payload.changes);
    });

    // LO changed the session mode
    ch.on("broadcast", { event: "mode_change" }, function ({ payload }) {
      if (payload && payload.mode) setModeState(payload.mode);
    });

    // LO sends a full-state dump when borrower first joins
    ch.on("broadcast", { event: "full_sync" }, function ({ payload }) {
      if (payload && payload.changes && !isLO) applyChanges(payload.changes);
    });

    // Presence: who is connected
    ch.on("presence", { event: "sync" }, function () {
      try {
        const state = ch.presenceState();
        const all = Object.values(state).flat();
        const otherRole = isLO ? "borrower" : "lo";
        const peer = all.find(function (p) { return p.role === otherRole; });
        setPeerConnected(!!peer);
        setPeerName((peer && peer.name) ? peer.name : "");
      } catch {}
    });

    // When a borrower joins, LO dumps current full state so borrower starts in sync
    ch.on("presence", { event: "join" }, function ({ newPresences }) {
      if (!isLO) return;
      const borrowerJoined = newPresences && newPresences.some(function (p) { return p.role === "borrower"; });
      if (!borrowerJoined) return;
      setTimeout(function () {
        try {
          const snapshot = {};
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.startsWith("mtk_")) snapshot[k.slice(4)] = localStorage.getItem(k);
          }
          if (channelRef.current) {
            channelRef.current.send({ type: "broadcast", event: "full_sync", payload: { changes: snapshot } });
          }
        } catch {}
      }, 600);
    });

    ch.subscribe(async function (status) {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        try {
          await ch.track({
            role:  isLO ? "lo" : "borrower",
            name:  displayName || (isLO ? "Loan Officer" : "Borrower"),
          });
        } catch {}
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        setConnected(false);
        setPeerConnected(false);
      }
    });

    channelRef.current = ch;

    return function () {
      try { client.removeChannel(ch); } catch {}
      channelRef.current = null;
      setConnected(false);
      setPeerConnected(false);
    };
  }, [scenarioId, isLO, displayName, applyChanges]);

  // ── Change mode and broadcast to peer ────────────────────────────────────
  const setMode = useCallback(function (newMode) {
    setModeState(newMode);
    if (channelRef.current) {
      try {
        channelRef.current.send({ type: "broadcast", event: "mode_change", payload: { mode: newMode } });
      } catch {}
    }
  }, []);

  // ── Broadcast a live-session invite to the borrower's dashboard ───────────
  // Creates a short-lived channel just to fire the invite event, then removes it.
  const inviteClient = useCallback(function (loName) {
    if (!scenarioId) return;
    var client = window._supabaseClient;
    if (!client) return;
    try {
      var ch = client.channel("invite_scenario_" + scenarioId, { config: { broadcast: { self: false } } });
      ch.subscribe(function (status) {
        if (status !== "SUBSCRIBED") return;
        try {
          ch.send({ type: "broadcast", event: "live_invite", payload: { loName: loName || "Your Loan Officer", scenarioId: scenarioId } });
        } catch {}
        setTimeout(function () { try { client.removeChannel(ch); } catch {} }, 2000);
      });
    } catch {}
  }, [scenarioId]);

  return { connected, mode, setMode, peerConnected, peerName, inviteClient };
}

// ── LiveSessionBar ──────────────────────────────────────────────────────────
// Rendered inside MortgageToolkit below the tab bar.
// LO sees: connection dot, peer status, mode toggle, share link button.
// Borrower sees: connection dot, mode indicator.
function LiveSessionBar({ scenarioId, isLO, mode, setMode, connected, peerConnected, peerName, darkMode, onInviteClient, panel }) {
  const [copied,  setCopied]  = useState(false);
  const [invited, setInvited] = useState(false);
  const c = window.COLORS || {};
  const f = window.font || "'Inter', sans-serif";

  const agreed = mode === "agreed";

  // Colors vary by mode and dark/light
  const barBg     = darkMode ? (agreed ? "#0C2318" : "#0B1C2B")  : (agreed ? "#F0FDF4" : "#EBF5FB");
  const barBorder = darkMode ? (agreed ? "#166534" : "#1E3A50")  : (agreed ? "#86EFAC" : "#BFDBFE");
  const accentClr = darkMode ? (agreed ? "#4ADE80" : "#7DD3FC")  : (agreed ? "#166534" : "#1D4ED8");
  const subtleClr = darkMode ? "#64748B" : "#94A3B8";

  const myDot   = connected   ? "#22C55E" : "#F59E0B";
  const peerDot = peerConnected ? "#22C55E" : subtleClr;

  const shareUrl = (function () {
    var base = window.location.href.split("?")[0];
    return base + "?live=" + scenarioId;
  })();

  function copyLink() {
    try {
      navigator.clipboard.writeText(shareUrl).then(function () {
        setCopied(true);
        setTimeout(function () { setCopied(false); }, 2500);
      });
    } catch {
      // Fallback for non-HTTPS
      var ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 2500);
    }
  }

  var modeToggleBase = {
    padding: "3px 12px", borderRadius: 12, border: "none", cursor: "pointer",
    fontSize: 11, fontWeight: 700, fontFamily: f, transition: "all 0.18s",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 10,
      padding: panel ? "12px 16px" : "9px 16px",
      background: panel ? "transparent" : barBg,
      border: panel ? "none" : ("1px solid " + barBorder),
      borderRadius: panel ? 0 : 8,
      marginBottom: panel ? 0 : 14,
      fontFamily: f,
    }}>

      {/* Left — connection indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>

        {/* My connection */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
            background: myDot,
            boxShadow: connected ? "0 0 0 2px " + myDot + "44" : "none",
            transition: "background 0.3s",
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: accentClr, letterSpacing: "0.01em" }}>
            {connected ? "Live Session" : "Connecting…"}
          </span>
        </div>

        {/* Peer status */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: peerDot }} />
          <span style={{ fontSize: 11, color: subtleClr }}>
            {isLO
              ? (peerConnected ? "Borrower connected" + (peerName ? ": " + peerName : "") : "Waiting for borrower…")
              : (peerConnected ? "LO connected"       + (peerName ? ": " + peerName : "") : "Waiting for LO…")
            }
          </span>
        </div>

      </div>

      {/* Right — LO controls OR borrower status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        {isLO ? (
          <React.Fragment>

            {/* Mode pill toggle */}
            <div style={{
              display: "flex", alignItems: "center", gap: 2, padding: "3px 4px",
              background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              borderRadius: 16, border: "1px solid " + barBorder,
            }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: subtleClr, paddingLeft: 8, paddingRight: 4 }}>
                Mode
              </span>
              <button
                onClick={function () { setMode("exploring"); }}
                style={Object.assign({}, modeToggleBase, {
                  background: !agreed ? (darkMode ? "#1D4ED8" : "#3B82F6") : "transparent",
                  color:      !agreed ? "#fff" : subtleClr,
                })}
              >✏️ Exploring</button>
              <button
                onClick={function () { setMode("agreed"); }}
                style={Object.assign({}, modeToggleBase, {
                  background: agreed ? (darkMode ? "#166534" : "#22C55E") : "transparent",
                  color:      agreed ? "#fff" : subtleClr,
                })}
              >🔒 Agreed</button>
            </div>

            {/* Invite Client button — in-app push to borrower's dashboard */}
            {onInviteClient && (
              <button
                onClick={function () {
                  onInviteClient();
                  setInvited(true);
                  setTimeout(function () { setInvited(false); }, 3000);
                }}
                title={peerConnected ? "Borrower is already connected" : "Send an in-app notification to the borrower"}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 14px", borderRadius: 16,
                  border: "1px solid " + (peerConnected ? subtleClr : barBorder),
                  background: invited
                    ? (darkMode ? "#166534" : "#DCFCE7")
                    : peerConnected
                      ? "transparent"
                      : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)"),
                  color: invited ? (darkMode ? "#4ADE80" : "#166534") : peerConnected ? subtleClr : accentClr,
                  fontSize: 11, fontWeight: 700, fontFamily: f,
                  cursor: peerConnected ? "default" : "pointer",
                  transition: "all 0.2s", opacity: peerConnected ? 0.5 : 1,
                }}
              >
                {invited ? "✅ Notified!" : peerConnected ? "📡 Borrower Online" : "📡 Invite Client"}
              </button>
            )}

            {/* Share link button — hidden until grant-on-copy is implemented */}
            {false && <button
              onClick={copyLink}
              title="Copy invite link for borrower"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 14px", borderRadius: 16,
                border: "1px solid " + barBorder,
                background: copied
                  ? (darkMode ? "#166534" : "#DCFCE7")
                  : (darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)"),
                color: copied ? (darkMode ? "#4ADE80" : "#166534") : accentClr,
                fontSize: 11, fontWeight: 700, fontFamily: f, cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {copied ? "✅ Link Copied!" : "🔗 Share Link"}
            </button>}

          </React.Fragment>
        ) : (
          /* Borrower: mode indicator only */
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: accentClr }}>
            {agreed
              ? "🔒 Agreed — viewing only (you can still edit the Pre-Qual Letter)"
              : "✏️ Exploring — you can edit freely with your LO"
            }
          </div>
        )}

      </div>
    </div>
  );
}

// ── Exports ──────────────────────────────────────────────────────────────────
window.useSyncSession = useSyncSession;
window.LiveSessionBar = LiveSessionBar;
