// modules/calculators/BuyDownsTab.js
// Read-only temporary buydown comparison tab.
// Reads rate, loan amount, and term directly from Payment Calculator localStorage keys.

const { useMemo, useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const COLORS_DARK     = window.COLORS_DARK;
const font            = window.font;

function BuyDownsTab() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;

  const navy        = c.navy   || "#1B3A5C";
  const border      = c.border || "#D1D9E6";
  const green       = isDark ? "#5DE890" : "#1A7A3A";
  const textSub     = c.textSecondary || "#64748b";
  const textMain    = c.text || "#1B2A3B";

  // Read-only from Payment Calculator
  const [pcRate] = useLocalStorage("pc_rate", "");
  const [pcLA]   = useLocalStorage("pc_la",   "");
  const [pcTerm] = useLocalStorage("pc_term", "30");
  const [pcHP]   = useLocalStorage("pc_hp",   "");
  const [pcDP]   = useLocalStorage("pc_dp",   "");

  // Monthly non-PI components
  const [dtiTax] = useLocalStorage("dti_tax", "0");
  const [dtiIns] = useLocalStorage("dti_ins", "0");
  const [dtiPMI] = useLocalStorage("dti_pmi", "0");

  // Selected program — persisted
  const [selectedProgId, setSelectedProgId] = useLocalStorage("byd_prog", "21");
  const [showFullTable, setShowFullTable]   = useState(false);

  const noteRate  = parseFloat(pcRate) || 0;
  const la        = parseFloat(pcLA)   || 0;
  const term      = parseInt(pcTerm)   || 30;
  const hp        = parseFloat(pcHP)   || 0;
  const dpPct     = parseFloat(pcDP)   || 0;
  const dpAmt     = hp > 0 && dpPct > 0 ? Math.round(hp * dpPct / 100) : null;
  const monthlyOther = (parseFloat(dtiTax) || 0)
                     + (parseFloat(dtiIns) || 0)
                     + (parseFloat(dtiPMI) || 0);
  const hasPITI = monthlyOther > 0;
  const hasData = noteRate > 0 && la > 0;

  const PROGRAMS = [
    { id: "321", name: "3/2/1 Buydown", offsets: [3, 2, 1] },
    { id: "21",  name: "2/1 Buydown",   offsets: [2, 1]    },
    { id: "111", name: "1/1/1 Buydown", offsets: [1, 1, 1] },
    { id: "11",  name: "1/1 Buydown",   offsets: [1, 1]    },
    { id: "10",  name: "1/0 Buydown",   offsets: [1]       },
  ];

  const data = useMemo(() => {
    if (!hasData) return [];
    var r     = noteRate / 100 / 12;
    var n     = term * 12;
    var mktPI = Math.round(pmt(r, n, la));

    return PROGRAMS.map(function(prog) {
      var yearRows = prog.offsets.map(function(offset, i) {
        var adjRate    = Math.max(noteRate - offset, 0.001);
        var pi         = Math.round(pmt(adjRate / 100 / 12, n, la));
        var savings    = mktPI - pi;
        return {
          year:          i + 1,
          rate:          adjRate,
          pi:            pi,
          savings:       savings,
          annualSavings: savings * 12,
          subsidy:       savings * 12,
        };
      });
      var totalCost = yearRows.reduce(function(s, r) { return s + r.subsidy; }, 0);
      var costPct   = hp > 0 ? totalCost / hp * 100 : null;
      var laPct     = la > 0 ? totalCost / la * 100 : null;
      return { id: prog.id, name: prog.name, yearRows: yearRows, totalCost: totalCost, costPct: costPct, laPct: laPct, mktPI: mktPI };
    });
  }, [noteRate, la, term, hp]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: textSub, fontFamily: font }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📉</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: textMain, marginBottom: 8 }}>
          No loan data yet
        </div>
        <div style={{ fontSize: 13 }}>
          Enter an interest rate and loan amount in the <strong>Payment Calculator</strong> tab to see buydown options.
        </div>
      </div>
    );
  }

  var maxYrs       = Math.max.apply(null, data.map(function(p) { return p.yearRows.length; }));
  var mktPI        = data.length > 0 ? data[0].mktPI : 0;
  var mktPITI      = mktPI + Math.round(monthlyOther);
  var selectedProg = data.find(function(d) { return d.id === selectedProgId; }) || data[1];

  // ── Shared row style ───────────────────────────────────────────────────────
  var rowLine = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 0", borderBottom: "1px solid " + border, fontSize: 13,
  };

  // ── Full-table styles ──────────────────────────────────────────────────────
  var hdSt = {
    padding: "10px 14px", fontSize: 12, fontWeight: 800, color: "#fff",
    textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.15)",
  };
  var lbSt = {
    padding: "9px 14px", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.04em",
    color: textSub, textAlign: "left",
    whiteSpace: "nowrap", borderBottom: "1px solid " + border,
    background: isDark ? "#0D1820" : "#F5F8FA",
  };
  var tdSt = {
    padding: "9px 10px", textAlign: "center",
    borderBottom: "1px solid " + border,
    borderLeft: "1px solid " + border,
    verticalAlign: "middle",
  };

  return (
    <div style={{ padding: 20, fontFamily: font, maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: textMain }}>
          Temporary Buydowns
        </div>
      </div>

      {/* ── LOAN DETAILS ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: navy }}>
          Loan Details
        </div>
        <div style={{ fontSize: 11, color: textSub, marginTop: 1 }}>
          Pulled live from the Payment Calculator — update values there to refresh.
        </div>
      </div>
      <div style={{ marginBottom: 22, padding: "12px 18px", background: isDark ? "#0D1820" : "#F5F8FA", borderRadius: 10, border: "1px solid " + border, display: "inline-block", minWidth: 260 }}>
        {[
          hp > 0    ? { label: "Purchase Price",  value: "$" + hp.toLocaleString("en-US") } : null,
          dpPct > 0 ? { label: "Down Payment",    value: (dpAmt ? "$" + dpAmt.toLocaleString("en-US") + " (" + dpPct + "%)" : dpPct + "%") } : null,
          { label: "Loan Amount",   value: "$" + la.toLocaleString("en-US") },
          { label: "Term",          value: term + " years" },
          { label: "Rate",          value: noteRate.toFixed(3) + "%" },
          { label: "Payment (P&I)", value: "$" + mktPI.toLocaleString("en-US") + "/mo", bold: true },
          hasPITI ? { label: "Payment (PITI)", value: "$" + mktPITI.toLocaleString("en-US") + "/mo", bold: true } : null,
        ].filter(Boolean).map(function(row, i) {
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "3px 0" }}>
              <span style={{ fontSize: 12, color: isDark ? "#4A7A90" : "#94A3B8", lineHeight: 1, flexShrink: 0 }}>•</span>
              <span style={{ fontSize: 13, color: textSub, minWidth: 130, flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: row.bold ? 700 : 500, color: row.bold ? navy : textMain }}>{row.value}</span>
            </div>
          );
        })}
      </div>

      {/* ── BUILDER COST SUMMARY ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: navy }}>
          Builder Cost by Program
        </div>
        <div style={{ fontSize: 11, color: textSub, marginTop: 1 }}>
          Click a row to view the full breakdown below.
        </div>
      </div>
      <div style={{ marginBottom: 24, borderRadius: 10, overflow: "hidden", border: "1.5px solid " + border, boxShadow: "0 2px 6px rgba(0,20,60,0.05)" }}>
        {/* Summary table header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", background: navy, padding: "9px 14px", gap: 0 }}>
          {["Program", "Builder Cost", "% of Price", "Yr 1 Mo Savings"].map(function(h, i) {
            return (
              <div key={h} style={{ fontSize: 11, fontWeight: 800, color: "#fff", textAlign: i === 0 ? "left" : "right", padding: "0 10px" }}>
                {h}
              </div>
            );
          })}
        </div>
        {/* Summary rows */}
        {data.map(function(prog, idx) {
          var isSelected = prog.id === selectedProgId;
          var yr1Sav     = prog.yearRows.length > 0 ? prog.yearRows[0].savings : 0;
          var rowBg      = isSelected
            ? (isDark ? "#0A2040" : "#EAF3FF")
            : (idx % 2 === 0 ? (isDark ? "#111E2C" : "#fff") : (isDark ? "#0D1820" : "#F9FBFC"));
          return (
            <div
              key={prog.id}
              onClick={function() { setSelectedProgId(prog.id); }}
              style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto",
                padding: "10px 14px", cursor: "pointer",
                background: rowBg,
                borderBottom: idx < data.length - 1 ? "1px solid " + border : "none",
                transition: "background 0.12s",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: isSelected ? 800 : 500, color: isSelected ? navy : textMain, padding: "0 10px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
                {isSelected && <span style={{ color: navy, fontSize: 10 }}>▶</span>}
                {prog.name}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: navy, textAlign: "right", padding: "0 10px", minWidth: 100 }}>
                ${prog.totalCost.toLocaleString("en-US")}
              </div>
              <div style={{ fontSize: 12, color: textSub, textAlign: "right", padding: "0 10px", minWidth: 90 }}>
                {prog.costPct != null ? prog.costPct.toFixed(2) + "%" : "—"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: green, textAlign: "right", padding: "0 0 0 10px", minWidth: 110 }}>
                +${yr1Sav.toLocaleString("en-US")}/mo
              </div>
            </div>
          );
        })}
      </div>

      {/* ── BUYDOWN PROGRAM SELECTOR ──────────────────────────────────────── */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: navy }}>
            Buydown Program Details
          </label>
          <select
            value={selectedProgId}
            onChange={function(e) { setSelectedProgId(e.target.value); }}
            style={{
              padding: "9px 14px", borderRadius: 8,
              border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"),
              fontSize: 14, fontFamily: font, fontWeight: 700,
              background: isDark ? "#1A2530" : "#fff",
              color: navy, outline: "none", cursor: "pointer", minWidth: 180,
            }}
          >
            {PROGRAMS.map(function(p) {
              return <option key={p.id} value={p.id}>{p.name}</option>;
            })}
          </select>
        </div>
      </div>

      {/* ── DETAIL CARD for selected program ─────────────────────────────── */}
      {selectedProg && (function() {
        var yr1Sav  = selectedProg.yearRows.length > 0 ? selectedProg.yearRows[0].savings : 0;
        return (
          <div style={{
            marginBottom: 24, background: isDark ? "#0f1e2c" : "#fff",
            border: "1.5px solid " + border, borderTop: "4px solid " + navy,
            borderRadius: 12, padding: "18px 22px",
            boxShadow: "0 2px 8px rgba(0,20,60,0.06)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: textSub, marginBottom: 4 }}>
              {selectedProg.name}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: navy }}>
                ${selectedProg.totalCost.toLocaleString("en-US")}
              </div>
              <div style={{ fontSize: 13, color: textSub }}>
                builder cost
                {selectedProg.costPct != null ? " · " + selectedProg.costPct.toFixed(2) + "% of price" : ""}
              </div>
            </div>

            {/* Year-by-year rows */}
            {selectedProg.yearRows.map(function(yr) {
              var piti = yr.pi + Math.round(monthlyOther);
              return (
                <div key={"yr" + yr.year} style={rowLine}>
                  <span style={{ color: textSub, minWidth: 60 }}>Year {yr.year}</span>
                  <span style={{ fontWeight: 700, color: navy, minWidth: 70 }}>{yr.rate.toFixed(3)}%</span>
                  <span style={{ color: textMain }}>
                    P&amp;I ${yr.pi.toLocaleString("en-US")}/mo
                    {hasPITI ? "  ·  PITI $" + piti.toLocaleString("en-US") + "/mo" : ""}
                  </span>
                  <span style={{ fontWeight: 700, color: green }}>+${yr.savings.toLocaleString("en-US")}/mo saved</span>
                </div>
              );
            })}

            {/* Full-rate row */}
            <div style={{ ...rowLine, borderBottom: "none", opacity: 0.7 }}>
              <span style={{ color: textSub, minWidth: 60 }}>Year {selectedProg.yearRows.length + 1}+</span>
              <span style={{ fontWeight: 700, color: navy, minWidth: 70 }}>{noteRate.toFixed(3)}%</span>
              <span style={{ color: textMain }}>
                P&amp;I ${mktPI.toLocaleString("en-US")}/mo
                {hasPITI ? "  ·  PITI $" + mktPITI.toLocaleString("en-US") + "/mo" : ""}
              </span>
              <span style={{ color: textSub, fontSize: 11 }}>note rate</span>
            </div>

            {/* Year 1 savings callout */}
            <div style={{ marginTop: 14, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: isDark ? "#0A2A14" : "#F0FFF4", border: "1px solid " + (isDark ? "#1A5A2A" : "#AAEEBB") }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: textSub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Year 1 Monthly Savings</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: green }}>${yr1Sav.toLocaleString("en-US")}/mo</div>
              </div>
              <div style={{ flex: 1, padding: "10px 14px", borderRadius: 8, background: isDark ? "#0A1A28" : "#EEF4FF", border: "1px solid " + (isDark ? "#1A3A5A" : "#BFDBFE") }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: textSub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Builder Cost</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: navy }}>${selectedProg.totalCost.toLocaleString("en-US")}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── SHOW FULL COMPARISON toggle ───────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={function() { setShowFullTable(function(v) { return !v; }); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"),
            background: isDark ? "#0D1820" : "#F0F6FF",
            fontSize: 13, fontWeight: 700, color: navy,
            fontFamily: font, cursor: "pointer",
          }}
        >
          {showFullTable ? "▲ Hide full comparison table" : "▼ Show full comparison table"}
        </button>
      </div>

      {/* ── FULL COMPARISON TABLE (collapsed by default) ──────────────────── */}
      {showFullTable && (
        <div style={{ marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1.5px solid " + border, boxShadow: "0 2px 8px rgba(0,20,60,0.06)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...hdSt, background: navy, textAlign: "left", width: 130 }}></th>
                {data.map(function(prog) {
                  return (
                    <th key={prog.id} style={{ ...hdSt, background: navy }}>
                      {prog.name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxYrs }, function(_, yi) {
                var rowBg = yi % 2 === 0 ? (isDark ? "#111E2C" : "#fff") : (isDark ? "#0D1820" : "#F9FBFC");
                return (
                  <tr key={"yr" + yi} style={{ background: rowBg }}>
                    <td style={lbSt}>Year {yi + 1}</td>
                    {data.map(function(prog) {
                      var yr = prog.yearRows[yi];
                      if (!yr) {
                        return (
                          <td key={prog.id} style={{ ...tdSt, background: rowBg, color: textSub, fontSize: 11, fontStyle: "italic" }}>
                            full rate
                          </td>
                        );
                      }
                      var piti = yr.pi + Math.round(monthlyOther);
                      return (
                        <td key={prog.id} style={{ ...tdSt, background: rowBg }}>
                          <div style={{ fontWeight: 800, color: navy, fontSize: 15 }}>{yr.rate.toFixed(3)}%</div>
                          <div style={{ fontSize: 12, color: textMain, marginTop: 3 }}>
                            <span style={{ color: textSub, fontSize: 10 }}>P&I </span>
                            ${yr.pi.toLocaleString("en-US")}/mo
                          </div>
                          {hasPITI && (
                            <div style={{ fontSize: 12, color: textMain, marginTop: 1 }}>
                              <span style={{ color: textSub, fontSize: 10 }}>PITI </span>
                              ${piti.toLocaleString("en-US")}/mo
                            </div>
                          )}
                          <div style={{ fontSize: 11, fontWeight: 700, color: green, marginTop: 4 }}>
                            +${yr.savings.toLocaleString("en-US")}/mo saved
                          </div>
                          <div style={{ fontSize: 11, color: green, marginTop: 1 }}>
                            +${yr.annualSavings.toLocaleString("en-US")}/yr saved
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Full rate row */}
              <tr style={{ background: isDark ? "#0A1520" : "#EEF4F9" }}>
                <td style={{ ...lbSt, background: isDark ? "#0A1520" : "#E8EFF6" }}>
                  Year {maxYrs + 1}+
                </td>
                {data.map(function(prog) {
                  var fullPITI = prog.mktPI + Math.round(monthlyOther);
                  return (
                    <td key={prog.id} style={{ ...tdSt, background: isDark ? "#0A1520" : "#EEF4F9" }}>
                      <div style={{ fontWeight: 800, color: navy, fontSize: 14 }}>{noteRate.toFixed(3)}%</div>
                      <div style={{ fontSize: 10, color: textSub }}>note rate</div>
                      <div style={{ fontSize: 12, color: textMain, marginTop: 2 }}>
                        <span style={{ color: textSub, fontSize: 10 }}>P&I </span>
                        ${prog.mktPI.toLocaleString("en-US")}/mo
                      </div>
                      {hasPITI && (
                        <div style={{ fontSize: 12, color: textMain, marginTop: 1 }}>
                          <span style={{ color: textSub, fontSize: 10 }}>PITI </span>
                          ${fullPITI.toLocaleString("en-US")}/mo
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Divider */}
              <tr>
                <td colSpan={data.length + 1} style={{ padding: 0, height: 3, background: isDark ? "#1A3040" : "#C8E4F5" }} />
              </tr>

              {/* Builder cost row */}
              <tr style={{ background: isDark ? "#0D1B26" : "#EBF5FB" }}>
                <td style={{ ...lbSt, background: isDark ? "#0D1B26" : "#DDF0FB", color: navy, borderBottom: "none" }}>
                  Builder Cost
                </td>
                {data.map(function(prog) {
                  return (
                    <td key={prog.id} style={{ ...tdSt, background: isDark ? "#0D1B26" : "#EBF5FB", borderBottom: "none" }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: navy }}>
                        ${prog.totalCost.toLocaleString("en-US")}
                      </div>
                      {prog.costPct != null && (
                        <div style={{ fontSize: 10, color: textSub }}>{prog.costPct.toFixed(3)}% of price</div>
                      )}
                      {prog.laPct != null && (
                        <div style={{ fontSize: 10, color: textSub }}>{prog.laPct.toFixed(3)}% of loan</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        marginTop: 4, padding: "11px 15px",
        background: isDark ? "#1A2535" : "#FFF8E7",
        border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"),
        borderLeft: "4px solid #E6A817",
        borderRadius: 7, fontSize: 11, color: textSub, lineHeight: 1.6,
      }}>
        <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
        {" "}Buydown costs are estimates based on the monthly P&I difference at each year's subsidized rate.
        Actual buydown amounts are set at closing and may vary by lender.
        The note rate remains at {noteRate.toFixed(3)}% for the full loan term.
        {hasPITI && " PITI includes taxes, insurance, and PMI from the Payment Calculator."}
        {" "}Savings are relative to the full note rate payment.
      </div>

    </div>
  );
}

window.BuyDownsTab = BuyDownsTab;
