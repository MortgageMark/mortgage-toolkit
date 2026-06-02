// supabase/functions/send-scenario-link/index.ts
// Supabase Edge Function — sends a scenario magic link email via Resend.
// Triggered by the NotifyClient button in the toolkit (via tokens.js → sendScenarioLink).
//
// Required Supabase secrets (set via Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY     — from resend.com API Keys
//
// Deploy: supabase functions deploy send-scenario-link

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM_ADDRESS = "MortgageMark@mortgagemark.com";
const FROM_NAME    = "Mortgage Mark";

// ── Destination display labels ────────────────────────────────────────────────
const DESTINATION_LABELS: Record<string, string> = {
  fee_sheet:         "Fee Sheet",
  loan_comparison:   "Loan Comparison",
  refi_analysis:     "Refinance Analysis",
  full_scenario:     "Full Scenario",
  payment_breakdown: "Payment Breakdown",
};

// ── CORS headers (allow the toolkit origin) ───────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the requesting LO ──────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Use service role client to verify the JWT without RLS interference
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Verify the user is internal or admin (not a borrower calling this directly)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, tenant_id, display_name")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "internal"].includes(profile.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    // ── 2. Parse + validate request body ──────────────────────────────────
    const body = await req.json();
    const {
      clientEmail,
      clientName,
      scenarioName,
      destination,
      destinationLabel,
      tokenUrl,
      createdByName,
      expiresAt,
    } = body;

    if (!clientEmail || !clientName || !tokenUrl || !destination) {
      return json({ error: "Missing required fields: clientEmail, clientName, tokenUrl, destination" }, 400);
    }

    if (!DESTINATION_LABELS[destination]) {
      return json({ error: `Invalid destination: ${destination}` }, 400);
    }

    const label        = destinationLabel || DESTINATION_LABELS[destination];
    const loName       = createdByName || profile.display_name || "Your Loan Officer";
    const expiryDate   = expiresAt
      ? new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "30 days from now";

    // ── 3. Build the email HTML ────────────────────────────────────────────
    const emailHtml = buildEmailHtml({
      clientName,
      loName,
      scenarioName: scenarioName || "Your Mortgage Scenario",
      label,
      tokenUrl,
      expiryDate,
    });

    // ── 4. Send via Resend ─────────────────────────────────────────────────
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    `${FROM_NAME} <${FROM_ADDRESS}>`,
        to:      [clientEmail],
        subject: `${loName} shared your ${label} — view it here`,
        html:    emailHtml,
      }),
    });

    if (!resendResp.ok) {
      const resendErr = await resendResp.json().catch(() => ({}));
      console.error("Resend error:", resendErr);
      return json({ error: "Email send failed", detail: resendErr }, 500);
    }

    const resendData = await resendResp.json();
    return json({ success: true, emailId: resendData.id });

  } catch (err) {
    console.error("send-scenario-link error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildEmailHtml({
  clientName,
  loName,
  scenarioName,
  label,
  tokenUrl,
  expiryDate,
}: {
  clientName:   string;
  loName:       string;
  scenarioName: string;
  label:        string;
  tokenUrl:     string;
  expiryDate:   string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${loName} shared your ${label}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0C4160;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;
                         letter-spacing:-0.5px;">Mortgage Mark</h1>
              <p style="margin:6px 0 0;color:#48A0CE;font-size:14px;">
                Powered by CMG Home Loans
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;color:#0C4160;font-size:16px;font-weight:600;">
                Hi ${clientName},
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                ${loName} has prepared your <strong>${label}</strong> for
                <em>${scenarioName}</em> and would like to share it with you.
              </p>
              <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.6;">
                Click the button below to view your personalized scenario — no login or
                password required. The link will work on any device.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#48A0CE;border-radius:8px;text-align:center;">
                    <a href="${tokenUrl}"
                       style="display:inline-block;padding:14px 36px;color:#ffffff;
                              font-size:15px;font-weight:700;text-decoration:none;
                              letter-spacing:0.2px;">
                      View My ${label} →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <p style="margin:0 0 8px;color:#6B7280;font-size:13px;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 32px;word-break:break-all;">
                <a href="${tokenUrl}"
                   style="color:#48A0CE;font-size:13px;text-decoration:none;">
                  ${tokenUrl}
                </a>
              </p>

              <!-- Expiry notice -->
              <table cellpadding="0" cellspacing="0" width="100%"
                     style="background:#E0E8E8;border-radius:8px;margin-bottom:8px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#0C4160;font-size:13px;line-height:1.5;">
                      🔒 This link is secure and unique to you. It expires on
                      <strong>${expiryDate}</strong>. You can open it multiple
                      times or share it with a co-borrower.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f4f7f8;padding:24px 40px;border-top:1px solid #e5e7eb;
                       text-align:center;">
              <p style="margin:0;color:#6B7280;font-size:12px;line-height:1.6;">
                ${loName} | Mortgage Mark<br />
                Mark Pfeiffer | NMLS #729612 | CMG Home Loans | NMLS #1820<br />
                Equal Housing Lender
              </p>
              <p style="margin:12px 0 0;color:#9CA3AF;font-size:11px;">
                This email was sent because a loan officer shared a scenario with you.
                If you did not request this, please disregard.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
