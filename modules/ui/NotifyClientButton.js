// modules/ui/NotifyClientButton.js
// "Notify Client" button for the LO toolkit header.
// Sends a magic link email to the client for the current scenario + tab destination.
// Only renders for internal users when the scenario has a linked contact with an email.
//
// Globals: window.sendScenarioLink (tokens.js), window.TOKEN_DESTINATIONS (tokens.js)

const { useState, useCallback } = React;
const _font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Maps toolkit module IDs → token destination keys
const MODULE_TO_DEST = {
  fees:    "fee_sheet",
  compare: "loan_comparison",
  refi:    "refi_analysis",
  payment: "full_scenario",
  // everything else defaults to full_scenario
};

function NotifyClientButton({ scenario, contact, activeModule, user }) {
  const [sending,     setSending]     = useState(false);
  const [modal,       setModal]       = useState(null); // null | { url, isExisting, error, clientName }
  const [copied,      setCopied]      = useState(false);
  const [sendingLive, setSendingLive] = useState(false);
  const [liveModal,   setLiveModal]   = useState(null); // null | { url, error, clientName }
  const [liveCopied,  setLiveCopied]  = useState(false);

  // Derive contact fields
  const clientEmail = (contact && (contact.email_personal || contact.email_work || "").trim()) || "";
  const clientName  = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
    : "";
  const clientPhone = (contact && (contact.phone_cell || contact.phone_work || contact.phone_home || "").trim()) || "";

  // Don't render if missing required data
  if (!scenario || !scenario.id)         return null;
  if (!clientEmail)                       return null;
  if (!user || !user.isInternal)          return null;

  const destination = MODULE_TO_DEST[activeModule] || "full_scenario";
  const destLabel   = (window.TOKEN_DESTINATIONS && window.TOKEN_DESTINATIONS[destination]) || "Scenario";

  const handleSendLive = useCallback(async function() {
    setSendingLive(true);
    setLiveModal(null);
    const liveUrl = (window.location.href.split("?")[0]) + "?live=" + scenario.id;

    // Grant email-based read access so the borrower can load the scenario after
    // logging in, even if the scenario has no contact_id linking their email.
    if (window.grantLiveScenarioAccess && clientEmail) {
      await window.grantLiveScenarioAccess(scenario.id, clientEmail).catch(function() {});
    }

    const SUPABASE_URL = window._supabaseClient && window._supabaseClient.supabaseUrl;
    const EDGE_FN_URL  = SUPABASE_URL ? SUPABASE_URL + "/functions/v1/send-scenario-link" : null;
    var emailError = null;
    if (EDGE_FN_URL) {
      try {
        const { data: { session } } = await window._supabaseClient.auth.getSession();
        const resp = await fetch(EDGE_FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + (session && session.access_token ? session.access_token : ""),
          },
          body: JSON.stringify({
            clientEmail,
            clientName,
            scenarioName:     scenario.name || "Your Mortgage Scenario",
            destination:      "live_session",
            destinationLabel: "Live Session",
            tokenUrl:         liveUrl,
            createdByName:    user.name || "Your Loan Officer",
            isLiveSession:    true,
          }),
        });
        if (!resp.ok) emailError = new Error("Email send failed — link was still created.");
      } catch (e) {
        emailError = new Error("Email send failed — link was still created.");
      }
    } else {
      emailError = new Error("Email service unavailable.");
    }
    setSendingLive(false);
    setLiveModal({ url: liveUrl, error: emailError ? emailError.message : null, clientName });
  }, [clientEmail, clientName, scenario, user]);

  const handleSend = useCallback(async function() {
    setSending(true);
    setModal(null);

    const result = await window.sendScenarioLink({
      clientId:      null,           // we don't store client's Supabase auth ID here
      clientEmail,
      clientPhone:   clientPhone || null,
      clientName,
      contactId:     scenario.contact_id || null,
      scenarioId:    scenario.id,
      scenarioName:  scenario.name || "Your Scenario",
      destination,
      createdByName: user.name || "Your Loan Officer",
    });

    setSending(false);
    setModal({
      url:        result.url,
      isExisting: result.isExisting,
      error:      result.error ? result.error.message : null,
      clientName,
      clientEmail,
    });
  }, [clientEmail, clientPhone, clientName, scenario, destination, user]);

  const handleCopy = useCallback(function() {
    if (!modal || !modal.url) return;
    navigator.clipboard.writeText(modal.url).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    }).catch(function() {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = modal.url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    });
  }, [modal]);

  return (
    <React.Fragment>
      {/* ── Live Session invite button ── */}
      <button
        onClick={handleSendLive}
        disabled={sendingLive}
        title={"Email live session link to " + clientName}
        style={{
          display:     "flex",
          alignItems:  "center",
          gap:         6,
          padding:     "7px 14px",
          borderRadius: 8,
          border:      "none",
          background:  sendingLive ? "rgba(255,255,255,0.12)" : "rgba(52,211,153,0.85)",
          color:       sendingLive ? "#fff" : "#064E3B",
          fontSize:    12,
          fontWeight:  700,
          fontFamily:  _font,
          cursor:      sendingLive ? "wait" : "pointer",
          whiteSpace:  "nowrap",
          transition:  "background 0.2s",
          flexShrink:  0,
        }}
      >
        {sendingLive
          ? <React.Fragment><span style={{ fontSize: 14 }}>⏳</span> Sending…</React.Fragment>
          : <React.Fragment><span style={{ fontSize: 14 }}>📡</span> Live Session</React.Fragment>
        }
      </button>

      {/* ── Trigger button ── */}
      <button
        onClick={handleSend}
        disabled={sending}
        title={"Send " + destLabel + " link to " + clientName}
        style={{
          display:     "flex",
          alignItems:  "center",
          gap:         6,
          padding:     "7px 14px",
          borderRadius: 8,
          border:      "none",
          background:  sending ? "rgba(255,255,255,0.12)" : "rgba(72,160,206,0.85)",
          color:       "#fff",
          fontSize:    12,
          fontWeight:  700,
          fontFamily:  _font,
          cursor:      sending ? "wait" : "pointer",
          whiteSpace:  "nowrap",
          transition:  "background 0.2s",
          flexShrink:  0,
        }}
      >
        {sending
          ? <React.Fragment><span style={{ fontSize: 14 }}>⏳</span> Sending…</React.Fragment>
          : <React.Fragment><span style={{ fontSize: 14 }}>📧</span> Notify Client</React.Fragment>
        }
      </button>

      {/* ── Live Session result modal ── */}
      {liveModal && (
        <div
          onClick={function(e) { if (e.target === e.currentTarget) setLiveModal(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.22)", padding: "32px 28px 24px", maxWidth: 480, width: "100%", fontFamily: _font }}>
            {liveModal.error
              ? <React.Fragment>
                  <div style={{ fontSize: 28, textAlign: "center", marginBottom: 10 }}>⚠️</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#064E3B", textAlign: "center", margin: "0 0 8px" }}>Link ready — email may not have sent</h3>
                  <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>{liveModal.error}</p>
                </React.Fragment>
              : <React.Fragment>
                  <div style={{ fontSize: 28, textAlign: "center", marginBottom: 10 }}>📡</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#064E3B", textAlign: "center", margin: "0 0 4px" }}>Live Session invite sent!</h3>
                  <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>
                    Email sent to <strong style={{ color: "#064E3B" }}>{liveModal.clientName}</strong>. When they open the link and load their scenario, you'll both be connected automatically.
                  </p>
                </React.Fragment>
            }
            {liveModal.url && (
              <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 8, padding: "10px 12px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 11, color: "#374151", wordBreak: "break-all", lineHeight: 1.4, fontFamily: "monospace" }}>{liveModal.url}</span>
                <button
                  onClick={function() {
                    navigator.clipboard.writeText(liveModal.url).then(function() { setLiveCopied(true); setTimeout(function() { setLiveCopied(false); }, 2000); }).catch(function() {});
                  }}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 6, border: "none", background: liveCopied ? "#22c55e" : "#064E3B", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: _font, cursor: "pointer", transition: "background 0.2s" }}
                >{liveCopied ? "Copied ✓" : "Copy"}</button>
              </div>
            )}
            <button onClick={function() { setLiveModal(null); }} style={{ display: "block", width: "100%", padding: "11px 16px", borderRadius: 8, border: "1.5px solid #D1D9E0", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, fontFamily: _font, cursor: "pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Result modal ── */}
      {modal && (
        <div
          onClick={function(e) { if (e.target === e.currentTarget) setModal(null); }}
          style={{
            position:   "fixed", inset: 0, zIndex: 99998,
            background: "rgba(0,0,0,0.55)",
            display:    "flex", alignItems: "center", justifyContent: "center",
            padding:    16,
          }}
        >
          <div style={{
            background:   "#fff",
            borderRadius: 14,
            boxShadow:    "0 8px 40px rgba(0,0,0,0.22)",
            padding:      "32px 28px 24px",
            maxWidth:     480,
            width:        "100%",
            fontFamily:   _font,
          }}>
            {/* Header */}
            {modal.error
              ? <React.Fragment>
                  <div style={{ fontSize: 28, textAlign: "center", marginBottom: 10 }}>⚠️</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0C4160", textAlign: "center", margin: "0 0 8px" }}>
                    {modal.url ? "Link created — email failed" : "Something went wrong"}
                  </h3>
                  <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>
                    {modal.error}
                  </p>
                </React.Fragment>
              : <React.Fragment>
                  <div style={{ fontSize: 28, textAlign: "center", marginBottom: 10 }}>✅</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0C4160", textAlign: "center", margin: "0 0 4px" }}>
                    {modal.isExisting ? "Link resent!" : "Link sent!"}
                  </h3>
                  <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", margin: "0 0 16px", lineHeight: 1.5 }}>
                    {destLabel} link emailed to{" "}
                    <strong style={{ color: "#0C4160" }}>{modal.clientName || modal.clientEmail}</strong>
                    {modal.isExisting && <React.Fragment><br /><span style={{ fontSize: 11 }}>(existing link reused — not expired)</span></React.Fragment>}
                  </p>
                </React.Fragment>
            }

            {/* URL box + copy button */}
            {modal.url && (
              <div style={{
                background:   "#F4F7F8",
                border:       "1.5px solid #E0E8E8",
                borderRadius: 8,
                padding:      "10px 12px",
                marginBottom: 16,
                display:      "flex",
                alignItems:   "center",
                gap:          8,
              }}>
                <span style={{
                  flex:       1,
                  fontSize:   11,
                  color:      "#374151",
                  wordBreak:  "break-all",
                  lineHeight: 1.4,
                  fontFamily: "monospace",
                }}>
                  {modal.url}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    flexShrink:   0,
                    padding:      "6px 12px",
                    borderRadius: 6,
                    border:       "none",
                    background:   copied ? "#22c55e" : "#0C4160",
                    color:        "#fff",
                    fontSize:     11,
                    fontWeight:   700,
                    fontFamily:   _font,
                    cursor:       "pointer",
                    transition:   "background 0.2s",
                  }}
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            )}

            {/* Close */}
            <button
              onClick={function() { setModal(null); }}
              style={{
                display:      "block",
                width:        "100%",
                padding:      "11px 16px",
                borderRadius: 8,
                border:       "1.5px solid #D1D9E0",
                background:   "#fff",
                color:        "#374151",
                fontSize:     13,
                fontWeight:   600,
                fontFamily:   _font,
                cursor:       "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

window.NotifyClientButton = NotifyClientButton;
