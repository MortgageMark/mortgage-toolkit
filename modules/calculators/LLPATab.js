// modules/calculators/LLPATab.js
// Fannie Mae Loan-Level Price Adjustment (LLPA) Matrix
// Effective: 01/28/2026 — reads scenario fields from Payment Calculator, DTI, etc.
// Reference: https://singlefamily.fanniemae.com/media/9391/display

const { useState, useMemo } = React;
const useLocalStorage   = window.useLocalStorage;
const useThemeColors    = window.useThemeColors;
const COLORS            = window.COLORS;
const COLORS_DARK       = window.COLORS_DARK;
const font              = window.font;
const CONFORMING_LIMITS = window.CONFORMING_LIMITS;

// ── LLPA Data Tables (Fannie Mae, effective 01/28/2026) ────────────────────

// LTV bracket upper bounds (9 cols for purchase/LCOR, 5 cols for cash-out)
const LTV_BREAKS_STD = [30, 60, 70, 75, 80, 85, 90, 95, 101];
const LTV_LABELS_STD = ["≤30%","30–60%","60–70%","70–75%","75–80%","80–85%","85–90%","90–95%",">95%"];
const LTV_BREAKS_CO  = [30, 60, 70, 75, 80];
const LTV_LABELS_CO  = ["≤30%","30–60%","60–70%","70–75%","75–80%"];

// FICO brackets (row 0 = highest score)
const FICO_MINS   = [780, 760, 740, 720, 700, 680, 660, 640, 0];
const FICO_LABELS = ["≥ 780","760–779","740–759","720–739","700–719","680–699","660–679","640–659","≤ 639"];

function getLtvCol(ltv, isCashOut) {
  const breaks = isCashOut ? LTV_BREAKS_CO : LTV_BREAKS_STD;
  for (let i = 0; i < breaks.length; i++) { if (ltv <= breaks[i]) return i; }
  return breaks.length - 1;
}
function getFicoRow(fico) {
  for (let i = 0; i < FICO_MINS.length; i++) { if (fico >= FICO_MINS[i]) return i; }
  return FICO_MINS.length - 1;
}

// Base Credit Score / LTV grids  [ficoRow][ltvCol]
const PURCHASE_GRID = [
  [0.000, 0.000, 0.000, 0.000, 0.375, 0.375, 0.250, 0.250, 0.125],
  [0.000, 0.000, 0.000, 0.250, 0.625, 0.625, 0.500, 0.500, 0.250],
  [0.000, 0.000, 0.125, 0.375, 0.875, 1.000, 0.750, 0.625, 0.500],
  [0.000, 0.000, 0.250, 0.750, 1.250, 1.250, 1.000, 0.875, 0.750],
  [0.000, 0.000, 0.375, 0.875, 1.375, 1.500, 1.250, 1.125, 0.875],
  [0.000, 0.000, 0.625, 1.125, 1.750, 1.875, 1.500, 1.375, 1.125],
  [0.000, 0.000, 0.750, 1.375, 1.875, 2.125, 1.750, 1.625, 1.250],
  [0.000, 0.000, 1.125, 1.500, 2.250, 2.500, 2.000, 1.875, 1.500],
  [0.000, 0.125, 1.500, 2.125, 2.750, 2.875, 2.625, 2.250, 1.750],
];
const LCOR_GRID = [
  [0.000, 0.000, 0.000, 0.125, 0.500, 0.625, 0.500, 0.375, 0.375],
  [0.000, 0.000, 0.125, 0.375, 0.875, 1.000, 0.750, 0.625, 0.625],
  [0.000, 0.000, 0.250, 0.750, 1.125, 1.375, 1.125, 1.000, 1.000],
  [0.000, 0.000, 0.500, 1.000, 1.625, 1.750, 1.500, 1.250, 1.250],
  [0.000, 0.000, 0.625, 1.250, 1.875, 2.125, 1.750, 1.625, 1.625],
  [0.000, 0.000, 0.875, 1.625, 2.250, 2.500, 2.125, 1.750, 1.750],
  [0.000, 0.125, 1.125, 1.875, 2.500, 3.000, 2.375, 2.125, 2.125],
  [0.000, 0.250, 1.375, 2.125, 2.875, 3.375, 2.875, 2.500, 2.500],
  [0.000, 0.375, 1.750, 2.500, 3.500, 3.875, 3.625, 2.500, 2.500],
];
const CASHOUT_GRID = [
  [0.375, 0.375, 0.625, 0.875, 1.375],
  [0.375, 0.375, 0.875, 1.250, 1.875],
  [0.375, 0.375, 1.000, 1.625, 2.375],
  [0.375, 0.500, 1.375, 2.000, 2.750],
  [0.375, 0.500, 1.625, 2.625, 3.250],
  [0.375, 0.625, 2.000, 2.875, 3.750],
  [0.375, 0.875, 2.750, 4.000, 4.750],
  [0.375, 1.375, 3.125, 4.625, 5.125],
  [0.375, 1.375, 3.375, 4.875, 5.125],
];

// Supplemental LLPAs — Purchase & LCOR (indexed by LTV col, 9 cols)
const SUPP_STD = {
  arm:         [0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.250, 0.250],
  condo:       [0.000, 0.000, 0.125, 0.125, 0.750, 0.750, 0.750, 0.750, 0.750],
  investment:  [1.125, 1.125, 1.625, 2.125, 3.375, 4.125, 4.125, 4.125, 4.125],
  secondHome:  [1.125, 1.125, 1.625, 2.125, 3.375, 4.125, 4.125, 4.125, 4.125],
  units24:     [0.000, 0.000, 0.375, 0.375, 0.625, 0.625, 0.625, 0.625, 0.625],
  hbFixed:     [0.500, 0.500, 0.750, 0.750, 1.000, 1.000, 1.000, 1.000, 1.000],
  hbArm:       [1.250, 1.250, 1.500, 1.500, 2.500, 2.500, 2.500, 2.750, 2.750],
  subordinate: [0.625, 0.625, 0.625, 0.875, 1.125, 1.125, 1.125, 1.875, 1.875],
};

// Supplemental LLPAs — Cash-Out (5 cols, no ARM row)
const SUPP_CO = {
  condo:       [0.000, 0.000, 0.125, 0.125, 0.750],
  investment:  [1.125, 1.125, 1.625, 2.125, 3.375],
  secondHome:  [1.125, 1.125, 1.625, 2.125, 3.375],
  units24:     [0.000, 0.000, 0.375, 0.375, 0.625],
  hbFixed:     [1.250, 1.250, 1.500, 1.500, 1.750],
  hbArm:       [2.000, 2.000, 2.250, 2.250, 3.250],
  subordinate: [0.625, 0.625, 0.625, 0.875, 1.125],
};

// ── Component ──────────────────────────────────────────────────────────────

function LLPATab() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;

  // ── From Payment Calculator ─────────────────────────────────────────────
  const [pcFico]     = useLocalStorage("pc_fico",       "740");
  const [pcCoFico]   = useLocalStorage("pc_cofico",     "740");
  const [pcBorrowers]= useLocalStorage("pc_borrowers",  "1");
  const [pcHP]       = useLocalStorage("pc_hp",         "");
  const [pcLA]       = useLocalStorage("pc_la",         "");
  const [pcTerm]     = useLocalStorage("pc_term",       "30");
  const [pcLT]       = useLocalStorage("pc_lt",         "fixed"); // "fixed"|"arm"|"io"
  const [pcPurpose]  = useLocalStorage("pc_purpose",    "purchase"); // "purchase"|"refinance"|"cashOutRefi"
  const [pcProg]     = useLocalStorage("pc_prog",       "conventional");
  const [pcOcc]      = useLocalStorage("pc_occ",        "primary"); // "primary"|"vacation"|"investment"
  const [pcPropType] = useLocalStorage("pc_proptype",   "sfr"); // sfr|condo|townhome|duplex|3plex|4plex
  const [pc2ndOn]    = useLocalStorage("pc_2nd_enabled","false");
  const [pcDpaProg]  = useLocalStorage("pc_dpa_prog",   "none");

  // ── Manual overrides (stored with llpa_ prefix) ─────────────────────────
  const [manMfgHome,  setManMfgHome]  = useState(false);  // manufactured home
  const [manFTHBWaiver, setManFTHBWaiver] = useState(false); // FTHB income waiver
  const [manHomeReady,  setManHomeReady]  = useState(false); // manual HomeReady override

  // ── Computed inputs ─────────────────────────────────────────────────────
  const hp       = parseFloat(pcHP) || 0;
  const la       = parseFloat(pcLA) || 0;
  const term     = parseInt(pcTerm) || 30;
  const fico1    = parseInt(pcFico)    || 0;
  const fico2    = parseInt(pcCoFico)  || 0;
  const borrowers = parseInt(pcBorrowers) || 1;

  // Representative FICO = lower of all borrowers' middle scores
  const repFico  = borrowers > 1 ? Math.min(fico1, fico2) : fico1;

  const ltv      = (hp > 0 && la > 0) ? (la / hp * 100) : 0;
  const isConventional = pcProg === "conventional";
  const isCashOut  = pcPurpose === "cashOutRefi";
  const isLCOR     = pcPurpose === "refinance";
  const isArm      = pcLT === "arm";
  const isShortTerm = term <= 15; // credit/LTV grid doesn't apply to ≤15yr loans
  const isCondo    = pcPropType === "condo";
  const isInvestment = pcOcc === "investment";
  const isSecondHome = pcOcc === "vacation";
  const units      = pcPropType === "duplex" ? 2 : pcPropType === "3plex" ? 3 : pcPropType === "4plex" ? 4 : 1;
  const is24Units  = units >= 2;
  const hasSubordinate = pc2ndOn === "true" || pc2ndOn === true;
  const confLimit  = (CONFORMING_LIMITS && CONFORMING_LIMITS.baseline) || 806500;
  const isHighBalance = la > confLimit;

  // Waiver detection
  const dpaIsHomeReady = ["homeready","homeposs","hfa_fannie","hfa_freddie"].includes(pcDpaProg);
  const isWaived   = dpaIsHomeReady || manHomeReady || manFTHBWaiver;
  const waiverLabel = dpaIsHomeReady
    ? "HomeReady / Home Possible (via DPA program)" : manHomeReady
    ? "HomeReady (manual override)" : "First-Time Homebuyer — Income ≤ 100% AMI";

  // Grid selection
  const baseGrid   = isCashOut ? CASHOUT_GRID : isLCOR ? LCOR_GRID : PURCHASE_GRID;
  const suppGrid   = isCashOut ? SUPP_CO : SUPP_STD;
  const ltvLabels  = isCashOut ? LTV_LABELS_CO : LTV_LABELS_STD;

  const ficoRow    = repFico > 0 ? getFicoRow(repFico) : null;
  const ltvCol     = ltv > 0 ? getLtvCol(ltv, isCashOut) : null;

  // ── LLPA Line Items ─────────────────────────────────────────────────────
  const lineItems = useMemo(() => {
    if (!isConventional || isWaived || ficoRow === null || ltvCol === null) return [];
    const items = [];

    // 1. Base Credit Score / LTV (skipped for ≤15yr loans)
    if (!isShortTerm) {
      const base = baseGrid[ficoRow]?.[ltvCol] ?? 0;
      items.push({ key: "base", label: `Credit Score / LTV (${FICO_LABELS[ficoRow]}, ${ltvLabels[ltvCol]})`, value: base, isBase: true });
    }

    // 2. ARM
    if (isArm && !isCashOut) {
      const v = SUPP_STD.arm[ltvCol] ?? 0;
      if (v > 0) items.push({ key: "arm", label: "Adjustable-Rate Mortgage (ARM)", value: v });
    }

    // 3. Condo (attached)
    if (isCondo) {
      const v = (suppGrid.condo?.[ltvCol]) ?? 0;
      if (v > 0) items.push({ key: "condo", label: "Condo (Attached)", value: v });
    }

    // 4. Occupancy — investment or second home (mutually exclusive)
    if (isInvestment) {
      const v = (suppGrid.investment?.[ltvCol]) ?? 0;
      if (v > 0) items.push({ key: "invest", label: "Investment Property", value: v });
    } else if (isSecondHome) {
      const v = (suppGrid.secondHome?.[ltvCol]) ?? 0;
      if (v > 0) items.push({ key: "second", label: "Second Home", value: v });
    }

    // 5. Manufactured Home (flat 0.500% regardless of LTV)
    if (manMfgHome) {
      items.push({ key: "mfg", label: "Manufactured Home", value: 0.500 });
    }

    // 6. 2–4 Unit Property
    if (is24Units) {
      const v = (suppGrid.units24?.[ltvCol]) ?? 0;
      if (v > 0) items.push({ key: "units", label: `${units}-Unit Property`, value: v });
    }

    // 7. High-Balance
    if (isHighBalance) {
      const key = isArm ? "hbArm" : "hbFixed";
      const v = (suppGrid[key]?.[ltvCol]) ?? 0;
      if (v > 0) items.push({ key: "hb", label: `High-Balance Loan (${isArm ? "ARM" : "Fixed"})`, value: v });
    }

    // 8. Subordinate Financing
    if (hasSubordinate) {
      const v = (suppGrid.subordinate?.[ltvCol]) ?? 0;
      if (v > 0) items.push({ key: "sub", label: "Subordinate Financing (2nd Mortgage)", value: v });
    }

    return items;
  }, [isConventional, isWaived, ficoRow, ltvCol, isShortTerm, isArm, isCondo,
      isInvestment, isSecondHome, manMfgHome, is24Units, isHighBalance,
      hasSubordinate, isCashOut, baseGrid, suppGrid, ltvLabels, units]);

  const totalPts = isWaived ? 0 : lineItems.reduce((s, i) => s + i.value, 0);
  const totalDollar = la > 0 ? Math.round(totalPts / 100 * la) : null;

  // ── Style helpers ───────────────────────────────────────────────────────
  const border  = c.border || "#E0E8E8";
  const navy    = COLORS.navy;
  const fmtP    = (n, d = 3) => (n >= 0 ? "+" : "") + n.toFixed(d) + "%";
  const fmtPts  = n => n.toFixed(3) + "%";
  const fmtD    = n => "$" + Math.abs(Math.round(n)).toLocaleString("en-US");

  const labelSt = { fontSize: 11, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 };
  const cardSt  = { background: c.bgAlt || "#F9FBFC", border: "1px solid " + border, borderRadius: 10, padding: "18px 22px", marginBottom: 16 };
  const chipSt  = (active, color) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: active ? color + "22" : (c.bg || "#fff"),
    color: active ? color : (c.textSecondary || "#64748b"),
    border: "1px solid " + (active ? color + "55" : border),
    cursor: "pointer", userSelect: "none",
  });

  const purposeGridLabel = isCashOut ? "Cash-Out Refinance" : isLCOR ? "Limited Cash-Out Refinance" : "Purchase";

  const progName = { conventional:"Conventional", fha:"FHA", va:"VA", usda:"USDA", jumbo:"Jumbo" }[pcProg] || pcProg;
  const occName  = { primary:"Primary Residence", vacation:"Second Home", investment:"Investment Property" }[pcOcc] || pcOcc;
  const propName = { sfr:"Single Family (SFR)", townhome:"Townhome", condo:"Condo (Attached)", duplex:"2-Unit (Duplex)", "3plex":"3-Unit", "4plex":"4-Unit", other:"Other" }[pcPropType] || pcPropType;
  const ltName   = pcLT === "arm" ? `ARM` : pcLT === "io" ? "Interest-Only" : "Fixed";

  const Toggle3 = ({ label, checked, onChange }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: c.text || "#1B2A3B", fontFamily: font }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: COLORS.blue, cursor: "pointer" }} />
      {label}
    </label>
  );

  // ── Grid cell colors ────────────────────────────────────────────────────
  const cellColor = (val) => {
    if (val === 0)    return { bg: isDark ? "#0D2218" : "#F0FFF4", text: isDark ? "#3DB87A" : "#166534" };
    if (val <= 0.500) return { bg: isDark ? "#0D1E36" : "#EFF6FF", text: isDark ? "#60A5FA" : "#1D4ED8" };
    if (val <= 1.000) return { bg: isDark ? "#1C1F0D" : "#FEFCE8", text: isDark ? "#FDE047" : "#854D0E" };
    if (val <= 2.000) return { bg: isDark ? "#2E1A0D" : "#FFF7ED", text: isDark ? "#FB923C" : "#9A3412" };
    return              { bg: isDark ? "#2E0D0D" : "#FEF2F2", text: isDark ? "#F87171" : "#991B1B" };
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: font }}>

      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: c.navy || navy, letterSpacing: "-0.01em" }}>
          Fannie Mae LLPA Matrix
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginTop: 3 }}>
          Loan-Level Price Adjustments · Effective 01/28/2026 · Conventional conforming loans only
        </div>
      </div>

      {/* Non-conventional warning */}
      {!isConventional && (
        <div style={{ padding: "12px 16px", background: isDark ? "#2E2818" : "#FFF8E1", border: "1px solid #FFD54F", borderRadius: 8, color: isDark ? "#FDE047" : "#854D0E", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          ⚠️ LLPAs apply to conventional conforming loans only. Current program is <strong>{progName}</strong> — the LLPA matrix does not apply.
        </div>
      )}

      {/* ── Scenario Inputs ─────────────────────────────────────────────── */}
      <div style={cardSt}>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || navy, marginBottom: 14 }}>
          Scenario Inputs
          <span style={{ fontSize: 11, fontWeight: 400, color: c.textSecondary || "#64748b", marginLeft: 8 }}>pulled from Payment Calculator</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>

          <div>
            <span style={labelSt}>Rep. FICO Score</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: repFico >= 720 ? (c.green || COLORS.green) : repFico >= 660 ? (c.gold || COLORS.gold) : (c.red || COLORS.red) }}>
              {repFico > 0 ? repFico : "—"}
            </div>
            {borrowers > 1 && repFico > 0 && (
              <div style={{ fontSize: 10, color: c.textSecondary || "#64748b" }}>
                lower of {fico1} / {fico2}
              </div>
            )}
          </div>

          <div>
            <span style={labelSt}>LTV</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.navy || navy }}>
              {ltv > 0 ? ltv.toFixed(2) + "%" : "—"}
            </div>
            {ltv > 0 && ltvCol !== null && (
              <div style={{ fontSize: 10, color: c.textSecondary || "#64748b" }}>
                bracket: {ltvLabels[ltvCol]}
              </div>
            )}
          </div>

          <div>
            <span style={labelSt}>Loan Amount</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.navy || navy }}>
              {la > 0 ? "$" + la.toLocaleString("en-US") : "—"}
            </div>
            {isHighBalance && (
              <div style={{ fontSize: 10, color: c.gold || COLORS.gold, fontWeight: 700 }}>High-Balance</div>
            )}
          </div>

          <div>
            <span style={labelSt}>Loan Purpose</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text || "#1B2A3B" }}>{purposeGridLabel}</div>
          </div>

          <div>
            <span style={labelSt}>Program</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text || "#1B2A3B" }}>{progName}</div>
          </div>

          <div>
            <span style={labelSt}>Loan Type</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text || "#1B2A3B" }}>
              {ltName}{term <= 15 ? ` · ${term}yr` : ""}{isShortTerm ? " ⚠️" : ""}
            </div>
            {isShortTerm && <div style={{ fontSize: 10, color: c.textSecondary || "#64748b" }}>Grid n/a for ≤15yr</div>}
          </div>

          <div>
            <span style={labelSt}>Occupancy</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text || "#1B2A3B" }}>{occName}</div>
          </div>

          <div>
            <span style={labelSt}>Property Type</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text || "#1B2A3B" }}>{propName}</div>
          </div>

          <div>
            <span style={labelSt}>Subordinate 2nd</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: hasSubordinate ? (c.gold || COLORS.gold) : (c.textSecondary || "#64748b") }}>
              {hasSubordinate ? "Yes" : "No"}
            </div>
          </div>

        </div>

        {/* Manual override toggles */}
        <div style={{ borderTop: "1px solid " + border, paddingTop: 14, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", alignSelf: "center" }}>
            Manual Overrides:
          </div>
          <Toggle3 label="Manufactured Home" checked={manMfgHome} onChange={setManMfgHome} />
          <Toggle3 label="HomeReady / Home Possible" checked={manHomeReady} onChange={setManHomeReady} />
          <Toggle3 label="1st-Time Buyer (income ≤ 100% AMI)" checked={manFTHBWaiver} onChange={setManFTHBWaiver} />
        </div>
      </div>

      {/* ── LLPA Waiver Banner ──────────────────────────────────────────── */}
      {isWaived && isConventional && (
        <div style={{ padding: "12px 18px", background: isDark ? "#0D2218" : "#F0FFF4", border: "1px solid " + (isDark ? "#166534" : "#86EFAC"), borderRadius: 8, color: isDark ? "#4ADE80" : "#166534", fontSize: 13, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          ✅ LLPA Waiver Applied — {waiverLabel}
          <span style={{ fontWeight: 400, fontSize: 12 }}>All credit score/LTV LLPAs reduced to 0.000%</span>
        </div>
      )}

      {/* ── LLPA Breakdown ──────────────────────────────────────────────── */}
      {isConventional && (ficoRow !== null) && (ltvCol !== null) && (
        <div style={cardSt}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || navy, marginBottom: 14 }}>
            LLPA Breakdown
          </div>

          {lineItems.length === 0 && !isWaived && (
            <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>
              No LLPAs apply to this scenario.
            </div>
          )}

          {(lineItems.length > 0 || isWaived) && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
              <thead>
                <tr style={{ background: navy }}>
                  <th style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.03em" }}>Adjustment</th>
                  <th style={{ padding: "9px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.03em", minWidth: 100 }}>Points (%)</th>
                  <th style={{ padding: "9px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.03em", minWidth: 120 }}>Dollar Cost</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => {
                  const dollarAmt = la > 0 ? Math.round(item.value / 100 * la) : null;
                  return (
                    <tr key={item.key} style={{ background: item.isBase ? (isDark ? "#0D1E36" : "#EFF6FF") : "transparent" }}>
                      <td style={{ padding: "8px 14px", fontSize: 13, color: c.text || "#1B2A3B", borderBottom: "1px solid " + border, fontWeight: item.isBase ? 600 : 400 }}>
                        {item.label}
                        {item.isBase && <span style={{ marginLeft: 6, fontSize: 10, color: c.textSecondary || "#64748b" }}>(base)</span>}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: item.value > 0 ? (c.red || COLORS.red) : (c.green || COLORS.green), borderBottom: "1px solid " + border }}>
                        {fmtPts(item.value)}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: item.value > 0 ? (c.red || COLORS.red) : (c.textSecondary || "#64748b"), borderBottom: "1px solid " + border }}>
                        {dollarAmt !== null && item.value > 0 ? fmtD(dollarAmt) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {/* Total row */}
                <tr style={{ background: isDark ? "#0A1E30" : "#EBF5FB" }}>
                  <td style={{ padding: "10px 14px", fontSize: 14, fontWeight: 800, color: c.navy || navy }}>
                    Total LLPA
                    {isWaived && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: c.green || COLORS.green }}>(waived — 0.000%)</span>}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 15, fontWeight: 800, color: totalPts > 0 ? (c.red || COLORS.red) : (c.green || COLORS.green) }}>
                    {fmtPts(totalPts)}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 15, fontWeight: 800, color: totalPts > 0 ? (c.red || COLORS.red) : (c.textSecondary || "#64748b") }}>
                    {totalDollar !== null && totalPts > 0 ? fmtD(totalDollar) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {isShortTerm && (
            <div style={{ marginTop: 12, fontSize: 12, color: c.textSecondary || "#64748b" }}>
              ⚠️ Credit Score / LTV grid LLPAs do not apply to loans with terms of 15 years or less. Supplemental LLPAs (occupancy, property type, etc.) still apply.
            </div>
          )}
        </div>
      )}

      {/* Missing fields reminder */}
      {isConventional && (repFico === 0 || ltv === 0) && (
        <div style={{ padding: "12px 16px", background: c.bgAlt || "#F9FBFC", border: "1px solid " + border, borderRadius: 8, fontSize: 13, color: c.textSecondary || "#64748b", marginBottom: 16 }}>
          Enter <strong>Credit Score</strong>, <strong>Home Price</strong>, and <strong>Loan Amount</strong> in the Payment Calculator to populate the LLPA breakdown.
        </div>
      )}

      {/* ── Full FICO/LTV Grid ───────────────────────────────────────────── */}
      {isConventional && (
        <div style={cardSt}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || navy, marginBottom: 4 }}>
            Base LLPA Grid — {purposeGridLabel}
          </div>
          <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginBottom: 14 }}>
            Credit score / LTV component only · Supplemental adjustments (occupancy, property type, etc.) are additional
            {ficoRow !== null && ltvCol !== null && (
              <span style={{ marginLeft: 8, padding: "2px 8px", background: COLORS.blue + "22", color: COLORS.blue, borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                ◆ current scenario highlighted
              </span>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontFamily: font, fontSize: 12, whiteSpace: "nowrap" }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "left", background: navy, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "8px 0 0 0", minWidth: 100 }}>
                    FICO \ LTV
                  </th>
                  {(isCashOut ? LTV_LABELS_CO : LTV_LABELS_STD).map((label, ci) => (
                    <th key={ci} style={{
                      padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#fff",
                      background: ci === ltvCol ? COLORS.blue : navy,
                      borderLeft: "1px solid rgba(255,255,255,0.15)",
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FICO_LABELS.map((ficoLabel, ri) => {
                  const grid = isCashOut ? CASHOUT_GRID : isLCOR ? LCOR_GRID : PURCHASE_GRID;
                  const isActiveRow = ri === ficoRow;
                  return (
                    <tr key={ri}>
                      <td style={{
                        padding: "7px 12px", fontWeight: isActiveRow ? 800 : 600, fontSize: 11,
                        background: isActiveRow ? (isDark ? "#0D1E36" : "#DBEAFE") : (isDark ? "#1A2530" : "#F5F8FA"),
                        color: isActiveRow ? COLORS.blue : (c.text || "#1B2A3B"),
                        borderBottom: "1px solid " + border,
                        borderRight: "1px solid " + border,
                      }}>
                        {ficoLabel}
                      </td>
                      {(grid[ri] || []).map((val, ci) => {
                        const isActive = ri === ficoRow && ci === ltvCol;
                        const cc = cellColor(val);
                        return (
                          <td key={ci} style={{
                            padding: "7px 12px", textAlign: "center", fontWeight: isActive ? 800 : 500,
                            background: isActive ? COLORS.blue : cc.bg,
                            color: isActive ? "#fff" : cc.text,
                            borderBottom: "1px solid " + border,
                            borderLeft: "1px solid " + border,
                            outline: isActive ? "2px solid " + COLORS.blue : "none",
                            outlineOffset: isActive ? "-2px" : "0",
                            position: "relative",
                          }}>
                            {val.toFixed(3)}%
                            {isActive && (
                              <span style={{ position: "absolute", top: 1, right: 2, fontSize: 7, color: "#fff" }}>◆</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grid legend */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: c.textSecondary || "#64748b" }}>
            {[
              { label: "0.000%", ...cellColor(0) },
              { label: "≤ 0.500%", ...cellColor(0.125) },
              { label: "≤ 1.000%", ...cellColor(0.750) },
              { label: "≤ 2.000%", ...cellColor(1.500) },
              { label: "> 2.000%", ...cellColor(2.500) },
            ].map(({ label, bg, text }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 14, height: 14, background: bg, border: "1px solid " + border, borderRadius: 2 }} />
                {label}
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 14, height: 14, background: COLORS.blue, borderRadius: 2 }} />
              Current scenario
            </div>
          </div>
        </div>
      )}

      {/* Footnotes */}
      <div style={{ fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.7, padding: "0 4px" }}>
        <div><strong>Source:</strong> Fannie Mae LLPA Matrix, effective 01/28/2026 — <em>for educational/internal use only; verify against current published matrix before pricing.</em></div>
        <div><strong>Conforming limit:</strong> ${(confLimit).toLocaleString("en-US")} (1-unit standard area). High-balance limit: ${((CONFORMING_LIMITS && CONFORMING_LIMITS.highCost) || 1209750).toLocaleString("en-US")}.</div>
        <div><strong>Waivers:</strong> HomeReady (SFC 900), Home Possible, HFA Preferred/Advantage, and First-Time Homebuyers with income ≤ 100% AMI (purchase only) receive full LLPA waivers on the credit/LTV and most supplemental adjustments.</div>
        <div><strong>≤ 15yr terms:</strong> Credit score / LTV grid does not apply. Supplemental LLPAs (occupancy, property type, etc.) still apply.</div>
      </div>

    </div>
  );
}

window.LLPATab = LLPATab;
