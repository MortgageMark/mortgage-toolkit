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

// ── TransactionTeamTab ────────────────────────────────────────────────────────
// Three flows:
//   Flow 1 — Client enters their own vendor info (simple form, stored as client_data)
//   Flow 2 — LO links an existing contact card to this role (stored with source="lo")
//   Flow 3 — Partner links their own contact card (stored with source="partner")
// All entries stored in network_links JSONB as an array; multiple per role allowed.

const TEAM_ROLES = [
  { key: "builder",   label: "Builder",   icon: "🏠", color: "#f97316" },
  { key: "realtor",   label: "Realtor",   icon: "🏡", color: "#7c3aed" },
  { key: "lender",    label: "Lender",    icon: "🏦", color: "#0C4160" },
  { key: "insurance", label: "Insurance", icon: "🛡️", color: "#0891b2" },
  { key: "title",     label: "Title",     icon: "📄", color: "#16a34a" },
];

function TransactionTeamTab({ contact, contacts, loProfiles, isInternal, isPartner, user, onSelectContact, onNetworkPatched }) {
  const f = "'Inter', system-ui, sans-serif";
  const patchContact        = window.patchContactInSupabase;
  const saveContactFn       = window.saveContactToSupabase;

  // Resolve assigned LO profile → use as auto-lender if no explicit lender entry exists
  var assignedLoProfile = null;
  if (contact.assigned_lo_id && loProfiles && loProfiles.length) {
    assignedLoProfile = loProfiles.find(function(p) { return p.id === contact.assigned_lo_id; }) || null;
  }
  // Try to find the LO's contact card by email match (for phone number)
  var assignedLoContact = null;
  if (assignedLoProfile && assignedLoProfile.email && contacts && contacts.length) {
    var loEmailLower = assignedLoProfile.email.toLowerCase();
    assignedLoContact = contacts.find(function(c) {
      return (c.email_work || c.email_personal || "").toLowerCase() === loEmailLower;
    }) || null;
  }

  // Resolve creator profile → use as auto-builder if creator role is "builder"
  var creatorBuilderProfile = null;
  if (contact.created_by_user_id && loProfiles && loProfiles.length) {
    var creatorProfile = loProfiles.find(function(p) { return p.id === contact.created_by_user_id; }) || null;
    if (creatorProfile && creatorProfile.role === "builder") creatorBuilderProfile = creatorProfile;
  }
  // Try to find the builder's contact card by email match (for phone number)
  var creatorBuilderContact = null;
  if (creatorBuilderProfile && creatorBuilderProfile.email && contacts && contacts.length) {
    var builderEmailLower = creatorBuilderProfile.email.toLowerCase();
    creatorBuilderContact = contacts.find(function(c) {
      return (c.email_work || c.email_personal || "").toLowerCase() === builderEmailLower;
    }) || null;
  }

  // Parse network_links — normalise old format ({role,contact_id}) to new format
  function parseLinks(raw) {
    try {
      var arr = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);
      return arr.map(function(e) {
        // legacy format: {role, contact_id} → convert
        if (e.contact_id && !e.source) return { role: e.role, contact_id: e.contact_id, source: "lo" };
        return e;
      });
    } catch(ex) { return []; }
  }

  const [entries,    setEntries]    = React.useState(function() { return parseLinks(contact.network_links); });
  const [picking,    setPicking]    = React.useState(null);   // {role, source} being picked
  const [search,     setSearch]     = React.useState("");
  const [clientForm, setClientForm] = React.useState({});     // {role: {name,company,phone,email}}
  const [clientEdit, setClientEdit] = React.useState(null);   // role key currently editing
  const [saving,     setSaving]     = React.useState(false);
  const [saved,      setSaved]      = React.useState(false);
  const [importing,  setImporting]  = React.useState(null);   // role key being imported

  // Contact lookup map
  var contactMap = {};
  (contacts || []).forEach(function(c) { contactMap[c.id] = c; });

  // Auto-link assigned LO as lender and creator builder on mount (if contact card found + not already linked)
  React.useEffect(function() {
    var current = parseLinks(contact.network_links);
    var changed = false;
    var updated = current.slice();
    var hasLender  = current.some(function(e) { return e.role === "lender"  && e.source === "lo"; });
    var hasBuilder = current.some(function(e) { return e.role === "builder" && e.source === "lo"; });
    if (!hasLender && assignedLoContact) {
      updated.push({ role: "lender", contact_id: assignedLoContact.id, source: "lo", source_name: assignedLoProfile ? (assignedLoProfile.display_name || assignedLoProfile.email) : "" });
      changed = true;
    }
    if (!hasBuilder && creatorBuilderContact) {
      updated.push({ role: "builder", contact_id: creatorBuilderContact.id, source: "lo", source_name: creatorBuilderProfile ? (creatorBuilderProfile.display_name || creatorBuilderProfile.email) : "" });
      changed = true;
    }
    if (changed && patchContact && contact.id) {
      setEntries(updated);
      patchContact(contact.id, { network_links: updated }).then(function(res) {
        if (!res || !res.error) { if (onNetworkPatched) onNetworkPatched(updated); }
      });
    }
  }, [contact.id]);

  function fullName(c) {
    if (!c) return "";
    return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || c.email_work || c.email_personal || "(No name)";
  }
  function fmtPhone(raw) {
    var d = (raw || "").replace(/\D/g, "");
    if (d.length < 4) return raw || "";
    if (d.length < 7) return "(" + d.slice(0,3) + ") " + d.slice(3);
    return "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6,10);
  }

  function persist(newEntries) {
    setEntries(newEntries);
    setSaving(true);
    if (patchContact && contact.id) {
      patchContact(contact.id, { network_links: newEntries }).then(function(res) {
        setSaving(false);
        if (res && res.error) {
          alert("Could not save team link: " + (res.error.message || "Unknown error. Make sure the network_links migration has been run in Supabase."));
          return;
        }
        setSaved(true);
        setTimeout(function() { setSaved(false); }, 2000);
        // Update parent contacts list so re-opening shows the new data
        if (onNetworkPatched) onNetworkPatched(newEntries);
      });
    } else { setSaving(false); }
  }

  // LO / partner: link an existing contact card
  function linkContact(role, contactId, source) {
    var sourceName = user ? (user.name || user.email || "") : "";
    var without = entries.filter(function(e) { return !(e.role === role && e.source === source); });
    persist([...without, { role: role, contact_id: contactId, source: source, source_name: sourceName }]);
    setPicking(null); setSearch("");
  }

  // Remove an entry by role + source
  function removeEntry(role, source) {
    persist(entries.filter(function(e) { return !(e.role === role && e.source === source); }));
  }

  // Client: save their own vendor info
  function saveClientEntry(role) {
    var fd = clientForm[role] || {};
    if (!fd.name && !fd.phone && !fd.email) { setClientEdit(null); return; }
    var without = entries.filter(function(e) { return !(e.role === role && e.source === "client"); });
    persist([...without, { role: role, source: "client", contact_id: null, client_data: fd }]);
    setClientEdit(null);
  }

  // LO: import client-entered data as a new contact card
  async function importClientEntry(role, clientData) {
    if (!saveContactFn) return;
    setImporting(role);
    var parts = (clientData.name || "").trim().split(/\s+/);
    var result = await saveContactFn({
      first_name:       parts[0] || "",
      last_name:        parts.slice(1).join(" ") || "",
      company:          clientData.company || null,
      phone_cell:       clientData.phone   || null,
      email_work:       clientData.email   || null,
      contact_type:     "business",
      contact_category: role.charAt(0).toUpperCase() + role.slice(1),
      status:           "active",
    });
    setImporting(null);
    if (result.error || !result.data) { alert("Import failed: " + (result.error && result.error.message)); return; }
    var newContact = result.data;
    // Replace client_data entry with a proper contact_id entry (keep source=client so we know it came from them)
    var without = entries.filter(function(e) { return !(e.role === role && e.source === "client"); });
    persist([...without, { role: role, source: "client", contact_id: newContact.id, imported: true }]);
  }

  // Entries by role
  function entriesForRole(roleKey) {
    return entries.filter(function(e) { return e.role === roleKey; });
  }

  // Contact mini-card — single column layout
  function ContactMiniCard({ c, roleColor, sourceBadge, onOpen, onRemove, canRemove }) {
    var name      = fullName(c);
    var company   = c.company   || "";
    var teamName  = c.team_name || "";
    var addrParts = [c.address1_street, c.address1_city, c.address1_state, c.address1_zip].filter(Boolean);
    var address   = addrParts.join(", ");
    var workPhone = c.phone_work || "";
    var cellPhone = c.phone_cell || "";
    var workEmail = c.email_work || c.email_personal || "";
    var website   = c.lo_website || "";
    var row = function(icon, href, text) {
      if (!text) return null;
      return React.createElement("a", { href: href, target: href && href.startsWith("http") ? "_blank" : undefined, rel: "noopener noreferrer", style: { display: "flex", alignItems: "center", fontSize: 15, color: "#0C4160", textDecoration: "none", fontFamily: f, padding: "3px 0" } },
        React.createElement("span", null, text)
      );
    };
    return React.createElement("div", { style: { padding: "14px 16px", borderTop: "1px solid #f1f5f9" } },
      // Name row + badge + remove
      React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 } },
          React.createElement("button", {
            onClick: onOpen || undefined,
            disabled: !onOpen,
            style: { fontSize: 17, fontWeight: 700, color: onOpen ? "#2563eb" : "#1e293b", fontFamily: f, cursor: onOpen ? "pointer" : "default", textDecoration: onOpen ? "underline" : "none", background: "none", border: "none", padding: 0, textAlign: "left", lineHeight: 1.3 }
          }, name),
          sourceBadge && React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: "#fff", background: sourceBadge.color, borderRadius: 4, padding: "2px 7px", fontFamily: f } }, sourceBadge.label)
        ),
        canRemove && React.createElement("button", { onClick: onRemove, style: { fontSize: 12, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontFamily: f, flexShrink: 0 } }, "Remove")
      ),
      // Single column details
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
        company  && React.createElement("div", { style: { fontSize: 15, color: "#374151", fontFamily: f } }, company),
        teamName && React.createElement("div", { style: { fontSize: 15, color: "#64748b", fontFamily: f } }, teamName),
        address  && React.createElement("div", { style: { fontSize: 15, color: "#64748b", fontFamily: f } }, address),
        (workPhone || cellPhone || workEmail || website) && React.createElement("div", { style: { height: 8 } }),
        row("📞", workPhone ? "tel:" + workPhone.replace(/\D/g,"") : null, workPhone ? fmtPhone(workPhone) + " (work)" : ""),
        row("📱", cellPhone ? "tel:" + cellPhone.replace(/\D/g,"") : null, cellPhone ? fmtPhone(cellPhone) + " (cell)" : ""),
        row("✉️", workEmail ? "mailto:" + workEmail : null, workEmail),
        row("🌐", website ? (website.startsWith("http") ? website : "https://" + website) : null, website)
      )
    );
  }

  // Client data mini-card (unimported)
  function ClientDataCard({ roleKey, roleColor, data, onImport, onEdit, onRemove }) {
    return React.createElement("div", { style: { padding: "10px 14px", borderTop: "1px solid #f1f5f9", background: "#fffbeb" } },
      React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } },
        React.createElement("div", { style: { flex: 1 } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 } },
            React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: "#1e293b", fontFamily: f } }, data.name || "(No name)"),
            React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#f59e0b", borderRadius: 4, padding: "1px 6px", fontFamily: f } }, "Client Added")
          ),
          data.company && React.createElement("div", { style: { fontSize: 12, color: "#64748b", fontFamily: f } }, data.company),
          React.createElement("div", { style: { display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" } },
            data.phone && React.createElement("a", { href: "tel:" + data.phone.replace(/\D/g,""), style: { fontSize: 12, color: "#0C4160", textDecoration: "none", fontFamily: f } }, fmtPhone(data.phone)),
            data.email && React.createElement("a", { href: "mailto:" + data.email, style: { fontSize: 12, color: "#0C4160", textDecoration: "none", fontFamily: f } }, data.email)
          )
        ),
        React.createElement("div", { style: { display: "flex", gap: 6, flexShrink: 0, flexDirection: "column", alignItems: "flex-end" } },
          isInternal && React.createElement("button", {
            onClick: onImport, disabled: importing === roleKey,
            style: { fontSize: 12, fontWeight: 700, color: "#fff", background: importing === roleKey ? "#86efac" : "#16a34a", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: f, whiteSpace: "nowrap" }
          }, importing === roleKey ? "Importing…" : "Import →"),
          React.createElement("button", { onClick: onRemove, style: { fontSize: 11, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontFamily: f } }, "Remove")
        )
      )
    );
  }

  // Client entry form
  function ClientEntryForm({ roleKey, roleColor }) {
    var fd = clientForm[roleKey] || {};
    function upd(field, val) { setClientForm(function(prev) { var n = Object.assign({}, prev); n[roleKey] = Object.assign({}, prev[roleKey] || {}, { [field]: val }); return n; }); }
    var inp = { width: "100%", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: f, boxSizing: "border-box", outline: "none", marginBottom: 8 };
    return React.createElement("div", { style: { padding: "12px 14px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" } },
      React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontFamily: f } }, "Add Your Contact"),
      React.createElement("input", { type: "text", placeholder: "Name", value: fd.name || "", onChange: function(e) { upd("name", e.target.value); }, style: inp }),
      React.createElement("input", { type: "text", placeholder: "Company", value: fd.company || "", onChange: function(e) { upd("company", e.target.value); }, style: inp }),
      React.createElement("input", { type: "tel",   placeholder: "Phone", value: fd.phone || "", onChange: function(e) { upd("phone", e.target.value); }, style: Object.assign({}, inp, { marginBottom: 8 }) }),
      React.createElement("input", { type: "email", placeholder: "Email", value: fd.email || "", onChange: function(e) { upd("email", e.target.value); }, style: Object.assign({}, inp, { marginBottom: 12 }) }),
      React.createElement("div", { style: { display: "flex", gap: 8 } },
        React.createElement("button", { onClick: function() { saveClientEntry(roleKey); }, style: { flex: 1, padding: "8px 0", background: roleColor, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: f } }, "Save"),
        React.createElement("button", { onClick: function() { setClientEdit(null); }, style: { padding: "8px 14px", background: "none", color: "#94a3b8", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: f } }, "Cancel")
      )
    );
  }

  // Picker (LO + partner)
  function ContactPicker({ roleKey, source, roleColor }) {
    var searchLower = search.toLowerCase();
    var filtered = (contacts || []).filter(function(c) {
      if (!searchLower) return true;
      return [fullName(c), c.company || "", c.email_work || "", c.email_personal || ""].join(" ").toLowerCase().includes(searchLower);
    }).slice(0, 20);
    return React.createElement("div", { style: { padding: "10px 14px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" } },
      React.createElement("input", {
        autoFocus: true, type: "text", placeholder: "Search People…", value: search,
        onChange: function(e) { setSearch(e.target.value); },
        style: { width: "100%", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: f, boxSizing: "border-box", marginBottom: 8, outline: "none" }
      }),
      filtered.length === 0 && React.createElement("div", { style: { fontSize: 12, color: "#94a3b8", fontFamily: f, fontStyle: "italic", padding: "4px 0" } }, "No contacts found."),
      React.createElement("div", { style: { maxHeight: 200, overflowY: "auto" } },
        filtered.map(function(c) {
          return React.createElement("div", {
            key: c.id,
            onClick: function() { linkContact(roleKey, c.id, source); },
            style: { padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: f, color: "#1e293b" },
            onMouseEnter: function(e) { e.currentTarget.style.background = "#e0f2fe"; },
            onMouseLeave: function(e) { e.currentTarget.style.background = "transparent"; }
          },
            React.createElement("div", { style: { fontWeight: 600 } }, fullName(c)),
            (c.company || c.contact_category) && React.createElement("div", { style: { fontSize: 11, color: "#64748b" } }, [c.company, c.contact_category].filter(Boolean).join(" · "))
          );
        })
      )
    );
  }

  var mySource = isInternal ? "lo" : isPartner ? "partner" : "client";

  return React.createElement("div", { style: { padding: "4px 0" } },
    // Header
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
      React.createElement("div", { style: { fontSize: 13, color: "#64748b", fontFamily: f } },
        isInternal ? "Link vendor and partner contacts to this person's transaction." :
        "See who's on your team, and add your own contacts."
      ),
      (saving || saved) && React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: saving ? "#94a3b8" : "#16a34a", fontFamily: f } }, saving ? "Saving…" : "✓ Saved")
    ),

    // Role cards
    TEAM_ROLES.map(function(role) {
      var roleEntries  = entriesForRole(role.key);
      var loEntry      = roleEntries.find(function(e) { return e.source === "lo"; });
      var partnerEntry = roleEntries.find(function(e) { return e.source === "partner"; });
      var clientEntry  = roleEntries.find(function(e) { return e.source === "client"; });
      var hasAny       = loEntry || partnerEntry || clientEntry;
      var isPickingThis = picking && picking.role === role.key;

      return React.createElement("div", { key: role.key, style: { border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 10, overflow: "hidden" } },

        // Role header bar
        React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: hasAny ? role.color + "0f" : "#f8fafc" } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
            React.createElement("span", { style: { fontSize: 16 } }, role.icon),
            React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: role.color, fontFamily: f, textTransform: "uppercase", letterSpacing: "0.05em" } }, role.label)
          ),
          React.createElement("div", { style: { display: "flex", gap: 6 } },
            // LO: show Link button (if no LO entry yet)
            isInternal && !loEntry && React.createElement("button", {
              onClick: function() { setPicking(isPickingThis && picking.source === "lo" ? null : { role: role.key, source: "lo" }); setSearch(""); },
              style: { fontSize: 12, fontWeight: 600, color: "#fff", background: role.color, border: "none", borderRadius: 6, padding: "3px 12px", cursor: "pointer", fontFamily: f }
            }, isPickingThis && picking.source === "lo" ? "Cancel" : "+ Link"),
            // Partner: show Link button (if no partner entry yet)
            isPartner && !partnerEntry && React.createElement("button", {
              onClick: function() { setPicking(isPickingThis && picking.source === "partner" ? null : { role: role.key, source: "partner" }); setSearch(""); },
              style: { fontSize: 12, fontWeight: 600, color: "#fff", background: role.color, border: "none", borderRadius: 6, padding: "3px 12px", cursor: "pointer", fontFamily: f }
            }, isPickingThis && picking.source === "partner" ? "Cancel" : "+ Link"),
            // Client: show + Add button (if no client entry yet)
            !isInternal && !isPartner && !clientEntry && React.createElement("button", {
              onClick: function() { setClientEdit(clientEdit === role.key ? null : role.key); },
              style: { fontSize: 12, fontWeight: 600, color: "#fff", background: role.color, border: "none", borderRadius: 6, padding: "3px 12px", cursor: "pointer", fontFamily: f }
            }, clientEdit === role.key ? "Cancel" : "+ Add Mine")
          )
        ),

        // Auto-builder: contact creator shown when no explicit builder entries exist
        role.key === "builder" && !loEntry && !partnerEntry && !clientEntry && creatorBuilderProfile && (function() {
          var bName    = creatorBuilderProfile.display_name || creatorBuilderProfile.email || "Builder";
          var bEmail   = creatorBuilderProfile.email || "";
          var bPhone   = creatorBuilderContact ? (creatorBuilderContact.phone_cell || creatorBuilderContact.phone_work || "") : "";
          var bCompany = creatorBuilderContact ? (creatorBuilderContact.company || "") : "";
          var dp = function(raw) { var n=(raw||"").replace(/\D/g,""); if(n.length<4)return raw||""; if(n.length<7)return"("+n.slice(0,3)+") "+n.slice(3); return"("+n.slice(0,3)+") "+n.slice(3,6)+"-"+n.slice(6,10); };
          return React.createElement("div", { style: { padding: "10px 14px", borderTop: "1px solid #f1f5f9" } },
            React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } },
              React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 } },
                  React.createElement("button", { onClick: creatorBuilderContact && onSelectContact ? function() { onSelectContact(creatorBuilderContact); } : undefined, disabled: !(creatorBuilderContact && onSelectContact), style: { fontSize: 14, fontWeight: 700, color: creatorBuilderContact && onSelectContact ? "#2563eb" : "#1e293b", fontFamily: f, cursor: creatorBuilderContact && onSelectContact ? "pointer" : "default", textDecoration: creatorBuilderContact && onSelectContact ? "underline" : "none", background: "none", border: "none", padding: 0, textAlign: "left" } }, bName),
                  React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#f97316", borderRadius: 4, padding: "1px 6px", fontFamily: f } }, "Created By")
                ),
                bCompany && React.createElement("div", { style: { fontSize: 12, color: "#64748b", fontFamily: f } }, bCompany),
                React.createElement("div", { style: { display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" } },
                  bPhone && React.createElement("a", { href: "tel:" + bPhone.replace(/\D/g,""), style: { fontSize: 12, color: "#0C4160", textDecoration: "none", fontFamily: f } }, dp(bPhone)),
                  bEmail && React.createElement("a", { href: "mailto:" + bEmail, style: { fontSize: 12, color: "#0C4160", textDecoration: "none", fontFamily: f } }, bEmail)
                )
              ),
              creatorBuilderContact && onSelectContact && React.createElement("button", {
                onClick: function() { onSelectContact(creatorBuilderContact); },
                style: { fontSize: 12, fontWeight: 600, color: "#f97316", background: "none", border: "1px solid #f9731644", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontFamily: f, flexShrink: 0 }
              }, "Open →")
            )
          );
        })(),

        // Auto-lender: assigned LO shown when no explicit lender entries exist
        role.key === "lender" && !loEntry && !partnerEntry && !clientEntry && assignedLoProfile && (function() {
          var loName  = assignedLoProfile.display_name || assignedLoProfile.email || "Loan Officer";
          var loEmail = assignedLoProfile.email || "";
          var loPhone = assignedLoContact ? (assignedLoContact.phone_cell || assignedLoContact.phone_work || "") : "";
          var loCompany = assignedLoContact ? (assignedLoContact.company || "") : "";
          var d = (raw => { var n=(raw||"").replace(/\D/g,""); if(n.length<4)return raw||""; if(n.length<7)return"("+n.slice(0,3)+") "+n.slice(3); return"("+n.slice(0,3)+") "+n.slice(3,6)+"-"+n.slice(6,10); });
          return React.createElement("div", { style: { padding: "10px 14px", borderTop: "1px solid #f1f5f9" } },
            React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } },
              React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 2 } },
                  React.createElement("button", { onClick: assignedLoContact && onSelectContact ? function() { onSelectContact(assignedLoContact); } : undefined, disabled: !(assignedLoContact && onSelectContact), style: { fontSize: 14, fontWeight: 700, color: assignedLoContact && onSelectContact ? "#2563eb" : "#1e293b", fontFamily: f, cursor: assignedLoContact && onSelectContact ? "pointer" : "default", textDecoration: assignedLoContact && onSelectContact ? "underline" : "none", background: "none", border: "none", padding: 0, textAlign: "left" } }, loName),
                  React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: "#fff", background: "#0C4160", borderRadius: 4, padding: "1px 6px", fontFamily: f } }, "Assigned LO")
                ),
                loCompany && React.createElement("div", { style: { fontSize: 12, color: "#64748b", fontFamily: f } }, loCompany),
                React.createElement("div", { style: { display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" } },
                  loPhone && React.createElement("a", { href: "tel:" + loPhone.replace(/\D/g,""), style: { fontSize: 12, color: "#0C4160", textDecoration: "none", fontFamily: f } }, d(loPhone)),
                  loEmail && React.createElement("a", { href: "mailto:" + loEmail, style: { fontSize: 12, color: "#0C4160", textDecoration: "none", fontFamily: f } }, loEmail)
                )
              ),
              assignedLoContact && onSelectContact && React.createElement("button", {
                onClick: function() { onSelectContact(assignedLoContact); },
                style: { fontSize: 12, fontWeight: 600, color: "#0C4160", background: "none", border: "1px solid #0C416044", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontFamily: f, flexShrink: 0 }
              }, "Open →")
            )
          );
        })(),

        // Empty state
        !hasAny
          && !(role.key === "lender"  && assignedLoProfile)
          && !(role.key === "builder" && creatorBuilderProfile)
          && clientEdit !== role.key
          && React.createElement("div", { style: { padding: "10px 14px", fontSize: 13, color: "#94a3b8", fontFamily: f, fontStyle: "italic" } },
            "No " + role.label.toLowerCase() + " linked yet."
          ),

        // LO-linked contact card
        loEntry && loEntry.contact_id && contactMap[loEntry.contact_id] && React.createElement(ContactMiniCard, {
          c: contactMap[loEntry.contact_id], roleColor: role.color,
          sourceBadge: { label: "From LO", color: role.color },
          onOpen: onSelectContact ? function() { onSelectContact(contactMap[loEntry.contact_id]); } : null,
          onRemove: function() { removeEntry(role.key, "lo"); },
          canRemove: isInternal,
        }),

        // Partner-linked contact card
        partnerEntry && partnerEntry.contact_id && contactMap[partnerEntry.contact_id] && React.createElement(ContactMiniCard, {
          c: contactMap[partnerEntry.contact_id], roleColor: role.color,
          sourceBadge: { label: "From " + (partnerEntry.source_name || "Partner"), color: "#7c3aed" },
          onOpen: onSelectContact ? function() { onSelectContact(contactMap[partnerEntry.contact_id]); } : null,
          onRemove: function() { removeEntry(role.key, "partner"); },
          canRemove: isInternal,
        }),

        // Client-linked contact card (already imported)
        clientEntry && clientEntry.contact_id && contactMap[clientEntry.contact_id] && React.createElement(ContactMiniCard, {
          c: contactMap[clientEntry.contact_id], roleColor: role.color,
          sourceBadge: { label: "Client Added", color: "#f59e0b" },
          onOpen: onSelectContact ? function() { onSelectContact(contactMap[clientEntry.contact_id]); } : null,
          onRemove: function() { removeEntry(role.key, "client"); },
          canRemove: isInternal || !isInternal,
        }),

        // Client-entered data (not yet imported)
        clientEntry && !clientEntry.contact_id && clientEntry.client_data && React.createElement(ClientDataCard, {
          roleKey: role.key, roleColor: role.color,
          data: clientEntry.client_data,
          onImport: function() { importClientEntry(role.key, clientEntry.client_data); },
          onEdit: function() {
            setClientForm(function(prev) { var n = Object.assign({}, prev); n[role.key] = Object.assign({}, clientEntry.client_data); return n; });
            setClientEdit(role.key);
          },
          onRemove: function() { removeEntry(role.key, "client"); },
        }),

        // Client edit form
        clientEdit === role.key && React.createElement(ClientEntryForm, { roleKey: role.key, roleColor: role.color }),

        // LO / partner contact picker
        isPickingThis && React.createElement(ContactPicker, { roleKey: role.key, source: picking.source, roleColor: role.color })
      );
    })
  );
}

function ContactDetail({ contact, user, onBack, onSave, onArchive, onDelete, onLogout, onSelectScenario, contacts, onSelectContact, onScenarios, onTasksScenarios, onTasksContacts, activeView, onSetView }) {
  const isInternal = !!(user && user.isInternal);
  const isAdmin    = !!(user && user.role === "admin");
  const isPartner  = !!(user && (user.role === "realtor" || user.role === "builder"));
  const canManage  = isInternal || isPartner;

  // Collapse to single column on mobile (≤768px)
  const [isMobileCD, setIsMobileCD] = React.useState(() => window.innerWidth <= 768);
  React.useEffect(function() {
    function onResize() { setIsMobileCD(window.innerWidth <= 768); }
    window.addEventListener("resize", onResize);
    return function() { window.removeEventListener("resize", onResize); };
  }, []);
  const cols2  = isMobileCD ? "1fr" : "1fr 1fr";
  const cols3  = isMobileCD ? "1fr" : "1fr 1fr 1fr";
  const gap2   = isMobileCD ? "12px" : "24px";

  // ── LO profiles for Assigned LO dropdown ─────────────────────────────────
  const [loProfiles, setLoProfiles] = useState([]);
  useEffectCD(function() {
    if (!supabaseCD) return;
    supabaseCD
      .from("profiles")
      .select("id, display_name, email, role")
      .in("role", ["admin", "super_admin", "branch_admin", "internal", "builder", "realtor"])
      .order("display_name", { ascending: true })
      .then(function(res) {
        if (!res.error && res.data) setLoProfiles(res.data);
      });
  }, []);

  // ── Business contacts for Team Lead picker ────────────────────────────────
  const [loContacts,  setLoContacts]  = useState([]);
  const [cdBranches,  setCdBranches]  = useState([]);
  const isBusiness = contact.contact_type === "business";
  // True when the logged-in LO is viewing their own contact card
  const isOwnProfile = isInternal && user && isBusiness && (
    contact.email_work === user.email || contact.email_personal === user.email || contact.email === user.email
  );
  useEffectCD(function() {
    if (!supabaseCD || !isAdmin || !isBusiness) return;
    // Fetch all business contacts for team lead picker
    supabaseCD
      .from("contacts")
      .select("id, first_name, last_name, company, lo_title, contact_category")
      .eq("contact_type", "business")
      .in("contact_category", ["Loan Officer", "Realtor", "Builder"])
      .order("first_name", { ascending: true })
      .then(function(res) {
        if (!res.error && res.data) setLoContacts(res.data);
      });
    // Fetch branches for branch picker
    supabaseCD
      .from("branches")
      .select("id, name")
      .order("name", { ascending: true })
      .then(function(res) {
        if (!res.error && res.data) setCdBranches(res.data);
      });
  }, [isAdmin, isBusiness]);

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
    company:    contact.company    || "",
    team_name:  contact.team_name  || "",
    photo_url:      contact.photo_url      || "",
    logo_url:       contact.logo_url       || "",
    team_logo_url:  contact.team_logo_url  || "",
    signature_url:  contact.signature_url  || "",
    // Classification
    contact_type:           contact.contact_type            || "client",
    contact_category:       contact.contact_category        || "",
    referred_by_contact_id: contact.referred_by_contact_id  || null,
    assigned_lo_id:         contact.assigned_lo_id          || null,
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
    // LO / partner profile
    lo_title:             contact.lo_title             || "",
    lo_nmls:              contact.lo_nmls              || "",
    lo_license:           contact.lo_license           || "",
    lo_email_display:     contact.lo_email_display     || "",
    lo_company_nmls:      contact.lo_company_nmls      || "",
    lo_branch_nmls:       contact.lo_branch_nmls       || "",
    lo_website:           contact.lo_website           || "",
    team_lead_contact_id: contact.team_lead_contact_id || null,
    branch_id:            contact.branch_id            || null,
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
  const [showPerson2,    setShowPerson2]    = useState(!!(contact.first_name2 || contact.last_name2 || contact.nickname2));
  const [photoUploading, setPhotoUploading] = useState(false);
  const [copiedRefLink,    setCopiedRefLink]    = useState(false);
  const [partnerStatus,    setPartnerStatus]    = useState(null); // null | 'pending' | 'active'
  const [partnershipId,    setPartnershipId]    = useState(null);
  const [partnerSaving,    setPartnerSaving]    = useState(false);

  // Load existing partnership status for this contact
  React.useEffect(function() {
    if (!supabaseCD || !isBusiness || !contact.email_personal) return;
    var fn = window.fetchMyPartnerships;
    if (!fn) return;
    fn().then(function(res) {
      if (res.error || !res.data) return;
      var match = res.data.find(function(p) {
        return p.partner_contact_id === contact.id ||
               (p.partner_email && p.partner_email.toLowerCase() === (contact.email_personal || "").toLowerCase());
      });
      if (match) { setPartnerStatus(match.status); setPartnershipId(match.id); }
    });
  }, [contact.id]);

  const [uploadError, setUploadError] = useState("");
  async function handlePhotoUpload(file, field) {
    if (!file || !supabaseCD) return;
    setUploadError("");
    // Validate file type
    const allowed = ["jpg","jpeg","png","gif","webp","svg"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setUploadError("Unsupported file type. Please use JPG, PNG, GIF, WebP, or SVG.");
      return;
    }
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 5MB. Try compressing the image first.");
      return;
    }
    setPhotoUploading(true);
    const path = contact.id + "/" + field + "-" + Date.now() + "." + ext;
    const { error: upErr } = await supabaseCD.storage.from("contact-photos").upload(path, file, { upsert: true });
    if (upErr) {
      setPhotoUploading(false);
      setUploadError("Upload failed: " + upErr.message + ". Make sure the 'contact-photos' bucket exists in Supabase Storage.");
      return;
    }
    const { data: urlData } = supabaseCD.storage.from("contact-photos").getPublicUrl(path);
    handleFieldChange(field, urlData.publicUrl);
    setPhotoUploading(false);
  }
  const [showContact2, setShowContact2] = useState(!!(contact.first_name2 || contact.last_name2 || contact.phone2 || contact.email2));
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

      // Instant PQ letter update — if this is the logged-in LO's own contact record,
      // propagate the new profile fields immediately without requiring a re-login.
      var isOwnLoContact = (
        editForm.contact_type === "business" &&
        editForm.contact_category === "Loan Officer" &&
        user &&
        (editForm.email_personal === user.email || editForm.email_work === user.email)
      );
      if (isOwnLoContact && window.propagateLOToPreQual) {
        var fullName = [editForm.first_name, editForm.last_name].filter(Boolean).join(" ");
        if (fullName) {
          window.propagateLOToPreQual({
            name:          fullName,
            nmls:          editForm.lo_nmls          || "",
            phone:         editForm.phone_work        || "",
            cell:          editForm.phone_cell        || "",
            email_display: editForm.lo_email_display  || "",
            email:         user.email,
            title:         editForm.lo_title          || "",
            website:       editForm.lo_website        || "",
            branchNmls:    editForm.lo_branch_nmls    || "",
            company:       editForm.company           || "",
            companyNMLS:   editForm.lo_company_nmls   || "",
            address:       editForm.address1_street   || "",
            city:          editForm.address1_city     || "",
            state:         editForm.address1_state    || "",
            zip:           editForm.address1_zip      || "",
          });
        }
      }
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
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#f1f5f9" }}>
        <div
          style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobileCD ? "16px 12px" : "24px 16px", paddingBottom: editMode ? "120px" : "24px", boxSizing: "border-box", width: "100%" }}
          onDoubleClick={isInternal && !editMode ? function (e) {
            if (e.target.tagName === "BUTTON" || e.target.tagName === "A" ||
                e.target.tagName === "INPUT"  || e.target.tagName === "SELECT" ||
                e.target.tagName === "TEXTAREA") return;
            setEditMode(true);
            setSaveError(null);
          } : undefined}
        >

        {/* Tab bar + Create Login + Edit button — all on one row */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
          {/* Row 1: tabs + buttons together */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", gap: "2px", background: "#e2e8f0", borderRadius: "10px", padding: "3px", flex: 1 }}>
            <button
              onClick={function () { if (onSetView) onSetView("contact"); }}
              style={{
                padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", flex: 1, whiteSpace: "nowrap",
                background: activeView === "contact" ? "#ffffff" : "transparent",
                color:      activeView === "contact" ? "#1e3a5f"  : "#64748b",
                boxShadow:  activeView === "contact" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              Contact Info
            </button>
            <button
              onClick={function () { if (onSetView) onSetView("network"); }}
              style={{
                padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", flex: 1, whiteSpace: "nowrap",
                background: activeView === "network" ? "#ffffff" : "transparent",
                color:      activeView === "network" ? "#1e3a5f"  : "#64748b",
                boxShadow:  activeView === "network" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "background 0.15s, color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              My Team
            </button>
            {isInternal && (
              <button
                onClick={function () { if (onSetView) onSetView("internal"); }}
                style={{
                  padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
                  background: activeView === "internal" ? "#ffffff" : "transparent",
                  color:      activeView === "internal" ? "#1e3a5f"  : "#64748b",
                  boxShadow:  activeView === "internal" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "background 0.15s, color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                Internal Notes
              </button>
            )}
          </div>
          </div>{/* end tabs pill */}
          {/* Buttons — same row as tabs, right side */}
          {!editMode && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
              {/* Create Login / Login Active — Contact Info tab only */}
              {activeView === "contact" && canManage && (portalCreated || contact.auth_user_id ||
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
              {/* Edit button replaced by floating action button below */}
            </div>
          )}
          </div>{/* end row */}
        </div>{/* end column wrapper */}

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
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
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
                {isMobileCD && editForm.contact_type !== "client" && (
                  <div>
                    <label style={labelStyle}>Company</label>
                    <input style={fieldStyle} value={editForm.company}
                      onChange={function(e) { handleFieldChange("company", e.target.value); }}
                      placeholder="Employer / company name" />
                  </div>
                )}
                {isMobileCD && editForm.contact_type !== "client" && (
                  <div>
                    <label style={labelStyle}>Team Name</label>
                    <input style={fieldStyle} value={editForm.team_name}
                      onChange={function(e) { handleFieldChange("team_name", e.target.value); }}
                      placeholder="e.g. Sample Team Name" />
                  </div>
                )}
              </div>
              {/* Right column: Company + Team Name for business contacts (desktop only) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {!isMobileCD && editForm.contact_type !== "client" && (
                  <div>
                    <label style={labelStyle}>Company</label>
                    <input style={fieldStyle} value={editForm.company}
                      onChange={function(e) { handleFieldChange("company", e.target.value); }}
                      placeholder="Employer / company name" />
                  </div>
                )}
                {!isMobileCD && editForm.contact_type !== "client" && (
                  <div>
                    <label style={labelStyle}>Team Name</label>
                    <input style={fieldStyle} value={editForm.team_name}
                      onChange={function(e) { handleFieldChange("team_name", e.target.value); }}
                      placeholder="e.g. Sample Team Name" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Read View */
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Photo + logo display for business contacts */}
                {isBusiness && (contact.photo_url || contact.logo_url) && (
                  <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
                    {contact.photo_url && <img src={contact.photo_url} alt="Headshot" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: "50%", border: "2px solid #E8EEF4" }} />}
                    {contact.logo_url  && <img src={contact.logo_url}  alt="Logo"     style={{ height: 56, maxWidth: 100, objectFit: "contain", borderRadius: 6, border: "1px solid #E8EEF4", padding: 4, background: "#fff" }} />}
                  </div>
                )}
                <InfoRow label="Prefix"     value={contact.prefix} />
                <InfoRow label="First Name" value={contact.first_name} />
                <InfoRow label="Nickname"   value={contact.nickname} />
                <InfoRow label="Last Name"  value={contact.last_name} />
                {contact.contact_type !== "client" && <InfoRow label="Company" value={contact.company} />}
              </div>
              {/* Classification moved to Internal Info section below */}
              <div />
            </div>
          )}

        </div>

        {/* Internal Info - LO/Admin only */}
        {(isInternal || isAdmin) && (
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Internal Info</div>
            {editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
                {/* Left: Type + Category */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select style={fieldStyle} value={editForm.contact_type}
                      onChange={function(e) {
                        var newType = e.target.value;
                        var defaultCat = newType === "business" ? "Other" : "Client";
                        setEditForm(function(prev) { return Object.assign({}, prev, { contact_type: newType, contact_category: defaultCat }); });
                      }}>
                      <option value="client">Client</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select style={fieldStyle} value={editForm.contact_category}
                      onChange={function(e) { handleFieldChange("contact_category", e.target.value); }}>
                      {(editForm.contact_type === "business" ? CD_BUSINESS_CATEGORIES : CD_CLIENT_CATEGORIES)
                        .map(function(cat) { return <option key={cat} value={cat}>{cat}</option>; })}
                    </select>
                  </div>
                </div>
                {/* Right: Source + Assigned LO */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Source (Referred By)</label>
                    <ReferralPickerCD value={editForm.referred_by_contact_id}
                      onChange={function(id) { handleFieldChange("referred_by_contact_id", id); }}
                      contacts={contacts || []} excludeId={contact.id} />
                  </div>
                  {editForm.contact_type !== "business" && (
                    <div>
                      <label style={labelStyle}>Assigned LO</label>
                      <select style={fieldStyle} value={editForm.assigned_lo_id || ""}
                        onChange={function(e) { handleFieldChange("assigned_lo_id", e.target.value || null); }}>
                        <option value="">-- Unassigned --</option>
                        {loProfiles.map(function(lo) { return <option key={lo.id} value={lo.id}>{lo.display_name || lo.email}</option>; })}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
                {/* Left: Type + Category */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <InfoRow label="Type" value={contact.contact_type ? contact.contact_type.charAt(0).toUpperCase() + contact.contact_type.slice(1) : ""} />
                <InfoRow label="Category" value={contact.contact_category} />
                </div>
                {/* Right: Source + Assigned LO + Creator + Referral */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Source (Referred By)</div>
                  {(() => {
                    var rb2 = contact.referred_by_contact_id && contacts ? contacts.find(function(c) { return c.id === contact.referred_by_contact_id; }) : null;
                    if (!rb2) return <div style={{ fontSize: "14px", color: "#cbd5e1" }}>&mdash;</div>;
                    var rbn = ((rb2.first_name || "") + " " + (rb2.last_name || "")).trim() || "Unnamed";
                    var rbc = rb2.contact_category || rb2.contact_type || "";
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "14px", color: "#1e293b" }}>{rbn}{rbc ? "  ·  " + rbc : ""}</span>
                        {onSelectContact && <button onClick={function() { onSelectContact(rb2); }} style={{ background: "#e0f2fe", color: "#0369a1", border: "none", borderRadius: "6px", padding: "3px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>Open →</button>}
                      </div>
                    );
                  })()}
                </div>
                {contact.contact_type !== "business" && (() => {
                  var alo = contact.assigned_lo_id ? loProfiles.find(function(lo) { return lo.id === contact.assigned_lo_id; }) : null;
                  return <InfoRow label="Assigned LO" value={alo ? (alo.display_name || alo.email) : null} />;
                })()}
                {isAdmin && (() => {
                  var cn = null;
                  if (contact.creator_id) { var cp2 = loProfiles.find(function(p) { return p.id === contact.creator_id; }); cn = cp2 ? (cp2.display_name || cp2.email) : null; }
                  return <InfoRow label="Creator" value={cn} />;
                })()}
                {isBusiness && (contact.contact_category === "Realtor" || contact.contact_category === "Builder") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Referral Link</div>
                      <button onClick={function() { var lnk = window.location.origin + window.location.pathname + "?from=" + encodeURIComponent(contact.id); navigator.clipboard.writeText(lnk).then(function() { setCopiedRefLink(true); setTimeout(function() { setCopiedRefLink(false); }, 2000); }); }} style={{ background: copiedRefLink ? "#E6F9F0" : "#F0F4F8", color: copiedRefLink ? "#1B8A5A" : "#0C4160", border: "1px solid " + (copiedRefLink ? "#1B8A5A" : "#D1D9E6"), borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {copiedRefLink ? "✓ Copied!" : "📋 Copy Referral Link"}
                      </button>
                    </div>
                    {isAdmin && (
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Partnership</div>
                        {partnerStatus === "active" && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, fontWeight: 700, color: "#1B8A5A", background: "#E6F9F0", borderRadius: 6, padding: "5px 10px" }}>✓ Active Partner</span><button onClick={async function() { setPartnerSaving(true); if (window.removePartnership) await window.removePartnership(partnershipId); setPartnerStatus(null); setPartnershipId(null); setPartnerSaving(false); }} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Unlink</button></div>}
                        {partnerStatus === "pending" && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, fontWeight: 600, color: "#b45309", background: "#fffbeb", borderRadius: 6, padding: "5px 10px" }}>⏳ Invite Pending</span><button onClick={async function() { setPartnerSaving(true); if (window.removePartnership) await window.removePartnership(partnershipId); setPartnerStatus(null); setPartnershipId(null); setPartnerSaving(false); }} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Cancel</button></div>}
                        {!partnerStatus && <button disabled={partnerSaving || !contact.email_personal} onClick={async function() { if (!window.invitePartner || partnerSaving) return; setPartnerSaving(true); var r = await window.invitePartner({ partnerContactId: contact.id, partnerEmail: contact.email_personal }); if (!r.error) { setPartnerStatus("pending"); setPartnershipId(r.data && r.data.id); } setPartnerSaving(false); }} style={{ background: "#0C4160", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: partnerSaving ? "wait" : "pointer", opacity: (!contact.email_personal || partnerSaving) ? 0.5 : 1 }}>{partnerSaving ? "Sending…" : "🤝 Invite to Partner"}</button>}
                      </div>
                    )}
                  </div>
                )}
                </div>{/* end right column */}
              </div>
            )}
          </div>
        )}


        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Contact Info                                                        */}
        {/* Left: Cell/Work/Home/Best   Right: Personal/Work/Other/Best       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Contact Info</div>
          {editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
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

        {/* ── My Team tab ──────────────────────────────────────────── */}
        {activeView === "network" && (
          <TransactionTeamTab
            contact={contact}
            contacts={contacts}
            loProfiles={loProfiles}
            isInternal={isInternal}
            isPartner={isPartner}
            user={user}
            onSelectContact={onSelectContact}
            onNetworkPatched={function(newLinks) {
              if (onSave) onSave(Object.assign({}, contact, { network_links: newLinks }));
            }}
          />
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
          <div style={{ display: "grid", gridTemplateColumns: isMobileCD ? "1fr" : "1fr 1.4fr", gap: isMobileCD ? "14px" : "24px" }}>

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showPerson2 ? 16 : 0 }}>
            <div style={sectionTitleStyle}>Person 2 Info</div>
            <button
              onClick={function() { setShowPerson2(function(v) { return !v; }); }}
              style={{ fontSize: 12, fontWeight: 600, color: "#0C4160", background: showPerson2 ? "#E8EEF4" : "#F0F4F8", border: "1px solid #D1D9E6", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
            >
              {showPerson2 ? "Hide" : "Show"}
            </button>
          </div>
          {showPerson2 && editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
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
          ) : showPerson2 ? (
            (contact.first_name2 || contact.last_name2) ? (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
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
              <div style={{ fontSize: "13px", color: "#94a3b8" }}>No person 2 on record.</div>
            )
          ) : null}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Contact 2 Info                                                     */}
        {/* Left: Cell/Work/Home/Best   Right: Personal/Work/Other/Best       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {(editMode || contact.first_name2 || contact.last_name2 || contact.phone2 || contact.email2) && (
          <div style={sectionStyle}>{cardNum(7)}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showContact2 ? 16 : 0 }}>
              <div style={sectionTitleStyle}>Contact 2 Info</div>
              <button
                onClick={function() { setShowContact2(function(v) { return !v; }); }}
                style={{ fontSize: 12, fontWeight: 600, color: "#0C4160", background: showContact2 ? "#E8EEF4" : "#F0F4F8", border: "1px solid #D1D9E6", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
              >
                {showContact2 ? "Hide" : "Show"}
              </button>
            </div>
            {showContact2 && editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
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
            ) : showContact2 ? (
              /* Read View */
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
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
            ) : null}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 8 — Address Information                                       */}
        {/* Left: Mailing Address 1 + Type   Right: Mailing Address 2 + Type  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle}>{cardNum(8)}
          <div style={sectionTitleStyle}>Address Information</div>
          {editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
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

        {/* Delete moved to edit mode bar — see below */}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* LO / PARTNER PROFILE (business contacts, admin only)              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isBusiness && (isAdmin || isOwnProfile) && (
          <div style={{ ...sectionStyle, borderLeft: "4px solid #0C4160" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ ...sectionTitleStyle, margin: 0, flex: 1 }}>LO / Partner Profile</div>
              <span style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>{isAdmin ? "Admin only · " : ""}Used on PQ letters &amp; team assignments</span>
            </div>

            {editMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* ── Professional Info ── */}
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 }}>Professional Info</div>
                <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 12 }}>
                  {/* Left column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Title</label>
                      <input style={fieldStyle} value={editForm.lo_title} onChange={function(e) { handleFieldChange("lo_title", e.target.value); }} placeholder="e.g. Senior Loan Officer" />
                    </div>
                    {editForm.contact_category !== "Realtor" && editForm.contact_category !== "Builder" && (
                      <>
                        <div>
                          <label style={labelStyle}>Personal NMLS #</label>
                          <input style={fieldStyle} value={editForm.lo_nmls} onChange={function(e) { handleFieldChange("lo_nmls", e.target.value); }} placeholder="729612" />
                        </div>
                        <div>
                          <label style={labelStyle}>Branch NMLS #</label>
                          <input style={fieldStyle} value={editForm.lo_branch_nmls} onChange={function(e) { handleFieldChange("lo_branch_nmls", e.target.value); }} placeholder="Branch NMLS" />
                        </div>
                        <div>
                          <label style={labelStyle}>Company NMLS #</label>
                          <input style={fieldStyle} value={editForm.lo_company_nmls} onChange={function(e) { handleFieldChange("lo_company_nmls", e.target.value); }} placeholder="1820" />
                        </div>
                      </>
                    )}
                    {(editForm.contact_category === "Realtor" || editForm.contact_category === "Builder") && (
                      <div>
                        <label style={labelStyle}>License #</label>
                        <input style={fieldStyle} value={editForm.lo_license} onChange={function(e) { handleFieldChange("lo_license", e.target.value); }} placeholder="TX-123456" />
                      </div>
                    )}
                  </div>
                  {/* Right column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Display Email (for letters)</label>
                      <input style={fieldStyle} value={editForm.lo_email_display} onChange={function(e) { handleFieldChange("lo_email_display", e.target.value); }} placeholder="team@company.com" type="email" />
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>Use if different from login email</div>
                    </div>
                    <div>
                      <label style={labelStyle}>Website</label>
                      <input style={fieldStyle} value={editForm.lo_website} onChange={function(e) { handleFieldChange("lo_website", e.target.value); }} placeholder="https://mortgagemark.com" />
                    </div>
                  </div>
                </div>

                {/* ── Team ── */}
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginTop: 8, marginBottom: 4 }}>Team</div>
                <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Team Lead</label>
                    <select style={fieldStyle} value={editForm.team_lead_contact_id || ""} onChange={function(e) { handleFieldChange("team_lead_contact_id", e.target.value || null); }}>
                      <option value="">— No Team Lead —</option>
                      {loContacts.filter(function(c) { return c.id !== contact.id && c.contact_category === editForm.contact_category; }).map(function(c) {
                        var name = ((c.first_name || "") + " " + (c.last_name || "")).trim() || "(unnamed)";
                        return <option key={c.id} value={c.id}>{name}{c.lo_title ? " · " + c.lo_title : ""}{c.company ? " · " + c.company : ""}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Branch</label>
                    <select style={fieldStyle} value={editForm.branch_id || ""} onChange={function(e) { handleFieldChange("branch_id", e.target.value || null); }}>
                      <option value="">— No Branch —</option>
                      {cdBranches.map(function(b) { return <option key={b.id} value={b.id}>{b.name}</option>; })}
                    </select>
                  </div>
                </div>

              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "8px 16px" }}>
                {contact.lo_title         && <InfoRow label="Title"              value={contact.lo_title} />}
                {contact.lo_nmls          && <InfoRow label="NMLS #"             value={"#" + contact.lo_nmls} />}
                {contact.lo_license       && <InfoRow label="License #"          value={contact.lo_license} />}
                {contact.lo_email_display && <InfoRow label="Display Email"      value={contact.lo_email_display} />}
                {contact.lo_website       && <InfoRow label="Website"            value={contact.lo_website} />}
                {contact.lo_company_nmls  && <InfoRow label="Company NMLS"       value={"#" + contact.lo_company_nmls} />}
                {contact.lo_branch_nmls   && <InfoRow label="Branch NMLS"        value={"#" + contact.lo_branch_nmls} />}
                {contact.team_lead_contact_id && (function() {
                  var lead = loContacts.find(function(c) { return c.id === contact.team_lead_contact_id; });
                  var name = lead ? ((lead.first_name || "") + " " + (lead.last_name || "")).trim() : contact.team_lead_contact_id;
                  return <InfoRow label="Team Lead" value={name} />;
                })()}
                {contact.branch_id && (function() {
                  var branch = cdBranches.find(function(b) { return b.id === contact.branch_id; });
                  return <InfoRow label="Branch" value={branch ? branch.name : contact.branch_id} />;
                })()}
                {!contact.lo_title && !contact.lo_nmls && !contact.lo_email_display && !contact.team_lead_contact_id && (
                  <div style={{ color: "#94a3b8", fontSize: 13, gridColumn: "1 / -1" }}>
                    No LO profile data yet. Click ✏️ Edit to fill in PQ letter info and team assignment.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Photo, Logo & Signature (LO/Admin only) ── */}
        {isBusiness && (isInternal || isAdmin) && (
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Photos &amp; Signature</div>
            {editMode ? (
              <>
                {/* File requirements note */}
                <div style={{ fontSize: 12, color: "#6B7D8A", background: "#F7FAFB", border: "1px solid #E0E8E8", borderRadius: 8, padding: "8px 12px", marginBottom: 14, lineHeight: 1.6 }}>
                  <strong>Accepted formats:</strong> JPG, PNG, GIF, WebP, SVG &nbsp;·&nbsp; <strong>Max size:</strong> 5MB<br />
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>For signatures: use a PNG with a transparent background for the cleanest result on letters.</span>
                </div>
                {/* Upload error */}
                {uploadError && (
                  <div style={{ fontSize: 12, color: "#B91C1C", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                    ⚠ {uploadError}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: cols3, gap: 14 }}>
                  {[["photo_url","Headshot","👤"],["logo_url","Company Logo","🏢"],["team_logo_url","Team / Brand Logo","⭐"],["signature_url","Signature","✍️"]].map(function(f) {
                    var field = f[0], label = f[1], icon = f[2];
                    var url = editForm[field];
                    return (
                      <div key={field}>
                        <label style={labelStyle}>{label}</label>
                        <div
                          onClick={function() {
                            setUploadError("");
                            var inp = document.createElement("input");
                            inp.type = "file";
                            inp.accept = ".jpg,.jpeg,.png,.gif,.webp,.svg,image/jpeg,image/png,image/gif,image/webp,image/svg+xml";
                            inp.onchange = function(e) { if (e.target.files[0]) handlePhotoUpload(e.target.files[0], field); };
                            inp.click();
                          }}
                          style={{ border: "1.5px dashed #D1D9E6", borderRadius: 10, padding: 12, cursor: "pointer", textAlign: "center", background: "#F7FAFB", minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}
                        >
                          {photoUploading
                            ? <><span style={{ fontSize: 20 }}>⏳</span><span style={{ fontSize: 11, color: "#94a3b8" }}>Uploading...</span></>
                            : url
                              ? <img src={url} alt={label} style={{ maxHeight: 70, maxWidth: "100%", objectFit: "contain", borderRadius: field === "photo_url" ? "50%" : 4, background: field === "signature_url" ? "#fff" : "transparent" }} />
                              : <><span style={{ fontSize: 24 }}>{icon}</span><span style={{ fontSize: 11, color: "#94a3b8" }}>Click to upload</span></>
                          }
                        </div>
                        {url && (
                          <button onClick={function() { handleFieldChange(field, ""); setUploadError(""); }} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "3px 0", fontFamily: "inherit" }}>
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                {contact.photo_url && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Headshot</div>
                    <img src={contact.photo_url} alt="Headshot" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%", border: "2px solid #E8EEF4" }} />
                  </div>
                )}
                {contact.logo_url && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Company Logo</div>
                    <img src={contact.logo_url} alt="Logo" style={{ height: 72, maxWidth: 160, objectFit: "contain", borderRadius: 8, border: "1px solid #E8EEF4", padding: 6, background: "#fff" }} />
                  </div>
                )}
                {contact.signature_url && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Signature</div>
                    <img src={contact.signature_url} alt="Signature" style={{ height: 60, maxWidth: 200, objectFit: "contain", border: "1px solid #E8EEF4", borderRadius: 6, padding: 6, background: "#fff" }} />
                  </div>
                )}
                {!contact.photo_url && !contact.logo_url && !contact.signature_url && (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>No photos uploaded yet. Click ✏️ Edit to add a headshot, logo, or signature.</div>
                )}
              </div>
            )}
          </div>
        )}

          </React.Fragment>
        )}

      </div>
      </div>

      {/* ── Floating Edit button (always visible when not in edit mode) ─── */}
      {!editMode && isInternal && (
        <button
          onClick={function () { setEditMode(true); setSaveError(null); }}
          title="Edit contact"
          style={{
            position: "fixed",
            bottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))",
            right: 24,
            zIndex: 290,
            width: 52, height: 52,
            borderRadius: "50%",
            background: "#1e3a5f",
            color: "#fff",
            border: "none",
            fontSize: 22,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={function(e) { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.32)"; }}
          onMouseLeave={function(e) { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)"; }}
        >
          ✏️
        </button>
      )}

      {/* ── Sticky Save / Discard bar (edit mode only) ───────────────────── */}
      {editMode && (
        <div style={{
          position: "fixed", bottom: 0, left: "var(--mtk-sidebar-w, 0px)", right: 0, zIndex: 300,
          background: "#fff", borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.10)",
          paddingTop: "12px", paddingLeft: "24px", paddingRight: "24px",
          paddingBottom: "max(14px, env(safe-area-inset-bottom))",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        }}>
          {/* Delete — admin only, far left, requires edit mode to see */}
          {isAdmin && (
            <button
              onClick={handleDelete}
              title="Permanently delete this contact"
              style={{
                padding: "10px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: "1px solid #fca5a5", background: "transparent", color: "#dc2626",
                cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", marginRight: "auto",
              }}
            >
              🗑 Delete
            </button>
          )}
          {saveError && (
            <div style={{ fontSize: "13px", color: "#dc2626", fontFamily: "'Inter', system-ui, sans-serif" }}>
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
