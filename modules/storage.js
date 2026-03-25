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
  "sns_price","sns_mort1","sns_comm",
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
  } else {
    // New / blank scenario — preserve uid if present; blank all financial fields
    if (data && data.uid) {
      try { localStorage.setItem("mtk_uid", JSON.stringify(data.uid)); } catch {}
    }
    BLANK_SCENARIO_FIELDS.forEach(function(k) {
      try { localStorage.setItem("mtk_" + k, JSON.stringify("")); } catch {}
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
  scenarioId, uid, name, notes, status, calculationData, contact_id,
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
  if (contact_id       !== undefined) payload.contact_id       = contact_id;
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

// --- fetchScenariosFromSupabase (original line 264) ---
async function fetchScenariosFromSupabase() {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: [], error: authErr || new Error("Not logged in") };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = profile && profile.role;
  const INTERNAL_ROLES = ["super_admin", "admin", "branch_admin", "internal"];
  const canSeeAll = INTERNAL_ROLES.includes(role);
  // RLS handles the actual row filtering (own + team scenarios for internal,
  // all tenant scenarios for admin/super_admin/branch_admin).
  // The user_id filter below is only a safeguard for non-internal roles (borrowers, realtors).
  let query = supabase.from("scenarios").select("*").order("updated_at", { ascending: false });
  if (!canSeeAll) { query = query.eq("user_id", user.id); }
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
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("updated_at", { ascending: false });
  return { data: data || [], error };
}

// --- saveContactToSupabase ---
async function saveContactToSupabase({
  contactId, prefix, first_name, last_name, nickname,
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
    .select("id, body, created_at, user_id")
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
window.fetchClaimableScenariosForBorrower = fetchClaimableScenariosForBorrower;
window.claimScenarioInSupabase            = claimScenarioInSupabase;
window.fetchContactsFromSupabase     = fetchContactsFromSupabase;
window.saveContactToSupabase         = saveContactToSupabase;
window.archiveContactInSupabase      = archiveContactInSupabase;
window.deleteContactFromSupabase     = deleteContactFromSupabase;
window.patchContactInSupabase        = patchContactInSupabase;
window.fetchContactNotesFromSupabase = fetchContactNotesFromSupabase;
window.addContactNoteToSupabase      = addContactNoteToSupabase;
window.fetchTemplatesFromSupabase    = fetchTemplatesFromSupabase;
window.saveTemplateToSupabase        = saveTemplateToSupabase;
window.deleteTemplateFromSupabase    = deleteTemplateFromSupabase;
window.setDefaultTemplateInSupabase  = setDefaultTemplateInSupabase;
