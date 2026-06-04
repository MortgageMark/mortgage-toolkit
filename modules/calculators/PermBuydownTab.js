// modules/calculators/PermBuydownTab.js
// Shows what it costs a builder to permanently buy down a buyer's interest rate.
// Reads loan data from Payment Calculator localStorage keys.

const { useMemo, useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const COLORS_DARK     = window.COLORS_DARK;
const font            = window.font;

function PermBuydownTab({ isInternal }) {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;

  const navy   = c.navy   || "#1B3A5C";
  const border = c.border || "#D1D9E6";

  // Read-only from Payment Calculator
  const [pcRate]       = useLocalStorage("pc_rate",      "");
  const [pcLA]         = useLocalStorage("pc_la",        "");
  const [pcTerm]       = useLocalStorage("pc_term",      "30");
  const [pcHP]         = useLocalStorage("pc_hp",        "");
  const [pcDP]         = useLocalStorage("pc_dp",        "");
  const [pcProg]       = useLocalStorage("pc_prog",      "conventional");
  const [pcLoanType]   = useLocalStorage("pc_lt",        "fixed");
  const [pcArmYears]   = useLocalStorage("pc_armfy",     "5");

  // Interest Rates tab — use program-specific market rate as the current rate
  const [irConvRate]  = useLocalStorage("ir_market",       "");
  const [irFhaRate]   = useLocalStorage("ir_fha_market",   "");
  const [irVaRate]    = useLocalStorage("ir_va_market",    "");
  const [irUsdaRate]  = useLocalStorage("ir_usda_market",  "");
  const [irNonqmRate] = useLocalStorage("ir_nonqm_market", "");
  const prog = (pcProg || "conventional").toLowerCase();
  const irRate = prog === "fha"   ? irFhaRate
               : prog === "usda"  ? (irUsdaRate  || irFhaRate)
               : prog === "va"    ? irVaRate
               : prog === "nonqm" ? (irNonqmRate || irConvRate)
               : irConvRate; // conventional, jumbo, everything else
  // Use IR tab rate when available; fall back to Payment Calculator rate
  const baseIRRate  = (irRate && parseFloat(irRate) > 0) ? irRate : pcRate;

  // ── LLPA adjustment (conventional only) ─────────────────────────────────
  const [pcFico]   = useLocalStorage("pc_fico",   "740");
  const [pcHP]     = useLocalStorage("pc_hp",     "0");
  const [pcPurp]   = useLocalStorage("pc_purpose","purchase");
  const [pcOcc]    = useLocalStorage("pc_occ",    "primary");
  const [irSteps]  = useLocalStorage("ir_steps",  {});

  const llpaAdjustedRate = React.useMemo(function() {
    var isConv = prog === "conventional" || prog === "homeready" || prog === "homeposs";
    if (!isConv || !window.lookupLLPA) return parseFloat(baseIRRate) || 0;
    var fico   = parseInt(pcFico) || 740;
    var la_    = parseFloat(pcLA)  || 0;
    var hp_    = parseFloat(pcHP)  || 0;
    var ltv    = (hp_ > 0 && la_ > 0) ? Math.round(la_ / hp_ * 1000) / 10 : 75;
    var txType = pcPurp === "purchase" ? "purchase"
               : pcPurp === "cashout"  ? "cashout"
               : "lcor";
    // LLPAs don't apply to non-primary investment in this simple adjustment
    var actualLLPA   = window.lookupLLPA(fico, ltv, txType);
    var baselineLLPA = window.LLPA_BASELINE != null ? window.LLPA_BASELINE : 0.375;
    var delta        = actualLLPA - baselineLLPA; // positive = worse borrower, rate goes up
    if (Math.abs(delta) < 0.01) return parseFloat(baseIRRate) || 0;
    // Convert points delta to rate using step costs; fall back to 4 pts per 1%
    var steps    = irSteps && typeof irSteps === "object" ? irSteps : {};
    var stepVals = Object.values(steps).map(Number).filter(function(v) { return v > 0; });
    var avgStep  = stepVals.length > 0 ? stepVals.reduce(function(a,b){return a+b;},0) / stepVals.length : 0.25;
    // avgStep = points per 0.125% increment; rateAdj = delta / avgStep * 0.125
    var rateAdj  = (delta / avgStep) * 0.125;
    // Round to nearest 0.125%
    rateAdj = Math.round(rateAdj / 0.125) * 0.125;
    return Math.max(0, (parseFloat(baseIRRate) || 0) + rateAdj);
  }, [baseIRRate, pcFico, pcLA, pcHP, pcPurp, prog, irSteps]);

  var llpaDelta = (function() {
    var isConv = prog === "conventional" || prog === "homeready" || prog === "homeposs";
    if (!isConv || !window.lookupLLPA) return 0;
    var fico  = parseInt(pcFico) || 740;
    var la_   = parseFloat(pcLA) || 0;
    var hp_   = parseFloat(pcHP) || 0;
    var ltv   = (hp_ > 0 && la_ > 0) ? Math.round(la_ / hp_ * 1000) / 10 : 75;
    var txType = pcPurp === "purchase" ? "purchase" : pcPurp === "cashout" ? "cashout" : "lcor";
    return window.lookupLLPA(fico, ltv, txType) - (window.LLPA_BASELINE != null ? window.LLPA_BASELINE : 0.375);
  })();

  // ARM adjustment: 10yr = -0.125%, 7yr = -0.250%, 5yr = -0.375% vs 30yr fixed
  var armAdj = 0;
  if (pcLoanType === "arm") {
    var armYrs = parseInt(pcArmYears) || 5;
    armAdj = armYrs >= 10 ? -0.125 : armYrs >= 7 ? -0.250 : -0.375;
  }
  const currentRate = String(Math.max(0, (llpaAdjustedRate || parseFloat(baseIRRate) || 0) + armAdj));
  const [dtiTax] = useLocalStorage("dti_tax", "0");
  const [dtiIns] = useLocalStorage("dti_ins", "0");
  const [dtiPMI] = useLocalStorage("dti_pmi", "0");

  // Adjustable: how many discount points per 0.25% rate reduction
  const [ptsPerQtr, setPtsPerQtr] = useState("0.5");

  const noteRate     = parseFloat(currentRate) || 0;
  const la           = parseFloat(pcLA)   || 0;
  const term         = parseInt(pcTerm)   || 30;
  const hp           = parseFloat(pcHP)   || 0;
  const dpPct        = parseFloat(pcDP)   || 0;
  const dpAmt        = hp > 0 && dpPct > 0 ? Math.round(hp * dpPct / 100) : null;
  const monthlyOther = (parseFloat(dtiTax) || 0)
                     + (parseFloat(dtiIns) || 0)
                     + (parseFloat(dtiPMI) || 0);
  const hasPITI = monthlyOther > 0;
  const hasData = noteRate > 0 && la > 0;

  // Max seller concessions by program / LTV / occupancy
  var pbLtv = hp > 0 ? la / hp * 100 : 0;
  var pbMaxSCPct = (function() {
    var prog = pcProg || "conventional";
    var occ  = pcOcc  || "primary";
    if (prog === "fha")   return 6;
    if (prog === "va")    return 4;
    if (prog === "usda")  return 6;
    if (prog === "jumbo") return 3;
    if (prog === "nonqm") return null;
    if (occ === "investment") return 2;
    if (pbLtv > 90) return 3;
    if (pbLtv > 75) return 6;
    return 9;
  })();
  var pbMaxSCStr = pbMaxSCPct === null
    ? "Varies by lender"
    : (pbMaxSCPct + "%" + (hp > 0 ? " (up to $" + Math.round(hp * pbMaxSCPct / 100).toLocaleString("en-US") + ")" : ""));

  // Build rate-reduction rows
  const rows = useMemo(function() {
    if (!hasData) return [];
    var ppq  = parseFloat(ptsPerQtr) || 1.0;
    var r    = noteRate / 100 / 12;
    var n    = term * 12;
    var base = pmt(r, n, la);

    // Baseline (current rate) row — always first
    var baseline = {
      isBaseline: true,
      newRate:    noteRate,
      newPmt:     Math.round(base),
      savings:    0,
      annualSav:  0,
      points:     0,
      cost:       0,
      costPct:    0,
      breakEven:  null,
    };

    // 0.125% steps from 0.125 down to 2.500
    var steps = [];
    for (var s = 1; s <= 20; s++) {
      steps.push(Math.round(s * 125) / 1000); // avoids floating-point drift
    }

    var dataRows = steps.map(function(reduction) {
      var newRate = Math.max(noteRate - reduction, 0.001);
      // Convert X.000% to (X-1).990% — avoids whole-number rates
      if (Math.round(newRate * 1000) % 1000 === 0) { newRate = newRate - 0.01; }
      var newR    = newRate / 100 / 12;
      var newP    = pmt(newR, n, la);
      var savings = base - newP;
      var points  = (reduction / 0.125) * ppq;
      var cost    = la * points / 100;
      var bkEven  = savings > 0 ? cost / savings : null;
      return {
        isBaseline: false,
        reduction:  reduction,
        newRate:    newRate,
        newPmt:     Math.round(newP),
        savings:    Math.round(savings),
        annualSav:  Math.round(savings * 12),
        points:     points,
        cost:       Math.round(cost),
        costPct:    hp > 0 ? cost / hp * 100 : null,
        breakEven:  bkEven ? Math.ceil(bkEven) : null,
      };
    });

    return [baseline].concat(dataRows);
  }, [noteRate, la, term, hp, ptsPerQtr, hasData]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: c.textSecondary || "#64748b", fontFamily: font }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.text || "#1B2A3B", marginBottom: 8 }}>
          No loan data yet
        </div>
        <div style={{ fontSize: 13 }}>
          Enter an interest rate and loan amount in the <strong>Payment Calculator</strong> tab to see permanent buydown options.
        </div>
      </div>
    );
  }

  var basePmt = Math.round(pmt(noteRate / 100 / 12, term * 12, la));
  var ptCost  = Math.round(la * (parseFloat(ptsPerQtr) || 1) / 100);

  const hdSt = {
    padding: "10px 14px", fontSize: 12, fontWeight: 800, color: "#fff",
    textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.15)",
  };
  const lbSt = {
    padding: "9px 14px", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.04em",
    color: c.textSecondary || "#64748b", textAlign: "left",
    whiteSpace: "nowrap", borderBottom: "1px solid " + border,
    background: isDark ? "#0D1820" : "#F5F8FA",
  };
  const tdSt = {
    padding: "10px 12px", textAlign: "center",
    borderBottom: "1px solid " + border,
    borderLeft: "1px solid " + border,
    verticalAlign: "middle",
  };

  return (
    <div style={{ padding: 20, fontFamily: font, maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.text || "#1B2A3B" }}>
          Permanent Buydown
        </div>
        <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginTop: 4 }}>
          📋 Loan data is pulled live from the <strong>Payment Calculator</strong> tab — update values there to refresh this view.
        </div>
      </div>

      {/* Rate adjustment note (LLPA + ARM) */}
      {(function() {
        var isConv   = prog === "conventional" || prog === "homeready" || prog === "homeposs";
        var hasLLPA  = isConv && Math.abs(llpaDelta) >= 0.01;
        var hasARM   = pcLoanType === "arm" && armAdj !== 0;
        if (!hasLLPA && !hasARM) return null;
        var finalRate = parseFloat(currentRate) || 0;
        var baseStr   = parseFloat(baseIRRate).toFixed(3) + "%";
        var finalStr  = finalRate.toFixed(3) + "%";
        var totalAdj  = finalRate - parseFloat(baseIRRate);
        var isUp      = totalAdj > 0.001;
        var parts = [];
        if (hasLLPA) parts.push(Math.abs(llpaDelta).toFixed(3) + " pts LLPA " + (llpaDelta > 0 ? "above" : "below") + " baseline");
        if (hasARM)  parts.push(Math.abs(armAdj).toFixed(3) + "% ARM discount (" + parseInt(pcArmYears) + "-yr)");
        return React.createElement("div", {
          style: { marginBottom: 12, padding: "9px 14px", borderRadius: 8, fontSize: 12, fontFamily: c.font || "inherit",
            background: isUp ? (isDark ? "#2D1A00" : "#FFFBEB") : (isDark ? "#0A1F12" : "#F0FDF4"),
            border: "1px solid " + (isUp ? "#FCD34D" : "#86EFAC"),
            color: isUp ? (isDark ? "#FCD34D" : "#92400E") : (isDark ? "#4ADE80" : "#166534"),
            lineHeight: 1.5 }
        },
          React.createElement("strong", null, isUp ? "⚠️ " : "✓ "),
          "IR Tab " + baseStr + " → " + finalStr + " (" + (totalAdj >= 0 ? "+" : "") + totalAdj.toFixed(3) + "%) · " + parts.join(", ") + "."
        );
      })()}

      {/* Loan summary card */}
      {(() => {
        var rows = [
          hp > 0    ? { label: "Purchase Price", value: "$" + hp.toLocaleString("en-US") }                                                 : null,
          dpPct > 0 ? { label: "Down Payment",   value: (dpAmt ? "$" + dpAmt.toLocaleString("en-US") + " (" + dpPct + "%)" : dpPct + "%") }  : null,
          { label: "Loan Amount",      value: "$" + la.toLocaleString("en-US") },
          { label: "Term",             value: term + " years" },
          { label: "Rate",             value: noteRate.toFixed(3) + "%" },
          { label: "Payment (P&I)",    value: "$" + basePmt.toLocaleString("en-US") + "/mo", bold: true },
          hasPITI ? { label: "Payment (PITI)", value: "$" + (basePmt + Math.round(monthlyOther)).toLocaleString("en-US") + "/mo", bold: true } : null,
          { label: "Max Seller Conc.", value: pbMaxSCStr },
        ].filter(Boolean);
        return (
          <div style={{ marginBottom: 20, padding: "12px 18px", background: isDark ? "#0D1820" : "#F5F8FA", borderRadius: 10, border: "1px solid " + border, display: "inline-block", minWidth: 260 }}>
            {rows.map(function(row, i) {
              return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "3px 0" }}>
                  <span style={{ fontSize: 12, color: isDark ? "#4A7A90" : "#94A3B8", lineHeight: 1, flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: 13, color: c.textSecondary || "#64748b", minWidth: 130, flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: row.bold ? navy : (c.text || "#1B2A3B") }}>{row.value}</span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Table */}
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid " + border, boxShadow: "0 2px 8px rgba(0,20,60,0.06)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ ...hdSt, background: navy, textAlign: "left", width: 130 }}>Rate</th>
              <th style={{ ...hdSt, background: navy }}>Monthly Payment</th>
              <th style={{ ...hdSt, background: navy }}>Savings</th>
              <th style={{ ...hdSt, background: navy }}>Costs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(function(row, i) {
              // Baseline row gets a distinct tinted background
              var baselineBg = isDark ? "#0A1E30" : "#E8F0F8";
              var rowBg = row.isBaseline
                ? baselineBg
                : (i % 2 === 0 ? (isDark ? "#111E2C" : "#fff") : (isDark ? "#0D1820" : "#F9FBFC"));
              return (
                <tr key={i} style={{ background: rowBg }}>
                  <td style={{ ...lbSt, background: rowBg }}>
                    <div style={{ fontWeight: 800, color: navy, fontSize: 15 }}>
                      {row.newRate.toFixed(3)}%
                    </div>
                    <div style={{ fontSize: 10, color: c.textSecondary || "#94A3B0", fontWeight: row.isBaseline ? 700 : 400 }}>
                      {row.isBaseline ? "current rate" : "was " + noteRate.toFixed(3) + "%"}
                    </div>
                  </td>
                  <td style={{ ...tdSt, background: rowBg }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isDark ? "#7BAAC8" : "#4A6F8A" }}>
                      ${row.newPmt.toLocaleString("en-US")} P&amp;I
                    </div>
                    {hasPITI && (
                      <div style={{ fontWeight: 700, fontSize: 13, color: navy, marginTop: 4 }}>
                        ${(row.newPmt + Math.round(monthlyOther)).toLocaleString("en-US")} PITI
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdSt, background: rowBg }}>
                    {row.isBaseline ? (
                      <div style={{ fontSize: 13, color: c.textSecondary || "#94A3B0" }}>—</div>
                    ) : (
                      <React.Fragment>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#5DE890" : "#1A7A3A" }}>
                          +${row.savings.toLocaleString("en-US")}/mo
                        </div>
                        <div style={{ fontSize: 11, color: isDark ? "#4DD47C" : "#1A7A3A" }}>
                          +${row.annualSav.toLocaleString("en-US")}/yr
                        </div>
                      </React.Fragment>
                    )}
                  </td>
                  <td style={{ ...tdSt, background: row.isBaseline ? rowBg : (isDark ? "#0D1B26" : "#EBF5FB") }}>
                    {row.isBaseline ? (
                      <div style={{ fontSize: 13, color: c.textSecondary || "#94A3B0" }}>—</div>
                    ) : (
                      <React.Fragment>
                        <div style={{ fontWeight: 800, fontSize: 15, color: navy }}>
                          ${row.cost.toLocaleString("en-US")}
                        </div>
                        {row.costPct != null && (
                          <div style={{ fontSize: 10, color: c.textSecondary || "#64748b" }}>
                            {row.costPct.toFixed(3)}% of Sales Price
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 2 }}>
                          {row.points.toFixed(3)}% of Loan Amount
                        </div>
                      </React.Fragment>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Points-per-0.125% control — internal only */}
      {isInternal && <div style={{
        display: "inline-flex", alignItems: "center", gap: 12, marginTop: 14,
        padding: "10px 16px", background: isDark ? "#0D1820" : "#F0F6FF",
        borderRadius: 8, border: "1px solid " + border,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: c.text || "#1B2A3B" }}>
          <span style={{ color: isDark ? "#F0C040" : "#A07800" }}>Internal:</span> Discount points per 0.125% rate reduction:
        </span>
        <input
          type="number" inputMode="decimal" onFocus={(e) => e.target.select()} min="0.1" max="4" step="0.1" value={ptsPerQtr}
          onChange={function(e) { setPtsPerQtr(e.target.value); }}
          style={{
            width: 70, padding: "8px 10px", borderRadius: 7, border: "1px solid " + border,
            fontSize: 15, fontFamily: font, background: isDark ? "#1A2530" : "#fff",
            color: c.text || "#1B2A3B", outline: "none", textAlign: "center",
          }}
        />
        <span style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>
          (1 pt&nbsp;=&nbsp;<strong>${ptCost.toLocaleString("en-US")}</strong>)
        </span>
      </div>}

      {/* Disclaimer */}
      <div style={{
        marginTop: 10, padding: "11px 15px",
        background: isDark ? "#1A2535" : "#FFF8E7",
        border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"),
        borderLeft: "4px solid #E6A817",
        borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.6,
      }}>
        <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
        {" "}Discount point costs vary by lender and rate environment — 0.5 points per 0.125% is a common approximation but not guaranteed.
        Break-even assumes the buyer keeps the loan without refinancing. Verify actual point pricing with your lender.
      </div>

    </div>
  );
}

window.PermBuydownTab = PermBuydownTab;
