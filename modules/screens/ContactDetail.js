// modules/screens/ContactDetail.js
const { useState, useEffect: useEffectCD, useRef: useRefCD } = React;
const fetchContactNotesFromSupabase = window.fetchContactNotesFromSupabase;
const addContactNoteToSupabase      = window.addContactNoteToSupabase;
const saveContactToSupabase         = window.saveContactToSupabase;
const archiveContactInSupabase      = window.archiveContactInSupabase;
const supabaseCD = window._supabaseClient;
const formatPhone = window.formatPhone;
const cdSaveScenario = window.saveScenarioToSupabase;

// Lead helpers (mirrors ScenarioDashboard)
function cdGetLeadStatusColors(leadStatus) {
  if (!leadStatus || leadStatus === "?")  return { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };
  if (leadStatus.startsWith("("))        return { bg: "rgba(59,130,246,0.12)",  text: "#1d4ed8" };
  if (leadStatus.startsWith("Waiting"))  return { bg: "rgba(245,158,11,0.12)",  text: "#b45309" };
  if (leadStatus.startsWith("z"))        return { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };
  return { bg: "rgba(34,197,94,0.12)", text: "#16a34a" };
}
function cdGetLoanPurposeLabel(purpose) {
  const LOAN_PURPOSES = window.LOAN_PURPOSES || [];
  const match = LOAN_PURPOSES.find(function(p) { return p.value === purpose; });
  return match ? match.label : (purpose || "");
}
const cdFormatPhone = formatPhone;

function cdFormatDateOnly(dateStr) {
  if (!dateStr) return "";
  var parts = (dateStr + "").split("-");
  if (parts.length < 3) return dateStr;
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[parseInt(parts[1],10)-1] + " " + parseInt(parts[2],10) + ", " + parseInt(parts[0],10);
}

const CONTACT_TYPE_COLORS_CD = {
  business: { bg: "#dbeafe", text: "#1e40af" },
  client:   { bg: "#dcfce7", text: "#166534" },
};

const CD_BUSINESS_CATEGORIES = [
  "Employee", "Financial Partner", "Home Builder", "Loan: Third Party",
  "Loan Officer", "Marketing", "Other", "Personal", "Realtor", "Recruit",
  "Work Relationship", "zz-Junk",
];

const CD_CLIENT_CATEGORIES = [
  "Client",
  "Current Client Referral (CCR)",
  "Past Client (PC)",
  "Past Client Referral (PCR)",
  "Client (Import)",
  "zz-Junk",
];

// ── ReferralPickerCD ─────────────────────────────────────────────────────────
// White-themed picker for the ContactDetail edit form (JSX, light background)
function ReferralPickerCD({ value, onChange, contacts, excludeId }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const pickerFieldStyle = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid #cbd5e1", fontSize: "14px", fontFamily: "inherit",
    outline: "none", background: "#fff", boxSizing: "border-box",
  };

  const selected = value && contacts
    ? contacts.find(function(c) { return c.id === value; })
    : null;

  if (selected) {
    const sName = `${selected.first_name || ""} ${selected.last_name || ""}`.trim() || "Unnamed";
    const sCat  = selected.contact_category || selected.contact_type || "";
    return (
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={{ ...pickerFieldStyle, flex: 1, display: "block", cursor: "default", color: "#1e293b" }}>
          {sName}{sCat ? `  \u00b7  ${sCat}` : ""}
        </span>
        <button
          type="button"
          onClick={function() { onChange(null); }}
          style={{
            background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5",
            borderRadius: "6px", padding: "6px 10px", cursor: "pointer",
            fontSize: "12px", flexShrink: 0,
          }}
        >&times;</button>
      </div>
    );
  }

  const filtered = (contacts || []).filter(function(c) { return !excludeId || c.id !== excludeId; });
  const candidates = (search.trim()
    ? filtered.filter(function(c) {
        const q = search.trim().toLowerCase();
        return (
          `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.email_personal || "").toLowerCase().includes(q)
        );
      })
    : filtered
  ).slice(0, 8);

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        placeholder="Click to browse or type to search..."
        style={pickerFieldStyle}
        value={search}
        onChange={function(e) { setSearch(e.target.value); }}
        onFocus={function() { setFocused(true); }}
        onBlur={function() { setTimeout(function() { setFocused(false); setSearch(""); }, 160); }}
      />
      {focused && candidates.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px",
          overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        }}>
          {candidates.map(function(c) {
            const nm  = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unnamed";
            const cat = c.contact_category || c.contact_type || "";
            return (
              <div
                key={c.id}
                onMouseDown={function() { onChange(c.id); setSearch(""); }}
                style={{ padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}
                onMouseEnter={function(e) { e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = ""; }}
              >
                <span style={{ fontWeight: "600", fontSize: "13px", color: "#1e293b" }}>{nm}</span>
                {cat && <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "8px" }}>{cat}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize: "11px", fontWeight: "600", color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px",
      }}>
        {label}
      </div>
      <div style={{ fontSize: "14px", color: value ? "#1e293b" : "#cbd5e1" }}>
        {value || "\u2014"}
      </div>
    </div>
  );
}

function HdrCell({ label, value, width }) {
  return (
    <div style={{ width: width || "auto", flexShrink: 0, minWidth: 0 }}>
      {value ? (
        <React.Fragment>
          <div style={{
            fontSize: "10px", color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase", letterSpacing: "0.07em",
            lineHeight: "1.2", marginBottom: "2px",
          }}>
            {label}
          </div>
          <div style={{
            fontSize: "13px", color: "#fff", fontWeight: "600",
            lineHeight: "1.3", whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {value}
          </div>
        </React.Fragment>
      ) : null}
    </div>
  );
}

function ContactDetail({ contact, user, onBack, onSave, onArchive, onDelete, onLogout, onSelectScenario, contacts, onSelectContact, onScenarios, onTasksScenarios, onTasksContacts, activeView, onSetView }) {
  const isInternal = !!(user && user.isInternal);
  const isAdmin    = !!(user && user.role === "admin");
  const isPartner  = !!(user && (user.role === "realtor" || user.role === "builder"));
  const canManage  = isInternal || isPartner;

  // Derive the login role from the contact's type/category
  const inferredRole = (function() {
    if (contact.contact_type === "client") return "borrower";
    var cat = (contact.contact_category || "").toLowerCase();
    if (cat.includes("realtor")) return "realtor";
    if (cat.includes("builder")) return "builder";
    return "borrower"; // safe default for all other business contacts
  })();

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    // Name (Client 1)
    prefix:     contact.prefix     || "",
    first_name: contact.first_name || "",
    nickname:   contact.nickname   || "",
    last_name:  contact.last_name  || "",
    // Classification
    contact_type:           contact.contact_type            || "client",
    contact_category:       contact.contact_category        || "",
    referred_by_contact_id: contact.referred_by_contact_id  || null,
    // Phone (fall back to legacy phone field for existing records)
    phone_cell: contact.phone_cell || contact.phone || "",
    phone_work: contact.phone_work || "",
    phone_home: contact.phone_home || "",
    phone_best: contact.phone_best || "",
    // Email (fall back to legacy email field for existing records)
    email_personal: contact.email_personal || contact.email || "",
    email_work:     contact.email_work     || "",
    email_other:    contact.email_other    || "",
    email_best:     contact.email_best     || "",
    // Notes + follow-up
    notes:       contact.notes       || "",
    note_quick:  contact.note_quick  || "",
    fu_date:     contact.fu_date     || "",
    fu_who:      contact.fu_who      || "",
    fu_priority: contact.fu_priority || "",
    // Address 1 (fall back to legacy address fields for existing records)
    address1_street: contact.address1_street || contact.address || "",
    address1_city:   contact.address1_city   || contact.city    || "",
    address1_zip:    contact.address1_zip    || contact.zip     || "",
    address1_state:  contact.address1_state  || contact.state   || "",
    address1_type:   contact.address1_type   || "Home",
    // Address 2
    address2_street: contact.address2_street || "",
    address2_city:   contact.address2_city   || "",
    address2_zip:    contact.address2_zip    || "",
    address2_state:  contact.address2_state  || "",
    address2_type:   contact.address2_type   || "Home",
    // Client 2 (co-borrower / spouse)
    prefix2:               contact.prefix2               || "",
    first_name2:           contact.first_name2           || "",
    nickname2:             contact.nickname2             || "",
    last_name2:            contact.last_name2            || "",
    connection_to_contact1: contact.connection_to_contact1 || "",
    phone2:      contact.phone2      || "",
    phone2_work: contact.phone2_work || "",
    phone2_home: contact.phone2_home || "",
    phone2_best: contact.phone2_best || "",
    email2:         contact.email2         || "",
    email2_work:    contact.email2_work    || "",
    email2_other:   contact.email2_other   || "",
    email2_best:    contact.email2_best    || "",
  });
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [notes, setNotes]               = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote]           = useState("");
  const [noteAdding, setNoteAdding]     = useState(false);
  const [noteError, setNoteError]       = useState(null);

  const [linkedScenarios, setLinkedScenarios]       = useState([]);
  const [scenariosLoading, setScenariosLoading]     = useState(false);
  const [creatingScenario, setCreatingScenario]     = useState(false);
  const [openingScenario, setOpeningScenario]       = useState(null);

  // activeView is now controlled by App.js via props
  function handleSetView(view) {
    if (onSetView) onSetView(view);
    if (view !== "contact") { setEditMode(false); setSaveError(null); }
  }

  // Portal account creation
  const [portalCreated, setPortalCreated] = useState(!!contact.auth_user_id);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalModal,   setPortalModal]   = useState(null); // { snippet }
  const [portalCopied,  setPortalCopied]  = useState(false);

  // On mount: if auth_user_id isn't set, check profiles by email so "Login Active" shows immediately
  useEffectCD(function() {
    if (portalCreated) return; // already confirmed
    var email = (contact.email_personal || contact.email || contact.email_work || "").trim();
    if (!email || !supabaseCD) return;
    supabaseCD
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle()
      .then(function(res) {
        if (res.data) setPortalCreated(true);
      });
  }, [contact.id]);

  // Load activity notes on mount
  useEffectCD(function () {
    if (!contact.id) return;
    setNotesLoading(true);
    fetchContactNotesFromSupabase(contact.id).then(function ({ data, error }) {
      setNotesLoading(false);
      if (!error) setNotes(data || []);
    });
  }, [contact.id]);

  // Load linked scenarios on mount
  useEffectCD(function () {
    if (!contact.id || !supabaseCD) return;
    setScenariosLoading(true);
    supabaseCD
      .from("scenarios")
      .select("id, name, status, lead_status, loan_purpose, property_address, lead_source, target_close_date, actual_close_date, updated_at")
      .eq("contact_id", contact.id)
      .order("updated_at", { ascending: false })
      .then(function ({ data, error }) {
        setScenariosLoading(false);
        if (!error) setLinkedScenarios(data || []);
      });
  }, [contact.id]);


  function handleFieldChange(field, value) {
    setEditForm(function (prev) { return Object.assign({}, prev, { [field]: value }); });
  }

  async function handleDelete() {
    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "this contact";

    // Count linked scenarios first
    const { data: linkedScs } = await supabaseCD
      .from("scenarios")
      .select("id")
      .eq("contact_id", contact.id);
    const scCount = (linkedScs || []).length;

    const warningLines = [
      "Permanently delete " + fullName + "?",
      "",
      scCount > 0
        ? "⚠️ This will also permanently delete " + scCount + " linked scenario" + (scCount === 1 ? "" : "s") + "."
        : "No linked scenarios will be affected.",
      "",
      "This cannot be undone.",
    ];
    if (!confirm(warningLines.join("\n"))) return;

    // Delete linked scenarios first
    if (scCount > 0) {
      const { error: scErr } = await supabaseCD
        .from("scenarios")
        .delete()
        .eq("contact_id", contact.id);
      if (scErr) { alert("Could not delete linked scenarios: " + scErr.message); return; }
    }

    const { error } = await supabaseCD
      .from("contacts")
      .delete()
      .eq("id", contact.id);
    if (error) { alert("Could not delete contact: " + error.message); return; }
    if (onDelete) onDelete(contact.id);
    else if (onArchive) onArchive(contact.id);
    else if (onBack) onBack();
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const { data, error } = await saveContactToSupabase(
      Object.assign({}, editForm, { contactId: contact.id })
    );
    setSaving(false);
    if (error) {
      setSaveError(error.message || "Save failed.");
    } else {
      setEditMode(false);
      if (onSave) onSave(data);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setNoteAdding(true);
    setNoteError(null);
    const { data, error } = await addContactNoteToSupabase({ contactId: contact.id, body: newNote });
    setNoteAdding(false);
    if (error) {
      setNoteError(error.message || "Could not add note.");
    } else {
      setNewNote("");
      setNotes(function (prev) { return [data, ...prev]; });
    }
  }

  async function handleNewScenario() {
    if (!supabaseCD || !onSelectScenario || !cdSaveScenario) return;
    setCreatingScenario(true);
    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "New Scenario";
    try {
      const uid = "s_" + Date.now();
      const { data, error } = await cdSaveScenario({
        uid:             uid,
        name:            contactName,
        notes:           "",
        calculationData: { uid: uid },
        contact_id:      contact.id,
        lead_status:     "?",
        loan_purpose:    "purchase",
      });
      if (error || !data) { alert("Could not create scenario. Please try again."); return; }
      onSelectScenario({
        id:               data.id,
        clientName:       data.name || contactName,
        notes:            "",
        createdBy:        data.user_id,
        status:           "active",
        lead_status:      "?",
        loan_purpose:     "purchase",
        contact_id:       contact.id,
        calculatorData:   {},
        _cloud:           true,
      });
    } catch (err) {
      alert("Could not create scenario.");
    } finally {
      setCreatingScenario(false);
    }
  }

  async function handleOpenScenario(scenarioId) {
    if (!supabaseCD || !onSelectScenario) return;
    setOpeningScenario(scenarioId);
    try {
      const { data, error } = await supabaseCD
        .from("scenarios")
        .select("*")
        .eq("id", scenarioId)
        .single();
      if (error || !data) { alert("Could not open scenario."); return; }
      // Stamp contact name into DTI Calculator header
      const contactFullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");
      if (contactFullName) {
        localStorage.setItem("mtk_dti_buyer_names", JSON.stringify(contactFullName));
      }
      onSelectScenario({
        id:               data.id,
        clientName:       data.name || "Untitled",
        notes:            data.notes || "",
        createdBy:        data.user_id,
        createdAt:        data.created_at,
        updatedAt:        data.updated_at,
        status:           data.status        || "active",
        lead_status:      data.lead_status   || "?",
        loan_purpose:     data.loan_purpose  || "purchase",
        property_address: data.property_address || "",
        contact_id:       data.contact_id    || null,
        calculatorData:   data.calculation_data || {},
        _cloud:           true,
      });
    } catch (err) {
      alert("Could not open scenario.");
    } finally {
      setOpeningScenario(null);
    }
  }

  async function handleCreatePortal() {
    const email = (contact.email_personal || contact.email || contact.email_work || "").trim();
    if (!email) { alert("No email address found for this contact. Add one before creating a portal account."); return; }
    if (!supabaseCD) return;
    setPortalLoading(true);
    try {
      const emailLower = email.toLowerCase();
      const { data, error: invokeErr } = await supabaseCD.functions.invoke("create-borrower-account", {
        body: {
          contactId:   contact.id,
          email:       emailLower,
          displayName: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || email,
          role:        inferredRole,
        },
      });

      if (invokeErr) {
        alert("Could not create account: " + (invokeErr.message || String(invokeErr)));
        return;
      }

      const result = data || {};

      if (result.alreadyExists) {
        alert("An account already exists for " + email + ". They can already log in.");
        setPortalCreated(true);
        return;
      }
      if (result.error || result.success !== true) {
        alert("Could not create account: " + (result.error || "Unexpected response from server."));
        return;
      }

      // Patch the profile role in case the Edge Function defaulted to "borrower"
      if (inferredRole !== "borrower" && isInternal) {
        try {
          const { data: prof } = await supabaseCD
            .from("profiles").select("id").eq("email", emailLower).maybeSingle();
          if (prof && prof.id) {
            await supabaseCD.from("profiles").update({ role: inferredRole }).eq("id", prof.id);
          }
        } catch (e) { console.warn("Could not patch profile role:", e); }
      }

      // Build role-aware copy snippet
      setPortalCreated(true);
      const appUrl = window.location.origin + window.location.pathname;
      const firstName = (contact.first_name || "").trim() || "there";
      const roleLabel = inferredRole === "realtor" ? "Realtor"
                      : inferredRole === "builder"  ? "Builder"
                      : "Client";
      const purposeLine = inferredRole === "realtor" || inferredRole === "builder"
        ? "You can log in to view scenarios that have been shared with you."
        : "You can log in to view your mortgage details at any time.";
      const snippet = [
        "Hi " + firstName + ",",
        "",
        purposeLine,
        "",
        "Login page: " + appUrl,
        "Email: " + emailLower,
        "Temporary password: 123456",
        "",
        "Sign up as: " + roleLabel,
        "",
        "You'll be asked to create a new password on your first login.",
        "",
        "— " + (user && user.name ? user.name : "Your Loan Officer"),
      ].join("\n");
      setPortalModal({ snippet, roleLabel });
    } catch (err) {
      alert("Something went wrong. Please try again.");
      console.error("handleCreatePortal error:", err);
    } finally {
      setPortalLoading(false);
    }
  }

  function handleCopyPortalSnippet() {
    if (!portalModal) return;
    navigator.clipboard.writeText(portalModal.snippet).then(function () {
      setPortalCopied(true);
      setTimeout(function () { setPortalCopied(false); }, 2500);
    });
  }

  const displayName = [
    editMode ? editForm.first_name : contact.first_name,
    editMode ? editForm.last_name  : contact.last_name,
  ].filter(Boolean).join(" ") || "Unnamed Contact";

  const typeColors     = CONTACT_TYPE_COLORS_CD[contact.contact_type]  || CONTACT_TYPE_COLORS_CD.business;
  const editTypeColors = CONTACT_TYPE_COLORS_CD[editForm.contact_type] || CONTACT_TYPE_COLORS_CD.business;

  const fieldStyle = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid #cbd5e1", fontSize: "14px", fontFamily: "inherit",
    outline: "none", background: "#fff", boxSizing: "border-box",
  };
  const labelStyle = {
    display: "block", fontSize: "12px", fontWeight: "600",
    color: "#64748b", marginBottom: "4px",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const sectionStyle = {
    background: "#fff", borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)", padding: "20px",
    marginBottom: "16px", position: "relative",
  };
  const cardNum = (n) => (
    <span style={{
      position: "absolute", bottom: "10px", right: "14px",
      fontSize: "10px", fontWeight: "700", color: "#d1d5db",
      userSelect: "none", pointerEvents: "none", lineHeight: 1,
    }}>{n}</span>
  );
  const sectionTitleStyle = {
    fontSize: "13px", fontWeight: "700", color: "#1e3a5f", marginBottom: "16px",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const addrSubheadStyle = {
    fontSize: "12px", fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px",
  };

  function handlePhoneBlur(field) {
    const raw = editForm[field] || "";
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10)
      handleFieldChange(field, `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`);
    else if (digits.length === 11 && digits[0] === "1")
      handleFieldChange(field, `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`);
  }

  const bestPhone = (() => {
    const bp = contact.phone_best;
    if (bp === "Cell")  return contact.phone_cell  || contact.phone || "";
    if (bp === "Work")  return contact.phone_work  || "";
    if (bp === "Home")  return contact.phone_home  || "";
    return contact.phone_cell || contact.phone || "";
  })();
  const bestEmail = (() => {
    const be = contact.email_best;
    if (be === "Personal") return contact.email_personal || contact.email || "";
    if (be === "Work")     return contact.email_work     || "";
    if (be === "Other")    return contact.email_other    || "";
    return contact.email_personal || contact.email || "";
  })();
  const bestPhone2 = (() => {
    const bp = contact.phone2_best;
    if (bp === "Cell")  return contact.phone2      || "";
    if (bp === "Work")  return contact.phone2_work || "";
    if (bp === "Home")  return contact.phone2_home || "";
    return contact.phone2 || "";
  })();
  const bestEmail2 = (() => {
    const be = contact.email2_best;
    if (be === "Personal") return contact.email2       || "";
    if (be === "Work")     return contact.email2_work  || "";
    if (be === "Other")    return contact.email2_other || "";
    return contact.email2 || "";
  })();

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#f1f5f9",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Sub-nav: Contacts + Scenarios (non-internal, non-borrower only) ── */}
      {!isInternal && user && user.role !== "borrower" && (
        <div style={{
          background: "#f0f4f8",
          borderBottom: "1px solid #dde3ea",
          padding: "0 24px",
        }}>
          <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", gap: "4px" }}>
            <button
              onClick={onBack}
              style={{
                background: "transparent", border: "none",
                color: "#1e3a5f", fontSize: 13, fontWeight: 600,
                padding: "7px 14px", borderRadius: 6, cursor: "pointer",
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
              onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(30,58,95,0.08)"; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
            >
              Contacts
            </button>
            {onScenarios && (
              <button
                onClick={onScenarios}
                style={{
                  background: "transparent", border: "none",
                  color: "#1e3a5f", fontSize: 13, fontWeight: 600,
                  padding: "7px 14px", borderRadius: 6, cursor: "pointer",
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
                onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(30,58,95,0.08)"; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
              >
                Scenarios
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Body row: inline sidebar (internal) + content ────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Content scroll area ─────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#f1f5f9" }}>
        <div
          style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 16px", paddingBottom: editMode ? "120px" : "24px" }}
          onDoubleClick={isInternal && !editMode && activeView === "contact" ? function (e) {
            if (e.target.tagName === "BUTTON" || e.target.tagName === "A" ||
                e.target.tagName === "INPUT"  || e.target.tagName === "SELECT" ||
                e.target.tagName === "TEXTAREA") return;
            setEditMode(true);
            setSaveError(null);
          } : undefined}
        >

        {/* Tab bar + Create Login + Edit button — always visible regardless of active tab */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "12px" }}>
          {/* Left: Contact Info / Internal Notes tabs (internal users only) */}
          {isInternal ? (
            <div style={{ display: "flex", gap: "2px", background: "#e2e8f0", borderRadius: "10px", padding: "3px" }}>
              <button
                onClick={function () { if (onSetView) onSetView("contact"); }}
                style={{
                  padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
                  background: activeView === "contact" ? "#ffffff" : "transparent",
                  color:      activeView === "contact" ? "#1e3a5f"  : "#64748b",
                  boxShadow:  activeView === "contact" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                Contact Info
              </button>
              <button
                onClick={function () { if (onSetView) onSetView("internal"); }}
                style={{
                  padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
                  background: activeView === "internal" ? "#ffffff" : "transparent",
                  color:      activeView === "internal" ? "#1e3a5f"  : "#64748b",
                  boxShadow:  activeView === "internal" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                Internal Notes
              </button>
            </div>
          ) : (
            <div />
          )}
          {/* Create Login + Edit buttons — only relevant on the Contact Info tab */}
          {activeView === "contact" && !editMode && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
              {canManage && (portalCreated || contact.auth_user_id ||
                contact.email_personal || contact.email || contact.email_work) && (
                (portalCreated || contact.auth_user_id) ? (
                  <button
                    disabled
                    style={{
                      background: "#dcfce7", color: "#16a34a",
                      border: "1px solid #86efac", borderRadius: "8px",
                      padding: "4px 14px", fontSize: "13px", fontWeight: 700,
                      cursor: "default", fontFamily: "'Inter', system-ui, sans-serif",
                      opacity: 1, flexShrink: 0,
                    }}
                  >
                    ✓ Login Active
                  </button>
                ) : (
                  <button
                    onClick={handleCreatePortal}
                    disabled={portalLoading}
                    style={{
                      background: portalLoading ? "#e2e8f0" : "#1e3a5f",
                      color: portalLoading ? "#94a3b8" : "#fff",
                      border: "none", borderRadius: "8px",
                      padding: "4px 14px", fontSize: "13px", fontWeight: 700,
                      cursor: portalLoading ? "wait" : "pointer",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      flexShrink: 0,
                    }}
                  >
                    {portalLoading ? "Creating…" : "Create Login"}
                  </button>
                )
              )}
              {isInternal && (
                <button
                  onClick={function () { setEditMode(true); setSaveError(null); }}
                  style={{
                    background: "transparent", border: "1px solid #cbd5e1", borderRadius: "8px",
                    padding: "4px 16px", fontSize: "13px", fontWeight: 600, color: "#1e3a5f",
                    cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
                    letterSpacing: "0.01em", flexShrink: 0,
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        {activeView === "contact" && (
          <React.Fragment>

        {saveError && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px",
            padding: "12px 16px", color: "#dc2626", fontSize: "14px", marginBottom: "16px",
          }}>
            {saveError}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 1 — Linked Scenarios                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(1)}
          <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>
            Linked Scenarios
          </h3>
          {scenariosLoading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px", fontSize: "14px" }}>
              Loading...
            </div>
          ) : linkedScenarios.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "14px" }}>
                No scenarios linked to this contact yet.
              </div>
              {onSelectScenario && (
                <button
                  onClick={handleNewScenario}
                  disabled={creatingScenario}
                  style={{
                    background: creatingScenario ? "#e2e8f0" : "#1e3a5f",
                    color: creatingScenario ? "#94a3b8" : "#fff",
                    border: "none", borderRadius: "8px",
                    padding: "10px 22px", fontSize: "13px", fontWeight: 700,
                    cursor: creatingScenario ? "not-allowed" : "pointer",
                  }}
                >
                  {creatingScenario ? "Creating…" : "+ Start New Scenario"}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {linkedScenarios.map(function (s) {
                const ls      = s.lead_status  || "?";
                const lsColor = cdGetLeadStatusColors(ls);
                const lp      = s.loan_purpose || "purchase";
                const lpLabel = cdGetLoanPurposeLabel(lp);
                return (
                  <div key={s.id} style={{
                    background: "#f8fafc", borderRadius: "8px", padding: "10px 14px",
                    borderLeft: "3px solid #2d5a8e",
                  }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
                      {s.name || "Untitled Scenario"}
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 700,
                        padding: "2px 8px", borderRadius: "6px",
                        background: lsColor.bg, color: lsColor.text,
                      }}>
                        {ls}
                      </span>
                      {lp !== "purchase" && (
                        <span style={{
                          fontSize: "11px", fontWeight: 700,
                          padding: "2px 8px", borderRadius: "6px",
                          background: "rgba(139,92,246,0.12)", color: "#7c3aed",
                        }}>
                          {lpLabel}
                        </span>
                      )}
                    </div>
                    {s.property_address && (
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "2px" }}>
                        {s.property_address}
                      </div>
                    )}
                    {(s.lead_source || s.target_close_date || s.actual_close_date) && (
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "12px", marginBottom: "2px" }}>
                        {s.lead_source && (
                          <span style={{ color: "#64748b" }}>{s.lead_source}</span>
                        )}
                        {s.target_close_date && (
                          <span style={{ color: "#b45309" }}>Target: {cdFormatDateOnly(s.target_close_date)}</span>
                        )}
                        {s.actual_close_date && (
                          <span style={{ color: "#16a34a" }}>Closed: {cdFormatDateOnly(s.actual_close_date)}</span>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        Updated {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : "—"}
                      </div>
                      {onSelectScenario && (
                        <button
                          onClick={function (e) { e.stopPropagation(); handleOpenScenario(s.id); }}
                          disabled={openingScenario === s.id}
                          style={{
                            background: openingScenario === s.id ? "#e2e8f0" : "#1e3a5f",
                            color:      openingScenario === s.id ? "#94a3b8" : "#fff",
                            border: "none", borderRadius: "6px",
                            padding: "4px 12px", fontSize: "12px", fontWeight: 600,
                            cursor: openingScenario === s.id ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {openingScenario === s.id ? "Opening..." : "Open →"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 2 — Personal Info                                             */}
        {/* Left: First / Nickname / Last   Right: Type / Category / Source   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(2)}
          <div style={sectionTitleStyle}>Personal Info</div>
          {editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Left: Name (Client 1) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Prefix</label>
                  <select
                    style={fieldStyle}
                    value={editForm.prefix}
                    onChange={function (e) { handleFieldChange("prefix", e.target.value); }}
                  >
                    <option value="">&mdash; None &mdash;</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Rev.">Rev.</option>
                    <option value="Prof.">Prof.</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input
                    style={fieldStyle}
                    value={editForm.first_name}
                    onChange={function (e) { handleFieldChange("first_name", e.target.value); }}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Nickname</label>
                  <input
                    style={fieldStyle}
                    value={editForm.nickname}
                    onChange={function (e) { handleFieldChange("nickname", e.target.value); }}
                    placeholder="Nickname"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    style={fieldStyle}
                    value={editForm.last_name}
                    onChange={function (e) { handleFieldChange("last_name", e.target.value); }}
                    placeholder="Last name"
                  />
                </div>
              </div>
              {/* Right: Classification */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select
                    style={fieldStyle}
                    value={editForm.contact_type}
                    onChange={function (e) {
                      const newType    = e.target.value;
                      const defaultCat = newType === "business" ? "Other" : "Client";
                      setEditForm(function (prev) {
                        return Object.assign({}, prev, { contact_type: newType, contact_category: defaultCat });
                      });
                    }}
                  >
                    <option value="client">Client</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    style={fieldStyle}
                    value={editForm.contact_category}
                    onChange={function (e) { handleFieldChange("contact_category", e.target.value); }}
                  >
                    {(editForm.contact_type === "business" ? CD_BUSINESS_CATEGORIES : CD_CLIENT_CATEGORIES)
                      .map(function (cat) {
                        return <option key={cat} value={cat}>{cat}</option>;
                      })}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Source (Referred By)</label>
                  <ReferralPickerCD
                    value={editForm.referred_by_contact_id}
                    onChange={function (id) { handleFieldChange("referred_by_contact_id", id); }}
                    contacts={contacts || []}
                    excludeId={contact.id}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Read View */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <InfoRow label="Prefix"     value={contact.prefix} />
                <InfoRow label="First Name" value={contact.first_name} />
                <InfoRow label="Nickname"   value={contact.nickname} />
                <InfoRow label="Last Name"  value={contact.last_name} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <InfoRow
                  label="Type"
                  value={contact.contact_type
                    ? contact.contact_type.charAt(0).toUpperCase() + contact.contact_type.slice(1)
                    : ""}
                />
                <InfoRow label="Category" value={contact.contact_category} />
                <div>
                  <div style={{
                    fontSize: "11px", fontWeight: "600", color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px",
                  }}>Source (Referred By)</div>
                  {(() => {
                    const rb = contact.referred_by_contact_id && contacts
                      ? contacts.find(function (c) { return c.id === contact.referred_by_contact_id; })
                      : null;
                    if (!rb) return <div style={{ fontSize: "14px", color: "#cbd5e1" }}>&mdash;</div>;
                    const rbName = `${rb.first_name || ""} ${rb.last_name || ""}`.trim() || "Unnamed";
                    const rbCat  = rb.contact_category || rb.contact_type || "";
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "14px", color: "#1e293b" }}>
                          {rbName}{rbCat ? `  \u00b7  ${rbCat}` : ""}
                        </span>
                        {onSelectContact && (
                          <button
                            onClick={function () { onSelectContact(rb); }}
                            style={{
                              background: "#e0f2fe", color: "#0369a1", border: "none",
                              borderRadius: "6px", padding: "3px 10px",
                              cursor: "pointer", fontSize: "12px", fontWeight: "600",
                            }}
                          >Open &rarr;</button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Contact Info                                                        */}
        {/* Left: Cell/Work/Home/Best   Right: Personal/Work/Other/Best       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Contact Info</div>
          {editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Left: Phone */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Phone: Cell</label>
                  <input
                    style={fieldStyle} type="tel"
                    value={editForm.phone_cell}
                    onChange={function (e) { handleFieldChange("phone_cell", e.target.value); }}
                    onBlur={function () { handlePhoneBlur("phone_cell"); }}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone: Work</label>
                  <input
                    style={fieldStyle} type="tel"
                    value={editForm.phone_work}
                    onChange={function (e) { handleFieldChange("phone_work", e.target.value); }}
                    onBlur={function () { handlePhoneBlur("phone_work"); }}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone: Home</label>
                  <input
                    style={fieldStyle} type="tel"
                    value={editForm.phone_home}
                    onChange={function (e) { handleFieldChange("phone_home", e.target.value); }}
                    onBlur={function () { handlePhoneBlur("phone_home"); }}
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone: Best</label>
                  <select
                    style={fieldStyle}
                    value={editForm.phone_best}
                    onChange={function (e) { handleFieldChange("phone_best", e.target.value); }}
                  >
                    <option value="">&mdash; Select &mdash;</option>
                    <option value="Cell">Cell</option>
                    <option value="Work">Work</option>
                    <option value="Home">Home</option>
                  </select>
                </div>
              </div>
              {/* Right: Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Email: Personal</label>
                  <input
                    style={fieldStyle} type="email"
                    value={editForm.email_personal}
                    onChange={function (e) { handleFieldChange("email_personal", e.target.value); }}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email: Work</label>
                  <input
                    style={fieldStyle} type="email"
                    value={editForm.email_work}
                    onChange={function (e) { handleFieldChange("email_work", e.target.value); }}
                    placeholder="email@company.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email: Other</label>
                  <input
                    style={fieldStyle} type="email"
                    value={editForm.email_other}
                    onChange={function (e) { handleFieldChange("email_other", e.target.value); }}
                    placeholder="other@example.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email: Best</label>
                  <select
                    style={fieldStyle}
                    value={editForm.email_best}
                    onChange={function (e) { handleFieldChange("email_best", e.target.value); }}
                  >
                    <option value="">&mdash; Select &mdash;</option>
                    <option value="Personal">Personal</option>
                    <option value="Work">Work</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Read View */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <InfoRow label="Phone: Cell" value={cdFormatPhone(contact.phone_cell || contact.phone)} />
                <InfoRow label="Phone: Work" value={cdFormatPhone(contact.phone_work)} />
                <InfoRow label="Phone: Home" value={cdFormatPhone(contact.phone_home)} />
                <InfoRow label="Phone: Best" value={contact.phone_best} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <InfoRow label="Email: Personal" value={contact.email_personal || contact.email} />
                <InfoRow label="Email: Work"     value={contact.email_work} />
                <InfoRow label="Email: Other"    value={contact.email_other} />
                <InfoRow label="Email: Best"     value={contact.email_best} />
              </div>
            </div>
          )}
        </div>

          </React.Fragment>
        )}

        {activeView === "internal" && isInternal && (
          <React.Fragment>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 1 — Linked Scenarios (copy)                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(1)}
          <h3 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>
            Linked Scenarios
          </h3>
          {scenariosLoading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px", fontSize: "14px" }}>
              Loading...
            </div>
          ) : linkedScenarios.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "14px" }}>
                No scenarios linked to this contact yet.
              </div>
              {onSelectScenario && (
                <button
                  onClick={handleNewScenario}
                  disabled={creatingScenario}
                  style={{
                    background: creatingScenario ? "#e2e8f0" : "#1e3a5f",
                    color: creatingScenario ? "#94a3b8" : "#fff",
                    border: "none", borderRadius: "8px",
                    padding: "10px 22px", fontSize: "13px", fontWeight: 700,
                    cursor: creatingScenario ? "not-allowed" : "pointer",
                  }}
                >
                  {creatingScenario ? "Creating…" : "+ Start New Scenario"}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {linkedScenarios.map(function (s) {
                const ls      = s.lead_status  || "?";
                const lsColor = cdGetLeadStatusColors(ls);
                const lp      = s.loan_purpose || "purchase";
                const lpLabel = cdGetLoanPurposeLabel(lp);
                return (
                  <div key={s.id} style={{
                    background: "#f8fafc", borderRadius: "8px", padding: "10px 14px",
                    borderLeft: "3px solid #2d5a8e",
                  }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
                      {s.name || "Untitled Scenario"}
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 700,
                        padding: "2px 8px", borderRadius: "6px",
                        background: lsColor.bg, color: lsColor.text,
                      }}>
                        {ls}
                      </span>
                      {lp !== "purchase" && (
                        <span style={{
                          fontSize: "11px", fontWeight: 700,
                          padding: "2px 8px", borderRadius: "6px",
                          background: "rgba(139,92,246,0.12)", color: "#7c3aed",
                        }}>
                          {lpLabel}
                        </span>
                      )}
                    </div>
                    {s.property_address && (
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "2px" }}>
                        {s.property_address}
                      </div>
                    )}
                    {(s.lead_source || s.target_close_date || s.actual_close_date) && (
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "12px", marginBottom: "2px" }}>
                        {s.lead_source && (
                          <span style={{ color: "#64748b" }}>{s.lead_source}</span>
                        )}
                        {s.target_close_date && (
                          <span style={{ color: "#b45309" }}>Target: {cdFormatDateOnly(s.target_close_date)}</span>
                        )}
                        {s.actual_close_date && (
                          <span style={{ color: "#16a34a" }}>Closed: {cdFormatDateOnly(s.actual_close_date)}</span>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        Updated {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : "—"}
                      </div>
                      {onSelectScenario && (
                        <button
                          onClick={function (e) { e.stopPropagation(); handleOpenScenario(s.id); }}
                          disabled={openingScenario === s.id}
                          style={{
                            background: openingScenario === s.id ? "#e2e8f0" : "#1e3a5f",
                            color:      openingScenario === s.id ? "#94a3b8" : "#fff",
                            border: "none", borderRadius: "6px",
                            padding: "4px 12px", fontSize: "12px", fontWeight: 600,
                            cursor: openingScenario === s.id ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {openingScenario === s.id ? "Opening..." : "Open →"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 3 — Notes (Internal only)                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(3)}
          <div style={sectionTitleStyle}>Notes (Internal)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "24px" }}>

            {/* ── Left: Follow-up fields ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {editMode ? (
                <React.Fragment>
                  <div>
                    <label style={labelStyle}>FU: Next</label>
                    <input
                      type="date"
                      style={fieldStyle}
                      value={editForm.fu_date}
                      onChange={function (e) { handleFieldChange("fu_date", e.target.value); }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>FU: Who</label>
                    <select
                      style={fieldStyle}
                      value={editForm.fu_who}
                      onChange={function (e) { handleFieldChange("fu_who", e.target.value); }}
                    >
                      <option value="">—</option>
                      <option value="MP">MP</option>
                      <option value="JW">JW</option>
                      <option value="TP">TP</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>FU: Priority</label>
                    <select
                      style={fieldStyle}
                      value={editForm.fu_priority}
                      onChange={function (e) { handleFieldChange("fu_priority", e.target.value); }}
                    >
                      <option value="">—</option>
                      <option value="Low">Low</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <InfoRow label="FU: Next"     value={contact.fu_date ? cdFormatDateOnly(contact.fu_date) : null} />
                  <InfoRow label="FU: Who"      value={contact.fu_who || null} />
                  <InfoRow label="FU: Priority" value={contact.fu_priority || null} />
                </React.Fragment>
              )}
            </div>

            {/* ── Right: Notes ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {editMode ? (
                <React.Fragment>
                  <div>
                    <label style={labelStyle}>Note: Quick</label>
                    <input
                      type="text"
                      style={fieldStyle}
                      maxLength={120}
                      value={editForm.note_quick}
                      onChange={function (e) { handleFieldChange("note_quick", e.target.value); }}
                      placeholder="Quick reminder for this call..."
                    />
                    <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "right", marginTop: "3px" }}>
                      {(editForm.note_quick || "").length}/120
                    </div>
                  </div>
                  {isInternal && (
                    <div>
                      <label style={labelStyle}>Internal: Note: Permanent</label>
                      <textarea
                        style={Object.assign({}, fieldStyle, { minHeight: "60px", resize: "vertical" })}
                        value={editForm.notes}
                        onChange={function (e) { handleFieldChange("notes", e.target.value); }}
                        placeholder="Permanent notes about this contact..."
                      />
                    </div>
                  )}
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <InfoRow label="Note: Quick"     value={contact.note_quick || null} />
                  {isInternal && <InfoRow label="Internal: Note: Permanent" value={contact.notes || null} />}
                </React.Fragment>
              )}
            </div>

          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Activity Log (internal only)                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(4)}
          <div style={sectionTitleStyle}>Activity Log (Internal)</div>

          {isInternal && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <textarea
                  style={Object.assign({}, fieldStyle, { flex: 1, minHeight: "64px", resize: "vertical" })}
                  value={newNote}
                  onChange={function (e) { setNewNote(e.target.value); }}
                  placeholder="Add a note about this contact..."
                  disabled={noteAdding}
                />
                <button
                  onClick={handleAddNote}
                  disabled={noteAdding || !newNote.trim()}
                  style={{
                    background: (!newNote.trim() || noteAdding) ? "#e2e8f0" : "#1e3a5f",
                    color:      (!newNote.trim() || noteAdding) ? "#94a3b8" : "#fff",
                    border: "none", borderRadius: "8px",
                    padding: "0 16px",
                    cursor: (!newNote.trim() || noteAdding) ? "not-allowed" : "pointer",
                    fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap",
                  }}
                >
                  {noteAdding ? "Adding..." : "Add Note"}
                </button>
              </div>
              {noteError && (
                <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "6px" }}>{noteError}</div>
              )}
            </div>
          )}

          {notesLoading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px", fontSize: "14px" }}>
              Loading activity...
            </div>
          ) : notes.length === 0 ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px", fontSize: "14px" }}>
              No activity yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {notes.map(function (note) {
                return (
                  <div key={note.id} style={{
                    background: "#f8fafc", borderRadius: "8px", padding: "12px 14px",
                    borderLeft: "3px solid #2d5a8e",
                  }}>
                    <div style={{ fontSize: "14px", color: "#1e293b", lineHeight: "1.5" }}>{note.body}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                      {note.created_at ? new Date(note.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

          </React.Fragment>
        )}

        {activeView === "contact" && (
          <React.Fragment>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Personal 2 Info                                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(6)}
          <div style={sectionTitleStyle}>Personal 2 Info</div>
          {editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Left: Name (Client 2) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Prefix</label>
                  <select
                    style={fieldStyle}
                    value={editForm.prefix2}
                    onChange={function (e) { handleFieldChange("prefix2", e.target.value); }}
                  >
                    <option value="">&mdash; None &mdash;</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Rev.">Rev.</option>
                    <option value="Prof.">Prof.</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input
                    style={fieldStyle}
                    value={editForm.first_name2}
                    onChange={function (e) { handleFieldChange("first_name2", e.target.value); }}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Nickname</label>
                  <input
                    style={fieldStyle}
                    value={editForm.nickname2}
                    onChange={function (e) { handleFieldChange("nickname2", e.target.value); }}
                    placeholder="Nickname"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    style={fieldStyle}
                    value={editForm.last_name2}
                    onChange={function (e) { handleFieldChange("last_name2", e.target.value); }}
                    placeholder="Last name"
                  />
                </div>
              </div>
              {/* Right: Connection */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Connection to Contact 1</label>
                  <select
                    style={fieldStyle}
                    value={editForm.connection_to_contact1}
                    onChange={function (e) { handleFieldChange("connection_to_contact1", e.target.value); }}
                  >
                    <option value="">&mdash; None &mdash;</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Significant Other">Significant Other</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            (contact.first_name2 || contact.last_name2) ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <InfoRow label="Prefix"     value={contact.prefix2} />
                  <InfoRow label="First Name" value={contact.first_name2} />
                  <InfoRow label="Nickname"   value={contact.nickname2} />
                  <InfoRow label="Last Name"  value={contact.last_name2} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <InfoRow label="Connection to Contact 1" value={contact.connection_to_contact1} />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "#cbd5e1" }}>No co-borrower on record.</div>
            )
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Contact 2 Info                                                     */}
        {/* Left: Cell/Work/Home/Best   Right: Personal/Work/Other/Best       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {(editMode || contact.first_name2 || contact.last_name2) && (
          <div style={sectionStyle}>{cardNum(7)}
            <div style={sectionTitleStyle}>Contact 2 Info</div>
            {editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                {/* Left: Phone */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Phone: Cell</label>
                    <input
                      style={fieldStyle} type="tel"
                      value={editForm.phone2}
                      onChange={function (e) { handleFieldChange("phone2", e.target.value); }}
                      onBlur={function () { handlePhoneBlur("phone2"); }}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone: Work</label>
                    <input
                      style={fieldStyle} type="tel"
                      value={editForm.phone2_work}
                      onChange={function (e) { handleFieldChange("phone2_work", e.target.value); }}
                      onBlur={function () { handlePhoneBlur("phone2_work"); }}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone: Home</label>
                    <input
                      style={fieldStyle} type="tel"
                      value={editForm.phone2_home}
                      onChange={function (e) { handleFieldChange("phone2_home", e.target.value); }}
                      onBlur={function () { handlePhoneBlur("phone2_home"); }}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone: Best</label>
                    <select
                      style={fieldStyle}
                      value={editForm.phone2_best}
                      onChange={function (e) { handleFieldChange("phone2_best", e.target.value); }}
                    >
                      <option value="">&mdash; Select &mdash;</option>
                      <option value="Cell">Cell</option>
                      <option value="Work">Work</option>
                      <option value="Home">Home</option>
                    </select>
                  </div>
                </div>
                {/* Right: Email */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Email: Personal</label>
                    <input
                      style={fieldStyle} type="email"
                      value={editForm.email2}
                      onChange={function (e) { handleFieldChange("email2", e.target.value); }}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email: Work</label>
                    <input
                      style={fieldStyle} type="email"
                      value={editForm.email2_work}
                      onChange={function (e) { handleFieldChange("email2_work", e.target.value); }}
                      placeholder="email@company.com"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email: Other</label>
                    <input
                      style={fieldStyle} type="email"
                      value={editForm.email2_other}
                      onChange={function (e) { handleFieldChange("email2_other", e.target.value); }}
                      placeholder="other@example.com"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email: Best</label>
                    <select
                      style={fieldStyle}
                      value={editForm.email2_best}
                      onChange={function (e) { handleFieldChange("email2_best", e.target.value); }}
                    >
                      <option value="">&mdash; Select &mdash;</option>
                      <option value="Personal">Personal</option>
                      <option value="Work">Work</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* Read View */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <InfoRow label="Phone: Cell" value={cdFormatPhone(contact.phone2)} />
                  <InfoRow label="Phone: Work" value={cdFormatPhone(contact.phone2_work)} />
                  <InfoRow label="Phone: Home" value={cdFormatPhone(contact.phone2_home)} />
                  <InfoRow label="Phone: Best" value={contact.phone2_best} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <InfoRow label="Email: Personal" value={contact.email2} />
                  <InfoRow label="Email: Work"     value={contact.email2_work} />
                  <InfoRow label="Email: Other"    value={contact.email2_other} />
                  <InfoRow label="Email: Best"     value={contact.email2_best} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 8 — Address Information                                       */}
        {/* Left: Mailing Address 1 + Type   Right: Mailing Address 2 + Type  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(8)}
          <div style={sectionTitleStyle}>Address Information</div>
          {editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Left: Address 1 */}
              <div>
                <div style={addrSubheadStyle}>Mailing Address 1</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Street</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_street}
                      onChange={function (e) { handleFieldChange("address1_street", e.target.value); }}
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_city}
                      onChange={function (e) { handleFieldChange("address1_city", e.target.value); }}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_zip}
                      onChange={function (e) { handleFieldChange("address1_zip", e.target.value); }}
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_state}
                      onChange={function (e) { handleFieldChange("address1_state", e.target.value); }}
                      placeholder="TX" maxLength={2}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Address Type</label>
                    <select
                      style={fieldStyle}
                      value={editForm.address1_type}
                      onChange={function (e) { handleFieldChange("address1_type", e.target.value); }}
                    >
                      <option value="Home">Home</option>
                      <option value="Work">Work</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Right: Address 2 */}
              <div>
                <div style={addrSubheadStyle}>Mailing Address 2</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Street</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_street}
                      onChange={function (e) { handleFieldChange("address2_street", e.target.value); }}
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_city}
                      onChange={function (e) { handleFieldChange("address2_city", e.target.value); }}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_zip}
                      onChange={function (e) { handleFieldChange("address2_zip", e.target.value); }}
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_state}
                      onChange={function (e) { handleFieldChange("address2_state", e.target.value); }}
                      placeholder="TX" maxLength={2}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Address Type</label>
                    <select
                      style={fieldStyle}
                      value={editForm.address2_type}
                      onChange={function (e) { handleFieldChange("address2_type", e.target.value); }}
                    >
                      <option value="Home">Home</option>
                      <option value="Work">Work</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Read View */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <div style={addrSubheadStyle}>
                  Mailing Address 1{contact.address1_type ? ` (${contact.address1_type})` : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <InfoRow label="Street" value={contact.address1_street || contact.address} />
                  <InfoRow label="City"   value={contact.address1_city   || contact.city} />
                  <InfoRow label="ZIP"    value={contact.address1_zip    || contact.zip} />
                  <InfoRow label="State"  value={contact.address1_state  || contact.state} />
                </div>
              </div>
              <div>
                <div style={addrSubheadStyle}>
                  Mailing Address 2{contact.address2_type ? ` (${contact.address2_type})` : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <InfoRow label="Street" value={contact.address2_street} />
                  <InfoRow label="City"   value={contact.address2_city} />
                  <InfoRow label="ZIP"    value={contact.address2_zip} />
                  <InfoRow label="State"  value={contact.address2_state} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Delete — bottom of page, admin only ── */}
        {isAdmin && !editMode && (
          <div style={{ paddingTop: "24px", paddingBottom: "8px", textAlign: "center" }}>
            <button
              onClick={handleDelete}
              title="Permanently delete this contact"
              style={{
                background: "transparent", border: "1px solid #fca5a5",
                color: "#dc2626", borderRadius: "8px",
                padding: "9px 28px", fontSize: "13px", fontWeight: 600,
                cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              🗑 Delete Contact
            </button>
          </div>
        )}

          </React.Fragment>
        )}

      </div>
      </div>
      </div>

      {/* ── Sticky Save / Discard bar (edit mode only) ───────────────────── */}
      {editMode && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300,
          background: "#fff", borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.10)",
          paddingTop: "12px", paddingLeft: "24px", paddingRight: "24px",
          paddingBottom: "max(14px, env(safe-area-inset-bottom))",
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px",
        }}>
          {saveError && (
            <div style={{ flex: 1, fontSize: "13px", color: "#dc2626", fontFamily: "'Inter', system-ui, sans-serif" }}>
              {saveError}
            </div>
          )}
          <button
            onClick={function () { setEditMode(false); setSaveError(null); }}
            style={{
              padding: "10px 22px", borderRadius: "8px", fontSize: "14px", fontWeight: "600",
              border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#475569",
              cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: "700",
              border: "none",
              background: saving ? "#93c5fd" : "#2563eb",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: "background 0.15s",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* ── Portal Account Created Modal ───────────────────────────────────── */}
      {portalModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}>
          <div style={{
            background: "#fff", borderRadius: "16px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
            padding: "32px", maxWidth: "480px", width: "100%",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#1e3a5f", marginBottom: "8px" }}>
              {portalModal && portalModal.roleLabel ? portalModal.roleLabel + " Login Created!" : "Login Created!"}
            </div>
            <div style={{ fontSize: "13px", color: "#475569", marginBottom: "20px", lineHeight: 1.6 }}>
              Copy the message below and send it to{" "}
              <strong>{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "the contact"}</strong>.
              They'll be prompted to set a personal password when they first log in.
            </div>
            <textarea
              readOnly
              value={portalModal.snippet}
              style={{
                width: "100%", height: "170px",
                fontSize: "13px", fontFamily: "monospace",
                padding: "10px 12px", borderRadius: "8px",
                border: "1px solid #cbd5e1", boxSizing: "border-box",
                resize: "none", background: "#f8fafc",
                color: "#1e293b", lineHeight: 1.65,
              }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button
                onClick={handleCopyPortalSnippet}
                style={{
                  flex: 1, padding: "11px 0",
                  background: portalCopied ? "#16a34a" : "#1e3a5f",
                  color: "#fff", border: "none", borderRadius: "8px",
                  fontSize: "14px", fontWeight: 700, cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {portalCopied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={function () { setPortalModal(null); }}
                style={{
                  padding: "11px 20px", background: "#f1f5f9",
                  color: "#475569", border: "1px solid #e2e8f0",
                  borderRadius: "8px", fontSize: "14px", cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

window.ContactDetail = window.ContactDetail || ContactDetail;
