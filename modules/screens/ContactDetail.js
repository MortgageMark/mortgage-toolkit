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
  if (!leadStatus)  return { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };
  if (leadStatus === "?")                return { bg: "rgba(139,92,246,0.15)",  text: "#7c3aed" };
  if (leadStatus.startsWith("("))        return { bg: "rgba(59,130,246,0.12)",  text: "#1d4ed8" };
  if (leadStatus.startsWith("Waiting") || leadStatus === ".Suspended")  return { bg: "rgba(245,158,11,0.12)",  text: "#b45309" };
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

// Two-level category structure: alpha order, Other last at each level
const CD_BIZ_CAT_TREE = {
  "Builder": [],
  "Lender":  ["Branch Manager", "Employee", "LOA", "Loan Officer", "Processor"],
  "Realtor": [],
  "Vendor":  ["Appraiser", "Insurance", "Title", "Other"],
  "Other":   ["Financial", "Marketing", "Personal"],
};
const CD_BIZ_CATS = ["Builder", "Lender", "Realtor", "Vendor", "Other"];
const CD_BUSINESS_CATEGORIES = CD_BIZ_CATS; // alias for any remaining references

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
        placeholder=""
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
  { key: "builder",   label: "Builder",   color: "#f97316" },
  { key: "realtor",   label: "Realtor",   color: "#7c3aed" },
  { key: "lender",    label: "Lender",    color: "#16a34a" },
  { key: "insurance", label: "Insurance", color: "#0891b2" },
  { key: "title",     label: "Title",     color: "#475569" },
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
  // Fall back to the currently logged-in user if no assigned LO
  if (!assignedLoProfile && isInternal && user && loProfiles && loProfiles.length) {
    assignedLoProfile = loProfiles.find(function(p) { return p.id === user.id; }) || null;
  }
  // Try to find the LO's contact card by email match (for phone number)
  var assignedLoContact = null;
  if (assignedLoProfile && assignedLoProfile.email && contacts && contacts.length) {
    var loEmailLower = assignedLoProfile.email.toLowerCase();
    assignedLoContact = contacts.find(function(c) {
      return (c.email_work || c.email_personal || "").toLowerCase() === loEmailLower;
    }) || null;
  }
  // Also try matching by user.id on contact's created_by / auth_user_id if email match missed
  if (!assignedLoContact && isInternal && user && contacts && contacts.length) {
    assignedLoContact = contacts.find(function(c) {
      return c.auth_user_id === user.id;
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
      return React.createElement("a", { href: href, target: href && href.startsWith("http") ? "_blank" : undefined, rel: "noopener noreferrer", style: { display: "flex", alignItems: "center", fontSize: 12, color: "#0C4160", textDecoration: "none", fontFamily: f, padding: "2px 0" } },
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
            style: { fontSize: 13, fontWeight: 600, color: onOpen ? "#2563eb" : "#1e293b", fontFamily: f, cursor: onOpen ? "pointer" : "default", textDecoration: onOpen ? "underline" : "none", background: "none", border: "none", padding: 0, textAlign: "left", lineHeight: 1.3 }
          }, name),
          sourceBadge && React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: "#fff", background: sourceBadge.color, borderRadius: 4, padding: "2px 7px", fontFamily: f } }, sourceBadge.label)
        ),
        canRemove && React.createElement("button", { onClick: onRemove, style: { fontSize: 12, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontFamily: f, flexShrink: 0 } }, "Remove")
      ),
      // Single column details
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
        company  && React.createElement("div", { style: { fontSize: 12, color: "#374151", fontFamily: f } }, company),
        teamName && React.createElement("div", { style: { fontSize: 12, color: "#64748b", fontFamily: f } }, teamName),
        address  && React.createElement("div", { style: { fontSize: 12, color: "#64748b", fontFamily: f } }, address),
        (workPhone || cellPhone || workEmail || website) && React.createElement("div", { style: { height: 4 } }),
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
                  React.createElement("button", { onClick: creatorBuilderContact && onSelectContact ? function() { onSelectContact(creatorBuilderContact); } : undefined, disabled: !(creatorBuilderContact && onSelectContact), style: { fontSize: 13, fontWeight: 600, color: creatorBuilderContact && onSelectContact ? "#2563eb" : "#1e293b", fontFamily: f, cursor: creatorBuilderContact && onSelectContact ? "pointer" : "default", textDecoration: creatorBuilderContact && onSelectContact ? "underline" : "none", background: "none", border: "none", padding: 0, textAlign: "left" } }, bName),
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
                  React.createElement("button", { onClick: assignedLoContact && onSelectContact ? function() { onSelectContact(assignedLoContact); } : undefined, disabled: !(assignedLoContact && onSelectContact), style: { fontSize: 13, fontWeight: 600, color: assignedLoContact && onSelectContact ? "#2563eb" : "#1e293b", fontFamily: f, cursor: assignedLoContact && onSelectContact ? "pointer" : "default", textDecoration: assignedLoContact && onSelectContact ? "underline" : "none", background: "none", border: "none", padding: 0, textAlign: "left" } }, loName),
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

// ── AddressAutocomplete ───────────────────────────────────────────────────────
// Free address search using Nominatim (OpenStreetMap) — no API key needed
function AddressAutocomplete({ onSelect, font }) {
  const [query,    setQuery]    = React.useState("");
  const [results,  setResults]  = React.useState([]);
  const [loading,  setLoading]  = React.useState(false);
  const [open,     setOpen]     = React.useState(false);
  const debounceRef = React.useRef(null);
  const f = font || "'Inter', system-ui, sans-serif";

  function handleInput(e) {
    var val = e.target.value;
    setQuery(val);
    setOpen(false);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 4) { setResults([]); return; }
    debounceRef.current = setTimeout(function() {
      setLoading(true);
      fetch("https://nominatim.openstreetmap.org/search?q=" + encodeURIComponent(val) +
        "&format=json&addressdetails=1&countrycodes=us&limit=6",
        { headers: { "Accept-Language": "en-US" } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          setResults(data || []);
          setOpen(true);
          setLoading(false);
        })
        .catch(function() { setLoading(false); });
    }, 400);
  }

  function pick(item) {
    var a = item.address || {};
    var street = [a.house_number, a.road].filter(Boolean).join(" ");
    var city   = a.city || a.town || a.village || a.hamlet || a.county || "";
    var state  = a.state_code ? a.state_code.toUpperCase() : (a.state || "");
    var zip    = (a.postcode || "").split("-")[0]; // strip ZIP+4
    setQuery(street ? street + ", " + city + ", " + state + " " + zip : item.display_name);
    setOpen(false);
    setResults([]);
    onSelect({ street, city, state, zip });
  }

  return React.createElement("div", { style: { position: "relative", marginBottom: 12 } },
    React.createElement("label", { style: { fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4, fontFamily: f } },
      "🔍 Search Address"
    ),
    React.createElement("input", {
      type: "text", value: query,
      onChange: handleInput,
      onFocus: function() { if (results.length > 0) setOpen(true); },
      onBlur: function() { setTimeout(function() { setOpen(false); }, 200); },
      placeholder: "Start typing an address…",
      style: { width: "100%", padding: "9px 12px", border: "1.5px solid #cbd5e1", borderRadius: 8,
        fontSize: 14, fontFamily: f, outline: "none", boxSizing: "border-box",
        background: "#f8fafc" }
    }),
    loading && React.createElement("div", { style: { fontSize: 12, color: "#94a3b8", fontFamily: f, marginTop: 4 } }, "Searching…"),
    open && results.length > 0 && React.createElement("div", {
      style: { position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)", marginTop: 2, maxHeight: 240, overflowY: "auto" }
    },
      results.map(function(item, i) {
        var a = item.address || {};
        var line1 = [a.house_number, a.road].filter(Boolean).join(" ");
        var line2 = [a.city || a.town || a.village, a.state_code, (a.postcode||"").split("-")[0]].filter(Boolean).join(", ");
        return React.createElement("div", {
          key: i,
          onMouseDown: function() { pick(item); },
          style: { padding: "10px 14px", cursor: "pointer", borderBottom: i < results.length - 1 ? "1px solid #f1f5f9" : "none",
            fontFamily: f, fontSize: 13 },
          onMouseEnter: function(e) { e.currentTarget.style.background = "#f0f4f8"; },
          onMouseLeave: function(e) { e.currentTarget.style.background = "#fff"; }
        },
          React.createElement("div", { style: { fontWeight: 600, color: "#1e293b" } }, line1 || item.display_name.split(",")[0]),
          line2 && React.createElement("div", { style: { fontSize: 12, color: "#64748b", marginTop: 2 } }, line2)
        );
      })
    )
  );
}

// ── ActivityNotesPanel ────────────────────────────────────────────────────────
// Right-panel notes feed with type (Call / Left Message / Note), author, timestamp
const NOTE_TYPES = [
  { value: "call",    label: "Call",     icon: "📞", color: "#16a34a" },
  { value: "leftmsg", label: "Message",  icon: "📱", color: "#d97706" },
  { value: "meeting", label: "Meeting",  icon: "🤝", color: "#7c3aed" },
  { value: "note",    label: "Note",     icon: "📝", color: "#1e3a5f" },
];
// Encode type into body: "call|body text"
function encodeNote(type, body) { return type + "|" + body; }
function decodeNote(raw) {
  var sep = raw.indexOf("|");
  if (sep < 0) return { type: "note", body: raw };
  var t = raw.slice(0, sep);
  if (["note","call","leftmsg","meeting"].includes(t)) return { type: t, body: raw.slice(sep + 1) };
  return { type: "note", body: raw };
}

// A note is "long" if it has > 160 chars or multiple lines
function isLongNote(body) {
  return body.length > 160 || body.indexOf("\n") >= 0;
}
const COLLAPSED_MAX_HEIGHT = 72; // px

function ActivityNotesPanel({ contactId, userName, font, isMobile, width }) {
  const [notes,       setNotes]       = React.useState([]);
  const [loading,     setLoading]     = React.useState(true);
  const [noteText,    setNoteText]    = React.useState("");
  const [noteType,    setNoteType]    = React.useState("note");
  const [saving,      setSaving]      = React.useState(false);
  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const [allExpanded, setAllExpanded] = React.useState(false);
  const f = font || "'Inter', system-ui, sans-serif";
  const addFn   = window.addContactNoteToSupabase;
  const fetchFn = window.fetchContactNotesFromSupabase;

  function toggleNote(id) {
    setExpandedIds(function(prev) {
      var next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function expandAll(noteList) {
    setExpandedIds(new Set((noteList || notes).map(function(n) { return n.id; })));
    setAllExpanded(true);
  }
  function collapseAll() {
    setExpandedIds(new Set());
    setAllExpanded(false);
  }

  React.useEffect(function() {
    if (!contactId || !fetchFn) { setLoading(false); return; }
    fetchFn(contactId).then(function(res) {
      setNotes(res.data || []);
      setLoading(false);
    });
  }, [contactId]);

  async function handleSubmit() {
    if (!noteText.trim() || saving || !addFn) return;
    setSaving(true);
    var body = encodeNote(noteType, noteText.trim());
    var res = await addFn({ contactId, body });
    if (!res.error && res.data) {
      setNotes(function(prev) { return [res.data, ...prev]; });
      setNoteText("");
    }
    setSaving(false);
  }

  var panelStyle = isMobile
    ? { padding: "16px 16px 32px", fontFamily: f }
    : { width: width || 700, flexShrink: 0, height: "100%", overflowY: "auto",
        borderLeft: "1px solid #e2e8f0", background: "#fff", padding: "20px 16px",
        fontFamily: f, display: "flex", flexDirection: "column" };

  return React.createElement("div", { style: panelStyle },
    // Header
    React.createElement("div", { style: { fontWeight: 800, fontSize: 15, color: "#1e3a5f", marginBottom: 14, letterSpacing: "-0.01em" } }, "Activity Log"),

    // Note type selector
    React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
      NOTE_TYPES.map(function(t) {
        var active = noteType === t.value;
        return React.createElement("button", {
          key: t.value,
          onClick: function() { setNoteType(t.value); },
          style: { flex: 1, padding: "6px 4px", fontSize: 12, fontWeight: 700, fontFamily: f,
            border: "1.5px solid " + (active ? t.color : "#e2e8f0"),
            borderRadius: 7, cursor: "pointer",
            background: active ? t.color : "#fff",
            color: active ? "#fff" : "#64748b",
            transition: "all 0.15s" }
        }, t.icon + " " + t.label);
      })
    ),

    // Text area
    React.createElement("textarea", {
      value: noteText,
      onChange: function(e) { setNoteText(e.target.value); },
      onKeyDown: function(e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); },
      placeholder: "Add a note… (Ctrl+Enter to submit)",
      rows: 3,
      style: { width: "100%", padding: "9px 11px", border: "1.5px solid #e2e8f0", borderRadius: 8,
        fontSize: 13, fontFamily: f, resize: "vertical", outline: "none", boxSizing: "border-box",
        marginBottom: 8, lineHeight: 1.5, minHeight: 72 }
    }),
    React.createElement("button", {
      onClick: handleSubmit,
      disabled: !noteText.trim() || saving,
      style: { width: "100%", padding: "8px 0", background: !noteText.trim() || saving ? "#e2e8f0" : "#1e3a5f",
        color: !noteText.trim() || saving ? "#94a3b8" : "#fff", border: "none", borderRadius: 8,
        fontSize: 13, fontWeight: 700, fontFamily: f, cursor: !noteText.trim() || saving ? "default" : "pointer",
        marginBottom: 16 }
    }, saving ? "Saving…" : "Add Note"),

    // Expand / Collapse All — only shown when there are long notes
    notes.some(function(n) { return isLongNote(decodeNote(n.body || "").body); }) && React.createElement("div", {
      style: { display: "flex", justifyContent: "flex-end", marginBottom: 8 }
    },
      React.createElement("button", {
        onClick: function() { allExpanded ? collapseAll() : expandAll(); },
        style: { fontSize: 11, fontWeight: 700, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontFamily: f, padding: 0, textDecoration: "underline" }
      }, allExpanded ? "↑ Collapse All" : "↓ Expand All")
    ),

    // Divider
    React.createElement("div", { style: { height: 1, background: "#f1f5f9", marginBottom: 12 } }),

    // Feed
    loading
      ? React.createElement("div", { style: { fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "20px 0" } }, "Loading…")
      : notes.length === 0
        ? React.createElement("div", { style: { fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "20px 0" } }, "No notes yet.")
        : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12, flex: 1, overflowY: isMobile ? "visible" : "auto" } },
            notes.map(function(n) {
              var decoded = decodeNote(n.body || "");
              var typeMeta = NOTE_TYPES.find(function(t) { return t.value === decoded.type; }) || NOTE_TYPES[0];
              var author = (n.profiles && n.profiles.display_name) || "";
              var ts = n.created_at ? new Date(n.created_at) : null;
              var tsLabel = ts ? ts.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) + " " + ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
              var isLong     = isLongNote(decoded.body);
              var isExpanded = expandedIds.has(n.id);
              return React.createElement("div", {
                key: n.id,
                style: { background: "#f8fafc", borderRadius: 8, padding: "10px 12px", borderLeft: "3px solid " + typeMeta.color }
              },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" } },
                  React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: "#fff", background: typeMeta.color, borderRadius: 4, padding: "2px 8px" } }, typeMeta.icon + " " + typeMeta.label),
                  React.createElement("span", { style: { fontSize: 11, color: "#64748b", fontWeight: 600 } },
                    (author ? author + " · " : "") + tsLabel
                  )
                ),
                React.createElement("div", {
                  style: {
                    fontSize: 13, color: "#1e293b", lineHeight: 1.55,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    overflow: "hidden",
                    maxHeight: isLong && !isExpanded ? COLLAPSED_MAX_HEIGHT + "px" : "none",
                    maskImage: isLong && !isExpanded ? "linear-gradient(to bottom, black 60%, transparent 100%)" : "none",
                    WebkitMaskImage: isLong && !isExpanded ? "linear-gradient(to bottom, black 60%, transparent 100%)" : "none",
                  }
                }, decoded.body),
                isLong && React.createElement("button", {
                  onClick: function() { toggleNote(n.id); },
                  style: { marginTop: 4, fontSize: 11, fontWeight: 700, color: typeMeta.color, background: "none", border: "none", cursor: "pointer", fontFamily: f, padding: 0 }
                }, isExpanded ? "↑ Show less" : "↓ Read more")
              );
            })
          )
  );
}

function ContactDetail({ contact, user, onBack, onSave, onArchive, onDelete, onLogout, onSelectScenario, contacts, onSelectContact, onScenarios, onTasksScenarios, onTasksContacts, activeView, onSetView }) {
  // "lo" included as a legacy fallback — some cached user objects may still carry the old role string
  const INTERNAL_ROLES_CD = ["super_admin", "admin", "branch_admin", "internal", "lo"];
  const isInternal = !!(user && (user.isInternal === true || (user.role && INTERNAL_ROLES_CD.includes(user.role))));
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

  // Draggable right panel width
  const [rightPanelWidth, setRightPanelWidth] = React.useState(function() {
    try { var s = localStorage.getItem("cd_notes_width"); var maxW = Math.floor(window.innerWidth * 0.4); return s ? Math.min(parseInt(s) || 380, maxW) : Math.min(380, maxW); } catch(e) { return 380; }
  });
  const isDraggingRef = React.useRef(false);
  function startDrag(e) {
    isDraggingRef.current = true;
    var startX = e.clientX;
    var startW = rightPanelWidth;
    function onMove(ev) {
      if (!isDraggingRef.current) return;
      var delta = startX - ev.clientX; // drag left = wider
      var newW = Math.max(280, Math.min(900, startW + delta));
      setRightPanelWidth(newW);
      try { localStorage.setItem("cd_notes_width", String(newW)); } catch(ex) {}
    }
    function onUp() {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  const cols2  = isMobileCD ? "1fr" : "1fr 1fr";
  const cols3  = isMobileCD ? "1fr" : "1fr 1fr 1fr";
  const gap2   = isMobileCD ? "12px" : "24px";
  // Applied to the RIGHT column div of any two-column section on mobile
  const rightColStyle = isMobileCD
    ? { borderTop: "1px solid #cbd5e1", paddingTop: 14, marginTop: 8 }
    : {};

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
  // Requires user.email to be a real non-empty string so null/undefined never accidentally match
  const _userEmail = (user && user.email && typeof user.email === "string" && user.email.trim()) ? user.email.toLowerCase() : null;
  const isOwnProfile = !!(isInternal && _userEmail && isBusiness && (
    (contact.email_work      && contact.email_work.toLowerCase()      === _userEmail) ||
    (contact.email_personal  && contact.email_personal.toLowerCase()  === _userEmail) ||
    (contact.email           && contact.email.toLowerCase()           === _userEmail)
  ));
  useEffectCD(function() {
    if (!supabaseCD || !isAdmin || !isBusiness) return;
    // Fetch all business contacts for team lead picker
    supabaseCD
      .from("contacts")
      .select("id, first_name, last_name, company, lo_title, contact_category")
      .eq("contact_type", "business")
      .in("contact_category", ["Lender", "Realtor", "Builder"])
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
    contact_subcategory:    contact.contact_subcategory     || "",
    referred_by_contact_id: contact.referred_by_contact_id  || null,
    assigned_lo_id:         contact.assigned_lo_id          || null,
    // Phone (fall back to legacy phone field for existing records)
    phone_cell: contact.phone_cell || contact.phone || "",
    phone_work: contact.phone_work || "",
    phone_home: contact.phone_home || "",
    phone_best: contact.phone_best || (function() {
      var phones = [contact.phone_cell || contact.phone, contact.phone_work, contact.phone_home].filter(Boolean);
      if (phones.length === 1) {
        if (contact.phone_cell || contact.phone) return "Cell";
        if (contact.phone_work) return "Work";
        if (contact.phone_home) return "Home";
      }
      return "";
    })(),
    // Email (fall back to legacy email field for existing records)
    email_personal: contact.email_personal || contact.email || "",
    email_work:     contact.email_work     || "",
    email_other:    contact.email_other    || "",
    email_best:     contact.email_best     || (function() {
      var emails = [contact.email_personal || contact.email, contact.email_work, contact.email_other].filter(Boolean);
      if (emails.length === 1) {
        if (contact.email_personal || contact.email) return "Personal";
        if (contact.email_work) return "Work";
        if (contact.email_other) return "Other";
      }
      return "";
    })(),
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
    mailing_address_primary: contact.mailing_address_primary || "address1",
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
  const [mobileTab,      setMobileTab]      = useState("scenarios"); // tracks active mobile tab highlight

  // Scroll-spy: update active tab as sections scroll into view (mobile only)
  React.useEffect(function() {
    if (!isMobileCD) return;
    var sc = document.getElementById("cd-scroll-container");
    if (!sc) return;
    var SECTIONS = [
      { id: "cd-notes-mobile",     tab: "notes"     },
      { id: "cd-team-section",     tab: "team"      },
      { id: "cd-scenarios-section", tab: "scenarios" },
    ];
    function onScroll() {
      var scTop = sc.getBoundingClientRect().top;
      for (var i = 0; i < SECTIONS.length; i++) {
        var el = document.getElementById(SECTIONS[i].id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - scTop <= 80) {
          setMobileTab(SECTIONS[i].tab);
          return;
        }
      }
      setMobileTab("scenarios");
    }
    sc.addEventListener("scroll", onScroll, { passive: true });
    return function() { sc.removeEventListener("scroll", onScroll); };
  }, [isMobileCD]);

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
        editForm.contact_category === "Lender" &&
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
    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "New Scenario";
    const scenarioName = window.prompt("Scenario name:", contactName);
    if (scenarioName === null) return; // user cancelled
    setCreatingScenario(true);
    const finalName = scenarioName.trim() || contactName;
    try {
      const uid = "s_" + Date.now();
      const { data, error } = await cdSaveScenario({
        uid:             uid,
        name:            finalName,
        notes:           "",
        calculationData: { uid: uid },
        contact_id:      contact.id,
        lead_status:     "",
        loan_purpose:    "purchase",
      });
      if (error || !data) { alert("Could not create scenario. Please try again."); return; }
      onSelectScenario({
        id:               data.id,
        clientName:       data.name || contactName,
        notes:            "",
        createdBy:        data.user_id,
        status:           "active",
        lead_status:      "",
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
        lead_status:      data.lead_status   || "",
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
    maxWidth: "640px",
  };
  // Double-click anywhere on a card opens edit mode
  const cardDoubleClick = (isInternal && !editMode) ? function(e) {
    var tag = e.target.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    setEditMode(true); setSaveError(null);
  } : null;
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

  // Live phone formatter — formats as digits are entered: (972) 829-8639
  function liveFormatPhone(raw) {
    var digits = (raw || "").replace(/\D/g, "");
    // Strip leading 1 for display
    if (digits.length === 11 && digits[0] === "1") digits = digits.slice(1);
    if (digits.length === 0)  return "";
    if (digits.length <= 3)   return "(" + digits;
    if (digits.length <= 6)   return "(" + digits.slice(0,3) + ") " + digits.slice(3);
    return "(" + digits.slice(0,3) + ") " + digits.slice(3,6) + "-" + digits.slice(6,10);
  }
  function handlePhoneChange(field, e) {
    var input = e.target;
    var raw = input.value;
    var cursorPos = input.selectionStart;
    var oldDigitsBefore = (raw.slice(0, cursorPos).replace(/\D/g, "")).length;
    var newFormatted = liveFormatPhone(raw);
    handleFieldChange(field, newFormatted);
    // Restore cursor: find position after oldDigitsBefore digits in new formatted string
    requestAnimationFrame(function() {
      var count = 0;
      var newPos = newFormatted.length;
      for (var i = 0; i < newFormatted.length; i++) {
        if (/\d/.test(newFormatted[i])) { count++; }
        if (count === oldDigitsBefore && /\d/.test(newFormatted[i])) { newPos = i + 1; break; }
      }
      try { input.setSelectionRange(newPos, newPos); } catch(ex) {}
    });
  }
  function handlePhoneBlur(field) {
    // Already formatted live — just clean up edge cases
    var raw = editForm[field] || "";
    var digits = raw.replace(/\D/g, "");
    if (digits.length === 10)
      handleFieldChange(field, "(" + digits.slice(0,3) + ") " + digits.slice(3,6) + "-" + digits.slice(6));
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

      {/* ── Body row: contact card left + notes right ────────── */}
      <div style={{ flex: 1, display: "grid", overflow: "hidden", gridTemplateColumns: (isInternal && !isMobileCD) ? ("1fr 6px " + rightPanelWidth + "px") : "1fr" }}>

        {/* ── Contact card scroll area ── */}
        <div id="cd-scroll-container" style={{ minWidth: 0, overflowY: "auto", overflowX: "hidden", background: "#f1f5f9" }}>

        {/* ── MOBILE FROZEN TAB BAR ── */}
        {isMobileCD && (
          <div id="cd-content-top" style={{
            flexShrink: 0, zIndex: 50, background: "#f1f5f9",
            padding: "10px 12px 6px", borderBottom: "1px solid #e2e8f0",
            display: "flex", flexDirection: "column", gap: "8px",
          }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
          <div style={{ display: "flex", gap: "2px", background: "#e2e8f0", borderRadius: "10px", padding: "3px", width: "fit-content" }}>
            {isInternal && (
              <button onClick={function() {
                setMobileTab("scenarios");
                if (onSetView) onSetView("contact");
                var el = document.getElementById("cd-scenarios-section"); if (el) el.scrollIntoView({ behavior: "auto" });
              }} style={{ padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter', system-ui, sans-serif", background: mobileTab === "scenarios" ? "#ffffff" : "transparent", color: mobileTab === "scenarios" ? "#1e3a5f" : "#64748b", boxShadow: mobileTab === "scenarios" ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
                Scenarios
              </button>
            )}
            {contact.contact_type === "client" && (
              <button onClick={function() {
                setMobileTab("team");
                var el = document.getElementById("cd-team-section"); if (el) el.scrollIntoView({ behavior: "auto" });
              }} style={{ padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", whiteSpace: "nowrap", background: mobileTab === "team" ? "#ffffff" : "transparent", color: mobileTab === "team" ? "#1e3a5f" : "#64748b", boxShadow: mobileTab === "team" ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
                Team
              </button>
            )}
            {isInternal && (
              <button onClick={function() {
                setMobileTab("notes");
                var el = document.getElementById("cd-notes-mobile"); if (el) el.scrollIntoView({ behavior: "auto" });
              }} style={{ padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter', system-ui, sans-serif", background: mobileTab === "notes" ? "#ffffff" : "transparent", color: mobileTab === "notes" ? "#1e3a5f" : "#64748b", boxShadow: mobileTab === "notes" ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
                Notes
              </button>
            )}
          </div>
          </div>
          </div>
        )}

        <div
          style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobileCD ? "12px 12px 16px" : "24px 16px", paddingBottom: editMode ? "120px" : "24px", boxSizing: "border-box", width: "100%" }}
          onDoubleClick={isInternal && !editMode ? function (e) {
            var tag = e.target.tagName;
            if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
            setEditMode(true);
            setSaveError(null);
          } : null}
        >

        {/* Tab bar + Create Login + Edit button — desktop only now */}
        <div id="cd-content-top" style={{
          display: isMobileCD ? "none" : "flex", flexDirection: "column", gap: "8px", marginBottom: "12px",
        }}>
          {/* Row 1: tabs + buttons together */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ display: (contact.contact_type === "client" || isMobileCD) ? "flex" : "none", gap: "2px", background: "#e2e8f0", borderRadius: "10px", padding: "3px", width: "fit-content" }}>
            {/* Scenarios — first on mobile */}
            {isInternal && isMobileCD && (
              <a href="#cd-scenarios-section"
                style={{
                  padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  textDecoration: "none", whiteSpace: "nowrap",
                  background: "transparent", color: "#64748b",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  display: "inline-block",
                }}
              >
                Scenarios
              </a>
            )}
            <button
              onClick={function () { if (onSetView) onSetView("contact"); }}
              style={{
                padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", whiteSpace: "nowrap",
                background: activeView === "contact" ? "#ffffff" : "transparent",
                color:      activeView === "contact" ? "#1e3a5f"  : "#64748b",
                boxShadow:  activeView === "contact" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              Contact
            </button>
            {contact.contact_type === "client" && (
              <button
                onClick={function () { var el = document.getElementById("cd-team-section"); if (el) el.scrollIntoView({ behavior: "auto" }); }}
                style={{
                  padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  border: "none", cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif", whiteSpace: "nowrap",
                  background: "transparent", color: "#64748b",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                Team
              </button>
            )}
            {/* Notes — last on mobile */}
            {isInternal && isMobileCD && (
              <a href="#cd-notes-mobile"
                style={{
                  padding: "5px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                  textDecoration: "none", whiteSpace: "nowrap",
                  background: "transparent", color: "#64748b",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  display: "inline-block",
                }}
              >
                Notes
              </a>
            )}
          </div>{/* end tabs pill */}
          {/* Buttons — same row as tabs, right side */}
          {!editMode && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
              {/* Create Login / Login Active — Contact Info tab only */}
              {/* Create Login button — only shown when no portal exists yet */}
              {activeView === "contact" && canManage && !(portalCreated || contact.auth_user_id) &&
                (contact.email_personal || contact.email || contact.email_work) && (
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
              )}
              {/* Edit button replaced by floating action button below */}
            </div>
          )}
          </div>{/* end row */}
        </div>{/* end column wrapper */}

        {true && (
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
        {/* CARD 1 — Scenarios                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div id="cd-scenarios-section" style={sectionStyle} onDoubleClick={cardDoubleClick}>{cardNum(1)}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={sectionTitleStyle}>Scenarios</div>
            {onSelectScenario && (
              <button onClick={handleNewScenario} disabled={creatingScenario} style={{
                background: creatingScenario ? "#e2e8f0" : "#1e3a5f",
                color: creatingScenario ? "#94a3b8" : "#fff",
                border: "none", borderRadius: "7px", padding: "5px 14px",
                fontSize: "12px", fontWeight: 700, cursor: creatingScenario ? "not-allowed" : "pointer",
              }}>
                {creatingScenario ? "Creating…" : "+ New Scenario"}
              </button>
            )}
          </div>
          {scenariosLoading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px", fontSize: "14px" }}>Loading...</div>
          ) : linkedScenarios.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "14px", padding: "12px 0" }}>No scenarios yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ textAlign: "left", padding: "7px 12px", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>Scenario Name</th>
                    <th style={{ textAlign: "left", padding: "7px 12px", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>Purpose</th>
                    <th style={{ textAlign: "left", padding: "7px 12px", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Created</th>
                    <th style={{ padding: "7px 12px", borderBottom: "1px solid #e2e8f0" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {linkedScenarios.map(function(s, i) {
                    var lp = s.loan_purpose || "purchase";
                    var lpLabel = cdGetLoanPurposeLabel(lp);
                    var createdDate = s.created_at ? new Date(s.created_at).toLocaleDateString() : "—";
                    return (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 600, color: "#1e293b" }}>
                          {s.name || "Untitled Scenario"}
                        </td>
                        <td style={{ padding: "9px 12px", color: "#475569" }}>{lpLabel}</td>
                        <td style={{ padding: "9px 12px", color: "#94a3b8", whiteSpace: "nowrap" }}>{createdDate}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right" }}>
                          {onSelectScenario && (
                            <a href={"/scenarios/" + s.id}
                              onClick={function(e) {
                                if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                                e.preventDefault();
                                handleOpenScenario(s.id);
                              }}
                              style={{
                                display: "inline-block",
                                background: openingScenario === s.id ? "#e2e8f0" : "#1e3a5f",
                                color: openingScenario === s.id ? "#94a3b8" : "#fff",
                                borderRadius: "6px", padding: "4px 12px",
                                fontSize: "12px", fontWeight: 600,
                                pointerEvents: openingScenario === s.id ? "none" : "auto",
                                whiteSpace: "nowrap", textDecoration: "none",
                              }}>
                              {openingScenario === s.id ? "Opening..." : "Open →"}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD — Follow Up (Internal only)                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isInternal && (
          <div style={{ ...sectionStyle, borderLeft: "4px solid #1e3a5f" }} onDoubleClick={cardDoubleClick}>
            <div style={sectionTitleStyle}>Follow Up (Internal)</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobileCD ? "1fr" : "1fr 1fr", gap: isMobileCD ? "14px" : "24px" }}>
              {/* Left: FU fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {editMode ? (
                  <React.Fragment>
                    <div>
                      <label style={labelStyle}>FU: Next</label>
                      <input type="date" style={fieldStyle} value={editForm.fu_date}
                        onChange={function(e) { handleFieldChange("fu_date", e.target.value); }} />
                    </div>
                    <div>
                      <label style={labelStyle}>FU: Who</label>
                      <select style={fieldStyle} value={editForm.fu_who}
                        onChange={function(e) { handleFieldChange("fu_who", e.target.value); }}>
                        <option value="">—</option>
                        <option value="MP">MP</option>
                        <option value="JW">JW</option>
                        <option value="TP">TP</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>FU: Priority</label>
                      <select style={fieldStyle} value={editForm.fu_priority}
                        onChange={function(e) { handleFieldChange("fu_priority", e.target.value); }}>
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
              {/* Right: Notes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {editMode ? (
                  <React.Fragment>
                    <div>
                      <label style={labelStyle}>Quick Note</label>
                      <input type="text" style={fieldStyle} maxLength={120}
                        value={editForm.note_quick}
                        onChange={function(e) { handleFieldChange("note_quick", e.target.value); }} />
                      <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "right", marginTop: "3px" }}>
                        {(editForm.note_quick || "").length}/120
                      </div>
                    </div>
                    <div>
                      <label style={Object.assign({}, labelStyle, { display: "flex", alignItems: "center", gap: 5 })}>
                        Permanent Note
                        <span title={"Use this for things you want to quickly reference:\n• \"Listing Agent for John Smith's purchase\"\n• \"Goal: 12 buyer + 12 listing sides; did 15 last year\"\n• \"Kids: Bobby (boy, 2010) and Taylor (boy, 2015)\"\n• \"Has a golden retriever named Fido\""}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 15, height: 15, borderRadius: "50%", background: "#94a3b8",
                            color: "#fff", fontSize: 10, fontWeight: 700, cursor: "default",
                            flexShrink: 0, lineHeight: 1 }}>i</span>
                      </label>
                      <textarea style={Object.assign({}, fieldStyle, { minHeight: "80px", resize: "vertical" })}
                        value={editForm.notes}
                        onChange={function(e) { handleFieldChange("notes", e.target.value); }} />
                    </div>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <InfoRow label="Quick Note"     value={contact.note_quick || null} />
                    <InfoRow label="Permanent Note ⓘ" value={contact.notes || null} labelTitle={"Use for quick-reference info:\n• Listing Agent for John Smith's purchase\n• Goal: 12 buyer + 12 listing sides\n• Kids: Bobby (boy, 2010) and Taylor (boy, 2015)\n• Has a golden retriever named Fido"} />
                  </React.Fragment>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 2 — Personal Info                                             */}
        {/* Left: First / Nickname / Last   Right: Type / Category / Source   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle} onDoubleClick={cardDoubleClick}>{cardNum(2)}
          <div style={sectionTitleStyle}>Names</div>
          {editMode ? (
            <div>
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
              {/* Left: Name (Client 1) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 }}>Person 1</div>
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
                    placeholder=""
                  />
                </div>
                <div>
                  <label style={labelStyle}>Nickname</label>
                  <input
                    style={fieldStyle}
                    value={editForm.nickname}
                    onChange={function (e) { handleFieldChange("nickname", e.target.value); }}
                    placeholder=""
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    style={fieldStyle}
                    value={editForm.last_name}
                    onChange={function (e) { handleFieldChange("last_name", e.target.value); }}
                    placeholder=""
                  />
                </div>
              </div>
              {/* Right column: Person 2 fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={isMobileCD ? { borderTop: "1px solid #cbd5e1", marginTop: 8, paddingTop: 14, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 } : { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 }}>Person 2</div>
                <div>
                  <label style={labelStyle}>Prefix (2)</label>
                  <select style={fieldStyle} value={editForm.prefix2}
                    onChange={function(e) { handleFieldChange("prefix2", e.target.value); }}>
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
                  <label style={labelStyle}>First Name (2)</label>
                  <input style={fieldStyle} value={editForm.first_name2}
                    onChange={function(e) { handleFieldChange("first_name2", e.target.value); }} placeholder="" />
                </div>
                <div>
                  <label style={labelStyle}>Nickname (2)</label>
                  <input style={fieldStyle} value={editForm.nickname2}
                    onChange={function(e) { handleFieldChange("nickname2", e.target.value); }} placeholder="" />
                </div>
                <div>
                  <label style={labelStyle}>Last Name (2)</label>
                  <input style={fieldStyle} value={editForm.last_name2}
                    onChange={function(e) { handleFieldChange("last_name2", e.target.value); }} placeholder="" />
                </div>
                <div>
                  <label style={labelStyle}>Connection to Person 1</label>
                  <select style={fieldStyle} value={editForm.connection_to_contact1}
                    onChange={function(e) { handleFieldChange("connection_to_contact1", e.target.value); }}>
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
            </div>
          ) : (
            /* Read View */
            <div>
            <div style={{ display: "grid", gridTemplateColumns: contact.first_name2 ? cols2 : "1fr", gap: "16px" }}>
              {/* Left: Name fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {contact.first_name2 && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 }}>Person 1</div>}
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
              </div>
              {/* Right: Person 2 — only shown when first_name2 exists */}
              {contact.first_name2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={isMobileCD ? { borderTop: "1px solid #cbd5e1", marginTop: 8, paddingTop: 14, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 } : { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 }}>Person 2</div>
                  <InfoRow label="Prefix (2)"     value={contact.prefix2} />
                  <InfoRow label="First Name (2)" value={contact.first_name2} />
                  <InfoRow label="Nickname (2)"   value={contact.nickname2} />
                  <InfoRow label="Last Name (2)"  value={contact.last_name2} />
                  <InfoRow label="Connection"     value={contact.connection_to_contact1} />
                </div>
              )}
            </div>
            </div>
          )}

        </div>

        {/* Internal Info - LO/Admin only */}
        {(isInternal || isAdmin) && (
          <div style={sectionStyle} onDoubleClick={cardDoubleClick}>
            <div style={sectionTitleStyle}>Lead Details (Internal)</div>
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
                        setEditForm(function(prev) { return Object.assign({}, prev, { contact_type: newType, contact_category: defaultCat, contact_subcategory: "" }); });
                      }}>
                      <option value="client">Client</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select style={fieldStyle} value={editForm.contact_category}
                      onChange={function(e) { setEditForm(function(prev) { return Object.assign({}, prev, { contact_category: e.target.value, contact_subcategory: "" }); }); }}>
                      {(editForm.contact_type === "business" ? CD_BIZ_CATS : CD_CLIENT_CATEGORIES)
                        .map(function(cat) { return <option key={cat} value={cat}>{cat}</option>; })}
                    </select>
                  </div>
                  {editForm.contact_type === "business" && CD_BIZ_CAT_TREE[editForm.contact_category] && CD_BIZ_CAT_TREE[editForm.contact_category].length > 0 && (
                    <div>
                      <label style={labelStyle}>Subcategory</label>
                      <select style={fieldStyle} value={editForm.contact_subcategory || ""}
                        onChange={function(e) { handleFieldChange("contact_subcategory", e.target.value); }}>
                        <option value="">— Select —</option>
                        {CD_BIZ_CAT_TREE[editForm.contact_category].map(function(sub) { return <option key={sub} value={sub}>{sub}</option>; })}
                      </select>
                    </div>
                  )}
                </div>
                {/* Right: Source + Assigned LO */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", ...rightColStyle }}>
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
                  {canManage && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Portal Access</div>
                      {(portalCreated || contact.auth_user_id)
                        ? <span style={{ fontSize: "14px", fontWeight: 700, color: "#16a34a" }}>✓ Login Active</span>
                        : <span style={{ fontSize: "14px", color: "#94a3b8" }}>No login yet</span>
                      }
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
                {/* Left: Type + Category */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <InfoRow label="Type" value={contact.contact_type ? contact.contact_type.charAt(0).toUpperCase() + contact.contact_type.slice(1) : ""} />
                <InfoRow label="Category" value={contact.contact_category + (contact.contact_subcategory ? " · " + contact.contact_subcategory : "")} />
                </div>
                {/* Right: Source + Assigned LO + Creator + Referral */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", ...rightColStyle }}>
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
                {canManage && (
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Portal Access</div>
                    {(portalCreated || contact.auth_user_id)
                      ? <span style={{ fontSize: "14px", fontWeight: 700, color: "#16a34a" }}>✓ Login Active</span>
                      : <span style={{ fontSize: "14px", color: "#94a3b8" }}>No login yet</span>
                    }
                  </div>
                )}
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
        {/* Contact Info — phones left column, emails right column           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle} onDoubleClick={cardDoubleClick}>
          <div style={sectionTitleStyle}>Contact Info</div>
          <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
          {/* Left: Phone */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {isMobileCD && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 }}>Phone</div>}
          {editMode ? (
            <React.Fragment>
              <div><label style={labelStyle}>Phone: Cell</label><input style={fieldStyle} type="tel" inputMode="tel" value={editForm.phone_cell} onChange={function(e){handlePhoneChange("phone_cell",e);}} onBlur={function(){handlePhoneBlur("phone_cell");}} placeholder="" /></div>
              <div><label style={labelStyle}>Phone: Work</label><input style={fieldStyle} type="tel" inputMode="tel" value={editForm.phone_work} onChange={function(e){handlePhoneChange("phone_work",e);}} onBlur={function(){handlePhoneBlur("phone_work");}} placeholder="" /></div>
              <div><label style={labelStyle}>Phone: Home</label><input style={fieldStyle} type="tel" inputMode="tel" value={editForm.phone_home} onChange={function(e){handlePhoneChange("phone_home",e);}} onBlur={function(){handlePhoneBlur("phone_home");}} placeholder="" /></div>
              <div><label style={labelStyle}>Phone: Best</label>
                <select style={fieldStyle} value={editForm.phone_best} onChange={function(e){handleFieldChange("phone_best",e.target.value);}}>
                  <option value="">&mdash; Select &mdash;</option>
                  <option value="Cell">Cell</option>
                  <option value="Work">Work</option>
                  <option value="Home">Home</option>
                </select>
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <InfoRow label="Phone: Cell" value={cdFormatPhone(contact.phone_cell || contact.phone)} />
              <InfoRow label="Phone: Work" value={cdFormatPhone(contact.phone_work)} />
              <InfoRow label="Phone: Home" value={cdFormatPhone(contact.phone_home)} />
              <InfoRow label="Phone: Best" value={contact.phone_best || (function() {
                var phones = [contact.phone_cell || contact.phone, contact.phone_work, contact.phone_home].filter(Boolean);
                if (phones.length === 1) { if (contact.phone_cell || contact.phone) return "Cell"; if (contact.phone_work) return "Work"; if (contact.phone_home) return "Home"; }
                return null;
              })()} />
            </React.Fragment>
          )}
          </div>
          {/* Right: Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", ...rightColStyle }}>
            {isMobileCD && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C4160", marginBottom: 4 }}>Email</div>}
            {editMode ? (<React.Fragment>
              <div><label style={labelStyle}>Email: Personal</label><input style={fieldStyle} type="email" value={editForm.email_personal} onChange={function (e) { handleFieldChange("email_personal", e.target.value); }} placeholder="" /></div>
              <div><label style={labelStyle}>Email: Work</label><input style={fieldStyle} type="email" value={editForm.email_work} onChange={function (e) { handleFieldChange("email_work", e.target.value); }} placeholder="" /></div>
              <div><label style={labelStyle}>Email: Other</label><input style={fieldStyle} type="email" value={editForm.email_other} onChange={function (e) { handleFieldChange("email_other", e.target.value); }} placeholder="" /></div>
              <div><label style={labelStyle}>Email: Best</label>
                <select style={fieldStyle} value={editForm.email_best} onChange={function (e) { handleFieldChange("email_best", e.target.value); }}>
                  <option value="">&mdash; Select &mdash;</option>
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </React.Fragment>) : (<React.Fragment>
              <InfoRow label="Email: Personal" value={contact.email_personal || contact.email} />
              <InfoRow label="Email: Work"     value={contact.email_work} />
              <InfoRow label="Email: Other"    value={contact.email_other} />
              <InfoRow label="Email: Best"     value={contact.email_best || (function() {
                var emails = [contact.email_personal || contact.email, contact.email_work, contact.email_other].filter(Boolean);
                if (emails.length === 1) { if (contact.email_personal || contact.email) return "Personal"; if (contact.email_work) return "Work"; if (contact.email_other) return "Other"; }
                return null;
              })()} />
            </React.Fragment>)}
          </div>
          </div>{/* end contact info grid */}
        </div>

          </React.Fragment>
        )}


        {activeView === "internal" && isInternal && (
          <React.Fragment>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 1 — Scenarios (copy)                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle} onDoubleClick={cardDoubleClick}>{cardNum(1)}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={sectionTitleStyle}>Scenarios</div>
            {onSelectScenario && (
              <button onClick={handleNewScenario} disabled={creatingScenario} style={{
                background: creatingScenario ? "#e2e8f0" : "#1e3a5f",
                color: creatingScenario ? "#94a3b8" : "#fff",
                border: "none", borderRadius: "7px", padding: "5px 14px",
                fontSize: "12px", fontWeight: 700, cursor: creatingScenario ? "not-allowed" : "pointer",
              }}>
                {creatingScenario ? "Creating…" : "+ New Scenario"}
              </button>
            )}
          </div>
          {scenariosLoading ? (
            <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px", fontSize: "14px" }}>Loading...</div>
          ) : linkedScenarios.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: "14px", padding: "12px 0" }}>No scenarios yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ textAlign: "left", padding: "7px 12px", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>Scenario Name</th>
                    <th style={{ textAlign: "left", padding: "7px 12px", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0" }}>Purpose</th>
                    <th style={{ textAlign: "left", padding: "7px 12px", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>Created</th>
                    <th style={{ padding: "7px 12px", borderBottom: "1px solid #e2e8f0" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {linkedScenarios.map(function(s, i) {
                    var lp = s.loan_purpose || "purchase";
                    var lpLabel = cdGetLoanPurposeLabel(lp);
                    var createdDate = s.created_at ? new Date(s.created_at).toLocaleDateString() : "—";
                    return (
                      <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "9px 12px", fontWeight: 600, color: "#1e293b" }}>
                          {s.name || "Untitled Scenario"}
                        </td>
                        <td style={{ padding: "9px 12px", color: "#475569" }}>{lpLabel}</td>
                        <td style={{ padding: "9px 12px", color: "#94a3b8", whiteSpace: "nowrap" }}>{createdDate}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right" }}>
                          {onSelectScenario && (
                            <a href={"/scenarios/" + s.id}
                              onClick={function(e) {
                                if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                                e.preventDefault();
                                handleOpenScenario(s.id);
                              }}
                              style={{
                                display: "inline-block",
                                background: openingScenario === s.id ? "#e2e8f0" : "#1e3a5f",
                                color: openingScenario === s.id ? "#94a3b8" : "#fff",
                                borderRadius: "6px", padding: "4px 12px",
                                fontSize: "12px", fontWeight: 600,
                                pointerEvents: openingScenario === s.id ? "none" : "auto",
                                whiteSpace: "nowrap", textDecoration: "none",
                              }}>
                              {openingScenario === s.id ? "Opening..." : "Open →"}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Activity Log (internal only)                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle} onDoubleClick={cardDoubleClick}>{cardNum(4)}
          <div style={sectionTitleStyle}>Activity Log (Internal)</div>

          {isInternal && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <textarea
                  style={Object.assign({}, fieldStyle, { flex: 1, minHeight: "64px", resize: "vertical" })}
                  value={newNote}
                  onChange={function (e) { setNewNote(e.target.value); }}
                  placeholder=""
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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* Contact 2 Info (Person 2 phone/email)                             */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {contact.first_name2 && (
          <div style={sectionStyle} onDoubleClick={cardDoubleClick}>{cardNum(7)}
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
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone: Work</label>
                    <input
                      style={fieldStyle} type="tel"
                      value={editForm.phone2_work}
                      onChange={function (e) { handleFieldChange("phone2_work", e.target.value); }}
                      onBlur={function () { handlePhoneBlur("phone2_work"); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone: Home</label>
                    <input
                      style={fieldStyle} type="tel"
                      value={editForm.phone2_home}
                      onChange={function (e) { handleFieldChange("phone2_home", e.target.value); }}
                      onBlur={function () { handlePhoneBlur("phone2_home"); }}
                      placeholder=""
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
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email: Work</label>
                    <input
                      style={fieldStyle} type="email"
                      value={editForm.email2_work}
                      onChange={function (e) { handleFieldChange("email2_work", e.target.value); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email: Other</label>
                    <input
                      style={fieldStyle} type="email"
                      value={editForm.email2_other}
                      onChange={function (e) { handleFieldChange("email2_other", e.target.value); }}
                      placeholder=""
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
              /* Read View — only show rows with data */
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {contact.phone2      && <InfoRow label="Phone: Cell" value={cdFormatPhone(contact.phone2)} />}
                  {contact.phone2_work && <InfoRow label="Phone: Work" value={cdFormatPhone(contact.phone2_work)} />}
                  {contact.phone2_home && <InfoRow label="Phone: Home" value={cdFormatPhone(contact.phone2_home)} />}
                  {contact.phone2_best && <InfoRow label="Phone: Best" value={contact.phone2_best} />}
                  {!contact.phone2 && !contact.phone2_work && !contact.phone2_home && (
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>No phone on file.</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {contact.email2       && <InfoRow label="Email: Personal" value={contact.email2} />}
                  {contact.email2_work  && <InfoRow label="Email: Work"     value={contact.email2_work} />}
                  {contact.email2_other && <InfoRow label="Email: Other"    value={contact.email2_other} />}
                  {contact.email2_best  && <InfoRow label="Email: Best"     value={contact.email2_best} />}
                  {!contact.email2 && !contact.email2_work && !contact.email2_other && (
                    <div style={{ fontSize: 13, color: "#94a3b8" }}>No email on file.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* COMPANY INFO — hidden for clients                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {contact.contact_type !== "client" && <div style={sectionStyle} onDoubleClick={cardDoubleClick}>
            <div style={sectionTitleStyle}>Company</div>
            {editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Company Name</label>
                    <input style={fieldStyle} value={editForm.company}
                      onChange={function(e) { handleFieldChange("company", e.target.value); }} placeholder="" />
                  </div>
                  <div>
                    <label style={labelStyle}>Branch / Office</label>
                    <select style={fieldStyle} value={editForm.branch_id || ""} onChange={function(e) { handleFieldChange("branch_id", e.target.value || null); }}>
                      <option value="">— No Branch —</option>
                      {cdBranches.map(function(b) { return <option key={b.id} value={b.id}>{b.name}</option>; })}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input style={fieldStyle} value={editForm.lo_title}
                      onChange={function(e) { handleFieldChange("lo_title", e.target.value); }} placeholder="" />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, ...rightColStyle }}>
                  <div>
                    <label style={labelStyle}>Team Name</label>
                    <input style={fieldStyle} value={editForm.team_name}
                      onChange={function(e) { handleFieldChange("team_name", e.target.value); }} placeholder="" />
                  </div>
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
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "8px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <InfoRow label="Company"        value={contact.company} />
                  <InfoRow label="Branch / Office" value={(function() {
                    if (!contact.branch_id) return null;
                    var branch = cdBranches.find(function(b) { return b.id === contact.branch_id; });
                    return branch ? branch.name : contact.branch_id;
                  })()} />
                  <InfoRow label="Title"          value={contact.lo_title} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, ...rightColStyle }}>
                  <InfoRow label="Team Name" value={contact.team_name} />
                  <InfoRow label="Team Lead" value={(function() {
                    if (!contact.team_lead_contact_id) return null;
                    var lead = loContacts.find(function(c) { return c.id === contact.team_lead_contact_id; });
                    return lead ? ((lead.first_name || "") + " " + (lead.last_name || "")).trim() : contact.team_lead_contact_id;
                  })()} />
                </div>
              </div>
            )}
          </div>}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CARD 8 — Address Information                                       */}
        {/* Left: Mailing Address 1 + Type   Right: Mailing Address 2 + Type  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={sectionStyle} onDoubleClick={cardDoubleClick}>{cardNum(8)}
          <div style={sectionTitleStyle}>Address</div>
          {editMode ? (
            <div style={{ display: "grid", gridTemplateColumns: cols2, gap: gap2 }}>
              {/* Left: Address 1 */}
              <div>
                <div style={addrSubheadStyle}>Address 1</div>
                <AddressAutocomplete font={font} onSelect={function(a) {
                  if (a.street) handleFieldChange("address1_street", a.street);
                  if (a.city)   handleFieldChange("address1_city",   a.city);
                  if (a.state)  handleFieldChange("address1_state",  a.state);
                  if (a.zip)    handleFieldChange("address1_zip",    a.zip);
                }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Street</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_street}
                      onChange={function (e) { handleFieldChange("address1_street", e.target.value); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_city}
                      onChange={function (e) { handleFieldChange("address1_city", e.target.value); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_zip}
                      onChange={function (e) { handleFieldChange("address1_zip", e.target.value); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address1_state}
                      onChange={function (e) { handleFieldChange("address1_state", e.target.value); }}
                      placeholder="" maxLength={2}
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
                  <div>
                    <label style={labelStyle}>Mailing Address</label>
                    <select
                      style={fieldStyle}
                      value={editForm.mailing_address_primary}
                      onChange={function (e) { handleFieldChange("mailing_address_primary", e.target.value); }}
                    >
                      <option value="address1">Address 1</option>
                      <option value="address2">Address 2</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Right: Address 2 */}
              <div style={rightColStyle}>
                <div style={addrSubheadStyle}>Address 2</div>
                <AddressAutocomplete font={font} onSelect={function(a) {
                  if (a.street) handleFieldChange("address2_street", a.street);
                  if (a.city)   handleFieldChange("address2_city",   a.city);
                  if (a.state)  handleFieldChange("address2_state",  a.state);
                  if (a.zip)    handleFieldChange("address2_zip",    a.zip);
                }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Street</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_street}
                      onChange={function (e) { handleFieldChange("address2_street", e.target.value); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_city}
                      onChange={function (e) { handleFieldChange("address2_city", e.target.value); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ZIP</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_zip}
                      onChange={function (e) { handleFieldChange("address2_zip", e.target.value); }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>State</label>
                    <input
                      style={fieldStyle}
                      value={editForm.address2_state}
                      onChange={function (e) { handleFieldChange("address2_state", e.target.value); }}
                      placeholder="" maxLength={2}
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
                  Address 1{contact.address1_type ? ` (${contact.address1_type})` : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <InfoRow label="Street"          value={contact.address1_street || contact.address} />
                  <InfoRow label="City"            value={contact.address1_city   || contact.city} />
                  <InfoRow label="ZIP"             value={contact.address1_zip    || contact.zip} />
                  <InfoRow label="State"           value={contact.address1_state  || contact.state} />
                  <InfoRow label="Address Type"    value={contact.address1_type} />
                  <InfoRow label="Mailing Address" value={contact.mailing_address_primary === "address2" ? "Address 2" : "Address 1"} />
                </div>
              </div>
              <div style={rightColStyle}>
                <div style={addrSubheadStyle}>
                  Address 2{contact.address2_type ? ` (${contact.address2_type})` : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <InfoRow label="Street"       value={contact.address2_street} />
                  <InfoRow label="City"         value={contact.address2_city} />
                  <InfoRow label="ZIP"          value={contact.address2_zip} />
                  <InfoRow label="State"        value={contact.address2_state} />
                  <InfoRow label="Address Type" value={contact.address2_type} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete moved to edit mode bar — see below */}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PQ INFO — internal/admin only                                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {(isInternal || isAdmin) && <div style={{ ...sectionStyle, borderLeft: "4px solid #0C4160" }} onDoubleClick={cardDoubleClick}>
            <div style={{ marginBottom: 16 }}>
              <div style={sectionTitleStyle}>PQ Letter Info (Internal)</div>
            </div>

            {editMode ? (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 12 }}>
                {/* Left column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {editForm.contact_category !== "Realtor" && editForm.contact_category !== "Builder" && (
                    <>
                      <div>
                        <label style={labelStyle}>Personal NMLS #</label>
                        <input style={fieldStyle} value={editForm.lo_nmls} onChange={function(e) { handleFieldChange("lo_nmls", e.target.value); }} placeholder="" />
                      </div>
                      <div>
                        <label style={labelStyle}>Branch NMLS #</label>
                        <input style={fieldStyle} value={editForm.lo_branch_nmls} onChange={function(e) { handleFieldChange("lo_branch_nmls", e.target.value); }} placeholder="" />
                      </div>
                      <div>
                        <label style={labelStyle}>Company NMLS #</label>
                        <input style={fieldStyle} value={editForm.lo_company_nmls} onChange={function(e) { handleFieldChange("lo_company_nmls", e.target.value); }} placeholder="" />
                      </div>
                    </>
                  )}
                  {(editForm.contact_category === "Realtor" || editForm.contact_category === "Builder") && (
                    <div>
                      <label style={labelStyle}>License #</label>
                      <input style={fieldStyle} value={editForm.lo_license} onChange={function(e) { handleFieldChange("lo_license", e.target.value); }} placeholder="" />
                    </div>
                  )}
                </div>
                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, ...rightColStyle }}>
                  <div>
                    <label style={labelStyle}>Display Email (for letters)</label>
                    <input style={fieldStyle} value={editForm.lo_email_display} onChange={function(e) { handleFieldChange("lo_email_display", e.target.value); }} placeholder="" type="email" />
                  </div>
                  <div>
                    <label style={labelStyle}>Website</label>
                    <input style={fieldStyle} value={editForm.lo_website} onChange={function(e) { handleFieldChange("lo_website", e.target.value); }} placeholder="" />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: "12px 16px" }}>
                {/* Left col — mirrors edit left col */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {contact.contact_category !== "Realtor" && contact.contact_category !== "Builder" ? (
                    <>
                      <InfoRow label="Personal NMLS #"  value={contact.lo_nmls ? "#" + contact.lo_nmls : null} />
                      <InfoRow label="Branch NMLS #"    value={contact.lo_branch_nmls ? "#" + contact.lo_branch_nmls : null} />
                      <InfoRow label="Company NMLS #"   value={contact.lo_company_nmls ? "#" + contact.lo_company_nmls : null} />
                    </>
                  ) : (
                    <InfoRow label="License #" value={contact.lo_license} />
                  )}
                </div>
                {/* Right col — mirrors edit right col */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, ...rightColStyle }}>
                  <InfoRow label="Display Email (for letters)" value={contact.lo_email_display} />
                  <InfoRow label="Website"                     value={contact.lo_website} />
                </div>
              </div>
            )}
          </div>}

        {/* ── Photo, Logo & Signature (LO/Admin only) ── */}
        {isBusiness && (isInternal || isAdmin) && (
          <div style={sectionStyle} onDoubleClick={cardDoubleClick}>
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

        {/* ── Team section — client contacts only ── */}
        <div id="cd-team-section" style={{ display: contact.contact_type === "client" ? "block" : "none" }}>
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
        </div>

        {/* ── Back to Top ── */}
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 8px" }}>
          <button
            onClick={function() {
              var sc = document.getElementById("cd-scroll-container");
              if (sc) { sc.scrollTop = 0; return; }
              var el = document.getElementById("cd-content-top");
              if (el) el.scrollIntoView({ behavior: "auto" });
            }}
            style={{
              background: "none", border: "1px solid #cbd5e1", borderRadius: 8,
              padding: "7px 20px", fontSize: 13, fontWeight: 600, color: "#64748b",
              cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ↑ Back to Top
          </button>
        </div>

        {/* ── Mobile notes — inside scroll area so page scrolls normally ── */}
        {isInternal && isMobileCD && (
          <div id="cd-notes-mobile" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", marginTop: 8, paddingBottom: "60vh" }}>
            <ActivityNotesPanel
              contactId={contact.id}
              userName={user && (user.name || user.email) || ""}
              font={font}
              isMobile
            />
            <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 16px" }}>
              <button
                onClick={function() { var sc = document.getElementById("cd-scroll-container"); if (sc) sc.scrollTop = 0; }}
                style={{
                  background: "none", border: "1px solid #cbd5e1", borderRadius: 8,
                  padding: "7px 20px", fontSize: 13, fontWeight: 600, color: "#64748b",
                  cursor: "pointer", fontFamily: "'Inter', system-ui, sans-serif",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                ↑ Back to Top
              </button>
            </div>
          </div>
        )}

      </div>
      </div>{/* end left column */}

      {/* ── Drag handle + Right panel (desktop only) ────────────────────── */}
      {isInternal && !isMobileCD && (
        <React.Fragment>
          {/* Drag handle */}
          <div
            onMouseDown={startDrag}
            style={{
              cursor: "col-resize", background: "transparent",
              borderLeft: "1px solid #e2e8f0",
              transition: "background 0.15s",
            }}
            onMouseEnter={function(e) { e.currentTarget.style.background = "#cbd5e1"; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
            title="Drag to resize"
          />
          <ActivityNotesPanel
            contactId={contact.id}
            userName={user && (user.name || user.email) || ""}
            font={font}
            width={rightPanelWidth}
          />
        </React.Fragment>
      )}
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
            width: 44, height: 44,
            borderRadius: "10px",
            background: "#1e3a5f",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={function(e) { e.currentTarget.style.background = "#2d5a8e"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.22)"; }}
          onMouseLeave={function(e) { e.currentTarget.style.background = "#1e3a5f"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.18)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
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
