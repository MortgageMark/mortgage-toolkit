// modules/calculators/DTICalculator.js
const { useState, useMemo, useEffect } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const fmt2 = window.fmt2;
const MetricCard = window.MetricCard;
const SectionCard = window.SectionCard;
const GaugeChart = window.GaugeChart;
const COLORS = window.COLORS;
const font = window.font;

const INCOME_TYPES = [
  "Alimony Received",
  "Bonus",
  "Car Allowance",
  "Child Support Received",
  "Commission",
  "Disability Income",
  "Foster Care Income",
  "Hourly Income",
  "Investment / Dividends",
  "Overtime",
  "Part-Time Employment",
  "Pension / Retirement",
  "Rental Income",
  "Salary / Base Pay",
  "Self-Employment Income",
  "Social Security",
  "Trust Income",
  "VA Disability",
  "Other Income",
];

const DEBT_SUGGESTIONS = [
  "Alimony",
  "Auto: Lease",
  "Auto Loan",
  "Child Support",
  "Co-signed Loan",
  "Collection",
  "Credit Card",
  "Installment",
  "Lease Payment",
  "Line of Credit",
  "Medical Debt",
  "Mortgage",
  "Personal Loan",
  "Student Loan",
  "Tax Payment Plan",
  "Other Debt",
];

const OWNER_OPTS = [
  { value: "borrower",   abbr: "BORR",  color: "#3b82f6", label: "Borrower"    },
  { value: "coborrower", abbr: "CO-B",  color: "#10b981", label: "Co-Borrower"  },
  { value: "joint",      abbr: "JOINT", color: "#8b5cf6", label: "Joint"        },
  { value: "auth_user",  abbr: "AUTH",  color: "#f59e0b", label: "Auth User"    },
];

const INCOME_OWNER_OPTS = [
  { value: "borrower",   abbr: "BORR", color: "#3b82f6", label: "Borrower"    },
  { value: "coborrower", abbr: "CO-B", color: "#10b981", label: "Co-Borrower"  },
];

const HOUSING_OWNERS = [
  { value: "borrower", abbr: "BORR",  color: "#3b82f6" },
  { value: "joint",    abbr: "JOINT", color: "#8b5cf6" },
];

const PC_PURPOSE_LABELS = { purchase: "Purchase", refinance: "Refinance" };

const DEFAULT_INCOME = JSON.stringify([
  { id: 1, type: "Salary / Base Pay", notes: "", amount: "8333", owner: "borrower", excluded: false },
]);
const DEFAULT_DEBTS = JSON.stringify([
  { id: 1, type: "Car / Truck Payment",  notes: "",                   amount: "450", balance: "",      owner: "borrower", status: "" },
  { id: 2, type: "Student Loan",          notes: "",                   amount: "200", balance: "",      owner: "borrower", status: "" },
  { id: 3, type: "Credit Card Minimum",   notes: "Husband's Discover", amount: "150", balance: "4200", owner: "borrower", status: "" },
]);

function parseArr(str) {
  try { return JSON.parse(str) || []; } catch { return []; }
}
// Format a raw numeric string with thousands commas for display
function addCommas(val) {
  if (!val && val !== 0) return "";
  const str = String(val).replace(/[^0-9.]/g, "");
  if (!str) return "";
  const parts = str.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}
function ownerOpt(val, opts) {
  const list = opts || OWNER_OPTS;
  return list.find(o => o.value === val) || list[0];
}
function nextOwner(val, opts) {
  const list = opts || OWNER_OPTS;
  const idx = list.findIndex(o => o.value === val);
  return list[(Math.max(idx, 0) + 1) % list.length].value;
}

function IncludeToggle({ on, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 38, height: 22, borderRadius: 11, cursor: "pointer", flexShrink: 0,
      background: on ? "#22c55e" : "#d1d5db",
      position: "relative", transition: "background 0.2s",
    }}>
      <div style={{
        position: "absolute", top: 3, left: on ? 17 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

function OwnerBadge({ owner, onClick, width, opts }) {
  const o = ownerOpt(owner, opts);
  return (
    <button onClick={onClick} title={`${o.label} — click to change`} style={{
      width: width || 64, fontSize: 11, padding: "4px 2px",
      borderRadius: 10, border: `1.5px solid ${o.color}`,
      background: o.color + "18", color: o.color,
      fontFamily: font, fontWeight: 700, cursor: "pointer",
      textAlign: "center", flexShrink: 0,
    }}>{o.abbr}</button>
  );
}

function DTICalculator() {
  const c = useThemeColors();

  // ── Borrower name from About / Contact tab (read-only) ────────────────────
  const [abtC1First]  = useLocalStorage("abt_c1fn",   "");
  const [abtC1Last]   = useLocalStorage("abt_c1ln",   "");
  const [abtC2First]  = useLocalStorage("abt_c2fn",   "");
  const [abtC2Last]   = useLocalStorage("abt_c2ln",   "");
  const [abtC2OnLoan] = useLocalStorage("abt_c2loan", false);

  const c1Name = [abtC1First, abtC1Last].filter(Boolean).join(" ")
    || [window._mtkBorrowerFn, window._mtkBorrowerLn].filter(Boolean).join(" ");
  const c2Name = abtC2OnLoan ? [abtC2First, abtC2Last].filter(Boolean).join(" ") : "";
  const borrowerDisplayName = c1Name
    ? (c2Name ? `${c1Name} & ${c2Name}` : c1Name)
    : "";

  // ── Purpose + Loan Amount from Payment Calculator ─────────────────────────
  const [pcPurpose] = useLocalStorage("pc_purpose", "purchase");
  const [pcLa]      = useLocalStorage("pc_la",      "");

  // ── Income — all amounts are monthly ─────────────────────────────────────
  const [incomeStr,    setIncomeStr]    = useLocalStorage("dti_income",   DEFAULT_INCOME);
  const [pendingType,  setPendingType]  = useState("");
  const [pendingAmt,   setPendingAmt]   = useState("");
  const [pendingNotes, setPendingNotes] = useState("");
  const [pendingOwner, setPendingOwner] = useState("borrower");

  // ── Housing (propagated from Payment Calculator) ──────────────────────────
  const [dtiPi,  ] = useLocalStorage("dti_pi",  "0");
  const [dtiTax, ] = useLocalStorage("dti_tax", "0");
  const [dtiIns, ] = useLocalStorage("dti_ins", "0");
  const [dtiPmi, ] = useLocalStorage("dti_pmi", "0");
  const [housingOwner, setHousingOwner] = useLocalStorage("dti_housing_owner", "borrower");

  // ── Debts ─────────────────────────────────────────────────────────────────
  const [debtsStr,    setDebtsStr]    = useLocalStorage("dti_debts",      DEFAULT_DEBTS);
  const [debtPick,    setDebtPick]    = useState("");
  // Payoff balance — written here, read by FeeSheetGenerator as "dti_payoff_bal"
  const [, setPayoffBalStr] = useLocalStorage("dti_payoff_bal", "0");
  const [, setDtiBackRatio] = useLocalStorage("dti_back_ratio", "0");

  const income = useMemo(() => parseArr(incomeStr).map(r => ({ ...r, notes: r.notes || "" })), [incomeStr]);

  const debts = useMemo(() => parseArr(debtsStr).map(d => ({
    ...d,
    type:    d.type    || d.label || DEBT_SUGGESTIONS[0],
    notes:   d.notes   || "",
    balance: d.balance || "",
    // migrate old excluded boolean → status string
    status:  d.status !== undefined ? d.status : (d.excluded ? "exclude" : ""),
  })), [debtsStr]);

  // ── Calculations (all amounts are monthly) ────────────────────────────────
  const calc = useMemo(() => {
    const pendingTotal   = parseFloat(pendingAmt) || 0;
    const confirmedTotal = income.filter(r => !r.excluded)
                                 .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const totalIncome    = confirmedTotal + pendingTotal;

    const housing = (parseFloat(dtiPi)  || 0) + (parseFloat(dtiTax) || 0) +
                    (parseFloat(dtiIns) || 0) + (parseFloat(dtiPmi) || 0);

    const activeDebts  = debts.filter(d => !d.status);
    const exclDebts    = debts.filter(d => d.status === "exclude");
    const payoffDebts  = debts.filter(d => d.status === "payoff");

    const nonHousingDebts = activeDebts.reduce((s, d) => s + (parseFloat(d.amount)  || 0), 0);
    const excludedTotal   = exclDebts.reduce((s, d)   => s + (parseFloat(d.amount)  || 0), 0);
    const payoffMonthly   = payoffDebts.reduce((s, d) => s + (parseFloat(d.amount)  || 0), 0);
    const payoffBalTotal  = payoffDebts.reduce((s, d) => s + (parseFloat(d.balance) || 0), 0);
    // Total outstanding balance across ALL debts with a balance entered
    const totalBalance    = debts.reduce((s, d) => s + (parseFloat(d.balance) || 0), 0);

    const totalDebts = housing + nonHousingDebts;
    const frontDTI   = totalIncome > 0 ? (housing    / totalIncome) * 100 : 0;
    const backDTI    = totalIncome > 0 ? (totalDebts / totalIncome) * 100 : 0;
    const remaining  = totalIncome - totalDebts;

    return { income: totalIncome, housing, nonHousingDebts, excludedTotal,
             payoffMonthly, payoffBalTotal, totalBalance, totalDebts, frontDTI, backDTI, remaining };
  }, [incomeStr, pendingAmt, dtiPi, dtiTax, dtiIns, dtiPmi, debtsStr]);

  // Sync payoff balance to Fee Sheet Generator
  useEffect(() => {
    setPayoffBalStr(String(calc.payoffBalTotal));
  }, [calc.payoffBalTotal]);

  // Sync back-end DTI so Payment Calculator can use it for MI surcharge detection
  useEffect(() => {
    setDtiBackRatio(String(calc.backDTI.toFixed(1)));
  }, [calc.backDTI]);

  // ── Income CRUD ───────────────────────────────────────────────────────────
  const updateIncome = (id, field, val) =>
    setIncomeStr(JSON.stringify(income.map(r => r.id === id ? { ...r, [field]: val } : r)));
  const removeIncome = (id) =>
    setIncomeStr(JSON.stringify(income.filter(r => r.id !== id)));

  const handleIncomeTypeSelect = (type) => {
    if (!type) return;
    setIncomeStr(JSON.stringify([...income, {
      id: Date.now(), type, notes: pendingNotes, amount: pendingAmt, owner: pendingOwner, excluded: false,
    }]));
    setPendingType(""); setPendingAmt(""); setPendingNotes("");
  };

  const coIncome     = income.filter(r => r.owner === "coborrower");
  const allCoIncExcl = coIncome.length > 0 && coIncome.every(r => r.excluded);
  const toggleCoInc  = () => setIncomeStr(JSON.stringify(
    income.map(r => r.owner === "coborrower" ? { ...r, excluded: !allCoIncExcl } : r)
  ));

  const hOwnerOpt = HOUSING_OWNERS.find(o => o.value === housingOwner) || HOUSING_OWNERS[0];
  const cycleHousingOwner = () => {
    const idx = HOUSING_OWNERS.findIndex(o => o.value === housingOwner);
    setHousingOwner(HOUSING_OWNERS[(idx + 1) % HOUSING_OWNERS.length].value);
  };

  // ── Debt CRUD ─────────────────────────────────────────────────────────────
  const updateDebt = (id, field, val) =>
    setDebtsStr(JSON.stringify(debts.map(d => d.id === id ? { ...d, [field]: val } : d)));
  const removeDebt = (id) =>
    setDebtsStr(JSON.stringify(debts.filter(d => d.id !== id)));

  const handleDebtTypeSelect = (type) => {
    if (!type) return;
    setDebtsStr(JSON.stringify([...debts, {
      id: Date.now(), type, notes: "", amount: "", balance: "", owner: "borrower", status: "",
    }]));
    setDebtPick("");
  };

  const coDebts       = debts.filter(d => d.owner === "coborrower");
  const allCoDebtExcl = coDebts.length > 0 && coDebts.every(d => d.status !== "");
  const toggleCoDebt  = () => setDebtsStr(JSON.stringify(
    debts.map(d => d.owner === "coborrower" ? { ...d, status: allCoDebtExcl ? "" : "exclude" } : d)
  ));

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle = {
    fontSize: 14, fontFamily: font, borderRadius: 4, outline: "none",
    border: `1px solid ${c.border || COLORS.border}`,
    background: c.bg || "#fff", color: c.text || "#333",
    padding: "6px 8px", boxSizing: "border-box",
  };
  const readonlyStyle = {
    ...inputStyle,
    background: c.bgAlt || "#f4f5f7",
    color: c.gray || COLORS.gray,
  };
  const colHdr = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.05em", color: c.gray || COLORS.gray, fontFamily: font,
    textAlign: "left",   // ← all headers left-aligned
  };

  // Shared column widths — income and debt sections aligned
  const COL_OWN    = 64;   // Owner badge — same in both sections
  const COL_TYPE   = 178;  // Type dropdown — same in both sections (columns line up)
  const COL_AMT    = 110;  // Monthly amount (income) / Min. Payment (debt) — same width
  const COL_BAL    = 100;  // Balance (debt only)
  const COL_STATUS = 132;  // Status dropdown (debt only)
  const COL_TOG    = 50;   // Include toggle (income only)
  const COL_REM    = 22;   // Remove button

  const rowWrapIncome = (excluded) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 8px", borderRadius: 6, marginBottom: 6,
    background: excluded ? (c.bgAlt || "#f4f5f7") : "transparent",
    border: `1px solid ${excluded ? (c.border || COLORS.border) : "transparent"}`,
    opacity: excluded ? 0.6 : 1, transition: "all 0.15s",
  });

  const rowWrapDebt = (status) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "6px 8px", borderRadius: 6, marginBottom: 6,
    background: status === "exclude" ? (c.bgAlt || "#f4f5f7")
              : status === "payoff"  ? "#fffbeb"
              : "transparent",
    border: `1px solid ${
      status === "exclude" ? (c.border || COLORS.border)
    : status === "payoff"  ? "#f59e0b55"
    : "transparent"}`,
    opacity: status === "exclude" ? 0.6 : 1,
    transition: "all 0.15s",
  });

  const purposeLabel = PC_PURPOSE_LABELS[pcPurpose] || (pcPurpose
    ? pcPurpose.charAt(0).toUpperCase() + pcPurpose.slice(1)
    : "Purchase");

  return (
    <div>

      {/* ══ Header Panel ══ */}
      <div style={{
        borderRadius: 12, marginBottom: 16,
        background: "linear-gradient(135deg, #0f2744 0%, #1d4ed8 100%)",
        boxShadow: "0 4px 20px rgba(15,39,68,0.35)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          {/* Left: label + name */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)", fontFamily: font, marginBottom: 4 }}>
              DTI Analysis
            </div>
            {borrowerDisplayName ? (
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: font, lineHeight: 1.15 }}>
                {borrowerDisplayName}
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.35)", fontFamily: font, fontStyle: "italic" }}>
                No borrower name — enter in the About tab
              </div>
            )}
            {pcLa && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.50)", fontFamily: font, marginTop: 4, display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ background: "rgba(255,255,255,0.12)", borderRadius: 5, padding: "1px 8px", fontWeight: 600 }}>
                  {purposeLabel}
                </span>
                <span>{fmt2(parseFloat(pcLa) || 0)} loan</span>
              </div>
            )}
          </div>

          {/* Right: stats */}
          <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
            {[
              {
                label: "Monthly PITI",
                value: calc.housing > 0 ? fmt2(calc.housing) : "—",
                sub: calc.housing > 0 ? "" : "set in Payment Calc",
                color: "#fff", valueSize: 22,
              },
              {
                label: "Front-End DTI",
                value: `${calc.frontDTI.toFixed(1)}%`,
                sub: "housing ratio",
                color: calc.frontDTI === 0 ? "rgba(255,255,255,0.45)"
                     : calc.frontDTI < 28  ? "#4ade80"
                     : calc.frontDTI < 36  ? "#fbbf24" : "#f87171",
                valueSize: 24,
              },
              {
                label: "Back-End DTI",
                value: `${calc.backDTI.toFixed(1)}%`,
                sub: "total ratio",
                color: calc.backDTI === 0  ? "rgba(255,255,255,0.45)"
                     : calc.backDTI < 36   ? "#4ade80"
                     : calc.backDTI < 43   ? "#fbbf24" : "#f87171",
                valueSize: 24,
              },
            ].map((m, i) => (
              <div key={m.label} style={{ display: "flex", alignItems: "stretch" }}>
                {i > 0 && (
                  <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "2px 20px 2px 0", flexShrink: 0 }} />
                )}
                <div style={{ paddingRight: i < 2 ? 20 : 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.48)", fontFamily: font, marginBottom: 3 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: m.valueSize, fontWeight: 700, lineHeight: 1, color: m.color, fontFamily: font }}>
                    {m.value}
                  </div>
                  {m.sub && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", fontFamily: font, marginTop: 2 }}>
                      {m.sub}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Income allocation bar */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)",
            fontFamily: font, letterSpacing: "0.07em", marginBottom: 6, textTransform: "uppercase" }}>
            Income Allocation
          </div>
          <div style={{ height: 18, borderRadius: 9, overflow: "hidden", display: "flex",
            background: "rgba(255,255,255,0.12)" }}>
            {calc.income > 0 && (
              <>
                <div style={{ width: `${Math.min((calc.housing / calc.income) * 100, 100)}%`,
                  background: "rgba(96,165,250,0.85)", transition: "width 0.3s" }} />
                <div style={{ width: `${Math.min((calc.nonHousingDebts / calc.income) * 100, Math.max(0, 100 - (calc.housing / calc.income) * 100))}%`,
                  background: "rgba(248,113,113,0.85)", transition: "width 0.3s" }} />
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 11, fontFamily: font, flexWrap: "wrap" }}>
            <span style={{ color: "rgba(147,197,253,0.9)" }}>
              ■ Housing {calc.income > 0 ? ((calc.housing / calc.income) * 100).toFixed(0) : 0}%
            </span>
            <span style={{ color: "rgba(252,165,165,0.9)" }}>
              ■ Other Debts {calc.income > 0 ? ((calc.nonHousingDebts / calc.income) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Warning ── */}
      {calc.backDTI >= 43 && (
        <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 8,
          padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 17, lineHeight: 1.3 }}>⚠️</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e", fontFamily: font }}>
              DTI Review Recommended — {calc.backDTI.toFixed(1)}% Back-End
            </span>
            <div style={{ fontSize: 12, color: "#78350f", fontFamily: font, lineHeight: 1.5, marginTop: 2 }}>
              A back-end DTI at or above 43% warrants a closer look at guideline requirements.
              Many programs allow higher ratios with strong compensating factors.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MONTHLY INCOME ══════════════ */}
      <SectionCard title="MONTHLY INCOME" accent={c.green || COLORS.green}>

        {/* Instructions */}
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8,
          background: (c.green || COLORS.green) + "10",
          border: `1px solid ${(c.green || COLORS.green) + "30"}` }}>
          <span style={{ fontSize: 12, color: c.gray || COLORS.gray, fontFamily: font, lineHeight: 1.6 }}>
            💡 <strong>Best practice:</strong> Break income down by category rather than entering a single gross total.
            {" "}For example, instead of <em>$100,000</em>, enter separate rows for{" "}
            <em>$70k base salary</em>, <em>$27k commission</em>, and <em>$3k car allowance</em>.
            This makes the DTI analysis cleaner and easier to document for underwriting.
          </span>
        </div>

        {/* Column headers */}
        {income.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ ...colHdr, width: COL_OWN, flexShrink: 0 }}>Owner</span>
            <span style={{ ...colHdr, width: COL_TYPE, flexShrink: 0 }}>Income Type</span>
            <span style={{ ...colHdr, flex: 1 }}>DESCRIPTIONS &amp; NOTES (optional)</span>
            <span style={{ ...colHdr, width: COL_AMT, flexShrink: 0, textAlign: "center" }}>Monthly</span>
            <span style={{ ...colHdr, width: COL_BAL, flexShrink: 0, textAlign: "center" }}>Annual</span>
            <span style={{ width: COL_REM, flexShrink: 0 }} />
          </div>
        )}

        {/* Confirmed income rows */}
        {income.map(row => (
          <div key={row.id} style={rowWrapIncome(row.excluded)}>
            <OwnerBadge
              owner={row.owner} opts={INCOME_OWNER_OPTS} width={COL_OWN}
              onClick={() => updateIncome(row.id, "owner", nextOwner(row.owner, INCOME_OWNER_OPTS))}
            />
            <select value={row.type} onChange={e => updateIncome(row.id, "type", e.target.value)}
              style={{ ...inputStyle, width: COL_TYPE, flexShrink: 0, padding: "6px 6px",
                textDecoration: row.excluded ? "line-through" : "none",
                background: row.excluded ? "transparent" : (c.bg || "#fff"),
              }}>
              {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={row.notes} placeholder="Description / notes…"
              onChange={e => updateIncome(row.id, "notes", e.target.value)}
              style={{ ...inputStyle, flex: 1,
                textDecoration: row.excluded ? "line-through" : "none",
                background: row.excluded ? "transparent" : (c.bg || "#fff"),
                color: row.excluded ? (c.gray || COLORS.gray) : (c.text || "#333"),
              }} />
            <div style={{ position: "relative", width: COL_AMT, flexShrink: 0 }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
              <input type="text"
                value={addCommas(row.amount)}
                onChange={e => updateIncome(row.id, "amount", e.target.value.replace(/[^0-9.]/g, ""))}
                style={{ ...inputStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                  textDecoration: row.excluded ? "line-through" : "none",
                  background: row.excluded ? "transparent" : (c.bg || "#fff"),
                  color: row.excluded ? (c.gray || COLORS.gray) : (c.text || "#333"),
                }} />
            </div>
            {/* Annual — read-only */}
            <div style={{ position: "relative", width: COL_BAL, flexShrink: 0 }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
              <div style={{ ...readonlyStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                textDecoration: row.excluded ? "line-through" : "none",
              }}>
                {addCommas(((parseFloat(row.amount) || 0) * 12).toFixed(0))}
              </div>
            </div>
            <button onClick={() => removeIncome(row.id)} style={{
              width: COL_REM, flexShrink: 0, background: "none", border: "none",
              cursor: "pointer", color: c.red || COLORS.red, fontSize: 16, lineHeight: 1, padding: 0,
            }}>✕</button>
          </div>
        ))}

        {/* Pending / add row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 8px", borderRadius: 6, marginTop: income.length > 0 ? 4 : 0,
          border: `1.5px dashed ${(c.green || COLORS.green) + "55"}`,
          background: (c.green || COLORS.green) + "06",
        }}>
          <OwnerBadge owner={pendingOwner} opts={INCOME_OWNER_OPTS} width={COL_OWN}
            onClick={() => setPendingOwner(nextOwner(pendingOwner, INCOME_OWNER_OPTS))} />
          <select value={pendingType} onChange={e => handleIncomeTypeSelect(e.target.value)}
            style={{
              ...inputStyle, width: COL_TYPE, flexShrink: 0, padding: "6px 6px",
              background: "transparent",
              color: pendingType ? (c.text || "#333") : (c.gray || COLORS.gray),
              border: `1px solid ${(c.green || COLORS.green) + "55"}`,
            }}>
            <option value="" disabled>+ Add income…</option>
            {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="text" value={pendingNotes} placeholder="Notes (optional)"
            onChange={e => setPendingNotes(e.target.value)}
            style={{ ...inputStyle, flex: 1, background: "transparent",
              border: `1px solid ${(c.green || COLORS.green) + "55"}` }} />
          <div style={{ position: "relative", width: COL_AMT, flexShrink: 0 }}>
            <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
            <input type="text"
              value={addCommas(pendingAmt)}
              onChange={e => setPendingAmt(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              style={{ ...inputStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                background: "transparent", border: `1px solid ${(c.green || COLORS.green) + "55"}` }} />
          </div>
          <div style={{ width: COL_BAL, flexShrink: 0 }} />
          <div style={{ width: COL_STATUS + COL_REM + 8, flexShrink: 0,
            fontSize: 11, color: (c.green || COLORS.green) + "99", fontFamily: font,
            textAlign: "center", fontStyle: "italic" }}>
            {pendingAmt ? "← select type" : ""}
          </div>
        </div>

        {/* Income totals */}
        {calc.income > 0 && (
          <div style={{ borderTop: `1px solid ${c.border || COLORS.border}`, marginTop: 12, paddingTop: 10,
            display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: COL_OWN + 8 + COL_TYPE, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
              {coIncome.length > 0 && (
                <>
                  <IncludeToggle on={allCoIncExcl} onClick={toggleCoInc} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font,
                    textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Exclude Co-Borrower</span>
                </>
              )}
            </div>
            <span style={{ flex: 1, fontSize: 14, color: c.gray || COLORS.gray, fontFamily: font, textAlign: "right" }}>
              Total Monthly Income
            </span>
            <div style={{ width: COL_AMT, flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.green || COLORS.green, fontFamily: font }}>
                ${addCommas(calc.income.toFixed(2).replace(/\.00$/, ""))}
              </div>
            </div>
            <div style={{ width: COL_BAL, flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || COLORS.navy, fontFamily: font }}>
                ${addCommas((calc.income * 12).toFixed(0))}
              </div>
            </div>
            <div style={{ width: COL_REM, flexShrink: 0 }} />
          </div>
        )}
      </SectionCard>

      {/* ══════════════ MONTHLY DEBT OBLIGATIONS ══════════════ */}
      <div style={{ marginTop: 16 }}>
        <SectionCard title="MONTHLY DEBT" accent={c.red || COLORS.red}>

          {/* Instructions */}
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8,
            background: (c.red || COLORS.red) + "10",
            border: `1px solid ${(c.red || COLORS.red) + "30"}` }}>
            <span style={{ fontSize: 12, color: c.gray || COLORS.gray, fontFamily: font, lineHeight: 1.6 }}>
              💡 <strong>Enter minimum monthly payments only.</strong>{" "}
              Focus on debts that appear on a credit report (credit cards, auto loans, student loans, personal loans)
              and any large non-credit obligations (alimony, child support, co-signed leases).
              Do <em>not</em> include routine bills like cell phone, utilities, groceries, or subscriptions
              — those are <em>not</em> counted in DTI.
            </span>
          </div>

          {/* Column headers — left-aligned, aligned with income section */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ ...colHdr, width: COL_OWN, flexShrink: 0 }}>Owner</span>
            <span style={{ ...colHdr, width: COL_TYPE, flexShrink: 0 }}>Type</span>
            <span style={{ ...colHdr, flex: 1 }}>DESCRIPTIONS &amp; NOTES (optional)</span>
            <span style={{ ...colHdr, width: COL_AMT, flexShrink: 0, textAlign: "center" }}>Min. Pmt</span>
            <span style={{ ...colHdr, width: COL_BAL, flexShrink: 0, textAlign: "center" }}>Balance</span>
            <span style={{ ...colHdr, width: COL_STATUS, flexShrink: 0, textAlign: "center" }}>Status</span>
            <span style={{ width: COL_REM, flexShrink: 0 }} />
          </div>

          {/* Mortgage row — always included, no status control */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: 6, marginBottom: 6,
            background: (c.blue || COLORS.blue) + "08",
            border: `1px solid ${(c.blue || COLORS.blue) + "28"}`,
          }}>
            <button onClick={cycleHousingOwner} style={{
              width: COL_OWN, flexShrink: 0, fontSize: 11, padding: "4px 2px",
              borderRadius: 10, border: `1.5px solid ${hOwnerOpt.color}`,
              background: hOwnerOpt.color + "18", color: hOwnerOpt.color,
              fontFamily: font, fontWeight: 700, cursor: "pointer", textAlign: "center",
            }}>{hOwnerOpt.abbr}</button>
            <div style={{ ...readonlyStyle, width: COL_TYPE, flexShrink: 0, fontSize: 14,
              fontWeight: 600, color: c.navy || COLORS.navy }}>
              Mortgage Payment
            </div>
            <div style={{ ...readonlyStyle, flex: 1, fontStyle: "italic" }}>
              Future Mortgage Payment (PITI)
            </div>
            <div style={{ ...readonlyStyle, width: COL_AMT, flexShrink: 0, textAlign: "right",
              fontWeight: 700, fontSize: 14, position: "relative", paddingLeft: 20,
              color: calc.housing > 0 ? (c.navy || COLORS.navy) : (c.gray || COLORS.gray) }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, fontWeight: 400, color: c.gray || COLORS.gray }}>$</span>
              {calc.housing > 0 ? addCommas(calc.housing.toFixed(2).replace(/\.00$/, "")) : "—"}
            </div>
            {/* Balance — n/a for mortgage row */}
            <div style={{ ...readonlyStyle, width: COL_BAL, flexShrink: 0, textAlign: "right",
              color: c.gray || COLORS.gray, fontSize: 14 }}>—</div>
            {/* Status — always counted, no control shown */}
            <div style={{ width: COL_STATUS, flexShrink: 0,
              fontSize: 11, color: c.gray || COLORS.gray, fontFamily: font,
              fontStyle: "italic", textAlign: "center" }}>
              Always counted
            </div>
            <div style={{ width: COL_REM, flexShrink: 0 }} />
          </div>

          {/* Dynamic debt rows */}
          {debts.map(d => (
            <div key={d.id} style={rowWrapDebt(d.status)}>
              <OwnerBadge owner={d.owner} width={COL_OWN}
                onClick={() => updateDebt(d.id, "owner", nextOwner(d.owner))} />
              <select value={d.type} onChange={e => updateDebt(d.id, "type", e.target.value)}
                style={{ ...inputStyle, width: COL_TYPE, flexShrink: 0, padding: "6px 6px",
                  textDecoration: d.status === "exclude" ? "line-through" : "none",
                  background: d.status ? "transparent" : (c.bg || "#fff"),
                  color: d.status === "exclude" ? (c.gray || COLORS.gray) : (c.text || "#333"),
                }}>
                <option value=""></option>
                {DEBT_SUGGESTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <input type="text" value={d.notes} placeholder="Description / notes…"
                onChange={e => updateDebt(d.id, "notes", e.target.value)}
                style={{ ...inputStyle, flex: 1,
                  textDecoration: d.status === "exclude" ? "line-through" : "none",
                  background: d.status === "payoff" ? "#fffbeb" : d.status === "exclude" ? "transparent" : (c.bg || "#fff"),
                  color: d.status === "exclude" ? (c.gray || COLORS.gray) : (c.text || "#333"),
                }} />
              {/* Monthly payment */}
              <div style={{ position: "relative", width: COL_AMT, flexShrink: 0 }}>
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
                <input type="text"
                  value={addCommas(d.amount)}
                  onChange={e => updateDebt(d.id, "amount", e.target.value.replace(/[^0-9.]/g, ""))}
                  style={{ ...inputStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                    textDecoration: d.status === "exclude" ? "line-through" : "none",
                    background: d.status === "payoff" ? "#fffbeb" : d.status === "exclude" ? "transparent" : (c.bg || "#fff"),
                    color: d.status === "exclude" ? (c.gray || COLORS.gray) : (c.text || "#333"),
                  }} />
              </div>
              {/* Balance */}
              <div style={{ position: "relative", width: COL_BAL, flexShrink: 0 }}>
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
                <input type="text"
                  value={addCommas(d.balance)}
                  onChange={e => updateDebt(d.id, "balance", e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="—"
                  style={{ ...inputStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                    background: d.status === "payoff" ? "#fffbeb" : d.status === "exclude" ? "transparent" : (c.bg || "#fff"),
                    color: d.status === "payoff" ? "#92400e" : (c.text || "#333"),
                    fontWeight: d.status === "payoff" ? 700 : 400,
                  }} />
              </div>
              {/* Status dropdown */}
              <select value={d.status} onChange={e => updateDebt(d.id, "status", e.target.value)}
                style={{
                  ...inputStyle, width: COL_STATUS, flexShrink: 0, fontSize: 14, padding: "6px 6px",
                  background: d.status === "payoff"  ? "#fffbeb"
                            : d.status === "exclude" ? (c.bgAlt || "#f4f5f7")
                            : (c.bg || "#fff"),
                  color: d.status === "payoff"  ? "#92400e"
                       : d.status === "exclude" ? (c.gray || COLORS.gray)
                       : (c.text || "#333"),
                  fontWeight: d.status === "payoff" ? 700 : 400,
                  borderColor: d.status === "payoff" ? "#f59e0b" : (c.border || COLORS.border),
                }}>
                <option value="">—</option>
                <option value="exclude">Exclude</option>
                <option value="payoff">Pay Off at Closing</option>
              </select>
              <button onClick={() => removeDebt(d.id)} style={{
                width: COL_REM, flexShrink: 0, background: "none", border: "none",
                cursor: "pointer", color: c.red || COLORS.red, fontSize: 16, lineHeight: 1, padding: 0,
              }}>✕</button>
            </div>
          ))}

          {/* Pay-off-at-closing callout */}
          {calc.payoffBalTotal > 0 && (
            <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 6,
              background: "#fffbeb", border: "1px solid #f59e0b55",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#92400e", fontFamily: font, fontWeight: 600 }}>
                💳 Debt payoffs at closing — added to Fee Sheet cash to close
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#92400e", fontFamily: font }}>
                ${addCommas(calc.payoffBalTotal.toFixed(0))}
              </span>
            </div>
          )}

          {/* Add debt */}
          <div style={{ marginTop: 10 }}>
            <select value={debtPick} onChange={e => handleDebtTypeSelect(e.target.value)}
              style={{
                ...inputStyle, width: "100%", fontSize: 14,
                color: debtPick ? (c.text || "#333") : (c.gray || COLORS.gray),
                border: `1.5px dashed ${(c.red || COLORS.red) + "55"}`,
                background: (c.red || COLORS.red) + "05",
              }}>
              <option value="" disabled>— Add another payment —</option>
              {DEBT_SUGGESTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* Debt totals — payment and balance columns */}
          <div style={{ borderTop: `1px solid ${c.border || COLORS.border}`, marginTop: 12, paddingTop: 10 }}>
            {/* Included debts row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: COL_OWN + 8 + COL_TYPE, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                {coDebts.length > 0 && (
                  <>
                    <IncludeToggle on={allCoDebtExcl} onClick={toggleCoDebt} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font,
                      textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Exclude Co-Borrower</span>
                  </>
                )}
              </div>
              <span style={{ flex: 1, fontSize: 14, color: c.gray || COLORS.gray, fontFamily: font, textAlign: "right" }}>
                Monthly Debts (included in DTI)
              </span>
              <span style={{ width: COL_AMT, flexShrink: 0, fontSize: 16, fontWeight: 700,
                color: c.red || COLORS.red, fontFamily: font, textAlign: "right" }}>
                ${addCommas(calc.nonHousingDebts.toFixed(2).replace(/\.00$/, ""))}
              </span>
              {/* Balance total — shown in balance column */}
              {calc.totalBalance > 0 ? (
                <span style={{ width: COL_BAL, flexShrink: 0, fontSize: 14, fontWeight: 700,
                  color: c.navy || COLORS.navy, fontFamily: font, textAlign: "right" }}>
                  ${addCommas(calc.totalBalance.toFixed(0))}
                </span>
              ) : (
                <div style={{ width: COL_BAL, flexShrink: 0 }} />
              )}
              <div style={{ width: COL_STATUS + COL_REM + 8, flexShrink: 0 }} />
            </div>
            {/* Excluded row */}
            {calc.excludedTotal > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{ width: COL_OWN, flexShrink: 0 }} />
                <div style={{ width: COL_TYPE, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: c.gray || COLORS.gray, fontFamily: font, textAlign: "right" }}>
                  Excluded from DTI
                </span>
                <span style={{ width: COL_AMT, flexShrink: 0, fontSize: 14, textAlign: "right",
                  color: c.gray || COLORS.gray, fontFamily: font, textDecoration: "line-through" }}>
                  ${addCommas(calc.excludedTotal.toFixed(2).replace(/\.00$/, ""))}
                </span>
                <div style={{ width: COL_BAL + COL_STATUS + COL_REM + 16, flexShrink: 0 }} />
              </div>
            )}
            {/* Payoff row */}
            {calc.payoffMonthly > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{ width: COL_OWN, flexShrink: 0 }} />
                <div style={{ width: COL_TYPE, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: "#92400e", fontFamily: font, textAlign: "right" }}>
                  Paid off at closing (excluded from DTI)
                </span>
                <span style={{ width: COL_AMT, flexShrink: 0, fontSize: 14, textAlign: "right",
                  color: "#92400e", fontFamily: font, textDecoration: "line-through" }}>
                  ${addCommas(calc.payoffMonthly.toFixed(2).replace(/\.00$/, ""))}
                </span>
                <div style={{ width: COL_BAL + COL_STATUS + COL_REM + 16, flexShrink: 0 }} />
              </div>
            )}
          </div>
        </SectionCard>
      </div>

    </div>
  );
}

window.DTICalculator = DTICalculator;
