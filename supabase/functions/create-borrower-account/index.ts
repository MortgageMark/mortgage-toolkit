// supabase/functions/create-borrower-account/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Decode a JWT payload without verifying the signature.
// Safe here because Supabase's gateway already validates the JWT before
// the function runs (Verify JWT is enabled by default).
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const raw = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    // base64url strips padding — add it back so atob() doesn't throw
    const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("create-borrower-account: request received");

  try {
    // ── 1. Check env vars ─────────────────────────────────────────────────────
    console.log("SUPABASE_URL present:", !!SUPABASE_URL);
    console.log("SUPABASE_SERVICE present:", !!SUPABASE_SERVICE);
    if (!SUPABASE_URL || !SUPABASE_SERVICE) {
      console.error("Missing env vars");
      return json({ error: "Server misconfiguration — env vars missing" });
    }

    // ── 2. Extract caller user ID from the JWT ─────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    console.log("Auth header present:", !!authHeader);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const claims = decodeJwtPayload(token);
    const callerId = claims.sub as string | undefined;
    console.log("Caller ID from JWT:", callerId ?? "none");
    if (!callerId) {
      return json({ error: "Unauthorized — could not parse JWT" });
    }

    // ── 3. Look up caller's profile (role + tenant) ───────────────────────────
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { persistSession: false },
    });

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role, tenant_id")
      .eq("id", callerId)
      .single();

    console.log("Caller profile:", callerProfile?.role ?? "none", "error:", profileErr?.message ?? "none");
    if (!callerProfile || !["admin", "internal"].includes(callerProfile.role)) {
      return json({ error: "Forbidden — LOs and admins only" });
    }

    // ── 4. Parse + validate body ───────────────────────────────────────────────
    const body = await req.json();
    const { contactId, email, displayName } = body;
    console.log("Body — contactId:", contactId, "email:", email);
    if (!contactId || !email) {
      return json({ error: "Missing required fields: contactId, email" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── 5. Create the Auth user ────────────────────────────────────────────────
    // Generate a random 16-char password — user will change it on first login
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let tmpPwd = "";
    for (let i = 0; i < 16; i++) tmpPwd += chars[Math.floor(Math.random() * chars.length)];

    console.log("Calling auth.admin.createUser for:", cleanEmail);
    const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
      email:         cleanEmail,
      password:      tmpPwd,
      email_confirm: true,
      user_metadata: {
        display_name: (displayName || cleanEmail).trim(),
        role:         "borrower",
      },
    });

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      console.log("createUser error:", createErr.message);
      if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
        return json({ alreadyExists: true });
      }
      // Return 200 with error so the frontend can display the actual message
      return json({ error: createErr.message });
    }

    const newUserId = createData.user.id;
    console.log("User created:", newUserId);

    // ── 6. Stamp must_change_password + tenant_id on their profile ─────────────
    const { error: profUpdateErr } = await adminClient.from("profiles").update({
      must_change_password: true,
      tenant_id: callerProfile.tenant_id,
    }).eq("id", newUserId);
    if (profUpdateErr) console.log("Profile update warning:", profUpdateErr.message);

    // ── 7. Link the auth user back to the contact record ──────────────────────
    const { error: ctUpdateErr } = await adminClient.from("contacts").update({
      auth_user_id: newUserId,
    }).eq("id", contactId);
    if (ctUpdateErr) console.log("Contact update warning:", ctUpdateErr.message);

    console.log("create-borrower-account: success");
    return json({ success: true, userId: newUserId, alreadyExists: false });

  } catch (err) {
    console.error("create-borrower-account unexpected error:", err);
    return json({ error: String(err) });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
