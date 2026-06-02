// modules/calculators/TargetPaymentTab.js
// Builder enters a target monthly payment for a buyer.
// Shows three strategies: permanent buydown, price reduction, or 2/1 temp buydown.

const { useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const lookupSpmiRate  = window.lookupSpmiRate;
const COLORS_DARK     = window.COLORS_DARK;
const font            = window.font;
const fmt             = window.fmt;

function TargetPaymentTab() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;

  const navy   = c.navy   || "#1B3A5C";
  const border = c.border || "#D1D9E6";
  const green  = isDark ? "#5DE890" : "#1A7A3A";
  const blue   = isDark ? "#7BC8F0" : "#1565C0";

  // Read-only from Payment Calculator
  const [pcRate] = useLocalStorage("pc_rate", "");
  const [pcLA]   = useLocalStorage("pc_la",   "");
  const [pcTerm] = useLocalStorage("pc_term", "30");
  const [pcHP]   = useLocalStorage("pc_hp",   "");
  const [pcDP]   = useLocalStorage("pc_dp",   "10");
  const [dtiTax] = useLocalStorage("dti_tax", "0");
  const [dtiIns] = useLocalStorage("dti_ins", "0");
  const [dtiPMI] = useLocalStorage("dti_pmi", "0");
  const [pcProg] = useLocalStorage("pc_prog", "conventional");
  const [pcOcc]  = useLocalStorage("pc_occ",  "primary");
  const [pcFico] = useLocalStorage("pc_fico", "");

  // Target payment input — persisted so tab switches don't wipe the values
  const [targetPI,    setTargetPI]    = useLocalStorage("tgt_target_pi",   "");
  const [paymentMode, setPaymentMode] = useLocalStorage("tgt_payment_mode", "PITI");
  const [spmiOvr, setSpmiOvr] = useLocalStorage("tgt_spmi_ovr", "");
  const [lpmiOvr, setLpmiOvr] = useLocalStorage("tgt_lpmi_ovr", "");

  const noteRate    = parseFloat(pcRate) || 0;
  const la          = parseFloat(pcLA)   || 0;
  const term        = parseInt(pcTerm)   || 30;
  const hp          = parseFloat(pcHP)   || 0;
  const dpPct       = parseFloat(pcDP)   || 10;
  const monthlyPMI  = parseFloat(dtiPMI) || 0;
  const monthlyOther = (parseFloat(dtiTax) || 0)
                     + (parseFloat(dtiIns) || 0)
                     + monthlyPMI;
  const hasPITI = monthlyOther > 0;
  const hasPMI  = monthlyPMI > 0 && (pcProg === "conventional" || pcProg === "jumbo");
  const hasData = noteRate > 0 && la > 0;
  const dpAmt   = hp > 0 && dpPct > 0 ? Math.round(hp * dpPct / 100) : null;

  // Max seller concessions by program / LTV / occupancy
  var tgtLtv = hp > 0 ? la / hp * 100 : 0;
  var tgtMaxSCPct = (function() {
    var prog = pcProg || "conventional";
    var occ  = pcOcc  || "primary";
    if (prog === "fha")   return 6;
    if (prog === "va")    return 4;
    if (prog === "usda")  return 6;
    if (prog === "jumbo") return 3;
    if (prog === "nonqm") return null;
    if (occ === "investment") return 2;
    if (tgtLtv > 90) return 3;
    if (tgtLtv > 75) return 6;
    return 9;
  })();
  var tgtMaxSCStr = tgtMaxSCPct === null
    ? "Varies by lender"
    : (tgtMaxSCPct + "%" + (hp > 0 ? " (up to $" + Math.round(hp * tgtMaxSCPct / 100).toLocaleString("en-US") + ")" : ""));

  // Bisection solver: find monthly rate given target payment, loan amount, and term
  function solveMonthlyRate(targetPmt, loanAmt, periods) {
    if (targetPmt <= 0 || loanAmt <= 0 || periods <= 0) return null;
    var lo = 0.000001;
    var hi = 0.05; // 60% annual cap
    for (var i = 0; i < 100; i++) {
      var mid = (lo + hi) / 2;
      var val = loanAmt * mid * Math.pow(1 + mid, periods) / (Math.pow(1 + mid, periods) - 1);
      if (Math.abs(val - targetPmt) < 0.01) break;
      if (val > targetPmt) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  }

  const analysis = useMemo(function() {
    if (!hasData) return null;
    var r = noteRate / 100 / 12;
    var n = term * 12;
    var currentPI  = pmt(r, n, la);
    var rawTarget  = parseFloat(targetPI) || 0;
    // If user entered PITI, back out the non-PI components to get P&I target
    var target     = paymentMode === "PITI" ? Math.max(rawTarget - monthlyOther, 0) : rawTarget;

    var result = {
      currentPI:    Math.round(currentPI),
      currentPITI:  Math.round(currentPI + monthlyOther),
      targetPI:     target,
      targetPITI:   target > 0 ? Math.round(target + monthlyOther) : null,
      targetInput:  rawTarget,
      gap:          target > 0 ? Math.round(currentPI - target) : null,
      perm:         null,
      priceRed:     null,
      tempBuydown:  null,
      spmi:         null,
      lpmi:         null,
    };

    if (target <= 0 || target >= currentPI) return result;

    var gap = currentPI - target;

    // ── Strategy 1: Permanent Buydown ────────────────────────────────────────
    var mRate = solveMonthlyRate(target, la, n);
    if (mRate) {
      var exactAnnualRate  = mRate * 12 * 100;
      // Floor to nearest 0.125% so payment stays at or below target
      var targetAnnualRate = Math.floor(exactAnnualRate * 8) / 8;
      // Apply X.000% → (X-1).990% rule to avoid whole-number rates
      if (Math.round(targetAnnualRate * 1000) % 1000 === 0) { targetAnnualRate = targetAnnualRate - 0.01; }
      var rateReduction    = noteRate - targetAnnualRate;
      var numSteps         = Math.round(rateReduction / 0.125); // steps of 0.125%
      var points           = numSteps * 0.5;                    // 0.5 pts per 0.125%
      var permCost         = Math.round(la * points / 100);
      var roundedMonthly   = Math.round(pmt(targetAnnualRate / 100 / 12, n, la));
      var breakEven        = gap > 0 ? Math.ceil(permCost / gap) : null;
      var permMonthlySav   = Math.round(currentPI) - roundedMonthly;
      result.perm = {
        targetRate:    targetAnnualRate,
        rateReduction: rateReduction,
        points:        points,
        cost:          permCost,
        costPct:       hp > 0 ? permCost / hp * 100 : null,
        breakEven:     breakEven,
        monthly:       roundedMonthly,
        lifeSavings:   permMonthlySav * n,
        fiveYrSavings: permMonthlySav * 60,
      };
    }

    // ── Strategy 2: Price Reduction ──────────────────────────────────────────
    // pmt(r, n, target_loan) = target → target_loan = target / (r*(1+r)^n/((1+r)^n-1))
    var pvFactor  = r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    var targetLoan = target / pvFactor;
    var loanReduction = la - targetLoan;
    // If dp% stays the same, price reduction = loan_reduction / (1 - dp/100)
    var dpFraction    = (100 - dpPct) / 100;
    var priceReduction = dpFraction > 0 ? Math.round(loanReduction / dpFraction) : null;
    var newPrice       = priceReduction != null ? Math.round(hp - priceReduction) : null;
    // Life interest savings: current_loan vs target_loan, both at same rate
    var currentTotalInterest = currentPI * n - la;
    var newTotalInterest     = target * n - targetLoan;
    var lifeInterestSavings  = Math.round(currentTotalInterest - newTotalInterest);
    result.priceRed = {
      loanReduction:       Math.round(loanReduction),
      priceReduction:      priceReduction,
      newPrice:            newPrice,
      monthly:             Math.round(target),
      lifeInterestSavings: lifeInterestSavings,
      fiveYrSavings:       Math.round((currentPI - target) * 60),
    };

    // ── Strategy 3: 2/1 Temp Buydown ────────────────────────────────────────
    var yr1Rate = Math.max(noteRate - 2, 0.001);
    var yr2Rate = Math.max(noteRate - 1, 0.001);
    var yr1Pmt  = pmt(yr1Rate / 100 / 12, n, la);
    var yr2Pmt  = pmt(yr2Rate / 100 / 12, n, la);
    var yr1Sav  = currentPI - yr1Pmt;
    var yr2Sav  = currentPI - yr2Pmt;
    var bCost   = Math.round(yr1Sav * 12 + yr2Sav * 12);
    var meetsY1 = yr1Pmt <= target + 1; // within $1 rounding
    result.tempBuydown = {
      yr1Rate:  yr1Rate,
      yr2Rate:  yr2Rate,
      yr1Pmt:   Math.round(yr1Pmt),
      yr2Pmt:   Math.round(yr2Pmt),
      fullPmt:  Math.round(currentPI),
      cost:     bCost,
      costPct:  hp > 0 ? bCost / hp * 100 : null,
      meetsY1:  meetsY1,
      gap:      Math.round(gap),
    };

    // ── Strategy 4: Single-Paid MI (SPMI) ─────────────────────────────────────
    if (monthlyPMI > 0 && (pcProg === "conventional" || pcProg === "jumbo")) {
      var ltv      = hp > 0 ? (la / hp) * 100 : 0;
      var ficoNum  = parseInt(pcFico) || 0;
      var tableRate = ficoNum >= 620 ? lookupSpmiRate(ltv, ficoNum) : null;
      var spmiRateEst = tableRate !== null
        ? tableRate
        : (ltv > 95 ? 0.0205 : ltv > 90 ? 0.0165 : ltv > 85 ? 0.0130 : 0.0100);
      var spmiCostEst = Math.round(la * spmiRateEst);
      var spmiOvrNum  = parseFloat(spmiOvr) || 0;
      var spmiCost    = spmiOvrNum > 0 ? spmiOvrNum : spmiCostEst;
      result.spmi = {
        cost:          spmiCost,
        costEst:       spmiCostEst,
        monthlySav:    monthlyPMI,
        breakEven:     Math.ceil(spmiCost / monthlyPMI),
        isEstimate:    spmiOvrNum === 0,
        hasFicoLookup: tableRate !== null,
        ficoUsed:      ficoNum >= 620 ? ficoNum : null,
        costPct:       hp > 0 ? spmiCost / hp * 100 : null,
      };

      // ── Strategy 5: Lender-Paid MI (LPMI) ───────────────────────────────────
      var annPmiRate = la > 0 ? (monthlyPMI / la) * 1200 : 0;
      var lpmiOvrNum = parseFloat(lpmiOvr) || 0;
      var rateInc    = lpmiOvrNum > 0 ? lpmiOvrNum : Math.round(annPmiRate * 1000) / 1000;
      var lpmiNewPI  = pmt((noteRate + rateInc) / 100 / 12, n, la);
      var piIncrease = lpmiNewPI - currentPI;
      result.lpmi = {
        rateInc:       rateInc,
        rateIncEst:    Math.round(annPmiRate * 1000) / 1000,
        newPI:         Math.round(lpmiNewPI),
        piIncrease:    Math.round(piIncrease),
        netMonthlySav: Math.round(monthlyPMI - piIncrease),
        isEstimate:    lpmiOvrNum === 0,
      };
    }

    return result;
  }, [noteRate, la, term, hp, dpPct, monthlyOther, monthlyPMI, targetPI, paymentMode, hasData, spmiOvr, lpmiOvr, pcProg, pcFico]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: c.textSecondary || "#64748b", fontFamily: font }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.text || "#1B2A3B", marginBottom: 8 }}>
          No loan data yet
        </div>
        <div style={{ fontSize: 13 }}>
          Enter an interest rate and loan amount in the <strong>Payment Calculator</strong> tab first.
        </div>
      </div>
    );
  }

  var basePmt     = Math.round(pmt(noteRate / 100 / 12, term * 12, la));
  var showResults = analysis && analysis.targetPI > 0 && analysis.gap > 0;
  var noGap       = analysis && analysis.targetPI > 0 && analysis.gap <= 0;

  const cardStyle = {
    background: isDark ? "#0f1e2c" : "#fff",
    border: "1.5px solid " + border,
    borderRadius: 12,
    padding: "20px 22px",
    flex: 1,
  };
  const stratLbl = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", color: c.textSecondary || "#64748b",
    marginBottom: 6,
  };
  const stratMain = { fontSize: 22, fontWeight: 800, color: navy, marginBottom: 4 };
  const stratSub  = { fontSize: 13, color: c.textSecondary || "#64748b", marginBottom: 12 };
  const rowLine   = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 0", borderBottom: "1px solid " + border,
    fontSize: 13,
  };

  return (
    <div style={{ padding: 20, fontFamily: font, maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.text || "#1B2A3B" }}>
          Target Payment Calculator
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginTop: 4 }}>
          Enter the buyer's target monthly payment to see various options.
        </div>
      </div>

      {/* Loan summary card */}
      {(() => {
        var rows = [
          hp > 0    ? { label: "Purchase Price", value: "$" + hp.toLocaleString("en-US") }                                                               : null,
          dpPct > 0 ? { label: "Down Payment",   value: (dpAmt ? "$" + dpAmt.toLocaleString("en-US") + " (" + dpPct + "%)" : dpPct + "%") }              : null,
          { label: "Loan Amount",   value: "$" + la.toLocaleString("en-US") },
          { label: "Term",          value: term + " years" },
          { label: "Rate",          value: noteRate.toFixed(3) + "%" },
          { label: "Payment (P&I)", value: "$" + basePmt.toLocaleString("en-US") + "/mo", bold: true },
          hasPITI ? { label: "Payment (PITI)", value: "$" + (basePmt + Math.round(monthlyOther)).toLocaleString("en-US") + "/mo", bold: true } : null,
          { label: "Max Seller Conc.", value: tgtMaxSCStr },
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

      {/* Target payment input */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 14,
        marginBottom: 24, padding: "16px 20px",
        background: isDark ? "#0D1820" : "#F0F6FF",
        borderRadius: 10, border: "1px solid " + border,
      }}>
        {/* Instruction text */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.text || "#1B2A3B", marginBottom: 3 }}>
            What's the buyer's target payment?
          </div>
          <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
            Choose P&amp;I or PITI, enter the amount, and we'll show you options to get there.
          </div>
        </div>

        {/* Inputs row */}
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            {/* Mode dropdown — styled as a real input */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.textSecondary || "#64748b" }}>
                Type
              </label>
              <select
                value={paymentMode}
                onChange={function(e) { setPaymentMode(e.target.value); }}
                style={{
                  padding: "10px 12px", borderRadius: 8,
                  border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"),
                  fontSize: 15, fontFamily: font, fontWeight: 700,
                  background: isDark ? "#1A2530" : "#fff",
                  color: navy, outline: "none", cursor: "pointer",
                  minWidth: 90,
                }}
              >
                <option value="PITI">PITI</option>
                <option value="PI">P&amp;I</option>
              </select>
            </div>
            {/* Amount input */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.textSecondary || "#64748b" }}>
                Target Amount
              </label>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ padding: "10px 11px", background: isDark ? "#1A2530" : "#E8EEF5", border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"), borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 15, color: c.textSecondary || "#64748b", fontWeight: 600 }}>$</span>
                <input
                  type="text"
                  onFocus={(e) => e.target.select()} inputMode="numeric"
                  placeholder={"e.g. " + (analysis ? Math.round((paymentMode === "PITI" ? analysis.currentPITI : analysis.currentPI) * 0.9).toLocaleString("en-US") : "2,000")}
                  value={targetPI ? Number(targetPI).toLocaleString("en-US") : ""}
                  onChange={function(e) {
                    var stripped = e.target.value.replace(/[^0-9]/g, "");
                    setTargetPI(stripped);
                  }}
                  style={{
                    padding: "10px 12px", borderRadius: "0 8px 8px 0",
                    border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"),
                    fontSize: 15, fontFamily: font, background: isDark ? "#1A2530" : "#fff",
                    color: c.text || "#1B2A3B", outline: "none", width: 140,
                  }}
                />
              </div>
            </div>
          </div>
          {/* Derived counterpart */}
          {analysis && analysis.targetPI > 0 && (
            <div style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>
              {paymentMode === "PITI"
                ? "= $" + analysis.targetPI.toLocaleString("en-US") + "/mo P&I"
                : hasPITI ? "= $" + analysis.targetPITI.toLocaleString("en-US") + "/mo PITI" : null}
            </div>
          )}
        </div>

          {/* Gap chip */}
          {analysis && analysis.gap !== null && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                padding: "12px 18px", borderRadius: 10,
                background: analysis.gap > 0 ? (isDark ? "#2A1010" : "#FFF0F0") : (isDark ? "#0A2A14" : "#F0FFF4"),
                border: "1px solid " + (analysis.gap > 0 ? (isDark ? "#6A2020" : "#FFBBBB") : (isDark ? "#1A5A2A" : "#AAEEBB")),
                textAlign: "center",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {analysis.gap > 0 ? "Gap to Close" : "Already Achievable"}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: analysis.gap > 0 ? (isDark ? "#FF8080" : "#C02020") : green, marginTop: 2 }}>
                  {analysis.gap > 0 ? "$" + analysis.gap.toLocaleString("en-US") + "/mo" : "✓"}
                </div>
              </div>
            </div>
          )}
        </div>{/* end inputs row */}
      </div>

      {/* No gap / target not set message */}
      {!showResults && !noGap && (
        <div style={{ padding: 32, textAlign: "center", color: c.textSecondary || "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👆</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Enter a target P&I payment above to see your options.</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>The target must be lower than the current payment of ${analysis ? analysis.currentPI.toLocaleString("en-US") : "—"}/mo.</div>
        </div>
      )}

      {noGap && (
        <div style={{ padding: 24, textAlign: "center", background: isDark ? "#0A2A14" : "#F0FFF4", borderRadius: 10, border: "1px solid " + (isDark ? "#1A5A2A" : "#AAEEBB") }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: green }}>
            The buyer's target is already at or above the current payment — no builder concession needed!
          </div>
        </div>
      )}

      {/* Strategy cards */}
      {showResults && analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Card 1: Permanent Buydown */}
          {analysis.perm && (function() {
            var showPITI   = paymentMode === "PITI" && hasPITI;
            var pmtLabel   = showPITI ? "New monthly PITI" : "New monthly P&I";
            var pmtDisplay = showPITI
              ? (analysis.perm.monthly + Math.round(monthlyOther)).toLocaleString("en-US")
              : analysis.perm.monthly.toLocaleString("en-US");
            return (
              <div style={{ background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid " + navy, borderRadius: 12, padding: "18px 20px" }}>
                {/* Headline */}
                <div style={stratLbl}>Option 1 · Permanent Buydown</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                  <div style={stratMain}>${analysis.perm.cost.toLocaleString("en-US")}</div>
                  <div style={{ fontSize: 13, color: c.textSecondary || "#64748b" }}>one-time builder cost</div>
                </div>
                {/* All rows */}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 0 }}>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>{pmtLabel}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: green }}>${pmtDisplay}/mo</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Buy rate from</span>
                    <span style={{ fontWeight: 600, color: navy }}>{noteRate.toFixed(3)}% → {analysis.perm.targetRate.toFixed(3)}%</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Rate reduction</span>
                    <span style={{ fontWeight: 600, color: navy }}>{analysis.perm.rateReduction.toFixed(3)}%</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Discount points</span>
                    <span style={{ fontWeight: 600, color: navy }}>{analysis.perm.points.toFixed(3)} pts</span>
                  </div>
                  {analysis.perm.costPct != null && (
                    <div style={rowLine}>
                      <span style={{ color: c.textSecondary || "#64748b" }}>% of home price</span>
                      <span style={{ fontWeight: 600 }}>{analysis.perm.costPct.toFixed(3)}%</span>
                    </div>
                  )}
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Buyer's savings after 5 years</span>
                    <span style={{ fontWeight: 700, color: green }}>${analysis.perm.fiveYrSavings.toLocaleString("en-US")}</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Buyer's life interest savings</span>
                    <span style={{ fontWeight: 600, color: green }}>${analysis.perm.lifeSavings.toLocaleString("en-US")}</span>
                  </div>
                  {analysis.perm.breakEven && (
                    <div style={rowLine}>
                      <span style={{ color: c.textSecondary || "#64748b" }}>Buyer break-even</span>
                      <span style={{ fontWeight: 600 }}>
                        {analysis.perm.breakEven < 12
                          ? analysis.perm.breakEven + " months"
                          : (analysis.perm.breakEven / 12).toFixed(1) + " years"}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 7, background: isDark ? "#0A1A28" : "#EEF4FF", fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
                  Rate permanently reduced for the life of the loan. Best value if buyer plans to stay long-term.
                </div>
              </div>
            );
          })()}

          {/* Card 2: Price Reduction */}
          {analysis.priceRed && (function() {
            var showPITI   = paymentMode === "PITI" && hasPITI;
            var pmtLabel   = showPITI ? "New monthly PITI" : "New monthly P&I";
            var pmtDisplay = showPITI
              ? (analysis.priceRed.monthly + Math.round(monthlyOther)).toLocaleString("en-US")
              : analysis.priceRed.monthly.toLocaleString("en-US");
            var headline   = analysis.priceRed.priceReduction != null
              ? "$" + analysis.priceRed.priceReduction.toLocaleString("en-US")
              : "$" + analysis.priceRed.loanReduction.toLocaleString("en-US") + " off loan";
            return (
              <div style={{ background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid #1A7A3A", borderRadius: 12, padding: "18px 20px" }}>
                {/* Headline */}
                <div style={stratLbl}>Option 2 · Price Reduction</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                  <div style={stratMain}>{headline}</div>
                  <div style={{ fontSize: 13, color: c.textSecondary || "#64748b" }}>reduction to home price</div>
                </div>
                {/* All rows */}
                <div style={{ marginTop: 12 }}>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>{pmtLabel}</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: green }}>${pmtDisplay}/mo</span>
                  </div>
                  {analysis.priceRed.newPrice != null && (
                    <div style={rowLine}>
                      <span style={{ color: c.textSecondary || "#64748b" }}>New sale price</span>
                      <span style={{ fontWeight: 600, color: navy }}>${analysis.priceRed.newPrice.toLocaleString("en-US")}</span>
                    </div>
                  )}
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Loan reduction</span>
                    <span style={{ fontWeight: 600, color: navy }}>${analysis.priceRed.loanReduction.toLocaleString("en-US")}</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Buyer's savings after 5 years</span>
                    <span style={{ fontWeight: 700, color: green }}>${analysis.priceRed.fiveYrSavings.toLocaleString("en-US")}</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Buyer's life interest savings</span>
                    <span style={{ fontWeight: 600, color: green }}>${analysis.priceRed.lifeInterestSavings.toLocaleString("en-US")}</span>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 7, background: isDark ? "#0A2A14" : "#F0FFF4", fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
                  Down payment % ({dpPct}%) assumed constant. Buyer needs less loan and pays less interest over the life of the loan.
                </div>
              </div>
            );
          })()}

          {/* Card 3: 2/1 Temp Buydown */}
          {analysis.tempBuydown && (function() {
            var showPITI = paymentMode === "PITI" && hasPITI;
            var mo       = Math.round(monthlyOther);
            var yr1Disp  = showPITI ? (analysis.tempBuydown.yr1Pmt + mo).toLocaleString("en-US") : analysis.tempBuydown.yr1Pmt.toLocaleString("en-US");
            var yr2Disp  = showPITI ? (analysis.tempBuydown.yr2Pmt + mo).toLocaleString("en-US") : analysis.tempBuydown.yr2Pmt.toLocaleString("en-US");
            var fullDisp = showPITI ? (analysis.tempBuydown.fullPmt + mo).toLocaleString("en-US") : analysis.tempBuydown.fullPmt.toLocaleString("en-US");
            var pmtType  = showPITI ? "PITI" : "P&I";
            var yr1MoSav = analysis.tempBuydown.fullPmt - analysis.tempBuydown.yr1Pmt;
            var yr2MoSav = analysis.tempBuydown.fullPmt - analysis.tempBuydown.yr2Pmt;
            return (
              <div style={{ background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid #1565C0", borderRadius: 12, padding: "18px 20px" }}>
                {/* Headline */}
                <div style={stratLbl}>Option 3 · 2/1 Temp Buydown</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                  <div style={stratMain}>${analysis.tempBuydown.cost.toLocaleString("en-US")}</div>
                  <div style={{ fontSize: 13, color: c.textSecondary || "#64748b" }}>one-time builder cost</div>
                </div>
                {/* All rows */}
                <div style={{ marginTop: 12 }}>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Year 1 {pmtType} ({analysis.tempBuydown.yr1Rate.toFixed(3)}%)</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: analysis.tempBuydown.meetsY1 ? green : (isDark ? "#FF8080" : "#C02020") }}>
                      ${yr1Disp}/mo{analysis.tempBuydown.meetsY1 ? " ✓" : " ✗"}
                    </span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Year 1 monthly savings</span>
                    <span style={{ fontWeight: 700, color: green }}>${yr1MoSav.toLocaleString("en-US")}/mo</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Year 2 ({analysis.tempBuydown.yr2Rate.toFixed(3)}%)</span>
                    <span style={{ fontWeight: 600, color: navy }}>${yr2Disp}/mo {pmtType}</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Year 2 monthly savings</span>
                    <span style={{ fontWeight: 700, color: green }}>${yr2MoSav.toLocaleString("en-US")}/mo</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Year 3+ ({noteRate.toFixed(3)}%)</span>
                    <span style={{ fontWeight: 600, color: navy }}>${fullDisp}/mo {pmtType}</span>
                  </div>
                  {analysis.tempBuydown.costPct != null && (
                    <div style={rowLine}>
                      <span style={{ color: c.textSecondary || "#64748b" }}>% of home price</span>
                      <span style={{ fontWeight: 600 }}>{analysis.tempBuydown.costPct.toFixed(3)}%</span>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 7, background: isDark ? "#0A1A2E" : "#EEF4FF", fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
                  {analysis.tempBuydown.meetsY1
                    ? "Year 1 payment meets the target. Buyer adjusts up in years 2 and 3."
                    : "Year 1 payment doesn't fully close the $" + analysis.tempBuydown.gap.toLocaleString("en-US") + "/mo gap — a price reduction or perm buydown may be more effective."}
                </div>
              </div>
            );
          })()}

          {/* Card 4: Single-Paid MI (SPMI) */}
          {analysis.spmi && (function() {
            var spmi        = analysis.spmi;
            var noMIOther   = monthlyOther - monthlyPMI;
            var newPITI     = Math.round(basePmt + noMIOther);
            var inpStyle    = { padding: "6px 8px", border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"), fontSize: 13, fontFamily: font, background: isDark ? "#1A2530" : "#fff", color: c.text || "#1B2A3B", outline: "none" };
            return (
              <div style={{ background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid #0891B2", borderRadius: 12, padding: "18px 20px" }}>
                <div style={stratLbl}>Option 4 · Single-Paid MI (SPMI) — Conventional</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                  <div style={stratMain}>${spmi.cost.toLocaleString("en-US")}</div>
                  <div style={{ fontSize: 13, color: c.textSecondary || "#64748b" }}>
                    {spmi.isEstimate
                      ? (spmi.hasFicoLookup
                          ? "MGIC est. · FICO " + spmi.ficoUsed
                          : "LTV est. · no FICO")
                      : "entered"}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Monthly PMI eliminated</span>
                    <span style={{ fontWeight: 700, color: green }}>−${spmi.monthlySav.toLocaleString("en-US")}/mo</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>P&I payment (unchanged)</span>
                    <span style={{ fontWeight: 600, color: navy }}>${basePmt.toLocaleString("en-US")}/mo</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>New PITI (PMI removed)</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: green }}>${newPITI.toLocaleString("en-US")}/mo</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Break-even vs. monthly PMI</span>
                    <span style={{ fontWeight: 600 }}>
                      {spmi.breakEven < 12
                        ? spmi.breakEven + " months"
                        : (spmi.breakEven / 12).toFixed(1) + " years"}
                    </span>
                  </div>
                  {spmi.costPct != null && (
                    <div style={rowLine}>
                      <span style={{ color: c.textSecondary || "#64748b" }}>% of home price</span>
                      <span style={{ fontWeight: 600 }}>{spmi.costPct.toFixed(3)}%</span>
                    </div>
                  )}
                </div>
                {/* SPMI premium override */}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>SPMI premium override:</span>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ ...inpStyle, background: isDark ? "#1A2530" : "#E8EEF5", borderRight: "none", borderRadius: "6px 0 0 6px" }}>$</span>
                    <input type="text" onFocus={(e) => e.target.select()} inputMode="numeric"
                      placeholder={"~" + spmi.costEst.toLocaleString("en-US")}
                      value={spmiOvr ? Number(spmiOvr).toLocaleString("en-US") : ""}
                      onChange={function(e) { setSpmiOvr(e.target.value.replace(/[^0-9]/g, "")); }}
                      style={{ ...inpStyle, borderRadius: "0 6px 6px 0", width: 110 }}
                    />
                  </div>
                  {spmiOvr && <button onClick={function() { setSpmiOvr(""); }} style={{ fontSize: 11, color: c.textSecondary || "#64748b", background: "none", border: "none", cursor: "pointer" }}>✕ clear</button>}
                </div>
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 7, background: isDark ? "#071A24" : "#E8F6FB", fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
                  P&I is unchanged — PMI is eliminated via a one-time upfront premium paid at closing. Typically funded by seller concessions or a builder incentive. Verify actual SPMI rate with your lender/MI company.
                </div>
              </div>
            );
          })()}

          {/* Card 5: Lender-Paid MI (LPMI) */}
          {analysis.lpmi && (function() {
            var lpmi      = analysis.lpmi;
            var noMIOther = monthlyOther - monthlyPMI;
            var newPITI   = Math.round(lpmi.newPI + noMIOther);
            var netPos    = lpmi.netMonthlySav > 0;
            var inpStyle  = { padding: "6px 8px", border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"), fontSize: 13, fontFamily: font, background: isDark ? "#1A2530" : "#fff", color: c.text || "#1B2A3B", outline: "none" };
            return (
              <div style={{ background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid #7C3AED", borderRadius: 12, padding: "18px 20px" }}>
                <div style={stratLbl}>Option 5 · Lender-Paid MI (LPMI) — Conventional</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
                  <div style={stratMain}>No upfront cost</div>
                  <div style={{ fontSize: 13, color: netPos ? green : (isDark ? "#FF8080" : "#C02020") }}>
                    {netPos
                      ? "−$" + lpmi.netMonthlySav.toLocaleString("en-US") + "/mo net PITI savings"
                      : "+$" + Math.abs(lpmi.netMonthlySav).toLocaleString("en-US") + "/mo net (rate increase exceeds PMI)"}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Rate adjustment</span>
                    <span style={{ fontWeight: 600, color: navy }}>+{lpmi.rateInc.toFixed(3)}%{lpmi.isEstimate ? " (est.)" : ""}</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>New P&I (at higher rate)</span>
                    <span style={{ fontWeight: 600, color: navy }}>${lpmi.newPI.toLocaleString("en-US")}/mo (+${lpmi.piIncrease.toLocaleString("en-US")})</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Monthly PMI eliminated</span>
                    <span style={{ fontWeight: 700, color: green }}>−${monthlyPMI.toLocaleString("en-US")}/mo</span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>Net monthly savings</span>
                    <span style={{ fontWeight: 700, color: netPos ? green : (isDark ? "#FF8080" : "#C02020") }}>
                      {netPos ? "$" + lpmi.netMonthlySav.toLocaleString("en-US") + "/mo" : "−$" + Math.abs(lpmi.netMonthlySav).toLocaleString("en-US") + "/mo"}
                    </span>
                  </div>
                  <div style={rowLine}>
                    <span style={{ color: c.textSecondary || "#64748b" }}>New PITI</span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: netPos ? green : navy }}>${newPITI.toLocaleString("en-US")}/mo</span>
                  </div>
                </div>
                {/* LPMI rate override */}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>Rate increase override:</span>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <input type="text" onFocus={(e) => e.target.select()} inputMode="decimal"
                      placeholder={"~" + lpmi.rateIncEst.toFixed(3)}
                      value={lpmiOvr || ""}
                      onChange={function(e) { setLpmiOvr(e.target.value.replace(/[^0-9.]/g, "")); }}
                      style={{ ...inpStyle, borderRadius: "6px 0 0 6px", width: 80 }}
                    />
                    <span style={{ ...inpStyle, background: isDark ? "#1A2530" : "#E8EEF5", borderLeft: "none", borderRadius: "0 6px 6px 0" }}>%</span>
                  </div>
                  {lpmiOvr && <button onClick={function() { setLpmiOvr(""); }} style={{ fontSize: 11, color: c.textSecondary || "#64748b", background: "none", border: "none", cursor: "pointer" }}>✕ clear</button>}
                </div>
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 7, background: isDark ? "#1A1028" : "#F5F0FF", fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
                  No upfront cost — lender covers MI in exchange for a slightly higher rate. Net savings depend on the rate adjustment. Verify exact rate bump with your lender.
                  {!netPos && " At this rate increase LPMI raises total payment — SPMI may be the better option."}
                </div>
              </div>
            );
          })()}

        </div>
      )}

      {/* Disclaimer */}
      {showResults && (
        <div style={{ marginTop: 16, padding: "11px 15px", background: isDark ? "#1A2535" : "#FFF8E7", border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"), borderLeft: "4px solid #E6A817", borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
          {" "}Permanent buydown uses 1 point per 0.25% reduction as an approximation — verify with your lender.
          Price reduction assumes {dpPct}% down payment remains constant. All calculations are estimates.
        </div>
      )}

    </div>
  );
}

window.TargetPaymentTab = TargetPaymentTab;
