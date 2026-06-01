// modules/screens/UsersPanel.js
// Full-page admin screen for managing team members, roles, and borrower permissions.
// Replaces/supplements the AdminPanel popup â€” accessible from the Scenario Dashboard.
const { useState, useEffect } = React;
const supabase        = window._supabaseClient;
const useThemeColors  = window.useThemeColors;
const useLocalStorage = window.useLocalStorage;
const generateId      = window.generateId;
const MODULE_DEFS     = window.MODULE_DEFS;

const UP_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ROLE_COLORS = {
  super_admin:  { bg: "#FCE7F3", text: "#831843", border: "#EC4899" },
  admin:        { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  branch_admin: { bg: "#E0E7FF", text: "#3730A3", border: "#6366F1" },
  internal:     { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6" },
  realtor:      { bg: "#F3E8FF", text: "#6B21A8", border: "#A855F7" },
  builder:      { bg: "#FFF7ED", text: "#C2410C", border: "#FB923C" },
  borrower:     { bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB" },
};
const ROLE_LABELS = { super_admin: "Super Admin", admin: "Admin", branch_admin: "Branch Admin", internal: "Internal", realtor: "Realtor", builder: "Builder", borrower: "Borrower" };

function RoleBadge({ role }) {
  const rc = ROLE_COLORS[role] || ROLE_COLORS.borrower;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, fontFamily: UP_FONT, letterSpacing: "0.05em",
      background: rc.bg, color: rc.text, border: "1px solid " + rc.border,
    }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function upFmtPhone(val) {
  var d = (val || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return val || "";
  if (d.length === 10) return "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6);
  return val;
}

// â”€â”€ Shared button styles (light theme) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BTN_PRIMARY   = { padding: "8px 18px", background: "#0C4160", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: UP_FONT, cursor: "pointer" };
const BTN_SECONDARY = { padding: "8px 18px", background: "#E8EEF4", color: "#0C4160", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: UP_FONT, cursor: "pointer" };
const BTN_SM        = { padding: "5px 12px", background: "#0C4160", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: UP_FONT, cursor: "pointer" };
const BTN_GHOST     = { padding: "5px 12px", background: "#F0F4F8", color: "#0C4160", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: UP_FONT, cursor: "pointer" };
const INPUT_ST      = { width: "100%", padding: "9px 12px", border: "1.5px solid #E0E8E8", borderRadius: 8, fontSize: 13, fontFamily: UP_FONT, color: "#0C4160", background: "#F7FAFB", outline: "none", boxSizing: "border-box" };
const LABEL_ST      = { display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B7D8A", marginBottom: 3, fontFamily: UP_FONT };

const HDR_STYLE = {
  background: "linear-gradient(135deg, #0C4160 0%, #1A5E8A 100%)",
  padding: "16px 24px", display: "flex", alignItems: "center", gap: 12, color: "#fff",
};

// â”€â”€ Edit Profile full-screen form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditProfileScreen({ profile, onSave, onCancel, teamProfiles, branches }) {
  const [form, setForm] = useState({
    display_name:  profile.display_name  || "",
    email_display: profile.email_display || "",
    title:         profile.title         || "",
    company:       profile.company       || "",
    nmls:          profile.nmls          || "",
    branch_nmls:   profile.branch_nmls   || "",
    company_nmls:  profile.company_nmls  || "",
    phone:         profile.phone         || "",
    cell_phone:    profile.cell_phone    || "",
    brokerage:     profile.brokerage     || "",
    website:       profile.website       || "",
    address:       profile.address       || "",
    city:          profile.city          || "",
    state:         profile.state         || "",
    zip:           profile.zip           || "",
    team_lead_id:  profile.team_lead_id  || "",
    branch_id:     profile.branch_id     || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState("");

  function setField(key, val) {
    setForm(function(prev) { return Object.assign({}, prev, { [key]: val }); });
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true); setError("");
    const payload = {
      display_name:  form.display_name  || null,
      email_display: form.email_display || null,
      title:         form.title         || null,
      company:       form.company       || null,
      nmls:          form.nmls          || null,
      branch_nmls:   form.branch_nmls   || null,
      company_nmls:  form.company_nmls  || null,
      phone:         form.phone         || null,
      cell_phone:    form.cell_phone    || null,
      brokerage:     form.brokerage     || null,
      website:       form.website       || null,
      address:       form.address       || null,
      city:          form.city          || null,
      state:         form.state         || null,
      zip:           form.zip           || null,
      team_lead_id:  form.team_lead_id  || null,
      branch_id:     form.branch_id     || null,
    };
    const { error: saveErr } = await supabase.from("profiles").update(payload).eq("id", profile.id);
    setSaving(false);
    if (saveErr) {
      if (saveErr.message && saveErr.message.includes("team_lead_id")) {
        setError("team_lead_id column missing. Run supabase-teams-branches-migration.sql first.");
      } else if (saveErr.message && saveErr.message.includes("email_display")) {
        setError("email_display column missing. Run supabase-profiles-email-display.sql first.");
      } else {
        setError(saveErr.message);
      }
    } else {
      setSaved(true);
      setTimeout(function() { onSave(form); }, 900);
    }
  }

  const isPartnerRole = profile.role === "realtor" || profile.role === "builder";
  const isLORole      = !isPartnerRole && profile.role !== "borrower";

  const FIELDS = [
    { key: "display_name",  label: "Display Name",         placeholder: "Full name",      span: 2 },
    { key: "email_display", label: "Email â€” PQ Letter",    placeholder: "name@email.com", span: 2 },
    { key: "title",         label: "Title",                placeholder: "Loan Officer"          },
    { key: "company",       label: "Company",              placeholder: "CMG Home Loans"        },
    { key: "nmls",          label: "NMLS #",               placeholder: "",               loOnly: true },
    { key: "branch_nmls",   label: "Branch NMLS #",        placeholder: "",               loOnly: true },
    { key: "company_nmls",  label: "Company NMLS #",       placeholder: "",               loOnly: true },
    { key: "phone",         label: "Phone (Office)",       placeholder: "(555) 555-5555"        },
    { key: "cell_phone",    label: "Cell Phone",           placeholder: "(555) 555-5555"        },
    { key: "brokerage",     label: "Brokerage",            placeholder: "Keller Williams, RE/MAX, etc.", partnerOnly: true },
    { key: "website",       label: "Website",              placeholder: "https://...",    span: 2 },
    { key: "address",       label: "Address",              placeholder: "Street address", span: 2 },
    { key: "city",          label: "City",                 placeholder: ""                      },
    { key: "state",         label: "State",                placeholder: "TX"                    },
    { key: "zip",           label: "Zip",                  placeholder: ""                      },
  ].filter(function(f) {
    if (f.loOnly      && !isLORole)      return false;
    if (f.partnerOnly && !isPartnerRole) return false;
    return true;
  });

  // Potential team leads = non-borrower profiles excluding self
  const potentialLeads = (teamProfiles || []).filter(function(p) { return p.id !== profile.id; });

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8", fontFamily: UP_FONT }}>
      <div style={HDR_STYLE}>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: UP_FONT, fontWeight: 600 }}>â† Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Edit Profile</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{profile.display_name || profile.email}</div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "28px 28px", boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>

          {/* Login ID â€” read only */}
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL_ST}>Email â€” Login ID <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(read-only â€” managed by Supabase Auth)</span></label>
            <div style={Object.assign({}, INPUT_ST, { background: "#EEF2F6", color: "#6B7D8A", cursor: "default", display: "flex", alignItems: "center", gap: 8 })}>
              <span style={{ fontSize: 13 }}>ðŸ”’</span>
              {profile.email || <em style={{ opacity: 0.5 }}>no login email on record</em>}
            </div>
            <div style={{ fontSize: 12, color: "#94A3B0", marginTop: 4, lineHeight: 1.4 }}>
              To change the login email, the user must update it from their own account or contact Supabase Auth directly.
            </div>
          </div>

          {/* Team Lead + Branch â€” LO roles only */}
          {isLORole && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 18 }}>
            <div>
              <label style={LABEL_ST}>Team Lead</label>
              <select
                value={form.team_lead_id}
                onChange={function(e) { setField("team_lead_id", e.target.value); }}
                style={Object.assign({}, INPUT_ST, { cursor: "pointer" })}
              >
                <option value="">â€” No team (standalone) â€”</option>
                {potentialLeads.map(function(p) {
                  return (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.email} ({ROLE_LABELS[p.role] || p.role})
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label style={LABEL_ST}>Branch</label>
              <select
                value={form.branch_id}
                onChange={function(e) { setField("branch_id", e.target.value); }}
                style={Object.assign({}, INPUT_ST, { cursor: "pointer" })}
              >
                <option value="">â€” No branch assigned â€”</option>
                {(branches || []).map(function(b) {
                  return <option key={b.id} value={b.id}>{b.name}{b.nmls ? " (NMLS " + b.nmls + ")" : ""}</option>;
                })}
              </select>
            </div>
          </div>}

          {/* Editable fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 20 }}>
            {FIELDS.map(function(f) {
              return (
                <div key={f.key} style={f.span === 2 ? { gridColumn: "1 / -1" } : {}}>
                  <label style={LABEL_ST}>{f.label}</label>
                  <input
                    style={INPUT_ST}
                    value={form[f.key]}
                    placeholder={f.placeholder}
                    onChange={function(e) { setField(f.key, e.target.value); }}
                  />
                </div>
              );
            })}
          </div>

          {error && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 14 }}>âš  {error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onCancel} style={BTN_SECONDARY}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={Object.assign({}, BTN_PRIMARY,
                saving ? { opacity: 0.6, cursor: "wait" } : {},
                saved  ? { background: "#1B8A5A" } : {}
              )}
            >
              {saved ? "âœ“ Saved" : saving ? "Savingâ€¦" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Main UsersPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function UsersPanel({ user, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState("directory");

  // â”€â”€ Supabase profile data â”€â”€â”€â”€
  const [allProfiles,     setAllProfiles]     = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError,   setProfilesError]   = useState(null);

  // â”€â”€ Role management â”€â”€â”€â”€
  const [editRoles, setEditRoles] = useState({});
  const [roleSaving, setRoleSaving] = useState({});
  const [roleSaved,  setRoleSaved]  = useState({});
  const [roleError,  setRoleError]  = useState({});

  // â”€â”€ Team share toggle â”€â”€â”€â”€
  const [teamShareEdit,   setTeamShareEdit]   = useState({});  // leadId â†’ bool
  const [teamShareSaving, setTeamShareSaving] = useState({});
  const [teamShareSaved,  setTeamShareSaved]  = useState({});

  // â”€â”€ Team bulk selection â”€â”€â”€â”€
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [bulkRole,        setBulkRole]        = useState("");
  const [bulkRoleSaving,  setBulkRoleSaving]  = useState(false);
  const [bulkDeleting,    setBulkDeleting]    = useState(false);
  const [bulkResult,      setBulkResult]      = useState(null);  // "deleted" | "role_saved"
  const [confirmBulkDel,  setConfirmBulkDel]  = useState(false);

  // â”€â”€ Directory bulk selection + three-dot menu â”€â”€â”€â”€
  const [selectedDirIds,   setSelectedDirIds]   = useState([]);
  const [dirBulkRole,      setDirBulkRole]      = useState("");
  const [dirBulkSaving,    setDirBulkSaving]    = useState(false);
  const [dirBulkDeleting,  setDirBulkDeleting]  = useState(false);
  const [dirBulkResult,    setDirBulkResult]    = useState(null);
  const [dirConfirmDel,    setDirConfirmDel]    = useState(false);
  const [dirMenuOpenId,    setDirMenuOpenId]    = useState(null);
  const [dirConfirmSingle, setDirConfirmSingle] = useState(null); // profile to delete

  function toggleTeamSelect(id) {
    setSelectedTeamIds(function(prev) {
      return prev.includes(id) ? prev.filter(function(x) { return x !== id; }) : prev.concat([id]);
    });
  }
  function clearTeamSelection() { setSelectedTeamIds([]); setBulkRole(""); setBulkResult(null); }

  async function handleBulkDelete() {
    if (!supabase || selectedTeamIds.length === 0) return;
    setBulkDeleting(true);
    const { error } = await supabase.from("profiles").delete().in("id", selectedTeamIds);
    setBulkDeleting(false);
    setConfirmBulkDel(false);
    if (!error) {
      setAllProfiles(function(prev) { return prev.filter(function(p) { return !selectedTeamIds.includes(p.id); }); });
      setBulkResult("deleted");
      setSelectedTeamIds([]);
      setTimeout(function() { setBulkResult(null); }, 3000);
    }
  }

  async function handleBulkRoleChange() {
    if (!supabase || selectedTeamIds.length === 0 || !bulkRole) return;
    setBulkRoleSaving(true);
    const { error } = await supabase.from("profiles").update({ role: bulkRole }).in("id", selectedTeamIds);
    setBulkRoleSaving(false);
    if (!error) {
      setAllProfiles(function(prev) {
        return prev.map(function(p) { return selectedTeamIds.includes(p.id) ? Object.assign({}, p, { role: bulkRole }) : p; });
      });
      setEditRoles(function(prev) {
        var next = Object.assign({}, prev);
        selectedTeamIds.forEach(function(id) { next[id] = bulkRole; });
        return next;
      });
      setBulkResult("role_saved");
      setSelectedTeamIds([]);
      setBulkRole("");
      setTimeout(function() { setBulkResult(null); }, 3000);
    }
  }

  // â”€â”€ Directory bulk handlers â”€â”€â”€â”€
  async function handleDirBulkDelete() {
    if (!supabase || selectedDirIds.length === 0) return;
    setDirBulkDeleting(true);
    const { error } = await supabase.from("profiles").delete().in("id", selectedDirIds);
    setDirBulkDeleting(false);
    setDirConfirmDel(false);
    if (!error) {
      setAllProfiles(function(prev) { return prev.filter(function(p) { return !selectedDirIds.includes(p.id); }); });
      setDirBulkResult("deleted");
      setSelectedDirIds([]);
      setTimeout(function() { setDirBulkResult(null); }, 3000);
    }
  }
  async function handleDirBulkRole() {
    if (!supabase || selectedDirIds.length === 0 || !dirBulkRole) return;
    setDirBulkSaving(true);
    const { error } = await supabase.from("profiles").update({ role: dirBulkRole }).in("id", selectedDirIds);
    setDirBulkSaving(false);
    if (!error) {
      setAllProfiles(function(prev) { return prev.map(function(p) { return selectedDirIds.includes(p.id) ? Object.assign({}, p, { role: dirBulkRole }) : p; }); });
      setDirBulkResult("role_saved");
      setSelectedDirIds([]);
      setDirBulkRole("");
      setTimeout(function() { setDirBulkResult(null); }, 3000);
    }
  }
  async function handleDirDeleteSingle(profileId) {
    if (!supabase) return;
    await supabase.from("profiles").delete().eq("id", profileId);
    setAllProfiles(function(prev) { return prev.filter(function(p) { return p.id !== profileId; }); });
    setDirConfirmSingle(null);
    setDirMenuOpenId(null);
  }

  // â”€â”€ Edit profile screen â”€â”€â”€â”€
  const [editingProfile, setEditingProfile] = useState(null);

  // â”€â”€ Branches â”€â”€â”€â”€
  const [branches,        setBranches]        = useState([]);
  const [branchesLoaded,  setBranchesLoaded]  = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchForm,      setBranchForm]      = useState(null);  // null=hidden, {}=add, {id,...}=edit
  const [branchSaving,    setBranchSaving]    = useState(false);
  const [branchError,     setBranchError]     = useState("");
  const [confirmDelBranch, setConfirmDelBranch] = useState(null);

  // â”€â”€ Activity tab â”€â”€â”€â”€
  const [actSessions,   setActSessions]   = useState(null);
  const [actLoading,    setActLoading]    = useState(false);
  const [actLoaded,     setActLoaded]     = useState(false);
  const [actSearch,     setActSearch]     = useState("");
  const [actRoleFilter, setActRoleFilter] = useState("all");
  const [actSort,       setActSort]       = useState({ col: "lastSeen", dir: "desc" });
  const [dirSearch, setDirSearch] = useState("");
  const [dirRoleFilter, setDirRoleFilter] = useState("lo");
  const [dirSort, setDirSort] = useState({ col: "name", dir: "asc" });

  // â”€â”€ Team tab search / sort â”€â”€â”€â”€
  const [teamSearch,     setTeamSearch]     = useState("");
  const [teamRoleFilter, setTeamRoleFilter] = useState("all");
  const [teamSort,       setTeamSort]       = useState({ col: "name", dir: "asc" });

  const isAdmin      = user && ["super_admin", "admin"].includes(user.role);
  const isSuperAdmin = user && user.role === "super_admin";

  // â”€â”€ Load all Supabase profiles â”€â”€â”€â”€
  useEffect(function() {
    if (!supabase) { setProfilesLoading(false); return; }
    supabase
      .from("profiles")
      .select("id, display_name, email, email_display, role, nmls, phone, cell_phone, company, brokerage, title, address, city, state, zip, branch_nmls, company_nmls, website, team_lead_id, team_share_scenarios, branch_id")
      .order("display_name", { ascending: true })
      .then(function(res) {
        // If a column doesn't exist yet, retry with minimal safe set
        if (res.error && res.error.message && (res.error.message.includes("email_display") || res.error.message.includes("team_lead_id") || res.error.message.includes("team_share_scenarios") || res.error.message.includes("branch_id"))) {
          return supabase
            .from("profiles")
            .select("id, display_name, email, role, nmls, phone, cell_phone, company, title, address, city, state, zip, branch_nmls, company_nmls, website")
            .order("display_name", { ascending: true });
        }
        return res;
      })
      .then(function(res) {
        setProfilesLoading(false);
        if (res.error) { setProfilesError(res.error.message); return; }
        const data = res.data || [];
        setAllProfiles(data);
        const roles = {};
        const shareVals = {};
        data.forEach(function(p) {
          roles[p.id] = p.role || "borrower";
          shareVals[p.id] = !!p.team_share_scenarios;
        });
        setTeamShareEdit(shareVals);
        setEditRoles(roles);
      });
  }, []);

  // â”€â”€ Load branches lazily when Branches tab is opened â”€â”€â”€â”€
  useEffect(function() {
    if ((activeTab !== "branches" && activeTab !== "directory") || branchesLoaded || !supabase) return;
    setBranchesLoading(true);
    supabase.from("branches").select("*").order("name").then(function(res) {
      setBranchesLoading(false);
      setBranchesLoaded(true);
      if (!res.error) setBranches(res.data || []);
    });
  }, [activeTab, branchesLoaded]);

  // â”€â”€ Lazy-load activity sessions when Activity tab opens â”€â”€â”€â”€
  useEffect(function() {
    if ((activeTab !== "activity" && activeTab !== "directory") || actLoaded || !supabase || !isAdmin) return;
    var fetchFn = window.fetchUserSessions;
    if (!fetchFn) { setActLoaded(true); return; }
    setActLoading(true);
    fetchFn(15).then(function(res) {
      setActLoading(false);
      setActLoaded(true);
      if (!res.error) setActSessions(res.data || []);
    }).catch(function() { setActLoading(false); setActLoaded(true); });
  }, [activeTab, actLoaded, isAdmin]);

  const ROLE_ORDER  = { super_admin: 0, admin: 1, branch_admin: 2, internal: 3, realtor: 4, builder: 5, borrower: 6 };
  const teamProfiles = allProfiles.filter(function(p) { return p.role !== "borrower"; });

  // Build team groups: keyed by team lead ID, value = { lead, members[] }
  // A profile is a "member" if team_lead_id points to another profile's id
  const teamGroups = React.useMemo(function() {
    const leadMap = {};  // leadId â†’ { lead: profile, members: [] }
    const standalone = [];
    const profileById = {};
    teamProfiles.forEach(function(p) { profileById[p.id] = p; });

    teamProfiles.forEach(function(p) {
      const lid = p.team_lead_id;
      const isOwnLead = !lid || lid === p.id;
      if (!isOwnLead) {
        // This profile is a team member
        if (!leadMap[lid]) leadMap[lid] = { leadId: lid, members: [] };
        leadMap[lid].members.push(p);
      }
      // Also pre-register lead entry if this profile leads others
    });

    // Now resolve lead profiles and separate standalone
    teamProfiles.forEach(function(p) {
      const lid = p.team_lead_id;
      const isOwnLead = !lid || lid === p.id;
      if (isOwnLead) {
        if (leadMap[p.id]) {
          // This person is a team lead
          leadMap[p.id].lead = p;
        } else {
          // No one is under them â€” standalone
          standalone.push(p);
        }
      }
    });

    // Build ordered list: teams first, then standalone
    const teams = Object.values(leadMap)
      .filter(function(g) { return g.lead; })
      .sort(function(a, b) {
        return (a.lead.display_name || "").localeCompare(b.lead.display_name || "");
      });

    return { teams, standalone };
  }, [teamProfiles]);

  // â”€â”€ Role save â”€â”€â”€â”€
  async function saveRole(profileId) {
    if (!supabase || profileId === user.id) return;
    const newRole = editRoles[profileId];
    setRoleSaving(function(p) { return Object.assign({}, p, { [profileId]: true }); });
    setRoleError(function(p)  { return Object.assign({}, p, { [profileId]: null }); });
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    setRoleSaving(function(p) { return Object.assign({}, p, { [profileId]: false }); });
    if (error) {
      setRoleError(function(p) { return Object.assign({}, p, { [profileId]: error.message }); });
    } else {
      setAllProfiles(function(prev) {
        return prev.map(function(p) { return p.id === profileId ? Object.assign({}, p, { role: newRole }) : p; });
      });
      setRoleSaved(function(p) { return Object.assign({}, p, { [profileId]: true }); });
      setTimeout(function() {
        setRoleSaved(function(p) { return Object.assign({}, p, { [profileId]: false }); });
      }, 2500);
    }
  }

  // â”€â”€ Team share scenarios toggle â”€â”€â”€â”€
  async function saveTeamShare(leadId) {
    if (!supabase) return;
    const newVal = !!teamShareEdit[leadId];
    setTeamShareSaving(function(p) { return Object.assign({}, p, { [leadId]: true }); });
    const { error } = await supabase.from("profiles").update({ team_share_scenarios: newVal }).eq("id", leadId);
    setTeamShareSaving(function(p) { return Object.assign({}, p, { [leadId]: false }); });
    if (!error) {
      setAllProfiles(function(prev) {
        return prev.map(function(p) { return p.id === leadId ? Object.assign({}, p, { team_share_scenarios: newVal }) : p; });
      });
      setTeamShareSaved(function(p) { return Object.assign({}, p, { [leadId]: true }); });
      setTimeout(function() {
        setTeamShareSaved(function(p) { return Object.assign({}, p, { [leadId]: false }); });
      }, 2500);
    }
  }

  // â”€â”€ Branch save / delete â”€â”€â”€â”€
  const EMPTY_BRANCH = { name: "", nmls: "", address: "", city: "", state: "", zip: "" };

  async function saveBranch() {
    if (!supabase || !branchForm) return;
    if (!branchForm.name || !branchForm.name.trim()) { setBranchError("Branch name is required."); return; }
    setBranchSaving(true); setBranchError("");
    if (branchForm.id) {
      // Update
      const { error } = await supabase.from("branches").update({
        name: branchForm.name.trim(), nmls: branchForm.nmls || "", address: branchForm.address || "",
        city: branchForm.city || "", state: branchForm.state || "", zip: branchForm.zip || "",
      }).eq("id", branchForm.id);
      setBranchSaving(false);
      if (error) { setBranchError(error.message); return; }
      setBranches(function(prev) { return prev.map(function(b) { return b.id === branchForm.id ? Object.assign({}, b, branchForm) : b; }); });
    } else {
      // Insert
      const { data, error } = await supabase.from("branches").insert({
        name: branchForm.name.trim(), nmls: branchForm.nmls || "", address: branchForm.address || "",
        city: branchForm.city || "", state: branchForm.state || "", zip: branchForm.zip || "",
      }).select().single();
      setBranchSaving(false);
      if (error) { setBranchError(error.message); return; }
      setBranches(function(prev) { return prev.concat([data]); });
    }
    setBranchForm(null);
  }

  async function deleteBranch(id) {
    if (!supabase) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (!error) setBranches(function(prev) { return prev.filter(function(b) { return b.id !== id; }); });
    setConfirmDelBranch(null);
  }

  // â”€â”€ Edit profile callbacks â”€â”€â”€â”€
  function handleEditSave(updatedFields) {
    setAllProfiles(function(prev) {
      return prev.map(function(p) {
        return p.id === editingProfile.id ? Object.assign({}, p, updatedFields) : p;
      });
    });
    setEditingProfile(null);
  }

  // â”€â”€ Activity tab helpers â”€â”€â”€â”€
  function actDotColor(daysSince) {
    if (daysSince === null) return "#D1D5DB";
    if (daysSince <= 3)  return "#22C55E";
    if (daysSince <= 7)  return "#F59E0B";
    return "#F97316";
  }
  function actRelDate(daysSince) {
    if (daysSince === null) return "Never";
    if (daysSince === 0)    return "Today";
    if (daysSince === 1)    return "Yesterday";
    return daysSince + "d ago";
  }
  function actExactDate(isoStr) {
    if (!isoStr) return "â€”";
    var d = new Date(isoStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function toggleActSort(col) {
    setActSort(function(prev) {
      if (prev.col === col) return { col: col, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { col: col, dir: (col === "sessions") ? "desc" : (col === "lastSeen" ? "desc" : "asc") };
    });
  }
  function refreshActivity() {
    var fetchFn = window.fetchUserSessions;
    if (!fetchFn || !supabase || !isAdmin) return;
    setActLoading(true);
    fetchFn(15).then(function(res) {
      setActLoading(false);
      if (!res.error) setActSessions(res.data || []);
    }).catch(function() { setActLoading(false); });
  }

  // â”€â”€ Activity merged data â”€â”€â”€â”€
  var actMerged = React.useMemo(function() {
    var byUser = {};
    (actSessions || []).forEach(function(s) {
      if (!byUser[s.user_id]) byUser[s.user_id] = [];
      byUser[s.user_id].push(s.logged_in_at);
    });
    return allProfiles.map(function(p) {
      var sessions = byUser[p.id] || [];
      var lastSeen = sessions.length > 0
        ? sessions.reduce(function(a, b) { return a > b ? a : b; }, "")
        : null;
      var daysSince = lastSeen
        ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86400000)
        : null;
      return Object.assign({}, p, { sessionCount: sessions.length, lastSeen: lastSeen, daysSince: daysSince });
    });
  }, [actSessions, allProfiles]);

  var actFiltered = React.useMemo(function() {
    var result = actMerged;
    if (actRoleFilter !== "all") {
      result = result.filter(function(u) {
        if (actRoleFilter === "lo") return ["admin","super_admin","branch_admin","internal"].includes(u.role);
        return u.role === actRoleFilter;
      });
    }
    if (actSearch.trim()) {
      var q = actSearch.toLowerCase();
      result = result.filter(function(u) {
        return (u.display_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
      });
    }
    result = result.slice().sort(function(a, b) {
      // Never-logged-in always at bottom regardless of sort direction
      if (a.lastSeen === null && b.lastSeen === null) return (a.display_name || "").localeCompare(b.display_name || "");
      if (a.lastSeen === null) return 1;
      if (b.lastSeen === null) return -1;
      var mul = actSort.dir === "asc" ? 1 : -1;
      if (actSort.col === "name")     return mul * (a.display_name || a.email || "").localeCompare(b.display_name || b.email || "");
      if (actSort.col === "role")     return mul * (a.role || "").localeCompare(b.role || "");
      if (actSort.col === "sessions") return mul * (a.sessionCount - b.sessionCount);
      // lastSeen default
      return mul * a.lastSeen.localeCompare(b.lastSeen);
    });
    return result;
  }, [actMerged, actRoleFilter, actSearch, actSort]);

  var ACT_ROLE_FILTERS = [
    { id: "all",     label: "All" },
    { id: "lo",      label: "LO / Admin" },
    { id: "borrower",label: "Clients" },
    { id: "builder", label: "Builders" },
    { id: "realtor", label: "Realtors" },
  ];
  var actActiveCount = actLoaded ? actMerged.filter(function(u) { return u.sessionCount > 0; }).length : null;

  // â”€â”€ Directory tab helpers â”€â”€â”€â”€
  var branchById = React.useMemo(function() {
    var map = {};
    branches.forEach(function(b) { map[b.id] = b; });
    return map;
  }, [branches]);

  var DIR_ROLE_FILTERS = [
    { id: "all",     label: "All" },
    { id: "lo",      label: "LO / Admin" },
    { id: "builder", label: "Builders" },
    { id: "realtor", label: "Realtors" },
    { id: "borrower",label: "Clients" },
  ];

  var dirRoleCounts = React.useMemo(function() {
    var counts = { all: allProfiles.length, lo: 0, builder: 0, realtor: 0, borrower: 0 };
    allProfiles.forEach(function(p) {
      if (["admin","super_admin","branch_admin","internal"].includes(p.role)) counts.lo++;
      else if (p.role === "builder") counts.builder++;
      else if (p.role === "realtor") counts.realtor++;
      else counts.borrower++;
    });
    return counts;
  }, [allProfiles]);

  var dirFiltered = React.useMemo(function() {
    var sessionByUser = {};
    (actSessions || []).forEach(function(s) {
      if (!sessionByUser[s.user_id]) sessionByUser[s.user_id] = [];
      sessionByUser[s.user_id].push(s.logged_in_at);
    });
    var result = allProfiles.map(function(p) {
      var branch = branchById[p.branch_id] || null;
      var sessions = sessionByUser[p.id] || [];
      var lastSeen = sessions.length > 0 ? sessions.reduce(function(a, b) { return a > b ? a : b; }, "") : null;
      var daysSince = lastSeen ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86400000) : null;
      return Object.assign({}, p, { branchName: branch ? branch.name : "", sessionCount: sessions.length, lastSeen: lastSeen, daysSince: daysSince });
    });
    if (dirRoleFilter !== "all") {
      var filterRolesMap = { lo: ["admin","super_admin","branch_admin","internal"], builder: ["builder"], realtor: ["realtor"], borrower: ["borrower"] };
      var filterRoles = filterRolesMap[dirRoleFilter] || [];
      result = result.filter(function(p) { return filterRoles.includes(p.role); });
    }
    if (dirSearch.trim()) {
      var q = dirSearch.toLowerCase();
      result = result.filter(function(p) {
        return (p.display_name || "").toLowerCase().includes(q) ||
               (p.email || "").toLowerCase().includes(q) ||
               (p.company || "").toLowerCase().includes(q) ||
               (p.branchName || "").toLowerCase().includes(q) ||
               (p.nmls || "").toLowerCase().includes(q);
      });
    }
    result = result.slice().sort(function(a, b) {
      var mul = dirSort.dir === "asc" ? 1 : -1;
      if (dirSort.col === "name")    return mul * (a.display_name || a.email || "").localeCompare(b.display_name || b.email || "");
      if (dirSort.col === "role")    return mul * (a.role || "").localeCompare(b.role || "");
      if (dirSort.col === "branch")  return mul * (a.branchName || "").localeCompare(b.branchName || "");
      if (dirSort.col === "company") return mul * (a.company || "").localeCompare(b.company || "");
      if (dirSort.col === "lastSeen") {
        if (a.lastSeen === null && b.lastSeen === null) return 0;
        if (a.lastSeen === null) return 1;
        if (b.lastSeen === null) return -1;
        return mul * a.lastSeen.localeCompare(b.lastSeen);
      }
      return 0;
    });
    return result;
  }, [allProfiles, actSessions, branchById, dirRoleFilter, dirSearch, dirSort]);

  function toggleDirSort(col) {
    setDirSort(function(prev) {
      if (prev.col === col) return { col: col, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { col: col, dir: col === "lastSeen" ? "desc" : "asc" };
    });
  }

  // â”€â”€ Tab bar item â”€â”€â”€â”€
  function tabBtn(key, label, count) {
    const active = activeTab === key;
    return (
      <button key={key} onClick={function() { setActiveTab(key); }} style={{
        padding: "12px 20px", border: "none",
        borderBottom: active ? "3px solid #0C4160" : "3px solid transparent",
        background: "transparent",
        color: active ? "#0C4160" : "#6B7D8A",
        fontSize: 14, fontWeight: active ? 700 : 500, fontFamily: UP_FONT,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
      }}>
        {label}
        <span style={{ background: active ? "#0C4160" : "#E0E8E8", color: active ? "#fff" : "#0C4160", borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
          {count}
        </span>
      </button>
    );
  }

  // â”€â”€ Render edit profile screen â”€â”€â”€â”€
  if (editingProfile) {
    return (
      <EditProfileScreen
        profile={editingProfile}
        onSave={handleEditSave}
        onCancel={function() { setEditingProfile(null); }}
        teamProfiles={teamProfiles}
        branches={branches}
      />
    );
  }

  // â”€â”€ Main page â”€â”€â”€â”€
  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8", fontFamily: UP_FONT }}>

      {/* Header */}
      <div style={HDR_STYLE}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>Team &amp; Users</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Manage roles, permissions, and team profiles</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E0E8E8", display: "flex", padding: "0 24px", overflowX: "auto" }}>
        {isAdmin && tabBtn("directory", "Directory", allProfiles.length)}
        {tabBtn("team",      "Internal Team", teamProfiles.length)}
        {isAdmin && tabBtn("branches", "Branches", branches.length)}
        {isAdmin && tabBtn("activity",  "Activity",  actActiveCount !== null ? actActiveCount + " active" : "â€¦")}
      </div>

      {/* Body */}
      <div style={{ maxWidth: activeTab === "directory" ? 1300 : 900, margin: "28px auto", padding: "0 20px", paddingBottom: 60 }}>

        {/* Loading / error */}
        {profilesLoading && activeTab !== "roster" && (
          <div style={{ textAlign: "center", padding: 60, color: "#6B7D8A", fontSize: 14 }}>Loadingâ€¦</div>
        )}
        {!profilesLoading && profilesError && activeTab !== "roster" && (
          <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "14px 18px", borderRadius: 10, fontSize: 13 }}>âš  {profilesError}</div>
        )}

        {/* â”€â”€ INTERNAL TEAM TAB â”€â”€ */}
        {activeTab === "team" && !profilesLoading && !profilesError && (
          <div>
            {(function() {
              const TH = { padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748b", textAlign: "left", borderBottom: "2px solid #E8EEF4", whiteSpace: "nowrap", userSelect: "none", cursor: "pointer" };
              const TD = { padding: "10px 12px", fontSize: 13, color: "#0C4160", borderBottom: "1px solid #F0F4F8", verticalAlign: "middle" };

              function thArrow(col) {
                if (teamSort.col !== col) return <span style={{ opacity: 0.3, marginLeft: 3 }}>â‡…</span>;
                return <span style={{ marginLeft: 3, color: "#2563eb" }}>{teamSort.dir === "asc" ? "â†‘" : "â†“"}</span>;
              }
              function toggleTeamSort(col) {
                setTeamSort(function(prev) {
                  if (prev.col === col) return { col: col, dir: prev.dir === "asc" ? "desc" : "asc" };
                  return { col: col, dir: "asc" };
                });
              }

              // Filter + sort
              var teamFiltered = teamProfiles.slice();
              if (teamSearch.trim()) {
                var q = teamSearch.toLowerCase();
                teamFiltered = teamFiltered.filter(function(p) {
                  return (p.display_name || "").toLowerCase().includes(q) ||
                         (p.email || "").toLowerCase().includes(q) ||
                         (p.nmls || "").toLowerCase().includes(q);
                });
              }
              if (teamRoleFilter !== "all") {
                var roleMap = { lo: ["admin","super_admin","branch_admin","internal"], builder: ["builder"], realtor: ["realtor"] };
                var allowed = roleMap[teamRoleFilter] || [teamRoleFilter];
                teamFiltered = teamFiltered.filter(function(p) { return allowed.includes(p.role); });
              }
              teamFiltered = teamFiltered.sort(function(a, b) {
                var mul = teamSort.dir === "asc" ? 1 : -1;
                if (teamSort.col === "name")  return mul * (a.display_name || a.email || "").localeCompare(b.display_name || b.email || "");
                if (teamSort.col === "email") return mul * (a.email || "").localeCompare(b.email || "");
                if (teamSort.col === "role")  return mul * (ROLE_ORDER[a.role] || 9) - mul * (ROLE_ORDER[b.role] || 9);
                if (teamSort.col === "nmls")  return mul * (a.nmls || "").localeCompare(b.nmls || "");
                if (teamSort.col === "phone") return mul * (a.phone || a.cell_phone || "").localeCompare(b.phone || b.cell_phone || "");
                return 0;
              });

              var allIds = teamFiltered.filter(function(p) { return p.id !== user.id; }).map(function(p) { return p.id; });
              var allSelected = allIds.length > 0 && allIds.every(function(id) { return selectedTeamIds.includes(id); });

              return (
                <div>
                  {/* â”€â”€ Toolbar â”€â”€ */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text" placeholder="Search by name, email, or NMLSâ€¦"
                      value={teamSearch} onChange={function(e) { setTeamSearch(e.target.value); }}
                      style={{ flex: "1 1 220px", padding: "9px 13px", borderRadius: 8, border: "1px solid #E0E8E8", background: "#fff", color: "#0C4160", fontSize: 13, fontFamily: UP_FONT, outline: "none" }}
                    />
                    <select value={teamRoleFilter} onChange={function(e) { setTeamRoleFilter(e.target.value); }}
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E0E8E8", background: "#fff", color: "#0C4160", fontSize: 13, fontFamily: UP_FONT, cursor: "pointer" }}>
                      <option value="all">All Roles</option>
                      <option value="lo">LO / Admin</option>
                      <option value="realtor">Realtors</option>
                      <option value="builder">Builders</option>
                    </select>
                    <span style={{ fontSize: 13, color: "#8A99A8", whiteSpace: "nowrap" }}>{teamFiltered.length} member{teamFiltered.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* â”€â”€ Bulk action bar â”€â”€ */}
                  {isAdmin && selectedTeamIds.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", marginBottom: 14, background: "#0C4160", borderRadius: 10, fontSize: 13, fontFamily: UP_FONT }}>
                      <span style={{ color: "#fff", fontWeight: 600 }}>{selectedTeamIds.length} selected</span>
                      <button onClick={clearTeamSelection} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: UP_FONT }}>âœ• Clear</button>
                      <div style={{ flex: 1 }} />
                      <select value={bulkRole} onChange={function(e) { setBulkRole(e.target.value); }}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", fontSize: 12, fontFamily: UP_FONT, background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>
                        <option value="">â€” Change role toâ€¦ â€”</option>
                        <option value="borrower">Borrower</option>
                        <option value="realtor">Realtor</option>
                        <option value="builder">Builder</option>
                        <option value="internal">Internal</option>
                        <option value="branch_admin">Branch Admin</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button onClick={handleBulkRoleChange} disabled={!bulkRole || bulkRoleSaving}
                        style={{ padding: "5px 12px", background: bulkResult === "role_saved" ? "#1B8A5A" : "#fff", color: bulkResult === "role_saved" ? "#fff" : "#0C4160", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: UP_FONT, opacity: (!bulkRole || bulkRoleSaving) ? 0.5 : 1 }}>
                        {bulkResult === "role_saved" ? "âœ“ Saved" : bulkRoleSaving ? "Savingâ€¦" : "Apply Role"}
                      </button>
                      <button onClick={function() { setConfirmBulkDel(true); }}
                        style={{ padding: "5px 14px", background: "#B91C1C", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: UP_FONT }}>
                        Delete {selectedTeamIds.length}
                      </button>
                    </div>
                  )}

                  {bulkResult === "deleted" && (
                    <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#166534", fontFamily: UP_FONT }}>
                      âœ… Profiles deleted. Their Supabase Auth login still exists â€” contact your Supabase admin to fully remove it if needed.
                    </div>
                  )}

                  {/* â”€â”€ Table â”€â”€ */}
                  <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EEF4", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#F7FAFB" }}>
                          <th style={{ ...TH, width: 36, cursor: "default" }} onClick={function(e) { e.stopPropagation(); }}>
                            {isAdmin && <input type="checkbox" checked={allSelected} onChange={function(e) {
                              if (e.target.checked) setSelectedTeamIds(function(prev) { var next = prev.slice(); allIds.forEach(function(id) { if (!next.includes(id)) next.push(id); }); return next; });
                              else setSelectedTeamIds(function(prev) { return prev.filter(function(id) { return !allIds.includes(id); }); });
                            }} style={{ cursor: "pointer" }} />}
                          </th>
                          <th style={TH} onClick={function() { toggleTeamSort("name"); }}>Name {thArrow("name")}</th>
                          <th style={TH} onClick={function() { toggleTeamSort("email"); }}>Email {thArrow("email")}</th>
                          <th style={TH} onClick={function() { toggleTeamSort("role"); }}>Role {thArrow("role")}</th>
                          <th style={TH} onClick={function() { toggleTeamSort("phone"); }}>Phone {thArrow("phone")}</th>
                          <th style={TH} onClick={function() { toggleTeamSort("nmls"); }}>NMLS {thArrow("nmls")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamFiltered.length === 0 && (
                          <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "#8A99A8", padding: "32px 0" }}>No members match your search.</td></tr>
                        )}
                        {teamFiltered.map(function(p) {
                          const isSelf     = p.id === user.id;
                          const isSelected = selectedTeamIds.includes(p.id);
                          return (
                            <tr key={p.id}
                              style={{ background: isSelected ? "rgba(12,65,96,0.06)" : "transparent", transition: "background 0.1s" }}
                              onMouseEnter={function(e) { if (!isSelected) e.currentTarget.style.background = "rgba(12,65,96,0.03)"; }}
                              onMouseLeave={function(e) { e.currentTarget.style.background = isSelected ? "rgba(12,65,96,0.06)" : "transparent"; }}
                            >
                              <td style={{ ...TD, width: 36 }} onClick={function(e) { e.stopPropagation(); }}>
                                {isAdmin && !isSelf && (
                                  <input type="checkbox" checked={isSelected} onChange={function() { toggleTeamSelect(p.id); }} style={{ cursor: "pointer" }} />
                                )}
                              </td>
                              <td style={TD}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                  {isAdmin && !isSelf
                                    ? <button onClick={function() { setEditingProfile(p); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#0C4160", fontFamily: UP_FONT, textDecoration: "underline", textDecorationColor: "#C5D5E4", textUnderlineOffset: 3 }}>{p.display_name || "(no name)"}</button>
                                    : <span style={{ fontWeight: 600 }}>{p.display_name || "(no name)"}</span>
                                  }
                                  {isSelf && <span style={{ fontSize: 9, color: "#1B8A5A", fontWeight: 700, background: "#E8F5E9", borderRadius: 99, padding: "1px 6px" }}>YOU</span>}
                                </div>
                              </td>
                              <td style={{ ...TD, color: "#6B7D8A", fontSize: 12 }}>{p.email_display || p.email || ""}</td>
                              <td style={TD}><RoleBadge role={p.role} /></td>
                              <td style={{ ...TD, color: "#6B7D8A", fontSize: 12, whiteSpace: "nowrap" }}>{p.phone ? upFmtPhone(p.phone) : p.cell_phone ? upFmtPhone(p.cell_phone) : ""}</td>
                              <td style={{ ...TD, color: "#6B7D8A", fontSize: 12 }}>{p.nmls || ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* â”€â”€ Bulk delete confirm modal â”€â”€ */}
            {confirmBulkDel && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", fontFamily: UP_FONT }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#B91C1C", margin: "0 0 10px 0" }}>Delete {selectedTeamIds.length} user{selectedTeamIds.length > 1 ? "s" : ""}?</h3>
                  <p style={{ fontSize: 13, color: "#6B7D8A", margin: "0 0 8px 0", lineHeight: 1.6 }}>
                    This removes their <strong>profile record</strong> from the app. Their Supabase Auth login will still exist â€” contact your Supabase admin to fully remove the auth account if needed.
                  </p>
                  <p style={{ fontSize: 13, color: "#B91C1C", margin: "0 0 20px 0", lineHeight: 1.6, fontWeight: 600 }}>This cannot be undone.</p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={function() { setConfirmBulkDel(false); }} style={BTN_SECONDARY}>Cancel</button>
                    <button onClick={handleBulkDelete} disabled={bulkDeleting}
                      style={Object.assign({}, BTN_PRIMARY, { background: "#B91C1C" }, bulkDeleting ? { opacity: 0.6, cursor: "wait" } : {})}>
                      {bulkDeleting ? "Deletingâ€¦" : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ BRANCHES TAB â”€â”€ */}
        {activeTab === "branches" && isAdmin && (
          <div>
            <p style={{ fontSize: 13, color: "#6B7D8A", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Manage branch offices. Branches can be assigned to team members in their Edit Profile screen.
            </p>

            {/* Add button */}
            {!branchForm && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={function() { setBranchForm(Object.assign({}, EMPTY_BRANCH)); setBranchError(""); }} style={BTN_PRIMARY}>
                  + Add Branch
                </button>
              </div>
            )}

            {/* Add / Edit form */}
            {branchForm && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", marginBottom: 20, boxShadow: "0 2px 14px rgba(0,0,0,0.10)", border: "2px solid #0C4160" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0C4160", marginBottom: 18 }}>
                  {branchForm.id ? "Edit Branch" : "Add New Branch"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
                  {[
                    ["Branch Name *", "name",    "e.g. Austin Branch",   "1 / -1"],
                    ["NMLS #",        "nmls",    "",                     ""],
                    ["Address",       "address", "Street address",       "1 / -1"],
                    ["City",          "city",    "",                     ""],
                    ["State",         "state",   "TX",                   ""],
                    ["Zip",           "zip",     "",                     ""],
                  ].map(function(row) {
                    return (
                      <div key={row[1]} style={row[3] ? { gridColumn: row[3] } : {}}>
                        <label style={LABEL_ST}>{row[0]}</label>
                        <input
                          type="text"
                          style={INPUT_ST}
                          value={branchForm[row[1]] || ""}
                          placeholder={row[2]}
                          onChange={function(e) {
                            var v = e.target.value;
                            setBranchForm(function(prev) { return Object.assign({}, prev, { [row[1]]: v }); });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {branchError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>âš  {branchError}</div>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={function() { setBranchForm(null); setBranchError(""); }} style={BTN_SECONDARY}>Cancel</button>
                  <button onClick={saveBranch} disabled={branchSaving} style={Object.assign({}, BTN_PRIMARY, branchSaving ? { opacity: 0.6, cursor: "wait" } : {})}>
                    {branchSaving ? "Savingâ€¦" : "Save Branch"}
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {branchesLoading && <div style={{ textAlign: "center", padding: 40, color: "#6B7D8A" }}>Loadingâ€¦</div>}

            {/* Branch table */}
            {!branchesLoading && branches.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 10, padding: "40px 24px", textAlign: "center", color: "#6B7D8A", fontSize: 14, border: "1px solid #E8EEF4" }}>
                No branches yet. Add your first branch above.
              </div>
            )}

            {!branchesLoading && branches.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #E8EEF4" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F7FAFB" }}>
                      {["Branch Name", "NMLS #", "Address", "City", "State", "Zip", ""].map(function(h) {
                        return <th key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8A99A8", textAlign: "left", borderBottom: "2px solid #E8EEF4", whiteSpace: "nowrap" }}>{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map(function(b) {
                      const TD = { padding: "9px 12px", fontSize: 13, color: "#0C4160", borderBottom: "1px solid #F0F4F8", verticalAlign: "middle" };
                      return (
                        <tr key={b.id}>
                          <td style={{ ...TD, fontWeight: 600 }}>{b.name}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.nmls || "â€”"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.address || "â€”"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.city || "â€”"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.state || "â€”"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.zip || "â€”"}</td>
                          <td style={{ ...TD, whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={function() { setBranchForm(Object.assign({}, b)); setBranchError(""); }}
                                style={Object.assign({}, BTN_GHOST, { padding: "4px 10px", fontSize: 11 })}>Edit</button>
                              <button onClick={function() { setConfirmDelBranch(b); }}
                                style={Object.assign({}, BTN_GHOST, { padding: "4px 10px", fontSize: 11, color: "#B91C1C", border: "1px solid #FECACA", background: "#FEF2F2" })}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Delete confirm overlay */}
            {confirmDelBranch && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", maxWidth: 400, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0C4160", margin: "0 0 12px 0", fontFamily: UP_FONT }}>Delete Branch?</h3>
                  <p style={{ fontSize: 14, color: "#6B7D8A", margin: "0 0 20px 0", fontFamily: UP_FONT }}>
                    Delete <strong>{confirmDelBranch.name}</strong>? Team members assigned to this branch will have their branch cleared. This cannot be undone.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={function() { setConfirmDelBranch(null); }} style={BTN_SECONDARY}>Cancel</button>
                    <button onClick={function() { deleteBranch(confirmDelBranch.id); }} style={Object.assign({}, BTN_PRIMARY, { background: "#B91C1C" })}>Delete</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ ACTIVITY TAB â”€â”€ */}
        {activeTab === "activity" && isAdmin && (
          <div>

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                value={actSearch}
                onChange={function(e) { setActSearch(e.target.value); }}
                placeholder="Search name or emailâ€¦"
                style={Object.assign({}, INPUT_ST, { maxWidth: 240, flex: "1 1 180px" })}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "1 1 auto" }}>
                {ACT_ROLE_FILTERS.map(function(f) {
                  var active = actRoleFilter === f.id;
                  return (
                    <button key={f.id} onClick={function() { setActRoleFilter(f.id); }} style={{
                      padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                      fontFamily: UP_FONT, cursor: "pointer",
                      border: "1.5px solid " + (active ? "#0C4160" : "#D1D9E6"),
                      background: active ? "#0C4160" : "#F0F4F8",
                      color: active ? "#fff" : "#0C4160",
                    }}>{f.label}</button>
                  );
                })}
              </div>
              <button
                onClick={refreshActivity}
                disabled={actLoading}
                style={Object.assign({}, BTN_GHOST, actLoading ? { opacity: 0.6, cursor: "wait" } : {})}
              >
                {actLoading ? "Loadingâ€¦" : "â†º Refresh"}
              </button>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { color: "#22C55E", label: "Active â‰¤ 3 days" },
                { color: "#F59E0B", label: "Active â‰¤ 7 days" },
                { color: "#F97316", label: "Active â‰¤ 15 days" },
                { color: "#D1D5DB", label: "Never / no data" },
              ].map(function(item) {
                return (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT }}>{item.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Summary strip */}
            {actLoaded && (
              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                  { label: "Total Users",   value: actMerged.length },
                  { label: "Active (15d)",  value: actMerged.filter(function(u) { return u.sessionCount > 0; }).length, hi: true },
                  { label: "Not Active",    value: actMerged.filter(function(u) { return u.sessionCount === 0; }).length },
                  { label: "Active Today",  value: actMerged.filter(function(u) { return u.daysSince === 0; }).length },
                ].map(function(chip) {
                  return (
                    <div key={chip.label} style={{
                      background: chip.hi ? "#EFF6FF" : "#fff",
                      border: "1px solid " + (chip.hi ? "#BFDBFE" : "#E0E8E8"),
                      borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 100,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: chip.hi ? "#1E40AF" : "#0C4160", fontFamily: UP_FONT }}>{chip.value}</div>
                      <div style={{ fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT, marginTop: 2 }}>{chip.label}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Loading spinner */}
            {actLoading && !actLoaded && (
              <div style={{ textAlign: "center", padding: 60, color: "#6B7D8A", fontSize: 14 }}>Loading activity dataâ€¦</div>
            )}

            {/* Table */}
            {actLoaded && (
              <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #E0E8E8", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F0F4F8", borderBottom: "2px solid #E0E8E8" }}>
                      <th style={{ width: 28, padding: "10px 8px 10px 16px" }} />
                      {[
                        { col: "name",     label: "Name / Email" },
                        { col: "role",     label: "Role" },
                        { col: "lastSeen", label: "Last Login" },
                        { col: "sessions", label: "Sessions (15d)" },
                      ].map(function(h) {
                        var isActive = actSort.col === h.col;
                        return (
                          <th key={h.col}
                            onClick={function() { toggleActSort(h.col); }}
                            style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700,
                              fontFamily: UP_FONT, color: isActive ? "#0C4160" : "#6B7D8A",
                              textTransform: "uppercase", letterSpacing: "0.06em", cursor: "pointer",
                              userSelect: "none", whiteSpace: "nowrap",
                            }}>
                            {h.label}
                            <span style={{ marginLeft: 4, opacity: isActive ? 1 : 0.3 }}>
                              {isActive ? (actSort.dir === "asc" ? " â†‘" : " â†“") : " â†•"}
                            </span>
                          </th>
                        );
                      })}
                      <th style={{ padding: "10px 16px 10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, fontFamily: UP_FONT, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {actFiltered.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "40px 24px", textAlign: "center", color: "#6B7D8A", fontSize: 14, fontFamily: UP_FONT }}>
                          No users match this filter.
                        </td>
                      </tr>
                    )}
                    {actFiltered.map(function(u, idx) {
                      var isInactive = u.sessionCount === 0;
                      var rc = ROLE_COLORS[u.role] || ROLE_COLORS.borrower;
                      return (
                        <tr key={u.id} style={{
                          borderBottom: idx < actFiltered.length - 1 ? "1px solid #F0F4F8" : "none",
                          background: isInactive ? "#FAFAFA" : "#fff",
                          opacity: isInactive ? 0.75 : 1,
                        }}>
                          {/* Status dot */}
                          <td style={{ padding: "12px 8px 12px 16px", verticalAlign: "middle" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: actDotColor(u.daysSince) }} />
                          </td>
                          {/* Name */}
                          <td style={{ padding: "12px 12px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#0C4160", fontFamily: UP_FONT }}>
                              {u.display_name || <em style={{ opacity: 0.5 }}>No name</em>}
                            </div>
                            <div style={{ fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT, marginTop: 1 }}>{u.email}</div>
                          </td>
                          {/* Role */}
                          <td style={{ padding: "12px 12px" }}>
                            <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, fontFamily: UP_FONT, background: rc.bg, color: rc.text, border: "1px solid " + rc.border, whiteSpace: "nowrap" }}>
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          </td>
                          {/* Last login relative */}
                          <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: u.sessionCount > 0 ? "#0C4160" : "#D1D5DB", fontFamily: UP_FONT }}>
                              {actRelDate(u.daysSince)}
                            </span>
                          </td>
                          {/* Session count */}
                          <td style={{ padding: "12px 12px" }}>
                            {u.sessionCount > 0
                              ? <span style={{ display: "inline-block", background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE", borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 700, fontFamily: UP_FONT }}>{u.sessionCount}</span>
                              : <span style={{ fontSize: 12, color: "#D1D5DB", fontFamily: UP_FONT }}>â€”</span>
                            }
                          </td>
                          {/* Exact date */}
                          <td style={{ padding: "12px 16px 12px 12px", fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT, whiteSpace: "nowrap" }}>
                            {actExactDate(u.lastSeen)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding: "10px 16px", borderTop: "1px solid #F0F4F8", fontSize: 12, color: "#94A3B0", fontFamily: UP_FONT }}>
                  Showing {actFiltered.length} of {actMerged.length} users Â· Last 15 days Â· Data collected since session tracking was enabled
                </div>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ DIRECTORY TAB â”€â”€ */}
        {activeTab === "directory" && isAdmin && !profilesLoading && !profilesError && (
          <div>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input type="text" value={dirSearch} onChange={function(e) { setDirSearch(e.target.value); }}
                placeholder="Search name, email, company, NMLSâ€¦"
                style={Object.assign({}, INPUT_ST, { maxWidth: 320, flex: "1 1 200px" })} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DIR_ROLE_FILTERS.map(function(f) {
                  var active = dirRoleFilter === f.id;
                  var count  = dirRoleCounts[f.id] !== undefined ? dirRoleCounts[f.id] : 0;
                  return (
                    <button key={f.id} onClick={function() { setDirRoleFilter(f.id); }} style={{
                      padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                      fontFamily: UP_FONT, cursor: "pointer",
                      border: "1.5px solid " + (active ? "#0C4160" : "#D1D9E6"),
                      background: active ? "#0C4160" : "#F0F4F8", color: active ? "#fff" : "#0C4160",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {f.label}
                      <span style={{ background: active ? "rgba(255,255,255,0.25)" : "#E0E8E8", color: active ? "#fff" : "#6B7D8A", borderRadius: 99, padding: "0 6px", fontSize: 10, fontWeight: 700 }}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: 12, color: "#8A99A8", whiteSpace: "nowrap" }}>{dirFiltered.length} of {allProfiles.length}</span>
            </div>

            {/* Bulk action bar */}
            {selectedDirIds.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 16px", marginBottom: 14, background: "#0C4160", borderRadius: 10, fontSize: 13, fontFamily: UP_FONT }}>
                <span style={{ color: "#fff", fontWeight: 600 }}>{selectedDirIds.length} selected</span>
                <button onClick={function() { setSelectedDirIds([]); setDirBulkRole(""); setDirBulkResult(null); }}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: UP_FONT }}>âœ• Clear</button>
                <div style={{ flex: 1 }} />
                <select value={dirBulkRole} onChange={function(e) { setDirBulkRole(e.target.value); }}
                  style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", fontSize: 12, fontFamily: UP_FONT, background: "rgba(255,255,255,0.12)", color: "#fff", cursor: "pointer" }}>
                  <option value="">â€” Change role toâ€¦ â€”</option>
                  <option value="borrower">Borrower</option>
                  <option value="realtor">Realtor</option>
                  <option value="builder">Builder</option>
                  <option value="internal">Internal</option>
                  <option value="branch_admin">Branch Admin</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={handleDirBulkRole} disabled={!dirBulkRole || dirBulkSaving}
                  style={{ padding: "5px 12px", background: dirBulkResult === "role_saved" ? "#1B8A5A" : "#fff", color: dirBulkResult === "role_saved" ? "#fff" : "#0C4160", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: UP_FONT, opacity: (!dirBulkRole || dirBulkSaving) ? 0.5 : 1 }}>
                  {dirBulkResult === "role_saved" ? "âœ“ Saved" : dirBulkSaving ? "Savingâ€¦" : "Apply Role"}
                </button>
                <button onClick={function() { setDirConfirmDel(true); }}
                  style={{ padding: "5px 14px", background: "#B91C1C", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: UP_FONT }}>
                  Delete {selectedDirIds.length}
                </button>
              </div>
            )}

            {dirBulkResult === "deleted" && (
              <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#166534", fontFamily: UP_FONT }}>
                âœ… Profiles deleted.
              </div>
            )}

            {/* Table */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EEF4", overflowX: "auto", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                <thead>
                  <tr style={{ background: "#F7FAFB", borderBottom: "2px solid #E8EEF4" }}>
                    {/* Select-all */}
                    <th style={{ width: 36, padding: "10px 0 10px 14px" }} onClick={function(e) { e.stopPropagation(); }}>
                      {(function() {
                        var allIds = dirFiltered.filter(function(p) { return p.id !== user.id; }).map(function(p) { return p.id; });
                        var allSel = allIds.length > 0 && allIds.every(function(id) { return selectedDirIds.includes(id); });
                        return <input type="checkbox" checked={allSel} style={{ cursor: "pointer" }} onChange={function(e) {
                          if (e.target.checked) setSelectedDirIds(function(prev) { var next = prev.slice(); allIds.forEach(function(id) { if (!next.includes(id)) next.push(id); }); return next; });
                          else setSelectedDirIds(function(prev) { return prev.filter(function(id) { return !allIds.includes(id); }); });
                        }} />;
                      })()}
                    </th>
                    {[
                      { col: "name",     label: "Name"       },
                      { col: null,       label: "Email"      },
                      { col: "role",     label: "Role"       },
                      { col: "branch",   label: "Branch"     },
                      { col: "company",  label: "Company"    },
                      { col: null,       label: "NMLS"       },
                      { col: "lastSeen", label: "Last Login" },
                    ].map(function(h, i) {
                      var isActive = h.col && dirSort.col === h.col;
                      return (
                        <th key={i} onClick={h.col ? function() { toggleDirSort(h.col); } : undefined} style={{
                          padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700,
                          fontFamily: UP_FONT, color: isActive ? "#0C4160" : "#6B7D8A",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          cursor: h.col ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
                        }}>
                          {h.label}
                          {h.col && <span style={{ marginLeft: 3, opacity: isActive ? 1 : 0.3 }}>{isActive ? (dirSort.dir === "asc" ? "â†‘" : "â†“") : "â‡…"}</span>}
                        </th>
                      );
                    })}
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {dirFiltered.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: "40px 24px", textAlign: "center", color: "#6B7D8A", fontSize: 14, fontFamily: UP_FONT }}>No people match this filter.</td></tr>
                  )}
                  {dirFiltered.map(function(p, idx) {
                    var isSelf    = p.id === user.id;
                    var isSelected = selectedDirIds.includes(p.id);
                    var menuOpen  = dirMenuOpenId === p.id;
                    return (
                      <tr key={p.id}
                        style={{ borderBottom: idx < dirFiltered.length - 1 ? "1px solid #F0F4F8" : "none", background: isSelected ? "rgba(12,65,96,0.06)" : isSelf ? "rgba(12,65,96,0.03)" : "#fff", transition: "background 0.1s" }}
                        onMouseEnter={function(e) { if (!isSelected) e.currentTarget.style.background = "rgba(12,65,96,0.02)"; }}
                        onMouseLeave={function(e) { e.currentTarget.style.background = isSelected ? "rgba(12,65,96,0.06)" : isSelf ? "rgba(12,65,96,0.03)" : "#fff"; }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: "10px 0 10px 14px", verticalAlign: "middle" }} onClick={function(e) { e.stopPropagation(); }}>
                          {!isSelf && <input type="checkbox" checked={isSelected} style={{ cursor: "pointer" }}
                            onChange={function() { setSelectedDirIds(function(prev) { return prev.includes(p.id) ? prev.filter(function(x) { return x !== p.id; }) : prev.concat([p.id]); }); }} />}
                        </td>
                        {/* Name */}
                        <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button onClick={function() { setEditingProfile(p); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#0C4160", fontFamily: UP_FONT, textDecoration: "underline", textDecorationColor: "#C5D5E4", textUnderlineOffset: 3, textAlign: "left" }}>
                              {p.display_name || "(no name)"}
                            </button>
                            {isSelf && <span style={{ fontSize: 9, color: "#1B8A5A", fontWeight: 700, background: "#E8F5E9", borderRadius: 99, padding: "1px 6px" }}>YOU</span>}
                          </div>
                          {p.title && <div style={{ fontSize: 12, color: "#8A99A8", fontFamily: UP_FONT, marginTop: 1 }}>{p.title}</div>}
                        </td>
                        {/* Email */}
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT, whiteSpace: "nowrap" }}>{p.email || "â€”"}</td>
                        {/* Role badge only */}
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}><RoleBadge role={p.role} /></td>
                        {/* Branch */}
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT, whiteSpace: "nowrap" }}>{p.branchName || <span style={{ color: "#D1D5DB" }}>â€”</span>}</td>
                        {/* Company */}
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT, whiteSpace: "nowrap" }}>{p.company || <span style={{ color: "#D1D5DB" }}>â€”</span>}</td>
                        {/* NMLS */}
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "#8A99A8", fontFamily: UP_FONT, whiteSpace: "nowrap" }}>{p.nmls ? "#" + p.nmls : <span style={{ color: "#D1D5DB" }}>â€”</span>}</td>
                        {/* Last Login */}
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          {actLoaded ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: p.sessionCount > 0 ? "#0C4160" : "#D1D5DB", fontFamily: UP_FONT }}>{actRelDate(p.daysSince)}</div>
                              {p.lastSeen && <div style={{ fontSize: 10, color: "#94A3B0", fontFamily: UP_FONT }}>{actExactDate(p.lastSeen)}</div>}
                            </div>
                          ) : <span style={{ fontSize: 12, color: "#D1D5DB", fontFamily: UP_FONT }}>â€”</span>}
                        </td>
                        {/* Three-dot menu */}
                        <td style={{ padding: "10px 12px", textAlign: "center", verticalAlign: "middle" }} onClick={function(e) { e.stopPropagation(); }}>
                          {isAdmin && (
                            <div style={{ position: "relative", display: "inline-block" }}>
                              <button
                                onClick={function(e) { e.stopPropagation(); setDirMenuOpenId(menuOpen ? null : p.id); }}
                                style={{ background: "none", border: "1px solid #E0E8E8", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontSize: 15, color: "#6B7D8A", lineHeight: 1, fontFamily: UP_FONT }}>
                                Â·Â·Â·
                              </button>
                              {menuOpen && (
                                <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 200, background: "#fff", border: "1px solid #E0E8E8", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", minWidth: 150, overflow: "hidden" }}>
                                  <button onClick={function() { setEditingProfile(p); setDirMenuOpenId(null); }}
                                    style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, fontFamily: UP_FONT, color: "#0C4160", cursor: "pointer" }}>
                                    âœï¸ Edit Profile
                                  </button>
                                  {!isSelf && (
                                    <button onClick={function() { setDirConfirmSingle(p); setDirMenuOpenId(null); }}
                                      style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, fontFamily: UP_FONT, color: "#B91C1C", cursor: "pointer" }}>
                                      ðŸ—‘ï¸ Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: "10px 16px", borderTop: "1px solid #F0F4F8", fontSize: 12, color: "#94A3B0", fontFamily: UP_FONT, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <span>{dirFiltered.length} of {allProfiles.length} people shown</span>
                <span>{actLoaded ? "âœ“ Login data loaded" : "Login data loads when Activity tab is opened"}</span>
              </div>
            </div>

            {/* Single delete confirm */}
            {dirConfirmSingle && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", fontFamily: UP_FONT }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#B91C1C", margin: "0 0 10px 0" }}>Delete {dirConfirmSingle.display_name || "this user"}?</h3>
                  <p style={{ fontSize: 13, color: "#6B7D8A", margin: "0 0 20px 0", lineHeight: 1.6 }}>This removes their profile record. Their Supabase Auth login will still exist. This cannot be undone.</p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={function() { setDirConfirmSingle(null); }} style={BTN_SECONDARY}>Cancel</button>
                    <button onClick={function() { handleDirDeleteSingle(dirConfirmSingle.id); }} style={Object.assign({}, BTN_PRIMARY, { background: "#B91C1C" })}>Delete</button>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk delete confirm */}
            {dirConfirmDel && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)", fontFamily: UP_FONT }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#B91C1C", margin: "0 0 10px 0" }}>Delete {selectedDirIds.length} user{selectedDirIds.length > 1 ? "s" : ""}?</h3>
                  <p style={{ fontSize: 13, color: "#6B7D8A", margin: "0 0 8px 0", lineHeight: 1.6 }}>This removes their profile records. This cannot be undone.</p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={function() { setDirConfirmDel(false); }} style={BTN_SECONDARY}>Cancel</button>
                    <button onClick={handleDirBulkDelete} disabled={dirBulkDeleting} style={Object.assign({}, BTN_PRIMARY, { background: "#B91C1C" }, dirBulkDeleting ? { opacity: 0.6 } : {})}>
                      {dirBulkDeleting ? "Deletingâ€¦" : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

window.UsersPanel = UsersPanel;
