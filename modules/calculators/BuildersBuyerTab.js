// modules/calculators/BuildersBuyerTab.js
// Builder cost calculator: perm buydown, temp buydown, or both.
// Reads loan data from Payment Calculator.

const { useMemo, useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const COLORS_DARK     = window.COLORS_DARK;
const font            = window.font;

const BB_TEMP_PROGRAMS = [
  { id: "none", name: "None",          offsets: []        },
  { id: "10",   name: "1/0 Buydown",   offsets: [1]       },
  { id: "11",   name: "1/1 Buydown",   offsets: [1, 1]    },
  { id: "111",  name: "1/1/1 Buydown", offsets: [1, 1, 1] },
  { id: "21",   name: "2/1 Buydown",   offsets: [2, 1]    },
  { id: "321",  name: "3/2/1 Buydown", offsets: [3, 2, 1] },
];

function BuildersBuyerTab() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;
  const navy   = c.navy   || "#1B3A5C";
  const border = c.border || "#D1D9E6";
  const sec    = c.textSecondary || "#64748b";
  const green  = isDark ? "#5DE890" : "#1A7A3A";

  const [pdfLoading, setPdfLoading] = useState(false);

  // Read-only from Payment Calculator
  const [pcRate] = useLocalStorage("pc_rate", "");
  const [pcLA]   = useLocalStorage("pc_la",   "");
  const [pcTerm] = useLocalStorage("pc_term", "30");
  const [pcHP]   = useLocalStorage("pc_hp",   "");
  const [pcDP]   = useLocalStorage("pc_dp",   "");
  const [dtiTax] = useLocalStorage("dti_tax", "0");
  const [dtiIns] = useLocalStorage("dti_ins", "0");
  const [dtiPMI] = useLocalStorage("dti_pmi", "0");

  // Borrower name — from PQ letter key and contact keys set by MortgageToolkit on load
  const [pqApplicant]      = useLocalStorage("pq_applicant", "");
  const [contactFirstName] = useLocalStorage("abt_c1fn",     "");
  const [contactLastName]  = useLocalStorage("abt_c1ln",     "");

  // Builder selections — persisted
  const [bbPropAddr,    setBbPropAddr]    = useLocalStorage("bb_prop_addr",    "");
  const [bbPrice,       setBbPrice]       = useLocalStorage("bb_price",        "");
  const [bbConc,        setBbConc]        = useLocalStorage("bb_conc",         "");
  const [permRate,      setPermRate]      = useLocalStorage("bb_perm_rate",    "");
  const [tempProg,      setTempProg]      = useLocalStorage("bb_temp_prog",    "21");

  // LO identity — keys WITHOUT "mtk_" prefix; useLocalStorage adds it automatically
  const [loName]  = useLocalStorage("pq_lo",      "");
  const [loNmls]  = useLocalStorage("pq_lonmls",  "");
  const [loTitle] = useLocalStorage("pq_lotitle", "");

  // Scenario name + borrower fallback — parsed from active scenario JSON
  var scenarioName     = "";
  var scenarioBorrower = "";
  try {
    var _as = JSON.parse(localStorage.getItem("mtk_active_scenario") || "null");
    if (_as && _as.name) scenarioName = _as.name;
    if (_as && _as.calculationData && _as.calculationData["mtk_pq_applicant"]) {
      scenarioBorrower = _as.calculationData["mtk_pq_applicant"];
    }
  } catch(e) {}

  // Contact full name from MortgageToolkit propagation (most reliable source)
  var contactFullName = [contactFirstName, contactLastName].filter(Boolean).join(" ");

  // Effective borrower name: contact name → PQ key → scenario snapshot
  var displayBorrower = contactFullName.trim() || pqApplicant.trim() || scenarioBorrower.trim() || "";

  const noteRate     = parseFloat(pcRate) || 0;
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

  function stripNum(val) {
    return parseFloat((val || "").toString().replace(/[^0-9.]/g, "")) || 0;
  }

  const permRateNum   = parseFloat(permRate) || 0;
  const permRateValid = permRateNum > 0 && permRateNum < noteRate;
  const effectiveBase = permRateValid ? permRateNum : noteRate;
  const salesPrice    = stripNum(bbPrice);
  const concession    = stripNum(bbConc);

  const analysis = useMemo(function() {
    if (!hasData) return null;
    var n      = term * 12;
    var notePI = Math.round(pmt(noteRate / 100 / 12, n, la));

    // ── Permanent buydown ────────────────────────────────────────────
    var permCost   = 0;
    var permPoints = 0;
    var permPI     = notePI;
    if (permRateValid) {
      permPI     = Math.round(pmt(effectiveBase / 100 / 12, n, la));
      var steps  = Math.round((noteRate - effectiveBase) / 0.125);
      permPoints = steps * 0.5;
      permCost   = Math.round(la * permPoints / 100);
    }

    // ── Temporary buydown (applied on top of effectiveBase) ──────────
    var prog     = BB_TEMP_PROGRAMS.find(function(p) { return p.id === tempProg; }) || BB_TEMP_PROGRAMS[0];
    var tempCost = 0;
    if (prog.offsets.length > 0) {
      prog.offsets.forEach(function(offset) {
        var adjPI = Math.round(pmt(Math.max(effectiveBase - offset, 0.001) / 100 / 12, n, la));
        tempCost += (permPI - adjPI) * 12;
      });
      tempCost = Math.round(tempCost);
    }

    var totalCost = permCost + tempCost;
    var refPrice  = salesPrice > 0 ? salesPrice : (hp > 0 ? hp : 0);
    var remaining = concession > 0 ? concession - totalCost : null;

    return {
      notePI, permPI, permCost, permPoints, effectiveBase,
      tempCost, prog,
      totalCost,
      refPrice,
      remaining,
      hasPerm: permRateValid,
      hasTemp: prog.offsets.length > 0,
    };
  }, [hasData, noteRate, la, term, hp, permRateValid, effectiveBase, tempProg, salesPrice, concession]);

  // ── PDF download ───────────────────────────────────────────────────
  async function downloadPDF() {
    if (pdfLoading) return;
    setPdfLoading(true);
    await new Promise(function(r) { setTimeout(r, 100); });
    try {
      var el = document.getElementById("bb-print-zone");
      if (!el || !window.html2canvas || !window.jspdf) { setPdfLoading(false); return; }
      var { jsPDF } = window.jspdf;
      var canvas = await window.html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
        width: 900, windowWidth: 940,
      });
      var pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
      var pageW = 8.5, pageH = 11;
      var margin = 0.4;
      var contentW = pageW - margin * 2;
      var maxH     = pageH - margin * 2;
      var imgData  = canvas.toDataURL("image/png");
      // Always fill the full content width; scale down only if taller than the page
      var fitW = contentW;
      var fitH = (canvas.height / canvas.width) * fitW;
      if (fitH > maxH) {
        fitH = maxH;
        fitW = (canvas.width / canvas.height) * fitH;
      }
      var xOffset = (pageW - fitW) / 2;
      var yOffset = margin;
      pdf.addImage(imgData, "PNG", xOffset, yOffset, fitW, fitH);
      var nameForFile = displayBorrower || scenarioName || "builders-overview";
      pdf.save(nameForFile.replace(/\s+/g, "-") + ".pdf");
    } catch(e) {
      console.error("PDF error:", e);
    }
    setPdfLoading(false);
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: sec, fontFamily: font }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.text || "#1B2A3B", marginBottom: 8 }}>
          No loan data yet
        </div>
        <div style={{ fontSize: 13 }}>
          Enter an interest rate and loan amount in the <strong>Payment Calculator</strong> tab first.
        </div>
      </div>
    );
  }

  var basePmt  = Math.round(pmt(noteRate / 100 / 12, term * 12, la));
  var canPrint = analysis && (analysis.hasPerm || analysis.hasTemp);

  var today = new Date();
  var dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Shared input styles
  const labelSt = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.05em", color: sec, marginBottom: 5, display: "block",
  };
  const prefixSt = {
    padding: "10px 11px", fontSize: 14, fontWeight: 600, color: sec,
    background: isDark ? "#1A2530" : "#E8EEF5",
    border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"),
    borderRight: "none", borderRadius: "8px 0 0 8px", flexShrink: 0,
  };
  const suffixSt = {
    padding: "10px 11px", fontSize: 14, fontWeight: 600, color: sec,
    background: isDark ? "#1A2530" : "#E8EEF5",
    border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"),
    borderLeft: "none", borderRadius: "0 8px 8px 0", flexShrink: 0,
  };
  const inputSt = {
    flex: 1, padding: "10px 12px",
    border: "1.5px solid " + (isDark ? "#3A5A7A" : "#93B8D4"),
    fontSize: 15, fontFamily: font,
    background: isDark ? "#1A2530" : "#fff",
    color: c.text || "#1B2A3B", outline: "none", minWidth: 0,
  };

  function dollarDisplay(raw) {
    var n = parseInt((raw || "").toString().replace(/[^0-9]/g, ""), 10);
    return isNaN(n) || n === 0 ? "" : n.toLocaleString("en-US");
  }
  function dollarStrip(val) { return val.replace(/[^0-9]/g, ""); }

  // Summary row for the print zone — optionally right-align the value
  function SummaryRow(props) {
    return (
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "5px 0",
        borderBottom: props.last ? "none" : "1px solid #E8EEF5",
      }}>
        <span style={{ fontSize: 13, color: "#64748b", flexShrink: 0, marginRight: 8 }}>{props.label}</span>
        <span style={{
          fontSize: 13,
          fontWeight: props.bold ? 700 : 500,
          color: props.bold ? "#1B3A5C" : "#1B2A3B",
          textAlign: props.right ? "right" : "left",
        }}>
          {props.value}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: font, maxWidth: 800, margin: "0 auto" }}>

      {/* ── Header (outside print zone) ─────────────────────────────── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: c.text || "#1B2A3B" }}>
            Builder's Overview
          </div>
          <div style={{ fontSize: 12, color: sec, marginTop: 4 }}>
            📋 Loan data pulled from the <strong>Payment Calculator</strong> tab.
          </div>
        </div>
        {!pdfLoading && canPrint && (
          <button
            onClick={downloadPDF}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 700,
              background: navy, color: "#fff",
              border: "none", borderRadius: 8, cursor: "pointer",
              flexShrink: 0, marginLeft: 16, marginTop: 2,
            }}
          >
            ⬇ Save PDF
          </button>
        )}
        {pdfLoading && (
          <div style={{ fontSize: 12, color: sec, marginLeft: 16, marginTop: 8 }}>Generating…</div>
        )}
      </div>

      {/* ── Input Form (outside print zone) ─────────────────────────── */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 16,
        marginBottom: 28, padding: "18px 20px",
        background: isDark ? "#0D1820" : "#F0F6FF",
        borderRadius: 10, border: "1px solid " + border,
      }}>

        {/* Property address — full width */}
        <div>
          <label style={labelSt}>Property Address</label>
          <input
            type="text"
            placeholder="123 Main St, San Antonio, TX 78209"
            value={bbPropAddr}
            onChange={function(e) { setBbPropAddr(e.target.value); }}
            style={{ ...inputSt, borderRadius: 8, width: "100%", flex: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Row 1: Sales Price + Concession Amount */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelSt}>Sales Price</label>
            <div style={{ display: "flex" }}>
              <span style={prefixSt}>$</span>
              <input
                type="text" inputMode="numeric"
                placeholder="450,000"
                value={dollarDisplay(bbPrice)}
                onChange={function(e) { setBbPrice(dollarStrip(e.target.value)); }}
                style={inputSt}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelSt}>Concession Amount</label>
            <div style={{ display: "flex" }}>
              <span style={prefixSt}>$</span>
              <input
                type="text" inputMode="numeric"
                placeholder="10,000"
                value={dollarDisplay(bbConc)}
                onChange={function(e) { setBbConc(dollarStrip(e.target.value)); }}
                style={inputSt}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Perm Buydown Rate + Temp Buydown Program */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelSt}>Perm Buydown Rate</label>
            <div style={{ display: "flex" }}>
              <input
                type="number" min="0.125" step="0.125"
                value={permRate}
                onChange={function(e) { setPermRate(e.target.value); }}
                placeholder={(noteRate - 0.5).toFixed(3)}
                style={{ ...inputSt, borderRadius: "8px 0 0 8px", textAlign: "center" }}
              />
              <span style={suffixSt}>%</span>
            </div>
            {permRate && !permRateValid && (
              <div style={{ fontSize: 11, color: isDark ? "#FF8080" : "#C02020", marginTop: 5 }}>
                Must be less than {noteRate.toFixed(3)}%
              </div>
            )}
            {!permRate && (
              <div style={{ fontSize: 11, color: sec, marginTop: 5 }}>Leave blank for none</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={labelSt}>Temp Buydown Program</label>
            <select
              value={tempProg}
              onChange={function(e) { setTempProg(e.target.value); }}
              style={{ ...inputSt, borderRadius: 8, cursor: "pointer", width: "100%", flex: "none" }}
            >
              {BB_TEMP_PROGRAMS.map(function(prog) {
                return <option key={prog.id} value={prog.id}>{prog.name}</option>;
              })}
            </select>
          </div>
        </div>

      </div>

      {/* ══ PRINT ZONE ══════════════════════════════════════════════════ */}
      <div id="bb-print-zone" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Title header */}
        <div style={{
          background: "#1B3A5C", borderRadius: 10,
          padding: "20px 26px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Builder's Overview
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "0.01em" }}>
              {displayBorrower || scenarioName || "—"}
            </div>
            {bbPropAddr && (
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4, fontWeight: 500 }}>
                {bbPropAddr}
              </div>
            )}
            {scenarioName && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: bbPropAddr ? 2 : 4 }}>
                {scenarioName}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Prepared
            </div>
            <div style={{ fontSize: 14, color: "#fff", fontWeight: 600, marginTop: 3 }}>
              {dateStr}
            </div>
          </div>
        </div>

        {/* Two-column summary: Loan Details + Deal Parameters */}
        <div style={{ display: "flex", gap: 16 }}>

          {/* Loan Details */}
          <div style={{
            flex: 1, padding: "16px 20px",
            background: "#F5F8FA", borderRadius: 10,
            border: "1px solid #D1D9E6",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Loan Details
            </div>
            {hp > 0 && <SummaryRow label="Purchase Price" value={"$" + hp.toLocaleString("en-US")} />}
            {dpPct > 0 && <SummaryRow label="Down Payment" value={dpAmt ? "$" + dpAmt.toLocaleString("en-US") + " (" + dpPct + "%)" : dpPct + "%"} />}
            <SummaryRow label="Loan Amount"    value={"$" + la.toLocaleString("en-US")} />
            <SummaryRow label="Loan Term"      value={term + " years"} />
            <SummaryRow label="Note Rate"      value={noteRate.toFixed(3) + "%"} />
            <SummaryRow label="Payment (P&I)"  value={"$" + basePmt.toLocaleString("en-US") + "/mo"} bold={true} />
            {hasPITI
              ? <SummaryRow label="Payment (PITI)" value={"$" + (basePmt + Math.round(monthlyOther)).toLocaleString("en-US") + "/mo"} bold={true} last={true} />
              : null}
          </div>

          {/* Deal Parameters — values right-aligned */}
          <div style={{
            flex: 1, padding: "16px 20px",
            background: "#F5F8FA", borderRadius: 10,
            border: "1px solid #D1D9E6",
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1B3A5C", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Deal Parameters
            </div>
            {bbPropAddr && (
              <SummaryRow right label="Property" value={bbPropAddr} />
            )}
            {salesPrice > 0
              ? <SummaryRow right label="Sales Price" value={"$" + salesPrice.toLocaleString("en-US")} />
              : null}
            {concession > 0
              ? <SummaryRow right label="Concession" value={"$" + concession.toLocaleString("en-US") + (salesPrice > 0 ? " (" + (concession / salesPrice * 100).toFixed(2) + "%)" : "")} />
              : null}
            {analysis && analysis.hasPerm
              ? <SummaryRow right label="Perm Buydown" value={analysis.effectiveBase.toFixed(3) + "% (" + analysis.permPoints.toFixed(3) + " pts)"} />
              : <SummaryRow right label="Perm Buydown" value="None" />}
            <SummaryRow right label="Temp Buydown" value={analysis ? analysis.prog.name : "None"} last={true} />
          </div>

        </div>

        {/* ── Cost breakdown ────────────────────────────────────────── */}
        {analysis && (analysis.hasPerm || analysis.hasTemp) && (
          <div style={{
            borderRadius: 12, overflow: "hidden",
            border: "1.5px solid #D1D9E6",
            boxShadow: "0 2px 10px rgba(0,20,60,0.07)",
          }}>

            {/* Header row: title + concession amount */}
            <div style={{
              background: "#1B3A5C", padding: "14px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Builder Cost Breakdown
              </div>
              {concession > 0 && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
                    ${concession.toLocaleString("en-US")}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    concession
                  </div>
                </div>
              )}
            </div>

            {/* Waterfall rows */}
            <div style={{ background: "#fff" }}>

              {/* Perm buydown */}
              {analysis.hasPerm && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "16px 22px", borderBottom: "1px solid #D1D9E6",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1B2A3B" }}>
                      Permanent Buydown Cost
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {noteRate.toFixed(3)}% → {analysis.effectiveBase.toFixed(3)}%
                      &nbsp;·&nbsp; {analysis.permPoints.toFixed(3)} pts
                      {analysis.refPrice > 0 && (" · " + (analysis.permCost / analysis.refPrice * 100).toFixed(3) + "% of price")}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#C02020", flexShrink: 0, marginLeft: 20 }}>
                    −${analysis.permCost.toLocaleString("en-US")}
                  </div>
                </div>
              )}

              {/* Temp buydown */}
              {analysis.hasTemp && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "16px 22px", borderBottom: "1px solid #D1D9E6",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1B2A3B" }}>
                      {analysis.prog.name} Cost
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {analysis.hasPerm
                        ? "On top of " + analysis.effectiveBase.toFixed(3) + "% perm rate"
                        : "On top of " + noteRate.toFixed(3) + "% note rate"}
                      {analysis.refPrice > 0 && (" · " + (analysis.tempCost / analysis.refPrice * 100).toFixed(3) + "% of price")}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#C02020", flexShrink: 0, marginLeft: 20 }}>
                    −${analysis.tempCost.toLocaleString("en-US")}
                  </div>
                </div>
              )}

              {/* Total / Remaining */}
              <div style={{
                padding: "16px 22px",
                background: "#EBF5FB",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1B2A3B" }}>
                    {concession > 0 ? "Remaining Concession" : "Total Builder Cost"}
                  </div>
                  {analysis.refPrice > 0 && (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {concession > 0
                        ? "$" + concession.toLocaleString("en-US") + " − $" + analysis.totalCost.toLocaleString("en-US") + " in buydowns"
                        : (analysis.totalCost / analysis.refPrice * 100).toFixed(3) + "% of sales price"}
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 800,
                  color: concession > 0
                    ? (analysis.remaining >= 0 ? "#1A7A3A" : "#C02020")
                    : "#1B3A5C",
                  flexShrink: 0, marginLeft: 20,
                }}>
                  {concession > 0
                    ? (analysis.remaining >= 0 ? "$" : "−$") + Math.abs(analysis.remaining).toLocaleString("en-US")
                    : "$" + analysis.totalCost.toLocaleString("en-US")}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Placeholder when nothing selected */}
        {analysis && !analysis.hasPerm && !analysis.hasTemp && (
          <div style={{ padding: 32, textAlign: "center", color: sec, background: isDark ? "#0D1820" : "#F5F8FA", borderRadius: 10, border: "1px solid " + border }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>☝️</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Enter a perm buydown rate and/or select a temp buydown program above.
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{
          padding: "11px 16px",
          background: "#FFF8E7",
          border: "1px solid #F0D080",
          borderLeft: "4px solid #E6A817",
          borderRadius: 7, fontSize: 11, color: "#64748b", lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
          {" "}Perm buydown uses 0.5 pts per 0.125% reduction as an approximation.
          Temp buydown cost is the total P&amp;I subsidy across the buydown period.
          Verify actual costs with your lender.
        </div>

        {/* LO footer */}
        <div style={{
          borderTop: "2px solid #1B3A5C",
          paddingTop: 14,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
              Prepared by
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1B3A5C" }}>
              {loName || "—"}
            </div>
            {loTitle && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{loTitle}</div>
            )}
          </div>
          {loNmls && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                NMLS#
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1B3A5C" }}>{loNmls}</div>
            </div>
          )}
        </div>

      </div>
      {/* ══ END PRINT ZONE ══════════════════════════════════════════════ */}

    </div>
  );
}

window.BuildersBuyerTab = BuildersBuyerTab;
