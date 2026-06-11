// modules/screens/ScenarioDashboard.js
const { useState, useEffect } = React;
const useLocalStorage = window.useLocalStorage;
const _t = window.t || function(s) { return s; };
const useThemeColors = window.useThemeColors;
const supabase = window._supabaseClient;
const fetchScenariosFromSupabase = window.fetchScenariosFromSupabase;
const saveScenarioToSupabase = window.saveScenarioToSupabase;
const deleteScenarioFromSupabase = window.deleteScenarioFromSupabase;
const writeAuditLog = window.writeAuditLog;
const fetchAuditLog = window.fetchAuditLog;
const fetchContactsFromSupabase = window.fetchContactsFromSupabase;
const fetchClaimableScenariosForBorrower   = window.fetchClaimableScenariosForBorrower;
const claimScenarioInSupabase              = window.claimScenarioInSupabase;
const fetchCoborrowerScenariosForBorrower  = window.fetchCoborrowerScenariosForBorrower;
const fetchTemplatesFromSupabase      = window.fetchTemplatesFromSupabase;
const patchContactInSupabase          = window.patchContactInSupabase;
const shareScenarioWithPartner        = window.shareScenarioWithPartner;
const shareScenarioByInvite           = window.shareScenarioByInvite;
const referScenarioToLO               = window.referScenarioToLO;
const fetchScenarioShares             = window.fetchScenarioShares;
const fetchSharedScenariosFromSupabase = window.fetchSharedScenariosFromSupabase;
const fetchPartnerProfiles            = window.fetchPartnerProfiles;
const AppHeader                       = window.AppHeader;
const saveTemplateToSupabase       = window.saveTemplateToSupabase;
const deleteTemplateFromSupabase   = window.deleteTemplateFromSupabase;
const setDefaultTemplateInSupabase = window.setDefaultTemplateInSupabase;

// ── Lead Group Helpers ─────────────────────────────────────────────────────
// Three dashboard tabs: Active (pre-pipeline + in-pipeline), Waiting, Archived.
// Grouping is derived from the lead_status string value — no separate column needed.

const LEAD_GROUPS = ["active", "waiting", "archived"];
const LEAD_GROUP_LABELS = { pre: "All", active: "Active", waiting: "Waiting", archived: "Archived" };

function getLeadGroup(leadStatus) {
  if (!leadStatus) return "active";
  if (leadStatus.startsWith("z")) return "archived";        // z- and zz- prefixes
  if (leadStatus.startsWith("Waiting") || leadStatus === ".Suspended") return "waiting";
  return "active";                                          // ?, (A)-(D), 01.-15.
}

function getLeadStatusColors(leadStatus) {
  if (!leadStatus)
    return { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };   // gray   – no status (not a lead)
  if (leadStatus === "?")
    return { bg: "rgba(139,92,246,0.15)",  text: "#7c3aed" };   // purple – identified lead, uncategorized
  if (leadStatus.startsWith("("))
    return { bg: "rgba(59,130,246,0.12)",  text: "#1d4ed8" };   // blue   – pre-pipeline
  if (leadStatus.startsWith("Waiting") || leadStatus === ".Suspended")
    return { bg: "rgba(245,158,11,0.12)",  text: "#b45309" };   // amber  – waiting / suspended
  if (leadStatus.startsWith("z"))
    return { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };   // gray   – archived
  return { bg: "rgba(34,197,94,0.12)",   text: "#16a34a" };     // green  – active pipeline
}

function getLoanPurposeLabel(purpose) {
  const LOAN_PURPOSES = window.LOAN_PURPOSES || [];
  const match = LOAN_PURPOSES.find(function(p) { return p.value === purpose; });
  return match ? match.label : (purpose || "");
}

// ── LeadStatusSelect – grouped <optgroup> dropdown ─────────────────────────
function LeadStatusSelect({ value, onChange, style }) {
  const LEAD_STATUSES = window.LEAD_STATUSES || [];
  const groups = [
    { label: "Lead",             key: "pre"      },
    { label: "Active Pipeline", key: "active"   },
    { label: "Waiting / Suspended", key: "waiting"  },
    { label: "Archived",        key: "archived" },
  ];
  return (
    <select value={value} onChange={onChange} style={style}>
      <option value="">None</option>
      {groups.map(function(g) {
        const opts = LEAD_STATUSES.filter(function(s) { return s.group === g.key; });
        if (opts.length === 0) return null;
        return (
          <optgroup key={g.key} label={g.label}>
            {opts.map(function(s) {
              return <option key={s.value} value={s.value}>{s.label}</option>;
            })}
          </optgroup>
        );
      })}
    </select>
  );
}

// ── Activity Report Page (standalone full-page view) ───────────────────────
function ActivityReportPage({ user, onBack }) {
  const f = "'Inter', system-ui, sans-serif";
  const [activityData,    setActivityData]    = React.useState(null);
  const [activityLoading, setActivityLoading] = React.useState(true);
  const [contactsMap,     setContactsMap]     = React.useState({});

  React.useEffect(function() {
    async function load() {
      setActivityLoading(true);
      try {
        var supabase = window._supabaseClient;
        if (!supabase) { setActivityData([]); setActivityLoading(false); return; }
        var since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        var { data: internalProfiles } = await supabase.from("profiles")
          .select("id").in("role", ["admin", "super_admin", "branch_admin", "internal"]);
        var internalIds = new Set((internalProfiles || []).map(function(p) { return p.id; }));

        var [{ data: logs }, { data: letters }, { data: shares }, { data: scenarios }, { data: contacts }] = await Promise.all([
          supabase.from("scenario_audit_log").select("scenario_id, user_id, action, created_at").gte("created_at", since).order("created_at", { ascending: false }),
          supabase.from("pq_letters").select("scenario_id, created_at, user_id").gte("created_at", since),
          supabase.from("pq_letter_shares").select("scenario_id, sent_at, user_id").gte("sent_at", since),
          supabase.from("scenarios").select("id, name, clientName, contact_id, created_at, loan_purpose"),
          supabase.from("contacts").select("id, first_name, last_name, company"),
        ]);

        var cMap = {};
        (contacts || []).forEach(function(c) { cMap[c.id] = c; });
        setContactsMap(cMap);

        var byScenario = {};
        (logs || []).filter(function(l) { return !internalIds.has(l.user_id); }).forEach(function(l) {
          if (!byScenario[l.scenario_id]) byScenario[l.scenario_id] = { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          var s = byScenario[l.scenario_id];
          if (l.action === "viewed") { s.views++; if (!s.lastSeen || l.created_at > s.lastSeen) s.lastSeen = l.created_at; }
          else { s.actions.push(l.action); if (!s.lastSeen || l.created_at > s.lastSeen) s.lastSeen = l.created_at; }
        });
        (letters || []).filter(function(l) { return !internalIds.has(l.user_id); }).forEach(function(l) {
          if (!byScenario[l.scenario_id]) byScenario[l.scenario_id] = { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          byScenario[l.scenario_id].letterCount++;
          if (!byScenario[l.scenario_id].lastSeen || l.created_at > byScenario[l.scenario_id].lastSeen) byScenario[l.scenario_id].lastSeen = l.created_at;
        });
        (shares || []).filter(function(l) { return !internalIds.has(l.user_id); }).forEach(function(l) {
          if (!byScenario[l.scenario_id]) byScenario[l.scenario_id] = { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          byScenario[l.scenario_id].shareCount++;
        });

        var rows = (scenarios || []).map(function(sc) {
          var d = byScenario[sc.id] || { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          return Object.assign({ scenario: sc }, d);
        }).filter(function(r) { return r.lastSeen; })
          .sort(function(a, b) { return (b.lastSeen || "").localeCompare(a.lastSeen || ""); });

        setActivityData(rows);
      } catch(e) { setActivityData([]); }
      setActivityLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: f }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, padding: 0, fontFamily: f }}>
            ← Back
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f" }}>Activity Report</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Client activity — last 30 days · sorted by most recently active</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
        {activityLoading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b", fontSize: 14 }}>Loading activity data…</div>
        ) : !activityData || activityData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: 14 }}>
            No activity found in the last 30 days. Activity is logged when clients open their scenarios or PQ letters are generated.
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {["Contact", "Scenario", "Last Seen", "Views (30d)", "PQ Letters", "PQ Sent", "Other Actions"].map(function(h) {
                    return <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {activityData.map(function(row, i) {
                  var sc = row.scenario;
                  var contact = sc.contact_id ? contactsMap[sc.contact_id] : null;
                  var contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : (sc.clientName || "—");
                  var lastSeen = row.lastSeen ? new Date(row.lastSeen) : null;
                  var now = new Date();
                  var diffMs = lastSeen ? now - lastSeen : null;
                  var diffLabel = diffMs == null ? "—"
                    : diffMs < 60*60*1000 ? "< 1 hour ago"
                    : diffMs < 24*60*60*1000 ? Math.floor(diffMs/3600000) + "h ago"
                    : diffMs < 7*24*60*60*1000 ? Math.floor(diffMs/86400000) + "d ago"
                    : lastSeen.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  var isHot = diffMs && diffMs < 3*24*60*60*1000;
                  var uniqueActions = [...new Set(row.actions)].filter(function(a) { return a !== "viewed"; });
                  return (
                    <tr key={sc.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e3a5f" }}>{contactName}</td>
                      <td style={{ padding: "10px 14px", color: "#374151" }}>{sc.clientName || sc.name || "—"}</td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: isHot ? 700 : 400, color: isHot ? "#dc2626" : "#374151" }}>
                          {isHot ? "🔥 " : ""}{diffLabel}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: row.views > 0 ? "#1e3a5f" : "#94a3b8" }}>
                        {row.views > 0 ? row.views : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: row.letterCount > 0 ? "#16a34a" : "#94a3b8", fontWeight: row.letterCount > 0 ? 700 : 400 }}>
                        {row.letterCount > 0 ? "✓ " + row.letterCount : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", color: row.shareCount > 0 ? "#2563eb" : "#94a3b8", fontWeight: row.shareCount > 0 ? 700 : 400 }}>
                        {row.shareCount > 0 ? "✓ " + row.shareCount : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>
                        {uniqueActions.length > 0 ? uniqueActions.slice(0, 3).join(", ") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
window.ActivityReportPage = ActivityReportPage;

// ── Main Component ─────────────────────────────────────────────────────────
function ScenarioDashboard({ user, onSelectScenario, onLogout, onContacts, onOpenContact, onUsers, onMyInfo, onLoginSettings, onSettings, pageTitle,
  groupFilter: groupFilterProp, setGroupFilter: setGroupFilterProp }) {
  const c = useThemeColors();
  const isTaskView = pageTitle === "Tasks: Scenarios"; // tasks view hides/adds specific columns
  const [darkMode, setDarkMode] = useLocalStorage("app_dark", false);
  // Read app_lang directly — useLocalStorage adds mtk_ prefix which mismatches the key
  var _sdRawLang = "en";
  try { var _sdRl = localStorage.getItem("app_lang"); if (_sdRl) { try { _sdRawLang = JSON.parse(_sdRl); } catch(e) { _sdRawLang = _sdRl; } } } catch(e) {}
  const [appLang] = useState(_sdRawLang);
  // Read lang directly from localStorage (bypasses JSON.parse which breaks plain strings)
  const t = function(str) {
    var lang = "en";
    try { var _raw = localStorage.getItem("app_lang"); if (_raw) { try { lang = JSON.parse(_raw); } catch(e2) { lang = _raw; } } } catch(e) {}
    if (lang !== "es") return str;
    var tr = window.TRANSLATIONS_ES;
    return (tr && tr[str]) ? tr[str] : str;
  };
  const [scenarios, setScenarios] = useLocalStorage("scenarios", []);
  // Keep window ref in sync so _openActivityReport can access latest scenarios
  React.useEffect(function() { window._sdScenarios = scenarios; }, [scenarios]);
  const [groupFilterInternal, setGroupFilterInternal] = useState("pre");
  // Use controlled value from App.js sidebar if provided, otherwise internal state
  const groupFilter    = groupFilterProp    !== undefined ? groupFilterProp    : groupFilterInternal;
  const setGroupFilter = setGroupFilterProp !== undefined ? setGroupFilterProp : setGroupFilterInternal;
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [showActivityReport, setShowActivityReport] = useState(false);
  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);

  // Expose opener so App.js sidebar can trigger it
  React.useEffect(function() {
    window._openActivityReport = async function() {
      setShowActivityReport(true);
      setActivityLoading(true);
      try {
        var supabase = window._supabaseClient;
        if (!supabase) return;
        var since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        // Fetch internal/admin user IDs to exclude their activity from the report
        var { data: internalProfiles } = await supabase.from("profiles")
          .select("id").in("role", ["admin", "super_admin", "branch_admin", "internal"]);
        var internalIds = new Set((internalProfiles || []).map(function(p) { return p.id; }));
        var { data: logs }    = await supabase.from("scenario_audit_log").select("scenario_id, user_id, action, note, created_at").gte("created_at", since).order("created_at", { ascending: false });
        var { data: letters } = await supabase.from("pq_letters").select("scenario_id, created_at, user_id").gte("created_at", since).order("created_at", { ascending: false });
        var { data: shares }  = await supabase.from("pq_letter_shares").select("scenario_id, realtor_name, sent_at, user_id").gte("sent_at", since).order("sent_at", { ascending: false });
        var byScenario = {};
        // Only count activity from non-internal users (clients, realtors, builders)
        (logs || []).filter(function(l) { return !internalIds.has(l.user_id); }).forEach(function(l) {
          if (!byScenario[l.scenario_id]) byScenario[l.scenario_id] = { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          var s = byScenario[l.scenario_id];
          if (l.action === "viewed") { s.views++; if (!s.lastSeen || l.created_at > s.lastSeen) s.lastSeen = l.created_at; }
          else { s.actions.push(l.action); if (!s.lastSeen || l.created_at > s.lastSeen) s.lastSeen = l.created_at; }
        });
        // Letters generated by clients count; generated by LO are not "client activity"
        (letters || []).filter(function(l) { return !internalIds.has(l.user_id); }).forEach(function(l) {
          if (!byScenario[l.scenario_id]) byScenario[l.scenario_id] = { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          byScenario[l.scenario_id].letterCount++;
          if (!byScenario[l.scenario_id].lastSeen || l.created_at > byScenario[l.scenario_id].lastSeen) byScenario[l.scenario_id].lastSeen = l.created_at;
        });
        // Shares sent by LO don't count; only client-initiated shares
        (shares || []).filter(function(l) { return !internalIds.has(l.user_id); }).forEach(function(l) {
          if (!byScenario[l.scenario_id]) byScenario[l.scenario_id] = { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          byScenario[l.scenario_id].shareCount++;
        });
        var scenariosCopy = window._sdScenarios || [];
        var rows = scenariosCopy.map(function(sc) {
          var d = byScenario[sc.id] || { views: 0, lastSeen: null, actions: [], letterCount: 0, shareCount: 0 };
          return Object.assign({ scenario: sc }, d);
        }).filter(function(r) { return r.lastSeen; })
          .sort(function(a, b) { return (b.lastSeen || "").localeCompare(a.lastSeen || ""); });
        setActivityData(rows);
      } catch(e) { setActivityData([]); }
      setActivityLoading(false);
    };
    return function() { window._openActivityReport = null; };
  }, []);

  // New scenario form fields
  const [newUid, setNewUid] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newLeadStatus, setNewLeadStatus] = useState("");
  const [newLoanPurpose, setNewLoanPurpose] = useState("purchase");
  const [newPropertyAddress, setNewPropertyAddress] = useState("");
  const [newLeadSource, setNewLeadSource] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [contactOptions, setContactOptions] = useState([]);
  const [showInlineNewContact, setShowInlineNewContact] = useState(false);
  const [inlineFirstName, setInlineFirstName] = useState("");
  const [inlineLastName, setInlineLastName] = useState("");
  const [inlineEmail, setInlineEmail] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [savingInlineContact, setSavingInlineContact] = useState(false);
  const [newReferralContactId, setNewReferralContactId] = useState("");
  const [showInlineReferralContact, setShowInlineReferralContact] = useState(false);
  const [inlineRefFirstName, setInlineRefFirstName] = useState("");
  const [inlineRefLastName, setInlineRefLastName] = useState("");
  const [inlineRefEmail, setInlineRefEmail] = useState("");
  const [inlineRefPhone, setInlineRefPhone] = useState("");
  const [savingInlineReferralContact, setSavingInlineReferralContact] = useState(false);

  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  // ── Bulk selection ──────────────────────────────────────────────────
  const [selectedIds,   setSelectedIds]   = useState([]);  // scenario IDs
  const [bulkFields,    setBulkFields]    = useState({ lead_status: "", fu_date: "", fu_who: "", fu_priority: "" });
  const [bulkApplying,  setBulkApplying]  = useState(false);
  const [bulkDeleting,  setBulkDeleting]  = useState(false);
  const [bulkResult,    setBulkResult]    = useState(null); // null | { ok, failed }

  // ── Column visibility + widths ────────────────────────────────────────────
  const SD_COL_DEFS = [
    { id: "contact",     label: "Contact",     defaultW: 150 },
    { id: "scenario",    label: "Scenario",    defaultW: 160 },
    { id: "lead_status", label: "Lead Status", defaultW: 130 },
    { id: "purpose",     label: "Purpose",     defaultW: 90  },
    { id: "fu_date",     label: "FU Next",     defaultW: 75  },
    { id: "fu_who",      label: "FU Who",      defaultW: 80  },
    { id: "fu_priority", label: "FU Priority", defaultW: 90  },
    { id: "note_quick",  label: "Quick Notes", defaultW: 150 },
    { id: "createdAt",   label: "Created",     defaultW: 75  },
    { id: "creator",     label: "Creator",     defaultW: 110 },
  ];
  const [sdColHidden,  setSdColHidden]  = useLocalStorage("sd_col_hidden",  []);
  const [sdColWidths,  setSdColWidths]  = useLocalStorage("sd_col_widths",  {});
  const [showColPicker, setShowColPicker] = useState(false);
  const sdResizeRef = React.useRef(null);
  function sdColVisible(id)  { return !sdColHidden.includes(id); }
  function sdColW(id, def)   { return sdColWidths[id] || def; }
  function sdStartResize(e, colId, defaultW) {
    e.preventDefault();
    var startX = e.clientX, startW = sdColW(colId, defaultW);
    function onMove(ev) {
      var w = Math.max(50, startW + ev.clientX - startX);
      setSdColWidths(function(prev) { return Object.assign({}, prev, { [colId]: w }); });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [filterLeadStatus, setFilterLeadStatus] = useState(""); // "" | "pre" | "active" | "waiting" | "archived"
  const [filterPurpose,    setFilterPurpose]    = useState(""); // "" | "purchase" | "refi"
  const [filterFuPriority, setFilterFuPriority] = useState(""); // "" | "High" | "Medium" | "Low"
  const [filterFuDate,     setFilterFuDate]     = useState(""); // "" | "overdue" | "today" | "this_week" | "this_month" | "none"
  const [filterFuWho,      setFilterFuWho]      = useState(""); // "" | any fu_who value | "_none"
  const [closingFilter,    setClosingFilter]    = useState(false);
  const [pipelineSubFilter, setPipelineSubFilter] = useState(null); // null | "pre" | "pipeline"
  const [cloudLoading, setCloudLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloudError, setCloudError] = useState(null);
  const [openMenuId,       setOpenMenuId]       = useState(null);
  const [menuPos,          setMenuPos]          = useState(null); // {top, right} in viewport px for fixed positioning
  const [noteModalScenario, setNoteModalScenario] = useState(null); // scenario for quick-note modal
  const [noteText,          setNoteText]          = useState("");
  const [noteSaving,        setNoteSaving]        = useState(false);
  const [noteSaved,         setNoteSaved]         = useState(false);
  useEffect(function() {
    if (!openMenuId) return;
    function closeMenu() { setOpenMenuId(null); setMenuPos(null); }
    document.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true); // capture scroll anywhere
    return function() {
      document.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [openMenuId]);

  const [auditLogOpen, setAuditLogOpen] = useState(null);
  const [auditLogData, setAuditLogData] = useState([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [pendingPartnerInvites, setPendingPartnerInvites] = useState([]);
  const [partnerResponding,    setPartnerResponding]    = useState(null); // id being acted on
  const [claimable, setClaimable] = useState([]);
  const [claiming, setClaiming] = useState(false);
  const [coborrowerScenarios, setCoborrowerScenarios] = useState([]);
  const [liveInvite, setLiveInvite] = useState(null); // { scenario, loName }
  const [borrowerContactId, setBorrowerContactId] = useState(user.newContactId || null); // own contact ID, for auto-linking
  const [editDetailsOpen,   setEditDetailsOpen]   = useState(null);
  const [editDetailsForm,   setEditDetailsForm]   = useState({});
  const [editDetailsSaving, setEditDetailsSaving] = useState(false);
  const [contactsMap,       setContactsMap]       = useState({});

  // ── Sharing / Referral state ──────────────────────────────────────────────
  const isPartner = user && (user.role === "realtor" || user.role === "builder");
  const [sharedWithMe,      setSharedWithMe]      = useState([]);   // scenarios shared TO this partner
  const [sharedWithMeTab,   setSharedWithMeTab]   = useState(false); // toggle between My Pipeline / Shared With Me
  const [referringId,       setReferringId]       = useState(null); // scenario being referred
  const [referNote,         setReferNote]         = useState("");
  const [referSaving,       setReferSaving]       = useState(false);
  const [referredIds,       setReferredIds]       = useState(new Set()); // scenario IDs already referred
  // LO: share modal state
  const [shareModalScenario, setShareModalScenario] = useState(null);
  const [partnerProfiles,    setPartnerProfiles]    = useState([]);
  const [sharePartnerId,     setSharePartnerId]     = useState("");
  const [sharePermission,    setSharePermission]    = useState("view");
  const [shareNote,          setShareNote]          = useState("");
  const [shareSaving,        setShareSaving]        = useState(false);
  const [shareMode,          setShareMode]          = useState("existing"); // "existing" | "invite"
  const [shareBrokerage,     setShareBrokerage]     = useState(""); // brokerage name for team-share
  const [brokerageShareResult, setBrokerageShareResult] = useState(null); // { ok, failed } after team share
  const [shareInviteEmail,   setShareInviteEmail]   = useState("");
  const [shareInviteRole,    setShareInviteRole]    = useState("realtor");
  const [shareInviteDone,    setShareInviteDone]    = useState(null); // copy-paste snippet after invite
  // Per-scenario share counts (LO view): { [scenarioId]: number }
  const [shareCountsMap,     setShareCountsMap]     = useState({});
  // Referred badge set: scenario IDs that were referred TO this LO
  const [referralScenarioIds, setReferralScenarioIds] = useState(new Set());

  // ── Template state ──────────────────────────────────────────────────────
  const [templates,           setTemplates]           = useState([]);
  const [defaultTemplateId,   setDefaultTemplateId]   = useState(null);
  const [newTemplateId,       setNewTemplateId]       = useState("");
  const [saveTemplateModal,      setSaveTemplateModal]      = useState(null);  // { scenarioId, calculatorData, loanPurpose }
  const [saveTemplateName,       setSaveTemplateName]       = useState("");
  const [saveTemplateDesc,       setSaveTemplateDesc]       = useState("");
  const [saveTemplateIsGlobal,   setSaveTemplateIsGlobal]   = useState(false);
  const [saveTemplateOverwriteId,setSaveTemplateOverwriteId]= useState("");   // "" = create new; uuid = overwrite that template
  const [savingTemplate,         setSavingTemplate]         = useState(false);
  const [showManageTemplates,    setShowManageTemplates]    = useState(false);
  const [deletingTemplateId,     setDeletingTemplateId]     = useState(null);
  const [settingDefaultId,       setSettingDefaultId]       = useState(null);
  const [tplSearch,              setTplSearch]              = useState("");
  const [tplPurposeFilter,       setTplPurposeFilter]       = useState("all");
  const [tplScopeFilter,         setTplScopeFilter]         = useState("all");
  const [tplSortCol,             setTplSortCol]             = useState("name");
  const [tplSortDir,             setTplSortDir]             = useState("asc");
  const [profileMenuOpen,        setProfileMenuOpen]        = useState(false);

  const isCloudUser = !!(user && user.supabaseUser && supabase);
  // Roles that must link scenarios to a contact (internal, realtor, builder)
  const requiresContact = isCloudUser && (user.isInternal || user.role === "realtor" || user.role === "builder");
  const roster = JSON.parse(localStorage.getItem("mtk_roster") || "[]");
  const currentMember = roster.find(m => m.id === user.id);
  const displayName = currentMember ? currentMember.name : (user.name || "Team Member");

  // ── Map a Supabase row → local scenario shape ──────────────────────────
  function mapFromCloud(row) {
    return {
      id:              row.id,
      uid:             row.scenario_id || (row.calculation_data || {}).uid || "",
      clientName:      row.name || "Untitled",
      notes:           row.notes || "",
      createdBy:       row.user_id,
      createdByName:   row._owner_name || displayName,
      createdAt:       row.created_at,
      updatedAt:       row.updated_at,
      status:          row.status       || "active",
      lead_status:     row.lead_status  || "",
      loan_purpose:    row.loan_purpose || "purchase",
      property_address:  row.property_address  || "",
      lead_source:       row.lead_source      || "",
      target_close_date: row.target_close_date || null,
      actual_close_date: row.actual_close_date || null,
      contact_id:             row.contact_id             || null,
      co_borrower_contact_id: row.co_borrower_contact_id || null,
      lockLevel:              row.lock_level             || "none",
      lockedBy:        row.locked_by    || null,
      lockedAt:        row.locked_at    || null,
      calculatorData:  row.calculation_data || {},
      lmt_deal_id:     row.lmt_deal_id  || null,
      _cloud: true,
    };
  }

  // ── Cloud fetch on mount ───────────────────────────────────────────────
  useEffect(function() {
    if (!isCloudUser) return;
    let cancelled = false;
    setScenarios([]);  // wipe cache — never show another user's data
    setCloudLoading(true);
    fetchScenariosFromSupabase()
      .then(function(result) {
        if (cancelled) return;
        if (result.error) {
          console.warn("Cloud scenario fetch error:", result.error);
          setCloudError("Could not load scenarios from cloud. Showing cached data.");
        } else {
          setScenarios(result.data.map(mapFromCloud));
          setCloudError(null);
        }
      })
      .catch(function(err) {
        if (cancelled) return;
        console.warn("Cloud scenario fetch exception:", err);
        setCloudError("Could not load scenarios from cloud. Showing cached data.");
      })
      .finally(function() {
        if (!cancelled) setCloudLoading(false);
      });
    return function() { cancelled = true; };
  }, []);

  // ── Deep-link: auto-open scenario from URL (/scenarios/:id) ─────────────
  useEffect(function() {
    if (!isCloudUser || !onSelectScenario || !supabase) return;
    var pendingId = null;
    try { pendingId = sessionStorage.getItem("mtk_pending_scenario_id"); } catch(e) {}
    if (!pendingId) return;
    try { sessionStorage.removeItem("mtk_pending_scenario_id"); } catch(e) {}
    supabase.from("scenarios").select("*").eq("id", pendingId).single()
      .then(function(res) {
        if (res.error || !res.data) return;
        var row = res.data;
        var calcData = (row.calculation_data && typeof row.calculation_data === "object") ? row.calculation_data : {};
        onSelectScenario({
          id: row.id, name: row.name || "Untitled",
          notes: row.notes || "", loan_purpose: row.loan_purpose || "purchase",
          property_address: row.property_address || "",
          calculatorData: calcData, status: row.status || "active",
          contact_id: row.contact_id || null,
        });
      })
      .catch(function() {});
  }, [isCloudUser]);

  // ── Partner invite fetch (Realtor / Builder) ──────────────────────────
  useEffect(function() {
    if (!isCloudUser || (user.role !== "realtor" && user.role !== "builder")) return;
    var fn = window.fetchPendingPartnershipInvites;
    if (!fn) return;
    fn().then(function(res) {
      if (!res.error) setPendingPartnerInvites(res.data || []);
    });
  }, [isCloudUser, user.role]);

  // ── Borrower claimable fetch ───────────────────────────────────────────
  useEffect(function() {
    if (!isCloudUser || user.role !== "borrower") return;
    let cancelled = false;
    fetchClaimableScenariosForBorrower().then(function({ data, error }) {
      if (cancelled || error) return;
      setClaimable(data || []);
    });
    return function() { cancelled = true; };
  }, []);

  // ── Borrower co-borrower fetch ────────────────────────────────────────────
  useEffect(function() {
    if (!isCloudUser || user.role !== "borrower") return;
    let cancelled = false;
    fetchCoborrowerScenariosForBorrower().then(function({ data, error }) {
      if (cancelled || error) return;
      setCoborrowerScenarios(data || []);
    });
    return function() { cancelled = true; };
  }, []);

  // ── Partner: fetch scenarios shared WITH me ───────────────────────────────
  useEffect(function() {
    if (!isCloudUser || !isPartner) return;
    let cancelled = false;
    fetchSharedScenariosFromSupabase().then(function({ data, error }) {
      if (cancelled || error) return;
      setSharedWithMe((data || []).map(function(raw) {
        const mapped = mapFromCloud(raw);
        return { ...mapped, _share: raw._share || null, _shared_by_name: raw._shared_by_name || "" };
      }));
    });
    return function() { cancelled = true; };
  }, []);

  // ── Partner: load already-referred scenario IDs so button shows "Referred" state ──
  useEffect(function() {
    if (!isCloudUser || !isPartner || !supabase) return;
    let cancelled = false;
    supabase
      .from("scenario_shares")
      .select("scenario_id")
      .eq("share_type", "referral")
      .then(function({ data, error }) {
        if (cancelled || error) return;
        setReferredIds(new Set((data || []).map(function(r) { return r.scenario_id; })));
      });
    return function() { cancelled = true; };
  }, []);

  // ── LO: fetch partner profiles for share modal ────────────────────────────
  useEffect(function() {
    if (!isCloudUser || !user.isInternal) return;
    let cancelled = false;
    fetchPartnerProfiles().then(function({ data }) {
      if (cancelled) return;
      setPartnerProfiles(data || []);
    });
    return function() { cancelled = true; };
  }, []);

  // ── LO: fetch referral scenario IDs (scenarios referred to the team) ──────
  useEffect(function() {
    if (!isCloudUser || !user.isInternal || !supabase) return;
    let cancelled = false;
    supabase
      .from("scenario_shares")
      .select("scenario_id")
      .eq("share_type", "referral")
      .then(function({ data, error }) {
        if (cancelled || error) return;
        setReferralScenarioIds(new Set((data || []).map(function(r) { return r.scenario_id; })));
      });
    return function() { cancelled = true; };
  }, []);

  // ── Live-session invite listener (borrower only) ──────────────────────────
  // Subscribes to invite_scenario_{id} for each loaded scenario.
  // When LO broadcasts a live_invite event, shows the join banner.
  useEffect(function() {
    if (!isCloudUser || user.role !== "borrower" || !supabase || scenarios.length === 0) return;
    var channels = scenarios.filter(function(s) { return !!s.id; }).map(function(s) {
      var ch = supabase.channel("invite_scenario_" + s.id, { config: { broadcast: { self: false } } });
      ch.on("broadcast", { event: "live_invite" }, function(msg) {
        var payload = (msg && msg.payload) ? msg.payload : {};
        setLiveInvite({ scenario: s, loName: payload.loName || "Your Loan Officer" });
      });
      ch.subscribe();
      return ch;
    });
    return function() {
      channels.forEach(function(ch) { try { supabase.removeChannel(ch); } catch {} });
    };
  }, [isCloudUser, user.role, scenarios.length]);

  // ── Contact fetch on mount — populates table map + new form picker ──
  useEffect(function() {
    if (!requiresContact) return;
    let cancelled = false;
    fetchContactsFromSupabase().then(function({ data, error }) {
      if (cancelled || error) return;
      const opts = data || [];
      setContactOptions(opts);
      const map = {};
      opts.forEach(function(ct) { map[ct.id] = ct; });
      setContactsMap(map);
    });
    return function() { cancelled = true; };
  }, []);

  // ── Borrower contact-ID fetch — auto-links own scenarios to contact record ──
  // On mount, fetches the borrower's own contact row (RLS scopes to their record only).
  // Then backfills any existing scenarios that have no contact_id yet.
  useEffect(function() {
    if (!isCloudUser || user.role !== "borrower" || !supabase) return;
    let cancelled = false;
    async function ensureBorrowerContact() {
      // 1. Try to find existing contact (RLS scopes to their email)
      var { data, error } = await supabase.from("contacts").select("id").limit(1);
      var cid = (!error && data && data.length > 0) ? data[0].id : null;
      // 2. If not found, create one from their profile
      if (!cid) {
        var nameParts = (user.name || "").trim().split(/\s+/);
        var { data: newContact } = await supabase.from("contacts").insert({
          first_name:     nameParts[0] || "",
          last_name:      nameParts.slice(1).join(" ") || "",
          email:          (user.email || "").toLowerCase(),
          email_personal: (user.email || "").toLowerCase(),
          contact_type:   "client",
          contact_category: "Client",
          status:         "active",
          tags:           [],
          source:         "self-signup",
          notes:          "",
        }).select("id").single();
        if (newContact) cid = newContact.id;
      }
      if (!cid || cancelled) return;
      setBorrowerContactId(cid);
      // 3. Backfill: link any existing scenarios that are missing a contact_id
      supabase.from("scenarios")
        .update({ contact_id: cid })
        .is("contact_id", null)
        .then(function({ error: upErr }) {
          if (upErr) console.warn("Borrower contact backfill failed:", upErr.message);
        });
    }
    ensureBorrowerContact();
    return function() { cancelled = true; };
  }, []);

  // ── Template fetch on mount (internal only) ────────────────────────────
  useEffect(function() {
    if (!isCloudUser || !user.isInternal) return;
    let cancelled = false;
    fetchTemplatesFromSupabase().then(function({ data, error }) {
      if (cancelled || error) return;
      setTemplates(data || []);
    });
    supabase
      .from("profiles")
      .select("default_template_id")
      .eq("id", user.supabaseUser.id)
      .single()
      .then(function({ data }) {
        if (!cancelled && data) setDefaultTemplateId(data.default_template_id || null);
      });
    return function() { cancelled = true; };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────
  function generateScenarioId() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = yy + mm + dd + "-";
    let maxSeq = 0;
    scenarios.forEach(function(s) {
      const uid = s.uid || "";
      if (uid.startsWith(prefix)) {
        const seq = parseInt(uid.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    return prefix + String(maxSeq + 1).padStart(4, "0");
  }

  function openNewForm() {
    setNewUid(generateScenarioId());
    setNewClientName("");
    setNewTemplateId(defaultTemplateId || "");
    setShowNewForm(true);
  }

  function resetNewForm() {
    setNewUid("");
    setNewClientName("");
    setNewNotes("");
    setNewLeadStatus("");
    setNewLoanPurpose("purchase");
    setNewPropertyAddress("");
    setNewLeadSource("");
    setNewContactId("");
    setNewReferralContactId("");
    setNewTemplateId("");
    setContactOptions([]);
    setShowInlineNewContact(false);
    setInlineFirstName(""); setInlineLastName(""); setInlineEmail(""); setInlinePhone("");
    setShowInlineReferralContact(false);
    setInlineRefFirstName(""); setInlineRefLastName(""); setInlineRefEmail(""); setInlineRefPhone("");
    setShowNewForm(false);
  }

  async function saveInlineContact() {
    if (!inlineFirstName.trim() && !inlineLastName.trim()) {
      alert("Please enter at least a first or last name.");
      return;
    }
    setSavingInlineContact(true);
    try {
      const { data, error } = await saveContactToSupabase({
        first_name: inlineFirstName.trim() || null,
        last_name:  inlineLastName.trim()  || null,
        email_personal: inlineEmail.trim() || null,
        phone_cell: inlinePhone.trim()     || null,
        contact_type: "client",
        contact_category: "Client",
        status: "active",
      });
      if (error) { alert("Could not create contact: " + error.message); return; }
      const newContact = data;
      setContactOptions(function(prev) { return [newContact, ...prev]; });
      const map = {};
      [newContact, ...contactOptions].forEach(function(ct) { map[ct.id] = ct; });
      setContactsMap(map);
      setNewContactId(newContact.id);
      setShowInlineNewContact(false);
      setInlineFirstName(""); setInlineLastName(""); setInlineEmail(""); setInlinePhone("");
    } catch (err) {
      alert("Could not create contact: " + err.message);
    } finally { setSavingInlineContact(false); }
  }

  async function saveInlineReferralContact() {
    if (!inlineRefFirstName.trim() && !inlineRefLastName.trim()) {
      alert("Please enter at least a first or last name.");
      return;
    }
    setSavingInlineReferralContact(true);
    try {
      const { data, error } = await saveContactToSupabase({
        first_name: inlineRefFirstName.trim() || null,
        last_name:  inlineRefLastName.trim()  || null,
        email_personal: inlineRefEmail.trim() || null,
        phone_cell: inlineRefPhone.trim()     || null,
        contact_type: "client",
        status: "active",
      });
      if (error) { alert("Could not create contact: " + error.message); return; }
      const newContact = data;
      setContactOptions(function(prev) { return [newContact, ...prev]; });
      const map = {};
      [newContact, ...contactOptions].forEach(function(ct) { map[ct.id] = ct; });
      setContactsMap(map);
      setNewReferralContactId(newContact.id);
      setShowInlineReferralContact(false);
      setInlineRefFirstName(""); setInlineRefLastName(""); setInlineRefEmail(""); setInlineRefPhone("");
    } catch (err) {
      alert("Could not create contact: " + err.message);
    } finally { setSavingInlineReferralContact(false); }
  }

  // Extract "Last, First" from a scenario's saved About tab data.
  function getClientLabel(scenario) {
    const data = scenario.calculatorData || {};
    function parse(v) {
      if (v === null || v === undefined) return "";
      try { return JSON.parse(v) || ""; } catch { return String(v) || ""; }
    }
    const fn = parse(data["abt_c1fn"]);
    const ln = parse(data["abt_c1ln"]);
    if (ln && fn) return ln + ", " + fn;
    if (fn) return fn;
    if (ln) return ln;
    const name = (scenario.createdByName || "").trim();
    if (name) {
      const parts = name.split(/\s+/);
      if (parts.length >= 2) return parts[parts.length - 1] + ", " + parts[0];
      return name;
    }
    return "";
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
  }

  function formatTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  // Formats a YYYY-MM-DD date string without UTC offset issues
  function formatDateOnly(dateStr) {
    if (!dateStr) return "";
    const parts = (dateStr + "").split("-");
    if (parts.length < 3) return dateStr;
    const m = parts[1].padStart(2, "0");
    const d = parts[2].padStart(2, "0");
    return m + "/" + d;
  }

  // ── CRUD actions ───────────────────────────────────────────────────────
  async function createScenario() {
    if (!newClientName.trim() || saving) return;
    if (requiresContact && !newContactId) {
      alert("Please link this scenario to a contact before creating it.");
      return;
    }
    // For borrowers: we'll resolve their contact below — if it fails we'll abort there
    // Seed calculationData from selected template (if any)
    const selectedTemplate = templates.find(function(t) { return t.id === newTemplateId; });
    const templateCalcData = selectedTemplate ? (selectedTemplate.calculation_data || {}) : {};

    let createdScenario = null;
    if (isCloudUser) {
      setSaving(true);
      // For borrowers: if contact ID isn't cached yet, fetch or create it now
      let resolvedBorrowerContactId = borrowerContactId;
      if (!user.isInternal && !resolvedBorrowerContactId && supabase) {
        try {
          const { data: ctData } = await supabase.from("contacts").select("id").limit(1);
          if (ctData && ctData.length > 0) {
            resolvedBorrowerContactId = ctData[0].id;
          } else {
            const nameParts = (user.name || "").trim().split(/\s+/);
            const { data: newCt } = await supabase.from("contacts").insert({
              first_name:     nameParts[0] || "",
              last_name:      nameParts.slice(1).join(" ") || "",
              email:          (user.email || "").toLowerCase(),
              email_personal: (user.email || "").toLowerCase(),
              contact_type:   "client",
              contact_category: "Client",
              status:         "active",
              tags:           [],
              source:         "self-signup",
              notes:          "",
            }).select("id").single();
            if (newCt) resolvedBorrowerContactId = newCt.id;
          }
          if (resolvedBorrowerContactId) setBorrowerContactId(resolvedBorrowerContactId);
        } catch (_) {}
        // Borrowers must have a contact to link the scenario to
        if (!user.isInternal && !resolvedBorrowerContactId) {
          alert("Could not link scenario to your contact record. Please try again.");
          setSaving(false);
          return;
        }
      }
      try {
        const finalContactId = requiresContact ? (newContactId || null) : (resolvedBorrowerContactId || null);
        if (!finalContactId) {
          alert("Please link this scenario to a contact before creating it.");
          setSaving(false);
          return;
        }
        const { data, error } = await saveScenarioToSupabase({
          uid:              newUid,
          name:             newClientName.trim(),
          notes:            "",
          calculationData:  { ...templateCalcData, uid: newUid },
          contact_id:       finalContactId,
          lead_status:      "",
          loan_purpose:     newLoanPurpose,
          property_address: null,
          lead_source:      null,
        });
        if (error) { alert("Could not save scenario: " + error.message); return; }
        createdScenario = mapFromCloud(data);
        setScenarios(prev => [createdScenario, ...prev]);
        writeAuditLog(data.id, "created", {}, newClientName.trim());
      } catch (err) {
        alert("Could not save scenario: " + err.message);
        return;
      } finally { setSaving(false); }
    } else {
      // Local-only fallback
      const now = new Date().toISOString();
      createdScenario = {
        id:               "s" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        uid:              newUid,
        clientName:       newClientName.trim(),
        notes:            newNotes.trim(),
        createdBy:        user.id,
        createdByName:    displayName,
        createdAt:        now,
        updatedAt:        now,
        status:           "active",
        lead_status:      "",
        loan_purpose:     newLoanPurpose,
        property_address: "",
        calculatorData:   { ...templateCalcData, uid: newUid },
      };
      setScenarios(prev => [createdScenario, ...prev]);
    }
    resetNewForm();
    if (createdScenario) {
      // Always land on Payment Calculator when opening a brand-new scenario
      localStorage.setItem("mtk_app_mod", JSON.stringify("payment"));
      onSelectScenario(createdScenario);
    }
  }

  async function claimScenario(scenarioId) {
    if (claiming) return;
    setClaiming(true);
    try {
      const { data, error } = await claimScenarioInSupabase(scenarioId);
      if (error) { alert("Could not claim scenario: " + error.message); return; }
      setClaimable(prev => prev.filter(s => s.id !== scenarioId));
      setScenarios(prev => [mapFromCloud(data), ...prev]);
      writeAuditLog(data.id, "claimed", {}, data.name);
    } catch (err) {
      alert("Could not claim scenario: " + err.message);
    } finally { setClaiming(false); }
  }

  async function changeLeadStatus(scenario, newStatus) {
    if (newStatus === (scenario.lead_status || "")) return;
    if (isCloudUser) {
      const { error } = await supabase
        .from("scenarios")
        .update({ lead_status: newStatus || null })
        .eq("id", scenario.id);
      if (error) { alert("Could not update lead status: " + error.message); return; }
      writeAuditLog(
        scenario.id, "lead_status_changed",
        { old: scenario.lead_status || "", new: newStatus },
        scenario.clientName
      );
    }
    setScenarios(prev => prev.map(s =>
      s.id === scenario.id
        ? { ...s, lead_status: newStatus, updatedAt: new Date().toISOString() }
        : s
    ));
  }

  async function toggleAuditLog(scenarioId) {
    if (auditLogOpen === scenarioId) {
      setAuditLogOpen(null);
      setAuditLogData([]);
      return;
    }
    setAuditLogOpen(scenarioId);
    setAuditLogLoading(true);
    try {
      const { data } = await fetchAuditLog(scenarioId);
      const userIds = [...new Set(data.map(e => e.user_id))];
      const { data: profiles } = await supabase
        .from("profiles").select("id, display_name").in("id", userIds);
      const nameMap = {};
      if (profiles) profiles.forEach(p => { nameMap[p.id] = p.display_name; });
      setAuditLogData(data.map(e => ({ ...e, _user_name: nameMap[e.user_id] || "Unknown" })));
    } catch (err) {
      console.warn("Audit log fetch error:", err);
      setAuditLogData([]);
    } finally { setAuditLogLoading(false); }
  }

  async function deleteScenario(id) {
    if (!confirm("Delete this scenario? This cannot be undone.")) return;
    const scenarioName = scenarios.find(s => s.id === id)?.clientName || "";
    if (isCloudUser) {
      writeAuditLog(id, "deleted", {}, scenarioName);
      const { error, deletedCount } = await deleteScenarioFromSupabase(id);
      if (error) { alert("Could not delete scenario: " + error.message); return; }
      if (deletedCount === 0) {
        alert("Could not delete scenario \u2014 permission denied. Ask your admin to deploy supabase-admin-delete-scenarios.sql.");
        return;
      }
    }
    setScenarios(prev => prev.filter(s => s.id !== id));
  }

  async function bulkDeleteScenarios() {
    if (selectedIds.length === 0) return;
    if (!confirm("Permanently delete " + selectedIds.length + " scenario" + (selectedIds.length === 1 ? "" : "s") + "? This cannot be undone.")) return;
    setBulkDeleting(true);
    try {
      let deleted = 0;
      for (const id of selectedIds) {
        const { error, deletedCount } = await deleteScenarioFromSupabase(id);
        if (!error && deletedCount > 0) deleted++;
      }
      setScenarios(function(prev) { return prev.filter(function(s) { return !selectedIds.includes(s.id); }); });
      setSelectedIds([]);
      setBulkResult({ okScenarios: deleted, failed: selectedIds.length - deleted, hasFuFields: false, okContacts: 0, skippedNoContact: 0 });
    } catch (err) {
      alert("Bulk delete failed: " + err.message);
    } finally { setBulkDeleting(false); }
  }

  async function duplicateScenario(scenario) {
    if (isCloudUser) {
      setSaving(true);
      try {
        const { data, error } = await saveScenarioToSupabase({
          name:             (scenario.clientName || "Untitled") + " (Copy)",
          notes:            scenario.notes || "",
          calculationData:  { ...(scenario.calculatorData || scenario.calculation_data || {}), uid: generateScenarioId() },
          contact_id:       scenario.contact_id || null,
          lead_status:      scenario.lead_status || "",
          loan_purpose:     scenario.loan_purpose || "purchase",
          property_address: scenario.property_address || null,
        });
        if (error) { alert("Could not duplicate scenario: " + error.message); return; }
        setScenarios(prev => [mapFromCloud(data), ...prev]);
        writeAuditLog(data.id, "duplicated", { source: { old: null, new: scenario.id } },
          scenario.clientName + " \u2192 Copy");
      } catch (err) {
        alert("Could not duplicate scenario: " + err.message);
        return;
      } finally { setSaving(false); }
    } else {
      const now = new Date().toISOString();
      const copy = {
        ...scenario,
        id:           "s" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        uid:          generateScenarioId(),
        clientName:   scenario.clientName + " (Copy)",
        createdBy:    user.id,
        createdByName: displayName,
        createdAt:    now,
        updatedAt:    now,
        calculatorData: { ...scenario.calculatorData },
      };
      setScenarios(prev => [copy, ...prev]);
    }
  }

  async function saveAsTemplate() {
    if (!saveTemplateName.trim() || savingTemplate || !saveTemplateModal) return;
    setSavingTemplate(true);
    const isOverwrite = !!saveTemplateOverwriteId;
    try {
      const { data, error } = await saveTemplateToSupabase({
        templateId:       isOverwrite ? saveTemplateOverwriteId : undefined,
        name:             saveTemplateName.trim(),
        description:      saveTemplateDesc.trim(),
        isGlobal:         saveTemplateIsGlobal,
        loanPurpose:      saveTemplateModal.loanPurpose || "purchase",
        calculationData:  saveTemplateModal.calculatorData || {},
      });
      if (error) { alert("Could not save template: " + error.message); return; }
      if (isOverwrite) {
        // Replace the updated template in the list
        setTemplates(function(prev) {
          return prev.map(function(t) { return t.id === saveTemplateOverwriteId ? data : t; });
        });
      } else {
        setTemplates(function(prev) { return [data, ...prev]; });
      }
      setSaveTemplateModal(null);
      setSaveTemplateName("");
      setSaveTemplateDesc("");
      setSaveTemplateIsGlobal(false);
      setSaveTemplateOverwriteId("");
    } catch (err) {
      alert("Could not save template: " + err.message);
    } finally { setSavingTemplate(false); }
  }

  async function handleDeleteTemplate(tplId) {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    setDeletingTemplateId(tplId);
    try {
      const { error } = await deleteTemplateFromSupabase(tplId);
      if (error) { alert("Could not delete template: " + error.message); return; }
      setTemplates(function(prev) { return prev.filter(function(t) { return t.id !== tplId; }); });
      if (defaultTemplateId === tplId) setDefaultTemplateId(null);
      if (newTemplateId === tplId) setNewTemplateId("");
    } catch (err) {
      alert("Could not delete template: " + err.message);
    } finally { setDeletingTemplateId(null); }
  }

  async function handleSetDefaultTemplate(tplId) {
    setSettingDefaultId(tplId);
    try {
      const newDefault = (defaultTemplateId === tplId) ? null : tplId;
      const { error } = await setDefaultTemplateInSupabase(newDefault);
      if (error) { alert("Could not update default: " + error.message); return; }
      setDefaultTemplateId(newDefault);
    } catch (err) {
      alert("Could not update default: " + err.message);
    } finally { setSettingDefaultId(null); }
  }

  async function saveEditDetails(scenario) {
    if (!isCloudUser || editDetailsSaving) return;
    setEditDetailsSaving(true);
    try {
      const { error } = await saveScenarioToSupabase({
        scenarioId:             scenario.id,
        name:                   scenario.clientName,
        notes:                  scenario.notes,
        status:                 scenario.status,
        lead_status:            scenario.lead_status,
        loan_purpose:           scenario.loan_purpose,
        property_address:       editDetailsForm.property_address       || null,
        lead_source:            editDetailsForm.lead_source            || null,
        target_close_date:      editDetailsForm.target_close_date      || null,
        actual_close_date:      editDetailsForm.actual_close_date      || null,
        co_borrower_contact_id: editDetailsForm.co_borrower_contact_id || null,
      });
      if (error) { alert("Could not save details: " + error.message); return; }
      setScenarios(function(prev) {
        return prev.map(function(s) {
          if (s.id !== scenario.id) return s;
          return {
            ...s,
            property_address:       editDetailsForm.property_address       || "",
            lead_source:            editDetailsForm.lead_source            || "",
            target_close_date:      editDetailsForm.target_close_date      || null,
            actual_close_date:      editDetailsForm.actual_close_date      || null,
            co_borrower_contact_id: editDetailsForm.co_borrower_contact_id || null,
            updatedAt:              new Date().toISOString(),
          };
        });
      });
      writeAuditLog(scenario.id, "updated", {}, "Lead details updated");
      setEditDetailsOpen(null);
      setEditDetailsForm({});
    } catch (err) {
      alert("Could not save details: " + err.message);
    } finally { setEditDetailsSaving(false); }
  }

  // ── Partner: refer scenario to LO team ───────────────────────────────────
  async function handleReferToLO(scenarioId) {
    if (referSaving) return;
    setReferSaving(true);
    try {
      const { error } = await referScenarioToLO({ scenarioId, note: referNote.trim() });
      if (error) { alert("Could not send referral: " + error.message); return; }
      setReferredIds(function(prev) { const s = new Set(prev); s.add(scenarioId); return s; });
      setReferringId(null);
      setReferNote("");
    } catch (err) {
      alert("Could not send referral: " + err.message);
    } finally { setReferSaving(false); }
  }

  // ── LO: share scenario with a specific partner ────────────────────────────
  async function handleShareWithPartner() {
    if (!shareModalScenario || !sharePartnerId || shareSaving) return;
    setSharaSaving(true);
    try {
      const { error } = await shareScenarioWithPartner({
        scenarioId:  shareModalScenario.id,
        partnerUserId: sharePartnerId,
        permission:  sharePermission,
        note:        shareNote.trim(),
      });
      if (error) { alert("Could not share scenario: " + error.message); return; }
      // Update share count badge
      setShareCountsMap(function(prev) {
        return { ...prev, [shareModalScenario.id]: (prev[shareModalScenario.id] || 0) + 1 };
      });
      setShareModalScenario(null);
      setSharePartnerId("");
      setShareNote("");
      setSharePermission("view");
    } catch (err) {
      alert("Could not share scenario: " + err.message);
    } finally { setShareSaving(false); }
  }
  // typo fix helper — setSharaSaving won't exist so point to the real setter
  function setSharaSaving(v) { setShareSaving(v); }

  function resetShareModal() {
    setShareModalScenario(null);
    setSharePartnerId("");
    setShareNote("");
    setSharePermission("view");
    setShareMode("existing");
    setShareInviteEmail("");
    setShareInviteRole("realtor");
    setShareInviteDone(null);
    setShareBrokerage("");
    setBrokerageShareResult(null);
  }

  async function handleShareWithBrokerage() {
    if (!shareModalScenario || !shareBrokerage || shareSaving) return;
    const members = partnerProfiles.filter(function(p) { return p.brokerage === shareBrokerage; });
    if (members.length === 0) return;
    setShareSaving(true);
    setBrokerageShareResult(null);
    let ok = 0; let failed = 0;
    for (const partner of members) {
      const { error } = await shareScenarioWithPartner({
        scenarioId:  shareModalScenario.id,
        partnerId:   partner.id,
        permission:  sharePermission,
        note:        shareNote,
      });
      if (error) { failed++; } else { ok++; }
    }
    setShareCountsMap(function(prev) {
      return { ...prev, [shareModalScenario.id]: (prev[shareModalScenario.id] || 0) + ok };
    });
    setBrokerageShareResult({ ok, failed, total: members.length });
    setShareSaving(false);
  }

  async function handleInviteAndShare() {
    if (!shareModalScenario || !shareInviteEmail.trim() || shareSaving) return;
    const emailVal = shareInviteEmail.trim().toLowerCase();
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(emailVal)) { alert("Please enter a valid email address."); return; }
    setSharaSaving(true);
    try {
      const { error } = await shareScenarioByInvite({
        scenarioId:  shareModalScenario.id,
        email:       emailVal,
        role:        shareInviteRole,
        permission:  sharePermission,
        note:        shareNote.trim(),
      });
      if (error) { alert("Could not create invite: " + error.message); return; }
      setShareCountsMap(function(prev) {
        return { ...prev, [shareModalScenario.id]: (prev[shareModalScenario.id] || 0) + 1 };
      });
      const appUrl = window.location.origin + window.location.pathname;
      const roleLabel = shareInviteRole === "builder" ? "Builder" : "Realtor";
      setShareInviteDone(
        "Hi,\n\nI've shared a scenario with you on Mortgage Mark. You can view it by signing up at:\n\n" +
        appUrl + "\n\n" +
        "Use this email to sign up: " + emailVal + "\n" +
        "Sign up as: " + roleLabel + "\n\n" +
        "Once you're in, the scenario \"" + shareModalScenario.clientName + "\" will appear in your \"Shared With Me\" tab."
      );
    } catch (err) {
      alert("Could not create invite: " + err.message);
    } finally { setShareSaving(false); }
  }

  // ── Bulk edit apply ────────────────────────────────────────────────────
  async function applyBulkEdit() {
    if (bulkApplying || selectedIds.length === 0) return;
    const hasLeadStatus = bulkFields.lead_status !== "";
    const hasFuDate     = bulkFields.fu_date     !== "";
    const hasFuWho      = bulkFields.fu_who      !== "";
    const hasFuPriority = bulkFields.fu_priority !== "";
    const hasFuFields   = hasFuDate || hasFuWho || hasFuPriority;
    if (!hasLeadStatus && !hasFuFields) return;

    setBulkApplying(true);
    setBulkResult(null);
    let okScenarios = 0, okContacts = 0, failedScenarios = 0, failedContacts = 0, skippedNoContact = 0;

    // ── 1. Update lead_status on selected scenarios ──────────────────────
    if (hasLeadStatus && isCloudUser) {
      for (const sid of selectedIds) {
        try {
          const { error } = await supabase
            .from("scenarios")
            .update({ lead_status: bulkFields.lead_status })
            .eq("id", sid);
          if (error) { failedScenarios++; } else { okScenarios++; }
        } catch { failedScenarios++; }
      }
      // Reflect in local state
      setScenarios(function(prev) {
        return prev.map(function(s) {
          if (!selectedIds.includes(s.id)) return s;
          return { ...s, lead_status: bulkFields.lead_status, updatedAt: new Date().toISOString() };
        });
      });
    }

    // ── 2. Update FU fields on the linked contacts ───────────────────────
    if (hasFuFields) {
      const patch = {};
      if (hasFuDate)     patch.fu_date     = bulkFields.fu_date     || null;
      if (hasFuWho)      patch.fu_who      = bulkFields.fu_who      || null;
      if (hasFuPriority) patch.fu_priority = bulkFields.fu_priority || null;

      // Collect unique contact IDs; count scenarios with no contact as skipped
      const contactMap = {};
      selectedIds.forEach(function(sid) {
        const s = scenarios.find(function(x) { return x.id === sid; });
        const cid = s && s.contact_id;
        if (!cid) { skippedNoContact++; return; }
        contactMap[cid] = true;
      });

      for (const cid of Object.keys(contactMap)) {
        try {
          const { data, error } = await patchContactInSupabase(cid, patch);
          if (error) { failedContacts++; continue; }
          okContacts++;
          // Reflect updated contact in contactsMap
          setContactsMap(function(prev) {
            return { ...prev, [cid]: { ...(prev[cid] || {}), ...patch } };
          });
        } catch { failedContacts++; }
      }
    }

    setBulkApplying(false);
    setBulkResult({
      okScenarios, okContacts,
      failed: failedScenarios + failedContacts,
      skippedNoContact,
      hasFuFields,
    });
    // Reset form but keep selection so user can see what was updated
    setBulkFields({ lead_status: "", fu_date: "", fu_who: "", fu_priority: "" });
    // Auto-dismiss result after 6 seconds
    setTimeout(function() { setBulkResult(null); }, 6000);
  }

  // ── Filtering & sorting ────────────────────────────────────────────────
  const groupCounts = {};
  LEAD_GROUPS.forEach(g => {
    groupCounts[g] = scenarios.filter(s => getLeadGroup(s.lead_status) === g).length;
  });

  // ── Pipeline metrics (internal users only) ────────────────────────────
  const LEAD_STATUSES_ALL = window.LEAD_STATUSES || [];
  const pipelineMetrics = {
    pre: scenarios.filter(function(s) {
      const m = LEAD_STATUSES_ALL.find(function(x) { return x.value === (s.lead_status || ""); });
      return m && m.group === "pre";
    }).length,
    active: scenarios.filter(function(s) {
      const m = LEAD_STATUSES_ALL.find(function(x) { return x.value === (s.lead_status || ""); });
      return m && m.group === "active";
    }).length,
    waiting: scenarios.filter(function(s) { return getLeadGroup(s.lead_status) === "waiting"; }).length,
  };

  // Helper: get closing date from scenario — checks target_close_date first,
  // then falls back to fs_closing_date stored inside the scenario's calculatorData
  // (the Fee Sheet closing date picker, stored as mtk_fs_closing_date in localStorage).
  function getClosingDate(s) {
    if (s.target_close_date) return s.target_close_date + "";
    var cd = s.calculatorData && s.calculatorData["fs_closing_date"];
    if (!cd) return null;
    try { var p = JSON.parse(cd); return typeof p === "string" ? p : null; } catch(e) { return typeof cd === "string" ? cd : null; }
  }

  // Helper: lead status is 01. Contract/Go through 15. Funded
  function isContractToFunded(leadStatus) {
    if (!leadStatus) return false;
    var m = leadStatus.match(/^(\d+)\./);
    if (!m) return false;
    var n = parseInt(m[1], 10);
    return n >= 1 && n <= 15;
  }

  // "Closing this month" — closing date in current month AND status is 01–15
  const _now = new Date();
  const closingThisMonth = scenarios.filter(function(s) {
    if (!isContractToFunded(s.lead_status)) return false;
    var dateStr = getClosingDate(s);
    if (!dateStr) return false;
    const parts = dateStr.split("-");
    return parts.length >= 2 &&
      parseInt(parts[0], 10) === _now.getFullYear() &&
      parseInt(parts[1], 10) - 1 === _now.getMonth();
  }).length;

  // ── Column sort handler ────────────────────────────────────────────────
  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(function(prev) { return prev === "asc" ? "desc" : "asc"; });
    } else {
      setSortBy(col);
      // Date columns default descending; text columns default ascending
      setSortDir(col === "updatedAt" || col === "createdAt" || col === "fu_date" ? "desc" : "asc");
    }
  }

  const LEAD_STATUSES_GROUPS = [
    { value: "pre",      label: "All"    },
    { value: "active",   label: "Active Pipeline" },
    { value: "waiting",  label: "Waiting"          },
    { value: "archived", label: "Archived"         },
  ];

  const filtered = scenarios
    .filter(function(s) {
      if (closingFilter) {
        if (!isContractToFunded(s.lead_status)) return false;
        var dateStr = getClosingDate(s);
        if (!dateStr) return false;
        const parts = dateStr.split("-");
        return parts.length >= 2 &&
          parseInt(parts[0], 10) === _now.getFullYear() &&
          parseInt(parts[1], 10) - 1 === _now.getMonth();
      }
      if (pipelineSubFilter === "pre") {
        var m = LEAD_STATUSES_ALL.find(function(x) { return x.value === s.lead_status; });
        return m ? m.group === "pre" : !s.lead_status;
      }
      if (pipelineSubFilter === "pipeline") {
        var m2 = LEAD_STATUSES_ALL.find(function(x) { return x.value === s.lead_status; });
        return m2 ? m2.group === "active" : false;
      }
      // "All" tab (groupFilter === "pre") shows everything except archived
      if (groupFilter === "pre") return getLeadGroup(s.lead_status) !== "archived";
      return getLeadGroup(s.lead_status) === groupFilter;
    })
    .filter(function(s) {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const ct = s.contact_id ? (contactsMap[s.contact_id] || null) : null;
      function parseV(v) {
        if (v === null || v === undefined) return "";
        try { return JSON.parse(v) || ""; } catch (e) { return String(v) || ""; }
      }
      // Phonetic/fuzzy match helper (same algorithm as ContactsTab)
      function sdx(str) {
        var s2 = String(str).toUpperCase().replace(/[^A-Z]/g, "");
        if (!s2) return "";
        var m = {B:1,F:1,P:1,V:1,C:2,G:2,J:2,K:2,Q:2,S:2,X:2,Z:2,D:3,T:3,L:4,M:5,N:5,R:6};
        var code = s2[0], prev = m[s2[0]] || 0;
        for (var i = 1; i < s2.length && code.length < 4; i++) {
          var curr = m[s2[i]] || 0;
          if (curr && curr !== prev) code += curr;
          prev = curr;
        }
        return (code + "000").slice(0, 4);
      }
      function sdFuzzy(q, target) {
        if (!q || !target) return false;
        var tl = target.toLowerCase();
        if (tl.includes(q)) return true;
        var qToks = q.split(/\s+/).filter(Boolean);
        var tToks = tl.split(/\s+/).filter(Boolean);
        return qToks.every(function(qt) {
          if (qt.length < 3) return tl.includes(qt);
          var sq = sdx(qt);
          return tToks.some(function(tt) { return tt.includes(qt) || (tt.length >= 3 && sdx(tt) === sq); });
        });
      }
      const d = s.calculatorData || {};
      const c2fn = parseV(d["abt_c2fn"]);
      const c2ln = parseV(d["abt_c2ln"]);
      const c2label = (c2ln && c2fn ? c2ln + ", " + c2fn : c2fn || c2ln).toLowerCase();
      const ctFull  = ct ? ((ct.first_name || "") + " " + (ct.last_name || "")).trim() : "";
      const ctFullR = ct ? ((ct.last_name  || "") + ", " + (ct.first_name || "")).trim() : "";
      const ct2Full = ct ? ((ct.first_name2 || "") + " " + (ct.last_name2 || "")).trim() : "";
      return (
        sdFuzzy(term, s.clientName) ||
        sdFuzzy(term, getClientLabel(s)) ||
        (c2label && sdFuzzy(term, c2label)) ||
        (s.notes && s.notes.toLowerCase().includes(term)) ||
        (s.createdByName && s.createdByName.toLowerCase().includes(term)) ||
        (s.property_address && s.property_address.toLowerCase().includes(term)) ||
        sdFuzzy(term, ctFull) ||
        sdFuzzy(term, ctFullR) ||
        (ct && sdFuzzy(term, ct.first_name  || "")) ||
        (ct && sdFuzzy(term, ct.last_name   || "")) ||
        (ct && sdFuzzy(term, ct.nickname    || "")) ||
        sdFuzzy(term, ct2Full) ||
        (ct && sdFuzzy(term, ct.first_name2 || "")) ||
        (ct && sdFuzzy(term, ct.last_name2  || "")) ||
        (ct && sdFuzzy(term, ct.nickname2   || "")) ||
        (ct && ct.phone_cell && ct.phone_cell.toLowerCase().includes(term)) ||
        (ct && ct.phone_work && ct.phone_work.toLowerCase().includes(term)) ||
        (ct && ct.phone_home && ct.phone_home.toLowerCase().includes(term)) ||
        (ct && ct.phone2     && ct.phone2.toLowerCase().includes(term)) ||
        (ct && ct.email_personal && ct.email_personal.toLowerCase().includes(term)) ||
        (ct && ct.email_work    && ct.email_work.toLowerCase().includes(term)) ||
        (ct && ct.email2        && ct.email2.toLowerCase().includes(term))
      );
    })
    // ── Column filters ────────────────────────────────────────────────────
    .filter(function(s) {
      if (!filterLeadStatus) return true;
      const LEAD_STATUSES_ALL2 = window.LEAD_STATUSES || [];
      const m = LEAD_STATUSES_ALL2.find(function(x) { return x.value === (s.lead_status || ""); });
      const grp = m ? m.group : getLeadGroup(s.lead_status);
      return grp === filterLeadStatus;
    })
    .filter(function(s) {
      if (!filterPurpose) return true;
      const lp = s.loan_purpose || "purchase";
      if (filterPurpose === "refi") return lp.startsWith("refi");
      return !lp.startsWith("refi"); // "purchase" catches all non-refi
    })
    .filter(function(s) {
      if (!filterFuPriority) return true;
      const ct = s.contact_id ? (contactsMap[s.contact_id] || null) : null;
      const prio = ct ? (ct.fu_priority || "") : "";
      if (filterFuPriority === "_none") return !prio;
      return prio === filterFuPriority;
    })
    .filter(function(s) {
      if (!filterFuDate) return true;
      const ct = s.contact_id ? (contactsMap[s.contact_id] || null) : null;
      const fuDate = ct ? (ct.fu_date || "") : "";
      if (filterFuDate === "none") return !fuDate;
      if (!fuDate) return false;
      const d = new Date(fuDate + "T00:00:00"); // parse YYYY-MM-DD as local date
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const weekEnd    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      if (filterFuDate === "overdue")    return d < todayStart;
      if (filterFuDate === "today")      return d >= todayStart && d < todayEnd;
      if (filterFuDate === "this_week")  return d >= todayStart && d < weekEnd;
      if (filterFuDate === "this_month") return d >= todayStart && d < monthEnd;
      return true;
    })
    .filter(function(s) {
      if (!filterFuWho) return true;
      const ct = s.contact_id ? (contactsMap[s.contact_id] || null) : null;
      const who = ct ? (ct.fu_who || "") : "";
      if (filterFuWho === "_none") return !who;
      return who === filterFuWho;
    })
    .sort(function(a, b) {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "updatedAt") return dir * (new Date(a.updatedAt) - new Date(b.updatedAt));
      if (sortBy === "createdAt") return dir * (new Date(a.createdAt) - new Date(b.createdAt));
      if (sortBy === "clientName") {
        const la = getClientLabel(a) || a.clientName || "";
        const lb = getClientLabel(b) || b.clientName || "";
        return dir * la.localeCompare(lb);
      }
      if (sortBy === "contact") {
        const ctA = contactsMap[a.contact_id];
        const ctB = contactsMap[b.contact_id];
        const firstA = (ctA ? ctA.first_name || "" : "").toLowerCase();
        const firstB = (ctB ? ctB.first_name || "" : "").toLowerCase();
        const cmp = firstA.localeCompare(firstB);
        if (cmp !== 0) return dir * cmp;
        const lastA  = (ctA ? ctA.last_name  || "" : "").toLowerCase();
        const lastB  = (ctB ? ctB.last_name  || "" : "").toLowerCase();
        return dir * lastA.localeCompare(lastB);
      }
      if (sortBy === "uid") {
        return dir * (a.uid || "").localeCompare(b.uid || "");
      }
      if (sortBy === "loan_purpose") {
        return dir * (a.loan_purpose || "").localeCompare(b.loan_purpose || "");
      }
      if (sortBy === "lead_status") {
        return dir * (a.lead_status || "").localeCompare(b.lead_status || "");
      }
      if (sortBy === "fu_date") {
        const ctA = contactsMap[a.contact_id];
        const ctB = contactsMap[b.contact_id];
        const da = ctA && ctA.fu_date ? ctA.fu_date : "9999-99-99";
        const db = ctB && ctB.fu_date ? ctB.fu_date : "9999-99-99";
        return dir * da.localeCompare(db);
      }
      if (sortBy === "fu_who") {
        const ctA = contactsMap[a.contact_id];
        const ctB = contactsMap[b.contact_id];
        return dir * (ctA && ctA.fu_who ? ctA.fu_who : "").localeCompare(ctB && ctB.fu_who ? ctB.fu_who : "");
      }
      if (sortBy === "fu_priority") {
        const order = { High: 0, Medium: 1, Low: 2, "": 3 };
        const ctA = contactsMap[a.contact_id];
        const ctB = contactsMap[b.contact_id];
        const pa = ctA ? (ctA.fu_priority || "") : "";
        const pb = ctB ? (ctB.fu_priority || "") : "";
        const oa = order[pa] !== undefined ? order[pa] : 3;
        const ob = order[pb] !== undefined ? order[pb] : 3;
        return dir * (oa - ob);
      }
      return 0;
    });

  // ── Shared styles ──────────────────────────────────────────────────────
  const cardStyle = {
    background:    c.cardBg,
    border:        "1px solid " + c.border,
    borderRadius:  "12px",
    padding:       "20px",
    cursor:        "pointer",
    transition:    "all 0.2s ease",
    position:      "relative",
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    border: "1px solid " + c.border, background: c.bg,
    color: c.text, fontSize: "14px", outline: "none", boxSizing: "border-box",
  };

  const thStyle = {
    padding: "8px 12px", textAlign: "left", fontSize: "11px",
    fontWeight: 700, color: c.textSecondary || "#64748b",
    textTransform: "uppercase", letterSpacing: "0.05em",
    whiteSpace: "nowrap", userSelect: "none",
  };

  const tdStyle = {
    padding: "10px 12px", verticalAlign: "middle", fontSize: "13px",
  };

  const actionBtnStyle = {
    background: "transparent", border: "1px solid " + c.border,
    borderRadius: "5px", padding: "4px 8px",
    cursor: "pointer", fontSize: "13px", color: c.text,
    lineHeight: 1,
  };

  const LOAN_PURPOSES = window.LOAN_PURPOSES || [];

  // ── Render ─────────────────────────────────────────────────────────────
  // ── Templates full-page view ──────────────────────────────────────────────
  if (showManageTemplates) {
    const tplSortFn = function(a, b) {
      const dir = tplSortDir === "asc" ? 1 : -1;
      if (tplSortCol === "name")    return dir * (a.name || "").localeCompare(b.name || "");
      if (tplSortCol === "purpose") return dir * (a.loan_purpose || "").localeCompare(b.loan_purpose || "");
      if (tplSortCol === "scope")   return dir * ((a.is_global ? "shared" : "personal").localeCompare(b.is_global ? "shared" : "personal"));
      if (tplSortCol === "created") return dir * ((a.created_at || "").localeCompare(b.created_at || ""));
      if (tplSortCol === "default") return dir * ((a.id === defaultTemplateId ? 0 : 1) - (b.id === defaultTemplateId ? 0 : 1));
      return 0;
    };
    const tplToggleSort = function(col) {
      if (tplSortCol === col) setTplSortDir(function(d) { return d === "asc" ? "desc" : "asc"; });
      else { setTplSortCol(col); setTplSortDir("asc"); }
    };
    const tplSortIcon = function(col) {
      if (tplSortCol !== col) return " \u2195";
      return tplSortDir === "asc" ? " \u2191" : " \u2193";
    };

    const tplFiltered = templates.filter(function(t) {
      if (tplPurposeFilter !== "all" && t.loan_purpose !== tplPurposeFilter) return false;
      if (tplScopeFilter === "shared"   && !t.is_global)  return false;
      if (tplScopeFilter === "personal" &&  t.is_global)  return false;
      if (tplSearch.trim()) {
        const q = tplSearch.trim().toLowerCase();
        if (!(t.name || "").toLowerCase().includes(q) &&
            !(t.description || "").toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort(tplSortFn);

    const tplThStyle = {
      padding: "10px 14px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
      textTransform: "uppercase", color: c.textSecondary || "#64748b",
      borderBottom: "2px solid " + (c.border || "#e2e8f0"),
      textAlign: "left", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none",
      background: c.cardBg || c.bgAlt || "#f8fafc",
    };
    const tplTdStyle = {
      padding: "12px 14px", fontSize: "13px",
      borderBottom: "1px solid " + (c.border || "#e2e8f0"),
      verticalAlign: "middle",
    };

    return (
      <div style={{ minHeight: "100vh", background: c.bg || "#f7fafb", color: c.text || "#1a2530", fontFamily: "'Inter', -apple-system, sans-serif" }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
          padding: "20px 32px", display: "flex", alignItems: "center", gap: "16px", color: "#fff",
        }}>
          <button
            onClick={function() { setShowManageTemplates(false); }}
            style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff", borderRadius: "8px", padding: "7px 16px",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}
          >← Scenarios</button>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>📋 Scenario Templates</h1>
            <div style={{ fontSize: "13px", opacity: 0.7, marginTop: "2px" }}>
              {templates.length} template{templates.length !== 1 ? "s" : ""} · ★ to set default · click 📋 on a scenario card to create one
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxWidth: "1100px", margin: "28px auto", padding: "0 24px" }}>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Search name or description…"
              value={tplSearch}
              onChange={function(e) { setTplSearch(e.target.value); }}
              style={{
                flex: "1 1 220px", padding: "8px 12px", borderRadius: "8px",
                border: "1px solid " + c.border, background: c.cardBg, color: c.text,
                fontSize: "13px", outline: "none",
              }}
            />
            <select
              value={tplPurposeFilter}
              onChange={function(e) { setTplPurposeFilter(e.target.value); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid " + c.border, background: c.cardBg, color: c.text, fontSize: "13px", cursor: "pointer" }}
            >
              <option value="all">All Purposes</option>
              <option value="purchase">🏠 Purchase</option>
              <option value="refi">🔄 Refi</option>
            </select>
            <select
              value={tplScopeFilter}
              onChange={function(e) { setTplScopeFilter(e.target.value); }}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid " + c.border, background: c.cardBg, color: c.text, fontSize: "13px", cursor: "pointer" }}
            >
              <option value="all">All Scopes</option>
              <option value="personal">Personal</option>
              <option value="shared">🌐 Shared</option>
            </select>
            {(tplSearch || tplPurposeFilter !== "all" || tplScopeFilter !== "all") && (
              <button
                onClick={function() { setTplSearch(""); setTplPurposeFilter("all"); setTplScopeFilter("all"); }}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid " + c.border, background: "transparent", color: c.textSecondary, fontSize: "13px", cursor: "pointer" }}
              >Clear</button>
            )}
            <span style={{ fontSize: "12px", color: c.textSecondary, marginLeft: "auto" }}>
              {tplFiltered.length} of {templates.length}
            </span>
          </div>

          {/* Empty state — no templates at all */}
          {templates.length === 0 && (
            <div style={{ background: c.cardBg, border: "1px solid " + c.border, borderRadius: "12px", padding: "48px 32px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
              <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>No templates yet</div>
              <div style={{ fontSize: "13px", color: c.textSecondary }}>Click the 📋 button on any scenario card to save its calculator settings as a template.</div>
              <button onClick={function() { setShowManageTemplates(false); }} style={{ marginTop: "20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>← Back to Dashboard</button>
            </div>
          )}

          {/* Table */}
          {templates.length > 0 && (
            <div style={{ background: c.cardBg, border: "1px solid " + c.border, borderRadius: "12px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...tplThStyle, width: 40, textAlign: "center" }} onClick={function() { tplToggleSort("default"); }} title="Sort by default">★{tplSortIcon("default")}</th>
                    <th style={tplThStyle} onClick={function() { tplToggleSort("name"); }}>Name{tplSortIcon("name")}</th>
                    <th style={tplThStyle}>Description</th>
                    <th style={tplThStyle} onClick={function() { tplToggleSort("purpose"); }}>Purpose{tplSortIcon("purpose")}</th>
                    <th style={tplThStyle} onClick={function() { tplToggleSort("scope"); }}>Scope{tplSortIcon("scope")}</th>
                    <th style={tplThStyle} onClick={function() { tplToggleSort("created"); }}>Created{tplSortIcon("created")}</th>
                    <th style={{ ...tplThStyle, textAlign: "center", cursor: "default" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tplFiltered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...tplTdStyle, textAlign: "center", color: c.textSecondary, padding: "32px" }}>
                        No templates match the current filters.
                      </td>
                    </tr>
                  )}
                  {tplFiltered.map(function(t) {
                    const isDefault    = t.id === defaultTemplateId;
                    const isDeleting   = deletingTemplateId === t.id;
                    const isSettingDef = settingDefaultId === t.id;
                    const created = t.created_at ? new Date(t.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "\u2014";
                    return (
                      <tr key={t.id} style={{ background: isDefault ? "rgba(37,99,235,0.04)" : "transparent" }}>
                        {/* Star */}
                        <td style={{ ...tplTdStyle, textAlign: "center" }}>
                          <button
                            onClick={function() { handleSetDefaultTemplate(t.id); }}
                            disabled={!!isSettingDef}
                            title={isDefault ? "Remove as default" : "Set as default"}
                            style={{ background: "none", border: "none", cursor: isSettingDef ? "wait" : "pointer", fontSize: "18px", lineHeight: 1, padding: 0, color: isDefault ? "#f59e0b" : c.textSecondary, opacity: isSettingDef ? 0.4 : 1 }}
                          >{isDefault ? "★" : "☆"}</button>
                        </td>
                        {/* Name */}
                        <td style={{ ...tplTdStyle, fontWeight: 600 }}>
                          {t.name}
                          {isDefault && <span style={{ marginLeft: 6, fontSize: "10px", fontWeight: 700, background: "rgba(37,99,235,0.12)", color: "#2563eb", padding: "1px 6px", borderRadius: 99, border: "1px solid rgba(37,99,235,0.2)" }}>DEFAULT</span>}
                        </td>
                        {/* Description */}
                        <td style={{ ...tplTdStyle, color: c.textSecondary, maxWidth: "260px" }}>
                          <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {t.description || <span style={{ opacity: 0.4 }}>—</span>}
                          </span>
                        </td>
                        {/* Purpose */}
                        <td style={tplTdStyle}>
                          <span style={{
                            display: "inline-block", padding: "2px 9px", borderRadius: 99, fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap",
                            background: t.loan_purpose === "refi" ? "rgba(59,130,246,0.1)" : "rgba(34,197,94,0.1)",
                            color:      t.loan_purpose === "refi" ? "#1d4ed8"               : "#15803d",
                          }}>
                            {t.loan_purpose === "refi" ? "🔄 Refi" : "🏠 Purchase"}
                          </span>
                        </td>
                        {/* Scope */}
                        <td style={tplTdStyle}>
                          {t.is_global
                            ? <span style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>🌐 Shared</span>
                            : <span style={{ fontSize: "12px", color: c.textSecondary }}>Personal</span>}
                        </td>
                        {/* Created */}
                        <td style={{ ...tplTdStyle, whiteSpace: "nowrap", color: c.textSecondary }}>{created}</td>
                        {/* Actions */}
                        <td style={{ ...tplTdStyle, textAlign: "center" }}>
                          <button
                            onClick={function() { handleDeleteTemplate(t.id); }}
                            disabled={!!isDeleting}
                            style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.35)", color: "#dc2626", borderRadius: "6px", padding: "4px 12px", fontSize: "12px", fontWeight: 600, cursor: isDeleting ? "wait" : "pointer", opacity: isDeleting ? 0.4 : 1 }}
                          >{isDeleting ? "…" : "Delete"}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: c.bg, color: c.text }}>

      {/* ── Client / borrower header bar (profile + logout) ── */}
      {!user.isInternal && (
        <div style={{
          background: "linear-gradient(135deg, #0C4160 0%, #1A5E8A 100%)",
          padding: "12px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {user.name ? "Welcome, " + user.name.split(" ")[0] : "My Scenarios"}
            </div>
            {user.email && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>{user.email}</div>
            )}
          </div>
          {/* Profile avatar — opens dropdown menu */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={function() { setProfileMenuOpen(function(o) { return !o; }); }}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                border: "2px solid rgba(255,255,255,0.35)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {user.name ? user.name.trim().split(/\s+/).map(function(w) { return w[0]; }).join("").slice(0,2).toUpperCase() : "?"}
            </button>
            {profileMenuOpen && (
              <div style={{
                position: "absolute", top: 46, right: 0, zIndex: 999,
                background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                border: "1px solid #E8EEF4", minWidth: 190, overflow: "hidden",
              }}
                onMouseLeave={function() { setProfileMenuOpen(false); }}
              >
                {onMyInfo && (
                  <button onClick={function() { setProfileMenuOpen(false); onMyInfo(); }} style={{
                    display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                    background: "none", border: "none", borderBottom: "1px solid #F0F4F8",
                    fontSize: 13, fontWeight: 600, color: "#0C4160", cursor: "pointer",
                  }}>👤 My Profile</button>
                )}
                {onLoginSettings && (
                  <button onClick={function() { setProfileMenuOpen(false); onLoginSettings(); }} style={{
                    display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                    background: "none", border: "none", borderBottom: "1px solid #F0F4F8",
                    fontSize: 13, fontWeight: 600, color: "#0C4160", cursor: "pointer",
                  }}>🔑 Login & Password</button>
                )}
                {/* Language toggle */}
                <button
                  onClick={function() {
                    var currentLang = "en";
                    try { var _cl = localStorage.getItem("app_lang"); if (_cl) { try { currentLang = JSON.parse(_cl); } catch(e) { currentLang = _cl; } } } catch(e) {}
                    var next = currentLang === "es" ? "en" : "es";
                    try { localStorage.setItem("app_lang", JSON.stringify(next)); } catch(e) {}
                    setTimeout(function() { window.location.reload(); }, 50);
                  }}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                    background: "none", border: "none", borderBottom: "1px solid #F0F4F8",
                    fontSize: 13, fontWeight: 600, color: "#0C4160", cursor: "pointer",
                  }}
                >
                  {appLang === "es" ? "🇺🇸 Switch to English" : "🇲🇽 Cambiar a Español"}
                </button>
                {onSettings && (
                  <button onClick={function() { setProfileMenuOpen(false); onSettings(); }} style={{
                    display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                    background: "none", border: "none", borderBottom: "1px solid #F0F4F8",
                    fontSize: 13, fontWeight: 600, color: "#0C4160", cursor: "pointer",
                  }}>⚙️ Settings</button>
                )}
                {onLogout && (
                  <button onClick={function() { setProfileMenuOpen(false); onLogout(); }} style={{
                    display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                    background: "none", border: "none",
                    fontSize: 13, fontWeight: 500, color: "#64748B", cursor: "pointer",
                  }}>Sign Out</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>

        {/* Action Bar */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "12px",
          alignItems: "center", marginBottom: "16px",
        }}>
          <button
            onClick={openNewForm}
            style={{
              background: "#2563eb", color: "#fff", border: "none",
              borderRadius: "8px", padding: "10px 20px",
              fontSize: "15px", fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            + New Scenario
          </button>
          <input
            type="text"
            placeholder="Search scenarios…"
            value={searchTerm}
            onChange={function(e) { setSearchTerm(e.target.value); }}
            style={{
              flex: 1, minWidth: "200px", padding: "10px 14px",
              borderRadius: "8px", border: "1px solid " + c.border,
              background: c.cardBg, color: c.text, fontSize: "14px", outline: "none",
            }}
          />
          {(filterLeadStatus || filterPurpose || filterFuPriority || filterFuDate || filterFuWho) && (
            <button
              onClick={function() { setFilterLeadStatus(""); setFilterPurpose(""); setFilterFuPriority(""); setFilterFuDate(""); setFilterFuWho(""); }}
              style={{
                padding: "10px 14px", borderRadius: "8px",
                border: "1px solid #f59e0b",
                background: "rgba(245,158,11,0.08)", color: "#b45309",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* ── Pipeline Metrics Strip + Activity Report (internal only) ── */}
        {user.isInternal && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { label: t("All"),              count: pipelineMetrics.pre + pipelineMetrics.active + pipelineMetrics.waiting, bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)",  color: "#1d4ed8",
                onClick: function() { setClosingFilter(false); setGroupFilter("pre"); setPipelineSubFilter(null); } },
              { label: t("Active Pipeline"),  count: pipelineMetrics.active,  bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",   color: "#16a34a",
                onClick: function() { setClosingFilter(false); setGroupFilter("active"); setPipelineSubFilter("pipeline"); } },
              { label: t("Waiting"),          count: pipelineMetrics.waiting, bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)",  color: "#b45309",
                onClick: function() { setClosingFilter(false); setGroupFilter("waiting"); setPipelineSubFilter(null); } },
              { label: t("Closing This Month"), count: closingThisMonth,      bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)",   color: "#dc2626",
                onClick: function() { setClosingFilter(function(prev) { return !prev; }); setPipelineSubFilter(null); } },
            ].map(function(m) {
              const isActive = closingFilter
                ? m.label === "Closing This Month"
                : m.label === "All" ? (groupFilter === "pre" && !pipelineSubFilter && !closingFilter)
                : m.label === "Active Pipeline" ? pipelineSubFilter === "pipeline"
                : m.label === "Waiting" ? groupFilter === "waiting" && !closingFilter
                : false;
              return (
                <div
                  key={m.label}
                  onClick={m.onClick}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "8px",
                    background: isActive ? m.border : m.bg,
                    border: "1px solid " + (isActive ? m.color : m.border),
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: "12px", color: m.color, fontWeight: isActive ? 700 : 400 }}>{m.label}</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: m.color }}>{m.count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── New Scenario Form ────────────────────────────────────── */}
        {showNewForm && (
          <div style={{ marginBottom: "24px", maxWidth: "600px" }}>
          <div style={{ borderRadius: "14px", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.22)", border: "1px solid #1e3a5f" }}>
            {/* Dark header */}
            <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)", padding: "18px 24px" }}>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>Create New Scenario</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>All fields marked * are required</div>
            </div>
            {/* Dark body */}
            <div style={{ background: "#0f1f30", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* ── Contact * ── */}
              {requiresContact && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Contact <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    {!showInlineNewContact && (
                      <button type="button" onClick={function() { setShowInlineNewContact(true); }}
                        style={{ fontSize: "12px", fontWeight: 600, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        + New Contact
                      </button>
                    )}
                  </div>
                  <select value={newContactId} onChange={function(e) { setNewContactId(e.target.value); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid " + (!newContactId ? "#f87171" : "#2a4a6a"), background: "#1a3450", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                    <option value="">— Select a contact —</option>
                    {contactOptions.map(function(ct) {
                      return <option key={ct.id} value={ct.id}>{((ct.first_name || "") + " " + (ct.last_name || "")).trim()}{ct.email_personal ? " (" + ct.email_personal + ")" : ""}</option>;
                    })}
                  </select>
                  {showInlineNewContact && (
                    <div style={{ marginTop: "10px", padding: "14px", background: "#162c42", borderRadius: "8px", border: "1px solid #2a4a6a" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Quick-add contact</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                        {[["text","First Name *",inlineFirstName,setInlineFirstName],["text","Last Name *",inlineLastName,setInlineLastName],["email","Email (optional)",inlineEmail,setInlineEmail],["tel","Phone (optional)",inlinePhone,setInlinePhone]].map(function(f) {
                          return <input key={f[1]} type={f[0]} placeholder={f[1]} value={f[2]} onChange={function(e) { f[3](e.target.value); }} style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: "12px", outline: "none", width: "100%", boxSizing: "border-box" }} />;
                        })}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button type="button" onClick={saveInlineContact} disabled={savingInlineContact}
                          style={{ padding: "6px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: savingInlineContact ? "not-allowed" : "pointer" }}>
                          {savingInlineContact ? "Saving…" : "Save Contact"}
                        </button>
                        <button type="button" onClick={function() { setShowInlineNewContact(false); setInlineFirstName(""); setInlineLastName(""); setInlineEmail(""); setInlinePhone(""); }}
                          style={{ padding: "6px 12px", background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid #2a4a6a", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* ── Scenario Name ── */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                  Scenario Name <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vacation Home Purchase"
                  value={newClientName}
                  onChange={function(e) { setNewClientName(e.target.value); }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* ── Loan Purpose ── */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                  Loan Purpose <span style={{ color: "#f87171" }}>*</span>
                </label>
                <select value={newLoanPurpose} onChange={function(e) { setNewLoanPurpose(e.target.value); }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                  <option value="purchase">🏠 Purchase</option>
                  <option value="refi">🔄 Refinance</option>
                </select>
              </div>

              {/* ── Template (optional) ── */}
              {isCloudUser && user.isInternal && templates.length > 0 && (
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                    Template <span style={{ fontSize: "10px", fontWeight: 400, opacity: 0.6 }}>(optional — pre-fills calculator settings)</span>
                  </label>
                  <select
                    value={newTemplateId}
                    onChange={function(e) { setNewTemplateId(e.target.value); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                  >
                    <option value="">— No template (blank) —</option>
                    {templates.slice().sort(function(a, b) { return a.name.localeCompare(b.name); }).map(function(t) {
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.id === defaultTemplateId ? " ✓ Default" : ""}{t.is_global ? " 🌐" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {newTemplateId && (function() {
                    const tpl = templates.find(function(t) { return t.id === newTemplateId; });
                    return tpl && tpl.description ? (
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{tpl.description}</div>
                    ) : (
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>New scenario will be pre-filled with this template's calculator settings.</div>
                    );
                  })()}
                </div>
              )}

              {/* ── Buttons ── */}
              <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                <button
                  onClick={createScenario}
                  disabled={saving}
                  style={{
                    background: saving ? "#1d4ed8" : "#2563eb",
                    color: "#fff", border: "none", borderRadius: "8px",
                    padding: "11px 28px", fontSize: "14px", fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                    letterSpacing: "0.02em",
                  }}
                >
                  {saving ? "Saving\u2026" : "Create Scenario"}
                </button>
                <button
                  onClick={resetNewForm}
                  style={{
                    background: "transparent", color: "rgba(255,255,255,0.5)",
                    border: "1px solid #2a4a6a", borderRadius: "8px",
                    padding: "11px 24px", fontSize: "14px", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ── Borrower: Live Session Invite ────────────────────────── */}
        {liveInvite && (
          <div style={{
            marginBottom: "16px",
            background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
            border: "2px solid #34D399",
            borderRadius: "12px", padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
            boxShadow: "0 4px 20px rgba(52,211,153,0.25)",
            animation: "mtk-pulse-border 2s infinite",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>📡</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "#ECFDF5", letterSpacing: "-0.01em" }}>
                  {liveInvite.loName} is ready for a live session!
                </div>
                <div style={{ fontSize: "12px", color: "#6EE7B7", marginTop: 3 }}>
                  {liveInvite.scenario.name || "Your Scenario"} — tap below to join and see numbers update in real time.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={function() { onSelectScenario(liveInvite.scenario); }}
                style={{
                  padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "#34D399", color: "#064E3B",
                  fontSize: "14px", fontWeight: 800, letterSpacing: "-0.01em",
                  whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(52,211,153,0.4)",
                }}
              >Join Live Session →</button>
              <button
                onClick={function() { setLiveInvite(null); }}
                style={{
                  padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer", background: "transparent", color: "#6EE7B7",
                  fontSize: "12px", fontWeight: 600,
                }}
              >Dismiss</button>
            </div>
          </div>
        )}

        {/* ── Realtor/Builder: Pending Partnership Invites ──────────── */}
        {isCloudUser && pendingPartnerInvites.length > 0 && (
          <div style={{ marginBottom: 20, background: "rgba(12,65,96,0.06)", border: "1px solid rgba(12,65,96,0.25)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#0C4160" }}>
              🤝 Partnership Invite{pendingPartnerInvites.length > 1 ? "s" : ""} ({pendingPartnerInvites.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingPartnerInvites.map(function(inv) {
                var loName = (inv.lo && inv.lo.display_name) || "A Loan Officer";
                return (
                  <div key={inv.id} style={{ background: "#fff", borderRadius: 8, padding: "12px 14px", border: "1px solid #E8EEF4", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0C4160" }}>{loName} has invited you to partner.</div>
                      <div style={{ fontSize: 12, color: "#6B7D8A", marginTop: 2 }}>As partners, your referral link will route new clients to {loName} by default.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={partnerResponding === inv.id}
                        onClick={async function() {
                          setPartnerResponding(inv.id);
                          var fn = window.respondToPartnership;
                          if (fn) await fn({ partnershipId: inv.id, accept: true });
                          setPendingPartnerInvites(function(prev) { return prev.filter(function(p) { return p.id !== inv.id; }); });
                          setPartnerResponding(null);
                        }}
                        style={{ background: "#0C4160", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >Accept</button>
                      <button
                        disabled={partnerResponding === inv.id}
                        onClick={async function() {
                          setPartnerResponding(inv.id);
                          var fn = window.respondToPartnership;
                          if (fn) await fn({ partnershipId: inv.id, accept: false });
                          setPendingPartnerInvites(function(prev) { return prev.filter(function(p) { return p.id !== inv.id; }); });
                          setPartnerResponding(null);
                        }}
                        style={{ background: "#F0F4F8", color: "#6B7D8A", border: "1px solid #D1D9E6", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >Decline</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Borrower: Scenarios Prepared For You ────────────────── */}
        {isCloudUser && user.role === "borrower" && claimable.length > 0 && (
          <div style={{
            marginBottom: "20px",
            background: "rgba(37,99,235,0.06)",
            border: "1px solid rgba(37,99,235,0.3)",
            borderRadius: "12px", padding: "16px 20px",
          }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "12px", color: "#1e40af" }}>
              📬 Scenarios prepared for you ({claimable.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {claimable.map(function(s) {
                return (
                  <div key={s.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: c.cardBg, border: "1px solid " + c.border,
                    borderRadius: "8px", padding: "10px 14px",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{s.name || "Untitled Scenario"}</div>
                      {s.notes && (
                        <div style={{ fontSize: "12px", color: c.textSecondary || "#888", marginTop: "2px" }}>
                          {s.notes.length > 80 ? s.notes.substring(0, 80) + "\u2026" : s.notes}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={function() { claimScenario(s.id); }}
                      disabled={claiming}
                      style={{
                        background: claiming ? "#93b4f5" : "#2563eb", color: "#fff",
                        border: "none", borderRadius: "6px", padding: "7px 16px",
                        fontSize: "13px", fontWeight: 600,
                        cursor: claiming ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap", marginLeft: "16px",
                        opacity: claiming ? 0.7 : 1,
                      }}
                    >
                      {claiming ? "Claiming\u2026" : "Claim \u2192"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Borrower: Co-Borrower Scenarios ──────────────────────── */}
        {isCloudUser && user.role === "borrower" && coborrowerScenarios.length > 0 && (
          <div style={{
            marginBottom: "20px",
            background: "rgba(124,58,237,0.06)",
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: "12px", padding: "16px 20px",
          }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "12px", color: "#6d28d9" }}>
              👥 Scenarios you are listed on as co-borrower ({coborrowerScenarios.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {coborrowerScenarios.map(function(s) {
                return (
                  <div key={s.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: c.cardBg, border: "1px solid " + c.border,
                    borderRadius: "8px", padding: "10px 14px",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{s.name || "Untitled"}</div>
                      {s.property_address && (
                        <div style={{ fontSize: "12px", color: c.textSecondary || "#888", marginTop: "2px" }}>{s.property_address}</div>
                      )}
                      <div style={{ fontSize: "11px", color: c.textSecondary || "#888", marginTop: "2px" }}>
                        {getLoanPurposeLabel(s.loan_purpose)} · Updated {new Date(s.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={function() { onSelectScenario(mapFromCloud(s)); }}
                      style={{
                        background: "#7c3aed", color: "#fff",
                        border: "none", borderRadius: "6px", padding: "7px 16px",
                        fontSize: "13px", fontWeight: 600,
                        cursor: "pointer", whiteSpace: "nowrap", marginLeft: "16px",
                      }}
                    >View &#8594;</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Cloud Loading Indicator ──────────────────────────────── */}
        {cloudLoading && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "14px 18px", marginBottom: "16px",
            background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)",
            borderRadius: "10px", fontSize: "14px", color: "#2563eb",
          }}>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "18px" }}>⟳</span>
            Loading scenarios from cloud…
          </div>
        )}

        {/* ── Cloud Error Banner ───────────────────────────────────── */}
        {cloudError && !cloudLoading && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 18px", marginBottom: "16px",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "10px", fontSize: "14px", color: "#ef4444",
          }}>
            <span>⚠️ {cloudError}</span>
            <button
              onClick={function() { setCloudError(null); }}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px", padding: "0 4px", lineHeight: 1 }}
            >✕</button>
          </div>
        )}

        {/* ── Scenario Count ───────────────────────────────────────── */}
        <p style={{ fontSize: "14px", color: c.textSecondary || "#888", marginBottom: "16px" }}>
          {filtered.length}{" "}
          {closingFilter ? "closing this month" : LEAD_GROUP_LABELS[groupFilter].toLowerCase() + (user.isInternal ? " lead" : " scenario")}{filtered.length !== 1 && !closingFilter ? "s" : ""}
          {searchTerm ? (" matching \"" + searchTerm + "\"") : ""}
          {isCloudUser && !cloudLoading && " · ☁️ Cloud"}
        </p>

        {/* ── Empty State ──────────────────────────────────────────── */}
        {filtered.length === 0 && !showNewForm && (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            background: c.cardBg, borderRadius: "12px",
            border: "1px solid " + c.border,
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📋</div>
            <h3 style={{ margin: "0 0 8px", fontSize: "20px" }}>
              {searchTerm
                ? "No matching scenarios"
                : "No " + LEAD_GROUP_LABELS[groupFilter].toLowerCase() + (user.isInternal ? " leads" : " scenarios")}
            </h3>
            <p style={{ color: c.textSecondary || "#888", margin: "0 0 20px" }}>
              {searchTerm
                ? "Try a different search term"
                : (groupFilter === "active" || groupFilter === "pre")
                  ? t("Create your first scenario to get started")
                  : (LEAD_GROUP_LABELS[groupFilter] + (user.isInternal ? " leads" : " scenarios") + " will appear here")}
            </p>
            {!searchTerm && (groupFilter === "active" || groupFilter === "pre") && (
              <button
                onClick={openNewForm}
                style={{
                  background: "#2563eb", color: "#fff", border: "none",
                  borderRadius: "8px", padding: "12px 28px",
                  fontSize: "15px", fontWeight: 600, cursor: "pointer",
                }}
              >
                + Create First Scenario
              </button>
            )}
          </div>
        )}

        {/* ── Bulk Edit Bar ─────────────────────────────────────────── */}
        {selectedIds.length > 0 && (
          <div style={{
            marginBottom: 12, padding: "12px 16px",
            background: "rgba(37,99,235,0.08)", border: "1.5px solid rgba(37,99,235,0.3)",
            borderRadius: 10, display: "flex", flexWrap: "wrap",
            alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", whiteSpace: "nowrap" }}>
              {selectedIds.length} selected
            </span>

            {/* Lead Status */}
            <LeadStatusSelect
              value={bulkFields.lead_status}
              onChange={function(e) { setBulkFields(function(p) { return { ...p, lead_status: e.target.value }; }); }}
              style={{
                padding: "5px 8px", borderRadius: 6,
                border: "1px solid " + c.border,
                background: bulkFields.lead_status ? "rgba(37,99,235,0.1)" : c.bg,
                color: bulkFields.lead_status ? "#2563eb" : c.textSecondary,
                fontSize: 12, cursor: "pointer", outline: "none",
              }}
            />

            {/* FU Date */}
            <input
              type="date"
              value={bulkFields.fu_date}
              onChange={function(e) { setBulkFields(function(p) { return { ...p, fu_date: e.target.value }; }); }}
              placeholder="FU Date"
              title="FU Next date"
              style={{
                padding: "5px 8px", borderRadius: 6,
                border: "1px solid " + c.border,
                background: bulkFields.fu_date ? "rgba(37,99,235,0.1)" : c.bg,
                color: c.text, fontSize: 12, cursor: "pointer", outline: "none",
              }}
            />

            {/* FU Who */}
            <input
              type="text"
              value={bulkFields.fu_who}
              onChange={function(e) { setBulkFields(function(p) { return { ...p, fu_who: e.target.value }; }); }}
              placeholder="FU Who"
              style={{
                padding: "5px 8px", borderRadius: 6, width: 100,
                border: "1px solid " + c.border,
                background: bulkFields.fu_who ? "rgba(37,99,235,0.1)" : c.bg,
                color: c.text, fontSize: 12, outline: "none",
              }}
            />

            {/* FU Priority */}
            <select
              value={bulkFields.fu_priority}
              onChange={function(e) { setBulkFields(function(p) { return { ...p, fu_priority: e.target.value }; }); }}
              style={{
                padding: "5px 8px", borderRadius: 6,
                border: "1px solid " + c.border,
                background: bulkFields.fu_priority ? "rgba(37,99,235,0.1)" : c.bg,
                color: bulkFields.fu_priority ? "#2563eb" : c.textSecondary,
                fontSize: 12, cursor: "pointer", outline: "none",
              }}
            >
              <option value="">FU Priority</option>
              <option value="High">🔴 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">⚪ Low</option>
            </select>

            {/* Apply button */}
            <button
              onClick={applyBulkEdit}
              disabled={bulkApplying || (
                bulkFields.lead_status === "" &&
                bulkFields.fu_date === "" &&
                bulkFields.fu_who === "" &&
                bulkFields.fu_priority === ""
              )}
              style={{
                padding: "6px 14px", borderRadius: 6,
                border: "none",
                background: bulkApplying ? "rgba(37,99,235,0.4)" : "#2563eb",
                color: "#fff", fontSize: 12, fontWeight: 700,
                cursor: bulkApplying ? "wait" : "pointer",
                opacity: (bulkApplying || (bulkFields.lead_status === "" && bulkFields.fu_date === "" && bulkFields.fu_who === "" && bulkFields.fu_priority === "")) ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {bulkApplying ? "Applying…" : "Apply to " + selectedIds.length}
            </button>

            {/* Clear selection */}
            <button
              onClick={function() { setSelectedIds([]); setBulkFields({ lead_status: "", fu_date: "", fu_who: "", fu_priority: "" }); setBulkResult(null); }}
              style={{
                padding: "5px 10px", borderRadius: 6, border: "1px solid " + c.border,
                background: "transparent", color: c.textSecondary,
                fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              ✕ Deselect
            </button>

            {/* Bulk delete (admin only) */}
            {user && user.role === "admin" && (
              <button
                onClick={bulkDeleteScenarios}
                disabled={bulkDeleting}
                style={{
                  padding: "6px 14px", borderRadius: 6,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.12)", color: "#f87171",
                  fontSize: 12, fontWeight: 700,
                  cursor: bulkDeleting ? "wait" : "pointer", whiteSpace: "nowrap",
                }}
              >
                {bulkDeleting ? "Deleting…" : "🗑 Delete " + selectedIds.length}
              </button>
            )}

            {/* Result badge */}
            {bulkResult && (
              <span style={{ fontSize: 12, fontWeight: 600, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {bulkResult.failed > 0 && (
                  <span style={{ color: "#dc2626" }}>⚠️ {bulkResult.failed} failed</span>
                )}
                {bulkResult.okScenarios > 0 && (
                  <span style={{ color: "#16a34a" }}>✅ {bulkResult.okScenarios} status{bulkResult.okScenarios !== 1 ? "es" : ""} updated</span>
                )}
                {bulkResult.hasFuFields && bulkResult.okContacts > 0 && (
                  <span style={{ color: "#16a34a" }}>✅ {bulkResult.okContacts} FU updated</span>
                )}
                {bulkResult.hasFuFields && bulkResult.skippedNoContact > 0 && (
                  <span style={{ color: "#f59e0b" }}>⚠️ {bulkResult.skippedNoContact} skipped (no contact)</span>
                )}
                {bulkResult.okScenarios === 0 && bulkResult.okContacts === 0 && bulkResult.failed === 0 && (
                  <span style={{ color: "#6b7280" }}>nothing to update</span>
                )}
              </span>
            )}

            <span style={{ fontSize: 12, color: c.textSecondary, marginLeft: "auto" }}>
              Only filled fields will be changed. Blank = leave as-is.
            </span>
          </div>
        )}

        {/* ── Columns picker ───────────────────────────────────────── */}
        {user.isInternal && filtered.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6, position: "relative", zIndex: 400 }}>
            <button
              onClick={function() { setShowColPicker(function(v) { return !v; }); }}
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 7, border: "1px solid " + c.border, background: c.cardBg, color: c.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >⚙ Columns {showColPicker ? "▲" : "▼"}</button>
            {showColPicker && (
              <>
                {/* Click-outside backdrop */}
                <div onClick={function() { setShowColPicker(false); }} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 9999,
                  background: "#fff", border: "1px solid #e2e8f0",
                  borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
                  padding: "14px 18px", minWidth: 220,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 12, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                    Show / Hide Columns
                  </div>
                  {SD_COL_DEFS.map(function(col) {
                    var visible = sdColVisible(col.id);
                    return React.createElement("label", { key: col.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "5px 0", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#1e293b", userSelect: "none" } },
                      React.createElement("input", {
                        type: "checkbox", checked: visible,
                        style: { width: 15, height: 15, cursor: "pointer", accentColor: "#2563eb" },
                        onChange: function() {
                          setSdColHidden(function(prev) {
                            return visible ? [...prev, col.id] : prev.filter(function(x) { return x !== col.id; });
                          });
                        }
                      }),
                      col.label
                    );
                  })}
                  <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                    <button onClick={function() { setSdColHidden([]); setSdColWidths({}); setShowColPicker(false); }}
                      style={{ fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                      Reset to defaults
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Scenario Table ───────────────────────────────────────── */}
        {user.isInternal && filtered.length > 0 && (
          <div style={{ overflowX: "auto", background: c.cardBg, border: "1px solid " + c.border, borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 36 }} />
                {SD_COL_DEFS.map(function(col) {
                  return sdColVisible(col.id) ? <col key={col.id} style={{ width: sdColW(col.id, col.defaultW) }} /> : null;
                })}
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "2px solid " + c.border }}>
                  {/* ── sortable + filterable column headers ── */}
                  {(function() {
                    // Arrow indicator helper
                    function arrow(col) {
                      if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: 3 }}>⇅</span>;
                      return <span style={{ marginLeft: 3, color: "#2563eb" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
                    }
                    // Shared header click style
                    const clickTh = { ...thStyle, cursor: "pointer", userSelect: "none", position: "relative" };
                    // Resize handle for column headers
                    function rh(colId, defW) {
                      return <div onMouseDown={function(e) { e.stopPropagation(); sdStartResize(e, colId, defW); }} style={{ position: "absolute", right: 0, top: 0, width: 5, height: "100%", cursor: "col-resize", zIndex: 1 }} />;
                    }
                    const filterSelectStyle = {
                      marginTop: 4, display: "block", width: "100%",
                      fontSize: "10px", padding: "2px 4px",
                      borderRadius: 4, border: "1px solid " + c.border,
                      background: c.bg, color: c.text, cursor: "pointer",
                    };
                    return (
                      <React.Fragment>
                        {/* Checkbox — select all visible */}
                        <th style={{ ...thStyle, width: 36, textAlign: "center" }}
                            onClick={function(e) { e.stopPropagation(); }}>
                          <input
                            type="checkbox"
                            checked={filtered.length > 0 && filtered.every(function(s) { return selectedIds.includes(s.id); })}
                            onChange={function(e) {
                              if (e.target.checked) {
                                setSelectedIds(filtered.map(function(s) { return s.id; }));
                              } else {
                                setSelectedIds([]);
                              }
                            }}
                            style={{ cursor: "pointer" }}
                          />
                        </th>

                        {/* Contact — sortable */}
                        {sdColVisible("contact") && <th style={clickTh} onClick={function() { handleSort("contact"); }}>
                          Contact {arrow("contact")}{rh("contact",150)}
                        </th>}

                        {/* Scenario Name — sortable */}
                        {sdColVisible("scenario") && <th style={clickTh} onClick={function() { handleSort("clientName"); }}>
                          Scenario Name {arrow("clientName")}{rh("scenario",160)}
                        </th>}

                        {/* Lead Status — sortable + filterable by group */}
                        {sdColVisible("lead_status") && <th style={{ ...clickTh, position: "relative" }}>
                          <div onClick={function() { handleSort("lead_status"); }} style={{ display: "inline-block" }}>
                            Lead Status {arrow("lead_status")}
                          </div>
                          <select
                            value={filterLeadStatus}
                            onChange={function(e) { e.stopPropagation(); setFilterLeadStatus(e.target.value); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            style={{ ...filterSelectStyle, minWidth: 100 }}
                          >
                            <option value="">All groups</option>
                            {LEAD_STATUSES_GROUPS.map(function(g) {
                              return <option key={g.value} value={g.value}>{g.label}</option>;
                            })}
                          </select>
                        </th>}

                        {/* Purpose - sortable + filterable */}
                        {sdColVisible("purpose") && <th style={{ ...clickTh, position: "relative" }}>
                          <div onClick={function() { handleSort("loan_purpose"); }} style={{ display: "inline-block" }}>
                            Purpose {arrow("loan_purpose")}
                          </div>
                          <select value={filterPurpose} onChange={function(e) { e.stopPropagation(); setFilterPurpose(e.target.value); }} onClick={function(e) { e.stopPropagation(); }} style={{ ...filterSelectStyle, minWidth: 80 }}>
                            <option value="">All</option>
                            <option value="purchase">Purchase</option>
                            <option value="refi">Refi</option>
                          </select>
                          {rh("purpose",90)}
                        </th>}

                        {/* FU columns */}
                        {sdColVisible("fu_date") && <th style={{ ...clickTh, position: "relative" }} onClick={function() { handleSort("fu_date"); }}>
                          FU Next {arrow("fu_date")}{rh("fu_date",75)}
                        </th>}

                        {sdColVisible("fu_who") && <th style={{ ...clickTh, position: "relative" }}>
                          <div onClick={function() { handleSort("fu_who"); }} style={{ display: "inline-block" }}>FU Who {arrow("fu_who")}</div>
                          <select value={filterFuWho} onChange={function(e) { e.stopPropagation(); setFilterFuWho(e.target.value); }} onClick={function(e) { e.stopPropagation(); }} style={{ ...filterSelectStyle, minWidth: 80 }}>
                            <option value="">All</option>
                            <option value="_none">— None —</option>
                            {[...new Set(Object.values(contactsMap).map(function(c) { return c.fu_who; }).filter(Boolean))].sort().map(function(w) { return <option key={w} value={w}>{w}</option>; })}
                          </select>
                          {rh("fu_who",80)}
                        </th>}

                        {sdColVisible("fu_priority") && <th style={{ ...clickTh, position: "relative" }}>
                          <div onClick={function() { handleSort("fu_priority"); }} style={{ display: "inline-block" }}>FU Priority {arrow("fu_priority")}</div>
                          <select value={filterFuPriority} onChange={function(e) { e.stopPropagation(); setFilterFuPriority(e.target.value); }} onClick={function(e) { e.stopPropagation(); }} style={{ ...filterSelectStyle, minWidth: 80 }}>
                            <option value="">All</option>
                            <option value="_none">— None —</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                          {rh("fu_priority",90)}
                        </th>}

                        {sdColVisible("note_quick") && <th style={{ ...thStyle, position: "relative" }}>Quick Notes{rh("note_quick",150)}</th>}

                        {/* Created — sortable (hidden in task view) */}
                        {!isTaskView && sdColVisible("createdAt") && (
                          <th style={{ ...clickTh, position: "relative" }} onClick={function() { handleSort("createdAt"); }}>
                            Created {arrow("createdAt")}{rh("createdAt",75)}
                          </th>
                        )}

                        {/* Loan Officer (hidden in task view) */}
                        {!isTaskView && sdColVisible("creator") && <th style={{ ...thStyle, position: "relative" }}>Creator{rh("creator",110)}</th>}

                        {/* Three-dot menu column */}
                        {!isTaskView && <th style={{ ...thStyle, width: 40 }}></th>}
                      </React.Fragment>
                    );
                  })()}
                </tr>
              </thead>
              <tbody>
                {filtered.map(function(scenario) {
                  const ls      = scenario.lead_status || "";
                  const lsColor = getLeadStatusColors(ls);
                  const contact = contactsMap[scenario.contact_id] || null;
                  const contactName = contact
                    ? ((contact.first_name || "") + " " + (contact.last_name || "")).trim()
                    : "";

                  const isLastRow = filtered[filtered.length - 1].id === scenario.id;
                  const rowBorderStyle = isLastRow && auditLogOpen !== scenario.id && editDetailsOpen !== scenario.id
                    ? "none" : ("1px solid " + c.border);

                  return (
                    <React.Fragment key={scenario.id}>
                      <tr
                        onClick={function() { onSelectScenario(scenario); }}
                        style={{
                          borderBottom: rowBorderStyle, cursor: "pointer",
                          background: selectedIds.includes(scenario.id) ? "rgba(37,99,235,0.07)" : "transparent",
                        }}
                        onMouseEnter={function(e) {
                          if (!selectedIds.includes(scenario.id))
                            e.currentTarget.style.background = "rgba(37,99,235,0.04)";
                        }}
                        onMouseLeave={function(e) {
                          e.currentTarget.style.background = selectedIds.includes(scenario.id)
                            ? "rgba(37,99,235,0.07)" : "transparent";
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ ...tdStyle, textAlign: "center", width: 36 }}
                            onClick={function(e) { e.stopPropagation(); }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(scenario.id)}
                            onChange={function(e) {
                              const id = scenario.id;
                              setSelectedIds(function(prev) {
                                return e.target.checked
                                  ? [...prev, id]
                                  : prev.filter(function(x) { return x !== id; });
                              });
                            }}
                            style={{ cursor: "pointer" }}
                          />
                        </td>

                        {/* Contact Name */}
                        {sdColVisible("contact") && <td style={tdStyle} onClick={function(e) { e.stopPropagation(); }}>
                          {(contactName && onOpenContact && scenario.contact_id)
                            ? <a href={"/contacts/" + scenario.contact_id} onClick={function(e) { e.preventDefault(); onOpenContact(scenario.contact_id); }} style={{ fontWeight: 500, whiteSpace: "nowrap", color: "#60a5fa", cursor: "pointer", textDecoration: "underline" }}>{contactName}</a>
                            : <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{contactName || <span style={{ color: c.textSecondary || "#aaa" }}>—</span>}</span>}
                        </td>}

                        {/* Scenario Name */}
                        {sdColVisible("scenario") && <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <a href={"/scenarios/" + scenario.id} onClick={function(e) { e.preventDefault(); onSelectScenario(scenario); }} style={{ fontWeight: 500, color: "#60a5fa", textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }}>{scenario.clientName}</a>
                            {user.isInternal && referralScenarioIds.has(scenario.id) && (
                              <span title="Referred by a partner" style={{ fontSize: "10px", fontWeight: 700, background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap" }}>⭐ Referred</span>
                            )}
                            {(shareCountsMap[scenario.id] || 0) > 0 && (
                              <span title="Shared with partner(s)" style={{ fontSize: "10px", fontWeight: 700, background: "rgba(37,99,235,0.1)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap" }}>🔗 {shareCountsMap[scenario.id]} shared</span>
                            )}
                            {user.isInternal && scenario.lmt_deal_id && (
                              <span
                                title="In Loan Manager — click to open"
                                onClick={function(e) {
                                  e.stopPropagation();
                                  var lmtUrl = window.location.href.replace(/[^\/]*$/, "") + "loan-manager.html?deal=" + scenario.lmt_deal_id;
                                  window.open(lmtUrl, "_blank");
                                }}
                                style={{ fontSize: "10px", fontWeight: 700, background: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.25)", borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap", cursor: "pointer" }}
                              >↗ LMT</span>
                            )}
                          </div>
                        </td>}

                        {/* Lead Status */}
                        {sdColVisible("lead_status") && <td style={tdStyle} onClick={function(e) { e.stopPropagation(); }}>
                          <LeadStatusSelect value={ls} onChange={function(e) { changeLeadStatus(scenario, e.target.value); }} style={{ padding: "3px 5px", borderRadius: "5px", border: "1px solid " + c.border, background: lsColor.bg, color: lsColor.text, fontSize: "11px", fontWeight: 600, cursor: "pointer", outline: "none", maxWidth: "150px", width: "100%" }} />
                        </td>}

                        {/* Purpose */}
                        {sdColVisible("purpose") && <td style={tdStyle}>
                          {(() => {
                            const lp = scenario.loan_purpose || "purchase";
                            const isRefi = lp.startsWith("refi");
                            return (
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap", background: isRefi ? "rgba(59,130,246,0.12)" : "rgba(34,197,94,0.12)", color: isRefi ? "#1d4ed8" : "#15803d" }}>
                                {isRefi ? "Refi" : "Purchase"}
                              </span>
                            );
                          })()}
                        </td>}

                        {/* FU fields from linked contact — inline editable */}
                        {(true) && (() => {
                          const cid = scenario.contact_id;
                          const ct = contactsMap[cid] || {};
                          const noCt = !cid;
                          const fuWhoOpts = ((user && user.fuWhoOptions) || "").split(",").map(function(s) { return s.trim(); }).filter(Boolean);
                          const inCell = { padding: "0 2px", margin: 0, border: "none", borderBottom: "1px solid " + (c.border || "#ddd"), background: "transparent", fontFamily: font, fontSize: "12px", color: c.text, width: "100%", outline: "none" };
                          async function patchFu(field, value) {
                            if (!cid || !patchContactInSupabase) return;
                            const patch = { [field]: value || null };
                            const { error } = await patchContactInSupabase(cid, patch);
                            if (!error) setContactsMap(function(prev) { return { ...prev, [cid]: { ...(prev[cid] || {}), ...patch } }; });
                          }
                          const dash = <span style={{ color: c.textSecondary || "#aaa" }}>—</span>;
                          return (
                            <React.Fragment>
                              {sdColVisible("fu_date") && <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "12px" }} onClick={function(e) { e.stopPropagation(); }}>
                                {noCt ? dash : <input type="text" defaultValue={ct.fu_date ? (function(d){ var p=d.split("-"); return p.length>=3?p[1]+"/"+p[2]:d; })(ct.fu_date) : ""} placeholder="" onBlur={function(e) { var raw=e.target.value.trim(); if(!raw){patchFu("fu_date",null);return;} var m=raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/); if(!m)return; var yr=m[3]?(m[3].length===2?"20"+m[3]:m[3]):(ct.fu_date?ct.fu_date.split("-")[0]:new Date().getFullYear().toString()); patchFu("fu_date",yr+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0")); }} style={{ ...inCell, width: "48px" }} />}
                              </td>}
                              {sdColVisible("fu_who") && <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "12px" }} onClick={function(e) { e.stopPropagation(); }}>
                                {noCt ? dash : (<React.Fragment><input type="text" list={"fu-who-list-" + scenario.id} defaultValue={ct.fu_who || ""} placeholder="" onBlur={function(e) { patchFu("fu_who", e.target.value); }} style={inCell} /><datalist id={"fu-who-list-" + scenario.id}>{fuWhoOpts.map(function(o) { return <option key={o} value={o} />; })}</datalist></React.Fragment>)}
                              </td>}
                              {sdColVisible("fu_priority") && <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "12px" }} onClick={function(e) { e.stopPropagation(); }}>
                                {noCt ? dash : <select defaultValue={ct.fu_priority || ""} onChange={function(e) { patchFu("fu_priority", e.target.value); }} style={{ ...inCell, cursor: "pointer" }}><option value="">—</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>}
                              </td>}
                              {sdColVisible("note_quick") && <td style={{ ...tdStyle, fontSize: "12px", maxWidth: 160 }} onClick={function(e) { e.stopPropagation(); }}>
                                {noCt ? dash : <input type="text" defaultValue={ct.note_quick || ""} placeholder="" onBlur={function(e) { patchFu("note_quick", e.target.value); }} style={{ ...inCell, maxWidth: 150 }} />}
                              </td>}
                            </React.Fragment>
                          );
                        })()}

                        {/* Created (hidden in task view) */}
                        {!isTaskView && sdColVisible("createdAt") && (
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            <span style={{ color: c.textSecondary || "#888", fontSize: "12px" }}>{formatDate(scenario.createdAt)}</span>
                          </td>
                        )}

                        {/* Loan Officer (hidden in task view) */}
                        {!isTaskView && sdColVisible("creator") && (
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "12px", color: c.text }}>{scenario.createdByName || <span style={{ color: c.textSecondary || "#aaa" }}>—</span>}</span>
                          </td>
                        )}

                        {/* Three-dot menu */}
                        {!isTaskView && (
                          <td style={{ ...tdStyle, textAlign: "center", width: 40 }} onClick={function(e) { e.stopPropagation(); }}>
                            <div style={{ position: "relative", display: "inline-block" }}>
                              <button
                                onClick={function(e) {
                                  e.stopPropagation();
                                  if (openMenuId === scenario.id) {
                                    setOpenMenuId(null); setMenuPos(null);
                                  } else {
                                    var rect = e.currentTarget.getBoundingClientRect();
                                    setOpenMenuId(scenario.id);
                                    setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                  }
                                }}
                                style={{
                                  background: openMenuId === scenario.id ? (c.bgAlt || "rgba(0,0,0,0.06)") : "transparent",
                                  border: "1px solid " + (openMenuId === scenario.id ? c.border : "transparent"),
                                  borderRadius: 6, cursor: "pointer",
                                  padding: "3px 7px", fontSize: 16,
                                  color: c.text, lineHeight: 1,
                                }}
                              >⋯</button>

                              {openMenuId === scenario.id && menuPos && (
                                <div
                                  onClick={function(e) { e.stopPropagation(); }}
                                  style={{
                                    position: "fixed", top: menuPos.top, right: menuPos.right, zIndex: 9999,
                                    background: c.bg || "#fff",
                                    border: "1px solid " + c.border,
                                    borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                                    minWidth: 180, padding: "6px 0",
                                  }}
                                >
                                  {(function() {
                                    const menuItem = function(label, onClick, color) {
                                      return React.createElement("button", {
                                        key: label,
                                        onClick: function() { setOpenMenuId(null); onClick(); },
                                        style: {
                                          display: "block", width: "100%", textAlign: "left",
                                          padding: "8px 16px", background: "transparent",
                                          border: "none", cursor: "pointer",
                                          fontSize: 13, fontFamily: "inherit",
                                          color: color || c.text,
                                        },
                                        onMouseEnter: function(e) { e.currentTarget.style.background = c.bgAlt || "rgba(0,0,0,0.04)"; },
                                        onMouseLeave: function(e) { e.currentTarget.style.background = "transparent"; },
                                      }, label);
                                    };
                                    const items = [];
                                    if (isCloudUser && user.isInternal)
                                      items.push(menuItem("✏️  Rename", async function() {
                                        const current = scenario.clientName || scenario.name || "";
                                        const newName = window.prompt("Rename scenario:", current);
                                        if (newName === null || newName.trim() === "" || newName.trim() === current) return;
                                        const { error } = await saveScenarioToSupabase({ scenarioId: scenario.id, name: newName.trim() });
                                        if (error) { alert("Could not rename: " + error.message); return; }
                                        setScenarios(function(prev) { return prev.map(function(s) { return s.id === scenario.id ? Object.assign({}, s, { clientName: newName.trim() }) : s; }); });
                                      }));
                                    if (isCloudUser && scenario.contact_id)
                                      items.push(menuItem("📝  Add Note", function() { setNoteModalScenario(scenario); setNoteText(""); setNoteSaved(false); }));
                                    if (isCloudUser)
                                      items.push(menuItem("📜  Activity Log", function() { toggleAuditLog(scenario.id); }));
                                    if (isCloudUser && user.isInternal)
                                      items.push(menuItem("✏️  Edit Details", function() {
                                        if (editDetailsOpen === scenario.id) { setEditDetailsOpen(null); setEditDetailsForm({}); }
                                        else {
                                          setEditDetailsOpen(scenario.id);
                                          setEditDetailsForm({
                                            loan_purpose:           scenario.loan_purpose           || "purchase",
                                            property_address:       scenario.property_address       || "",
                                            lead_source:            scenario.lead_source            || "",
                                            target_close_date:      scenario.target_close_date      || "",
                                            actual_close_date:      scenario.actual_close_date      || "",
                                            co_borrower_contact_id: scenario.co_borrower_contact_id || "",
                                          });
                                        }
                                      }));
                                    if (isCloudUser && user.isInternal)
                                      items.push(menuItem("📋  Save as Template", function() {
                                        setSaveTemplateModal({ scenarioId: scenario.id, calculatorData: scenario.calculatorData || {}, loanPurpose: scenario.loan_purpose || "purchase" });
                                        setSaveTemplateName(scenario.clientName || "");
                                        setSaveTemplateDesc("");
                                        setSaveTemplateIsGlobal(false);
                                      }));
                                    if (isCloudUser && user.isInternal && partnerProfiles.length > 0)
                                      items.push(menuItem("🔗  Share with Partner", function() {
                                        setShareModalScenario(scenario);
                                        setSharePartnerId(""); setSharePermission("view"); setShareNote("");
                                      }));
                                    if (isCloudUser && user.isInternal) {
                                      if (scenario.lmt_deal_id) {
                                        // Already pushed — show View link
                                        items.push(menuItem("↗  View in Loan Manager", function() {
                                          var lmtUrl = window.location.href.replace(/[^\/]*$/, "") + "loan-manager.html?deal=" + scenario.lmt_deal_id;
                                          window.open(lmtUrl, "_blank");
                                        }));
                                      } else {
                                        // Not yet pushed — show Send button
                                        items.push(menuItem("📤  Send to Loan Manager", async function() {
                                          const calcData = scenario.calculatorData || {};
                                          const contact = contactsMap[scenario.contact_id] || null;
                                          // Map loan program key → LMT label
                                          const progMap = { conventional:"Conv", fha:"FHA", va:"VA", usda:"USDA", jumbo:"Jumbo", heloc:"HELOC" };
                                          const rawProg = calcData["pc_prog"] || "";
                                          const loanProgram = progMap[rawProg] || rawProg || "";
                                          const transType = (scenario.loan_purpose || "purchase").startsWith("refi") ? "refinance" : "purchase";
                                          // Map HLT lead_status → LMT deal status
                                          const ls = scenario.lead_status || "";
                                          const lmtStatus = (!ls || ls === "?") ? "(A) Loan App: Sent"
                                            : (ls.startsWith("(") || /^\d{2}\./.test(ls)) ? ls
                                            : "(A) Loan App: Sent";
                                          // Build borrower name from the linked contact, fall back to scenario name
                                          const contactName = contact
                                            ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
                                            : "";
                                          const payload = {
                                            primary_borrower_name:  contactName || scenario.clientName || "",
                                            primary_contact_id:     scenario.contact_id || null,
                                            primary_borrower_email: contact ? (contact.email_personal || contact.email_work || "") : "",
                                            primary_borrower_phone: contact ? (contact.phone_cell || contact.phone_work || "") : "",
                                            property_address:       scenario.property_address || (contact ? (contact.address || "") : ""),
                                            city:                   contact ? (contact.city  || "") : "",
                                            state:                  contact ? (contact.state || "") : "",
                                            zip:                    contact ? (contact.zip   || "") : "",
                                            loan_amount:            parseFloat(calcData["pc_la"])   || null,
                                            rate:                   parseFloat(calcData["pc_rate"]) || null,
                                            loan_term:              parseInt(calcData["pc_term"])   || 30,
                                            loan_program:           loanProgram,
                                            trans_type:             transType,
                                            closing_date:           scenario.target_close_date || null,
                                            assigned_lo_id:         (contact ? contact.assigned_lo_id : null) || user?.id || null,
                                            quick_note:             scenario.notes || "",
                                            hlt_scenario_name:      scenario.clientName || "",
                                            status:                 lmtStatus,
                                            occupancy: (function() {
                                              var occ = calcData["occupancy"] || calcData["pc_occupancy"] || "primary";
                                              if (occ === "investor" || occ === "investment") return "investment";
                                              if (occ === "secondary") return "secondary";
                                              return "primary";
                                            })(),
                                          };
                                          var supabase = window._supabaseClient;
                                          var { data: dealData, error } = await supabase.from("lmt_deals").insert(payload).select().single();
                                          if (error) { alert("Could not send to Loan Manager: " + error.message); return; }
                                          // Write lmt_deal_id back to the scenario row
                                          await supabase.from("scenarios").update({ lmt_deal_id: dealData.id }).eq("id", scenario.id);
                                          // Reflect in local state so the badge / menu swap immediately
                                          setScenarios(function(prev) {
                                            return prev.map(function(s) {
                                              return s.id === scenario.id ? Object.assign({}, s, { lmt_deal_id: dealData.id }) : s;
                                            });
                                          });
                                          // Open LMT to the new deal
                                          var lmtUrl = window.location.href.replace(/[^\/]*$/, "") + "loan-manager.html?deal=" + dealData.id;
                                          window.open(lmtUrl, "_blank");
                                        }));
                                      }
                                    }
                                    if (user.isInternal) {
                                      if (items.length > 0)
                                        items.push(React.createElement("div", { key: "div1", style: { height: 1, background: c.border, margin: "4px 0" } }));
                                      items.push(menuItem("📦  Archive", function() {
                                        if (!confirm("Archive this scenario? It will move to the Archived tab.")) return;
                                        changeLeadStatus(scenario, "z- Lead");
                                      }, "#b45309"));
                                    }
                                    if (isCloudUser && user.role === "admin") {
                                      items.push(menuItem("🗑  Delete", function() { deleteScenario(scenario.id); }, "#ef4444"));
                                    }
                                    return items;
                                  })()}
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* ── Audit Log expanded row ── */}
                      {auditLogOpen === scenario.id && (
                        <tr>
                          <td colSpan={15} style={{ padding: 0, borderBottom: "1px solid " + c.border }}>
                            <div style={{
                              padding: "12px 20px", fontSize: "13px",
                              maxHeight: "220px", overflowY: "auto",
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: "8px" }}>📜 Activity Log</div>
                              {auditLogLoading && <div style={{ color: c.textSecondary }}>Loading...</div>}
                              {!auditLogLoading && auditLogData.length === 0 && (
                                <div style={{ color: c.textSecondary, fontStyle: "italic" }}>No activity recorded yet.</div>
                              )}
                              {!auditLogLoading && auditLogData.map(function(entry, idx) {
                                const actionLabels = {
                                  created: "🆕 Created", updated: "✏️ Updated", deleted: "🗑️ Deleted",
                                  locked_fees: "🔒 Locked (Fees)", locked_full: "🔒 Locked (Full)",
                                  unlocked: "🔓 Unlocked", duplicated: "📋 Duplicated",
                                  status_changed: "📊 Status Changed", lead_status_changed: "🏷️ Lead Status Changed",
                                  claimed: "✅ Claimed",
                                };
                                const dt = new Date(entry.created_at);
                                const timeStr = dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
                                  + " at " + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                                return (
                                  <div key={entry.id || idx} style={{
                                    display: "flex", gap: "8px", padding: "6px 0", alignItems: "baseline",
                                    borderBottom: idx < auditLogData.length - 1 ? "1px solid " + c.border : "none",
                                  }}>
                                    <span style={{ minWidth: "160px", fontWeight: 500 }}>{actionLabels[entry.action] || entry.action}</span>
                                    <span style={{ color: "#7c3aed", fontWeight: 500 }}>{entry._user_name}</span>
                                    <span style={{ color: c.textSecondary, marginLeft: "auto", whiteSpace: "nowrap" }}>{timeStr}</span>
                                    {entry.note && <span style={{ color: c.textSecondary, fontStyle: "italic" }}>— {entry.note}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── Edit Details expanded row ── */}
                      {isCloudUser && user.isInternal && editDetailsOpen === scenario.id && (
                        <tr>
                          <td colSpan={15} style={{ padding: 0, borderBottom: "1px solid " + c.border }}
                              onClick={function(e) { e.stopPropagation(); }}>
                            <div style={{ padding: "16px 20px" }}>
                              <div style={{ fontWeight: 600, marginBottom: "12px", fontSize: "13px" }}>✏️ Edit Lead Details</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                                <div>
                                  <label style={{ display: "block", fontSize: "12px", color: c.textSecondary || "#888", marginBottom: "3px" }}>Loan Purpose</label>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 0" }}>
                                    <span style={{
                                      display: "inline-block", padding: "3px 10px", borderRadius: "12px",
                                      fontSize: "12px", fontWeight: 600,
                                      background: (scenario.loan_purpose || "purchase").startsWith("refi") ? "#dbeafe" : "#dcfce7",
                                      color: (scenario.loan_purpose || "purchase").startsWith("refi") ? "#1d4ed8" : "#15803d",
                                    }}>
                                      {(LOAN_PURPOSES.find(function(p) { return p.value === (scenario.loan_purpose || "purchase"); }) || {}).label || "Purchase"}
                                    </span>
                                    <span style={{ fontSize: "11px", color: c.textSecondary || "#888" }}>locked at creation</span>
                                  </div>
                                </div>
                                <div>
                                  <label style={{ display: "block", fontSize: "12px", color: c.textSecondary || "#888", marginBottom: "3px" }}>Lead Source</label>
                                  <input type="text" placeholder="e.g. Zillow, Referral…"
                                    value={editDetailsForm.lead_source || ""}
                                    onChange={function(e) { setEditDetailsForm(function(p) { return { ...p, lead_source: e.target.value }; }); }}
                                    style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
                                  />
                                </div>
                              </div>
                              <div style={{ marginBottom: "10px" }}>
                                <label style={{ display: "block", fontSize: "12px", color: c.textSecondary || "#888", marginBottom: "3px" }}>Subject Property Address</label>
                                <input type="text" placeholder="e.g. 123 Main St, Dallas TX 75201"
                                  value={editDetailsForm.property_address || ""}
                                  onChange={function(e) { setEditDetailsForm(function(p) { return { ...p, property_address: e.target.value }; }); }}
                                  style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
                                />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                                <div>
                                  <label style={{ display: "block", fontSize: "12px", color: c.textSecondary || "#888", marginBottom: "3px" }}>Target Close Date</label>
                                  <input type="date"
                                    value={editDetailsForm.target_close_date || ""}
                                    onChange={function(e) { setEditDetailsForm(function(p) { return { ...p, target_close_date: e.target.value }; }); }}
                                    style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: "block", fontSize: "12px", color: c.textSecondary || "#888", marginBottom: "3px" }}>Actual Close Date</label>
                                  <input type="date"
                                    value={editDetailsForm.actual_close_date || ""}
                                    onChange={function(e) { setEditDetailsForm(function(p) { return { ...p, actual_close_date: e.target.value }; }); }}
                                    style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
                                  />
                                </div>
                              </div>
                              {/* Co-borrower contact picker */}
                              <div style={{ marginBottom: "12px" }}>
                                <label style={{ display: "block", fontSize: "12px", color: c.textSecondary || "#888", marginBottom: "3px" }}>
                                  Co-Borrower Contact
                                  <span style={{ marginLeft: "6px", fontWeight: 400, opacity: 0.7 }}>(optional — gives them read-only access)</span>
                                </label>
                                <select
                                  value={editDetailsForm.co_borrower_contact_id || ""}
                                  onChange={function(e) { setEditDetailsForm(function(p) { return { ...p, co_borrower_contact_id: e.target.value || null }; }); }}
                                  style={{ ...inputStyle, fontSize: "13px", padding: "7px 10px" }}
                                >
                                  <option value="">— None —</option>
                                  {contactOptions.filter(function(ct) { return ct.id !== scenario.contact_id; }).map(function(ct) {
                                    const name = ((ct.first_name || "") + " " + (ct.last_name || "")).trim();
                                    const email = ct.email_personal || ct.email_work || ct.email || "";
                                    return <option key={ct.id} value={ct.id}>{name}{email ? " (" + email + ")" : ""}</option>;
                                  })}
                                </select>
                                {editDetailsForm.co_borrower_contact_id && (
                                  <div style={{ fontSize: "11px", color: c.textSecondary || "#888", marginTop: "4px" }}>
                                    This contact will be able to log in and view this scenario.
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                  onClick={function() { saveEditDetails(scenario); }}
                                  disabled={editDetailsSaving}
                                  style={{
                                    background: editDetailsSaving ? "#93b4f5" : "#2563eb",
                                    color: "#fff", border: "none", borderRadius: "6px",
                                    padding: "7px 18px", fontSize: "13px", fontWeight: 600,
                                    cursor: editDetailsSaving ? "not-allowed" : "pointer",
                                    opacity: editDetailsSaving ? 0.7 : 1,
                                  }}
                                >{editDetailsSaving ? "Saving\u2026" : "Save Details"}</button>
                                <button
                                  onClick={function() { setEditDetailsOpen(null); setEditDetailsForm({}); }}
                                  style={{
                                    background: "transparent", color: c.textSecondary || c.text,
                                    border: "1px solid " + c.border, borderRadius: "6px",
                                    padding: "7px 14px", fontSize: "13px", cursor: "pointer",
                                  }}
                                >Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Borrower Scenario Table ───────────────────────────────── */}
        {!user.isInternal && !isPartner && !sharedWithMeTab && filtered.length > 0 && (
          <div style={{ overflowX: "auto", background: c.cardBg, border: "1px solid " + c.border, borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid " + c.border }}>
                  <th style={thStyle}>Scenario Name</th>
                  <th style={thStyle}>Loan Amount</th>
                  <th style={thStyle}>Interest Rate</th>
                  <th style={thStyle}>Loan Term</th>
                  <th style={thStyle}>Monthly Payment</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(function(scenario) {
                  const d = scenario.calculatorData || {};
                  function parseN(v) {
                    if (v === null || v === undefined) return 0;
                    try { const p = JSON.parse(v); return parseFloat(p) || 0; } catch { return parseFloat(v) || 0; }
                  }
                  const la   = parseN(d["pc_la"]);
                  const rate = parseN(d["pc_rate"]);
                  const term = parseN(d["pc_term"]);
                  const r = rate / 100 / 12;
                  const n = term * 12;
                  const payment = (la > 0 && r > 0 && n > 0)
                    ? la * r / (1 - Math.pow(1 + r, -n))
                    : (la > 0 && n > 0 ? la / n : 0);
                  const fmtDollar = function(v) {
                    return v > 0 ? "$" + Math.round(v).toLocaleString("en-US") : "—";
                  };
                  const isLastRow = filtered[filtered.length - 1].id === scenario.id;
                  return (
                    <tr
                      key={scenario.id}
                      onClick={function() { onSelectScenario(scenario); }}
                      style={{
                        borderBottom: isLastRow ? "none" : "1px solid " + c.border,
                        cursor: "pointer",
                        background: "transparent",
                      }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(37,99,235,0.04)"; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{scenario.clientName}</td>
                      <td style={tdStyle}>{fmtDollar(la)}</td>
                      <td style={tdStyle}>{rate ? rate.toFixed(2) + "%" : "—"}</td>
                      <td style={tdStyle}>{term ? term + " years" : "—"}</td>
                      <td style={tdStyle}>{payment > 0 ? fmtDollar(payment) + "/mo" : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }} onClick={function(e) { e.stopPropagation(); }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          {isPartner && (
                            referredIds.has(scenario.id)
                              ? <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 99, padding: "3px 10px", whiteSpace: "nowrap" }}>⭐ Referred</span>
                              : <button onClick={function() { setReferringId(scenario.id); setReferNote(""); }}
                                  style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                                  ⭐ Refer
                                </button>
                          )}
                          <a
                            href={"/scenarios/" + scenario.id}
                            onClick={function(e) { e.preventDefault(); onSelectScenario(scenario); }}
                            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
                            Open →
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}


        {/* ── Partner: My Pipeline / Shared With Me tab switcher ──────── */}
        {isPartner && isCloudUser && (
          <div style={{ marginTop: 32 }}>
            {/* Sub-tab switcher */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "2px solid " + c.border }}>
              {[
                { key: false, label: "My Pipeline" },
                { key: true,  label: "Shared With Me" + (sharedWithMe.length > 0 ? " (" + sharedWithMe.length + ")" : "") },
              ].map(function(t) {
                const active = sharedWithMeTab === t.key;
                return (
                  <button key={String(t.key)} onClick={function() { setSharedWithMeTab(t.key); }}
                    style={{
                      background: "transparent", border: "none",
                      borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent",
                      marginBottom: "-2px", padding: "8px 16px",
                      fontSize: "14px", fontWeight: active ? 700 : 400,
                      color: active ? "#7c3aed" : (c.textSecondary || "#888"),
                      cursor: "pointer",
                    }}
                  >{t.label}</button>
                );
              })}
            </div>

            {/* ── Shared With Me table ── */}
            {sharedWithMeTab && (
              sharedWithMe.length === 0
                ? <div style={{ textAlign: "center", padding: "40px 24px", background: c.cardBg, borderRadius: 12, border: "1px solid " + c.border, color: c.textSecondary }}>
                    No scenarios have been shared with you yet.
                  </div>
                : <div style={{ overflowX: "auto", background: c.cardBg, border: "1px solid " + c.border, borderRadius: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid " + c.border }}>
                          <th style={thStyle}>Scenario Name</th>
                          <th style={thStyle}>Purpose</th>
                          <th style={thStyle}>Shared By</th>
                          <th style={thStyle}>Date Shared</th>
                          <th style={thStyle}>Note</th>
                          <th style={thStyle}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sharedWithMe.map(function(scenario) {
                          const share = scenario._share || {};
                          const lp = scenario.loan_purpose || "purchase";
                          const isRefi = lp.startsWith("refi");
                          const isLast = sharedWithMe[sharedWithMe.length - 1].id === scenario.id;
                          return (
                            <tr key={scenario.id}
                              onClick={function() { onSelectScenario(scenario); }}
                              style={{ borderBottom: isLast ? "none" : "1px solid " + c.border, cursor: "pointer" }}
                              onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(124,58,237,0.04)"; }}
                              onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
                            >
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{scenario.clientName}</td>
                              <td style={tdStyle}>
                                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: isRefi ? "rgba(59,130,246,0.12)" : "rgba(34,197,94,0.12)", color: isRefi ? "#1d4ed8" : "#15803d" }}>
                                  {isRefi ? "Refi" : "Purchase"}
                                </span>
                              </td>
                              <td style={tdStyle}>{scenario._shared_by_name || "—"}</td>
                              <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 12, color: c.textSecondary }}>
                                {share.created_at ? new Date(share.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "—"}
                              </td>
                              <td style={{ ...tdStyle, fontSize: 12, maxWidth: 200 }}>
                                {share.note
                                  ? <span title={share.note}>{share.note.length > 60 ? share.note.slice(0, 60) + "…" : share.note}</span>
                                  : <span style={{ color: c.textSecondary }}>—</span>}
                              </td>
                              <td style={{ ...tdStyle, textAlign: "right" }} onClick={function(e) { e.stopPropagation(); }}>
                                <a href={"/scenarios/" + scenario.id}
                                  onClick={function(e) { e.preventDefault(); onSelectScenario(scenario); }}
                                  style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
                                  Open →
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
            )}

            {/* ── Partner: Refer to Mortgage Mark button on own scenarios ── */}
            {!sharedWithMeTab && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 24px", background: c.cardBg, borderRadius: 12, border: "1px solid " + c.border, color: c.textSecondary }}>
                No scenarios yet. Create one above to get started.
              </div>
            )}

            {!sharedWithMeTab && filtered.length > 0 && (
              <div style={{ overflowX: "auto", background: c.cardBg, border: "1px solid " + c.border, borderRadius: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid " + c.border }}>
                      <th style={thStyle}>Lead Status</th>
                      <th style={thStyle}>Contact</th>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Scenario Name</th>
                      <th style={thStyle}>Purpose</th>
                      <th style={thStyle}>Property</th>
                      <th style={thStyle}>Created</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(function(scenario) {
                      const ls       = scenario.lead_status || "";
                      const lsColor  = getLeadStatusColors(ls);
                      const contact  = contactsMap[scenario.contact_id] || null;
                      const contactName = contact
                        ? ((contact.first_name || "") + " " + (contact.last_name || "")).trim()
                        : "";
                      const lp     = scenario.loan_purpose || "purchase";
                      const isRefi = lp.startsWith("refi");
                      const isLast = filtered[filtered.length - 1].id === scenario.id;
                      return (
                        <tr key={scenario.id}
                          onClick={function() { onSelectScenario(scenario); }}
                          style={{ borderBottom: isLast ? "none" : "1px solid " + c.border, cursor: "pointer" }}
                          onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(124,58,237,0.04)"; }}
                          onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
                        >
                          {/* Lead Status */}
                          <td style={tdStyle} onClick={function(e) { e.stopPropagation(); }}>
                            <span style={{
                              display: "inline-block", padding: "3px 8px", borderRadius: 5,
                              fontSize: 12, fontWeight: 700,
                              background: lsColor.bg, color: lsColor.text,
                            }}>{ls || "—"}</span>
                          </td>

                          {/* Contact */}
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                              {contactName || <span style={{ color: c.textSecondary }}>—</span>}
                            </span>
                          </td>

                          {/* ID */}
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            {scenario.uid
                              ? <span style={{ fontFamily: "monospace", fontSize: 11, color: c.textSecondary, letterSpacing: "0.03em" }}>{scenario.uid}</span>
                              : <span style={{ color: c.textSecondary }}>—</span>}
                          </td>

                          {/* Scenario Name */}
                          <td style={tdStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <a href={"/scenarios/" + scenario.id} onClick={function(e) { e.preventDefault(); onSelectScenario(scenario); }} style={{ fontWeight: 500, color: "#60a5fa", textDecoration: "underline", cursor: "pointer", whiteSpace: "nowrap" }}>{scenario.clientName}</a>
                              {referredIds.has(scenario.id) && (
                                <span style={{ fontSize: 12, fontWeight: 700, background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 99, padding: "1px 7px", whiteSpace: "nowrap" }}>⭐ Referred</span>
                              )}
                            </div>
                          </td>

                          {/* Purpose */}
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 10,
                              fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                              background: isRefi ? "rgba(59,130,246,0.12)" : "rgba(34,197,94,0.12)",
                              color:      isRefi ? "#1d4ed8"               : "#15803d",
                            }}>
                              {isRefi ? "Refi" : "Purchase"}
                            </span>
                          </td>

                          {/* Property Address */}
                          <td style={{ ...tdStyle, fontSize: 12, maxWidth: 200 }}>
                            {scenario.property_address
                              ? <span title={scenario.property_address}>{scenario.property_address.length > 40 ? scenario.property_address.slice(0, 40) + "…" : scenario.property_address}</span>
                              : <span style={{ color: c.textSecondary }}>—</span>}
                          </td>

                          {/* Created */}
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                            <span style={{ color: c.textSecondary, fontSize: 12 }}>{formatDate(scenario.createdAt)}</span>
                          </td>

                          {/* Actions */}
                          <td style={{ ...tdStyle, whiteSpace: "nowrap" }} onClick={function(e) { e.stopPropagation(); }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                              {referredIds.has(scenario.id)
                                ? <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 99, padding: "3px 10px", whiteSpace: "nowrap" }}>⭐ Referred</span>
                                : <button onClick={function() { setReferringId(scenario.id); setReferNote(""); }}
                                    style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                                    ⭐ Refer
                                  </button>
                              }
                              <a href={"/scenarios/" + scenario.id}
                                onClick={function(e) { e.preventDefault(); onSelectScenario(scenario); }}
                                style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
                                Open →
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Client disclosure ─────────────────────────────────────── */}
        {!user.isInternal && (
          <div style={{
            marginTop: 32, paddingTop: 14,
            borderTop: "1px solid " + (c.border || "#e5eef4"),
            fontSize: 12, color: c.gray || "#94a3b8",
            lineHeight: 1.6, textAlign: "center",
          }}>
            Not a commitment to lend. All loans subject to credit approval and underwriting.
            Rates shown are estimates only and subject to change without notice.{" "}
            Mark Pfeiffer | NMLS #729612 | CMG Home Loans | NMLS #1820 | Equal Housing Lender |{" "}
            NMLS Consumer Access: www.nmlsconsumeraccess.org
          </div>
        )}

      </div>

      {/* ── Share with Partner Modal (LO) ──────────────────────────────────── */}
      {shareModalScenario && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onClick={function() { setShareModalScenario(null); }}>
          <div style={{ background: "#0f1f30", border: "1px solid #2a4a6a", borderRadius: 14, padding: "28px", minWidth: 340, maxWidth: 460, width: "90%", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}
            onClick={function(e) { e.stopPropagation(); }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>🔗 Share with Partner</div>
              <button onClick={resetShareModal} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 18 }}>
              Scenario: <strong style={{ color: "#fff" }}>{shareModalScenario.clientName}</strong>
            </div>

            {/* Mode tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #2a4a6a", marginBottom: 20 }}>
              {[
                { key: "existing", label: "Existing Partner" },
                { key: "invite",   label: "Invite New Partner" },
              ].map(function(tab) {
                var active = shareMode === tab.key;
                return (
                  <button key={tab.key} onClick={function() { setShareMode(tab.key); setShareInviteDone(null); }}
                    style={{
                      background: "transparent", border: "none", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                      marginBottom: "-1px", padding: "8px 16px", fontSize: 13, fontWeight: active ? 700 : 400,
                      color: active ? "#60a5fa" : "rgba(255,255,255,0.45)", cursor: "pointer",
                    }}>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Existing partner mode ── */}
            {shareMode === "existing" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Partner <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <select value={sharePartnerId} onChange={function(e) { setSharePartnerId(e.target.value); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + (!sharePartnerId ? "#f87171" : "#2a4a6a"), background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                    <option value="">— Select a Realtor or Builder —</option>
                    {partnerProfiles.map(function(p) {
                      return <option key={p.id} value={p.id}>{p.display_name || p.email} ({p.role})</option>;
                    })}
                  </select>
                  {partnerProfiles.length === 0 && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                      No partners in your account yet — use "Invite New Partner" to add one.
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Permission</label>
                  <select value={sharePermission} onChange={function(e) { setSharePermission(e.target.value); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                    <option value="view">View only</option>
                    <option value="collaborate">Collaborate (full access)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Note <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                  </label>
                  <input type="text" value={shareNote} onChange={function(e) { setShareNote(e.target.value); }}
                    placeholder="e.g. Working with this buyer on Oakwood subdivision"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button onClick={handleShareWithPartner} disabled={!sharePartnerId || shareSaving}
                    style={{ background: !sharePartnerId || shareSaving ? "#374151" : "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 14, fontWeight: 700, cursor: !sharePartnerId || shareSaving ? "not-allowed" : "pointer", opacity: (!sharePartnerId || shareSaving) ? 0.6 : 1 }}>
                    {shareSaving ? "Sharing…" : "Share Scenario"}
                  </button>
                  <button onClick={resetShareModal}
                    style={{ background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid #2a4a6a", borderRadius: 8, padding: "11px 24px", fontSize: 14, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>

                {/* ── Brokerage team share ── */}
                {(function() {
                  const brokerages = [...new Set(
                    partnerProfiles
                      .filter(function(p) { return p.brokerage && p.brokerage.trim(); })
                      .map(function(p) { return p.brokerage.trim(); })
                  )].sort();
                  if (brokerages.length === 0) return null;
                  const teamMembers = shareBrokerage
                    ? partnerProfiles.filter(function(p) { return p.brokerage === shareBrokerage; })
                    : [];
                  return (
                    <div style={{ borderTop: "1px solid #2a4a6a", paddingTop: 16, marginTop: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                        — or share with a whole brokerage team —
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={shareBrokerage}
                          onChange={function(e) { setShareBrokerage(e.target.value); setBrokerageShareResult(null); }}
                          style={{ flex: 1, minWidth: 160, padding: "9px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: shareBrokerage ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13, outline: "none" }}
                        >
                          <option value="">Select brokerage…</option>
                          {brokerages.map(function(b) {
                            const count = partnerProfiles.filter(function(p) { return p.brokerage === b; }).length;
                            return <option key={b} value={b}>{b} ({count})</option>;
                          })}
                        </select>
                        <button
                          onClick={handleShareWithBrokerage}
                          disabled={!shareBrokerage || shareSaving}
                          style={{
                            padding: "9px 18px", borderRadius: 8, border: "none",
                            background: !shareBrokerage || shareSaving ? "#374151" : "#0f766e",
                            color: "#fff", fontSize: 13, fontWeight: 700,
                            cursor: !shareBrokerage || shareSaving ? "not-allowed" : "pointer",
                            opacity: !shareBrokerage || shareSaving ? 0.6 : 1, whiteSpace: "nowrap",
                          }}
                        >
                          {shareSaving ? "Sharing…" : "Share with Team"}
                        </button>
                      </div>
                      {shareBrokerage && teamMembers.length > 0 && !brokerageShareResult && (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6 }}>
                          Will share with: {teamMembers.map(function(p) { return p.display_name || p.email; }).join(", ")}
                        </div>
                      )}
                      {brokerageShareResult && (
                        <div style={{ fontSize: 12, marginTop: 8, fontWeight: 600,
                          color: brokerageShareResult.failed > 0 ? "#f87171" : "#4ade80" }}>
                          {brokerageShareResult.failed > 0
                            ? "⚠️ " + brokerageShareResult.ok + "/" + brokerageShareResult.total + " shared (" + brokerageShareResult.failed + " failed)"
                            : "✅ Shared with all " + brokerageShareResult.ok + " members of " + shareBrokerage}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Invite new partner mode ── */}
            {shareMode === "invite" && !shareInviteDone && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 2 }}>
                  Enter their email and role. The scenario will be waiting in their "Shared With Me" tab the moment they sign up.
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Email <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input type="email" value={shareInviteEmail} onChange={function(e) { setShareInviteEmail(e.target.value); }}
                    placeholder="partner@email.com"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Role <span style={{ color: "#f87171" }}>*</span></label>
                  <select value={shareInviteRole} onChange={function(e) { setShareInviteRole(e.target.value); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                    <option value="realtor">Realtor</option>
                    <option value="builder">Builder</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Permission</label>
                  <select value={sharePermission} onChange={function(e) { setSharePermission(e.target.value); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
                    <option value="view">View only</option>
                    <option value="collaborate">Collaborate (full access)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Note <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                  </label>
                  <input type="text" value={shareNote} onChange={function(e) { setShareNote(e.target.value); }}
                    placeholder="e.g. Working with this buyer on Oakwood subdivision"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button onClick={handleInviteAndShare} disabled={!shareInviteEmail.trim() || shareSaving}
                    style={{ background: !shareInviteEmail.trim() || shareSaving ? "#374151" : "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 14, fontWeight: 700, cursor: !shareInviteEmail.trim() || shareSaving ? "not-allowed" : "pointer", opacity: !shareInviteEmail.trim() || shareSaving ? 0.6 : 1 }}>
                    {shareSaving ? "Saving…" : "Create Invite & Share"}
                  </button>
                  <button onClick={resetShareModal}
                    style={{ background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid #2a4a6a", borderRadius: 8, padding: "11px 24px", fontSize: 14, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── Invite success: copy-paste message ── */}
            {shareMode === "invite" && shareInviteDone && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4ade80", fontWeight: 700, fontSize: 14 }}>
                  ✓ Invite created — scenario is queued for {shareInviteEmail}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>
                  Copy the message below and send it to your partner however you like (text, email, etc.):
                </div>
                <textarea readOnly value={shareInviteDone} rows={9}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#0d1b2a", color: "#e2e8f0", fontSize: 12, lineHeight: 1.6, resize: "none", boxSizing: "border-box", fontFamily: "monospace", outline: "none" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={function() { navigator.clipboard && navigator.clipboard.writeText(shareInviteDone); }}
                    style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Copy Message
                  </button>
                  <button onClick={resetShareModal}
                    style={{ background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid #2a4a6a", borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Refer to LO Modal (Partner) ─────────────────────────────────────── */}
      {referringId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onClick={function() { setReferringId(null); setReferNote(""); }}>
          <div style={{ background: "#0f1f30", border: "1px solid #2a4a6a", borderRadius: 14, padding: "28px", minWidth: 340, maxWidth: 460, width: "90%", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}
            onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 8 }}>⭐ Refer to Mortgage Mark</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 20, lineHeight: 1.5 }}>
              This will notify the Mortgage Mark team that your client is ready for a mortgage conversation.
              They'll follow up and can access this scenario to hit the ground running.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Note <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>(optional)</span>
              </label>
              <input type="text" value={referNote} onChange={function(e) { setReferNote(e.target.value); }}
                placeholder="e.g. Pre-approved target $450k, looking to close by June"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={function() { handleReferToLO(referringId); }} disabled={referSaving}
                style={{ background: referSaving ? "#374151" : "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 14, fontWeight: 700, cursor: referSaving ? "not-allowed" : "pointer", opacity: referSaving ? 0.6 : 1 }}>
                {referSaving ? "Sending…" : "Send Referral →"}
              </button>
              <button onClick={function() { setReferringId(null); setReferNote(""); }}
                style={{ background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid #2a4a6a", borderRadius: 8, padding: "11px 24px", fontSize: 14, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save as Template Modal ──────────────────────────────────────── */}
      {saveTemplateModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
          }}
          onClick={function() { setSaveTemplateModal(null); setSaveTemplateName(""); setSaveTemplateDesc(""); setSaveTemplateIsGlobal(false); setSaveTemplateOverwriteId(""); }}
        >
          <div
            style={{
              background: "#0f1f30", border: "1px solid #2a4a6a",
              borderRadius: "14px", padding: "28px 28px 24px",
              minWidth: "340px", maxWidth: "480px", width: "90%",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
            onClick={function(e) { e.stopPropagation(); }}
          >
            <div style={{ fontSize: "17px", fontWeight: 700, color: "#fff", marginBottom: "20px" }}>
              📋 Save as Template
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                  TEMPLATE NAME <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  type="text"
                  value={saveTemplateName}
                  onChange={function(e) { setSaveTemplateName(e.target.value); }}
                  placeholder='e.g. "Standard Purchase", "Builder ABC", "FHA 3.5%"'
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                  DESCRIPTION <span style={{ fontSize: "10px", fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={saveTemplateDesc}
                  onChange={function(e) { setSaveTemplateDesc(e.target.value); }}
                  placeholder="e.g. Conv 5% down, standard CMG fees"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              {/* ── Update existing template picker ── */}
              {templates.length > 0 && (
                <div style={{ borderTop: "1px solid #2a4a6a", paddingTop: "14px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                    UPDATE EXISTING TEMPLATE <span style={{ fontSize: "10px", fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                  </label>
                  <select
                    value={saveTemplateOverwriteId}
                    onChange={function(e) {
                      const id = e.target.value;
                      setSaveTemplateOverwriteId(id);
                      if (id) {
                        const tpl = templates.find(function(t) { return t.id === id; });
                        if (tpl) {
                          setSaveTemplateName(tpl.name);
                          setSaveTemplateDesc(tpl.description || "");
                          setSaveTemplateIsGlobal(tpl.is_global || false);
                        }
                      }
                    }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #2a4a6a", background: "#1a3450", color: saveTemplateOverwriteId ? "#fbbf24" : "rgba(255,255,255,0.5)", fontSize: "14px", outline: "none" }}
                  >
                    <option value="">— Create new template —</option>
                    {templates.slice().sort(function(a,b) { return a.name.localeCompare(b.name); }).map(function(t) {
                      return <option key={t.id} value={t.id}>{t.name}{t.is_global ? " 🌐" : ""}</option>;
                    })}
                  </select>
                  {saveTemplateOverwriteId && (
                    <div style={{ fontSize: "11px", color: "#fbbf24", marginTop: "4px" }}>
                      ⚠️ This will overwrite the existing template's calculator values.
                    </div>
                  )}
                </div>
              )}
              {user.role === "admin" && (
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: "13px", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={saveTemplateIsGlobal}
                    onChange={function(e) { setSaveTemplateIsGlobal(e.target.checked); }}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  🌐 Share with the entire team (visible to all LOs)
                </label>
              )}
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", paddingTop: "2px" }}>
                All current calculator settings from this scenario will be saved to the template.
              </div>
              <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                <button
                  onClick={saveAsTemplate}
                  disabled={savingTemplate || !saveTemplateName.trim()}
                  style={{
                    background: (savingTemplate || !saveTemplateName.trim()) ? "#1d4ed8" : (saveTemplateOverwriteId ? "#b45309" : "#2563eb"),
                    color: "#fff", border: "none", borderRadius: "8px",
                    padding: "10px 26px", fontSize: "14px", fontWeight: 700,
                    cursor: (savingTemplate || !saveTemplateName.trim()) ? "not-allowed" : "pointer",
                    opacity: (savingTemplate || !saveTemplateName.trim()) ? 0.6 : 1,
                  }}
                >
                  {savingTemplate ? "Saving\u2026" : (saveTemplateOverwriteId ? "Update Template" : "Save Template")}
                </button>
                <button
                  onClick={function() { setSaveTemplateModal(null); setSaveTemplateName(""); setSaveTemplateDesc(""); setSaveTemplateIsGlobal(false); setSaveTemplateOverwriteId(""); }}
                  style={{
                    background: "transparent", color: "rgba(255,255,255,0.5)",
                    border: "1px solid #2a4a6a", borderRadius: "8px",
                    padding: "10px 20px", fontSize: "14px", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Note Modal ── */}
      {noteModalScenario && ReactDOM.createPortal(
        <div
          onClick={function() { if (!noteSaving) { setNoteModalScenario(null); setNoteText(""); } }}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={function(e) { e.stopPropagation(); }}
            style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0C4160", marginBottom: 4 }}>📝 Add Note</div>
            <div style={{ fontSize: 12, color: "#6B7D8A", marginBottom: 14 }}>
              {noteModalScenario.clientName || noteModalScenario.name || "Scenario"}
            </div>
            <textarea
              autoFocus
              value={noteText}
              onChange={function(e) { setNoteText(e.target.value); setNoteSaved(false); }}
              placeholder="Type your note here…"
              rows={5}
              style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #E0E8E8", borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", color: "#0C4160" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                onClick={function() { setNoteModalScenario(null); setNoteText(""); }}
                style={{ padding: "8px 18px", background: "#F0F4F8", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#6B7D8A" }}
              >Cancel</button>
              <button
                disabled={!noteText.trim() || noteSaving}
                onClick={async function() {
                  if (!noteText.trim() || noteSaving) return;
                  setNoteSaving(true);
                  const addNote = window.addContactNoteToSupabase;
                  if (addNote) await addNote({ contactId: noteModalScenario.contact_id, body: noteText.trim() });
                  setNoteSaving(false);
                  setNoteSaved(true);
                  setTimeout(function() { setNoteModalScenario(null); setNoteText(""); setNoteSaved(false); }, 800);
                }}
                style={{ padding: "8px 20px", background: noteSaved ? "#1B8A5A" : "#0C4160", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (!noteText.trim() || noteSaving) ? "not-allowed" : "pointer", color: "#fff", opacity: (!noteText.trim() || noteSaving) ? 0.5 : 1 }}
              >
                {noteSaved ? "✓ Saved!" : noteSaving ? "Saving…" : "Save Note"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    {/* ── Activity Report Modal ─────────────────────────────────────────── */}
    {showActivityReport && ReactDOM.createPortal(
      (() => {
        const isMobileAR = window.innerWidth < 700;
        return (
        <div
          onClick={function(e) { if (e.target === e.currentTarget) setShowActivityReport(false); }}
          style={isMobileAR
            ? { position: "fixed", inset: 0, background: "#fff", zIndex: 9000, display: "flex", flexDirection: "column", overflowY: "auto" }
            : { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}
        >
        <div style={isMobileAR
          ? { background: "#fff", width: "100%", flex: 1, display: "flex", flexDirection: "column", fontFamily: "'Inter', system-ui, sans-serif" }
          : { background: "#fff", borderRadius: 14, width: "100%", maxWidth: 860, boxShadow: "0 8px 40px rgba(0,0,0,0.2)", fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1e3a5f" }}>📊 Activity Report — Last 30 Days</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Sorted by most recently active.</div>
            </div>
            <button onClick={function() { setShowActivityReport(false); }} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#475569", padding: "6px 12px" }}>✕ Close</button>
          </div>

          {/* Body */}
          <div style={{ padding: "16px 24px 24px" }}>
            {activityLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: 14 }}>Loading activity data…</div>
            ) : !activityData || activityData.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 14 }}>
                No activity found in the last 30 days. Activity is logged when clients open their scenarios or PQ letters are generated.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    {["Contact", "Scenario", "Last Seen", "Views (30d)", "PQ Letters", "PQ Sent", "Other Actions"].map(function(h) {
                      return <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{h}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activityData.map(function(row, i) {
                    var sc = row.scenario;
                    var contact = sc.contact_id ? (contactsMap && contactsMap[sc.contact_id]) : null;
                    var contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : (sc.clientName || "—");
                    var lastSeen = row.lastSeen ? new Date(row.lastSeen) : null;
                    var now = new Date();
                    var diffMs = lastSeen ? now - lastSeen : null;
                    var diffLabel = diffMs == null ? "—"
                      : diffMs < 60*60*1000 ? "< 1 hour ago"
                      : diffMs < 24*60*60*1000 ? Math.floor(diffMs/3600000) + "h ago"
                      : diffMs < 7*24*60*60*1000 ? Math.floor(diffMs/86400000) + "d ago"
                      : lastSeen.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    var isHot = diffMs && diffMs < 3*24*60*60*1000;
                    var uniqueActions = [...new Set(row.actions)].filter(function(a) { return a !== "viewed"; });
                    return (
                      <tr key={sc.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1e3a5f" }}>{contactName}</td>
                        <td style={{ padding: "10px 12px", color: "#374151" }}>{sc.clientName || sc.name || "—"}</td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: isHot ? 700 : 400, color: isHot ? "#dc2626" : "#374151" }}>
                            {isHot ? "🔥 " : ""}{diffLabel}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: row.views > 0 ? "#1e3a5f" : "#94a3b8" }}>
                          {row.views > 0 ? row.views : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: row.letterCount > 0 ? "#16a34a" : "#94a3b8", fontWeight: row.letterCount > 0 ? 700 : 400 }}>
                          {row.letterCount > 0 ? "✓ " + row.letterCount : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center", color: row.shareCount > 0 ? "#2563eb" : "#94a3b8", fontWeight: row.shareCount > 0 ? 700 : 400 }}>
                          {row.shareCount > 0 ? "✓ " + row.shareCount : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 12 }}>
                          {uniqueActions.length > 0 ? uniqueActions.slice(0, 3).join(", ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        </div>
        );
      })(),
      document.body
    )}
    </div>
  );
}

window.ScenarioDashboard = ScenarioDashboard;
