// modules/screens/ContactsTab.js
const { useState, useEffect, useMemo } = React;
const supabase                          = window._supabaseClient;
const fetchContactsFromSupabase         = window.fetchContactsFromSupabase;
const saveContactToSupabase             = window.saveContactToSupabase;
const archiveContactInSupabase          = window.archiveContactInSupabase;
const deleteContactFromSupabase         = window.deleteContactFromSupabase;
const ContactDetail                     = window.ContactDetail;

const TYPE_TABS_CT = [
  { key: "all",      label: "All"      },
  { key: "business", label: "Business" },
  { key: "client",   label: "Client"   },
];

const BUSINESS_CATEGORIES_CT = [
  "Employee", "Financial Partner", "Home Builder", "Loan: Third Party",
  "Loan Officer", "Marketing", "Other", "Personal", "Realtor", "Recruit",
  "Work Relationship", "zz-Junk",
];

const CLIENT_CATEGORIES_CT = [
  "Client",
  "Current Client Referral (CCR)",
  "Past Client (PC)",
  "Past Client Referral (PCR)",
  "Client (Import)",
  "zz-Junk",
];

const TYPE_COLORS_CT = {
  business: { bg: "rgba(59,130,246,0.15)",  text: "#2563eb" },
  client:   { bg: "rgba(34,197,94,0.15)",   text: "#16a34a" },
};

function ctFormatPhone(val) {
  if (!val) return "";
  var digits = val.replace(/\D/g, "");
  if (digits.length === 10) return "(" + digits.slice(0,3) + ") " + digits.slice(3,6) + "-" + digits.slice(6);
  if (digits.length === 11 && digits[0] === "1") return "(" + digits.slice(1,4) + ") " + digits.slice(4,7) + "-" + digits.slice(7);
  return val;
}

const EMPTY_FORM_CT = {
  prefix: "", first_name: "", nickname: "", last_name: "",
  contact_type: "client", contact_category: "Client",
  referred_by_contact_id: null,
  phone_cell: "", phone_work: "", phone_home: "", phone_best: "",
  email_personal: "", email_work: "", email_other: "", email_best: "",
  notes: "", note_quick: "",
  fu_date: "", fu_who: "", fu_priority: "",
  address1_street: "", address1_city: "", address1_zip: "", address1_state: "", address1_type: "Home",
  address2_street: "", address2_city: "", address2_zip: "", address2_state: "", address2_type: "Home",
  prefix2: "", first_name2: "", nickname2: "", last_name2: "", connection_to_contact1: "",
  phone2: "", phone2_work: "", phone2_home: "", phone2_best: "",
  email2: "", email2_work: "", email2_other: "", email2_best: "",
};

// ── ReferralPickerCT ─────────────────────────────────────────────────────────
// Defined at module level (outside ContactsTab) so React never remounts it
function ReferralPickerCT(props) {
  var value     = props.value;
  var onChange  = props.onChange;
  var allCtacts = props.contacts || [];
  var excludeId = props.excludeId;

  var _s = useState(""); var search = _s[0]; var setSearch = _s[1];

  var stl = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.07)", color: "#f8fafc",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  };

  var selected = value ? allCtacts.find(function(c) { return c.id === value; }) : null;
  if (selected) {
    var sName = (((selected.first_name || "") + " " + (selected.last_name || "")).trim()) || "Unnamed";
    var sCat  = selected.contact_category || selected.contact_type || "";
    return React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
      React.createElement("span", { style: Object.assign({}, stl, { flex: 1, display: "block", cursor: "default" }) },
        sName + (sCat ? "  ·  " + sCat : "")
      ),
      React.createElement("button", {
        type: "button",
        onClick: function() { onChange(null); },
        style: {
          background: "rgba(239,68,68,0.15)", color: "#fca5a5",
          border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px",
          padding: "6px 10px", cursor: "pointer", fontSize: "12px", flexShrink: 0,
        },
      }, "✕")
    );
  }

  var candidates = allCtacts
    .filter(function(c) { return !excludeId || c.id !== excludeId; })
    .filter(function(c) {
      if (!search.trim()) return false;
      var q = search.trim().toLowerCase();
      return (((c.first_name || "") + " " + (c.last_name || "")).toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q));
    })
    .slice(0, 8);

  return React.createElement("div", { style: { position: "relative" } },
    React.createElement("input", {
      type: "text", placeholder: "Search by name or email…",
      style: stl, value: search,
      onChange: function(e) { setSearch(e.target.value); },
      onBlur:   function()  { setTimeout(function() { setSearch(""); }, 160); },
    }),
    candidates.length > 0 && React.createElement("div", {
      style: {
        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
        background: "#1e3a5f", border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: "8px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      },
    },
      candidates.map(function(c) {
        var nm  = (((c.first_name || "") + " " + (c.last_name || "")).trim()) || "Unnamed";
        var cat = c.contact_category || c.contact_type || "";
        return React.createElement("div", {
          key: c.id,
          onMouseDown: function() { onChange(c.id); setSearch(""); },
          style: { padding: "9px 12px", cursor: "pointer", color: "#f8fafc",
            borderBottom: "1px solid rgba(255,255,255,0.07)" },
          onMouseEnter: function(e) { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; },
          onMouseLeave: function(e) { e.currentTarget.style.background = ""; },
        },
          React.createElement("span", { style: { fontWeight: "600", fontSize: "13px" } }, nm),
          cat && React.createElement("span", { style: { fontSize: "11px", color: "#94a3b8", marginLeft: "8px" } }, cat)
        );
      })
    )
  );
}

// ── CSV Export ───────────────────────────────────────────────────────────────
function exportContactsToCSV(contacts) {
  var headers = [
    "First Name", "Last Name", "Email",
    "Phone (Cell)", "Phone (Work)",
    "City", "State",
    "Type", "Category",
    "FU Next", "FU Who", "FU Priority", "Note: Quick",
    "Created",
  ];

  function esc(val) {
    var s = (val == null ? "" : String(val));
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return "\"" + s.replace(/"/g, "\"\"") + "\"";
    }
    return s;
  }

  var rows = [headers.map(esc).join(",")];
  contacts.forEach(function(c) {
    var created = c.created_at
      ? new Date(c.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
      : "";
    rows.push([
      c.first_name       || "",
      c.last_name        || "",
      c.email            || "",
      ctFormatPhone(c.phone_cell || c.phone || ""),
      ctFormatPhone(c.phone_work || ""),
      c.city             || "",
      c.state            || "",
      c.contact_type     || "",
      c.contact_category || "",
      c.fu_date          || "",
      c.fu_who           || "",
      c.fu_priority      || "",
      c.note_quick       || "",
      created,
    ].map(esc).join(","));
  });

  var csv  = rows.join("\r\n");
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href     = url;
  a.download = "contacts-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ContactsTab({ user, onBack, onLogout, onSelectScenario, initialContactId, onUsers }) {
  const isInternal  = !!(user && user.isInternal);
  const isCloudUser = !!(user && user.supabaseUser && supabase);

  const [contacts,        setContacts]        = useState([]);
  const [cloudLoading,    setCloudLoading]    = useState(false);
  const [cloudError,      setCloudError]      = useState(null);
  const [typeFilter,      setTypeFilter]      = useState("all");
  const [categoryFilter,  setCategoryFilter]  = useState(null);
  const [statusFilter,    setStatusFilter]    = useState("active");
  const [searchTerm,      setSearchTerm]      = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [showAddForm,     setShowAddForm]     = useState(false);
  const [addForm,         setAddForm]         = useState(EMPTY_FORM_CT);
  const [addSaving,       setAddSaving]       = useState(false);
  const [addError,        setAddError]        = useState(null);
  const [scenarioCounts,  setScenarioCounts]  = useState({});
  const [fuWhoFilter,     setFuWhoFilter]     = useState("");
  const [fuPriorityFilter,setFuPriorityFilter]= useState("");
  const [fuDateFilter,    setFuDateFilter]    = useState(""); // "" | "overdue" | "today" | "this_week" | "this_month" | "none"
  const [sortBy,          setSortBy]          = useState("created_at");
  const [sortDir,         setSortDir]         = useState("desc");
  const [deletingId,      setDeletingId]      = useState(null);

  // ── Auto-open contact when navigating from toolkit ───────────────────
  useEffect(function() {
    if (!initialContactId || contacts.length === 0 || selectedContact) return;
    const match = contacts.find(function(c) { return c.id === initialContactId; });
    if (match) setSelectedContact(match);
  }, [initialContactId, contacts]);

  // ── Load contacts on mount ────────────────────────────────────────────
  useEffect(function() {
    if (!isCloudUser) return;
    let cancelled = false;

    // Anti-leakage: wipe any previous user's cached contacts BEFORE fetch
    setContacts([]);
    setCloudError(null);
    setCloudLoading(true);

    fetchContactsFromSupabase().then(function(result) {
      if (cancelled) return;
      setCloudLoading(false);
      if (result.error) {
        setCloudError(result.error.message || "Failed to load contacts.");
        return;
      }
      setContacts(result.data || []);
    }).catch(function(err) {
      if (cancelled) return;
      setCloudLoading(false);
      setCloudError(err.message || "Unexpected error loading contacts.");
    });

    return function() { cancelled = true; };
  }, [isCloudUser]);

  // ── Scenario counts per contact ───────────────────────────────────────
  useEffect(function() {
    if (!isCloudUser || contacts.length === 0) {
      setScenarioCounts({});
      return;
    }
    var contactIds = contacts.map(function(c) { return c.id; });
    var cancelled = false;
    supabase
      .from("scenarios")
      .select("contact_id")
      .in("contact_id", contactIds)
      .then(function(result) {
        if (cancelled || result.error || !result.data) return;
        var counts = {};
        result.data.forEach(function(row) {
          if (!row.contact_id) return;
          counts[row.contact_id] = (counts[row.contact_id] || 0) + 1;
        });
        setScenarioCounts(counts);
      });
    return function() { cancelled = true; };
  }, [contacts]);

  // ── Derived FU Who options (unique values from loaded contacts) ────────
  const fuWhoOptions = useMemo(function() {
    var seen = {};
    var opts = [];
    contacts.forEach(function(c) {
      if (c.fu_who && !seen[c.fu_who]) { seen[c.fu_who] = true; opts.push(c.fu_who); }
    });
    return opts.sort();
  }, [contacts]);

  // ── Sort handler ──────────────────────────────────────────────────────
  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(function(prev) { return prev === "asc" ? "desc" : "asc"; });
    } else {
      setSortBy(col);
      setSortDir(col === "created_at" || col === "fu_date" ? "desc" : "asc");
    }
  }

  // ── Delete handler (admin only) ───────────────────────────────────────
  async function handleDeleteContact(contact) {
    if (!window.confirm("Permanently delete " + ((contact.first_name || "") + " " + (contact.last_name || "")).trim() + "? This cannot be undone.")) return;
    setDeletingId(contact.id);
    try {
      const { error } = await deleteContactFromSupabase(contact.id);
      if (error) { alert("Could not delete contact: " + error.message); return; }
      setContacts(function(prev) { return prev.filter(function(c) { return c.id !== contact.id; }); });
    } catch (err) {
      alert("Could not delete contact: " + err.message);
    } finally { setDeletingId(null); }
  }

  // ── Filtered contacts (type + status + search + FU filters) ───────────
  const filteredContacts = useMemo(function() {
    let list = contacts;

    if (typeFilter !== "all") {
      list = list.filter(function(c) { return c.contact_type === typeFilter; });
    }
    if (categoryFilter) {
      list = list.filter(function(c) { return c.contact_category === categoryFilter; });
    }
    list = list.filter(function(c) { return c.status === statusFilter; });
    if (fuWhoFilter) {
      if (fuWhoFilter === "_none") {
        list = list.filter(function(c) { return !(c.fu_who || ""); });
      } else {
        list = list.filter(function(c) { return (c.fu_who || "") === fuWhoFilter; });
      }
    }
    if (fuPriorityFilter) {
      if (fuPriorityFilter === "_none") {
        list = list.filter(function(c) { return !(c.fu_priority || ""); });
      } else {
        list = list.filter(function(c) { return (c.fu_priority || "") === fuPriorityFilter; });
      }
    }
    if (fuDateFilter) {
      const _now = new Date();
      const todayStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
      const todayEnd   = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + 1);
      const weekEnd    = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() + 7);
      const monthEnd   = new Date(_now.getFullYear(), _now.getMonth() + 1, 1);
      list = list.filter(function(c) {
        const fud = c.fu_date || "";
        if (fuDateFilter === "none") return !fud;
        if (!fud) return false;
        const d = new Date(fud + "T00:00:00");
        if (fuDateFilter === "overdue")    return d < todayStart;
        if (fuDateFilter === "today")      return d >= todayStart && d < todayEnd;
        if (fuDateFilter === "this_week")  return d >= todayStart && d < weekEnd;
        if (fuDateFilter === "this_month") return d >= todayStart && d < monthEnd;
        return true;
      });
    }

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(function(c) {
        return (
          (c.first_name || "").toLowerCase().includes(q) ||
          (c.last_name  || "").toLowerCase().includes(q) ||
          (c.email      || "").toLowerCase().includes(q) ||
          (c.email_personal || "").toLowerCase().includes(q) ||
          (c.email_work     || "").toLowerCase().includes(q) ||
          (c.phone      || "").toLowerCase().includes(q) ||
          (c.phone_cell || "").toLowerCase().includes(q) ||
          (c.city       || "").toLowerCase().includes(q)
        );
      });
    }

    // ── Sort ──────────────────────────────────────────────────────────────
    list = list.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort(function(a, b) {
      if (sortBy === "name") {
        const la = ((a.last_name || "") + (a.first_name || "")).toLowerCase();
        const lb = ((b.last_name || "") + (b.first_name || "")).toLowerCase();
        return dir * la.localeCompare(lb);
      }
      if (sortBy === "category") {
        const ca = (a.contact_category || a.contact_type || "").toLowerCase();
        const cb = (b.contact_category || b.contact_type || "").toLowerCase();
        return dir * ca.localeCompare(cb);
      }
      if (sortBy === "phone") {
        const pa = ctFormatPhone(a.phone_cell || a.phone || "");
        const pb = ctFormatPhone(b.phone_cell || b.phone || "");
        return dir * pa.localeCompare(pb);
      }
      if (sortBy === "email") {
        const ea = a.email_personal || a.email_work || a.email || "";
        const eb = b.email_personal || b.email_work || b.email || "";
        return dir * ea.localeCompare(eb);
      }
      if (sortBy === "fu_date") {
        const da = a.fu_date ? new Date(a.fu_date + "T00:00:00").getTime() : (dir === 1 ? Infinity : -Infinity);
        const db = b.fu_date ? new Date(b.fu_date + "T00:00:00").getTime() : (dir === 1 ? Infinity : -Infinity);
        return dir * (da - db);
      }
      if (sortBy === "fu_who") {
        return dir * (a.fu_who || "").localeCompare(b.fu_who || "");
      }
      if (sortBy === "fu_priority") {
        const rank = function(c) { return c.fu_priority === "High" ? 0 : c.fu_priority === "Medium" ? 1 : c.fu_priority === "Low" ? 2 : 3; };
        return dir * (rank(a) - rank(b));
      }
      // default: created_at
      return dir * (new Date(a.created_at) - new Date(b.created_at));
    });

    return list;
  }, [contacts, typeFilter, categoryFilter, statusFilter, searchTerm, fuWhoFilter, fuPriorityFilter, fuDateFilter, sortBy, sortDir]);

  // ── Callbacks from ContactDetail ──────────────────────────────────────
  function handleContactSaved(updatedContact) {
    setContacts(function(prev) {
      const idx = prev.findIndex(function(c) { return c.id === updatedContact.id; });
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = updatedContact;
      return next;
    });
    setSelectedContact(updatedContact);
  }

  function handleContactArchived(contactId) {
    setContacts(function(prev) { return prev.filter(function(c) { return c.id !== contactId; }); });
    setSelectedContact(null);
  }

  // ── Add new contact ───────────────────────────────────────────────────
  function handleAddSubmit(e) {
    e.preventDefault();
    if (!addForm.last_name.trim()) { setAddError("Last name is required."); return; }
    setAddSaving(true);
    setAddError(null);

    saveContactToSupabase(addForm).then(function(result) {
      setAddSaving(false);
      if (result.error) { setAddError(result.error.message || "Failed to save contact."); return; }
      setContacts(function(prev) { return [result.data, ...prev]; });
      setAddForm(EMPTY_FORM_CT);
      setShowAddForm(false);
    }).catch(function(err) {
      setAddSaving(false);
      setAddError(err.message || "Unexpected error saving contact.");
    });
  }

  // ── If a contact is selected → render ContactDetail full-screen ───────
  if (selectedContact) {
    return React.createElement(ContactDetail, {
      contact:           selectedContact,
      user:              user,
      onBack:            function() { setSelectedContact(null); },
      onSave:            handleContactSaved,
      onArchive:         handleContactArchived,
      onDelete:          handleContactArchived,  // hard-delete: same effect — remove from list + go back
      onLogout:          onLogout,
      onSelectScenario:  onSelectScenario,
      contacts:          contacts,
      onSelectContact:   function(c) { setSelectedContact(c); },
    });
  }

  // ── Style constants ───────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#f8fafc",
    },
    header: {
      background: "rgba(255,255,255,0.08)",
      backdropFilter: "blur(10px)",
      borderBottom: "1px solid rgba(255,255,255,0.12)",
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
    backBtn: {
      background: "rgba(255,255,255,0.12)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: "8px",
      padding: "8px 14px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "500",
    },
    title: { fontSize: "20px", fontWeight: "700", color: "#fff", margin: 0 },
    logoutBtn: {
      background: "rgba(255,255,255,0.1)",
      color: "#cbd5e1",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "8px",
      padding: "7px 14px",
      cursor: "pointer",
      fontSize: "13px",
    },
    body: { padding: "24px", maxWidth: "1400px", margin: "0 auto" },
    toolbar: {
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      marginBottom: "20px",
      alignItems: "center",
    },
    searchInput: {
      flex: "1",
      minWidth: "200px",
      padding: "9px 14px",
      borderRadius: "8px",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.07)",
      color: "#f8fafc",
      fontSize: "14px",
      outline: "none",
    },
    addBtn: {
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      padding: "9px 18px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      whiteSpace: "nowrap",
    },
  };

  // ── Sub-components ────────────────────────────────────────────────────

  function TypeTab(props) {
    var tab    = props.tab;
    var active = typeFilter === tab.key;
    return React.createElement("button", {
      onClick: function() { setTypeFilter(tab.key); setCategoryFilter(null); },
      style: {
        padding: "6px 14px",
        borderRadius: "20px",
        border: active ? "none" : "1px solid rgba(255,255,255,0.2)",
        background: active ? "#2563eb" : "rgba(255,255,255,0.07)",
        color: active ? "#fff" : "#94a3b8",
        fontSize: "13px",
        fontWeight: active ? "600" : "400",
        cursor: "pointer",
        transition: "all 0.15s",
      },
    }, tab.label);
  }

  function CategoryPill(props) {
    var cat    = props.cat;
    var active = categoryFilter === cat;
    return React.createElement("button", {
      onClick: function() { setCategoryFilter(cat); },
      style: {
        padding: "4px 12px", borderRadius: "14px",
        border: active ? "none" : "1px solid rgba(255,255,255,0.15)",
        background: active ? "#2563eb" : "rgba(255,255,255,0.05)",
        color: active ? "#fff" : "#94a3b8",
        fontSize: "12px", fontWeight: active ? "600" : "400",
        cursor: "pointer",
      },
    }, cat || "All Categories");
  }

  function StatusTab(props) {
    var active = statusFilter === props.val;
    return React.createElement("button", {
      onClick: function() { setStatusFilter(props.val); },
      style: {
        padding: "5px 12px",
        borderRadius: "6px",
        border: "none",
        background: active ? "rgba(255,255,255,0.15)" : "transparent",
        color: active ? "#fff" : "#64748b",
        fontSize: "12px",
        fontWeight: active ? "600" : "400",
        cursor: "pointer",
      },
    }, props.label);
  }

  var thStyle = {
    padding: "8px 12px", textAlign: "left", fontSize: "11px",
    fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: "0.05em",
    whiteSpace: "nowrap", userSelect: "none",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  };
  var tdStyle = { padding: "10px 12px", verticalAlign: "middle", fontSize: "13px" };

  // ── Add Contact inline form ───────────────────────────────────────────

  var inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.07)", color: "#f8fafc",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  };
  var labelStyle  = { fontSize: "12px", color: "#94a3b8", marginBottom: "4px", display: "block" };
  var rowStyle    = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" };
  var optionStyle = { background: "#1e3a5f", color: "#f8fafc" };

  function setAddField(field, value) {
    setAddForm(function(p) {
      var next = Object.assign({}, p);
      next[field] = value;
      return next;
    });
  }

  // ── Main render ───────────────────────────────────────────────────────
  return React.createElement("div", { style: S.page },

    // ── Header ─────────────────────────────────────────────────────────
    React.createElement("div", { style: S.header },
      React.createElement("div", { style: S.headerLeft },
        React.createElement("div", null,
          React.createElement("h1", { style: Object.assign({}, S.title, { marginBottom: 0 }) }, "Contacts"),
          user && React.createElement("div", {
            style: { fontSize: "12px", color: "#94a3b8", marginTop: "2px" }
          }, user.name || user.email || "")
        )
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
        onUsers && React.createElement("button", { onClick: onUsers, style: S.backBtn }, "👥 Team"),
        React.createElement("button", { onClick: onBack, style: S.backBtn }, "Scenarios"),
        React.createElement("button", { onClick: onLogout, style: S.logoutBtn }, "Logout")
      )
    ),

    // ── Body ────────────────────────────────────────────────────────────
    React.createElement("div", { style: S.body },

      // Type tabs
      React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" } },
        TYPE_TABS_CT.map(function(tab) {
          return React.createElement(TypeTab, { key: tab.key, tab: tab });
        })
      ),

      // Category sub-pills (only when a specific type is selected)
      typeFilter !== "all" && React.createElement("div", {
        style: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" },
      },
        [null].concat(typeFilter === "business" ? BUSINESS_CATEGORIES_CT : CLIENT_CATEGORIES_CT)
          .map(function(cat) {
            return React.createElement(CategoryPill, { key: cat || "__all__", cat: cat });
          })
      ),

      // Toolbar: search + filters + status toggle + add button
      React.createElement("div", { style: S.toolbar },
        React.createElement("input", {
          type: "text",
          placeholder: "Search contacts…",
          style: S.searchInput,
          value: searchTerm,
          onChange: function(e) { setSearchTerm(e.target.value); },
        }),

        // Clear filters pill (only when a filter is active)
        (fuWhoFilter || fuPriorityFilter || fuDateFilter) && React.createElement("button", {
          onClick: function() { setFuWhoFilter(""); setFuPriorityFilter(""); setFuDateFilter(""); },
          style: {
            padding: "7px 12px", borderRadius: "8px", cursor: "pointer",
            background: "rgba(239,68,68,0.15)", color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.3)", fontSize: "12px", fontWeight: "600",
            whiteSpace: "nowrap",
          },
        }, "✕ Clear"),

        // Export CSV button
        filteredContacts.length > 0 && React.createElement("button", {
          onClick: function() { exportContactsToCSV(filteredContacts); },
          title: "Export " + filteredContacts.length + " contact" + (filteredContacts.length === 1 ? "" : "s") + " to CSV",
          style: {
            padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
            background: "rgba(255,255,255,0.07)", color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.18)",
            fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap",
          },
        }, "↓ CSV (" + filteredContacts.length + ")"),

        React.createElement("div", {
          style: { display: "flex", gap: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "3px" }
        },
          React.createElement(StatusTab, { val: "active",    label: "Active"    }),
          React.createElement(StatusTab, { val: "archived",  label: "Archived"  }),
          React.createElement(StatusTab, { val: "converted", label: "Converted" })
        ),
        isInternal && React.createElement("button", {
          onClick: function() { setShowAddForm(function(v) { return !v; }); setAddError(null); },
          style: S.addBtn,
        }, showAddForm ? "✕ Cancel" : "+ Add Contact")
      ),

      // ── Add Contact form ──────────────────────────────────────────────
      showAddForm && isInternal && React.createElement("div", {
        style: {
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "20px",
        }
      },
        React.createElement("h3", {
          style: { margin: "0 0 16px", fontSize: "15px", fontWeight: "600", color: "#f8fafc" }
        }, "New Contact"),
        React.createElement("form", { onSubmit: handleAddSubmit },
          // Row 1: First + Last name
          React.createElement("div", { style: rowStyle },
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "First Name"),
              React.createElement("input", {
                style: inputStyle, value: addForm.first_name,
                onChange: function(e) { setAddField("first_name", e.target.value); }
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "Last Name *"),
              React.createElement("input", {
                style: inputStyle, value: addForm.last_name, required: true,
                onChange: function(e) { setAddField("last_name", e.target.value); }
              })
            )
          ),
          // Row 2: Email + Phone
          React.createElement("div", { style: rowStyle },
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "Email"),
              React.createElement("input", {
                type: "email", style: inputStyle, value: addForm.email,
                onChange: function(e) { setAddField("email", e.target.value); }
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "Phone"),
              React.createElement("input", {
                style: inputStyle, value: addForm.phone,
                onChange: function(e) { setAddField("phone", e.target.value); }
              })
            )
          ),
          // Row 3: City + State
          React.createElement("div", { style: rowStyle },
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "City"),
              React.createElement("input", {
                style: inputStyle, value: addForm.city,
                onChange: function(e) { setAddField("city", e.target.value); }
              })
            ),
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "State"),
              React.createElement("input", {
                style: inputStyle, value: addForm.state,
                placeholder: "TX", maxLength: 2,
                onChange: function(e) { setAddField("state", e.target.value.toUpperCase()); }
              })
            )
          ),
          // Contact type + category
          React.createElement("div", { style: rowStyle },
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "Type"),
              React.createElement("select", {
                style: Object.assign({}, inputStyle, { cursor: "pointer" }),
                value: addForm.contact_type,
                onChange: function(e) {
                  var newType    = e.target.value;
                  var defaultCat = newType === "business" ? "Other" : "Client";
                  setAddForm(function(p) {
                    return Object.assign({}, p, { contact_type: newType, contact_category: defaultCat });
                  });
                }
              },
                React.createElement("option", { value: "client",   style: optionStyle }, "Client"),
                React.createElement("option", { value: "business", style: optionStyle }, "Business")
              )
            ),
            React.createElement("div", null,
              React.createElement("label", { style: labelStyle }, "Category"),
              React.createElement("select", {
                style: Object.assign({}, inputStyle, { cursor: "pointer" }),
                value: addForm.contact_category,
                onChange: function(e) { setAddField("contact_category", e.target.value); }
              },
                (addForm.contact_type === "business" ? BUSINESS_CATEGORIES_CT : CLIENT_CATEGORIES_CT)
                  .map(function(cat) {
                    return React.createElement("option", { key: cat, value: cat, style: optionStyle }, cat);
                  })
              )
            )
          ),
          // Referred By
          React.createElement("div", { style: { marginBottom: "12px" } },
            React.createElement("label", { style: labelStyle }, "Referred By"),
            React.createElement(ReferralPickerCT, {
              value:     addForm.referred_by_contact_id,
              onChange:  function(id) { setAddField("referred_by_contact_id", id); },
              contacts:  contacts,
              excludeId: null,
            })
          ),
          // Error + buttons
          addError && React.createElement("p", {
            style: { color: "#f87171", fontSize: "13px", margin: "0 0 10px" }
          }, addError),
          React.createElement("div", { style: { display: "flex", gap: "10px" } },
            React.createElement("button", {
              type: "submit",
              disabled: addSaving,
              style: {
                background: "#2563eb", color: "#fff", border: "none",
                borderRadius: "8px", padding: "8px 18px",
                cursor: addSaving ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: "600",
                opacity: addSaving ? 0.65 : 1,
              }
            }, addSaving ? "Saving…" : "Save Contact"),
            React.createElement("button", {
              type: "button",
              onClick: function() { setShowAddForm(false); setAddForm(EMPTY_FORM_CT); setAddError(null); },
              style: {
                background: "rgba(255,255,255,0.08)", color: "#94a3b8",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px", padding: "8px 16px",
                cursor: "pointer", fontSize: "14px",
              }
            }, "Cancel")
          )
        )
      ),

      // ── Loading state ─────────────────────────────────────────────────
      cloudLoading && React.createElement("div", {
        style: { textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: "15px" }
      }, "Loading contacts…"),

      // ── Error state ───────────────────────────────────────────────────
      !cloudLoading && cloudError && React.createElement("div", {
        style: {
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "10px", padding: "16px", color: "#fca5a5", fontSize: "14px",
        }
      }, "Error loading contacts: " + cloudError),

      // ── Not a cloud user ──────────────────────────────────────────────
      !isCloudUser && !cloudLoading && React.createElement("div", {
        style: { textAlign: "center", padding: "60px 0", color: "#64748b", fontSize: "15px" }
      }, "Sign in to view your contacts."),

      // ── Empty state ───────────────────────────────────────────────────
      !cloudLoading && !cloudError && isCloudUser && filteredContacts.length === 0 &&
        React.createElement("div", {
          style: { textAlign: "center", padding: "60px 0", color: "#475569", fontSize: "15px" }
        }, contacts.length === 0
          ? "No contacts yet. Add your first contact above."
          : "No contacts match your current filters."
        ),

      // ── Contact table ─────────────────────────────────────────────────
      !cloudLoading && !cloudError && filteredContacts.length > 0 &&
        React.createElement("div", {
          style: {
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            overflowX: "auto",
          }
        },
          React.createElement("table", {
            style: {
              width: "100%", borderCollapse: "collapse", tableLayout: "fixed",
              minWidth: "1100px", fontSize: "13px",
            }
          },
            React.createElement("thead", null,
              React.createElement("tr", { style: { background: "rgba(255,255,255,0.06)" } },
                (function() {
                  // Sort arrow helper
                  function arrow(col) {
                    if (sortBy !== col) return React.createElement("span", { style: { opacity: 0.3, marginLeft: 3 } }, "⇅");
                    return React.createElement("span", { style: { marginLeft: 3, color: "#60a5fa" } }, sortDir === "asc" ? "↑" : "↓");
                  }
                  var clkTh = Object.assign({}, thStyle, { cursor: "pointer", verticalAlign: "top" });
                  var fltSel = {
                    marginTop: "4px", display: "block", width: "100%",
                    fontSize: "10px", padding: "2px 4px",
                    borderRadius: "4px", border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.07)", color: "#94a3b8",
                    cursor: "pointer", outline: "none",
                  };
                  return [
                    // Category — sortable
                    React.createElement("th", { key: "cat", style: Object.assign({}, clkTh, { width: "150px" }),
                      onClick: function() { handleSort("category"); } },
                      React.createElement("span", null, "Category"), arrow("category")
                    ),
                    // Contact — sortable by name
                    React.createElement("th", { key: "name", style: clkTh,
                      onClick: function() { handleSort("name"); } },
                      React.createElement("span", null, "Contact"), arrow("name")
                    ),
                    // Phone — sortable
                    React.createElement("th", { key: "phone", style: Object.assign({}, clkTh, { width: "130px" }),
                      onClick: function() { handleSort("phone"); } },
                      React.createElement("span", null, "Phone"), arrow("phone")
                    ),
                    // Email — sortable
                    React.createElement("th", { key: "email", style: clkTh,
                      onClick: function() { handleSort("email"); } },
                      React.createElement("span", null, "Email"), arrow("email")
                    ),
                    // FU Next — sortable + date-window filter
                    React.createElement("th", { key: "fudate", style: Object.assign({}, clkTh, { width: "115px" }) },
                      React.createElement("div", { onClick: function() { handleSort("fu_date"); }, style: { display: "inline-block" } },
                        React.createElement("span", null, "FU Next"), arrow("fu_date")
                      ),
                      React.createElement("select", {
                        value: fuDateFilter,
                        onChange: function(e) { e.stopPropagation(); setFuDateFilter(e.target.value); },
                        onClick:  function(e) { e.stopPropagation(); },
                        style: fltSel,
                      },
                        React.createElement("option", { value: "",           style: { background: "#1e3a5f" } }, "All"),
                        React.createElement("option", { value: "overdue",    style: { background: "#1e3a5f" } }, "Overdue"),
                        React.createElement("option", { value: "today",      style: { background: "#1e3a5f" } }, "Today"),
                        React.createElement("option", { value: "this_week",  style: { background: "#1e3a5f" } }, "This Week"),
                        React.createElement("option", { value: "this_month", style: { background: "#1e3a5f" } }, "This Month"),
                        React.createElement("option", { value: "none",       style: { background: "#1e3a5f" } }, "— none")
                      )
                    ),
                    // FU Who — sortable + distinct-value filter
                    React.createElement("th", { key: "fuwho", style: Object.assign({}, clkTh, { width: "100px" }) },
                      React.createElement("div", { onClick: function() { handleSort("fu_who"); }, style: { display: "inline-block" } },
                        React.createElement("span", null, "FU Who"), arrow("fu_who")
                      ),
                      React.createElement("select", {
                        value: fuWhoFilter,
                        onChange: function(e) { e.stopPropagation(); setFuWhoFilter(e.target.value); },
                        onClick:  function(e) { e.stopPropagation(); },
                        style: fltSel,
                      },
                        React.createElement("option", { value: "", style: { background: "#1e3a5f" } }, "All"),
                        fuWhoOptions.map(function(who) {
                          return React.createElement("option", { key: who, value: who, style: { background: "#1e3a5f" } }, who);
                        }),
                        React.createElement("option", { value: "_none", style: { background: "#1e3a5f" } }, "— none")
                      )
                    ),
                    // FU Priority — sortable + filter
                    React.createElement("th", { key: "fupri", style: Object.assign({}, clkTh, { width: "110px" }) },
                      React.createElement("div", { onClick: function() { handleSort("fu_priority"); }, style: { display: "inline-block" } },
                        React.createElement("span", null, "FU Priority"), arrow("fu_priority")
                      ),
                      React.createElement("select", {
                        value: fuPriorityFilter,
                        onChange: function(e) { e.stopPropagation(); setFuPriorityFilter(e.target.value); },
                        onClick:  function(e) { e.stopPropagation(); },
                        style: fltSel,
                      },
                        React.createElement("option", { value: "",      style: { background: "#1e3a5f" } }, "All"),
                        React.createElement("option", { value: "High",  style: { background: "#1e3a5f" } }, "🔴 High"),
                        React.createElement("option", { value: "Medium",style: { background: "#1e3a5f" } }, "🟡 Medium"),
                        React.createElement("option", { value: "Low",   style: { background: "#1e3a5f" } }, "⚪ Low"),
                        React.createElement("option", { value: "_none", style: { background: "#1e3a5f" } }, "— none")
                      )
                    ),
                    // Note: Quick — not sortable
                    React.createElement("th", { key: "note", style: thStyle }, "Note: Quick"),
                    // Created — sortable
                    React.createElement("th", { key: "created", style: Object.assign({}, clkTh, { width: "95px" }),
                      onClick: function() { handleSort("created_at"); } },
                      React.createElement("span", null, "Created"), arrow("created_at")
                    ),
                    // Actions column (delete)
                    React.createElement("th", { key: "actions", style: Object.assign({}, thStyle, { width: "50px" }) })
                  ];
                })()
              )
            ),
            React.createElement("tbody", null,
              filteredContacts.map(function(contact) {
                var fullName  = ((contact.first_name || "") + " " + (contact.last_name || "")).trim() || "Unnamed";
                var category  = contact.contact_category || contact.contact_type || "client";
                var tc        = TYPE_COLORS_CT[contact.contact_type] || TYPE_COLORS_CT.business;
                var phone     = ctFormatPhone(contact.phone_cell || contact.phone_work || contact.phone || "");
                var email     = contact.email_personal || contact.email_work || contact.email || "";
                var subLine   = phone || email || "";
                var scCount   = scenarioCounts[contact.id] || 0;

                // FU fields (available once supabase-contact-notes-fields-migration is deployed)
                var fuDate    = contact.fu_date
                  ? new Date(contact.fu_date + "T00:00:00").toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
                  : null;
                var fuWho     = contact.fu_who     || null;
                var fuPri     = contact.fu_priority || null;
                var noteQuick = contact.note_quick  || null;
                var created   = contact.created_at
                  ? new Date(contact.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
                  : "—";

                // Priority badge colors
                var priBg    = fuPri === "High" ? "rgba(239,68,68,0.2)"    : "rgba(100,116,139,0.2)";
                var priColor = fuPri === "High" ? "#f87171"                 : "#94a3b8";

                return React.createElement("tr", {
                  key: contact.id,
                  onClick: function() { setSelectedContact(contact); },
                  style: { borderBottom: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" },
                  onMouseEnter: function(e) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; },
                  onMouseLeave: function(e) { e.currentTarget.style.background = ""; },
                },

                  // Category badge
                  React.createElement("td", { style: tdStyle },
                    React.createElement("span", {
                      style: {
                        display: "inline-block",
                        background: tc.bg, color: tc.text,
                        borderRadius: "5px", padding: "2px 8px",
                        fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap",
                      }
                    }, category)
                  ),

                  // Contact Name + scenario badge
                  React.createElement("td", { style: tdStyle },
                    React.createElement("div", { style: { fontWeight: "600", color: "#f8fafc" } }, fullName),
                    scCount > 0 && React.createElement("span", {
                      style: {
                        display: "inline-block", marginTop: "3px",
                        background: "rgba(37,99,235,0.18)", color: "#60a5fa",
                        borderRadius: "10px", padding: "1px 7px",
                        fontSize: "10px", fontWeight: "600",
                      }
                    }, scCount + (scCount === 1 ? " scenario" : " scenarios"))
                  ),

                  // Phone
                  React.createElement("td", {
                    style: Object.assign({}, tdStyle, { color: "#94a3b8", whiteSpace: "nowrap" }),
                  },
                    phone || React.createElement("span", { style: { color: "#334155" } }, "—")
                  ),

                  // Email
                  React.createElement("td", {
                    style: Object.assign({}, tdStyle, { color: "#94a3b8", overflow: "hidden" }),
                  },
                    email
                      ? React.createElement("span", {
                          title: email,
                          style: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                        }, email)
                      : React.createElement("span", { style: { color: "#334155" } }, "—")
                  ),

                  // FU Next
                  React.createElement("td", { style: tdStyle },
                    fuDate
                      ? React.createElement("span", { style: { color: "#fbbf24", fontWeight: "600" } }, fuDate)
                      : React.createElement("span", { style: { color: "#334155" } }, "—")
                  ),

                  // FU Who
                  React.createElement("td", { style: tdStyle },
                    fuWho
                      ? React.createElement("span", { style: { fontWeight: "700", color: "#f8fafc" } }, fuWho)
                      : React.createElement("span", { style: { color: "#334155" } }, "—")
                  ),

                  // FU Priority
                  React.createElement("td", { style: tdStyle },
                    fuPri
                      ? React.createElement("span", {
                          style: {
                            display: "inline-block",
                            background: priBg, color: priColor,
                            borderRadius: "5px", padding: "2px 8px",
                            fontSize: "11px", fontWeight: "700",
                          }
                        }, fuPri)
                      : React.createElement("span", { style: { color: "#334155" } }, "—")
                  ),

                  // Note: Quick
                  React.createElement("td", {
                    style: Object.assign({}, tdStyle, { color: "#94a3b8", overflow: "hidden" }),
                  },
                    noteQuick
                      ? React.createElement("span", {
                          title: noteQuick,
                          style: { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                        }, noteQuick.length > 55 ? noteQuick.substring(0, 55) + "…" : noteQuick)
                      : React.createElement("span", { style: { color: "#334155" } }, "—")
                  ),

                  // Created
                  React.createElement("td", {
                    style: Object.assign({}, tdStyle, { color: "#475569", whiteSpace: "nowrap" }),
                  }, created),

                  // Delete button (admin only)
                  React.createElement("td", {
                    style: Object.assign({}, tdStyle, { textAlign: "center" }),
                    onClick: function(e) { e.stopPropagation(); },
                  },
                    user && user.role === "admin" && React.createElement("button", {
                      onClick: function(e) { e.stopPropagation(); handleDeleteContact(contact); },
                      disabled: deletingId === contact.id,
                      title: "Permanently delete this contact",
                      style: {
                        background: "rgba(239,68,68,0.15)",
                        color: "#f87171",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: "5px",
                        padding: "3px 7px",
                        cursor: deletingId === contact.id ? "wait" : "pointer",
                        fontSize: "12px",
                        lineHeight: 1,
                      },
                    }, deletingId === contact.id ? "…" : "🗑")
                  )
                );
              })
            )
          )
        )
    )
  );
}

window.ContactsTab = window.ContactsTab || ContactsTab;
