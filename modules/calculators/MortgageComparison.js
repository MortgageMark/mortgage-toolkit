// modules/calculators/MortgageComparison.js
const { useMemo, useEffect } = React;
const useLocalStorage = window.useLocalStorage;
const COLORS          = window.COLORS;
const font            = window.font;
const pmt             = window.pmt;
const calcAPR         = window.calcAPR;
const fmt             = window.fmt;
const fmt2            = window.fmt2;
const getStateFees    = window.getStateFees;
const SectionCard     = window.SectionCard;
const LabeledInput    = window.LabeledInput;
const Select          = window.Select;
const MetricCard      = window.MetricCard;
const exportToPDF     = window.exportToPDF;
const exportToExcel    = window.exportToExcel;
const lookupPMICompany = window.lookupPMICompany;
const lookupPMI        = window.lookupPMI;
const InfoTip          = window.InfoTip;

const PRESET_TERMS_MC = ["30", "20", "15"];

// X/Y format: each number = % rate reduction for that year
const TEMP_BD_SCHEDULES = {
  "3/2/1": [3, 2, 1],
  "2/1":   [2, 1],
  "1/1":   [1, 1],
  "1/0":   [1],
};

// Default scenarios — start at zero/blank so fresh scenarios show empty fields.
// Once the user enters values in Payment Calculator the useEffect below syncs Scenario A.
function getDefaultScenarios() {
  const tryLS = (k) => { try { const v = localStorage.getItem("mtk_" + k); return v !== null ? JSON.parse(v) : ""; } catch { return ""; } };
  const hp   = tryLS("pc_hp")   || "";
  const rate = tryLS("pc_rate") || "";
  const term = tryLS("pc_term") || "30";
  const dp   = tryLS("pc_dp")   || "20";
  const base = { points: "0", pointsMode: "pct", sellerConc: "0", sellerConcMode: "dollar",
                 bdType: "none", bdPermRate: "", bdPermCost: "", bdPermCostMode: "pct", bdTempType: "none",
                 addlCosts: "", addlCostsMode: "dollar", addlCredits: "", addlCreditsMode: "dollar",
                 prog: "conventional", upfrontMiOvr: "", upfrontFinanced: "rolled_in", miOvr: "", customLabel: "" };
  return [
    { ...base, id: 1, label: "Scenario A", hp, downPct: dp, rate, term, color: COLORS.navy  },
    { ...base, id: 2, label: "Scenario B", hp: "", downPct: "20", rate: "", term: "30", color: COLORS.blue  },
    { ...base, id: 3, label: "Scenario C", hp: "", downPct: "20", rate: "", term: "30", color: "#E07B2A" },
  ];
}

function MortgageComparison() {

  // ── Payment Calculator bidirectional sync (Scenario A shares pc_* keys) ──
  const [pcHp,   setPcHp]   = useLocalStorage("pc_hp",   "437500");
  const [pcRate, setPcRate] = useLocalStorage("pc_rate", "6.75");
  const [pcTerm, setPcTerm] = useLocalStorage("pc_term", "30");
  const [pcDp,   setPcDp]   = useLocalStorage("pc_dp",   "20");

  const [pcLa]    = useLocalStorage("pc_la",    "350000");
  const [pcState] = useLocalStorage("pc_state", "TX");

  const [scenarios, setScenarios] = useLocalStorage("mc_sc", getDefaultScenarios());

  // ── Fee Sheet keys (read-only — pulled for closing cost estimates) ──
  const [fsState]      = useLocalStorage("fs_state",        "TX");
  const [fsClosingDate]= useLocalStorage("fs_closing_date", "");
  const [fsMt]         = useLocalStorage("fs_mt",           "625");
  const [fsMi]         = useLocalStorage("fs_mi",           "200");
  const [fsEsc]        = useLocalStorage("fs_esc",          true);
  const [fsSv]         = useLocalStorage("fs_sv",           true);
  const [fsOrigPct]    = useLocalStorage("fs_op",           "1.0");
  const [fsOvUw]       = useLocalStorage("fs_ov_uw",        "");
  const [fsDefUw]      = useLocalStorage("fs_def_uw",       "");
  const [fsOvProc]     = useLocalStorage("fs_ov_proc",      "");
  const [fsDefProc]    = useLocalStorage("fs_def_proc",     "");
  const [fsOvAppr]     = useLocalStorage("fs_ov_appr",      "");
  const [fsDefAppr]    = useLocalStorage("fs_def_appr",     "");
  const [fsOvCr]       = useLocalStorage("fs_ov_cr",        "");
  const [fsDefCr]      = useLocalStorage("fs_def_cr",       "");
  const [fsOvFlood]    = useLocalStorage("fs_ov_flood",     "");
  const [fsDefFlood]   = useLocalStorage("fs_def_flood",    "");
  const [fsOvTaxsvc]   = useLocalStorage("fs_ov_taxsvc",    "");
  const [fsDefTaxsvc]  = useLocalStorage("fs_def_taxsvc",   "");
  const [fsOvDocprep]  = useLocalStorage("fs_ov_docprep",   "");
  const [fsDefDocprep] = useLocalStorage("fs_def_docprep",  "");
  const [fsOvSurvey]   = useLocalStorage("fs_ov_survey",    "");
  const [fsDefSurvey]  = useLocalStorage("fs_def_survey",   "");
  const [fsOvEscfee]   = useLocalStorage("fs_ov_escfee",    "");
  const [fsDefEscrow]  = useLocalStorage("fs_def_escrow",   "");
  const [fsOvTsrch]    = useLocalStorage("fs_ov_tsrch",     "");
  const [fsDefTitle]   = useLocalStorage("fs_def_title",    "");

  // ── Exact totals published by FeeSheetGenerator (Scenario A uses these directly) ──
  const [fsMcCc]       = useLocalStorage("fs_mc_cc",       "0");
  const [fsMcPrepaids] = useLocalStorage("fs_mc_prepaids", "0");
  const [fsMcCtc]      = useLocalStorage("fs_mc_ctc",      "0");
  const [fsMcAddl]     = useLocalStorage("fs_mc_addl",     "0");
  const [fsMcCredits]  = useLocalStorage("fs_mc_credits",  "0");
  const [fsMcGovFee]   = useLocalStorage("fs_mc_gov_fee",  "0"); // VA/FHA/USDA financed upfront fee
  const [pcEffMi]      = useLocalStorage("pc_eff_mi",      "0"); // Payment Calc effective monthly PMI
  const [pcEffTax]     = useLocalStorage("pc_eff_tax",     "0"); // Payment Calc effective monthly tax
  const [pcEffIns]     = useLocalStorage("pc_eff_ins",     "0"); // Payment Calc effective monthly insurance
  const [fsDp]         = useLocalStorage("fs_dp",          "0"); // Fee Sheet discount points %
  const [fsSc]         = useLocalStorage("fs_sc",          "");  // Fee Sheet seller concessions $
  const [fsLt]         = useLocalStorage("fs_lt",          "conv"); // Fee Sheet loan type
  const [fsTempBdType]  = useLocalStorage("fs_temp_bd",   "none"); // Temp buydown type from Fee Sheet (read-only)
  const [fsFicoScore]   = useLocalStorage("pc_fico",         "740");  // Primary FICO from Payment Calc
  const [fsCoBorFico]   = useLocalStorage("pc_cofico",       "740");  // Co-borrower FICO
  const [fsBorrowCount] = useLocalStorage("pc_borrowers",    "1");    // Borrower count
  const [pcProg]        = useLocalStorage("pc_prog",         "conventional"); // Payment Calc loan program
  const [pcUpfrontMode] = useLocalStorage("pc_upfront_mode", "rolled_in");   // Fee Sheet upfront MI mode

  // ── PC → Scenario A (push PC values into Scenario A) ──
  useEffect(() => {
    setScenarios(prev => {
      const a = prev.find(s => s.id === 1);
      if (!a) return prev;
      if (a.hp === pcHp && a.rate === pcRate && a.term === pcTerm && a.downPct === pcDp && a.prog === pcProg) return prev;
      return prev.map(s => s.id === 1 ? { ...s, hp: pcHp, rate: pcRate, term: pcTerm, downPct: pcDp, prog: pcProg } : s);
    });
  }, [pcHp, pcRate, pcTerm, pcDp, pcProg]);

  // ── One-time migration: fix Scenario C color if still stored as green ──
  useEffect(() => {
    setScenarios(prev => {
      const c = prev.find(s => s.id === 3);
      if (!c || c.color === "#E07B2A") return prev;
      return prev.map(s => s.id === 3 ? { ...s, color: "#E07B2A" } : s);
    });
  }, []);

  // ── One-time migration: bdTempType now drives buydown for B & C. ──
  // Old stored scenarios had bdType:"none" + bdTempType:"2/1" (stale default).
  // Reset bdTempType to "none" whenever bdType was "none" so no phantom buydown appears.
  useEffect(() => {
    setScenarios(prev => {
      const needs = prev.some(s => s.id !== 1 && (s.bdType === "none" || !s.bdType) && s.bdTempType && s.bdTempType !== "none");
      if (!needs) return prev;
      return prev.map(s =>
        s.id !== 1 && (s.bdType === "none" || !s.bdType) && s.bdTempType && s.bdTempType !== "none"
          ? { ...s, bdTempType: "none" }
          : s
      );
    });
  }, []);

  // ── One-time migration: fix B/C downPct precision when HP matches PC ──
  // When B/C were reset from PC, downPct got pcDp's rounded value (e.g. "9.412").
  // 425000 × 9.412/100 = 40,001 — off by $1. Re-derive from pcHp - pcLa so the
  // dollar hint is exact. Only fixes scenarios whose HP matches PC's HP.
  useEffect(() => {
    const hpNum = parseFloat(pcHp) || 0;
    const laNum = parseFloat(pcLa) || 0;
    if (hpNum <= 0 || laNum <= 0) return;
    const exactDown  = Math.round(hpNum - laNum);
    const exactDpPct = ((hpNum - laNum) / hpNum * 100).toFixed(4);
    setScenarios(prev => {
      const needs = prev.some(s =>
        s.id !== 1 &&
        Math.abs((parseFloat(s.hp) || 0) - hpNum) < 1 &&
        Math.round((parseFloat(s.hp) || 0) * (parseFloat(s.downPct) || 0) / 100) !== exactDown
      );
      if (!needs) return prev;
      return prev.map(s => {
        if (s.id === 1) return s;
        if (Math.abs((parseFloat(s.hp) || 0) - hpNum) < 1 &&
            Math.round((parseFloat(s.hp) || 0) * (parseFloat(s.downPct) || 0) / 100) !== exactDown) {
          return { ...s, downPct: exactDpPct };
        }
        return s;
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update a field; Scenario A also writes back to pc_* keys
  const updateScenario = (id, field, value) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    if (id === 1) {
      if (field === "hp")      setPcHp(value);
      if (field === "rate")    setPcRate(value);
      if (field === "term")    setPcTerm(value);
      if (field === "downPct") setPcDp(value);
    }
  };

  // Reset a scenario's core fields back to current Payment Calculator / Fee Sheet values
  const resetScenarioToPC = (id) => {
    // Derive exact down % from pcHp - pcLa to avoid rounding artifacts from stored pcDp
    const hpNum = parseFloat(pcHp) || 0;
    const laNum = parseFloat(pcLa) || 0;
    const exactDpPct = hpNum > 0 && laNum > 0
      ? ((hpNum - laNum) / hpNum * 100).toFixed(4)
      : pcDp;
    setScenarios(prev => prev.map(s =>
      s.id === id
        ? { ...s, hp: pcHp, rate: pcRate, term: pcTerm, downPct: exactDpPct,
            bdTempType: fsTempBdType || "none",
            sellerConc: fsSc || "0", sellerConcMode: "dollar",
            points: fsDp || "0", pointsMode: "pct",
            addlCosts: "", addlCostsMode: "dollar",
            addlCredits: "", addlCreditsMode: "dollar",
            prog: pcProg || "conventional",
            upfrontMiOvr: "",
            upfrontFinanced: pcUpfrontMode || "rolled_in",
            miOvr: "" }
        : s
    ));
  };

  // ── Fee sheet fixed values (not per-loan) ──
  // Uses same ov/def logic as FeeSheetGenerator. Discount points are EXCLUDED
  // since each scenario has its own "points" field.
  const fsHelpers = useMemo(() => {
    const st  = getStateFees(fsState);
    const ov  = (val, fb)  => { const n = parseFloat(val);    return (val    !== "" && !isNaN(n)) ? n : fb; };
    const def = (cust, hd) => { const n = parseFloat(cust);   return (cust   !== "" && !isNaN(n)) ? n : hd; };

    const underwriting  = ov(fsOvUw,      def(fsDefUw,      1000));
    const processingFee = ov(fsOvProc,    def(fsDefProc,    595));
    const appraisal     = ov(fsOvAppr,    def(fsDefAppr,    750));
    const creditReport  = ov(fsOvCr,      def(fsDefCr,      350));
    const floodCert     = ov(fsOvFlood,   def(fsDefFlood,   st.floodCert     || 14));
    const taxService    = ov(fsOvTaxsvc,  def(fsDefTaxsvc,  st.taxServiceFee || 85));
    const docPrep       = ov(fsOvDocprep, def(fsDefDocprep, 250));
    const survey        = fsSv ? ov(fsOvSurvey, def(fsDefSurvey, st.surveyFee || 450)) : 0;
    // Sum of fees that do NOT change per scenario loan amount
    const fixedThirdParty = appraisal + creditReport + floodCert + taxService + docPrep + survey;
    // APR finance charges (fixed portion — origination/discount added per scenario)
    const aprFixedFees = floodCert + taxService + docPrep;

    // Prepaid interest days from Fee Sheet closing date
    const today     = new Date();
    const defaultCD = `${today.getFullYear()}-${String(today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2).padStart(2, "0")}-15`;
    const cdStr     = fsClosingDate || defaultCD;
    const [cdY, cdM, cdD] = cdStr.split("-").map(Number);
    const cdYear    = cdY || today.getFullYear();
    const cdMonth   = cdM || (today.getMonth() + 2);
    const cdDay     = cdD || 15;
    const daysInMo  = new Date(cdYear, cdMonth, 0).getDate();
    const prepaidDays = Math.max(1, daysInMo - cdDay + 1);

    // Insurance/tax-based prepaids (same across all scenarios)
    const mIns = parseFloat(fsMi) || 0;
    const mTax = parseFloat(fsMt) || 0;
    const homeownersInsAmt = Math.round(mIns * 12);          // 12-mo premium
    const taxRes = fsEsc ? Math.round(mTax * 3) : 0;         // 3-mo tax reserves
    const insRes = fsEsc ? Math.round(mIns * 3) : 0;         // 3-mo ins reserves
    const fixedPrepaids = homeownersInsAmt + taxRes + insRes; // prepaid interest added per-loan

    return { st, underwriting, processingFee, fixedThirdParty, aprFixedFees, prepaidDays, fixedPrepaids };
  }, [fsState, fsClosingDate, fsMt, fsMi, fsEsc, fsSv,
      fsOvUw, fsDefUw, fsOvProc, fsDefProc, fsOvAppr, fsDefAppr,
      fsOvCr, fsDefCr, fsOvFlood, fsDefFlood, fsOvTaxsvc, fsDefTaxsvc,
      fsOvDocprep, fsDefDocprep, fsOvSurvey, fsDefSurvey]);

  // Qualifying FICO — minimum across all borrowers (same logic as PaymentCalculator)
  const qualifyingFico = (() => {
    const scores = [parseInt(fsFicoScore) || 740];
    if (fsBorrowCount !== "1") scores.push(parseInt(fsCoBorFico) || 740);
    return Math.min(...scores);
  })();

  // Derive PMI rate from Payment Calculator's exact monthly MI ÷ Scenario A's computed LA.
  // Using pcHp/pcDp (not pc_la input) gives the true computed loan amount for Scenario A.
  // Applying this rate to all scenarios ensures B/C match A when inputs are identical.
  const pcEffMiNum       = parseFloat(pcEffMi) || 0;
  const scenALa          = Math.round((parseFloat(pcHp) || 0) * (1 - (parseFloat(pcDp) || 0) / 100));
  const pcDerivedPmiRate = scenALa > 0 && pcEffMiNum > 0 ? (pcEffMiNum * 12) / scenALa : null;

  // ── Core scenario math + closing cost estimates ──
  const analyses = useMemo(() => {
    const { st, underwriting, processingFee, fixedThirdParty, aprFixedFees, prepaidDays, fixedPrepaids } = fsHelpers;
    const ov  = (val, fb)  => { const n = parseFloat(val);  return (val  !== "" && !isNaN(n)) ? n : fb; };
    const def = (cust, hd) => { const n = parseFloat(cust); return (cust !== "" && !isNaN(n)) ? n : hd; };

    return scenarios.map(s => {
      // Scenario A always uses live Payment Calculator values so stale mc_sc data can't skew calcs
      const hp      = s.id === 1 ? (parseFloat(pcHp)   || 0)  : (parseFloat(s.hp || "425000") || 0);
      const dpPct   = s.id === 1 ? (parseFloat(pcDp)   || 0)  : (parseFloat(s.downPct) || 0);
      const dp      = dpPct / 100;
      const baseLa  = Math.round(hp * (1 - dp));   // loan amount before any upfront MI roll-in
      const downPayment = Math.round(hp * dp);
      const r       = s.id === 1 ? ((parseFloat(pcRate) || 0) / 100 / 12) : ((parseFloat(s.rate) || 0) / 100 / 12);
      const termYrs = s.id === 1 ? (parseFloat(pcTerm) || 30) : (parseFloat(s.term) || 30);
      const n           = Math.round(termYrs * 12);

      // ── Loan program & upfront MI ────────────────────────────────────────
      const prog = s.id === 1 ? pcProg : (s.prog || "conventional");
      // Default upfront MI pct by program (FHA 1.75%, VA 2.3% standard, USDA 1%)
      const defUpfrontPct = prog === "fha" ? 0.0175 : prog === "va" ? 0.023 : prog === "usda" ? 0.01 : 0;
      const defUpfrontMi  = Math.round(baseLa * defUpfrontPct);
      // Scenario A: Fee Sheet is the source of truth; B/C: use override or default
      const upfrontMiFee = s.id === 1
        ? (parseInt(fsMcGovFee) || 0)
        : (s.upfrontMiOvr !== "" && s.upfrontMiOvr !== undefined
            ? (parseFloat(s.upfrontMiOvr) || 0)
            : defUpfrontMi);
      // Financed mode: Scenario A reads from Fee Sheet; B/C from their own field
      const upfrontFinanced = s.id === 1 ? pcUpfrontMode : (s.upfrontFinanced || "rolled_in");
      // Effective loan amount used for P&I calculation
      const la = upfrontFinanced === "rolled_in" ? Math.round(baseLa + upfrontMiFee) : baseLa;
      // When paid at closing, upfront MI appears as a closing cost rather than in LA
      const upfrontAsCost = upfrontFinanced === "paid_closing" ? upfrontMiFee : 0;

      // Scenario A: always pull points and seller concessions from the Fee Sheet
      const rawPoints   = s.id === 1 ? (parseFloat(fsDp)  || 0) : (parseFloat(s.points)          || 0);
      const rawSc       = s.id === 1
        ? (parseFloat(fsSc)  || 0)
        : (s.sellerConc !== undefined && s.sellerConc !== ""
            ? (parseFloat(s.sellerConc) || 0)
            : (parseFloat(fsSc) || 0));
      const pointsMode  = s.id === 1 ? "pct" : (s.pointsMode || "pct");
      const scMode      = s.id === 1 ? "dollar" : (s.sellerConcMode || "dollar");
      const pts         = pointsMode === "dollar" ? Math.round(rawPoints) : Math.round(la * rawPoints / 100);
      const sellerConc  = scMode === "pct" ? Math.round(hp * rawSc / 100) : Math.round(rawSc);
      const monthlyPI   = pmt(r, n, la);
      const ltv         = hp > 0 ? (baseLa / hp * 100) : 0;  // LTV on base LA, not inflated by MI
      // Monthly MI — program-aware (matches PaymentCalculator logic)
      const pmiMonthly = (() => {
        if (baseLa <= 0) return 0;
        // VA: no monthly MI
        if (prog === "va") return 0;
        // FHA: monthly MIP per HUD Mortgagee Letter 2023-05
        if (prog === "fha") {
          const hiBalance = baseLa > 726200;
          let mipRate;
          if (termYrs <= 15) {
            mipRate = hiBalance ? (ltv > 90 ? 0.65 : 0.40) : (ltv > 90 ? 0.40 : 0.15);
          } else {
            mipRate = hiBalance ? (ltv > 95 ? 0.75 : 0.70) : (ltv > 95 ? 0.55 : 0.50);
          }
          return Math.round(baseLa * mipRate / 100 / 12);
        }
        // USDA: 0.35% annual guarantee fee
        if (prog === "usda") return Math.round(baseLa * 0.35 / 100 / 12);
        // Conventional: PMI only when LTV > 80%
        if (dp >= 0.20) return 0;
        if (pcDerivedPmiRate !== null) return Math.round(baseLa * pcDerivedPmiRate / 12);
        // Fallback: FICO-adjusted company table lookup
        const params = { ltv, fico: qualifyingFico, termYears: termYrs, isMultiBorrower: fsBorrowCount !== "1" };
        const enactR  = lookupPMICompany("enact",  params);
        const essentR = lookupPMICompany("essent", params);
        let rate = null;
        if (enactR !== null && essentR !== null) rate = Math.min(enactR, essentR);
        else if (enactR  !== null) rate = enactR;
        else if (essentR !== null) rate = essentR;
        if (rate === null) { const res = lookupPMI({ ltv, fico: qualifyingFico, termYears: termYrs }); rate = res.rate; }
        return rate != null ? Math.round(baseLa * rate / 12) : Math.round(baseLa * 0.005 / 12);
      })();
      // Monthly MI: Scenario A uses Payment Calc effective MI; B/C use override ($/mo) if set
      const effectivePmi = s.id === 1
        ? pcEffMiNum
        : (s.miOvr !== "" && s.miOvr !== undefined
            ? Math.round(parseFloat(s.miOvr) || 0)
            : pmiMonthly);
      const totalInterest = (n > 0 && monthlyPI > 0) ? (monthlyPI * n) - la : 0;

      // ── Closing costs (excl. discount points — entered per scenario) ──
      const origination = Math.round(la * (parseFloat(fsOrigPct) || 0) / 100);
      const lenderFees  = origination + underwriting + processingFee; // no discount pts

      // Title fees scaled to this scenario's HP and LA
      const ownerTitle  = hp > 0 ? (st.basicRate ? st.basicRate(hp) : 0) : 0;
      const lenderTitle = la > 0 ? Math.round((st.basicRate ? st.basicRate(la) : 0) * (st.simultaneousRate || 0.35)) : 0;
      const escrowCalc  = Math.round(Math.max(500, hp * 0.001));
      const escrowFee   = ov(fsOvEscfee, def(fsDefEscrow, escrowCalc));
      const titleSearch = ov(fsOvTsrch,  def(fsDefTitle,  250));
      // 150 recording + 50 courier + 25 tax cert/e-recording
      const titleFees   = ownerTitle + lenderTitle + escrowFee + titleSearch + 225;

      const closingCosts = lenderFees + fixedThirdParty + titleFees;

      // ── Prepaids (prepaid interest is loan/rate-specific) ──
      const dailyInterest   = la > 0 ? (la * (s.id === 1 ? (parseFloat(pcRate) || 0) : (parseFloat(s.rate) || 0)) / 100) / 365 : 0;
      const prepaidInterest = Math.round(dailyInterest * prepaidDays);
      const prepaids        = prepaidInterest + fixedPrepaids;

      // ── Closing costs, prepaids, and CTC — Fee Sheet is the source of truth ──
      // All scenarios use the Fee Sheet's exact fee totals. The only per-scenario
      // "swaps" are discount points and seller concessions (entered per-scenario on this page).
      // Prepaid interest recalculates for each scenario's own rate + loan amount;
      // the fixed portion (insurance premium, tax/ins reserves) stays from the Fee Sheet.
      const fsCC           = parseInt(fsMcCc)       || 0;
      const fsPre          = parseInt(fsMcPrepaids) || 0;
      const fsCtc          = parseInt(fsMcCtc)      || 0;
      const fsDiscPts      = Math.round(la * (parseFloat(fsDp) || 0) / 100);
      const fsSCnum        = parseFloat(fsSc) || 0;
      const fsMcAddlNum    = parseInt(fsMcAddl)    || 0;
      const fsMcCreditsNum = parseInt(fsMcCredits) || 0;
      // Non-SC credits (earnest, option, lender credits) = total FS credits minus FS seller concessions
      const fsNonScCredits = Math.max(0, fsMcCreditsNum - fsSCnum);

      // B & C free-form adjustments — LO-entered costs/credits for program-specific line items
      const addlCostsVal    = s.id !== 1 ? (parseFloat(s.addlCosts)   || 0) : 0;
      const addlCreditsVal  = s.id !== 1 ? (parseFloat(s.addlCredits) || 0) : 0;
      const addlCostsMode   = s.addlCostsMode   || "dollar";
      const addlCreditsMode = s.addlCreditsMode || "dollar";
      const addlCostsDollar   = la > 0 && addlCostsVal > 0
        ? (addlCostsMode   === "pct" ? Math.round(la * addlCostsVal   / 100) : Math.round(addlCostsVal)) : 0;
      const addlCreditsDollar = la > 0 && addlCreditsVal > 0
        ? (addlCreditsMode === "pct" ? Math.round(la * addlCreditsVal / 100) : Math.round(addlCreditsVal)) : 0;

      let finalClosingCosts = closingCosts;
      let finalPrepaids     = prepaids;
      let cashNeeded;
      const usesFSValues    = fsCC > 0; // true whenever the Fee Sheet has been populated

      if (fsCC > 0) {
        // FS CC minus FS disc pts; each scenario's own pts are added in display + cashNeeded
        finalClosingCosts = fsCC - fsDiscPts;

        if (s.id === 1) {
          // Scenario A: FS prepaids already reflect A's rate and closing date — use as-is
          if (fsPre > 0) finalPrepaids = fsPre;
          // Calculate fresh from components (same structure as B/C) so stale fs_mc_ctc snapshots
          // don't diverge from what the line-item rows display.
          cashNeeded = Math.max(0, downPayment + pts + finalClosingCosts + fsMcAddlNum + finalPrepaids - fsMcCreditsNum + upfrontAsCost);
        } else {
          // B/C: strip A's estimated per-diem interest from FS prepaids, add this scenario's own.
          // Insurance premium + tax/ins reserves stay unchanged (same property, same FS values).
          const aPrepaidInterest  = Math.round(scenALa * (parseFloat(pcRate) || 0) / 100 / 365 * prepaidDays);
          const fixedPrepaidsFS   = Math.max(0, (fsPre || 0) - aPrepaidInterest);
          const bcPrepaidInterest = Math.round(la * (parseFloat(s.rate) || 0) / 100 / 365 * prepaidDays);
          finalPrepaids = fixedPrepaidsFS + bcPrepaidInterest;
          // dp + pts + FS CC (no FS pts) + FS addl fees + recalc prepaids − non-SC credits − this scenario's SC ± addl adj + upfront MI paid at closing
          cashNeeded = Math.max(0, downPayment + pts + finalClosingCosts + fsMcAddlNum + finalPrepaids - fsNonScCredits - sellerConc + addlCostsDollar - addlCreditsDollar + upfrontAsCost);
        }
      } else {
        // Fee Sheet not yet populated — fall back to estimate
        cashNeeded = Math.max(0, downPayment + pts + finalClosingCosts + finalPrepaids - sellerConc + addlCostsDollar - addlCreditsDollar + upfrontAsCost);
      }

      // APR: origination + discount pts + UW + processing + flood + tax svc + doc prep
      const aprFees = origination + pts + underwriting + processingFee + aprFixedFees;
      const annualRate = s.id === 1 ? (parseFloat(pcRate) || 0) : (parseFloat(s.rate) || 0);
      const apr = la > 0 && annualRate > 0 ? calcAPR(la, annualRate, termYrs, aprFees) : annualRate;

      return {
        ...s,                   // preserves raw buydown fields (bdType, bdPermRate, etc.)
        rate: s.id === 1 ? String(parseFloat(pcRate) || 0) : (s.rate || ""),
        hp, baseLa, la, downPayment, dpPct, monthlyPI, pmiMonthly: effectivePmi, pmiAuto: pmiMonthly,
        totalInterest, ltv,
        pts, sellerConc, cashNeeded, n, termYrs,
        closingCosts: finalClosingCosts, prepaids: finalPrepaids, apr,
        usesFSValues,           // true when B/C use Fee Sheet exact values (same HP+DP as A)
        addlCostsDollar, addlCreditsDollar,
        prog, upfrontMiFee, defUpfrontPct, upfrontFinanced, upfrontAsCost,
      };
    });
  // scenProgsKey: explicit dep so any scenario program change guarantees recomputation
  }, [scenarios, scenarios.map(s=>s.prog||'').join(','), fsHelpers, fsOrigPct, fsOvEscfee, fsDefEscrow, fsOvTsrch, fsDefTitle,
      fsMcCc, fsMcPrepaids, fsMcCtc, fsMcAddl, fsMcCredits, fsDp, fsSc, fsMcGovFee,
      fsFicoScore, fsCoBorFico, fsBorrowCount,
      pcHp, pcDp, pcRate, pcTerm, pcProg, pcUpfrontMode, pcDerivedPmiRate]);

  // ── Per-scenario buydown calculations ──
  const perScenarioBD = useMemo(() => analyses.map(a => {
    // Scenario A: bdType is always driven by the Fee Sheet's temp buydown setting.
    // B/C: bdType is derived from their Structure selection (bdTempType).
    const bdType = a.id === 1
      ? (fsTempBdType && fsTempBdType !== "none" ? "temporary" : "none")
      : (a.bdTempType && a.bdTempType !== "none" ? "temporary" : "none");
    if (bdType === "none") return { type: "none" };

    const { la, monthlyPI: baseMPI, termYrs, n } = a;
    const baseRate = parseFloat(a.rate) || 0;

    const calcPerm = () => {
      const bdRate = parseFloat(a.bdPermRate) || 0;
      if (!bdRate)            return { type: "permanent", noRate: true };
      if (bdRate >= baseRate) return { type: "permanent", rateError: true, baseRate };
      const bdMPI          = pmt(bdRate / 100 / 12, n, la);
      const monthlySavings = baseMPI - bdMPI;
      const costMode       = a.bdPermCostMode || "pct";
      const costVal        = parseFloat(a.bdPermCost) || 0;
      const cost           = costMode === "pct" ? Math.round(la * costVal / 100) : Math.round(costVal);
      const costPct        = la > 0 ? (costMode === "pct" ? costVal : costVal / la * 100) : 0;
      const breakevenMonths = (cost > 0 && monthlySavings > 0) ? Math.ceil(cost / monthlySavings) : null;
      return {
        type: "permanent", baseRate, bdRate, baseMPI, bdMPI, monthlySavings,
        cost, costPct, la, breakevenMonths, termYrs,
        net5yr:  monthlySavings * 60  - cost,
        net10yr: monthlySavings * 120 - cost,
      };
    };

    const calcTemp = () => {
      // Scenario A: structure is always read from the Fee Sheet (fs_temp_bd)
      const tempType   = a.id === 1 ? fsTempBdType : (a.bdTempType || "2/1");
      const reductions = TEMP_BD_SCHEDULES[tempType];
      // If no valid schedule (e.g. Fee Sheet has "none"), return a placeholder
      if (!reductions) return { type: "temporary", tempType, years: null, totalSubsidy: 0 };
      let totalSubsidy = 0;
      const years = reductions.map((redPct, i) => {
        const yRate          = Math.max(0.01, baseRate - redPct);
        const yMPI           = pmt(yRate / 100 / 12, n, la);
        const monthlySavings = baseMPI - yMPI;
        const yearSubsidy    = monthlySavings * 12;
        totalSubsidy += yearSubsidy;
        return { year: i + 1, rate: yRate, payment: yMPI, monthlySavings, yearSubsidy };
      });
      years.push({ year: reductions.length + 1, rate: baseRate, payment: baseMPI, monthlySavings: 0, yearSubsidy: 0, isFull: true });
      return { type: "temporary", baseRate, baseMPI, years, totalSubsidy, tempType, la };
    };

    if (bdType === "permanent") return calcPerm();
    if (bdType === "temporary") return calcTemp();
    if (bdType === "both")      return { type: "both", perm: calcPerm(), temp: calcTemp() };

    return { type: "none" };
  }), [analyses, fsTempBdType]);

  // ── Buydown cost helpers ──────────────────────────────────────────────────
  // FeeSheetGenerator bakes tempBdCost into lenderFees → displayClosingCosts → fsMcCtc.
  // So A's cashNeeded (via fsMcCtc) already contains A's BD subsidy, AND B/C's
  // cashNeeded also contains it (via fsCC = fsMcCc = displayClosingCosts).
  // effectiveCtc strips A's embedded BD from B/C and substitutes their own BD cost.
  const getBdCost = (bd) => {
    if (!bd || bd.type === "none") return 0;
    if (bd.type === "permanent") return bd.cost || 0;
    if (bd.type === "temporary") return Math.round(bd.totalSubsidy || 0);
    if (bd.type === "both") return (bd.perm?.cost || 0) + Math.round(bd.temp?.totalSubsidy || 0);
    return 0;
  };

  const aBdCost = getBdCost(perScenarioBD[0]); // A's temp BD subsidy (from Fee Sheet)

  const effectiveCtc = (a, i) => {
    const bdCost = getBdCost(perScenarioBD[i]);
    if (!a.usesFSValues) {
      // No Fee Sheet data — BD not embedded in any cashNeeded, just add each scenario's own
      return a.cashNeeded + bdCost;
    }
    if (a.id === 1) return a.cashNeeded; // A: fsMcCtc already correct (includes A's BD)
    // B/C: cashNeeded embeds A's BD via fsCC — replace it with B/C's own BD cost
    return a.cashNeeded + (bdCost - aBdCost);
  };

  // ── Inline sub-components ──────────────────────────────────────────────

  const StatBox = ({ label, value, color }) => (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  padding: "6px 8px", flex: 1, minWidth: 70 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.gray, fontFamily: font,
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: color || COLORS.navy, fontFamily: font }}>{value}</div>
    </div>
  );

  // Pill toggle for buydown cost mode
  const CostModePills = ({ mode, onChange }) => (
    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
      {[["pct", "% of Loan"], ["dollar", "$ Amount"]].map(([v, lbl]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: "4px 0", borderRadius: 5, cursor: "pointer", fontFamily: font,
          border: `1px solid ${mode === v ? COLORS.gold : COLORS.border}`,
          background: mode === v ? `${COLORS.gold}22` : "transparent",
          color: mode === v ? COLORS.gold : COLORS.gray,
          fontSize: 12, fontWeight: 700,
        }}>{lbl}</button>
      ))}
    </div>
  );

  // Renders one buydown card for a given scenario
  const renderBDCard = (a, bd) => {
    // Scenario A: buydown type is always forced by the Fee Sheet (read-only).
    // B/C: bdType derived from their Structure selection (bdTempType drives everything).
    const bdType   = a.id === 1
      ? (fsTempBdType && fsTempBdType !== "none" ? "temporary" : "none")
      : (a.bdTempType && a.bdTempType !== "none" ? "temporary" : "none");
    const costMode = a.bdPermCostMode || "pct";
    const upd      = (f, v) => updateScenario(a.id, f, v);

    const rawCost = parseFloat(a.bdPermCost) || 0;
    let costHint = "";
    if (a.la > 0 && rawCost > 0) {
      costHint = `${rawCost} pts × ${fmt(a.la)} = ${fmt(Math.round(a.la * rawCost / 100))}`;
    }

    const showPerm = bdType === "permanent" || bdType === "both";
    const showTemp = bdType === "temporary" || bdType === "both";
    const permBd   = bd.type === "both" ? bd.perm : bd;
    const tempBd   = bd.type === "both" ? bd.temp : bd;

    const PermResults = ({ pbd }) => {
      if (pbd.noRate) return (
        <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, padding: "8px 0" }}>
          Enter a buydown rate above to see analysis.
        </div>
      );
      if (pbd.rateError) return (
        <div style={{ fontSize: 12, color: COLORS.red, fontFamily: font, padding: "8px 0" }}>
          Rate must be lower than the base rate ({pbd.baseRate}%).
        </div>
      );
      return (<>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10, marginBottom: 6 }}>
          <StatBox label="Base Pmt"  value={fmt2(pbd.baseMPI)}        color={COLORS.navy}  />
          <StatBox label="BD Pmt"    value={fmt2(pbd.bdMPI)}          color={COLORS.green} />
          <StatBox label="Saves/mo"  value={fmt2(pbd.monthlySavings)} color={COLORS.green} />
        </div>
        {pbd.cost > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            <StatBox label="BD Cost"  value={fmt(pbd.cost)} color={COLORS.gold} />
            {pbd.breakevenMonths && <StatBox label="Breakeven" value={`${pbd.breakevenMonths} mo`} color={COLORS.blue} />}
            <StatBox label="Net 5yr"
              value={pbd.net5yr  >= 0 ? fmt(Math.round(pbd.net5yr))  : `(${fmt(Math.round(-pbd.net5yr))})`}
              color={pbd.net5yr  >= 0 ? COLORS.green : COLORS.red} />
            <StatBox label="Net 10yr"
              value={pbd.net10yr >= 0 ? fmt(Math.round(pbd.net10yr)) : `(${fmt(Math.round(-pbd.net10yr))})`}
              color={pbd.net10yr >= 0 ? COLORS.green : COLORS.red} />
          </div>
        )}
        {pbd.breakevenMonths && (() => {
          const bkPct  = Math.min(100, (pbd.breakevenMonths / (pbd.termYrs * 12)) * 100);
          const bkYrs  = (pbd.breakevenMonths / 12).toFixed(1);
          const rdxPct = (pbd.baseRate - pbd.bdRate).toFixed(3).replace(/\.?0+$/, "");
          return (
            <div style={{ background: COLORS.bgAlt, borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font, marginBottom: 6 }}>
                Breakeven Analysis
              </div>
              <div style={{ fontSize: 12, color: COLORS.navy, fontFamily: font, lineHeight: 1.65, marginBottom: 8 }}>
                Reducing your rate from <strong>{pbd.baseRate}%</strong> to <strong>{pbd.bdRate}%</strong> (a <strong>{rdxPct}%</strong> reduction) saves{" "}
                <strong style={{ color: COLORS.green }}>{fmt2(pbd.monthlySavings)}/mo</strong>.{" "}
                At a cost of <strong style={{ color: COLORS.gold }}>{fmt(pbd.cost)}</strong>, you won't see the benefit of this buydown until{" "}
                <strong style={{ color: COLORS.blue }}>month {pbd.breakevenMonths} ({bkYrs} yrs)</strong>.{" "}
                After that, you pocket {fmt2(pbd.monthlySavings)}/mo for the remaining life of the loan.
              </div>
              <div style={{ height: 8, background: COLORS.border, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${bkPct.toFixed(1)}%`, height: "100%", background: COLORS.gold,
                              borderRadius: 4, transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 9, color: COLORS.gray, fontFamily: font, marginTop: 3, textAlign: "right" }}>
                Month {pbd.breakevenMonths} of {Math.round(pbd.termYrs * 12)}
              </div>
            </div>
          );
        })()}
      </>);
    };

    const TempResults = ({ tbd }) => (<>
      {/* Structure: read-only from Fee Sheet for Scenario A; B & C use the top-level dropdown */}
      {a.id === 1 && (
        <div style={{ background: COLORS.bgAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                      padding: "7px 10px", marginBottom: 8,
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
            {fsTempBdType && fsTempBdType !== "none" ? `${fsTempBdType} Buydown` : "None"}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.gray, fontFamily: font, letterSpacing: "0.03em" }}>← Fee Sheet</span>
        </div>
      )}
      {/* Schedule table — hidden when no valid schedule (e.g. Fee Sheet has "none") */}
      {tbd.years ? (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${COLORS.navy}` }}>
                {["Yr", "Rate", "Payment", "Subsidy/yr"].map(h => (
                  <th key={h} style={{ padding: "5px 6px", textAlign: h === "Yr" ? "left" : "right",
                                       fontSize: 12, fontWeight: 700, color: COLORS.gray }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tbd.years.map((y, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`,
                                     background: y.isFull ? COLORS.bgAlt : COLORS.bg }}>
                  <td style={{ padding: "5px 6px", fontWeight: 600, color: COLORS.navy }}>
                    {y.isFull ? `${y.year}+` : `Yr ${y.year}`}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700,
                                color: y.isFull ? COLORS.navy : COLORS.green }}>
                    {y.rate.toFixed(2)}%
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700,
                                color: y.isFull ? COLORS.navy : COLORS.green }}>
                    {fmt2(y.payment)}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right",
                                fontWeight: y.isFull ? 400 : 700,
                                color: y.isFull ? COLORS.gray : COLORS.gold }}>
                    {y.isFull ? "—" : fmt(Math.round(y.yearSubsidy))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "12px 0", color: COLORS.gray, fontSize: 12, fontFamily: font }}>
          {a.id === 1
            ? "Set a temp buydown type in the Fee Sheet to see the schedule."
            : "Select a structure above."}
        </div>
      )}
      {tbd.totalSubsidy > 0 && (
        <div style={{ marginTop: 8, background: `${COLORS.gold}18`,
                      border: `1.5px solid ${COLORS.gold}55`, borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
            💰 Seller/Builder Subsidy:{" "}
            <span style={{ color: COLORS.gold, fontSize: 15 }}>{fmt(Math.round(tbd.totalSubsidy))}</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, marginTop: 2, lineHeight: 1.4 }}>
            Deposited into escrow at closing to cover the payment gap each month during the buydown period.
          </div>
        </div>
      )}
    </>);

    return (
      <SectionCard key={a.id} title={`${a.label} — Temporary Buydown`} accent={COLORS.gold}>

        {/* Buydown type: read-only for Scenario A (driven by Fee Sheet) */}
        {a.id === 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: COLORS.bgAlt, border: `1px solid ${COLORS.border}`,
                        borderRadius: 6, padding: "7px 10px", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
              {fsTempBdType && fsTempBdType !== "none" ? "Temporary Buydown" : "No Buydown"}
            </span>
            <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.gray, fontFamily: font, letterSpacing: "0.03em" }}>← Fee Sheet</span>
          </div>
        )}
        {/* B & C: Structure dropdown is the sole control — "None" disables the buydown */}
        {a.id !== 1 && (
          <Select label="Structure" value={a.bdTempType || "none"} onChange={(v) => upd("bdTempType", v)} options={[
            { value: "none",  label: "— No Buydown —" },
            { value: "3/2/1", label: "3/2/1 Buydown"  },
            { value: "2/1",   label: "2/1 Buydown"    },
            { value: "1/1",   label: "1/1 Buydown"    },
            { value: "1/0",   label: "1/0 Buydown"    },
          ]} small />
        )}

        {/* ─ Buydown cost / CTC impact callout ─ */}
        {(() => {
          const bdCost = getBdCost(bd);
          if (bdType === "none") {
            // B/C with no BD when A has a BD: user saves A's BD cost vs Scenario A
            if (a.id !== 1 && a.usesFSValues && aBdCost > 0) {
              return (
                <div style={{ background: "#16A34A14", border: "1px solid #16A34A55",
                              borderRadius: 6, padding: "6px 10px", marginBottom: 8,
                              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#16A34A", fontFamily: font }}>
                    No buydown — $0 subsidy
                  </span>
                  <span style={{ fontSize: 12, color: "#16A34A", fontFamily: font }}>
                    Saves {fmt(aBdCost)} vs Scenario A
                  </span>
                </div>
              );
            }
            return null;
          }
          const diffVsA = bdCost - aBdCost;
          const diffLabel = a.id === 1
            ? "Included in Fee Sheet CTC"
            : aBdCost > 0
              ? `${diffVsA >= 0 ? "+" : "−"}${fmt(Math.abs(diffVsA))} vs Scenario A`
              : "Added to Cash to Close";
          return (
            <div style={{ background: `${COLORS.gold}18`, border: `1.5px solid ${COLORS.gold}55`,
                          borderRadius: 6, padding: "6px 10px", marginBottom: 8,
                          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.gold, fontFamily: font }}>
                💰 Buydown Subsidy: {fmt(bdCost)}
              </span>
              <span style={{ fontSize: 12, color: COLORS.gray, fontFamily: font }}>
                {diffLabel}
              </span>
            </div>
          );
        })()}

        {/* ─ No buydown placeholder ─ */}
        {bdType === "none" && (
          <div style={{ textAlign: "center", padding: "14px 0", color: COLORS.gray, fontSize: 12, fontFamily: font }}>
            {a.id === 1
              ? "Set a temp buydown type in the Fee Sheet to see the schedule here."
              : <>Select <strong>Permanent</strong> or <strong>Temporary</strong> to analyze.</>
            }
          </div>
        )}

        {/* ─ Permanent section ─ */}
        {showPerm && (<>
          {bdType === "both" && (
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font,
                          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Permanent Buydown
            </div>
          )}
          <LabeledInput label="New Interest Rate after Buydown" value={a.bdPermRate || ""} onChange={(v) => upd("bdPermRate", v)} suffix="%" step="0.125" small />
          <LabeledInput
            label="Buydown Cost in Points (i.e. % of Loan)"
            value={a.bdPermCost || ""}
            onChange={(v) => upd("bdPermCost", v)}
            suffix="%"
            step="0.125"
            hint={costHint}
            small
          />
          <PermResults pbd={permBd} />
          {/* ─ Pricing education note — last item in permanent section ─ */}
          <div style={{
            background: `${COLORS.gold}0f`,
            border: `1px solid ${COLORS.gold}55`,
            borderRadius: 7,
            padding: "9px 11px",
            marginBottom: 4,
            marginTop: 8,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.gold, fontFamily: font, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ⚠ Pricing Changes Daily
            </div>
            <div style={{ fontSize: 12, color: COLORS.navy, fontFamily: font, lineHeight: 1.55 }}>
              Buydown costs are set by current market pricing and vary by loan program, credit score, LTV, and lender-level adjustments (LLPAs). A rough starting point:{" "}
              <strong>~0.5% in discount points typically buys ~0.125% in rate reduction</strong> — but this is not linear, not guaranteed, and not a substitute for actual lender pricing.
            </div>
            <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, marginTop: 5, fontStyle: "italic" }}>
              Always verify current costs with your lender before quoting a buydown to a borrower.
            </div>
          </div>
        </>)}

        {/* ─ Divider between sections when both ─ */}
        {bdType === "both" && (
          <div style={{ height: 1, background: COLORS.border, margin: "14px 0" }} />
        )}

        {/* ─ Temporary section ─ */}
        {showTemp && (<>
          {bdType === "both" && (
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font,
                          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Temporary Buydown
            </div>
          )}
          <TempResults tbd={tempBd} />
        </>)}

      </SectionCard>
    );
  };

  // Returns the valid permanent-buydown result (or null) so the matrix can use BD rate/cost
  const getPermBD = (bd) => {
    if (!bd) return null;
    if (bd.type === "permanent" && !bd.noRate && !bd.rateError && bd.bdMPI) return bd;
    if (bd.type === "both" && bd.perm && !bd.perm.noRate && !bd.perm.rateError && bd.perm.bdMPI) return bd.perm;
    return null;
  };

  // ── Print side-by-side for client ────────────────────────────────────────
  const printComparison = () => {
    let clientName = "Client";
    try {
      const sc = JSON.parse(localStorage.getItem("mtk_active_scenario") || "null");
      clientName = sc?.name || sc?.clientName || "Client";
    } catch {}
    let loLine = "CMG Home Loans";
    try {
      const u = JSON.parse(localStorage.getItem("mtk_app_user") || "null");
      if (u?.display_name) loLine = u.display_name + " · CMG Home Loans";
    } catch {}
    const tableEl = document.getElementById("mc-comparison-table");
    if (!tableEl) return;
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const win = window.open("", "_blank", "width=960,height=720");
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Loan Comparison — ${clientName}</title>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'DM Sans',sans-serif; background:#fff; color:#1A2530; padding:36px 44px; }
        .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:14px; border-bottom:3px solid #0C4160; }
        .hdr-left h1 { font-size:24px; font-weight:800; color:#0C4160; letter-spacing:-0.3px; }
        .hdr-left p { font-size:12px; color:#64748B; margin-top:5px; }
        .hdr-left p strong { color:#1A2530; }
        .hdr-right { text-align:right; font-size:11px; color:#64748B; line-height:1.8; }
        .hdr-right strong { color:#0C4160; font-size:12px; }
        table { width:100%; border-collapse:collapse; }
        .disc { margin-top:22px; font-size:9px; color:#94a3b8; font-style:italic; line-height:1.7; border-top:1px solid #e2e8f0; padding-top:10px; }
        @media print { body { padding:20px 28px; } }
      </style>
    </head><body>
      <div class="hdr">
        <div class="hdr-left">
          <h1>Loan Comparison</h1>
          <p>Prepared for: <strong>${clientName}</strong></p>
        </div>
        <div class="hdr-right">
          <strong>${loLine}</strong><br>${today}
        </div>
      </div>
      ${tableEl.outerHTML}
      <div class="disc">These scenarios are for illustration purposes only and are not a commitment to lend. Rates and fees are estimates subject to change without notice. All loans are subject to credit approval and underwriting. Contact your loan officer for a formal Loan Estimate.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 700);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ══ CURRENT VALUES REFERENCE ════════════════════════════════════════ */}
      <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, fontStyle: "italic", marginBottom: 14 }}>
        Default values are pulled from the Payment Calculator and Fee Sheet. Adjust each scenario independently below.
      </div>

      {/* ══ LO-only internal banner ══════════════════════════════════════ */}
      {(() => {
        try { const _u = JSON.parse(localStorage.getItem("mtk_app_user") || "null"); if (!_u?.isInternal) return null; } catch { return null; }
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
                        padding: "9px 14px", borderRadius: 8, fontFamily: font,
                        background: "#FFF8E7", border: "1px solid #F0D080", borderLeft: "3px solid #E6A817" }}>
            <span style={{ fontSize: 15 }}>🔒</span>
            <div style={{ fontSize: 12, color: "#7A5800", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>Internal view — </span>
              The scenario inputs and fee details on this page are your working view and are not shown to clients.
              The side-by-side comparison below is what clients see when they access this scenario.
            </div>
          </div>
        );
      })()}

      {/* ══ Scenario input cards ══════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
        {scenarios.map((s) => {
          const isA        = s.id === 1;
          const isCustomTerm = !PRESET_TERMS_MC.includes(s.term);
          const hp       = parseFloat(s.hp || "0") || 0;
          const dpDollar = Math.round(hp * (parseFloat(s.downPct) || 0) / 100);
          const scAnalysis = analyses.find(a => a.id === s.id);
          // Normalize to ≥1 decimal, cap at 3 (used for rate & down payment)
          const fmtDec = (v) => {
            if (v === "" || v == null) return "";
            const n = parseFloat(v);
            if (isNaN(n)) return v;
            const raw = String(v).trim();
            const dot = raw.indexOf('.');
            if (dot === -1) return n.toFixed(1);
            const dec = raw.length - dot - 1;
            return dec > 3 ? n.toFixed(3) : raw;
          };

          // Read-only field for Scenario A — styled to match LabeledInput small
          const ROField = ({ label, value, hint }) => (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray, fontFamily: font,
                            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
              <div style={{ background: COLORS.bg, border: `1.5px solid ${COLORS.border}`,
                            borderRadius: 8, padding: "8px 10px", fontSize: 13,
                            fontWeight: 500, color: COLORS.navy, fontFamily: font }}>{value || "—"}</div>
              {hint && <div style={{ fontSize: 12, color: COLORS.gray, marginTop: 3, fontFamily: font }}>{hint}</div>}
            </div>
          );

          const PROG_OPTS = [
            { value: "conventional", label: "Conventional" },
            { value: "fha",          label: "FHA"          },
            { value: "va",           label: "VA"           },
            { value: "usda",         label: "USDA"         },
            { value: "jumbo",        label: "Jumbo"        },
          ];
          const progLabel = v => (PROG_OPTS.find(o => o.value === v) || {}).label || v;
          const isGovProg = (p) => p === "fha" || p === "va" || p === "usda";

          return (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* ── Main loan parameters card ── */}
              <SectionCard
                title={
                  <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <span style={{ flexShrink: 0 }}>{s.label}</span>
                    <input
                      type="text"
                      value={s.customLabel || ""}
                      onChange={(e) => updateScenario(s.id, "customLabel", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Optional: Name of Scenario"
                      maxLength={40}
                      style={{
                        flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8,
                        fontFamily: font, fontSize: 13, fontWeight: 400,
                        border: `1.5px solid ${s.color}55`, background: `${s.color}0A`,
                        color: COLORS.navy, outline: "none",
                      }}
                    />
                  </span>
                }
                accent={s.color}
              >
                {isA ? (
                  <>
                    <div style={{
                      fontSize: 12, color: s.color, fontFamily: font, fontWeight: 700,
                      textAlign: "center", marginBottom: 10, padding: "5px 8px",
                      background: `${s.color}11`, border: `1px solid ${s.color}33`, borderRadius: 5,
                    }}>
                      ← Synced from Payment Calculator
                    </div>
                    {(() => {
                      const aHp     = parseFloat(pcHp) || 0;
                      const aLa     = parseFloat(pcLa) || 0;
                      const aDown   = Math.max(0, Math.round(aHp - aLa));
                      const dpHint  = aDown > 0 ? `${fmt(aDown)} down · Loan: ${fmt(aLa)}` : undefined;
                      const aAn     = analyses.find(a => a.id === 1);
                      const aApr    = aAn ? aAn.apr : null;
                      const rStr    = String(pcRate || "").trim();
                      const rDec    = rStr.indexOf(".") === -1 ? 2 : Math.max(2, rStr.length - rStr.indexOf(".") - 1);
                      const aprHint = aApr && aApr !== parseFloat(pcRate) ? `APR ${aApr.toFixed(rDec)}%` : undefined;
                      return (
                        <>
                          <ROField label="Loan Program"   value={progLabel(pcProg)} />
                          <ROField label="Purchase Price" value={`$${(parseFloat(pcHp) || 0).toLocaleString()}`} />
                          <ROField label="Down Payment"   value={`${pcDp}%`} hint={dpHint} />
                          <ROField label="Interest Rate"  value={`${pcRate}%`} hint={aprHint} />
                          <ROField label="Term"           value={`${pcTerm} yr`} />
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => resetScenarioToPC(s.id)}
                      style={{
                        display: "block", width: "100%", marginBottom: 10,
                        padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: font,
                        border: `1px solid ${s.color}66`, background: `${s.color}11`,
                        color: s.color, fontSize: 12, fontWeight: 700,
                      }}
                      title="Copy current Payment Calculator values into this scenario"
                    >
                      ↺ Reset to Current Values
                    </button>
                    <Select label="Loan Program" value={s.prog || "conventional"} onChange={(v) => updateScenario(s.id, "prog", v)} options={PROG_OPTS} small />
                    <LabeledInput label="Purchase Price" prefix="$" value={s.hp || ""}  onChange={(v) => { if (String(v).trimStart().startsWith("-")) return; updateScenario(s.id, "hp", v); }} useCommas small infoTip="The amount financed for this scenario. Comparing scenarios with different loan amounts (e.g., different down payments) shows the trade-off between upfront cash and monthly payment." />
                    <LabeledInput label="Down Payment"   value={s.downPct} type="text" onChange={(v) => { if (String(v).trimStart().startsWith("-")) return; updateScenario(s.id, "downPct", v); }} onBlur={(v) => { if (v !== "") updateScenario(s.id, "downPct", fmtDec(v)); }} suffix="%" small
                      hint={dpDollar > 0 ? `${fmt(dpDollar)} down · Loan: ${fmt(Math.round(hp - dpDollar))}` : undefined} />
                    <LabeledInput label="Interest Rate"  value={s.rate}    type="text" onChange={(v) => { if (String(v).trimStart().startsWith("-")) return; updateScenario(s.id, "rate", v); }} onBlur={(v) => { if (v !== "") updateScenario(s.id, "rate", fmtDec(v)); }} suffix="%" small infoTip="The rate for this specific scenario. Use this to compare a lower rate with points vs. a higher rate with no points — the break-even calculator can tell you when the lower rate pays off." />
                    {scAnalysis && scAnalysis.apr && scAnalysis.apr !== parseFloat(s.rate) && (() => {
                      const rStr = String(s.rate || "").trim(); const d = rStr.indexOf("."); const dec = d === -1 ? 2 : Math.max(2, rStr.length - d - 1);
                      return <div style={{ fontSize: 9, color: COLORS.gray, fontFamily: font, marginTop: -4, marginBottom: 4 }}>APR {scAnalysis.apr.toFixed(dec)}%</div>;
                    })()}
                    <Select label="Term" value={isCustomTerm ? "other" : s.term} onChange={(v) => {
                      if (v === "other") updateScenario(s.id, "term", "");
                      else               updateScenario(s.id, "term", v);
                    }} options={[
                      { value: "30", label: "30 Years" }, { value: "20", label: "20 Years" },
                      { value: "15", label: "15 Years" }, { value: "other", label: "Other…" },
                    ]} small />
                    {isCustomTerm && (
                      <LabeledInput label="Custom Years" value={s.term} onChange={(v) => {
                        const str = v.replace(/[^0-9]/g, "");
                        if (!str) { updateScenario(s.id, "term", ""); return; }
                        const yr = parseInt(str);
                        if (yr >= 1 && yr <= 30) updateScenario(s.id, "term", String(yr));
                        else if (yr > 30)        updateScenario(s.id, "term", "30");
                      }} suffix="yr" small hint="1–30 years" />
                    )}
                  </>
                )}
              </SectionCard>

              {/* ── Upfront MI card (gov programs only) ── */}
              {isA ? (
                (() => {
                  const govFee = parseInt(fsMcGovFee) || 0;
                  if (!isGovProg(pcProg) && govFee === 0) return null;
                  return (
                    <SectionCard title="UPFRONT MI" accent={s.color}>
                      <ROField label="Upfront MI" value={govFee > 0 ? fmt(govFee) : "—"} />
                      <ROField label="Upfront Financed" value={pcUpfrontMode === "rolled_in" ? "Rolled Into Loan" : "Paid at Closing"} />
                    </SectionCard>
                  );
                })()
              ) : (
                isGovProg(s.prog || "conventional") && (() => {
                  const sAnalysis = analyses.find(a => a.id === s.id);
                  const defAmt = sAnalysis ? sAnalysis.upfrontMiFee : 0;
                  const upfrontPctStr = sAnalysis && sAnalysis.defUpfrontPct > 0
                    ? ` (${parseFloat((sAnalysis.defUpfrontPct * 100).toFixed(2))}%)`
                    : "";
                  return (
                    <SectionCard title="UPFRONT MI" accent={s.color}>
                      <LabeledInput
                        label="Upfront MI Override"
                        prefix="$"
                        value={s.upfrontMiOvr || ""}
                        onChange={(v) => updateScenario(s.id, "upfrontMiOvr", v)}
                        useCommas
                        small
                        hint={s.upfrontMiOvr === "" || s.upfrontMiOvr === undefined ? `Default: ${fmt(defAmt)}${upfrontPctStr}` : undefined}
                        info="Leave blank to use default; enter 0 if buyer is exempt"
                      />
                      <Select
                        label="Upfront Financed"
                        value={s.upfrontFinanced || "rolled_in"}
                        onChange={(v) => updateScenario(s.id, "upfrontFinanced", v)}
                        options={[
                          { value: "rolled_in",    label: "Rolled Into Loan" },
                          { value: "paid_closing", label: "Paid at Closing"  },
                        ]}
                        small
                      />
                    </SectionCard>
                  );
                })()
              )}

              {/* ── Monthly MI card ── */}
              {isA ? (
                pcEffMiNum > 0 && (
                  <SectionCard title="MONTHLY MI" accent={s.color}>
                    <ROField label="Monthly MI" value={`${fmt2(pcEffMiNum)}/mo`}
                      hint={scenALa > 0 ? `${parseFloat((pcEffMiNum * 12 / scenALa * 100).toFixed(2))}% annual factor` : undefined} />
                  </SectionCard>
                )
              ) : (
                <SectionCard title="MONTHLY MI" accent={s.color}>
                  {(() => {
                    const sA = analyses.find(a => a.id === s.id);
                    const autoAmt = sA ? sA.pmiAuto : 0;
                    const rateStr = (sA && sA.baseLa > 0 && autoAmt > 0)
                      ? ` (${parseFloat((autoAmt * 12 / sA.baseLa * 100).toFixed(2))}%)`
                      : "";
                    const miHint = s.miOvr === "" || s.miOvr === undefined
                      ? `Default: ${autoAmt > 0 ? fmt2(autoAmt) : "$0"}${rateStr}`
                      : undefined;
                    return (
                      <LabeledInput
                        label="MI Monthly Override"
                        value={s.miOvr || ""}
                        onChange={(v) => { if (String(v).trimStart().startsWith("-")) return; updateScenario(s.id, "miOvr", v); }}
                        prefix="$"
                        step="1"
                        small
                        useCommas
                        hint={miHint}
                        info="Monthly MI dollar amount; leave blank for auto-calculated MI"
                      />
                    );
                  })()}
                </SectionCard>
              )}

            </div>
          );
        })}
      </div>

      {/* ══ Per-scenario fee cards ═══════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
        {scenarios.map((s) => {
          const sAn       = analyses.find(a => a.id === s.id) || {};
          const la        = parseFloat(sAn.la) || 0;
          const hp        = parseFloat(sAn.hp) || 0;
          const isA       = s.id === 1;

          const dpMode    = isA ? "pct"    : (s.pointsMode    || "pct");
          const scMode    = isA ? "dollar" : (s.sellerConcMode || "dollar");

          // Scenario A values always come from the Fee Sheet
          const dpVal     = isA ? (fsDp  || "0") : (s.points     || "0");
          const scVal     = isA ? (fsSc  || "0") : (s.sellerConc || "0");
          const dpRaw     = parseFloat(dpVal) || 0;
          const scRaw     = parseFloat(scVal) || 0;

          // Dollar equivalents (for hints)
          const dpDollar  = la > 0 && dpRaw > 0 ? (dpMode === "dollar" ? dpRaw : la * dpRaw / 100) : 0;
          const scDollar  = scRaw > 0 ? (scMode === "pct" && hp > 0 ? hp * scRaw / 100 : (scMode === "dollar" ? scRaw : 0)) : 0;
          const dpAmt     = dpDollar > 0 ? fmt(Math.round(dpDollar)) : null;
          const scAmt     = scDollar > 0 ? fmt(Math.round(scDollar)) : null;

          // Read-only display row used for Scenario A — matches LabeledInput small
          const ReadRow = ({ value, suffix, hint }) => (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                background: COLORS.bg, border: `1.5px solid ${COLORS.border}`,
                borderRadius: 8, padding: "8px 10px", fontSize: 13,
                fontWeight: 500, color: COLORS.navy, fontFamily: font,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>{value || "—"}{suffix ? <span style={{ color: COLORS.gray }}> {suffix}</span> : null}</span>
                {hint && <span style={{ fontSize: 12, color: COLORS.gray }}>{hint}</span>}
              </div>
            </div>
          );

          // Format pts to always show 1 decimal for non-zero values; cap at 3 decimals
          const fmtPts = (v) => {
            const n = parseFloat(v);
            if (!n || n <= 0) return v || "0";
            const raw = String(v).trim();
            const dot = raw.indexOf('.');
            if (dot === -1) return n.toFixed(1);
            const dec = raw.length - dot - 1;
            return dec > 3 ? n.toFixed(3) : raw;
          };

          // Inline $/%  toggle buttons — passed as rightAddon to LabeledInput
          const Tgl = ({ modeKey, modeVal }) => (
            <>
              {[["dollar", "$"], ["pct", "%"]].map(([mv, lbl]) => (
                <button key={mv} onClick={() => updateScenario(s.id, modeKey, mv)} style={{
                  width: 28, borderRadius: 6, cursor: "pointer", fontFamily: font,
                  border: `1.5px solid ${modeVal === mv ? COLORS.navy : COLORS.border}`,
                  background: modeVal === mv ? COLORS.navy : "transparent",
                  color: modeVal === mv ? "#fff" : COLORS.gray,
                  fontSize: 12, fontWeight: 700,
                }}>{lbl}</button>
              ))}
            </>
          );

          // Section sub-header used by all four fields
          const FeeHdr = ({ label, fromFS }) => (
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font,
                          textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 10,
                          marginBottom: 6, paddingBottom: 4, borderBottom: `1.5px solid ${COLORS.border}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{label}</span>
              {fromFS && <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.gray, textTransform: "none", letterSpacing: 0 }}>← Fee Sheet</span>}
            </div>
          );

          return (
            <SectionCard key={s.id} title={`${s.label} — Fees`} accent={s.color}>

              {/* ── Discount Points ── */}
              <FeeHdr label="Discount Points" fromFS={isA} />
              {isA
                ? <ReadRow value={fmtPts(dpVal)} suffix="pts" hint={dpAmt ? `= ${dpAmt}` : null} />
                : (() => {
                    const isPct = dpMode === "pct";
                    const dpPtsHint = !isPct && la > 0 && dpRaw > 0
                      ? `= ${fmtPts(String(parseFloat((dpRaw / la * 100).toFixed(3))))} pts`
                      : null;
                    return (
                      <LabeledInput
                        value={s.points}
                        type="text"
                        prefix={isPct ? undefined : "$"}
                        suffix={isPct ? "pts" : undefined}
                        onChange={(v) => {
                          if (String(v).trimStart().startsWith("-")) return;
                          if (v !== "" && !/^[\d.]*$/.test(v)) return;
                          updateScenario(s.id, "points", v);
                        }}
                        onBlur={(v) => {
                          if (isPct) {
                            const n = parseFloat(v);
                            if (!isNaN(n) && v !== "") updateScenario(s.id, "points", fmtPts(String(v).trim()));
                          }
                        }}
                        useCommas={!isPct}
                        small
                        hint={isPct ? (dpAmt ? `= ${dpAmt}` : undefined) : (dpPtsHint || undefined)}
                        rightAddon={<Tgl modeKey="pointsMode" modeVal={dpMode} />}
                        infoTip="Upfront fee paid to buy down the interest rate. Use the comparison to see when the monthly savings from a lower rate recoup the upfront cost of the points."
                      />
                    );
                  })()
              }

              {/* ── Seller Concessions ── */}
              <FeeHdr label="Seller Concessions" fromFS={isA} />
              {isA
                ? <ReadRow value={scAmt || "—"} hint="Reduces cash to close" />
                : (() => {
                    const isPct = scMode === "pct";
                    const scPctHint = !isPct && hp > 0 && scRaw > 0
                      ? `${parseFloat((scRaw / hp * 100).toFixed(2))}% of price`
                      : "Reduces cash to close";
                    return (
                      <LabeledInput
                        prefix={isPct ? undefined : "$"}
                        suffix={isPct ? "% of price" : undefined}
                        value={s.sellerConc || ""}
                        onChange={(v) => { if (String(v).trimStart().startsWith("-")) return; updateScenario(s.id, "sellerConc", v); }}
                        useCommas={!isPct}
                        small
                        hint={isPct ? (scAmt ? `= ${scAmt}` : "Reduces cash to close") : scPctHint}
                        rightAddon={<Tgl modeKey="sellerConcMode" modeVal={scMode} />}
                        infoTip="Credits from the seller toward the buyer's closing costs. Comparing scenarios with and without concessions shows how they affect the rate (often concessions are used to buy down the rate) and cash to close."
                      />
                    );
                  })()
              }

              {/* ── Additional Costs (B & C only) ── */}
              {!isA && (() => {
                const mode = s.addlCostsMode || "dollar";
                const pct  = mode === "pct";
                const val  = parseFloat(s.addlCosts) || 0;
                return (
                  <>
                    <FeeHdr label="Additional Costs" />
                    <LabeledInput
                      prefix={pct ? undefined : "$"}
                      suffix={pct ? "%" : undefined}
                      value={s.addlCosts || ""}
                      onChange={(v) => { if (String(v).trimStart().startsWith("-")) return; updateScenario(s.id, "addlCosts", v); }}
                      useCommas={!pct}
                      small
                      hint={pct && la > 0 && val > 0 ? `= ${fmt(Math.round(la * val / 100))}` : "Adds to Cash to Close"}
                      rightAddon={<Tgl modeKey="addlCostsMode" modeVal={mode} />}
                    />
                  </>
                );
              })()}

              {/* ── Additional Credits (B & C only) ── */}
              {!isA && (() => {
                const mode = s.addlCreditsMode || "dollar";
                const pct  = mode === "pct";
                const val  = parseFloat(s.addlCredits) || 0;
                return (
                  <>
                    <FeeHdr label="Additional Credits" />
                    <LabeledInput
                      prefix={pct ? undefined : "$"}
                      suffix={pct ? "%" : undefined}
                      value={s.addlCredits || ""}
                      onChange={(v) => { if (String(v).trimStart().startsWith("-")) return; updateScenario(s.id, "addlCredits", v); }}
                      useCommas={!pct}
                      small
                      hint={pct && la > 0 && val > 0 ? `= ${fmt(Math.round(la * val / 100))}` : "Reduces Cash to Close"}
                      rightAddon={<Tgl modeKey="addlCreditsMode" modeVal={mode} />}
                    />
                  </>
                );
              })()}

            </SectionCard>
          );
        })}
      </div>

      {/* ══ Per-scenario buydown cards ════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
        {analyses.map((a, i) => renderBDCard(a, perScenarioBD[i]))}
      </div>

      {/* ══ Public note above comparison ═════════════════════════════════ */}
      <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 8, fontFamily: font,
                    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                    fontSize: 12, color: COLORS.gray, lineHeight: 1.6 }}>
        📋 <span style={{ fontWeight: 600, color: COLORS.navy }}>These scenarios are for illustration purposes only.</span>{" "}
        Your loan officer has put together these options based on your situation — reach out to them to discuss which program and structure makes the most sense for you.
      </div>

      {/* ══ Side-by-side comparison table ════════════════════════════════ */}
      <SectionCard title="SIDE-BY-SIDE COMPARISON">
        <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, marginBottom: 8, fontStyle: "italic" }}>
          Scenario A closing costs, prepaids, and cash to close pull directly from the Fee Sheet.
          B &amp; C are estimates using your Fee Sheet settings (state-specific title, overrides, prepaid calendar).
        </div>
        <div id="mc-comparison-table" style={{ overflowX: "auto" }}>
          {(() => {
            // Use Payment Calculator's live-computed values so Scenario A matches exactly
            const taxMonthly   = parseFloat(pcEffTax) || parseFloat(fsMt) || 0;
            const insMonthly   = parseFloat(pcEffIns) || parseFloat(fsMi) || 0;
            const aEffMi       = parseFloat(pcEffMi)  || 0; // Scenario A PMI from Payment Calc
            const aCredits     = parseInt(fsMcCredits) || 0;
            const aAddl        = parseInt(fsMcAddl)    || 0;
            const aCC          = parseInt(fsMcCc)      || 0;
            const aPre         = parseInt(fsMcPrepaids)|| 0;

            // Section header row
            const SectionHdr = ({ label }) => (
              <tr>
                <td colSpan={analyses.length + 1} style={{
                  background: COLORS.navy, color: "#fff",
                  padding: "6px 12px", fontSize: 12, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  fontFamily: font,
                }}>
                  {label}
                </td>
              </tr>
            );

            // Regular data row (tier: "strong" | "soft" | "muted" | undefined=normal)
            const DataRow = ({ label, cells, tier, dividerAbove }) => (
              <>
                {dividerAbove && (
                  <tr><td colSpan={analyses.length + 1} style={{ borderTop: `2px solid ${COLORS.navy}`, padding: 0 }} /></tr>
                )}
                <tr style={{
                  borderBottom: tier === "muted" ? "none" : `1px solid ${COLORS.border}`,
                  background: tier === "strong" ? `${COLORS.blue}0d`
                            : tier === "soft"   ? `${COLORS.gold}0a`
                            : COLORS.bg,
                }}>
                  <td style={{
                    padding: tier === "strong" ? "10px 12px" : tier === "muted" ? "1px 12px 5px 22px" : "7px 12px",
                    fontSize: tier === "strong" ? 13 : tier === "muted" ? 10 : 12,
                    fontWeight: tier === "strong" ? 700 : 400,
                    fontStyle: tier === "muted" ? "italic" : "normal",
                    color: tier === "muted" ? COLORS.gray : COLORS.navy,
                    fontFamily: font,
                    borderLeft: tier === "strong" ? `3px solid ${COLORS.blue}` : "3px solid transparent",
                  }}>{label}</td>
                  {cells.map((val, ci) => (
                    <td key={ci} style={{
                      padding: tier === "strong" ? "10px 12px" : tier === "muted" ? "1px 12px 5px" : "7px 12px",
                      textAlign: "right",
                      fontSize: tier === "strong" ? 15 : tier === "muted" ? 10 : 13,
                      fontWeight: tier === "strong" ? 700 : 400,
                      fontStyle: tier === "muted" ? "italic" : "normal",
                      color: tier === "strong" ? analyses[ci].color : tier === "muted" ? COLORS.gray : COLORS.navy,
                      fontFamily: font,
                    }}>{val}</td>
                  ))}
                </tr>
              </>
            );

            const rateCell = (a, bd) => {
              const pb = getPermBD(bd);
              const rStr = String(a.rate || "").trim(); const d = rStr.indexOf("."); const dec = d === -1 ? 2 : Math.max(2, rStr.length - d - 1);
              if (pb) return `${pb.bdRate.toFixed(dec)}% (BD ↓ from ${a.rate}%)`;
              return a.apr && a.apr !== parseFloat(a.rate) ? `${a.rate}% (${a.apr.toFixed(dec)}% APR)` : `${a.rate}%`;
            };

            return (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.navy}` }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: COLORS.gray }}></th>
                    {analyses.map(a => (
                      <th key={a.id} style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: a.color }}>
                        {a.label}
                        {a.customLabel && <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray, marginTop: 2 }}>{a.customLabel}</div>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>

                  {/* ── LOAN TERMS ── */}
                  <SectionHdr label="Loan Terms" />
                  <DataRow label="Loan Program"     cells={analyses.map(a => {
                    const map = { conventional:"Conventional", fha:"FHA", va:"VA", usda:"USDA", jumbo:"Jumbo" };
                    return map[a.prog] || a.prog || "Conventional";
                  })} />
                  <DataRow label="Purchase Price"   cells={analyses.map(a => fmt(a.hp))} />
                  <DataRow label="Down Payment"     cells={analyses.map(a => `${fmt(a.downPayment)} (${a.dpPct.toFixed(1)}%)`)} />
                  <DataRow label="Base Loan Amount" cells={analyses.map(a => `${fmt(a.baseLa)} (${a.ltv.toFixed(1)}% LTV)`)} />
                  {analyses.some(a => a.upfrontMiFee > 0) && (
                    <DataRow label="Upfront MI / Funding Fee" tier="muted"
                      cells={analyses.map(a => {
                        if (a.upfrontMiFee <= 0) return "—";
                        const mode = a.upfrontFinanced === "paid_closing" ? "paid@close" : "rolled in";
                        return `${fmt(a.upfrontMiFee)} (${mode})`;
                      })} />
                  )}
                  {analyses.some(a => a.upfrontMiFee > 0) && (
                    <DataRow label="Effective Loan Amount" cells={analyses.map(a => fmt(a.la))} />
                  )}
                  <DataRow label="Rate / APR"       cells={analyses.map((a, i) => rateCell(a, perScenarioBD[i]))} />
                  <DataRow label="Term"             cells={analyses.map(a => `${a.termYrs} yr`)} />

                  {/* ── MONTHLY PAYMENT (PITI) ── */}
                  <SectionHdr label="Monthly Payment (PITI)" />
                  <DataRow label="Principal & Interest" cells={analyses.map((a, i) => { const pb = getPermBD(perScenarioBD[i]); return fmt2(pb ? pb.bdMPI : a.monthlyPI); })} />
                  {analyses.some(a => a.pmiMonthly > 0) && (
                    <DataRow label="Monthly PMI / MIP" cells={analyses.map(a => (
                      a.pmiMonthly > 0 ? fmt2(a.pmiMonthly) : "—"
                    ))} />
                  )}
                  <DataRow label="Monthly Taxes"       cells={analyses.map(() => fmt2(taxMonthly))} />
                  <DataRow label="Monthly Insurance"   cells={analyses.map(() => fmt2(insMonthly))} />
                  <DataRow label="Total Monthly (PITI)" tier="strong" cells={analyses.map((a, i) => {
                    const pb = getPermBD(perScenarioBD[i]);
                    return fmt2((pb ? pb.bdMPI : a.monthlyPI) + a.pmiMonthly + taxMonthly + insMonthly);
                  })} />

                  {/* ── COST TO CLOSE ── */}
                  <SectionHdr label="Cost to Close" />
                  <DataRow label="Purchase Price"
                    cells={analyses.map(a => fmt(a.hp))} />
                  <DataRow label="Loan Amount"
                    cells={analyses.map(a => `(${fmt(a.baseLa)})`)} />
                  {analyses.some(a => a.upfrontMiFee > 0 && a.upfrontFinanced === "rolled_in") && (
                    <DataRow label="↳ Upfront MI (in loan)" tier="muted"
                      cells={analyses.map(a =>
                        (a.upfrontMiFee > 0 && a.upfrontFinanced === "rolled_in")
                          ? fmt(a.upfrontMiFee)
                          : "—"
                      )} />
                  )}
                  {analyses.some(a => a.upfrontAsCost > 0) && (
                    <DataRow label="+ Upfront MI (paid at closing)" tier="muted"
                      cells={analyses.map(a => a.upfrontAsCost > 0 ? `+${fmt(a.upfrontAsCost)}` : "—")} />
                  )}
                  <DataRow label="+ Closing Costs"
                    cells={analyses.map(a => {
                      // Strip A's embedded BD from CC so it shows as a separate Buydown row
                      const displayCC = (a.usesFSValues && aBdCost > 0)
                        ? Math.max(0, a.closingCosts - aBdCost + a.pts)
                        : a.closingCosts + a.pts;
                      return fmt(displayCC);
                    })} />
                  {aAddl !== 0 && (
                    <DataRow label="+ Additional Fees"
                      cells={analyses.map(() => fmt(aAddl))} />
                  )}
                  <DataRow label="+ Prepaids & Escrow"
                    cells={analyses.map(a => fmt(a.prepaids))} />
                  {(aBdCost > 0 || perScenarioBD.slice(1).some(bd => getBdCost(bd) > 0)) && (
                    <DataRow label="+ Buydown Subsidy"
                      cells={analyses.map((a, i) => {
                        const bdCost = getBdCost(perScenarioBD[i]);
                        return bdCost > 0 ? fmt(bdCost) : "—";
                      })} />
                  )}
                  {analyses.some(a => a.addlCostsDollar > 0) && (
                    <DataRow label="+ Additional Costs"
                      cells={analyses.map(a => a.addlCostsDollar > 0 ? fmt(a.addlCostsDollar) : "—")} />
                  )}
                  <DataRow label="– Credits"
                    cells={analyses.map(a => {
                      // A: all FS credits (incl SC). B/C: their own SC + any non-SC FS credits.
                      const nonScFS = Math.max(0, aCredits - (parseFloat(fsSc) || 0));
                      const cred = a.id === 1 ? aCredits : (a.sellerConc + nonScFS);
                      return cred > 0 ? `(${fmt(cred)})` : "—";
                    })} />
                  {analyses.some(a => a.addlCreditsDollar > 0) && (
                    <DataRow label="– Additional Credits"
                      cells={analyses.map(a => a.addlCreditsDollar > 0 ? `(${fmt(a.addlCreditsDollar)})` : "—")} />
                  )}
                  <DataRow label="Cash to Close" tier="strong" dividerAbove
                    cells={analyses.map((a, i) => fmt(effectiveCtc(a, i)))} />

                </tbody>
              </table>
            );
          })()}
        </div>
      </SectionCard>

      {/* ══ Delta comparison cards (A vs B, A vs C) ══════════════════════ */}
      {(() => {
        const scA = analyses.find(a => a.id === 1);
        const scB = analyses.find(a => a.id === 2);
        const scC = analyses.find(a => a.id === 3);
        if (!scA) return null;

        const renderDelta = (compare) => {
          if (!compare) return null;
          const hasData   = compare.la > 0 && compare.monthlyPI > 0;
          const compareIdx = analyses.findIndex(a => a.id === compare.id);
          const piDelta   = hasData ? (compare.monthlyPI + compare.pmiMonthly) - (scA.monthlyPI + scA.pmiMonthly) : null;
          const ctcDelta  = hasData ? effectiveCtc(compare, compareIdx) - effectiveCtc(scA, 0) : null;
          const clr  = d => d < 0 ? "#16A34A" : d > 0 ? "#DC2626" : COLORS.gray;
          const sign = d => d > 0 ? "+" : "−";
          const subPi  = d => d < 0 ? `less/mo than A`  : d > 0 ? `more/mo than A`  : "same as A";
          const subCtc = d => d < 0 ? `less at closing than A` : d > 0 ? `more at closing than A` : "same as A";

          return (
            <div style={{ border: `2px solid ${compare.color}`, borderRadius: 12,
                          padding: "18px 16px", textAlign: "center", background: COLORS.bg }}>
              {/* Header */}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                            letterSpacing: "0.07em", marginBottom: 14, fontFamily: font }}>
                <span style={{ color: scA.color }}>Scenario A</span>
                <span style={{ color: COLORS.gray, margin: "0 6px", fontWeight: 400 }}>vs</span>
                <span style={{ color: compare.color }}>{compare.label}</span>
              </div>

              {!hasData ? (
                <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, padding: "10px 0" }}>
                  Enter values for {compare.label} to see comparison
                </div>
              ) : (
                <>
                  {/* Monthly Payment delta */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.gray, fontFamily: font,
                                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      Monthly Payment
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: clr(piDelta), fontFamily: font, lineHeight: 1 }}>
                      {piDelta === 0 ? "—" : `${sign(piDelta)}${fmt2(Math.abs(piDelta))}`}
                    </div>
                    <div style={{ fontSize: 12, color: clr(piDelta), fontFamily: font, marginTop: 3 }}>
                      {subPi(piDelta)}
                    </div>
                  </div>

                  <div style={{ height: 1, background: COLORS.border, margin: "0 0 14px 0" }} />

                  {/* Cash to Close delta */}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.gray, fontFamily: font,
                                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      Cash to Close
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: clr(ctcDelta), fontFamily: font, lineHeight: 1 }}>
                      {ctcDelta === 0 ? "—" : `${sign(ctcDelta)}${fmt(Math.abs(ctcDelta))}`}
                    </div>
                    <div style={{ fontSize: 12, color: clr(ctcDelta), fontFamily: font, marginTop: 3 }}>
                      {subCtc(ctcDelta)}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        };

        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 4 }}>
            {renderDelta(scB)}
            {renderDelta(scC)}
          </div>
        );
      })()}

      {/* ══ LO-only calculation reference note ══════════════════════════════ */}
      {(() => {
        try { const _u = JSON.parse(localStorage.getItem("mtk_app_user") || "null"); if (!_u?.isInternal) return null; } catch { return null; }
        return (
          <div style={{ marginTop: 20, padding: "12px 16px", background: COLORS.bgAlt,
                        border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray, fontFamily: font,
                          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              LO Note — What This Comparison Updates vs. Holds Fixed
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font, marginBottom: 5 }}>
                  Updates per scenario
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 12, color: COLORS.navy, fontFamily: font, lineHeight: 1.8 }}>
                  <li>Purchase price, down payment &amp; loan amount</li>
                  <li>Interest rate &amp; loan term</li>
                  <li>Monthly P&amp;I and PMI</li>
                  <li>Discount points</li>
                  <li>Seller concessions</li>
                  <li>Temporary buydown subsidy (B &amp; C use their own structure/cost)</li>
                  <li>Prepaid interest (per diem, based on rate &amp; loan amount)</li>
                </ul>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font, marginBottom: 5 }}>
                  Held fixed from Fee Sheet
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 12, color: COLORS.navy, fontFamily: font, lineHeight: 1.8 }}>
                  <li>Lender fees (origination, underwriting, processing)</li>
                  <li>Third-party fees (appraisal, credit report, flood, tax svc, etc.)</li>
                  <li>Title fees — owner's &amp; lender's policy, escrow, title search</li>
                  <li>Additional fees (HOA transfer, home warranty, etc.)</li>
                  <li>Insurance premium &amp; tax/insurance reserves</li>
                  <li>Lender credits, earnest money, option fee</li>
                </ul>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ Print button ═════════════════════════════════════════════════ */}
      <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
        <button onClick={printComparison} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer",
          background: COLORS.navy, color: "#fff", fontFamily: font,
          fontSize: 13, fontWeight: 700, letterSpacing: "0.02em",
          boxShadow: "0 2px 8px rgba(12,65,96,0.25)",
        }}>
          🖨 Print Comparison for Client
        </button>
      </div>

    </div>
  );
}

window.MortgageComparison = MortgageComparison;
