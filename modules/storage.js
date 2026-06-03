// modules/storage.js
// Globals available: window.useLocalStorage (hooks.js),
//                    window.CALC_KEY_PREFIXES (constants.js),
//                    window._supabaseClient (main HTML plain <script> block)

// Alias — keeps all internal function bodies identical to source (original line 140)
const CALC_KEY_PREFIXES = window.CALC_KEY_PREFIXES;

// Supabase client bridge (mirrors pattern in mortgage-toolkit.html plain <script> block)
const supabase = window._supabaseClient;

// --- CALC_SECTION_NAMES (original line 177) ---
const CALC_SECTION_NAMES = {
  "pc_": "Purchase Calculator", "ra_": "Rate/APR", "fs_": "Fee Sheet",
  "mc_": "Monthly Cost", "be_": "Break-Even", "pq_": "Pre-Qualification",
  "fc_": "FHA Calculator", "af_": "Affordability", "am_": "Amortization",
  "dti_": "DTI", "rvb_": "Rent vs Buy", "sns_": "Seller Net Sheet",
  "biw_": "Bi-Weekly", "cce_": "Closing Cost Est.", "hel_": "HELOC",
  "lpc_": "Loan Product Compare", "bud_": "Budget", "ohlc_": "Overhead",
  "rw_": "Refinance", "fly_": "Flyer", "brand_": "Branding",
  "abt_": "About", "wb_": "Wealth Builder", "te_": "Title Endorsements"
};

// --- snapshotCalculatorData (original line 145) ---
function snapshotCalculatorData() {
  const data = {};
  // Always preserve uid — it's stored as mtk_uid but not in CALC_KEY_PREFIXES
  try {
    const uid = JSON.parse(localStorage.getItem("mtk_uid"));
    if (uid) data.uid = uid;
  } catch {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("mtk_")) continue;
    const shortKey = k.slice(4);
    if (CALC_KEY_PREFIXES.some(p => shortKey.startsWith(p))) {
      try { data[shortKey] = JSON.parse(localStorage.getItem(k)); } catch {}
    }
  }
  // Explicitly include lo_selected — not in CALC_KEY_PREFIXES but must travel with the scenario
  try {
    const loSel = localStorage.getItem("mtk_lo_selected");
    if (loSel !== null) data["lo_selected"] = JSON.parse(loSel);
  } catch {}
  // Include enabled modules so the LO's tab visibility choices travel with the scenario
  try {
    const mods = localStorage.getItem("mtk_app_enabled_mods");
    if (mods !== null) data["_enabled_mods"] = JSON.parse(mods);
  } catch {}
  return data;
}

// Fields that should start blank for new (empty) scenarios.
// These are primary financial input fields. Selector/mode fields (pc_purpose, pc_term,
// pc_state, etc.) are intentionally omitted so dropdowns keep sensible defaults.
const BLANK_SCENARIO_FIELDS = [
  // Payment Calculator
  "pc_la","pc_hp","pc_dp","pc_rate","pc_fico","pc_hoa",
  // pc_taxr, pc_insr, pc_pmi intentionally NOT blanked — defaults (2.3%, 0.7%, 0.55%) must survive new-scenario creation
  // Fee Sheet / Mortgage Comparison shared amounts
  "fs_mt","fs_mi",
  // Refinance Analyzer
  "ra_cb","ra_cr","ra_ola","ra_notedate","ra_cpmi","ra_chv","ra_addr","ra_city","ra_zip",
  // Affordability Calculator
  "af_inc","af_coinc","af_debts","af_rate",
  // Loan Program Comparison
  "lpc_price","lpc_credit","lpc_conv","lpc_fha","lpc_va","lpc_usda",
  // Closing Cost Estimator
  "cce_price","cce_loan","cce_rate",
  // Bi-Weekly Calculator
  "biw_loan","biw_rate",
  // Break-Even Calculator
  "be_cp","be_np","be_cc","be_cr","be_nr","be_lb",
  // Rent vs Buy Calculator
  "rvb_price","rvb_rate","rvb_rent",
  // HELOC Calculator
  "hel_value","hel_bal","hel_amt","hel_mrate","hel_mpay","hel_hrate",
  // DTI Calculator — blank income/debt lists so sample data doesn't carry over
  "dti_income","dti_debts","dti_payoff_bal",
  // PQ Letter — text/number fields that must start fresh per scenario
  // NOTE: pq_lt and pq_lterm are intentionally NOT blanked — they are selects with
  // default values ("Conventional", "30 Year") and must persist for first-render letter generation.
  "pq_dti","pq_co","pq_lo","pq_bpts","pq_bcd",
  // Seller Net Sheet
  "sns_price","sns_mort1",
  // Budget Planner
  "bud_income","bud_mort","bud_tax","bud_ins","bud_util","bud_car",
  "bud_carins","bud_groc","bud_child","bud_student","bud_cc","bud_subs","bud_ent","bud_save","bud_other",
];

// --- restoreCalculatorData (original line 158) ---
function restoreCalculatorData(data) {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("mtk_")) continue;
    const shortKey = k.slice(4);
    if (CALC_KEY_PREFIXES.some(p => shortKey.startsWith(p))) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));

  // Determine if data contains real calculator values (keys matching a known prefix).
  // A brand-new scenario has only { uid: "..." } — no calc-prefix keys — so it
  // gets treated as blank (fields reset to "") rather than falling back to
  // hardcoded useState defaults, which is what caused "random settings" on new scenarios.
  const hasCalcData = data && typeof data === "object" &&
    Object.keys(data).some(function(k) {
      return CALC_KEY_PREFIXES.some(function(p) { return k.startsWith(p); });
    });

  if (hasCalcData) {
    // Existing scenario (or template-seeded) — restore all saved values
    Object.entries(data).forEach(([shortKey, val]) => {
      try { localStorage.setItem("mtk_" + shortKey, JSON.stringify(val)); } catch {}
    });
    // Restore lo_selected explicitly (stored under "lo_selected" in snapshot, key is "mtk_lo_selected")
    if (data["lo_selected"] !== undefined) {
      try { localStorage.setItem("mtk_lo_selected", JSON.stringify(data["lo_selected"])); } catch {}
    }
    // Restore enabled modules so clients see exactly the tabs the LO enabled
    if (data["_enabled_mods"] !== undefined) {
      try { localStorage.setItem("mtk_app_enabled_mods", JSON.stringify(data["_enabled_mods"])); } catch {}
    }
  } else {
    // New / blank scenario — preserve uid if present; blank all financial fields
    if (data && data.uid) {
      try { localStorage.setItem("mtk_uid", JSON.stringify(data.uid)); } catch {}
    }
    BLANK_SCENARIO_FIELDS.forEach(function(k) {
      try { localStorage.setItem("mtk_" + k, JSON.stringify("")); } catch {}
    });
    // Explicit non-blank defaults for new scenarios
    // VA: always start as Active Duty/Veteran, First Use, not rated/exempt
    // 2nd Lien: always start disabled with all fields blank
    var NEW_SCENARIO_DEFAULTS = {
      "pc_va_svc":      "active",  // Active Duty / Veteran
      "pc_va_first":    "true",    // First use
      "pc_va_exempt":   "false",   // Not exempt (not disability-rated)
      "pc_va_dis":      "0",       // 0% disability rating
      "pc_2nd_enabled": "false",   // 2nd lien off
      "pc_2nd_rate":    "",
      "pc_2nd_term":    "",
      "pc_2nd_amt":     "",
      "pc_2nd_mode":    "pct",
      "sns_comm":       "6",    // Realtor commission defaults to 6%
    };
    Object.keys(NEW_SCENARIO_DEFAULTS).forEach(function(k) {
      try { localStorage.setItem("mtk_" + k, JSON.stringify(NEW_SCENARIO_DEFAULTS[k])); } catch {}
    });
  }
}

// --- diffCalculatorData (original line 187) ---
function diffCalculatorData(before, after) {
  if (!before || !after) return { sections: [], details: {} };
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = {};
  allKeys.forEach(function(key) {
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) {
      const prefix = CALC_KEY_PREFIXES.find(function(p) { return key.startsWith(p); }) || "";
      const section = CALC_SECTION_NAMES[prefix] || prefix || "Other";
      if (!changed[section]) changed[section] = [];
      changed[section].push(key);
    }
  });
  return { sections: Object.keys(changed), details: changed };
}

// --- saveScenarioData (original line 205) ---
function saveScenarioData(scenarioId) {
  if (!scenarioId) return;
  try {
    const scenarios = JSON.parse(localStorage.getItem("mtk_scenarios") || "[]");
    const idx = scenarios.findIndex(s => s.id === scenarioId);
    if (idx >= 0) {
      scenarios[idx].calculatorData = snapshotCalculatorData();
      scenarios[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("mtk_scenarios", JSON.stringify(scenarios));
    }
  } catch {}
}

// --- saveScenarioToSupabase (original line 228) ---
async function saveScenarioToSupabase({
  scenarioId, uid, name, notes, status, calculationData, contact_id, co_borrower_contact_id,
  lead_status, loan_purpose, property_address, lead_source,
  target_close_date, actual_close_date
} = {}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const payload = {
    user_id: user.id,
    name: name || "Untitled Scenario",
    notes: notes || "",
    status: status || "active",
    calculation_data: calculationData !== undefined ? calculationData : snapshotCalculatorData(),
  };
  if (uid              !== undefined && uid) payload.scenario_id = uid;
  if (contact_id            !== undefined) payload.contact_id            = contact_id;
  if (co_borrower_contact_id !== undefined) payload.co_borrower_contact_id = co_borrower_contact_id || null;
  if (lead_status      !== undefined) payload.lead_status      = lead_status;
  if (loan_purpose     !== undefined) payload.loan_purpose     = loan_purpose;
  if (property_address !== undefined) payload.property_address = property_address || null;
  if (lead_source      !== undefined) payload.lead_source      = lead_source || null;
  if (target_close_date !== undefined) payload.target_close_date = target_close_date || null;
  if (actual_close_date !== undefined) payload.actual_close_date = actual_close_date || null;
  if (scenarioId) {
    const { data, error } = await supabase
      .from("scenarios").update(payload).eq("id", scenarioId).select().single();
    return { data, error };
  } else {
    const { data, error } = await supabase
      .from("scenarios").insert(payload).select().single();
    return { data, error };
  }
}

// --- fetchScenariosFromSupabase ---
async function fetchScenariosFromSupabase() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: [], error: authErr || new Error("Not logged in") };

  // Get role from profile (get_my_role() is now VOLATILE — safe to call)
  // Fall back to sessionStorage if profile query fails
  var role = "borrower";
  try {
    var cached = sessionStorage.getItem("mtk_user_role");
    if (cached) { role = cached; }
    else {
      var { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (prof && prof.role) { role = prof.role; try { sessionStorage.setItem("mtk_user_role", role); } catch(e) {} }
    }
  } catch(e) {}

  const ADMIN_ROLES = ["super_admin", "admin", "branch_admin"];
  const canSeeAll = ADMIN_ROLES.includes(role);

  let query = supabase.from("scenarios").select("*").order("updated_at", { ascending: false });
  if (!canSeeAll) query = query.eq("user_id", user.id);

  const { data, error } = await query;
  if (error || !data) return { data: data || [], error };

  const userIds = [...new Set(data.map(r => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles").select("id, display_name").in("id", userIds);
  const nameMap = {};
  if (profiles) profiles.forEach(p => { nameMap[p.id] = p.display_name; });
  const enriched = data.map(row => ({ ...row, _owner_name: nameMap[row.user_id] || "" }));
  return { data: enriched, error: null };
}

// --- deleteScenarioFromSupabase (original line 311) ---
async function deleteScenarioFromSupabase(scenarioId) {
  const { data, error } = await supabase
    .from("scenarios")
    .delete()
    .eq("id", scenarioId)
    .select("id");
  return { error, deletedCount: data ? data.length : 0 };
}

// --- writeAuditLog (original line 325) ---
async function writeAuditLog(scenarioId, action, changes, note) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("scenario_audit_log").insert({
    scenario_id: scenarioId, user_id: user.id,
    action: action, changes: changes || {}, note: note || ""
  });
}

// --- fetchAuditLog (original line 340) ---
async function fetchAuditLog(scenarioId) {
  const { data, error } = await supabase
    .from("scenario_audit_log").select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: false }).limit(50);
  return { data: data || [], error };
}

// --- hashPassword (original line 355) ---
async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// --- getDefaultRoster (original line 360) ---
function getDefaultRoster() {
  return [
    { id: "m1", name: "Mark Ningard", title: "Sr. Loan Officer",
      company: "CMG Home Loans", phone: "469-631-3879",
      email: "mymortgagemark@gmail.com", nmls: "729612",
      branchNmls: "", address: "", city: "", state: "TX", zip: "",
      role: "admin", passwordHash: "", active: true, firstLogin: true },
    { id: "m2", name: "Paige Minden", title: "Loan Officer Assistant",
      company: "CMG Home Loans", phone: "", email: "", nmls: "",
      branchNmls: "", address: "", city: "", state: "TX", zip: "",
      role: "admin", passwordHash: "", active: true, firstLogin: true }
  ];
}

// --- saveLetterSnapshot (insert-only, immutable) ---
async function saveLetterSnapshot({ letterId, scenarioId, letterData } = {}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const payload = {
    letter_id:   letterId,
    scenario_id: scenarioId,
    user_id:     user.id,
    letter_data: letterData,
  };
  const { data, error } = await supabase.from("letter_snapshots").insert(payload);
  return { data, error };
}

// --- fetchLetterSnapshots ---
async function fetchLetterSnapshots(scenarioId) {
  if (!scenarioId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("letter_snapshots")
    .select("id, letter_id, generated_at, letter_data")
    .eq("scenario_id", scenarioId)
    .order("generated_at", { ascending: false })
    .limit(50);
  return { data: data || [], error };
}

// --- savePQSnapshot — hybrid cloud/guest ---
async function savePQSnapshot(snapshot) {
  if (!snapshot || !snapshot.scenarioId) return { data: null, error: new Error("Missing scenarioId") };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const payload = {
        user_id:     user.id,
        scenario_id: snapshot.scenarioId,
        letter_id:   snapshot.letterId,
        snapshot:    snapshot,
      };
      const { data, error } = await supabase.from("pq_letters").insert(payload).select().single();
      return { data, error };
    }
  } catch {}
  // Guest fallback: localStorage
  try {
    const lsKey = "pq_snapshots_" + snapshot.scenarioId;
    const existing = JSON.parse(localStorage.getItem(lsKey) || "[]");
    existing.unshift(snapshot);
    localStorage.setItem(lsKey, JSON.stringify(existing));
    return { data: snapshot, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

// --- fetchPQSnapshots — hybrid cloud/guest ---
async function fetchPQSnapshots(scenarioId) {
  if (!scenarioId) return { data: [], error: null };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("pq_letters")
        .select("id, letter_id, created_at, snapshot")
        .eq("scenario_id", scenarioId)
        .order("created_at", { ascending: false })
        .limit(50);
      return { data: data || [], error };
    }
  } catch {}
  // Guest fallback
  try {
    const lsKey = "pq_snapshots_" + scenarioId;
    const items = JSON.parse(localStorage.getItem(lsKey) || "[]");
    const data = items.map(snap => ({
      id:         snap.letterId,
      letter_id:  snap.letterId,
      created_at: snap.createdAt,
      snapshot:   snap,
    }));
    return { data, error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

// --- sharePQLetter — hybrid cloud/guest ---
async function sharePQLetter({ letterId, scenarioId, realtorName, realtorEmail, note = '' } = {}) {
  if (!letterId || !scenarioId) return { data: null, error: new Error("Missing required fields") };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const payload = {
        user_id:       user.id,
        letter_id:     letterId,
        scenario_id:   scenarioId,
        realtor_name:  realtorName,
        realtor_email: realtorEmail,
        note:          note || '',
      };
      const { data, error } = await supabase.from("pq_letter_shares").insert(payload).select().single();
      return { data, error };
    }
  } catch {}
  // Guest fallback: localStorage
  try {
    const lsKey = "pq_shares_" + scenarioId;
    const existing = JSON.parse(localStorage.getItem(lsKey) || "[]");
    const entry = {
      id: Date.now().toString(),
      letter_id:     letterId,
      scenario_id:   scenarioId,
      sent_at:       new Date().toISOString(),
      realtor_name:  realtorName,
      realtor_email: realtorEmail,
      note:          note || '',
    };
    existing.unshift(entry);
    localStorage.setItem(lsKey, JSON.stringify(existing));
    return { data: entry, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

// --- fetchPQShares — hybrid cloud/guest ---
async function fetchPQShares(scenarioId) {
  if (!scenarioId) return { data: [], error: null };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("pq_letter_shares")
        .select("id, letter_id, sent_at, realtor_name, realtor_email, note")
        .eq("scenario_id", scenarioId)
        .order("sent_at", { ascending: false })
        .limit(50);
      return { data: data || [], error };
    }
  } catch {}
  // Guest fallback
  try {
    const lsKey = "pq_shares_" + scenarioId;
    const items = JSON.parse(localStorage.getItem(lsKey) || "[]");
    return { data: items, error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

// --- fetchContactsFromSupabase ---
async function fetchContactsFromSupabase() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: [], error: authErr || new Error("Not logged in") };

  // Get role from profile — always accurate, no stale sessionStorage issues
  var role = "borrower";
  try {
    var cached = sessionStorage.getItem("mtk_user_role");
    if (cached) { role = cached; }
    else {
      var { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (prof && prof.role) { role = prof.role; try { sessionStorage.setItem("mtk_user_role", role); } catch(e) {} }
    }
  } catch(e) {}

  const ADMIN_ROLES = ["super_admin", "admin", "branch_admin"];
  const isAdmin = ADMIN_ROLES.includes(role);

  let query = supabase.from("contacts").select("*").order("updated_at", { ascending: false });
  // Non-admins see contacts they created OR contacts assigned to them as LO
  if (!isAdmin) query = query.or(`created_by_user_id.eq.${user.id},assigned_lo_id.eq.${user.id}`);

  const { data, error } = await query;
  return { data: data || [], error };
}

// --- saveContactToSupabase ---
async function saveContactToSupabase({
  contactId, prefix, first_name, last_name, nickname,
  company, team_name, photo_url, logo_url, team_logo_url, signature_url,
  contact_type, contact_category, referred_by_contact_id,
  // phone
  phone_cell, phone_work, phone_home, phone_best,
  // email
  email_personal, email_work, email_other, email_best,
  // notes + follow-up
  notes, note_quick,
  fu_date, fu_who, fu_priority,
  // address 1
  address1_street, address1_city, address1_zip, address1_state, address1_type,
  // address 2
  address2_street, address2_city, address2_zip, address2_state, address2_type,
  // client 2
  prefix2, first_name2, nickname2, last_name2, connection_to_contact1,
  phone2, phone2_work, phone2_home, phone2_best,
  email2, email2_work, email2_other, email2_best,
  // assigned LO
  assigned_lo_id,
  // LO / partner profile fields
  lo_title, lo_nmls, lo_license, lo_email_display,
  lo_company_nmls, lo_branch_nmls, lo_website,
  team_lead_contact_id, branch_id,
  // legacy (kept for RLS / other reads)
  status, tags, source,
} = {}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const payload = {
    prefix:     prefix     || null,
    first_name: first_name || "",
    last_name:  last_name  || "",
    nickname:   nickname   || null,
    company:    company    || null,
    team_name:  team_name  || null,
    photo_url:     photo_url     || null,
    logo_url:      logo_url      || null,
    team_logo_url: team_logo_url || null,
    signature_url: signature_url || null,
    contact_type:           contact_type           || "client",
    contact_category:       contact_category       || null,
    referred_by_contact_id: referred_by_contact_id || null,
    // phone
    phone_cell: phone_cell || null,
    phone_work: phone_work || null,
    phone_home: phone_home || null,
    phone_best: phone_best || null,
    // email
    email_personal: email_personal || null,
    email_work:     email_work     || null,
    email_other:    email_other    || null,
    email_best:     email_best     || null,
    // notes + follow-up
    notes:       notes       || "",
    note_quick:  note_quick  || null,
    fu_date:     fu_date     || null,
    fu_who:      fu_who      || null,
    fu_priority: fu_priority || null,
    // address 1
    address1_street: address1_street || null,
    address1_city:   address1_city   || null,
    address1_zip:    address1_zip    || null,
    address1_state:  address1_state  || null,
    address1_type:   address1_type   || "Home",
    // address 2
    address2_street: address2_street || null,
    address2_city:   address2_city   || null,
    address2_zip:    address2_zip    || null,
    address2_state:  address2_state  || null,
    address2_type:   address2_type   || "Home",
    // client 2 — name + relationship
    prefix2:               prefix2               || null,
    first_name2:           first_name2           || null,
    nickname2:             nickname2             || null,
    last_name2:            last_name2            || null,
    connection_to_contact1: connection_to_contact1 || null,
    // client 2 — phone
    phone2:      phone2      || null,
    phone2_work: phone2_work || null,
    phone2_home: phone2_home || null,
    phone2_best: phone2_best || null,
    // client 2 — email
    email2:       email2       || null,
    email2_work:  email2_work  || null,
    email2_other: email2_other || null,
    email2_best:  email2_best  || null,
    // assigned LO
    assigned_lo_id: assigned_lo_id || null,
    // LO / partner profile fields
    lo_title:             lo_title             || null,
    lo_nmls:              lo_nmls              || null,
    lo_license:           lo_license           || null,
    lo_email_display:     lo_email_display     || null,
    lo_company_nmls:      lo_company_nmls      || null,
    lo_branch_nmls:       lo_branch_nmls       || null,
    lo_website:           lo_website           || null,
    team_lead_contact_id: team_lead_contact_id || null,
    branch_id:            branch_id            || null,
    // legacy
    status: status || "active",
    tags:   tags   || [],
    source: source || "",
  };
  if (contactId) {
    const { data, error } = await supabase
      .from("contacts").update(payload).eq("id", contactId).select().single();
    return { data, error };
  } else {
    payload.created_by_user_id = user.id;
    payload.creator_id         = user.id; // default: logged-in admin is the creator
    const { data, error } = await supabase
      .from("contacts").insert(payload).select().single();
    return { data, error };
  }
}

// --- archiveContactInSupabase ---
async function archiveContactInSupabase(contactId) {
  const { error } = await supabase
    .from("contacts").update({ status: "archived" }).eq("id", contactId);
  return { error };
}

// --- deleteContactFromSupabase (admin-only — blocked by RLS for non-admins) ---
async function deleteContactFromSupabase(contactId) {
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);
  return { error };
}

// --- bulkUpdateContactsInSupabase (internal+ — updates multiple contacts in one query) ---
async function bulkUpdateContactsInSupabase(ids, fields) {
  if (!ids || ids.length === 0) return { error: null };
  const { error } = await supabase.from("contacts").update(fields).in("id", ids);
  return { error };
}

// --- bulkDeleteContactsInSupabase (admin-only) ---
async function bulkDeleteContactsInSupabase(ids) {
  if (!ids || ids.length === 0) return { error: null };
  const { error } = await supabase.from("contacts").delete().in("id", ids);
  return { error };
}

// --- patchContactInSupabase (partial update — only the fields passed) ---
async function patchContactInSupabase(contactId, fields) {
  const { data, error } = await supabase
    .from("contacts").update(fields).eq("id", contactId).select();
  return { data: data && data[0], error };
}

// --- fetchContactNotesFromSupabase ---
async function fetchContactNotesFromSupabase(contactId) {
  if (!contactId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("contact_notes")
    .select("id, body, created_at, user_id, profiles(display_name)")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(100);
  return { data: data || [], error };
}

// --- addContactNoteToSupabase ---
async function addContactNoteToSupabase({ contactId, body } = {}) {
  if (!contactId || !body) return { data: null, error: new Error("Missing contactId or body") };
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const { data, error } = await supabase
    .from("contact_notes")
    .insert({ contact_id: contactId, user_id: user.id, body: body.trim() })
    .select().single();
  return { data, error };
}

// --- fetchClaimableScenariosForBorrower ---
// Returns scenarios linked to a contact whose email matches the borrower's
// auth email but not yet owned by the borrower. Requires RLS policies from
// supabase-borrower-claim.sql to be deployed before this returns data.
async function fetchClaimableScenariosForBorrower() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: [], error: authErr || new Error("Not logged in") };
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, name, notes, status, lead_status, loan_purpose, property_address, created_at, updated_at")
    .neq("user_id", user.id)
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

// --- claimScenarioInSupabase ---
// Sets user_id = auth.uid() on a scenario. Blocked by RLS unless
// supabase-borrower-claim.sql UPDATE policy is deployed.
async function claimScenarioInSupabase(scenarioId) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const { data, error } = await supabase
    .from("scenarios")
    .update({ user_id: user.id })
    .eq("id", scenarioId)
    .select()
    .single();
  return { data, error };
}

// --- fetchCoborrowerScenariosForBorrower ---
// Returns scenarios where the authenticated user's email matches the
// co_borrower_contact's email but the user does not own the scenario.
// Requires the RLS policy from supabase-scenario-coborrower-migration.sql.
// Co-borrowers are read-only — there is no claim path.
async function fetchCoborrowerScenariosForBorrower() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: [], error: authErr || new Error("Not logged in") };
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, name, notes, status, lead_status, loan_purpose, property_address, created_at, updated_at, calculation_data, co_borrower_contact_id")
    .not("co_borrower_contact_id", "is", null)
    .neq("user_id", user.id)
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

// --- fetchTemplatesFromSupabase ---
async function fetchTemplatesFromSupabase() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: [], error: authErr || new Error("Not logged in") };
  const { data, error } = await supabase
    .from("scenario_templates")
    .select("*")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

// --- saveTemplateToSupabase ---
async function saveTemplateToSupabase({ templateId, name, description, isGlobal, loanPurpose, calculationData } = {}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const payload = {
    name:             name || "Untitled Template",
    description:      description || "",
    is_global:        isGlobal || false,
    loan_purpose:     loanPurpose || "purchase",
    calculation_data: calculationData || {},
  };
  if (templateId) {
    const { data, error } = await supabase
      .from("scenario_templates").update(payload).eq("id", templateId).select().single();
    return { data, error };
  } else {
    const { data, error } = await supabase
      .from("scenario_templates").insert(payload).select().single();
    return { data, error };
  }
}

// --- deleteTemplateFromSupabase ---
async function deleteTemplateFromSupabase(templateId) {
  const { error } = await supabase.from("scenario_templates").delete().eq("id", templateId);
  return { error };
}

// --- setDefaultTemplateInSupabase ---
async function setDefaultTemplateInSupabase(templateId) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: authErr || new Error("Not logged in") };
  const { error } = await supabase
    .from("profiles")
    .update({ default_template_id: templateId || null })
    .eq("id", user.id);
  return { error };
}

// ── Scenario Sharing ──────────────────────────────────────────────────────

// Share a specific scenario with a partner user (LO → Realtor/Builder)
async function shareScenarioWithPartner({ scenarioId, partnerUserId, permission = "view", note = "" } = {}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const payload = {
    scenario_id:         scenarioId,
    shared_by_user_id:   user.id,
    shared_with_user_id: partnerUserId,
    share_type:          "share",
    permission:          permission,
    note:                note || "",
  };
  const { data, error } = await supabase.from("scenario_shares").insert(payload).select().single();
  return { data, error };
}

// Refer a scenario to the LO team (Realtor/Builder → LO)
// shared_with_user_id is NULL = team-wide referral
async function referScenarioToLO({ scenarioId, note = "" } = {}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const payload = {
    scenario_id:         scenarioId,
    shared_by_user_id:   user.id,
    shared_with_user_id: null,    // null = whole team
    share_type:          "referral",
    permission:          "view",
    note:                note || "",
  };
  const { data, error } = await supabase.from("scenario_shares").insert(payload).select().single();
  return { data, error };
}

// Fetch shares for a specific scenario (to show who it's been shared with)
async function fetchScenarioShares(scenarioId) {
  if (!scenarioId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("scenario_shares")
    .select("id, share_type, permission, note, created_at, shared_by_user_id, shared_with_user_id")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

// Fetch scenarios shared with the current user (for partner dashboards)
async function fetchSharedScenariosFromSupabase() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: [], error: authErr || new Error("Not logged in") };
  // Get share records where this user is the recipient
  const { data: shares, error: sharesErr } = await supabase
    .from("scenario_shares")
    .select("scenario_id, share_type, permission, note, created_at, shared_by_user_id")
    .eq("shared_with_user_id", user.id)
    .order("created_at", { ascending: false });
  if (sharesErr || !shares || shares.length === 0) return { data: [], error: sharesErr };
  const scenarioIds = [...new Set(shares.map(s => s.scenario_id))];
  const { data: rows, error: rowsErr } = await supabase
    .from("scenarios")
    .select("*")
    .in("id", scenarioIds);
  if (rowsErr) return { data: [], error: rowsErr };
  // Enrich with share metadata
  const shareMap = {};
  shares.forEach(s => { if (!shareMap[s.scenario_id]) shareMap[s.scenario_id] = s; });
  // Look up who shared it
  const byIds = [...new Set(shares.map(s => s.shared_by_user_id))];
  const { data: byProfiles } = await supabase
    .from("profiles").select("id, display_name").in("id", byIds);
  const byNameMap = {};
  if (byProfiles) byProfiles.forEach(p => { byNameMap[p.id] = p.display_name; });
  const enriched = (rows || []).map(row => ({
    ...row,
    _share: shareMap[row.id] || null,
    _shared_by_name: byNameMap[(shareMap[row.id] || {}).shared_by_user_id] || "",
  }));
  return { data: enriched, error: null };
}

// Fetch partner profiles (realtors and builders) in this tenant — for the LO share picker
async function fetchPartnerProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, brokerage")
    .in("role", ["realtor", "builder"])
    .order("display_name", { ascending: true });
  return { data: data || [], error };
}

// Share a scenario with a partner who doesn't have an account yet (pending invite)
async function shareScenarioByInvite({ scenarioId, email, role, permission = "view", note = "" } = {}) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: authErr || new Error("Not logged in") };
  const payload = {
    scenario_id:          scenarioId,
    shared_by_user_id:    user.id,
    shared_with_user_id:  null,
    shared_with_email:    email.toLowerCase().trim(),
    invited_role:         role,
    share_type:           "share",
    permission:           permission,
    note:                 note || "",
  };
  const { data, error } = await supabase.from("scenario_shares").insert(payload).select().single();
  return { data, error };
}

// Called after a new partner signs up — fills in shared_with_user_id on any
// pending shares addressed to their email, making them live immediately.
async function resolvePendingSharesForUser(email, userId) {
  if (!supabase || !email || !userId) return;
  try {
    await supabase
      .from("scenario_shares")
      .update({ shared_with_user_id: userId })
      .eq("shared_with_email", email.toLowerCase().trim())
      .is("shared_with_user_id", null);
  } catch (err) {
    console.warn("[resolvePendingSharesForUser]", err);
  }
}

// --- fetchGlobalRateConfig ---
// Reads the single tenant-level interest rate config from Supabase.
// Returns null if none exists yet.
async function fetchGlobalRateConfig() {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase
    .from("global_rate_config")
    .select("market_rate, floor_rate, rate_date, step_costs, updated_at")
    .maybeSingle();
  if (error) console.error("[fetchGlobalRateConfig]", error);
  return { data: data || null, error };
}

// --- saveGlobalRateConfig ---
// Upserts the global interest rate config for the current tenant.
// Only internal users can call this (enforced by RLS).
// tenant_id is fetched via RPC so the upsert conflict detection works correctly.
async function saveGlobalRateConfig({ market, floor, rateDate, stepCosts }) {
  if (!supabase) return { error: new Error("No Supabase") };
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: authErr || new Error("Not logged in") };
  // Must include tenant_id explicitly so Supabase can detect the UNIQUE conflict
  const { data: tenantId, error: tenantErr } = await supabase.rpc("get_my_tenant_id");
  if (tenantErr || !tenantId) return { error: tenantErr || new Error("Could not determine tenant") };
  const { error } = await supabase
    .from("global_rate_config")
    .upsert({
      tenant_id:   tenantId,
      market_rate: market,
      floor_rate:  floor,
      rate_date:   rateDate || "",
      step_costs:  stepCosts || {},
      updated_by:  user.id,
      updated_at:  new Date().toISOString(),
    }, { onConflict: "tenant_id" });
  if (error) console.error("[saveGlobalRateConfig]", error);
  return { error };
}

// --- grantLiveScenarioAccess ---
// Inserts a scenario_shares record with shared_with_email so a borrower can
// read the scenario by email match after logging in, even without contact_id.
// Called by NotifyClientButton when the LO sends a live session link.
async function grantLiveScenarioAccess(scenarioId, clientEmail) {
  if (!supabase || !scenarioId || !clientEmail) return { error: new Error("Missing params") };
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: authErr || new Error("Not logged in") };
  const { data, error } = await supabase
    .from("scenario_shares")
    .insert({
      scenario_id:        scenarioId,
      shared_with_email:  clientEmail.toLowerCase().trim(),
      share_type:         "share",
      permission:         "view",
      note:               "live_session_invite",
    })
    .select("id")
    .single();
  if (error) console.warn("[grantLiveScenarioAccess]", error.message);
  return { data, error };
}

// --- mergeContactsInSupabase ---
// Merges two contacts: updates the keeper with mergedFields, re-points
// all scenarios + notes from the loser to the keeper, then deletes the loser.
async function mergeContactsInSupabase(keepId, deleteId, mergedFields) {
  if (!supabase || !keepId || !deleteId) return { error: new Error("Missing params") };
  // 1. Update the keeper record
  const { error: updateErr } = await supabase
    .from("contacts")
    .update(mergedFields)
    .eq("id", keepId);
  if (updateErr) return { error: updateErr };
  // 2. Re-point scenarios
  await supabase.from("scenarios").update({ contact_id: keepId }).eq("contact_id", deleteId);
  // 3. Re-point contact notes
  await supabase.from("contact_notes").update({ contact_id: keepId }).eq("contact_id", deleteId);
  // 4. Delete the loser
  const { error: delErr } = await supabase.from("contacts").delete().eq("id", deleteId);
  if (delErr) return { error: delErr };
  return { error: null };
}

// --- Expose on window ---
window.CALC_SECTION_NAMES         = CALC_SECTION_NAMES;
window.snapshotCalculatorData     = snapshotCalculatorData;
window.restoreCalculatorData      = restoreCalculatorData;
window.diffCalculatorData         = diffCalculatorData;
window.saveScenarioData           = saveScenarioData;
window.saveScenarioToSupabase     = saveScenarioToSupabase;
window.fetchScenariosFromSupabase = fetchScenariosFromSupabase;
window.deleteScenarioFromSupabase = deleteScenarioFromSupabase;
window.writeAuditLog              = writeAuditLog;
window.fetchAuditLog              = fetchAuditLog;
window.hashPassword               = hashPassword;
window.getDefaultRoster           = getDefaultRoster;
window.saveLetterSnapshot         = saveLetterSnapshot;
window.fetchLetterSnapshots       = fetchLetterSnapshots;
window.savePQSnapshot             = savePQSnapshot;
window.fetchPQSnapshots           = fetchPQSnapshots;
window.sharePQLetter              = sharePQLetter;
window.fetchPQShares              = fetchPQShares;
window.fetchClaimableScenariosForBorrower    = fetchClaimableScenariosForBorrower;
window.claimScenarioInSupabase               = claimScenarioInSupabase;
window.fetchCoborrowerScenariosForBorrower   = fetchCoborrowerScenariosForBorrower;
window.fetchContactsFromSupabase     = fetchContactsFromSupabase;
window.saveContactToSupabase         = saveContactToSupabase;
window.archiveContactInSupabase      = archiveContactInSupabase;
window.deleteContactFromSupabase          = deleteContactFromSupabase;
window.bulkUpdateContactsInSupabase       = bulkUpdateContactsInSupabase;
window.bulkDeleteContactsInSupabase       = bulkDeleteContactsInSupabase;
window.mergeContactsInSupabase            = mergeContactsInSupabase;
window.patchContactInSupabase             = patchContactInSupabase;
window.fetchContactNotesFromSupabase = fetchContactNotesFromSupabase;
window.addContactNoteToSupabase      = addContactNoteToSupabase;
window.fetchTemplatesFromSupabase    = fetchTemplatesFromSupabase;
window.saveTemplateToSupabase        = saveTemplateToSupabase;
window.deleteTemplateFromSupabase    = deleteTemplateFromSupabase;
window.setDefaultTemplateInSupabase  = setDefaultTemplateInSupabase;
window.shareScenarioWithPartner         = shareScenarioWithPartner;
window.shareScenarioByInvite            = shareScenarioByInvite;
window.resolvePendingSharesForUser      = resolvePendingSharesForUser;
window.referScenarioToLO               = referScenarioToLO;
window.fetchScenarioShares             = fetchScenarioShares;
window.fetchSharedScenariosFromSupabase = fetchSharedScenariosFromSupabase;
window.fetchPartnerProfiles            = fetchPartnerProfiles;
window.fetchGlobalRateConfig           = fetchGlobalRateConfig;
window.saveGlobalRateConfig            = saveGlobalRateConfig;
window.grantLiveScenarioAccess         = grantLiveScenarioAccess;

// ── Partnerships ──────────────────────────────────────────────────────────────

// LO invites a Realtor/Builder to partner (from their contact card)
async function invitePartner({ partnerContactId, partnerEmail }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not logged in") };
  // Prevent duplicate invites
  const { data: existing } = await supabase.from("partnerships")
    .select("id, status")
    .eq("lo_user_id", user.id)
    .eq("partner_email", partnerEmail.toLowerCase())
    .maybeSingle();
  if (existing && existing.status !== "declined")
    return { data: existing, error: null }; // already invited
  // Look up partner's user_id if they have an account
  const { data: partnerProfile } = await supabase.from("profiles")
    .select("id").eq("email", partnerEmail.toLowerCase()).maybeSingle();
  const payload = {
    lo_user_id:         user.id,
    partner_contact_id: partnerContactId || null,
    partner_email:      partnerEmail.toLowerCase(),
    partner_user_id:    partnerProfile ? partnerProfile.id : null,
    status:             "pending",
    initiated_by:       user.id,
  };
  const { data, error } = await supabase.from("partnerships").insert(payload).select().single();
  return { data, error };
}

// Realtor/Builder accepts or declines an invite
async function respondToPartnership({ partnershipId, accept }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error("Not logged in") };
  // Stamp partner_user_id when accepting so LO can see who confirmed
  const updates = { status: accept ? "active" : "declined", updated_at: new Date().toISOString() };
  if (accept) updates.partner_user_id = user.id;
  const { data, error } = await supabase.from("partnerships")
    .update(updates).eq("id", partnershipId).select().single();
  return { data, error };
}

// Fetch all partnerships for the current user (LO sees theirs; partner sees theirs)
async function fetchMyPartnerships() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  const email = user.email ? user.email.toLowerCase() : "";
  // Fetch where I'm the LO
  const { data: asLO } = await supabase.from("partnerships")
    .select("*").eq("lo_user_id", user.id).neq("status", "declined");
  // Fetch where I'm the partner
  const { data: asPartner } = await supabase.from("partnerships")
    .select("*").or(`partner_user_id.eq.${user.id},partner_email.eq.${email}`)
    .neq("status", "declined");
  return { data: [...(asLO || []), ...(asPartner || [])], error: null };
}

// Fetch pending invites for the current Realtor/Builder
async function fetchPendingPartnershipInvites() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: null };
  const email = user.email ? user.email.toLowerCase() : "";
  const { data, error } = await supabase.from("partnerships")
    .select("*, lo:lo_user_id(display_name, email, nmls)")
    .or(`partner_user_id.eq.${user.id},partner_email.eq.${email}`)
    .eq("status", "pending");
  return { data: data || [], error };
}

// Remove a partnership (either side can unlink)
async function removePartnership(partnershipId) {
  const { error } = await supabase.from("partnerships").delete().eq("id", partnershipId);
  return { error };
}

window.invitePartner                  = invitePartner;
window.respondToPartnership           = respondToPartnership;
window.fetchMyPartnerships            = fetchMyPartnerships;
window.fetchPendingPartnershipInvites = fetchPendingPartnershipInvites;
window.removePartnership              = removePartnership;

// ── Custom Warning Rules ─────────────────────────────────────────────────────

async function fetchWarningRules() {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase
    .from("warning_rules")
    .select("*")
    .order("created_at", { ascending: true });
  return { data: data || [], error };
}

async function saveWarningRule(rule) {
  if (!supabase) return { data: null, error: "No Supabase client" };
  const payload = {
    label:      rule.label,
    message:    rule.message,
    severity:   rule.severity || "warning",
    conditions: rule.conditions || [],
    enabled:    rule.enabled !== false,
  };
  if (rule.id) {
    const { data, error } = await supabase
      .from("warning_rules")
      .update(payload)
      .eq("id", rule.id)
      .select()
      .single();
    return { data, error };
  } else {
    const { data, error } = await supabase
      .from("warning_rules")
      .insert(payload)
      .select()
      .single();
    return { data, error };
  }
}

async function deleteWarningRule(id) {
  if (!supabase) return { error: "No Supabase client" };
  const { error } = await supabase.from("warning_rules").delete().eq("id", id);
  return { error };
}

window.fetchWarningRules  = fetchWarningRules;
window.saveWarningRule    = saveWarningRule;
window.deleteWarningRule  = deleteWarningRule;

// --- logUserSession ---
// Records a login event to user_sessions (Supabase).
// Deduplicates per user per calendar day via localStorage so page refreshes
// don't create duplicate rows. Safe to call on every login/session-restore.
async function logUserSession(user) {
  if (!supabase || !user || !user.id || !user.supabaseUser) return;
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const dedupeKey = "mtk_last_session_log_" + user.id + "_" + today;
  if (localStorage.getItem(dedupeKey)) return; // already logged today
  try {
    const { error } = await supabase.from("user_sessions").insert({
      user_id:      user.id,
      email:        user.email        || "",
      display_name: user.name         || "",
      role:         user.role         || "borrower",
    });
    if (!error) {
      localStorage.setItem(dedupeKey, "1");
      // Clean up yesterday's dedup key to prevent localStorage bloat
      try {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        localStorage.removeItem("mtk_last_session_log_" + user.id + "_" + yesterday);
      } catch(e) {}
    }
  } catch(e) {
    console.warn("[logUserSession]", e);
  }
}

// --- fetchUserSessions ---
// Returns session rows for the last N days (default 15), admin-only via RLS.
async function fetchUserSessions(days) {
  if (!supabase) return { data: [], error: null };
  days = days || 15;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("user_sessions")
    .select("user_id, email, display_name, role, logged_in_at")
    .gte("logged_in_at", since)
    .order("logged_in_at", { ascending: false });
  return { data: data || [], error };
}

window.logUserSession    = logUserSession;
window.fetchUserSessions = fetchUserSessions;
