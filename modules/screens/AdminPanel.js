// modules/screens/AdminPanel.js
const { useState, useEffect } = React;
const useThemeColors = window.useThemeColors;
const useLocalStorage = window.useLocalStorage;
const generateId = window.generateId;
const formatPhone = window.formatPhone;
const supabase = window._supabaseClient;
const MODULE_DEFS = window.MODULE_DEFS;

function AdminPanel({ currentUser, onClose }) {
    const c = useThemeColors();
    const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const [roster, setRoster] = useLocalStorage("roster", []);
    const [editingMember, setEditingMember] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [resetPwMember, setResetPwMember] = useState(null);
    const [newPw, setNewPw] = useState("");
    const [resetSending, setResetSending] = useState(false);
    const [resetResult, setResetResult] = useState(null); // null | "sent" | "error" | "no-account"
    const [searchTerm, setSearchTerm] = useState("");
    const [borrowers, setBorrowers] = useState([]);
    const [permsEdit, setPermsEdit] = useState({});
    const [permsSaving, setPermsSaving] = useState({});
    const [permsSaved, setPermsSaved] = useState({});

    // Team Access state
    const [teamProfiles, setTeamProfiles] = useState([]);
    const [teamRoles, setTeamRoles] = useState({});
    const [teamSaving, setTeamSaving] = useState({});
    const [teamSaved, setTeamSaved] = useState({});
    const [teamFetchError, setTeamFetchError] = useState(null);
    const [roleSaveError, setRoleSaveError] = useState({});

    useEffect(function() {
      if (!supabase) return;
      supabase.from("profiles").select("id, display_name, email, borrower_permissions")
        .eq("role", "borrower")
        .then(function(res) {
          if (res.error) { console.warn("Borrower fetch error:", res.error); return; }
          const data = res.data || [];
          setBorrowers(data);
          const initial = {};
          data.forEach(function(b) {
            initial[b.id] = Array.isArray(b.borrower_permissions) ? b.borrower_permissions : [];
          });
          setPermsEdit(initial);
        });
    }, []);

    // Fetch all profiles for Team Access panel
    useEffect(function() {
      if (!supabase) return;
      supabase.from("profiles").select("id, display_name, email, email_display, role, nmls, phone, cell_phone, fax, company, company_nmls, branch_nmls, website, address, city, state, zip")
        .order("display_name", { ascending: true })
        .then(function(res) {
          if (res.error) { setTeamFetchError("Could not load team profiles."); return; }
          const data = res.data || [];
          setTeamProfiles(data);
          const roles = {};
          data.forEach(function(p) { roles[p.id] = p.role || "borrower"; });
          setTeamRoles(roles);

          // Sync internal/admin profiles into local roster so LOSelector can find them
          // (syncProfileToRoster in LoginScreen only runs for the current user on sign-in,
          //  so teammates never appear in the roster on other machines without this sync)
          try {
            let roster = [];
            try { roster = JSON.parse(localStorage.getItem("mtk_roster") || "[]"); } catch(e) {}
            data.forEach(function(p) {
              if (p.role !== "admin" && p.role !== "internal") return;
              const idx = roster.findIndex(function(m) { return m.id === p.id; });
              const entry = {
                id: p.id,
                name: p.display_name || p.email || "",
                email: p.email || "",
                email_display: p.email_display || "",
                role: p.role,
                nmls: p.nmls || "",
                phone: p.phone || "",
                cell: p.cell_phone || "",
                fax: p.fax || "",
                title: p.title || "",
                company: p.company || "",
                companyNMLS: p.company_nmls || "",
                branchNmls: p.branch_nmls || "",
                website: p.website || "",
                address: p.address || "",
                city: p.city || "",
                state: p.state || "",
                zip: p.zip || "",
                active: true,
                passwordHash: "supabase-managed",
                firstLogin: false
              };
              if (idx >= 0) {
                roster[idx] = Object.assign({}, roster[idx], entry);
              } else {
                roster.push(entry);
              }
            });
            localStorage.setItem("mtk_roster", JSON.stringify(roster));
            window.dispatchEvent(new Event("storage"));
          } catch(e) {}
        });
    }, []);

    const isAdmin = currentUser && currentUser.role === "admin";

    // New member form state
    const emptyMember = {
      id: "",
      name: "",
      title: "Loan Officer",
      company: "CMG Home Loans",
      companyNMLS: "",
      phone: "",
      email: "",
      nmls: "",
      branchNmls: "",
      cell: "",
      fax: "",
      website: "",
      address: "",
      city: "",
      state: "TX",
      zip: "",
      role: "lo",
      passwordHash: "",
      active: true,
      firstLogin: true
    };

    const [formData, setFormData] = useState(emptyMember);
    const [formError, setFormError] = useState("");

    const updateField = function(field, val) {
      setFormData(function(prev) {
        const next = Object.assign({}, prev);
        next[field] = val;
        return next;
      });
    };

    const handleSave = function() {
      if (!formData.name.trim()) { setFormError("Name is required."); return; }
      const updated = roster.slice();
      if (editingMember) {
        const idx = updated.findIndex(function(m) { return m.id === editingMember.id; });
        if (idx >= 0) {
          // Preserve password hash
          updated[idx] = Object.assign({}, formData, { passwordHash: updated[idx].passwordHash });
          // Prevent removing own admin role
          if (editingMember.id === currentUser.id && formData.role !== "admin") {
            setFormError("You cannot remove your own admin role.");
            return;
          }
        }
      } else {
        // New member
        formData.id = generateId();
        formData.firstLogin = true;
        formData.passwordHash = "";
        updated.push(formData);
      }
      setRoster(updated);
      setEditingMember(null);
      setShowAddForm(false);
      setFormData(emptyMember);
      setFormError("");

      // ── Also persist to Supabase if this member is a cloud user ──────────
      if (supabase && editingMember) {
        const isSupabaseUser = teamProfiles.some(function(p) { return p.id === editingMember.id; });
        if (isSupabaseUser) {
          supabase.from("profiles").update({
            display_name:  formData.name.trim()       || null,
            title:         formData.title             || null,
            phone:         formData.phone             || null,
            cell_phone:    formData.cell              || null,
            fax:           formData.fax               || null,
            company:       formData.company           || null,
            company_nmls:  formData.companyNMLS       || null,
            branch_nmls:   formData.branchNmls        || null,
            nmls:          formData.nmls              || null,
            website:       formData.website           || null,
            address:       formData.address           || null,
            city:          formData.city              || null,
            state:         formData.state             || null,
            zip:           formData.zip               || null,
          }).eq("id", editingMember.id)
            .then(function(res) {
              if (res.error) console.warn("Profile cloud save failed:", res.error.message);
            });
        }
      }
    };

    const handleDeactivate = function(memberId) {
      if (memberId === currentUser.id) { return; } // Can't deactivate self
      const updated = roster.map(function(m) {
        if (m.id === memberId) return Object.assign({}, m, { active: false });
        return m;
      });
      setRoster(updated);
      setConfirmDelete(null);
    };

    const handleReactivate = function(memberId) {
      const updated = roster.map(function(m) {
        if (m.id === memberId) return Object.assign({}, m, { active: true });
        return m;
      });
      setRoster(updated);
    };

    const handleResetPassword = async function() {
      if (!resetPwMember) return;
      const isSupabaseUser = teamProfiles.some(function(p) { return p.id === resetPwMember.id; });
      if (isSupabaseUser && supabase && resetPwMember.email) {
        setResetSending(true);
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetPwMember.email, {
          redirectTo: window.location.href
        });
        setResetSending(false);
        setResetResult(resetErr ? "error" : "sent");
      } else if (isSupabaseUser && supabase && !resetPwMember.email) {
        setResetResult("no-account");
      } else {
        // Local-only roster entry — no Supabase account yet
        setResetResult("no-account");
        // Still clear local hash as before
        const updated = roster.map(function(m) {
          if (m.id === resetPwMember.id) return Object.assign({}, m, { passwordHash: "", firstLogin: true });
          return m;
        });
        setRoster(updated);
      }
    };

    const closeResetModal = function() {
      setResetPwMember(null);
      setNewPw("");
      setResetResult(null);
      setResetSending(false);
    };

    const startEdit = function(member) {
      setFormData(Object.assign({}, member));
      setEditingMember(member);
      setShowAddForm(true);
      setFormError("");
    };

    const startAdd = function() {
      setFormData(Object.assign({}, emptyMember));
      setEditingMember(null);
      setShowAddForm(true);
      setFormError("");
    };

    const cancelForm = function() {
      setShowAddForm(false);
      setEditingMember(null);
      setFormData(emptyMember);
      setFormError("");
    };

    const filtered = roster.filter(function(m) {
      if (!searchTerm) return true;
      return m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const inputStyle = {
      width: "100%",
      padding: "10px 12px",
      border: "1.5px solid " + c.border,
      borderRadius: 8,
      fontSize: 14,
      fontFamily: font,
      fontWeight: 500,
      color: c.text || c.navy,
      background: c.bg,
      outline: "none",
      boxSizing: "border-box"
    };

    const labelSt = {
      display: "block",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: c.gray,
      marginBottom: 4,
      fontFamily: font
    };

    const btnSm = function(bg, fg) {
      return {
        padding: "6px 14px",
        background: bg || c.navy,
        color: fg || "#fff",
        border: "none",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: font,
        cursor: "pointer"
      };
    };

    // ── Borrower Tab Access helpers ──
    const BASE_TABS = ["about", "payment", "refi", "fees", "compare", "breakeven"];
    const GRANTABLE = MODULE_DEFS ? MODULE_DEFS.filter(function(m) { return !BASE_TABS.includes(m.id); }) : [];

    const togglePerm = function(userId, tabId) {
      setPermsEdit(function(prev) {
        const current = prev[userId] || [];
        const next = current.includes(tabId)
          ? current.filter(function(t) { return t !== tabId; })
          : current.concat([tabId]);
        const result = Object.assign({}, prev);
        result[userId] = next;
        return result;
      });
    };

    const savePerm = async function(userId) {
      if (!supabase) return;
      setPermsSaving(function(prev) { const r = Object.assign({}, prev); r[userId] = true; return r; });
      const perms = permsEdit[userId] || [];
      const { error } = await supabase.from("profiles").update({ borrower_permissions: perms }).eq("id", userId);
      if (error) console.warn("savePerm error:", error);
      setPermsSaving(function(prev) { const r = Object.assign({}, prev); r[userId] = false; return r; });
      setPermsSaved(function(prev) { const r = Object.assign({}, prev); r[userId] = true; return r; });
      setTimeout(function() {
        setPermsSaved(function(prev) { const r = Object.assign({}, prev); r[userId] = false; return r; });
      }, 2000);
    };

    const saveTeamRole = async function(userId) {
      if (!supabase) return;
      if (userId === currentUser.id) {
        setRoleSaveError(function(prev) { return Object.assign({}, prev, { [userId]: "Cannot change your own role." }); });
        return;
      }
      setTeamSaving(function(prev) { return Object.assign({}, prev, { [userId]: true }); });
      setRoleSaveError(function(prev) { return Object.assign({}, prev, { [userId]: null }); });
      const newRole = teamRoles[userId];
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
      setTeamSaving(function(prev) { return Object.assign({}, prev, { [userId]: false }); });
      if (error) {
        setRoleSaveError(function(prev) { return Object.assign({}, prev, { [userId]: error.message }); });
      } else {
        setTeamProfiles(function(prev) {
          return prev.map(function(p) { return p.id === userId ? Object.assign({}, p, { role: newRole }) : p; });
        });
        setTeamSaved(function(prev) { return Object.assign({}, prev, { [userId]: true }); });
        setTimeout(function() {
          setTeamSaved(function(prev) { return Object.assign({}, prev, { [userId]: false }); });
        }, 2000);
        // If the promoted user was a borrower, refresh the borrowers list
        if (newRole !== "borrower") {
          setBorrowers(function(prev) { return prev.filter(function(b) { return b.id !== userId; }); });
        }
      }
    };

    const borrowerSection = !supabase ? null : React.createElement(React.Fragment, null,
      React.createElement("hr", { style: { margin: "24px 0", border: "none", borderTop: "1px solid " + c.border } }),
      React.createElement("h3", {
        style: { fontSize: 15, fontWeight: 700, color: c.text || c.navy, margin: "0 0 4px 0", fontFamily: font }
      }, "\uD83D\uDD10 Borrower Tab Access"),
      React.createElement("p", {
        style: { fontSize: 12, color: c.gray, fontFamily: font, margin: "0 0 16px 0" }
      }, "Grant individual borrower accounts access to additional calculator tabs beyond the default 6."),
      borrowers.length === 0
        ? React.createElement("div", {
            style: { fontSize: 13, color: c.gray, fontFamily: font, padding: "12px 0" }
          }, "No borrower accounts found.")
        : borrowers.map(function(b) {
            const editPerms = permsEdit[b.id] || [];
            return React.createElement("div", {
              key: b.id,
              style: {
                border: "1px solid " + c.border,
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 10
              }
            },
              React.createElement("div", {
                style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }
              },
                React.createElement("div", null,
                  React.createElement("div", {
                    style: { fontSize: 14, fontWeight: 600, color: c.text || c.navy, fontFamily: font }
                  }, b.display_name || b.email),
                  React.createElement("div", {
                    style: { fontSize: 11, color: c.gray, fontFamily: font }
                  }, b.email)
                ),
                React.createElement("button", {
                  onClick: function() { savePerm(b.id); },
                  disabled: permsSaving[b.id],
                  style: btnSm(permsSaved[b.id] ? "#1B8A5A" : c.navy, "#fff")
                }, permsSaved[b.id] ? "\u2713 Saved" : permsSaving[b.id] ? "Saving\u2026" : "Save")
              ),
              React.createElement("div", {
                style: { display: "flex", flexWrap: "wrap", gap: 8 }
              },
                GRANTABLE.map(function(tab) {
                  const on = editPerms.includes(tab.id);
                  return React.createElement("label", {
                    key: tab.id,
                    style: {
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 12, fontWeight: 500, fontFamily: font,
                      color: c.text || c.navy, cursor: "pointer",
                      padding: "4px 10px", borderRadius: 6,
                      border: "1px solid " + (on ? c.navy : c.border),
                      background: on ? (c.navy + "18") : "transparent",
                      userSelect: "none"
                    }
                  },
                    React.createElement("input", {
                      type: "checkbox",
                      checked: on,
                      onChange: function() { togglePerm(b.id, tab.id); },
                      style: { cursor: "pointer" }
                    }),
                    tab.icon + " " + tab.label
                  );
                })
              )
            );
          })
    );

    // ── Team Access section ──
    const ROLE_ORDER = { admin: 0, internal: 1, realtor: 2, borrower: 3 };
    const roleTagColors = { admin: "#D4920B", internal: "#1a5fa8", borrower: "#888", realtor: "#9B59B6" };
    const sortedTeamProfiles = teamProfiles.slice().sort(function(a, b) {
      return (ROLE_ORDER[a.role] || 9) - (ROLE_ORDER[b.role] || 9);
    });

    const teamSection = !supabase || !isAdmin ? null : React.createElement(React.Fragment, null,
      React.createElement("hr", { style: { margin: "24px 0", border: "none", borderTop: "1px solid " + c.border } }),
      React.createElement("h3", {
        style: { fontSize: 15, fontWeight: 700, color: c.text || c.navy, margin: "0 0 4px 0", fontFamily: font }
      }, "\uD83D\uDD10 Team Access"),
      React.createElement("p", {
        style: { fontSize: 12, color: c.gray, fontFamily: font, margin: "0 0 16px 0" }
      }, "New sign-ups default to Borrower. Promote teammates to Internal or Admin here."),
      teamFetchError && React.createElement("div", {
        style: { fontSize: 13, color: "#C0392B", fontFamily: font, marginBottom: 10 }
      }, teamFetchError),
      teamProfiles.length === 0 && !teamFetchError
        ? React.createElement("div", { style: { fontSize: 13, color: c.gray, fontFamily: font, padding: "8px 0" } }, "No accounts found.")
        : sortedTeamProfiles.map(function(p) {
            const isSelf = p.id === currentUser.id;
            const selectedRole = teamRoles[p.id] || p.role || "borrower";
            const originalRole = p.role || "borrower";
            const hasChanged = selectedRole !== originalRole;
            const err = roleSaveError[p.id];
            const tagColor = roleTagColors[originalRole] || "#888";
            return React.createElement("div", {
              key: p.id,
              style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid " + c.border, marginBottom: 8, background: isSelf ? (c.bg || "#f8f9fb") : (c.white || "#fff") }
            },
              React.createElement("div", {
                style: { width: 32, height: 32, borderRadius: "50%", background: tagColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: font }
              }, (p.display_name || p.email || "?").charAt(0).toUpperCase()),
              React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: c.text || c.navy, fontFamily: font, display: "flex", alignItems: "center", gap: 6 } },
                  p.display_name || "(no name)",
                  isSelf && React.createElement("span", { style: { fontSize: 10, color: "#1B8A5A", fontWeight: 600 } }, "(you)")
                ),
                React.createElement("div", { style: { fontSize: 11, color: c.gray, fontFamily: font } }, p.email || "")
              ),
              React.createElement("select", {
                value: selectedRole,
                disabled: isSelf,
                onChange: function(e) {
                  var val = e.target.value;
                  setTeamRoles(function(prev) { return Object.assign({}, prev, { [p.id]: val }); });
                },
                style: { padding: "5px 8px", borderRadius: 6, border: "1px solid " + c.border, fontSize: 12, fontFamily: font, background: "#fff", color: c.text || c.navy, cursor: isSelf ? "default" : "pointer", opacity: isSelf ? 0.6 : 1 }
              },
                React.createElement("option", { value: "borrower" }, "Borrower"),
                React.createElement("option", { value: "realtor" }, "Realtor"),
                React.createElement("option", { value: "internal" }, "Internal"),
                React.createElement("option", { value: "branch_admin" }, "Branch Admin"),
                React.createElement("option", { value: "admin" }, "Admin")
              ),
              React.createElement("button", {
                onClick: function() { saveTeamRole(p.id); },
                disabled: !hasChanged || isSelf || teamSaving[p.id],
                style: Object.assign({}, btnSm(teamSaved[p.id] ? "#1B8A5A" : hasChanged && !isSelf ? c.navy : "#bbb", "#fff"), { cursor: (!hasChanged || isSelf) ? "default" : "pointer" })
              }, teamSaved[p.id] ? "\u2713 Saved" : teamSaving[p.id] ? "Saving\u2026" : "Save"),
              err ? React.createElement("div", { style: { fontSize: 11, color: "#C0392B", fontFamily: font, marginLeft: 4 } }, err) : null
            );
          })
    );

    // ── Add/Edit Form ──
    if (showAddForm) {
      const fieldRow = function(label, field, placeholder, type, onBlur) {
        return React.createElement("div", { style: { marginBottom: 12 }, key: field },
          React.createElement("label", { style: labelSt }, label),
          React.createElement("input", {
            type: type || "text",
            value: formData[field] || "",
            onChange: function(e) { updateField(field, e.target.value); },
            onBlur: onBlur || undefined,
            style: inputStyle,
            placeholder: placeholder || ""
          })
        );
      };
      const phoneBlur = function(field) {
        return function() { updateField(field, formatPhone(formData[field])); };
      };

      return React.createElement("div", {
        style: {
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20
        }
      },
        React.createElement("div", {
          style: {
            background: c.white, borderRadius: 16, padding: "28px 24px",
            maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
          }
        },
          React.createElement("div", {
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }
          },
            React.createElement("h3", {
              style: { fontSize: 18, fontWeight: 700, color: c.text || c.navy, margin: 0, fontFamily: font }
            }, editingMember ? "Edit Team Member" : "Add Team Member"),
            React.createElement("button", {
              onClick: cancelForm,
              style: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: c.gray }
            }, "\u2715")
          ),
          React.createElement("div", {
            style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }
          },
            fieldRow("Full Name *", "name", "Jane Smith"),
            fieldRow("Title", "title", "Loan Officer"),
            fieldRow("Company", "company", "CMG Home Loans"),
            fieldRow("Company NMLS #", "companyNMLS", ""),
            fieldRow("Phone", "phone", "(555) 123-4567", "tel", phoneBlur("phone")),
            fieldRow("Email", "email", "jane@example.com", "email"),
            fieldRow("NMLS #", "nmls", "123456"),
            fieldRow("Branch NMLS", "branchNmls", ""),
            fieldRow("Cell Phone", "cell", "(555) 123-4567", "tel", phoneBlur("cell")),
            fieldRow("Fax", "fax", "(555) 123-4568", "tel", phoneBlur("fax")),
            fieldRow("Website URL", "website", "https://", "url"),
            React.createElement("div", { style: { marginBottom: 12 }, key: "role" },
              React.createElement("label", { style: labelSt }, "ROLE"),
              React.createElement("select", {
                value: formData.role,
                onChange: function(e) { updateField("role", e.target.value); },
                style: Object.assign({}, inputStyle, { cursor: "pointer" })
              },
                React.createElement("option", { value: "admin" }, "Admin"),
                React.createElement("option", { value: "lo" }, "Loan Officer"),
                React.createElement("option", { value: "assistant" }, "Assistant")
              )
            )
          ),
          React.createElement("div", {
            style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 4 }
          },
            fieldRow("Address", "address", "123 Main St"),
            fieldRow("City", "city", "Dallas"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }, key: "stzip" },
              React.createElement("div", null,
                React.createElement("label", { style: labelSt }, "STATE"),
                React.createElement("input", {
                  value: formData.state || "",
                  onChange: function(e) { updateField("state", e.target.value); },
                  style: inputStyle,
                  placeholder: "TX"
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: labelSt }, "ZIP"),
                React.createElement("input", {
                  value: formData.zip || "",
                  onChange: function(e) { updateField("zip", e.target.value); },
                  style: inputStyle,
                  placeholder: "75001"
                })
              )
            )
          ),
          formError && React.createElement("div", {
            style: { color: "#C0392B", fontSize: 13, marginTop: 10, fontFamily: font }
          }, formError),
          React.createElement("div", {
            style: { display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }
          },
            React.createElement("button", { onClick: cancelForm, style: btnSm("#E0E8E8", c.text || c.navy) }, "Cancel"),
            React.createElement("button", { onClick: handleSave, style: btnSm(c.navy, "#fff") },
              editingMember ? "Save Changes" : "Add Member"
            )
          )
        )
      );
    }

    // ── Password reset confirm ──
    if (resetPwMember) {
      return React.createElement("div", {
        style: {
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }
      },
        React.createElement("div", {
          style: { background: c.white, borderRadius: 16, padding: "28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }
        },
          React.createElement("h3", {
            style: { fontSize: 18, fontWeight: 700, color: c.text || c.navy, margin: "0 0 12px 0", fontFamily: font }
          }, "Reset Password"),

          // Result states
          resetResult === "sent" && React.createElement("div", {
            style: { background: "#E8F5E9", border: "1.5px solid #4CAF50", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 14, color: "#2E7D32", fontFamily: font, lineHeight: 1.5 }
          }, "\u2705 Password reset email sent to " + resetPwMember.email + ". They'll get a link to set a new password."),

          resetResult === "error" && React.createElement("div", {
            style: { background: "#FEE2E2", border: "1.5px solid #DC2626", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 14, color: "#B91C1C", fontFamily: font, lineHeight: 1.5 }
          }, "\u26A0\uFE0F Could not send reset email. Check that their email address is correct and try again."),

          resetResult === "no-account" && React.createElement("div", {
            style: { background: "#FFF3CD", border: "1.5px solid #F59E0B", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 14, color: "#92400E", fontFamily: font, lineHeight: 1.5 }
          }, "\u26A0\uFE0F This person doesn't have a Supabase account yet. They need to sign up at the login screen first. Once they do, use Team Access to promote them to Internal."),

          // Default prompt (before action)
          !resetResult && React.createElement("p", {
            style: { fontSize: 14, color: c.gray, fontFamily: font, margin: "0 0 20px 0" }
          }, "Send a password reset email to " + (resetPwMember.email || resetPwMember.name) + "? They'll receive a link to set a new password."),

          React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } },
            resetResult
              ? React.createElement("button", {
                  onClick: closeResetModal,
                  style: btnSm(c.navy, "#fff")
                }, "Done")
              : React.createElement(React.Fragment, null,
                  React.createElement("button", {
                    onClick: closeResetModal,
                    style: btnSm("#E0E8E8", c.text || c.navy)
                  }, "Cancel"),
                  React.createElement("button", {
                    onClick: handleResetPassword,
                    disabled: resetSending,
                    style: Object.assign({}, btnSm("#C0392B", "#fff"), resetSending ? { opacity: 0.6, cursor: "wait" } : {})
                  }, resetSending ? "Sending\u2026" : "Send Reset Email")
                )
          )
        )
      );
    }

    // ── Deactivate confirm ──
    if (confirmDelete) {
      return React.createElement("div", {
        style: {
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }
      },
        React.createElement("div", {
          style: { background: c.white, borderRadius: 16, padding: "28px 24px", maxWidth: 400, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }
        },
          React.createElement("h3", {
            style: { fontSize: 18, fontWeight: 700, color: c.text || c.navy, margin: "0 0 12px 0", fontFamily: font }
          }, "Deactivate Member?"),
          React.createElement("p", {
            style: { fontSize: 14, color: c.gray, fontFamily: font, margin: "0 0 20px 0" }
          }, "Deactivate " + confirmDelete.name + "? They will no longer be able to log in. You can reactivate them later."),
          React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } },
            React.createElement("button", {
              onClick: function() { setConfirmDelete(null); },
              style: btnSm("#E0E8E8", c.text || c.navy)
            }, "Cancel"),
            React.createElement("button", {
              onClick: function() { handleDeactivate(confirmDelete.id); },
              style: btnSm("#C0392B", "#fff")
            }, "Deactivate")
          )
        )
      );
    }

    // ── Main Admin Panel ──
    return React.createElement("div", {
      style: {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20
      }
    },
      React.createElement("div", {
        style: {
          background: c.white, borderRadius: 16, padding: "28px 24px",
          maxWidth: 700, width: "100%", maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
        }
      },
        // Header
        React.createElement("div", {
          style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }
        },
          React.createElement("h2", {
            style: { fontSize: 20, fontWeight: 700, color: c.text || c.navy, margin: 0, fontFamily: font }
          }, "\uD83D\uDC65 Team Administration"),
          React.createElement("button", {
            onClick: onClose,
            style: { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: c.gray, lineHeight: 1 }
          }, "\u2715")
        ),

        // Search + Add button
        React.createElement("div", {
          style: { display: "flex", gap: 10, marginBottom: 16 }
        },
          React.createElement("input", {
            type: "text",
            value: searchTerm,
            onChange: function(e) { setSearchTerm(e.target.value); },
            style: Object.assign({}, inputStyle, { flex: 1 }),
            placeholder: "Search team members..."
          }),
          isAdmin && React.createElement("button", {
            onClick: startAdd,
            style: btnSm("#1B8A5A", "#fff")
          }, "+ Add Member")
        ),

        // Member list
        filtered.map(function(member) {
          const isSelf = member.id === currentUser.id;
          const roleColors = { admin: "#D4920B", lo: "#48A0CE", assistant: "#6B7D8A" };
          return React.createElement("div", {
            key: member.id,
            style: {
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: 10,
              border: "1px solid " + c.border,
              marginBottom: 8,
              opacity: member.active ? 1 : 0.5,
              background: member.active ? c.white : (c.bg || "#f8f8f8")
            }
          },
            // Avatar
            React.createElement("div", {
              style: {
                width: 40, height: 40, borderRadius: "50%",
                background: "linear-gradient(135deg, " + c.navy + ", " + (c.blue || "#48A0CE") + ")",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700, fontFamily: font, flexShrink: 0
              }
            }, member.name.charAt(0).toUpperCase()),
            // Info
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", {
                style: { display: "flex", alignItems: "center", gap: 8 }
              },
                React.createElement("span", {
                  style: { fontSize: 14, fontWeight: 600, color: c.text || c.navy, fontFamily: font }
                }, member.name),
                React.createElement("span", {
                  style: {
                    fontSize: 10, fontWeight: 700, color: "#fff", padding: "2px 8px",
                    borderRadius: 4, background: roleColors[member.role] || c.gray,
                    textTransform: "uppercase", letterSpacing: "0.05em"
                  }
                }, member.role),
                !member.active && React.createElement("span", {
                  style: { fontSize: 10, fontWeight: 600, color: "#C0392B", fontFamily: font }
                }, "(inactive)"),
                isSelf && React.createElement("span", {
                  style: { fontSize: 10, fontWeight: 600, color: "#1B8A5A", fontFamily: font }
                }, "(you)")
              ),
              React.createElement("div", {
                style: { fontSize: 12, color: c.gray, fontFamily: font, marginTop: 2 }
              }, [member.title, member.email, member.nmls ? "NMLS #" + member.nmls : ""].filter(Boolean).join(" \u00B7 ")),
              (member.phone || member.cell) && React.createElement("div", {
                style: { fontSize: 12, color: c.gray, fontFamily: font, marginTop: 3, display: "flex", gap: 14, flexWrap: "wrap" }
              },
                member.phone && React.createElement("a", {
                  href: "tel:" + member.phone.replace(/\D/g, ""),
                  style: { color: "inherit", textDecoration: "none" }
                }, "\uD83D\uDCDE " + member.phone),
                member.cell && member.cell !== member.phone && React.createElement("a", {
                  href: "tel:" + member.cell.replace(/\D/g, ""),
                  style: { color: "inherit", textDecoration: "none" }
                }, "\uD83D\uDCF1 " + member.cell)
              )
            ),
            // Actions
            isAdmin && React.createElement("div", {
              style: { display: "flex", gap: 6, flexShrink: 0 }
            },
              React.createElement("button", {
                onClick: function() { startEdit(member); },
                title: "Edit",
                style: { background: "none", border: "1px solid " + c.border, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }
              }, "\u270F\uFE0F"),
              React.createElement("button", {
                onClick: function() { setResetPwMember(member); },
                title: "Reset password",
                style: { background: "none", border: "1px solid " + c.border, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }
              }, "\uD83D\uDD11"),
              !member.active ? React.createElement("button", {
                onClick: function() { handleReactivate(member.id); },
                title: "Reactivate",
                style: { background: "none", border: "1px solid " + c.border, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }
              }, "\u2705") : !isSelf && React.createElement("button", {
                onClick: function() { setConfirmDelete(member); },
                title: "Deactivate",
                style: { background: "none", border: "1px solid " + c.border, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14 }
              }, "\u26D4")
            )
          );
        }),

        filtered.length === 0 && React.createElement("div", {
          style: { textAlign: "center", padding: 30, color: c.gray, fontSize: 14, fontFamily: font }
        }, "No team members found."),

        teamSection,
        borrowerSection
      )
    );
  }

window.AdminPanel = AdminPanel;
