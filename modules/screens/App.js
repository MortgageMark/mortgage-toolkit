// modules/screens/App.js
const { useState, useEffect, useCallback, useRef, useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const LoginScreen = window.LoginScreen;
const ScenarioDashboard = window.ScenarioDashboard;
const ContactsTab = window.ContactsTab;
const MortgageToolkit = window.MortgageToolkit;
const supabase = window._supabaseClient;
const restoreCalculatorData = window.restoreCalculatorData;
const saveScenarioData = window.saveScenarioData;
const snapshotCalculatorData = window.snapshotCalculatorData;
const diffCalculatorData = window.diffCalculatorData;
const saveScenarioToSupabase = window.saveScenarioToSupabase;
const writeAuditLog = window.writeAuditLog;

const _font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ── DisclaimerModal ───────────────────────────────────────────────────────────
// Full-screen overlay shown once per browser session (sessionStorage-gated).
// All interaction with the page behind it is blocked until the checkbox is
// checked and the "I Understand" button is clicked.
function DisclaimerModal({ onAck }) {
  const [checked, setChecked] = React.useState(false);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
      overflowY: "auto",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 16px 56px rgba(0,0,0,0.36)",
        padding: "36px 32px",
        maxWidth: 600,
        width: "100%",
        maxHeight: "90vh",
        overflowY: "auto",
        fontFamily: _font,
        boxSizing: "border-box",
      }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
          <h2 style={{
            fontSize: 22, fontWeight: 800, color: "#0C4160",
            margin: "0 0 10px 0", fontFamily: _font,
          }}>
            Important Disclosures
          </h2>
          <div style={{ width: 48, height: 3, background: "#C9A84C", margin: "0 auto", borderRadius: 2 }} />
        </div>

        {/* Body */}
        <div style={{
          fontSize: 13, color: "#3D5166", lineHeight: 1.75,
          fontFamily: _font, marginBottom: 22,
        }}>
          <p style={{ marginTop: 0 }}>
            The information provided in this toolkit is for educational and informational
            purposes only and does not constitute financial, legal, or tax advice. Results,
            calculations, and estimates are based on information you provide and are intended
            to illustrate general mortgage concepts only.
          </p>
          <p>
            This is not a commitment to lend, a pre-approval, or a guarantee of financing.
            All loans are subject to underwriting review and approval, and not all applicants
            will qualify. Interest rates and APRs shown are illustrative only, subject to
            change without notice, and do not constitute a rate lock.
          </p>
          <p>
            Calculations shown do not account for taxes, insurance, HOA dues, PMI, or other
            fees that may affect your actual payment obligation. Refinance analysis results
            assume consistent payments and do not account for selling or paying off the loan
            before the estimated break-even date. Adjustable-rate mortgage estimates are
            subject to change after the initial fixed period and may increase significantly.
          </p>
          <p style={{ marginBottom: 0 }}>
            Results presented do not constitute a pre-qualification or pre-approval and are
            not based on a full review of your credit, income, assets, or employment.
          </p>
        </div>

        {/* Checkbox */}
        <label style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          cursor: "pointer", marginBottom: 22,
          padding: "14px 16px",
          background: checked ? "#EBF5FB" : "#F7FAFB",
          border: `1.5px solid ${checked ? "#48A0CE" : "#D1D9E0"}`,
          borderRadius: 10,
          transition: "border-color 0.15s, background 0.15s",
        }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            style={{
              marginTop: 2, width: 18, height: 18,
              cursor: "pointer", accentColor: "#0C4160", flexShrink: 0,
            }}
          />
          <span style={{
            fontSize: 13, color: "#0C4160", fontFamily: _font,
            lineHeight: 1.6, fontWeight: 500,
          }}>
            I understand that this toolkit is for educational purposes only and does not
            constitute financial advice, a commitment to lend, or a guarantee of financing.
          </span>
        </label>

        {/* CTA button */}
        <button
          onClick={checked ? onAck : undefined}
          disabled={!checked}
          style={{
            display: "block", width: "100%",
            padding: "14px 24px", borderRadius: 10, border: "none",
            background: checked
              ? "linear-gradient(135deg, #0C4160 0%, #1A5E8A 100%)"
              : "#C8D4DC",
            color: checked ? "#fff" : "#8A9BAA",
            fontSize: 15, fontWeight: 700,
            fontFamily: _font,
            cursor: checked ? "pointer" : "not-allowed",
            transition: "background 0.2s, color 0.2s",
            letterSpacing: "0.02em",
          }}
        >
          I Understand — Let Me In
        </button>

        {/* Footer inside modal */}
        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid #E5EEF4",
          textAlign: "center",
          fontSize: 11,
          color: "#8A9BAA",
          fontFamily: _font,
          lineHeight: 1.7,
        }}>
          Mark Pfeiffer | NMLS #729612 | CMG Home Loans | NMLS #1820<br />
          Equal Housing Lender | Not affiliated with HUD or any government agency.<br />
          NMLS Consumer Access: www.nmlsconsumeraccess.org
        </div>

      </div>
    </div>
  );
}

// ── PersistentFooter ──────────────────────────────────────────────────────────
// Fixed disclaimer strip always visible at the bottom of the viewport.
function PersistentFooter() {
  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      zIndex: 9000,
      background: "rgba(10, 34, 56, 0.94)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      borderTop: "1px solid rgba(255,255,255,0.10)",
      padding: "6px 20px",
      textAlign: "center",
      fontSize: 11,
      color: "rgba(255,255,255,0.68)",
      fontFamily: _font,
      lineHeight: 1.55,
    }}>
      Not a commitment to lend. All loans subject to credit approval and underwriting.
      Rates shown are estimates only and subject to change without notice.{" "}
      Mark Pfeiffer | NMLS #729612 | CMG Home Loans | NMLS #1820 | Equal Housing Lender |{" "}
      NMLS Consumer Access: www.nmlsconsumeraccess.org
    </div>
  );
}

// ── BorrowerProfileSetup ──────────────────────────────────────────────────────
// Shown to a newly signed-up borrower/realtor so they can complete their
// contact record (address, phone, etc.) before reaching the Scenario Dashboard.
function BorrowerProfileSetup({ user, contactId, onComplete }) {
  const supa = window._supabaseClient;
  const [address, setAddress] = React.useState("");
  const [city,    setCity]    = React.useState("");
  const [stateAb, setStateAb] = React.useState("");
  const [zip,     setZip]     = React.useState("");
  const [saving,  setSaving]  = React.useState(false);
  const [err,     setErr]     = React.useState("");

  const inputSt = {
    width: "100%", padding: "11px 13px",
    border: "1.5px solid #D1D9E0", borderRadius: 8,
    fontSize: 14, fontFamily: _font, color: "#0C4160",
    background: "#F7FAFB", outline: "none", boxSizing: "border-box",
  };
  const labelSt = {
    display: "block", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.09em", textTransform: "uppercase",
    color: "#6B7D8A", marginBottom: 4, fontFamily: _font,
  };

  const handleSave = async () => {
    setSaving(true); setErr("");
    if (supa && contactId) {
      const { error: updateErr } = await supa.from("contacts").update({
        address: address.trim() || null,
        city:    city.trim()    || null,
        state:   stateAb.trim() || null,
        zip:     zip.trim()     || null,
      }).eq("id", contactId);
      if (updateErr) {
        setErr("Couldn't save — your info was still recorded. Click Continue.");
        console.warn("Profile update failed:", updateErr.message);
      }
    }
    setSaving(false);
    onComplete();
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0C4160 0%, #164E72 40%, #48A0CE 100%)",
      padding: 20, fontFamily: _font,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        padding: "36px 32px", maxWidth: 440, width: "100%",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0C4160", margin: "0 0 6px 0", fontFamily: _font }}>
            Welcome, {(user && user.name) ? user.name.split(" ")[0] : "there"}!
          </h2>
          <p style={{ fontSize: 13, color: "#6B7D8A", margin: 0, lineHeight: 1.5, fontFamily: _font }}>
            Your account is all set. Please add a few more details so your
            loan officer can reach you easily.
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelSt}>HOME ADDRESS</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              style={inputSt} placeholder="123 Main St" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={labelSt}>CITY</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)}
                style={inputSt} placeholder="Austin" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>STATE</label>
              <input type="text" value={stateAb} onChange={e => setStateAb(e.target.value)}
                style={inputSt} placeholder="TX" maxLength={2} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>ZIP</label>
              <input type="text" value={zip} onChange={e => setZip(e.target.value)}
                style={inputSt} placeholder="78701" maxLength={10} />
            </div>
          </div>
        </div>

        {err && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#c0392b", fontFamily: _font }}>{err}</div>
        )}

        {/* Actions */}
        <button onClick={handleSave} disabled={saving} style={{
          display: "block", width: "100%", marginTop: 20,
          padding: "13px 24px", borderRadius: 10, border: "none",
          background: saving ? "#94A3B0" : "linear-gradient(135deg, #0C4160, #164E72)",
          color: "#fff", fontSize: 15, fontWeight: 700,
          fontFamily: _font, cursor: saving ? "wait" : "pointer",
        }}>
          {saving ? "Saving…" : "Save & Continue →"}
        </button>
        <button onClick={onComplete} style={{
          display: "block", width: "100%", marginTop: 10,
          background: "none", border: "none",
          fontSize: 12, color: "#94A3B0", fontFamily: _font,
          cursor: "pointer", textDecoration: "underline",
        }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ── ClientMyInfoPanel ─────────────────────────────────────────────────────────
// Full-page screen for a borrower/client to view and edit their own contact record.
// Fetches from Supabase contacts (RLS returns only their own row), saves back via update.

// Phone helpers (module-scope so they don't re-create on every render)
function _mipFmtPhone(raw) {
  var d = (raw || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  if (d.length <= 3) return "(" + d;
  if (d.length <= 6) return "(" + d.slice(0,3) + ") " + d.slice(3);
  return "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6);
}
function _mipPhoneOk(v) {
  var d = (v || "").replace(/\D/g, "");
  return d.length === 0 || d.length === 10;
}
function _mipEmailOk(v) {
  var s = (v || "").trim();
  return !s || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function ClientMyInfoPanel({ user, onClose, onLogout }) {
  const supa = window._supabaseClient;
  const [contact,       setContact]      = React.useState(null);
  const [loading,       setLoading]      = React.useState(true);
  const [saving,        setSaving]       = React.useState(false);
  const [saveMsg,       setSaveMsg]      = React.useState("");
  const [fieldErrs,     setFieldErrs]    = React.useState({});

  // Primary borrower fields
  const [firstName,     setFirstName]     = React.useState("");
  const [lastName,      setLastName]      = React.useState("");
  const [phoneCell,     setPhoneCell]     = React.useState("");
  const [phoneHome,     setPhoneHome]     = React.useState("");
  const [phoneWork,     setPhoneWork]     = React.useState("");
  const [phoneBest,     setPhoneBest]     = React.useState("cell");
  const [emailPersonal, setEmailPersonal] = React.useState("");
  const [emailWork,     setEmailWork]     = React.useState("");
  const [address1,      setAddress1]      = React.useState("");
  const [city1,         setCity1]         = React.useState("");
  const [state1,        setState1]        = React.useState("");
  const [zip1,          setZip1]          = React.useState("");

  // Co-borrower / spouse
  const [showCoBorrower, setShowCoBorrower] = React.useState(false);
  const [cbFirstName,    setCbFirstName]    = React.useState("");
  const [cbLastName,     setCbLastName]     = React.useState("");
  const [cbPhone,        setCbPhone]        = React.useState("");
  const [cbEmail,        setCbEmail]        = React.useState("");
  const [cbRelation,     setCbRelation]     = React.useState("Spouse");

  // Fetch own contact on mount (RLS ensures only their record comes back)
  React.useEffect(function() {
    if (!supa) { setLoading(false); return; }
    supa.from("contacts").select("*").limit(5)
      .then(function({ data, error }) {
        if (!error && data && data.length > 0) {
          var c = data[0];
          setContact(c);
          setFirstName(c.first_name || "");
          setLastName(c.last_name || "");
          setPhoneCell(_mipFmtPhone(c.phone_cell || c.phone || ""));
          setPhoneHome(_mipFmtPhone(c.phone_home || ""));
          setPhoneWork(_mipFmtPhone(c.phone_work || ""));
          setPhoneBest(c.phone_best || "cell");
          setEmailPersonal(c.email_personal || c.email || (user && user.email) || "");
          setEmailWork(c.email_work || "");
          setAddress1(c.address1_street || c.address || "");
          setCity1(c.address1_city || c.city || "");
          setState1(c.address1_state || c.state || "");
          setZip1(c.address1_zip || c.zip || "");
          // Co-borrower (stored in co_borrower_data jsonb column)
          var cb = c.co_borrower_data || {};
          if (cb.firstName || cb.lastName) {
            setShowCoBorrower(true);
            setCbFirstName(cb.firstName || "");
            setCbLastName(cb.lastName || "");
            setCbPhone(_mipFmtPhone(cb.phone || ""));
            setCbEmail(cb.email || "");
            setCbRelation(cb.relation || "Spouse");
          }
        }
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }, []);

  var handleSave = function() {
    if (!contact || !supa) return;
    // Validate — phones must be empty or exactly 10 digits; emails must be valid format
    var errs = {};
    if (!_mipPhoneOk(phoneCell))     errs.phoneCell     = "Must be 10 digits";
    if (!_mipPhoneOk(phoneHome))     errs.phoneHome     = "Must be 10 digits";
    if (!_mipPhoneOk(phoneWork))     errs.phoneWork     = "Must be 10 digits";
    if (!_mipEmailOk(emailPersonal)) errs.emailPersonal = "Invalid email format";
    if (!_mipEmailOk(emailWork))     errs.emailWork     = "Invalid email format";
    if (showCoBorrower) {
      if (!_mipPhoneOk(cbPhone)) errs.cbPhone = "Must be 10 digits";
      if (!_mipEmailOk(cbEmail)) errs.cbEmail = "Invalid email format";
    }
    if (Object.keys(errs).length > 0) { setFieldErrs(errs); return; }
    setFieldErrs({});
    setSaving(true); setSaveMsg("");

    var cbData = (showCoBorrower && (cbFirstName.trim() || cbLastName.trim())) ? {
      firstName: cbFirstName.trim(),
      lastName:  cbLastName.trim(),
      phone:     cbPhone.replace(/\D/g,"") || null,
      email:     cbEmail.trim() || null,
      relation:  cbRelation,
    } : null;

    supa.from("contacts").update({
      first_name:       firstName.trim()             || null,
      last_name:        lastName.trim()              || null,
      phone_cell:       phoneCell.replace(/\D/g,"")  || null,
      phone_home:       phoneHome.replace(/\D/g,"")  || null,
      phone_work:       phoneWork.replace(/\D/g,"")  || null,
      phone_best:       phoneBest                    || null,
      email_personal:   emailPersonal.trim()         || null,
      email_work:       emailWork.trim()             || null,
      address1_street:  address1.trim()              || null,
      address1_city:    city1.trim()                 || null,
      address1_state:   state1.trim()                || null,
      address1_zip:     zip1.trim()                  || null,
      co_borrower_data: cbData,
    }).eq("id", contact.id)
      .then(function({ error }) {
        setSaving(false);
        if (error) { setSaveMsg("error"); }
        else { setSaveMsg("saved"); setTimeout(function() { setSaveMsg(""); }, 3000); }
      })
      .catch(function() { setSaving(false); setSaveMsg("error"); });
  };

  var iSt = {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid #D1D9E0", borderRadius: 8,
    fontSize: 14, fontFamily: _font, color: "#0C4160",
    background: "#F7FAFB", outline: "none", boxSizing: "border-box",
  };
  var iErrSt = Object.assign({}, iSt, { borderColor: "#dc2626", background: "#fff8f8" });
  var lSt = {
    display: "block", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.09em", textTransform: "uppercase",
    color: "#6B7D8A", marginBottom: 4, fontFamily: _font,
  };
  var secHead = {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "#1A5E8A",
    margin: "22px 0 10px", fontFamily: _font,
    borderBottom: "1.5px solid #E5EEF4", paddingBottom: 5,
  };
  var errTxt = { fontSize: 11, color: "#dc2626", marginTop: 3, fontFamily: _font };

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8", fontFamily: _font, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0C4160 0%, #1A5E8A 100%)",
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, color: "#fff",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>My Information</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>View and update your contact details</div>
        </div>
        <button onClick={onClose} style={{
          background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)",
          color: "#fff", borderRadius: 8, padding: "7px 16px",
          fontSize: 13, cursor: "pointer", fontFamily: _font, fontWeight: 600,
        }}>← Back</button>
        {onLogout && (
          <button onClick={onLogout} style={{
            background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.25)",
            color: "rgba(255,255,255,0.85)", borderRadius: 8, padding: "7px 14px",
            fontSize: 12, cursor: "pointer", fontFamily: _font, marginLeft: 8,
          }}>Logout</button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 680, margin: "32px auto", padding: "0 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#6B7D8A", fontSize: 14 }}>
            Loading your information…
          </div>
        ) : !contact ? (
          <div style={{
            background: "#fff", borderRadius: 12, padding: "40px 28px",
            textAlign: "center", color: "#6B7D8A", fontSize: 14,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, color: "#0C4160", marginBottom: 8, fontSize: 16 }}>
              No contact record found
            </div>
            <div style={{ lineHeight: 1.6 }}>
              Your loan officer hasn't linked a contact record to your account yet.
              Please reach out to them to get your profile set up.
            </div>
          </div>
        ) : (
          <div style={{
            background: "#fff", borderRadius: 12,
            boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            padding: "28px 28px",
          }}>

            {/* ── Name ── */}
            <div style={secHead}>Name</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lSt}>First Name</label>
                <input value={firstName} onChange={function(e) { setFirstName(e.target.value); }} style={iSt} placeholder="First name" />
              </div>
              <div>
                <label style={lSt}>Last Name</label>
                <input value={lastName} onChange={function(e) { setLastName(e.target.value); }} style={iSt} placeholder="Last name" />
              </div>
            </div>

            {/* ── Phone ── */}
            <div style={secHead}>Phone</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={lSt}>Cell</label>
                <input type="tel" value={phoneCell}
                  onChange={function(e) { setPhoneCell(_mipFmtPhone(e.target.value)); setFieldErrs(function(p) { var n={...p}; delete n.phoneCell; return n; }); }}
                  style={fieldErrs.phoneCell ? iErrSt : iSt} placeholder="(555) 555-5555" maxLength={14} />
                {fieldErrs.phoneCell && <div style={errTxt}>⚠ {fieldErrs.phoneCell}</div>}
              </div>
              <div>
                <label style={lSt}>Home</label>
                <input type="tel" value={phoneHome}
                  onChange={function(e) { setPhoneHome(_mipFmtPhone(e.target.value)); setFieldErrs(function(p) { var n={...p}; delete n.phoneHome; return n; }); }}
                  style={fieldErrs.phoneHome ? iErrSt : iSt} placeholder="(555) 555-5555" maxLength={14} />
                {fieldErrs.phoneHome && <div style={errTxt}>⚠ {fieldErrs.phoneHome}</div>}
              </div>
              <div>
                <label style={lSt}>Work</label>
                <input type="tel" value={phoneWork}
                  onChange={function(e) { setPhoneWork(_mipFmtPhone(e.target.value)); setFieldErrs(function(p) { var n={...p}; delete n.phoneWork; return n; }); }}
                  style={fieldErrs.phoneWork ? iErrSt : iSt} placeholder="(555) 555-5555" maxLength={14} />
                {fieldErrs.phoneWork && <div style={errTxt}>⚠ {fieldErrs.phoneWork}</div>}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={lSt}>Best Number to Reach You</label>
              <select value={phoneBest} onChange={function(e) { setPhoneBest(e.target.value); }} style={{ ...iSt, background: "#fff" }}>
                <option value="cell">Cell</option>
                <option value="home">Home</option>
                <option value="work">Work</option>
              </select>
            </div>

            {/* ── Email ── */}
            <div style={secHead}>Email</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lSt}>Personal Email</label>
                <input type="email" value={emailPersonal}
                  onChange={function(e) { setEmailPersonal(e.target.value); setFieldErrs(function(p) { var n={...p}; delete n.emailPersonal; return n; }); }}
                  style={fieldErrs.emailPersonal ? iErrSt : iSt} placeholder="you@example.com" />
                {fieldErrs.emailPersonal
                  ? <div style={errTxt}>⚠ {fieldErrs.emailPersonal}</div>
                  : <div style={{ fontSize: 11, color: "#94A3B0", fontStyle: "italic", marginTop: 3 }}>
                      Login: {user && user.email}
                    </div>
                }
              </div>
              <div>
                <label style={lSt}>Work Email</label>
                <input type="email" value={emailWork}
                  onChange={function(e) { setEmailWork(e.target.value); setFieldErrs(function(p) { var n={...p}; delete n.emailWork; return n; }); }}
                  style={fieldErrs.emailWork ? iErrSt : iSt} placeholder="you@company.com" />
                {fieldErrs.emailWork && <div style={errTxt}>⚠ {fieldErrs.emailWork}</div>}
              </div>
            </div>

            {/* ── Home Address ── */}
            <div style={secHead}>Home Address</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={lSt}>Street Address</label>
                <input value={address1} onChange={function(e) { setAddress1(e.target.value); }} style={iSt} placeholder="123 Main St" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lSt}>City</label>
                  <input value={city1} onChange={function(e) { setCity1(e.target.value); }} style={iSt} placeholder="Austin" />
                </div>
                <div>
                  <label style={lSt}>State</label>
                  <input value={state1} onChange={function(e) { setState1(e.target.value); }} style={iSt} placeholder="TX" maxLength={2} />
                </div>
                <div>
                  <label style={lSt}>ZIP</label>
                  <input value={zip1} onChange={function(e) { setZip1(e.target.value); }} style={iSt} placeholder="78701" maxLength={10} />
                </div>
              </div>
            </div>

            {/* ── Co-Borrower / Spouse ── */}
            <div style={{ marginTop: 24 }}>
              <button
                onClick={function() {
                  var next = !showCoBorrower;
                  setShowCoBorrower(next);
                  if (!next) {
                    setCbFirstName(""); setCbLastName(""); setCbPhone(""); setCbEmail(""); setCbRelation("Spouse");
                    setFieldErrs(function(p) { var n={...p}; delete n.cbPhone; delete n.cbEmail; return n; });
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "10px 16px", borderRadius: 8,
                  border: "1.5px solid " + (showCoBorrower ? "#48A0CE" : "#D1D9E0"),
                  background: showCoBorrower ? "#EBF5FB" : "#F7FAFB",
                  color: showCoBorrower ? "#0C4160" : "#6B7D8A",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: _font,
                }}
              >
                <span>{showCoBorrower ? "👫 Co-Borrower / Spouse" : "➕ Add Co-Borrower / Spouse"}</span>
                <span style={{ fontSize: 11, opacity: 0.65 }}>{showCoBorrower ? "▲ Remove" : "▼ Add"}</span>
              </button>

              {showCoBorrower && (
                <div style={{
                  border: "1.5px solid #D1DEE8", borderTop: "none",
                  borderRadius: "0 0 8px 8px", padding: "16px 16px 12px",
                  background: "#F9FBFD",
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={lSt}>First Name</label>
                      <input value={cbFirstName} onChange={function(e) { setCbFirstName(e.target.value); }} style={iSt} placeholder="First name" />
                    </div>
                    <div>
                      <label style={lSt}>Last Name</label>
                      <input value={cbLastName} onChange={function(e) { setCbLastName(e.target.value); }} style={iSt} placeholder="Last name" />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lSt}>Relationship</label>
                    <select value={cbRelation} onChange={function(e) { setCbRelation(e.target.value); }} style={{ ...iSt, background: "#fff" }}>
                      <option value="Spouse">Spouse</option>
                      <option value="Partner">Partner</option>
                      <option value="Co-Borrower">Co-Borrower</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lSt}>Phone</label>
                      <input type="tel" value={cbPhone}
                        onChange={function(e) { setCbPhone(_mipFmtPhone(e.target.value)); setFieldErrs(function(p) { var n={...p}; delete n.cbPhone; return n; }); }}
                        style={fieldErrs.cbPhone ? iErrSt : iSt} placeholder="(555) 555-5555" maxLength={14} />
                      {fieldErrs.cbPhone && <div style={errTxt}>⚠ {fieldErrs.cbPhone}</div>}
                    </div>
                    <div>
                      <label style={lSt}>Email</label>
                      <input type="email" value={cbEmail}
                        onChange={function(e) { setCbEmail(e.target.value); setFieldErrs(function(p) { var n={...p}; delete n.cbEmail; return n; }); }}
                        style={fieldErrs.cbEmail ? iErrSt : iSt} placeholder="spouse@example.com" />
                      {fieldErrs.cbEmail && <div style={errTxt}>⚠ {fieldErrs.cbEmail}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Save ── */}
            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <button onClick={handleSave} disabled={saving} style={{
                padding: "12px 32px", borderRadius: 9, border: "none",
                background: saving ? "#94A3B0" : "linear-gradient(135deg, #0C4160, #1A5E8A)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                fontFamily: _font, cursor: saving ? "wait" : "pointer",
                boxShadow: saving ? "none" : "0 2px 8px rgba(12,65,96,0.25)",
              }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
              {saveMsg === "saved" && (
                <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 600 }}>✅ Saved!</span>
              )}
              {saveMsg === "error" && (
                <span style={{ color: "#dc2626", fontSize: 13 }}>Save failed — please try again.</span>
              )}
              {Object.keys(fieldErrs).length > 0 && !saveMsg && (
                <span style={{ color: "#dc2626", fontSize: 13 }}>⚠ Please fix the errors above first.</span>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [loggedInUser, setLoggedInUser] = useLocalStorage("app_user", null);
  const [activeScenario, setActiveScenario] = useLocalStorage("active_scenario", null);
  const scenarioSnapshotRef = useRef(null); // before-snapshot for audit diffing
  const [authLoading, setAuthLoading] = React.useState(true);
  const [showContacts, setShowContacts] = React.useState(false);
  const [pendingContactId, setPendingContactId] = React.useState(null);
  const [showProfileSetup, setShowProfileSetup] = React.useState(false);
  const [profileContactId, setProfileContactId] = React.useState(null);
  const [showMyInfo,       setShowMyInfo]        = React.useState(false);
  const [showUsers,        setShowUsers]         = React.useState(false);

  // ── Magic link / view token ────────────────────────────────────────────────
  // Read on first render from URL params + sessionStorage (set by view.html).
  // Stored in a ref so it survives re-renders without triggering extra effects.
  const viewTokenDataRef = React.useRef(null);
  const [viewPrefill, setViewPrefill] = React.useState(null); // { clientName, clientEmail, loName }

  React.useEffect(function() {
    var params = new URLSearchParams(window.location.search);
    var viewToken = params.get("view_token");
    var dest      = params.get("dest");
    if (!viewToken) return;

    // Read token data stored by view.html
    var raw = null;
    try { raw = sessionStorage.getItem("mtk_view_token_data"); } catch(e) {}
    var tokenData = null;
    try { tokenData = raw ? JSON.parse(raw) : null; } catch(e) {}

    if (tokenData) {
      viewTokenDataRef.current = tokenData;
      // Override destination from URL param if provided (more reliable)
      if (dest) viewTokenDataRef.current.destination = dest;
      setViewPrefill({
        clientName:  tokenData.clientName  || "",
        clientEmail: tokenData.clientEmail || "",
        loName:      tokenData.loName      || "Your Loan Officer",
      });
    }

    // Clean the URL so the params don't persist on refresh
    var cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  // Disclaimer: shown once per browser session. sessionStorage clears on tab/browser close.
  const [disclaimerAcked, setDisclaimerAcked] = React.useState(
    () => sessionStorage.getItem("disclaimer_acknowledged") === "true"
  );
  const handleAckDisclaimer = () => {
    sessionStorage.setItem("disclaimer_acknowledged", "true");
    setDisclaimerAcked(true);
  };

  // ── Supabase session restoration on mount ──────────────────────────
  useEffect(function() {
    let cancelled = false;

    async function restoreSession() {
      try {
        if (!supabase) {
          if (!cancelled) setAuthLoading(false);
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user && !cancelled) {
          const user = session.user;
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (profile && !cancelled) {
            const role = profile.role || "borrower";
            const displayName = profile.display_name || user.email;
            const isInternal = ["super_admin", "admin", "branch_admin", "internal"].includes(role);

            setLoggedInUser({
              id: user.id,
              name: displayName,
              role: role,
              email: user.email,
              isInternal: isInternal,
              supabaseUser: true,
              borrowerPermissions: profile.borrower_permissions || [],
            });
          }
        } else if (!cancelled && loggedInUser && loggedInUser.supabaseUser) {
          setLoggedInUser(null);
        }
      } catch (err) {
        console.warn("Session restore error:", err);
      }

      if (!cancelled) setAuthLoading(false);
    }

    restoreSession();
    return function() { cancelled = true; };
  }, []);

  // ── Listen for Supabase auth state changes ────────────────────────
  useEffect(function() {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      function(event, session) {
        if (event === "SIGNED_OUT") {
          setLoggedInUser(null);
          setActiveScenario(null);
        }
      }
    );
    return function() { subscription.unsubscribe(); };
  }, []);

  // ── Session validation (legacy roster users) ────────────────────────
  useEffect(function() {
    if (!loggedInUser || !loggedInUser.id) return;
    if (loggedInUser.supabaseUser) return;
    var r = [];
    try { r = JSON.parse(localStorage.getItem("mtk_roster") || "[]"); } catch(e) {}
    if (r.length > 0 && !r.some(function(m) { return m.id === loggedInUser.id && m.active; })) {
      if (loggedInUser.isInternal) setLoggedInUser(null);
    }
  }, []);

  const isInternal = React.useMemo(() => {
    if (!loggedInUser) return false;
    if (loggedInUser.isInternal === true) return true;
    const INTERNAL_ROLES = ["super_admin", "admin", "branch_admin", "internal"];
    if (loggedInUser.role && INTERNAL_ROLES.includes(loggedInUser.role)) return true;
    if (loggedInUser.supabaseUser) return false;
    try {
      const r = JSON.parse(localStorage.getItem("mtk_roster") || "[]");
      return r.some(m => m.id === loggedInUser.id && m.active);
    } catch { return false; }
  }, [loggedInUser]);

  const handleLogin = (userData) => {
    setLoggedInUser(userData);

    // ── Magic link: auto-load the scenario that was shared ─────────────────
    const td = viewTokenDataRef.current;
    if (td && td.scenario) {
      const calcData = td.scenario.calculation_data || {};
      const scenarioObj = {
        id:              td.scenario.id,
        name:            td.scenario.name || "Your Scenario",
        notes:           td.scenario.notes || "",
        loan_purpose:    td.scenario.loan_purpose || "purchase",
        property_address: td.scenario.property_address || "",
        calculatorData:  calcData,
        status:          "active",
        // Store destination so MortgageToolkit can open the right tab
        _viewDest:       td.destination || "full_scenario",
      };
      // Store destination for MortgageToolkit to read on mount
      try {
        sessionStorage.setItem("mtk_view_dest", td.destination || "full_scenario");
        // Clear token data so it doesn't repeat on next login
        sessionStorage.removeItem("mtk_view_token_data");
      } catch(e) {}
      viewTokenDataRef.current = null;
      setViewPrefill(null);
      handleSelectScenario(scenarioObj);
      return; // skip profile setup / contacts redirect
    }

    // ── Normal login flow ──────────────────────────────────────────────────
    if (userData && userData.newContactId) {
      const userIsInternal = userData.isInternal ||
        ["super_admin", "admin", "branch_admin", "internal"].includes(userData.role);
      if (userIsInternal) {
        setPendingContactId(userData.newContactId);
        setShowContacts(true);
      } else {
        setProfileContactId(userData.newContactId);
        setShowProfileSetup(true);
      }
    }
  };

  const handleLogout = async () => {
    if (loggedInUser && loggedInUser.supabaseUser && supabase) {
      try { await supabase.auth.signOut(); }
      catch (err) { console.warn("Supabase sign-out error:", err); }
    }
    Object.keys(localStorage)
      .filter(k => k.startsWith("mtk_") && k !== "mtk_roster")
      .forEach(k => localStorage.removeItem(k));
    setShowContacts(false);
    setShowProfileSetup(false);
    setShowMyInfo(false);
    setShowUsers(false);
    setProfileContactId(null);
    setActiveScenario(null);
    setLoggedInUser(null);
  };

  const handleSelectScenario = (scenario) => {
    if (scenario === null) {
      restoreCalculatorData({});
      localStorage.setItem("mtk_active_scenario", JSON.stringify({ none: true }));
      scenarioSnapshotRef.current = null;
      setActiveScenario({ none: true });
    } else {
      const calcData = scenario.calculatorData || {};
      restoreCalculatorData(calcData);
      // For borrowers: stash their name on window so DTI Calculator / Pre-Qual
      // can display it even when the About tab has never been filled in.
      // Using window avoids any localStorage timing issues.
      if (loggedInUser && !loggedInUser.isInternal && loggedInUser.name) {
        var _np = loggedInUser.name.trim().split(/\s+/);
        window._mtkBorrowerFn = _np[0] || "";
        window._mtkBorrowerLn = _np.slice(1).join(" ") || "";
      }
      if (!calcData.pc_purpose && scenario.loan_purpose) {
        const mappedPurpose = (scenario.loan_purpose || "").startsWith("refi") ? "refinance" : "purchase";
        localStorage.setItem("mtk_pc_purpose", JSON.stringify(mappedPurpose));
      }
      localStorage.setItem("mtk_active_scenario", JSON.stringify(scenario));
      scenarioSnapshotRef.current = calcData;
      setActiveScenario(scenario);
    }
  };

  const handleBackToScenarios = () => {
    if (activeScenario && activeScenario.id) {
      saveScenarioData(activeScenario.id);

      if (loggedInUser && loggedInUser.supabaseUser && supabase) {
        var afterSnap = snapshotCalculatorData();
        var diff = diffCalculatorData(scenarioSnapshotRef.current, afterSnap);
        var scenarioIdForAudit = activeScenario.id;

        saveScenarioToSupabase({
          scenarioId: activeScenario.id,
          name: activeScenario.clientName || activeScenario.name || "Untitled",
          notes: activeScenario.notes || "",
          status: activeScenario.status || "active"
        }).then(function() {
          if (diff.sections.length > 0) {
            writeAuditLog(
              scenarioIdForAudit,
              "updated",
              diff.details,
              "Changed: " + diff.sections.join(", ")
            );
          }
        }).catch(function(err) {
          console.warn("Cloud save on exit failed:", err);
        });
      }
    }
    setActiveScenario(null);
  };

  // ── Determine page content (single return below) ──────────────────
  const showDashboard = isInternal || (loggedInUser && loggedInUser.supabaseUser);

  let pageContent;

  if (authLoading) {
    pageContent = (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
        color: "#fff",
        fontFamily: _font,
        fontSize: "1.1rem",
      }}>
        Loading…
      </div>
    );
  } else if (!loggedInUser) {
    pageContent = <LoginScreen onLogin={handleLogin} viewPrefill={viewPrefill} />;
  } else if (showProfileSetup) {
    pageContent = (
      <BorrowerProfileSetup
        user={loggedInUser}
        contactId={profileContactId}
        onComplete={function() { setShowProfileSetup(false); setProfileContactId(null); }}
      />
    );
  } else if (showMyInfo) {
    pageContent = (
      <ClientMyInfoPanel
        user={loggedInUser}
        onClose={function() { setShowMyInfo(false); }}
        onLogout={handleLogout}
      />
    );
  } else if (showUsers) {
    pageContent = (
      <UsersPanel
        user={loggedInUser}
        onBack={function() { setShowUsers(false); }}
        onLogout={handleLogout}
      />
    );
  } else if (showContacts) {
    pageContent = (
      <ContactsTab
        user={loggedInUser}
        initialContactId={pendingContactId}
        onBack={function() { setShowContacts(false); setPendingContactId(null); }}
        onLogout={handleLogout}
        onSelectScenario={function(scenario) {
          setShowContacts(false);
          handleSelectScenario(scenario);
        }}
        onUsers={loggedInUser && ["super_admin", "admin"].includes(loggedInUser.role) ? function() { setShowContacts(false); setShowUsers(true); } : null}
      />
    );
  } else if (showDashboard && activeScenario === null) {
    pageContent = (
      <ScenarioDashboard
        user={loggedInUser}
        onSelectScenario={handleSelectScenario}
        onLogout={handleLogout}
        onContacts={isInternal ? function() { setShowContacts(true); } : null}
        onUsers={loggedInUser && loggedInUser.role === "admin" ? function() { setShowUsers(true); } : null}
        onMyInfo={(!isInternal && loggedInUser && loggedInUser.supabaseUser) ? function() { setShowMyInfo(true); } : null}
      />
    );
  } else {
    const currentScenario = activeScenario && activeScenario.none ? null : activeScenario;
    pageContent = (
      <MortgageToolkit
        key={activeScenario && activeScenario.id ? activeScenario.id : "default"}
        user={loggedInUser}
        onLogout={handleLogout}
        activeScenario={currentScenario}
        onBackToScenarios={showDashboard ? handleBackToScenarios : null}
        onOpenContact={isInternal ? function(contactId) { setPendingContactId(contactId); setShowContacts(true); } : null}
        onOpenProfile={!isInternal ? function() { setShowMyInfo(true); } : null}
      />
    );
  }

  // Single return — disclaimer modal overlays everything; footer is always present
  return (
    <React.Fragment>
      {!disclaimerAcked && <DisclaimerModal onAck={handleAckDisclaimer} />}
      {pageContent}
      <PersistentFooter />
    </React.Fragment>
  );
}

window.App = window.App || App;
