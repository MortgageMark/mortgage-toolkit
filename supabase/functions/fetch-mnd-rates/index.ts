// supabase/functions/fetch-mnd-rates/index.ts
// Fetches today's benchmark rates from MortgageNewsDaily.com and returns
// them as JSON. Called from the InterestRates tab "Sync from MND" button.
// Deploy: supabase functions deploy fetch-mnd-rates

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const res  = await fetch("https://www.mortgagenewsdaily.com", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MortgageMark/1.0)" },
    });
    const html = await res.text();

    function extract(label: string): string | null {
      // Matches:  <td>30 Yr. Fixed</td>  <td>6.65%</td>
      const re = new RegExp(
        `<td>${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/td>\\s*<td>([0-9.]+)%<\\/td>`,
        "i"
      );
      return html.match(re)?.[1] ?? null;
    }

    const rates = {
      fixed30: extract("30 Yr. Fixed"),
      fixed15: extract("15 Yr. Fixed"),
      fha30:   extract("30 Yr. FHA"),
      va30:    extract("30 Yr. VA"),
      source:  "MortgageNewsDaily.com",
      fetchedAt: new Date().toISOString(),
    };

    // At least one rate must parse — otherwise the page layout may have changed
    if (!rates.fixed30 && !rates.fha30 && !rates.va30) {
      return new Response(
        JSON.stringify({ error: "Could not parse rates — MND page layout may have changed." }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(rates),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
