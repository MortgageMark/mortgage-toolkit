// modules/screens/LoginScreen.js
const { useState, useEffect } = React;
const useThemeColors = window.useThemeColors;
const useLocalStorage = window.useLocalStorage;
const supabase = window._supabaseClient;
const resolvePendingSharesForUser = window.resolvePendingSharesForUser;
const t = window.t || function(s) { return s; };
const setAppLang = window.setAppLang || function() {};

function LoginScreen({ onLogin, viewPrefill, pendingLive }) {
  const c = useThemeColors();
  const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  // LO referral — resolved from ?lo= NMLS param stored in sessionStorage
  const [loRef,   setLoRef]   = useState(null); // { id, display_name, nmls }
  // Realtor/Builder referral — resolved from ?from= contact UUID
  const [fromRef, setFromRef] = useState(null); // { id, first_name, last_name, company, photo_url, logo_url, assigned_lo_id, assigned_lo_name }

  useEffect(function() {
    if (!supabase) return;
    // Resolve ?lo= (LO by NMLS)
    var nmls = null;
    try { nmls = sessionStorage.getItem("mtk_lo_ref"); } catch(e) {}
    if (nmls) {
      supabase.from("profiles")
        .select("id, display_name, nmls, role")
        .eq("nmls", nmls)
        .in("role", ["admin", "internal"])
        .limit(1).maybeSingle()
        .then(function(res) { if (res.data) setLoRef(res.data); });
    }
    // Resolve ?from= (Realtor/Builder by contact UUID)
    var fromId = null;
    try { fromId = sessionStorage.getItem("mtk_from_ref"); } catch(e) {}
    if (fromId) {
      supabase.from("contacts")
        .select("id, first_name, last_name, company, photo_url, logo_url, assigned_lo_id, contact_category")
        .eq("id", fromId)
        .limit(1).maybeSingle()
        .then(function(res) {
          if (!res.data) return;
          var c = res.data;
          // If they have an assigned LO, fetch that name too
          if (c.assigned_lo_id) {
            supabase.from("profiles").select("id, display_name").eq("id", c.assigned_lo_id).limit(1).maybeSingle()
              .then(function(loRes) {
                setFromRef(Object.assign({}, c, { assigned_lo_name: loRes.data ? (loRes.data.display_name || "") : "" }));
              });
          } else {
            setFromRef(Object.assign({}, c, { assigned_lo_name: "" }));
          }
        });
    }
  }, []);

  // If arriving from a magic link or referral link, default to signup
  const [mode, setMode] = useState((viewPrefill || (() => { try { return !!(sessionStorage.getItem("mtk_lo_ref") || sessionStorage.getItem("mtk_from_ref")); } catch(e) { return false; } })()) ? "signup" : "signin");
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
  const [suNmls, setSuNmls] = useState("");
  const [appLang, setLang] = useLocalStorage("app_lang", "en");
  // Read ?lang= from URL on mount
  useEffect(function() {
    try {
      var params = new URLSearchParams(window.location.search);
      var urlLang = params.get("lang");
      if (urlLang === "es" || urlLang === "en") { setAppLang(urlLang); }
    } catch(e) {}
  }, []);

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

      // If the DB still has the default 'borrower' role but the user signed up
      // with a different role (stored in auth metadata), correct it now.
      const metaRole = (user.user_metadata && user.user_metadata.role) || null;
      let role = (profile && profile.role) ? profile.role : "borrower";
      if (role === "borrower" && metaRole && metaRole !== "borrower") {
        const { error: roleFixErr } = await supabase.from("profiles").update({ role: metaRole }).eq("id", user.id);
        if (!roleFixErr) role = metaRole;
      }
      const displayName = (profile && profile.display_name) ? profile.display_name : (user.email || "User");
      const isInternal = ["admin", "internal", "branch_admin"].includes(role);

      // Also sync profile data into the legacy roster for admin panel compatibility
      syncProfileToRoster(user.id, displayName, role, profile);

      // For admin/internal users: sync the full team roster from Supabase so all
      // LOs appear in the LOSelector without needing to open the Admin Panel.
      if (isInternal) {
        supabase.from("profiles")
          .select("id, display_name, email, email_display, role, nmls, phone, cell_phone, fax, title, company, company_nmls, branch_nmls, website, address, city, state, zip")
          .in("role", ["admin", "internal"])
          .then(function(res) {
            if (res.error || !res.data) return;
            var uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            try {
              var roster = [];
              try { roster = JSON.parse(localStorage.getItem("mtk_roster") || "[]"); } catch(e) {}
              res.data.forEach(function(p) {
                var idx = roster.findIndex(function(m) { return m.id === p.id; });
                var entry = {
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
                };
                if (idx >= 0) { roster[idx] = Object.assign({}, roster[idx], entry); }
                else { roster.push(entry); }
              });
              // Remove stale non-UUID entries whose NMLS duplicates a real Supabase entry
              var uuidNmls = new Set(
                roster.filter(function(m) { return uuidRe.test(m.id) && m.nmls; })
                      .map(function(m) { return m.nmls; })
              );
              roster = roster.filter(function(m) {
                if (uuidRe.test(m.id)) return true;
                if (m.nmls && uuidNmls.has(m.nmls)) return false;
                return true;
              });
              localStorage.setItem("mtk_roster", JSON.stringify(roster));
              window.dispatchEvent(new Event("storage"));
            } catch(e) {}
          });
      }

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
        fuWhoOptions: (profile && profile.fu_who_options) || "",
        newContactId: newContactId || null,
        mustChangePassword: !!(profile && profile.must_change_password),
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
      // Detect "email already registered" via two signals:
      // 1. identities === [] (email-confirmation-enabled projects)
      // 2. created_at is more than 30s ago (admin-created users returned by signUp have a non-empty
      //    identities array but are NOT new — so the elapsed-time check catches them)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try signing in.");
        setLoading(false);
        return;
      }
      if (data.user && data.user.created_at) {
        const ageSeconds = (Date.now() - new Date(data.user.created_at).getTime()) / 1000;
        if (ageSeconds > 30) {
          setError("An account with this email already exists. Please sign in instead.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }
      if (data.session) {
        // Auto-confirmed — log them in immediately
        const user = data.user;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        // If the trigger defaulted the profile to 'borrower' but the user chose a different role,
        // correct it now. This happens when ON CONFLICT DO NOTHING skips the insert (e.g. a
        // prior failed signup already created the row) or the trigger doesn't receive metadata.
        let role = (profile && profile.role) ? profile.role : suRole;
        if (profile && profile.role === "borrower" && suRole && suRole !== "borrower") {
          await supabase.from("profiles").update({ role: suRole }).eq("id", user.id);
          role = suRole;
        }
        const displayName = (profile && profile.display_name) ? profile.display_name : (suFirstName.trim() + " " + suLastName.trim()).trim();
        const isInternal = ["admin", "internal", "branch_admin"].includes(role);

        syncProfileToRoster(user.id, displayName, role, profile);

        // Seed FU Who options with this LO's initials on first signup
        if (isInternal && suFirstName.trim() && suLastName.trim()) {
          const initials = (suFirstName.trim()[0] + suLastName.trim()[0]).toUpperCase();
          try {
            // Seed fu_who_options in Supabase profile with this LO's initials
            var _existing = (profile && profile.fu_who_options) || "";
            var _opts = _existing ? _existing.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
            if (!_opts.includes(initials)) {
              _opts.push(initials);
              await supabase.from("profiles").update({ fu_who_options: _opts.join(",") }).eq("id", user.id);
            }
          } catch(e) {}
        }

        // Save NMLS to profile if provided (LO signup)
        if (suRole === "internal" && suNmls.trim()) {
          await supabase.from("profiles").update({ nmls: suNmls.trim() }).eq("id", user.id);
        }

        // Ensure a contact record exists; returns new contact ID for brand-new users
        // ?lo= links (LO referral) → auto-assign that LO
        // ?from= links (Realtor/Builder referral) → NO auto-assign; Realtor uses Refer button
        const assignedLoId      = loRef ? loRef.id : null;
        const referredByContact = fromRef ? fromRef.id : null;
        const newContactId = await ensureContactForNewUser(displayName, user.email, role, suPhone.trim(), suFirstName.trim(), suLastName.trim(), assignedLoId, referredByContact);
        // Clear referral tokens after successful signup
        try { sessionStorage.removeItem("mtk_lo_ref");   } catch(e) {}
        try { sessionStorage.removeItem("mtk_from_ref"); } catch(e) {}

        // Resolve any pending scenario shares addressed to this email
        if (resolvePendingSharesForUser) {
          await resolvePendingSharesForUser(user.email, user.id);
        }

        // Flag new LO signups so App.js can show the setup prompt
        if (isInternal) {
          try { sessionStorage.setItem("mtk_new_lo_signup", "1"); } catch(e) {}
        }

        onLogin({
          id: user.id,
          name: displayName,
          role: role,
          email: user.email,
          isInternal: isInternal,
          supabaseUser: true,
          borrowerPermissions: profile.borrower_permissions || [],
          fuWhoOptions: (profile && profile.fu_who_options) || "",
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
  async function ensureContactForNewUser(displayName, email, role, phone, firstName, lastName, assignedLoId, referredByContactId) {
    if (!supabase || !email) return null;
    try {
      const emailLower = email.toLowerCase();

      // Search across all email columns — Realtors/Builders may exist in multiple LOs' contacts
      const { data: existing, error: selectErr } = await supabase
        .from("contacts")
        .select("id, email, email_personal, email_work")
        .or(`email.eq.${emailLower},email_personal.eq.${emailLower},email_work.eq.${emailLower}`);
      if (selectErr) {
        console.warn("Contact lookup failed:", selectErr.message, selectErr.code);
        return null;
      }

      if (existing && existing.length > 0) {
        // For Realtors/Builders: stamp email_personal on ALL matching contacts so
        // every LO's copy is properly linked to this account via email matching.
        if (role === "realtor" || role === "builder") {
          const ids = existing.map(function(c) { return c.id; });
          await supabase.from("contacts")
            .update({ email_personal: emailLower })
            .in("id", ids);
        }
        return existing[0].id; // return first match as primary contact
      }

      // Use explicitly-provided names; fall back to splitting displayName only as a safety net
      const resolvedFirst = (firstName || "").trim() || ((displayName || "").trim().split(/\s+/)[0] || "");
      const resolvedLast  = (lastName  || "").trim() || ((displayName || "").trim().split(/\s+/).slice(1).join(" ") || "");

      const contactPayload = {
        first_name:      resolvedFirst,
        last_name:       resolvedLast,
        email:           email.toLowerCase(),
        email_personal:  email.toLowerCase(),
        phone_cell:      (phone || "").replace(/\D/g, ""),
        contact_type:    (role === "internal" || role === "branch_admin" || role === "realtor" || role === "builder") ? "business" : "client",
        contact_category: (role === "internal" || role === "branch_admin") ? "Loan Officer"
                        : role === "realtor"  ? "Realtor"
                        : role === "builder"  ? "Home Builder"
                        : null,
        status:          "active",
        tags:            [],
        source:          "self-signup",
        notes:           "",
      };
      if (assignedLoId)        contactPayload.assigned_lo_id         = assignedLoId;
      if (referredByContactId) contactPayload.referred_by_contact_id = referredByContactId;
      if (assignedLoId)        contactPayload.creator_id             = assignedLoId;

      const { data: newContact, error: insertErr } = await supabase.from("contacts").insert(contactPayload).select("id").single();

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
    // Remove stale non-UUID entries that share the same NMLS as a UUID-based entry.
    // This cleans up manually-created legacy entries (e.g. "Marky Mark") that duplicate
    // a real Supabase profile entry with the same NMLS number.
    var uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    var uuidNmls = new Set(
      roster.filter(function(m) { return uuidRe.test(m.id) && m.nmls; })
            .map(function(m) { return m.nmls; })
    );
    roster = roster.filter(function(m) {
      if (uuidRe.test(m.id)) return true;
      if (m.nmls && uuidNmls.has(m.nmls)) return false;
      return true;
    });
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
        }, "Home Loan Toolkit"),
        React.createElement("p", {
          style: { fontSize: 11, color: "#6B7D8A", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, fontFamily: font, margin: 0 }
        }, "Your toolkit for success")
      ),

      // Live session invite banner
      pendingLive && React.createElement("div", {
        style: {
          background: "#EBF8FF", border: "1.5px solid #3B82F6",
          borderRadius: 10, padding: "14px 16px", marginBottom: 20,
          textAlign: "center", fontFamily: font
        }
      },
        React.createElement("div", { style: { fontSize: 13, color: "#1D4ED8", fontWeight: 700, marginBottom: 4 } },
          "📡 You've been invited to a Live Session"
        ),
        React.createElement("div", { style: { fontSize: 12, color: "#374151", lineHeight: 1.5 } },
          "Your loan officer is ready to walk through your numbers with you.",
          React.createElement("br"),
          "Sign in or create a free account to join."
        )
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
                        placeholder: "",
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
                  placeholder: ""
                })
              ),
              React.createElement("div", { style: { marginBottom: 6 } },
                React.createElement("label", { style: labelStyle }, "PASSWORD"),
                React.createElement("input", {
                  type: "password",
                  value: password,
                  onChange: function(e) { setPassword(e.target.value); },
                  style: inputStyle,
                  placeholder: "",
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
        // Referral attribution banner — LO link or Realtor/Builder link
        (loRef || fromRef) && React.createElement("div", {
          style: {
            display: "flex", alignItems: "center", gap: 12,
            background: "linear-gradient(90deg, #0C4160, #1A5E8A)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
          }
        },
          // Photo / logo
          fromRef && (fromRef.photo_url || fromRef.logo_url)
            ? React.createElement("img", {
                src: fromRef.photo_url || fromRef.logo_url,
                alt: "",
                style: { width: 48, height: 48, borderRadius: fromRef.photo_url ? "50%" : 8, objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,0.3)" }
              })
            : React.createElement("span", { style: { fontSize: 24, lineHeight: 1 } }, "🏠"),
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, color: "rgba(255,255,255,0.70)", fontFamily: font, marginBottom: 2 } },
              fromRef ? "You're signing up through" : "You're signing up with"
            ),
            React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: font } },
              fromRef
                ? (((fromRef.first_name || "") + " " + (fromRef.last_name || "")).trim() || "Your Agent") + (fromRef.company ? "  ·  " + fromRef.company : "")
                : (loRef.display_name || "Your Loan Officer")
            ),
            false && fromRef && fromRef.assigned_lo_name && React.createElement("div", { style: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font, marginTop: 2 } },
              "with " + fromRef.assigned_lo_name
            )
          )
        ),
        React.createElement("div", { style: { display: "flex", gap: 10, marginBottom: 14 } },
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("label", { style: labelStyle }, "FIRST NAME"),
            React.createElement("input", {
              type: "text",
              value: suFirstName,
              onChange: function(e) { setSuFirstName(e.target.value); },
              style: inputStyle,
              placeholder: ""
            })
          ),
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("label", { style: labelStyle }, "LAST NAME"),
            React.createElement("input", {
              type: "text",
              value: suLastName,
              onChange: function(e) { setSuLastName(e.target.value); },
              style: inputStyle,
              placeholder: ""
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
            placeholder: ""
          })
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "PHONE"),
          React.createElement("input", {
            type: "tel",
            value: suPhone,
            onChange: function(e) { setSuPhone(_fmtPhone(e.target.value)); },
            style: inputStyle,
            placeholder: "",
            maxLength: 14
          })
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "I AM A"),
          React.createElement("select", {
            value: suRole,
            onChange: function(e) { setSuRole(e.target.value); setSuNmls(""); },
            style: inputStyle
          },
            React.createElement("option", { value: "borrower" }, "Client / Borrower"),
            React.createElement("option", { value: "realtor" }, "Realtor"),
            React.createElement("option", { value: "builder" }, "Builder"),
            React.createElement("option", { value: "internal" }, "Loan Officer")
          )
        ),
        suRole === "internal" && React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "NMLS #"),
          React.createElement("input", {
            type: "text",
            inputMode: "numeric",
            value: suNmls,
            onChange: function(e) { setSuNmls(e.target.value.replace(/\D/g, "")); },
            style: inputStyle,
            placeholder: ""
          }),
          React.createElement("div", { style: { fontSize: 11, color: "#94A3B0", marginTop: 4, fontFamily: font } },
            "Your NMLS number is used to generate your unique referral link."
          )
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "PASSWORD"),
          React.createElement("input", {
            type: "password",
            value: suPassword,
            onChange: function(e) { setSuPassword(e.target.value); },
            style: inputStyle,
            placeholder: ""
          })
        ),
        React.createElement("div", { style: { marginBottom: 14 } },
          React.createElement("label", { style: labelStyle }, "CONFIRM PASSWORD"),
          React.createElement("input", {
            type: "password",
            value: suPassword2,
            onChange: function(e) { setSuPassword2(e.target.value); },
            style: inputStyle,
            placeholder: ""
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
        }, loading ? t("Creating account...") : t("Create Account")),

        // Discreet language toggle
        React.createElement("div", {
          style: { textAlign: "center", marginTop: 16 }
        },
          React.createElement("button", {
            onClick: function() { setAppLang(appLang === "es" ? "en" : "es"); },
            style: { background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#94A3B0", fontFamily: font, opacity: 0.7 }
          }, appLang === "es" ? "\uD83C\uDDFA\uD83C\uDDF8 English" : "\uD83C\uDDF2\uD83C\uDDFD Espa\u00F1ol")
        )
      ),

      // Footer
      React.createElement("div", {
        style: { textAlign: "center", marginTop: 20, fontSize: 12, color: "#94A3B0", fontFamily: font }
      },
        "Need help? ",
        React.createElement("a", {
          href: "mailto:help@homeloantoolkit.com?subject=Home Loan Toolkit Support",
          style: { color: "#60A5FA", textDecoration: "none" }
        }, "help@homeloantoolkit.com")
      ),
      React.createElement("div", {
        style: { textAlign: "center", marginTop: 6, fontSize: 11, color: "#94A3B0", fontFamily: font }
      }, "\u00A9 2026 DewMark"),
      React.createElement("div", {
        style: { textAlign: "center", marginTop: 6, fontSize: 10, color: "#C0CDD6", fontFamily: font, letterSpacing: "0.05em" }
      }, "v20260325-1")
    )
  );
}

window.LoginScreen = LoginScreen;
