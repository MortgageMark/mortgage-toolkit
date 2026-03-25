// modules/screens/MortgageToolkit.js
const { useState, useEffect, useCallback, useMemo } = React;
const useLocalStorage = window.useLocalStorage;

// All calculator components (loaded before this file):
const PaymentCalculator = window.PaymentCalculator;
const RefinanceAnalyzer = window.RefinanceAnalyzer;
const FeeSheetGenerator = window.FeeSheetGenerator;
const MortgageComparison = window.MortgageComparison;
const BreakEvenCalculator = window.BreakEvenCalculator;
const PreQualLetter = window.PreQualLetter;
const ForwardCommitment = window.ForwardCommitment;
const AffordabilityCalculator = window.AffordabilityCalculator;
const AmortizationSchedule = window.AmortizationSchedule;
const DTICalculator = window.DTICalculator;
const RentVsBuyCalculator = window.RentVsBuyCalculator;
const SellerNetSheet = window.SellerNetSheet;
const ClosingCostEstimator = window.ClosingCostEstimator;
const HELOCCalculator = window.HELOCCalculator;
const LoanProgramComparison = window.LoanProgramComparison;
const BudgetPlanner = window.BudgetPlanner;
const OpenHouseLeadCapture = window.OpenHouseLeadCapture;
const RateWatchDashboard = window.RateWatchDashboard;
const FlyerGenerator = window.FlyerGenerator;
const WealthBuilder = window.WealthBuilder;
const TitleEndorsements = window.TitleEndorsements;
const SettingsPanel = window.SettingsPanel;
const LOSelector = window.LOSelector;
const AdminPanel = window.AdminPanel;
const snapshotCalculatorData = window.snapshotCalculatorData;
const fetchContactNotesFromSupabase = window.fetchContactNotesFromSupabase;
const addContactNoteToSupabase = window.addContactNoteToSupabase;
const saveContactToSupabase = window.saveContactToSupabase;
const fetchAuditLog = window.fetchAuditLog;
const LEAD_STATUSES = window.LEAD_STATUSES;
const NotifyClientButton = window.NotifyClientButton;

// Theme / style globals (loaded before this file via constants.js or hooks.js):
const COLORS = window.COLORS;
const COLORS_DARK = window.COLORS_DARK;
const font = window.font;
const ThemeContext = window.ThemeContext;

// MODULES array with component refs — built here since all components are loaded
const MODULES = [
  // ── Primary tabs (visible to all roles in order) ──
  { id: "refi",       label: "Refi Analyzer",        icon: "\uD83D\uDD04", component: RefinanceAnalyzer },
  { id: "payment",    label: "Payment Calculator", icon: "\uD83D\uDCB0", component: PaymentCalculator },
  { id: "amort",      label: "Amortization",        icon: "\uD83D\uDCC5", component: AmortizationSchedule },
  { id: "dti",        label: "DTI Calculator",       icon: "\uD83D\uDCD0", component: DTICalculator },
  { id: "fees",       label: "Fee Sheet",            icon: "\uD83D\uDCCB", component: FeeSheetGenerator },
  { id: "compare",    label: "Compare Loans",        icon: "\u2696\uFE0F", component: MortgageComparison },
  { id: "prequal",    label: "Pre-Qual Letter",      icon: "\u2709\uFE0F", component: PreQualLetter },
  { id: "sellernet",  label: "Seller Net Sheet",     icon: "\uD83D\uDCB5", component: SellerNetSheet },
  { id: "rentvsbuy",  label: "Rent vs Buy",          icon: "\uD83C\uDFD8\uFE0F", component: RentVsBuyCalculator },
  // ── Admin-only tabs (second row) ──
  { id: "breakeven",  label: "Break-Even",           icon: "\uD83D\uDCCA", component: BreakEvenCalculator },
  { id: "locks",      label: "Rate Locks",            icon: "\uD83D\uDD12", component: ForwardCommitment },
  { id: "afford",     label: "Affordability",         icon: "\uD83C\uDFE0", component: AffordabilityCalculator },
  { id: "closing",    label: "Closing Costs",         icon: "\uD83C\uDFE6", component: ClosingCostEstimator },
  { id: "heloc",      label: "HELOC",                 icon: "\uD83C\uDFE1", component: HELOCCalculator },
  { id: "programs",   label: "Loan Programs",         icon: "\uD83C\uDFAF", component: LoanProgramComparison },
  { id: "budget",     label: "Budget Planner",        icon: "\uD83D\uDCD2", component: BudgetPlanner },
  { id: "openhouse",  label: "Open House",            icon: "\uD83C\uDFD8\uFE0F", component: OpenHouseLeadCapture },
  { id: "flyer",      label: "Flyer Generator",       icon: "\uD83D\uDCF0", component: FlyerGenerator },
  { id: "ratewatch",  label: "Rate Watch",            icon: "\uD83D\uDCC8", component: RateWatchDashboard },
  { id: "wealthbuilder",    label: "Wealth Builder",      icon: "\uD83C\uDFE6", component: WealthBuilder },
  { id: "titleendorsements", label: "Title Endorsements", icon: "\uD83D\uDCCB", component: TitleEndorsements },
];

// These tabs are hidden from everyone except admins.
// For admins they appear in a separate shaded row beneath the primary tabs.
const ADMIN_ONLY_MODULE_IDS = ["breakeven", "locks", "afford", "closing", "heloc", "programs", "budget", "openhouse", "flyer", "ratewatch", "wealthbuilder", "rentvsbuy", "titleendorsements"];

function fmtPhone(val) {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return val;
}

// ── ScenarioContactPanel ─────────────────────────────────────────────────────
// Renders inside the MortgageToolkit tab bar for internal users.
// Shows the contact linked to this scenario: FU fields, quick note, permanent notes.
function ScenarioContactPanel({ contactId, scenarioId, scenario, darkMode, colors, onOpenContact }) {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState({ fu_date: "", fu_who: "", fu_priority: "", note_quick: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [leadStatus, setLeadStatus] = useState((scenario && scenario.lead_status) || "?");
  const [savingStatus, setSavingStatus] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  // ── Co-Borrower (moved from AboutTab) ──
  const [c2fn, setC2fn] = useLocalStorage("abt_c2fn", "");
  const [c2ln, setC2ln] = useLocalStorage("abt_c2ln", "");
  const [c2OnLoan, setC2OnLoan] = useLocalStorage("abt_c2loan", false);
  const [c2OnTitle, setC2OnTitle] = useLocalStorage("abt_c2title", false);

  useEffect(() => {
    if (!contactId) { setLoading(false); return; }
    let cancelled = false;
    const supa = window._supabaseClient;
    if (!supa) { setLoading(false); return; }
    Promise.all([
      supa.from("contacts").select("*").eq("id", contactId).single(),
      fetchContactNotesFromSupabase(contactId),
      scenarioId ? fetchAuditLog(scenarioId) : Promise.resolve({ data: [], error: null }),
    ]).then(([ctRes, notesRes, auditRes]) => {
      if (cancelled) return;
      if (!ctRes.error && ctRes.data) {
        const ct = ctRes.data;
        setContact(ct);
        setEditForm({
          fu_date: ct.fu_date || "",
          fu_who: ct.fu_who || "",
          fu_priority: ct.fu_priority || "",
          note_quick: ct.note_quick || "",
        });
        // Propagate primary borrower name to workspace localStorage
        // so PreQualLetter, DTICalculator, etc. pick it up automatically.
        // Dispatch mtk_propagated so any mounted components re-read their keys.
        localStorage.setItem("mtk_abt_c1fn", JSON.stringify(ct.first_name || ""));
        localStorage.setItem("mtk_abt_c1ln", JSON.stringify(ct.last_name  || ""));
        window.dispatchEvent(new Event("mtk_propagated"));
      }
      if (!notesRes.error) setNotes(notesRes.data || []);
      if (!auditRes.error) setAuditLog(auditRes.data || []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [contactId, scenarioId]);

  const handleSave = async () => {
    if (!contact) return;
    setSaving(true);
    setSaveMsg("");
    const { id, created_at, updated_at, tenant_id, created_by_user_id, ...rest } = contact;
    const { error } = await saveContactToSupabase({
      contactId: id,
      ...rest,
      fu_date:     editForm.fu_date     || null,
      fu_who:      editForm.fu_who      || null,
      fu_priority: editForm.fu_priority || null,
      note_quick:  editForm.note_quick  || null,
    });
    setSaving(false);
    if (error) {
      setSaveMsg("Error: " + error.message);
    } else {
      setContact(prev => ({ ...prev, ...editForm }));
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 2500);
    }
  };

  const handleAddNote = async () => {
    const body = newNote.trim();
    if (!body || addingNote) return;
    setAddingNote(true);
    const { data, error } = await addContactNoteToSupabase({ contactId, body });
    if (!error && data) {
      setNotes(prev => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  };

  const handleSaveLeadStatus = async (newStatus) => {
    if (!scenarioId || savingStatus || newStatus === leadStatus) return;
    setSavingStatus(true);
    const supa = window._supabaseClient;
    if (supa) {
      await supa.from("scenarios").update({ lead_status: newStatus }).eq("id", scenarioId);
    }
    setLeadStatus(newStatus);
    setSavingStatus(false);
  };

  const c = colors;
  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 6,
    border: "1px solid " + (darkMode ? "#2e4a62" : "#bfcfde"),
    background: darkMode ? "#1A2530" : "#f0f5fa",
    color: c.text || (darkMode ? "#E0EAF0" : "#1B2A3B"),
    fontSize: 13, fontFamily: font, boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700,
    color: darkMode ? "#7ba9cc" : "#4a6a85",
    textTransform: "uppercase", letterSpacing: "0.05em",
    marginBottom: 4, display: "block",
  };
  const cardStyle = {
    background: darkMode ? "#0f1e2c" : "#f4f8fc",
    border: "1px solid " + (darkMode ? "#243a50" : "#c2d4e6"),
    borderRadius: 10, padding: "16px 20px", marginBottom: 16,
    boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,0.35)" : "0 1px 4px rgba(30,80,140,0.07)",
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: c.textSecondary || "#64748b", fontFamily: font }}>
        Loading contact…
      </div>
    );
  }
  if (!contact) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: c.textSecondary || "#64748b", fontFamily: font }}>
        Contact not found.
      </div>
    );
  }

  const fullName = [contact.prefix, contact.first_name, contact.last_name].filter(Boolean).join(" ");
  const phone = fmtPhone(contact.phone_cell || contact.phone_work || contact.phone_home || "");
  const email = contact.email_personal || contact.email_work || "";

  const LEAD_STATUSES_PANEL = window.LEAD_STATUSES || [];
  const leadStatusGroups = [
    { label: "Pre-Pipeline",    key: "pre"      },
    { label: "Active Pipeline", key: "active"   },
    { label: "Waiting",         key: "waiting"  },
    { label: "Archived",        key: "archived" },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 40, fontFamily: font }}>

      {/* ── Contact Header ── */}
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: darkMode ? "#1A3040" : "#EBF5FB",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 800, color: COLORS.blue, flexShrink: 0,
        }}>
          {(contact.first_name || "?").charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div
            onClick={onOpenContact ? function() { onOpenContact(contactId); } : undefined}
            style={{
              fontSize: 20, fontWeight: 800, color: c.navy || COLORS.navy,
              cursor: onOpenContact ? "pointer" : "default",
              display: "inline-block",
              textDecoration: onOpenContact ? "underline" : "none",
              textDecorationColor: "rgba(0,100,180,0.4)",
              textUnderlineOffset: "3px",
            }}
          >
            {fullName || "Unnamed Contact"}
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 5 }}>
            <div style={{ fontSize: 12 }}>
              {phone
                ? <span style={{ color: c.textSecondary || "#64748b" }}>{phone}</span>
                : <span style={{ color: darkMode ? "#3d5a6e" : "#b0bec8", fontStyle: "italic" }}>no phone</span>
              }
            </div>
            <div style={{ fontSize: 12 }}>
              {email
                ? <span style={{ color: c.textSecondary || "#64748b" }}>{email}</span>
                : <span style={{ color: darkMode ? "#3d5a6e" : "#b0bec8", fontStyle: "italic" }}>no email</span>
              }
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: c.textSecondary || "#64748b", textAlign: "right" }}>
          {contact.contact_type}{contact.contact_category ? " · " + contact.contact_category : ""}
        </div>
      </div>

      {/* ── Follow-Up + Co-Borrower (side by side) ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-start" }}>

        {/* Follow-Up */}
        <div style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || COLORS.navy, marginBottom: 14 }}>
            Follow-Up
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>FU Date</label>
              <input
                type="date"
                value={editForm.fu_date}
                onChange={e => setEditForm(f => ({ ...f, fu_date: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>FU Who</label>
              <select
                value={editForm.fu_who}
                onChange={e => setEditForm(f => ({ ...f, fu_who: e.target.value }))}
                style={inputStyle}
              >
                <option value="">—</option>
                <option value="MP">MP</option>
                <option value="JW">JW</option>
                <option value="TP">TP</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>FU Priority</label>
              <select
                value={editForm.fu_priority}
                onChange={e => setEditForm(f => ({ ...f, fu_priority: e.target.value }))}
                style={inputStyle}
              >
                <option value="">—</option>
                <option value="Low">Low</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Quick Note</label>
            <input
              type="text"
              maxLength={120}
              value={editForm.note_quick}
              onChange={e => setEditForm(f => ({ ...f, note_quick: e.target.value }))}
              placeholder="Brief call reminder…"
              style={inputStyle}
            />
            <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 4, textAlign: "right" }}>
              {editForm.note_quick.length}/120
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Lead Status</label>
            <select
              value={leadStatus}
              onChange={function(e) { handleSaveLeadStatus(e.target.value); }}
              disabled={savingStatus}
              style={{
                ...inputStyle,
                fontWeight: 600,
                opacity: savingStatus ? 0.6 : 1,
                cursor: savingStatus ? "not-allowed" : "pointer",
              }}
            >
              {leadStatusGroups.map(function(g) {
                const opts = LEAD_STATUSES_PANEL.filter(function(s) { return s.group === g.key; });
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
            {savingStatus && (
              <span style={{ fontSize: 11, color: c.textSecondary || "#64748b", marginTop: 3, display: "block" }}>Saving…</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 20px", borderRadius: 7, border: "none",
                background: COLORS.blue, color: "#fff", fontSize: 13, fontWeight: 700,
                fontFamily: font, cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >{saving ? "Saving…" : "Save Changes"}</button>
            {saveMsg && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: saveMsg.startsWith("Error") ? "#e74c3c" : "#27ae60",
              }}>{saveMsg}</span>
            )}
          </div>
        </div>

        {/* Co-Borrower */}
        <div style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || COLORS.navy, marginBottom: 14 }}>
            Co-Borrower
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input
                type="text"
                value={c2fn}
                onChange={e => setC2fn(e.target.value)}
                placeholder="Co-borrower first name…"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                value={c2ln}
                onChange={e => setC2ln(e.target.value)}
                placeholder="Co-borrower last name…"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: c.text || (darkMode ? "#E0EAF0" : "#1B2A3B") }}>
              <input
                type="checkbox"
                checked={!!c2OnLoan}
                onChange={e => setC2OnLoan(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: COLORS.blue, cursor: "pointer" }}
              />
              Will Co-Borrower be on the Loan?
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: c.text || (darkMode ? "#E0EAF0" : "#1B2A3B") }}>
              <input
                type="checkbox"
                checked={!!c2OnTitle}
                onChange={e => setC2OnTitle(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: COLORS.blue, cursor: "pointer" }}
              />
              Will Co-Borrower be on Title?
            </label>
          </div>
        </div>

      </div>

      {/* ── Permanent Notes ── */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || COLORS.navy, marginBottom: 14 }}>
          Permanent Notes
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            style={{ ...inputStyle, resize: "vertical", flex: 1 }}
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !newNote.trim()}
            style={{
              padding: "8px 16px", borderRadius: 7, border: "none",
              background: COLORS.blue, color: "#fff", fontSize: 13, fontWeight: 700,
              fontFamily: font, alignSelf: "flex-start",
              cursor: (addingNote || !newNote.trim()) ? "default" : "pointer",
              opacity: (addingNote || !newNote.trim()) ? 0.5 : 1,
            }}
          >{addingNote ? "Adding…" : "Add"}</button>
        </div>
        {notes.length === 0 ? (
          <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>
            No notes yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map(n => (
              <div key={n.id} style={{
                background: darkMode ? "#1A2530" : "#F7FAFC",
                border: "1px solid " + (c.border || "#E2EAF0"),
                borderRadius: 7, padding: "10px 14px",
              }}>
                <div style={{ fontSize: 11, color: c.textSecondary || "#64748b", marginBottom: 4 }}>
                  {new Date(n.created_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" })}
                </div>
                <div style={{ fontSize: 13, color: c.text || (darkMode ? "#E0EAF0" : "#1B2A3B"), lineHeight: 1.5 }}>
                  {n.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Activity Log ── */}
      {auditLog.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || COLORS.navy, marginBottom: 14 }}>
            Activity Log
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {auditLog.map((entry, i) => (
              <div key={entry.id} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "8px 0",
                borderBottom: i < auditLog.length - 1 ? "1px solid " + (c.border || "#E2EAF0") : "none",
              }}>
                <div style={{ fontSize: 11, color: c.textSecondary || "#64748b", whiteSpace: "nowrap", minWidth: 140 }}>
                  {new Date(entry.created_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" })}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.navy || COLORS.navy, marginRight: 8, textTransform: "capitalize" }}>
                    {entry.action}
                  </span>
                  {entry.note && (
                    <span style={{ fontSize: 12, color: c.text || (darkMode ? "#E0EAF0" : "#1B2A3B") }}>
                      {entry.note}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function MortgageToolkit({ user, onLogout, activeScenario, onBackToScenarios, onOpenContact, onOpenProfile }) {
  const [activeModule, setActiveModule] = useLocalStorage("app_mod", "payment");
  const [userRole, setUserRole] = useLocalStorage("app_role", "admin");
  const [darkMode, setDarkMode] = useLocalStorage("app_dark", false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [brandName] = useLocalStorage("brand_name", "Mortgage Toolkit");
  const [brandSub] = useLocalStorage("brand_sub", "MORTGAGE MARK \u00B7 CMG HOME LOANS \u00B7 NMLS #729612");
  const [brandLogo] = useLocalStorage("brand_logo", "");
  const [brandColor] = useLocalStorage("brand_color", COLORS.navy);
  const colors = darkMode ? COLORS_DARK : COLORS;

  // Internal person: which modules to show to borrower
  const allModuleIds = MODULES.map(m => m.id);
  const [enabledModules, setEnabledModules] = useLocalStorage("app_enabled_mods", allModuleIds);
  const [showModuleSelector, setShowModuleSelector] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [headerContact, setHeaderContact] = useState(null);
  const isInternal = (function() {
    if (!user) return false;
    if (user.isInternal === true) return true;
    if (user.supabaseUser) return false;
    const r = JSON.parse(localStorage.getItem("mtk_roster") || "[]");
    return r.some(function(m) { return m.id === user.id && m.active; });
  })();
  const currentUserRole = user && user.role ? user.role : "lo";
  const isAdmin = currentUserRole === "admin";
  // Admin-only features (second row, purpose filter bypass) only active when admin is in Admin View
  const showAdminTabs = isAdmin && userRole === "admin";

  const toggleModule = (id) => {
    setEnabledModules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = (on) => { setEnabledModules(on ? allModuleIds : []); };

  // ── Shared Value Propagation ──────────────────────────────────────
  // When Payment Calculator values change, propagate to all other modules.
  // Master keys: pc_hp (home price), pc_la (loan amount), pc_rate (rate)
  const readLS = (k) => { try { const v = localStorage.getItem("mtk_" + k); return v !== null ? JSON.parse(v) : null; } catch { return null; } };
  const writeLS = (k, v) => { try { localStorage.setItem("mtk_" + k, JSON.stringify(v)); } catch {} };

  const propagateSharedValues = useCallback(() => {
    const hp = readLS("pc_hp");
    const la = readLS("pc_la");
    const rt = readLS("pc_rate");

    // Home Price / Purchase Price → multiple modules
    if (hp !== null) {
      writeLS("fs_pp", hp);           // Fee Sheet: purchasePrice
      writeLS("mc_hp", hp);           // Mortgage Comparison: homePrice
      writeLS("rvb_price", hp);       // Rent vs Buy: homePrice
      writeLS("hel_value", hp);       // HELOC: homeValue
      writeLS("sns_price", hp);       // Seller Net Sheet: salePrice
      writeLS("cce_price", parseFloat(hp) || 0); // Closing Cost: purchPrice (number)
      writeLS("pq_pp", hp);           // Pre-Qual: purchasePrice
      writeLS("lpc_price", hp);       // Loan Program Comparison: price
    }
    // Loan Amount → multiple modules
    if (la !== null) {
      writeLS("fs_la", la);           // Fee Sheet: loanAmount
      writeLS("am_la", la);           // Amortization: loanAmount
      writeLS("biw_loan", la);        // Bi-Weekly: loanAmt
      writeLS("be_lb", la);           // Break-Even: loanBalance
      writeLS("cce_loan", parseFloat(la) || 0); // Closing Cost: loanAmt (number)
    }
    // Interest Rate → multiple modules
    if (rt !== null) {
      writeLS("fs_rate", rt);         // Fee Sheet: rate
      writeLS("af_rate", rt);         // Affordability: rate
      writeLS("am_rate", rt);         // Amortization: rate
      writeLS("rvb_rate", rt);        // Rent vs Buy: rate
      writeLS("biw_rate", rt);        // Bi-Weekly: rate
      writeLS("hel_mrate", rt);       // HELOC: mortRate
      writeLS("be_nr", rt);           // Break-Even: newRate
      writeLS("cce_rate", parseFloat(rt) || 0); // Closing Cost: rate (number)
    }
    // Also propagate computed housing costs to DTI calculator
    if (la !== null && rt !== null) {
      const laNum = parseFloat(la) || 0;
      const hpNum = parseFloat(hp) || 0;
      const monthlyR = ((parseFloat(rt) || 0) / 100) / 12;
      const n = 360; // assume 30yr for DTI
      const pi = monthlyR > 0 ? laNum * (monthlyR * Math.pow(1 + monthlyR, n)) / (Math.pow(1 + monthlyR, n) - 1) : laNum / n;
      writeLS("dti_pi", String(Math.round(pi)));

      // Propagate monthly tax to DTI
      const taxM = readLS("pc_taxm");
      const taxR = readLS("pc_taxr");
      const taxD = readLS("pc_tax");
      const hse = readLS("pc_hse");
      const taxBasis = hse ? hpNum * 0.80 : hpNum;
      const monthlyTaxProp = taxM === "rate" ? Math.round(taxBasis * ((parseFloat(taxR) || 0) / 100) / 12) : Math.round(parseFloat(taxD) || 0);
      writeLS("dti_tax", String(monthlyTaxProp));
      writeLS("fs_mt", String(monthlyTaxProp));

      // Propagate monthly insurance to DTI
      const insM = readLS("pc_insm");
      const insR = readLS("pc_insr");
      const insD = readLS("pc_ins");
      const monthlyInsProp = insM === "rate" ? Math.round(hpNum * ((parseFloat(insR) || 0) / 100) / 12) : Math.round(parseFloat(insD) || 0);
      writeLS("dti_ins", String(monthlyInsProp));
      writeLS("fs_mi", String(monthlyInsProp));

      // Propagate PMI to DTI
      const dp = parseFloat(readLS("pc_dp")) || 0;
      const pmiR = parseFloat(readLS("pc_pmi")) || 0;
      const monthlyPMI = dp < 20 ? (laNum * pmiR / 100) / 12 : 0;
      writeLS("dti_pmi", String(Math.round(monthlyPMI)));
    }
    window.dispatchEvent(new Event("mtk_propagated"));
  }, []);

  // ── Magic link: jump to the destination tab on first mount ──────────────────
  // view.html stores the destination key in sessionStorage before redirecting here.
  // Map destination keys → MODULES ids, then clear sessionStorage so it doesn't
  // re-trigger on subsequent renders or page refreshes.
  useEffect(() => {
    var DEST_TO_MODULE = {
      fee_sheet:         "fees",
      loan_comparison:   "compare",
      refi_analysis:     "refi",
      full_scenario:     "payment",
      payment_breakdown: "payment",
    };
    var dest = null;
    try { dest = sessionStorage.getItem("mtk_view_dest"); } catch(e) {}
    if (dest && DEST_TO_MODULE[dest]) {
      setActiveModule(DEST_TO_MODULE[dest]);
      try { sessionStorage.removeItem("mtk_view_dest"); } catch(e) {}
    }
  }, []); // empty deps — run once on mount only

  // Run propagation whenever the active tab changes (so destination tabs load fresh values)
  useEffect(() => {
    propagateSharedValues();
  }, [activeModule, propagateSharedValues]);

  // Also listen for localStorage changes (covers Payment Calculator edits in real-time)
  useEffect(() => {
    const watchKeys = ["mtk_pc_hp", "mtk_pc_la", "mtk_pc_rate", "mtk_pc_taxm", "mtk_pc_taxr", "mtk_pc_tax", "mtk_pc_insm", "mtk_pc_insr", "mtk_pc_ins", "mtk_pc_hse", "mtk_pc_state", "mtk_pc_city", "mtk_pc_county"];
    const handler = (e) => {
      if (watchKeys.includes(e.key)) propagateSharedValues();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [propagateSharedValues]);

  // Propagation via custom event (for same-tab localStorage writes)
  useEffect(() => {
    const handler = () => propagateSharedValues();
    window.addEventListener("mtk_propagated", handler);
    return () => window.removeEventListener("mtk_propagated", handler);
  }, [propagateSharedValues]);

  // Handle ?tabs= URL param for shared links
  const urlTabs = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tabs");
    return t ? t.split(",") : null;
  }, []);
  const isSharedView = urlTabs !== null;

  const filteredModules = useMemo(() => {
    if (isSharedView) return MODULES.filter(m => urlTabs.includes(m.id));
    // Internal users see all tabs + module selector; non-internal see only enabled tabs
    let mods = MODULES;
    if (!isInternal) {
      mods = mods.filter(m => enabledModules.includes(m.id));
    }
    // Admin-only tabs only visible when admin is in Admin View (not simulating other roles)
    if (!showAdminTabs) {
      mods = mods.filter(m => !ADMIN_ONLY_MODULE_IDS.includes(m.id));
    }
    // Purpose-based tab filtering — applies whenever not in Admin View
    if (!showAdminTabs) {
      const loanPurpose = activeScenario?.loan_purpose || "purchase";
      const isRefi = loanPurpose.startsWith("refi");
      if (isRefi) {
        mods = mods.filter(m => !["compare", "prequal", "sellernet", "rentvsbuy"].includes(m.id));
      } else {
        mods = mods.filter(m => m.id !== "refi");
      }
    }
    return mods.filter(m => {
      if (user && user.role === "borrower") {
        const isPurchase = !activeScenario || !activeScenario.loan_purpose || (activeScenario.loan_purpose || "").startsWith("purchase") || activeScenario.loan_purpose === "purchase";
        const base = isPurchase
          ? ["payment", "fees", "compare", "breakeven", "amort", "dti", "prequal", "sellernet"]
          : ["payment", "fees", "compare", "breakeven", "amort"];
        const extra = Array.isArray(user.borrowerPermissions) ? user.borrowerPermissions : [];
        return base.concat(extra).includes(m.id);
      }
      if (userRole === "client") return ["payment", "amort", "dti", "fees", "compare", "prequal", "sellernet", "rentvsbuy", "refi"].includes(m.id);
      if (userRole === "realtor") return ["payment", "amort", "dti", "fees", "compare", "prequal", "sellernet", "rentvsbuy", "refi"].includes(m.id);
      return true;
    });
  }, [user, userRole, isSharedView, urlTabs, isInternal, enabledModules, isAdmin, activeScenario, showAdminTabs]);

  const ActiveComponent = MODULES.find(m => m.id === activeModule)?.component || (filteredModules[0]?.component || PaymentCalculator);

  useEffect(() => {
    document.body.style.background = darkMode ? "#1A2530" : "#F5F8FA";
    document.body.style.transition = "background 0.3s";
  }, [darkMode]);

  // ── Auto-save every 60 seconds for cloud users ────────────────────
  useEffect(() => {
    if (!user || !user.supabaseUser || !activeScenario || !activeScenario.id) return;
    const intervalId = setInterval(async () => {
      try {
        const client = window._supabaseClient;
        if (!client) return;
        const calculationData = snapshotCalculatorData();
        const { error } = await client
          .from("scenarios")
          .update({ calculation_data: calculationData })
          .eq("id", activeScenario.id);
        if (error) console.warn("Auto-save failed:", error.message);
      } catch (err) {
        console.warn("Auto-save error:", err);
      }
    }, 60000);
    return () => clearInterval(intervalId);
  }, [user, activeScenario]);

  // Auto-select first visible tab if current is hidden
  // Skip for "contact_tab" — it's a special internal tab not in MODULES
  useEffect(() => {
    if (activeModule === "contact_tab") return;
    if (filteredModules.length > 0 && !filteredModules.find(m => m.id === activeModule)) {
      setActiveModule(filteredModules[0].id);
    }
  }, [filteredModules, activeModule]);

  // Fetch contact name for header display (prefix, first, nickname, last + lead status)
  useEffect(() => {
    const cid = activeScenario && activeScenario.contact_id;
    if (!cid) { setHeaderContact(null); return; }
    const supa = window._supabaseClient;
    if (!supa) return;
    let cancelled = false;
    supa.from("contacts")
      .select("prefix, first_name, nickname, last_name, phone_cell, phone_work, phone_home, email_personal, email_work")
      .eq("id", cid)
      .single()
      .then(function(res) { if (!cancelled && !res.error && res.data) setHeaderContact(res.data); });
    return function() { cancelled = true; };
  }, [activeScenario && activeScenario.contact_id]);

  const headerBg = darkMode
    ? "linear-gradient(135deg, #0A1E30 0%, #0E2A3C 50%, #122E44 100%)"
    : `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}DD 50%, ${brandColor}AA 100%)`;

  // LO contact info — shown in header for borrower/client view only
  const [loName]    = useLocalStorage("pq_lo",    "");
  const [loPhone]   = useLocalStorage("pq_loph",  "");
  const [loEmail]   = useLocalStorage("pq_loem",  "");
  const [loWebsite] = useLocalStorage("pq_loweb", "");

  const btnStyle = { padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 4 };

  // PDF Export helper — captures current module content
  const exportPDF = () => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const activeLabel = MODULES.find(m => m.id === activeModule)?.label || "Report";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(19, 49, 85);
      doc.text(brandName, 20, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 124, 147);
      doc.text(brandSub, 20, 27);
      doc.setDrawColor(72, 160, 206);
      doc.setLineWidth(0.5);
      doc.line(20, 30, 190, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(19, 49, 85);
      doc.text(activeLabel, 20, 40);
      // Capture all metric/label text from visible module
      const el = document.querySelector("[data-pdf-content]") || document.querySelector("[style*='maxWidth: 900']") || document.querySelector("[style*='max-width']");
      if (el) {
        const items = el.querySelectorAll("[style]");
        let y = 50;
        const seen = new Set();
        items.forEach(node => {
          const txt = node.innerText?.trim();
          if (txt && txt.length > 0 && txt.length < 200 && !seen.has(txt)) {
            seen.add(txt);
            if (y > 260) { doc.addPage(); y = 20; }
            const fs = parseFloat(window.getComputedStyle(node).fontSize);
            const isBold = window.getComputedStyle(node).fontWeight >= 600;
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            doc.setFontSize(Math.min(Math.max(fs * 0.7, 8), 12));
            doc.setTextColor(51, 51, 51);
            const lines = doc.splitTextToSize(txt, 170);
            lines.forEach(line => { if (y > 260) { doc.addPage(); y = 20; } doc.text(line, 20, y); y += 5; });
            y += 1;
          }
        });
      }
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text("Generated by " + brandName + " \u00B7 Estimates for educational purposes only.", 20, 272);
      doc.save(activeLabel.replace(/\s+/g, "_") + ".pdf");
    } catch (e) { alert("PDF export failed: " + e.message); }
  };

  // Client Portal Link builder
  const buildPortalLink = useCallback((moduleId, params = {}) => {
    const base = window.location.href.split("?")[0];
    const qs = new URLSearchParams({ tabs: moduleId, ...params });
    return base + "?" + qs.toString();
  }, []);

  return (
    <ThemeContext.Provider value={{ dark: darkMode, colors }}>
    <div style={{ fontFamily: font, background: darkMode ? "linear-gradient(180deg, #1A2530 0%, #152028 100%)" : "linear-gradient(180deg, #F5F8FA 0%, #EDF2F5 100%)", minHeight: "100vh", transition: "background 0.3s" }}>

      {/* ── Print-only branded header ── */}
      <div className="mtk-print-only mtk-print-header">
        {brandLogo && <img src={brandLogo} alt="Logo" style={{ maxHeight: 40 }} />}
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: brandColor }}>{brandName}</div>
          <div style={{ fontSize: 10, color: "#666" }}>{brandSub}</div>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="mtk-no-print" style={{ background: headerBg, padding: "20px 24px 16px", color: "#fff" }}>
        <div className="mtk-header-flex" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {headerContact ? (
              <React.Fragment>
                {/* Client avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(72,160,206,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 800, color: COLORS.blue,
                }}>
                  {(headerContact.first_name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  {/* Client name — clickable link */}
                  <div
                    onClick={onOpenContact ? function() { onOpenContact(activeScenario.contact_id); } : undefined}
                    style={{
                      fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2,
                      cursor: onOpenContact ? "pointer" : "default",
                      display: "inline-block",
                      textDecoration: onOpenContact ? "underline" : "none",
                      textDecorationColor: "rgba(255,255,255,0.45)",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    {[headerContact.prefix, headerContact.first_name, headerContact.nickname ? "\u201C" + headerContact.nickname + "\u201D" : null, headerContact.last_name].filter(Boolean).join(" ") || "Unnamed Contact"}
                  </div>
                  {/* Phone + Email */}
                  {(headerContact.phone_cell || headerContact.phone_work || headerContact.phone_home || headerContact.email_personal || headerContact.email_work) ? (
                    <div style={{ display: "flex", gap: 16, marginTop: 3, fontSize: 12, opacity: 0.8, alignItems: "center" }}>
                      {(headerContact.phone_cell || headerContact.phone_work || headerContact.phone_home) && (
                        <span>{fmtPhone(headerContact.phone_cell || headerContact.phone_work || headerContact.phone_home)}</span>
                      )}
                      {(headerContact.email_personal || headerContact.email_work) && (
                        <span>{headerContact.email_personal || headerContact.email_work}</span>
                      )}
                    </div>
                  ) : null}
                  {/* Scenario ID + Lead Status */}
                  <div style={{ display: "flex", gap: 10, marginTop: 3, fontSize: 10, opacity: 0.6, alignItems: "center" }}>
                    {activeScenario && activeScenario.clientName && (
                      <span style={{ fontFamily: "monospace", letterSpacing: "0.04em" }}>
                        {activeScenario.clientName}
                      </span>
                    )}
                    {activeScenario && activeScenario.lead_status && activeScenario.lead_status !== "?" && (
                      <span style={{ fontFamily: font }}>
                        {activeScenario.clientName ? "\u00B7" : ""} {activeScenario.lead_status}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                {brandLogo ? (
                  <img src={brandLogo} alt="Logo" style={{ height: 40, borderRadius: 8 }} onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(72,160,206,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: COLORS.blue }}>
                    {brandName.charAt(0)}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{brandName}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: "0.06em" }}>{brandSub}</div>
                </div>
              </React.Fragment>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!isSharedView && (
                <>
                  {isInternal && user && user.role !== "borrower" && <button onClick={() => setShowModuleSelector(!showModuleSelector)} style={{ ...btnStyle, background: showModuleSelector ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)", fontSize: 13 }} title="Select borrower modules">Modules</button>}
                  {isAdmin && React.createElement("button", {
                    onClick: function() { setShowAdmin(true); },
                    style: Object.assign({}, btnStyle, { fontSize: 13 }),
                    title: "Team Administration"
                  }, "\uD83D\uDC65")}
                  {isAdmin && <button onClick={() => setSettingsOpen(true)} style={btnStyle} title="Settings">{"\u2699\uFE0F"}</button>}
                  {isAdmin && isInternal && (
                    <select value={userRole} onChange={(e) => setUserRole(e.target.value)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>
                      <option value="admin" style={{ color: "#333" }}>Admin View</option>
                      <option value="lo" style={{ color: "#333" }}>Loan Officer</option>
                      <option value="realtor" style={{ color: "#333" }}>Realtor Partner</option>
                      <option value="client" style={{ color: "#333" }}>Client View</option>
                    </select>
                  )}
                  <button onClick={() => setDarkMode(!darkMode)} style={btnStyle} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
                    {darkMode ? "\u2600\uFE0F" : "\uD83C\uDF19"}
                  </button>
                  {onOpenContact && <button onClick={function() { onOpenContact(null); }} style={{ ...btnStyle, background: "rgba(255,255,255,0.18)", fontWeight: 700 }} title="Go to Contacts">Contacts</button>}
                  {onOpenProfile && <button onClick={onOpenProfile} style={{ ...btnStyle, background: "rgba(255,255,255,0.18)", fontWeight: 700 }} title="My Profile">👤 My Profile</button>}
                  {onBackToScenarios && <button onClick={onBackToScenarios} style={{ ...btnStyle, background: "rgba(255,255,255,0.18)", fontWeight: 700 }} title="Back to Scenarios">Scenarios</button>}
                  {NotifyClientButton && isInternal && activeScenario && activeScenario.contact_id && headerContact && (
                    <NotifyClientButton
                      scenario={activeScenario}
                      contact={headerContact}
                      activeModule={activeModule}
                      user={user}
                    />
                  )}
                  <button onClick={onLogout} style={{ ...btnStyle, fontSize: 13, opacity: 0.7 }} title="Logout">Log Out</button>
                </>
              )}
            </div>
        </div>
        {/* ── LO Contact Strip (borrower/client view only) ── */}
        {!isInternal && (loName || loPhone || loEmail || loWebsite) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
            marginTop: 10, paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            fontSize: 12, opacity: 0.85,
          }}>
            {loName && (
              <span style={{ fontWeight: 700, fontSize: 13 }}>{loName}</span>
            )}
            {loPhone && (
              <a href={`tel:${loPhone.replace(/\D/g,"")}`} style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                📞 {loPhone}
              </a>
            )}
            {loEmail && (
              <a href={`mailto:${loEmail}`} style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                ✉️ {loEmail}
              </a>
            )}
            {loWebsite && (
              <a href={loWebsite.startsWith("http") ? loWebsite : "https://" + loWebsite} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                🌐 {loWebsite}
              </a>
            )}
          </div>
        )}
        {/* ── Primary tab row ── */}
        <div className="mtk-tab-bar" style={{ display: "flex", gap: 4, marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
          {isInternal && !isSharedView && activeScenario && activeScenario.contact_id && (
            <button onClick={() => setActiveModule("contact_tab")} style={{
              padding: "10px 16px", borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: font, whiteSpace: "nowrap",
              background: activeModule === "contact_tab" ? "rgba(255,255,255,0.2)" : "transparent",
              color: activeModule === "contact_tab" ? "#fff" : "rgba(255,255,255,0.7)",
              border: activeModule === "contact_tab" ? "none" : "1px dashed rgba(255,255,255,0.35)",
              transition: "all 0.2s",
            }}>{"\uD83D\uDC64"} Contact Notes</button>
          )}
          {filteredModules.filter(m => !ADMIN_ONLY_MODULE_IDS.includes(m.id)).map((m) => (
            <button key={m.id} onClick={() => setActiveModule(m.id)} style={{
              padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: font, whiteSpace: "nowrap",
              background: activeModule === m.id ? "rgba(255,255,255,0.2)" : "transparent",
              color: activeModule === m.id ? "#fff" : "rgba(255,255,255,0.6)",
              transition: "all 0.2s",
            }}><span style={{ marginRight: 6 }}>{m.icon}</span>{m.label}</button>
          ))}
        </div>
        {/* ── Admin-only tab row (second row, shaded) ── */}
        {isAdmin && !isSharedView && filteredModules.some(m => ADMIN_ONLY_MODULE_IDS.includes(m.id)) && (
          <div style={{ display: "flex", gap: 4, overflowX: "auto", marginTop: 3, paddingTop: 5, paddingBottom: 6, paddingLeft: 4, paddingRight: 4, background: "rgba(0,0,0,0.20)", borderRadius: "0 0 8px 8px" }}>
            {filteredModules.filter(m => ADMIN_ONLY_MODULE_IDS.includes(m.id)).map((m) => (
              <button key={m.id} onClick={() => setActiveModule(m.id)} style={{
                padding: "7px 13px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: font, whiteSpace: "nowrap",
                background: activeModule === m.id ? "rgba(255,255,255,0.18)" : "transparent",
                color: activeModule === m.id ? "#fff" : "rgba(255,255,255,0.45)",
                transition: "all 0.2s",
              }}><span style={{ marginRight: 5 }}>{m.icon}</span>{m.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── Internal Module Selector Panel ── */}
      {isInternal && showModuleSelector && (
        <div className="mtk-no-print" style={{ padding: "16px 24px", background: darkMode ? "#0D1B26" : "#EDF4FA", borderBottom: `1px solid ${darkMode ? "#1E3040" : "#D1E3F0"}` }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.navy, fontFamily: font }}>{"\uD83D\uDCCB"} Module Selector</div>
                <div style={{ fontSize: 11, color: colors.gray, fontFamily: font }}>Choose which tabs the borrower will see when they log in.</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleAll(true)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${colors.border || "#D1D9E0"}`, background: colors.bgAlt || "#F5F8FA", color: colors.navy, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>Select All</button>
                <button onClick={() => toggleAll(false)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${colors.border || "#D1D9E0"}`, background: colors.bgAlt || "#F5F8FA", color: colors.navy, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>Clear All</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {MODULES.filter(m => isAdmin || !ADMIN_ONLY_MODULE_IDS.includes(m.id)).map(m => (
                <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: enabledModules.includes(m.id) ? (darkMode ? "#1A3040" : "#fff") : "transparent", border: `1px solid ${enabledModules.includes(m.id) ? (darkMode ? "#2A4050" : "#D1E3F0") : "transparent"}`, cursor: "pointer", fontSize: 12, fontWeight: 500, color: enabledModules.includes(m.id) ? colors.navy : (colors.gray || "#999"), fontFamily: font, transition: "all 0.15s" }}>
                  <input type="checkbox" checked={enabledModules.includes(m.id)} onChange={() => toggleModule(m.id)} style={{ width: 15, height: 15, accentColor: COLORS.navy }} />
                  <span>{m.icon}</span> {m.label}
                </label>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: colors.gray, fontFamily: font }}>
              {"\uD83D\uDC64"} Logged in as: <strong>{user?.name}</strong> ({user?.email}) — Internal Team Member
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        {isSharedView && (
          <div style={{ padding: "8px 14px", background: darkMode ? "#1A3040" : "#E8F4FD", borderRadius: 8, marginBottom: 16, fontSize: 12, color: COLORS.blue, fontWeight: 600, fontFamily: font, border: `1px solid ${COLORS.blue}33` }}>
            {"\uD83D\uDCCE"} Shared View — Showing {filteredModules.length} selected tool{filteredModules.length !== 1 ? "s" : ""}. <a href={window.location.href.split("?")[0]} style={{ color: COLORS.blue, textDecoration: "underline" }}>{"View full toolkit \u2192"}</a>
          </div>
        )}
        {!isSharedView && userRole !== "admin" && (
          <div style={{ padding: "8px 14px", background: darkMode ? "#2E2818" : COLORS.goldLight, borderRadius: 8, marginBottom: 16, fontSize: 12, color: COLORS.gold, fontWeight: 600, fontFamily: font, border: darkMode ? "1px solid #4A3C1A" : "1px solid #FFE082" }}>
            {userRole === "client" ? "Client View \u2014 You can view payment calculations, compare loans, and analyze break-even scenarios." :
             userRole === "realtor" ? "Realtor Partner View \u2014 Access payment tools, fee sheets, loan comparisons, and pre-qualification letters." :
             "Loan Officer View \u2014 Full access to all tools including rate locks and internal analytics."}
          </div>
        )}
        {!isSharedView && user && user.role === "borrower" && (
          <div style={{ padding: "10px 16px", background: darkMode ? "#0E2236" : "#EBF5FB", borderRadius: 8, marginBottom: 16, fontFamily: font, border: `1px solid ${COLORS.blue}44`, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{"\uD83D\uDCCB"}</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#A8D4F0" : COLORS.navy }}>
                {activeScenario && (activeScenario.name || activeScenario.clientName)
                  ? `Scenario: ${activeScenario.name || activeScenario.clientName}`
                  : "Your Mortgage Scenario"}
              </span>
              <span style={{ fontSize: 12, opacity: 0.65, marginLeft: 8, color: darkMode ? "#A8D4F0" : COLORS.navy }}>
                {"\u2014"} Review your loan details below. Reach out to your loan officer with any questions.
              </span>
            </div>
          </div>
        )}
        {activeModule === "contact_tab" && isInternal && activeScenario && activeScenario.contact_id
          ? <ScenarioContactPanel key={activeScenario.contact_id} contactId={activeScenario.contact_id} scenarioId={activeScenario.id} scenario={activeScenario} darkMode={darkMode} colors={colors} onOpenContact={onOpenContact} />
          : <div key={activeModule} className="mtk-fade-in"><ActiveComponent isInternal={isInternal} user={user} scenario={activeScenario} /></div>
        }
      </div>

      {/* ── Footer removed — replaced by PersistentFooter in App.js ── */}
      <div style={{ height: 32 }} />
    </div>

    {/* ── Settings Panel ── */}
    <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} darkMode={darkMode} allModules={MODULES} />

    {showAdmin && user && user.role === "admin" && React.createElement(AdminPanel, {
      currentUser: user,
      onClose: function() { setShowAdmin(false); }
    })}

    </ThemeContext.Provider>
  );
}
window.MortgageToolkit = MortgageToolkit;
