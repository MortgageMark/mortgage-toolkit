// modules/screens/ScenarioDashboard.js
const { useState, useEffect } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const supabase = window._supabaseClient;
const fetchScenariosFromSupabase = window.fetchScenariosFromSupabase;
const saveScenarioToSupabase = window.saveScenarioToSupabase;
const deleteScenarioFromSupabase = window.deleteScenarioFromSupabase;
const writeAuditLog = window.writeAuditLog;
const fetchAuditLog = window.fetchAuditLog;
const fetchContactsFromSupabase = window.fetchContactsFromSupabase;
const fetchClaimableScenariosForBorrower = window.fetchClaimableScenariosForBorrower;
const claimScenarioInSupabase = window.claimScenarioInSupabase;
const fetchTemplatesFromSupabase   = window.fetchTemplatesFromSupabase;
const patchContactInSupabase       = window.patchContactInSupabase;
const saveTemplateToSupabase       = window.saveTemplateToSupabase;
const deleteTemplateFromSupabase   = window.deleteTemplateFromSupabase;
const setDefaultTemplateInSupabase = window.setDefaultTemplateInSupabase;

// ── Lead Group Helpers ─────────────────────────────────────────────────────
// Three dashboard tabs: Active (pre-pipeline + in-pipeline), Waiting, Archived.
// Grouping is derived from the lead_status string value — no separate column needed.

const LEAD_GROUPS = ["active", "waiting", "archived"];
const LEAD_GROUP_LABELS = { active: "Active", waiting: "Waiting", archived: "Archived" };

function getLeadGroup(leadStatus) {
  if (!leadStatus) return "active";
  if (leadStatus.startsWith("z")) return "archived";        // z- and zz- prefixes
  if (leadStatus.startsWith("Waiting")) return "waiting";   // Waiting, Waiting - Building
  return "active";                                          // ?, (A)-(D), 01.-15.
}

function getLeadStatusColors(leadStatus) {
  if (!leadStatus || leadStatus === "?")
    return { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };   // gray – unknown
  if (leadStatus.startsWith("("))
    return { bg: "rgba(59,130,246,0.12)",  text: "#1d4ed8" };   // blue  – pre-pipeline
  if (leadStatus.startsWith("Waiting"))
    return { bg: "rgba(245,158,11,0.12)",  text: "#b45309" };   // amber – waiting
  if (leadStatus.startsWith("z"))
    return { bg: "rgba(107,114,128,0.12)", text: "#6b7280" };   // gray  – archived
  return { bg: "rgba(34,197,94,0.12)",   text: "#16a34a" };     // green – active pipeline
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
    { label: "Pre-Pipeline",    key: "pre"      },
    { label: "Active Pipeline", key: "active"   },
    { label: "Waiting",         key: "waiting"  },
    { label: "Archived",        key: "archived" },
  ];
  return (
    <select value={value} onChange={onChange} style={style}>
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

// ── Main Component ─────────────────────────────────────────────────────────
function ScenarioDashboard({ user, onSelectScenario, onLogout, onContacts, onUsers, onMyInfo }) {
  const c = useThemeColors();
  const [scenarios, setScenarios] = useLocalStorage("scenarios", []);
  const [groupFilter, setGroupFilter] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  // New scenario form fields
  const [newUid, setNewUid] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newLeadStatus, setNewLeadStatus] = useState("?");
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
  const [bulkResult,    setBulkResult]    = useState(null); // null | { ok, failed }

  const [filterLeadStatus, setFilterLeadStatus] = useState(""); // "" | "pre" | "active" | "waiting" | "archived"
  const [filterPurpose,    setFilterPurpose]    = useState(""); // "" | "purchase" | "refi"
  const [filterFuPriority, setFilterFuPriority] = useState(""); // "" | "High" | "Medium" | "Low"
  const [filterFuDate,     setFilterFuDate]     = useState(""); // "" | "overdue" | "today" | "this_week" | "this_month" | "none"
  const [filterFuWho,      setFilterFuWho]      = useState(""); // "" | any fu_who value | "_none"
  const [closingFilter, setClosingFilter] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloudError, setCloudError] = useState(null);
  const [auditLogOpen, setAuditLogOpen] = useState(null);
  const [auditLogData, setAuditLogData] = useState([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [claimable, setClaimable] = useState([]);
  const [claiming, setClaiming] = useState(false);
  const [borrowerContactId, setBorrowerContactId] = useState(user.newContactId || null); // own contact ID, for auto-linking
  const [editDetailsOpen,   setEditDetailsOpen]   = useState(null);
  const [editDetailsForm,   setEditDetailsForm]   = useState({});
  const [editDetailsSaving, setEditDetailsSaving] = useState(false);
  const [contactsMap,       setContactsMap]       = useState({});

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

  const isCloudUser = !!(user && user.supabaseUser && supabase);
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
      lead_status:     row.lead_status  || "?",
      loan_purpose:    row.loan_purpose || "purchase",
      property_address:  row.property_address  || "",
      lead_source:       row.lead_source      || "",
      target_close_date: row.target_close_date || null,
      actual_close_date: row.actual_close_date || null,
      contact_id:        row.contact_id        || null,
      lockLevel:         row.lock_level        || "none",
      lockedBy:        row.locked_by    || null,
      lockedAt:        row.locked_at    || null,
      calculatorData:  row.calculation_data || {},
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

  // ── Contact fetch on mount (internal only) — populates table map + new form picker ──
  useEffect(function() {
    if (!isCloudUser || !user.isInternal) return;
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
    setNewLeadStatus("?");
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
    if (isCloudUser && user.isInternal && !newContactId) {
      alert("Please link this scenario to a contact before creating it.");
      return;
    }
    if (isCloudUser && user.isInternal && !newReferralContactId) {
      alert("Please select a referral source before creating this scenario.");
      return;
    }
    const referralContact = contactOptions.find(function(ct) { return ct.id === newReferralContactId; });
    const referralName = referralContact
      ? ((referralContact.first_name || "") + " " + (referralContact.last_name || "")).trim()
      : (newLeadSource.trim() || null);
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
      }
      try {
        const { data, error } = await saveScenarioToSupabase({
          uid:              newUid,
          name:             newClientName.trim(),
          notes:            "",
          calculationData:  { ...templateCalcData, uid: newUid },
          contact_id:       user.isInternal ? (newContactId || null) : (resolvedBorrowerContactId || null),
          lead_status:      "?",
          loan_purpose:     newLoanPurpose,
          property_address: null,
          lead_source:      referralName,
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
        lead_status:      "?",
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
    if (newStatus === (scenario.lead_status || "?")) return;
    if (isCloudUser) {
      const { error } = await supabase
        .from("scenarios")
        .update({ lead_status: newStatus })
        .eq("id", scenario.id);
      if (error) { alert("Could not update lead status: " + error.message); return; }
      writeAuditLog(
        scenario.id, "lead_status_changed",
        { old: scenario.lead_status || "?", new: newStatus },
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

  async function duplicateScenario(scenario) {
    if (isCloudUser) {
      setSaving(true);
      try {
        const { data, error } = await saveScenarioToSupabase({
          name:             (scenario.clientName || "Untitled") + " (Copy)",
          notes:            scenario.notes || "",
          calculationData:  { ...(scenario.calculatorData || scenario.calculation_data || {}), uid: generateScenarioId() },
          lead_status:      scenario.lead_status || "?",
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
        scenarioId:        scenario.id,
        name:              scenario.clientName,
        notes:             scenario.notes,
        status:            scenario.status,
        lead_status:       scenario.lead_status,
        loan_purpose:      scenario.loan_purpose,
        property_address:  editDetailsForm.property_address || null,
        lead_source:       editDetailsForm.lead_source      || null,
        target_close_date: editDetailsForm.target_close_date || null,
        actual_close_date: editDetailsForm.actual_close_date || null,
      });
      if (error) { alert("Could not save details: " + error.message); return; }
      setScenarios(function(prev) {
        return prev.map(function(s) {
          if (s.id !== scenario.id) return s;
          return {
            ...s,
            property_address:  editDetailsForm.property_address  || "",
            lead_source:       editDetailsForm.lead_source        || "",
            target_close_date: editDetailsForm.target_close_date || null,
            actual_close_date: editDetailsForm.actual_close_date || null,
            updatedAt:         new Date().toISOString(),
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
      const m = LEAD_STATUSES_ALL.find(function(x) { return x.value === (s.lead_status || "?"); });
      return m && m.group === "pre";
    }).length,
    active: scenarios.filter(function(s) {
      const m = LEAD_STATUSES_ALL.find(function(x) { return x.value === (s.lead_status || "?"); });
      return m && m.group === "active";
    }).length,
    waiting: scenarios.filter(function(s) { return getLeadGroup(s.lead_status) === "waiting"; }).length,
  };

  // "Closing this month" — target_close_date in current month, not archived
  const _now = new Date();
  const closingThisMonth = scenarios.filter(function(s) {
    if (!s.target_close_date) return false;
    if (getLeadGroup(s.lead_status) === "archived") return false;
    const parts = (s.target_close_date + "").split("-");
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
    { value: "pre",      label: "Pre-Pipeline"    },
    { value: "active",   label: "Active Pipeline" },
    { value: "waiting",  label: "Waiting"          },
    { value: "archived", label: "Archived"         },
  ];

  const filtered = scenarios
    .filter(function(s) {
      if (closingFilter) {
        if (getLeadGroup(s.lead_status) === "archived") return false;
        if (!s.target_close_date) return false;
        const parts = (s.target_close_date + "").split("-");
        return parts.length >= 2 &&
          parseInt(parts[0], 10) === _now.getFullYear() &&
          parseInt(parts[1], 10) - 1 === _now.getMonth();
      }
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
      const d = s.calculatorData || {};
      const c2fn = parseV(d["abt_c2fn"]);
      const c2ln = parseV(d["abt_c2ln"]);
      const c2label = (c2ln && c2fn ? c2ln + ", " + c2fn : c2fn || c2ln).toLowerCase();
      const ctFull  = ct ? ((ct.first_name || "") + " " + (ct.last_name || "")).trim().toLowerCase() : "";
      const ctFullR = ct ? ((ct.last_name  || "") + ", " + (ct.first_name || "")).trim().toLowerCase() : "";
      return (
        s.clientName.toLowerCase().includes(term) ||
        getClientLabel(s).toLowerCase().includes(term) ||
        (c2label && c2label.includes(term)) ||
        (s.notes && s.notes.toLowerCase().includes(term)) ||
        (s.createdByName && s.createdByName.toLowerCase().includes(term)) ||
        (s.property_address && s.property_address.toLowerCase().includes(term)) ||
        (ctFull  && ctFull.includes(term)) ||
        (ctFullR && ctFullR.includes(term)) ||
        (ct && ct.first_name && ct.first_name.toLowerCase().includes(term)) ||
        (ct && ct.last_name  && ct.last_name.toLowerCase().includes(term)) ||
        (ct && ct.phone_cell && ct.phone_cell.toLowerCase().includes(term)) ||
        (ct && ct.phone_work && ct.phone_work.toLowerCase().includes(term)) ||
        (ct && ct.phone_home && ct.phone_home.toLowerCase().includes(term)) ||
        (ct && ct.email_personal && ct.email_personal.toLowerCase().includes(term)) ||
        (ct && ct.email_work    && ct.email_work.toLowerCase().includes(term))
      );
    })
    // ── Column filters ────────────────────────────────────────────────────
    .filter(function(s) {
      if (!filterLeadStatus) return true;
      const LEAD_STATUSES_ALL2 = window.LEAD_STATUSES || [];
      const m = LEAD_STATUSES_ALL2.find(function(x) { return x.value === (s.lead_status || "?"); });
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
        const na = ctA ? ((ctA.last_name || "") + (ctA.first_name || "")) : "";
        const nb = ctB ? ((ctB.last_name || "") + (ctB.first_name || "")) : "";
        return dir * na.localeCompare(nb);
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

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
        padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        color: "#fff",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
            {(user && (user.role === "admin" || user.role === "internal"))
              ? "Scenario Dashboard" : "My Scenarios"}
          </h1>
          <p style={{ margin: "4px 0 0", opacity: 0.8, fontSize: "14px" }}>
            Welcome back, {displayName}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {onMyInfo && (
            <button
              onClick={onMyInfo}
              style={{
                background: "rgba(255,255,255,0.9)", color: "#1e3a5f",
                border: "none", borderRadius: "8px", padding: "8px 16px",
                cursor: "pointer", fontSize: "14px", fontWeight: "600",
              }}
            >
              👤 My Info
            </button>
          )}
          {onUsers && (
            <button
              onClick={onUsers}
              style={{
                background: "rgba(255,255,255,0.9)", color: "#1e3a5f",
                border: "none", borderRadius: "8px", padding: "8px 16px",
                cursor: "pointer", fontSize: "14px", fontWeight: "600",
              }}
            >
              👥 Team
            </button>
          )}
          {isCloudUser && user.isInternal && (
            <button
              onClick={function() { setShowManageTemplates(true); }}
              style={{
                background: "rgba(255,255,255,0.9)", color: "#1e3a5f",
                border: "none", borderRadius: "8px", padding: "8px 16px",
                cursor: "pointer", fontSize: "14px", fontWeight: "600",
              }}
            >
              📋 Templates{templates.length > 0 ? " (" + templates.length + ")" : ""}
            </button>
          )}
          {onContacts && (
            <button
              onClick={onContacts}
              style={{
                background: "rgba(255,255,255,0.9)", color: "#1e3a5f",
                border: "none", borderRadius: "8px", padding: "8px 16px",
                cursor: "pointer", fontSize: "14px", fontWeight: "600",
              }}
            >
              Contacts
            </button>
          )}
          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,255,255,0.15)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px",
              padding: "8px 16px", cursor: "pointer", fontSize: "14px",
            }}
          >
            Logout
          </button>
        </div>
      </div>

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

        {/* ── Pipeline Metrics Strip (internal only) ──────────────── */}
        {user.isInternal && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { label: "Pre-Pipeline",    count: pipelineMetrics.pre,     bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)",  color: "#1d4ed8", clickable: false },
              { label: "Active Pipeline", count: pipelineMetrics.active,  bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)",   color: "#16a34a", clickable: false },
              { label: "Waiting",           count: pipelineMetrics.waiting, bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)",  color: "#b45309", clickable: false },
              { label: "Closing This Month", count: closingThisMonth,       bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)",   color: "#dc2626", clickable: true  },
            ].map(function(m) {
              const isActive = m.clickable && closingFilter;
              return (
                <div
                  key={m.label}
                  onClick={m.clickable ? function() { setClosingFilter(function(prev) { return !prev; }); } : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "6px 12px", borderRadius: "8px",
                    background: isActive ? m.border : m.bg,
                    border: "1px solid " + m.border,
                    cursor: m.clickable ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  <span style={{ fontSize: "12px", color: isActive ? m.color : (c.textSecondary || "#64748b"), fontWeight: isActive ? 700 : 400 }}>{m.label}</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: m.color }}>{m.count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Lead Group Filter Tabs */}
        <div style={{
          display: "flex", gap: "4px", marginBottom: "20px",
          borderBottom: "2px solid " + c.border,
        }}>
          {LEAD_GROUPS.map(function(tab) {
            const isActive = groupFilter === tab;
            return (
              <button
                key={tab}
                onClick={function() { setClosingFilter(false); setGroupFilter(tab); }}
                style={{
                  background: "transparent", border: "none",
                  borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                  marginBottom: "-2px", padding: "8px 16px",
                  fontSize: "14px", fontWeight: isActive ? 700 : 400,
                  color: isActive ? "#2563eb" : (c.textSecondary || "#888"),
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px",
                  transition: "color 0.15s",
                }}
              >
                {LEAD_GROUP_LABELS[tab]}
                <span style={{
                  background: isActive ? "rgba(37,99,235,0.12)" : (c.cardBg || "rgba(0,0,0,0.06)"),
                  color: isActive ? "#2563eb" : (c.textSecondary || "#888"),
                  borderRadius: "10px", padding: "1px 7px",
                  fontSize: "12px", fontWeight: 600,
                  minWidth: "20px", textAlign: "center",
                }}>
                  {groupCounts[tab] || 0}
                </span>
              </button>
            );
          })}
        </div>

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
              {isCloudUser && user.isInternal && (
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

              {/* ── Referred By * ── */}
              {isCloudUser && user.isInternal && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Referred By <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    {!showInlineReferralContact && (
                      <button type="button" onClick={function() { setShowInlineReferralContact(true); }}
                        style={{ fontSize: "12px", fontWeight: 600, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        + New Contact
                      </button>
                    )}
                  </div>
                  <select value={newReferralContactId} onChange={function(e) { setNewReferralContactId(e.target.value); }}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid " + (!newReferralContactId ? "#f87171" : "#2a4a6a"), background: "#1a3450", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}>
                    <option value="">— Select referral source —</option>
                    {contactOptions.map(function(ct) {
                      return <option key={ct.id} value={ct.id}>{((ct.first_name || "") + " " + (ct.last_name || "")).trim()}{ct.email_personal ? " (" + ct.email_personal + ")" : ""}</option>;
                    })}
                  </select>
                  {showInlineReferralContact && (
                    <div style={{ marginTop: "10px", padding: "14px", background: "#162c42", borderRadius: "8px", border: "1px solid #2a4a6a" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Quick-add referral contact</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                        {[["text","First Name *",inlineRefFirstName,setInlineRefFirstName],["text","Last Name *",inlineRefLastName,setInlineRefLastName],["email","Email (optional)",inlineRefEmail,setInlineRefEmail],["tel","Phone (optional)",inlineRefPhone,setInlineRefPhone]].map(function(f) {
                          return <input key={f[1]} type={f[0]} placeholder={f[1]} value={f[2]} onChange={function(e) { f[3](e.target.value); }} style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #2a4a6a", background: "#1a3450", color: "#fff", fontSize: "12px", outline: "none", width: "100%", boxSizing: "border-box" }} />;
                        })}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button type="button" onClick={saveInlineReferralContact} disabled={savingInlineReferralContact}
                          style={{ padding: "6px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: savingInlineReferralContact ? "not-allowed" : "pointer" }}>
                          {savingInlineReferralContact ? "Saving…" : "Save Contact"}
                        </button>
                        <button type="button" onClick={function() { setShowInlineReferralContact(false); setInlineRefFirstName(""); setInlineRefLastName(""); setInlineRefEmail(""); setInlineRefPhone(""); }}
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
          {closingFilter ? "closing this month" : LEAD_GROUP_LABELS[groupFilter].toLowerCase() + " lead"}{filtered.length !== 1 && !closingFilter ? "s" : ""}
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
                : "No " + LEAD_GROUP_LABELS[groupFilter].toLowerCase() + " leads"}
            </h3>
            <p style={{ color: c.textSecondary || "#888", margin: "0 0 20px" }}>
              {searchTerm
                ? "Try a different search term"
                : groupFilter === "active"
                  ? "Create your first scenario to get started"
                  : (LEAD_GROUP_LABELS[groupFilter] + " leads will appear here")}
            </p>
            {!searchTerm && groupFilter === "active" && (
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

            <span style={{ fontSize: 11, color: c.textSecondary, marginLeft: "auto" }}>
              Only filled fields will be changed. Blank = leave as-is.
            </span>
          </div>
        )}

        {/* ── Scenario Table ───────────────────────────────────────── */}
        {filtered.length > 0 && (
          <div style={{ overflowX: "auto", background: c.cardBg, border: "1px solid " + c.border, borderRadius: "12px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                    const clickTh = { ...thStyle, cursor: "pointer", userSelect: "none" };
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

                        {/* Lead Status — sortable + filterable by group */}
                        <th style={clickTh}>
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
                        </th>

                        {/* Contact — sortable */}
                        <th style={clickTh} onClick={function() { handleSort("contact"); }}>
                          Contact {arrow("contact")}
                        </th>

                        {/* ID — sortable */}
                        <th style={clickTh} onClick={function() { handleSort("uid"); }}>
                          ID {arrow("uid")}
                        </th>

                        {/* Scenario Name — sortable */}
                        <th style={clickTh} onClick={function() { handleSort("clientName"); }}>
                          Scenario Name {arrow("clientName")}
                        </th>

                        {/* Purpose — sortable + filterable */}
                        <th style={clickTh}>
                          <div onClick={function() { handleSort("loan_purpose"); }} style={{ display: "inline-block" }}>
                            Purpose {arrow("loan_purpose")}
                          </div>
                          <select
                            value={filterPurpose}
                            onChange={function(e) { e.stopPropagation(); setFilterPurpose(e.target.value); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            style={{ ...filterSelectStyle, minWidth: 80 }}
                          >
                            <option value="">All</option>
                            <option value="purchase">Purchase</option>
                            <option value="refi">Refi</option>
                          </select>
                        </th>

                        {/* FU Next — sortable + filterable by date window */}
                        <th style={clickTh}>
                          <div onClick={function() { handleSort("fu_date"); }} style={{ display: "inline-block" }}>
                            FU Next {arrow("fu_date")}
                          </div>
                          <select
                            value={filterFuDate}
                            onChange={function(e) { e.stopPropagation(); setFilterFuDate(e.target.value); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            style={{ ...filterSelectStyle, minWidth: 90 }}
                          >
                            <option value="">All</option>
                            <option value="overdue">Overdue</option>
                            <option value="today">Today</option>
                            <option value="this_week">This Week</option>
                            <option value="this_month">This Month</option>
                            <option value="none">— (none)</option>
                          </select>
                        </th>

                        {/* FU Who — sortable + filterable by distinct values */}
                        <th style={clickTh}>
                          <div onClick={function() { handleSort("fu_who"); }} style={{ display: "inline-block" }}>
                            FU Who {arrow("fu_who")}
                          </div>
                          <select
                            value={filterFuWho}
                            onChange={function(e) { e.stopPropagation(); setFilterFuWho(e.target.value); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            style={{ ...filterSelectStyle, minWidth: 80 }}
                          >
                            <option value="">All</option>
                            {(function() {
                              const seen = {};
                              Object.values(contactsMap).forEach(function(ct) {
                                const w = ct.fu_who || "";
                                if (w) seen[w] = true;
                              });
                              return Object.keys(seen).sort().map(function(w) {
                                return <option key={w} value={w}>{w}</option>;
                              });
                            })()}
                            <option value="_none">— (none)</option>
                          </select>
                        </th>

                        {/* FU Priority — sortable + filterable */}
                        <th style={clickTh}>
                          <div onClick={function() { handleSort("fu_priority"); }} style={{ display: "inline-block" }}>
                            FU Priority {arrow("fu_priority")}
                          </div>
                          <select
                            value={filterFuPriority}
                            onChange={function(e) { e.stopPropagation(); setFilterFuPriority(e.target.value); }}
                            onClick={function(e) { e.stopPropagation(); }}
                            style={{ ...filterSelectStyle, minWidth: 70 }}
                          >
                            <option value="">All</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                            <option value="_none">— (none)</option>
                          </select>
                        </th>

                        {/* Note: Quick — not sortable */}
                        <th style={thStyle}>Note: Quick</th>

                        {/* Created — sortable */}
                        <th style={clickTh} onClick={function() { handleSort("createdAt"); }}>
                          Created {arrow("createdAt")}
                        </th>

                        {/* Actions column */}
                        <th style={thStyle}></th>
                      </React.Fragment>
                    );
                  })()}
                </tr>
              </thead>
              <tbody>
                {filtered.map(function(scenario) {
                  const ls      = scenario.lead_status || "?";
                  const lsColor = getLeadStatusColors(ls);
                  const contact = contactsMap[scenario.contact_id] || null;
                  const contactName = contact
                    ? ((contact.first_name || "") + " " + (contact.last_name || "")).trim()
                    : "";
                  const fuDate     = contact ? (contact.fu_date     || "") : "";
                  const fuWho      = contact ? (contact.fu_who      || "") : "";
                  const fuPriority = contact ? (contact.fu_priority || "") : "";
                  const noteQuick  = contact ? (contact.note_quick  || "") : "";

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

                        {/* Lead Status */}
                        <td style={tdStyle} onClick={function(e) { e.stopPropagation(); }}>
                          <LeadStatusSelect
                            value={ls}
                            onChange={function(e) { changeLeadStatus(scenario, e.target.value); }}
                            style={{
                              padding: "3px 5px", borderRadius: "5px",
                              border: "1px solid " + c.border,
                              background: lsColor.bg, color: lsColor.text,
                              fontSize: "11px", fontWeight: 600, cursor: "pointer",
                              outline: "none", maxWidth: "150px", width: "100%",
                            }}
                          />
                        </td>

                        {/* Contact Name */}
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
                            {contactName || <span style={{ color: c.textSecondary || "#aaa" }}>—</span>}
                          </span>
                        </td>

                        {/* ID */}
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          {scenario.uid
                            ? <span style={{ fontFamily: "monospace", fontSize: "11px", color: c.textSecondary || "#888", letterSpacing: "0.03em" }}>{scenario.uid}</span>
                            : <span style={{ color: c.textSecondary || "#aaa" }}>—</span>
                          }
                        </td>

                        {/* Scenario Name */}
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600 }}>{scenario.clientName}</span>
                        </td>

                        {/* Purpose */}
                        <td style={tdStyle}>
                          {(() => {
                            const lp = scenario.loan_purpose || "purchase";
                            const isRefi = lp.startsWith("refi");
                            return (
                              <span style={{
                                display: "inline-block", padding: "2px 8px", borderRadius: "10px",
                                fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap",
                                background: isRefi ? "rgba(59,130,246,0.12)" : "rgba(34,197,94,0.12)",
                                color:      isRefi ? "#1d4ed8"               : "#15803d",
                              }}>
                                {isRefi ? "Refi" : "Purchase"}
                              </span>
                            );
                          })()}
                        </td>

                        {/* FU Next */}
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          {fuDate
                            ? <span style={{ color: "#b45309", fontWeight: 500 }}>{formatDateOnly(fuDate)}</span>
                            : <span style={{ color: c.textSecondary || "#aaa" }}>—</span>
                          }
                        </td>

                        {/* FU Who */}
                        <td style={tdStyle}>
                          {fuWho
                            ? <span style={{ fontWeight: 600, fontSize: "12px" }}>{fuWho}</span>
                            : <span style={{ color: c.textSecondary || "#aaa" }}>—</span>
                          }
                        </td>

                        {/* FU Priority */}
                        <td style={tdStyle}>
                          {fuPriority
                            ? <span style={{
                                background: fuPriority === "High" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                                color:      fuPriority === "High" ? "#dc2626" : "#b45309",
                                fontSize: "11px", fontWeight: 700,
                                padding: "2px 7px", borderRadius: "5px",
                                whiteSpace: "nowrap",
                              }}>{fuPriority}</span>
                            : <span style={{ color: c.textSecondary || "#aaa" }}>—</span>
                          }
                        </td>

                        {/* Note: Quick */}
                        <td style={{ ...tdStyle, maxWidth: "220px" }}>
                          {noteQuick
                            ? <span style={{ fontSize: "12px" }} title={noteQuick}>
                                {noteQuick.length > 60 ? noteQuick.substring(0, 60) + "\u2026" : noteQuick}
                              </span>
                            : <span style={{ color: c.textSecondary || "#aaa" }}>—</span>
                          }
                        </td>

                        {/* Created */}
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          <span style={{ color: c.textSecondary || "#888", fontSize: "12px" }}>
                            {formatDate(scenario.createdAt)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }} onClick={function(e) { e.stopPropagation(); }}>
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            {isCloudUser && (
                              <button
                                title="Activity Log"
                                onClick={function() { toggleAuditLog(scenario.id); }}
                                style={{
                                  ...actionBtnStyle,
                                  background:   auditLogOpen === scenario.id ? "rgba(37,99,235,0.1)" : "transparent",
                                  borderColor:  auditLogOpen === scenario.id ? "#2563eb" : c.border,
                                  color:        auditLogOpen === scenario.id ? "#2563eb" : c.text,
                                }}
                              >📜</button>
                            )}
                            {isCloudUser && user.isInternal && (
                              <button
                                title="Edit Lead Details"
                                onClick={function() {
                                  if (editDetailsOpen === scenario.id) {
                                    setEditDetailsOpen(null); setEditDetailsForm({});
                                  } else {
                                    setEditDetailsOpen(scenario.id);
                                    setEditDetailsForm({
                                      loan_purpose:      scenario.loan_purpose      || "purchase",
                                      property_address:  scenario.property_address  || "",
                                      lead_source:       scenario.lead_source       || "",
                                      target_close_date: scenario.target_close_date || "",
                                      actual_close_date: scenario.actual_close_date || "",
                                    });
                                  }
                                }}
                                style={{
                                  ...actionBtnStyle,
                                  background:   editDetailsOpen === scenario.id ? "rgba(37,99,235,0.1)" : "transparent",
                                  borderColor:  editDetailsOpen === scenario.id ? "#2563eb" : c.border,
                                  color:        editDetailsOpen === scenario.id ? "#2563eb" : c.text,
                                }}
                              >✏️</button>
                            )}
                            {isCloudUser && user.isInternal && (
                              <button
                                title="Save as Template"
                                onClick={function() {
                                  setSaveTemplateModal({
                                    scenarioId:     scenario.id,
                                    calculatorData: scenario.calculatorData || {},
                                    loanPurpose:    scenario.loan_purpose || "purchase",
                                  });
                                  setSaveTemplateName(scenario.clientName || "");
                                  setSaveTemplateDesc("");
                                  setSaveTemplateIsGlobal(false);
                                }}
                                style={{ ...actionBtnStyle }}
                              >📋</button>
                            )}
                            {isCloudUser && user.role === "admin" && (
                              <button
                                title="Delete Scenario"
                                onClick={function() { deleteScenario(scenario.id); }}
                                style={{
                                  ...actionBtnStyle,
                                  background: "transparent",
                                  borderColor: "rgba(239,68,68,0.4)",
                                  color: "#ef4444",
                                }}
                              >🗑</button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Audit Log expanded row ── */}
                      {auditLogOpen === scenario.id && (
                        <tr>
                          <td colSpan={11} style={{ padding: 0, borderBottom: "1px solid " + c.border }}>
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
                          <td colSpan={11} style={{ padding: 0, borderBottom: "1px solid " + c.border }}
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

        {/* ── Quick-start: open without saving ────────────────────── */}
        <div style={{
          marginTop: "32px", padding: "16px 20px",
          background: c.cardBg, borderRadius: "12px",
          border: "1px solid " + c.border, textAlign: "center",
        }}>
          <p style={{ margin: "0 0 8px", fontSize: "14px", color: c.textSecondary || "#888" }}>
            Need a quick calculation without saving?
          </p>
          <button
            onClick={function() { onSelectScenario(null); }}
            style={{
              background: "transparent", color: "#2563eb",
              border: "1px solid #2563eb", borderRadius: "8px",
              padding: "8px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
            }}
          >
            Open Calculators (No Scenario)
          </button>
        </div>

      </div>

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

    </div>
  );
}

window.ScenarioDashboard = ScenarioDashboard;
