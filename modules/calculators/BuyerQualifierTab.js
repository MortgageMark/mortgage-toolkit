// modules/calculators/BuyerQualifierTab.js
// Enter a buyer's max monthly budget and a target home price.
// Shows what they can afford, whether they hit the target, and what builder
// incentive would close any gap (via price reduction or 2/1 buydown).

const { useMemo, useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const COLORS_DARK     = window.COLORS_DARK;
const font            = window.font;

function BuyerQualifierTab() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;

  const navy   = c.navy   || "#1B3A5C";
  const border = c.border || "#D1D9E6";
  const green  = isDark ? "#5DE890" : "#1A7A3A";
  const red    = isDark ? "#FF8080" : "#C02020";

  // Read-only from Payment Calculator
  const [pcRate] = useLocalStorage("pc_rate", "");
  const [pcLA]   = useLocalStorage("pc_la",   "");
  const [pcTerm] = useLocalStorage("pc_term", "30");
  const [pcHP]   = useLocalStorage("pc_hp",   "");
  const [pcDP]   = useLocalStorage("pc_dp",   "10");
  const [dtiTax] = useLocalStorage("dti_tax", "0");
  const [dtiIns] = useLocalStorage("dti_ins", "0");
  const [dtiPMI] = useLocalStorage("dti_pmi", "0");

  // Inputs editable in this tab (pre-seeded from PC)
  const [maxBudget,   setMaxBudget]   = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [dpInput,     setDpInput]     = useState("");

  const noteRate     = parseFloat(pcRate) || 0;
  const la           = parseFloat(pcLA)   || 0;
  const term         = parseInt(pcTerm)   || 30;
  const hp           = parseFloat(pcHP)   || 0;
  const dpPct        = parseFloat(dpInput || pcDP) || 10;
  const dpAmt        = hp > 0 && dpPct > 0 ? Math.round(hp * dpPct / 100) : null;
  const monthlyOther = (parseFloat(dtiTax) || 0)
                     + (parseFloat(dtiIns) || 0)
                     + (parseFloat(dtiPMI) || 0);
  const hasPITI = monthlyOther > 0;
  const hasRate = noteRate > 0;

  const budgetNum  = parseFloat((maxBudget  || "").replace(/,/g, "")) || 0;
  const targetNum  = parseFloat((targetPrice || "").replace(/,/g, "")) || parseFloat(pcHP) || 0;

  const analysis = useMemo(function() {
    if (!hasRate || budgetNum <= 0) return null;
    var r = noteRate / 100 / 12;
    var n = term * 12;
    var pvFactor = r > 0 ? r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : 1 / n;

    // Max loan = max_PI / pvFactor  (max_PI = budget minus non-PI monthly costs)
    var maxPI   = Math.max(budgetNum - monthlyOther, 0);
    var maxLoan = maxPI / pvFactor;
    // Max home price = max_loan / (1 - dp/100)
    var dpFrac  = (100 - dpPct) / 100;
    var maxPrice = dpFrac > 0 ? maxLoan / dpFrac : null;

    var atTarget = null;
    var gapMonthly = null;
    if (targetNum > 0) {
      var targetLoan  = targetNum * dpFrac;
      var targetPI    = pmt(r, n, targetLoan);
      var targetPITI  = targetPI + monthlyOther;
      gapMonthly = targetPITI - budgetNum; // positive = over budget

      // 2/1 buydown cost at target price
      var yr1Rate  = Math.max(noteRate - 2, 0.001);
      var yr2Rate  = Math.max(noteRate - 1, 0.001);
      var yr1Pmt   = pmt(yr1Rate / 100 / 12, n, targetLoan);
      var yr2Pmt   = pmt(yr2Rate / 100 / 12, n, targetLoan);
      var bdCost   = Math.round((targetPI - yr1Pmt) * 12 + (targetPI - yr2Pmt) * 12);

      // Price reduction needed to close gap: gapMonthly/pvFactor = loan_reduction; price_red = loan_red/dpFrac
      var loanRedNeeded  = gapMonthly > 0 ? gapMonthly / pvFactor : 0;
      var priceRedNeeded = dpFrac > 0 ? Math.round(loanRedNeeded / dpFrac) : 0;

      // 2/1 buydown: does year 1 payment fit budget?
      var yr1PITI = yr1Pmt + monthlyOther;
      var yr1Gap  = yr1PITI - budgetNum;

      atTarget = {
        loan:          Math.round(targetLoan),
        pi:            Math.round(targetPI),
        piti:          Math.round(targetPITI),
        gapMonthly:    Math.round(gapMonthly),
        overBudget:    gapMonthly > 0,
        priceRedNeeded: priceRedNeeded,
        bdCost:        bdCost,
        yr1Pmt:        Math.round(yr1Pmt),
        yr2Pmt:        Math.round(yr2Pmt),
        fullPmt:       Math.round(targetPI),
        yr1PITI:       Math.round(yr1PITI),
        yr1Gap:        Math.round(yr1Gap),
        yr1Rate:       yr1Rate,
        yr2Rate:       yr2Rate,
        yr1MeetsTarget: yr1Gap <= 0,
      };
    }

    return {
      maxPI:    Math.round(maxPI),
      maxLoan:  Math.round(maxLoan),
      maxPrice: maxPrice != null ? Math.round(maxPrice) : null,
      dpPct:    dpPct,
      atTarget: atTarget,
    };
  }, [noteRate, term, dpPct, budgetNum, targetNum, monthlyOther, hasRate]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasRate) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: c.textSecondary || "#64748b", fontFamily: font }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.text || "#1B2A3B", marginBottom: 8 }}>
          No interest rate yet
        </div>
        <div style={{ fontSize: 13 }}>
          Enter an interest rate in the <strong>Payment Calculator</strong> tab first.
        </div>
      </div>
    );
  }

  var basePmt = la > 0 ? Math.round(pmt(noteRate / 100 / 12, term * 12, la)) : null;

  const rowSt = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 0", borderBottom: "1px solid " + border, fontSize: 13,
  };
  const secHead = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
    color: c.textSecondary || "#64748b", marginBottom: 8, marginTop: 16,
  };

  return (
    <div style={{ padding: 20, fontFamily: font, maxWidth: 880, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.text || "#1B2A3B" }}>
          Buyer Qualifier
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginTop: 4 }}>
          Enter the buyer's maximum monthly payment and a target home price to see if they qualify — and what the builder can do to close any gap.
        </div>
      </div>

      {/* Loan summary card */}
      {basePmt != null && (() => {
        var rows = [
          hp > 0    ? { label: "Purchase Price", value: "$" + hp.toLocaleString("en-US") }                                                               : null,
          dpPct > 0 ? { label: "Down Payment",   value: (dpAmt ? "$" + dpAmt.toLocaleString("en-US") + " (" + dpPct + "%)" : dpPct + "%") }              : null,
          { label: "Loan Amount",   value: "$" + la.toLocaleString("en-US") },
          { label: "Term",          value: term + " years" },
          { label: "Rate",          value: noteRate.toFixed(3) + "%" },
          { label: "Payment (P&I)", value: "$" + basePmt.toLocaleString("en-US") + "/mo", bold: true },
          hasPITI ? { label: "Payment (PITI)", value: "$" + (basePmt + Math.round(monthlyOther)).toLocaleString("en-US") + "/mo", bold: true } : null,
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

      {/* Input section */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16,
        marginBottom: 24, padding: "20px",
        background: isDark ? "#0D1820" : "#F5F8FA",
        borderRadius: 10, border: "1px solid " + border,
      }}>
        {/* Max budget */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.textSecondary || "#64748b", display: "block", marginBottom: 6 }}>
            Max Monthly Payment (PITI)
          </label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ padding: "10px 12px", background: isDark ? "#1A2530" : "#E8EEF5", border: "1px solid " + border, borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 15, color: c.textSecondary || "#64748b", fontWeight: 600 }}>$</span>
            <input
              type="text"
              placeholder="e.g. 2,800"
              value={maxBudget}
              onChange={function(e) { setMaxBudget(e.target.value); }}
              style={{ padding: "10px 12px", borderRadius: "0 8px 8px 0", border: "1px solid " + border, fontSize: 15, fontFamily: font, background: isDark ? "#1A2530" : "#fff", color: c.text || "#1B2A3B", outline: "none", width: "100%", boxSizing: "border-box" }}
            />
          </div>
          {hasPITI && monthlyOther > 0 && (
            <div style={{ fontSize: 11, color: c.textSecondary || "#64748b", marginTop: 4 }}>
              T&I&nbsp;est:&nbsp;<strong>${Math.round(monthlyOther).toLocaleString("en-US")}/mo</strong>
            </div>
          )}
        </div>

        {/* Target home price */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.textSecondary || "#64748b", display: "block", marginBottom: 6 }}>
            Target Home Price
          </label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ padding: "10px 12px", background: isDark ? "#1A2530" : "#E8EEF5", border: "1px solid " + border, borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 15, color: c.textSecondary || "#64748b", fontWeight: 600 }}>$</span>
            <input
              type="text"
              placeholder={pcHP ? parseInt(pcHP).toLocaleString("en-US") : "e.g. 425,000"}
              value={targetPrice}
              onChange={function(e) { setTargetPrice(e.target.value); }}
              style={{ padding: "10px 12px", borderRadius: "0 8px 8px 0", border: "1px solid " + border, fontSize: 15, fontFamily: font, background: isDark ? "#1A2530" : "#fff", color: c.text || "#1B2A3B", outline: "none", width: "100%", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Down payment % */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.textSecondary || "#64748b", display: "block", marginBottom: 6 }}>
            Down Payment %
          </label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <input
              type="number"
              min="0" max="100" step="0.5"
              placeholder={pcDP || "10"}
              value={dpInput}
              onChange={function(e) { setDpInput(e.target.value); }}
              style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px", border: "1px solid " + border, borderRight: "none", fontSize: 15, fontFamily: font, background: isDark ? "#1A2530" : "#fff", color: c.text || "#1B2A3B", outline: "none", width: "100%", boxSizing: "border-box" }}
            />
            <span style={{ padding: "10px 12px", background: isDark ? "#1A2530" : "#E8EEF5", border: "1px solid " + border, borderLeft: "none", borderRadius: "0 8px 8px 0", fontSize: 15, color: c.textSecondary || "#64748b", fontWeight: 600 }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: c.textSecondary || "#64748b", marginTop: 4 }}>
            From Payment Calculator: {pcDP || 10}%
          </div>
        </div>

        {/* Rate / term (read-only context) */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: c.textSecondary || "#64748b", marginBottom: 4 }}>
            Rate / Term (from Payment Calc)
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: navy }}>{noteRate.toFixed(3)}%</div>
          <div style={{ fontSize: 13, color: c.textSecondary || "#64748b" }}>{term}-year term</div>
        </div>
      </div>

      {/* Results */}
      {!analysis && (
        <div style={{ padding: 32, textAlign: "center", color: c.textSecondary || "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👆</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Enter a max monthly payment to get started.</div>
        </div>
      )}

      {analysis && (
        <div style={{ display: "grid", gridTemplateColumns: analysis.atTarget ? "1fr 1fr" : "1fr", gap: 16 }}>

          {/* Card: Max Affordable */}
          <div style={{ background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid " + navy, borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: navy, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
              Max Affordable Purchase Price
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: navy, marginBottom: 4 }}>
              {analysis.maxPrice != null ? "$" + analysis.maxPrice.toLocaleString("en-US") : "—"}
            </div>
            <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginBottom: 16 }}>
              at {noteRate.toFixed(3)}% with {dpPct}% down
            </div>
            <div style={rowSt}>
              <span style={{ color: c.textSecondary || "#64748b" }}>Max P&I budget</span>
              <span style={{ fontWeight: 600 }}>${analysis.maxPI.toLocaleString("en-US")}/mo</span>
            </div>
            {hasPITI && (
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>T&I</span>
                <span style={{ fontWeight: 600 }}>${Math.round(monthlyOther).toLocaleString("en-US")}/mo</span>
              </div>
            )}
            <div style={rowSt}>
              <span style={{ color: c.textSecondary || "#64748b" }}>Max loan amount</span>
              <span style={{ fontWeight: 600 }}>${analysis.maxLoan.toLocaleString("en-US")}</span>
            </div>
            <div style={{ ...rowSt, borderBottom: "none" }}>
              <span style={{ color: c.textSecondary || "#64748b" }}>Down payment ({dpPct}%)</span>
              <span style={{ fontWeight: 600 }}>
                {analysis.maxPrice != null ? "$" + Math.round(analysis.maxPrice * dpPct / 100).toLocaleString("en-US") : "—"}
              </span>
            </div>
          </div>

          {/* Card: At Target Price */}
          {analysis.atTarget && (
            <div style={{
              background: isDark ? "#0f1e2c" : "#fff",
              border: "1.5px solid " + (analysis.atTarget.overBudget ? (isDark ? "#6A2020" : "#FFBBBB") : (isDark ? "#1A5A2A" : "#AAEEBB")),
              borderTop: "4px solid " + (analysis.atTarget.overBudget ? red : green),
              borderRadius: 12, padding: "20px 22px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>{analysis.atTarget.overBudget ? "⚠️" : "✅"}</span>
                <div style={{ fontSize: 13, fontWeight: 800, color: analysis.atTarget.overBudget ? red : green, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {analysis.atTarget.overBudget ? "Over Budget" : "Qualifies!"}
                </div>
              </div>
              <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginBottom: 4 }}>
                At ${targetNum.toLocaleString("en-US")} with {dpPct}% down:
              </div>
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Loan amount</span>
                <span style={{ fontWeight: 600 }}>${analysis.atTarget.loan.toLocaleString("en-US")}</span>
              </div>
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Monthly P&I</span>
                <span style={{ fontWeight: 600 }}>${analysis.atTarget.pi.toLocaleString("en-US")}/mo</span>
              </div>
              {hasPITI && (
                <div style={rowSt}>
                  <span style={{ color: c.textSecondary || "#64748b" }}>Full PITI</span>
                  <span style={{ fontWeight: 700, color: analysis.atTarget.overBudget ? red : green }}>
                    ${analysis.atTarget.piti.toLocaleString("en-US")}/mo
                  </span>
                </div>
              )}
              <div style={{ ...rowSt, borderBottom: analysis.atTarget.overBudget ? ("1px solid " + border) : "none" }}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Buyer budget</span>
                <span style={{ fontWeight: 600 }}>${budgetNum.toLocaleString("en-US")}/mo</span>
              </div>
              {analysis.atTarget.overBudget && (
                <div style={{ ...rowSt, borderBottom: "none" }}>
                  <span style={{ fontWeight: 700, color: red }}>Monthly gap</span>
                  <span style={{ fontWeight: 800, fontSize: 16, color: red }}>
                    +${analysis.atTarget.gapMonthly.toLocaleString("en-US")}/mo over budget
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Builder Solutions (only when over budget) */}
      {analysis && analysis.atTarget && analysis.atTarget.overBudget && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: c.text || "#1B2A3B", marginBottom: 14 }}>
            💡 Builder Solutions to Close the Gap
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>

            {/* Solution: Price Reduction */}
            <div style={{ flex: 1, minWidth: 220, background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid " + navy, borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: navy, marginBottom: 10 }}>🏷️ Price Reduction</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: navy, marginBottom: 4 }}>
                ${analysis.atTarget.priceRedNeeded.toLocaleString("en-US")}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginBottom: 12 }}>off the sale price</div>
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>New sale price</span>
                <span style={{ fontWeight: 600 }}>${Math.round(targetNum - analysis.atTarget.priceRedNeeded).toLocaleString("en-US")}</span>
              </div>
              <div style={{ ...rowSt, borderBottom: "none" }}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Rate stays</span>
                <span style={{ fontWeight: 600 }}>{noteRate.toFixed(3)}% for life</span>
              </div>
              <div style={{ marginTop: 12, padding: "7px 10px", background: isDark ? "#0A1A28" : "#F0F4FA", borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b" }}>
                Permanently lowers payment and total interest paid.
              </div>
            </div>

            {/* Solution: 2/1 Buydown */}
            <div style={{ flex: 1, minWidth: 220, background: isDark ? "#0f1e2c" : "#fff", border: "1.5px solid " + border, borderTop: "4px solid #1565C0", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#1565C0", marginBottom: 10 }}>📉 2/1 Buydown</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: navy, marginBottom: 4 }}>
                ${analysis.atTarget.bdCost.toLocaleString("en-US")}
              </div>
              <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginBottom: 12 }}>builder cost</div>
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Year 1 ({analysis.atTarget.yr1Rate.toFixed(3)}%)</span>
                <span style={{ fontWeight: 700, color: analysis.atTarget.yr1MeetsTarget ? green : red }}>
                  ${(hasPITI ? analysis.atTarget.yr1PITI : analysis.atTarget.yr1Pmt).toLocaleString("en-US")}/mo
                  {analysis.atTarget.yr1MeetsTarget ? " ✓" : " ✗"}
                </span>
              </div>
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Year 2 ({analysis.atTarget.yr2Rate.toFixed(3)}%)</span>
                <span style={{ fontWeight: 600, color: navy }}>${analysis.atTarget.yr2Pmt.toLocaleString("en-US")}/mo P&I</span>
              </div>
              <div style={{ ...rowSt, borderBottom: "none" }}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Year 3+ ({noteRate.toFixed(3)}%)</span>
                <span style={{ fontWeight: 600, color: navy }}>${analysis.atTarget.fullPmt.toLocaleString("en-US")}/mo P&I</span>
              </div>
              <div style={{ marginTop: 12, padding: "7px 10px", background: isDark ? "#0A1A28" : "#EEF4FF", borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b" }}>
                {analysis.atTarget.yr1MeetsTarget
                  ? "Year 1 payment meets the buyer's budget."
                  : "Year 1 payment still doesn't fully meet budget — consider combining with a price reduction."}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Disclaimer */}
      {analysis && (
        <div style={{ marginTop: 20, padding: "11px 15px", background: isDark ? "#1A2535" : "#FFF8E7", border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"), borderLeft: "4px solid #E6A817", borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
          {" "}This tool does not account for DTI qualification (income/debt ratios), credit score, or lender overlays.
          T&I estimates come from the Payment Calculator and may not reflect the actual tax/insurance for each home price.
          All figures are for illustration — verify with your lending team.
        </div>
      )}

    </div>
  );
}

window.BuyerQualifierTab = BuyerQualifierTab;
