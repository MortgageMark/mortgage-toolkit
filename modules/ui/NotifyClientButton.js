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
  const [sending,   setSending]   = useState(false);
  const [modal,     setModal]     = useState(null); // null | { url, isExisting, error, clientName }
  const [copied,    setCopied]    = useState(false);

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
