// modules/calculators/PaymentCalculator.js

const { useState, useEffect, useMemo } = React;

const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const SectionCard = window.SectionCard;
const Select = window.Select;
const LabeledInput = window.LabeledInput;
const Toggle = window.Toggle;
const DonutChart = window.DonutChart;
const MetricCard = window.MetricCard;
const pmt = window.pmt;
const calcAPR = window.calcAPR;
const getStateFees = window.getStateFees;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const lookupPMI = window.lookupPMI;
const lookupPMICompany = window.lookupPMICompany;
const COLORS = window.COLORS;
const font = window.font;
const STATE_LIST = window.STATE_LIST;
const CONFORMING_LIMITS = window.CONFORMING_LIMITS;
const FHA_LIMITS = window.FHA_LIMITS;
const BalanceCurveChart = window.BalanceCurveChart;
const PIStackedBarChart = window.PIStackedBarChart;
const STATE_APPR_RATES = window.STATE_APPR_RATES;

const PRESET_TERMS_PC = ["30", "25", "20", "15", "10"];

// Average homeowners insurance rates by state (% of home value, 2024 estimates)
const STATE_INS_RATES = {
  AL:0.80, AK:0.65, AZ:0.55, AR:0.95, CA:0.60, CO:0.75, CT:0.65, DE:0.42,
  FL:1.60, GA:0.80, HI:0.30, ID:0.42, IL:0.75, IN:0.75, IA:0.85, KS:1.40,
  KY:0.80, LA:1.80, ME:0.55, MD:0.58, MA:0.65, MI:0.70, MN:0.90, MS:1.10,
  MO:0.90, MT:0.65, NE:1.20, NV:0.55, NH:0.55, NJ:0.70, NM:0.70, NY:0.65,
  NC:0.75, ND:0.90, OH:0.65, OK:1.60, OR:0.42, PA:0.58, RI:0.70, SC:0.80,
  SD:0.85, TN:0.80, TX:1.10, UT:0.50, VT:0.55, VA:0.60, WA:0.55, WV:0.68,
  WI:0.60, WY:0.60, DC:0.50,
};

// Property type multipliers — relative to SFR baseline
// Condo: HOA covers structure/exterior; owner only insures interior walls-in (HO-6)
// Multi-unit: higher liability and replacement exposure
const INS_PROP_MULTIPLIERS = {
  sfr: 1.00, townhome: 0.80, condo: 0.40,
  duplex: 1.10, "3plex": 1.15, "4plex": 1.20, other: 1.00,
};

// Occupancy multipliers — investment properties have higher replacement/liability risk
const INS_OCC_MULTIPLIERS = {
  primary: 1.00, vacation: 1.10, investment: 1.20,
};

// Average effective property tax rates by state (% of home value, 2024 estimates)
const STATE_TAX_RATES = {
  AL:0.41, AK:1.04, AZ:0.62, AR:0.62, CA:0.73, CO:0.55, CT:2.14, DE:0.57,
  FL:0.89, GA:0.92, HI:0.28, ID:0.69, IL:2.23, IN:0.85, IA:1.57, KS:1.41,
  KY:0.86, LA:0.55, ME:1.36, MD:1.09, MA:1.23, MI:1.54, MN:1.12, MS:0.65,
  MO:0.97, MT:0.84, NE:1.73, NV:0.60, NH:2.18, NJ:2.49, NM:0.79, NY:1.73,
  NC:0.82, ND:0.98, OH:1.59, OK:0.90, OR:0.97, PA:1.58, RI:1.63, SC:0.57,
  SD:1.08, TN:0.71, TX:1.74, UT:0.62, VT:1.90, VA:0.82, WA:1.03, WV:0.59,
  WI:1.73, WY:0.61, DC:0.56,
};

function EquityProjectionChart({ timeline, milestones }) {
  const c = useThemeColors();
  const [hov, setHov] = React.useState(null);
  if (!timeline || timeline.length < 2) return null;
  const W = 480, H = 180;
  const pad = { t: 16, r: 20, b: 28, l: 72 };
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
  const maxVal = Math.max(...timeline.map(d => d.homeValue));
  const yFn = v => pad.t + h - (v / maxVal) * h;
  const xFn = i => pad.l + (i / (timeline.length - 1)) * w;
  const valuePath = timeline.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.homeValue).toFixed(1)}`).join(" ");
  const balancePath = timeline.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.balance).toFixed(1)}`).join(" ");
  const areaPath = `M${xFn(0).toFixed(1)},${yFn(timeline[0].balance).toFixed(1)} ${timeline.map((d, i) => `L${xFn(i).toFixed(1)},${yFn(d.homeValue).toFixed(1)}`).join(" ")} ${[...timeline].reverse().map((d, i, arr) => `L${xFn(arr.length - 1 - i).toFixed(1)},${yFn(d.balance).toFixed(1)}`).join(" ")} Z`;
  const fmtK = v => Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}K`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => p * maxVal);
  const xTickYrs = [5, 10, 15, 20, 25, 30].filter(y => y <= timeline.length);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    let closest = 0, minDist = Infinity;
    timeline.forEach((d, i) => {
      const dist = Math.abs(xFn(i) - mx);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setHov(closest);
  };

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", margin: "0 auto 12px", cursor: "crosshair" }}
        onMouseMove={handleMouseMove} onMouseLeave={() => setHov(null)}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} y1={yFn(v)} x2={W - pad.r} y2={yFn(v)} stroke="#E0E8E8" strokeWidth={1} strokeDasharray="3 3" />
            <text x={pad.l - 5} y={yFn(v) + 4} textAnchor="end" fontSize={9} fill="#6B7D8A">{fmtK(v)}</text>
          </g>
        ))}
        {xTickYrs.map(yr => (
          <text key={yr} x={xFn(yr - 1)} y={H - 6} textAnchor="middle" fontSize={9} fill="#6B7D8A">{yr}yr</text>
        ))}
        <path d={areaPath} fill={c.green} fillOpacity={0.15} />
        <path d={valuePath} fill="none" stroke={c.green} strokeWidth={2} strokeLinejoin="round" />
        <path d={balancePath} fill="none" stroke={c.red} strokeWidth={2} strokeLinejoin="round" strokeDasharray="5 3" />
        <circle cx={pad.l + 8} cy={12} r={4} fill={c.green} />
        <text x={pad.l + 16} y={16} fontSize={9} fontWeight="700" fill={c.green}>Home Value</text>
        <circle cx={pad.l + 100} cy={12} r={4} fill={c.red} />
        <text x={pad.l + 108} y={16} fontSize={9} fontWeight="700" fill={c.red}>Loan Balance</text>
        <text x={pad.l + 200} y={16} fontSize={9} fontWeight="700" fill={c.green} fillOpacity={0.7}>■ Equity</text>
        {hov !== null && (() => {
          const d = timeline[hov];
          const px = xFn(hov);
          const pyV = yFn(d.homeValue);
          const pyB = yFn(d.balance);
          const tipW = 168, tipH = 70;
          const tx = px + 10 + tipW > W - pad.r ? px - tipW - 10 : px + 10;
          const ty = Math.min(Math.max(Math.min(pyV, pyB) - 4, pad.t), pad.t + h - tipH);
          return (
            <g>
              <line x1={px} y1={pad.t} x2={px} y2={pad.t + h} stroke="#6B7D8A" strokeWidth={1} strokeDasharray="3 3" opacity="0.5" />
              <circle cx={px} cy={pyV} r={4} fill={c.green} stroke="#fff" strokeWidth={2} />
              <circle cx={px} cy={pyB} r={4} fill={c.red} stroke="#fff" strokeWidth={2} />
              <rect x={tx} y={ty} width={tipW} height={tipH} rx={5} fill={c.bg || '#fff'} stroke={c.border} strokeWidth={1} opacity="0.97" />
              <text x={tx + 8} y={ty + 15} fontSize={9} fontWeight="700" fill={c.text || c.navy} fontFamily={font}>Year {d.year}</text>
              <text x={tx + 8} y={ty + 29} fontSize={8} fill={c.green} fontFamily={font}>Home Value: {fmt(Math.round(d.homeValue))}</text>
              <text x={tx + 8} y={ty + 42} fontSize={8} fill={c.red} fontFamily={font}>Loan Balance: {fmt(Math.round(d.balance))}</text>
              <text x={tx + 8} y={ty + 56} fontSize={8} fill={c.gray} fontFamily={font}>Equity: {fmt(Math.round(d.equity))} ({d.equityPct.toFixed(1)}%)</text>
            </g>
          );
        })()}
      </svg>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          milestones.yr20pct && { label: `20% Equity at Yr ${milestones.yr20pct.year}`, val: `${fmt(Math.round(milestones.yr20pct.equity))} equity`, color: c.green },
          milestones.yr5 && { label: "Value at Yr 5", val: fmt(Math.round(milestones.yr5.homeValue)), color: c.blue },
          milestones.yr10 && { label: "Value at Yr 10", val: fmt(Math.round(milestones.yr10.homeValue)), color: c.blue },
          milestones.yr30 && { label: "Value at Payoff", val: fmt(Math.round(milestones.yr30.homeValue)), color: c.navy },
        ].filter(Boolean).map((m, i) => (
          <div key={i} style={{ flex: "1 1 140px", padding: "8px 10px", borderRadius: 8, border: `1px solid ${m.color}33`, background: m.color + "0d" }}>
            <div style={{ fontSize: 10, color: c.gray, fontFamily: font }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: m.color, fontFamily: font }}>{m.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function addCommasLocal(v) {
  const s = String(v).replace(/[^0-9.]/g, "");
  const [int, dec] = s.split(".");
  const formatted = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? formatted + "." + dec : formatted;
}
function stripCommasLocal(v) { return String(v).replace(/,/g, ""); }

function PaymentCalculator() {
  const c = useThemeColors();
  const [loanAmount, setLoanAmount] = useLocalStorage("pc_la", "350000");
  const [homePrice, setHomePrice] = useLocalStorage("pc_hp", "437500");
  const [downPaymentPct, setDownPaymentPct] = useLocalStorage("pc_dp", "20");
  const [dpMode, setDpMode] = useLocalStorage("pc_dpm", "pct");
  const [rate, setRate] = useLocalStorage("pc_rate", "6.75");
  const [term, setTerm] = useLocalStorage("pc_term", "30");
  // Fee Sheet values used for APR calculation
  const [fsOrigPct]    = useLocalStorage("fs_op",         "0");
  const [fsDpPts]      = useLocalStorage("fs_dp",         "0");
  const [fsOvUw]       = useLocalStorage("fs_ov_uw",      "");
  const [fsDefUw]      = useLocalStorage("fs_def_uw",     "");
  const [fsOvProc]     = useLocalStorage("fs_ov_proc",    "");
  const [fsDefProc]    = useLocalStorage("fs_def_proc",   "");
  const [fsOvFlood]    = useLocalStorage("fs_ov_flood",   "");
  const [fsDefFlood]   = useLocalStorage("fs_def_flood",  "");
  const [fsOvTaxsvc]   = useLocalStorage("fs_ov_taxsvc",  "");
  const [fsDefTaxsvc]  = useLocalStorage("fs_def_taxsvc", "");
  const [fsOvDocprep]  = useLocalStorage("fs_ov_docprep", "");
  const [fsDefDocprep] = useLocalStorage("fs_def_docprep","");
  const [fsState]      = useLocalStorage("fs_state",      "TX");
  const [taxMode, setTaxMode] = useLocalStorage("pc_taxm", "rate");
  const [propertyTax, setPropertyTax] = useLocalStorage("pc_tax", "");
  const [propertyTaxRate, setPropertyTaxRate] = useLocalStorage("pc_taxr", "2.3");
  // Homestead auto-derived: TX primary owner gets 80% tax basis automatically
  const [insMode, setInsMode] = useLocalStorage("pc_insm", "rate");
  const [homeInsurance, setHomeInsurance] = useLocalStorage("pc_ins", "");
  const [homeInsuranceRate, setHomeInsuranceRate] = useLocalStorage("pc_insr", "0.7");
  const [pmiRate, setPmiRate] = useLocalStorage("pc_pmi", "0.55");
  const [pmiAuto, setPmiAuto] = useLocalStorage("pc_pmiauto", true);
  const [ficoScore, setFicoScore] = useLocalStorage("pc_fico", "740");
  const [pmiInfo, setPmiInfo] = useState(null);
  const [hoaDues, setHoaDues] = useLocalStorage("pc_hoa", "0");
  const [loanType, setLoanType] = useLocalStorage("pc_lt", "fixed");
  const [purpose, setPurpose] = useLocalStorage("pc_purpose", "purchase");
  const [loanProgram, setLoanProgram] = useLocalStorage("pc_prog", "conventional");
  const [occupancy, setOccupancy] = useLocalStorage("pc_occ", "primary");
  const [armFixedYears, setArmFixedYears] = useLocalStorage("pc_armfy", "5");
  const [armCap, setArmCap] = useLocalStorage("pc_armcap", "2");
  const [armLifeCap, setArmLifeCap] = useLocalStorage("pc_armlc", "5");
  const [armMargin, setArmMargin] = useLocalStorage("pc_armmg", "2.75");
  const [ioPeriod, setIoPeriod] = useLocalStorage("pc_iop", "10");
  const [helocDrawYears, setHelocDrawYears] = useLocalStorage("pc_hedy", "10");
  const [helocRepayYears, setHelocRepayYears] = useLocalStorage("pc_hery", "20");
  const [pcState, setPcState] = useLocalStorage("pc_state", "TX");
  const [propType, setPropType] = useLocalStorage("pc_proptype", "sfr");
  const homesteadExemption = pcState === "TX" && occupancy === "primary";
  const isCustomTerm = !PRESET_TERMS_PC.includes(term);

  // VA / FHA / USDA upfront & monthly fee state
  const [vaFirstUse, setVaFirstUse] = useLocalStorage("pc_va_first", "true");
  const [vaExempt, setVaExempt] = useLocalStorage("pc_va_exempt", "false");
  const [fhaMipAuto, setFhaMipAuto] = useLocalStorage("pc_fha_mipauto", "true");
  const [fhaMipOverride, setFhaMipOverride] = useLocalStorage("pc_fha_mip", "0.80");

  const syncDown = (hp, dp) => {
    const h = parseFloat(hp) || 0;
    const d = parseFloat(dp) || 0;
    setLoanAmount(String(Math.round(h * (1 - d / 100))));
  };

  useEffect(() => {
    if (!pmiAuto || loanProgram !== "conventional" || loanType === "heloc") { setPmiInfo(null); return; }
    const hp = parseFloat(homePrice) || 0;
    const la = parseFloat(loanAmount) || 0;
    const ltv = hp > 0 ? (la / hp) * 100 : 0;
    if (ltv <= 80) { setPmiInfo(null); setPmiRate(""); return; }
    const fico = parseInt(ficoScore) || 740;
    const termYrs = parseInt(term) || 30;
    const isFixed = loanType === "fixed";
    const isCashOut = purpose === "cashOutRefi";
    const result = lookupPMI({ ltv, fico, termYears: termYrs, occupancy, isFixed, isCashOut, isMultiBorrower: false, highDTI: false });
    if (result.rate !== null) {
      setPmiRate(String((result.rate * 100).toFixed(2)));
      setPmiInfo(result);
    } else { setPmiInfo(null); }
  }, [pmiAuto, homePrice, loanAmount, ficoScore, term, loanType, loanProgram, purpose, occupancy]);

  // FHA and USDA require owner-occupied — enforce automatically
  useEffect(() => {
    if ((loanProgram === "fha" || loanProgram === "usda") && occupancy !== "primary") {
      setOccupancy("primary");
    }
  }, [loanProgram]);

  // Auto-set property tax rate when state changes (skip mount so saved values are preserved)
  const taxRateStateInitRef = React.useRef(true);
  useEffect(() => {
    if (taxRateStateInitRef.current) { taxRateStateInitRef.current = false; return; }
    const defaultRate = STATE_TAX_RATES[pcState];
    if (defaultRate != null) setPropertyTaxRate(String(defaultRate));
  }, [pcState]);

  // Auto-set home insurance rate when state, property type, or occupancy changes
  // Applies multipliers: condos are cheaper (HOA covers structure), investment properties cost more
  const insRateStateInitRef = React.useRef(true);
  useEffect(() => {
    if (insRateStateInitRef.current) { insRateStateInitRef.current = false; return; }
    const baseRate = STATE_INS_RATES[pcState];
    if (baseRate != null) {
      const propMult = INS_PROP_MULTIPLIERS[propType] || 1.00;
      const occMult = INS_OCC_MULTIPLIERS[occupancy] || 1.00;
      setHomeInsuranceRate(String(parseFloat((baseRate * propMult * occMult).toFixed(2))));
    }
  }, [pcState, propType, occupancy]);

  // Appreciation rate for equity projection
  const [pcAppr, setPcAppr] = useLocalStorage("pc_appr", "3.5");
  const apprStateInitRef = React.useRef(true);
  useEffect(() => {
    if (apprStateInitRef.current) { apprStateInitRef.current = false; return; }
    const defaultRate = STATE_APPR_RATES[pcState];
    if (defaultRate != null) setPcAppr(String(defaultRate));
  }, [pcState]);

  useEffect(() => {
    window.dispatchEvent(new Event("mtk_values_changed"));
  }, [homePrice, loanAmount, rate, propertyTaxRate, homeInsuranceRate, taxMode, insMode, propertyTax, homeInsurance, downPaymentPct, pmiRate, ficoScore, homesteadExemption, pcState]);

  // Auto-format interest rate: 2 decimals normally, 3 if the user typed a third decimal (e.g. 6.125)
  useEffect(() => {
    const timer = setTimeout(() => {
      const n = parseFloat(rate);
      if (isNaN(n)) return;
      const str = String(rate).trim();
      const dotIdx = str.indexOf(".");
      const decimals = dotIdx === -1 ? 0 : str.length - dotIdx - 1;
      const formatted = decimals === 3 ? n.toFixed(3) : n.toFixed(2);
      if (formatted !== rate) setRate(formatted);
    }, 800);
    return () => clearTimeout(timer);
  }, [rate]);

  const calc = useMemo(() => {
    const baseLA = parseFloat(loanAmount) || 0;
    const hp = parseFloat(homePrice) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const annualRate = (parseFloat(rate) || 0);
    const termYrs = parseInt(term) || 30;
    const n = loanType === "heloc" ? ((parseFloat(helocDrawYears) || 10) + (parseFloat(helocRepayYears) || 20)) * 12 : termYrs * 12;
    const dp = parseFloat(downPaymentPct) || 0;
    const taxBasis = homesteadExemption ? hp * 0.80 : hp;
    const monthlyTaxInput = parseFloat(propertyTax) || 0;
    const annualTax = taxMode === "rate" ? taxBasis * ((parseFloat(propertyTaxRate) || 0) / 100) : monthlyTaxInput * 12;
    const monthlyTax = taxMode === "rate" ? annualTax / 12 : monthlyTaxInput;
    const monthlyInsInput = parseFloat(homeInsurance) || 0;
    const annualIns = insMode === "rate" ? hp * ((parseFloat(homeInsuranceRate) || 0) / 100) : monthlyInsInput * 12;
    const monthlyIns = insMode === "rate" ? annualIns / 12 : monthlyInsInput;
    const monthlyHOA = parseFloat(hoaDues) || 0;
    const ltv = hp > 0 ? (baseLA / hp * 100) : 0;

    // ── Upfront fees rolled into funded loan amount ──
    const vaExemptBool = vaExempt === "true";
    const vaFirstBool  = vaFirstUse === "true";
    const vaFeeRate = (() => {
      if (loanProgram !== "va" || vaExemptBool) return 0;
      if (purpose === "refinance") return 0.005; // IRRRL
      if (dp >= 10) return 0.0125;
      if (dp >= 5)  return 0.0150;
      return vaFirstBool ? 0.0215 : 0.0330;
    })();
    const vaFundingFee  = Math.round(baseLA * vaFeeRate);
    const fhaUfmip      = loanProgram === "fha"  ? Math.round(baseLA * 0.0175) : 0;
    const usdaUpfront   = loanProgram === "usda" ? Math.round(baseLA * 0.01)   : 0;
    const upfrontFee    = vaFundingFee + fhaUfmip + usdaUpfront;
    const la            = baseLA + upfrontFee; // funded loan amount used for P&I

    // ── Monthly mortgage insurance ──
    const fhaMipRatePct = (() => {
      if (loanProgram !== "fha") return 0;
      if (fhaMipAuto !== "true") return parseFloat(fhaMipOverride) || 0.80;
      // Post-March 2023 standard FHA MIP rates
      if (termYrs <= 15) return ltv > 90 ? 0.70 : 0.45;
      return ltv > 95 ? 0.85 : 0.80;
    })();
    const monthlyFhaMip  = loanProgram === "fha"  ? (baseLA * fhaMipRatePct / 100) / 12 : 0;
    const monthlyUsdaFee = loanProgram === "usda" ? (baseLA * 0.35 / 100) / 12          : 0;
    const isConvPMI      = (loanProgram === "conventional" || loanProgram === "") && ltv > 80;
    const monthlyPMI     = isConvPMI ? (la * (parseFloat(pmiRate) || 0) / 100) / 12 : 0;
    const monthlyMI      = loanProgram === "fha" ? monthlyFhaMip
                         : loanProgram === "usda" ? monthlyUsdaFee
                         : monthlyPMI;

    let monthlyPI, totalInterest, extraInfo = {};

    if (loanType === "arm") {
      const fixedMo = (parseFloat(armFixedYears) || 5) * 12;
      const adjCap  = parseFloat(armCap) || 2;
      const lifeCap = parseFloat(armLifeCap) || 5;
      const margin  = parseFloat(armMargin) || 2.75;
      monthlyPI = pmt(r, n, la);
      const worstRate = Math.min(annualRate + lifeCap, annualRate + adjCap);
      const worstR    = worstRate / 100 / 12;
      const remainBal = la * ((Math.pow(1 + r, n) - Math.pow(1 + r, fixedMo)) / (Math.pow(1 + r, n) - 1));
      const worstPI   = pmt(worstR, n - fixedMo, remainBal);
      totalInterest = (monthlyPI * fixedMo) + (worstPI * (n - fixedMo)) - la;
      extraInfo = { worstPI, worstRate, fixedMo, remainBal, adjCap, lifeCap, margin };
    } else if (loanType === "io") {
      const ioPeriodMo = (parseFloat(ioPeriod) || 10) * 12;
      const ioPayment  = la * r;
      const amortPI    = pmt(r, n - ioPeriodMo, la);
      monthlyPI = ioPayment;
      totalInterest = (ioPayment * ioPeriodMo) + (amortPI * (n - ioPeriodMo)) - la;
      extraInfo = { ioPayment, amortPI, ioPeriodMo };
    } else if (loanType === "heloc") {
      const drawMo    = (parseFloat(helocDrawYears) || 10) * 12;
      const repayMo   = (parseFloat(helocRepayYears) || 20) * 12;
      const drawPayment = la * r;
      const repayPI   = pmt(r, repayMo, la);
      monthlyPI = drawPayment;
      totalInterest = (drawPayment * drawMo) + (repayPI * repayMo) - la;
      extraInfo = { drawPayment, repayPI, drawMo, repayMo };
    } else {
      monthlyPI     = pmt(r, n, la);
      totalInterest = (monthlyPI * n) - la;
    }

    const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyMI + monthlyHOA;

    // APR — finance charges from the Fee Sheet (origination, discount pts, UW, processing, flood, tax svc, doc prep)
    const _ov  = (val, fb)  => { const n = parseFloat(val);  return (val  !== "" && !isNaN(n)) ? n : fb; };
    const _def = (cust, hd) => { const n = parseFloat(cust); return (cust !== "" && !isNaN(n)) ? n : hd; };
    const stFees = getStateFees ? getStateFees(fsState) : {};
    const aprOrig    = Math.round(baseLA * (parseFloat(fsOrigPct) || 0) / 100);
    const aprDisc    = Math.round(baseLA * (parseFloat(fsDpPts)   || 0) / 100);
    const aprUw      = _ov(fsOvUw,      _def(fsDefUw,      1000));
    const aprProc    = _ov(fsOvProc,    _def(fsDefProc,    595));
    const aprFlood   = _ov(fsOvFlood,   _def(fsDefFlood,   (stFees.floodCert || 14)));
    const aprTaxSvc  = _ov(fsOvTaxsvc,  _def(fsDefTaxsvc,  (stFees.taxServiceFee || 85)));
    const aprDocPrep = _ov(fsOvDocprep, _def(fsDefDocprep, 250));
    const aprFees = aprOrig + aprDisc + aprUw + aprProc + aprFlood + aprTaxSvc + aprDocPrep;
    const apr = (loanType === "" || loanType === "fixed") && baseLA > 0
      ? calcAPR(baseLA, annualRate, termYrs, aprFees)
      : annualRate;

    return {
      monthlyPI, monthlyTax, monthlyIns, monthlyPMI: monthlyMI, monthlyHOA,
      totalMonthly, totalInterest, ltv, la, baseLA, n, loanType,
      upfrontFee, vaFundingFee, vaFeeRate, fhaUfmip, usdaUpfront,
      fhaMipRatePct, monthlyFhaMip, monthlyUsdaFee, monthlyMI, isConvPMI,
      apr, aprFees,
      ...extraInfo,
    };
  }, [loanAmount, homePrice, rate, term, propertyTax, homeInsurance, propertyTaxRate, homeInsuranceRate, taxMode, insMode, downPaymentPct, pmiRate, hoaDues, loanType, armFixedYears, armCap, armLifeCap, armMargin, ioPeriod, helocDrawYears, helocRepayYears, pcState, occupancy, loanProgram, purpose, vaFirstUse, vaExempt, fhaMipAuto, fhaMipOverride,
    fsOrigPct, fsDpPts, fsOvUw, fsDefUw, fsOvProc, fsDefProc, fsOvFlood, fsDefFlood, fsOvTaxsvc, fsDefTaxsvc, fsOvDocprep, fsDefDocprep, fsState]);

  // Equity projection: overlays appreciation-driven value on the balance paydown
  const equityTimeline = useMemo(() => {
    if (loanType !== "" && loanType !== "fixed") return [];
    const la = calc.la;
    const hp = parseFloat(homePrice) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const termYrs = parseInt(term) || 30;
    const appr = (parseFloat(pcAppr) || 0) / 100;
    if (la <= 0 || r <= 0 || termYrs <= 0 || hp <= 0) return [];
    const monthlyPI = pmt(r, termYrs * 12, la);
    let balance = la;
    const timeline = [];
    for (let y = 0; y < termYrs; y++) {
      for (let m = 0; m < 12 && balance > 0.005; m++) {
        const intPmt = balance * r;
        const prinPmt = Math.min(monthlyPI - intPmt, balance);
        balance = Math.max(0, balance - prinPmt);
      }
      const homeValue = hp * Math.pow(1 + appr, y + 1);
      const equity = homeValue - balance;
      const equityPct = homeValue > 0 ? equity / homeValue * 100 : 0;
      timeline.push({ year: y + 1, homeValue, balance, equity, equityPct });
      if (balance <= 0.005) break;
    }
    return timeline;
  }, [calc.la, homePrice, rate, term, loanType, pcAppr]);

  // Key equity milestones
  const equityMilestones = useMemo(() => {
    const milestones = {};
    equityTimeline.forEach(d => {
      if (!milestones.yr5 && d.year >= 5) milestones.yr5 = d;
      if (!milestones.yr10 && d.year >= 10) milestones.yr10 = d;
      if (!milestones.yr20pct && d.equityPct >= 20) milestones.yr20pct = d;
      if (!milestones.yr30 && d.year >= 30) milestones.yr30 = d;
    });
    if (!milestones.yr30) milestones.yr30 = equityTimeline[equityTimeline.length - 1] || null;
    return milestones;
  }, [equityTimeline]);

  // Build yearly amortization data for balance/PI charts (fixed-rate only)
  const amortYears = useMemo(() => {
    if (loanType !== "" && loanType !== "fixed") return [];
    const la = calc.la;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const termYrs = parseInt(term) || 30;
    if (la <= 0 || r <= 0 || termYrs <= 0) return [];
    const monthlyPI = pmt(r, termYrs * 12, la);
    let balance = la;
    const years = [];
    let cumulInt = 0;
    for (let y = 0; y < termYrs; y++) {
      let yPrin = 0, yInt = 0;
      for (let m = 0; m < 12 && balance > 0.005; m++) {
        const intPmt = balance * r;
        let prinPmt = monthlyPI - intPmt;
        if (prinPmt > balance) prinPmt = balance;
        balance = Math.max(0, balance - prinPmt);
        yPrin += prinPmt;
        yInt += intPmt;
      }
      cumulInt += yInt;
      years.push({ year: y + 1, principal: yPrin, interest: yInt, totalPayment: yPrin + yInt, endBalance: balance, totalInterest: cumulInt });
      if (balance <= 0.005) break;
    }
    return years;
  }, [calc.la, rate, term, loanType]);

  const miLabel = loanProgram === "fha" ? "FHA MIP" : loanProgram === "usda" ? "USDA Annual Fee" : "PMI";
  const pieData = [
    { label: "Principal & Interest", value: calc.monthlyPI, color: c.navy },
    { label: "Property Tax", value: calc.monthlyTax, color: c.blue },
    { label: "Home Insurance", value: calc.monthlyIns, color: c.green },
    ...(calc.monthlyMI > 0 ? [{ label: miLabel, value: calc.monthlyMI, color: c.gold }] : []),
    ...(calc.monthlyHOA > 0 ? [{ label: "HOA", value: calc.monthlyHOA, color: c.grayLight }] : []),
  ].filter(d => d.value > 0);

  const total = pieData.reduce((s, d) => s + d.value, 0);

  const loanTypeLabel = loanType === "arm" ? `ARM ${armFixedYears}/1` : loanType === "io" ? "Interest-Only" : loanType === "heloc" ? "HELOC" : "Fixed";
  const programLabel = loanProgram === "fha" ? "FHA" : loanProgram === "va" ? "VA" : loanProgram === "usda" ? "USDA" : "CONV";
  const occLabel = occupancy === "vacation" ? "Vacation" : occupancy === "investment" ? "Investment" : "Primary";
  const purposeLabel = purpose === "refinance" ? "Refi" : "Purchase";

  const showMISection = loanType !== "heloc" && (
    loanProgram === "va" ||
    loanProgram === "fha" ||
    loanProgram === "usda" ||
    ((loanProgram === "conventional" || loanProgram === "") && calc.ltv > 80)
  );
  const miSectionTitle = loanProgram === "fha" ? "FHA MORTGAGE INSURANCE"
    : loanProgram === "usda" ? "USDA ANNUAL FEE"
    : loanProgram === "va" ? "VA LOAN BENEFIT"
    : "PRIVATE MORTGAGE INSURANCE";
  const miSectionAccent = loanProgram === "va" ? c.green
    : (loanProgram === "fha" || loanProgram === "usda") ? c.gold
    : c.blue;

  return (
    <div>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* ═══ LEFT COLUMN — 3 stacked sections ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* ── 1. LOAN PROGRAM ── */}
          <SectionCard title="LOAN PROGRAM" accent={c.blue}>
            <Select label="State (where the property is located)" value={pcState} onChange={setPcState} options={STATE_LIST.map(s => ({ value: s.value, label: s.label }))} />
            <Select label="Loan Program" value={loanProgram} onChange={setLoanProgram} options={[
              { value: "", label: "— Select —" },
              { value: "conventional", label: "Conventional" }, { value: "fha", label: "FHA" },
              { value: "va", label: "VA" }, { value: "usda", label: "USDA" },
            ]} />
            <Select label="Occupancy" value={occupancy} onChange={(v) => {
              if (loanProgram === "fha" || loanProgram === "usda") return;
              setOccupancy(v);
            }} options={[
              { value: "", label: "— Select —" },
              { value: "primary", label: "Owner Occupied" },
              ...(loanProgram === "fha" || loanProgram === "usda" ? [] : [
                { value: "vacation", label: "Vacation Home" },
                { value: "investment", label: "Investment Property" },
              ]),
            ]} />
            {(loanProgram === "fha" || loanProgram === "usda") && (
              <div style={{ fontSize: 10, color: c.blue, fontFamily: font, marginTop: -4, marginBottom: 4, fontStyle: "italic" }}>
                {loanProgram === "fha" ? "FHA" : "USDA"} requires owner-occupied. Occupancy locked.
              </div>
            )}
            <Select label="Property Type" value={propType} onChange={setPropType} options={[
              { value: "", label: "— Select —" },
              { value: "sfr", label: "Single Family Home" },
              { value: "townhome", label: "Townhome" },
              { value: "condo", label: "Condo" },
              { value: "duplex", label: "Duplex" },
              { value: "3plex", label: "3-Plex" },
              { value: "4plex", label: "4-Plex" },
              { value: "other", label: "Other" },
            ]} />
            {(() => {
              const la = parseFloat(loanAmount) || 0;
              const conformingLimit = CONFORMING_LIMITS.baseline;
              const fhaLimit = FHA_LIMITS.floor;
              const warnings = [];
              if (loanProgram === "conventional" && la > conformingLimit) {
                warnings.push({ color: "#d97706", bg: "#fffbeb", border: "#fcd34d", icon: "⚠️", text: `Loan amount exceeds the conforming limit of ${fmt(conformingLimit)}. This is a Jumbo loan — different rates and guidelines apply.` });
              }
              if (loanProgram === "fha" && la > fhaLimit) {
                warnings.push({ color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", icon: "🚫", text: `Loan amount exceeds the FHA floor limit of ${fmt(fhaLimit)} for ${pcState}. Reduce the loan amount or select a different program.` });
              }
              if (loanProgram === "conventional" && la > conformingLimit * 0.95 && la <= conformingLimit) {
                warnings.push({ color: "#2563eb", bg: "#eff6ff", border: "#93c5fd", icon: "ℹ️", text: `Loan amount is within 5% of the conforming limit (${fmt(conformingLimit)}). Consider staying below to avoid jumbo pricing.` });
              }
              if (loanProgram === "fha" && la > fhaLimit * 0.95 && la <= fhaLimit) {
                warnings.push({ color: "#2563eb", bg: "#eff6ff", border: "#93c5fd", icon: "ℹ️", text: `Loan amount is within 5% of the FHA floor limit (${fmt(fhaLimit)}) for ${pcState}.` });
              }
              return warnings.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2, marginBottom: 4 }}>
                  {warnings.map((w, i) => (
                    <div key={i} style={{ background: w.bg, border: `1px solid ${w.border}`, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{w.icon}</span>
                      <span style={{ fontSize: 11, color: w.color, fontWeight: 600, fontFamily: font, lineHeight: 1.4 }}>{w.text}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* ── VA Funding Fee panel ── */}
            {loanProgram === "va" && loanType !== "heloc" && (
              <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.blue, fontFamily: font, marginBottom: 8 }}>VA FUNDING FEE</div>
                <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${c.border}`, marginBottom: 8 }}>
                  {[{ v: "true", l: "First Use" }, { v: "false", l: "Subsequent Use" }].map(o => (
                    <button key={o.v} onClick={() => setVaFirstUse(o.v)} style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: vaFirstUse === o.v ? c.blue : "transparent", color: vaFirstUse === o.v ? "#fff" : c.gray, transition: "all 0.2s" }}>{o.l}</button>
                  ))}
                </div>
                <Toggle label="Disability Exempt (waives funding fee)" checked={vaExempt === "true"} onChange={v => setVaExempt(v ? "true" : "false")} />
                <div style={{ marginTop: 8, padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 3 }}>
                    <span style={{ color: c.gray }}>Base Loan Amount</span>
                    <span style={{ color: c.text || c.navy, fontWeight: 600 }}>{fmt(calc.baseLA)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 5 }}>
                    <span style={{ color: c.gray }}>VA Funding Fee {vaExempt !== "true" && `(${(calc.vaFeeRate * 100).toFixed(2)}%)`}</span>
                    <span style={{ color: c.gold, fontWeight: 600 }}>{vaExempt === "true" ? "Waived" : `+${fmt(calc.vaFundingFee)}`}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: font, borderTop: `1px solid ${c.border}`, paddingTop: 5 }}>
                    <span style={{ color: c.navy, fontWeight: 700 }}>Funded Loan Amount</span>
                    <span style={{ color: c.navy, fontWeight: 800 }}>{fmt(calc.la)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: c.gray, fontFamily: font, marginTop: 6, lineHeight: 1.4 }}>
                  Funding fee is rolled into the loan. VA loans have <strong>no monthly MI</strong>.
                </div>
              </div>
            )}

            {/* ── FHA MIP panel ── */}
            {loanProgram === "fha" && loanType !== "heloc" && (
              <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.blue, fontFamily: font, marginBottom: 8 }}>FHA MORTGAGE INSURANCE</div>
                <div style={{ padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 3 }}>
                    <span style={{ color: c.gray }}>Base Loan Amount</span>
                    <span style={{ color: c.text || c.navy, fontWeight: 600 }}>{fmt(calc.baseLA)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 5 }}>
                    <span style={{ color: c.gray }}>Upfront MIP (1.75% — financed)</span>
                    <span style={{ color: c.gold, fontWeight: 600 }}>+{fmt(calc.fhaUfmip)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: font, borderTop: `1px solid ${c.border}`, paddingTop: 5 }}>
                    <span style={{ color: c.navy, fontWeight: 700 }}>Funded Loan Amount</span>
                    <span style={{ color: c.navy, fontWeight: 800 }}>{fmt(calc.la)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.gray, fontFamily: font, marginBottom: 4 }}>Annual MIP Rate</div>
                <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${c.border}`, marginBottom: 6 }}>
                  {[{ v: "true", l: "Auto" }, { v: "false", l: "Manual" }].map(o => (
                    <button key={o.v} onClick={() => setFhaMipAuto(o.v)} style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: fhaMipAuto === o.v ? c.blue : "transparent", color: fhaMipAuto === o.v ? "#fff" : c.gray, transition: "all 0.2s" }}>{o.l}</button>
                  ))}
                </div>
                {fhaMipAuto !== "true" && (
                  <LabeledInput label="Annual MIP Rate" value={fhaMipOverride} onChange={setFhaMipOverride} suffix="%" small hint={`${fmt2(calc.monthlyFhaMip)}/mo`} />
                )}
                <div style={{ fontSize: 11, color: c.gray, fontFamily: font, marginTop: fhaMipAuto === "true" ? 0 : 4 }}>
                  Annual MIP: <strong style={{ color: c.navy }}>{calc.fhaMipRatePct.toFixed(2)}%</strong> = <strong style={{ color: c.navy }}>{fmt2(calc.monthlyFhaMip)}/mo</strong>
                  {fhaMipAuto === "true" && <span style={{ opacity: 0.7 }}> (auto: LTV {calc.ltv.toFixed(0)}%, {parseInt(term) || 30}yr term)</span>}
                </div>
              </div>
            )}

            {/* ── USDA fees panel ── */}
            {loanProgram === "usda" && loanType !== "heloc" && (
              <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.blue, fontFamily: font, marginBottom: 8 }}>USDA FEES</div>
                <div style={{ padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 3 }}>
                    <span style={{ color: c.gray }}>Base Loan Amount</span>
                    <span style={{ color: c.text || c.navy, fontWeight: 600 }}>{fmt(calc.baseLA)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 5 }}>
                    <span style={{ color: c.gray }}>Upfront Guarantee Fee (1.0% — financed)</span>
                    <span style={{ color: c.gold, fontWeight: 600 }}>+{fmt(calc.usdaUpfront)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: font, borderTop: `1px solid ${c.border}`, paddingTop: 5, marginBottom: 5 }}>
                    <span style={{ color: c.navy, fontWeight: 700 }}>Funded Loan Amount</span>
                    <span style={{ color: c.navy, fontWeight: 800 }}>{fmt(calc.la)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font }}>
                    <span style={{ color: c.gray }}>Annual Fee (0.35%)</span>
                    <span style={{ color: c.navy, fontWeight: 600 }}>{fmt2(calc.monthlyUsdaFee)}/mo</span>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── 3. LOAN DETAILS ── */}
          <SectionCard title="LOAN DETAILS" accent={c.navy}>
            <Select label="Loan Type" value={loanType} onChange={setLoanType} options={[
              { value: "", label: "— Select —" },
              { value: "fixed", label: "Fixed Rate" }, { value: "arm", label: "Adjustable Rate (ARM)" },
              { value: "io", label: "Interest-Only" }, { value: "heloc", label: "HELOC" },
            ]} />
            {loanType !== "heloc" && (
              <>
                <Select label="Loan Term" value={isCustomTerm ? "other" : term} onChange={(v) => {
                  if (v === "other") setTerm("");
                  else setTerm(v);
                }} options={[
                  { value: "30", label: "30 Years" }, { value: "25", label: "25 Years" },
                  { value: "20", label: "20 Years" }, { value: "15", label: "15 Years" },
                  { value: "10", label: "10 Years" },
                  { value: "other", label: "Other…" },
                ]} />
                {isCustomTerm && (
                  <LabeledInput label="Custom Term" value={term} onChange={(v) => {
                    const str = v.replace(/[^0-9]/g, "");
                    if (str === "") { setTerm(""); return; }
                    const yr = parseInt(str);
                    if (yr >= 1 && yr <= 30) setTerm(String(yr));
                    else if (yr > 30) setTerm("30");
                  }} suffix="years" small hint="Enter 1–30 years" />
                )}
              </>
            )}
            {loanType === "arm" && (
              <div style={{ background: c.bgAlt || c.blueLight, borderRadius: 8, padding: 12, marginTop: 4, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.blue, marginBottom: 8, fontFamily: font }}>ARM PARAMETERS</div>
                <Select label="Fixed Period" value={armFixedYears} onChange={setArmFixedYears} options={[
                  { value: "3", label: "3 Years" }, { value: "5", label: "5 Years" },
                  { value: "7", label: "7 Years" }, { value: "10", label: "10 Years" },
                ]} />
                <LabeledInput label="Adjustment Cap" value={armCap} onChange={setArmCap} suffix="%" small hint="Max rate change per adjustment" />
                <LabeledInput label="Lifetime Cap" value={armLifeCap} onChange={setArmLifeCap} suffix="%" small hint="Max total rate increase over life" />
                <LabeledInput label="Margin" value={armMargin} onChange={setArmMargin} suffix="%" small hint="Added to index rate at adjustment" />
              </div>
            )}
            {loanType === "io" && (
              <div style={{ background: c.bgAlt || c.blueLight, borderRadius: 8, padding: 12, marginTop: 4, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.blue, marginBottom: 8, fontFamily: font }}>INTEREST-ONLY PERIOD</div>
                <Select label="IO Period" value={ioPeriod} onChange={setIoPeriod} options={[
                  { value: "5", label: "5 Years" }, { value: "7", label: "7 Years" },
                  { value: "10", label: "10 Years" },
                ]} />
                <div style={{ fontSize: 11, color: c.gray, fontFamily: font, marginTop: 4 }}>After {ioPeriod} years, payments become fully amortizing for the remaining {(parseFloat(term) || 30) - (parseFloat(ioPeriod) || 10)} years.</div>
              </div>
            )}
            {loanType === "heloc" && (
              <div style={{ background: c.bgAlt || c.blueLight, borderRadius: 8, padding: 12, marginTop: 4, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c.blue, marginBottom: 8, fontFamily: font }}>HELOC TERMS</div>
                <Select label="Draw Period" value={helocDrawYears} onChange={setHelocDrawYears} options={[
                  { value: "5", label: "5 Years" }, { value: "10", label: "10 Years" },
                  { value: "15", label: "15 Years" },
                ]} />
                <Select label="Repayment Period" value={helocRepayYears} onChange={setHelocRepayYears} options={[
                  { value: "10", label: "10 Years" }, { value: "15", label: "15 Years" },
                  { value: "20", label: "20 Years" },
                ]} />
                <div style={{ fontSize: 11, color: c.gray, fontFamily: font, marginTop: 4 }}>Interest-only during draw period, then fully amortizing during repayment.</div>
              </div>
            )}
            {loanType !== "heloc" && <LabeledInput label={purpose === "refinance" ? "Home Value" : "Purchase Price"} prefix="$" value={homePrice} onChange={(v) => { if (parseFloat(String(v).replace(/,/g, '')) > 99999999) return; setHomePrice(v); syncDown(v, downPaymentPct); }} useCommas />}
            {loanType !== "heloc" && purpose === "purchase" && (() => {
              const hp = parseFloat(homePrice) || 0;
              const dpPct = parseFloat(downPaymentPct) || 0;
              const dpDollar = Math.round(hp * dpPct / 100);
              return (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || c.gray, fontFamily: font }}>Down Payment</span>
                    <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${c.border}` }}>
                      {[{ v: "pct", l: "%" }, { v: "dollar", l: "$" }].map(o => (
                        <button key={o.v} onClick={() => setDpMode(o.v)} style={{ padding: "2px 10px", fontSize: 11, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: dpMode === o.v ? c.blue : "transparent", color: dpMode === o.v ? "#fff" : c.gray, transition: "all 0.15s" }}>{o.l}</button>
                      ))}
                    </div>
                  </div>
                  {dpMode === "pct" ? (
                    <LabeledInput label="" value={downPaymentPct} onChange={(v) => {
                      if (String(v).trimStart().startsWith('-')) return;
                      const numVal = parseFloat(v) || 0;
                      if (numVal > 100) return;
                      setDownPaymentPct(v);
                      syncDown(homePrice, v);
                    }} suffix="%" small hint={`${fmt(dpDollar)} down payment`} />
                  ) : (
                    <LabeledInput label="" prefix="$" value={String(dpDollar)} onChange={(v) => {
                      if (String(v).trimStart().startsWith('-')) return;
                      const hp2 = parseFloat(homePrice) || 0;
                      const d = parseFloat(v) || 0;
                      const cappedD = hp2 > 0 ? Math.min(d, hp2) : d;
                      const newPct = hp2 > 0 ? String((cappedD / hp2) * 100) : "0";
                      setDownPaymentPct(newPct);
                      syncDown(homePrice, newPct);
                    }} useCommas small hint={`${dpPct.toFixed(2)}% down`} />
                  )}
                </div>
              );
            })()}
            {/* Loan Amount — read-only for purchase, editable for refi */}
            {purpose === "purchase" ? (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, fontFamily: font, display: "block", marginBottom: 5 }}>
                  {loanType === "heloc" ? "Credit Line Amount" : "Loan Amount"}
                </span>
                <div style={{ padding: "10px 14px", background: c.bgAlt || "#faf9f7", border: `1px solid ${c.border}`, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: c.navy, fontFamily: font }}>{fmt(calc.la)}</span>
                  <span style={{ fontSize: 10, color: c.gray, fontFamily: font, fontStyle: "italic" }}>auto-calculated</span>
                </div>
                {calc.upfrontFee > 0 && (
                  <div style={{ fontSize: 10, color: c.gray, fontFamily: font, marginTop: 3 }}>
                    Base {fmt(calc.baseLA)} + {fmt(calc.upfrontFee)} financed fee
                  </div>
                )}
              </div>
            ) : (
              <LabeledInput label={loanType === "heloc" ? "Credit Line Amount" : "Loan Amount"} prefix="$" value={loanAmount} onChange={setLoanAmount} useCommas />
            )}
            <LabeledInput label="Interest Rate" value={rate} onChange={(v) => { if (String(v).trimStart().startsWith('-')) return; setRate(v); }} suffix="%" step="0.125" />
            {calc.apr > 0 && calc.apr !== (parseFloat(rate) || 0) && (
              <div style={{ fontSize: 10, color: c.gray, fontFamily: font, marginTop: -4, marginBottom: 6, paddingLeft: 2 }}>
                APR {calc.apr.toFixed((() => { const s = String(rate || "").trim(); const d = s.indexOf("."); return d === -1 ? 2 : Math.max(2, s.length - d - 1); })())}%
                <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.7 }}>(based on Fee Sheet charges)</span>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div>
          <div style={{ background: `linear-gradient(135deg, ${c.navy}, ${c.navyLight})`, borderRadius: 12, padding: 24, color: "#fff", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.5, marginBottom: 4 }}>{purposeLabel.toUpperCase()} · {programLabel} · {loanTypeLabel.toUpperCase()} · {occLabel.toUpperCase()}</div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 8 }}>
              {loanType === "io" ? "INTEREST-ONLY PAYMENT" : loanType === "heloc" ? "DRAW PERIOD PAYMENT" : "TOTAL MONTHLY PAYMENT"}
            </div>
            <div style={{ fontSize: 48, fontWeight: 800, fontFamily: font, lineHeight: 1 }}>{fmt2(calc.totalMonthly)}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
              {loanType === "io" ? `IO for ${ioPeriod}yr, then ${fmt2(calc.amortPI)}/mo P&I` :
               loanType === "heloc" ? `IO draw ${helocDrawYears}yr, then ${fmt2(calc.repayPI)}/mo repay` :
               loanType === "arm" ? `Fixed ${armFixedYears}yr, worst-case ${fmt2(calc.worstPI)}/mo after` :
               `Principal, Interest, Taxes, Insurance${calc.monthlyPMI > 0 ? ", PMI" : ""}${calc.monthlyHOA > 0 ? ", HOA" : ""}`}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
            <DonutChart
              data={pieData.map(d => ({ value: d.value, color: d.color }))}
              size={150}
              thickness={22}
              centerLabel="MONTHLY"
              centerValue={fmt2(total)}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
              {pieData.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: d.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: c.gray, fontWeight: 600, fontFamily: font }}>{d.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy, fontFamily: font }}>{fmt2(d.value)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: c.grayLight, fontFamily: font }}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* TAXES & INSURANCE — property tax, home insurance, HOA only */}
          <SectionCard title="TAXES & INSURANCE" accent={c.blue}>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || c.gray, fontFamily: font }}>Property Tax{taxMode === "dollar" ? " (monthly)" : ""}</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${c.border}` }}>
                  {[{ v: "rate", l: "%" }, { v: "dollar", l: "$" }].map(o => (
                    <button key={o.v} onClick={() => setTaxMode(o.v)} style={{ padding: "2px 10px", fontSize: 11, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: taxMode === o.v ? c.blue : "transparent", color: taxMode === o.v ? "#fff" : c.gray, transition: "all 0.15s" }}>{o.l}</button>
                  ))}
                </div>
              </div>
              {taxMode === "rate" ? (
                <LabeledInput label="" value={propertyTaxRate} onChange={(v) => { if (String(v).trimStart().startsWith('-')) return; setPropertyTaxRate(v); }} suffix="% of home value" small hint={`${fmt2((parseFloat(homePrice)||0)*(parseFloat(propertyTaxRate)||0)/100/12)}/mo · ${fmt2((parseFloat(homePrice)||0)*(parseFloat(propertyTaxRate)||0)/100)}/yr`} />
              ) : (
                <LabeledInput label="" prefix="$" value={propertyTax} onChange={(v) => { if (String(v).trimStart().startsWith('-')) return; setPropertyTax(v); }} useCommas suffix="/mo" small hint={`${fmt2((parseFloat(propertyTax)||0)*12)}/yr`} />
              )}
              {taxMode === "rate" && STATE_TAX_RATES[pcState] != null && (
                <div style={{ fontSize: 10, color: c.grayLight || c.gray, fontFamily: font, marginTop: 3, lineHeight: 1.4, fontStyle: "italic" }}>
                  * {(window.STATE_LIST||[]).find(s=>s.value===pcState)?.label || pcState} state average ≈ {STATE_TAX_RATES[pcState]}% — actual rates vary by county and taxing district. Override as needed.
                </div>
              )}
              {homesteadExemption && (
                <div style={{ marginTop: 4, fontSize: 10, color: c.textSecondary || c.gray, fontFamily: font, lineHeight: 1.5 }}>
                  Homestead exemption applied (owner-occupied primary residence) — estimated tax basis reduced to <strong style={{ color: c.text || c.navy }}>{fmt(Math.round((parseFloat(homePrice) || 0) * 0.80))}</strong>, approx. 80% of value. Actual exemption amount varies.
                </div>
              )}
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || c.gray, fontFamily: font }}>Home Insurance{insMode === "dollar" ? " (monthly)" : ""}</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${c.border}` }}>
                  {[{ v: "rate", l: "%" }, { v: "dollar", l: "$" }].map(o => (
                    <button key={o.v} onClick={() => setInsMode(o.v)} style={{ padding: "2px 10px", fontSize: 11, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: insMode === o.v ? c.blue : "transparent", color: insMode === o.v ? "#fff" : c.gray, transition: "all 0.15s" }}>{o.l}</button>
                  ))}
                </div>
              </div>
              {insMode === "rate" ? (
                <LabeledInput label="" value={homeInsuranceRate} onChange={(v) => { if (String(v).trimStart().startsWith('-')) return; setHomeInsuranceRate(v); }} suffix="% of home value" small hint={`${fmt2((parseFloat(homePrice) || 0) * (parseFloat(homeInsuranceRate) || 0) / 100 / 12)}/mo · ${fmt2((parseFloat(homePrice) || 0) * (parseFloat(homeInsuranceRate) || 0) / 100)}/yr`} />
              ) : (
                <LabeledInput label="" prefix="$" value={homeInsurance} onChange={(v) => { if (String(v).trimStart().startsWith('-')) return; setHomeInsurance(v); }} useCommas suffix="/mo" small hint={`${fmt2((parseFloat(homeInsurance) || 0) * 12)}/yr`} />
              )}
              {insMode === "rate" && STATE_INS_RATES[pcState] != null && (
                <div style={{ fontSize: 10, color: c.grayLight || c.gray, fontFamily: font, marginTop: 3, lineHeight: 1.4, fontStyle: "italic" }}>
                  * {(window.STATE_LIST||[]).find(s=>s.value===pcState)?.label || pcState} single family home avg ≈ {STATE_INS_RATES[pcState]}%{
                    (() => {
                      const propMult = INS_PROP_MULTIPLIERS[propType] || 1.00;
                      const occMult = INS_OCC_MULTIPLIERS[occupancy] || 1.00;
                      const combined = propMult * occMult;
                      if (combined === 1.00) return null;
                      const adj = parseFloat((STATE_INS_RATES[pcState] * combined).toFixed(2));
                      const notes = [];
                      if (propType === "condo") notes.push("condo — HOA covers structure");
                      else if (propType === "townhome") notes.push("townhome");
                      else if (propType === "duplex") notes.push("duplex");
                      else if (propType === "3plex") notes.push("3-plex");
                      else if (propType === "4plex") notes.push("4-plex");
                      if (occupancy === "investment") notes.push("investment property");
                      else if (occupancy === "vacation") notes.push("vacation home");
                      return ` → ${adj}% (${notes.join(", ")})`;
                    })()
                  } — varies by home age & carrier. Override as needed.
                </div>
              )}
            </div>
            <LabeledInput label="HOA Dues (monthly)" prefix="$" value={hoaDues} onChange={(v) => { if (String(v).trimStart().startsWith('-')) return; setHoaDues(v); }} suffix="/mo" small />
          </SectionCard>

          {/* MORTGAGE INSURANCE — separate section below T&I */}
          {showMISection && (
            <div style={{ marginTop: 16 }}>
              <SectionCard title={miSectionTitle} accent={miSectionAccent}>
                {/* VA — no monthly MI */}
                {loanProgram === "va" && (
                  <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.text || c.navy, fontFamily: font, marginBottom: 2 }}>VA — No Monthly MI</div>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font }}>
                      {vaExempt === "true" ? "Disability exempt — no funding fee or monthly MI" : "No monthly mortgage insurance required"}
                    </div>
                  </div>
                )}
                {/* FHA annual MIP summary */}
                {loanProgram === "fha" && (
                  <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.text || c.navy, fontFamily: font, marginBottom: 2 }}>FHA Mortgage Insurance</div>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font }}>
                      {calc.fhaMipRatePct.toFixed(2)}% annual = {fmt2(calc.monthlyFhaMip)}/mo
                    </div>
                  </div>
                )}
                {/* USDA annual fee summary */}
                {loanProgram === "usda" && (
                  <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.text || c.navy, fontFamily: font, marginBottom: 2 }}>USDA Annual Fee</div>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font }}>0.35% annual = {fmt2(calc.monthlyUsdaFee)}/mo</div>
                  </div>
                )}
                {/* Conventional PMI */}
                {(loanProgram === "conventional" || loanProgram === "") && calc.ltv > 80 && (() => {
                  const isConv = loanProgram === "conventional";
                  const userObj = (() => { try { const u = localStorage.getItem("mtk_app_user"); return u ? JSON.parse(u) : null; } catch { return null; } })();
                  const isInt = userObj?.isInternal === true;
                  return (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.text || c.navy, fontFamily: font }}>Private Mortgage Insurance</span>
                        {isConv && (
                          <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${c.border}` }}>
                            {[{ v: true, l: "Auto" }, { v: false, l: "Manual" }].map(o => (
                              <button key={String(o.v)} onClick={() => setPmiAuto(o.v)} style={{ padding: "2px 10px", fontSize: 10, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: pmiAuto === o.v ? c.blue : "transparent", color: pmiAuto === o.v ? "#fff" : c.gray, transition: "all 0.15s" }}>{o.l}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      {isConv && pmiAuto && (
                        <LabeledInput label="FICO Score" value={ficoScore} onChange={setFicoScore} small hint={pmiInfo ? `Bucket: ${parseInt(ficoScore) >= 760 ? "760+" : parseInt(ficoScore) >= 740 ? "740-759" : parseInt(ficoScore) >= 720 ? "720-739" : parseInt(ficoScore) >= 700 ? "700-719" : parseInt(ficoScore) >= 680 ? "680-699" : parseInt(ficoScore) >= 660 ? "660-679" : parseInt(ficoScore) >= 640 ? "640-659" : "620-639"} · Coverage: ${pmiInfo.coverage}%` : "Enter borrower FICO"} />
                      )}
                      {(!isConv || !pmiAuto) ? (
                        <LabeledInput label="PMI Rate" value={pmiRate} onChange={setPmiRate} suffix="% annual" small hint={`${fmt2(calc.monthlyPMI)}/mo · Removed at 80% LTV`} />
                      ) : (
                        <div style={{ fontSize: 12, fontFamily: font, color: c.textSecondary || c.gray, marginTop: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span>Rate: <strong style={{ color: c.text || c.navy, fontSize: 14 }}>{pmiRate}%</strong> annual</span>
                            <span style={{ fontSize: 11 }}>{fmt2(calc.monthlyPMI)}/mo</span>
                          </div>
                          {pmiInfo && <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>LTV {calc.ltv.toFixed(1)}% · {pmiInfo.tier} · Base {(pmiInfo.baseRate * 100).toFixed(2)}%{pmiInfo.totalAdj !== 0 ? ` · Adj ${pmiInfo.totalAdj > 0 ? "+" : ""}${(pmiInfo.totalAdj * 100).toFixed(2)}%` : ""}</div>}
                          <div style={{ fontSize: 10, marginTop: 2, opacity: 0.6 }}>Auto-cancels at 78% LTV (HPA) · Request removal at 80%</div>
                        </div>
                      )}
                      {isInt && isConv && pmiAuto && pmiInfo && (() => {
                        const hp = parseFloat(homePrice) || 0;
                        const la = parseFloat(loanAmount) || 0;
                        const ltv = hp > 0 ? (la / hp) * 100 : 0;
                        const fico = parseInt(ficoScore) || 740;
                        const termYrs = parseInt(term) || 30;
                        const enactR = lookupPMICompany("enact", { ltv, fico, termYears: termYrs });
                        const essentR = lookupPMICompany("essent", { ltv, fico, termYears: termYrs });
                        return (
                          <div style={{ marginTop: 10, padding: 8, background: c.bg || "#fff", borderRadius: 8, border: `1px dashed ${c.border}` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: c.blue, fontFamily: font, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>🔒 Internal — PMI Company Comparison</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                              <div style={{ padding: 6, borderRadius: 6, background: c.bgAlt || "#f5f5f5", textAlign: "center" }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: c.textSecondary || c.gray, fontFamily: font }}>Enact MI</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: enactR !== null ? c.green : c.gray, fontFamily: font }}>{enactR !== null ? `${(enactR * 100).toFixed(2)}%` : "N/A"}</div>
                                {enactR !== null && <div style={{ fontSize: 10, color: c.textSecondary || c.gray }}>{fmt2(la * enactR / 12)}/mo</div>}
                              </div>
                              <div style={{ padding: 6, borderRadius: 6, background: c.bgAlt || "#f5f5f5", textAlign: "center" }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: c.textSecondary || c.gray, fontFamily: font }}>Essent MI</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: essentR !== null ? c.green : c.gray, fontFamily: font }}>{essentR !== null ? `${(essentR * 100).toFixed(2)}%` : "N/A"}</div>
                                {essentR !== null && <div style={{ fontSize: 10, color: c.textSecondary || c.gray }}>{fmt2(la * essentR / 12)}/mo</div>}
                              </div>
                            </div>
                            {enactR !== null && essentR !== null && (
                              <div style={{ fontSize: 10, textAlign: "center", marginTop: 4, color: c.textSecondary || c.gray, fontFamily: font }}>
                                Savings: {fmt2(Math.abs((enactR - essentR) * la / 12))}/mo with {enactR < essentR ? "Enact" : essentR < enactR ? "Essent" : "either"}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </SectionCard>
            </div>
          )}
        </div>
      </div>
      {loanType === "arm" && (
        <div style={{ background: c.bgAlt || c.goldLight, border: `1px solid ${c.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy, fontFamily: font, marginBottom: 8 }}>⚠️ ARM Payment Scenario</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, fontFamily: font, color: c.textSecondary || c.gray }}>
            <span>Initial: <strong style={{ color: c.green }}>{fmt2(calc.monthlyPI)}/mo</strong> for {armFixedYears} years</span>
            <span>Worst-case: <strong style={{ color: c.red }}>{fmt2(calc.worstPI)}/mo</strong> (rate up to {calc.worstRate?.toFixed(2)}%)</span>
            <span>Increase: <strong style={{ color: c.gold }}>{fmt2(calc.worstPI - calc.monthlyPI)}/mo</strong></span>
          </div>
        </div>
      )}
      <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <MetricCard label="Total Interest" value={fmt(calc.totalInterest)} sublabel={loanType === "heloc" ? `Over ${(parseFloat(helocDrawYears)||10)+(parseFloat(helocRepayYears)||20)} years` : `Over ${term} years`} />
        <MetricCard label="Total Cost" value={fmt(calc.totalInterest + calc.la)} sublabel="Principal + Interest" />
        {loanType !== "heloc" && <MetricCard label="LTV" value={`${calc.ltv.toFixed(1)}%`} sublabel={
          loanProgram === "va"   ? "No MI (VA)" :
          loanProgram === "usda" ? "USDA Annual Fee" :
          loanProgram === "fha"  ? "FHA MIP Required" :
          calc.ltv > 80          ? "PMI Required" : "No PMI"
        } positive={calc.ltv <= 80 || loanProgram === "va"} />}
        <MetricCard label="P&I per $1K" value={fmt2(calc.monthlyPI / (calc.la / 1000))} sublabel={loanType === "io" ? "IO payment factor" : "Payment factor"} />
      </div>
      {amortYears.length > 1 && (
        <SectionCard title="LOAN VISUALIZATIONS" accent={c.blue}>
          {/* Appreciation rate — standalone input at top */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, padding: "10px 14px", background: c.bgAlt, borderRadius: 8, border: `1px solid ${c.border}` }}>
            <div style={{ flex: 1 }}>
              <LabeledInput label="Appreciation Rate" value={pcAppr} onChange={setPcAppr} suffix="% / yr" small hint={STATE_APPR_RATES[pcState] != null ? `${pcState} avg ≈ ${STATE_APPR_RATES[pcState]}% · Based on U.S. government home price data (5-yr avg) · Edit to override` : "Annual home value growth for equity projection"} />
            </div>
          </div>

          {/* Equity projection chart — first */}
          {equityTimeline.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.gray, fontFamily: font, marginBottom: 8, letterSpacing: "0.05em" }}>PROJECTED EQUITY CURVE ({pcAppr}% APPRECIATION)</div>
              <EquityProjectionChart timeline={equityTimeline} milestones={equityMilestones} />
            </div>
          )}

          {/* Balance paydown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.gray, fontFamily: font, marginBottom: 8, letterSpacing: "0.05em" }}>BALANCE PAYDOWN</div>
            <BalanceCurveChart years={amortYears} />
          </div>

          {/* Principal vs Interest by year */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c.gray, fontFamily: font, marginBottom: 8, letterSpacing: "0.05em" }}>PRINCIPAL vs INTEREST BY YEAR</div>
            <PIStackedBarChart years={amortYears} />
          </div>
        </SectionCard>
      )}
    </div>
  );
}

window.PaymentCalculator = PaymentCalculator;
