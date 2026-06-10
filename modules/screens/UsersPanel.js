// modules/screens/UsersPanel.js
// Full-page admin screen for managing team members, roles, and borrower permissions.
// Replaces/supplements the AdminPanel popup --" accessible from the Scenario Dashboard.
const { useState, useEffect } = React;
const supabase        = window._supabaseClient;
const useThemeColors  = window.useThemeColors;
const useLocalStorage = window.useLocalStorage;
const generateId      = window.generateId;
const MODULE_DEFS     = window.MODULE_DEFS;

const UP_FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const US_STATE_ABBRS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

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

const LMT_ROLE_LABELS = { lo: "Loan Officer", loa: "LOA", processor: "Processor", manager: "Branch Manager" };
function RoleBadge({ role, lmtRole }) {
  const rc = ROLE_COLORS[role] || ROLE_COLORS.borrower;
  var label = (role === "internal" && lmtRole && lmtRole !== "lo")
    ? (LMT_ROLE_LABELS[lmtRole] || lmtRole)
    : (ROLE_LABELS[role] || role);
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, fontFamily: UP_FONT, letterSpacing: "0.05em",
      background: rc.bg, color: rc.text, border: "1px solid " + rc.border,
    }}>
      {label}
    </span>
  );
}

function upFmtPhone(val) {
  var d = (val || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return val || "";
  if (d.length === 10) return "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6);
  return val;
}

// â"€â"€ Shared button styles (light theme) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€ Edit Profile full-screen form â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Phone number formatter: returns (XXX) XXX-XXXX as user types
function formatPhoneInput(raw) {
  var digits = (raw || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4)  return digits;
  if (digits.length < 7)  return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
}

// Generate a random 6-char uppercase invite code (no ambiguous chars)
function generateInviteCode() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code = "";
  for (var i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function EditProfileScreen({ profile, onSave, onCancel, teamProfiles, branches, viewerRole, isSelf }) {
  const [form, setForm] = useState({
    display_name:    profile.display_name    || "",
    email_display:   profile.email_display   || "",
    title:           profile.title           || "",
    company:         profile.company         || "",
    nmls:            profile.nmls            || "",
    is_branch_manager: !!(profile.is_branch_manager),
    branch_nmls:   profile.branch_nmls   || "",
    company_nmls:  profile.company_nmls  || "",
    phone:         formatPhoneInput(profile.phone      || ""),
    cell_phone:    formatPhoneInput(profile.cell_phone || ""),
    brokerage:     profile.brokerage     || "",
    website:       profile.website       || "",
    address:       profile.address       || "",
    city:          profile.city          || "",
    state:         profile.state         || "",
    zip:           profile.zip           || "",
    team_lead_id:  profile.team_lead_id  || "",
    branch_id:     profile.branch_id     || "",
    lmt_role:      profile.lmt_role      || "lo",
  });
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");
  const [myCode,        setMyCode]        = useState(profile.team_invite_code || "");
  const [joinCode,      setJoinCode]      = useState("");
  const [joinCodeErr,   setJoinCodeErr]   = useState("");
  const [joinBranch,    setJoinBranch]    = useState("");
  const [joinBranchErr, setJoinBranchErr] = useState("");
  const [copied,        setCopied]        = useState(false);
  const [profileTab,    setProfileTab]    = useState("profile");

  // Auto-generate invite code for LO profiles that don't have one yet
  React.useEffect(function() {
    if (!supabase || !profile || !profile.id) return;
    if (profile.team_invite_code) return;  // already has one
    var isLO = profile.role !== "borrower" && profile.role !== "realtor" && profile.role !== "builder";
    if (!isLO) return;
    var newCode = generateInviteCode();
    supabase.from("profiles").update({ team_invite_code: newCode }).eq("id", profile.id)
      .then(function(res) { if (!res.error) setMyCode(newCode); });
  }, []);

  function handleCopyCode() {
    if (!myCode) return;
    navigator.clipboard.writeText(myCode).then(function() {
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 2000);
    });
  }

  function setField(key, val) {
    setForm(function(prev) { return Object.assign({}, prev, { [key]: val }); });
  }

  async function handleSave() {
    if (!supabase) return;
    if (!profile || !profile.id) { setError("Profile ID is missing — please close and reopen My Profile."); return; }
    setSaving(true); setError("");
    // UUID helper: returns null if value is falsy OR the literal string "undefined"
    function safeUUID(v) { return (v && v !== "undefined") ? v : null; }
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
      team_lead_id:  safeUUID(form.team_lead_id),
      branch_id:     safeUUID(form.branch_id),
    };
    // Resolve branch join code → branch_id
    setJoinBranchErr("");
    if (joinBranch.trim()) {
      var { data: branchMatch, error: branchCodeErr } = await supabase
        .from("branches")
        .select("id, name")
        .eq("invite_code", joinBranch.trim().toUpperCase())
        .single();
      if (branchCodeErr || !branchMatch) {
        setJoinBranchErr("Branch code not found — double-check it with your branch admin.");
        setSaving(false);
        return;
      }
      payload.branch_id = branchMatch.id;
    }

    // Resolve join code → team_lead_id
    setJoinCodeErr("");
    if (joinCode.trim()) {
      var { data: leadProfile, error: codeErr } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("team_invite_code", joinCode.trim().toUpperCase())
        .single();
      if (codeErr || !leadProfile) {
        setJoinCodeErr("Code not found — double-check it with your team lead.");
        setSaving(false);
        return;
      }
      if (leadProfile.id === profile.id) {
        setJoinCodeErr("You can't join your own team.");
        setSaving(false);
        return;
      }
      payload.team_lead_id = leadProfile.id;
    }
    // Only admins can set is_branch_manager and lmt_role
    if (viewerRole === "admin" || viewerRole === "super_admin") {
      payload.is_branch_manager = !!form.is_branch_manager;
      if (isLORole) payload.lmt_role = form.lmt_role || "lo";
    }
    // Trim all string values before saving
    Object.keys(payload).forEach(function(k) {
      if (typeof payload[k] === "string") payload[k] = payload[k].trim() || null;
    });
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
    { key: "display_name",  label: "Display Name",      span: 2 },
    { key: "email_display", label: "Email - PQ Letter", span: 2 },
    { key: "title",         label: "Title"                       },
    { key: "company",       label: "Company"                     },
    { key: "nmls",          label: "NMLS #",            loOnly: true },
    { key: "branch_nmls",   label: "Branch NMLS #",     loOnly: true },
    { key: "company_nmls",  label: "Company NMLS #",    loOnly: true },
    { key: "phone",         label: "Phone (Office)"              },
    { key: "cell_phone",    label: "Cell Phone"                  },
    { key: "brokerage",     label: "Brokerage",         partnerOnly: true },
    { key: "website",       label: "Website",           span: 2  },
    { key: "address",       label: "Address",           span: 2  },
    { key: "city",          label: "City"                        },
    { key: "state",         label: "State",             dropdown: true },
    { key: "zip",           label: "Zip"                         },
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
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: UP_FONT, fontWeight: 600 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{profileTab === "activity" ? "Activity Report" : "Edit Profile"}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{profile.display_name || profile.email}</div>
        </div>
      </div>
      {/* Tab bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 0 }}>
        {[["profile", "👤 Profile"], ["activity", "📊 Activity Report"]].map(function(tab) {
          var active = profileTab === tab[0];
          return (
            <button key={tab[0]} onClick={function() { setProfileTab(tab[0]); }}
              style={{ padding: "12px 24px", fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "#0C4160" : "#64748b", background: "none", border: "none", borderBottom: active ? "2px solid #0C4160" : "2px solid transparent", cursor: "pointer", fontFamily: UP_FONT, marginBottom: -1 }}>
              {tab[1]}
            </button>
          );
        })}
      </div>
      {profileTab === "activity" && (function() {
        var ARPage = window.ActivityReportPage;
        return ARPage ? React.createElement(ARPage, { user: profile }) : React.createElement("div", { style: { padding: 40, textAlign: "center", color: "#64748b" } }, "Loading…");
      })()}
      {profileTab === "profile" && <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 20px" }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "28px 28px", boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>

          {/* Login ID --" read only */}
          <div style={{ marginBottom: 18 }}>
            <label style={LABEL_ST}>Email - Login ID <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(read-only - managed by Supabase Auth)</span></label>
            <div style={Object.assign({}, INPUT_ST, { background: "#EEF2F6", color: "#6B7D8A", cursor: "default", display: "flex", alignItems: "center", gap: 8 })}>
              <span style={{ fontSize: 13 }}>ðŸ"'</span>
              {profile.email || <em style={{ opacity: 0.5 }}>no login email on record</em>}
            </div>
            <div style={{ fontSize: 12, color: "#94A3B0", marginTop: 4, lineHeight: 1.4 }}>
              To change the login email, the user must update it from their own account or contact Supabase Auth directly.
            </div>
          </div>

          {/* Team Lead + Branch --" LO roles only */}
          {isLORole && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 18 }}>
            <div>
              <label style={LABEL_ST}>Team Lead</label>
              <select
                value={form.team_lead_id}
                onChange={function(e) { setField("team_lead_id", e.target.value); }}
                style={Object.assign({}, INPUT_ST, { cursor: "pointer" })}
              >
                <option value="">-- No team (standalone) --</option>
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
                <option value="">-- No branch assigned --</option>
                {(branches || []).map(function(b) {
                  return <option key={b.id} value={b.id}>{b.name}{b.nmls ? " (NMLS " + b.nmls + ")" : ""}</option>;
                })}
              </select>
            </div>
          </div>}

          {/* ── Team Invite Code (LO roles only) ──────────────────────────── */}
          {isLORole && <div style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>

            {/* My Team Code — share this with LOAs */}
            <div>
              <label style={LABEL_ST}>My Team Code <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(share with your LOAs)</span></label>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={Object.assign({}, INPUT_ST, { background: "#EEF2F6", color: "#0C4160", fontWeight: 700, letterSpacing: 2, cursor: "default", flex: 1 })}>
                  {myCode || <span style={{ opacity: 0.4, fontWeight: 400 }}>Generating…</span>}
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  style={{ padding: "0 14px", borderRadius: 8, border: "1px solid #C8D8E8", background: copied ? "#D1FAE5" : "#fff", color: copied ? "#065F46" : "#0C4160", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: UP_FONT }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>

            {/* Join a Team — enter your LO's code */}
            <div>
              <label style={LABEL_ST}>Join a Team <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(enter your LO's code)</span></label>
              <input
                style={Object.assign({}, INPUT_ST, { letterSpacing: 2, textTransform: "uppercase" })}
                value={joinCode}
                placeholder="e.g. MARK42"
                maxLength={6}
                onChange={function(e) { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setJoinCodeErr(""); }}
              />
              {joinCodeErr && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4, fontFamily: UP_FONT }}>{joinCodeErr}</div>}
            </div>

            {/* Join a Branch — enter branch code */}
            <div>
              <label style={LABEL_ST}>Join a Branch <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10 }}>(enter your branch code)</span></label>
              <input
                style={Object.assign({}, INPUT_ST, { letterSpacing: 2, textTransform: "uppercase" })}
                value={joinBranch}
                placeholder="e.g. CMG42"
                maxLength={6}
                onChange={function(e) { setJoinBranch(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setJoinBranchErr(""); }}
              />
              {joinBranchErr && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4, fontFamily: UP_FONT }}>{joinBranchErr}</div>}
            </div>
          </div>}

          {/* Lender Role — admin only, LO roles only */}
          {(viewerRole === "admin" || viewerRole === "super_admin") && isLORole && (
            <div style={{ marginBottom: 18 }}>
              <label style={LABEL_ST}>Lender Role</label>
              <select
                value={form.lmt_role}
                onChange={function(e) { setField("lmt_role", e.target.value); }}
                style={Object.assign({}, INPUT_ST, { cursor: "pointer" })}
              >
                <option value="lo">Loan Officer</option>
                <option value="loa">Loan Officer Assistant</option>
                <option value="processor">Processor</option>
                <option value="manager">Branch Manager</option>
              </select>
            </div>
          )}

          {/* Branch Manager designation — admin only, not shown on own profile */}
          {(viewerRole === "admin" || viewerRole === "super_admin") && !isSelf && isLORole && (
            <div style={{ marginBottom: 18, padding: "12px 16px", background: "#F0F4F8", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0C4160", fontFamily: UP_FONT }}>Branch Manager</div>
                <div style={{ fontSize: 11, color: "#6B7D8A", marginTop: 2, fontFamily: UP_FONT }}>Can manage their team: add members, set templates, edit permissions</div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!form.is_branch_manager}
                  onChange={function(e) { setField("is_branch_manager", e.target.checked); }}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: form.is_branch_manager ? "#1B8A5A" : "#6B7D8A", fontFamily: UP_FONT }}>
                  {form.is_branch_manager ? "Yes" : "No"}
                </span>
              </label>
            </div>
          )}

          {/* Editable fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginBottom: 20 }}>
            {FIELDS.map(function(f) {
              return (
                <div key={f.key} style={f.span === 2 ? { gridColumn: "1 / -1" } : {}}>
                  <label style={LABEL_ST}>{f.label}</label>
                  {f.dropdown ? (
                    <select
                      style={Object.assign({}, INPUT_ST, { cursor: "pointer" })}
                      value={form[f.key] || ""}
                      onChange={function(e) { setField(f.key, e.target.value); }}
                    >
                      <option value="">—</option>
                      {US_STATE_ABBRS.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
                    </select>
                  ) : (
                    <input
                      style={INPUT_ST}
                      value={form[f.key]}
                      placeholder=""
                      onChange={function(e) {
                        var val = (f.key === "phone" || f.key === "cell_phone")
                          ? formatPhoneInput(e.target.value)
                          : e.target.value;
                        setField(f.key, val);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {error && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 14 }}>! {error}</div>}
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
              {saved ? "Saved" : saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}

// â"€â"€ Main UsersPanel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function UsersPanel({ user, onBack, onLogout }) {
  const viewerRole = user && user.role;
  const isViewerAdmin = viewerRole === "admin" || viewerRole === "super_admin";
  const isViewerBranchManager = !!(user && user.is_branch_manager);
  const canManageUsers = isViewerAdmin || isViewerBranchManager;

  const [activeTab, setActiveTab] = useState("team");

  // â"€â"€ Supabase profile data â"€â"€â"€â"€
  const [allProfiles,     setAllProfiles]     = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError,   setProfilesError]   = useState(null);

  // â"€â"€ Role management â"€â"€â"€â"€
  const [editRoles,    setEditRoles]    = useState({});
  const [editLmtRoles, setEditLmtRoles] = useState({});
  const [roleSaving, setRoleSaving] = useState({});
  const [roleSaved,  setRoleSaved]  = useState({});
  const [roleError,  setRoleError]  = useState({});

  // â"€â"€ Team share toggle â"€â"€â"€â"€
  const [teamShareEdit,          setTeamShareEdit]          = useState({});  // leadId â†' bool
  const [teamShareSaving,        setTeamShareSaving]        = useState({});
  const [teamShareSaved,         setTeamShareSaved]         = useState({});
  const [teamShareContactsEdit,  setTeamShareContactsEdit]  = useState({});
  const [teamShareContactsSaving,setTeamShareContactsSaving]= useState({});
  const [teamShareContactsSaved, setTeamShareContactsSaved] = useState({});

  // â"€â"€ Team bulk selection â"€â"€â"€â"€
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [bulkRole,        setBulkRole]        = useState("");
  const [bulkRoleSaving,  setBulkRoleSaving]  = useState(false);
  const [bulkDeleting,    setBulkDeleting]    = useState(false);
  const [bulkResult,      setBulkResult]      = useState(null);  // "deleted" | "role_saved"
  const [confirmBulkDel,  setConfirmBulkDel]  = useState(false);

  const [copiedLinkId,  setCopiedLinkId]  = useState(null);
  const [accessSearch,  setAccessSearch]  = useState("");

  // â"€â"€ Directory bulk selection + three-dot menu â"€â"€â"€â"€
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

  // â"€â"€ Directory bulk handlers â"€â"€â"€â"€
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

  // â"€â"€ Edit profile screen â"€â"€â"€â"€
  const [editingProfile, setEditingProfile] = useState(null);

  // â"€â"€ Branches â"€â"€â"€â"€
  const [branches,        setBranches]        = useState([]);
  const [branchesLoaded,  setBranchesLoaded]  = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchForm,      setBranchForm]      = useState(null);  // null=hidden, {}=add, {id,...}=edit
  const [branchSaving,    setBranchSaving]    = useState(false);
  const [branchError,     setBranchError]     = useState("");
  const [confirmDelBranch, setConfirmDelBranch] = useState(null);

  // â"€â"€ Activity tab â"€â"€â"€â"€
  // My Branch (branch_admin self-service)
  const [myBranch,        setMyBranch]        = useState(null);
  const [myBranchLoaded,  setMyBranchLoaded]  = useState(false);
  const [myBranchForm,    setMyBranchForm]    = useState(null);
  const [myBranchSaving,  setMyBranchSaving]  = useState(false);
  const [myBranchError,   setMyBranchError]   = useState("");
  const [myBranchCopied,  setMyBranchCopied]  = useState(false);
  const [myBranchMembers, setMyBranchMembers] = useState([]);

  const [actSessions,   setActSessions]   = useState(null);
  const [actLoading,    setActLoading]    = useState(false);
  const [actLoaded,     setActLoaded]     = useState(false);
  const [actSearch,     setActSearch]     = useState("");
  const [actRoleFilter, setActRoleFilter] = useState("all");
  const [actSort,       setActSort]       = useState({ col: "lastSeen", dir: "desc" });
  const [dirSearch, setDirSearch] = useState("");
  const [dirRoleFilter, setDirRoleFilter] = useState("lo");
  const [dirSort, setDirSort] = useState({ col: "name", dir: "asc" });

  // â"€â"€ Team tab search / sort â"€â"€â"€â"€
  const [teamSearch,     setTeamSearch]     = useState("");
  const [teamRoleFilter, setTeamRoleFilter] = useState("all");
  const [teamSort,       setTeamSort]       = useState({ col: "name", dir: "asc" });

  // -- Team Leaders contact data ----------------------------------------------------------------------------------------
  const [teamContacts,        setTeamContacts]        = useState([]);
  const [teamContactsLoading, setTeamContactsLoading] = useState(false);
  const [myContactId,         setMyContactId]         = useState(null);

  const isAdmin        = user && ["super_admin", "admin", "branch_admin"].includes(user.role);
  const isSuperAdmin   = user && user.role === "super_admin";
  const isBranchAdmin  = user && user.role === "branch_admin";

  // â"€â"€ Load profiles â"€â"€â"€â"€
  // Admins see all; non-admins see only themselves
  useEffect(function() {
    if (!supabase) { setProfilesLoading(false); return; }
    var query = supabase
      .from("profiles")
      .select("id, display_name, email, email_display, role, lmt_role, nmls, phone, cell_phone, company, brokerage, title, address, city, state, zip, branch_nmls, company_nmls, website, team_lead_id, team_share_scenarios, team_share_contacts, branch_id")
      .order("display_name", { ascending: true });
    if (!isAdmin) query = query.eq("id", user.id);
    query
      .then(function(res) {
        // If a column doesn't exist yet, retry with minimal safe set
        if (res.error && res.error.message && (res.error.message.includes("email_display") || res.error.message.includes("team_lead_id") || res.error.message.includes("team_share_scenarios") || res.error.message.includes("branch_id"))) {
          return supabase
            .from("profiles")
            .select("id, display_name, email, role, lmt_role, nmls, phone, cell_phone, company, title, address, city, state, zip, branch_nmls, company_nmls, website")
            .order("display_name", { ascending: true });
        }
        return res;
      })
      .then(function(res) {
        setProfilesLoading(false);
        if (res.error) { setProfilesError(res.error.message); return; }
        const data = res.data || [];
        setAllProfiles(data);
        const shareVals = {};
        const shareContactVals = {};
        data.forEach(function(p) {
          shareVals[p.id] = !!p.team_share_scenarios;
          shareContactVals[p.id] = !!p.team_share_contacts;
        });
        setTeamShareEdit(shareVals);
        setTeamShareContactsEdit(shareContactVals);
      });
  }, []);

  // â"€â"€ Load branches on mount (admin only) â"€â"€â"€â"€
  useEffect(function() {
    if (branchesLoaded || !supabase || !isAdmin) return;
    setBranchesLoading(true);
    supabase.from("branches").select("*").order("name").then(function(res) {
      setBranchesLoading(false);
      setBranchesLoaded(true);
      if (!res.error) setBranches(res.data || []);
    });
  }, [branchesLoaded, isAdmin]);

  // Load My Branch when My Branch tab opens (branch_admin only)
  useEffect(function() {
    if (activeTab !== "mybranch" || myBranchLoaded || !supabase || !isBranchAdmin) return;
    setMyBranchLoaded(true);
    var branchId = user && user.branch_id;
    if (branchId) {
      supabase.from("branches").select("*").eq("id", branchId).single()
        .then(function(res) {
          if (!res.error && res.data) {
            setMyBranch(res.data);
            // load members
            supabase.from("profiles").select("id, display_name, email, role, nmls").eq("branch_id", branchId)
              .then(function(r) { if (!r.error) setMyBranchMembers(r.data || []); });
          }
        });
    }
  }, [activeTab, myBranchLoaded, isBranchAdmin]);

  // Lazy-load activity sessions when Activity tab opens
  useEffect(function() {
    if (activeTab !== "activity" || actLoaded || !supabase || !isAdmin) return;
    var fetchFn = window.fetchUserSessions;
    if (!fetchFn) { setActLoaded(true); return; }
    setActLoading(true);
    fetchFn(15).then(function(res) {
      setActLoading(false);
      setActLoaded(true);
      if (!res.error) setActSessions(res.data || []);
    }).catch(function() { setActLoading(false); setActLoaded(true); });
  }, [activeTab, actLoaded, isAdmin]);

  // -- Load business contacts when Team tab opens ----------------------------------------------------
  useEffect(function() {
    if (activeTab !== "team" || !supabase) return;
    setTeamContactsLoading(true);
    supabase.from("contacts")
      .select("id, first_name, last_name, lo_title, company, phone_cell, phone_work, email_personal, email_work, contact_category, team_lead_contact_id, branch_id")
      .eq("contact_type", "business")
      .in("contact_category", ["Lender", "Realtor", "Builder"])
      .eq("status", "active")
      .order("first_name", { ascending: true })
      .then(function(res) {
        setTeamContactsLoading(false);
        if (!res.error) setTeamContacts(res.data || []);
      });
    if (!isAdmin && user && user.email && !myContactId) {
      supabase.from("contacts")
        .select("id")
        .eq("contact_type", "business")
        .or("email_personal.eq." + user.email + ",email_work.eq." + user.email)
        .limit(1).maybeSingle()
        .then(function(res) {
          if (!res.error && res.data) setMyContactId(res.data.id);
        });
    }
  }, [activeTab]);

  const ROLE_ORDER  = { super_admin: 0, admin: 1, branch_admin: 2, internal: 3, realtor: 4, builder: 5, borrower: 6 };
  const teamProfiles = allProfiles.filter(function(p) { return p.role !== "borrower"; });

  // Build team groups: keyed by team lead ID, value = { lead, members[] }
  // A profile is a "member" if team_lead_id points to another profile's id
  const teamGroups = React.useMemo(function() {
    const leadMap = {};  // leadId â†' { lead: profile, members: [] }
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
          // No one is under them --" standalone
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

  // â"€â"€ Role save â"€â"€â"€â"€
  async function saveRole(profileId) {
    if (!supabase || profileId === user.id) return;
    const newRole = editRoles[profileId];
    if (!newRole) return;
    var payload = { role: newRole };
    if (newRole === "internal") {
      payload.lmt_role = editLmtRoles[profileId] || "lo";
    }
    setRoleSaving(function(p) { return Object.assign({}, p, { [profileId]: true }); });
    setRoleError(function(p)  { return Object.assign({}, p, { [profileId]: null }); });
    const { error } = await supabase.from("profiles").update(payload).eq("id", profileId);
    setRoleSaving(function(p) { return Object.assign({}, p, { [profileId]: false }); });
    if (error) {
      setRoleError(function(p) { return Object.assign({}, p, { [profileId]: error.message }); });
    } else {
      setAllProfiles(function(prev) {
        return prev.map(function(p) { return p.id === profileId ? Object.assign({}, p, payload) : p; });
      });
      setRoleSaved(function(p) { return Object.assign({}, p, { [profileId]: true }); });
      setTimeout(function() {
        setRoleSaved(function(p) { return Object.assign({}, p, { [profileId]: false }); });
      }, 2500);
    }
  }

  // â"€â"€ Team share scenarios toggle â"€â"€â"€â"€
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

  // â"€â"€ Team share contacts toggle â"€â"€â"€â"€
  async function saveTeamShareContacts(profileId) {
    if (!supabase) return;
    const newVal = !!teamShareContactsEdit[profileId];
    setTeamShareContactsSaving(function(p) { return Object.assign({}, p, { [profileId]: true }); });
    const { error } = await supabase.from("profiles").update({ team_share_contacts: newVal }).eq("id", profileId);
    setTeamShareContactsSaving(function(p) { return Object.assign({}, p, { [profileId]: false }); });
    if (!error) {
      setAllProfiles(function(prev) {
        return prev.map(function(p) { return p.id === profileId ? Object.assign({}, p, { team_share_contacts: newVal }) : p; });
      });
      setTeamShareContactsSaved(function(p) { return Object.assign({}, p, { [profileId]: true }); });
      setTimeout(function() {
        setTeamShareContactsSaved(function(p) { return Object.assign({}, p, { [profileId]: false }); });
      }, 2500);
    }
  }

  // â"€â"€ Branch save / delete â"€â"€â"€â"€
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
      // Insert — auto-generate invite code
      var newBranchCode = generateInviteCode();
      const { data, error } = await supabase.from("branches").insert({
        name: branchForm.name.trim(), nmls: branchForm.nmls || "", address: branchForm.address || "",
        city: branchForm.city || "", state: branchForm.state || "", zip: branchForm.zip || "",
        invite_code: newBranchCode,
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

  // â"€â"€ Edit profile callbacks â"€â"€â"€â"€
  function handleEditSave(updatedFields) {
    setAllProfiles(function(prev) {
      return prev.map(function(p) {
        return p.id === editingProfile.id ? Object.assign({}, p, updatedFields) : p;
      });
    });
    setEditingProfile(null);
  }

  // â"€â"€ Activity tab helpers â"€â"€â"€â"€
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
    if (!isoStr) return "--";
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

  // â"€â"€ Activity merged data â"€â"€â"€â"€
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

  // â"€â"€ Directory tab helpers â"€â"€â"€â"€
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

  // â"€â"€ Tab bar item â"€â"€â"€â"€
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

  // â"€â"€ Render edit profile screen â"€â"€â"€â"€
  if (editingProfile) {
    return (
      <EditProfileScreen
        profile={editingProfile}
        onSave={handleEditSave}
        onCancel={function() { setEditingProfile(null); }}
        teamProfiles={teamProfiles}
        branches={branches}
        viewerRole={user && user.role}
        isSelf={user && editingProfile && user.supabaseUser && user.supabaseUser.id === editingProfile.id}
      />
    );
  }

  // â"€â"€ Main page â"€â"€â"€â"€
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
        {tabBtn("team",     "Team Leaders",   (function() {
          var allIds = teamContacts.map(function(c) { return c.id; });
          return allIds.filter(function(id) { return teamContacts.some(function(c) { return c.team_lead_contact_id === id; }); }).length;
        })())}
        {isAdmin && tabBtn("branches", "Branches", branches.length)}
        {isBranchAdmin && tabBtn("mybranch", "My Branch", "")}
        {(isAdmin || isViewerBranchManager) && tabBtn("access", "Access Control", allProfiles.length)}
        {isAdmin && tabBtn("activity", "Activity", actActiveCount !== null ? actActiveCount + " active" : "...")}
      </div>

      {/* Body */}
      <div style={{ maxWidth: activeTab === "access" ? 1300 : 900, margin: "28px auto", padding: "0 20px", paddingBottom: 60 }}>

        {/* Loading / error */}
        {profilesLoading && activeTab !== "roster" && (
          <div style={{ textAlign: "center", padding: 60, color: "#6B7D8A", fontSize: 14 }}>Loading...</div>
        )}
        {!profilesLoading && profilesError && activeTab !== "roster" && (
          <div style={{ background: "#FEE2E2", color: "#B91C1C", padding: "14px 18px", borderRadius: 10, fontSize: 13 }}>! {profilesError}</div>
        )}

        {/* â"€â"€ TEAM LEADERS TAB â"€â"€ */}
        {activeTab === "team" && (
          <div>
            {teamContactsLoading && (
              <div style={{ textAlign: "center", padding: 40, color: "#6B7D8A", fontSize: 14, fontFamily: UP_FONT }}>Loading team...</div>
            )}
            {!teamContactsLoading && (function() {
              var catColor = { "Lender": "#0C4160", "Realtor": "#7C3AED", "Builder": "#D97706" };
              var catBg = { "Lender": "#DBEAFE", "Realtor": "#F3E8FF", "Builder": "#FFF7ED" };

              function contactName(c) {
                return ((c.first_name || "") + " " + (c.last_name || "")).trim() || "(unnamed)";
              }

              function MemberCard({ c }) {
                var cat = c.contact_category || "";
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    background: "#fff", borderRadius: 8, border: "1px solid #E8EEF4",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0C4160", fontFamily: UP_FONT }}>
                        {contactName(c)}
                      </div>
                      {(c.lo_title || c.company) && (
                        <div style={{ fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT }}>
                          {[c.lo_title, c.company].filter(Boolean).join(" \xB7 ")}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                      background: catBg[cat] || "#F0F4F8", color: catColor[cat] || "#6B7D8A",
                      whiteSpace: "nowrap",
                    }}>{cat}</span>
                  </div>
                );
              }

              if (!isAdmin) {
                var myTeam = myContactId
                  ? teamContacts.filter(function(c) { return c.team_lead_contact_id === myContactId; })
                  : [];
                return (
                  <div>
                    <div style={{ fontSize: 13, color: "#6B7D8A", marginBottom: 16, fontFamily: UP_FONT }}>
                      {myContactId ? "Showing your assigned team members." : "No Loan Officer contact record found for your email. Ask an admin to create one."}
                    </div>
                    {myTeam.length === 0 && myContactId && (
                      <div style={{ background: "#fff", borderRadius: 12, padding: "32px 24px", textAlign: "center", color: "#6B7D8A", fontSize: 14, fontFamily: UP_FONT, border: "1px solid #E8EEF4" }}>
                        No team members assigned yet. Open a contact record and set you as their Team Lead.
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {myTeam.map(function(c) { return <MemberCard key={c.id} c={c} />; })}
                    </div>
                  </div>
                );
              }

              var teams = teamContacts.map(function(lead) {
                var members = teamContacts.filter(function(c) { return c.team_lead_contact_id === lead.id; });
                return { lead: lead, members: members };
              }).filter(function(t) { return t.members.length > 0; })
                .sort(function(a, b) { return contactName(a.lead).localeCompare(contactName(b.lead)); });

              return (
                <div>
                  {teams.map(function(t) {
                    return (
                      <div key={t.lead.id} style={{ marginBottom: 20 }}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 16px", marginBottom: 6,
                          background: "linear-gradient(90deg, #0C4160, #1A5E8A)",
                          borderRadius: t.members.length > 0 ? "10px 10px 0 0" : 10,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: UP_FONT }}>
                              {contactName(t.lead)}
                            </div>
                            {(t.lead.lo_title || t.lead.company) && (
                              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: UP_FONT }}>
                                {[t.lead.lo_title, t.lead.company].filter(Boolean).join(" \xB7 ")}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: UP_FONT }}>
                            {t.members.length} member{t.members.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {t.members.length > 0 && (
                          <div style={{
                            border: "1px solid #E8EEF4", borderTop: "none",
                            borderRadius: "0 0 10px 10px", overflow: "hidden",
                            display: "flex", flexDirection: "column", gap: 1, background: "#F7FAFB",
                          }}>
                            {t.members.map(function(m) {
                              return (
                                <div key={m.id} style={{ paddingLeft: 20 }}>
                                  <MemberCard c={m} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {teams.length === 0 && (
                    <div style={{ background: "#fff", borderRadius: 12, padding: "40px 24px", textAlign: "center", color: "#6B7D8A", fontSize: 14, fontFamily: UP_FONT }}>
                      No Loan Officer, Realtor, or Builder contacts found. Add Business contacts with those categories to see them here.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* -- ACCESS CONTROL TAB -- */}
        {activeTab === "access" && isAdmin && !profilesLoading && !profilesError && (
          <div>
            {/* Search box */}
            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Search by name or email…"
                value={accessSearch || ""}
                onChange={function(e) { setAccessSearch(e.target.value); }}
                style={{ width: "100%", padding: "9px 14px", border: "1.5px solid #E0E8E8", borderRadius: 8, fontSize: 14, fontFamily: UP_FONT, color: "#0C4160", background: "#F7FAFB", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E8EEF4", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F7FAFB", borderBottom: "2px solid #E8EEF4" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: UP_FONT }}>Name</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: UP_FONT }}>Email</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: UP_FONT }}>Access Level</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: UP_FONT, width: 260 }}>Change Access</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: UP_FONT }}>Share Contacts</th>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: UP_FONT }}>Referral Link</th>
                  </tr>
                </thead>
                <tbody>
                  {allProfiles.filter(function(p) {
                    if (p.id === user.id) return false;
                    if (!accessSearch.trim()) return true;
                    var q = accessSearch.trim().toLowerCase();
                    var name = ((p.display_name || "") + " " + (p.email || "")).toLowerCase();
                    return name.includes(q);
                  }).map(function(p, idx) {
                    var selRole = editRoles[p.id] !== undefined ? editRoles[p.id] : "";
                    var selLmtRole = editLmtRoles[p.id] !== undefined ? editLmtRoles[p.id] : "";
                    var hasChanged = selRole !== "";
                    var isInternal = ["admin","internal","branch_admin","super_admin"].includes(p.role);
                    var referralLink = (isInternal && p.nmls)
                      ? (window.location.origin + window.location.pathname + "?lo=" + encodeURIComponent(p.nmls))
                      : null;
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid #F0F4F8", background: idx % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: "#0C4160", fontFamily: UP_FONT }}>
                          {p.display_name || "(no name)"}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B7D8A", fontFamily: UP_FONT }}>{p.email || "--"}</td>
                        <td style={{ padding: "10px 14px" }}><RoleBadge role={p.role} lmtRole={p.lmt_role} /></td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <select value={selRole}
                              onChange={function(e) { var v = e.target.value; setEditRoles(function(prev) { return Object.assign({}, prev, { [p.id]: v }); }); }}
                              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #E0E8E8", fontSize: 12, fontFamily: UP_FONT, background: "#fff", color: selRole === "" ? "#94A3B8" : "#0C4160", cursor: "pointer" }}>
                              <option value="">— Change role —</option>
                              <option value="borrower">Borrower</option>
                              <option value="realtor">Realtor</option>
                              <option value="builder">Builder</option>
                              <option value="internal">Internal (LO Team)</option>
                              <option value="branch_admin">Branch Admin</option>
                              <option value="admin">Admin</option>
                              {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                            </select>
                            {selRole === "internal" && (
                              <select value={selLmtRole}
                                onChange={function(e) { var v = e.target.value; setEditLmtRoles(function(prev) { return Object.assign({}, prev, { [p.id]: v }); }); }}
                                style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #E0E8E8", fontSize: 12, fontFamily: UP_FONT, background: "#fff", color: selLmtRole === "" ? "#94A3B8" : "#0C4160", cursor: "pointer" }}>
                                <option value="">— Sub-role —</option>
                                <option value="lo">Loan Officer</option>
                                <option value="loa">LOA</option>
                                <option value="processor">Processor</option>
                                <option value="manager">Branch Manager</option>
                              </select>
                            )}
                            <button onClick={function() { saveRole(p.id); }} disabled={!hasChanged || roleSaving[p.id]}
                              style={Object.assign({}, BTN_SM, { padding: "5px 10px", fontSize: 11, opacity: (!hasChanged || roleSaving[p.id]) ? 0.3 : 1, cursor: (!hasChanged || roleSaving[p.id]) ? "default" : "pointer" }, roleSaved[p.id] ? { background: "#1B8A5A" } : {})}>
                              {roleSaved[p.id] ? "✓" : roleSaving[p.id] ? "..." : "Save"}
                            </button>
                            {roleError[p.id] && <span style={{ fontSize: 11, color: "#B91C1C", fontFamily: UP_FONT }}>!</span>}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {isInternal ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                                <div
                                  onClick={function() {
                                    var cur = !!teamShareContactsEdit[p.id];
                                    setTeamShareContactsEdit(function(prev) { return Object.assign({}, prev, { [p.id]: !cur }); });
                                  }}
                                  style={{
                                    width: 36, height: 20, borderRadius: 99, cursor: "pointer", position: "relative", flexShrink: 0,
                                    background: teamShareContactsEdit[p.id] ? "#22C55E" : "#CBD5E1",
                                    transition: "background 0.2s",
                                  }}
                                >
                                  <div style={{
                                    position: "absolute", top: 2, left: teamShareContactsEdit[p.id] ? 18 : 2,
                                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                                  }} />
                                </div>
                                <span style={{ fontSize: 11, color: teamShareContactsEdit[p.id] ? "#16A34A" : "#94A3B8", fontFamily: UP_FONT }}>
                                  {teamShareContactsEdit[p.id] ? "On" : "Off"}
                                </span>
                              </label>
                              {teamShareContactsEdit[p.id] !== !!p.team_share_contacts && (
                                <button
                                  onClick={function() { saveTeamShareContacts(p.id); }}
                                  disabled={teamShareContactsSaving[p.id]}
                                  style={Object.assign({}, BTN_SM, { padding: "3px 8px", fontSize: 10, opacity: teamShareContactsSaving[p.id] ? 0.5 : 1 }, teamShareContactsSaved[p.id] ? { background: "#1B8A5A" } : {})}
                                >
                                  {teamShareContactsSaved[p.id] ? "✓" : teamShareContactsSaving[p.id] ? "..." : "Save"}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#CBD5E1", fontFamily: UP_FONT }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {referralLink ? (
                            <button
                              onClick={function() {
                                navigator.clipboard.writeText(referralLink).then(function() {
                                  setCopiedLinkId(p.id);
                                  setTimeout(function() { setCopiedLinkId(null); }, 2000);
                                });
                              }}
                              style={{ ...BTN_GHOST, fontSize: 11, padding: "4px 10px", background: copiedLinkId === p.id ? "#E6F9F0" : undefined, color: copiedLinkId === p.id ? "#1B8A5A" : undefined, borderColor: copiedLinkId === p.id ? "#1B8A5A" : undefined }}
                            >
                              {copiedLinkId === p.id ? "✓ Copied!" : "📋 Copy Link"}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: "#CBD5E1", fontFamily: UP_FONT }}>
                              {isInternal ? "No NMLS on profile" : "--"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* â"€â"€ BRANCHES TAB â"€â"€ */}
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
                {branchError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>! {branchError}</div>}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button onClick={function() { setBranchForm(null); setBranchError(""); }} style={BTN_SECONDARY}>Cancel</button>
                  <button onClick={saveBranch} disabled={branchSaving} style={Object.assign({}, BTN_PRIMARY, branchSaving ? { opacity: 0.6, cursor: "wait" } : {})}>
                    {branchSaving ? "Saving..." : "Save Branch"}
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {branchesLoading && <div style={{ textAlign: "center", padding: 40, color: "#6B7D8A" }}>Loading...</div>}

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
                      {["Branch Name", "NMLS #", "Join Code", "City", "State", ""].map(function(h) {
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
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.nmls || "--"}</td>
                          <td style={{ ...TD }}>
                            {b.invite_code
                              ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontWeight: 700, letterSpacing: 2, color: "#0C4160", fontSize: 12 }}>{b.invite_code}</span>
                                  <button onClick={function() { navigator.clipboard.writeText(b.invite_code); }}
                                    style={{ padding: "2px 8px", fontSize: 10, borderRadius: 5, border: "1px solid #C8D8E8", background: "#F0F4F8", color: "#0C4160", cursor: "pointer", fontFamily: UP_FONT }}>Copy</button>
                                </div>
                              : <span style={{ color: "#94A3B0", fontSize: 11 }}>--</span>}
                          </td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.city || "--"}</td>
                          <td style={{ ...TD, color: "#6B7D8A" }}>{b.state || "--"}</td>
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

        {/* â"€â"€ ACTIVITY TAB â"€â"€ */}
        {/* MY BRANCH TAB */}
        {activeTab === "mybranch" && isBranchAdmin && (
          <div>
            {!myBranchLoaded && <div style={{ textAlign: "center", padding: 40, color: "#6B7D8A" }}>Loading...</div>}

            {/* No branch yet */}
            {myBranchLoaded && !myBranch && (
              <div>
                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "16px 20px", marginBottom: 24, fontSize: 13, color: "#1D4ED8", lineHeight: 1.5 }}>
                  You don't have a branch set up yet. Fill in your branch details and save — you'll get a join code to share with your team.
                </div>
                <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0C4160", marginBottom: 18 }}>Create My Branch</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
                    {[["Branch Name *","name","e.g. Dallas - Addison","1 / -1"],["NMLS #","nmls","",""],["Address","address","Street address","1 / -1"],["City","city","",""],["State","state","TX",""],["Zip","zip","",""]].map(function(row) {
                      return (
                        <div key={row[1]} style={row[3] ? { gridColumn: row[3] } : {}}>
                          <label style={LABEL_ST}>{row[0]}</label>
                          <input type="text" style={INPUT_ST} value={(myBranchForm || {})[row[1]] || ""} placeholder={row[2]}
                            onChange={function(e) { var v = e.target.value; setMyBranchForm(function(p) { return Object.assign({}, p || {}, { [row[1]]: v }); }); }} />
                        </div>
                      );
                    })}
                  </div>
                  {myBranchError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>! {myBranchError}</div>}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button disabled={myBranchSaving} style={Object.assign({}, BTN_PRIMARY, myBranchSaving ? { opacity: 0.6 } : {})}
                      onClick={async function() {
                        if (!myBranchForm || !myBranchForm.name || !myBranchForm.name.trim()) { setMyBranchError("Branch name is required."); return; }
                        setMyBranchSaving(true); setMyBranchError("");
                        var code = generateInviteCode();
                        var { data: newB, error: bErr } = await supabase.from("branches").insert({
                          name: myBranchForm.name.trim(), nmls: myBranchForm.nmls || "",
                          address: myBranchForm.address || "", city: myBranchForm.city || "",
                          state: myBranchForm.state || "", zip: myBranchForm.zip || "",
                          invite_code: code,
                        }).select().single();
                        if (bErr) { setMyBranchError(bErr.message); setMyBranchSaving(false); return; }
                        await supabase.from("profiles").update({ branch_id: newB.id }).eq("id", user.id);
                        setMyBranch(newB); setMyBranchForm(null); setMyBranchSaving(false);
                      }}>
                      {myBranchSaving ? "Creating..." : "Create Branch"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Branch exists */}
            {myBranch && (
              <div>
                {/* Code card */}
                <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", marginBottom: 20, boxShadow: "0 2px 14px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B7D8A", marginBottom: 4 }}>Branch Join Code</div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 6, color: "#0C4160", fontFamily: "monospace" }}>{myBranch.invite_code || "--"}</div>
                    <div style={{ fontSize: 12, color: "#6B7D8A", marginTop: 4 }}>Share with your LOs and LOAs so they can join this branch.</div>
                  </div>
                  <button onClick={function() { navigator.clipboard.writeText(myBranch.invite_code || ""); setMyBranchCopied(true); setTimeout(function() { setMyBranchCopied(false); }, 2000); }}
                    style={Object.assign({}, BTN_PRIMARY, { fontSize: 13, padding: "10px 20px", background: myBranchCopied ? "#065F46" : "#0C4160" })}>
                    {myBranchCopied ? "✓ Copied!" : "Copy Code"}
                  </button>
                </div>

                {/* Edit details */}
                <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", marginBottom: 20, boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0C4160", marginBottom: 14 }}>Branch Details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 14 }}>
                    {[["Branch Name *","name","","1 / -1"],["NMLS #","nmls","",""],["Address","address","","1 / -1"],["City","city","",""],["State","state","",""],["Zip","zip","",""]].map(function(row) {
                      var val = myBranchForm ? (myBranchForm[row[1]] || "") : (myBranch[row[1]] || "");
                      return (
                        <div key={row[1]} style={row[3] ? { gridColumn: row[3] } : {}}>
                          <label style={LABEL_ST}>{row[0]}</label>
                          <input type="text" style={INPUT_ST} value={val} placeholder={row[2]}
                            onChange={function(e) { var v = e.target.value; setMyBranchForm(function(p) { return Object.assign({}, p || myBranch, { [row[1]]: v }); }); }} />
                        </div>
                      );
                    })}
                  </div>
                  {myBranchError && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 10 }}>! {myBranchError}</div>}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button disabled={myBranchSaving || !myBranchForm} style={Object.assign({}, BTN_PRIMARY, (!myBranchForm || myBranchSaving) ? { opacity: 0.5, cursor: "default" } : {})}
                      onClick={async function() {
                        if (!myBranchForm || !myBranchForm.name || !myBranchForm.name.trim()) { setMyBranchError("Branch name is required."); return; }
                        setMyBranchSaving(true); setMyBranchError("");
                        var { error: bErr } = await supabase.from("branches").update({
                          name: myBranchForm.name.trim(), nmls: myBranchForm.nmls || "",
                          address: myBranchForm.address || "", city: myBranchForm.city || "",
                          state: myBranchForm.state || "", zip: myBranchForm.zip || "",
                        }).eq("id", myBranch.id);
                        setMyBranchSaving(false);
                        if (bErr) { setMyBranchError(bErr.message); return; }
                        setMyBranch(Object.assign({}, myBranch, myBranchForm));
                        setMyBranchForm(null);
                      }}>
                      {myBranchSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>

                {/* Members list */}
                <div style={{ background: "#fff", borderRadius: 14, padding: "20px 24px", boxShadow: "0 2px 14px rgba(0,0,0,0.07)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0C4160", marginBottom: 14 }}>Branch Members ({myBranchMembers.length})</div>
                  {myBranchMembers.length === 0
                    ? <div style={{ fontSize: 13, color: "#94A3B0" }}>No members yet. Share your branch code with your team.</div>
                    : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr style={{ background: "#F7FAFB" }}>
                          {["Name","Email","Role","NMLS #"].map(function(h) {
                            return <th key={h} style={{ padding: "7px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8A99A8", textAlign: "left", borderBottom: "2px solid #E8EEF4" }}>{h}</th>;
                          })}
                        </tr></thead>
                        <tbody>
                          {myBranchMembers.map(function(m) {
                            var TD2 = { padding: "8px 12px", fontSize: 13, color: "#0C4160", borderBottom: "1px solid #F0F4F8" };
                            return (
                              <tr key={m.id}>
                                <td style={{ ...TD2, fontWeight: 600 }}>{m.display_name || "--"}</td>
                                <td style={{ ...TD2, color: "#6B7D8A" }}>{m.email || "--"}</td>
                                <td style={{ ...TD2 }}><span style={{ background: "#E0E7FF", color: "#3730A3", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>{ROLE_LABELS[m.role] || m.role}</span></td>
                                <td style={{ ...TD2, color: "#6B7D8A" }}>{m.nmls || "--"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && isAdmin && (
          <div>

            {/* Toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                value={actSearch}
                onChange={function(e) { setActSearch(e.target.value); }}
                placeholder="Search name or email..."
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
                {actLoading ? "Loading..." : "-> Refresh"}
              </button>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { color: "#22C55E", label: "Active <= 3 days" },
                { color: "#F59E0B", label: "Active <= 7 days" },
                { color: "#F97316", label: "Active <= 15 days" },
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
              <div style={{ textAlign: "center", padding: 60, color: "#6B7D8A", fontSize: 14 }}>Loading activity data...</div>
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
                              {isActive ? (actSort.dir === "asc" ? " ^" : " v") : " -"}
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
                              : <span style={{ fontSize: 12, color: "#D1D5DB", fontFamily: UP_FONT }}>--"</span>
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
      </div>
    </div>
  );
}

window.UsersPanel = UsersPanel;
window.EditProfileScreen = EditProfileScreen;
