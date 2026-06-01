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
const isHoliday      = window.isHoliday;
const getHolidayName = window.getHolidayName;
const useWarnings         = window.useWarnings;
const WarningBanner       = window.WarningBanner;
const fetchWarningRules   = window.fetchWarningRules;
const InfoTip = window.InfoTip;

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
            <div style={{ fontSize: 12, color: c.gray, fontFamily: font }}>{m.label}</div>
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

function PaymentCalculator({ isInternal, user }) {
  const isAdmin = user?.role === "admin";
  const c = useThemeColors();
  const [loanAmount, setLoanAmount] = useLocalStorage("pc_la", "350000");
  const [homePrice, setHomePrice] = useLocalStorage("pc_hp", "437500");
  const [valBasis,      setValBasis]      = useLocalStorage("pc_val_basis",   "");
  const [valConfidence, setValConfidence] = useLocalStorage("pc_val_conf",    "");
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
  const [loanType, setLoanType] = useLocalStorage("pc_lt", "fixed");
  const [purpose, setPurpose] = useLocalStorage("pc_purpose", "purchase");
  const [loanProgram, setLoanProgram] = useLocalStorage("pc_prog", "conventional");
  const [renovationProg, setRenovationProg] = useLocalStorage("pc_reno", "none");
  const [occupancy, setOccupancy] = useLocalStorage("pc_occ", "primary");
  const [armFixedYears, setArmFixedYears] = useLocalStorage("pc_armfy", "5");
  const [armCap, setArmCap] = useLocalStorage("pc_armcap", "2");
  const [armLifeCap, setArmLifeCap] = useLocalStorage("pc_armlc", "5");
  const [armMargin, setArmMargin] = useLocalStorage("pc_armmg", "2.75");
  const [ioPeriod, setIoPeriod] = useLocalStorage("pc_iop", "10");
  const [helocDrawYears, setHelocDrawYears] = useLocalStorage("pc_hedy", "10");
  const [helocRepayYears, setHelocRepayYears] = useLocalStorage("pc_hery", "20");
  // Refi: Structure — shared keys with RefinanceAnalyzer
  const [raCashOut, setRaCashOut] = useLocalStorage("ra_coa", "0");
  // Refi: Structure 2 — loan sizing worksheet
  const [rs2Balance,     setRs2Balance]     = useLocalStorage("ra_cb",            ""); // shared with RA Current Loan Balance
  const [rs2LastPmtDate, setRs2LastPmtDate] = useLocalStorage("ra_lastpmt",       ""); // shared with RA + Escrows
  const [rs2PerDiem,     setRs2PerDiem]     = useLocalStorage("pc_rs2_perdiem",   "");
  const [rs2NetEscrow,   setRs2NetEscrow]   = useLocalStorage("ra_escbal",        ""); // synced with Current Escrow Balance in ESCROWS section
  // Read fee sheet totals published by FeeSheetGenerator
  const [fsMcCc]        = useLocalStorage("fs_mc_cc",          "0");
  const [fsMcPrepaids]  = useLocalStorage("fs_mc_prepaids",    "0");
  const [fsMcEscrowDep] = useLocalStorage("fs_mc_escrow_dep",  null);
  const [rollInCosts, setRollInCosts] = useLocalStorage("ra_ric", "all");
  const [rollInAmount, setRollInAmount] = useLocalStorage("ra_ria", "");
  const [principalBuydown, setPrincipalBuydown] = useLocalStorage("ra_pbd", "");
  const [raEstPayoff] = useLocalStorage("ra_est_payoff", "");
  const [raCostsDue] = useLocalStorage("ra_costs_due", "");
  const [raRolledInAmt] = useLocalStorage("ra_rolled_in_amt", "");
  const [raFirstPmtDate] = useLocalStorage("ra_first_pmt_date", "");
  const [raHasSecondMtg] = useLocalStorage("ra_has2nd", false);
  const [raSecondBalance] = useLocalStorage("ra_2bal", "45000");
  const [raEscBal, setRaEscBal] = useLocalStorage("ra_escbal", "");
  const [raNetEsc, setRaNetEsc] = useLocalStorage("ra_netesc", false);
  const [fsInsRenew, setFsInsRenew] = useLocalStorage("fs_ins_renew", ""); // shared with FeeSheet + RA
  const [collect90Ins, setCollect90Ins] = useLocalStorage("pc_collect_90_ins", true);
  const [existEscrowMo, setExistEscrowMo] = useLocalStorage("pc_exist_esc_mo", "");
  const [existingMI, setExistingMI] = useLocalStorage("ra_cpmi", ""); // synced with RA Existing Monthly MI
  const [waiveEscrows, setWaiveEscrows] = useLocalStorage("fs_waive_esc", false); // shared with FeeSheetGenerator
  const [raTexasA6, setRaTexasA6] = useLocalStorage("ra_texas_a6", false);
  const [newClosingDate, setNewClosingDate] = useLocalStorage("fs_closing_date", "");
  const [pcState, setPcState] = useLocalStorage("pc_state", "TX");
  // Loan Balance & Payoff section — shared RA keys
  const [raCurRate]       = useLocalStorage("ra_cr",       "7.25");
  const [raCurTerm]       = useLocalStorage("ra_cto",      "30");
  const [raOrigLoanAmt]   = useLocalStorage("ra_ola",      "");
  const [raNoteDate]      = useLocalStorage("ra_notedate", "");
  const [raOccupancy]     = useLocalStorage("ra_occ",      "primary");
  const [raStateLS]       = useLocalStorage("ra_state",    "TX");
  const [pmtUnchecked,  setPmtUnchecked]  = useLocalStorage("ra_pmt_unchecked",  "[]");
  const [pmtSmartSeed,  setPmtSmartSeed]  = useLocalStorage("ra_pmt_smart_seed", "");
  const [propType, setPropType] = useLocalStorage("pc_proptype", "sfr");
  const homesteadExemption = pcState === "TX" && occupancy === "primary";
  const isCustomTerm = !PRESET_TERMS_PC.includes(term);

  // VA / FHA / USDA upfront & monthly fee state
  const [vaFirstUse, setVaFirstUse]         = useLocalStorage("pc_va_first",  "true");
  const [vaExempt, setVaExempt]             = useLocalStorage("pc_va_exempt", "false");
  const [vaServiceType, setVaServiceType]   = useLocalStorage("pc_va_svc",    "active");
  const [vaDisabilityPct, setVaDisabilityPct] = useLocalStorage("pc_va_dis",  "0");
  const [fhaMipAuto, setFhaMipAuto] = useLocalStorage("pc_fha_mipauto", "true");
  const [fhaMipOverride, setFhaMipOverride] = useLocalStorage("pc_fha_mip", "0.55");
  const [upfrontMode] = useLocalStorage("pc_upfront_mode", "rolled_in");
  const [monthlyMiOvr, setMonthlyMiOvr] = useLocalStorage("pc_monthly_mi_ovr", "");
  const [upfrontMiOvr, setUpfrontMiOvr] = useLocalStorage("pc_upfront_mi_ovr", "");

  // DPA program
  const [dpaProgram, setDpaProgram] = useLocalStorage("pc_dpa_prog",  "none");
  const [dpaAmount,  setDpaAmount]  = useLocalStorage("pc_dpa_amt",   "");
  const [dpaType,    setDpaType]    = useLocalStorage("pc_dpa_type",  "grant");
  const [dpaMode,    setDpaMode]    = useLocalStorage("pc_dpa_mode",  "pct");   // "pct" | "dollar"
  const [dpaPct,     setDpaPct]     = useLocalStorage("pc_dpa_pct",   "");

  // MI — borrower count, co-borrower FICO, premium type
  const [borrowerCount, setBorrowerCount] = useLocalStorage("pc_borrowers", "1");
  const [coBorroFico,  setCoBorroFico]    = useLocalStorage("pc_cofico",   "740");
  const [b3Fico,       setB3Fico]         = useLocalStorage("pc_b3fico",   "740");
  const [b4Fico,       setB4Fico]         = useLocalStorage("pc_b4fico",   "740");
  const [miPremiumType, setMiPremiumType] = useLocalStorage("pc_mitype",   "monthly");
  const [dtiBackRatio]                    = useLocalStorage("dti_back_ratio", "0");

  // Custom warning rules fetched from Supabase
  const [customWarnRules, setCustomWarnRules] = useState([]);
  useEffect(() => {
    if (!fetchWarningRules) return;
    fetchWarningRules().then(({ data }) => { if (data) setCustomWarnRules(data); });
  }, []);

  // Piggyback / 2nd Lien
  const [s2Enabled, setS2Enabled] = useLocalStorage("pc_2nd_enabled", "false");
  const [s2Rate,    setS2Rate]    = useLocalStorage("pc_2nd_rate",    "");
  const [s2Term,    setS2Term]    = useLocalStorage("pc_2nd_term",    "");
  const [s2Amt,     setS2Amt]     = useLocalStorage("pc_2nd_amt",     "");
  const [s2Mode,    setS2Mode]    = useLocalStorage("pc_2nd_mode",    "pct"); // "pct" | "dollar"

  // Derived MI factors — used in both the PMI useEffect and the calc useMemo
  const qualifyingFico = (() => {
    const scores = [parseInt(ficoScore) || 740];
    if (borrowerCount !== "1") scores.push(parseInt(coBorroFico) || 740);
    if (parseInt(borrowerCount) >= 3) scores.push(parseInt(b3Fico) || 740);
    if (parseInt(borrowerCount) >= 4) scores.push(parseInt(b4Fico) || 740);
    return Math.min(...scores);
  })();
  const dtiBack      = parseFloat(dtiBackRatio) || 0;
  const highDTI      = dtiBack > 45;
  const isMultiBorr  = borrowerCount !== "1";

  // Program type helpers — HomeReady/HFA/DPA programs behave like conventional for fees
  const CONV_PROGRAMS    = ["conventional","homeready","homeposs","hfa_fannie","hfa_freddie","jumbo","nonqm",""];
  const REDUCED_MI_PROGS = ["homeready","homeposs","hfa_fannie","hfa_freddie"];
  const isConvType    = CONV_PROGRAMS.includes(loanProgram);
  const useReducedMI  = REDUCED_MI_PROGS.includes(loanProgram);
  // DPA program may also add reducedMI when paired with conventional
  const dpaDef        = (window.DPA_PROGRAMS || []).find(p => p.id === dpaProgram) || { reducedMI: false, dpa: false };
  const useReducedMIFinal = useReducedMI || (isConvType && dpaDef.reducedMI);

  const syncDown = (hp, dp) => {
    const h = parseFloat(hp) || 0;
    const d = parseFloat(dp) || 0;
    setLoanAmount(String(Math.round(h * (1 - d / 100))));
  };

  // One-time migration: convert any saved dollar-mode 2nd lien amount to pct
  useEffect(() => {
    if (s2Mode === "dollar") {
      const hp = parseFloat(homePrice) || 0;
      const dollarAmt = parseFloat(s2Amt) || 0;
      if (hp > 0 && dollarAmt > 0) {
        setS2Amt(String(parseFloat((dollarAmt / hp * 100).toFixed(3))));
      } else {
        setS2Amt("");
      }
      setS2Mode("pct");
    }
  }, []); // run once on mount

  useEffect(() => {
    if (!pmiAuto || !isConvType || loanProgram === "jumbo" || loanType === "heloc") { setPmiInfo(null); return; }
    const hp = parseFloat(homePrice) || 0;
    const la = parseFloat(loanAmount) || 0;
    const ltv = hp > 0 ? (la / hp) * 100 : 0;
    if (ltv <= 80) { setPmiInfo(null); setPmiRate(""); return; }
    const termYrs = parseInt(term) || 30;
    const isFixed = loanType === "fixed";
    const isCashOut = purpose === "cashOutRefi";
    const result = lookupPMI({ ltv, fico: qualifyingFico, termYears: termYrs, occupancy, isFixed, isCashOut, isMultiBorrower: isMultiBorr, highDTI, reducedCoverage: useReducedMIFinal });
    // Use cheapest actual company rate (Enact vs Essent) — overrides generic table
    const compParams = { ltv, fico: qualifyingFico, termYears: termYrs, isMultiBorrower: isMultiBorr, highDTI, isCashOut, occupancy, reducedCoverage: useReducedMIFinal };
    const enactR  = lookupPMICompany("enact",  compParams);
    const essentR = lookupPMICompany("essent", compParams);
    let cheapestRate = null;
    if (enactR !== null && essentR !== null) cheapestRate = Math.min(enactR, essentR);
    else if (enactR !== null) cheapestRate = enactR;
    else if (essentR !== null) cheapestRate = essentR;
    if (cheapestRate !== null) {
      setPmiRate(String((cheapestRate * 100).toFixed(2)));
      setPmiInfo(result.rate !== null ? { ...result, rate: cheapestRate } : null);
    } else if (result.rate !== null) {
      setPmiRate(String((result.rate * 100).toFixed(2)));
      setPmiInfo(result);
    } else { setPmiInfo(null); }
  }, [pmiAuto, homePrice, loanAmount, ficoScore, coBorroFico, b3Fico, b4Fico, borrowerCount, term, loanType, loanProgram, purpose, occupancy, dtiBackRatio, dpaProgram]);

  // FHA, USDA, and VA require owner-occupied — enforce automatically
  useEffect(() => {
    if ((loanProgram === "fha" || loanProgram === "usda" || loanProgram === "va") && occupancy !== "primary") {
      setOccupancy("primary");
    }
  }, [loanProgram]);

  // Waive Escrows is not allowed for gov loans or LTV > 90%
  useEffect(() => {
    if (!waiveEscrows) return;
    const govLoan = loanProgram === "va" || loanProgram === "fha" || loanProgram === "usda";
    const hp = parseFloat(homePrice) || 0;
    const la = parseFloat(loanAmount) || 0;
    const highLtv = hp > 0 && (la / hp) * 100 > 90;
    if (govLoan || highLtv) setWaiveEscrows(false);
  }, [loanProgram, homePrice, loanAmount, waiveEscrows]);

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
  const [pcAppr, setPcAppr] = useLocalStorage("pc_appr", "3");
  const apprStateInitRef = React.useRef(true);
  useEffect(() => {
    if (apprStateInitRef.current) { apprStateInitRef.current = false; return; }
    const defaultRate = STATE_APPR_RATES[pcState];
    if (defaultRate != null) setPcAppr(String(defaultRate));
  }, [pcState]);

  useEffect(() => {
    window.dispatchEvent(new Event("mtk_values_changed"));
  }, [homePrice, loanAmount, rate, propertyTaxRate, homeInsuranceRate, taxMode, insMode, propertyTax, homeInsurance, downPaymentPct, pmiRate, ficoScore, homesteadExemption, pcState]);

  // Notify RA when refi structure fields change so its analysis stays in sync
  useEffect(() => {
    window.dispatchEvent(new Event("mtk_propagated"));
  }, [raCashOut, rollInCosts, rollInAmount, principalBuydown]);

  // pc_rs2_amount_due is published further below, after lbpEstimatedPayoff is computed.

  // When DPA mode is "pct", keep pc_dpa_amt in sync with the computed dollar value
  useEffect(() => {
    if (dpaMode !== "pct") return;
    const pct = parseFloat(dpaPct) || 0;
    const la  = parseFloat(loanAmount) || 0;
    const dollar = (pct > 0 && la > 0) ? String(Math.round(pct / 100 * la)) : "";
    setDpaAmount(dollar);
  }, [dpaMode, dpaPct, loanAmount]);

  // Format interest rate on blur: 2 decimals normally, 3 if user typed a third (e.g. 6.125)
  const handleRateBlur = () => {
    const n = parseFloat(rate);
    if (isNaN(n)) return;
    const str = String(rate).trim();
    const dotIdx = str.indexOf(".");
    const decimals = dotIdx === -1 ? 0 : str.length - dotIdx - 1;
    const formatted = decimals === 3 ? n.toFixed(3) : n.toFixed(2);
    if (formatted !== rate) setRate(formatted);
  };

  // ── Loan Balance & Payoff computed values (mirrors RefinanceAnalyzer logic) ──
  const todayForLBP = new Date();
  const defaultLastPmtLBP = todayForLBP.getFullYear() + "-" + String(todayForLBP.getMonth() + 1).padStart(2, "0") + "-01";

  const lbpMonthsPaid = useMemo(() => {
    if (!raNoteDate) return 0;
    const nd = new Date(raNoteDate + "T00:00:00");
    const now = new Date();
    const firstPmtYear  = nd.getMonth() + 2 > 11 ? nd.getFullYear() + 1 : nd.getFullYear();
    const firstPmtMonth = (nd.getMonth() + 2) % 12;
    const pmtsMade = (now.getFullYear() - firstPmtYear) * 12 + (now.getMonth() - firstPmtMonth);
    return Math.max(0, pmtsMade);
  }, [raNoteDate]);

  const lbpEstimatedBalance = useMemo(() => {
    const cb = parseFloat(String(rs2Balance).replace(/,/g, "")) || 0;
    const ola = parseFloat(String(raOrigLoanAmt).replace(/,/g, "")) || 0;
    const cr  = (parseFloat(raCurRate) || 0) / 100 / 12;
    const cTermOrig = (parseFloat(raCurTerm) || 30) * 12;
    if (!ola || !cr || !cTermOrig) return 0;
    const origPI = window.pmt ? window.pmt(cr, cTermOrig, ola) : 0;
    let bal = ola;
    for (let m = 0; m < lbpMonthsPaid; m++) {
      const interest = bal * cr;
      const princ = origPI - interest;
      bal = Math.max(0, bal - princ);
    }
    return bal;
  }, [rs2Balance, raOrigLoanAmt, raCurRate, raCurTerm, lbpMonthsPaid]);

  const lbpFundingInfo = useMemo(() => {
    const base = newClosingDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const isTXHomestead = raStateLS === "TX" && raOccupancy === "primary";
    if (!isTXHomestead) return { date: base, holidays: [], isTXRescission: false };
    const p = base.split("-");
    let d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    let added = 0;
    const skippedHolidays = [];
    while (added < 3) {
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      if (d.getDay() === 0) continue;
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if (isHoliday && isHoliday(iso, d.getFullYear())) {
        const name = getHolidayName ? getHolidayName(iso, d.getFullYear()) : "Federal Holiday";
        skippedHolidays.push({ iso, name });
        continue;
      }
      added++;
    }
    return { date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`, holidays: skippedHolidays, isTXRescission: true };
  }, [newClosingDate, raStateLS, raOccupancy]);

  const lbpFundingDate   = lbpFundingInfo.date;
  const lbpEffectiveFunding = lbpFundingDate;

  const lbpLastPmt = rs2LastPmtDate || defaultLastPmtLBP;

  const lbpAutoPaymentDates = useMemo(() => {
    if (!lbpLastPmt || !lbpEffectiveFunding) return [];
    const last = new Date(lbpLastPmt + "T12:00:00");
    const fund = new Date(lbpEffectiveFunding + "T12:00:00");
    const dates = [];
    let d = new Date(last.getFullYear(), last.getMonth() + 1, 1);
    while (d < fund) {
      dates.push(d.toISOString().slice(0, 10));
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return dates;
  }, [lbpLastPmt, lbpEffectiveFunding]);

  const lbpUncheckedSet = useMemo(() => {
    try { return new Set(JSON.parse(pmtUnchecked)); } catch { return new Set(); }
  }, [pmtUnchecked]);

  const lbpCheckedPayments = useMemo(() =>
    lbpAutoPaymentDates.filter(d => !lbpUncheckedSet.has(d)),
  [lbpAutoPaymentDates, lbpUncheckedSet]);

  function lbpTogglePayment(dateStr) {
    const next = new Set(lbpUncheckedSet);
    if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
    setPmtUnchecked(JSON.stringify([...next].filter(d => lbpAutoPaymentDates.includes(d))));
  }

  const lbpPaymentProjection = useMemo(() => {
    const cb = parseFloat(String(rs2Balance).replace(/,/g, "")) || 0;
    const r  = (parseFloat(raCurRate) || 0) / 100 / 12;
    const remaining = Math.max(1, (parseFloat(raCurTerm) || 30) * 12 - lbpMonthsPaid);
    const monthlyPmt = (cb > 0 && r > 0)
      ? (window.pmt ? window.pmt(r, remaining, cb) : cb * r / (1 - Math.pow(1 + r, -remaining)))
      : 0;
    const escMo  = parseFloat(String(existEscrowMo).replace(/,/g, "")) || 0;
    const escBal = parseFloat(String(raEscBal).replace(/,/g, ""))      || 0;
    let bal = cb, esc = escBal;
    const rows = [];
    for (const dateStr of lbpCheckedPayments) {
      const interest  = bal * r;
      const principal = r > 0 ? Math.max(0, monthlyPmt - interest) : 0;
      bal = Math.max(0, bal - principal);
      esc += escMo;
      rows.push({ date: dateStr, balance: Math.round(bal), escrow: Math.round(esc),
                  principal: Math.round(principal), interest: Math.round(interest) });
    }
    const effectiveLastPmtDate = lbpCheckedPayments.length > 0
      ? lbpCheckedPayments[lbpCheckedPayments.length - 1]
      : lbpLastPmt;
    return { projectedBalance: Math.round(bal), projectedEscrow: Math.round(esc), effectiveLastPmtDate, rows };
  }, [rs2Balance, raCurRate, raCurTerm, lbpMonthsPaid, existEscrowMo, raEscBal, lbpCheckedPayments, lbpLastPmt]);

  const lbpPayoffDays = useMemo(() => {
    const payoffDate = lbpEffectiveFunding
      ? new Date(lbpEffectiveFunding + "T00:00:00")
      : (() => { const d = new Date(); d.setDate(d.getDate() + 33); return d; })();
    const refDate = lbpPaymentProjection.effectiveLastPmtDate || lbpLastPmt;
    if (refDate) {
      const lp   = new Date(refDate + "T00:00:00");
      const days = Math.ceil((payoffDate.getTime() - lp.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) return days;
    }
    return payoffDate.getDate();
  }, [lbpPaymentProjection.effectiveLastPmtDate, lbpLastPmt, lbpEffectiveFunding]);

  const lbpEstimatedPayoff = useMemo(() => {
    const cb = parseFloat(String(rs2Balance).replace(/,/g, "")) || 0;
    if (!cb) return 0;
    const balAtFunding = lbpPaymentProjection.rows.length > 0 ? lbpPaymentProjection.projectedBalance : cb;
    const netEscrowAmt = raNetEsc ? (parseFloat(String(rs2NetEscrow).replace(/,/g, "")) || 0) : 0;
    const dailyRate = (parseFloat(raCurRate) || 0) / 100 / 365;
    const perDiem = balAtFunding * dailyRate * lbpPayoffDays;
    const fundingDay = lbpEffectiveFunding ? parseInt(lbpEffectiveFunding.split("-")[2]) : 0;
    const closingMo = lbpAutoPaymentDates.length > 0 ? lbpAutoPaymentDates[lbpAutoPaymentDates.length - 1] : null;
    const lateFee = fundingDay > 15 && closingMo && lbpUncheckedSet.has(closingMo) ? 100 : 0;
    return Math.round(balAtFunding - netEscrowAmt + perDiem + 150 + lateFee);
  }, [rs2Balance, lbpPaymentProjection, raNetEsc, rs2NetEscrow, raCurRate, lbpPayoffDays,
      lbpEffectiveFunding, lbpAutoPaymentDates, lbpUncheckedSet]);

  // Publish correct estimated payoff to shared keys — Fee Sheet reads pc_rs2_amount_due,
  // Refi Analysis reads ra_est_payoff.
  useEffect(() => {
    if (purpose === "purchase") return;
    const val = lbpEstimatedPayoff > 0 ? lbpEstimatedPayoff : "";
    try {
      localStorage.setItem("mtk_pc_rs2_amount_due", JSON.stringify(String(val)));
      localStorage.setItem("mtk_ra_est_payoff",     JSON.stringify(String(val)));
      window.dispatchEvent(new Event("mtk_propagated"));
    } catch {}
  }, [purpose, lbpEstimatedPayoff]);

  // Auto-default closing-month payment to unchecked when funding ≤ 10th
  useEffect(() => {
    if (!lbpAutoPaymentDates.length || !lbpEffectiveFunding) return;
    const day = parseInt(lbpEffectiveFunding.split('-')[2]);
    const closingMonthDate = lbpAutoPaymentDates[lbpAutoPaymentDates.length - 1];
    if (day >= 1 && day <= 10) {
      if (pmtSmartSeed !== closingMonthDate) {
        const next = new Set(lbpUncheckedSet);
        next.add(closingMonthDate);
        setPmtUnchecked(JSON.stringify([...next].filter(d => lbpAutoPaymentDates.includes(d))));
        setPmtSmartSeed(closingMonthDate);
      }
    } else {
      if (pmtSmartSeed && pmtSmartSeed === closingMonthDate) {
        const next = new Set(lbpUncheckedSet);
        next.delete(pmtSmartSeed);
        setPmtUnchecked(JSON.stringify([...next].filter(d => lbpAutoPaymentDates.includes(d))));
        setPmtSmartSeed("");
      }
    }
  }, [lbpEffectiveFunding, lbpAutoPaymentDates.join(",")]); // eslint-disable-line

  const calc = useMemo(() => {
    const baseLA = parseFloat(loanAmount) || 0;
    const hp = parseFloat(homePrice) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const annualRate = (parseFloat(rate) || 0);
    const termYrs = parseInt(term) || 30;
    const n = loanType === "heloc" ? ((parseFloat(helocDrawYears) || 10) + (parseFloat(helocRepayYears) || 20)) * 12 : termYrs * 12;
    const dp = parseFloat(downPaymentPct) || 0;
    const taxBasis = homesteadExemption ? hp * 0.70 : hp;
    const monthlyTaxInput = parseFloat(propertyTax) || 0;
    const annualTax = taxMode === "rate" ? taxBasis * ((parseFloat(propertyTaxRate) || 0) / 100) : monthlyTaxInput * 12;
    const monthlyTaxRaw = taxMode === "rate" ? annualTax / 12 : monthlyTaxInput;
    const monthlyTax = taxMode === "rate" ? Math.round(monthlyTaxRaw / 50) * 50 : monthlyTaxRaw;
    const monthlyInsInput = parseFloat(homeInsurance) || 0;
    const annualIns = insMode === "rate" ? hp * ((parseFloat(homeInsuranceRate) || 0) / 100) : monthlyInsInput * 12;
    const monthlyInsRaw = insMode === "rate" ? annualIns / 12 : monthlyInsInput;
    const monthlyIns = insMode === "rate" ? Math.round(monthlyInsRaw / 50) * 50 : monthlyInsRaw;
    // ── Piggyback early — needed for 1st-lien LTV/PMI calc ───────────────────
    const s2On  = s2Enabled === "true";
    const s2LA  = s2On ? Math.round(hp * (parseFloat(s2Amt) || 0) / 100) : 0;
    const firstLA = baseLA;

    const ltv = hp > 0 ? (firstLA / hp * 100) : 0;

    // ── MI Premium Type & qualifying factors ──────────────────────────────
    const qualFico = (() => {
      const scores = [parseInt(ficoScore) || 740];
      if (borrowerCount !== "1") scores.push(parseInt(coBorroFico) || 740);
      if (parseInt(borrowerCount) >= 3) scores.push(parseInt(b3Fico) || 740);
      if (parseInt(borrowerCount) >= 4) scores.push(parseInt(b4Fico) || 740);
      return Math.min(...scores);
    })();
    const isConvPMI_base = CONV_PROGRAMS.includes(loanProgram) && loanProgram !== "jumbo" && ltv > 80;
    // LPMI: no monthly MI, rate bumped up
    const lpmiAdjPct = (miPremiumType === "lpmi" && isConvPMI_base)
      ? (ltv > 95 ? 0.500 : ltv > 90 ? 0.375 : ltv > 85 ? 0.250 : 0.125)
      : 0;
    const rForPI = r + (lpmiAdjPct / 100 / 12);
    // Single / Split: upfront premium (financed)
    const singlePremRate = (miPremiumType === "single" && isConvPMI_base && window.lookupSinglePremium)
      ? (window.lookupSinglePremium({ ltv, fico: qualFico, termYears: termYrs }) || 0)
      : 0;
    const convSingleAmt   = Math.round(baseLA * singlePremRate);
    const splitUpfrontAmt = (miPremiumType === "split" && isConvPMI_base) ? Math.round(baseLA * 0.005) : 0;
    const convUpfrontPremium = convSingleAmt + splitUpfrontAmt;

    // ── Upfront fees rolled into funded loan amount ──
    const vaDisNum     = parseInt(vaDisabilityPct) || 0;
    const vaExemptBool = vaExempt === "true" || (loanProgram === "va" && vaDisNum >= 10);
    const vaFirstBool  = vaFirstUse === "true";
    const is100PctDisabledTX = loanProgram === "va" && vaDisNum === 100 && pcState === "TX" && occupancy === "primary";
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
    const upfrontFee    = vaFundingFee + fhaUfmip + usdaUpfront + convUpfrontPremium;
    const la            = upfrontMode === "paid_closing" ? firstLA : firstLA + upfrontFee;

    // ── Monthly mortgage insurance ──
    const fhaMipRatePct = (() => {
      if (loanProgram !== "fha") return 0;
      if (fhaMipAuto !== "true") return parseFloat(fhaMipOverride) || 0.55;
      // HUD Mortgagee Letter 2023-05 (effective March 20, 2023)
      const hiBalance = baseLA > 726200;
      if (termYrs <= 15) {
        if (hiBalance) return ltv > 90 ? 0.65 : 0.40;
        return ltv > 90 ? 0.40 : 0.15;
      }
      // > 15 years
      if (hiBalance) return ltv > 95 ? 0.75 : 0.70;
      return ltv > 95 ? 0.55 : 0.50;
    })();
    const monthlyFhaMip  = loanProgram === "fha"  ? (baseLA * fhaMipRatePct / 100) / 12 : 0;
    const monthlyUsdaFee = loanProgram === "usda" ? (baseLA * 0.35 / 100) / 12          : 0;
    const isConvPMI      = isConvPMI_base && miPremiumType !== "lpmi" && miPremiumType !== "single";
    // Use pmiInfo.rate directly when in auto mode — avoids stale pmiRate localStorage desync
    const effPmiPct      = (pmiAuto && pmiInfo && pmiInfo.rate != null)
                           ? pmiInfo.rate * 100
                           : (parseFloat(pmiRate) || 0);
    const monthlyPMI     = !isConvPMI ? 0
                         : miPremiumType === "split"
                           ? (la * effPmiPct / 100) / 12 * 0.60
                           : (la * effPmiPct / 100) / 12;
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
      const rEff    = (miPremiumType === "lpmi" && isConvPMI_base) ? rForPI : r;
      monthlyPI     = pmt(rEff, n, la);
      totalInterest = (monthlyPI * n) - la;
    }

    const effectiveMonthlyTax = is100PctDisabledTX ? 0 : monthlyTax;

    // ── Piggyback / 2nd Lien — P&I calc (s2On + s2LA already computed above) ──
    const s2R   = (parseFloat(s2Rate) || 0) / 100 / 12;
    const s2N   = (s2Term === "balloon" ? 30 : (parseFloat(s2Term) || 20)) * 12;
    const s2PI  = (s2On && s2R > 0 && s2LA > 0)
      ? Math.round(s2LA * s2R * Math.pow(1 + s2R, s2N) / (Math.pow(1 + s2R, s2N) - 1))
      : 0;

    const totalMonthly = monthlyPI + effectiveMonthlyTax + monthlyIns + monthlyMI + s2PI;

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

    // ── LO overrides (applied after all auto calcs) ───────────────────────
    const _monthlyMiOvr  = parseFloat(monthlyMiOvr)  || 0;
    const _upfrontMiOvr  = parseFloat(upfrontMiOvr)  || 0;
    const effMonthlyMI   = _monthlyMiOvr  > 0 ? _monthlyMiOvr  : monthlyMI;
    const effUpfrontFee  = _upfrontMiOvr  > 0 ? _upfrontMiOvr  : upfrontFee;
    const effTotal       = monthlyPI + effectiveMonthlyTax + monthlyIns + effMonthlyMI;

    return {
      noRate: !rate || parseFloat(rate) === 0,
      monthlyPI, monthlyTax: effectiveMonthlyTax, monthlyIns, monthlyPMI: effMonthlyMI,
      totalMonthly: effTotal, totalInterest, ltv, la, baseLA, n, loanType,
      upfrontFee: effUpfrontFee, vaFundingFee, vaFeeRate, fhaUfmip, usdaUpfront,
      fhaMipRatePct, monthlyFhaMip, monthlyUsdaFee, monthlyMI: effMonthlyMI, isConvPMI,
      autoMonthlyMI: monthlyMI, autoUpfrontFee: upfrontFee,
      apr, aprFees,
      qualFico, lpmiAdjPct, singlePremRate, convSingleAmt, splitUpfrontAmt, convUpfrontPremium,
      vaExemptBool, vaDisNum, is100PctDisabledTX,
      s2On, s2LA, s2PI, effPmiPct,
      ...extraInfo,
    };
  }, [loanAmount, homePrice, rate, term, propertyTax, homeInsurance, propertyTaxRate, homeInsuranceRate, taxMode, insMode, downPaymentPct, pmiRate, pmiAuto, pmiInfo, loanType, armFixedYears, armCap, armLifeCap, armMargin, ioPeriod, helocDrawYears, helocRepayYears, pcState, occupancy, loanProgram, purpose, vaFirstUse, vaExempt, vaServiceType, vaDisabilityPct, fhaMipAuto, fhaMipOverride,
    borrowerCount, coBorroFico, b3Fico, b4Fico, miPremiumType, dtiBackRatio, ficoScore, dpaProgram,
    fsOrigPct, fsDpPts, fsOvUw, fsDefUw, fsOvProc, fsDefProc, fsOvFlood, fsDefFlood, fsOvTaxsvc, fsDefTaxsvc, fsOvDocprep, fsDefDocprep, fsState,
    s2Enabled, s2Rate, s2Term, s2Amt, s2Mode, upfrontMode, monthlyMiOvr, upfrontMiOvr]);

  // ── Write authoritative monthly MI to a dedicated key ────────────────────
  // Must live AFTER the calc useMemo so calc is defined when the dep array runs.
  // Uses pc_eff_mi (not dti_pmi) so propagation.js can never overwrite it.
  // Handles auto-PMI lookup rate, FHA MIP, USDA fee, and split/LPMI/single premiums
  // — cases where propagation.js simple formula diverges from what we display.
  useEffect(() => {
    try {
      localStorage.setItem("mtk_pc_eff_mi",  JSON.stringify(String(Math.round(calc.monthlyPMI  || 0))));
      localStorage.setItem("mtk_pc_eff_tax", JSON.stringify(String(Math.round(calc.monthlyTax  || 0))));
      localStorage.setItem("mtk_pc_eff_ins", JSON.stringify(String(Math.round(calc.monthlyIns  || 0))));
      window.dispatchEvent(new Event("mtk_propagated"));
    } catch {}
  }, [calc.monthlyPMI, calc.monthlyTax, calc.monthlyIns]);

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
    // 2nd lien — track in parallel so total balance is correct
    const s2la = calc.s2On ? calc.s2LA : 0;
    const s2r  = calc.s2On ? (parseFloat(s2Rate) || 0) / 100 / 12 : 0;
    const s2isBalloon = s2Term === "balloon";
    const s2termYrs = calc.s2On ? (s2isBalloon ? 30 : (parseInt(s2Term) || 20)) : 0;
    const s2monthly = (s2la > 0 && s2r > 0 && s2termYrs > 0) ? pmt(s2r, s2termYrs * 12, s2la) : 0;
    let s2balance = s2la;
    const timeline = [];
    for (let y = 0; y < termYrs; y++) {
      for (let m = 0; m < 12 && balance > 0.005; m++) {
        const intPmt = balance * r;
        const prinPmt = Math.min(monthlyPI - intPmt, balance);
        balance = Math.max(0, balance - prinPmt);
        if (s2balance > 0.005 && s2monthly > 0 && s2r > 0) {
          const s2int  = s2balance * s2r;
          const s2prin = Math.min(s2monthly - s2int, s2balance);
          s2balance = Math.max(0, s2balance - s2prin);
        }
      }
      // Balloon: 2nd lien is paid off at year 15 (balloon due), remove from equity calc going forward
      if (s2isBalloon && y + 1 >= 15) s2balance = 0;
      const homeValue = hp * Math.pow(1 + appr, y + 1);
      const totalBalance = balance + s2balance;
      const equity = homeValue - totalBalance;
      const equityPct = homeValue > 0 ? equity / homeValue * 100 : 0;
      timeline.push({ year: y + 1, homeValue, balance: totalBalance, equity, equityPct });
      if (balance <= 0.005) break;
    }
    return timeline;
  }, [calc.la, calc.s2On, calc.s2LA, homePrice, rate, term, loanType, pcAppr, s2Rate, s2Term]);

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

  // Build yearly amortization data for 2nd lien charts
  const s2AmortYears = useMemo(() => {
    if (s2Enabled !== "true") return [];
    const la = calc.s2LA;
    const r  = (parseFloat(s2Rate) || 0) / 100 / 12;
    const isBalloon = s2Term === "balloon";
    const amortYrs  = isBalloon ? 30 : (parseInt(s2Term) || 20); // amortize over this many years
    const displayYrs = isBalloon ? 15 : amortYrs;                // show this many years in charts
    if (la <= 0 || r <= 0 || amortYrs <= 0) return [];
    const monthlyPI = pmt(r, amortYrs * 12, la);
    let balance = la;
    const years = [];
    let cumulInt = 0;
    for (let y = 0; y < displayYrs; y++) {
      let yPrin = 0, yInt = 0;
      for (let m = 0; m < 12 && balance > 0.005; m++) {
        const intPmt = balance * r;
        let prinPmt = monthlyPI - intPmt;
        if (prinPmt > balance) prinPmt = balance;
        balance = Math.max(0, balance - prinPmt);
        yPrin += prinPmt;
        yInt  += intPmt;
      }
      cumulInt += yInt;
      const isBalloonYear = isBalloon && y === displayYrs - 1;
      years.push({
        year: y + 1,
        principal: yPrin,
        interest: yInt,
        totalPayment: yPrin + yInt,
        endBalance: balance,
        totalInterest: cumulInt,
        ...(isBalloonYear ? { balloonBalance: Math.round(balance) } : {}),
      });
      if (!isBalloon && balance <= 0.005) break;
    }
    return years;
  }, [s2Enabled, calc.s2LA, s2Rate, s2Term]);

  const miLabel = loanProgram === "fha" ? "FHA MIP" : loanProgram === "usda" ? "USDA Annual Fee" : "PMI";
  const pieData = [
    { label: calc.s2PI > 0 ? "1st Lien P&I" : "Principal & Interest", value: calc.monthlyPI, color: c.navy },
    ...(calc.s2PI > 0 ? [{ label: "2nd Lien P&I", value: calc.s2PI, color: "#f97316" }] : []),
    { label: "Property Tax", value: calc.monthlyTax, color: c.blue },
    { label: "Home Insurance", value: calc.monthlyIns, color: c.green },
    ...(calc.monthlyMI > 0 ? [{ label: miLabel, value: calc.monthlyMI, color: c.gold }] : []),
  ].filter(d => d.value > 0);

  const total = pieData.reduce((s, d) => s + d.value, 0);

  const loanTypeLabel = loanType === "arm" ? `ARM ${armFixedYears}/1` : loanType === "io" ? "Interest-Only" : loanType === "heloc" ? "HELOC" : "Fixed";
  const PROG_LABELS = { conventional:"CONV", homeready:"HomeReady", homeposs:"Home Possible", hfa_fannie:"HFA Pref", hfa_freddie:"HFA Adv", fha:"FHA", va:"VA", usda:"USDA", jumbo:"Jumbo", nonqm:"Non-QM" };
  const programLabel = PROG_LABELS[loanProgram] || "CONV";
  const occLabel = occupancy === "vacation" ? "Vacation" : occupancy === "investment" ? "Investment" : "Primary";
  const purposeLabel = purpose === "refinance" ? "Refi" : "Purchase";

  const showMISection = loanType !== "heloc" && (
    loanProgram === "va" ||
    loanProgram === "fha" ||
    loanProgram === "usda" ||
    (isConvType && loanProgram !== "jumbo" && calc.ltv > 80)
  );
  const miSectionTitle = loanProgram === "fha" ? "FHA MORTGAGE INSURANCE"
    : loanProgram === "usda" ? "USDA ANNUAL FEE"
    : loanProgram === "va" ? "VA LOAN BENEFIT"
    : useReducedMI ? "PRIVATE MORTGAGE INSURANCE (PMI) — REDUCED COVERAGE"
    : "PRIVATE MORTGAGE INSURANCE (PMI)";
  const miSectionAccent = loanProgram === "va" ? c.green
    : (loanProgram === "fha" || loanProgram === "usda") ? c.gold
    : c.blue;

  const warnState = {
    loanProgram,
    occupancy,
    propType,
    loanAmount: parseFloat(loanAmount) || 0,
    homePrice: parseFloat(homePrice) || 0,
    ltv: calc.ltv || 0,
    fico: qualifyingFico || 0,
    pcState,
    purpose,
  };
  const warnSuppressions = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("mtk_warning_suppressions") || "[]"); }
    catch { return []; }
  }, []);
  const activeWarnings = useWarnings(warnState, warnSuppressions, customWarnRules);

  const extraWarnings = useMemo(() => {
    const warns = [];
    const hp   = parseFloat(homePrice) || 0;
    const dpPct = parseFloat(downPaymentPct) || 0;
    const r    = (parseFloat(rate) || 0) / 100 / 12;
    const n    = (parseInt(term) || 30) * 12;
    const pmtPer1k = (r > 0 && n > 0) ? pmt(r, n, 1000) : 0;

    // ── Warning: 2nd lien present but 1st lien LTV still > 80% (MI not avoided) ──
    if (calc.s2On && calc.ltv > 80 && isConvType && loanProgram !== "jumbo" && hp > 0) {
      const conformingLimit = CONFORMING_LIMITS ? CONFORMING_LIMITS.baseline : 806500;
      const totalLA = calc.baseLA + calc.s2LA;
      const isJumboAvoidance = calc.baseLA <= conformingLimit && totalLA > conformingLimit;
      const baseMsg = `Your 1st lien is at ${calc.ltv.toFixed(1)}% LTV — MI is still being charged despite the piggyback 2nd lien. The objective of a piggyback 2nd lien is to keep the 1st lien below 80% to avoid MI. Consider increasing the 2nd lien amount or down payment to bring the 1st lien to 80% or below.`;
      const jumboNote = isJumboAvoidance
        ? ` (If the goal is also to avoid jumbo pricing, the 2nd lien is working — your 1st lien of ${fmt(calc.baseLA)} stays below the ${fmt(conformingLimit)} conforming limit, though MI still applies at this LTV.)`
        : "";
      warns.push({
        id: "s2_pmi_conflict",
        severity: "warning",
        message: baseMsg + jumboNote,
      });
    }

    // ── Warning: CLTV > 100% ──
    if (hp > 0) {
      const totalLA = calc.baseLA + (calc.s2On ? calc.s2LA : 0);
      const cltv = totalLA / hp * 100;
      if (cltv > 100) {
        warns.push({
          id: "cltv_over_100",
          severity: "error",
          message: `CLTV is ${cltv.toFixed(1)}% — your total loan balance${calc.s2On ? "s" : ""} exceed${calc.s2On ? "" : "s"} the home's purchase price. Lenders require CLTV to be 100% or below. Reduce the loan amount${calc.s2On ? "s" : ""} or increase the down payment to get back under 100%.`,
        });
      }
    }

    // ── Warning: Conv purchase, down payment > 5% but not at a 5% interval ──
    const CONV_WARN = ["conventional", "homeready", "homeposs", "hfa_fannie", "hfa_freddie"];
    const breakpoints = [5, 10, 15, 20];
    const nearBreakpoint = breakpoints.some(bp => Math.abs(dpPct - bp) < 0.5);
    if (
      CONV_WARN.includes(loanProgram) &&
      purpose === "purchase" &&
      hp > 0 && dpPct > 5 && dpPct < 20 &&
      !nearBreakpoint &&
      !calc.s2On   // suppress when piggyback is active (structure is intentional)
    ) {
      const lower = [...breakpoints].reverse().find(bp => bp < dpPct) ?? 5;
      const upper = breakpoints.find(bp => bp > dpPct) ?? 20;
      const cashSaved  = Math.round(hp * (dpPct - lower) / 100);
      const cashNeeded = Math.round(hp * (upper - dpPct) / 100);
      warns.push({
        id: "dp_off_interval",
        severity: "warning",
        message: `Your ${dpPct % 1 === 0 ? dpPct : dpPct.toFixed(1)}% down payment is between PMI and rate pricing tiers — nothing changes between ${lower}% and ${upper}% down. You're in the same tier as ${lower}% down (save ${fmt(cashSaved)} in cash), or you could move up to ${upper}% down (${fmt(cashNeeded)} more) to get a better tier. Every extra $1,000 toward down payment only reduces your payment by ${pmtPer1k > 0 ? fmt2(pmtPer1k) : "—"}/mo.`,
      });
    }

    return warns;
  }, [calc.s2On, calc.ltv, calc.baseLA, calc.s2LA, isConvType, loanProgram, homePrice, downPaymentPct, rate, term, purpose]);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>

          <WarningBanner warnings={[...activeWarnings, ...extraWarnings]} />

          {/* ── PAYMENT SUMMARY ── */}
          <SectionCard title="" accent={c.navy}>
            <div style={{ background: `linear-gradient(135deg, ${c.navy}, ${c.navyLight})`, borderRadius: 12, padding: 24, color: "#fff", marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.5, marginBottom: 4 }}>{purposeLabel.toUpperCase()} · {programLabel} · {loanTypeLabel.toUpperCase()} · {occLabel.toUpperCase()}</div>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 8 }}>
                {loanType === "io" ? "INTEREST-ONLY PAYMENT" : loanType === "heloc" ? "DRAW PERIOD PAYMENT" : "TOTAL MONTHLY PAYMENT"}
              </div>
              {calc.noRate ? (
                <React.Fragment>
                  <div style={{ fontSize: 48, fontWeight: 800, fontFamily: font, lineHeight: 1, opacity: 0.4 }}>--</div>
                  <div style={{ fontSize: 12, marginTop: 8, background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>Enter an interest rate</div>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <div style={{ fontSize: 48, fontWeight: 800, fontFamily: font, lineHeight: 1 }}>{fmt2(calc.totalMonthly)}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                    {loanType === "io" ? `IO for ${ioPeriod}yr, then ${fmt2(calc.amortPI)}/mo P&I` :
                     loanType === "heloc" ? `IO draw ${helocDrawYears}yr, then ${fmt2(calc.repayPI)}/mo repay` :
                     loanType === "arm" ? `Fixed ${armFixedYears}yr, worst-case ${fmt2(calc.worstPI)}/mo after` :
                     `Principal, Interest, Taxes, Insurance${calc.monthlyPMI > 0 ? ", PMI" : ""}`}
                  </div>
                </React.Fragment>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
              <DonutChart
                data={pieData.map(d => ({ value: d.value, color: d.color }))}
                size={150}
                thickness={22}
                centerLabel="MONTHLY"
                centerValue={fmt2(total)}
                centerSub={calc.is100PctDisabledTX ? "TAX WAIVED" : undefined}
                centerSubColor="#16a34a"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
                {pieData.map((d) => (
                  <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: d.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: c.gray, fontWeight: 600, fontFamily: font }}>{d.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy, fontFamily: font }}>{fmt2(d.value)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: c.grayLight, fontFamily: font }}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* ── PROPERTY INFO ── */}
          <SectionCard title="PROPERTY INFO" accent={c.blue}>
            <Select label="State (where the property is located)" value={pcState} onChange={setPcState} options={STATE_LIST.map(s => ({ value: s.value, label: s.label }))} />
            <Select label="Occupancy" value={occupancy} onChange={setOccupancy} options={[
              { value: "", label: "— Select —" },
              { value: "primary", label: "Owner Occupied" },
              { value: "vacation", label: "Vacation Home" },
              { value: "investment", label: "Investment Property" },
            ]} />
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
            <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 6, marginBottom: 14, paddingTop: 14 }} />
            <Select label=""
              value={["homeready","homeposs","hfa_fannie","hfa_freddie"].includes(loanProgram) ? "conventional" : loanProgram}
              onChange={v => {
                setLoanProgram(v);
                if (["va","fha","usda"].includes(v)) setOccupancy("primary");
                if (!["conventional","fha"].includes(v)) setRenovationProg("none");
                if (!["conventional","homeready","homeposs","hfa_fannie","hfa_freddie","nonqm","fha"].includes(v)) setDpaProgram("none");
              }}
              options={[
                { value: "", label: "— Select —" },
                { value: "conventional", label: "Conventional" },
                { value: "fha",          label: "FHA" },
                { value: "nonqm",        label: "Non-QM / Non-Traditional" },
                { value: "usda",         label: "USDA" },
                { value: "va",           label: "VA" },
              ]}
            />
            {/* ── Construction & Renovation overlay — admin only ── */}
            {isAdmin && ["conventional","homeready","homeposs","hfa_fannie","hfa_freddie","fha"].includes(loanProgram) && loanType !== "heloc" && (
              <Select label="Construction & Renovation"
                value={renovationProg === "fha_203k" ? "fha_203k" : ["homeready","homeposs"].includes(loanProgram) ? loanProgram : "none"}
                onChange={v => {
                  if (v === "none") {
                    if (["homeready","homeposs"].includes(loanProgram)) setLoanProgram("conventional");
                    setRenovationProg("none");
                  } else if (v === "homeready") {
                    setLoanProgram("homeready"); setRenovationProg("homeready");
                  } else if (v === "homeposs") {
                    setLoanProgram("homeposs"); setRenovationProg("homeposs");
                  } else if (v === "fha_203k") {
                    if (!["fha"].includes(loanProgram)) setLoanProgram("fha");
                    setRenovationProg("fha_203k");
                  }
                }}
                options={[
                  { value: "none",      label: "— None —" },
                  { value: "fha_203k",  label: "FHA 203k" },
                  { value: "homeready", label: "HomeReady (Fannie Mae)" },
                  { value: "homeposs",  label: "Home Possible (Freddie Mac)" },
                ]}
              />
            )}
            {renovationProg === "fha_203k" && (
              <div style={{ fontSize: 12, color: c.blue, fontFamily: font, marginTop: -4, marginBottom: 4, fontStyle: "italic" }}>
                ℹ️ FHA 203k uses standard FHA rates and MIP. Renovation costs are included in the loan amount.
              </div>
            )}
            {useReducedMI && (
              <div style={{ fontSize: 12, color: c.green, fontFamily: font, marginTop: -4, marginBottom: 4, fontStyle: "italic" }}>
                ✓ Reduced MI coverage (25%) — {loanProgram === "homeready" ? "HomeReady" : loanProgram === "homeposs" ? "Home Possible" : "HFA"} program
              </div>
            )}
            {(() => {
              const la = parseFloat(loanAmount) || 0;
              const conformingLimit = CONFORMING_LIMITS.baseline;
              const fhaLimit = FHA_LIMITS.floor;
              const warnings = [];
              if (isConvType && la > conformingLimit) {
                warnings.push({ color: "#d97706", bg: "#fffbeb", border: "#fcd34d", icon: "⚠️", text: `Loan amount exceeds the conforming limit of ${fmt(conformingLimit)}. This is a Jumbo loan — different rates and guidelines apply.` });
              }
              if (loanProgram === "fha" && la > fhaLimit) {
                warnings.push({ color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", icon: "⚠️", text: `Loan amount may exceed the FHA limit for this county. FHA limits vary by county — confirm with your Loan Officer or check HUD's official lookup tool:`, link: "https://entp.hud.gov/idapp/html/hicostlook.cfm" });
              }
              if (isConvType && la > conformingLimit * 0.95 && la <= conformingLimit) {
                warnings.push({ color: "#2563eb", bg: "#eff6ff", border: "#93c5fd", icon: "ℹ️", text: `Loan amount is within 5% of the conforming limit (${fmt(conformingLimit)}). Consider staying below to avoid jumbo pricing.` });
              }
              if (loanProgram === "fha" && la > fhaLimit * 0.95 && la <= fhaLimit) {
                warnings.push({ color: "#2563eb", bg: "#eff6ff", border: "#93c5fd", icon: "ℹ️", text: `Loan amount is approaching the FHA limit for this area. FHA limits vary by county — verify with your Loan Officer or check HUD's official lookup tool:`, link: "https://entp.hud.gov/idapp/html/hicostlook.cfm" });
              }
              return warnings.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2, marginBottom: 4 }}>
                  {warnings.map((w, i) => (
                    <div key={i} style={{ background: w.bg, border: `1px solid ${w.border}`, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{w.icon}</span>
                      <span style={{ fontSize: 12, color: w.color, fontWeight: 600, fontFamily: font, lineHeight: 1.4 }}>
                        {w.text}
                        {w.link && <> — <a href={w.link} target="_blank" rel="noopener noreferrer" style={{ color: w.color, textDecoration: "underline" }}>{w.link}</a></>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* ── VA Funding Fee panel ── */}
            {loanProgram === "va" && loanType !== "heloc" && (
              <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.blue, fontFamily: font, marginBottom: 8 }}>VA FUNDING FEE</div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginBottom: 4 }}>Service Type</div>
                  <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${c.border}` }}>
                    {[{ v: "active", l: "Active Duty / Veteran" }, { v: "reserves", l: "Reserves / Nat'l Guard" }].map(o => (
                      <button key={o.v} onClick={() => setVaServiceType(o.v)} style={{ flex: 1, padding: "7px 4px", fontSize: 12, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: vaServiceType === o.v ? c.blue : "transparent", color: vaServiceType === o.v ? "#fff" : c.gray, transition: "all 0.2s" }}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginBottom: 4 }}>Usage</div>
                  <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${c.border}` }}>
                    {[{ v: "true", l: "First Use" }, { v: "false", l: "Subsequent Use" }].map(o => (
                      <button key={o.v} onClick={() => setVaFirstUse(o.v)} style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: vaFirstUse === o.v ? c.blue : "transparent", color: vaFirstUse === o.v ? "#fff" : c.gray, transition: "all 0.2s" }}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <Select
                  label="Service-Connected Disability"
                  value={vaDisabilityPct}
                  onChange={setVaDisabilityPct}
                  options={[
                    { value: "0",   label: "None / Not rated" },
                    { value: "10",  label: "10%" },
                    { value: "20",  label: "20%" },
                    { value: "30",  label: "30%" },
                    { value: "40",  label: "40%" },
                    { value: "50",  label: "50%" },
                    { value: "60",  label: "60%" },
                    { value: "70",  label: "70%" },
                    { value: "80",  label: "80%" },
                    { value: "90",  label: "90%" },
                    { value: "100", label: "100% (P&T)" },
                  ]}
                />
                {calc.vaExemptBool && calc.vaDisNum >= 10 && (
                  <div style={{ fontSize: 12, color: c.green, fontFamily: font, marginTop: 4, marginBottom: 4, lineHeight: 1.4 }}>
                    ✓ Funding fee automatically waived — service-connected disability (10%+)
                  </div>
                )}
                {calc.is100PctDisabledTX && (
                  <div style={{ fontSize: 12, color: c.gold, fontFamily: font, marginTop: 4, marginBottom: 4, lineHeight: 1.4, background: c.bg, borderRadius: 6, padding: "5px 8px", border: `1px solid ${c.border}` }}>
                    ★ TX Tax Code §11.131 — 100% disabled veterans receive a full property tax exemption on their primary residence. Property tax set to $0 in this estimate.
                  </div>
                )}
                {loanProgram === "va" && pcState === "TX" && calc.vaDisNum >= 30 && (
                  <div style={{ fontSize: 12, color: c.blue, fontFamily: font, marginTop: 4, marginBottom: 4, lineHeight: 1.4, background: c.bg, borderRadius: 6, padding: "5px 8px", border: `1px solid ${c.border}` }}>
                    ★ Texas Veterans Land Board (VLB) — Veterans with 30%+ service-connected disability may qualify for a 0.50% rate reduction. Ask about the VLB home loan program.
                  </div>
                )}
                <div style={{ marginTop: 8, padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 3 }}>
                    <span style={{ color: c.gray }}>Base Loan Amount</span>
                    <span style={{ color: c.text || c.navy, fontWeight: 600 }}>{fmt(calc.baseLA)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font, marginBottom: 5 }}>
                    <span style={{ color: c.gray }}>VA Funding Fee {!calc.vaExemptBool && `(${(calc.vaFeeRate * 100).toFixed(2)}%)`}</span>
                    <span style={{ color: c.gold, fontWeight: 600 }}>{calc.vaExemptBool ? "Waived" : `+${fmt(calc.vaFundingFee)}`}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontFamily: font, borderTop: `1px solid ${c.border}`, paddingTop: 5 }}>
                    <span style={{ color: c.navy, fontWeight: 700 }}>Funded Loan Amount</span>
                    <span style={{ color: c.navy, fontWeight: 800 }}>{fmt(calc.la)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 6, lineHeight: 1.4 }}>
                  {upfrontMode === "paid_closing" ? "Funding fee paid at closing — not included in loan amount." : "Funding fee is rolled into the loan."} VA loans have <strong>no monthly MI</strong>.
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
                    <span style={{ color: c.gray }}>Upfront Guarantee Fee (1.0%{upfrontMode === "paid_closing" ? " — paid at closing" : " — financed"})</span>
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
            {/* ── Down Payment Assistance (DPA) — admin only ── */}
            {(isConvType || loanProgram === "fha") && loanProgram !== "jumbo" && loanType !== "heloc" && occupancy === "primary" && isAdmin && (() => {
              const dpaOptions = (window.DPA_PROGRAMS || []).filter(p => p.dpa || p.id === "none");
              const activeDpa = (window.DPA_PROGRAMS || []).find(p => p.id === dpaProgram) || { dpa: false };
              const dpaAmt = parseFloat(dpaAmount) || 0;
              return (
                <div style={{ background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c.blue, fontFamily: font, marginBottom: 8 }}>DOWN PAYMENT ASSISTANCE (INTERNAL)</div>
                  <Select label="DPA Program"
                    value={["hfa_fannie","hfa_freddie"].includes(loanProgram) ? loanProgram : dpaProgram}
                    onChange={v => {
                      if (v === "hfa_fannie" || v === "hfa_freddie") {
                        setLoanProgram(v); setDpaProgram("none");
                      } else {
                        if (["hfa_fannie","hfa_freddie"].includes(loanProgram)) setLoanProgram("conventional");
                        setDpaProgram(v);
                      }
                    }}
                    options={[
                      ...dpaOptions.filter(p => p.id === "none").map(p => ({ value: p.id, label: p.label })),
                      ...[
                        { value: "hfa_fannie",  label: "HFA Preferred (Fannie Mae)" },
                        { value: "hfa_freddie", label: "HFA Advantage (Freddie Mac)" },
                        ...dpaOptions.filter(p => p.id !== "none").map(p => ({ value: p.id, label: p.label })),
                      ].sort((a, b) => a.label.localeCompare(b.label)),
                    ]}
                  />
                  {activeDpa.dpa && (() => {
                    const la = parseFloat(loanAmount) || 0;
                    const effectiveDollar = dpaMode === "pct"
                      ? Math.round((parseFloat(dpaPct) || 0) / 100 * la)
                      : dpaAmt;
                    const effectivePct = la > 0 ? (effectiveDollar / la * 100) : 0;
                    return (
                      <>
                        {/* DPA Amount label + % / $ toggle */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: c.gray, fontFamily: font, letterSpacing: "0.05em", textTransform: "uppercase" }}>DPA Amount</span>
                          <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${c.border}` }}>
                            {[{ v: "pct", l: "%" }, { v: "dollar", l: "$" }].map(o => (
                              <button key={o.v} onClick={() => {
                                if (o.v === "dollar" && dpaMode === "pct") {
                                  setDpaAmount(effectiveDollar > 0 ? String(effectiveDollar) : "");
                                }
                                if (o.v === "pct" && dpaMode === "dollar") {
                                  setDpaPct(la > 0 && dpaAmt > 0 ? (dpaAmt / la * 100).toFixed(3) : "");
                                }
                                setDpaMode(o.v);
                              }} style={{
                                padding: "3px 10px", fontSize: 12, fontWeight: 700, fontFamily: font,
                                border: "none", cursor: "pointer",
                                background: dpaMode === o.v ? c.blue : "transparent",
                                color: dpaMode === o.v ? "#fff" : c.gray,
                                transition: "all 0.15s",
                              }}>{o.l}</button>
                            ))}
                          </div>
                        </div>
                        {dpaMode === "pct" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <input
                              type="number" min="0" max="100" step="0.125"
                              value={dpaPct}
                              onChange={e => setDpaPct(e.target.value)}
                              placeholder="0.000"
                              style={{ flex: 1, padding: "10px 12px", border: `1.5px solid ${c.border}`, borderRadius: 8, fontSize: 15, fontWeight: 500, fontFamily: font, color: c.navy, background: c.bg, textAlign: "right", outline: "none" }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 500, color: c.gray, fontFamily: font }}>%</span>
                          </div>
                        ) : (
                          <LabeledInput prefix="$" value={dpaAmount} onChange={setDpaAmount} useCommas />
                        )}
                        {effectiveDollar > 0 && (
                          <div style={{ fontSize: 12, color: c.textSecondary || c.gray, fontFamily: font, marginBottom: 6, paddingLeft: 2 }}>
                            {dpaMode === "pct"
                              ? `= ${fmt(effectiveDollar)} of ${fmt(la)} loan`
                              : `${effectivePct.toFixed(3)}% of loan`}
                          </div>
                        )}
                        <Select label="DPA Type" value={dpaType} onChange={setDpaType} options={[
                          { value: "grant",      label: "Grant (no repayment)" },
                          { value: "forgivable", label: "Forgivable 2nd Lien" },
                          { value: "deferred",   label: "Deferred 2nd Lien (0% / due on sale)" },
                        ]} />
                        {effectiveDollar > 0 && (
                          <div style={{ fontSize: 12, color: c.green, fontFamily: font, marginTop: 4, padding: "6px 8px", background: c.greenLight || "#e8f5ee", borderRadius: 6 }}>
                            {dpaType === "grant" ? `Grant: ${fmt(effectiveDollar)} covers down payment — no repayment required.` : dpaType === "forgivable" ? `Forgivable 2nd lien of ${fmt(effectiveDollar)} — forgiven over time.` : `Deferred 2nd lien of ${fmt(effectiveDollar)} — 0% interest, due on sale/refi.`}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {activeDpa.reducedMI && !useReducedMI && (
                    <div style={{ fontSize: 12, color: c.green, fontFamily: font, marginTop: 6, fontStyle: "italic" }}>
                      ✓ {activeDpa.label} uses reduced MI coverage (25%) when paired with a conventional first mortgage.
                    </div>
                  )}
                </div>
              );
            })()}
          </SectionCard>

          {/* ── PROPERTY INFO ── */}
          {purpose !== "refinance" && <SectionCard title="PROPERTY INFO" accent={c.navy}>
            {loanType !== "heloc" && purpose !== "refinance" && <LabeledInput label="Purchase Price" prefix="$" value={homePrice} onChange={(v) => { if (parseFloat(String(v).replace(/,/g, '')) > 99999999) return; setHomePrice(v); if (purpose === "purchase") syncDown(v, downPaymentPct); }} useCommas infoTip="The agreed-upon sale price of the home. For a refinance, use the current appraised value. This drives your loan-to-value ratio (LTV), which affects your interest rate, PMI requirement, and loan program eligibility." />}
            {loanType !== "heloc" && purpose !== "purchase" && purpose !== "refinance" && <Select label="Value Based On" value={valBasis} onChange={setValBasis} options={[
              { value: "", label: "— Select —" },
              { value: "guess", label: "Homeowner's Estimate" },
              { value: "realtor", label: "Realtor's Opinion" },
              { value: "cad", label: "CAD Tax Value" },
              { value: "online", label: "Online Data (Zillow, Realtor.com, etc.)" },
              { value: "appraisal", label: "Current Appraisal" },
              { value: "placeholder", label: "Temp: Place Holder Estimate" },
            ]} />}
            {loanType !== "heloc" && purpose === "purchase" && (() => {
              const hp = parseFloat(homePrice) || 0;
              const dpPct = parseFloat(downPaymentPct) || 0;
              const laNum2 = parseFloat(loanAmount) || 0;
              const dpDollar = hp > 0 && laNum2 > 0 ? Math.round(hp - laNum2) : Math.round(hp * dpPct / 100);
              const inputStyle = { flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontSize: 15, fontWeight: 500, color: c.text || c.navy, fontFamily: font, width: "100%", minWidth: 0 };
              const wrapStyle = { display: "flex", alignItems: "center", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, overflow: "hidden", flex: 1 };
              return (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, marginBottom: 5, fontFamily: font }}>Down Payment</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={wrapStyle}>
                      <input type="text" inputMode="decimal" value={downPaymentPct}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (String(v).trimStart().startsWith('-') || parseFloat(v) > 100) return;
                          setDownPaymentPct(v);
                          syncDown(homePrice, v);
                        }}
                        style={inputStyle} />
                      <span style={{ padding: "10px 12px 10px 0", color: c.gray, fontSize: 13, fontWeight: 500, fontFamily: font }}>%</span>
                    </div>
                    <div style={wrapStyle}>
                      <span style={{ padding: "10px 0 10px 12px", color: c.navy, fontWeight: 600, fontSize: 15, fontFamily: font }}>$</span>
                      <input type="text" inputMode="numeric"
                        key={dpDollar}
                        defaultValue={dpDollar ? addCommasLocal(String(Math.round(dpDollar))) : ""}
                        onBlur={(e) => {
                          const v = stripCommasLocal(e.target.value);
                          if (String(v).trimStart().startsWith('-')) return;
                          const hp2 = parseFloat(homePrice) || 0;
                          const d = parseFloat(v) || 0;
                          const cappedD = hp2 > 0 ? Math.min(d, hp2) : d;
                          const newPct = hp2 > 0 ? String(parseFloat((cappedD / hp2 * 100).toFixed(3))) : "0";
                          setDownPaymentPct(newPct);
                          setLoanAmount(String(Math.round(hp2 - cappedD)));
                        }}
                        style={inputStyle} />
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* Loan Amount — read-only for purchase, hidden for refi */}
            {purpose === "purchase" && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, fontFamily: font, display: "block", marginBottom: 5 }}>
                  {loanType === "heloc" ? "Credit Line Amount" : "Loan Amount"}
                </span>
                <div style={{ padding: "10px 14px", background: c.bgAlt || "#faf9f7", border: `1px solid ${c.border}`, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: c.navy, fontFamily: font }}>{fmt(calc.la)}</span>
                  <span style={{ fontSize: 12, color: c.gray, fontFamily: font, fontStyle: "italic" }}>auto-calculated</span>
                </div>
                {calc.upfrontFee > 0 && (
                  <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 3 }}>
                    {upfrontMode === "paid_closing"
                      ? `${loanProgram === "va" ? "VA funding fee" : loanProgram === "fha" ? "FHA UFMIP" : loanProgram === "usda" ? "USDA guarantee fee" : "Upfront fee"} (${fmt(calc.upfrontFee)}) — paid at closing`
                      : `Base ${fmt(calc.baseLA)} + ${fmt(calc.upfrontFee)} ${loanProgram === "va" ? "VA funding fee" : loanProgram === "fha" ? "FHA UFMIP" : loanProgram === "usda" ? "USDA guarantee fee" : "financed fee"} (financed)`
                    }
                  </div>
                )}
                {(() => {
                  const rpp = (parseFloat(rate) || 0) / 100 / 12;
                  const la  = calc.la || 0;
                  const n   = (parseFloat(term) || 30) * 12;
                  if (rpp <= 0 || la <= 0 || n <= 0) return null;
                  const per5k = Math.round(pmt(rpp, n, 5000));
                  return (
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 6 }}>
                      FYI: Every $5,000 financed ≈ <strong style={{ color: c.navy }}>${per5k}/mo</strong>
                    </div>
                  );
                })()}
              </div>
            )}
            {purpose === "purchase" && (() => {
              const dp = parseFloat(downPaymentPct) || 0;
              const dpWarnings = [];
              if (loanProgram === "fha" && dp < 3.5)
                dpWarnings.push({ text: "FHA typically requires a minimum of 3.5% down. Please check with your Loan Officer to confirm eligibility." });
              if (isConvType && loanProgram !== "jumbo" && dp < 3)
                dpWarnings.push({ text: "Conventional loans typically require a minimum of 3% down. Please check with your Loan Officer to confirm eligibility." });
              if (loanProgram === "jumbo" && dp < 10)
                dpWarnings.push({ text: "Jumbo loans typically require a minimum of 10% down. Please check with your Loan Officer to confirm eligibility." });
              if (occupancy === "investment" && dp < 10)
                dpWarnings.push({ text: "Investment properties typically require a minimum of 10% down. This scenario may not be available — please check with your Loan Officer." });
              return dpWarnings.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, marginBottom: 2 }}>
                  {dpWarnings.map((w, i) => (
                    <div key={i} style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>⚠️</span>
                      <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600, fontFamily: font, lineHeight: 1.4 }}>{w.text}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </SectionCard>}

          {/* ── LOAN TERMS ── */}
          <SectionCard title="LOAN TERMS" accent={c.navy}>
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
                  }} suffix="years" hint="Enter 1–30 years" />
                )}
              </>
            )}
            {loanType === "arm" && (
              <div style={{ background: c.bgAlt || c.blueLight, borderRadius: 8, padding: 12, marginTop: 4, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.blue, marginBottom: 8, fontFamily: font }}>ARM PARAMETERS</div>
                <Select label="Fixed Period" value={armFixedYears} onChange={setArmFixedYears} options={[
                  { value: "3", label: "3 Years" }, { value: "5", label: "5 Years" },
                  { value: "7", label: "7 Years" }, { value: "10", label: "10 Years" },
                ]} />
                <LabeledInput label="Adjustment Cap" value={armCap} onChange={setArmCap} suffix="%" hint="Max rate change per adjustment" />
                <LabeledInput label="Lifetime Cap" value={armLifeCap} onChange={setArmLifeCap} suffix="%" hint="Max total rate increase over life" />
                <LabeledInput label="Margin" value={armMargin} onChange={setArmMargin} suffix="%" hint="Added to index rate at adjustment" />
              </div>
            )}
            {loanType === "io" && (
              <div style={{ background: c.bgAlt || c.blueLight, borderRadius: 8, padding: 12, marginTop: 4, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.blue, marginBottom: 8, fontFamily: font }}>INTEREST-ONLY PERIOD</div>
                <Select label="IO Period" value={ioPeriod} onChange={setIoPeriod} options={[
                  { value: "5", label: "5 Years" }, { value: "7", label: "7 Years" },
                  { value: "10", label: "10 Years" },
                ]} />
                <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 4 }}>After {ioPeriod} years, payments become fully amortizing for the remaining {(parseFloat(term) || 30) - (parseFloat(ioPeriod) || 10)} years.</div>
              </div>
            )}
            {loanType === "heloc" && (
              <div style={{ background: c.bgAlt || c.blueLight, borderRadius: 8, padding: 12, marginTop: 4, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.blue, marginBottom: 8, fontFamily: font }}>HELOC TERMS</div>
                <Select label="Draw Period" value={helocDrawYears} onChange={setHelocDrawYears} options={[
                  { value: "5", label: "5 Years" }, { value: "10", label: "10 Years" },
                  { value: "15", label: "15 Years" },
                ]} />
                <Select label="Repayment Period" value={helocRepayYears} onChange={setHelocRepayYears} options={[
                  { value: "10", label: "10 Years" }, { value: "15", label: "15 Years" },
                  { value: "20", label: "20 Years" },
                ]} />
                <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 4 }}>Interest-only during draw period, then fully amortizing during repayment.</div>
              </div>
            )}
            <LabeledInput label="Interest Rate" value={rate} onChange={(v) => { if (!/^(\d*\.?\d*)$/.test(String(v))) return; setRate(v); }} onBlur={handleRateBlur} suffix="%" type="text" infoTip="Your annual mortgage interest rate — not to be confused with APR, which includes fees. Even a 0.125% difference in rate can meaningfully change your monthly payment and total interest paid over the life of the loan." />
            {calc.apr > 0 && calc.apr !== (parseFloat(rate) || 0) && (
              <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: -4, marginBottom: 6, paddingLeft: 2 }}>
                APR {calc.apr.toFixed((() => { const s = String(rate || "").trim(); const d = s.indexOf("."); return d === -1 ? 2 : Math.max(2, s.length - d - 1); })())}%
                <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.7 }}>(based on Fee Sheet charges)</span>
              </div>
            )}
            {(() => {
              const r  = (parseFloat(rate) || 0) / 100 / 12;
              const la = calc.la || 0;
              const n  = (parseFloat(term) || 30) * 12;
              if (r <= 0 || la <= 0 || n <= 0) return null;
              const bump = Math.round(pmt((parseFloat(rate) + 0.125) / 100 / 12, n, la) - pmt(r, n, la));
              return (
                <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 2, paddingLeft: 2 }}>
                  FYI: A 0.125% rate change ≈ <strong style={{ color: c.navy }}>${bump}/mo</strong> on this loan
                </div>
              );
            })()}
          </SectionCard>

          {/* ── PIGGYBACK / 2ND LIEN ── */}
          <div data-sc-body style={{ background: c.white, borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 16, overflow: "hidden" }}>
            <div
              onClick={() => setS2Enabled(s2Enabled === "true" ? "false" : "true")}
              style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderBottom: s2Enabled === "true" ? `1px solid ${c.border}` : "none" }}
            >
              <div style={{ width: 4, height: 18, borderRadius: 2, background: c.navy, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy, fontFamily: font }}>PIGGYBACK / 2ND LIEN</div>
                {s2Enabled === "false" && s2Amt && (() => {
                  const hp = parseFloat(homePrice) || 0;
                  const dollarAmt = hp > 0 ? Math.round(hp * (parseFloat(s2Amt) || 0) / 100) : 0;
                  if (!dollarAmt) return null;
                  return (
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.gray, fontFamily: font, background: c.border, borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
                      Paused ({fmt(dollarAmt)})
                    </span>
                  );
                })()}
              </div>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: s2Enabled === "true" ? c.blue : c.border, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 2, left: s2Enabled === "true" ? 18 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            </div>
            {s2Enabled === "true" && (
              <div style={{ padding: 18 }}>
                <Select label="2nd Lien Term" value={s2Term} onChange={setS2Term} options={[
                  { value: "", label: "— Select —" },
                  { value: "balloon", label: "30/15 Balloon" },
                  { value: "30", label: "30 Years" },
                  { value: "20", label: "20 Years" },
                  { value: "15", label: "15 Years" },
                  { value: "10", label: "10 Years" },
                ]} />
                {s2Term === "balloon" && (
                  <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                    Amortized over 30 yrs · Full balance due at Month 180 (Year 15)
                  </div>
                )}
                {/* 2nd Lien Amount — dual % and $ fields (mirrors Down Payment) */}
                {(() => {
                  const hp = parseFloat(homePrice) || 0;
                  const s2Pct = parseFloat(s2Amt) || 0;
                  const s2Dollar = hp > 0 ? Math.round(hp * s2Pct / 100) : 0;
                  const inputStyle = { flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontSize: 15, fontWeight: 500, color: c.text || c.navy, fontFamily: font, width: "100%", minWidth: 0 };
                  const wrapStyle = { display: "flex", alignItems: "center", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, overflow: "hidden", flex: 1 };
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, marginBottom: 5, fontFamily: font }}>2nd Lien Amount</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={wrapStyle}>
                          <input type="text" inputMode="decimal" value={s2Amt}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (parseFloat(v) > 100) return;
                              setS2Amt(v);
                            }}
                            style={inputStyle} />
                          <span style={{ padding: "10px 12px 10px 0", color: c.gray, fontSize: 13, fontWeight: 500, fontFamily: font }}>%</span>
                        </div>
                        <div style={wrapStyle}>
                          <span style={{ padding: "10px 0 10px 12px", color: c.navy, fontWeight: 600, fontSize: 15, fontFamily: font }}>$</span>
                          <input type="text" inputMode="numeric"
                            key={s2Dollar}
                            defaultValue={s2Dollar > 0 ? addCommasLocal(String(s2Dollar)) : ""}
                            onBlur={(e) => {
                              const v = stripCommasLocal(e.target.value);
                              const d = parseFloat(v) || 0;
                              if (hp > 0) {
                                const newPct = parseFloat((Math.min(d, hp) / hp * 100).toFixed(4));
                                setS2Amt(String(newPct));
                              }
                            }}
                            placeholder={hp === 0 ? "Enter price first" : "0"}
                            disabled={hp === 0}
                            style={{ ...inputStyle, color: hp === 0 ? (c.gray) : (c.text || c.navy) }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <LabeledInput label="2nd Lien Rate" value={s2Rate} onChange={setS2Rate} suffix="%" step="0.125"
                  onBlur={v => {
                    const n = parseFloat(v);
                    if (!v || isNaN(n)) return;
                    const currentDecimals = (v.split(".")[1] || "").length;
                    setS2Rate(n.toFixed(Math.max(1, Math.min(3, currentDecimals))));
                  }}
                />
                {/* Summary */}
                <div style={{ marginTop: 8, padding: "10px 14px", background: c.bgAlt || "#faf9f7", borderRadius: 8, border: `1px solid ${c.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: c.gray, fontFamily: font }}>2nd Lien Balance</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.navy, fontFamily: font }}>{fmt(calc.s2LA)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: c.gray, fontFamily: font }}>2nd Lien Monthly P&I</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#f97316", fontFamily: font }}>{calc.s2PI > 0 ? fmt2(calc.s2PI) : "—"}</span>
                  </div>
                  {s2Term === "balloon" && (() => {
                    const bb = s2AmortYears.length > 0 ? (s2AmortYears[s2AmortYears.length - 1].balloonBalance || 0) : 0;
                    if (bb <= 0) return null;
                    return (
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${c.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#C0392B", fontFamily: font }}>⚠ Balloon Due Month 180</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#C0392B", fontFamily: font }}>{fmt(bb)}</span>
                        </div>
                      </div>
                    );
                  })()}
                  {calc.s2PI > 0 && calc.s2LA > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.gray, fontFamily: font }}>Combined 1st + 2nd P&I</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: c.navy, fontFamily: font }}>{fmt2(calc.monthlyPI + calc.s2PI)}</span>
                      </div>
                      {/* Weighted blended rate */}
                      {(() => {
                        const la1 = calc.la;
                        const r1  = parseFloat(rate) || 0;
                        const la2 = calc.s2LA;
                        const r2  = parseFloat(s2Rate) || 0;
                        const tot = la1 + la2;
                        if (tot <= 0 || r1 <= 0 || r2 <= 0) return null;
                        const blended = (la1 * r1 + la2 * r2) / tot;
                        return (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: c.gray, fontFamily: font }}>Weighted Blended Rate</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: c.navy, fontFamily: font }}>{blended.toFixed(3)}%</span>
                            </div>
                            <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 4, lineHeight: 1.55 }}>
                              One effective rate across both liens — each loan's rate is weighted by its balance relative to the total. Use this to compare your piggyback structure against a single loan offered at one rate.
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                {calc.s2LA > 0 && (parseFloat(homePrice) || 0) > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: c.gray, fontFamily: font, fontStyle: "italic" }}>
                    {(() => {
                      const hp = parseFloat(homePrice) || 1;
                      const firstPct = Math.round(calc.baseLA / hp * 100);
                      const s2Pct    = Math.round(calc.s2LA  / hp * 100);
                      const dpPct    = Math.max(0, Math.round((hp - calc.baseLA - calc.s2LA) / hp * 100));
                      return `Structure: ${firstPct}% / ${s2Pct}% / ${dpPct}%  (1st / 2nd / down)`;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── CREDIT PROFILE ── */}
          <SectionCard title="CREDIT PROFILE" accent={c.navy}>
            <Select label="Number of Borrowers" value={borrowerCount} onChange={setBorrowerCount} options={[
              { value: "1", label: "1 Borrower" },
              { value: "2", label: "2 Borrowers" },
              { value: "3", label: "3 Borrowers" },
              { value: "4", label: "4 Borrowers" },
            ]} />
            <LabeledInput
              label={borrowerCount !== "1" ? "Borrower 1 FICO" : "FICO Score"}
              value={ficoScore}
              onChange={v => setFicoScore(v.replace(/[^0-9]/g, ''))}
              onBlur={() => { const n = parseInt(ficoScore); if (!isNaN(n)) setFicoScore(String(Math.min(900, Math.max(400, n)))); }}
              hint={`Bucket: ${qualifyingFico >= 760 ? "760+" : qualifyingFico >= 740 ? "740–759" : qualifyingFico >= 720 ? "720–739" : qualifyingFico >= 700 ? "700–719" : qualifyingFico >= 680 ? "680–699" : qualifyingFico >= 660 ? "660–679" : qualifyingFico >= 640 ? "640–659" : "620–639"}${pmiInfo ? " · PMI coverage: " + pmiInfo.coverage + "%" : ""}`}
              infoTip="Your middle credit score from the three bureaus (Equifax, Experian, TransUnion). This is one of the biggest factors in determining your interest rate and PMI rate. On a joint application, lenders use the lower of the qualifying scores."
            />
            {borrowerCount !== "1" && (
              <>
                <LabeledInput label="Borrower 2 FICO" value={coBorroFico}
                  onChange={v => setCoBorroFico(v.replace(/[^0-9]/g, ''))}
                  onBlur={() => { const n = parseInt(coBorroFico); if (!isNaN(n)) setCoBorroFico(String(Math.min(900, Math.max(400, n)))); }}
                  />
                {parseInt(borrowerCount) >= 3 && (
                  <LabeledInput label="Borrower 3 FICO" value={b3Fico}
                    onChange={v => setB3Fico(v.replace(/[^0-9]/g, ''))}
                    onBlur={() => { const n = parseInt(b3Fico); if (!isNaN(n)) setB3Fico(String(Math.min(900, Math.max(400, n)))); }}
                    />
                )}
                {parseInt(borrowerCount) >= 4 && (
                  <LabeledInput label="Borrower 4 FICO" value={b4Fico}
                    onChange={v => setB4Fico(v.replace(/[^0-9]/g, ''))}
                    onBlur={() => { const n = parseInt(b4Fico); if (!isNaN(n)) setB4Fico(String(Math.min(900, Math.max(400, n)))); }}
                    />
                )}
                {(() => {
                  const b1 = parseInt(ficoScore) || 740;
                  const b2 = parseInt(coBorroFico) || 740;
                  const b3v = parseInt(borrowerCount) >= 3 ? (parseInt(b3Fico) || 740) : null;
                  const b4v = parseInt(borrowerCount) >= 4 ? (parseInt(b4Fico) || 740) : null;
                  const allScores = [b1, b2, ...(b3v !== null ? [b3v] : []), ...(b4v !== null ? [b4v] : [])];
                  const minScore = Math.min(...allScores);
                  const lowestLabels = [
                    b1 === minScore ? "B1" : null,
                    b2 === minScore ? "B2" : null,
                    b3v !== null && b3v === minScore ? "B3" : null,
                    b4v !== null && b4v === minScore ? "B4" : null,
                  ].filter(Boolean);
                  const coBorrowerIsLower = minScore < b1;
                  return (
                    <div style={{ fontSize: 12, padding: "4px 8px", background: c.bgAlt || c.bg, borderRadius: 4, marginTop: 2, fontFamily: font, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: c.gray }}>Qualifying Score:</span>
                      <strong style={{ color: coBorrowerIsLower ? c.gold : c.green }}>
                        {minScore} ({lowestLabels.join("/") + " lowest"})
                      </strong>
                    </div>
                  );
                })()}
              </>
            )}
            {borrowerCount !== "1" && (
              <div style={{ marginTop: 8, fontSize: 12, color: c.gray, fontFamily: font, fontStyle: "italic", lineHeight: 1.5 }}>
                ℹ️ Interest rates and MI factors are based on the lowest midscore of all borrowers.
              </div>
            )}
          </SectionCard>

          {/* ── MORTGAGE INSURANCE ── */}
          {showMISection && (() => {
            const _miInt = !!isInternal;
            return (
            <div style={{ marginTop: 0 }}>
              {/* Borrower-facing MI summary */}
              <SectionCard title={miSectionTitle} accent={miSectionAccent}>
                {loanProgram === "va" && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>✅</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.text || c.navy, fontFamily: font, marginBottom: 5 }}>No Monthly Mortgage Insurance</div>
                      <div style={{ fontSize: 12, color: c.gray, fontFamily: font, lineHeight: 1.6 }}>
                        {calc.vaExemptBool
                          ? "Your VA disability rating waives the funding fee entirely — no upfront cost and no monthly MI required."
                          : "One of the biggest benefits of a VA loan: no monthly mortgage insurance required, saving you money every month compared to FHA or conventional with less than 20% down."}
                      </div>
                    </div>
                  </div>
                )}
                {loanProgram === "fha" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: c.gray, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly MIP</div>
                        <div style={{ fontSize: 12, color: c.grayLight, fontFamily: font }}>{calc.fhaMipRatePct.toFixed(2)}% annual rate</div>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: c.gold, fontFamily: font }}>{fmt2(calc.monthlyFhaMip)}/mo</div>
                    </div>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, lineHeight: 1.6, background: c.bgAlt || "#f8f8f8", padding: "10px 12px", borderRadius: 8, marginBottom: 12 }}>
                      FHA requires Mortgage Insurance Premium (MIP) regardless of down payment. It's already included in your monthly payment above. Unlike conventional PMI, FHA MIP typically stays for the life of the loan.
                    </div>
                    <div style={{ padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}`, marginBottom: 10 }}>
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
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.gray, fontFamily: font, marginBottom: 4 }}>Annual MIP Rate</div>
                    <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${c.border}`, marginBottom: 6 }}>
                      {[{ v: "true", l: "Auto" }, { v: "false", l: "Manual" }].map(o => (
                        <button key={o.v} onClick={() => setFhaMipAuto(o.v)} style={{ flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: fhaMipAuto === o.v ? c.blue : "transparent", color: fhaMipAuto === o.v ? "#fff" : c.gray, transition: "all 0.2s" }}>{o.l}</button>
                      ))}
                    </div>
                    {fhaMipAuto !== "true" && (
                      <LabeledInput label="Annual MIP Rate" value={fhaMipOverride} onChange={setFhaMipOverride} suffix="%" hint={`${fmt2(calc.monthlyFhaMip)}/mo`} />
                    )}
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: fhaMipAuto === "true" ? 0 : 4 }}>
                      Annual MIP: <strong style={{ color: c.navy }}>{calc.fhaMipRatePct.toFixed(2)}%</strong> = <strong style={{ color: c.navy }}>{fmt2(calc.monthlyFhaMip)}/mo</strong>
                      {fhaMipAuto === "true" && <span style={{ opacity: 0.7 }}> (auto: LTV {calc.ltv.toFixed(0)}%, {parseInt(term) || 30}yr term)</span>}
                    </div>
                  </div>
                )}
                {loanProgram === "usda" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: c.gray, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly Annual Fee</div>
                        <div style={{ fontSize: 12, color: c.grayLight, fontFamily: font }}>0.35% annual rate</div>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: c.gold, fontFamily: font }}>{fmt2(calc.monthlyUsdaFee)}/mo</div>
                    </div>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, lineHeight: 1.6, background: c.bgAlt || "#f8f8f8", padding: "10px 12px", borderRadius: 8 }}>
                      USDA loans include a small annual guarantee fee that helps fund the program and makes 0% down financing possible. This is already included in your total payment above.
                    </div>
                  </div>
                )}
                {isConvType && loanProgram !== "jumbo" && calc.ltv > 80 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: c.blue, fontFamily: font }}>{calc.noRate ? "—" : fmt2(calc.monthlyPMI)}/mo</div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: c.gray, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly PMI</div>
                        <div style={{ fontSize: 12, color: c.grayLight, fontFamily: font }}>{calc.effPmiPct > 0 ? calc.effPmiPct.toFixed(2) : pmiRate}% annual · LTV: {calc.ltv.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, lineHeight: 1.6, background: c.bgAlt || "#f8f8f8", padding: "10px 12px", borderRadius: 8, marginBottom: 8 }}>
                      PMI is required when your down payment is less than 20%. It's already included in your monthly payment above. <strong style={{ color: c.navy }}>Removal options:</strong> PMI automatically cancels when your scheduled balance reaches 78% of the original value. You can request cancellation at 80% of the original value. Using a new appraisal, removal may be requested at 75% LTV if the loan is 2–5 years old, or 80% LTV if the loan is over 5 years old.
                    </div>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, lineHeight: 1.7, background: c.bgAlt || "#f8f8f8", padding: "10px 12px", borderRadius: 8, borderLeft: `3px solid ${c.blue}` }}>
                      <strong style={{ color: c.navy }}>Why does my MI rate vary?</strong> Your exact MI factor is determined by a combination of factors that lenders and MI companies evaluate together — including your credit score, loan-to-value ratio (LTV), debt-to-income ratio (DTI), number of borrowers on the loan, loan term, property type, and whether the loan is a purchase or refinance. Small changes in any of these can shift your rate. Your Loan Officer can run the exact quote once your full profile is in.
                    </div>
                  </div>
                )}
              </SectionCard>
              {/* Internal-only: PMI controls + MI factors (combined) */}
              {_miInt && isConvType && loanProgram !== "jumbo" && calc.ltv > 80 && (() => {
                const hp2  = parseFloat(homePrice) || 0;
                const la2  = parseFloat(loanAmount) || 0;
                const ltv2 = hp2 > 0 ? (la2 / hp2) * 100 : 0;
                const termYrs2 = parseInt(term) || 30;
                const isCashOut2 = purpose === "cashOutRefi";
                const adjParams = { ltv: ltv2, fico: qualifyingFico, termYears: termYrs2, isMultiBorrower: isMultiBorr, highDTI, isCashOut: isCashOut2, occupancy, reducedCoverage: useReducedMIFinal };
                const enactR  = lookupPMICompany("enact",  adjParams);
                const essentR = lookupPMICompany("essent", adjParams);
                const cheapest = (enactR !== null && essentR !== null)
                  ? (enactR <= essentR ? "Enact" : "Essent")
                  : enactR !== null ? "Enact" : essentR !== null ? "Essent" : null;
                return (
                  <SectionCard title="MORTGAGE INSURANCE (INTERNAL)" accent={c.blue}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.text || c.navy, fontFamily: font }}>PMI Rate</span>
                        <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${c.border}` }}>
                          {[{ v: true, l: "Auto" }, { v: false, l: "Manual" }].map(o => (
                            <button key={String(o.v)} onClick={() => setPmiAuto(o.v)} style={{ padding: "2px 10px", fontSize: 12, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: pmiAuto === o.v ? c.blue : "transparent", color: pmiAuto === o.v ? "#fff" : c.gray, transition: "all 0.15s" }}>{o.l}</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                        {[
                          { v: "monthly", l: "Monthly"      },
                          { v: "single",  l: "Single Prem." },
                          { v: "split",   l: "Split Prem."  },
                          { v: "lpmi",    l: "Lender Paid"  },
                        ].map(o => (
                          <button key={o.v} onClick={() => setMiPremiumType(o.v)} style={{
                            padding: "3px 10px", fontSize: 12, fontWeight: 700, fontFamily: font,
                            border: `1px solid ${miPremiumType === o.v ? c.blue : c.border}`,
                            borderRadius: 4, cursor: "pointer",
                            background: miPremiumType === o.v ? c.blue : "transparent",
                            color: miPremiumType === o.v ? "#fff" : c.gray,
                            transition: "all 0.15s",
                          }}>{o.l}</button>
                        ))}
                      </div>
                      {!pmiAuto ? (
                        <LabeledInput label="PMI Rate" value={pmiRate} onChange={setPmiRate} suffix="% annual" hint={`${fmt2(calc.monthlyPMI)}/mo · Removed at 80% LTV`} />
                      ) : miPremiumType === "lpmi" ? (
                        <div style={{ fontSize: 12, fontFamily: font, color: c.textSecondary || c.gray, marginTop: 4, padding: "6px 8px", background: c.bgAlt || "#f0f4fa", borderRadius: 6 }}>
                          <div style={{ fontWeight: 700, color: c.text || c.navy, marginBottom: 2 }}>Lender Paid MI — No Monthly Premium</div>
                          <div style={{ fontSize: 12 }}>Rate increase: <strong style={{ color: c.gold }}>+{calc.lpmiAdjPct.toFixed(3)}%</strong> added to note rate</div>
                          <div style={{ fontSize: 12, marginTop: 2, opacity: 0.7 }}>Lender absorbs MI cost via higher rate. MI never cancels (rate stays elevated).</div>
                        </div>
                      ) : miPremiumType === "single" ? (
                        <div style={{ fontSize: 12, fontFamily: font, color: c.textSecondary || c.gray, marginTop: 4, padding: "6px 8px", background: c.bgAlt || "#f0f4fa", borderRadius: 6 }}>
                          <div style={{ fontWeight: 700, color: c.text || c.navy, marginBottom: 2 }}>Single Premium — No Monthly MI</div>
                          <div style={{ fontSize: 12 }}>Upfront: <strong style={{ color: c.navy }}>{calc.singlePremRate ? `${(calc.singlePremRate * 100).toFixed(2)}% = ` : ""}{fmt(calc.convSingleAmt)}</strong> financed into loan</div>
                          <div style={{ fontSize: 12, marginTop: 2, opacity: 0.7 }}>One-time premium eliminates monthly MI. Ideal if staying long-term.</div>
                        </div>
                      ) : miPremiumType === "split" ? (
                        <div style={{ fontSize: 12, fontFamily: font, color: c.textSecondary || c.gray, marginTop: 4, padding: "6px 8px", background: c.bgAlt || "#f0f4fa", borderRadius: 6 }}>
                          <div style={{ fontWeight: 700, color: c.text || c.navy, marginBottom: 2 }}>Split Premium</div>
                          <div style={{ fontSize: 12 }}>Upfront: <strong style={{ color: c.navy }}>{fmt(calc.splitUpfrontAmt)}</strong> (0.50% financed) + Monthly: <strong style={{ color: c.navy }}>{fmt2(calc.monthlyPMI)}/mo</strong></div>
                          <div style={{ fontSize: 12, marginTop: 2, opacity: 0.7 }}>Reduces monthly MI by ~40%. Cancels at 80% LTV.</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, fontFamily: font, color: c.textSecondary || c.gray, marginTop: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span>Rate: <strong style={{ color: c.text || c.navy, fontSize: 14 }}>{calc.effPmiPct > 0 ? calc.effPmiPct.toFixed(2) : pmiRate}%</strong> annual</span>
                            <span style={{ fontSize: 12 }}>{fmt2(calc.monthlyPMI)}/mo</span>
                          </div>
                          {pmiInfo && <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>LTV {calc.ltv.toFixed(1)}% · {pmiInfo.tier} · Base {(pmiInfo.baseRate * 100).toFixed(2)}%{pmiInfo.totalAdj !== 0 ? ` · Adj ${pmiInfo.totalAdj > 0 ? "+" : ""}${(pmiInfo.totalAdj * 100).toFixed(2)}%` : ""}</div>}
                          <div style={{ fontSize: 12, marginTop: 2, opacity: 0.6 }}>Auto-cancels at 78% LTV (HPA) · Request removal at 80%</div>
                        </div>
                      )}
                    </div>
                    {pmiAuto && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${c.border}` }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 16px", fontSize: 12, fontFamily: font, marginBottom: 12 }}>
                          {[
                            { label: "Qualifying FICO", value: (() => {
                              if (borrowerCount === "1") return `${qualifyingFico}`;
                              const parts = [ficoScore, coBorroFico];
                              if (parseInt(borrowerCount) >= 3) parts.push(b3Fico);
                              if (parseInt(borrowerCount) >= 4) parts.push(b4Fico);
                              return `${qualifyingFico} (min of ${parts.join(" / ")})`;
                            })() },
                            { label: "LTV Bucket",      value: pmiInfo?.tier || `${ltv2.toFixed(1)}%` },
                            { label: "Term Table",      value: termYrs2 > 20 ? ">20yr" : "≤20yr" },
                            { label: "Occupancy Adj",  value: occupancy === "primary" ? "None" : occupancy === "vacation" ? "+Second Home" : "+Investment" },
                            { label: "Cash-Out Adj",   value: isCashOut2 ? "+Applied" : "None" },
                            { label: "Back-End DTI",   value: dtiBack > 0 ? `${dtiBack.toFixed(1)}%${highDTI ? " ⚠️ >45%" : ""}` : "N/A (run DTI Calc)", high: highDTI },
                            { label: "Multi-Borrower", value: isMultiBorr ? "−Discount applied" : "N/A" },
                            { label: "Base Rate",      value: pmiInfo ? `${(pmiInfo.baseRate * 100).toFixed(2)}%` : "—" },
                            { label: "Total Adj",      value: pmiInfo && pmiInfo.totalAdj !== 0 ? `${pmiInfo.totalAdj > 0 ? "+" : ""}${(pmiInfo.totalAdj * 100).toFixed(3)}%` : "None" },
                            { label: "Final Rate",     value: `${calc.effPmiPct > 0 ? calc.effPmiPct.toFixed(2) : pmiRate}%/yr` },
                            { label: "Coverage",       value: pmiInfo ? `${pmiInfo.coverage}%` : "—" },
                            { label: "Monthly MI",     value: fmt2(calc.monthlyPMI) },
                          ].map(item => (
                            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${c.border || "#eee"}` }}>
                              <span style={{ color: c.gray }}>{item.label}</span>
                              <strong style={{ color: item.high ? c.gold : c.text || c.navy }}>{item.value}</strong>
                            </div>
                          ))}
                        </div>
                        {dtiBack > 0 && (
                          <div style={{ fontSize: 12, color: c.gray, fontFamily: font, fontStyle: "italic", marginBottom: 10 }}>
                            DTI sourced from DTI Calculator · update there to recalculate MI surcharge
                          </div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.blue, fontFamily: font, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Company Rates (Adjusted)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {[{ label: "Enact MI", rate: enactR }, { label: "Essent MI", rate: essentR }].map(co => (
                            <div key={co.label} style={{ padding: 8, borderRadius: 8, background: c.bgAlt || "#f5f5f5", textAlign: "center", border: cheapest === co.label.split(" ")[0] ? `1.5px solid ${c.green}` : `1px solid ${c.border}` }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: c.textSecondary || c.gray, fontFamily: font }}>{co.label}{cheapest === co.label.split(" ")[0] ? " ✓" : ""}</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: co.rate !== null ? c.green : c.gray, fontFamily: font }}>{co.rate !== null ? `${(co.rate * 100).toFixed(2)}%` : "N/A"}</div>
                              {co.rate !== null && <div style={{ fontSize: 12, color: c.textSecondary || c.gray }}>{fmt2(la2 * co.rate / 12)}/mo</div>}
                            </div>
                          ))}
                        </div>
                        {enactR !== null && essentR !== null && (
                          <div style={{ fontSize: 12, textAlign: "center", marginTop: 6, color: c.textSecondary || c.gray, fontFamily: font }}>
                            Cheapest: <strong style={{ color: c.green }}>{cheapest}</strong> · saves {fmt2(Math.abs((enactR - essentR) * la2 / 12))}/mo
                          </div>
                        )}
                      </div>
                    )}
                  </SectionCard>
                );
              })()}
              {/* ── PMI BY DOWN PAYMENT — INTERNAL ── */}
              {_miInt && isConvType && loanProgram !== "jumbo" && calc.ltv > 80 && (parseFloat(homePrice) || 0) > 0 && (() => {
                const hp3 = parseFloat(homePrice) || 0;
                const la3 = parseFloat(loanAmount) || 0;
                const currentDP    = hp3 - la3;
                const currentDPPct = hp3 > 0 ? (currentDP / hp3) * 100 : 0;
                const termYrs3  = parseInt(term) || 30;
                const isCashOut3 = purpose === "cashOutRefi";
                const TH = { textAlign: "left", padding: "5px 8px", borderBottom: `2px solid ${c.border}`, color: c.gray, fontWeight: 600, fontSize: 10, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em" };
                const TD = { padding: "7px 8px", borderBottom: `1px solid ${c.border}`, fontSize: 12, fontFamily: font };

                const FIXED_DPS = [3, 5, 10, 15, 20];
                const matchedFixed = FIXED_DPS.some(p => Math.abs(p - currentDPPct) < 0.3);

                // Helper: compute cheapest-company PMI for any target DP %
                const computeRow = (pct) => {
                  const targetDP  = Math.round(hp3 * pct / 100);
                  const targetLA  = hp3 - targetDP;
                  const targetLTV = hp3 > 0 ? (targetLA / hp3) * 100 : 0;
                  const addlNeeded = targetDP - currentDP;
                  const noPMI = targetLTV <= 80;
                  let monthlyPMI = 0;
                  if (!noPMI) {
                    const params = { ltv: targetLTV, fico: qualifyingFico, termYears: termYrs3, isMultiBorrower: isMultiBorr, highDTI, isCashOut: isCashOut3, occupancy, reducedCoverage: useReducedMIFinal };
                    const eR = lookupPMICompany("enact",  params);
                    const sR = lookupPMICompany("essent", params);
                    let cheapR = null;
                    if (eR !== null && sR !== null) cheapR = Math.min(eR, sR);
                    else if (eR !== null) cheapR = eR;
                    else if (sR !== null) cheapR = sR;
                    if (cheapR !== null) { monthlyPMI = targetLA * cheapR / 12; }
                    else { const info = lookupPMI(params); if (info && info.rate != null) monthlyPMI = targetLA * info.rate / 12; }
                  }
                  return { addlNeeded, noPMI, monthlyPMI };
                };

                // Build fixed rows; if current DP matches one, mark it
                const rows = FIXED_DPS.map(pct => {
                  const isCurrentRow = Math.abs(pct - currentDPPct) < 0.3;
                  if (isCurrentRow) {
                    return { pct, label: `${pct}%`, isCurrent: true, addlNeeded: 0, noPMI: calc.ltv <= 80, monthlyPMI: calc.monthlyPMI };
                  }
                  const { addlNeeded, noPMI, monthlyPMI } = computeRow(pct);
                  return { pct, label: `${pct}%`, isCurrent: false, addlNeeded, noPMI, monthlyPMI };
                });

                // If actual DP doesn't land on a fixed row, insert "you are here"
                if (!matchedFixed && currentDPPct > 0 && currentDPPct < 20) {
                  const youHere = { pct: currentDPPct, label: `${currentDPPct.toFixed(1)}%`, isCurrent: true, addlNeeded: 0, noPMI: calc.ltv <= 80, monthlyPMI: calc.monthlyPMI };
                  const insertIdx = rows.findIndex(r => r.pct > currentDPPct);
                  if (insertIdx === -1) rows.push(youHere); else rows.splice(insertIdx, 0, youHere);
                }

                return (
                  <SectionCard title="PMI BY DOWN PAYMENT (INTERNAL)" accent={c.blue}>
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginBottom: 10, lineHeight: 1.5 }}>
                      Shows how monthly PMI changes as the down payment increases — use this to illustrate the savings of putting more down.
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={TH}>Down Payment</th>
                          <th style={{ ...TH, textAlign: "right" }}>$ to Reach</th>
                          <th style={{ ...TH, textAlign: "right" }}>Monthly PMI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => (
                          <tr key={row.label} style={{ background: row.isCurrent ? (c.bgAlt || "#f5f8fc") : "transparent" }}>
                            <td style={{ ...TD, fontWeight: row.isCurrent ? 700 : 400, color: row.noPMI ? c.green : c.navy }}>
                              {row.label}{row.isCurrent ? "  ◀ you are here" : ""}
                            </td>
                            <td style={{ ...TD, textAlign: "right", color: c.gray }}>
                              {row.isCurrent || row.addlNeeded <= 0 ? "—" : fmt(row.addlNeeded)}
                            </td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: row.noPMI ? c.green : c.blue }}>
                              {row.noPMI ? "$0 — PMI gone" : (row.monthlyPMI > 0 ? fmt2(row.monthlyPMI) + "/mo" : "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </SectionCard>
                );
              })()}

              {/* ── MI OVERRIDES (LO ONLY) ── */}
              {isInternal && (
                <SectionCard title="MI OVERRIDES (LO ONLY)" accent={c.blue}>
                  <div style={{ fontSize: 12, color: c.gray, fontFamily: font, lineHeight: 1.6, marginBottom: 14 }}>
                    Enter a dollar amount to override the system-calculated MI. Leave blank to use the auto value.
                    {(parseFloat(monthlyMiOvr) > 0 || parseFloat(upfrontMiOvr) > 0) && (
                      <span style={{ marginLeft: 8, color: "#b45309", fontWeight: 700 }}>⚠ Override active</span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <LabeledInput
                        label="Monthly MI Override"
                        value={monthlyMiOvr}
                        onChange={setMonthlyMiOvr}
                        prefix="$"
                        type="number"
                        hint={monthlyMiOvr ? `Replaces auto: ${fmt2(calc.autoMonthlyMI)}/mo` : `Auto: ${fmt2(calc.autoMonthlyMI)}/mo`}
                        infoTip="Enter a dollar amount to replace the system-calculated monthly mortgage insurance. Use this when the MI company gives you a different rate than the auto-lookup — for example, borrower-paid single premium scenarios, or when you have a manual quote from Enact or Essent. Leave blank to use the auto rate."
                      />
                    </div>
                    <div>
                      <LabeledInput
                        label="Upfront MI Override"
                        value={upfrontMiOvr}
                        onChange={setUpfrontMiOvr}
                        prefix="$"
                        type="number"
                        hint={upfrontMiOvr ? `Replaces auto: ${fmt(calc.autoUpfrontFee)}` : `Auto: ${fmt(calc.autoUpfrontFee)}`}
                        infoTip="Enter a dollar amount to replace the system-calculated upfront MI fee. This covers VA funding fees, FHA UFMIP (1.75%), USDA upfront guarantee fee (1%), and conventional single or split premiums. Use when your actual fee differs from the auto calculation — for example, when a borrower's disability rating waives the VA fee partially."
                      />
                    </div>
                  </div>
                  {(parseFloat(monthlyMiOvr) > 0 || parseFloat(upfrontMiOvr) > 0) && (
                    <button
                      onClick={() => { setMonthlyMiOvr(""); setUpfrontMiOvr(""); }}
                      style={{ marginTop: 10, background: "none", border: `1px solid ${c.border}`, borderRadius: 6, padding: "5px 14px", fontSize: 12, color: c.gray, fontFamily: font, cursor: "pointer" }}
                    >
                      ✕ Clear overrides
                    </button>
                  )}
                </SectionCard>
              )}

            </div>
            );
          })()}

      </div>

      {/* ═══ PROPERTY TAX ═══ */}
      <SectionCard title="PROPERTY TAX" accent={c.blue} style={{ maxWidth: 640 }} infoTip="Annual property taxes as a percentage of home value, included in your monthly PITI payment when escrowed. Texas rates typically range 1.5–2.5% depending on county and school district. Enter the monthly dollar amount OR the annual rate — both fields stay in sync.">
        {(() => {
          const hp = parseFloat(homePrice) || 0;
          const basis = homesteadExemption ? hp * 0.70 : hp;
          const rate = parseFloat(propertyTaxRate) || 0;
          const monthlyRaw = basis > 0 ? basis * rate / 100 / 12 : 0;
          const monthly = monthlyRaw > 0 ? Math.round(monthlyRaw / 50) * 50 : 0;
          const inputStyle = { flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontSize: 15, fontWeight: 500, color: c.text || c.navy, fontFamily: font, width: "100%", minWidth: 0 };
          const wrapStyle = { display: "flex", alignItems: "center", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, overflow: "hidden", flex: 1 };
          return (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: monthly > 0 ? 4 : 14 }}>
                <div style={wrapStyle}>
                  <span style={{ padding: "10px 0 10px 12px", color: c.navy, fontWeight: 600, fontSize: 15, fontFamily: font }}>$</span>
                  <input type="text" inputMode="numeric" value={monthly > 0 ? addCommasLocal(String(Math.round(monthly))) : ""}
                    onChange={(e) => {
                      const v = stripCommasLocal(e.target.value);
                      if (String(v).trimStart().startsWith('-')) return;
                      const mo = parseFloat(v) || 0;
                      const basis2 = homesteadExemption ? hp * 0.70 : hp;
                      if (basis2 > 0) setPropertyTaxRate(String(parseFloat((mo * 12 / basis2 * 100).toFixed(3))));
                      setTaxMode("rate");
                    }}
                    style={inputStyle} />
                  <span style={{ padding: "10px 12px 10px 0", color: c.gray, fontSize: 13, fontWeight: 500, fontFamily: font }}>/mo</span>
                </div>
                <div style={wrapStyle}>
                  <input type="number" min="0" max="3.5" step="0.001" value={propertyTaxRate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (String(v).trimStart().startsWith('-') || parseFloat(v) > 3.5) return;
                      setPropertyTaxRate(v);
                      setTaxMode("rate");
                    }}
                    style={inputStyle} />
                  <span style={{ padding: "10px 12px 10px 0", color: c.gray, fontSize: 13, fontWeight: 500, fontFamily: font }}>% / yr</span>
                </div>
              </div>
              {monthly > 0 && (
                <div style={{ fontSize: 12, color: c.grayLight || c.gray, fontFamily: font, marginBottom: 14, textAlign: "right" }}>
                  {fmt(Math.round(monthly * 12))} / year
                </div>
              )}
            </>
          );
        })()}
        {STATE_TAX_RATES[pcState] != null && (
          <div style={{ fontSize: 12, color: c.grayLight || c.gray, fontFamily: font, marginTop: 6, lineHeight: 1.5, fontStyle: "italic", padding: "6px 10px", background: c.bgAlt || "#f8f8f8", borderRadius: 6 }}>
            {(window.STATE_LIST||[]).find(s=>s.value===pcState)?.label || pcState} state average ≈ {STATE_TAX_RATES[pcState]}%; actual rates vary significantly by county and taxing district. Override the rate above as needed.
          </div>
        )}
        {pcState === "TX" && (
          <div style={{ fontSize: 12, color: c.navy, fontFamily: font, marginTop: 6, lineHeight: 1.5, padding: "6px 10px", background: `${c.blue}12`, border: `1px solid ${c.blue}33`, borderRadius: 6 }}>
            Our recommendation for North Texas: <strong style={{ color: c.navy }}>2.3%</strong>. Actual rates vary by city and taxing district; verify with the county appraisal district for the specific property.
          </div>
        )}
        {homesteadExemption && (
          <div style={{ marginTop: 6, fontSize: 12, color: c.textSecondary || c.gray, fontFamily: font, lineHeight: 1.5, padding: "6px 10px", background: c.bgAlt || "#f8f8f8", borderRadius: 6 }}>
            {(() => {
              const hp = parseFloat(homePrice) || 0;
              const rate = parseFloat(propertyTaxRate) || 0;
              const withExemption    = hp > 0 && rate > 0 ? fmt2(Math.round(hp * 0.70 * rate / 100 / 12 / 50) * 50) : null;
              const withoutExemption = hp > 0 && rate > 0 ? fmt2(Math.round(hp * rate / 100 / 12 / 50) * 50) : null;
              return (
                <>
                  Homestead exemption applied; tax basis reduced to approx. <strong style={{ color: c.text || c.navy }}>70% of value ({fmt(hp)} × 70% = {fmt(Math.round(hp * 0.70))})</strong>. Actual exemption varies by county.
                  {withExemption && withoutExemption && (
                    <span> Without exemption: <strong style={{ color: c.text || c.navy }}>{withoutExemption}/mo</strong>, with exemption: <strong style={{ color: c.green }}>{withExemption}/mo</strong>.</span>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </SectionCard>

      {/* ═══ HOME INSURANCE ═══ */}
      <SectionCard title="HOME INSURANCE" accent={c.blue} style={{ maxWidth: 640 }} infoTip="Annual homeowners insurance as a percentage of home value, included in your PITI payment when escrowed. A common estimate is 0.5–1.0% annually depending on location, coverage level, and provider. Always get an actual quote — rates vary significantly by property and insurer.">
        {(() => {
          const hp = parseFloat(homePrice) || 0;
          const rate = Math.max(0, parseFloat(homeInsuranceRate) || 0);
          const monthlyRaw = hp > 0 ? hp * rate / 100 / 12 : 0;
          const monthly = monthlyRaw > 0 ? Math.round(monthlyRaw / 50) * 50 : 0;
          const inputStyle = { flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontSize: 15, fontWeight: 500, color: c.text || c.navy, fontFamily: font, width: "100%", minWidth: 0 };
          const wrapStyle = { display: "flex", alignItems: "center", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, overflow: "hidden", flex: 1 };
          return (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: monthly > 0 ? 4 : 14 }}>
                <div style={wrapStyle}>
                  <span style={{ padding: "10px 0 10px 12px", color: c.navy, fontWeight: 600, fontSize: 15, fontFamily: font }}>$</span>
                  <input type="text" inputMode="numeric" value={monthly > 0 ? addCommasLocal(String(Math.round(monthly))) : ""}
                    onChange={(e) => {
                      const v = stripCommasLocal(e.target.value);
                      if (String(v).trimStart().startsWith('-')) return;
                      const mo = parseFloat(v) || 0;
                      if (hp > 0) setHomeInsuranceRate(String(parseFloat((mo * 12 / hp * 100).toFixed(3))));
                      setInsMode("rate");
                    }}
                    style={inputStyle} />
                  <span style={{ padding: "10px 12px 10px 0", color: c.gray, fontSize: 13, fontWeight: 500, fontFamily: font }}>/mo</span>
                </div>
                <div style={wrapStyle}>
                  <input type="number" min="0" max="2.5" step="0.001" value={homeInsuranceRate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (String(v).trimStart().startsWith('-') || parseFloat(v) > 2.5) return;
                      setHomeInsuranceRate(v);
                      setInsMode("rate");
                    }}
                    onBlur={() => { const n = parseFloat(homeInsuranceRate) || 0; if (n > 0 && n < 0.25) setHomeInsuranceRate("0.25"); }}
                    style={inputStyle} />
                  <span style={{ padding: "10px 12px 10px 0", color: c.gray, fontSize: 13, fontWeight: 500, fontFamily: font }}>% / yr</span>
                </div>
              </div>
              {monthly > 0 && (
                <div style={{ fontSize: 12, color: c.grayLight || c.gray, fontFamily: font, marginBottom: 14, textAlign: "right" }}>
                  {fmt(Math.round(monthly * 12))} / year
                </div>
              )}
              {rate > 0 && rate < 0.25 && (
                <div style={{ marginBottom: 8, fontSize: 12, color: "#b45309", fontFamily: font, lineHeight: 1.4, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 5, padding: "6px 10px" }}>
                  Homeowners insurance is required on all mortgage loans. Minimum floored at <strong>0.25%</strong> of home value.
                </div>
              )}
            </>
          );
        })()}
        {STATE_INS_RATES[pcState] != null && (
          <div style={{ fontSize: 12, color: c.grayLight || c.gray, fontFamily: font, marginTop: 6, lineHeight: 1.5, fontStyle: "italic", padding: "6px 10px", background: c.bgAlt || "#f8f8f8", borderRadius: 6 }}>
            {(window.STATE_LIST||[]).find(s=>s.value===pcState)?.label || pcState} avg ≈ {STATE_INS_RATES[pcState]}%{
              (() => {
                const propMult = INS_PROP_MULTIPLIERS[propType] || 1.00;
                const occMult = INS_OCC_MULTIPLIERS[occupancy] || 1.00;
                const combined = propMult * occMult;
                if (combined === 1.00) return null;
                const adj = parseFloat((STATE_INS_RATES[pcState] * combined).toFixed(2));
                const notes = [];
                if (propType === "condo") notes.push("condo");
                else if (propType === "townhome") notes.push("townhome");
                else if (propType === "duplex") notes.push("duplex");
                else if (propType === "3plex") notes.push("3-plex");
                else if (propType === "4plex") notes.push("4-plex");
                if (occupancy === "investment") notes.push("investment property");
                else if (occupancy === "vacation") notes.push("vacation home");
                return `, adjusted to ${adj}% (${notes.join(", ")})`;
              })()
            }; rates vary by home age, carrier, and coverage level. Override as needed.
          </div>
        )}
        {pcState === "TX" && (
          <div style={{ fontSize: 12, color: c.navy, fontFamily: font, marginTop: 6, lineHeight: 1.5, padding: "6px 10px", background: `${c.blue}12`, border: `1px solid ${c.blue}33`, borderRadius: 6 }}>
            Our recommendation for North Texas: <strong style={{ color: c.navy }}>0.7%</strong> for existing homes. New construction may qualify for lower rates; verify with the insurance carrier.
          </div>
        )}
      </SectionCard>

      {/* ═══ PAYMENT SUMMARY (RESULTS) — full-width ═══ */}
      <SectionCard title="" accent={c.navy} style={{ marginTop: 16, maxWidth: 640 }}>
        <div style={{ background: `linear-gradient(135deg, ${c.navy}, ${c.navyLight})`, borderRadius: 12, padding: 24, color: "#fff", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", opacity: 0.5, marginBottom: 4 }}>{purposeLabel.toUpperCase()} · {programLabel} · {loanTypeLabel.toUpperCase()} · {occLabel.toUpperCase()}</div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.7, marginBottom: 8 }}>
            {loanType === "io" ? "INTEREST-ONLY PAYMENT" : loanType === "heloc" ? "DRAW PERIOD PAYMENT" : "TOTAL MONTHLY PAYMENT"}
          </div>
          {calc.noRate ? (
            <React.Fragment>
              <div style={{ fontSize: 48, fontWeight: 800, fontFamily: font, lineHeight: 1, opacity: 0.4 }}>--</div>
              <div style={{ fontSize: 12, marginTop: 8, background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", display: "inline-block" }}>Enter an interest rate</div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div style={{ fontSize: 48, fontWeight: 800, fontFamily: font, lineHeight: 1 }}>{fmt2(calc.totalMonthly)}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                {loanType === "io" ? `IO for ${ioPeriod}yr, then ${fmt2(calc.amortPI)}/mo P&I` :
                 loanType === "heloc" ? `IO draw ${helocDrawYears}yr, then ${fmt2(calc.repayPI)}/mo repay` :
                 loanType === "arm" ? `Fixed ${armFixedYears}yr, worst-case ${fmt2(calc.worstPI)}/mo after` :
                 `Principal, Interest, Taxes, Insurance${calc.monthlyPMI > 0 ? ", PMI" : ""}${calc.monthlyHOA > 0 ? ", HOA" : ""}`}
              </div>
            </React.Fragment>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          <DonutChart
            data={pieData.map(d => ({ value: d.value, color: d.color }))}
            size={150}
            thickness={22}
            centerLabel="MONTHLY"
            centerValue={fmt2(total)}
            centerSub={calc.is100PctDisabledTX ? "TAX WAIVED" : undefined}
            centerSubColor="#16a34a"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
            {pieData.map((d) => (
              <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: c.bg, borderRadius: 8, border: `1px solid ${c.border}` }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, background: d.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: c.gray, fontWeight: 600, fontFamily: font }}>{d.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy, fontFamily: font }}>{fmt2(d.value)}</div>
                </div>
                <div style={{ fontSize: 12, color: c.grayLight, fontFamily: font }}>{total > 0 ? Math.round(d.value / total * 100) : 0}%</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ═══ REFI: ESCROW STRUCTURE — full-width, refi only ═══ */}
      {purpose !== "purchase" && (
        <SectionCard title="REFI: ESCROW STRUCTURE" accent={c.blue} style={{ marginTop: 16 }}>
          <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* LEFT — date questions + toggles */}
            <div style={{ background: c.bgAlt || "#faf9f7", borderRadius: 10, border: `1px solid ${c.border}`, padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.gray, fontFamily: font, marginBottom: 4, letterSpacing: "0.05em" }}>DATE OF MOST RECENT MORTGAGE PAYMENT</div>
                <input type="date" value={rs2LastPmtDate} onChange={e => setRs2LastPmtDate(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: c.navy, background: "#fff", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.gray, fontFamily: font, marginBottom: 4, letterSpacing: "0.05em" }}>INSURANCE RENEWAL DATE</div>
                <input type="date" value={fsInsRenew} onChange={e => setFsInsRenew(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", border: `1px solid ${fsInsRenew && fsInsRenew < new Date().toISOString().slice(0,10) ? "#f87171" : c.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: c.navy, background: "#fff", outline: "none", boxSizing: "border-box" }} />
                {fsInsRenew && fsInsRenew < new Date().toISOString().slice(0, 10) && (
                  <div style={{ marginTop: 4, padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 12, color: "#b91c1c", fontFamily: font, fontWeight: 600 }}>
                    ⚠ Insurance renewal date is in the past — policy may have lapsed or needs renewal before closing.
                  </div>
                )}
              </div>
              {!(loanProgram === "va" || loanProgram === "fha" || loanProgram === "usda") && calc.ltv <= 90 && (
                <React.Fragment>
                  <Toggle label="Waive Escrows (for new loan)" checked={waiveEscrows} onChange={setWaiveEscrows} />
                  {waiveEscrows && (function() {
                    if (!fsInsRenew || !lbpFundingDate) return null;
                    var renewDate = new Date(fsInsRenew + "T12:00:00");
                    var fundDate  = new Date(lbpFundingDate + "T12:00:00");
                    var diffDays  = (renewDate - fundDate) / (1000 * 60 * 60 * 24);
                    if (diffDays < 0 || diffDays > 90) return null;
                    return (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ padding:"8px 10px", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:6, fontSize:12, fontFamily:font, lineHeight:1.6, color:"#92400e", marginBottom:6 }}>
                          <strong>⚠ Internal:</strong> Insurance renews within 90 days of funding. When escrows are waived, most lenders require 90 days of prepaid insurance at closing to ensure coverage during new loan setup.
                        </div>
                        <Toggle label="Internal: Collect 90 Days of Insurance" checked={collect90Ins} onChange={setCollect90Ins} />
                      </div>
                    );
                  })()}
                </React.Fragment>
              )}
              <Toggle label="Internal: Net Escrows from Payoff" checked={raNetEsc} onChange={setRaNetEsc} />
              {(() => {
                const escBal = parseFloat(String(rs2NetEscrow).replace(/,/g, "")) || 0;
                const selfEscrow = escBal === 0 && rs2NetEscrow !== "";
                return (
                  <>
                    <LabeledInput label="Current Escrow Balance" prefix="$" value={rs2NetEscrow} onChange={setRs2NetEscrow} useCommas noNegative hint="Synced with Loan Sizing Worksheet" />
                    {rs2NetEscrow === "" || rs2NetEscrow === "0" || escBal === 0 ? (
                      <div style={{ padding: "7px 10px", background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 12, fontFamily: font, lineHeight: 1.5, color: c.gray, fontStyle: "italic" }}>
                        If the balance is $0, the borrower may currently be self-escrowing (paying taxes and insurance directly).
                      </div>
                    ) : raNetEsc ? (
                      <div style={{ padding: "8px 10px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, fontSize: 12, fontFamily: font, lineHeight: 1.6, color: c.navy }}>
                        <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 3 }}>⚠ Net Escrows are not always available — confirm with your LO.</div>
                        <div style={{ marginBottom: 4 }}>
                          <strong>If netting escrows:</strong> The escrow balance is credited against your payoff, reducing what you owe at closing. You will <strong>not</strong> receive a refund check after closing.
                        </div>
                        <div>
                          <strong>If not netting escrows:</strong> You pay the full payoff and your current servicer mails you a refund check for the escrow balance — typically within 30 days of closing.
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "8px 10px", background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 12, fontFamily: font, lineHeight: 1.6, color: c.navy }}>
                        After your loan funds, your current servicer will refund any money held in your escrow account. This is typically done via a mailed check — timing varies by servicer, but it generally arrives sometime after funding. We have no control over the servicer's process or timeline.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* RIGHT — escrow fields */}
            <div style={{ background: c.bgAlt || "#faf9f7", borderRadius: 10, border: `1px solid ${c.border}`, padding: "14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <LabeledInput label="Existing Monthly Escrow (both taxes and insurance)" prefix="$" value={existEscrowMo} onChange={setExistEscrowMo} useCommas noNegative hint="Current tax + insurance escrow payment" />
              <LabeledInput label="Existing Monthly MI (if applicable)" prefix="$" value={existingMI} onChange={setExistingMI} useCommas noNegative hint="Synced with Refi: Existing Loan tab" />
              {(() => {
                const existEsc = parseFloat(String(existEscrowMo).replace(/,/g, "")) || 0;
                const existMI  = parseFloat(String(existingMI).replace(/,/g, ""))    || 0;
                const newEsc   = (calc.monthlyTax || 0) + (calc.monthlyIns || 0);
                const newMI    = calc.monthlyPMI || 0;
                if (!existEsc && !existMI) return null;
                const oldTotal = existEsc + existMI;
                const newTotal = newEsc + newMI;
                const delta    = newTotal - oldTotal;
                return (
                  <div style={{ marginTop: 4, padding: "8px 10px", background: delta <= 0 ? (c.greenLight || "#f0fdf4") : `${c.gold}18`, border: `1px solid ${delta <= 0 ? (c.green || "#22c55e") + "44" : (c.gold || "#f59e0b") + "55"}`, borderRadius: 6, fontSize: 12, fontFamily: font, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, color: c.navy, marginBottom: 4 }}>📊 Escrow Comparison</div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: c.gray }}>
                      <span>Current escrow + MI <span style={{ fontSize: 12, opacity: 0.75 }}>({fmt2(existEsc)} tax & ins + {fmt2(existMI)} MI)</span></span>
                      <span style={{ fontWeight: 600, color: c.navy }}>{fmt2(oldTotal)}/mo</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: c.gray }}>
                      <span>New escrow + MI <span style={{ fontSize: 12, opacity: 0.75 }}>({fmt2(calc.monthlyTax || 0)} tax + {fmt2(calc.monthlyIns || 0)} ins + {fmt2(newMI)} MI)</span></span>
                      <span style={{ fontWeight: 600, color: c.navy }}>{fmt2(newTotal)}/mo</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTop: `1px solid ${c.border}`, fontWeight: 700 }}>
                      <span style={{ color: c.navy }}>Monthly change</span>
                      <span style={{ color: delta <= 0 ? (c.green || "#16a34a") : (c.gold || "#b45309") }}>
                        {delta <= 0 ? `−${fmt2(Math.abs(delta))}` : `+${fmt2(delta)}`}/mo
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        </SectionCard>
      )}

      {/* ═══ LOAN BALANCE & PAYOFF ═══ */}
      {purpose !== "purchase" && (
      <SectionCard title="LOAN BALANCE & PAYOFF" accent={COLORS.navy} style={{ marginTop: 16 }}>

        {/* Current Loan Balance — first field, full width */}
        <div style={{ marginBottom: 14 }}>
          <LabeledInput label="Current Loan Balance" prefix="$" value={rs2Balance} onChange={setRs2Balance} useCommas noNegative />
          {(() => {
            const ola = parseFloat(raOrigLoanAmt) || 0;
            const cr = parseFloat(raCurRate) || 0;
            const term = parseFloat(raCurTerm) || 0;
            const missing = [];
            if (!ola) missing.push("Original Loan Amount");
            if (!cr) missing.push("Interest Rate");
            if (!term) missing.push("Term");
            if (!raNoteDate) missing.push("Original Loan Date");
            if (missing.length > 0) return (
              <div style={{ fontSize: 12, color: COLORS.gray, padding: "7px 10px", background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontFamily: font, lineHeight: 1.6 }}>
                💡 To auto-calculate an estimated balance, also enter: <strong>{missing.join(", ")}</strong>
              </div>
            );
            const yrs = Math.floor(lbpMonthsPaid / 12);
            const mos = lbpMonthsPaid % 12;
            const timeStr = yrs > 0 && mos > 0 ? `${yrs}yr ${mos}mo` : yrs > 0 ? `${yrs} yr` : `${mos} mo`;
            const eb = lbpEstimatedBalance;
            const userBal = parseFloat(String(rs2Balance).replace(/,/g,"")) || 0;
            const diff = eb - userBal;
            const absDiff = Math.abs(diff);
            const hasUserBal = userBal > 0;
            const isLow  = hasUserBal && diff > 200;
            const isHigh = hasUserBal && diff < -200;
            const isMatch = hasUserBal && !isLow && !isHigh;
            const bg     = isHigh ? `${COLORS.gold}18`   : (isLow || isMatch) ? COLORS.greenLight : `${COLORS.blue}0d`;
            const border = isHigh ? `${COLORS.gold}55`   : (isLow || isMatch) ? `${COLORS.green}33` : `${COLORS.blue}33`;
            return (
              <div style={{ fontSize: 12, color: COLORS.navy, padding: "8px 10px", background: bg, border: `1px solid ${border}`, borderRadius: 6, fontFamily: font, lineHeight: 1.7 }}>
                Based on data entered, the estimated mortgage balance is <strong>{fmt(Math.round(eb))}</strong> after {timeStr} ({lbpMonthsPaid} payments).
                {isLow && <span style={{ color: COLORS.green, fontWeight: 600, display: "block", marginTop: 3 }}>🎉 Your stated balance is <strong>{fmt(Math.round(absDiff))}</strong> lower than expected — extra payments have been made!</span>}
                {isHigh && <span style={{ color: COLORS.gold, fontWeight: 600, display: "block", marginTop: 3 }}>⚠ Your stated balance is <strong>{fmt(Math.round(absDiff))}</strong> higher than expected — double-check the inputs above.</span>}
                {isMatch && <span style={{ color: COLORS.green, fontWeight: 600, display: "block", marginTop: 3 }}>✓ Stated balance matches the amortization schedule.</span>}
              </div>
            );
          })()}
        </div>

        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* LEFT — dates & payments before closing */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.grayLight, fontFamily: font, marginBottom: 4, letterSpacing: "0.05em" }}>DATE OF MOST RECENT MORTGAGE PAYMENT</div>
              <input type="date" value={rs2LastPmtDate} onChange={e => setRs2LastPmtDate(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: COLORS.navy, background: "#fff", outline: "none", boxSizing: "border-box" }} />
              <div style={{ fontSize: 12, color: COLORS.grayLight, fontFamily: font, marginTop: 3, fontStyle: "italic" }}>Synced with Refi Existing Loan tab.</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.grayLight, fontFamily: font, marginBottom: 4, letterSpacing: "0.05em" }}>CLOSING DATE</div>
              <input type="date" value={newClosingDate} onChange={e => setNewClosingDate(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: COLORS.navy, background: "#fff", outline: "none", boxSizing: "border-box" }} />
              <div style={{ fontSize: 12, color: COLORS.grayLight, fontFamily: font, marginTop: 3, fontStyle: "italic" }}>Synced with Fee Sheet closing date.</div>
              {/* Funding date — auto-calculated, displayed below closing date */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.grayLight, fontFamily: font, marginBottom: 3, letterSpacing: "0.05em" }}>FUNDING DATE (AUTO-CALCULATED)</div>
                <div style={{ padding: "7px 10px", background: lbpFundingInfo.isTXRescission ? `${COLORS.blue}0d` : `${COLORS.green}10`, border: `1px solid ${lbpFundingInfo.isTXRescission ? COLORS.blue + "33" : COLORS.green + "44"}`, borderRadius: 6, fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
                  {new Date(lbpFundingDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                </div>
                {lbpFundingInfo.isTXRescission ? (
                  <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, marginTop: 3, lineHeight: 1.5 }}>
                    TX homestead refi — 3-day TILA right of rescission applied (Saturdays count; Sundays &amp; federal holidays excluded).
                    {lbpFundingInfo.holidays.length > 0 && (
                      <span style={{ display: "block", marginTop: 3, color: COLORS.gold, fontWeight: 600 }}>
                        ⚠ Holiday accounted for: {lbpFundingInfo.holidays.map(h => h.name).join(", ")} — funding date pushed out an extra day.
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: COLORS.green, fontFamily: font, marginTop: 3, fontWeight: 600 }}>Funds same day as closing.</div>
                )}
              </div>
            </div>
            {/* Payments before closing — toggle list */}
            {lbpLastPmt && lbpEffectiveFunding && (() => {
              const fundingDay = parseInt(lbpEffectiveFunding.split('-')[2]);
              const isEarlyFunding = fundingDay >= 1 && fundingDay <= 10;
              const isLateFunding = fundingDay >= 16;
              return (
              <div style={{ padding: "10px 12px", background: "#fafafa", border: `1px solid ${COLORS.border}`, borderRadius: 7, fontSize: 12, fontFamily: font }}>
                <div style={{ fontWeight: 700, color: COLORS.navy, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📅 Payments Before Closing</span>
                  {lbpAutoPaymentDates.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 400, color: COLORS.grayLight, fontStyle: "italic" }}>click to toggle</span>
                  )}
                </div>

                {/* Instructions */}
                {lbpAutoPaymentDates.length > 0 && (
                  <div style={{ fontSize: 12, color: COLORS.gray, marginBottom: 8, lineHeight: 1.55 }}>
                    Check the boxes for each monthly payment you plan to make before closing. This updates the projected loan balance used in the payoff estimate.
                  </div>
                )}

                {lbpAutoPaymentDates.length === 0 ? (
                  <div style={{ color: COLORS.green, fontWeight: 600 }}>✓ No payments expected before closing.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {lbpAutoPaymentDates.map((dateStr) => {
                      const checked = !lbpUncheckedSet.has(dateStr);
                      const isClosingMonth = dateStr === lbpAutoPaymentDates[lbpAutoPaymentDates.length - 1];
                      const projRow = lbpPaymentProjection.rows.find(r => r.date === dateStr);
                      const _pmtD = new Date(dateStr + "T12:00:00");
                      const _ABBR = [null,"Feb.","March","April","May","June","July","Aug.","Sept.","Oct.","Nov.","Dec."];
                      const _mName = _ABBR[_pmtD.getMonth()] || ["January","February","March","April","May","June","July","August","September","October","November","December"][_pmtD.getMonth()];
                      const pmtLabel = _mName + " " + _pmtD.getDate();
                      return (
                        <div key={dateStr}>
                          <div
                            onClick={() => lbpTogglePayment(dateStr)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                              background: checked ? `${COLORS.green}12` : `${COLORS.gold}0d`,
                              border: `1px solid ${checked ? COLORS.green + "33" : COLORS.gold + "44"}`,
                              opacity: checked ? 1 : 0.65,
                            }}
                          >
                            <span style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                              border: `2px solid ${checked ? COLORS.green : COLORS.gold}`,
                              background: checked ? COLORS.green : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, color: "#fff", fontWeight: 800,
                            }}>{checked ? "✓" : ""}</span>
                            <span style={{ fontWeight: 600, color: COLORS.navy, minWidth: 52 }}>{pmtLabel}</span>
                            {projRow ? (
                              <span style={{ color: COLORS.gray, fontSize: 12 }}>
                                Loan Balance: <strong style={{ color: COLORS.navy }}>{fmt(projRow.balance)}</strong>
                                {projRow.escrow > 0 && <> · Escrow Balance: <strong style={{ color: COLORS.blue }}>{fmt(projRow.escrow)}</strong></>}
                              </span>
                            ) : (
                              <span style={{ color: COLORS.gold, fontSize: 12, fontStyle: "italic" }}>skipped</span>
                            )}
                          </div>
                          {/* Advisory note for the closing-month payment */}
                          {isClosingMonth && isEarlyFunding && (
                            <div style={{ marginTop: 4, marginBottom: 2, padding: "7px 10px", background: `${COLORS.gold}14`, border: `1px solid ${COLORS.gold}55`, borderRadius: 6, fontSize: 12, color: COLORS.navy, lineHeight: 1.55, fontFamily: font }}>
                              <span style={{ fontWeight: 700, color: "#92651a" }}>⚠ Funding on the {fundingDay}{fundingDay===1?"st":fundingDay===2?"nd":fundingDay===3?"rd":"th"} — we recommend skipping this payment.</span> When closing and funding within the first 10 days of the month, making the payment can cause last-minute payoff figure issues as servicers may not update the balance in time. We've unchecked this by default.
                              <span style={{ display: "block", marginTop: 4, color: COLORS.gray }}>
                                <strong>Will this hurt my credit?</strong> No. Mortgage lates are only reported when the payment is 30+ days past due.
                              </span>
                            </div>
                          )}
                          {isClosingMonth && !isEarlyFunding && isLateFunding && (
                            <div style={{ marginTop: 4, marginBottom: 2, padding: "7px 10px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 6, fontSize: 12, color: COLORS.navy, lineHeight: 1.55, fontFamily: font }}>
                              <span style={{ fontWeight: 700 }}>💡 Consider making this payment.</span> Funding after the 10th generally gives the servicer enough time to update the payoff. Note: if funding falls after the 15th, your servicer may charge a late fee (~$100). <strong>This will NOT affect your credit</strong> — mortgage lates only report when 30+ days past due.
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {lbpCheckedPayments.length > 0 && (
                      <div style={{ marginTop: 4, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.navy, fontWeight: 700 }}>
                        <span>Loan Balance after the additional future payments</span>
                        <span style={{ color: COLORS.green }}>{fmt(lbpPaymentProjection.projectedBalance)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-draft tip */}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.navy, lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 700 }}>It's recommended to disable auto-draft once you start the refi.</span> An unexpected payment after the payoff is ordered can throw off the final payoff figure and cause last-minute delays.
                </div>
              </div>
              );
            })()}
          </div>

          {/* RIGHT — line-item payoff breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const cb = parseFloat(String(rs2Balance).replace(/,/g,"")) || 0;
              const rate = (parseFloat(raCurRate) || 0) / 100;
              const balAtFunding = lbpPaymentProjection.rows.length > 0 ? lbpPaymentProjection.projectedBalance : cb;
              const netEscrowAmt = raNetEsc ? (parseFloat(String(rs2NetEscrow).replace(/,/g, "")) || 0) : 0;
              if (!cb || !rate || !lbpLastPmt) return (
                <div style={{ padding: "12px 14px", background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 12, color: COLORS.gray, fontFamily: font, lineHeight: 1.6 }}>
                  💡 Enter Current Loan Balance, Interest Rate, and last payment date to calculate the estimated payoff.
                </div>
              );
              const dailyAmt = balAtFunding * rate / 365;
              const days = lbpPayoffDays;
              const perDiem = dailyAmt * days;
              const servicerFeeMin = 150;
              const servicerFeeMax = 200;
              const servicerFeeEst = 150;
              const fundingDay = lbpEffectiveFunding ? parseInt(lbpEffectiveFunding.split('-')[2]) : 0;
              const closingMonthDate = lbpAutoPaymentDates.length > 0 ? lbpAutoPaymentDates[lbpAutoPaymentDates.length - 1] : null;
              const closingMonthSkipped = closingMonthDate && lbpUncheckedSet.has(closingMonthDate);
              const lateFeeApplies = fundingDay > 15 && closingMonthSkipped;
              const lateFee = lateFeeApplies ? 100 : 0;
              const estimatedPayoff = lbpEstimatedPayoff || (balAtFunding - netEscrowAmt + perDiem + servicerFeeEst + lateFee);
              const refDate = lbpPaymentProjection.effectiveLastPmtDate || lbpLastPmt;
              const fundingFmt = new Date(lbpEffectiveFunding + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const refFmt = new Date(refDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const Row = ({ label, value, sub, accent, borderTop, large }) => (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: borderTop ? "8px 0 4px" : "4px 0", borderTop: borderTop ? `1px solid ${COLORS.border}` : "none" }}>
                  <span style={{ color: sub ? COLORS.grayLight : COLORS.gray, fontSize: sub ? 10 : 11, fontStyle: sub ? "italic" : "normal", flex: 1, paddingRight: 8, lineHeight: 1.4 }}>{label}</span>
                  <span style={{ fontWeight: large ? 800 : 600, color: accent || COLORS.navy, fontSize: large ? 15 : 12, whiteSpace: "nowrap" }}>{value}</span>
                </div>
              );
              return (
                <div style={{ padding: "14px 16px", background: `${COLORS.navy}07`, border: `1px solid ${COLORS.navy}22`, borderRadius: 8, fontFamily: font }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.navy, marginBottom: 10, letterSpacing: "0.04em" }}>📋 ESTIMATED PAYOFF BREAKDOWN</div>

                  {/* Step 1: Balance at funding */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.grayLight, letterSpacing: "0.07em", marginBottom: 4, textTransform: "uppercase" }}>Step 1 — Loan Balance at Funding</div>
                  <Row label={lbpPaymentProjection.rows.length > 0 ? `Current balance after ${lbpPaymentProjection.rows.length} payment${lbpPaymentProjection.rows.length > 1 ? "s" : ""} made before closing` : "Current loan balance"} value={fmt(Math.round(balAtFunding))} />
                  {netEscrowAmt > 0 && (
                    <Row label="Less: escrow balance netted from payoff" value={`− ${fmt(Math.round(netEscrowAmt))}`} sub accent={COLORS.green} />
                  )}
                  <div style={{ marginBottom: 10 }} />

                  {/* Step 2: Per-diem interest */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.grayLight, letterSpacing: "0.07em", marginBottom: 4, textTransform: "uppercase" }}>Step 2 — Per-Diem Interest Due</div>
                  <Row label={`Daily rate: ${parseFloat(raCurRate)||0}% ÷ 365 days`} value={`${fmt2(dailyAmt)}/day`} />
                  <Row label={`Days from ${refFmt} → funding (${fundingFmt})`} value={`× ${days} days`} />
                  <Row label="Per-diem interest total" value={fmt(Math.round(perDiem))} accent={COLORS.blue} />
                  <div style={{ marginBottom: 10 }} />

                  {/* Step 3: Servicer fee */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.grayLight, letterSpacing: "0.07em", marginBottom: 4, textTransform: "uppercase" }}>Step 3 — Servicer Fees</div>
                  <Row label={`Payoff statement fee (typically $${servicerFeeMin}–$${servicerFeeMax})`} value={`+ ${fmt(servicerFeeEst)}`} />
                  {lateFeeApplies && (
                    <Row label={`Late fee — payment skipped, funding on the ${fundingDay}th (after 15th)`} value={`+ ${fmt(lateFee)}`} accent={COLORS.gold} />
                  )}
                  <div style={{ marginBottom: 6 }} />

                  {/* Total */}
                  <div style={{ borderTop: `2px solid ${COLORS.navy}33`, paddingTop: 10, marginTop: 2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy }}>Estimated Payoff Amount</span>
                      <span style={{ fontSize: 17, fontWeight: 800, color: COLORS.navy }}>{fmt(Math.round(estimatedPayoff))}</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.grayLight, marginTop: 5, lineHeight: 1.5 }}>
                      Actual payoff must be ordered directly from your current servicer. This estimate is for planning purposes only. Good-through date on the official payoff will determine final per-diem days.
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>

        </div>
      </SectionCard>
      )}

      {/* ═══ REFI: LOAN SIZING WORKSHEET ═══ */}
      {purpose !== "purchase" && (() => {
        // Recalculate estimated payoff using same logic as Loan Balance & Payoff section
        const cb2 = parseFloat(String(rs2Balance).replace(/,/g,"")) || 0;
        const rate2 = (parseFloat(raCurRate) || 0) / 100;
        const balAtFunding2 = lbpPaymentProjection.rows.length > 0 ? lbpPaymentProjection.projectedBalance : cb2;
        const netEscrowAmt2 = raNetEsc ? (parseFloat(String(rs2NetEscrow).replace(/,/g,"")) || 0) : 0;
        const dailyAmt2 = rate2 > 0 ? balAtFunding2 * rate2 / 365 : 0;
        const fundingDay2 = lbpEffectiveFunding ? parseInt(lbpEffectiveFunding.split('-')[2]) : 0;
        const closingMonthDate2 = lbpAutoPaymentDates.length > 0 ? lbpAutoPaymentDates[lbpAutoPaymentDates.length - 1] : null;
        const closingMonthSkipped2 = closingMonthDate2 && lbpUncheckedSet.has(closingMonthDate2);
        const lateFee2 = (fundingDay2 > 15 && closingMonthSkipped2) ? 100 : 0;
        const estimatedPayoffAmt = cb2 > 0 && rate2 > 0
          ? Math.round(balAtFunding2 - netEscrowAmt2 + (dailyAmt2 * lbpPayoffDays) + 150 + lateFee2)
          : 0;

        const ccNum     = parseInt(fsMcCc) || 0;
        const escDep    = fsMcEscrowDep !== null
                          ? (parseInt(fsMcEscrowDep) || 0)
                          : Math.round(((calc.monthlyTax || 0) + (calc.monthlyIns || 0)) * 3);
        const ppNum     = waiveEscrows
          ? Math.max(0, (parseInt(fsMcPrepaids) || 0) - escDep)
          : (parseInt(fsMcPrepaids) || 0);
        const laNum     = parseFloat(String(loanAmount).replace(/,/g,'')) || 0;
        const totalUses = estimatedPayoffAmt + ccNum + ppNum;
        const netAtClose = totalUses - laNum;

        const rowStyle = { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", fontSize:13, fontFamily:font, borderBottom:`1px solid ${c.border}` };
        const labelStyle = { color:c.gray, fontWeight:400 };
        const valStyle = { fontWeight:600, color:c.navy };

        return (
          <React.Fragment>
          <SectionCard title="REFI: LOAN AMOUNT & STRUCTURE" accent={c.gold} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Left column — Home Value + Value Based On */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:c.gray, fontFamily:font, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>PROPERTY VALUE</div>
                <LabeledInput label="Home Value" prefix="$" value={homePrice} onChange={(v) => { if (parseFloat(String(v).replace(/,/g,'')) > 99999999) return; setHomePrice(v); }} useCommas infoTip="The agreed-upon sale price of the home. For a refinance, use the current appraised value. This drives your loan-to-value ratio (LTV), which affects your interest rate, PMI requirement, and loan program eligibility." />
                <Select label="Home Value Based On" value={valBasis} onChange={setValBasis} options={[
                  { value: "", label: "— Select —" },
                  { value: "guess", label: "Homeowner's Estimate" },
                  { value: "realtor", label: "Realtor's Opinion" },
                  { value: "cad", label: "CAD Tax Value" },
                  { value: "online", label: "Online Data (Zillow, Realtor.com, etc.)" },
                  { value: "appraisal", label: "Current Appraisal" },
                  { value: "placeholder", label: "Temp: Place Holder Estimate" },
                ]} />
                <Select label="Home Value Used is:" value={valConfidence} onChange={setValConfidence} options={[
                  { value: "", label: "— Select —" },
                  { value: "aggressive", label: "Aggressive" },
                  { value: "moderate", label: "Moderate" },
                  { value: "conservative", label: "Conservative" },
                ]} />
                <LabeledInput label="Loan Amount" prefix="$" value={loanAmount} onChange={(v) => { if (parseFloat(String(v).replace(/,/g,'')) > 99999999) return; setLoanAmount(v); }} useCommas infoTip="The amount you're borrowing — typically the purchase price minus your down payment. For a refinance, this is your current payoff balance or the new loan amount. Keep in mind that financed fees (like the VA funding fee or FHA upfront MIP) may be added to this." />
                {(() => {
                  const hp = parseFloat(String(homePrice).replace(/,/g,'')) || 0;
                  const la = parseFloat(String(loanAmount).replace(/,/g,'')) || 0;
                  if (hp <= 0 || la <= 0) return null;
                  const ltv = (la / hp) * 100;
                  const ltvColor = ltv > 95 ? COLORS.red : ltv > 80 ? COLORS.gold : COLORS.green;
                  const milestones = [80, 85, 90, 95];
                  const nextMilestone = milestones.find(function(m) { return ltv > m; });
                  const amtToNext = nextMilestone ? Math.round(la - hp * (nextMilestone / 100)) : 0;
                  return (
                    <div style={{ fontSize: 12, fontFamily: font, padding: "6px 10px", background: c.bgAlt, borderRadius: 6, border: `1px solid ${c.border}`, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: ltvColor, fontWeight: 700 }}>LTV {ltv.toFixed(1)}%</span>
                        <span style={{ color: c.gray }}>{fmt(Math.round(hp - la))} equity</span>
                      </div>
                      {nextMilestone && amtToNext > 0 && (
                        <div style={{ color: c.gray, marginTop: 4 }}>
                          Lower the loan amount by <strong style={{ color: c.navy }}>{fmt(amtToNext)}</strong> to reach <strong style={{ color: c.navy }}>{nextMilestone}% LTV</strong>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  const rpp = (parseFloat(rate) || 0) / 100 / 12;
                  const n   = (parseFloat(term) || 30) * 12;
                  if (rpp <= 0 || laNum <= 0 || n <= 0) return null;
                  const per5k = Math.round(pmt(rpp, n, 5000));
                  return (
                    <div style={{ fontSize: 12, color: c.gray, fontFamily: font, marginTop: 4, paddingLeft: 2 }}>
                      FYI: Every $5,000 financed ≈ <strong style={{ color: c.navy }}>${per5k}/mo</strong>
                    </div>
                  );
                })()}
              </div>
              {/* Right column — Loan Amount Calculation */}
              <div style={{ flex: 1, minWidth: 0, background:c.bgAlt||"#faf9f7", borderRadius:10, border:`1px solid ${c.border}`, padding:"14px 14px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:c.gray, fontFamily:font, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>CASH TO CLOSE BREAKDOWN</div>
                <div style={{ border:`1px solid ${c.border}`, borderRadius:8, overflow:"hidden" }}>
                  {laNum > 0
                    ? <div style={{ ...rowStyle, background: c.blueLight||"#e8f0fb" }}><span style={{ fontWeight:700, color:c.navy }}>Loan Amount</span><span style={{ fontWeight:800, color:c.blue }}>{fmt(laNum)}</span></div>
                    : <div style={{ ...rowStyle, fontStyle:"italic", color:c.gray, fontSize:12 }}><span>Loan Amount</span><span>Enter amount at left</span></div>
                  }
                  {estimatedPayoffAmt > 0
                    ? <div style={rowStyle}><span style={labelStyle}>Estimated Payoff Amount</span><span style={valStyle}>− {fmt(estimatedPayoffAmt)}</span></div>
                    : <div style={{ ...rowStyle, fontStyle:"italic", color:c.gray, fontSize:12 }}><span>Estimated Payoff Amount</span><span>Complete Loan Balance &amp; Payoff above</span></div>
                  }
                  {ccNum  > 0 && <div style={rowStyle}><span style={labelStyle}>Closing Costs <span style={{ fontStyle:"italic", fontWeight:400 }}>(from Fee Sheet)</span></span><span style={valStyle}>− {fmt(ccNum)}</span></div>}
                  {ppNum  > 0 && <div style={rowStyle}><span style={labelStyle}>Prepaids <span style={{ fontStyle:"italic", fontWeight:400 }}>(from Fee Sheet)</span></span><span style={valStyle}>− {fmt(ppNum)}</span></div>}
                  {(ccNum === 0 && ppNum === 0) && (
                    <div style={{ ...rowStyle, fontStyle:"italic", color:c.gray, fontSize:12 }}><span>Closing Costs &amp; Prepaids</span><span>Open Fee Sheet to populate</span></div>
                  )}
                  <div style={{ borderTop:`2px solid ${c.blue||"#2563eb"}44` }} />
                  {(() => {
                    const isReady = laNum > 0 && totalUses > 0;
                    const cashBack = netAtClose < 0;
                    const label = cashBack ? "CASH BACK AT CLOSING" : "AMOUNT DUE AT CLOSING";
                    const color = cashBack ? COLORS.green : c.blue;
                    const display = isReady ? fmt(Math.abs(Math.round(netAtClose))) : "—";
                    return (
                      <div style={{ ...rowStyle, borderBottom:"none", background: cashBack ? "#16a34a" : "#dc2626" }}>
                        <span style={{ fontWeight:700, color:"#fff" }}>{label}</span>
                        <span style={{ fontWeight:800, color:"#fff", fontSize:15 }}>{display}</span>
                      </div>
                    );
                  })()}
                </div>
              {(() => {
                const hp = parseFloat(String(homePrice).replace(/,/g,'')) || 0;
                const ltv = hp > 0 && laNum > 0 ? (laNum / hp) * 100 : 0;
                const newMonthlyPI = calc.monthlyPI || 0;
                const newTotalPITI = newMonthlyPI + (calc.monthlyTax || 0) + (calc.monthlyIns || 0) + (calc.monthlyPMI || 0);
                const isConvNoMI = isConvType && loanProgram !== "jumbo";
                const tips = [];

            // If amount due > $500, suggest a loan amount that brings ~$400 to closing
            if (netAtClose > 500 && laNum > 0 && totalUses > 0) {
              var targetLA  = Math.round((laNum + (netAtClose - 400)) / 50) * 50;
              var targetLTV = hp > 0 ? (targetLA / hp) * 100 : 0;
              tips.push({ icon: "💡", text: "Consider increasing the loan to " + fmt(targetLA) + " (" + targetLTV.toFixed(1) + "% LTV), which would bring approximately $400 to closing." });
            }

            if (tips.length === 0) return null;
            return (
              <div style={{ marginTop: 12, padding: "14px 18px", background: c.bgAlt || "#faf9f7", border: `1px solid ${c.border}`, borderRadius: 10, fontFamily: font, fontSize: 12, color: c.navy, lineHeight: 1.75 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: c.navy, marginBottom: 8 }}>Loan Structuring Suggestions</div>
                {tips.map(function(tip, i) {
                  return (
                    <div key={i} style={{ marginBottom: i < tips.length - 1 ? 12 : 0, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0 }}>{tip.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {tip.body ? tip.body : (
                          <div>
                            <div>{tip.text}</div>
                            {tip.items && tip.items.length > 0 && (
                              <ul style={{ margin: "4px 0 0", paddingLeft: 16, lineHeight: 1.7 }}>
                                {tip.items.map(function(item, j) {
                                  return <li key={j}>{item}</li>;
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
              })()}
              </div>
            </div>
          </SectionCard>
          </React.Fragment>
        );
      })()}

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
      {amortYears.length > 1 && (
        <>
          {equityTimeline.length > 1 && (
            <SectionCard title="PROJECTED EQUITY CURVE" accent={c.blue} style={{ maxWidth: 640 }}>
              <LabeledInput label="Appreciation Rate" value={pcAppr} onChange={setPcAppr} suffix="% / yr" hint={STATE_APPR_RATES[pcState] != null ? `${pcState} avg ≈ ${STATE_APPR_RATES[pcState]}% · Based on U.S. government home price data (5-yr avg) · Edit to override` : "Annual home value growth for equity projection"} infoTip="The estimated annual rate at which the home's value will grow. Historically, U.S. home values have appreciated 3-4% annually on average, though this varies significantly by market. This is used to project your equity over time." />
              <EquityProjectionChart timeline={equityTimeline} milestones={equityMilestones} />
            </SectionCard>
          )}
          <SectionCard title="BALANCE PAYDOWN" accent={c.blue} style={{ maxWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: s2AmortYears.length > 0 ? "1fr 1fr" : "1fr", gap: 20 }}>
              <div>
                {s2AmortYears.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.navy, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${c.navy}33` }}>1st Lien</div>
                )}
                <BalanceCurveChart years={amortYears} />
              </div>
              {s2AmortYears.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316", fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 4, borderBottom: "2px solid #f9731633" }}>
                    2nd Lien{s2Term === "balloon" ? " · 30/15 Balloon" : ""}
                  </div>
                  <BalanceCurveChart years={s2AmortYears} />
                  {s2Term === "balloon" && (() => {
                    const bb = s2AmortYears[s2AmortYears.length - 1]?.balloonBalance || 0;
                    if (bb <= 0) return null;
                    return (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 7 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#C0392B", fontFamily: font }}>⚠ Balloon Payment · Month 180</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#C0392B", fontFamily: font }}>{fmt(bb)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#C0392B", fontFamily: font, marginTop: 3, opacity: 0.8 }}>
                          Remaining principal due in full at end of Year 15
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </SectionCard>
          <SectionCard title="PRINCIPAL vs INTEREST BY YEAR" accent={c.blue} style={{ maxWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: s2AmortYears.length > 0 ? "1fr 1fr" : "1fr", gap: 20 }}>
              <div>
                {s2AmortYears.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.navy, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${c.navy}33` }}>1st Lien</div>
                )}
                <PIStackedBarChart years={amortYears} />
              </div>
              {s2AmortYears.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316", fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 4, borderBottom: "2px solid #f9731633" }}>2nd Lien</div>
                  <PIStackedBarChart years={s2AmortYears} />
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

window.PaymentCalculator = PaymentCalculator;
