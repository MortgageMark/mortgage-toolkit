// modules/screens/ContactsTab.js
const { useState, useEffect, useMemo } = React;
const supabase                          = window._supabaseClient;
const fetchContactsFromSupabase         = window.fetchContactsFromSupabase;
const saveContactToSupabase             = window.saveContactToSupabase;
const patchContactInSupabase            = window.patchContactInSupabase;
const archiveContactInSupabase          = window.archiveContactInSupabase;
const deleteContactFromSupabase         = window.deleteContactFromSupabase;
const bulkUpdateContactsInSupabase      = window.bulkUpdateContactsInSupabase;
const bulkDeleteContactsInSupabase      = window.bulkDeleteContactsInSupabase;
const mergeContactsInSupabase           = window.mergeContactsInSupabase;
const ContactDetail                     = window.ContactDetail;
const AppHeader                         = window.AppHeader;
const useLocalStorage                   = window.useLocalStorage;

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
  business: { bg: "rgba(59,130,246,0.13)",  text: "#2563eb" },
  client:   { bg: "rgba(34,197,94,0.13)",   text: "#16a34a" },
};
// Per-category overrides — more specific than contact_type
const CATEGORY_COLORS_CT = {
  "Realtor":       { bg: "rgba(234,88,12,0.12)",   text: "#ea580c" },
  "Home Builder":  { bg: "rgba(124,58,237,0.12)",  text: "#7c3aed" },
  "Loan Officer":  { bg: "rgba(59,130,246,0.13)",  text: "#2563eb" },
  "Client":        { bg: "rgba(34,197,94,0.13)",   text: "#16a34a" },
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
  company: "",
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
  var onAddNew  = props.onAddNew; // optional: function(nameStr) => Promise

  var _s = useState(""); var search = _s[0]; var setSearch = _s[1];
  var _f = useState(false); var focused = _f[0]; var setFocused = _f[1];
  var _a = useState(false); var adding = _a[0]; var setAdding = _a[1];

  var stl = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1.5px solid #e2e8f0",
    background: "#fff", color: "#1e293b",
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
          background: "#fee2e2", color: "#dc2626",
          border: "1px solid #fecaca", borderRadius: "6px",
          padding: "6px 10px", cursor: "pointer", fontSize: "12px", flexShrink: 0,
        },
      }, "✕")
    );
  }

  var filtered = allCtacts.filter(function(c) { return !excludeId || c.id !== excludeId; });
  var candidates = (search.trim()
    ? filtered.filter(function(c) {
        var q = search.trim().toLowerCase();
        return (((c.first_name || "") + " " + (c.last_name || "")).toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q));
      })
    : filtered
  ).slice(0, 8);

  var showDropdown = focused && (candidates.length > 0 || (onAddNew && search.trim()));

  function handleAddNew() {
    if (!onAddNew || !search.trim() || adding) return;
    setAdding(true);
    Promise.resolve(onAddNew(search.trim())).then(function() {
      setAdding(false);
      setSearch("");
      setFocused(false);
    }).catch(function() { setAdding(false); });
  }

  return React.createElement("div", { style: { position: "relative" } },
    React.createElement("input", {
      type: "text",
      placeholder: adding ? "Creating contact…" : "Click to browse or type to search…",
      style: Object.assign({}, stl, adding ? { color: "#94a3b8" } : {}),
      value: adding ? "" : search,
      disabled: adding,
      onChange: function(e) { setSearch(e.target.value); },
      onFocus:  function()  { setFocused(true); },
      onBlur:   function()  { setTimeout(function() { setFocused(false); setSearch(""); }, 200); },
    }),
    showDropdown && React.createElement("div", {
      style: {
        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
        background: "#fff", border: "1px solid #e2e8f0",
        borderRadius: "8px", overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      },
    },
      candidates.map(function(c) {
        var nm  = (((c.first_name || "") + " " + (c.last_name || "")).trim()) || "Unnamed";
        var cat = c.contact_category || c.contact_type || "";
        return React.createElement("div", {
          key: c.id,
          onMouseDown: function() { onChange(c.id); setSearch(""); },
          style: { padding: "9px 12px", cursor: "pointer", color: "#1e293b",
            borderBottom: "1px solid #f1f5f9" },
          onMouseEnter: function(e) { e.currentTarget.style.background = "#f8fafc"; },
          onMouseLeave: function(e) { e.currentTarget.style.background = ""; },
        },
          React.createElement("span", { style: { fontWeight: "600", fontSize: "13px" } }, nm),
          cat && React.createElement("span", { style: { fontSize: "11px", color: "#64748b", marginLeft: "8px" } }, cat)
        );
      }),
      // "+ Add new contact" row — shown when there's a search term
      onAddNew && search.trim() && React.createElement("div", {
        onMouseDown: handleAddNew,
        style: {
          padding: "9px 12px", cursor: "pointer",
          color: "#2563eb", fontWeight: 600, fontSize: "13px",
          borderTop: candidates.length > 0 ? "1px solid #e2e8f0" : "none",
          display: "flex", alignItems: "center", gap: "6px",
          background: "#f8faff",
        },
        onMouseEnter: function(e) { e.currentTarget.style.background = "#eff6ff"; },
        onMouseLeave: function(e) { e.currentTarget.style.background = "#f8faff"; },
      },
        React.createElement("span", { style: { fontSize: "15px" } }, "+"),
        "Add \"" + search.trim() + "\" as a new contact"
      )
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

function ContactsTab({ user, onBack, onLogout, onSelectScenario, initialContactId, onUsers, onTasksScenarios, onTasksContacts, activeView, onSetView, onContactSelected, pageTitle,
  typeFilter: typeFilterProp, setTypeFilter: setTypeFilterProp }) {
  const isInternal  = !!(user && user.isInternal);
  const isPartner   = !!(user && (user.role === "realtor" || user.role === "builder"));
  const isCloudUser = !!(user && user.supabaseUser && supabase);
  const isAdmin     = !!(user && user.role === "admin");
  const isTaskView  = pageTitle === "Tasks: Contacts"; // task view has different columns
  const [darkMode, setDarkMode] = useLocalStorage("app_dark", false);

  // ── Column visibility + widths ────────────────────────────────────────────
  const CT_COL_DEFS = [
    { id: "category",    label: "Category",    defaultW: 120 },
    { id: "contact",     label: "Contact",      defaultW: 160 },
    { id: "contact2",    label: "Contact 2",    defaultW: 140 },
    { id: "fu_date",     label: "FU Next",      defaultW: 75  },
    { id: "fu_who",      label: "FU Who",       defaultW: 75  },
    { id: "fu_priority", label: "FU Priority",  defaultW: 90  },
    { id: "note_quick",  label: "Quick Notes",  defaultW: 150 },
    { id: "created_at",  label: "Created",      defaultW: 80  },
  ];
  const [ctColHidden,   setCtColHidden]   = useState(function() { try { return JSON.parse(localStorage.getItem("mtk_ct_col_hidden") || "[]"); } catch(e) { return []; } });
  const [ctColWidths,   setCtColWidths]   = useState(function() { try { return JSON.parse(localStorage.getItem("mtk_ct_col_widths") || "{}"); } catch(e) { return {}; } });
  const [showCtColPicker, setShowCtColPicker] = useState(false);
  function ctColVisible(id)  { return !ctColHidden.includes(id); }
  function ctColW(id, def)   { return ctColWidths[id] || def; }
  function ctSaveHidden(h)   { setCtColHidden(h); try { localStorage.setItem("mtk_ct_col_hidden", JSON.stringify(h)); } catch(e) {} }
  function ctSaveWidths(w)   { setCtColWidths(w); try { localStorage.setItem("mtk_ct_col_widths", JSON.stringify(w)); } catch(e) {} }
  function ctStartResize(e, colId, defaultW) {
    e.preventDefault();
    var startX = e.clientX, startW = ctColW(colId, defaultW);
    function onMove(ev) { ctSaveWidths(Object.assign({}, ctColWidths, { [colId]: Math.max(50, startW + ev.clientX - startX) })); }
    function onUp() { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [contacts,        setContacts]        = useState([]);
  const [cloudLoading,    setCloudLoading]    = useState(false);
  const [cloudError,      setCloudError]      = useState(null);
  const [typeFilterInternal, setTypeFilterInternal] = useState("all");
  // Use controlled value from App.js sidebar if provided, otherwise internal state
  const typeFilter    = typeFilterProp    !== undefined ? typeFilterProp    : typeFilterInternal;
  const setTypeFilter = setTypeFilterProp !== undefined ? setTypeFilterProp : setTypeFilterInternal;
  const [categoryFilter,  setCategoryFilter]  = useState(null);
  const [statusFilter,    setStatusFilter]    = useState("active");
  const [searchTerm,      setSearchTerm]      = useState("");
  const [selectedContact, setSelectedContact] = useState(null);

  // Notify parent when the selected contact changes (for sidebar name display)
  useEffect(function() {
    if (!onContactSelected) return;
    if (selectedContact) {
      var nm = ((selectedContact.first_name || "") + " " + (selectedContact.last_name || "")).trim();
      var badge = selectedContact.contact_category || selectedContact.contact_type || "";
      onContactSelected({ id: selectedContact.id, name: nm || "Contact", badge: badge });
    } else {
      onContactSelected(null);
    }
  }, [selectedContact]);

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
  const [selectedCIds,   setSelectedCIds]   = useState([]);
  const [bulkField,      setBulkField]      = useState("");
  const [bulkValue,      setBulkValue]      = useState("");
  const [bulkApplying,   setBulkApplying]   = useState(false);
  const [bulkDeleting,   setBulkDeleting]   = useState(false);
  const [bulkResult,     setBulkResult]     = useState(null);
  const [showMerge,      setShowMerge]      = useState(false);
  const [merging,        setMerging]        = useState(false);
  const [creatorMap,     setCreatorMap]     = useState({}); // profileId → display_name (admin only)

  // ── Auto-open contact when navigating from toolkit ───────────────────
  useEffect(function() {
    if (!initialContactId || contacts.length === 0 || selectedContact) return;
    const match = contacts.find(function(c) { return c.id === initialContactId; });
    if (match) setSelectedContact(match);
  }, [initialContactId, contacts]);

  // ── Close contact detail when sidebar filter link is clicked ─────────
  // typeFilterProp changes when the user clicks All / Business / Client
  // in the sidebar while a contact is open. We detect the change via a ref
  // so we only react to *updates*, not the initial mount value.
  var _prevTypeFilter = React.useRef(typeFilterProp);
  useEffect(function() {
    if (typeFilterProp !== _prevTypeFilter.current) {
      _prevTypeFilter.current = typeFilterProp;
      setSelectedContact(null);
    }
  }, [typeFilterProp]);

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

  // ── Creator profile lookup (admin only) ──────────────────────────────
  useEffect(function() {
    if (!isAdmin || !isCloudUser) return;
    var supa = window._supabaseClient;
    if (!supa) return;
    supa.from("profiles")
      .select("id, display_name")
      .in("role", ["admin", "super_admin", "branch_admin", "internal"])
      .then(function(res) {
        if (res.error || !res.data) return;
        var map = {};
        res.data.forEach(function(p) { map[p.id] = p.display_name || p.email || p.id; });
        setCreatorMap(map);
      });
  }, [isAdmin, isCloudUser]);

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

  // ── Bulk update handler (internal+) ──────────────────────────────────
  async function handleBulkUpdate() {
    if (!bulkField || selectedCIds.length === 0) return;
    const payload = { [bulkField]: bulkValue || null };
    setBulkApplying(true);
    setBulkResult(null);
    const { error } = await bulkUpdateContactsInSupabase(selectedCIds, payload);
    if (error) {
      setBulkResult({ error: error.message });
    } else {
      setContacts(function(prev) {
        return prev.map(function(c) {
          return selectedCIds.includes(c.id) ? Object.assign({}, c, payload) : c;
        });
      });
      setBulkResult({ ok: selectedCIds.length });
      setSelectedCIds([]);
      setBulkField("");
      setBulkValue("");
    }
    setBulkApplying(false);
  }

  // ── Bulk delete handler (admin only) ─────────────────────────────────
  async function handleBulkDelete() {
    if (selectedCIds.length === 0) return;
    const { data: linked } = await supabase
      .from("scenarios").select("id").in("contact_id", selectedCIds);
    const scCount = (linked || []).length;
    const msg = [
      "Permanently delete " + selectedCIds.length + " contact" + (selectedCIds.length === 1 ? "" : "s") + "?",
      scCount > 0
        ? "⚠️ " + scCount + " linked scenario" + (scCount === 1 ? "" : "s") + " will also be deleted."
        : "",
      "This cannot be undone.",
    ].filter(Boolean).join("\n\n");
    if (!window.confirm(msg)) return;
    setBulkDeleting(true);
    try {
      if (scCount > 0) {
        await supabase.from("scenarios").delete().in("contact_id", selectedCIds);
      }
      const { error } = await bulkDeleteContactsInSupabase(selectedCIds);
      if (error) { alert("Delete failed: " + error.message); return; }
      setContacts(function(prev) { return prev.filter(function(c) { return !selectedCIds.includes(c.id); }); });
      setSelectedCIds([]);
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally { setBulkDeleting(false); }
  }

  // ── Delete handler (admin only) ───────────────────────────────────────
  async function handleDeleteContact(contact) {
    const fullName = ((contact.first_name || "") + " " + (contact.last_name || "")).trim() || "this contact";

    // Count linked scenarios before confirming
    const { data: linkedScs } = await supabase
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
    if (!window.confirm(warningLines.join("\n"))) return;

    setDeletingId(contact.id);
    try {
      // Delete linked scenarios first
      if (scCount > 0) {
        const { error: scErr } = await supabase
          .from("scenarios")
          .delete()
          .eq("contact_id", contact.id);
        if (scErr) { alert("Could not delete linked scenarios: " + scErr.message); return; }
      }
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
        var fullName = ((c.first_name || "") + " " + (c.last_name || "")).toLowerCase();
        return (
          fullName.includes(q) ||
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
        const firstA = (a.first_name || "").toLowerCase();
        const firstB = (b.first_name || "").toLowerCase();
        const cmp = firstA.localeCompare(firstB);
        if (cmp !== 0) return dir * cmp;
        const lastA = (a.last_name  || "").toLowerCase();
        const lastB = (b.last_name  || "").toLowerCase();
        return dir * lastA.localeCompare(lastB);
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
      if (sortBy === "creator_id") {
        const ca = creatorMap[a.creator_id] || "";
        const cb = creatorMap[b.creator_id] || "";
        return dir * ca.localeCompare(cb);
      }
      // default: created_at
      return dir * (new Date(a.created_at) - new Date(b.created_at));
    });

    return list;
  }, [contacts, typeFilter, categoryFilter, statusFilter, searchTerm, fuWhoFilter, fuPriorityFilter, fuDateFilter, sortBy, sortDir, creatorMap]);

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

    // Trim + lowercase all email fields before saving
    var cleanedForm = Object.assign({}, addForm, {
      email_personal: (addForm.email_personal || "").trim().toLowerCase(),
      email_work:     (addForm.email_work     || "").trim().toLowerCase(),
      email_other:    (addForm.email_other    || "").trim().toLowerCase(),
    });
    saveContactToSupabase(cleanedForm).then(function(result) {
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

  // ── Merge contacts modal ──────────────────────────────────────────────
  function MergeContactsModal() {
    if (!showMerge || selectedCIds.length !== 2) return null;
    var cA = contacts.find(function(c) { return c.id === selectedCIds[0]; });
    var cB = contacts.find(function(c) { return c.id === selectedCIds[1]; });
    if (!cA || !cB) return null;

    // Local state lives inside this component (re-created each open)
    var _keep  = useState(cA.id);
    var keepId = _keep[0]; var setKeepId = _keep[1];
    var deleteId = keepId === cA.id ? cB.id : cA.id;
    var K = keepId === cA.id ? cA : cB;  // keeper object
    var D = keepId === cA.id ? cB : cA;  // deleter object

    // Field-level picks: "K" = use keeper's value, "D" = use deleter's, "custom" = typed
    var FIELDS = [
      { key: "first_name",        label: "First Name" },
      { key: "last_name",         label: "Last Name" },
      { key: "company",           label: "Company" },
      { key: "contact_type",      label: "Type" },
      { key: "contact_category",  label: "Category" },
      { key: "email_personal",    label: "Email (Personal)" },
      { key: "email_work",        label: "Email (Work)" },
      { key: "phone_cell",        label: "Phone (Cell)" },
      { key: "phone_work",        label: "Phone (Work)" },
      { key: "address1_street",   label: "Address" },
      { key: "address1_city",     label: "City" },
      { key: "address1_state",    label: "State" },
      { key: "fu_who",            label: "FU Who" },
      { key: "fu_priority",       label: "FU Priority" },
      { key: "fu_date",           label: "FU Date" },
      { key: "note_quick",        label: "Quick Note" },
    ];

    var initPicks = {};
    FIELDS.forEach(function(f) {
      // Auto-pick whichever side has a value; prefer keeper's
      initPicks[f.key] = (K[f.key] || "") ? "K" : ((D[f.key] || "") ? "D" : "K");
    });
    var _picks = useState(initPicks);
    var picks = _picks[0]; var setPicks = _picks[1];
    var _err = useState(""); var mergeErr = _err[0]; var setMergeErr = _err[1];

    function setPick(fieldKey, side) {
      setPicks(function(prev) { return Object.assign({}, prev, { [fieldKey]: side }); });
    }

    async function doMerge() {
      setMerging(true); setMergeErr("");
      // Build merged fields from picks
      var merged = {};
      FIELDS.forEach(function(f) {
        merged[f.key] = picks[f.key] === "D" ? (D[f.key] || null) : (K[f.key] || null);
      });
      const { error } = await mergeContactsInSupabase(keepId, deleteId, merged);
      if (error) {
        setMergeErr(error.message || "Merge failed.");
        setMerging(false);
        return;
      }
      // Update local state: patch keeper, remove deleter
      setContacts(function(prev) {
        return prev
          .filter(function(c) { return c.id !== deleteId; })
          .map(function(c) { return c.id === keepId ? Object.assign({}, c, merged) : c; });
      });
      setSelectedCIds([]);
      setShowMerge(false);
      setMerging(false);
      setBulkResult({ ok: "merged" });
    }

    var ov = { // overlay
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    };
    var box = {
      background: "#fff", borderRadius: "16px",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      width: "100%", maxWidth: "820px", maxHeight: "90vh",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden",
    };
    var hdr = {
      padding: "20px 24px 16px", borderBottom: "1px solid #e2e8f0",
      display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
    };
    var nameOf = function(c) { return ((c.first_name || "") + " " + (c.last_name || "")).trim() || "Unnamed"; };

    // Pill for picking a side
    function SidePill(props) {
      var active = picks[props.fieldKey] === props.side;
      var val = props.side === "K" ? (K[props.fieldKey] || "") : (D[props.fieldKey] || "");
      if (!val) val = <em style={{ color: "#94a3b8" }}>(empty)</em>;
      return React.createElement("div", {
        onClick: function() { setPick(props.fieldKey, props.side); },
        style: {
          flex: 1, padding: "8px 10px", borderRadius: "8px", cursor: "pointer",
          border: "2px solid " + (active ? "#2563eb" : "#e2e8f0"),
          background: active ? "#eff6ff" : "#f8fafc",
          fontSize: "12px", color: active ? "#1e3a5f" : "#475569",
          fontWeight: active ? 700 : 400,
          transition: "all 0.1s",
        }
      },
        React.createElement("div", { style: { fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? "#2563eb" : "#94a3b8", marginBottom: "3px" } },
          props.side === "K" ? "Primary" : "Duplicate"
        ),
        React.createElement("div", null, val)
      );
    }

    return React.createElement("div", { style: ov, onClick: function(e) { if (e.target === e.currentTarget && !merging) setShowMerge(false); } },
      React.createElement("div", { style: box },

        // Header
        React.createElement("div", { style: hdr },
          React.createElement("div", null,
            React.createElement("h2", { style: { margin: 0, fontSize: "18px", fontWeight: 800, color: "#1e3a5f" } }, "Merge Contacts"),
            React.createElement("p", { style: { margin: "4px 0 0", fontSize: "13px", color: "#64748b" } },
              "Choose which value to keep for each field. Notes from both contacts will be combined."
            )
          ),
          React.createElement("button", {
            onClick: function() { if (!merging) setShowMerge(false); },
            style: { background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "13px", color: "#475569" }
          }, "✕ Cancel")
        ),

        // Primary contact picker
        React.createElement("div", {
          style: { padding: "14px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }
        },
          React.createElement("div", { style: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "8px" } },
            "Which contact is the primary? (This ID is kept, the other is deleted)"
          ),
          React.createElement("div", { style: { display: "flex", gap: "10px" } },
            [cA, cB].map(function(c) {
              var active = keepId === c.id;
              return React.createElement("button", {
                key: c.id,
                onClick: function() { setKeepId(c.id); },
                style: {
                  flex: 1, padding: "10px 14px", borderRadius: "10px", cursor: "pointer",
                  border: "2px solid " + (active ? "#2563eb" : "#e2e8f0"),
                  background: active ? "#eff6ff" : "#fff",
                  color: active ? "#1e3a5f" : "#475569",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontWeight: active ? 700 : 400, fontSize: "13px", textAlign: "left",
                }
              },
                active && React.createElement("span", { style: { fontSize: "10px", background: "#2563eb", color: "#fff", borderRadius: "4px", padding: "1px 6px", marginRight: "8px", fontWeight: 700 } }, "PRIMARY"),
                nameOf(c),
                React.createElement("span", { style: { marginLeft: "8px", fontSize: "11px", color: "#94a3b8", fontWeight: 400 } }, c.email_personal || c.email_work || "")
              );
            })
          )
        ),

        // Field comparison (scrollable)
        React.createElement("div", { style: { overflowY: "auto", padding: "16px 24px", flex: 1 } },
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: "8px", alignItems: "center", marginBottom: "8px" } },
            React.createElement("div", null),
            React.createElement("div", { style: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#2563eb" } }, "Primary — " + nameOf(K)),
            React.createElement("div", { style: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b" } }, "Duplicate — " + nameOf(D))
          ),
          FIELDS.filter(function(f) {
            // Only show rows where at least one side has a value, or both are empty for required fields
            return (K[f.key] || "") || (D[f.key] || "") || ["first_name","last_name"].includes(f.key);
          }).map(function(f) {
            var kVal = K[f.key] || "";
            var dVal = D[f.key] || "";
            var same = kVal === dVal;
            return React.createElement("div", {
              key: f.key,
              style: {
                display: "grid", gridTemplateColumns: "120px 1fr 1fr",
                gap: "8px", alignItems: "stretch", marginBottom: "6px",
                opacity: same ? 0.6 : 1,
              }
            },
              React.createElement("div", { style: { fontSize: "11px", fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center" } },
                f.label,
                same && React.createElement("span", { style: { marginLeft: "5px", fontSize: "9px", color: "#94a3b8" } }, "(same)")
              ),
              React.createElement(SidePill, { fieldKey: f.key, side: "K" }),
              React.createElement(SidePill, { fieldKey: f.key, side: "D" })
            );
          })
        ),

        // Footer
        React.createElement("div", {
          style: { padding: "16px 24px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }
        },
          mergeErr && React.createElement("span", { style: { fontSize: "13px", color: "#dc2626", flex: 1 } }, "⚠ " + mergeErr),
          !mergeErr && React.createElement("span", { style: { fontSize: "12px", color: "#94a3b8", flex: 1 } },
            "\"" + nameOf(D) + "\" will be permanently deleted. Linked scenarios and notes will transfer to \"" + nameOf(K) + "\"."
          ),
          React.createElement("button", {
            onClick: function() { if (!merging) setShowMerge(false); },
            style: { padding: "10px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f1f5f9", color: "#475569", fontSize: "14px", cursor: "pointer" }
          }, "Cancel"),
          React.createElement("button", {
            onClick: doMerge,
            disabled: merging,
            style: {
              padding: "10px 24px", borderRadius: "8px", border: "none",
              background: merging ? "#94a3b8" : "linear-gradient(135deg,#7c3aed,#5b21b6)",
              color: "#fff", fontSize: "14px", fontWeight: 700,
              cursor: merging ? "wait" : "pointer",
            }
          }, merging ? "Merging…" : "Merge Contacts")
        )
      )
    );
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
      onScenarios:       onBack,
      onTasksScenarios:  onTasksScenarios || null,
      onTasksContacts:   onTasksContacts  || null,
      activeView:        activeView       || "contact",
      onSetView:         onSetView        || null,
    });
  }

  // ── Style constants ───────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: "100vh",
      background: "#F5F8FA",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: "#1e293b",
    },
    header: {
      background: "#fff",
      borderBottom: "1px solid #e2e8f0",
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: { display: "flex", alignItems: "center", gap: "16px" },
    backBtn: {
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      padding: "8px 14px",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "500",
    },
    title: { fontSize: "20px", fontWeight: "700", color: "#1e293b", margin: 0 },
    logoutBtn: {
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #e2e8f0",
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
      border: "1px solid #e2e8f0",
      background: "#fff",
      color: "#1e293b",
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
        border: active ? "none" : "1px solid #e2e8f0",
        background: active ? "#2563eb" : "#fff",
        color: active ? "#fff" : "#64748b",
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
        border: active ? "none" : "1px solid #e2e8f0",
        background: active ? "#2563eb" : "#fff",
        color: active ? "#fff" : "#64748b",
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
        background: active ? "rgba(37,99,235,0.1)" : "transparent",
        color: active ? "#2563eb" : "#64748b",
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
    borderBottom: "1px solid #e2e8f0",
  };
  var tdStyle = { padding: "10px 12px", verticalAlign: "middle", fontSize: "13px" };

  // ── Add Contact inline form ───────────────────────────────────────────

  var inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#fff", color: "#1e293b",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  };
  var labelStyle  = { fontSize: "12px", color: "#64748b", marginBottom: "4px", display: "block", fontWeight: "600" };
  var rowStyle    = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" };
  var optionStyle = { background: "#fff", color: "#1e293b" };

  function setAddField(field, value) {
    setAddForm(function(p) {
      var next = Object.assign({}, p);
      next[field] = value;
      return next;
    });
  }

  // ── Main render ───────────────────────────────────────────────────────
  return React.createElement("div", { style: S.page },

    // ── Body ────────────────────────────────────────────────────────────
    React.createElement("div", { style: S.body },

      // ── Type tags + subcategory pills (always visible) ───────────────
      React.createElement("div", { style: { marginBottom: "16px" } },
        // Row 1: type pills
        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: typeFilter !== "all" ? "10px" : "0" } },
          TYPE_TABS_CT.map(function(tab) {
            return React.createElement(TypeTab, { key: tab.key, tab: tab });
          })
        ),
        // Row 2: subcategory pills — shown when Business or Client is active
        typeFilter !== "all" && React.createElement("div", {
          style: {
            display: "flex", flexWrap: "wrap", gap: "6px",
            padding: "10px 14px",
            background: "#f8fafc",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
          },
        },
          [null].concat(typeFilter === "business" ? BUSINESS_CATEGORIES_CT : CLIENT_CATEGORIES_CT)
            .map(function(cat) {
              return React.createElement(CategoryPill, { key: cat || "__all__", cat: cat });
            })
        )
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
        (fuWhoFilter || fuPriorityFilter || fuDateFilter || categoryFilter) && React.createElement("button", {
          onClick: function() { setFuWhoFilter(""); setFuPriorityFilter(""); setFuDateFilter(""); setCategoryFilter(null); setTypeFilter("all"); },
          style: {
            padding: "7px 12px", borderRadius: "8px", cursor: "pointer",
            background: "rgba(239,68,68,0.08)", color: "#dc2626",
            border: "1px solid rgba(239,68,68,0.25)", fontSize: "12px", fontWeight: "600",
            whiteSpace: "nowrap",
          },
        }, "✕ Clear"),

        // Export CSV button
        filteredContacts.length > 0 && React.createElement("button", {
          onClick: function() { exportContactsToCSV(filteredContacts); },
          title: "Export " + filteredContacts.length + " contact" + (filteredContacts.length === 1 ? "" : "s") + " to CSV",
          style: {
            padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
            background: "#f1f5f9", color: "#64748b",
            border: "1px solid #e2e8f0",
            fontSize: "13px", fontWeight: "500", whiteSpace: "nowrap",
          },
        }, "↓ CSV (" + filteredContacts.length + ")"),

        React.createElement("div", {
          style: { display: "flex", gap: "4px", background: "#f1f5f9", borderRadius: "8px", padding: "3px" }
        },
          React.createElement(StatusTab, { val: "active",    label: "Active"    }),
          React.createElement(StatusTab, { val: "archived",  label: "Archived"  }),
          React.createElement(StatusTab, { val: "converted", label: "Converted" })
        ),
        (isInternal || isPartner) && React.createElement("button", {
          onClick: function() { setShowAddForm(function(v) { return !v; }); setAddError(null); },
          style: S.addBtn,
        }, showAddForm ? "✕ Cancel" : "+ Add Contact")
      ),

      // ── Add Contact modal ─────────────────────────────────────────────
      showAddForm && (isInternal || isPartner) && React.createElement("div", {
        style: {
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        },
        onClick: function(e) {
          if (e.target === e.currentTarget) { setShowAddForm(false); setAddForm(EMPTY_FORM_CT); setAddError(null); }
        }
      },
        React.createElement("div", {
          style: {
            background: "#fff", borderRadius: "16px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            padding: "32px", width: "100%", maxWidth: "480px",
            fontFamily: "'Inter', system-ui, sans-serif",
          }
        },
          // Header
          React.createElement("div", { style: { marginBottom: "24px" } },
            React.createElement("h3", {
              style: { margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: "#1e3a5f" }
            }, "New Contact"),
            React.createElement("p", {
              style: { margin: 0, fontSize: "13px", color: "#64748b" }
            }, "Fill in the basics — you can add more details from the contact record.")
          ),
          React.createElement("form", { onSubmit: handleAddSubmit },
            // Row 1: First + Last name
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" } },
              React.createElement("div", null,
                React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "First Name"),
                React.createElement("input", {
                  style: { width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", outline: "none", boxSizing: "border-box" },
                  value: addForm.first_name,
                  placeholder: "Joe",
                  onChange: function(e) { setAddField("first_name", e.target.value); }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "Last Name *"),
                React.createElement("input", {
                  style: { width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", outline: "none", boxSizing: "border-box" },
                  value: addForm.last_name, required: true,
                  placeholder: "Smith",
                  onChange: function(e) { setAddField("last_name", e.target.value); }
                })
              )
            ),
            // Row 2: Email + Phone
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" } },
              React.createElement("div", null,
                React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "Email"),
                React.createElement("input", {
                  type: "email",
                  style: { width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", outline: "none", boxSizing: "border-box" },
                  value: addForm.email_personal,
                  placeholder: "joe@email.com",
                  onChange: function(e) { setAddField("email_personal", e.target.value); }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "Phone"),
                React.createElement("input", {
                  type: "tel",
                  style: { width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", outline: "none", boxSizing: "border-box" },
                  value: addForm.phone,
                  placeholder: "(555) 555-5555",
                  onChange: function(e) { setAddField("phone", e.target.value); }
                })
              )
            ),
            // Row 3: Type + Category
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" } },
              React.createElement("div", null,
                React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "Type"),
                React.createElement("select", {
                  style: { width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", outline: "none", boxSizing: "border-box", background: "#fff", cursor: "pointer" },
                  value: addForm.contact_type,
                  onChange: function(e) {
                    var newType = e.target.value;
                    var defaultCat = newType === "business" ? "Other" : "Client";
                    setAddForm(function(p) { return Object.assign({}, p, { contact_type: newType, contact_category: defaultCat }); });
                  }
                },
                  React.createElement("option", { value: "client" },   "Client"),
                  React.createElement("option", { value: "business" }, "Business")
                )
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "Category"),
                React.createElement("select", {
                  style: { width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", outline: "none", boxSizing: "border-box", background: "#fff", cursor: "pointer" },
                  value: addForm.contact_category,
                  onChange: function(e) { setAddField("contact_category", e.target.value); }
                },
                  (addForm.contact_type === "business" ? BUSINESS_CATEGORIES_CT : CLIENT_CATEGORIES_CT)
                    .map(function(cat) { return React.createElement("option", { key: cat, value: cat }, cat); })
                )
              )
            ),
            // Company
            React.createElement("div", { style: { marginBottom: "14px" } },
              React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "Company"),
              React.createElement("input", {
                style: { width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", color: "#1e293b", outline: "none", boxSizing: "border-box" },
                value: addForm.company,
                placeholder: "Acme Realty, CMG, etc.",
                onChange: function(e) { setAddField("company", e.target.value); }
              })
            ),
            // Referred By
            React.createElement("div", { style: { marginBottom: "20px" } },
              React.createElement("label", { style: { display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#64748b", marginBottom: "5px" } }, "Referred By"),
              React.createElement(ReferralPickerCT, {
                value:     addForm.referred_by_contact_id,
                onChange:  function(id) { setAddField("referred_by_contact_id", id); },
                contacts:  contacts,
                excludeId: null,
                onAddNew:  function(nameStr) {
                  var parts = nameStr.trim().split(/\s+/);
                  var firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
                  var lastName  = parts[parts.length - 1] || nameStr.trim();
                  return saveContactToSupabase({
                    first_name: firstName, last_name: lastName,
                    contact_type: "client", contact_category: null,
                    email_personal: "", email_work: "", email_other: "",
                    phone_cell: "", phone_work: "", phone_fax: "",
                    address: "", city: "", state: "", zip: "",
                    referred_by_contact_id: null, status: "active", tags: [],
                  }).then(function(result) {
                    if (result.error || !result.data) return;
                    setContacts(function(prev) { return [result.data, ...prev]; });
                    setAddField("referred_by_contact_id", result.data.id);
                  });
                },
              })
            ),
            // Error
            addError && React.createElement("p", {
              style: { color: "#dc2626", fontSize: "13px", margin: "0 0 14px", background: "#fef2f2", padding: "8px 12px", borderRadius: "6px", border: "1px solid #fecaca" }
            }, addError),
            // Buttons
            React.createElement("div", { style: { display: "flex", gap: "10px" } },
              React.createElement("button", {
                type: "submit",
                disabled: addSaving,
                style: {
                  flex: 1, padding: "11px 0",
                  background: addSaving ? "#94a3b8" : "linear-gradient(135deg, #1e3a5f, #2d5a8e)",
                  color: "#fff", border: "none", borderRadius: "8px",
                  fontSize: "14px", fontWeight: 700,
                  cursor: addSaving ? "wait" : "pointer",
                }
              }, addSaving ? "Saving…" : "Save Contact"),
              React.createElement("button", {
                type: "button",
                onClick: function() { setShowAddForm(false); setAddForm(EMPTY_FORM_CT); setAddError(null); },
                style: {
                  padding: "11px 20px", background: "#f1f5f9", color: "#475569",
                  border: "1px solid #e2e8f0", borderRadius: "8px",
                  fontSize: "14px", cursor: "pointer",
                }
              }, "Cancel")
            )
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

      // ── Bulk action bar ───────────────────────────────────────────────
      selectedCIds.length > 0 && React.createElement("div", {
        style: {
          marginBottom: "12px", padding: "12px 16px",
          background: "rgba(37,99,235,0.08)", border: "1.5px solid rgba(37,99,235,0.3)",
          borderRadius: "10px", display: "flex", flexWrap: "wrap",
          alignItems: "center", gap: "10px",
        }
      },
        React.createElement("span", {
          style: { fontSize: "13px", fontWeight: "700", color: "#60a5fa", whiteSpace: "nowrap" },
        }, selectedCIds.length + " selected"),

        // Field picker
        (isInternal || isPartner) && React.createElement("select", {
          value: bulkField,
          onChange: function(e) { setBulkField(e.target.value); setBulkValue(""); setBulkResult(null); },
          style: {
            padding: "5px 8px", borderRadius: "6px",
            border: "1px solid #e2e8f0",
            background: bulkField ? "rgba(37,99,235,0.08)" : "#fff",
            color: bulkField ? "#2563eb" : "#64748b",
            fontSize: "12px", cursor: "pointer", outline: "none",
          },
        },
          React.createElement("option", { value: "" }, "Update field…"),
          React.createElement("option", { value: "contact_type" },     "Type"),
          React.createElement("option", { value: "contact_category" }, "Category"),
          React.createElement("option", { value: "status" },           "Status"),
          React.createElement("option", { value: "fu_who" },           "FU Who"),
          React.createElement("option", { value: "fu_priority" },      "FU Priority"),
          React.createElement("option", { value: "fu_date" },          "FU Date"),
          React.createElement("option", { value: "company" },          "Company"),
          React.createElement("option", { value: "note_quick" },       "Quick Note"),
          React.createElement("option", { value: "source" },           "Source")
        ),

        // Value input — changes based on field
        (isInternal || isPartner) && bulkField === "contact_type" && React.createElement("select", {
          value: bulkValue,
          onChange: function(e) { setBulkValue(e.target.value); },
          style: { padding: "5px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#1e293b", fontSize: "12px", outline: "none" },
        },
          React.createElement("option", { value: "" }, "Pick type…"),
          React.createElement("option", { value: "client" },   "Client"),
          React.createElement("option", { value: "business" }, "Business")
        ),
        (isInternal || isPartner) && bulkField === "contact_category" && React.createElement("select", {
          value: bulkValue,
          onChange: function(e) { setBulkValue(e.target.value); },
          style: { padding: "5px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#1e293b", fontSize: "12px", outline: "none" },
        },
          React.createElement("option", { value: "" }, "Pick category…"),
          React.createElement("optgroup", { label: "— Business —" },
            BUSINESS_CATEGORIES_CT.map(function(c) { return React.createElement("option", { key: c, value: c }, c); })
          ),
          React.createElement("optgroup", { label: "— Client —" },
            CLIENT_CATEGORIES_CT.map(function(c) { return React.createElement("option", { key: c, value: c }, c); })
          )
        ),
        (isInternal || isPartner) && bulkField === "status" && React.createElement("select", {
          value: bulkValue,
          onChange: function(e) { setBulkValue(e.target.value); },
          style: { padding: "5px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#1e293b", fontSize: "12px", outline: "none" },
        },
          React.createElement("option", { value: "" }, "Pick status…"),
          React.createElement("option", { value: "active" },    "Active"),
          React.createElement("option", { value: "archived" },  "Archived"),
          React.createElement("option", { value: "converted" }, "Converted")
        ),
        (isInternal || isPartner) && bulkField === "fu_priority" && React.createElement("select", {
          value: bulkValue,
          onChange: function(e) { setBulkValue(e.target.value); },
          style: { padding: "5px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#1e293b", fontSize: "12px", outline: "none" },
        },
          React.createElement("option", { value: "" }, "Pick priority…"),
          React.createElement("option", { value: "High" },   "🔴 High"),
          React.createElement("option", { value: "Medium" }, "🟡 Medium"),
          React.createElement("option", { value: "Low" },    "⚪ Low"),
          React.createElement("option", { value: "" }, "— Clear —")
        ),
        (isInternal || isPartner) && bulkField === "fu_date" && React.createElement("input", {
          type: "date", value: bulkValue,
          onChange: function(e) { setBulkValue(e.target.value); },
          style: { padding: "5px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#1e293b", fontSize: "12px", outline: "none" },
        }),
        (isInternal || isPartner) && (bulkField === "fu_who" || bulkField === "note_quick" || bulkField === "source" || bulkField === "company") && React.createElement("input", {
          type: "text", value: bulkValue, placeholder: "New value…",
          onChange: function(e) { setBulkValue(e.target.value); },
          style: { padding: "5px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#1e293b", fontSize: "12px", outline: "none", width: "140px" },
        }),

        // Apply button
        (isInternal || isPartner) && bulkField && React.createElement("button", {
          onClick: handleBulkUpdate,
          disabled: bulkApplying || !bulkField,
          style: {
            padding: "6px 14px", borderRadius: "6px", border: "none",
            background: bulkApplying ? "rgba(37,99,235,0.4)" : "#2563eb",
            color: "#fff", fontSize: "12px", fontWeight: "700",
            cursor: bulkApplying ? "wait" : "pointer", whiteSpace: "nowrap",
            opacity: (bulkApplying || !bulkField) ? 0.5 : 1,
          },
        }, bulkApplying ? "Applying…" : "Apply to " + selectedCIds.length),

        // Delete button (admin only)
        isAdmin && React.createElement("button", {
          onClick: handleBulkDelete,
          disabled: bulkDeleting,
          style: {
            padding: "6px 14px", borderRadius: "6px",
            border: "1px solid rgba(239,68,68,0.4)",
            background: "rgba(239,68,68,0.12)", color: "#f87171",
            fontSize: "12px", fontWeight: "700",
            cursor: bulkDeleting ? "wait" : "pointer", whiteSpace: "nowrap",
          },
        }, bulkDeleting ? "Deleting…" : "🗑 Delete " + selectedCIds.length),

        // Merge button (only when exactly 2 selected)
        (isInternal || isPartner) && selectedCIds.length === 2 && React.createElement("button", {
          onClick: function() { setShowMerge(true); },
          style: {
            padding: "6px 14px", borderRadius: "6px",
            border: "1px solid rgba(168,85,247,0.45)",
            background: "rgba(168,85,247,0.12)", color: "#c084fc",
            fontSize: "12px", fontWeight: "700",
            cursor: "pointer", whiteSpace: "nowrap",
          },
        }, "⇄ Merge 2 Contacts"),

        // Deselect
        React.createElement("button", {
          onClick: function() { setSelectedCIds([]); setBulkField(""); setBulkValue(""); setBulkResult(null); },
          style: {
            padding: "5px 10px", borderRadius: "6px",
            border: "1px solid #e2e8f0",
            background: "transparent", color: "#64748b",
            fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
          },
        }, "✕ Deselect"),

        // Result badge
        bulkResult && bulkResult.ok && React.createElement("span", {
          style: { fontSize: "12px", fontWeight: "600", color: "#4ade80" },
        }, bulkResult.ok === "merged" ? "✅ Contacts merged" : "✅ Updated " + bulkResult.ok),
        bulkResult && bulkResult.error && React.createElement("span", {
          style: { fontSize: "12px", fontWeight: "600", color: "#f87171" },
        }, "⚠️ " + bulkResult.error),

        React.createElement("span", {
          style: { fontSize: "11px", color: "#475569", marginLeft: "auto" },
        }, "Only the chosen field will be changed.")
      ),

      // ── Merge modal ───────────────────────────────────────────────────
      showMerge && React.createElement(MergeContactsModal, null),

      // ── Columns picker ────────────────────────────────────────────────────
      !cloudLoading && !cloudError && filteredContacts.length > 0 &&
        React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 6, position: "relative", zIndex: 400 } },
          React.createElement("button", {
            onClick: function() { setShowCtColPicker(function(v) { return !v; }); },
            style: { fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }
          }, "⚙ Columns " + (showCtColPicker ? "▲" : "▼")),
          showCtColPicker && React.createElement(React.Fragment, null,
            // Click-outside backdrop
            React.createElement("div", { onClick: function() { setShowCtColPicker(false); }, style: { position: "fixed", inset: 0, zIndex: 9998 } }),
            React.createElement("div", {
              style: { position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)", padding: "14px 18px", minWidth: 220 }
            },
              React.createElement("div", { style: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 } }, "Show / Hide Columns"),
              CT_COL_DEFS.map(function(col) {
                var visible = ctColVisible(col.id);
                return React.createElement("label", { key: col.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "5px 0", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#1e293b", userSelect: "none" } },
                  React.createElement("input", { type: "checkbox", checked: visible, style: { width: 15, height: 15, cursor: "pointer", accentColor: "#2563eb" }, onChange: function() { ctSaveHidden(visible ? [...ctColHidden, col.id] : ctColHidden.filter(function(x) { return x !== col.id; })); } }),
                  col.label
                );
              }),
              React.createElement("div", { style: { marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10 } },
                React.createElement("button", { onClick: function() { ctSaveHidden([]); ctSaveWidths({}); setShowCtColPicker(false); }, style: { fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 } }, "Reset to defaults")
              )
            )
          )
        ),

      // ── Contact table ─────────────────────────────────────────────────
      !cloudLoading && !cloudError && filteredContacts.length > 0 &&
        React.createElement("div", {
          style: {
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            overflowX: "auto",
          }
        },
          React.createElement("table", {
            style: {
              width: "100%", borderCollapse: "collapse", tableLayout: "fixed",
              minWidth: "600px", fontSize: "13px",
            }
          },
          React.createElement("colgroup", null,
            (isInternal || isPartner) ? React.createElement("col", { style: { width: "36px" } }) : null,
            CT_COL_DEFS.map(function(col) {
              return ctColVisible(col.id) ? React.createElement("col", { key: col.id, style: { width: ctColW(col.id, col.defaultW) + "px" } }) : null;
            }),
            isAdmin ? React.createElement("col", { style: { width: "80px" } }) : null
          ),
            React.createElement("thead", null,
              React.createElement("tr", { style: { background: "#f8fafc" } },
                (function() {
                  // Sort arrow helper
                  function arrow(col) {
                    if (sortBy !== col) return React.createElement("span", { style: { opacity: 0.3, marginLeft: 3 } }, "⇅");
                    return React.createElement("span", { style: { marginLeft: 3, color: "#60a5fa" } }, sortDir === "asc" ? "↑" : "↓");
                  }
                  var clkTh = Object.assign({}, thStyle, { cursor: "pointer", verticalAlign: "top", position: "relative" });
                  function rh(colId, defW) {
                    return React.createElement("div", { onMouseDown: function(e) { e.stopPropagation(); ctStartResize(e, colId, defW); }, style: { position: "absolute", right: 0, top: 0, width: 5, height: "100%", cursor: "col-resize", zIndex: 1 } });
                  }
                  var fltSel = {
                    marginTop: "4px", display: "block", width: "100%",
                    fontSize: "10px", padding: "2px 4px",
                    borderRadius: "4px", border: "1px solid #e2e8f0",
                    background: "#fff", color: "#64748b",
                    cursor: "pointer", outline: "none",
                  };
                  var allFilteredIds = filteredContacts.map(function(c) { return c.id; });
                  var allSelected = allFilteredIds.length > 0 && allFilteredIds.every(function(id) { return selectedCIds.includes(id); });
                  return [
                    // Checkbox column
                    (isInternal || isPartner) && React.createElement("th", {
                      key: "chk", style: Object.assign({}, thStyle, { width: "36px", textAlign: "center", padding: "8px 6px" }),
                      onClick: function(e) { e.stopPropagation(); },
                    },
                      React.createElement("input", {
                        type: "checkbox",
                        title: allSelected ? "Deselect all" : "Select all visible",
                        checked: allSelected,
                        onChange: function(e) {
                          if (e.target.checked) {
                            setSelectedCIds(function(prev) {
                              var next = prev.slice();
                              allFilteredIds.forEach(function(id) { if (!next.includes(id)) next.push(id); });
                              return next;
                            });
                          } else {
                            setSelectedCIds(function(prev) { return prev.filter(function(id) { return !allFilteredIds.includes(id); }); });
                          }
                        },
                      })
                    ),
                    // Category
                    ctColVisible("category") && React.createElement("th", { key: "cat", style: Object.assign({}, clkTh, { position: "relative" }) },
                      React.createElement("div", { onClick: function() { handleSort("category"); }, style: { display: "inline-block" } }, React.createElement("span", null, "Category"), arrow("category")),
                      React.createElement("select", { value: categoryFilter || "", onChange: function(e) { e.stopPropagation(); setCategoryFilter(e.target.value || null); setTypeFilter("all"); }, onClick: function(e) { e.stopPropagation(); }, style: fltSel },
                        React.createElement("option", { value: "" }, "All"),
                        React.createElement("optgroup", { label: "── Business ──" }, BUSINESS_CATEGORIES_CT.map(function(c) { return React.createElement("option", { key: c, value: c }, c); })),
                        React.createElement("optgroup", { label: "── Client ──" }, CLIENT_CATEGORIES_CT.map(function(c) { return React.createElement("option", { key: c, value: c }, c); }))
                      ),
                      rh("category", 120)
                    ),
                    // Contact name
                    ctColVisible("contact") && React.createElement("th", { key: "name", style: clkTh, onClick: function() { handleSort("name"); } },
                      React.createElement("span", null, "Contact"), arrow("name"), rh("contact", 160)
                    ),
                    // Contact 2
                    ctColVisible("contact2") && React.createElement("th", { key: "contact2", style: Object.assign({}, thStyle, { position: "relative" }) }, "Contact 2", rh("contact2", 140)),
                    // FU Next
                    ctColVisible("fu_date") && React.createElement("th", { key: "fu_date", style: clkTh, onClick: function() { handleSort("fu_date"); } },
                      React.createElement("span", null, "FU Next"), arrow("fu_date"), rh("fu_date", 75)
                    ),
                    // FU Who
                    ctColVisible("fu_who") && React.createElement("th", { key: "fu_who", style: clkTh },
                      React.createElement("div", { onClick: function() { handleSort("fu_who"); }, style: { display: "inline-block" } }, React.createElement("span", null, "FU Who"), arrow("fu_who")),
                      React.createElement("select", { value: fuWhoFilter, onChange: function(e) { e.stopPropagation(); setFuWhoFilter(e.target.value); }, onClick: function(e) { e.stopPropagation(); }, style: fltSel },
                        React.createElement("option", { value: "" }, "All"),
                        React.createElement("option", { value: "_none" }, "— None —"),
                        fuWhoOptions.map(function(w) { return React.createElement("option", { key: w, value: w }, w); })
                      ),
                      rh("fu_who", 75)
                    ),
                    // FU Priority
                    ctColVisible("fu_priority") && React.createElement("th", { key: "fu_priority", style: clkTh },
                      React.createElement("div", { onClick: function() { handleSort("fu_priority"); }, style: { display: "inline-block" } }, React.createElement("span", null, "FU Priority"), arrow("fu_priority")),
                      React.createElement("select", { value: fuPriorityFilter, onChange: function(e) { e.stopPropagation(); setFuPriorityFilter(e.target.value); }, onClick: function(e) { e.stopPropagation(); }, style: fltSel },
                        React.createElement("option", { value: "" }, "All"),
                        React.createElement("option", { value: "_none" }, "— None —"),
                        React.createElement("option", { value: "High" }, "High"),
                        React.createElement("option", { value: "Medium" }, "Medium"),
                        React.createElement("option", { value: "Low" }, "Low")
                      ),
                      rh("fu_priority", 90)
                    ),
                    ctColVisible("note_quick") && React.createElement("th", { key: "note_quick", style: Object.assign({}, thStyle, { position: "relative" }) }, "Quick Notes", rh("note_quick", 150)),
                    // Created (hidden in task view)
                    !isTaskView && ctColVisible("created_at") && React.createElement("th", { key: "created", style: clkTh, onClick: function() { handleSort("created_at"); } },
                      React.createElement("span", null, "Created"), arrow("created_at"), rh("created_at", 80)
                    ),
                    // Creator (admin only, hidden in task view)
                    !isTaskView && isAdmin && React.createElement("th", { key: "creator", style: Object.assign({}, clkTh, { width: "120px" }),
                      onClick: function() { handleSort("creator_id"); } },
                      React.createElement("span", null, "Creator"), arrow("creator_id")
                    ),
                    // Actions column / delete (hidden in task view)
                    !isTaskView && React.createElement("th", { key: "actions", style: Object.assign({}, thStyle, { width: "50px" }) })
                  ].filter(Boolean);
                })()
              )
            ),
            React.createElement("tbody", null,
              filteredContacts.map(function(contact) {
                var fullName  = ((contact.first_name || "") + " " + (contact.last_name || "")).trim() || "Unnamed";
                var category  = contact.contact_category || contact.contact_type || "client";
                var tc        = CATEGORY_COLORS_CT[contact.contact_category] || TYPE_COLORS_CT[contact.contact_type] || TYPE_COLORS_CT.business;
                var phone     = ctFormatPhone(contact.phone_cell || contact.phone_work || contact.phone || "");
                var email     = contact.email_personal || contact.email_work || contact.email || "";
                var subLine   = phone || email || "";
                var scCount   = scenarioCounts[contact.id] || 0;

                var created   = contact.created_at
                  ? new Date(contact.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
                  : "—";

                // Contact 2 fields
                var name2   = ((contact.first_name2 || "") + " " + (contact.last_name2 || "")).trim() || null;
                var phone2  = ctFormatPhone(contact.phone2 || contact.phone2_cell || contact.phone2_work || "");
                var email2  = contact.email2 || contact.email2_personal || contact.email2_work || null;

                var isChecked = selectedCIds.includes(contact.id);
                return React.createElement("tr", {
                  key: contact.id,
                  onClick: function() { setSelectedContact(contact); },
                  style: {
                    borderBottom: "1px solid #f1f5f9", cursor: "pointer",
                    background: isChecked ? "rgba(37,99,235,0.06)" : "#fff",
                  },
                  onMouseEnter: function(e) { if (!isChecked) e.currentTarget.style.background = "#f8fafc"; },
                  onMouseLeave: function(e) { e.currentTarget.style.background = isChecked ? "rgba(37,99,235,0.06)" : "#fff"; },
                },

                  // Checkbox cell
                  (isInternal || isPartner) && React.createElement("td", {
                    style: Object.assign({}, tdStyle, { textAlign: "center", padding: "10px 6px" }),
                    onClick: function(e) { e.stopPropagation(); },
                  },
                    React.createElement("input", {
                      type: "checkbox",
                      checked: isChecked,
                      onChange: function(e) {
                        var id = contact.id;
                        setSelectedCIds(function(prev) {
                          return e.target.checked ? [...prev, id] : prev.filter(function(x) { return x !== id; });
                        });
                        setBulkResult(null);
                      },
                    })
                  ),

                  // Category badge
                  ctColVisible("category") && React.createElement("td", { style: tdStyle },
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
                  ctColVisible("contact") && React.createElement("td", { style: tdStyle },
                    React.createElement("div", { style: { fontWeight: "600", color: "#1e293b" } }, fullName),
                    scCount > 0 && React.createElement("span", {
                      style: {
                        display: "inline-block", marginTop: "3px",
                        background: "rgba(37,99,235,0.1)", color: "#2563eb",
                        borderRadius: "10px", padding: "1px 7px",
                        fontSize: "10px", fontWeight: "600",
                      }
                    }, scCount + (scCount === 1 ? " scenario" : " scenarios"))
                  ),

                  // Contact 2
                  ctColVisible("contact2") && React.createElement("td", { style: Object.assign({}, tdStyle, { color: "#64748b" }) },
                    (name2 || phone2 || email2)
                      ? React.createElement("div", null,
                          name2 && React.createElement("div", { style: { fontWeight: "600", color: "#1e293b", whiteSpace: "nowrap" } }, name2),
                          phone2 && React.createElement("div", { style: { fontSize: "11px", whiteSpace: "nowrap" } }, phone2),
                          email2 && React.createElement("div", {
                            title: email2,
                            style: { fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" },
                          }, email2)
                        )
                      : React.createElement("span", { style: { color: "#334155" } }, "—")
                  ),

                  // FU Next — inline editable, displays MM/DD
                  ctColVisible("fu_date") && React.createElement("td", { style: Object.assign({}, tdStyle, { whiteSpace: "nowrap", fontSize: "13px", padding: "6px 12px" }), onClick: function(e) { e.stopPropagation(); } },
                    React.createElement("input", {
                      type: "text",
                      defaultValue: contact.fu_date ? (function(d) { var p = d.split("-"); return p.length >= 3 ? p[1] + "/" + p[2] : d; })(contact.fu_date) : "",
                      placeholder: "",
                      onFocus: function(e) { e.target.style.boxShadow = "0 1px 0 #2563eb"; },
                      onBlur: function(e) {
                        e.target.style.boxShadow = "none";
                        var raw = e.target.value.trim();
                        if (!raw) {
                          patchContactInSupabase && patchContactInSupabase(contact.id, { fu_date: null }).then(function(r) {
                            if (!r.error) setContacts(function(prev) { return prev.map(function(x) { return x.id === contact.id ? Object.assign({}, x, { fu_date: null }) : x; }); });
                          });
                          return;
                        }
                        var m = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
                        if (!m) return;
                        var yr = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : (contact.fu_date ? contact.fu_date.split("-")[0] : new Date().getFullYear().toString());
                        var iso = yr + "-" + m[1].padStart(2,"0") + "-" + m[2].padStart(2,"0");
                        patchContactInSupabase && patchContactInSupabase(contact.id, { fu_date: iso }).then(function(r) {
                          if (!r.error) setContacts(function(prev) { return prev.map(function(x) { return x.id === contact.id ? Object.assign({}, x, { fu_date: iso }) : x; }); });
                        });
                      },
                      style: { border: "none", background: "transparent", fontSize: "13px", color: "#1e293b", width: "52px", outline: "none", padding: 0, fontFamily: "inherit" }
                    })
                  ),

                  // FU Who — inline editable with datalist
                  ctColVisible("fu_who") && React.createElement("td", { style: Object.assign({}, tdStyle, { whiteSpace: "nowrap", fontSize: "13px", padding: "6px 12px" }), onClick: function(e) { e.stopPropagation(); } },
                    (function() {
                      var fuOpts = ((user && user.fuWhoOptions) || "").split(",").map(function(s) { return s.trim(); }).filter(Boolean);
                      var listId = "fu-who-ct-" + contact.id;
                      return React.createElement(React.Fragment, null,
                        React.createElement("input", {
                          type: "text", list: listId, defaultValue: contact.fu_who || "", placeholder: "—",
                          onFocus: function(e) { e.target.style.boxShadow = "0 1px 0 #2563eb"; },
                          onBlur: function(e) {
                            e.target.style.boxShadow = "none";
                            var val = e.target.value.trim() || null;
                            patchContactInSupabase && patchContactInSupabase(contact.id, { fu_who: val }).then(function(r) {
                              if (!r.error) setContacts(function(prev) { return prev.map(function(x) { return x.id === contact.id ? Object.assign({}, x, { fu_who: val }) : x; }); });
                            });
                          },
                          style: { border: "none", background: "transparent", fontSize: "13px", color: "#1e293b", width: "60px", outline: "none", padding: 0, fontFamily: "inherit" }
                        }),
                        React.createElement("datalist", { id: listId },
                          fuOpts.map(function(o) { return React.createElement("option", { key: o, value: o }); })
                        )
                      );
                    })()
                  ),

                  // FU Priority — inline editable, shown as colored badge
                  ctColVisible("fu_priority") && React.createElement("td", { style: Object.assign({}, tdStyle, { whiteSpace: "nowrap", fontSize: "13px", padding: "6px 12px" }), onClick: function(e) { e.stopPropagation(); } },
                    React.createElement("select", {
                      defaultValue: contact.fu_priority || "",
                      onChange: function(e) {
                        var val = e.target.value || null;
                        patchContactInSupabase && patchContactInSupabase(contact.id, { fu_priority: val }).then(function(r) {
                          if (!r.error) setContacts(function(prev) { return prev.map(function(x) { return x.id === contact.id ? Object.assign({}, x, { fu_priority: val }) : x; }); });
                        });
                      },
                      style: {
                        border: "none", background: "transparent", fontSize: "13px", outline: "none",
                        cursor: "pointer", padding: 0, fontFamily: "inherit",
                        color: contact.fu_priority === "High" ? "#dc2626" : contact.fu_priority === "Medium" ? "#d97706" : contact.fu_priority === "Low" ? "#16a34a" : "#94a3b8",
                        fontWeight: contact.fu_priority ? "600" : "400",
                      }
                    },
                      React.createElement("option", { value: "" }, "—"),
                      React.createElement("option", { value: "High" }, "High"),
                      React.createElement("option", { value: "Medium" }, "Medium"),
                      React.createElement("option", { value: "Low" }, "Low")
                    )
                  ),

                  // Quick Notes — inline editable
                  ctColVisible("note_quick") && React.createElement("td", { style: Object.assign({}, tdStyle, { fontSize: "13px", padding: "6px 12px" }), onClick: function(e) { e.stopPropagation(); } },
                    React.createElement("input", {
                      type: "text", defaultValue: contact.note_quick || "", placeholder: "—",
                      onFocus: function(e) { e.target.style.boxShadow = "0 1px 0 #2563eb"; },
                      onBlur: function(e) {
                        e.target.style.boxShadow = "none";
                        var val = e.target.value.trim() || null;
                        patchContactInSupabase && patchContactInSupabase(contact.id, { note_quick: val }).then(function(r) {
                          if (!r.error) setContacts(function(prev) { return prev.map(function(x) { return x.id === contact.id ? Object.assign({}, x, { note_quick: val }) : x; }); });
                        });
                      },
                      style: { border: "none", background: "transparent", fontSize: "13px", color: "#1e293b", width: "100%", outline: "none", padding: 0, fontFamily: "inherit" }
                    })
                  ),

                  // Created (hidden in task view)
                  !isTaskView && ctColVisible("created_at") && React.createElement("td", {
                    style: Object.assign({}, tdStyle, { color: "#64748b", whiteSpace: "nowrap", fontSize: "12px" }),
                  }, contact.created_at ? new Date(contact.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "—"),

                  // Creator (admin only, hidden in task view)
                  !isTaskView && isAdmin && React.createElement("td", {
                    style: Object.assign({}, tdStyle, { whiteSpace: "nowrap", fontSize: "12px" }),
                  }, (function() {
                    if (contact.creator_id && creatorMap[contact.creator_id]) {
                      return React.createElement("span", { style: { color: "#94a3b8" } }, creatorMap[contact.creator_id]);
                    }
                    return React.createElement("span", { style: { color: "#334155" } }, "—");
                  })()),

                  // Delete button (admin only, hidden in task view)
                  !isTaskView && React.createElement("td", {
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
