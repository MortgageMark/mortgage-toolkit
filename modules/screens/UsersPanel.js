// modules/screens/UsersPanel.js
// Full-page admin screen for managing team members, roles, and borrower permissions.
// Replaces/supplements the AdminPanel popup — accessible from the Scenario Dashboard.
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
  borrower:     { bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB" },
};
const ROLE_LABELS = { super_admin: "Super Admin", admin: "Admin", branch_admin: "Branch Admin", internal: "Internal", realtor: "Realtor", borrower: "Borrower" };

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

// ── Shared button styles (light theme) ──────────────────────────────────────
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

// ── Edit Profile full-screen form ───────────────────────────────────────────
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

  const FIELDS = [
    { key: "display_name",  label: "Display Name",         placeholder: "Full name",      span: 2 },
    { key: "email_display", label: "Email — PQ Letter",    placeholder: "name@email.com", span: 2 },
    { key: "title",         label: "Title",                placeholder: "Loan Officer"          },
    { key: "company",       label: "Company",              placeholder: "CMG Home Loans"        },
    { key: "nmls",          label: "NMLS #",               placeholder: ""                      },
    { key: "branch_nmls",   label: "Branch NMLS #",        placeholder: ""                      },
    { key: "company_nmls",  label: "Company NMLS #",       placeholder: ""                      },
    { key: "phone",         label: "Phone (Office)",       placeholder: "(555) 555-5555"        },
    { key: "cell_phone",    label: "Cell Phone",           placeholder: "(555) 555-5555"        },
    { key: "website",       label: "Website",              placeholder: "https://...",    span: 2 },
    { key: "address",       label: "Address",              placeholder: "Street address", span: 2 },
    { key: "city",          label: "City",                 placeholder: ""                      },
    { key: "state",         label: "State",                placeholder: "TX"                    },
    { key: "zip",           label: "Zip",                  placeholder: ""                      },
  ];

  // Potential team leads = non-borrower profiles excluding self
  const potentialLeads = (teamProfiles || []).filter(function(p) { return p.id !== profile.id; });

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8", fontFamily: UP_FONT }}>
      <div style={HDR_STYLE}>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: UP_FONT, fontWeight: 600 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Edit Profile</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{profile.display_name || profile.email}</div>
        </div>
      </div>
      <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "28px 28px", boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>

          {/* Login ID — read only */}
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL_ST}>Email — Login ID <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(read-only — managed by Supabase Auth)</span></label>
            <div style={Object.assign({}, INPUT_ST, { background: "#EEF2F6", color: "#6B7D8A", cursor: "default", display: "flex", alignItems: "center", gap: 8 })}>
              <span style={{ fontSize: 13 }}>🔒</span>
              {profile.email || <em style={{ opacity: 0.5 }}>no login email on record</em>}
            </div>
            <div style={{ fontSize: 11, color: "#94A3B0", marginTop: 4, lineHeight: 1.4 }}>
              To change the login email, the user must update it from their own account or contact Supabase Auth directly.
            </div>
          </div>

          {/* Team Lead + Branch — two-column dropdowns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 18 }}>
            <div>
              <label style={LABEL_ST}>Team Lead</label>
              <select
                value={form.team_lead_id}
                onChange={function(e) { setField("team_lead_id", e.target.value); }}
                style={Object.assign({}, INPUT_ST, { cursor: "pointer" })}
              >
                <option value="">— No team (standalone) —</option>
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
                <option value="">— No branch assigned —</option>
                {(branches || []).map(function(b) {
                  return <option key={b.id} value={b.id}>{b.name}{b.nmls ? " (NMLS " + b.nmls + ")" : ""}</option>;
                })}
              </select>
            </div>
          </div>

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

          {error && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 14 }}>⚠ {error}</div>}
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
              {saved ? "✓ Saved" : saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main UsersPanel ──────────────────────────────────────────────────────────
function UsersPanel({ user, onBack, onLogout }) {
  const [activeTab, setActiveTab] = useState("team");

  // ── Supabase profile data ────
  const [allProfiles,     setAllProfiles]     = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError,   setProfilesError]   = useState(null);

  // ── Role management ────
  const [editRoles, setEditRoles] = useState({});
  const [roleSaving, setRoleSaving] = useState({});
  const [roleSaved,  setRoleSaved]  = useState({});
  const [roleError,  setRoleError]  = useState({});

  // ── Password reset ────
  const [pwSending, setPwSending] = useState({});
  const [pwResult,  setPwResult]  = useState({});  // id → "sent" | "error"

  // ── Team share toggle ────
  const [teamShareEdit,   setTeamShareEdit]   = useState({});  // leadId → bool
  const [teamShareSaving, setTeamShareSaving] = useState({});
  const [teamShareSaved,  setTeamShareSaved]  = useState({});

  // ── Borrower permissions ────
  const [permsEdit,   setPermsEdit]   = useState({});
  const [permsSaving, setPermsSaving] = useState({});
  const [permsSaved,  setPermsSaved]  = useState({});

  // ── Edit profile screen ────
  const [editingProfile, setEditingProfile] = useState(null);

  // ── Branches ────
  const [branches,        setBranches]        = useState([]);
  const [branchesLoaded,  setBranchesLoaded]  = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchForm,      setBranchForm]      = useState(null);  // null=hidden, {}=add, {id,...}=edit
  const [branchSaving,    setBranchSaving]    = useState(false);
  const [branchError,     setBranchError]     = useState("");
  const [confirmDelBranch, setConfirmDelBranch] = useState(null);

  // ── Local roster ────
  const [roster,          setRoster]          = useLocalStorage("roster", []);
  const [showAddForm,     setShowAddForm]     = useState(false);
  const [editingMember,   setEditingMember]   = useState(null);
  const [memberForm,      setMemberForm]      = useState({});
  const [memberFormError, setMemberFormError] = useState("");
  const [confirmDeact,    setConfirmDeact]    = useState(null);
  const [rosterSearch,    setRosterSearch]    = useState("");

  const isAdmin      = user && ["super_admin", "admin"].includes(user.role);
  const isSuperAdmin = user && user.role === "super_admin";

  // ── Load all Supabase profiles ────
  useEffect(function() {
    if (!supabase) { setProfilesLoading(false); return; }
    supabase
      .from("profiles")
      .select("id, display_name, email, email_display, role, nmls, phone, cell_phone, company, title, address, city, state, zip, branch_nmls, company_nmls, website, team_lead_id, team_share_scenarios, branch_id")
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

  // ── Load borrower_permissions lazily when Borrowers tab is opened ────
  // Kept separate because the column may not exist in all deployments.
  const [permsLoaded, setPermsLoaded] = useState(false);
  useEffect(function() {
    if (activeTab !== "borrowers" || permsLoaded || !supabase) return;
    supabase
      .from("profiles")
      .select("id, borrower_permissions")
      .eq("role", "borrower")
      .then(function(res) {
        setPermsLoaded(true);
        if (res.error) return; // column missing — perms stay empty, savePerm will also fail gracefully
        const init = {};
        (res.data || []).forEach(function(p) {
          init[p.id] = Array.isArray(p.borrower_permissions) ? p.borrower_permissions : [];
        });
        setPermsEdit(init);
      });
  }, [activeTab, permsLoaded]);

  // ── Load branches lazily when Branches tab is opened ────
  useEffect(function() {
    if (activeTab !== "branches" || branchesLoaded || !supabase) return;
    setBranchesLoading(true);
    supabase.from("branches").select("*").order("name").then(function(res) {
      setBranchesLoading(false);
      setBranchesLoaded(true);
      if (!res.error) setBranches(res.data || []);
    });
  }, [activeTab, branchesLoaded]);

  const ROLE_ORDER  = { super_admin: 0, admin: 1, branch_admin: 2, internal: 3, realtor: 4, borrower: 5 };
  const teamProfiles     = allProfiles.filter(function(p) { return p.role !== "borrower"; });
  const borrowerProfiles = allProfiles.filter(function(p) { return p.role === "borrower"; });

  // Build team groups: keyed by team lead ID, value = { lead, members[] }
  // A profile is a "member" if team_lead_id points to another profile's id
  const teamGroups = React.useMemo(function() {
    const leadMap = {};  // leadId → { lead: profile, members: [] }
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
          // No one is under them — standalone
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

  // ── Role save ────
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

  // ── Team share scenarios toggle ────
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

  // ── Branch save / delete ────
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

  // ── Password reset ────
  async function sendPwReset(profile) {
    if (!supabase || !profile.email) return;
    setPwSending(function(p) { return Object.assign({}, p, { [profile.id]: true }); });
    setPwResult(function(p)  { return Object.assign({}, p, { [profile.id]: null }); });
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: window.location.href
    });
    setPwSending(function(p) { return Object.assign({}, p, { [profile.id]: false }); });
    setPwResult(function(p)  { return Object.assign({}, p, { [profile.id]: error ? "error" : "sent" }); });
    setTimeout(function() {
      setPwResult(function(p) { return Object.assign({}, p, { [profile.id]: null }); });
    }, 6000);
  }

  // ── Borrower permissions ────
  const BASE_TABS    = ["about", "payment", "refi", "fees", "compare", "breakeven"];
  const GRANTABLE    = MODULE_DEFS ? MODULE_DEFS.filter(function(m) { return !BASE_TABS.includes(m.id); }) : [];

  function togglePerm(userId, tabId) {
    setPermsEdit(function(prev) {
      const cur  = prev[userId] || [];
      const next = cur.includes(tabId) ? cur.filter(function(t) { return t !== tabId; }) : cur.concat([tabId]);
      return Object.assign({}, prev, { [userId]: next });
    });
  }

  async function savePerm(userId) {
    if (!supabase) return;
    setPermsSaving(function(p) { return Object.assign({}, p, { [userId]: true }); });
    await supabase.from("profiles").update({ borrower_permissions: permsEdit[userId] || [] }).eq("id", userId);
    setPermsSaving(function(p) { return Object.assign({}, p, { [userId]: false }); });
    setPermsSaved(function(p)  { return Object.assign({}, p, { [userId]: true }); });
    setTimeout(function() {
      setPermsSaved(function(p) { return Object.assign({}, p, { [userId]: false }); });
    }, 2500);
  }

  // ── Edit profile callbacks ────
  function handleEditSave(updatedFields) {
    setAllProfiles(function(prev) {
      return prev.map(function(p) {
        return p.id === editingProfile.id ? Object.assign({}, p, updatedFields) : p;
      });
    });
    setEditingProfile(null);
  }

  // ── Local roster helpers ────
  const EMPTY_MEMBER = { id: "", name: "", title: "Loan Officer", company: "CMG Home Loans", phone: "", email: "", nmls: "", branchNmls: "", role: "internal", active: true, firstLogin: true, passwordHash: "" };

  function startAddMember() {
    setMemberForm(Object.assign({}, EMPTY_MEMBER));
    setEditingMember(null);
    setShowAddForm(true);
    setMemberFormError("");
  }
  function startEditMember(m) {
    setMemberForm(Object.assign({}, m));
    setEditingMember(m);
    setShowAddForm(true);
    setMemberFormError("");
  }
  function cancelMemberForm() {
    setShowAddForm(false);
    setEditingMember(null);
    setMemberForm({});
    setMemberFormError("");
  }
  function saveMember() {
    if (!memberForm.name || !memberForm.name.trim()) { setMemberFormError("Name is required."); return; }
    const updated = roster.slice();
    if (editingMember) {
      const idx = updated.findIndex(function(m) { return m.id === editingMember.id; });
      if (idx >= 0) updated[idx] = Object.assign({}, memberForm, { passwordHash: updated[idx].passwordHash });
    } else {
      updated.push(Object.assign({}, memberForm, { id: generateId() }));
    }
    setRoster(updated);
    cancelMemberForm();
  }
  function deactivateMember(id) {
    setRoster(roster.map(function(m) { return m.id === id ? Object.assign({}, m, { active: false }) : m; }));
    setConfirmDeact(null);
  }
  function reactivateMember(id) {
    setRoster(roster.map(function(m) { return m.id === id ? Object.assign({}, m, { active: true }) : m; }));
  }

  // ── Tab bar item ────
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

  // ── Render edit profile screen ────
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

  // ── Main page ────
  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8", fontFamily: UP_FONT }}>

      {/* Header */}
      <div style={HDR_STYLE}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>Team &amp; Users</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Manage roles, permissions, and team profiles</div>
        </div>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: UP_FONT, fontWeight: 600 }}>← Back</button>
        {onLogout && (
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: UP_FONT, marginLeft: 8 }}>Logout</button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E0E8E8", display: "flex", padding: "0 24px", overflowX: "auto" }}>
        {tabBtn("team",      "Internal Team", teamProfiles.length)}
        {tabBtn("borrowers", "Borrowers",     borrowerProfiles.length)}
        {tabBtn("roster",    "Local Roster",  roster.length)}
        {isAdmin && tabBtn("branches", "Branches", branches.length)}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "28px auto", padding: "0 20px", paddingBottom: 60 }}>

        {/* Loading / error */}
        {profilesLoading && activeTab !== "roster" && (
          <div style={{ textAlign: "center", padding: 60, color: "#6B7D8A", fontSize: 14 }}>Loading…</div>
        )}
        {!profilesLoading && profilesError && activeTab !== "roster" && (
          <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "14px 18px", borderRadius: 10, fontSize: 13 }}>⚠ {profilesError}</div>
        )}

        {/* ── INTERNAL TEAM TAB ── */}
        {activeTab === "team" && !profilesLoading && !profilesError && (
          <div>
            {teamProfiles.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "40px 24px", textAlign: "center", color: "#6B7D8A", fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                No internal or admin accounts found.
              </div>
            )}

            {(function() {
              const TH = { padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8A99A8", textAlign: "left", borderBottom: "2px solid #E8EEF4", whiteSpace: "nowrap" };
              const TD = { padding: "9px 12px", fontSize: 13, color: "#0C4160", borderBottom: "1px solid #F0F4F8", verticalAlign: "middle" };

              function ProfileRow({ p, isTeamLead, indent }) {
                const isSelf       = p.id === user.id;
                const selRole      = editRoles[p.id] || p.role || "borrower";
                const hasChanged   = selRole !== (p.role || "borrower");
                const resetResult  = pwResult[p.id];
                const resetSending = pwSending[p.id];
                return (
                  <tr style={{ background: isSelf ? "rgba(12,65,96,0.04)" : "transparent" }}>
                    <td style={TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: indent ? 20 : 0 }}>
                        {indent && <span style={{ color: "#D1D9E6", fontSize: 14 }}>↳</span>}
                        <span style={{ fontWeight: 600 }}>{p.display_name || "(no name)"}</span>
                        {isSelf && <span style={{ fontSize: 9, color: "#1B8A5A", fontWeight: 700, background: "#E8F5E9", borderRadius: 99, padding: "1px 6px" }}>YOU</span>}
                        {isTeamLead && <span style={{ fontSize: 9, color: "#3730A3", fontWeight: 700, background: "#E0E7FF", borderRadius: 99, padding: "1px 6px" }}>LEAD</span>}
                      </div>
                    </td>
                    <td style={{ ...TD, color: "#6B7D8A", fontSize: 12 }}>{p.email}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}><RoleBadge role={p.role} /></td>
                    <td style={{ ...TD, color: "#8A99A8", fontSize: 12, whiteSpace: "nowrap" }}>{p.nmls ? "NMLS #" + p.nmls : ""}</td>
                    <td style={{ ...TD, color: "#8A99A8", fontSize: 12, whiteSpace: "nowrap" }}>{p.phone ? upFmtPhone(p.phone) : ""}</td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }} onClick={function(e) { e.stopPropagation(); }}>
                      {isAdmin && !isSelf && (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select
                            value={selRole}
                            onChange={function(e) { var v = e.target.value; setEditRoles(function(prev) { return Object.assign({}, prev, { [p.id]: v }); }); }}
                            style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid #E0E8E8", fontSize: 12, fontFamily: UP_FONT, background: "#fff", color: "#0C4160", cursor: "pointer" }}
                          >
                            <option value="borrower">Borrower</option>
                            <option value="realtor">Realtor</option>
                            <option value="internal">Internal</option>
                            <option value="branch_admin">Branch Admin</option>
                            <option value="admin">Admin</option>
                            {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                          </select>
                          <button onClick={function() { saveRole(p.id); }} disabled={!hasChanged || roleSaving[p.id]}
                            style={Object.assign({}, BTN_SM, { padding: "4px 9px", fontSize: 11 }, !hasChanged ? { opacity: 0.3, cursor: "default" } : {}, roleSaved[p.id] ? { background: "#1B8A5A" } : {})}>
                            {roleSaved[p.id] ? "✓" : roleSaving[p.id] ? "…" : "Save"}
                          </button>
                        </div>
                      )}
                      {roleError[p.id] && <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 3 }}>⚠ {roleError[p.id]}</div>}
                    </td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }} onClick={function(e) { e.stopPropagation(); }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {isAdmin && (
                          <button onClick={function() { setEditingProfile(p); }} style={Object.assign({}, BTN_GHOST, { padding: "4px 10px", fontSize: 11 })}>✏️ Edit</button>
                        )}
                        {p.email && (
                          <button onClick={function() { sendPwReset(p); }} disabled={resetSending}
                            style={Object.assign({}, BTN_GHOST, { padding: "4px 10px", fontSize: 11 },
                              resetResult === "sent"  ? { background: "#E8F5E9", color: "#1B8A5A", border: "1px solid #A7F3D0" } : {},
                              resetResult === "error" ? { background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FECACA" } : {},
                              resetSending ? { opacity: 0.6, cursor: "wait" } : {}
                            )}>
                            {resetResult === "sent" ? "✓ Sent" : resetResult === "error" ? "✗ Failed" : resetSending ? "…" : "🔑 Reset PW"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              function TeamTable({ rows }) {
                return (
                  <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #E8EEF4" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#F7FAFB" }}>
                          <th style={TH}>Name</th>
                          <th style={TH}>Email</th>
                          <th style={TH}>Role</th>
                          <th style={TH}>NMLS</th>
                          <th style={TH}>Phone</th>
                          <th style={TH}>Change Role</th>
                          <th style={TH}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>{rows}</tbody>
                    </table>
                  </div>
                );
              }

              return (
                <div>
                  {/* ── Teams ── */}
                  {teamGroups.teams.map(function(group) {
                    const lead = group.lead;
                    const sharing = teamShareEdit[lead.id] !== undefined ? teamShareEdit[lead.id] : !!lead.team_share_scenarios;
                    const origShare = !!lead.team_share_scenarios;
                    const shareChanged = sharing !== origShare;
                    const rows = [<ProfileRow key={lead.id} p={lead} isTeamLead={true} indent={false} />].concat(
                      group.members.slice().sort(function(a, b) { return (ROLE_ORDER[a.role] || 9) - (ROLE_ORDER[b.role] || 9); })
                        .map(function(m) { return <ProfileRow key={m.id} p={m} isTeamLead={false} indent={true} />; })
                    );
                    return (
                      <div key={lead.id} style={{ marginBottom: 24 }}>
                        <div style={{ background: "linear-gradient(90deg, #0C4160 0%, #1A5E8A 100%)", borderRadius: "10px 10px 0 0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", flex: 1 }}>
                            👥 {lead.display_name || lead.email}'s Team
                            <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>{group.members.length + 1} members</span>
                          </span>
                          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: isAdmin ? "pointer" : "default" }}>
                            <span style={{ fontSize: 11, color: "#fff", opacity: 0.85 }}>Share scenarios</span>
                            <input type="checkbox" checked={sharing} disabled={!isAdmin}
                              onChange={function(e) { if (!isAdmin) return; var v = e.target.checked; setTeamShareEdit(function(prev) { return Object.assign({}, prev, { [lead.id]: v }); }); }}
                              style={{ width: 15, height: 15, cursor: isAdmin ? "pointer" : "default" }}
                            />
                            {isAdmin && (shareChanged || teamShareSaving[lead.id] || teamShareSaved[lead.id]) && (
                              <button onClick={function() { saveTeamShare(lead.id); }} disabled={teamShareSaving[lead.id]}
                                style={{ padding: "2px 9px", fontSize: 10, fontWeight: 700, borderRadius: 5, border: "none", cursor: "pointer", background: teamShareSaved[lead.id] ? "#1B8A5A" : "#fff", color: teamShareSaved[lead.id] ? "#fff" : "#0C4160" }}>
                                {teamShareSaved[lead.id] ? "✓" : teamShareSaving[lead.id] ? "…" : "Save"}
                              </button>
                            )}
                          </label>
                        </div>
                        <TeamTable rows={rows} />
                      </div>
                    );
                  })}

                  {/* ── Standalone ── */}
                  {teamGroups.standalone.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      {teamGroups.teams.length > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8A99A8", marginBottom: 8, fontFamily: UP_FONT }}>
                          No Team Assigned
                        </div>
                      )}
                      <TeamTable rows={
                        teamGroups.standalone.slice()
                          .sort(function(a, b) { return (ROLE_ORDER[a.role] || 9) - (ROLE_ORDER[b.role] || 9); })
                          .map(function(p) { return <ProfileRow key={p.id} p={p} isTeamLead={false} indent={false} />; })
                      } />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── BORROWERS TAB ── */}
        {activeTab === "borrowers" && !profilesLoading && !profilesError && (
          <div>
            <p style={{ fontSize: 13, color: "#6B7D8A", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Grant individual borrower accounts access to additional calculator tabs beyond the default 6 (About, Payment, Refi, Fee Sheet, Compare, Break-Even).
            </p>

            {borrowerProfiles.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "40px 24px", textAlign: "center", color: "#6B7D8A", fontSize: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                No borrower accounts found.
              </div>
            )}

            {borrowerProfiles.map(function(b) {
              const editPerms   = permsEdit[b.id] || [];
              const resetResult = pwResult[b.id];
              const rSending    = pwSending[b.id];
              return (
                <div key={b.id} style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", marginBottom: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #E0E8E8" }}>

                  {/* Header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#6B7D8A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                      {(b.display_name || b.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0C4160" }}>{b.display_name || "(no name)"}</div>
                      <div style={{ fontSize: 12, color: "#6B7D8A" }}>{b.email}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {b.email && (
                        <button
                          onClick={function() { sendPwReset(b); }}
                          disabled={rSending}
                          style={Object.assign({}, BTN_GHOST, { fontSize: 11 },
                            resetResult === "sent"  ? { background: "#E8F5E9", color: "#1B8A5A", border: "1px solid #A7F3D0" } : {},
                            rSending ? { opacity: 0.6, cursor: "wait" } : {}
                          )}
                        >
                          {resetResult === "sent" ? "✓ Reset Sent" : rSending ? "…" : "🔑 Reset PW"}
                        </button>
                      )}
                      <button
                        onClick={function() { savePerm(b.id); }}
                        disabled={permsSaving[b.id]}
                        style={Object.assign({}, BTN_SM, permsSaved[b.id] ? { background: "#1B8A5A" } : {})}
                      >
                        {permsSaved[b.id] ? "✓ Saved" : permsSaving[b.id] ? "Saving…" : "Save Permissions"}
                      </button>
                    </div>
                  </div>

                  {/* Permission toggles */}
                  {GRANTABLE.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#6B7D8A" }}>No additional tabs available.</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {GRANTABLE.map(function(tab) {
                        const on = editPerms.includes(tab.id);
                        return (
                          <label key={tab.id} style={{
                            display: "flex", alignItems: "center", gap: 5,
                            fontSize: 12, fontWeight: 500, fontFamily: UP_FONT,
                            color: "#0C4160", cursor: "pointer",
                            padding: "5px 11px", borderRadius: 6,
                            border: "1px solid " + (on ? "#0C4160" : "#D1D9E6"),
                            background: on ? "rgba(12,65,96,0.09)" : "#F7FAFB",
                            userSelect: "none",
                          }}>
                            <input type="checkbox" checked={on} onChange={function() { togglePerm(b.id, tab.id); }} style={{ cursor: "pointer" }} />
                            {tab.icon} {tab.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── LOCAL ROSTER TAB ── */}
        {activeTab === "roster" && (
          <div>
            <p style={{ fontSize: 13, color: "#6B7D8A", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Local roster entries power the LO-of-record selector. Supabase-managed team members sync here automatically when they log in. Entries marked <strong>SUPABASE</strong> are cloud-managed.
            </p>

            {/* Controls */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search roster…"
                value={rosterSearch}
                onChange={function(e) { setRosterSearch(e.target.value); }}
                style={Object.assign({}, INPUT_ST, { maxWidth: 280, flex: 1 })}
              />
              <button onClick={startAddMember} style={BTN_PRIMARY}>+ Add Member</button>
            </div>

            {/* Add / Edit form */}
            {showAddForm && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", marginBottom: 20, boxShadow: "0 2px 14px rgba(0,0,0,0.10)", border: "2px solid #0C4160" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0C4160", marginBottom: 18 }}>
                  {editingMember ? "Edit Member" : "Add New Member"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
                  {[
                    ["Name *",        "name",       "Full name"],
                    ["Email",         "email",      "email@example.com"],
                    ["Title",         "title",      "Loan Officer"],
                    ["Company",       "company",    "CMG Home Loans"],
                    ["NMLS #",        "nmls",       ""],
                    ["Branch NMLS #", "branchNmls", ""],
                    ["Phone",         "phone",      "(555) 555-5555"],
                  ].map(function(row) {
                    return (
                      <div key={row[1]}>
                        <label style={LABEL_ST}>{row[0]}</label>
                        <input
                          type="text"
                          style={INPUT_ST}
                          value={memberForm[row[1]] || ""}
                          placeholder={row[2]}
                          onChange={function(e) {
                            var v = e.target.value;
                            setMemberForm(function(prev) { return Object.assign({}, prev, { [row[1]]: v }); });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {memberFormError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>⚠ {memberFormError}</div>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={cancelMemberForm} style={BTN_SECONDARY}>Cancel</button>
                  <button onClick={saveMember} style={BTN_PRIMARY}>Save</button>
                </div>
              </div>
            )}

            {/* Roster list */}
            {roster
              .filter(function(m) {
                if (!rosterSearch) return true;
                var q = rosterSearch.toLowerCase();
                return (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
              })
              .map(function(m) {
                return (
                  <div key={m.id} style={{
                    background: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 10,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                    border: "1px solid " + (m.active ? "#E0E8E8" : "#FECACA"),
                    opacity: m.active ? 1 : 0.68,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0C4160" }}>{m.name}</span>
                          {!m.active && <span style={{ fontSize: 10, color: "#B91C1C", background: "#FEE2E2", borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>INACTIVE</span>}
                          {m.passwordHash === "supabase-managed" && <span style={{ fontSize: 10, color: "#1a5fa8", background: "#DBEAFE", borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>SUPABASE</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7D8A", marginTop: 2 }}>
                          {[m.email, m.title, m.nmls ? "NMLS #" + m.nmls : null, m.phone ? upFmtPhone(m.phone) : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button onClick={function() { startEditMember(m); }} style={BTN_GHOST}>Edit</button>
                        {m.active
                          ? <button onClick={function() { setConfirmDeact(m); }} style={Object.assign({}, BTN_GHOST, { color: "#B91C1C", border: "1px solid #FECACA", background: "#FEF2F2" })}>Deactivate</button>
                          : <button onClick={function() { reactivateMember(m.id); }} style={Object.assign({}, BTN_GHOST, { color: "#1B8A5A", border: "1px solid #A7F3D0", background: "#F0FDF4" })}>Reactivate</button>
                        }
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Deactivate confirm overlay */}
            {confirmDeact && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", maxWidth: 400, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0C4160", margin: "0 0 12px 0", fontFamily: UP_FONT }}>Deactivate Member?</h3>
                  <p style={{ fontSize: 14, color: "#6B7D8A", margin: "0 0 20px 0", fontFamily: UP_FONT }}>
                    Deactivate {confirmDeact.name}? They will no longer appear as an LO-of-record option. You can reactivate them at any time.
                  </p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button onClick={function() { setConfirmDeact(null); }} style={BTN_SECONDARY}>Cancel</button>
                    <button onClick={function() { deactivateMember(confirmDeact.id); }} style={Object.assign({}, BTN_PRIMARY, { background: "#B91C1C" })}>Deactivate</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BRANCHES TAB ── */}
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
                {branchError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>⚠ {branchError}</div>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={function() { setBranchForm(null); setBranchError(""); }} style={BTN_SECONDARY}>Cancel</button>
                  <button onClick={saveBranch} disabled={branchSaving} style={Object.assign({}, BTN_PRIMARY, branchSaving ? { opacity: 0.6, cursor: "wait" } : {})}>
                    {branchSaving ? "Saving…" : "Save Branch"}
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {branchesLoading && <div style={{ textAlign: "center", padding: 40, color: "#6B7D8A" }}>Loading…</div>}

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
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.nmls || "—"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.address || "—"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.city || "—"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.state || "—"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.zip || "—"}</td>
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

      </div>
    </div>
  );
}

window.UsersPanel = UsersPanel;
