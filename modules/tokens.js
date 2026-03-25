// modules/tokens.js
// Magic link / tokenized deep link system for Mortgage Mark.
// Handles token creation, deduplication, URL building, and invalidation.
// Token resolution (link click) is handled server-side by the Edge Function.
//
// Globals available:
//   window._supabaseClient  — Supabase client (from mortgage-toolkit.html)
//   window.generateToken    — exported below

const supabase = window._supabaseClient;

// ── Destination routing map ───────────────────────────────────────────────────
// Maps destination key → tab name in the toolkit for display purposes
const TOKEN_DESTINATIONS = {
  fee_sheet:         "Fee Sheet",
  loan_comparison:   "Loan Comparison",
  refi_analysis:     "Refinance Analysis",
  full_scenario:     "Full Scenario",
  payment_breakdown: "Payment Breakdown",
};
window.TOKEN_DESTINATIONS = TOKEN_DESTINATIONS;

// ── generateToken ─────────────────────────────────────────────────────────────
// Generates a cryptographically secure, URL-safe token string using the
// Web Crypto API (available in all modern browsers — no Node.js required).
// 48 bytes → 64 base64url characters → effectively impossible to brute-force.
function generateToken() {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  // Convert to base64, then make URL-safe (replace +/ with -_, strip padding =)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
window.generateToken = generateToken;

// ── buildTokenUrl ─────────────────────────────────────────────────────────────
// Constructs the full shareable URL for a given token string.
// Uses the current origin in development; override with SITE_BASE_URL for prod.
function buildTokenUrl(token) {
  const base = window.SITE_BASE_URL || window.location.origin;
  return `${base}/view.html?token=${encodeURIComponent(token)}`;
}
window.buildTokenUrl = buildTokenUrl;

// ── createScenarioToken ───────────────────────────────────────────────────────
// Creates a new token record in scenario_tokens, or returns an existing active
// token if one already exists for the same (clientId, scenarioId, destination).
// This prevents duplicate tokens for the same scenario+destination+client.
//
// Params:
//   clientId       — Supabase auth UUID of the client (nullable if not yet registered)
//   clientEmail    — client email address (required, used for Resend)
//   clientPhone    — client phone (optional, for future SMS)
//   clientName     — client display name (used in email personalization)
//   contactId      — contacts table UUID (nullable)
//   scenarioId     — scenarios table UUID (the scenario being shared)
//   destination    — one of TOKEN_DESTINATIONS keys
//   createdByName  — LO's display name (stored for email personalization)
//
// Returns: { data: tokenRecord, error, isExisting: bool }
async function createScenarioToken({
  clientId,
  clientEmail,
  clientPhone,
  clientName,
  contactId,
  scenarioId,
  destination,
  createdByName,
} = {}) {
  if (!clientEmail) return { data: null, error: new Error("clientEmail is required") };
  if (!clientName)  return { data: null, error: new Error("clientName is required") };
  if (!scenarioId)  return { data: null, error: new Error("scenarioId is required") };
  if (!destination || !TOKEN_DESTINATIONS[destination]) {
    return { data: null, error: new Error(`Invalid destination: ${destination}`) };
  }

  // ── Deduplication check ──────────────────────────────────────────────────
  // If an active, non-expired token already exists for this exact combination,
  // return it instead of creating a duplicate.
  let query = supabase
    .from("scenario_tokens")
    .select("*")
    .eq("scenario_id", scenarioId)
    .eq("destination", destination)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString());

  if (clientId) {
    query = query.eq("client_id", clientId);
  } else {
    query = query.eq("client_email", clientEmail.toLowerCase().trim());
  }

  const { data: existing, error: fetchErr } = await query.maybeSingle();
  if (fetchErr) return { data: null, error: fetchErr };

  if (existing) {
    return { data: existing, error: null, isExisting: true };
  }

  // ── Insert new token ─────────────────────────────────────────────────────
  const token = generateToken();
  const payload = {
    token,
    client_email:   clientEmail.toLowerCase().trim(),
    client_name:    clientName,
    scenario_id:    scenarioId,
    destination,
    created_by_name: createdByName || "Your Loan Officer",
    // tenant_id and created_by_id default via get_my_tenant_id() / auth.uid()
  };

  // Optional fields — only include if provided
  if (clientId)    payload.client_id    = clientId;
  if (clientPhone) payload.client_phone = clientPhone;
  if (contactId)   payload.contact_id   = contactId;

  const { data, error } = await supabase
    .from("scenario_tokens")
    .insert(payload)
    .select()
    .single();

  return { data, error, isExisting: false };
}
window.createScenarioToken = createScenarioToken;

// ── invalidateToken ───────────────────────────────────────────────────────────
// Deactivates a token so the link stops working immediately.
// Only the LO who created the token (or an admin in the same tenant) can invalidate it.
//
// Returns: { data: updatedRecord, error }
async function invalidateToken(token) {
  if (!token) return { data: null, error: new Error("token is required") };

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: new Error("Not logged in") };

  // RLS enforces tenant isolation — only internal/admin can update tokens in their tenant.
  // We also verify created_by_id on the client side for a cleaner error message.
  const { data: existing, error: fetchErr } = await supabase
    .from("scenario_tokens")
    .select("id, created_by_id, is_active")
    .eq("token", token)
    .single();

  if (fetchErr) return { data: null, error: fetchErr };
  if (!existing) return { data: null, error: new Error("Token not found") };

  const { data, error } = await supabase
    .from("scenario_tokens")
    .update({ is_active: false })
    .eq("token", token)
    .select()
    .single();

  return { data, error };
}
window.invalidateToken = invalidateToken;

// ── getTokensForScenario ──────────────────────────────────────────────────────
// Fetches all tokens for a given scenario (for the LO's "Manage Links" view).
// Adds a computed `isValid` field: active + not expired.
//
// Options:
//   includeExpired — if true, includes expired/inactive tokens (default: false)
//
// Returns: { data: tokenRecords[], error }
async function getTokensForScenario(scenarioId, { includeExpired = false } = {}) {
  if (!scenarioId) return { data: [], error: new Error("scenarioId is required") };

  let query = supabase
    .from("scenario_tokens")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: false });

  if (!includeExpired) {
    query = query.eq("is_active", true).gt("expires_at", new Date().toISOString());
  }

  const { data, error } = await query;

  if (error) return { data: [], error };

  const now = new Date();
  const records = (data || []).map(t => ({
    ...t,
    isValid:  t.is_active && new Date(t.expires_at) > now,
    shareUrl: buildTokenUrl(t.token),
  }));

  return { data: records, error: null };
}
window.getTokensForScenario = getTokensForScenario;

// ── sendScenarioLink ──────────────────────────────────────────────────────────
// High-level convenience function used by the NotifyClient button.
// 1. Creates (or retrieves existing) token via createScenarioToken()
// 2. Calls the Supabase Edge Function to send the email via Resend
// 3. Returns { url, token, isExisting, error }
//
// The Edge Function URL is constructed from the Supabase project URL.
async function sendScenarioLink({
  clientId,
  clientEmail,
  clientPhone,
  clientName,
  contactId,
  scenarioId,
  scenarioName,
  destination,
  createdByName,
} = {}) {
  // Step 1: get or create the token
  const { data: tokenRecord, error: tokenErr, isExisting } = await createScenarioToken({
    clientId, clientEmail, clientPhone, clientName,
    contactId, scenarioId, destination, createdByName,
  });

  if (tokenErr || !tokenRecord) {
    return { url: null, token: null, isExisting: false, error: tokenErr || new Error("Token creation failed") };
  }

  const url = buildTokenUrl(tokenRecord.token);

  // Step 2: call the Edge Function to send the email
  // The Edge Function has the Resend API key stored as a secret — never in the browser.
  const SUPABASE_URL = window._supabaseClient.supabaseUrl;
  const EDGE_FN_URL  = `${SUPABASE_URL}/functions/v1/send-scenario-link`;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        clientEmail,
        clientName,
        scenarioName: scenarioName || "Your Mortgage Scenario",
        destination,
        destinationLabel: TOKEN_DESTINATIONS[destination] || destination,
        tokenUrl: url,
        createdByName,
        expiresAt: tokenRecord.expires_at,
      }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      console.warn("send-scenario-link Edge Function error:", body);
      // Token was created successfully even if email fails — return partial success
      return { url, token: tokenRecord.token, isExisting, error: new Error("Email send failed — link was still created.") };
    }
  } catch (fetchErr) {
    console.warn("Edge Function fetch error:", fetchErr);
    return { url, token: tokenRecord.token, isExisting, error: new Error("Email send failed — link was still created.") };
  }

  return { url, token: tokenRecord.token, isExisting, error: null };
}
window.sendScenarioLink = sendScenarioLink;
