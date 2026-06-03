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
const InfoTip = window.InfoTip;

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
  "Rental Income",
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
  const str   = String(val);
  const isNeg = str.startsWith("-");
  const clean = str.replace(/[^0-9.]/g, "");
  if (!clean) return isNeg ? "-" : "";
  const parts = clean.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (isNeg ? "-" : "") + parts.join(".");
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

// ── Student Loan qualifying payment calculator ────────────────────────────
// Research: Fannie Mae B3-6-05 (03/04/2026), Freddie Mac 5306, HUD ML 2021-13,
//           VA Circular 26-17-02, USDA HB-1-3555 PN-651 (11/25/2025)
const SL_AGENCIES = [
  { id: "fannie",  label: "Fannie Mae",  short: "FNMA" },
  { id: "freddie", label: "Freddie Mac", short: "FHLMC" },
  { id: "fha",     label: "FHA",         short: "FHA" },
  { id: "va",      label: "VA",          short: "VA" },
  { id: "usda",    label: "USDA",        short: "USDA" },
];

function calcSLPayment(loan, agency) {
  const bal    = parseFloat((loan.balance         || "").replace(/,/g,"")) || 0;
  const crPmt  = parseFloat((loan.creditReportPmt || "").replace(/,/g,"")) || 0;
  const status = loan.status || "active"; // active | deferred | forbearance

  // PSLF / near-forgiveness exclusion: Fannie & Freddie allow exclusion if <10 payments remain
  if (loan.pslf && (agency === "fannie" || agency === "freddie")) return 0;

  if (agency === "fannie") {
    if (status === "deferred" || status === "forbearance")
      return Math.round(bal * 0.01);                               // 1% of balance
    return crPmt || Math.round(bal * 0.01);                        // active: credit report; if $0 → 1%
  }

  if (agency === "freddie") {
    if (status === "deferred" || status === "forbearance")
      return Math.round(bal * 0.005);                              // 0.5% of balance
    return crPmt || Math.round(bal * 0.005);                       // active: credit report; if $0 → 0.5%
  }

  if (agency === "fha") {
    if (status === "deferred" || status === "forbearance")
      return Math.round(bal * 0.005);                              // 0.5% of balance (ML 2021-13)
    return crPmt || Math.round(bal * 0.005);                       // active: credit report; if $0 → 0.5%
  }

  if (agency === "va") {
    // VA: deferred 12+ months beyond closing → fully excluded
    if (status === "deferred" && loan.vaDeferred12mo) return 0;
    const vaFloor = Math.round(bal * 0.05 / 12);                  // 5% of balance ÷ 12
    if (status === "deferred" || status === "forbearance") return vaFloor;
    return Math.max(crPmt, vaFloor);                              // active: higher of credit report or 5%÷12
  }

  if (agency === "usda") {
    if (status === "deferred" || status === "forbearance")
      return Math.round(bal * 0.005);                             // 0.5% of balance (PN 651)
    return crPmt || Math.round(bal * 0.005);                      // active: credit report; if $0 → 0.5%
  }

  return crPmt;
}

const SL_PROGRAMS = [
  { value: "fannie",  label: "Conventional — Fannie Mae" },
  { value: "freddie", label: "Conventional — Freddie Mac" },
  { value: "fha",     label: "FHA" },
  { value: "va",      label: "VA" },
  { value: "usda",    label: "USDA" },
];

const SL_STATUSES = [
  { value: "active",      label: "Active repayment — payment on credit report" },
  { value: "deferred",    label: "Deferred" },
  { value: "forbearance", label: "Forbearance (incl. SAVE administrative)" },
];

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
      width: width || 64, fontSize: 12, padding: "4px 2px",
      borderRadius: 10, border: `1.5px solid ${o.color}`,
      background: o.color + "18", color: o.color,
      fontFamily: font, fontWeight: 700, cursor: "pointer",
      textAlign: "center", flexShrink: 0,
    }}>{o.abbr}</button>
  );
}

function DTICalculator() {
  const c = useThemeColors();

  // ── Borrower name — pq_applicant (set in PQ Letter form) takes priority ───
  const [pqApplicant] = useLocalStorage("pq_applicant", "");
  const [abtC1First]  = useLocalStorage("abt_c1fn",   "");
  const [abtC1Last]   = useLocalStorage("abt_c1ln",   "");
  const [abtC2First]  = useLocalStorage("abt_c2fn",   "");
  const [abtC2Last]   = useLocalStorage("abt_c2ln",   "");
  const [abtC2OnLoan] = useLocalStorage("abt_c2loan", false);

  const c1Name = pqApplicant.trim()
    || [abtC1First, abtC1Last].filter(Boolean).join(" ")
    || [window._mtkBorrowerFn, window._mtkBorrowerLn].filter(Boolean).join(" ");
  const c2Name = abtC2OnLoan ? [abtC2First, abtC2Last].filter(Boolean).join(" ") : "";
  const borrowerDisplayName = pqApplicant.trim()
    ? pqApplicant.trim()
    : c1Name
      ? (c2Name ? `${c1Name} & ${c2Name}` : c1Name)
      : "";

  // ── Purpose + Loan Amount + Program from Payment Calculator ──────────────
  const [pcPurpose] = useLocalStorage("pc_purpose", "purchase");
  const [pcLa]      = useLocalStorage("pc_la",      "");
  const [pcProgram] = useLocalStorage("pc_prog",    "conventional");

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
    const confirmedTotal = income.filter(r => !r.excluded && r.status !== "exclude")
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

  const hasStudentLoan = debts.some(d => d.type === "Student Loan");

  // ── Student Loan Qualifier state ──────────────────────────────────────────
  const [slLoansStr, setSlLoansStr] = useLocalStorage("dti_sl_loans", "[]");
  const [slProgram,  setSlProgram]  = useLocalStorage("dti_sl_prog",  "fannie");
  const slLoans = useMemo(() => { try { return JSON.parse(slLoansStr) || []; } catch { return []; } }, [slLoansStr]);

  const addSlLoan = () => setSlLoansStr(JSON.stringify([...slLoans, {
    id: Date.now(), description: "", balance: "", creditReportPmt: "", status: "active",
    idrPayment: "", vaDeferred12mo: false, pslf: false,
  }]));
  const updateSlLoan = (id, field, val) =>
    setSlLoansStr(JSON.stringify(slLoans.map(l => l.id === id ? { ...l, [field]: val } : l)));
  const removeSlLoan = (id) =>
    setSlLoansStr(JSON.stringify(slLoans.filter(l => l.id !== id)));

  const slTotals = useMemo(() =>
    SL_AGENCIES.reduce((acc, ag) => {
      acc[ag.id] = slLoans.reduce((sum, loan) => sum + calcSLPayment(loan, ag.id), 0);
      return acc;
    }, {}),
  [slLoansStr]);

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
    fontSize: 15, fontFamily: font, borderRadius: 6, outline: "none",
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
  const COL_OWN      = 64;   // Owner badge — same in both sections
  const COL_TYPE     = 178;  // Type dropdown — same in both sections (columns line up)
  const COL_AMT      = 110;  // Monthly amount (income) / Min. Payment (debt) — same width
  const COL_BAL      = 100;  // Balance (debt only) / Annual (income)
  const COL_STATUS   = 132;  // Status dropdown (debt only)
  const COL_INC_STAT = 92;   // Include/Exclude status (income only)
  const COL_REM      = 22;   // Remove button

  const incomeExcluded = (row) => row.status === "exclude" || !!row.excluded;

  const rowWrapIncome = (row) => {
    const excl = incomeExcluded(row);
    return {
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 8px", borderRadius: 6, marginBottom: 6,
      background: excl ? (c.bgAlt || "#f4f5f7") : "transparent",
      border: `1px solid ${excl ? (c.border || COLORS.border) : "transparent"}`,
      opacity: excl ? 0.6 : 1, transition: "all 0.15s",
    };
  };

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
          {/* Left: label + scenario details */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)", fontFamily: font, marginBottom: 6 }}>
              DTI Analysis
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {purposeLabel && (
                <span style={{ background: "rgba(255,255,255,0.12)", borderRadius: 5, padding: "2px 10px",
                  fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", fontFamily: font }}>
                  {purposeLabel}
                </span>
              )}
              {pcLa && (
                <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: font }}>
                  {fmt2(parseFloat(pcLa) || 0)}
                </span>
              )}
              {pcLa && (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: font }}>loan</span>
              )}
            </div>
            {calc.income > 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: font, marginTop: 5 }}>
                {fmt2(calc.income)}/mo gross income
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
                color: calc.backDTI === 0   ? "rgba(255,255,255,0.45)"
                     : calc.backDTI < 45.1  ? "#4ade80"
                     : calc.backDTI < 50    ? "#fbbf24" : "#f87171",
                valueSize: 24,
              },
            ].map((m, i) => (
              <div key={m.label} style={{ display: "flex", alignItems: "stretch" }}>
                {i > 0 && (
                  <div style={{ width: 1, background: "rgba(255,255,255,0.15)", margin: "2px 20px 2px 0", flexShrink: 0 }} />
                )}
                <div style={{ paddingRight: i < 2 ? 20 : 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.48)", fontFamily: font, marginBottom: 3,
                    display: "flex", alignItems: "center", gap: 4 }}>
                    {m.label}
                    {m.label === "Front-End DTI" && (
                      <InfoTip text="The percentage of your gross monthly income going toward housing costs (PITI — principal, interest, taxes, insurance). Most conventional loans want this below 28%. FHA allows up to 31%." />
                    )}
                    {m.label === "Back-End DTI" && (
                      <InfoTip text="The percentage of your gross monthly income covering ALL monthly obligations — your housing payment plus all other debts. Most conventional loans require under 45%, FHA allows up to 57% with compensating factors, and VA has no hard cap but lenders prefer under 41%." />
                    )}
                  </div>
                  <div style={{ fontSize: m.valueSize, fontWeight: 700, lineHeight: 1, color: m.color, fontFamily: font }}>
                    {m.value}
                  </div>
                  {m.sub && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", fontFamily: font, marginTop: 2 }}>
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
          <div style={{ display: "flex", gap: 14, marginTop: 5, fontSize: 12, fontFamily: font, flexWrap: "wrap" }}>
            <span style={{ color: "rgba(147,197,253,0.9)" }}>
              ■ Housing {calc.income > 0 ? ((calc.housing / calc.income) * 100).toFixed(0) : 0}%
            </span>
            <span style={{ color: "rgba(252,165,165,0.9)" }}>
              ■ Other Debts {calc.income > 0 ? ((calc.nonHousingDebts / calc.income) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Warnings ── */}
      {calc.backDTI >= 45.1 && (
        <div style={{ background: calc.backDTI >= 50 ? "#fef2f2" : "#fffbeb",
          border: `1px solid ${calc.backDTI >= 50 ? "#f87171" : "#f59e0b"}`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 10,
          display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 17, lineHeight: 1.3 }}>{calc.backDTI >= 50 ? "🔴" : "⚠️"}</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700,
              color: calc.backDTI >= 50 ? "#991b1b" : "#92400e", fontFamily: font }}>
              {calc.backDTI >= 50 ? "High DTI — Review Required" : "Elevated DTI"} — {calc.backDTI.toFixed(1)}% Back-End
            </span>
            <div style={{ fontSize: 12, color: calc.backDTI >= 50 ? "#7f1d1d" : "#78350f",
              fontFamily: font, lineHeight: 1.5, marginTop: 2 }}>
              {calc.backDTI >= 50
                ? "Back-end DTI above 50% is outside standard guidelines for most programs. Consult your LO — compensating factors, AUS findings, or program selection may be critical."
                : "Back-end DTI above 45% requires a closer look at guideline requirements. Many programs allow higher ratios with strong compensating factors."}
            </div>
          </div>
        </div>
      )}

      {/* FHA front-end warning */}
      {pcProgram === "fha" && calc.frontDTI > 46 && (
        <div style={{ background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 8,
          padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1.2 }}>⚠️</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e", fontFamily: font }}>
              FHA Front-End Ratio Alert — {calc.frontDTI.toFixed(1)}%
            </span>
            <div style={{ fontSize: 12, color: "#78350f", fontFamily: font, lineHeight: 1.5, marginTop: 2 }}>
              FHA's standard front-end (housing) ratio guideline is 31%, with a stretch to 46.99%
              when the AUS approves. A ratio above 46% is typically a manual-underwrite situation
              and may require strong compensating factors. <strong>Please check with your LO before proceeding.</strong>
            </div>
          </div>
        </div>
      )}

      {/* USDA ratio warnings */}
      {pcProgram === "usda" && (calc.frontDTI > 29 || calc.backDTI > 41) && (
        <div style={{ background: "#f0fdf4", border: "2px solid #16a34a55", borderRadius: 8,
          padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1.2 }}>⚠️</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#14532d", fontFamily: font }}>
              USDA Ratio Review — Front {calc.frontDTI.toFixed(1)}% / Back {calc.backDTI.toFixed(1)}%
            </span>
            <div style={{ fontSize: 12, color: "#166534", fontFamily: font, lineHeight: 1.5, marginTop: 2 }}>
              USDA standard ratios are <strong>29/41%</strong>. With compensating factors, GUS may approve up to <strong>32/44%</strong>,
              and up to <strong>34/46%</strong> with additional approval. Ratios above these levels will require
              manual underwrite and strong documented compensating factors.{" "}
              <strong>Please check with your LO — approval is not automatic at these levels.</strong>
            </div>
            {(calc.frontDTI > 34 || calc.backDTI > 46) && (
              <div style={{ fontSize: 12, color: "#14532d", fontFamily: font, marginTop: 4,
                fontStyle: "italic" }}>
                Note: Current ratios exceed USDA's maximum with compensating factors. This scenario will
                require a close review of GUS findings and loan-level approval.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ MONTHLY INCOME ══════════════ */}
      <SectionCard title="MONTHLY INCOME" accent={c.green || COLORS.green}>

        {/* Instructions */}
        <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8,
          background: (c.green || COLORS.green) + "10",
          border: `1px solid ${(c.green || COLORS.green) + "30"}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.green || COLORS.green,
            fontFamily: font, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            Enter GROSS (pre-tax) monthly income only.
            <InfoTip text="Your total income before taxes and deductions. For salaried employees, use your annual salary divided by 12. Self-employed borrowers use a 2-year average from their tax returns (Schedule C or K-1). Include all qualifying sources: base salary, consistent overtime, rental income, and other documented income." />
          </div>
          <span style={{ fontSize: 12, color: c.gray || COLORS.gray, fontFamily: font, lineHeight: 1.6 }}>
            💡 <strong>Best practice:</strong> Break income down by category rather than entering a single gross total.
            {" "}For example, instead of <em>$100,000</em>, enter separate rows for{" "}
            <em>$70k base salary</em>, <em>$27k commission</em>, and <em>$3k car allowance</em>.
            This makes the DTI analysis cleaner and easier to document for underwriting.
            Use <strong>Status → Exclude</strong> to keep an income source on record without counting it toward qualification.
          </span>
        </div>

        {/* Scrollable table — horizontal scroll on narrow screens */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>

        {/* Column headers */}
        {income.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ ...colHdr, width: COL_OWN, flexShrink: 0 }}>Owner</span>
            <span style={{ ...colHdr, width: COL_TYPE, flexShrink: 0 }}>Income Type</span>
            <span style={{ ...colHdr, flex: 1 }}>DESCRIPTIONS &amp; NOTES (optional)</span>
            <span style={{ ...colHdr, width: COL_AMT, flexShrink: 0, textAlign: "center" }}>Monthly</span>
            <span style={{ ...colHdr, width: COL_BAL, flexShrink: 0, textAlign: "center" }}>Annual</span>
            <span style={{ ...colHdr, width: COL_INC_STAT, flexShrink: 0, textAlign: "center" }}>Status</span>
            <span style={{ width: COL_REM, flexShrink: 0 }} />
          </div>
        )}

        {/* Confirmed income rows */}
        {income.map(row => {
          const excl = incomeExcluded(row);
          return (
            <div key={row.id} style={rowWrapIncome(row)}>
              <OwnerBadge
                owner={row.owner} opts={INCOME_OWNER_OPTS} width={COL_OWN}
                onClick={() => updateIncome(row.id, "owner", nextOwner(row.owner, INCOME_OWNER_OPTS))}
              />
              <select value={row.type} onChange={e => updateIncome(row.id, "type", e.target.value)}
                style={{ ...inputStyle, width: COL_TYPE, flexShrink: 0, padding: "6px 6px",
                  textDecoration: excl ? "line-through" : "none",
                  background: excl ? "transparent" : (c.bg || "#fff"),
                }}>
                {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="text" value={row.notes} placeholder="Description / notes…"
                onChange={e => updateIncome(row.id, "notes", e.target.value)}
                style={{ ...inputStyle, flex: 1,
                  textDecoration: excl ? "line-through" : "none",
                  background: excl ? "transparent" : (c.bg || "#fff"),
                  color: excl ? (c.gray || COLORS.gray) : (c.text || "#333"),
                }} />
              <div style={{ position: "relative", width: COL_AMT, flexShrink: 0 }}>
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
                <input type="text" inputMode="decimal" onFocus={(e) => e.target.select()}
                  value={addCommas(row.amount)}
                  onChange={e => updateIncome(row.id, "amount", e.target.value.replace(/[^0-9.]/g, ""))}
                  style={{ ...inputStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                    textDecoration: excl ? "line-through" : "none",
                    background: excl ? "transparent" : (c.bg || "#fff"),
                    color: excl ? (c.gray || COLORS.gray) : (c.text || "#333"),
                  }} />
              </div>
              {/* Annual — read-only */}
              <div style={{ position: "relative", width: COL_BAL, flexShrink: 0 }}>
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
                <div style={{ ...readonlyStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                  textDecoration: excl ? "line-through" : "none",
                }}>
                  {addCommas(((parseFloat(row.amount) || 0) * 12).toFixed(0))}
                </div>
              </div>
              {/* Include / Exclude status */}
              <select
                value={row.status || (row.excluded ? "exclude" : "")}
                onChange={e => updateIncome(row.id, "status", e.target.value)}
                style={{ ...inputStyle, width: COL_INC_STAT, flexShrink: 0, fontSize: 12, padding: "5px 4px",
                  background: excl ? "#fff3cd" : (c.bg || "#fff"),
                  color: excl ? "#92400e" : (c.gray || COLORS.gray),
                  fontWeight: excl ? 700 : 400,
                  border: `1px solid ${excl ? "#f59e0b" : (c.border || COLORS.border)}`,
                }}>
                <option value="">Include</option>
                <option value="exclude">Exclude</option>
              </select>
              <button onClick={() => removeIncome(row.id)} style={{
                width: COL_REM, flexShrink: 0, background: "none", border: "none",
                cursor: "pointer", color: c.red || COLORS.red, fontSize: 16, lineHeight: 1, padding: 0,
              }}>✕</button>
            </div>
          );
        })}

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
            <input type="text" inputMode="decimal" onFocus={(e) => e.target.select()}
              value={addCommas(pendingAmt)}
              onChange={e => setPendingAmt(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              style={{ ...inputStyle, width: "100%", paddingLeft: 20, textAlign: "right",
                background: "transparent", border: `1px solid ${(c.green || COLORS.green) + "55"}` }} />
          </div>
          <div style={{ width: COL_BAL, flexShrink: 0 }} />
          <div style={{ width: COL_INC_STAT + COL_REM + 8, flexShrink: 0,
            fontSize: 12, color: (c.green || COLORS.green) + "99", fontFamily: font,
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

        </div>{/* end scroll wrapper */}
      </SectionCard>

      {/* ══════════════ MONTHLY DEBT OBLIGATIONS ══════════════ */}
      <div style={{ marginTop: 16 }}>
        <SectionCard title="MONTHLY DEBT" accent={c.red || COLORS.red}>

          {/* Instructions */}
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8,
            background: (c.red || COLORS.red) + "10",
            border: `1px solid ${(c.red || COLORS.red) + "30"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <InfoTip text="All recurring monthly debt payments that appear on your credit report — car loans, student loans, credit card minimum payments, personal loans. Do NOT include utilities, subscriptions, cell phone bills, or insurance — these are not counted in your DTI calculation." />
            </div>
            <span style={{ fontSize: 12, color: c.gray || COLORS.gray, fontFamily: font, lineHeight: 1.6 }}>
              💡 <strong>Enter minimum monthly payments only.</strong>{" "}
              Focus on debts that appear on a credit report (credit cards, auto loans, student loans, personal loans)
              and any large non-credit obligations (alimony, child support, co-signed leases).
              Do <em>not</em> include routine bills like cell phone, utilities, groceries, or subscriptions
              — those are <em>not</em> counted in DTI.
            </span>
          </div>

          {/* Scrollable table — horizontal scroll on narrow screens */}
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>

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
              width: COL_OWN, flexShrink: 0, fontSize: 12, padding: "4px 2px",
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
            {/* Balance — show loan amount for mortgage row */}
            <div style={{ ...readonlyStyle, width: COL_BAL, flexShrink: 0, textAlign: "right",
              color: c.navy || COLORS.navy, fontSize: 14, fontWeight: 600 }}>
              {pcLa && parseFloat(pcLa) > 0 ? "$" + addCommas(String(Math.round(parseFloat(pcLa)))) : "—"}
            </div>
            {/* Status — always counted, no control shown */}
            <div style={{ width: COL_STATUS, flexShrink: 0,
              fontSize: 12, color: c.gray || COLORS.gray, fontFamily: font,
              fontStyle: "italic", textAlign: "center" }}>
              Always counted
            </div>
            <div style={{ width: COL_REM, flexShrink: 0 }} />
          </div>

          {/* Dynamic debt rows */}
          {debts.map(d => (
            <div key={d.id}>
            <div style={rowWrapDebt(d.status)}>
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
                {(parseFloat(d.amount) || 0) >= 0 && (
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                    fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
                )}
                <input type="text" inputMode="decimal" onFocus={(e) => e.target.select()}
                  value={addCommas(d.amount)}
                  onChange={e => {
                    // Strip commas first, then allow digits, dot, and a leading minus only
                    let val = e.target.value.replace(/,/g, "");
                    val = val.replace(/[^0-9.\-]/g, "");
                    if (val.indexOf("-") > 0) val = val.replace(/-/g, "");
                    updateDebt(d.id, "amount", val);
                  }}
                  placeholder={d.type === "Rental Income" ? "e.g. -1,125" : ""}
                  style={{ ...inputStyle, width: "100%",
                    paddingLeft: (parseFloat(d.amount) || 0) >= 0 ? 20 : 8,
                    textAlign: "right",
                    textDecoration: d.status === "exclude" ? "line-through" : "none",
                    background: d.status === "payoff" ? "#fffbeb" : d.status === "exclude" ? "transparent" : (c.bg || "#fff"),
                    color: d.status === "exclude" ? (c.gray || COLORS.gray)
                         : (parseFloat(d.amount) || 0) < 0 ? "#16a34a"
                         : (c.text || "#333"),
                    fontWeight: (parseFloat(d.amount) || 0) < 0 ? 700 : 400,
                  }} />
              </div>
              {/* Balance */}
              <div style={{ position: "relative", width: COL_BAL, flexShrink: 0 }}>
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  fontSize: 14, color: c.gray || COLORS.gray, pointerEvents: "none" }}>$</span>
                <input type="text" inputMode="decimal" onFocus={(e) => e.target.select()}
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
            {d.type === "Rental Income" && (
              <div style={{ fontSize: 12, color: "#16a34a", fontFamily: font, fontStyle: "italic",
                paddingLeft: 8, marginTop: -2, marginBottom: 4, lineHeight: 1.5 }}>
                💡 Rental income <strong>lowers</strong> your DTI — enter it as a <strong>negative number</strong>. Example: rental property mortgage = $1,200/mo debt (entered above). Gross rent collected = $1,500/mo. Most lenders count 75% of gross rent → enter <strong>-1125</strong>. Net DTI hit: $1,200 − $1,125 = only <strong>$75/mo</strong> added to obligations instead of $1,200.
              </div>
            )}
            </div>
          ))}

          {/* Student Loan Calculator callout — shown when SL section has loans entered */}
          {hasStudentLoan && slLoans.length > 0 && slTotals[slProgram] > 0 && (() => {
            const slDebt = debts.find(d => d.type === "Student Loan" && !d.status);
            const slDebtAmt = slDebt ? (parseFloat(slDebt.amount) || 0) : 0;
            const slCalcAmt = Math.round(slTotals[slProgram]);
            const mismatch = Math.abs(slDebtAmt - slCalcAmt) > 1;
            return (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6,
                background: mismatch ? "#fef3c7" : "#f0fdf4",
                border: `1px solid ${mismatch ? "#f59e0b77" : "#22c55e55"}`,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 12, fontFamily: font, color: mismatch ? "#92400e" : "#15803d", fontWeight: 600, lineHeight: 1.4 }}>
                  {mismatch ? "⚠ " : "✓ "}
                  Student Loan Calculator ({SL_PROGRAMS.find(p => p.value === slProgram)?.label || slProgram}): <strong>${slCalcAmt.toLocaleString()}/mo</strong>
                  {mismatch && slDebt
                    ? ` — "Student Loan" row above shows $${slDebtAmt.toLocaleString()}/mo`
                    : !slDebt ? " — no Student Loan row found in debts above" : ""}
                </div>
                {mismatch && slDebt && (
                  <button onClick={() => setDebtsStr(JSON.stringify(debts.map(d => d.id === slDebt.id ? { ...d, amount: String(slCalcAmt) } : d)))}
                    style={{ padding: "4px 12px", borderRadius: 4, fontSize: 12, fontFamily: font,
                      background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                    Update to ${slCalcAmt.toLocaleString()}
                  </button>
                )}
              </div>
            );
          })()}

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
                Total Monthly Debts (included in DTI)
              </span>
              <span style={{ width: COL_AMT, flexShrink: 0, fontSize: 16, fontWeight: 700,
                color: c.red || COLORS.red, fontFamily: font, textAlign: "right" }}>
                ${addCommas(calc.totalDebts.toFixed(2).replace(/\.00$/, ""))}
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

          </div>{/* end scroll wrapper */}
          </div>
        </SectionCard>
      </div>

      {/* ══════════════ STUDENT LOAN QUALIFIER ══════════════ */}
      {/* Only visible when a "Student Loan" liability is in the debts section above */}
      <div style={{ marginTop: 16, display: hasStudentLoan ? "block" : "none" }}>
        <SectionCard title="STUDENT LOAN QUALIFYING PAYMENT CALCULATOR" accent={c.blue || COLORS.blue}>

          {/* Intro */}
          <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginBottom: 12, lineHeight: 1.6,
            padding: "8px 10px", background: c.bgAlt, borderRadius: 6, border: `1px solid ${c.border}` }}>
            Student loan qualifying payments vary significantly by agency. Enter each student loan below
            to see the correct DTI payment for every program side-by-side, then copy the appropriate
            amount into the Monthly Debt section above.
          </div>

          {/* Loan program selector */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.05em", color: c.gray, fontFamily: font, marginBottom: 6 }}>
              Loan Program (highlights relevant column)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SL_PROGRAMS.map(p => (
                <button key={p.value} onClick={() => setSlProgram(p.value)} style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontFamily: font,
                  fontWeight: 600, cursor: "pointer", border: "none",
                  background: slProgram === p.value ? (c.navy || COLORS.navy) : (c.bgAlt || "#f4f5f7"),
                  color: slProgram === p.value ? "#fff" : (c.gray || COLORS.gray),
                  transition: "all 0.15s",
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Agency header row */}
          {slLoans.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 72px)", gap: 4,
              marginBottom: 4, paddingLeft: 4 }}>
              <div />
              {SL_AGENCIES.map(ag => (
                <div key={ag.id} style={{
                  fontSize: 10, fontWeight: 700, textAlign: "center", fontFamily: font,
                  color: slProgram === ag.id ? (c.navy || COLORS.navy) : (c.gray || COLORS.gray),
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  background: slProgram === ag.id ? (c.blue + "18" || "#dbeafe") : "transparent",
                  borderRadius: 4, padding: "2px 0",
                }}>{ag.short}</div>
              ))}
            </div>
          )}

          {/* Loan cards */}
          {slLoans.map((loan, idx) => {
            const payments = SL_AGENCIES.reduce((acc, ag) => {
              acc[ag.id] = calcSLPayment(loan, ag.id);
              return acc;
            }, {});

            return (
              <div key={loan.id} style={{
                border: `1px solid ${c.border}`, borderRadius: 8, padding: 10,
                marginBottom: 10, background: c.bg,
              }}>
                {/* Row 1: description + remove */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.gray, fontFamily: font, minWidth: 20 }}>
                    #{idx + 1}
                  </div>
                  <input
                    placeholder="Description (e.g. Navient – Undergrad, Parent PLUS)"
                    value={loan.description}
                    onChange={e => updateSlLoan(loan.id, "description", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => removeSlLoan(loan.id)} style={{
                    background: "none", border: "none", color: c.gray, cursor: "pointer",
                    fontSize: 16, lineHeight: 1, padding: "0 4px",
                  }}>×</button>
                </div>

                {/* Row 2: balance + credit report payment + status */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ flex: "1 1 120px" }}>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginBottom: 2 }}>Outstanding Balance</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      <span style={{ padding: "6px 8px", background: c.bgAlt, border: `1px solid ${c.border}`,
                        borderRight: "none", borderRadius: "4px 0 0 4px", fontSize: 15, color: c.gray }}>$</span>
                      <input inputMode="decimal" onFocus={(e) => e.target.select()} value={addCommas(loan.balance)} onChange={e => updateSlLoan(loan.id, "balance", e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0" style={{ ...inputStyle, borderRadius: "0 4px 4px 0", width: "100%" }} />
                    </div>
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginBottom: 2 }}>Credit Report Payment</div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ padding: "6px 8px", background: c.bgAlt, border: `1px solid ${c.border}`,
                        borderRight: "none", borderRadius: "4px 0 0 4px", fontSize: 15, color: c.gray }}>$</span>
                      <input inputMode="decimal" onFocus={(e) => e.target.select()} value={addCommas(loan.creditReportPmt)} onChange={e => updateSlLoan(loan.id, "creditReportPmt", e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0" style={{ ...inputStyle, borderRadius: "0 4px 4px 0", width: "100%" }} />
                    </div>
                  </div>
                  <div style={{ flex: "2 1 200px" }}>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginBottom: 2 }}>Repayment Status</div>
                    <select value={loan.status} onChange={e => updateSlLoan(loan.id, "status", e.target.value)}
                      style={{ ...inputStyle, width: "100%" }}>
                      {SL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Conditional: VA deferred 12-month exclusion */}
                {loan.status === "deferred" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                    padding: "6px 8px", background: "#fffbeb", borderRadius: 6, border: "1px solid #f59e0b44" }}>
                    <input type="checkbox" checked={!!loan.vaDeferred12mo}
                      onChange={e => updateSlLoan(loan.id, "vaDeferred12mo", e.target.checked)}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <div style={{ fontSize: 12, fontFamily: font, color: c.text || c.navy }}>
                      <strong>VA only:</strong> Deferment extends 12+ months beyond closing date
                      — if checked, VA excludes this loan from DTI entirely
                    </div>
                  </div>
                )}

                {/* Conditional: PSLF near-forgiveness */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={!!loan.pslf}
                    onChange={e => updateSlLoan(loan.id, "pslf", e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer" }} />
                  <div style={{ fontSize: 12, fontFamily: font, color: c.gray }}>
                    Enrolled in PSLF / forgiveness with <strong>fewer than 10 payments remaining</strong>
                    — Fannie Mae & Freddie Mac may exclude from DTI (documentation required)
                  </div>
                </div>

                {/* Agency payment grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 72px)", gap: 4,
                  borderTop: `1px solid ${c.border}`, paddingTop: 8 }}>
                  <div style={{ fontSize: 12, color: c.gray, fontFamily: font, display: "flex",
                    alignItems: "center" }}>Qualifying payment used in DTI:</div>
                  {SL_AGENCIES.map(ag => {
                    const pmt = payments[ag.id];
                    const isActive = slProgram === ag.id;
                    return (
                      <div key={ag.id} style={{
                        textAlign: "center", padding: "4px 2px", borderRadius: 6, fontFamily: font,
                        background: isActive ? (c.navy || COLORS.navy) : (c.bgAlt || "#f4f5f7"),
                        color: isActive ? "#fff" : (c.text || c.navy),
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 1 }}>{ag.short}</div>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>
                          {pmt === 0 ? <span style={{ color: isActive ? "#86efac" : "#16a34a" }}>$0</span>
                                     : `$${Math.round(pmt).toLocaleString()}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Explanatory note per status */}
                {(() => {
                  const bal = parseFloat((loan.balance || "").replace(/,/g,"")) || 0;
                  const notes = {
                    deferred: `Most agencies use 0.5% of balance. Fannie Mae uses 1% of balance. VA excludes entirely if deferred 12+ months past closing.`,
                    forbearance: `All agencies require a qualifying payment — SAVE administrative forbearance is treated like standard forbearance. 0.5% of balance (Freddie/FHA/USDA), 1% (Fannie), 5%÷12 (VA).`,
                    active: bal > 0
                      ? `Active repayment: uses the credit report payment. If the credit report shows $0, a percentage of balance is used — 1% ($${Math.round(bal*0.01).toLocaleString()}) for Fannie, 0.5% ($${Math.round(bal*0.005).toLocaleString()}) for Freddie/FHA/USDA. VA uses the higher of the credit report or 5%÷12 ($${Math.round(bal*0.05/12).toLocaleString()}).`
                      : "Active repayment: uses the credit report payment. If the credit report shows $0, a percentage of balance is used (1% Fannie, 0.5% Freddie/FHA/USDA, 5%÷12 VA).",
                  };
                  const note = notes[loan.status];
                  return note ? (
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 6, lineHeight: 1.5 }}>
                      💡 {note}
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })}

          {/* Add loan button */}
          <button onClick={addSlLoan} style={{
            width: "100%", padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
            fontFamily: font, cursor: "pointer", border: `1.5px dashed ${c.border}`,
            background: "transparent", color: c.blue || COLORS.blue, marginBottom: 12,
          }}>+ Add Student Loan</button>

          {/* Totals row */}
          {slLoans.length > 0 && (
            <div style={{ borderTop: `2px solid ${c.border}`, paddingTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 72px)", gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: font,
                  color: c.navy || COLORS.navy, display: "flex", alignItems: "center" }}>
                  Total qualifying payment:
                </div>
                {SL_AGENCIES.map(ag => {
                  const total = slTotals[ag.id];
                  const isActive = slProgram === ag.id;
                  return (
                    <div key={ag.id} style={{
                      textAlign: "center", padding: "6px 2px", borderRadius: 6, fontFamily: font,
                      background: isActive ? (c.navy || COLORS.navy) : (c.bgAlt || "#f4f5f7"),
                      color: isActive ? "#fff" : (c.text || c.navy),
                      border: isActive ? "none" : `1px solid ${c.border}`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 1 }}>{ag.short}</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>
                        {total === 0
                          ? <span style={{ color: isActive ? "#86efac" : "#16a34a" }}>$0</span>
                          : `$${Math.round(total).toLocaleString()}`}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 8, lineHeight: 1.5 }}>
                ↑ Enter the <strong>{SL_PROGRAMS.find(p => p.value === slProgram)?.label || slProgram}</strong> total
                (${Math.round(slTotals[slProgram] || 0).toLocaleString()}/mo) into the Monthly Debt section above as "Student Loan."
              </div>
            </div>
          )}

          {/* Reference card */}
          <div style={{ marginTop: 14, fontSize: 12, color: c.gray, fontFamily: font, lineHeight: 1.7,
            padding: "10px 12px", background: c.bgAlt, borderRadius: 8, border: `1px solid ${c.border}` }}>
            <div style={{ fontWeight: 700, color: c.navy || COLORS.navy, marginBottom: 4, fontSize: 12 }}>
              Quick Reference — Qualifying Payment Rules
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "2px 10px" }}>
              <span style={{ fontWeight: 700, color: c.navy || COLORS.navy }}>Fannie Mae</span>
              <span>Active → credit report (if $0: use 1% of balance) · Deferred/Forbearance → 1% of balance · PSLF &lt;10 pmts → exclude</span>
              <span style={{ fontWeight: 700, color: c.navy || COLORS.navy }}>Freddie Mac</span>
              <span>Active → credit report (if $0: use 0.5% of balance) · Deferred/Forbearance → 0.5% of balance · PSLF &lt;10 pmts → exclude</span>
              <span style={{ fontWeight: 700, color: c.navy || COLORS.navy }}>FHA</span>
              <span>Active → credit report (if $0: use 0.5% of balance, ML 2021-13) · Deferred/Forbearance → 0.5% · No PSLF exclusion</span>
              <span style={{ fontWeight: 700, color: c.navy || COLORS.navy }}>VA</span>
              <span>Active → higher of credit report or 5%÷12 · Deferred 12+ mo. post-close → excluded · Deferred/Forbearance → 5%÷12 · No PSLF exclusion</span>
              <span style={{ fontWeight: 700, color: c.navy || COLORS.navy }}>USDA</span>
              <span>Active → credit report (if $0: use 0.5% of balance, PN 651) · Deferred/Forbearance → 0.5% · No PSLF exclusion</span>
            </div>
            <div style={{ marginTop: 6, color: c.gray, fontStyle: "italic" }}>
              FHA, VA, USDA: loan in default = automatic disqualification. SAVE Plan forbearance: treated as standard forbearance by all agencies. Sources: Fannie Mae B3-6-05 (03/2026), Freddie Mac Guide §5306, HUD ML 2021-13, VA Circular 26-17-02, USDA HB-1-3555 PN-651.
            </div>
          </div>

        </SectionCard>
      </div>

    </div>
  );
}

window.DTICalculator = DTICalculator;
