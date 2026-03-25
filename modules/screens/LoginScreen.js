// modules/screens/LoginScreen.js
const { useState } = React;
const useThemeColors = window.useThemeColors;
const supabase = window._supabaseClient;

function LoginScreen({ onLogin, viewPrefill }) {
  const c = useThemeColors();
  const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  // If arriving from a magic link, default to signup so new clients can create an account
  const [mode, setMode] = useState(viewPrefill ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sign-in fields — pre-fill email from magic link if available
  const [email, setEmail] = useState(viewPrefill ? (viewPrefill.clientEmail || "") : "");
  const [password, setPassword] = useState("");

  // Sign-up fields — pre-fill name + email from magic link if available
  const _prefillParts = viewPrefill && viewPrefill.clientName ? viewPrefill.clientName.trim().split(/\s+/) : [];
  const [suFirstName, setSuFirstName] = useState(_prefillParts.length > 0 ? _prefillParts[0] : "");
  const [suLastName,  setSuLastName]  = useState(_prefillParts.length > 1 ? _prefillParts.slice(1).join(" ") : "");
  const [suEmail, setSuEmail] = useState(viewPrefill ? (viewPrefill.clientEmail || "") : "");
  const [suPhone, setSuPhone] = useState("");

  // Phone auto-formatter: (XXX) XXX-XXXX
  function _fmtPhone(raw) {
    var d = (raw || "").replace(/\D/g, "").slice(0, 10);
    if (!d) return "";
    if (d.length <= 3) return "(" + d;
    if (d.length <= 6) return "(" + d.slice(0, 3) + ") " + d.slice(3);
    return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  }
  const [suPassword, setSuPassword] = useState("");
  const [suPassword2, setSuPassword2] = useState("");
  const [suRole, setSuRole] = useState("borrower");

  // Forgot password
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // ── Sign In with Supabase ──
  const handleSignIn = async function() {
    setError(""); setSuccessMsg("");
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!password) { setError("Please enter your password."); return; }
    setLoading(true);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (signInErr) {
        setError(signInErr.message || "Sign-in failed.");
        setLoading(false);
        return;
      }
      // Fetch profile to get role & display name
      const user = data.user;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const role = (profile && profile.role) ? profile.role : "borrower";
      const displayName = (profile && profile.display_name) ? profile.display_name : (user.email || "User");
      const isInternal = (role === "admin" || role === "internal");

      // Also sync profile data into the legacy roster for admin panel compatibility
      syncProfileToRoster(user.id, displayName, role, profile);

      // Ensure a contact record exists; returns new contact ID only for first-time users
      const newContactId = await ensureContactForNewUser(displayName, user.email, role);

      onLogin({
        id: user.id,
        name: displayName,
        role: role,
        email: user.email,
        isInternal: isInternal,
        supabaseUser: true,
        borrowerPermissions: profile.borrower_permissions || [],
        newContactId: newContactId || null,
      });
    } catch (err) {
      setError("An unexpected error occurred.");
    }
    setLoading(false);
  };

  // ── Sign Up with Supabase ──
  const handleSignUp = async function() {
    setError(""); setSuccessMsg("");
    if (!suFirstName.trim()) { setError("Please enter your first name."); return; }
    if (!suLastName.trim())  { setError("Please enter your last name."); return; }
    if (!suEmail.trim()) { setError("Please enter your email."); return; }
    const phoneDigits = suPhone.trim().replace(/\D/g, "");
    if (phoneDigits.length !== 10) { setError("Please enter a valid 10-digit phone number."); return; }
    if (suPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (suPassword !== suPassword2) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: suEmail.trim(),
        password: suPassword,
        options: {
          data: {
            display_name: (suFirstName.trim() + " " + suLastName.trim()).trim(),
            role: suRole
          }
        }
      });
      if (signUpErr) {
        setError(signUpErr.message || "Sign-up failed.");
        setLoading(false);
        return;
      }
      // If email confirmation is required, show a message
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try signing in.");
        setLoading(false);
        return;
      }
      if (data.session) {
        // Auto-confirmed — log them in immediately
        const user = data.user;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        const role = (profile && profile.role) ? profile.role : suRole;
        const displayName = (profile && profile.display_name) ? profile.display_name : (suFirstName.trim() + " " + suLastName.trim()).trim();
        const isInternal = (role === "admin" || role === "internal");

        syncProfileToRoster(user.id, displayName, role, profile);

        // Ensure a contact record exists; returns new contact ID for brand-new users
        const newContactId = await ensureContactForNewUser(displayName, user.email, role, suPhone.trim(), suFirstName.trim(), suLastName.trim());

        onLogin({
          id: user.id,
          name: displayName,
          role: role,
          email: user.email,
          isInternal: isInternal,
          supabaseUser: true,
          borrowerPermissions: profile.borrower_permissions || [],
          newContactId: newContactId || null,
        });
      } else {
        // Email confirmation required
        setSuccessMsg("Check your email! Click the confirmation link, then come back and sign in.");
        setMode("signin");
        setEmail(suEmail.trim());
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    }
    setLoading(false);
  };

  // ── Forgot Password ──
  const handleForgotPassword = async function() {
    setError("");
    if (!forgotEmail.trim()) { setError("Please enter your email address."); return; }
    setForgotLoading(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: window.location.href
    });
    setForgotLoading(false);
    if (resetErr) {
      setError(resetErr.message || "Could not send reset email.");
    } else {
      setForgotSent(true);
    }
  };

  // Helper: create a contact record for a newly registered user.
  // Returns the new contact's ID if just created, or null if one already existed.
  async function ensureContactForNewUser(displayName, email, role, phone, firstName, lastName) {
    if (!supabase || !email) return null;
    try {
      // Check if a contact with this email already exists in this tenant
      const { data: existing, error: selectErr } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email.toLowerCase())
        .limit(1);
      if (selectErr) {
        console.warn("Contact lookup failed:", selectErr.message, selectErr.code);
        return null;
      }
      if (existing && existing.length > 0) return null; // already exists — returning user

      // Use explicitly-provided names; fall back to splitting displayName only as a safety net
      const resolvedFirst = (firstName || "").trim() || ((displayName || "").trim().split(/\s+/)[0] || "");
      const resolvedLast  = (lastName  || "").trim() || ((displayName || "").trim().split(/\s+/).slice(1).join(" ") || "");

      const { data: newContact, error: insertErr } = await supabase.from("contacts").insert({
        first_name:      resolvedFirst,
        last_name:       resolvedLast,
        email:           email.toLowerCase(),
        email_personal:  email.toLowerCase(),
        phone_cell:      (phone || "").replace(/\D/g, ""),  // digits only → matches phone_cell column
        contact_type:    "client",
        status:       "active",
        tags:         [],
        source:       "self-signup",
        notes:        "",
      }).select("id").single();

      if (insertErr) {
        // Likely missing RLS INSERT policy — deploy supabase-signup-contact-migration.sql
        console.warn("Contact INSERT failed:", insertErr.message, insertErr.code,
          "→ Did you deploy supabase-signup-contact-migration.sql?");
        return null;
      }

      return newContact ? newContact.id : null;
    } catch (err) {
      // Non-fatal — don't block login if contact creation fails
      console.warn("Could not create contact on signup:", err);
      return null;
    }
  }

  // Helper: sync Supabase profile into legacy roster so AdminPanel still works
  function syncProfileToRoster(userId, displayName, role, profile) {
    let roster = [];
    try { roster = JSON.parse(localStorage.getItem("mtk_roster") || "[]"); } catch(e) {}
    const idx = roster.findIndex(function(m) { return m.id === userId; });
    const memberData = {
      id: userId,
      name: displayName,
      title: (profile && profile.title) || "",
      company: (profile && profile.company) || "",
      phone: (profile && profile.phone) || "",
      email: (profile && profile.email) || "",
      email_display: (profile && profile.email_display) || "",
      nmls: (profile && profile.nmls) || "",
      branchNmls: (profile && profile.branch_nmls) || "",
      address: (profile && profile.address) || "",
      city: (profile && profile.city) || "",
      state: (profile && profile.state) || "",
      zip: (profile && profile.zip) || "",
      role: role,
      passwordHash: "supabase-managed",
      active: true,
      firstLogin: false
    };
    if (idx >= 0) {
      roster[idx] = memberData;
    } else {
      roster.push(memberData);
    }
    localStorage.setItem("mtk_roster", JSON.stringify(roster));
    window.dispatchEvent(new Event("storage"));
  }

  // ── Shared styles (same as original design) ──
  const cardStyle = {
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    padding: "36px 32px",
    maxWidth: 420,
    width: "100%",
    margin: "0 auto"
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1.5px solid #E0E8E8",
    borderRadius: 8,
    fontSize: 15,
    fontFamily: font,
    fontWeight: 500,
    color: "#0C4160",
    background: "#F7FAFB",
    outline: "none",
    boxSizing: "border-box"
  };

  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#6B7D8A",
    marginBottom: 5,
    fontFamily: font
  };

  const btnPrimary = {
    width: "100%",
    padding: "14px 24px",
    background: "linear-gradient(135deg, #0C4160, #164E72)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    fontFamily: font,
    cursor: "pointer",
    marginTop: 8,
    letterSpacing: "0.02em"
  };

  const tabStyle = function(active) {
    return {
      flex: 1,
      padding: "10px 8px",
      background: active ? "#0C4160" : "transparent",
      color: active ? "#fff" : "#6B7D8A",
      border: "none",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      fontFamily: font,
      cursor: "pointer",
      transition: "all 0.2s"
    };
  };

  // ── Main login screen ──
  return React.createElement("div", {
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0C4160 0%, #164E72 40%, #48A0CE 100%)",
      padding: 20,
      fontFamily: font
    }
  },
    React.createElement("div", { style: cardStyle },
      // Header
      React.createElement("div", { style: { textAlign: "center", marginBottom: 24 } },
        React.createElement("h1", {
          style: { fontSize: 22, fontWeight: 800, color: "#0C4160", margin: "0 0 4px 0", fontFamily: font, letterSpacing: "-0.01em" }
        }, "Mortgage Toolkit"),
        React.createElement("p", {
          style: { fontSize: 11, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, fontFamily: font, margin: 0 }
        }, "MORTGAGE MARK \u00B7 CMG HOME LOANS")
      ),

      // Magic link welcome banner
      viewPrefill && React.createElement("div", {
        style: {
          background: "#EBF5FB", border: "1.5px solid #48A0CE",
          borderRadius: 10, padding: "14px 16px", marginBottom: 20,
          textAlign: "center", fontFamily: font
        }
      },
        React.createElement("div", { style: { fontSize: 13, color: "#0C4160", fontWeight: 700, marginBottom: 4 } },
          viewPrefill.clientName ? "Welcome, " + viewPrefill.clientName.split(" ")[0] + "! 👋" : "Welcome! 👋"
        ),
        React.createElement("div", { style: { fontSize: 12, color: "#374151", lineHeight: 1.5 } },
          (viewPrefill.loName || "Your loan officer") + " shared a scenario with you.",
          React.createElement("br"),
          "Create your account or sign in to view it."
        )
      ),

      // Success message (e.g., after sign-up)
      successMsg && React.createElement("div", {
        style: { background: "#E8F5E9", color: "#2E7D32", padding: "12px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, fontFamily: font, textAlign: "center" }
      }, "\u2705 " + successMsg),

      // Tab switcher — 2 tabs
      React.createElement("div", {
        style: { display: "flex", gap: 4, background: "#F7FAFB", borderRadius: 10, padding: 4, marginBottom: 24 }
      },
        React.createElement("button", {
          onClick: function() { setMode("signin"); setError(""); },
          style: tabStyle(mode === "signin")
        }, "\uD83D\uDD12 Sign In"),
        React.createElement("button", {
          onClick: function() { setMode("signup"); setError(""); },
          style: tabStyle(mode === "signup")
        }, "\u2728 Sign Up")
      ),

      // ── Sign In tab ──
      mode === "signin" && (
        forgotMode
          ? React.createElement("div", null,
              forgotSent
                ? React.createElement("div", {
                    style: { background: "#E8F5E9", color: "#2E7D32", padding: "16px", borderRadius: 8, fontSize: 14, fontFamily: font, textAlign: "center", lineHeight: 1.5 }
                  },
                    "\u2705 Reset link sent! Check your email, then come back and sign in.",
                    React.createElement("br"),
                    React.createElement("button", {
                      onClick: function() { setForgotMode(false); setForgotSent(false); setForgotEmail(""); },
                      style: { marginTop: 12, background: "none", border: "none", color: "#0C4160", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, textDecoration: "underline" }
                    }, "Back to Sign In")
                  )
                : React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: "#0C4160", marginBottom: 12, fontFamily: font } }, "Reset your password"),
                    React.createElement("div", { style: { marginBottom: 14 } },
                      React.createElement("label", { style: labelStyle }, "EMAIL"),
                      React.createElement("input", {
                        type: "email",
                        value: forgotEmail,
                        onChange: function(e) { setForgotEmail(e.target.value); },
                        style: inputStyle,
                        placeholder: "you@email.com",
                        onKeyDown: function(e) { if (e.key === "Enter") handleForgotPassword(); },
                        autoFocus: true
                      })
                    ),
                    error && React.createElement("div", { style: { color: "#C0392B", fontSize: 13, marginBottom: 10, fontFamily: font } }, error),
                    React.createElement("button", {
                      onClick: handleForgotPassword,
                      disabled: forgotLoading,
                      style: Object.assign({}, btnPrimary, forgotLoading ? { opacity: 0.6, cursor: "wait" } : {})
                    }, forgotLoading ? "Sending\u2026" : "Send Reset Link"),
                    React.createElement("button", {
                      onClick: function() { setForgotMode(false); setError(""); },
                      style: { width: "100%", marginTop: 10, background: "none", border: "none", color: "#6B7D8A", fontSize: 13, cursor: "pointer", fontFamily: font }
                    }, "Back to Sign In")
                  )
            )
          : React.createElement("div", null,
              React.createElement("div", { style: { marginBottom: 14 } },
                React.createElement("label", { style: labelStyle }, "EMAIL"),
                React.createElement("input", {
                  type: "email",
                  value: email,
                  onChange: function(e) { setEmail(e.target.value); },
                  style: inputStyle,
                  placeholder: "you@email.com"
                })
              ),
              React.createElement("div", { style: { marginBottom: 6 } },
                React.createElement("label", { style: labelStyle }, "PASSWORD"),
                React.createElement("input", {
                  type: "password",
                  value: password,
                  onChange: function(e) { setPassword(e.target.value); },
                  style: inputStyle,
                  placeholder: "Enter your password",
                  onKeyDown: function(e) { if (e.key === "Enter") handleSignIn(); }
                })
              ),
              React.createElement("div", { style: { textAlign: "right", marginBottom: 14 } },
                React.createElement("button", {
                  onClick: function() { setForgotMode(true); setForgotEmail(email); setError(""); },
                  style: { background: "none", border: "none", fontSize: 12, color: "#48A0CE", cursor: "pointer", fontFamily: font, padding: 0 }
                }, "Forgot password?")
              ),
              error && React.createElement("div", {
                style: { color: "#C0392B", fontSize: 13, marginBottom: 10, fontFamily: font }
              }, error),
              React.createElement("button", {
                onClick: handleSignIn,
                disabled: loading,
                style: Object.assign({}, btnPrimary, loading ? { opacity: 0.6, cursor: "wait" } : {})
              }, loading ? "Signing in..." : "Sign In")
            )
      ),

      // ── Sign Up tab ──
      mode === "signup" && React.createElement("div", null,
        React.createElement("div", { style: { display: "flex", gap: 10, marginBottom: 14 } },
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("label", { style: labelStyle }, "FIRST NAME"),
            React.createElement("input", {
              type: "text",
              value: suFirstName,
              onChange: function(e) { setSuFirstName(e.target.value); },
              style: inputStyle,
              placeholder: "Mary"
            })
          ),
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("label", { style: labelStyle }, "LAST NAME"),
            React.createElement("input", {
              type: "text",
              value: suLastName,
              onChange: function(e) { setSuLastName(e.target.value); },
              style: inputStyle,
              placeholder: "Smith"
            })
          )
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "EMAIL"),
          React.createElement("input", {
            type: "email",
            value: suEmail,
            onChange: function(e) { setSuEmail(e.target.value); },
            style: inputStyle,
            placeholder: "you@email.com"
          })
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "PHONE"),
          React.createElement("input", {
            type: "tel",
            value: suPhone,
            onChange: function(e) { setSuPhone(_fmtPhone(e.target.value)); },
            style: inputStyle,
            placeholder: "(XXX) XXX-XXXX",
            maxLength: 14
          })
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "PASSWORD"),
          React.createElement("input", {
            type: "password",
            value: suPassword,
            onChange: function(e) { setSuPassword(e.target.value); },
            style: inputStyle,
            placeholder: "At least 6 characters"
          })
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "CONFIRM PASSWORD"),
          React.createElement("input", {
            type: "password",
            value: suPassword2,
            onChange: function(e) { setSuPassword2(e.target.value); },
            style: inputStyle,
            placeholder: "Re-enter password"
          })
        ),
        error && React.createElement("div", {
          style: {
            background: "#FEE2E2",
            border: "1.5px solid #DC2626",
            color: "#B91C1C",
            padding: "12px 14px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 14,
            fontFamily: font,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            lineHeight: 1.45
          }
        },
          React.createElement("span", { style: { fontSize: 16, flexShrink: 0, marginTop: 1 } }, "\u26A0\uFE0F"),
          error
        ),
        React.createElement("button", {
          onClick: handleSignUp,
          disabled: loading,
          style: Object.assign({}, btnPrimary, loading ? { opacity: 0.6, cursor: "wait" } : {})
        }, loading ? "Creating account..." : "Create Account")
      ),

      // Footer
      React.createElement("div", {
        style: { textAlign: "center", marginTop: 20, fontSize: 11, color: "#94A3B0", fontFamily: font }
      }, "\u00A9 " + new Date().getFullYear() + " Mortgage Mark \u00B7 NMLS #729612")
    )
  );
}

window.LoginScreen = LoginScreen;
