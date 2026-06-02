// supabase/functions/resolve-token/index.ts
// Supabase Edge Function — resolves a magic link token.
// Called by view.html when a client clicks their scenario link.
//
// Uses the service role key (bypasses RLS) so tokens are never
// exposed through the anon key. Rate limiting is enforced here.
//
// Required Supabase secrets:
//   SUPABASE_URL              — set automatically
//   SUPABASE_SERVICE_ROLE_KEY — set automatically
//
// Deploy: supabase functions deploy resolve-token

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Simple in-memory rate limiter ────────────────────────────────────────────
// 20 requests per minute per IP. Resets on function cold start.
// For production scale, replace with Upstash Redis.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT      = 20;
const RATE_WINDOW_MS  = 60_000;

function checkRateLimit(ip: string): boolean {
  const now  = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT) return false; // blocked

  entry.count++;
  return true; // allowed
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return json({
      error: "too_many_requests",
      message: "Too many requests. Please wait a moment and try again.",
    }, 429);
  }

  try {
    // ── Parse token from query string or body ──────────────────────────────
    const url   = new URL(req.url);
    let token   = url.searchParams.get("token");

    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }

    if (!token || typeof token !== "string" || token.length < 10) {
      return json({ error: "invalid_token", message: "Token is missing or malformed." }, 400);
    }

    // ── Look up token with service role (bypasses RLS) ─────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { persistSession: false },
    });

    const { data: tokenRecord, error: lookupErr } = await supabase
      .from("scenario_tokens")
      .select(`
        id, token, client_id, client_email, client_name,
        scenario_id, destination, tenant_id,
        created_by_id, created_by_name,
        created_at, expires_at, is_active, access_count
      `)
      .eq("token", token)
      .single();

    if (lookupErr || !tokenRecord) {
      return json({ error: "not_found", message: "This link is not valid." }, 404);
    }

    // ── Validate token ─────────────────────────────────────────────────────
    const now       = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);

    if (!tokenRecord.is_active) {
      return json({ error: "deactivated", message: "This link has been deactivated." }, 410);
    }

    if (expiresAt < now) {
      return json({ error: "expired", message: "This link has expired." }, 410);
    }

    // ── Fetch the scenario data ────────────────────────────────────────────
    const { data: scenario, error: scenarioErr } = await supabase
      .from("scenarios")
      .select("id, name, notes, calculation_data, loan_purpose, property_address")
      .eq("id", tokenRecord.scenario_id)
      .single();

    if (scenarioErr || !scenario) {
      return json({ error: "scenario_not_found", message: "The scenario could not be found." }, 404);
    }

    // ── Track access (fire and forget — don't await) ───────────────────────
    supabase
      .from("scenario_tokens")
      .update({
        last_accessed_at: now.toISOString(),
        access_count:     tokenRecord.access_count + 1,
      })
      .eq("id", tokenRecord.id)
      .then(() => {}) // intentionally not awaited
      .catch(() => {}); // silent — don't fail the response if tracking fails

    // ── Return token + scenario data ───────────────────────────────────────
    return json({
      success:     true,
      destination: tokenRecord.destination,
      scenarioId:  tokenRecord.scenario_id,
      clientName:  tokenRecord.client_name,
      loName:      tokenRecord.created_by_name,
      expiresAt:   tokenRecord.expires_at,
      scenario: {
        id:               scenario.id,
        name:             scenario.name,
        notes:            scenario.notes,
        loan_purpose:     scenario.loan_purpose,
        property_address: scenario.property_address,
        calculation_data: scenario.calculation_data,
      },
    });

  } catch (err) {
    console.error("resolve-token error:", err);
    return json({ error: "server_error", message: "Something went wrong." }, 500);
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
