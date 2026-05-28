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
// Normal flow footer — only visible when scrolled to the bottom.
function PersistentFooter() {
  return (
    <div style={{
      marginTop: 24,
      background: "rgba(10, 34, 56, 0.94)",
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

// ── ChangePasswordScreen ──────────────────────────────────────────────────────
// Shown to borrowers whose account was created by an LO (must_change_password = true).
// Forces them to set a personal password before reaching the dashboard.
function ChangePasswordScreen({ user, onComplete }) {
  const supa = window._supabaseClient;
  const [newPw,     setNewPw]     = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [saving,    setSaving]    = React.useState(false);
  const [err,       setErr]       = React.useState("");

  const inputSt = {
    width: "100%", padding: "12px 14px",
    border: "1.5px solid #E0E8E8", borderRadius: 8,
    fontSize: 15, fontFamily: _font,
    color: "#0C4160", background: "#F7FAFB",
    outline: "none", boxSizing: "border-box",
  };
  const labelSt = {
    display: "block", fontSize: 11, fontWeight: 600,
    letterSpacing: "0.08em", textTransform: "uppercase",
    color: "#6B7D8A", marginBottom: 5, fontFamily: _font,
  };

  const handleSave = async function () {
    setErr("");
    if (newPw.length < 6)      { setErr("Password must be at least 6 characters."); return; }
    if (newPw !== confirmPw)   { setErr("Passwords don't match. Please try again."); return; }
    setSaving(true);
    try {
      const { error: updateErr } = await supa.auth.updateUser({ password: newPw });
      if (updateErr) { setErr(updateErr.message || "Could not update password."); setSaving(false); return; }
      // Clear the flag on their profile
      if (user && user.id) {
        await supa.from("profiles").update({ must_change_password: false }).eq("id", user.id);
      }
      onComplete();
    } catch (e) {
      setErr("Something went wrong. Please try again.");
    }
    setSaving(false);
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
        padding: "36px 32px", maxWidth: 420, width: "100%",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0C4160", margin: "0 0 6px 0", fontFamily: _font }}>
            Welcome{user && user.name ? ", " + user.name.split(" ")[0] : ""}!
          </h2>
          <p style={{ fontSize: 13, color: "#6B7D8A", margin: 0, lineHeight: 1.6, fontFamily: _font }}>
            Your account was set up by your loan officer. Please create a personal password to continue.
          </p>
        </div>

        {/* Fields */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>NEW PASSWORD</label>
          <input
            type="password"
            value={newPw}
            onChange={function (e) { setNewPw(e.target.value); }}
            style={inputSt}
            placeholder="At least 6 characters"
            autoFocus
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>CONFIRM PASSWORD</label>
          <input
            type="password"
            value={confirmPw}
            onChange={function (e) { setConfirmPw(e.target.value); }}
            style={inputSt}
            placeholder="Re-enter password"
            onKeyDown={function (e) { if (e.key === "Enter") handleSave(); }}
          />
        </div>

        {err && (
          <div style={{
            background: "#FEE2E2", border: "1.5px solid #DC2626",
            color: "#B91C1C", padding: "11px 14px", borderRadius: 8,
            fontSize: 13, marginBottom: 14, fontFamily: _font,
          }}>
            {err}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", padding: "14px 24px",
            background: saving
              ? "#94A3B0"
              : "linear-gradient(135deg, #0C4160 0%, #164E72 100%)",
            color: "#fff", border: "none", borderRadius: 10,
            fontSize: 15, fontWeight: 700, fontFamily: _font,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Set Password & Continue →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#94A3B0", fontFamily: _font }}>
          © {new Date().getFullYear()} Mortgage Mark · NMLS #729612
        </div>
      </div>
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
  const [showMyInfo,           setShowMyInfo]           = React.useState(false);
  const [showUsers,            setShowUsers]            = React.useState(false);
  const [showTasksScenarios,   setShowTasksScenarios]   = React.useState(false);
  const [showTasksContacts,    setShowTasksContacts]    = React.useState(false);
  const [showChangePassword,   setShowChangePassword]   = React.useState(false);
  const [sidebarPinned,        setSidebarPinned]        = React.useState(true);
  const [mobileSidebarOpen,    setMobileSidebarOpen]    = React.useState(false);
  const [isMobile,             setIsMobile]             = React.useState(window.innerWidth < 768);
  const [contactView,          setContactView]          = React.useState("internal");
  const [contactsKey,          setContactsKey]          = React.useState(0);
  const [darkMode,             setDarkMode]             = useLocalStorage("app_dark", false);
  const [userRole,             setUserRole]             = useLocalStorage("app_role", "admin");
  const [activeContactInfo,    setActiveContactInfo]    = React.useState(null);

  // ── Mobile resize listener ────────────────────────────────────────────────
  React.useEffect(function() {
    var handler = function() { setIsMobile(window.innerWidth < 768); };
    window.addEventListener("resize", handler);
    return function() { window.removeEventListener("resize", handler); };
  }, []);

  // ── Browser back-button: history state refs ─────────────────────────────
  const _bNavPrev    = React.useRef(null);  // last screen key pushed
  const _bNavFromPop = React.useRef(false); // suppress push when popstate drives nav

  // ── Magic link / view token ────────────────────────────────────────────────
  // Read on first render from URL params + sessionStorage (set by view.html).
  // Stored in a ref so it survives re-renders without triggering extra effects.
  const viewTokenDataRef = React.useRef(null);
  const [viewPrefill, setViewPrefill] = React.useState(null); // { clientName, clientEmail, loName }

  // ── Live session invite ────────────────────────────────────────────────────
  // ?live=SCENARIO_ID in the URL means the LO shared a live-session link.
  // Store it in sessionStorage so it survives the login/signup flow.
  const pendingLiveRef = React.useRef(null);
  const [pendingLive, setPendingLive] = React.useState(false);

  React.useEffect(function() {
    var params = new URLSearchParams(window.location.search);
    var viewToken = params.get("view_token");
    var dest      = params.get("dest");
    var liveId    = params.get("live");

    // Handle ?live= invite link
    if (liveId) {
      pendingLiveRef.current = liveId;
      setPendingLive(true);
      try { sessionStorage.setItem("mtk_pending_live", liveId); } catch(e) {}
    }

    if (!viewToken) {
      if (liveId) window.history.replaceState({}, "", window.location.pathname);
      return;
    }

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

            // Resume force-change if they closed before finishing
            if (profile.must_change_password && !cancelled) {
              setShowChangePassword(true);
            }

            // Sync team roster on every session restore so email_display and other
            // profile fields are always current without requiring a fresh sign-in.
            if (isInternal && supabase && !cancelled) {
              supabase.from("profiles")
                .select("id, display_name, email, email_display, role, nmls, phone, cell_phone, fax, title, company, company_nmls, branch_nmls, website, address, city, state, zip")
                .in("role", ["admin", "internal"])
                .then(function(res) {
                  if (res.error || !res.data) return;
                  var uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                  try {
                    var roster = [];
                    try { roster = JSON.parse(localStorage.getItem("mtk_roster") || "[]"); } catch(e) {}
                    res.data.forEach(function(p) {
                      var idx = roster.findIndex(function(m) { return m.id === p.id; });
                      var entry = {
                        id: p.id,
                        name: p.display_name || p.email || "",
                        email: p.email || "",
                        email_display: p.email_display || "",
                        role: p.role,
                        nmls: p.nmls || "",
                        phone: p.phone || "",
                        cell: p.cell_phone || "",
                        fax: p.fax || "",
                        title: p.title || "",
                        company: p.company || "",
                        companyNMLS: p.company_nmls || "",
                        branchNmls: p.branch_nmls || "",
                        website: p.website || "",
                        address: p.address || "",
                        city: p.city || "",
                        state: p.state || "",
                        zip: p.zip || "",
                        active: true,
                        passwordHash: "supabase-managed",
                      };
                      if (idx >= 0) { roster[idx] = Object.assign({}, roster[idx], entry); }
                      else { roster.push(entry); }
                    });
                    localStorage.setItem("mtk_roster", JSON.stringify(roster));
                    window.dispatchEvent(new Event("storage"));
                  } catch(e) {}
                });
            }
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

    // Always land on the Scenario Dashboard after a fresh login.
    // Magic-link and live-session paths below immediately overwrite this.
    setActiveScenario(null);

    // ── Force password change for LO-created accounts ──────────────────────
    if (userData && userData.mustChangePassword) {
      setShowChangePassword(true);
      return; // don't do any other routing until password is set
    }

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

    // ── Live session invite: fetch scenario and jump straight in ───────────
    var pendingLiveId = null;
    try { pendingLiveId = sessionStorage.getItem("mtk_pending_live"); } catch(e) {}
    if (pendingLiveId) {
      try { sessionStorage.removeItem("mtk_pending_live"); } catch(e) {}
      pendingLiveRef.current = null;
      setPendingLive(false);
      if (supabase) {
        supabase.from("scenarios").select("*").eq("id", pendingLiveId).single()
          .then(function(res) {
            if (res.error || !res.data) return; // scenario not found or no access — fall through to dashboard
            var row = res.data;
            var calcData = (row.calculation_data && typeof row.calculation_data === "object")
              ? row.calculation_data : {};
            handleSelectScenario({
              id:               row.id,
              name:             row.name || "Live Session",
              notes:            row.notes || "",
              loan_purpose:     row.loan_purpose || "purchase",
              property_address: row.property_address || "",
              calculatorData:   calcData,
              status:           row.status || "active",
            });
          })
          .catch(function() {}); // non-fatal — user lands on dashboard if fetch fails
      }
      return;
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
    } else if (userData && userData.role === "borrower" && userData.supabaseUser) {
      // Borrowers (clients) go to their contact card first
      setShowMyInfo(true);
    }
    // LO / Builder / Realtor → fall through to ScenarioDashboard (activeScenario is null)
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
    setShowTasksScenarios(false);
    setShowTasksContacts(false);
    setShowChangePassword(false);
    setProfileContactId(null);
    setActiveScenario(null);
    setLoggedInUser(null);
  };

  const handleSelectScenario = (scenario) => {
    if (scenario === null) {
      restoreCalculatorData({});
      window._mtkInitCalcData = null;
      localStorage.setItem("mtk_active_scenario", JSON.stringify({ none: true }));
      scenarioSnapshotRef.current = null;
      setActiveScenario({ none: true });
    } else {
      const calcData = scenario.calculatorData || {};
      restoreCalculatorData(calcData);
      // DEFINITIVE FIX: expose calcData on window so BuilderTab's useState initializer
      // can read the authoritative scenario value BEFORE any localStorage timing can interfere.
      // This is synchronous — guaranteed to be set before React mounts BuilderTab.
      window._mtkInitCalcData = calcData;
      // For borrowers: stash their name so DTI Calculator / Pre-Qual can display it
      // even when the About tab has never been filled in.
      // Write to localStorage (abt_c1fn/abt_c1ln) so the name survives page reloads.
      // Only fills in if the LO hasn't already set the name via the About tab.
      if (loggedInUser && !loggedInUser.isInternal && loggedInUser.name) {
        var _np = loggedInUser.name.trim().split(/\s+/);
        window._mtkBorrowerFn = _np[0] || "";
        window._mtkBorrowerLn = _np.slice(1).join(" ") || "";
        if (!calcData["abt_c1fn"]) {
          localStorage.setItem("mtk_abt_c1fn", JSON.stringify(_np[0] || ""));
        }
        if (!calcData["abt_c1ln"]) {
          localStorage.setItem("mtk_abt_c1ln", JSON.stringify(_np.slice(1).join(" ") || ""));
        }
      }
      if (!calcData.pc_purpose && scenario.loan_purpose) {
        const mappedPurpose = (scenario.loan_purpose || "").startsWith("refi") ? "refinance" : "purchase";
        localStorage.setItem("mtk_pc_purpose", JSON.stringify(mappedPurpose));
      }
      // Auto-open the right tab: Payment Calculator for purchases, Refi Analyzer for refis
      const _lp = (scenario.loan_purpose || calcData["pc_purpose"] || "").toLowerCase();
      const _isRefi = _lp.startsWith("refi") || _lp === "refinance";
      localStorage.setItem("mtk_app_mod", JSON.stringify(_isRefi ? "refi" : "payment"));
      localStorage.setItem("mtk_active_scenario", JSON.stringify(scenario));
      scenarioSnapshotRef.current = calcData;
      setActiveScenario(scenario);
    }
  };

  // ── Browser back-button support ──────────────────────────────────────────
  // Derive a single key for the currently visible top-level screen.
  var _bNavKey = activeScenario   ? 'scenario'
    : showContacts                ? 'contacts'
    : showTasksScenarios          ? 'tasks-sc'
    : showTasksContacts           ? 'tasks-co'
    : showUsers                   ? 'users'
    : showMyInfo                  ? 'myinfo'
    : 'dashboard';

  // Mount: tag the page-load history entry so popstate can identify it.
  React.useEffect(function() {
    window.history.replaceState({ mtkScreen: 'dashboard' }, '');
    _bNavPrev.current = 'dashboard';
  }, []);

  // Push a new history entry whenever the user navigates to a different screen.
  React.useEffect(function() {
    if (_bNavFromPop.current) { _bNavFromPop.current = false; return; }
    if (_bNavPrev.current === null || _bNavPrev.current === _bNavKey) return;
    window.history.pushState({ mtkScreen: _bNavKey }, '');
    _bNavPrev.current = _bNavKey;
  }, [_bNavKey]); // eslint-disable-line

  // Listen for the browser back (or forward) button.
  React.useEffect(function() {
    function onPop(e) {
      var screen = e.state && e.state.mtkScreen;
      if (!screen) return; // entry is not ours — let the browser leave the page
      _bNavFromPop.current = true;
      _bNavPrev.current = screen;
      // Restore app state to match the history entry being popped to.
      setActiveScenario(null);
      setShowContacts(screen === 'contacts');
      setShowTasksScenarios(screen === 'tasks-sc');
      setShowTasksContacts(screen === 'tasks-co');
      setShowUsers(screen === 'users');
      setShowMyInfo(screen === 'myinfo');
      setPendingContactId(null);
    }
    window.addEventListener('popstate', onPop);
    return function() { window.removeEventListener('popstate', onPop); };
  }, []); // state setters are stable — empty deps is safe
  // ─────────────────────────────────────────────────────────────────────────

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
          status: activeScenario.status || "active",
          calculationData: afterSnap
        }).then(function() {
          if (diff.sections.length > 0) {
            writeAuditLog(
              scenarioIdForAudit,
              "updated",
              diff.details,
              "Changed: " + diff.sections.join(", ")
            );
          }
          setActiveScenario(null);
        }).catch(function(err) {
          console.warn("Cloud save on exit failed:", err);
          setActiveScenario(null);
        });
        return; // setActiveScenario(null) handled inside promise
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
    pageContent = <LoginScreen onLogin={handleLogin} viewPrefill={viewPrefill} pendingLive={pendingLive} />;
  } else if (showChangePassword) {
    pageContent = (
      <ChangePasswordScreen
        user={loggedInUser}
        onComplete={function () { setShowChangePassword(false); }}
      />
    );
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
  } else if (showTasksScenarios && isInternal) {
    pageContent = (
      <ScenarioDashboard
        user={loggedInUser}
        onSelectScenario={function(s) { setShowTasksScenarios(false); handleSelectScenario(s); }}
        onLogout={handleLogout}
        onContacts={isInternal ? function() { setShowTasksScenarios(false); setShowContacts(true); } : null}
        onOpenContact={isInternal ? function(contactId) { setPendingContactId(contactId); setShowTasksScenarios(false); setShowContacts(true); } : null}
        onUsers={loggedInUser && loggedInUser.role === "admin" ? function() { setShowTasksScenarios(false); setShowUsers(true); } : null}
        onMyInfo={null}
        pageTitle="Tasks: Scenarios"
      />
    );
  } else if (showTasksContacts && isInternal) {
    pageContent = (
      <ContactsTab
        key={"tasks-contacts-" + contactsKey}
        user={loggedInUser}
        initialContactId={pendingContactId}
        onBack={function() { setShowTasksContacts(false); setPendingContactId(null); }}
        onLogout={handleLogout}
        onSelectScenario={function(scenario) { setShowTasksContacts(false); handleSelectScenario(scenario); }}
        onUsers={loggedInUser && loggedInUser.role === "admin" ? function() { setShowTasksContacts(false); setShowUsers(true); } : null}
        onTasksScenarios={isInternal ? function() { setShowTasksContacts(false); setShowTasksScenarios(true); } : null}
        activeView={contactView}
        onSetView={setContactView}
        onContactSelected={setActiveContactInfo}
        pageTitle="Tasks: Contacts"
      />
    );
  } else if (showContacts) {
    pageContent = (
      <ContactsTab
        key={"contacts-" + contactsKey}
        user={loggedInUser}
        initialContactId={pendingContactId}
        onBack={function() { setShowContacts(false); setPendingContactId(null); }}
        onLogout={handleLogout}
        onSelectScenario={function(scenario) {
          setShowContacts(false);
          handleSelectScenario(scenario);
        }}
        onUsers={loggedInUser && ["super_admin", "admin"].includes(loggedInUser.role) ? function() { setShowContacts(false); setShowUsers(true); } : null}
        onTasksScenarios={isInternal ? function() { setShowContacts(false); setShowTasksScenarios(true); } : null}
        onTasksContacts={isInternal ? function() { setShowContacts(false); setShowTasksContacts(true); } : null}
        activeView={contactView}
        onSetView={setContactView}
        onContactSelected={setActiveContactInfo}
      />
    );
  } else if (showDashboard && activeScenario === null) {
    pageContent = (
      <ScenarioDashboard
        user={loggedInUser}
        onSelectScenario={handleSelectScenario}
        onLogout={handleLogout}
        onContacts={(isInternal || (loggedInUser && (loggedInUser.role === "realtor" || loggedInUser.role === "builder"))) ? function() { setShowContacts(true); } : null}
        onOpenContact={isInternal ? function(contactId) { setPendingContactId(contactId); setShowContacts(true); } : null}
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
        onOpenContact={(isInternal || (loggedInUser && (loggedInUser.role === "realtor" || loggedInUser.role === "builder"))) ? function(contactId) { setPendingContactId(contactId); setShowContacts(true); setActiveScenario(null); } : null}
        onOpenProfile={!isInternal ? function() { setShowMyInfo(true); } : null}
      />
    );
  }

  // Footer is hidden while inside the toolkit (MortgageToolkit uses height:100vh +
  // overflow:hidden, so the footer creates extra body height and causes the mobile
  // scroll confusion bug — user could scroll the page to reveal/stick the footer).
  const inToolkit = !authLoading && !!loggedInUser && !showChangePassword &&
    !showProfileSetup && !showMyInfo && !showUsers && !showContacts &&
    activeScenario !== null;

  // Sidebar is visible for internal users on all non-scenario screens
  const showSidebar = !!(isInternal && loggedInUser && !activeScenario && !authLoading &&
    !showChangePassword && !showProfileSetup && !showMyInfo && !showUsers);
  const sidebarWidth = showSidebar && !isMobile ? (sidebarPinned ? 220 : 42) : 0;

  // Determine which nav item is "active" (mutually exclusive highlights)
  const inContacts   = showContacts && !showTasksContacts;
  const inScenarios  = !showContacts && !showTasksScenarios && !showTasksContacts && !showUsers && activeScenario === null;
  const inTasksSc    = showTasksScenarios;
  const inTasksCo    = showTasksContacts;
  const inAnyContacts = showContacts || showTasksContacts; // for view-tab visibility

  // Sidebar panel icon SVG (rectangle with vertical divider line)
  const SidebarIcon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="6" y1="1.5" x2="6" y2="14.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  function sidebarNavBtn(label, isActive, onClick) {
    return (
      <button
        key={label}
        onClick={function() { onClick(); if (isMobile) setMobileSidebarOpen(false); }}
        style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "9px 16px", border: "none", cursor: "pointer",
          background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
          color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
          fontSize: 13, fontWeight: isActive ? 700 : 500,
          fontFamily: "'Inter', system-ui, sans-serif",
          borderLeft: isActive ? "3px solid #60a5fa" : "3px solid transparent",
          whiteSpace: "nowrap", transition: "background 0.15s",
        }}
        onMouseEnter={function(e) { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
        onMouseLeave={function(e) { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        {label}
      </button>
    );
  }

  return (
    <React.Fragment>
      {!disclaimerAcked && <DisclaimerModal onAck={handleAckDisclaimer} />}

      {/* ── Global fixed sidebar (internal users, non-scenario screens) ── */}

      {/* Mobile: floating hamburger button (shown when sidebar is closed) */}
      {showSidebar && isMobile && !mobileSidebarOpen && (
        <button
          onClick={function() { setMobileSidebarOpen(true); }}
          title="Open menu"
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 200,
            background: "#1e3a5f", border: "none", borderRadius: 8,
            padding: "8px 10px", cursor: "pointer", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.28)",
          }}
        >
          {SidebarIcon}
        </button>
      )}

      {/* Mobile: backdrop behind open sidebar */}
      {showSidebar && isMobile && mobileSidebarOpen && (
        <div
          onClick={function() { setMobileSidebarOpen(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199 }}
        />
      )}

      {/* Sidebar panel */}
      {showSidebar && (!isMobile || mobileSidebarOpen) && (
        <div style={isMobile ? {
          position: "fixed", left: 0, top: 0,
          width: 240, height: "100vh",
          background: "#1e3a5f", zIndex: 200,
          display: "flex", flexDirection: "column",
          overflow: "hidden", boxSizing: "border-box",
          boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
        } : {
          position: "fixed", left: 0, top: 0,
          width: sidebarPinned ? 220 : 42,
          height: "100vh",
          background: "#1e3a5f", zIndex: 200,
          display: "flex", flexDirection: "column",
          overflow: "hidden", transition: "width 0.2s ease",
          borderRight: "1px solid rgba(0,0,0,0.18)",
          boxSizing: "border-box",
        }}>

          {/* ── Contact / user name at top of sidebar ── */}
          {(sidebarPinned || isMobile) && (
            <div style={{
              padding: "16px 16px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              flexShrink: 0,
            }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: "#fff",
                lineHeight: 1.3, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                {activeContactInfo ? activeContactInfo.name : (loggedInUser && (loggedInUser.name || loggedInUser.email)) || ""}
              </div>
              {(activeContactInfo ? activeContactInfo.badge : (loggedInUser && loggedInUser.role)) && (
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.55)",
                  marginTop: 3, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  textTransform: "capitalize",
                }}>
                  {activeContactInfo ? activeContactInfo.badge : (loggedInUser && loggedInUser.role)}
                </div>
              )}
            </div>
          )}

          {/* Pin / expand button (desktop) OR close button (mobile) */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: (sidebarPinned || isMobile) ? "space-between" : "center",
            padding: "10px 10px 6px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            flexShrink: 0,
          }}>
            {(sidebarPinned || isMobile) && (
              <span style={{
                fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)",
                fontFamily: "'Inter', system-ui, sans-serif",
                letterSpacing: "0.01em", paddingLeft: 4,
              }}>
                Home Loan Toolkit
              </span>
            )}
            {isMobile ? (
              <button
                onClick={function() { setMobileSidebarOpen(false); }}
                style={{
                  background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 6,
                  padding: "5px 10px", color: "#fff", fontSize: 16, cursor: "pointer",
                  lineHeight: 1, flexShrink: 0,
                }}
              >&#10005;</button>
            ) : (
              <button
                onClick={function() { setSidebarPinned(function(p) { return !p; }); }}
                title={sidebarPinned ? "Collapse sidebar" : "Expand sidebar"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.75)", fontSize: 15,
                  padding: "3px 5px", lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 4, transition: "color 0.2s",
                }}
                onMouseEnter={function(e) { e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={function(e) { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
              >
                {SidebarIcon}
              </button>
            )}
          </div>

          {/* Nav items — shown when expanded (desktop) or always (mobile) */}
          {(sidebarPinned || isMobile) && (
            <div style={{ flex: 1, overflowY: "auto", paddingTop: 8, paddingBottom: 16 }}>

              {/* Dashboards section */}
              <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Dashboards
              </div>
              {sidebarNavBtn("Contact Dashboard", inContacts, function() {
                if (showContacts) {
                  setContactsKey(function(k) { return k + 1; });
                } else {
                  setShowContacts(true);
                  setShowTasksScenarios(false);
                  setShowTasksContacts(false);
                  setPendingContactId(null);
                }
              })}
              {sidebarNavBtn("Scenario Dashboard", inScenarios, function() {
                setShowContacts(false);
                setShowTasksScenarios(false);
                setShowTasksContacts(false);
                setShowUsers(false);
              })}

              {/* Tasks section */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 16px" }} />
              {sidebarNavBtn("Tasks: Scenarios", inTasksSc, function() {
                setShowTasksScenarios(true);
                setShowContacts(false);
                setShowTasksContacts(false);
              })}
              {sidebarNavBtn("Tasks: Contacts", inTasksCo, function() {
                setShowTasksContacts(true);
                setShowContacts(false);
                setShowTasksScenarios(false);
              })}

            </div>
          )}
        </div>
      )}

      {/* ── Global fixed profile icon (top-right) ── */}
      {showSidebar && (
        <div style={{
          position: "fixed", top: 0, right: 0,
          padding: "8px 14px", zIndex: 190,
          display: "flex", alignItems: "center",
        }}>
          {window.AppHeader && React.createElement(window.AppHeader, {
            user: loggedInUser,
            darkMode: darkMode,
            setDarkMode: setDarkMode,
            userRole: userRole,
            setUserRole: isInternal ? setUserRole : null,
            onTeam: (loggedInUser && loggedInUser.role === "admin") ? function() { setShowUsers(true); } : null,
            onLogout: handleLogout,
            isInternal: isInternal,
            isAdmin: !!(loggedInUser && loggedInUser.role === "admin"),
          })}
        </div>
      )}

      {/* ── Page content — pushed right by sidebar width ── */}
      <div style={{
        marginLeft: sidebarWidth,
        transition: "margin-left 0.2s ease",
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
      }}>
        {pageContent}
        {!inToolkit && <PersistentFooter />}
      </div>
    </React.Fragment>
  );
}

window.App = window.App || App;
