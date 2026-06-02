import { useState, useMemo, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════
// MORTGAGE MARK COMPREHENSIVE TOOLKIT
// CMG Home Loans · NMLS #729612
// ═══════════════════════════════════════════════════════════════════════

// ─── Utility Functions ─────────────────────────────────────────────────
function pmt(rate, nper, pv) {
  if (rate === 0) return pv / nper;
  const x = Math.pow(1 + rate, nper);
  return (pv * rate * x) / (x - 1);
}

function buildAmortization(balance, monthlyRate, totalPayments, monthlyPmt) {
  const schedule = [];
  let remaining = balance;
  for (let i = 1; i <= totalPayments; i++) {
    const interest = remaining * monthlyRate;
    const principal = monthlyPmt - interest;
    remaining = Math.max(0, remaining - principal);
    schedule.push({
      month: i, payment: monthlyPmt, principal, interest, balance: remaining,
      totalInterest: schedule.length > 0 ? schedule[schedule.length - 1].totalInterest + interest : interest,
    });
    if (remaining <= 0.01) break;
  }
  return schedule;
}

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function fmt2(val) {
  if (val === null || val === undefined || isNaN(val)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function addCommas(str) {
  const cleaned = String(str).replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function stripCommas(str) { return String(str).replace(/,/g, ""); }

function calcTrueBreakEven(curSchedule, newSchedule, curPMI, newPMI, closingCosts, maxMonths) {
  let curCumulative = 0, newCumulative = closingCosts, breakEvenMonth = null;
  const timeline = [];
  for (let m = 0; m < maxMonths; m++) {
    const curInterest = curSchedule[m] ? curSchedule[m].interest : 0;
    const newInterest = newSchedule[m] ? newSchedule[m].interest : 0;
    curCumulative += curInterest + curPMI;
    newCumulative += newInterest + newPMI;
    const netSavings = curCumulative - newCumulative;
    timeline.push({ month: m + 1, curMonthInterest: curInterest, newMonthInterest: newInterest, curCumulative, newCumulative, netSavings });
    if (breakEvenMonth === null && netSavings >= 0) breakEvenMonth = m + 1;
  }
  return { breakEvenMonth, timeline };
}

// ─── Color Constants ───────────────────────────────────────────────────
const COLORS = {
  navy: "#0C4160", navyLight: "#164E72", blue: "#48A0CE", blueLight: "#E8F4FA",
  green: "#1B8A5A", greenLight: "#E8F5EE", red: "#C0392B", redLight: "#FDECEB",
  gold: "#D4920B", goldLight: "#FFF8E1", gray: "#6B7D8A", grayLight: "#94A3B0",
  border: "#E0E8E8", bg: "#F7FAFB", bgAlt: "#FAFCFD", white: "#fff",
};

const font = "'DM Sans', sans-serif";

// ─── Texas Fee Data ─────────────────────────────────────────────────────
const TEXAS_FEES = {
  titleInsurance: { // Texas Department of Insurance regulated rates (per $1000 of policy)
    basicRate: (amount) => {
      if (amount <= 0) return 0;
      let premium = 0;
      if (amount <= 100000) premium = amount * 5.75 / 1000;
      else if (amount <= 200000) premium = 575 + (amount - 100000) * 5.00 / 1000;
      else if (amount <= 500000) premium = 1075 + (amount - 200000) * 4.50 / 1000;
      else if (amount <= 1000000) premium = 2425 + (amount - 500000) * 3.50 / 1000;
      else premium = 4175 + (amount - 1000000) * 2.75 / 1000;
      return Math.round(premium);
    },
    simultaneous: (loanAmt, purchasePrice) => {
      // Simultaneous issue discount for lender's policy when owner's policy is also issued
      if (loanAmt <= 0) return 0;
      const ownerPremium = TEXAS_FEES.titleInsurance.basicRate(purchasePrice);
      const lenderPremium = TEXAS_FEES.titleInsurance.basicRate(loanAmt);
      return Math.round(lenderPremium * 0.40); // ~40% of lender's policy for simultaneous issue
    }
  },
  transferTax: 0, // Texas has NO transfer tax / documentary stamps
  recordingFees: { deed: 26, mortgage: 44, release: 15 },
  surveyFee: { min: 350, max: 600, typical: 450 },
  appraisal: { conventional: 550, fha: 600, va: 550, jumbo: 750 },
  creditReport: 65,
  floodCert: 15,
  taxServiceFee: 85,
  escrowSetup: (monthlyTaxes, monthlyInsurance) => {
    // Texas requires 2 months taxes + 2 months insurance escrow cushion
    return Math.round((monthlyTaxes * 2) + (monthlyInsurance * 2));
  },
  prepaidInterest: (loanAmount, rate, days) => {
    return Math.round((loanAmount * (rate / 100) / 365) * days);
  },
  attorneyFee: 0, // Texas does not require attorney at closing
  homeWarranty: { typical: 550, range: "400-700" },
};

// ─── Shared Components ─────────────────────────────────────────────────
function LabeledInput({ label, value, onChange, prefix, suffix, type = "number", step, hint, useCommas, disabled, small }) {
  const displayVal = useCommas ? addCommas(value) : value;
  return (
    <div style={{ marginBottom: small ? 10 : 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.gray, marginBottom: 5, fontFamily: font }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: disabled ? "#f0f0f0" : COLORS.bg, border: `1.5px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
        {prefix && <span style={{ padding: "8px 0 8px 10px", color: COLORS.navy, fontWeight: 600, fontSize: small ? 13 : 15, fontFamily: font }}>{prefix}</span>}
        <input
          type={useCommas ? "text" : type}
          value={displayVal}
          onChange={(e) => onChange(useCommas ? stripCommas(e.target.value) : e.target.value)}
          step={step}
          disabled={disabled}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: small ? "8px 10px" : "10px 12px", fontSize: small ? 13 : 15, fontWeight: 500, color: COLORS.navy, fontFamily: font, width: "100%" }}
        />
        {suffix && <span style={{ padding: "8px 10px 8px 0", color: COLORS.gray, fontSize: small ? 11 : 13, fontWeight: 500, fontFamily: font }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 3, fontFamily: font }}>{hint}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: "pointer" }} onClick={() => onChange(!checked)}>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: checked ? COLORS.blue : COLORS.border, position: "relative", transition: "background 0.2s" }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 2, left: checked ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.navy, fontFamily: font }}>{label}</span>
    </div>
  );
}

function Select({ label, value, onChange, options, small }) {
  return (
    <div style={{ marginBottom: small ? 10 : 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.gray, marginBottom: 5, fontFamily: font }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: small ? "8px 10px" : "10px 12px", background: COLORS.bg, border: `1.5px solid ${COLORS.border}`, borderRadius: 8, fontSize: small ? 13 : 15, fontWeight: 500, color: COLORS.navy, fontFamily: font, cursor: "pointer" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function MetricCard({ label, value, sublabel, positive, large, highlight, accent }) {
  const accentColor = accent || COLORS.blue;
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 100%)` : COLORS.white,
      borderRadius: 12, padding: large ? "20px 18px" : "16px 14px",
      border: highlight ? "none" : `1px solid ${COLORS.border}`,
      boxShadow: highlight ? "0 4px 20px rgba(12,65,96,0.25)" : "0 1px 4px rgba(0,0,0,0.04)",
      flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: highlight ? "rgba(255,255,255,0.7)" : COLORS.gray, marginBottom: 6, fontFamily: font }}>{label}</div>
      <div style={{ fontSize: large ? 28 : 22, fontWeight: 700, color: highlight ? "#fff" : positive ? COLORS.green : positive === false ? COLORS.red : COLORS.navy, fontFamily: font, lineHeight: 1.1 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11, color: highlight ? "rgba(255,255,255,0.6)" : COLORS.grayLight, marginTop: 4, fontFamily: font }}>{sublabel}</div>}
    </div>
  );
}

function SectionCard({ title, children, accent, collapsed, onToggle }) {
  return (
    <div style={{ background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 16, overflow: "hidden" }}>
      {title && (
        <div onClick={onToggle} style={{ padding: "14px 18px", borderBottom: collapsed ? "none" : `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8, cursor: onToggle ? "pointer" : "default" }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: accent || COLORS.navy }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font, flex: 1 }}>{title}</div>
          {onToggle && <span style={{ color: COLORS.gray, fontSize: 14 }}>{collapsed ? "▸" : "▾"}</span>}
        </div>
      )}
      {!collapsed && <div style={{ padding: 18 }}>{children}</div>}
    </div>
  );
}

function Button({ label, onClick, primary, small, color, fullWidth, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "8px 16px" : "12px 24px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
      fontSize: small ? 12 : 14, fontWeight: 700, fontFamily: font, letterSpacing: "0.02em",
      background: disabled ? "#ccc" : primary ? (color || COLORS.navy) : COLORS.border,
      color: primary ? "#fff" : COLORS.navy,
      width: fullWidth ? "100%" : "auto",
      transition: "all 0.2s", opacity: disabled ? 0.6 : 1,
    }}>{label}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 1: PAYMENT CALCULATOR
// ═══════════════════════════════════════════════════════════════════════
function PaymentCalculator() {
  const [loanAmount, setLoanAmount] = useState("350000");
  const [homePrice, setHomePrice] = useState("437500");
  const [downPaymentPct, setDownPaymentPct] = useState("20");
  const [rate, setRate] = useState("6.75");
  const [term, setTerm] = useState("30");
  const [propertyTax, setPropertyTax] = useState("7500");
  const [homeInsurance, setHomeInsurance] = useState("2400");
  const [pmiRate, setPmiRate] = useState("0.55");
  const [hoaDues, setHoaDues] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const syncDown = (hp, dp) => {
    const h = parseFloat(hp) || 0;
    const d = parseFloat(dp) || 0;
    setLoanAmount(String(Math.round(h * (1 - d / 100))));
  };

  const calc = useMemo(() => {
    const la = parseFloat(loanAmount) || 0;
    const hp = parseFloat(homePrice) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseFloat(term) || 30) * 12;
    const monthlyPI = pmt(r, n, la);
    const monthlyTax = (parseFloat(propertyTax) || 0) / 12;
    const monthlyIns = (parseFloat(homeInsurance) || 0) / 12;
    const dp = parseFloat(downPaymentPct) || 0;
    const monthlyPMI = dp < 20 ? (la * (parseFloat(pmiRate) || 0) / 100) / 12 : 0;
    const monthlyHOA = parseFloat(hoaDues) || 0;
    const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyPMI + monthlyHOA;
    const totalInterest = (monthlyPI * n) - la;
    const ltv = hp > 0 ? (la / hp * 100) : 0;
    const schedule = buildAmortization(la, r, n, monthlyPI);
    return { monthlyPI, monthlyTax, monthlyIns, monthlyPMI, monthlyHOA, totalMonthly, totalInterest, ltv, la, n, schedule };
  }, [loanAmount, homePrice, rate, term, propertyTax, homeInsurance, downPaymentPct, pmiRate, hoaDues]);

  // Pie chart data
  const pieData = [
    { label: "Principal & Interest", value: calc.monthlyPI, color: COLORS.navy },
    { label: "Property Tax", value: calc.monthlyTax, color: COLORS.blue },
    { label: "Home Insurance", value: calc.monthlyIns, color: COLORS.green },
    ...(calc.monthlyPMI > 0 ? [{ label: "PMI", value: calc.monthlyPMI, color: COLORS.gold }] : []),
    ...(calc.monthlyHOA > 0 ? [{ label: "HOA", value: calc.monthlyHOA, color: COLORS.grayLight }] : []),
  ].filter(d => d.value > 0);

  const total = pieData.reduce((s, d) => s + d.value, 0);
  let cumulativeAngle = 0;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="LOAN DETAILS" accent={COLORS.navy}>
          <LabeledInput label="Home Price" prefix="$" value={homePrice} onChange={(v) => { setHomePrice(v); syncDown(v, downPaymentPct); }} useCommas />
          <LabeledInput label="Down Payment" value={downPaymentPct} onChange={(v) => { setDownPaymentPct(v); syncDown(homePrice, v); }} suffix="%" hint={`${fmt(Math.round((parseFloat(homePrice) || 0) * (parseFloat(downPaymentPct) || 0) / 100))} down payment`} />
          <LabeledInput label="Loan Amount" prefix="$" value={loanAmount} onChange={setLoanAmount} useCommas />
          <LabeledInput label="Interest Rate" value={rate} onChange={setRate} suffix="%" step="0.125" />
          <Select label="Loan Term" value={term} onChange={setTerm} options={[
            { value: "30", label: "30-Year Fixed" }, { value: "25", label: "25-Year Fixed" },
            { value: "20", label: "20-Year Fixed" }, { value: "15", label: "15-Year Fixed" },
            { value: "10", label: "10-Year Fixed" },
          ]} />
        </SectionCard>

        <div>
          {/* Big Payment Display */}
          <div style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius: 12, padding: 24, color: "#fff", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 8 }}>TOTAL MONTHLY PAYMENT</div>
            <div style={{ fontSize: 48, fontWeight: 800, fontFamily: font, lineHeight: 1 }}>{fmt2(calc.totalMonthly)}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>Principal, Interest, Taxes, Insurance{calc.monthlyPMI > 0 ? ", PMI" : ""}{calc.monthlyHOA > 0 ? ", HOA" : ""}</div>
          </div>

          {/* Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {pieData.map((d) => (
              <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: d.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: COLORS.gray, fontWeight: 600, fontFamily: font }}>{d.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt2(d.value)}</div>
                </div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</div>
              </div>
            ))}
          </div>

          <SectionCard title="TAXES & INSURANCE" accent={COLORS.blue}>
            <LabeledInput label="Annual Property Tax" prefix="$" value={propertyTax} onChange={setPropertyTax} useCommas small hint={`${fmt2((parseFloat(propertyTax) || 0) / 12)}/mo`} />
            <LabeledInput label="Annual Home Insurance" prefix="$" value={homeInsurance} onChange={setHomeInsurance} useCommas small hint={`${fmt2((parseFloat(homeInsurance) || 0) / 12)}/mo`} />
            {parseFloat(downPaymentPct) < 20 && (
              <LabeledInput label="PMI Rate" value={pmiRate} onChange={setPmiRate} suffix="% annual" small hint={`${fmt2(calc.monthlyPMI)}/mo · Removed at 80% LTV`} />
            )}
            <LabeledInput label="HOA Dues" prefix="$" value={hoaDues} onChange={setHoaDues} suffix="/mo" small />
          </SectionCard>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <MetricCard label="Total Interest" value={fmt(calc.totalInterest)} sublabel={`Over ${term} years`} />
        <MetricCard label="Total Cost" value={fmt(calc.totalInterest + calc.la)} sublabel="Principal + Interest" />
        <MetricCard label="LTV" value={`${calc.ltv.toFixed(1)}%`} sublabel={calc.ltv > 80 ? "PMI Required" : "No PMI"} positive={calc.ltv <= 80} />
        <MetricCard label="P&I per $1K" value={fmt2(calc.monthlyPI / (calc.la / 1000))} sublabel="Payment factor" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 2: REFINANCE ANALYZER (Enhanced from original)
// ═══════════════════════════════════════════════════════════════════════
function RefinanceAnalyzer() {
  const [curBalance, setCurBalance] = useState("320000");
  const [curRate, setCurRate] = useState("7.25");
  const [curTermOriginal, setCurTermOriginal] = useState("30");
  const [curMonthsPaid, setCurMonthsPaid] = useState("36");
  const [curPMI, setCurPMI] = useState("185");
  const [curHomeValue, setCurHomeValue] = useState("420000");
  const [curEscrow, setCurEscrow] = useState("450");
  const [newRate, setNewRate] = useState("6.25");
  const [newTerm, setNewTerm] = useState("30");
  const [closingCosts, setClosingCosts] = useState("6500");
  const [rollInCosts, setRollInCosts] = useState(true);
  const [newPMI, setNewPMI] = useState("0");
  const [pmiRemoval, setPmiRemoval] = useState(true);
  const [cashOutEnabled, setCashOutEnabled] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState("0");
  const [activeTab, setActiveTab] = useState("summary");

  const analysis = useMemo(() => {
    const cb = parseFloat(curBalance) || 0;
    const cr = (parseFloat(curRate) || 0) / 100 / 12;
    const cTermOrig = (parseFloat(curTermOriginal) || 30) * 12;
    const cPaid = parseFloat(curMonthsPaid) || 0;
    const cRemaining = cTermOrig - cPaid;
    const cPmiMonthly = parseFloat(curPMI) || 0;
    const escrow = parseFloat(curEscrow) || 0;
    const hv = parseFloat(curHomeValue) || 0;
    const nr = (parseFloat(newRate) || 0) / 100 / 12;
    const nTermMonths = (parseFloat(newTerm) || 30) * 12;
    const cc = parseFloat(closingCosts) || 0;
    const co = cashOutEnabled ? (parseFloat(cashOutAmount) || 0) : 0;
    const nPmiMonthly = pmiRemoval ? 0 : (parseFloat(newPMI) || 0);
    const curPI = pmt(cr, cRemaining, cb);
    const curTotalPayment = curPI + cPmiMonthly + escrow;
    const newLoanAmt = cb + (rollInCosts ? cc : 0) + co;
    const newPI = pmt(nr, nTermMonths, newLoanAmt);
    const newTotalPayment = newPI + nPmiMonthly + escrow;
    const monthlySavings = (curPI + cPmiMonthly) - (newPI + nPmiMonthly);
    const curSchedule = buildAmortization(cb, cr, cRemaining, curPI);
    const newSchedule = buildAmortization(newLoanAmt, nr, nTermMonths, newPI);
    const curTotalInterest = curSchedule.reduce((s, r) => s + r.interest, 0);
    const newTotalInterest = newSchedule.reduce((s, r) => s + r.interest, 0);
    const interestSaved = curTotalInterest - newTotalInterest;
    const maxAnalysisMonths = Math.max(cRemaining, nTermMonths);
    const trueBreakEven = calcTrueBreakEven(curSchedule, newSchedule, cPmiMonthly, nPmiMonthly, cc, maxAnalysisMonths);
    const fiveYr = 60;
    const cur5YrInterest = curSchedule.slice(0, fiveYr).reduce((s, r) => s + r.interest, 0);
    const new5YrInterest = newSchedule.slice(0, fiveYr).reduce((s, r) => s + r.interest, 0);
    const cur5YrPMI = cPmiMonthly * Math.min(fiveYr, cRemaining);
    const new5YrPMI = nPmiMonthly * Math.min(fiveYr, nTermMonths);
    const fiveYearSavings = (cur5YrInterest + cur5YrPMI) - (new5YrInterest + new5YrPMI) - cc;
    const lazyBreakEven = monthlySavings > 0 ? Math.ceil(cc / monthlySavings) : null;
    const curLTV = hv > 0 ? (cb / hv) * 100 : 0;
    const newLTV = hv > 0 ? (newLoanAmt / hv) * 100 : 0;
    let npv = -cc;
    for (let m = 1; m <= Math.min(cRemaining, nTermMonths); m++) {
      const sav = (curSchedule[m - 1]?.interest || 0) + cPmiMonthly - (newSchedule[m - 1]?.interest || 0) - nPmiMonthly;
      npv += sav / Math.pow(1 + cr, m);
    }
    return {
      curPI, curTotalPayment, newPI, newTotalPayment, newLoanAmt,
      monthlySavings, curSchedule, newSchedule,
      curTotalInterest, newTotalInterest, interestSaved,
      fiveYearSavings, trueBreakEven, lazyBreakEven,
      curLTV, newLTV, npv, cRemaining, closingCosts: cc,
      cPmiMonthly, nPmiMonthly, nTermMonths, cashOut: co, escrow,
    };
  }, [curBalance, curRate, curTermOriginal, curMonthsPaid, curPMI, curHomeValue, curEscrow, newRate, newTerm, closingCosts, rollInCosts, newPMI, cashOutEnabled, cashOutAmount, pmiRemoval]);

  const getRecommendation = () => {
    const { trueBreakEven, fiveYearSavings, monthlySavings } = analysis;
    const be = trueBreakEven.breakEvenMonth;
    if (monthlySavings <= 0 && fiveYearSavings <= 0) return { verdict: "NOT RECOMMENDED", color: COLORS.red, reason: "The new loan costs more. This refinance does not make financial sense." };
    if (!be) return { verdict: "NOT RECOMMENDED", color: COLORS.red, reason: "The new loan never costs less than keeping the current loan within the analysis window." };
    if (be <= 18 && fiveYearSavings > 5000) return { verdict: "STRONG REFINANCE CANDIDATE", color: COLORS.green, reason: `True break-even in ${be} months. ${fmt(fiveYearSavings)} in real 5-year savings.` };
    if (be <= 36) return { verdict: "GOOD CANDIDATE", color: COLORS.blue, reason: `True break-even in ${be} months. Worth pursuing if staying 3+ years.` };
    if (be <= 60) return { verdict: "WORTH CONSIDERING", color: COLORS.gold, reason: `True break-even takes ${be} months. Makes sense if keeping loan 5+ years.` };
    return { verdict: "MARGINAL", color: COLORS.red, reason: `True break-even of ${be} months is lengthy.` };
  };

  const rec = getRecommendation();

  return (
    <div>
      {/* Verdict Banner */}
      <div style={{
        padding: "14px 16px", borderRadius: 10, color: "#fff", marginBottom: 16,
        background: rec.color === COLORS.green ? `linear-gradient(135deg, ${COLORS.green}, #22A06B)` :
          rec.color === COLORS.blue ? `linear-gradient(135deg, #2E86AB, ${COLORS.blue})` :
          rec.color === COLORS.gold ? `linear-gradient(135deg, ${COLORS.gold}, #E5A825)` :
          `linear-gradient(135deg, ${COLORS.red}, #E74C3C)`,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4, fontFamily: font }}>{rec.verdict}</div>
        <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.4, fontFamily: font }}>{rec.reason}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <SectionCard title="CURRENT LOAN" accent={COLORS.navy}>
          <LabeledInput label="Current Balance" prefix="$" value={curBalance} onChange={setCurBalance} useCommas />
          <LabeledInput label="Interest Rate" value={curRate} onChange={setCurRate} suffix="%" step="0.125" />
          <LabeledInput label="Original Term" value={curTermOriginal} onChange={setCurTermOriginal} suffix="years" />
          <LabeledInput label="Months Already Paid" value={curMonthsPaid} onChange={setCurMonthsPaid} hint={`${Math.floor((parseFloat(curMonthsPaid) || 0) / 12)}yr ${(parseFloat(curMonthsPaid) || 0) % 12}mo into loan`} />
          <LabeledInput label="Current PMI/MIP" prefix="$" value={curPMI} onChange={setCurPMI} suffix="/mo" useCommas />
          <LabeledInput label="Home Value" prefix="$" value={curHomeValue} onChange={setCurHomeValue} useCommas />
          <LabeledInput label="Escrow (Tax+Ins)" prefix="$" value={curEscrow} onChange={setCurEscrow} suffix="/mo" useCommas />
        </SectionCard>

        <SectionCard title="NEW LOAN" accent={COLORS.blue}>
          <LabeledInput label="New Interest Rate" value={newRate} onChange={setNewRate} suffix="%" step="0.125" />
          <LabeledInput label="New Term" value={newTerm} onChange={setNewTerm} suffix="years" />
          <LabeledInput label="Closing Costs" prefix="$" value={closingCosts} onChange={setClosingCosts} useCommas />
          <Toggle label="Roll closing costs into loan" checked={rollInCosts} onChange={setRollInCosts} />
          <LabeledInput label="New PMI/MIP" prefix="$" value={newPMI} onChange={setNewPMI} suffix="/mo" useCommas />
          <Toggle label="PMI Removal Scenario" checked={pmiRemoval} onChange={setPmiRemoval} />
          {pmiRemoval && (
            <div style={{ fontSize: 12, color: analysis.newLTV <= 80 ? COLORS.green : COLORS.gold, padding: "6px 10px", background: analysis.newLTV <= 80 ? COLORS.greenLight : COLORS.goldLight, borderRadius: 6, marginBottom: 12, fontFamily: font }}>
              New LTV: {analysis.newLTV.toFixed(1)}% — {analysis.newLTV <= 80 ? "Below 80%, PMI can be removed" : "Above 80%, PMI may still apply"}
            </div>
          )}
          <Toggle label="Include Cash-Out" checked={cashOutEnabled} onChange={setCashOutEnabled} />
          {cashOutEnabled && <LabeledInput label="Cash-Out Amount" prefix="$" value={cashOutAmount} onChange={setCashOutAmount} useCommas />}
        </SectionCard>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ id: "summary", label: "Summary" }, { id: "math", label: "Show the Math" }, { id: "amort", label: "Amortization" }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: font,
            background: activeTab === t.id ? COLORS.navy : COLORS.border,
            color: activeTab === t.id ? "#fff" : COLORS.gray,
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === "summary" && (
        <div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <MetricCard label="True Break-Even" value={analysis.trueBreakEven.breakEvenMonth ? `${analysis.trueBreakEven.breakEvenMonth} mo` : "N/A"}
              sublabel={analysis.trueBreakEven.breakEvenMonth ? `About ${(analysis.trueBreakEven.breakEvenMonth / 12).toFixed(1)} years` : "New loan costs more"}
              positive={analysis.trueBreakEven.breakEvenMonth && analysis.trueBreakEven.breakEvenMonth <= 36} large highlight />
            <MetricCard label="5-Year Real Savings" value={fmt(analysis.fiveYearSavings)} sublabel="Interest + PMI saved minus costs" positive={analysis.fiveYearSavings > 0} large />
            <MetricCard label="Monthly Savings" value={`${fmt(analysis.monthlySavings)}/mo`} sublabel="P&I + PMI difference" positive={analysis.monthlySavings > 0} />
          </div>

          {/* Why our break-even is different */}
          <div style={{ background: COLORS.blueLight, borderRadius: 12, padding: 18, border: `1.5px solid ${COLORS.blue}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 10, fontFamily: font }}>WHY OUR BREAK-EVEN IS DIFFERENT</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, fontFamily: font }}>TYPICAL (WRONG) METHOD</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.red, fontFamily: font }}>{analysis.lazyBreakEven ? `${analysis.lazyBreakEven} months` : "N/A"}</div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 4, fontFamily: font }}>Closing costs ÷ payment savings. Ignores amortization.</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, fontFamily: font }}>OUR METHOD (CORRECT)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.green, fontFamily: font }}>{analysis.trueBreakEven.breakEvenMonth ? `${analysis.trueBreakEven.breakEvenMonth} months` : "N/A"}</div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 4, fontFamily: font }}>Cumulative interest + PMI comparison. Month-by-month tracking.</div>
              </div>
            </div>
          </div>

          {/* Payment Comparison */}
          <SectionCard title="PAYMENT COMPARISON">
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.gray, fontWeight: 600, fontFamily: font }}>CURRENT</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt2(analysis.curPI)}</div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>P&I only</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.navy, marginTop: 4, fontFamily: font }}>{fmt2(analysis.curTotalPayment)}</div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Total w/ escrow</div>
              </div>
              <div><svg width="32" height="20"><path d="M0 10 L24 10 M18 4 L24 10 L18 16" fill="none" stroke={COLORS.blue} strokeWidth="2.5" strokeLinecap="round" /></svg></div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: COLORS.gray, fontWeight: 600, fontFamily: font }}>NEW</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.blue, fontFamily: font }}>{fmt2(analysis.newPI)}</div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>P&I only</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.blue, marginTop: 4, fontFamily: font }}>{fmt2(analysis.newTotalPayment)}</div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Total w/ escrow</div>
              </div>
            </div>
          </SectionCard>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <MetricCard label="Lifetime Interest Saved" value={fmt(analysis.interestSaved)} positive={analysis.interestSaved > 0} />
            <MetricCard label="Net Present Value" value={fmt(analysis.npv)} sublabel="Time-value adjusted" positive={analysis.npv > 0} />
            <MetricCard label="New Loan Amount" value={fmt(analysis.newLoanAmt)} />
          </div>
        </div>
      )}

      {activeTab === "math" && (
        <SectionCard title="HOW WE CALCULATE TRUE BREAK-EVEN" accent={COLORS.green}>
          <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font }}>
            <strong>Most loan officers get this wrong.</strong> They take closing costs and divide by monthly payment savings. That only looks at cash flow — not where your money actually goes.
          </div>
          <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, marginTop: 10, fontFamily: font }}>
            <strong>What we do:</strong> Every month, we track the actual interest you burn on each loan, add PMI costs, and compare. The new loan starts "in the hole" by {fmt(analysis.closingCosts)} in closing costs. The true break-even is when the new loan's cumulative cost drops below what you'd pay staying put.
          </div>
          <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, marginTop: 10, fontFamily: font }}>
            <strong>Why it matters:</strong> Early in a mortgage, most of your payment is interest. A lower rate saves more in those early months than the simple payment difference suggests.
          </div>
        </SectionCard>
      )}

      {activeTab === "amort" && (
        <SectionCard title="SIDE-BY-SIDE AMORTIZATION">
          <div style={{ overflowX: "auto", maxHeight: 500 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: font }}>
              <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                <tr style={{ borderBottom: `2px solid ${COLORS.navy}` }}>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, color: COLORS.gray }}>Year</th>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, color: COLORS.navy }}>Cur Balance</th>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, color: COLORS.navy }}>Cur Interest</th>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, color: COLORS.blue, borderLeft: `1px solid ${COLORS.border}` }}>New Balance</th>
                  <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10, fontWeight: 700, color: COLORS.blue }}>New Interest</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(Math.max(analysis.curSchedule.length, analysis.newSchedule.length) / 12) }, (_, yr) => {
                  const idx = (yr + 1) * 12 - 1;
                  const cur = analysis.curSchedule[idx];
                  const nw = analysis.newSchedule[idx];
                  return (
                    <tr key={yr} style={{ borderBottom: `1px solid ${COLORS.border}`, background: yr % 2 === 0 ? COLORS.bgAlt : COLORS.white }}>
                      <td style={{ padding: "6px", textAlign: "right", fontWeight: 600, color: COLORS.navy }}>{yr + 1}</td>
                      <td style={{ padding: "6px", textAlign: "right", color: COLORS.navy }}>{cur ? fmt(cur.balance) : "—"}</td>
                      <td style={{ padding: "6px", textAlign: "right", color: COLORS.navy }}>{cur ? fmt(cur.totalInterest) : "—"}</td>
                      <td style={{ padding: "6px", textAlign: "right", color: COLORS.blue, borderLeft: `1px solid ${COLORS.border}` }}>{nw ? fmt(nw.balance) : "—"}</td>
                      <td style={{ padding: "6px", textAlign: "right", color: COLORS.blue }}>{nw ? fmt(nw.totalInterest) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 3: FEE SHEET GENERATOR (Texas-Specific)
// ═══════════════════════════════════════════════════════════════════════
function FeeSheetGenerator() {
  const [transactionType, setTransactionType] = useState("purchase");
  const [purchasePrice, setPurchasePrice] = useState("425000");
  const [loanAmount, setLoanAmount] = useState("340000");
  const [loanType, setLoanType] = useState("conventional");
  const [rate, setRate] = useState("6.75");
  const [closingDate, setClosingDate] = useState("15");
  const [includeEscrow, setIncludeEscrow] = useState(true);
  const [monthlyTaxes, setMonthlyTaxes] = useState("625");
  const [monthlyInsurance, setMonthlyInsurance] = useState("200");
  const [originationPct, setOriginationPct] = useState("1.0");
  const [discountPoints, setDiscountPoints] = useState("0");
  const [includeSurvey, setIncludeSurvey] = useState(true);
  const [includeHomeWarranty, setIncludeHomeWarranty] = useState(false);

  const fees = useMemo(() => {
    const pp = parseFloat(purchasePrice) || 0;
    const la = parseFloat(loanAmount) || 0;
    const r = parseFloat(rate) || 0;
    const days = 30 - (parseFloat(closingDate) || 15) + 1;
    const mTax = parseFloat(monthlyTaxes) || 0;
    const mIns = parseFloat(monthlyInsurance) || 0;
    const origPct = parseFloat(originationPct) || 0;
    const discPts = parseFloat(discountPoints) || 0;

    const isPurchase = transactionType === "purchase";

    // Lender Fees
    const origination = Math.round(la * origPct / 100);
    const discount = Math.round(la * discPts / 100);
    const underwriting = 995;
    const processingFee = 595;
    const lenderFees = origination + discount + underwriting + processingFee;

    // Third Party Fees
    const appraisal = TEXAS_FEES.appraisal[loanType] || 550;
    const creditReport = TEXAS_FEES.creditReport;
    const floodCert = TEXAS_FEES.floodCert;
    const taxService = TEXAS_FEES.taxServiceFee;
    const survey = includeSurvey ? TEXAS_FEES.surveyFee.typical : 0;
    const thirdPartyFees = appraisal + creditReport + floodCert + taxService + survey;

    // Title / Closing Fees
    const ownerTitlePolicy = isPurchase ? TEXAS_FEES.titleInsurance.basicRate(pp) : 0;
    const lenderTitlePolicy = isPurchase
      ? TEXAS_FEES.titleInsurance.simultaneous(la, pp)
      : TEXAS_FEES.titleInsurance.basicRate(la);
    const escrowFee = Math.round(Math.max(500, (isPurchase ? pp : la) * 0.001));
    const titleSearch = 250;
    const recordingFees = isPurchase
      ? TEXAS_FEES.recordingFees.deed + TEXAS_FEES.recordingFees.mortgage
      : TEXAS_FEES.recordingFees.mortgage + TEXAS_FEES.recordingFees.release;
    const titleFees = ownerTitlePolicy + lenderTitlePolicy + escrowFee + titleSearch + recordingFees;

    // Prepaids
    const prepaidInterest = TEXAS_FEES.prepaidInterest(la, r, days);
    const homeownersInsurance = isPurchase ? Math.round(mIns * 12) : 0; // First year premium on purchase
    const prepaidFees = prepaidInterest + homeownersInsurance;

    // Escrow Reserves
    const escrowReserves = includeEscrow ? TEXAS_FEES.escrowSetup(mTax, mIns) : 0;

    // Optional
    const homeWarranty = includeHomeWarranty ? TEXAS_FEES.homeWarranty.typical : 0;

    const totalClosingCosts = lenderFees + thirdPartyFees + titleFees;
    const totalPrepaids = prepaidFees + escrowReserves;
    const grandTotal = totalClosingCosts + totalPrepaids + homeWarranty;

    return {
      isPurchase, lenderFees, origination, discount, underwriting, processingFee,
      thirdPartyFees, appraisal, creditReport, floodCert, taxService, survey,
      titleFees, ownerTitlePolicy, lenderTitlePolicy, escrowFee, titleSearch, recordingFees,
      prepaidFees, prepaidInterest, homeownersInsurance, days,
      escrowReserves, homeWarranty,
      totalClosingCosts, totalPrepaids, grandTotal,
    };
  }, [transactionType, purchasePrice, loanAmount, loanType, rate, closingDate, monthlyTaxes, monthlyInsurance, originationPct, discountPoints, includeSurvey, includeHomeWarranty, includeEscrow]);

  const FeeRow = ({ label, amount, bold, indent, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: `${bold ? 10 : 6}px 0`, borderBottom: bold ? `2px solid ${COLORS.navy}` : `1px solid ${COLORS.border}`, marginLeft: indent ? 20 : 0 }}>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 400, color: color || COLORS.navy, fontFamily: font }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: color || COLORS.navy, fontFamily: font }}>{fmt(amount)}</span>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        {/* Inputs */}
        <div>
          <SectionCard title="TRANSACTION DETAILS" accent={COLORS.navy}>
            <Select label="Transaction Type" value={transactionType} onChange={setTransactionType} options={[
              { value: "purchase", label: "Purchase" }, { value: "refinance", label: "Refinance" },
            ]} />
            {transactionType === "purchase" && <LabeledInput label="Purchase Price" prefix="$" value={purchasePrice} onChange={setPurchasePrice} useCommas />}
            <LabeledInput label="Loan Amount" prefix="$" value={loanAmount} onChange={setLoanAmount} useCommas />
            <Select label="Loan Type" value={loanType} onChange={setLoanType} options={[
              { value: "conventional", label: "Conventional" }, { value: "fha", label: "FHA" },
              { value: "va", label: "VA" }, { value: "jumbo", label: "Jumbo" },
            ]} />
            <LabeledInput label="Interest Rate" value={rate} onChange={setRate} suffix="%" step="0.125" />
            <LabeledInput label="Closing Day of Month" value={closingDate} onChange={setClosingDate} hint={`${30 - (parseFloat(closingDate) || 15) + 1} days prepaid interest`} />
          </SectionCard>

          <SectionCard title="FEES & OPTIONS" accent={COLORS.blue}>
            <LabeledInput label="Origination Fee" value={originationPct} onChange={setOriginationPct} suffix="%" hint={`${fmt(Math.round((parseFloat(loanAmount) || 0) * (parseFloat(originationPct) || 0) / 100))}`} small />
            <LabeledInput label="Discount Points" value={discountPoints} onChange={setDiscountPoints} suffix="pts" small />
            <LabeledInput label="Monthly Taxes" prefix="$" value={monthlyTaxes} onChange={setMonthlyTaxes} suffix="/mo" small />
            <LabeledInput label="Monthly Insurance" prefix="$" value={monthlyInsurance} onChange={setMonthlyInsurance} suffix="/mo" small />
            <Toggle label="Include Escrow Reserves" checked={includeEscrow} onChange={setIncludeEscrow} />
            <Toggle label="Include Survey" checked={includeSurvey} onChange={setIncludeSurvey} />
            <Toggle label="Include Home Warranty" checked={includeHomeWarranty} onChange={setIncludeHomeWarranty} />
          </SectionCard>
        </div>

        {/* Fee Sheet Output */}
        <div>
          <div style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius: 12, padding: 20, color: "#fff", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.7 }}>ESTIMATED TOTAL CASH TO CLOSE</div>
            <div style={{ fontSize: 44, fontWeight: 800, fontFamily: font }}>{fmt(fees.grandTotal + (fees.isPurchase ? (parseFloat(purchasePrice) || 0) - (parseFloat(loanAmount) || 0) : 0))}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Texas · {fees.isPurchase ? "Purchase" : "Refinance"} · {loanType.charAt(0).toUpperCase() + loanType.slice(1)}</div>
          </div>

          <SectionCard title="CLOSING COST ESTIMATE — TEXAS">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.blue, letterSpacing: "0.06em", marginBottom: 6, fontFamily: font }}>LENDER FEES</div>
              <FeeRow label="Origination Fee" amount={fees.origination} indent />
              {fees.discount > 0 && <FeeRow label="Discount Points" amount={fees.discount} indent />}
              <FeeRow label="Underwriting Fee" amount={fees.underwriting} indent />
              <FeeRow label="Processing Fee" amount={fees.processingFee} indent />
              <FeeRow label="Subtotal — Lender Fees" amount={fees.lenderFees} bold />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.blue, letterSpacing: "0.06em", marginBottom: 6, fontFamily: font }}>THIRD PARTY FEES</div>
              <FeeRow label="Appraisal" amount={fees.appraisal} indent />
              <FeeRow label="Credit Report" amount={fees.creditReport} indent />
              <FeeRow label="Flood Certification" amount={fees.floodCert} indent />
              <FeeRow label="Tax Service Fee" amount={fees.taxService} indent />
              {fees.survey > 0 && <FeeRow label="Survey" amount={fees.survey} indent />}
              <FeeRow label="Subtotal — Third Party" amount={fees.thirdPartyFees} bold />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.blue, letterSpacing: "0.06em", marginBottom: 6, fontFamily: font }}>TITLE & CLOSING FEES</div>
              {fees.isPurchase && <FeeRow label="Owner's Title Policy" amount={fees.ownerTitlePolicy} indent />}
              <FeeRow label={fees.isPurchase ? "Lender's Title (Simultaneous)" : "Lender's Title Policy"} amount={fees.lenderTitlePolicy} indent />
              <FeeRow label="Escrow/Settlement Fee" amount={fees.escrowFee} indent />
              <FeeRow label="Title Search" amount={fees.titleSearch} indent />
              <FeeRow label="Recording Fees" amount={fees.recordingFees} indent />
              <FeeRow label="Subtotal — Title" amount={fees.titleFees} bold />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.green, letterSpacing: "0.06em", marginBottom: 6, fontFamily: font }}>PREPAIDS & ESCROW</div>
              <FeeRow label={`Prepaid Interest (${fees.days} days)`} amount={fees.prepaidInterest} indent />
              {fees.homeownersInsurance > 0 && <FeeRow label="Homeowners Insurance (12 mo)" amount={fees.homeownersInsurance} indent />}
              {fees.escrowReserves > 0 && <FeeRow label="Escrow Reserves (2 mo tax + ins)" amount={fees.escrowReserves} indent />}
              <FeeRow label="Subtotal — Prepaids" amount={fees.totalPrepaids} bold />
            </div>

            {fees.homeWarranty > 0 && (
              <div style={{ marginBottom: 14 }}>
                <FeeRow label="Home Warranty" amount={fees.homeWarranty} />
              </div>
            )}

            <div style={{ marginTop: 16, padding: "14px 16px", background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: font }}>TOTAL CLOSING COSTS + PREPAIDS</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: font }}>{fmt(fees.grandTotal)}</span>
            </div>

            <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 10, lineHeight: 1.5, fontFamily: font }}>
              * Texas title insurance rates are regulated by the Texas Department of Insurance. No transfer tax in Texas. Fees are estimates and may vary by title company and lender.
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 4: MORTGAGE COMPARISON
// ═══════════════════════════════════════════════════════════════════════
function MortgageComparison() {
  const [homePrice, setHomePrice] = useState("425000");
  const [scenarios, setScenarios] = useState([
    { id: 1, label: "Scenario A", downPct: "20", rate: "6.75", term: "30", points: "0", color: COLORS.navy },
    { id: 2, label: "Scenario B", downPct: "10", rate: "6.50", term: "30", points: "0.5", color: COLORS.blue },
    { id: 3, label: "Scenario C", downPct: "5", rate: "7.00", term: "30", points: "0", color: COLORS.green },
  ]);

  const updateScenario = (id, field, value) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const analyses = useMemo(() => {
    const hp = parseFloat(homePrice) || 0;
    return scenarios.map(s => {
      const dp = (parseFloat(s.downPct) || 0) / 100;
      const la = Math.round(hp * (1 - dp));
      const downPayment = Math.round(hp * dp);
      const r = (parseFloat(s.rate) || 0) / 100 / 12;
      const n = (parseFloat(s.term) || 30) * 12;
      const pts = Math.round(la * (parseFloat(s.points) || 0) / 100);
      const monthlyPI = pmt(r, n, la);
      const pmiMonthly = dp < 0.20 ? Math.round(la * 0.005 / 12) : 0;
      const totalInterest = (monthlyPI * n) - la;
      const ltv = hp > 0 ? (la / hp * 100) : 0;
      const totalCost = totalInterest + pts + downPayment;
      return { ...s, la, downPayment, monthlyPI, pmiMonthly, totalInterest, ltv, pts, totalCost, n };
    });
  }, [homePrice, scenarios]);

  return (
    <div>
      <SectionCard title="HOME PRICE">
        <LabeledInput label="Purchase Price" prefix="$" value={homePrice} onChange={setHomePrice} useCommas />
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
        {scenarios.map((s) => (
          <SectionCard key={s.id} title={s.label} accent={s.color}>
            <LabeledInput label="Down Payment" value={s.downPct} onChange={(v) => updateScenario(s.id, "downPct", v)} suffix="%" small />
            <LabeledInput label="Interest Rate" value={s.rate} onChange={(v) => updateScenario(s.id, "rate", v)} suffix="%" step="0.125" small />
            <Select label="Term" value={s.term} onChange={(v) => updateScenario(s.id, "term", v)} options={[
              { value: "30", label: "30yr" }, { value: "20", label: "20yr" }, { value: "15", label: "15yr" },
            ]} small />
            <LabeledInput label="Points" value={s.points} onChange={(v) => updateScenario(s.id, "points", v)} suffix="pts" small />
          </SectionCard>
        ))}
      </div>

      {/* Comparison Table */}
      <SectionCard title="SIDE-BY-SIDE COMPARISON">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.navy}` }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: COLORS.gray }}></th>
                {analyses.map(a => (
                  <th key={a.id} style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Down Payment", fn: (a) => `${fmt(a.downPayment)} (${a.downPct}%)` },
                { label: "Loan Amount", fn: (a) => fmt(a.la) },
                { label: "Rate", fn: (a) => `${a.rate}%` },
                { label: "Monthly P&I", fn: (a) => fmt2(a.monthlyPI), highlight: true },
                { label: "Monthly PMI", fn: (a) => a.pmiMonthly > 0 ? fmt2(a.pmiMonthly) : "None" },
                { label: "Total Monthly", fn: (a) => fmt2(a.monthlyPI + a.pmiMonthly), highlight: true },
                { label: "Points Cost", fn: (a) => a.pts > 0 ? fmt(a.pts) : "—" },
                { label: "LTV", fn: (a) => `${a.ltv.toFixed(1)}%` },
                { label: "Total Interest", fn: (a) => fmt(a.totalInterest) },
                { label: "Cash Needed", fn: (a) => fmt(a.downPayment + a.pts), highlight: true },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, background: row.highlight ? COLORS.bg : i % 2 === 0 ? COLORS.bgAlt : COLORS.white }}>
                  <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: row.highlight ? 700 : 500, color: COLORS.navy }}>{row.label}</td>
                  {analyses.map(a => (
                    <td key={a.id} style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, fontWeight: row.highlight ? 700 : 500, color: row.highlight ? a.color : COLORS.navy }}>{row.fn(a)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Monthly savings difference */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {analyses.map(a => (
          <MetricCard key={a.id} label={a.label} value={fmt2(a.monthlyPI + a.pmiMonthly)}
            sublabel={`${fmt(a.downPayment)} down · ${a.rate}% · ${a.term}yr`} large />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 5: BREAK-EVEN CALCULATOR (Standalone)
// ═══════════════════════════════════════════════════════════════════════
function BreakEvenCalculator() {
  const [currentPayment, setCurrentPayment] = useState("2450");
  const [newPayment, setNewPayment] = useState("2150");
  const [closingCosts, setClosingCosts] = useState("6500");
  const [currentRate, setCurrentRate] = useState("7.25");
  const [newRate, setNewRate] = useState("6.25");
  const [loanBalance, setLoanBalance] = useState("320000");

  const calc = useMemo(() => {
    const curPmt = parseFloat(currentPayment) || 0;
    const newPmt = parseFloat(newPayment) || 0;
    const cc = parseFloat(closingCosts) || 0;
    const monthlySavings = curPmt - newPmt;
    const simpleBreakEven = monthlySavings > 0 ? Math.ceil(cc / monthlySavings) : null;

    // True break-even using amortization
    const lb = parseFloat(loanBalance) || 0;
    const cr = (parseFloat(currentRate) || 0) / 100 / 12;
    const nr = (parseFloat(newRate) || 0) / 100 / 12;
    const curSchedule = buildAmortization(lb, cr, 360, pmt(cr, 360, lb));
    const newLb = lb + cc; // assume rolled in
    const newSchedule = buildAmortization(newLb, nr, 360, pmt(nr, 360, newLb));
    const trueBreakEven = calcTrueBreakEven(curSchedule, newSchedule, 0, 0, cc, 360);

    const savingsAt1yr = monthlySavings * 12;
    const savingsAt3yr = monthlySavings * 36;
    const savingsAt5yr = monthlySavings * 60 - cc;

    return { monthlySavings, simpleBreakEven, trueBreakEven, savingsAt1yr, savingsAt3yr, savingsAt5yr, cc };
  }, [currentPayment, newPayment, closingCosts, currentRate, newRate, loanBalance]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        <SectionCard title="INPUTS" accent={COLORS.navy}>
          <LabeledInput label="Current Monthly P&I" prefix="$" value={currentPayment} onChange={setCurrentPayment} useCommas />
          <LabeledInput label="New Monthly P&I" prefix="$" value={newPayment} onChange={setNewPayment} useCommas />
          <LabeledInput label="Total Closing Costs" prefix="$" value={closingCosts} onChange={setClosingCosts} useCommas />
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14, marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.gray, marginBottom: 8, fontFamily: font }}>FOR TRUE BREAK-EVEN (OPTIONAL)</div>
            <LabeledInput label="Loan Balance" prefix="$" value={loanBalance} onChange={setLoanBalance} useCommas small />
            <LabeledInput label="Current Rate" value={currentRate} onChange={setCurrentRate} suffix="%" small />
            <LabeledInput label="New Rate" value={newRate} onChange={setNewRate} suffix="%" small />
          </div>
        </SectionCard>

        <div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <MetricCard label="Monthly Savings" value={`${fmt(calc.monthlySavings)}/mo`} positive={calc.monthlySavings > 0} large highlight />
            <MetricCard label="Simple Break-Even" value={calc.simpleBreakEven ? `${calc.simpleBreakEven} mo` : "N/A"} sublabel="Closing costs ÷ savings" large />
            <MetricCard label="True Break-Even" value={calc.trueBreakEven.breakEvenMonth ? `${calc.trueBreakEven.breakEvenMonth} mo` : "N/A"} sublabel="Interest-based comparison" positive={calc.trueBreakEven.breakEvenMonth && calc.trueBreakEven.breakEvenMonth <= 36} large />
          </div>

          <SectionCard title="SAVINGS TIMELINE">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "1 Year", value: calc.savingsAt1yr, net: calc.savingsAt1yr - calc.cc },
                { label: "3 Years", value: calc.savingsAt3yr, net: calc.savingsAt3yr - calc.cc },
                { label: "5 Years", value: calc.savingsAt5yr + calc.cc, net: calc.savingsAt5yr },
              ].map((t) => (
                <div key={t.label} style={{ padding: 14, background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, fontFamily: font }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Gross: {fmt(t.value)}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.net >= 0 ? COLORS.green : COLORS.red, fontFamily: font }}>{fmt(t.net)}</div>
                  <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Net (after costs)</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 6: PRE-QUALIFICATION LETTER GENERATOR
// ═══════════════════════════════════════════════════════════════════════
function PreQualLetter() {
  const [borrowerName, setBorrowerName] = useState("");
  const [coBorrowerName, setCoBorrowerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanType, setLoanType] = useState("conventional");
  const [term, setTerm] = useState("30");
  const [downPaymentPct, setDownPaymentPct] = useState("20");
  const [expirationDays, setExpirationDays] = useState("90");
  const [conditions, setConditions] = useState("Subject to satisfactory appraisal, title search, and verification of all information provided.");
  const [loName, setLoName] = useState("Mark Nagelberg");
  const [loNmls, setLoNmls] = useState("729612");
  const [loPhone, setLoPhone] = useState("");
  const [loEmail, setLoEmail] = useState("mymortgagemark@gmail.com");
  const [showPreview, setShowPreview] = useState(false);

  const today = new Date();
  const expDate = new Date(today.getTime() + (parseInt(expirationDays) || 90) * 86400000);

  const letterContent = () => (
    <div style={{ fontFamily: "Georgia, serif", maxWidth: 700, margin: "0 auto", padding: 40, background: "#fff", border: "1px solid #ddd", borderRadius: 4 }}>
      {/* Letterhead */}
      <div style={{ borderBottom: "3px solid #0C4160", paddingBottom: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#0C4160", fontFamily: "'DM Sans', sans-serif" }}>CMG Home Loans</div>
          <div style={{ fontSize: 12, color: "#6B7D8A", fontFamily: "'DM Sans', sans-serif" }}>A Division of CMG Financial · NMLS #1820</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "#6B7D8A", lineHeight: 1.6 }}>
          {loName} · NMLS #{loNmls}<br />
          {loEmail}{loPhone ? ` · ${loPhone}` : ""}
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#333", lineHeight: 1.8 }}>
        <div style={{ marginBottom: 16 }}>{today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>

        <div style={{ fontSize: 16, fontWeight: 700, color: "#0C4160", marginBottom: 16, textAlign: "center" }}>PRE-QUALIFICATION LETTER</div>

        <p>To Whom It May Concern,</p>

        <p>Based on our preliminary review of the financial information provided, this letter confirms that <strong>{borrowerName || "[Borrower Name]"}</strong>{coBorrowerName ? ` and <strong>${coBorrowerName}</strong>` : ""} {borrowerName ? "has" : "have"} been pre-qualified for a mortgage loan with the following terms:</p>

        <div style={{ margin: "16px 0", padding: "14px 20px", background: "#F7FAFB", border: "1px solid #E0E8E8", borderRadius: 6 }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {propertyAddress && <tr><td style={{ padding: "4px 0", fontWeight: 600, width: 160 }}>Property:</td><td>{propertyAddress}</td></tr>}
              <tr><td style={{ padding: "4px 0", fontWeight: 600 }}>Purchase Price:</td><td>Up to {fmt(parseFloat(purchasePrice) || 0)}</td></tr>
              <tr><td style={{ padding: "4px 0", fontWeight: 600 }}>Loan Amount:</td><td>Up to {fmt(parseFloat(loanAmount) || 0)}</td></tr>
              <tr><td style={{ padding: "4px 0", fontWeight: 600 }}>Loan Type:</td><td>{loanType === "conventional" ? "Conventional" : loanType === "fha" ? "FHA" : loanType === "va" ? "VA" : "Jumbo"} · {term}-Year Fixed</td></tr>
              <tr><td style={{ padding: "4px 0", fontWeight: 600 }}>Down Payment:</td><td>{downPaymentPct}% ({fmt(Math.round((parseFloat(purchasePrice) || 0) * (parseFloat(downPaymentPct) || 0) / 100))})</td></tr>
            </tbody>
          </table>
        </div>

        <p>This pre-qualification is based on a preliminary review of credit, income, and asset information provided by the borrower{coBorrowerName ? "s" : ""}. {conditions}</p>

        <p>This letter is not a commitment to lend and does not guarantee loan approval. Final approval is subject to a complete application, underwriting review, and all applicable guidelines.</p>

        <p>This pre-qualification letter is valid until <strong>{expDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>.</p>

        <p>Please do not hesitate to contact me with any questions.</p>

        <div style={{ marginTop: 30 }}>
          <div style={{ fontWeight: 700 }}>{loName}</div>
          <div style={{ fontSize: 12, color: "#6B7D8A" }}>Loan Officer · NMLS #{loNmls}</div>
          <div style={{ fontSize: 12, color: "#6B7D8A" }}>CMG Home Loans · A Division of CMG Financial</div>
          {loPhone && <div style={{ fontSize: 12, color: "#6B7D8A" }}>{loPhone}</div>}
          <div style={{ fontSize: 12, color: "#6B7D8A" }}>{loEmail}</div>
        </div>

        <div style={{ marginTop: 30, paddingTop: 14, borderTop: "1px solid #ddd", fontSize: 10, color: "#999", lineHeight: 1.5 }}>
          This pre-qualification is not a commitment to lend. All loans are subject to credit approval. Programs, rates, terms, and conditions are subject to change without notice. CMG Financial, NMLS #1820. Equal Housing Lender.
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {!showPreview ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <SectionCard title="BORROWER INFO" accent={COLORS.navy}>
            <LabeledInput label="Borrower Name" value={borrowerName} onChange={setBorrowerName} type="text" />
            <LabeledInput label="Co-Borrower Name (optional)" value={coBorrowerName} onChange={setCoBorrowerName} type="text" />
            <LabeledInput label="Property Address (optional)" value={propertyAddress} onChange={setPropertyAddress} type="text" />
          </SectionCard>

          <SectionCard title="LOAN DETAILS" accent={COLORS.blue}>
            <LabeledInput label="Purchase Price (up to)" prefix="$" value={purchasePrice} onChange={setPurchasePrice} useCommas />
            <LabeledInput label="Loan Amount (up to)" prefix="$" value={loanAmount} onChange={setLoanAmount} useCommas />
            <Select label="Loan Type" value={loanType} onChange={setLoanType} options={[
              { value: "conventional", label: "Conventional" }, { value: "fha", label: "FHA" },
              { value: "va", label: "VA" }, { value: "jumbo", label: "Jumbo" },
            ]} />
            <LabeledInput label="Down Payment" value={downPaymentPct} onChange={setDownPaymentPct} suffix="%" />
            <Select label="Term" value={term} onChange={setTerm} options={[
              { value: "30", label: "30-Year Fixed" }, { value: "15", label: "15-Year Fixed" },
            ]} />
            <LabeledInput label="Valid for" value={expirationDays} onChange={setExpirationDays} suffix="days" />
          </SectionCard>

          <SectionCard title="LOAN OFFICER INFO" accent={COLORS.green}>
            <LabeledInput label="LO Name" value={loName} onChange={setLoName} type="text" small />
            <LabeledInput label="NMLS #" value={loNmls} onChange={setLoNmls} type="text" small />
            <LabeledInput label="Email" value={loEmail} onChange={setLoEmail} type="text" small />
            <LabeledInput label="Phone" value={loPhone} onChange={setLoPhone} type="text" small />
          </SectionCard>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionCard title="CONDITIONS">
              <textarea value={conditions} onChange={(e) => setConditions(e.target.value)} style={{
                width: "100%", height: 100, padding: 12, border: `1.5px solid ${COLORS.border}`, borderRadius: 8,
                fontFamily: font, fontSize: 13, color: COLORS.navy, resize: "vertical", background: COLORS.bg,
              }} />
            </SectionCard>
            <Button label="Generate Pre-Qualification Letter" onClick={() => setShowPreview(true)} primary fullWidth />
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Button label="← Back to Edit" onClick={() => setShowPreview(false)} />
            <Button label="Print Letter" onClick={() => window.print()} primary color={COLORS.green} />
          </div>
          {letterContent()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MODULE 7: FORWARD COMMITMENT / RATE LOCK TOOL
// ═══════════════════════════════════════════════════════════════════════
function ForwardCommitment() {
  const [locks, setLocks] = useState([
    { id: 1, borrower: "Sample Borrower", loanAmount: "350000", rate: "6.75", lockDate: "2025-01-15", lockDays: "60", expiration: "2025-03-16", status: "active", loanType: "Conv 30yr", notes: "" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLock, setNewLock] = useState({ borrower: "", loanAmount: "", rate: "", lockDays: "60", loanType: "Conv 30yr", notes: "" });

  const addLock = () => {
    const today = new Date();
    const exp = new Date(today.getTime() + parseInt(newLock.lockDays) * 86400000);
    setLocks(prev => [...prev, {
      id: Date.now(), ...newLock,
      lockDate: today.toISOString().split("T")[0],
      expiration: exp.toISOString().split("T")[0],
      status: "active",
    }]);
    setNewLock({ borrower: "", loanAmount: "", rate: "", lockDays: "60", loanType: "Conv 30yr", notes: "" });
    setShowAdd(false);
  };

  const getStatusColor = (lock) => {
    const exp = new Date(lock.expiration);
    const today = new Date();
    const daysLeft = Math.ceil((exp - today) / 86400000);
    if (lock.status === "closed") return { bg: COLORS.greenLight, text: COLORS.green, label: "CLOSED" };
    if (lock.status === "expired" || daysLeft < 0) return { bg: COLORS.redLight, text: COLORS.red, label: "EXPIRED" };
    if (daysLeft <= 7) return { bg: COLORS.goldLight, text: COLORS.gold, label: `${daysLeft}d LEFT` };
    return { bg: COLORS.blueLight, text: COLORS.blue, label: `${daysLeft}d LEFT` };
  };

  const totalPipeline = locks.filter(l => l.status === "active").reduce((s, l) => s + (parseFloat(l.loanAmount) || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <MetricCard label="Active Locks" value={locks.filter(l => l.status === "active").length} large highlight />
        <MetricCard label="Pipeline Volume" value={fmt(totalPipeline)} />
        <MetricCard label="Avg Rate" value={locks.length > 0 ? (locks.reduce((s, l) => s + (parseFloat(l.rate) || 0), 0) / locks.length).toFixed(3) + "%" : "—"} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>RATE LOCKS</div>
        <Button label="+ Add Lock" onClick={() => setShowAdd(!showAdd)} primary small />
      </div>

      {showAdd && (
        <SectionCard title="NEW RATE LOCK" accent={COLORS.green}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <LabeledInput label="Borrower" value={newLock.borrower} onChange={(v) => setNewLock(p => ({ ...p, borrower: v }))} type="text" small />
            <LabeledInput label="Loan Amount" prefix="$" value={newLock.loanAmount} onChange={(v) => setNewLock(p => ({ ...p, loanAmount: v }))} useCommas small />
            <LabeledInput label="Rate" value={newLock.rate} onChange={(v) => setNewLock(p => ({ ...p, rate: v }))} suffix="%" small />
            <Select label="Lock Period" value={newLock.lockDays} onChange={(v) => setNewLock(p => ({ ...p, lockDays: v }))} options={[
              { value: "30", label: "30 Days" }, { value: "45", label: "45 Days" },
              { value: "60", label: "60 Days" }, { value: "90", label: "90 Days" },
              { value: "120", label: "120 Days" }, { value: "180", label: "180 Days (Extended)" },
            ]} small />
            <LabeledInput label="Loan Type" value={newLock.loanType} onChange={(v) => setNewLock(p => ({ ...p, loanType: v }))} type="text" small />
            <LabeledInput label="Notes" value={newLock.notes} onChange={(v) => setNewLock(p => ({ ...p, notes: v }))} type="text" small />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button label="Save Lock" onClick={addLock} primary small color={COLORS.green} />
            <Button label="Cancel" onClick={() => setShowAdd(false)} small />
          </div>
        </SectionCard>
      )}

      {/* Lock Cards */}
      {locks.map((lock) => {
        const status = getStatusColor(lock);
        return (
          <div key={lock.id} style={{ background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 12, display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{lock.borrower}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: status.bg, color: status.text, fontFamily: font }}>{status.label}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font }}>
                {fmt(parseFloat(lock.loanAmount) || 0)} · {lock.rate}% · {lock.loanType} · Locked {lock.lockDate} · Expires {lock.expiration}
              </div>
              {lock.notes && <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 4, fontFamily: font }}>{lock.notes}</div>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setLocks(prev => prev.map(l => l.id === lock.id ? { ...l, status: "closed" } : l))} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.green}`, background: "transparent", color: COLORS.green, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Close</button>
              <button onClick={() => setLocks(prev => prev.filter(l => l.id !== lock.id))} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Remove</button>
            </div>
          </div>
        );
      })}

      {locks.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: COLORS.grayLight, fontFamily: font }}>No rate locks yet. Click "+ Add Lock" to start tracking.</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP — Navigation & Layout
// ═══════════════════════════════════════════════════════════════════════
const MODULES = [
  { id: "payment", label: "Payment Calculator", icon: "💰", component: PaymentCalculator },
  { id: "refi", label: "Refi Analyzer", icon: "🔄", component: RefinanceAnalyzer },
  { id: "fees", label: "Fee Sheet", icon: "📋", component: FeeSheetGenerator },
  { id: "compare", label: "Compare Loans", icon: "⚖️", component: MortgageComparison },
  { id: "breakeven", label: "Break-Even", icon: "📊", component: BreakEvenCalculator },
  { id: "prequal", label: "Pre-Qual Letter", icon: "✉️", component: PreQualLetter },
  { id: "locks", label: "Rate Locks", icon: "🔒", component: ForwardCommitment },
];

export default function MortgageToolkit() {
  const [activeModule, setActiveModule] = useState("payment");
  const [userRole, setUserRole] = useState("admin"); // admin, lo, realtor, client

  const ActiveComponent = MODULES.find(m => m.id === activeModule)?.component || PaymentCalculator;

  return (
    <div style={{ fontFamily: font, background: "linear-gradient(180deg, #F5F8FA 0%, #EDF2F5 100%)", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 50%, #1A5A80 100%)`, padding: "20px 24px 16px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(72,160,206,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: COLORS.blue }}>M</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Home Loan Toolkit</div>
              <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: "0.06em" }}>MORTGAGE MARK · CMG HOME LOANS · NMLS #729612</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select value={userRole} onChange={(e) => setUserRole(e.target.value)} style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer",
            }}>
              <option value="admin" style={{ color: "#333" }}>Admin View</option>
              <option value="lo" style={{ color: "#333" }}>Loan Officer</option>
              <option value="realtor" style={{ color: "#333" }}>Realtor Partner</option>
              <option value="client" style={{ color: "#333" }}>Client View</option>
            </select>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 4, marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
          {MODULES.filter(m => {
            if (userRole === "client") return ["payment", "compare", "breakeven"].includes(m.id);
            if (userRole === "realtor") return ["payment", "fees", "compare", "prequal", "breakeven"].includes(m.id);
            return true;
          }).map((m) => (
            <button key={m.id} onClick={() => setActiveModule(m.id)} style={{
              padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: font, whiteSpace: "nowrap",
              background: activeModule === m.id ? "rgba(255,255,255,0.2)" : "transparent",
              color: activeModule === m.id ? "#fff" : "rgba(255,255,255,0.6)",
              transition: "all 0.2s",
            }}>
              <span style={{ marginRight: 6 }}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
        {/* Role indicator */}
        {userRole !== "admin" && (
          <div style={{ padding: "8px 14px", background: COLORS.goldLight, borderRadius: 8, marginBottom: 16, fontSize: 12, color: COLORS.gold, fontWeight: 600, fontFamily: font, border: `1px solid #FFE082` }}>
            {userRole === "client" ? "Client View — You can view payment calculations, compare loans, and analyze break-even scenarios." :
             userRole === "realtor" ? "Realtor Partner View — Access payment tools, fee sheets, loan comparisons, and pre-qualification letters." :
             "Loan Officer View — Full access to all tools including rate locks and internal analytics."}
          </div>
        )}
        <ActiveComponent />
      </div>

      {/* Footer */}
      <div style={{ padding: "20px 24px", textAlign: "center", fontSize: 10, color: COLORS.grayLight, lineHeight: 1.5, fontFamily: font }}>
        Mortgage Mark · CMG Home Loans · A Division of CMG Financial · NMLS #729612 · mortgagemark.com<br />
        This tool provides estimates for educational purposes. Actual rates, terms, and savings may vary.<br />
        Equal Housing Lender. NMLS #1820.
      </div>
    </div>
  );
}
