// modules/screens/SettingsPanel.js
const { useState, useEffect, useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const COLORS = window.COLORS;
const font = window.font;
const _supabase = window._supabaseClient;
const fetchTemplatesFromSupabase_sp   = window.fetchTemplatesFromSupabase;
const saveTemplateToSupabase_sp       = window.saveTemplateToSupabase;
const deleteTemplateFromSupabase_sp   = window.deleteTemplateFromSupabase;
const setDefaultTemplateInSupabase_sp = window.setDefaultTemplateInSupabase;
const fetchWarningRulesSP             = window.fetchWarningRules;
const saveWarningRuleSP               = window.saveWarningRule;
const deleteWarningRuleSP             = window.deleteWarningRule;

function SettingsPanel({ open, onClose, darkMode, allModules, openTab }) {
  const c = useThemeColors();
  const [appLang, setLangPref] = useLocalStorage("app_lang", "en");
  const [brandName, setBrandName] = useLocalStorage("brand_name", "Home Loan Toolkit");
  const [brandSub, setBrandSub] = useLocalStorage("brand_sub", "MORTGAGE MARK · CMG HOME LOANS · NMLS #729612");
  const [brandLogo, setBrandLogo] = useLocalStorage("brand_logo", "");
  const [brandColor, setBrandColor] = useLocalStorage("brand_color", COLORS.navy);
  const [scenarios, setScenarios] = useLocalStorage("app_scenarios", []);
  const [newScenName, setNewScenName] = useState("");
  const [sharedTabs, setSharedTabs] = useLocalStorage("shared_tabs", []);
  const [shareMode, setShareMode] = useLocalStorage("share_mode", "all");
  const [settingsTab, setSettingsTab] = useState("branding");
  const [portalModule, setPortalModule] = useState(allModules[0]?.id || "payment");
  // fu_who_options — source of truth is Supabase; local state mirrors it for immediate UI feedback
  const [fuWhoOptions, setFuWhoOptions] = useState(function() {
    try { var u = JSON.parse(localStorage.getItem("mtk_app_user") || "null"); return (u && u.fuWhoOptions) || ""; } catch(e) { return ""; }
  });
  const [fuWhoInput, setFuWhoInput] = useState("");
  const [fuWhoSaving, setFuWhoSaving] = useState(false);

  // ── Team hierarchy state ───────────────────────────────────────────────
  const [teamHierarchy, setTeamHierarchy] = useState(null);
  const [teamHierarchyLoading, setTeamHierarchyLoading] = useState(false);

  useEffect(function() {
    if (settingsTab !== "team") return;
    if (!_supabase || !_spUser) return;
    if (teamHierarchy !== null) return; // already loaded
    setTeamHierarchyLoading(true);
    (async function() {
      try {
        var userId = _spUser.id;
        var userRole = _spUser.role || "internal";
        var lmtRole = _spUser.lmt_role || "lo";
        var teamLeadId = _spUser.team_lead_id || null;

        if (userRole === "admin" || userRole === "branch_admin") {
          // Admin: fetch ALL internal profiles, group by team_lead_id
          var { data: all } = await _supabase
            .from("profiles")
            .select("id, display_name, email, lmt_role, team_lead_id, role")
            .in("role", ["internal", "admin", "branch_admin"])
            .order("display_name");
          setTeamHierarchy({ mode: "admin", profiles: all || [] });
        } else if (!teamLeadId) {
          // LO (or standalone): fetch their direct reports
          var { data: members } = await _supabase
            .from("profiles")
            .select("id, display_name, email, lmt_role, team_lead_id")
            .eq("team_lead_id", userId)
            .order("lmt_role");
          setTeamHierarchy({ mode: "lo", members: members || [] });
        } else {
          // LOA / Processor: fetch team lead + teammates
          var { data: lead } = await _supabase
            .from("profiles")
            .select("id, display_name, email, lmt_role")
            .eq("id", teamLeadId)
            .maybeSingle();
          var { data: teammates } = await _supabase
            .from("profiles")
            .select("id, display_name, email, lmt_role")
            .eq("team_lead_id", teamLeadId)
            .neq("id", userId)
            .order("lmt_role");
          setTeamHierarchy({ mode: "member", lead: lead, teammates: teammates || [] });
        }
      } catch(e) {}
      setTeamHierarchyLoading(false);
    })();
  }, [settingsTab]);

  // ── Referral slug state ────────────────────────────────────────────────
  const [referralSlug, setReferralSlug] = useState("");
  const [referralSlugInput, setReferralSlugInput] = useState("");
  const [referralSlugSaving, setReferralSlugSaving] = useState(false);
  const [referralSlugMsg, setReferralSlugMsg] = useState(null); // {type: "ok"|"err", text}

  useEffect(function() {
    if (settingsTab !== "team" || !_supabase || !_spUser || !_spUser.id) return;
    (async function() {
      try {
        var { data } = await _supabase.from("profiles").select("referral_slug").eq("id", _spUser.id).single();
        if (data) {
          var s = data.referral_slug || "";
          setReferralSlug(s);
          setReferralSlugInput(s);
        }
      } catch(e) {}
    })();
  }, [settingsTab]);

  async function saveReferralSlug() {
    var raw = referralSlugInput.trim();
    if (!raw) {
      // Allow clearing the slug
      setReferralSlugSaving(true);
      try {
        await _supabase.from("profiles").update({ referral_slug: null }).eq("id", _spUser.id);
        setReferralSlug("");
        setReferralSlugMsg({ type: "ok", text: "Cleared." });
      } catch(e) { setReferralSlugMsg({ type: "err", text: "Save failed." }); }
      setReferralSlugSaving(false);
      setTimeout(function() { setReferralSlugMsg(null); }, 3000);
      return;
    }
    // Validate: letters, numbers, hyphens only, 3-40 chars
    if (!/^[A-Za-z0-9-]{3,40}$/.test(raw)) {
      setReferralSlugMsg({ type: "err", text: "Use only letters, numbers, and hyphens (3–40 chars)." });
      return;
    }
    setReferralSlugSaving(true);
    setReferralSlugMsg(null);
    try {
      // Check for duplicates
      var { data: existing } = await _supabase.from("profiles")
        .select("id").eq("referral_slug", raw).neq("id", _spUser.id).maybeSingle();
      if (existing) {
        setReferralSlugMsg({ type: "err", text: "That URL is already taken. Try another." });
        setReferralSlugSaving(false);
        return;
      }
      await _supabase.from("profiles").update({ referral_slug: raw }).eq("id", _spUser.id);
      setReferralSlug(raw);
      setReferralSlugMsg({ type: "ok", text: "Saved! Your link is live." });
      setTimeout(function() { setReferralSlugMsg(null); }, 4000);
    } catch(e) { setReferralSlugMsg({ type: "err", text: "Save failed. Try again." }); }
    setReferralSlugSaving(false);
  }

  // ── Team sharing state ─────────────────────────────────────────────────
  const [shareContacts, setShareContacts] = useState(function() {
    try {
      var u = JSON.parse(localStorage.getItem("mtk_app_user") || "null");
      return !!(u && u.team_share_contacts);
    } catch(e) { return false; }
  });
  const [shareContactsSaving, setShareContactsSaving] = useState(false);
  const [shareContactsSaved,  setShareContactsSaved]  = useState(false);

  // Always read fresh from Supabase when Team tab opens — localStorage can be stale
  useEffect(function() {
    if (settingsTab !== "team" || !_supabase || !_spUser || !_spUser.id) return;
    (async function() {
      try {
        var { data } = await _supabase.from("profiles").select("team_share_contacts").eq("id", _spUser.id).single();
        if (data) {
          var val = !!(data.team_share_contacts);
          setShareContacts(val);
          // Keep localStorage in sync too
          try {
            var u = JSON.parse(localStorage.getItem("mtk_app_user") || "null");
            if (u) { u.team_share_contacts = val; localStorage.setItem("mtk_app_user", JSON.stringify(u)); }
          } catch(e) {}
        }
      } catch(e) {}
    })();
  }, [settingsTab]);

  async function saveShareContacts(newVal) {
    setShareContacts(newVal);
    try {
      var u = JSON.parse(localStorage.getItem("mtk_app_user") || "null");
      if (!u || !u.id || !_supabase) return;
      setShareContactsSaving(true);
      await _supabase.from("profiles").update({ team_share_contacts: newVal }).eq("id", u.id);
      // Update localStorage cache so toggle shows correct value on reopen
      u.team_share_contacts = newVal;
      try { localStorage.setItem("mtk_app_user", JSON.stringify(u)); } catch(e) {}
      // Clear sessionStorage cache so team members reload fresh on next contact/scenario load
      try { sessionStorage.removeItem("mtk_team_lead_shares_contacts"); } catch(e) {}
      setShareContactsSaving(false);
      setShareContactsSaved(true);
      setTimeout(function() { setShareContactsSaved(false); }, 2500);
    } catch(e) { setShareContactsSaving(false); }
  }

  async function saveFuWhoOptions(newVal) {
    setFuWhoOptions(newVal);
    try {
      var u = JSON.parse(localStorage.getItem("mtk_app_user") || "null");
      if (!u || !u.id || !_supabase) return;
      setFuWhoSaving(true);
      await _supabase.from("profiles").update({ fu_who_options: newVal }).eq("id", u.id);
      // Mirror into cached user so next session restore reads it correctly
      localStorage.setItem("mtk_app_user", JSON.stringify(Object.assign({}, u, { fuWhoOptions: newVal })));
    } catch(e) {}
    setFuWhoSaving(false);
  }

  // ── Template management state ──────────────────────────────────────────
  const [tplList,       setTplList]       = useState([]);
  const [tplLoading,    setTplLoading]    = useState(false);
  const [tplDefaultId,  setTplDefaultId]  = useState(null);
  const [tplRole,       setTplRole]       = useState(null);
  const [tplEditId,     setTplEditId]     = useState(null);
  const [tplEditName,   setTplEditName]   = useState("");
  const [tplEditDesc,   setTplEditDesc]   = useState("");
  const [tplEditGlobal, setTplEditGlobal] = useState(false);
  const [tplSaving,     setTplSaving]     = useState(false);
  const [portalClient, setPortalClient] = useState("");
  const [warnSuppressions, setWarnSuppressions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mtk_warning_suppressions") || "[]"); }
    catch { return []; }
  });

  // ── Custom warning rules state ─────────────────────────────────────────────
  const [customRules,   setCustomRules]   = useState([]);
  const [rulesLoading,  setRulesLoading]  = useState(false);
  const [editingRule,   setEditingRule]   = useState(null);
  const [ruleSaving,    setRuleSaving]    = useState(false);
  const [ruleDeleteId,  setRuleDeleteId]  = useState(null);
  const [ruleError,     setRuleError]     = useState(null);

  const portalLink = useMemo(() => {
    const base = window.location.href.split("?")[0];
    const params = new URLSearchParams({ tabs: portalModule });
    if (portalClient) params.set("client", portalClient);
    return base + "?" + params.toString();
  }, [portalModule, portalClient]);

  // Jump to a specific tab when the panel is opened with openTab
  useEffect(() => {
    if (open && openTab) setSettingsTab(openTab);
  }, [open, openTab]);

  // Fetch templates when "templates" tab is opened
  useEffect(() => {
    if (settingsTab !== "templates" || !_supabase) return;
    let cancelled = false;
    setTplLoading(true);
    fetchTemplatesFromSupabase_sp().then(({ data, error }) => {
      if (cancelled) return;
      if (!error) setTplList(data || []);
      setTplLoading(false);
    });
    // Fetch profile for default_template_id + role
    _supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      _supabase.from("profiles").select("default_template_id, role").eq("id", user.id).single()
        .then(({ data }) => {
          if (cancelled) return;
          if (data) {
            setTplDefaultId(data.default_template_id || null);
            setTplRole(data.role || null);
          }
        });
    });
    return () => { cancelled = true; };
  }, [settingsTab]);

  // Fetch custom warning rules when warnings tab opens
  useEffect(() => {
    if (settingsTab !== "warnings" || !fetchWarningRulesSP) return;
    let cancelled = false;
    setRulesLoading(true);
    fetchWarningRulesSP().then(({ data }) => {
      if (!cancelled) { setCustomRules(data || []); setRulesLoading(false); }
    });
    return () => { cancelled = true; };
  }, [settingsTab]);

  const saveScenario = () => {
    if (!newScenName.trim()) return;
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith("mtk_") && !k.startsWith("mtk_brand_") && !k.startsWith("mtk_app_scenarios") && !k.startsWith("mtk_shared_tabs") && !k.startsWith("mtk_share_mode")) {
        data[k] = localStorage.getItem(k);
      }
    }
    const s = { name: newScenName.trim(), date: new Date().toLocaleDateString(), data };
    setScenarios([...scenarios, s]);
    setNewScenName("");
  };

  const loadScenario = (idx) => {
    const s = scenarios[idx];
    if (!s) return;
    Object.entries(s.data).forEach(([k, v]) => localStorage.setItem(k, v));
    window.location.reload();
  };

  const deleteScenario = (idx) => {
    setScenarios(scenarios.filter((_, i) => i !== idx));
  };

  const generateShareLink = () => {
    const ids = shareMode === "all" ? allModules.map(m => m.id) : sharedTabs;
    const param = encodeURIComponent(ids.join(","));
    const base = window.location.href.split("?")[0].split("#")[0];
    return `${base}?tabs=${param}`;
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(generateShareLink());
  };

  const toggleSharedTab = (id) => {
    setSharedTabs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const _spUser = (() => { try { return JSON.parse(localStorage.getItem("mtk_app_user") || "null"); } catch { return null; } })();
  const _spIsInternal = _spUser?.isInternal === true;

  const toggleSuppression = (id) => {
    const next = warnSuppressions.includes(id)
      ? warnSuppressions.filter(x => x !== id)
      : [...warnSuppressions, id];
    setWarnSuppressions(next);
    localStorage.setItem("mtk_warning_suppressions", JSON.stringify(next));
  };

  // ── Warning rule builder helpers ───────────────────────────────────────────
  const WARN_FIELDS = [
    { key: "loanProgram", label: "Loan Program",    type: "enum",   options: [{v:"conventional",l:"Conventional"},{v:"fha",l:"FHA"},{v:"va",l:"VA"},{v:"usda",l:"USDA"},{v:"jumbo",l:"Jumbo"},{v:"nonqm",l:"Non-QM"}] },
    { key: "occupancy",   label: "Occupancy",       type: "enum",   options: [{v:"primary",l:"Primary"},{v:"vacation",l:"Vacation / 2nd"},{v:"investment",l:"Investment"}] },
    { key: "propType",    label: "Property Type",   type: "enum",   options: [{v:"sfr",l:"SFR"},{v:"condo",l:"Condo"},{v:"townhome",l:"Townhome"},{v:"duplex",l:"Duplex"},{v:"3plex",l:"3-Plex"},{v:"4plex",l:"4-Plex"}] },
    { key: "purpose",     label: "Loan Purpose",    type: "enum",   options: [{v:"purchase",l:"Purchase"},{v:"rateTermRefi",l:"Rate/Term Refi"},{v:"cashOutRefi",l:"Cash-Out Refi"}] },
    { key: "ltv",         label: "LTV (%)",         type: "number" },
    { key: "fico",        label: "Credit Score",    type: "number" },
    { key: "loanAmount",  label: "Loan Amount ($)", type: "number" },
    { key: "homePrice",   label: "Home Price ($)",  type: "number" },
    { key: "pcState",     label: "State",           type: "state"  },
  ];
  const WARN_OPS = {
    enum:   [{v:"is",l:"is"},{v:"is_not",l:"is not"}],
    number: [{v:"gt",l:">"},{v:"gte",l:"≥"},{v:"lt",l:"<"},{v:"lte",l:"≤"},{v:"eq",l:"="}],
    state:  [{v:"is",l:"is"},{v:"is_not",l:"is not"}],
  };
  const getFieldMeta  = (key) => WARN_FIELDS.find(f => f.key === key) || WARN_FIELDS[0];
  const blankCond     = () => ({ field: "loanProgram", op: "is", value: "conventional" });
  const blankRule     = () => ({ id: null, label: "", message: "", severity: "warning", enabled: true, conditions: [blankCond()] });

  const startNewRule  = () => { setEditingRule(blankRule()); setRuleError(null); };
  const startEdit     = (r) => { setEditingRule({ ...r, conditions: r.conditions.map(c => ({...c})) }); setRuleError(null); };

  const updateCond = (idx, patch) => {
    setEditingRule(prev => {
      const conditions = prev.conditions.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, ...patch };
        if (patch.field && patch.field !== c.field) {
          const meta = getFieldMeta(patch.field);
          next.op    = WARN_OPS[meta.type][0].v;
          next.value = meta.type === "enum" ? meta.options[0].v : "";
        }
        return next;
      });
      return { ...prev, conditions };
    });
  };
  const addCond    = () => setEditingRule(prev => ({ ...prev, conditions: [...prev.conditions, blankCond()] }));
  const removeCond = (idx) => setEditingRule(prev => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) }));

  const saveRule = async () => {
    if (!editingRule.label.trim() || !editingRule.message.trim()) { setRuleError("Name and message are required."); return; }
    if (!editingRule.conditions.length) { setRuleError("Add at least one condition."); return; }
    setRuleSaving(true); setRuleError(null);
    const { data, error } = await saveWarningRuleSP(editingRule);
    setRuleSaving(false);
    if (error) { setRuleError("Save failed: " + (error.message || error)); return; }
    setCustomRules(prev => editingRule.id ? prev.map(r => r.id === editingRule.id ? data : r) : [...prev, data]);
    setEditingRule(null);
  };

  const confirmDelete = async (id) => {
    const { error } = await deleteWarningRuleSP(id);
    if (!error) { setCustomRules(prev => prev.filter(r => r.id !== id)); setRuleDeleteId(null); }
  };

  const toggleCustomEnabled = async (rule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    const { data, error } = await saveWarningRuleSP(updated);
    if (!error && data) setCustomRules(prev => prev.map(r => r.id === rule.id ? data : r));
  };

  if (!open) return null;
  const bg = darkMode ? "#1A2530" : "#fff";
  const fg = darkMode ? "#E0E8EF" : "#333";
  const border = darkMode ? "#2A3A48" : "#E8ECF0";
  const inputBg = darkMode ? "#0E1C28" : "#F5F8FA";

  const tabStyle = (active) => ({
    padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
    fontSize: 12, fontWeight: 600, fontFamily: font,
    background: active ? (darkMode ? COLORS.blue : COLORS.navy) : "transparent",
    color: active ? "#fff" : (darkMode ? "#8A9BAA" : "#666"),
  });

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${border}`, background: inputBg, color: fg, fontSize: 13, fontFamily: font };

  // Full-page layout when open=true (no overlay)
  return (
    <div style={{
      minHeight: "100dvh", background: bg, color: fg,
      display: "flex", flexDirection: "column", fontFamily: font,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "16px 24px", borderBottom: `1px solid ${border}`,
        background: bg, position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: fg, fontFamily: font }}>Settings</div>
        </div>
        {/* ── Tab bar ── */}
        <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <button onClick={() => setSettingsTab("branding")} style={tabStyle(settingsTab === "branding")}>Branding</button>
            <button onClick={() => setSettingsTab("templates")} style={tabStyle(settingsTab === "templates")}>Templates</button>
            <button onClick={() => setSettingsTab("scenarios")} style={tabStyle(settingsTab === "scenarios")}>Scenarios</button>
            <button onClick={() => setSettingsTab("sharing")} style={tabStyle(settingsTab === "sharing")}>Share Tabs</button>
            <button onClick={() => setSettingsTab("portal")} style={tabStyle(settingsTab === "portal")}>Client Portal</button>
            {_spIsInternal && <button onClick={() => setSettingsTab("followup")} style={tabStyle(settingsTab === "followup")}>Follow-Up</button>}
            {_spIsInternal && <button onClick={() => setSettingsTab("warnings")} style={tabStyle(settingsTab === "warnings")}>Warnings</button>}
            {_spIsInternal && <button onClick={() => setSettingsTab("team")} style={tabStyle(settingsTab === "team")}>Team</button>}
            <button onClick={() => setSettingsTab("language")} style={tabStyle(settingsTab === "language")}>Language</button>
        </div>
      </div>
      {/* ── Content ── */}
      <div style={{ flex: 1, padding: "28px 24px", maxWidth: 720, width: "100%", boxSizing: "border-box" }}>
          {settingsTab === "branding" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>Customize how the toolkit appears</div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, fontFamily: font }}>TOOLKIT NAME</label>
                <input value={brandName} onChange={e => setBrandName(e.target.value)} style={inputStyle} placeholder="Home Loan Toolkit" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, fontFamily: font }}>SUBTITLE / COMPANY INFO</label>
                <input value={brandSub} onChange={e => setBrandSub(e.target.value)} style={inputStyle} placeholder="Company Name · NMLS #" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, fontFamily: font }}>LOGO URL (optional)</label>
                <input value={brandLogo} onChange={e => setBrandLogo(e.target.value)} style={inputStyle} placeholder="https://example.com/logo.png" />
                {brandLogo && (
                  <div style={{ marginTop: 8, padding: 12, background: inputBg, borderRadius: 8, textAlign: "center" }}>
                    <img src={brandLogo} alt="Logo preview" style={{ maxHeight: 50, maxWidth: "100%" }} onError={e => e.target.style.display = "none"} />
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, fontFamily: font }}>HEADER COLOR</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} style={{ width: 40, height: 32, border: "none", cursor: "pointer", borderRadius: 4 }} />
                  <input value={brandColor} onChange={e => setBrandColor(e.target.value)} style={{ ...inputStyle, width: 120 }} />
                  <button onClick={() => setBrandColor(COLORS.navy)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "none", color: fg, fontSize: 11, fontFamily: font, cursor: "pointer" }}>Reset</button>
                </div>
              </div>
              <div style={{ padding: 12, background: inputBg, borderRadius: 8, fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", fontFamily: font }}>
                💡 Branding changes apply immediately and persist in your browser.
              </div>
            </div>
          )}
          {settingsTab === "templates" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>
                Manage scenario templates — pre-fill new scenarios with your standard settings.
              </div>
              <div style={{ fontSize: 12, color: darkMode ? "#6B7C8A" : "#888", fontFamily: font, lineHeight: 1.5 }}>
                📋 To create a template: open any scenario in the dashboard, click the <strong>📋</strong> button on the scenario row, and give it a name.
              </div>

              {tplLoading && (
                <div style={{ padding: 16, textAlign: "center", color: darkMode ? "#6B7C8A" : "#888", fontFamily: font, fontSize: 12 }}>
                  Loading templates…
                </div>
              )}

              {!tplLoading && tplList.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: darkMode ? "#5A6B78" : "#999", fontFamily: font, background: inputBg, borderRadius: 8 }}>
                  No templates yet. Save a scenario as a template to get started.
                </div>
              )}

              {!tplLoading && tplList.map((t) => (
                <div key={t.id} style={{ background: inputBg, border: `1px solid ${tplEditId === t.id ? COLORS.blue : border}`, borderRadius: 10, padding: "12px 14px" }}>
                  {tplEditId === t.id ? (
                    // ── Edit mode ──
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input
                        value={tplEditName}
                        onChange={e => setTplEditName(e.target.value)}
                        style={{ ...inputStyle, fontWeight: 600 }}
                        placeholder="Template name"
                      />
                      <input
                        value={tplEditDesc}
                        onChange={e => setTplEditDesc(e.target.value)}
                        style={inputStyle}
                        placeholder="Description (optional)"
                      />
                      {tplRole === "admin" && (
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontFamily: font, color: fg }}>
                          <input type="checkbox" checked={tplEditGlobal} onChange={e => setTplEditGlobal(e.target.checked)} style={{ width: 14, height: 14 }} />
                          🌐 Share with entire team (global)
                        </label>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          disabled={tplSaving || !tplEditName.trim()}
                          onClick={async () => {
                            if (!tplEditName.trim() || tplSaving) return;
                            setTplSaving(true);
                            const { data, error } = await saveTemplateToSupabase_sp({
                              templateId:  t.id,
                              name:        tplEditName.trim(),
                              description: tplEditDesc.trim(),
                              isGlobal:    tplEditGlobal,
                              loanPurpose: t.loan_purpose,
                              calculationData: t.calculation_data,
                            });
                            setTplSaving(false);
                            if (error) { alert("Could not update template: " + error.message); return; }
                            setTplList(prev => prev.map(x => x.id === t.id ? data : x));
                            setTplEditId(null);
                          }}
                          style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: COLORS.blue, color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}
                        >{tplSaving ? "Saving…" : "Save"}</button>
                        <button
                          onClick={() => setTplEditId(null)}
                          style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "none", color: fg, fontSize: 11, fontFamily: font, cursor: "pointer" }}
                        >Cancel</button>
                      </div>
                    </div>
                  ) : (
                    // ── Read mode ──
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>{t.name}</span>
                          {t.id === tplDefaultId && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: "rgba(34,197,94,0.12)", color: "#16a34a", fontFamily: font }}>✓ Default</span>
                          )}
                          {t.is_global && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: "rgba(59,130,246,0.12)", color: "#2563eb", fontFamily: font }}>🌐 Global</span>
                          )}
                        </div>
                        {t.description && (
                          <div style={{ fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", fontFamily: font }}>{t.description}</div>
                        )}
                        <div style={{ fontSize: 10, color: darkMode ? "#4A5B68" : "#bbb", fontFamily: font, marginTop: 2 }}>
                          {t.loan_purpose === "refi" ? "🔄 Refinance" : "🏠 Purchase"} · {Object.keys(t.calculation_data || {}).length} saved settings
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        {t.id !== tplDefaultId ? (
                          <button
                            onClick={async () => {
                              const { error } = await setDefaultTemplateInSupabase_sp(t.id);
                              if (error) { alert("Could not set default: " + error.message); return; }
                              setTplDefaultId(t.id);
                            }}
                            style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${COLORS.green}`, background: "none", color: COLORS.green, fontSize: 10, fontWeight: 600, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap" }}
                          >Set Default</button>
                        ) : (
                          <button
                            onClick={async () => {
                              const { error } = await setDefaultTemplateInSupabase_sp(null);
                              if (error) { alert("Could not clear default: " + error.message); return; }
                              setTplDefaultId(null);
                            }}
                            style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${border}`, background: "none", color: darkMode ? "#6B7C8A" : "#888", fontSize: 10, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap" }}
                          >Clear Default</button>
                        )}
                        <button
                          onClick={() => { setTplEditId(t.id); setTplEditName(t.name); setTplEditDesc(t.description || ""); setTplEditGlobal(t.is_global || false); }}
                          style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${border}`, background: "none", color: fg, fontSize: 11, fontFamily: font, cursor: "pointer" }}
                        >✏️</button>
                        <button
                          onClick={async () => {
                            if (!confirm("Delete template \"" + t.name + "\"? This cannot be undone.")) return;
                            const { error } = await deleteTemplateFromSupabase_sp(t.id);
                            if (error) { alert("Could not delete: " + error.message); return; }
                            setTplList(prev => prev.filter(x => x.id !== t.id));
                            if (tplDefaultId === t.id) setTplDefaultId(null);
                          }}
                          style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid rgba(239,68,68,0.4)", background: "none", color: "#ef4444", fontSize: 11, fontFamily: font, cursor: "pointer" }}
                        >🗑</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ padding: 12, background: inputBg, borderRadius: 8, fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", fontFamily: font, lineHeight: 1.6 }}>
                💡 <strong>How it works:</strong> Set one template as your <em>Default</em> and every new scenario automatically starts with those calculator settings. Pick a different template at creation time to override. Global templates (admin only) are visible to all LOs on the team.
              </div>
            </div>
          )}

          {settingsTab === "scenarios" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>Save & load all calculator inputs</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newScenName} onChange={e => setNewScenName(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Scenario name (e.g. Smith Family)" onKeyDown={e => e.key === "Enter" && saveScenario()} />
                <button onClick={saveScenario} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: COLORS.blue, color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap" }}>💾 Save</button>
              </div>
              {scenarios.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: darkMode ? "#5A6B78" : "#999", fontFamily: font }}>
                  No saved scenarios yet. Enter a name and click Save to capture all current inputs.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {scenarios.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: inputBg, borderRadius: 8, border: `1px solid ${border}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: darkMode ? "#5A6B78" : "#999", fontFamily: font }}>Saved {s.date} · {Object.keys(s.data).length} values</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => loadScenario(i)} style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${COLORS.green}`, background: "none", color: COLORS.green, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>Load</button>
                        <button onClick={() => deleteScenario(i)} style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${COLORS.red || "#E74C3C"}`, background: "none", color: COLORS.red || "#E74C3C", fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: 12, background: inputBg, borderRadius: 8, fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", fontFamily: font }}>
                💡 Scenarios save all current calculator values. Loading a scenario will restore those values and refresh the page.
              </div>
            </div>
          )}
          {settingsTab === "sharing" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>Choose which tabs to show when sharing</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShareMode("all")} style={{ ...tabStyle(shareMode === "all"), border: `1px solid ${shareMode === "all" ? COLORS.blue : border}` }}>All Tabs</button>
                <button onClick={() => setShareMode("custom")} style={{ ...tabStyle(shareMode === "custom"), border: `1px solid ${shareMode === "custom" ? COLORS.blue : border}` }}>Custom Selection</button>
              </div>
              {shareMode === "custom" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {allModules.map(m => (
                    <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: sharedTabs.includes(m.id) ? (darkMode ? "#1A3040" : "#E8F4FD") : inputBg, borderRadius: 8, cursor: "pointer", border: `1px solid ${sharedTabs.includes(m.id) ? COLORS.blue : border}`, transition: "all 0.2s" }}>
                      <input type="checkbox" checked={sharedTabs.includes(m.id)} onChange={() => toggleSharedTab(m.id)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <span style={{ fontSize: 16 }}>{m.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>{m.label}</span>
                    </label>
                  ))}
                </div>
              )}
              <div style={{ padding: 14, background: inputBg, borderRadius: 8, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, fontFamily: font }}>SHAREABLE LINK</div>
                <div style={{ fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", wordBreak: "break-all", marginBottom: 8, fontFamily: font }}>{generateShareLink()}</div>
                <button onClick={copyShareLink} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: COLORS.blue, color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>📋 Copy Link</button>
              </div>
              <div style={{ padding: 12, background: inputBg, borderRadius: 8, fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", fontFamily: font }}>
                💡 Share a link that only shows selected tabs. Recipients can view calculators without seeing internal tools.
              </div>
            </div>
          )}
          {settingsTab === "portal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>Generate pre-filled calculator links for clients</div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, fontFamily: font }}>SELECT CALCULATOR</label>
                <select value={portalModule} onChange={e => setPortalModule(e.target.value)} style={inputStyle}>
                  {allModules.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4, fontFamily: font }}>CLIENT NAME (optional, for your reference)</label>
                <input value={portalClient} onChange={e => setPortalClient(e.target.value)} style={inputStyle} placeholder="e.g. Smith Family" />
              </div>
              <div style={{ padding: 14, background: inputBg, borderRadius: 8, border: `1px solid ${border}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, fontFamily: font }}>CLIENT PORTAL LINK</div>
                <div style={{ fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", wordBreak: "break-all", marginBottom: 8, fontFamily: font }}>{portalLink}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { navigator.clipboard?.writeText(portalLink); }} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: COLORS.blue, color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>📋 Copy Link</button>
                  <button onClick={() => window.open(portalLink, "_blank")} style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${COLORS.blue}`, background: "none", color: COLORS.blue, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>🔗 Preview</button>
                </div>
              </div>
              <div style={{ padding: 12, background: inputBg, borderRadius: 8, fontSize: 11, color: darkMode ? "#6B7C8A" : "#888", fontFamily: font }}>
                💡 Send clients a direct link to a specific calculator with your branding. They'll see a clean, focused view perfect for their needs.
              </div>
            </div>
          )}
          {settingsTab === "followup" && _spIsInternal && (() => {
            const opts = fuWhoOptions ? fuWhoOptions.split(",").map(s => s.trim()).filter(Boolean) : [];
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>Follow-Up Team</div>
                <div style={{ fontSize: 12, color: c.textSecondary, fontFamily: font }}>
                  These names / initials appear in the "FU: Who" dropdown on every scenario and contact row. Add one per line or separated by commas.
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 6, fontFamily: font }}>CURRENT OPTIONS</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {opts.length === 0 && <span style={{ fontSize: 12, color: c.textSecondary, fontFamily: font }}>No options yet.</span>}
                    {opts.map((opt, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(37,99,235,0.1)", color: "#1d4ed8", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 600, fontFamily: font }}>
                        {opt}
                        <button onClick={() => {
                          const updated = opts.filter((_, j) => j !== i).join(",");
                          saveFuWhoOptions(updated);
                        }} style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={fuWhoInput}
                      onChange={e => setFuWhoInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && fuWhoInput.trim()) {
                          const toAdd = fuWhoInput.trim().split(/[,\n]+/).map(s => s.trim()).filter(s => s && !opts.includes(s));
                          if (toAdd.length) saveFuWhoOptions([...opts, ...toAdd].join(","));
                          setFuWhoInput("");
                        }
                      }}
                      placeholder="e.g. MP or Mark P."
                      style={{ flex: 1, padding: "8px 12px", border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, background: c.bg, color: c.text }}
                    />
                    <button onClick={() => {
                      const toAdd = fuWhoInput.trim().split(/[,\n]+/).map(s => s.trim()).filter(s => s && !opts.includes(s));
                      if (toAdd.length) saveFuWhoOptions([...opts, ...toAdd].join(","));
                      setFuWhoInput("");
                    }} style={{ padding: "8px 16px", background: COLORS.blue, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font }}>
                      {fuWhoSaving ? "Saving…" : "Add"}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: c.textSecondary, fontFamily: font }}>
                  💡 Tip: Use short initials (MP, PJ) for fast scanning in the dashboard.
                </div>
              </div>
            );
          })()}
          {settingsTab === "language" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font }}>Choose your preferred language for the app.</div>
              <div style={{ display: "flex", gap: 12 }}>
                {[["en","🇺🇸 English"],["es","🇲🇽 Español"]].map(function(opt) {
                  var isActive = appLang === opt[0];
                  return React.createElement("button", {
                    key: opt[0],
                    onClick: function() { setLangPref(opt[0]); if (window.setAppLang) window.setAppLang(opt[0]); },
                    style: {
                      flex: 1, padding: "14px 10px", borderRadius: 10, cursor: "pointer", fontFamily: font,
                      fontSize: 15, fontWeight: 700,
                      background: isActive ? COLORS.navy : inputBg,
                      color: isActive ? "#fff" : fg,
                      border: "2px solid " + (isActive ? COLORS.navy : border),
                      transition: "all 0.15s",
                    }
                  }, opt[1]);
                })}
              </div>
              <div style={{ fontSize: 12, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font, lineHeight: 1.6 }}>
                Language affects all screens for the current user. Spanish translations are being expanded — some labels may still appear in English.
              </div>
            </div>
          )}

          {settingsTab === "warnings" && _spIsInternal && (() => {
            const selStyle  = { padding: "6px 8px", borderRadius: 6, border: `1px solid ${border}`, background: inputBg, color: fg, fontSize: 12, fontFamily: font, cursor: "pointer" };
            const btnSm     = (extra) => ({ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: font, ...extra });

            const renderValueInput = (cond, idx) => {
              const meta = getFieldMeta(cond.field);
              if (meta.type === "enum") return (
                <select value={cond.value} onChange={e => updateCond(idx, { value: e.target.value })} style={selStyle}>
                  {meta.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              );
              if (meta.type === "state") return (
                <select value={cond.value} onChange={e => updateCond(idx, { value: e.target.value })} style={selStyle}>
                  {(window.STATE_LIST || []).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              );
              return <input type="number" inputMode="decimal" onFocus={(e) => e.target.select()} value={cond.value} onChange={e => updateCond(idx, { value: e.target.value })}
                style={{ ...selStyle, width: 80 }} placeholder="value" />;
            };

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* ── Rule builder form ── */}
                {editingRule && (
                  <div style={{ padding: 16, borderRadius: 10, border: `1.5px solid ${COLORS.blue}`, background: inputBg }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: font, color: fg, marginBottom: 12 }}>
                      {editingRule.id ? "Edit Rule" : "New Rule"}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, fontFamily: font, color: darkMode ? "#8A9BAA" : "#666", display: "block", marginBottom: 4 }}>RULE NAME</label>
                      <input value={editingRule.label} onChange={e => setEditingRule(p => ({...p, label: e.target.value}))}
                        style={inputStyle} placeholder="e.g. Non-warrantable condo LTV limit" />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, fontFamily: font, color: darkMode ? "#8A9BAA" : "#666", display: "block", marginBottom: 4 }}>WARNING MESSAGE (shown in calculator)</label>
                      <textarea value={editingRule.message} onChange={e => setEditingRule(p => ({...p, message: e.target.value}))}
                        rows={2} style={{ ...inputStyle, resize: "vertical" }} placeholder="Describe the guideline or limit..." />
                    </div>

                    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, fontFamily: font, color: darkMode ? "#8A9BAA" : "#666", display: "block", marginBottom: 4 }}>SEVERITY</label>
                        <select value={editingRule.severity} onChange={e => setEditingRule(p => ({...p, severity: e.target.value}))} style={{ ...selStyle, width: "100%" }}>
                          <option value="warning">Warning (amber)</option>
                          <option value="error">Error (red)</option>
                        </select>
                      </div>
                      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontFamily: font, color: fg }}>
                          <input type="checkbox" checked={editingRule.enabled} onChange={e => setEditingRule(p => ({...p, enabled: e.target.checked}))} />
                          Active (fires in calculator)
                        </label>
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, fontFamily: font, color: darkMode ? "#8A9BAA" : "#666", display: "block", marginBottom: 6 }}>CONDITIONS (all must match)</label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {editingRule.conditions.map((cond, idx) => {
                          const meta = getFieldMeta(cond.field);
                          const ops  = WARN_OPS[meta.type] || WARN_OPS.enum;
                          return (
                            <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <select value={cond.field} onChange={e => updateCond(idx, { field: e.target.value })} style={selStyle}>
                                {WARN_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                              </select>
                              <select value={cond.op} onChange={e => updateCond(idx, { op: e.target.value })} style={selStyle}>
                                {ops.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                              </select>
                              {renderValueInput(cond, idx)}
                              <button onClick={() => removeCond(idx)} style={{ ...btnSm({ background: "none", border: `1px solid ${border}`, color: darkMode ? "#8A9BAA" : "#999" }), padding: "5px 9px" }}>×</button>
                            </div>
                          );
                        })}
                      </div>
                      <button onClick={addCond} style={{ ...btnSm({ background: "none", border: `1px solid ${border}`, color: fg }), marginTop: 8 }}>+ Add Condition</button>
                    </div>

                    {ruleError && <div style={{ fontSize: 11, color: "#DC2626", fontFamily: font, marginBottom: 8 }}>{ruleError}</div>}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveRule} disabled={ruleSaving} style={btnSm({ background: COLORS.navy, color: "#fff", opacity: ruleSaving ? 0.6 : 1 })}>
                        {ruleSaving ? "Saving…" : "Save Rule"}
                      </button>
                      <button onClick={() => { setEditingRule(null); setRuleError(null); }} style={btnSm({ background: "none", border: `1px solid ${border}`, color: fg })}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Default (hardcoded) rules ── */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: font, color: darkMode ? "#8A9BAA" : "#888", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
                    Default Rules
                  </div>
                  <div style={{ fontSize: 11, color: darkMode ? "#6B7C8A" : "#999", fontFamily: font, marginBottom: 10, lineHeight: 1.5 }}>
                    Built-in agency guidelines. Toggle off any rule your program supports — suppressed per device only.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(window.WARNING_RULES || []).map(rule => {
                      const suppressed = warnSuppressions.includes(rule.id);
                      return (
                        <div key={rule.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${suppressed ? border : (rule.severity === "error" ? "#FECACA" : "#FCD34D")}`, background: suppressed ? inputBg : (rule.severity === "error" ? "#FEF2F2" : "#FFFBEB"), opacity: suppressed ? 0.6 : 1 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: font, color: fg, marginBottom: 2 }}>{rule.label}</div>
                            <div style={{ fontSize: 11, fontFamily: font, color: darkMode ? "#8A9BAA" : "#666", lineHeight: 1.4 }}>{rule.message}</div>
                          </div>
                          <button onClick={() => toggleSuppression(rule.id)} style={btnSm({ background: suppressed ? (darkMode ? "#2A3A48" : "#E8ECF0") : COLORS.navy, color: suppressed ? (darkMode ? "#8A9BAA" : "#666") : "#fff" })}>
                            {suppressed ? "Off" : "On"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {warnSuppressions.length > 0 && (
                    <button onClick={() => { setWarnSuppressions([]); localStorage.setItem("mtk_warning_suppressions", "[]"); }} style={{ ...btnSm({ background: "none", border: `1px solid ${border}`, color: fg }), marginTop: 10 }}>
                      Reset All to On
                    </button>
                  )}
                </div>

                {/* ── Custom (tenant) rules ── */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: font, color: darkMode ? "#8A9BAA" : "#888", letterSpacing: "0.06em", textTransform: "uppercase" }}>Custom Rules</div>
                    {!editingRule && <button onClick={startNewRule} style={btnSm({ background: COLORS.navy, color: "#fff" })}>+ New Rule</button>}
                  </div>
                  {rulesLoading && <div style={{ fontSize: 12, color: darkMode ? "#6B7C8A" : "#999", fontFamily: font }}>Loading…</div>}
                  {!rulesLoading && customRules.length === 0 && (
                    <div style={{ fontSize: 12, color: darkMode ? "#6B7C8A" : "#999", fontFamily: font, fontStyle: "italic" }}>
                      No custom rules yet. Click "+ New Rule" to add one.
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {customRules.map(rule => (
                      <div key={rule.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${!rule.enabled ? border : (rule.severity === "error" ? "#FECACA" : "#FCD34D")}`, background: !rule.enabled ? inputBg : (rule.severity === "error" ? "#FEF2F2" : "#FFFBEB"), opacity: rule.enabled ? 1 : 0.6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: font, color: fg, marginBottom: 2 }}>{rule.label}</div>
                          <div style={{ fontSize: 11, fontFamily: font, color: darkMode ? "#8A9BAA" : "#666", lineHeight: 1.4, marginBottom: 4 }}>{rule.message}</div>
                          <div style={{ fontSize: 10, fontFamily: font, color: darkMode ? "#6B7C8A" : "#aaa" }}>
                            {(rule.conditions || []).map((c, i) => {
                              const meta = getFieldMeta(c.field);
                              const opLabel = (WARN_OPS[meta.type] || []).find(o => o.v === c.op)?.l || c.op;
                              return <span key={i}>{i > 0 ? " AND " : ""}{meta.label} {opLabel} <strong>{c.value}</strong></span>;
                            })}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                          <button onClick={() => toggleCustomEnabled(rule)} style={btnSm({ background: rule.enabled ? COLORS.navy : (darkMode ? "#2A3A48" : "#E8ECF0"), color: rule.enabled ? "#fff" : (darkMode ? "#8A9BAA" : "#666") })}>
                            {rule.enabled ? "On" : "Off"}
                          </button>
                          <button onClick={() => startEdit(rule)} style={btnSm({ background: "none", border: `1px solid ${border}`, color: fg })}>Edit</button>
                          {ruleDeleteId === rule.id ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => confirmDelete(rule.id)} style={btnSm({ background: "#DC2626", color: "#fff" })}>Yes</button>
                              <button onClick={() => setRuleDeleteId(null)} style={btnSm({ background: "none", border: `1px solid ${border}`, color: fg })}>No</button>
                            </div>
                          ) : (
                            <button onClick={() => setRuleDeleteId(rule.id)} style={btnSm({ background: "none", border: `1px solid #FECACA`, color: "#DC2626" })}>Del</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })()}

          {settingsTab === "team" && _spIsInternal && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: font, color: fg }}>
                Share my contacts with my team
              </div>
              <div style={{ fontSize: 13, color: darkMode ? "#8A9BAA" : "#64748B", fontFamily: font, lineHeight: 1.6 }}>
                When enabled, your LOA and Processors can view and edit your contacts. They cannot delete contacts or export your data.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <div
                    onClick={function() { saveShareContacts(!shareContacts); }}
                    style={{
                      position: "relative", width: 44, height: 24, borderRadius: 99, cursor: "pointer",
                      background: shareContacts ? "#22C55E" : (darkMode ? "#374151" : "#CBD5E1"),
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 3,
                      left: shareContacts ? 22 : 3,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      transition: "left 0.2s",
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: font, color: shareContacts ? "#22C55E" : (darkMode ? "#8A9BAA" : "#94A3B0") }}>
                    {shareContacts ? "On" : "Off"}
                  </span>
                </label>
                {shareContactsSaving && (
                  <span style={{ fontSize: 12, color: darkMode ? "#8A9BAA" : "#94A3B0", fontFamily: font }}>Saving…</span>
                )}
                {shareContactsSaved && !shareContactsSaving && (
                  <span style={{ fontSize: 12, color: "#22C55E", fontFamily: font }}>Saved</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font, lineHeight: 1.6 }}>
                Changes take effect immediately. Your team members may need to refresh to see the update.
              </div>

              {/* ── Referral Link ──────────────────────────────── */}
              <div style={{ marginTop: 8, borderTop: "1px solid " + (darkMode ? "#2A3A48" : "#E8EEF4"), paddingTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: font, color: fg, marginBottom: 6 }}>
                  Your Referral Link
                </div>
                <div style={{ fontSize: 12, color: darkMode ? "#8A9BAA" : "#64748B", fontFamily: font, lineHeight: 1.6, marginBottom: 14 }}>
                  Create a custom URL that sends clients directly to your toolkit. Use letters, numbers, and hyphens — no spaces.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
                  <span style={{
                    padding: "8px 10px", background: darkMode ? "#1A2A38" : "#F1F5F9",
                    border: "1px solid " + border, borderRight: "none",
                    borderRadius: "6px 0 0 6px", fontSize: 12, color: darkMode ? "#8A9BAA" : "#64748B",
                    fontFamily: font, whiteSpace: "nowrap", lineHeight: 1,
                  }}>homeloantoolkit.com/</span>
                  <input
                    value={referralSlugInput}
                    onChange={function(e) {
                      setReferralSlugInput(e.target.value.replace(/[^A-Za-z0-9-]/g, ""));
                      setReferralSlugMsg(null);
                    }}
                    placeholder="CustomizeName"
                    maxLength={40}
                    style={Object.assign({}, inputStyle, {
                      borderRadius: "0 6px 6px 0", borderLeft: "none", flex: 1,
                    })}
                  />
                  <button
                    onClick={saveReferralSlug}
                    disabled={referralSlugSaving}
                    style={{
                      marginLeft: 8, padding: "8px 16px", borderRadius: 6,
                      background: COLORS.navy, color: "#fff", border: "none",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
                      opacity: referralSlugSaving ? 0.6 : 1, whiteSpace: "nowrap",
                    }}
                  >{referralSlugSaving ? "Saving…" : "Save"}</button>
                </div>
                {referralSlug && (
                  <div style={{ fontSize: 12, color: darkMode ? "#8A9BAA" : "#475569", fontFamily: font, marginBottom: 6 }}>
                    Current link:{" "}
                    <a href={"https://www.homeloantoolkit.com/" + referralSlug} target="_blank" rel="noopener noreferrer"
                      style={{ color: COLORS.blue, fontWeight: 600 }}>
                      homeloantoolkit.com/{referralSlug}
                    </a>
                  </div>
                )}
                {referralSlugMsg && (
                  <div style={{ fontSize: 12, fontFamily: font, fontWeight: 600,
                    color: referralSlugMsg.type === "ok" ? "#22C55E" : "#ef4444" }}>
                    {referralSlugMsg.text}
                  </div>
                )}
              </div>

              {/* ── Team Hierarchy ─────────────────────────────── */}
              <div style={{ marginTop: 8, borderTop: "1px solid " + (darkMode ? "#2A3A48" : "#E8EEF4"), paddingTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: font, color: fg, marginBottom: 14 }}>
                  Team Structure
                </div>

                {teamHierarchyLoading && (
                  <div style={{ fontSize: 13, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font }}>Loading…</div>
                )}

                {!teamHierarchyLoading && teamHierarchy && (function() {
                  var roleLabel = function(r) {
                    return r === "lo" ? "Loan Officer" : r === "loa" ? "LOA" : r === "processor" ? "Processor" : r === "manager" ? "Branch Manager" : r || "—";
                  };
                  var memberRow = function(p, indent, isSelf) {
                    return React.createElement("div", {
                      key: p.id,
                      style: {
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", marginLeft: indent ? 24 : 0,
                        borderRadius: 8,
                        background: isSelf ? (darkMode ? "rgba(14,116,190,0.12)" : "rgba(12,65,96,0.06)") : "transparent",
                        borderLeft: indent ? "2px solid " + (darkMode ? "#2A3A48" : "#D1E0EC") : "none",
                      }
                    },
                      React.createElement("div", {
                        style: {
                          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                          background: isSelf ? COLORS.navy : (darkMode ? "#2A3A48" : "#E2EBF3"),
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700,
                          color: isSelf ? "#fff" : (darkMode ? "#8A9BAA" : "#4A6280"),
                          fontFamily: font,
                        }
                      }, (p.display_name || p.email || "?").slice(0,2).toUpperCase()),
                      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        React.createElement("div", {
                          style: { fontSize: 13, fontWeight: isSelf ? 700 : 500, color: fg, fontFamily: font, display: "flex", alignItems: "center", gap: 6 }
                        },
                          p.display_name || p.email || "Unknown",
                          isSelf && React.createElement("span", {
                            style: { fontSize: 10, fontWeight: 700, color: COLORS.navy, background: darkMode ? "rgba(14,116,190,0.2)" : "#DBEAFE", borderRadius: 4, padding: "1px 6px", fontFamily: font }
                          }, "You")
                        ),
                        React.createElement("div", {
                          style: { fontSize: 11, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font, marginTop: 1 }
                        }, roleLabel(p.lmt_role))
                      )
                    );
                  };

                  // ── LO view ──────────────────────────────────────────
                  if (teamHierarchy.mode === "lo") {
                    var myProfile = { id: _spUser.id, display_name: _spUser.name || _spUser.email, email: _spUser.email, lmt_role: _spUser.lmt_role || "lo" };
                    return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
                      memberRow(myProfile, false, true),
                      teamHierarchy.members.length === 0
                        ? React.createElement("div", { style: { fontSize: 12, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font, padding: "8px 12px 4px 36px", fontStyle: "italic" } }, "No team members linked yet. Ask your LOA or Processor to set you as their Team Lead in their profile.")
                        : teamHierarchy.members.map(function(m) { return memberRow(m, true, false); })
                    );
                  }

                  // ── LOA / Processor view ──────────────────────────────
                  if (teamHierarchy.mode === "member") {
                    var myProf = { id: _spUser.id, display_name: _spUser.name || _spUser.email, email: _spUser.email, lmt_role: _spUser.lmt_role };
                    return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 } },
                      teamHierarchy.lead
                        ? memberRow(teamHierarchy.lead, false, false)
                        : React.createElement("div", { style: { fontSize: 12, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font, padding: "8px 12px", fontStyle: "italic" } }, "No Team Lead set. Ask your admin to link you to an LO."),
                      memberRow(myProf, true, true),
                      teamHierarchy.teammates.map(function(m) { return memberRow(m, true, false); })
                    );
                  }

                  // ── Admin / Branch Admin view ─────────────────────────
                  if (teamHierarchy.mode === "admin") {
                    var allProfiles = teamHierarchy.profiles || [];
                    // Group: team leads = profiles with no team_lead_id (or lmt_role=lo/manager)
                    var leads = allProfiles.filter(function(p) { return !p.team_lead_id; });
                    var byLead = {};
                    allProfiles.forEach(function(p) {
                      if (p.team_lead_id) {
                        if (!byLead[p.team_lead_id]) byLead[p.team_lead_id] = [];
                        byLead[p.team_lead_id].push(p);
                      }
                    });
                    if (leads.length === 0) {
                      return React.createElement("div", { style: { fontSize: 12, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font, fontStyle: "italic" } }, "No team structure found.");
                    }
                    return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
                      leads.map(function(lead) {
                        var reports = byLead[lead.id] || [];
                        var isMe = lead.id === _spUser.id;
                        return React.createElement("div", { key: lead.id, style: { borderRadius: 10, border: "1px solid " + (darkMode ? "#2A3A48" : "#E2EBF3"), overflow: "hidden" } },
                          memberRow(lead, false, isMe),
                          reports.length > 0
                            ? React.createElement("div", { style: { borderTop: "1px solid " + (darkMode ? "#2A3A48" : "#E8EEF4"), paddingTop: 4, paddingBottom: 4 } },
                                reports.map(function(m) { return memberRow(m, true, m.id === _spUser.id); })
                              )
                            : React.createElement("div", { style: { fontSize: 11, color: darkMode ? "#6B7D8A" : "#94A3B0", fontFamily: font, padding: "6px 12px 8px 36px", fontStyle: "italic" } }, "No members linked")
                        );
                      })
                    );
                  }

                  return null;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
  );
}

window.SettingsPanel = SettingsPanel;
