// modules/calculators/PriceVsIncentiveTab.js
// Builder enters a dollar budget and sees it compared side-by-side as:
//   1) Price reduction  2) 2/1 buydown  3) 1/0 buydown  4) Closing cost assist

const { useMemo, useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const COLORS_DARK     = window.COLORS_DARK;
const font            = window.font;

function PriceVsIncentiveTab() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;

  const navy   = c.navy   || "#1B3A5C";
  const border = c.border || "#D1D9E6";
  const green  = isDark ? "#5DE890" : "#1A7A3A";

  // Read-only from Payment Calculator
  const [pcRate] = useLocalStorage("pc_rate", "");
  const [pcLA]   = useLocalStorage("pc_la",   "");
  const [pcTerm] = useLocalStorage("pc_term", "30");
  const [pcHP]   = useLocalStorage("pc_hp",   "");
  const [pcDP]   = useLocalStorage("pc_dp",   "10");
  const [dtiTax] = useLocalStorage("dti_tax", "0");
  const [dtiIns] = useLocalStorage("dti_ins", "0");
  const [dtiPMI] = useLocalStorage("dti_pmi", "0");

  // Builder's incentive budget (editable in this tab)
  const [budget, setBudget] = useState("");

  const noteRate     = parseFloat(pcRate) || 0;
  const la           = parseFloat(pcLA)   || 0;
  const term         = parseInt(pcTerm)   || 30;
  const hp           = parseFloat(pcHP)   || 0;
  const dpPct        = parseFloat(pcDP)   || 10;
  const dpAmt        = hp > 0 && dpPct > 0 ? Math.round(hp * dpPct / 100) : null;
  const monthlyOther = (parseFloat(dtiTax) || 0)
                     + (parseFloat(dtiIns) || 0)
                     + (parseFloat(dtiPMI) || 0);
  const hasPITI = monthlyOther > 0;
  const hasData = noteRate > 0 && la > 0;

  const budgetAmt = parseFloat((budget || "").replace(/,/g, "")) || 0;

  const analysis = useMemo(function() {
    if (!hasData || budgetAmt <= 0) return null;
    var r       = noteRate / 100 / 12;
    var n       = term * 12;
    var basePmt = pmt(r, n, la);
    var dpFrac  = (100 - dpPct) / 100; // fraction of price that is loan

    // ── Column 1: Price Reduction ──────────────────────────────────────────
    // Budget goes to reduce the sale price. Loan reduces by budget * dpFrac.
    var loanRedux  = budgetAmt * dpFrac;
    var newLoan1   = Math.max(la - loanRedux, 1);
    var newPmt1    = pmt(r, n, newLoan1);
    var savings1   = basePmt - newPmt1;
    var lifeSav1   = savings1 * n;
    var newPrice1  = hp > 0 ? Math.max(hp - budgetAmt, 0) : null;
    var col1 = {
      label:        "Price Reduction",
      icon:         "🏷️",
      accentColor:  navy,
      budgetUsed:   budgetAmt,
      leftover:     0,
      yr1Pmt:       Math.round(newPmt1),
      yr2Pmt:       Math.round(newPmt1),
      fullPmt:      Math.round(newPmt1),
      monthlySav:   Math.round(savings1),
      annualSav:    Math.round(savings1 * 12),
      lifeSav:      Math.round(lifeSav1),
      newPrice:     newPrice1 != null ? Math.round(newPrice1) : null,
      permanent:    true,
      summary:      "Permanently lowers loan by $" + Math.round(loanRedux).toLocaleString("en-US"),
    };

    // ── Column 2: 2/1 Buydown ─────────────────────────────────────────────
    var yr1Rate2 = Math.max(noteRate - 2, 0.001);
    var yr2Rate2 = Math.max(noteRate - 1, 0.001);
    var yr1Pmt2  = pmt(yr1Rate2 / 100 / 12, n, la);
    var yr2Pmt2  = pmt(yr2Rate2 / 100 / 12, n, la);
    var yr1Sav2  = basePmt - yr1Pmt2;
    var yr2Sav2  = basePmt - yr2Pmt2;
    var bdCost2  = Math.round(yr1Sav2 * 12 + yr2Sav2 * 12);
    var leftover2 = Math.max(budgetAmt - bdCost2, 0);
    var canFund2  = budgetAmt >= bdCost2;
    var col2 = {
      label:        "2/1 Buydown",
      icon:         "📉",
      accentColor:  "#1565C0",
      budgetUsed:   Math.min(budgetAmt, bdCost2),
      leftover:     leftover2,
      yr1Rate:      yr1Rate2,
      yr2Rate:      yr2Rate2,
      yr1Pmt:       Math.round(yr1Pmt2),
      yr2Pmt:       Math.round(yr2Pmt2),
      fullPmt:      Math.round(basePmt),
      monthlySav:   Math.round(yr1Sav2), // year 1 savings
      canFund:      canFund2,
      bdCost:       bdCost2,
      permanent:    false,
      summary:      canFund2
        ? "Fully funded" + (leftover2 > 0 ? " · $" + leftover2.toLocaleString("en-US") + " toward closing costs" : "")
        : "Budget short by $" + (bdCost2 - budgetAmt).toLocaleString("en-US"),
    };

    // ── Column 3: 1/0 Buydown ─────────────────────────────────────────────
    var yr1Rate3 = Math.max(noteRate - 1, 0.001);
    var yr1Pmt3  = pmt(yr1Rate3 / 100 / 12, n, la);
    var yr1Sav3  = basePmt - yr1Pmt3;
    var bdCost3  = Math.round(yr1Sav3 * 12);
    var leftover3 = Math.max(budgetAmt - bdCost3, 0);
    var canFund3  = budgetAmt >= bdCost3;
    var col3 = {
      label:        "1/0 Buydown",
      icon:         "📊",
      accentColor:  "#6A3DB0",
      budgetUsed:   Math.min(budgetAmt, bdCost3),
      leftover:     leftover3,
      yr1Rate:      yr1Rate3,
      yr2Rate:      noteRate,
      yr1Pmt:       Math.round(yr1Pmt3),
      yr2Pmt:       Math.round(basePmt),
      fullPmt:      Math.round(basePmt),
      monthlySav:   Math.round(yr1Sav3),
      canFund:      canFund3,
      bdCost:       bdCost3,
      permanent:    false,
      summary:      canFund3
        ? "Fully funded" + (leftover3 > 0 ? " · $" + leftover3.toLocaleString("en-US") + " toward closing costs" : "")
        : "Budget short by $" + (bdCost3 - budgetAmt).toLocaleString("en-US"),
    };

    // ── Column 4: Closing Cost Assist ─────────────────────────────────────
    var col4 = {
      label:        "Closing Cost Assist",
      icon:         "💰",
      accentColor:  "#1A7A3A",
      budgetUsed:   budgetAmt,
      leftover:     0,
      yr1Pmt:       Math.round(basePmt),
      yr2Pmt:       Math.round(basePmt),
      fullPmt:      Math.round(basePmt),
      monthlySav:   0,
      permanent:    false,
      summary:      "Reduces buyer's out-of-pocket at closing by $" + budgetAmt.toLocaleString("en-US"),
    };

    return {
      basePmt:    Math.round(basePmt),
      basePITI:   Math.round(basePmt + monthlyOther),
      columns:    [col1, col2, col3, col4],
    };
  }, [noteRate, la, term, hp, dpPct, monthlyOther, budgetAmt, hasData]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: c.textSecondary || "#64748b", fontFamily: font }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚖️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.text || "#1B2A3B", marginBottom: 8 }}>
          No loan data yet
        </div>
        <div style={{ fontSize: 13 }}>
          Enter an interest rate and loan amount in the <strong>Payment Calculator</strong> tab first.
        </div>
      </div>
    );
  }

  var basePmt = Math.round(pmt(noteRate / 100 / 12, term * 12, la));

  const colCard = function(col) {
    var rowSt = {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderBottom: "1px solid " + border, fontSize: 13,
    };
    return (
      <div key={col.label} style={{
        flex: 1, minWidth: 200,
        background: isDark ? "#0f1e2c" : "#fff",
        border: "1.5px solid " + border,
        borderTop: "4px solid " + col.accentColor,
        borderRadius: 12, padding: "18px 20px",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ fontSize: 18, marginBottom: 6 }}>{col.icon}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: col.accentColor, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          {col.label}
        </div>

        {/* Budget usage */}
        <div style={{ marginBottom: 12, padding: "8px 12px", background: isDark ? "#0A1A28" : "#F5F8FA", borderRadius: 7, border: "1px solid " + border }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: c.textSecondary || "#64748b", letterSpacing: "0.04em", marginBottom: 4 }}>
            Budget Usage
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: navy }}>
            ${col.budgetUsed.toLocaleString("en-US")}
          </div>
          {col.leftover > 0 && (
            <div style={{ fontSize: 11, color: green, fontWeight: 600, marginTop: 2 }}>
              + ${col.leftover.toLocaleString("en-US")} toward closing costs
            </div>
          )}
          {"canFund" in col && !col.canFund && (
            <div style={{ fontSize: 11, color: isDark ? "#FF8080" : "#C02020", fontWeight: 600, marginTop: 2 }}>
              ⚠ Budget is ${(col.bdCost - budgetAmt).toLocaleString("en-US")} short
            </div>
          )}
        </div>

        {/* Payment schedule */}
        {col.yr1Rate != null ? (
          <div>
            <div style={rowSt}>
              <span style={{ color: c.textSecondary || "#64748b" }}>Year 1 ({col.yr1Rate.toFixed(3)}%)</span>
              <span style={{ fontWeight: 700, color: col.monthlySav > 0 ? green : c.text || "#1B2A3B" }}>
                ${col.yr1Pmt.toLocaleString("en-US")}/mo
              </span>
            </div>
            {col.yr2Rate != null && (
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>
                  {col.label === "2/1 Buydown" ? "Year 2 (" + col.yr2Rate.toFixed(3) + "%)" : "Year 2+ (" + noteRate.toFixed(3) + "%)"}
                </span>
                <span style={{ fontWeight: 600, color: c.text || "#1B2A3B" }}>
                  ${col.yr2Pmt.toLocaleString("en-US")}/mo
                </span>
              </div>
            )}
            {col.label === "2/1 Buydown" && (
              <div style={rowSt}>
                <span style={{ color: c.textSecondary || "#64748b" }}>Year 3+ ({noteRate.toFixed(3)}%)</span>
                <span style={{ fontWeight: 600, color: c.text || "#1B2A3B" }}>
                  ${col.fullPmt.toLocaleString("en-US")}/mo
                </span>
              </div>
            )}
          </div>
        ) : col.permanent ? (
          <div>
            <div style={rowSt}>
              <span style={{ color: c.textSecondary || "#64748b" }}>Every month</span>
              <span style={{ fontWeight: 700, color: green }}>${col.yr1Pmt.toLocaleString("en-US")}/mo</span>
            </div>
          </div>
        ) : (
          <div>
            <div style={rowSt}>
              <span style={{ color: c.textSecondary || "#64748b" }}>Every month</span>
              <span style={{ fontWeight: 600, color: c.text || "#1B2A3B" }}>${col.fullPmt.toLocaleString("en-US")}/mo</span>
            </div>
          </div>
        )}

        {/* PITI */}
        {hasPITI && (
          <div style={rowSt}>
            <span style={{ color: c.textSecondary || "#64748b" }}>Year 1 PITI</span>
            <span style={{ fontWeight: 600, color: c.text || "#1B2A3B" }}>
              ${(col.yr1Pmt + Math.round(monthlyOther)).toLocaleString("en-US")}/mo
            </span>
          </div>
        )}

        {/* Savings */}
        {col.monthlySav > 0 && (
          <div style={{ ...rowSt, borderBottom: "none" }}>
            <span style={{ color: c.textSecondary || "#64748b" }}>
              {col.permanent ? "Monthly savings (forever)" : "Year 1 monthly savings"}
            </span>
            <span style={{ fontWeight: 700, color: green }}>+${col.monthlySav.toLocaleString("en-US")}/mo</span>
          </div>
        )}
        {col.permanent && col.lifeSav > 0 && (
          <div style={{ ...rowSt, borderBottom: "none" }}>
            <span style={{ color: c.textSecondary || "#64748b" }}>Life interest savings</span>
            <span style={{ fontWeight: 700, color: green }}>+${col.lifeSav.toLocaleString("en-US")}</span>
          </div>
        )}
        {col.monthlySav === 0 && (
          <div style={{ ...rowSt, borderBottom: "none" }}>
            <span style={{ color: c.textSecondary || "#64748b" }}>Payment impact</span>
            <span style={{ fontWeight: 600, color: c.textSecondary || "#64748b" }}>None</span>
          </div>
        )}

        {/* Summary pill */}
        <div style={{ marginTop: "auto", paddingTop: 12 }}>
          <div style={{ padding: "8px 11px", background: isDark ? "#0A1A28" : "#F0F6FF", borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
            {col.summary}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 20, fontFamily: font, maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.text || "#1B2A3B" }}>
          Price vs. Incentive Comparison
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginTop: 4 }}>
          Enter your incentive budget and see what it does in four different forms.
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

      {/* Budget input + current payment context */}
      <div style={{
        display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap",
        marginBottom: 24, padding: "16px 20px",
        background: isDark ? "#0D1820" : "#F0F6FF",
        borderRadius: 10, border: "1px solid " + border,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.textSecondary || "#64748b" }}>
            Builder Incentive Budget
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <span style={{ padding: "10px 12px", background: isDark ? "#1A2530" : "#E8EEF5", border: "1px solid " + border, borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 15, color: c.textSecondary || "#64748b", fontWeight: 600 }}>$</span>
            <input
              type="text"
              placeholder="e.g. 15,000"
              value={budget}
              onChange={function(e) { setBudget(e.target.value); }}
              style={{
                padding: "10px 12px", borderRadius: "0 8px 8px 0", border: "1px solid " + border,
                fontSize: 15, fontFamily: font, background: isDark ? "#1A2530" : "#fff",
                color: c.text || "#1B2A3B", outline: "none", width: 160,
              }}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: c.textSecondary || "#64748b", marginBottom: 4 }}>
            Current Base Payment
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: navy }}>
            ${basePmt.toLocaleString("en-US")}/mo P&I
          </div>
          <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginTop: 2 }}>
            {noteRate.toFixed(3)}% · ${la.toLocaleString("en-US")} loan · {term}-yr
          </div>
        </div>
        {hp > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: c.textSecondary || "#64748b", marginBottom: 4 }}>
              Home Price
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: navy }}>${hp.toLocaleString("en-US")}</div>
            <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginTop: 2 }}>
              {dpPct}% down · ${la.toLocaleString("en-US")} loan
            </div>
          </div>
        )}
      </div>

      {/* Comparison cards */}
      {budgetAmt <= 0 && (
        <div style={{ padding: 32, textAlign: "center", color: c.textSecondary || "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👆</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Enter your incentive budget above to see the comparison.</div>
        </div>
      )}

      {analysis && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          {analysis.columns.map(colCard)}
        </div>
      )}

      {/* Disclaimer */}
      {analysis && (
        <div style={{ marginTop: 16, padding: "11px 15px", background: isDark ? "#1A2535" : "#FFF8E7", border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"), borderLeft: "4px solid #E6A817", borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
          {" "}Price reduction assumes {dpPct}% down payment stays constant; loan reduction = {(100 - dpPct).toFixed(0)}% of price reduction.
          Buydown costs are P&I difference × months at each subsidized rate. Actual buydown and closing cost amounts are set at closing — verify with your lender.
        </div>
      )}

    </div>
  );
}

window.PriceVsIncentiveTab = PriceVsIncentiveTab;
