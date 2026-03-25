// Refinance Analyzer component

const { useState, useMemo, useEffect, useRef } = React;
const useLocalStorage = window.useLocalStorage;
const pmt = window.pmt;
const buildAmortization = window.buildAmortization;
const calcTrueBreakEven = window.calcTrueBreakEven;
const lookupPMI = window.lookupPMI;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const COLORS = window.COLORS;
const font = window.font;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const Select = window.Select;
const Toggle = window.Toggle;
const MetricCard = window.MetricCard;
const getStateFees = window.getStateFees;
const STATE_TITLE_DATA = window.STATE_TITLE_DATA;
const isHoliday = window.isHoliday;

// ── Refi fee estimator (mirrors Fee Sheet logic, no UI state needed) ──────────
function estimateRefiFees({ la, rate, state, occupancy, closingDate, monthlyTax, monthlyIns, waiveEscrows, piw, waiveTitle, newSurvey, collect90Ins, originationPct, discountPts, nextTaxDueDate, insRenewalDate,
  fsOvUw, fsOvProc, fsOvAppr, fsOvCr, fsOvFlood, fsOvTaxSvc, fsOvDocPrep, fsOvSurvey, fsOvEscFee, fsOvTitleSearch,
  loDefUw, loDefProc, loDefAppr, loDefCr, loDefFlood, loDefTaxSvc, loDefDocPrep, loDefSurvey, loDefEscFee, loDefTitleSearch,
  defUw, defProc, defAppr, defCr, defFlood, defTaxSvc, defDocPrep, defSurvey, defEscFee, defTitleSearch,
}) {
  if (!getStateFees || !STATE_TITLE_DATA || la <= 0) return null;
  const st    = getStateFees(state || "TX");
  const stT   = STATE_TITLE_DATA[state] || STATE_TITLE_DATA["TX"];

  // Fee hierarchy helpers (mirrors Fee Sheet exactly):
  // ov = per-transaction override wins first
  // lo = LO-level default wins second
  // def = global admin default wins third
  // hardcoded = fallback
  const ov  = (val, fb)  => { const n = parseFloat(val); return (val !== "" && val != null && !isNaN(n)) ? n : fb; };
  const lo  = (val, fb)  => { const n = parseFloat(val); return (val !== "" && val != null && !isNaN(n)) ? n : fb; };
  const def = (cust, hc) => { const n = parseFloat(cust); return (cust !== "" && cust != null && !isNaN(n)) ? n : hc; };

  // Lender fees — mirrors Fee Sheet hierarchy (origination + discount + underwriting + processing)
  const origination   = Math.round(la * (parseFloat(originationPct) || 0) / 100);
  const discount      = Math.round(la * (parseFloat(discountPts)    || 0) / 100);
  const underwriting  = ov(fsOvUw,   lo(loDefUw,   def(defUw,   1000)));
  const processingFee = ov(fsOvProc, lo(loDefProc, def(defProc, 595)));
  const lenderFees    = origination + discount + underwriting + processingFee;

  // Third-party fees — same ov/lo/def hierarchy as Fee Sheet
  const appraisal    = piw ? 0 : ov(fsOvAppr,   lo(loDefAppr,   def(defAppr,   750)));
  const creditReport = ov(fsOvCr,     lo(loDefCr,     def(defCr,     350)));
  const floodCert    = ov(fsOvFlood,  lo(loDefFlood,  def(defFlood,  st.floodCert     || 14)));
  const taxService   = ov(fsOvTaxSvc, lo(loDefTaxSvc, def(defTaxSvc, st.taxServiceFee || 85)));
  const docPrep      = ov(fsOvDocPrep, lo(loDefDocPrep, def(defDocPrep, 250)));
  const surveyDefault = lo(loDefSurvey, def(defSurvey, st.surveyFee || 450));
  const survey       = newSurvey ? ov(fsOvSurvey, surveyDefault) : 0;
  const thirdParty   = appraisal + creditReport + floodCert + taxService + docPrep + survey;

  // Title fees — refi uses only lender title policy (no owner's policy)
  const lenderTitle  = waiveTitle ? 0 : (stT ? Math.round(stT.basicRate(la)) : Math.round(la * 0.005));
  const escrowFeeDefaultCalc = Math.round(Math.max(500, la * 0.001));
  const escrowFee    = ov(fsOvEscFee, lo(loDefEscFee, def(defEscFee, escrowFeeDefaultCalc)));
  const titleSearch  = ov(fsOvTitleSearch, lo(loDefTitleSearch, def(defTitleSearch, 250)));
  const recording    = 150;
  const courier      = 50;
  const taxCert      = state === "TX" ? 25 : (st.taxCertERecording || 25);
  const titleFees    = lenderTitle + escrowFee + titleSearch + recording + courier + taxCert;

  const closingFees  = lenderFees + thirdParty + titleFees;

  // Prepaids — prepaid interest + escrow reserves
  let prepaidInterest = 0, prepaidDays = 0, dailyRate = 0;
  let fd = null;
  if (closingDate && la > 0 && rate > 0) {
    const p  = closingDate.split("-");
    const cd = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    // TX primary homestead refi: 3 rescission days after closing (skip Sundays + federal holidays),
    // matching Fee Sheet's addRescissionDays logic exactly
    const isTXHomestead = state === "TX" && occupancy === "primary";
    fd = new Date(cd);
    if (isTXHomestead) {
      let added = 0;
      while (added < 3) {
        fd = new Date(fd.getFullYear(), fd.getMonth(), fd.getDate() + 1);
        if (fd.getDay() !== 0) { // not Sunday (Saturdays count per TILA)
          const iso = `${fd.getFullYear()}-${String(fd.getMonth()+1).padStart(2,"0")}-${String(fd.getDate()).padStart(2,"0")}`;
          if (!isHoliday(iso, fd.getFullYear())) added++;
        }
      }
    }
    const daysInMonth = new Date(fd.getFullYear(), fd.getMonth() + 1, 0).getDate();
    prepaidDays     = Math.max(1, daysInMonth - fd.getDate() + 1);
    dailyRate       = (la * (rate / 100)) / 365;
    prepaidInterest = Math.round(dailyRate * prepaidDays);
  }

  // Escrow reserves — use full RESPA aggregate calc when tax/ins renewal dates are available
  // (mirrors Fee Sheet's RESPA logic exactly); otherwise fall back to flat 3-month formula
  let taxRes = 0, insRes = 0, aggregateAdj = 0;
  let taxReserveMonths = 3, insReserveMonths = 3;
  if (!waiveEscrows) {
    const mTax = parseFloat(monthlyTax) || 0;
    const mIns = parseFloat(monthlyIns) || 0;
    if (fd && nextTaxDueDate && insRenewalDate) {
      // First payment date = funding month + 2 months, day 1 (same formula as Fee Sheet)
      const fpRaw = fd.getMonth() + 2;
      const fpYear  = fd.getFullYear() + Math.floor(fpRaw / 12);
      const fpMonth = fpRaw % 12; // 0-based
      const fpDate  = new Date(fpYear, fpMonth, 1);
      const fpY = fpDate.getFullYear(), fpM = fpDate.getMonth() + 1; // 1-based

      const taxParts   = nextTaxDueDate.split("-");
      const insParts   = insRenewalDate.split("-");
      const taxDue = new Date(parseInt(taxParts[0]), parseInt(taxParts[1]) - 1, parseInt(taxParts[2]));
      const insDue = new Date(parseInt(insParts[0]), parseInt(insParts[1]) - 1, parseInt(insParts[2]));

      let N = (taxDue.getFullYear() - fpY) * 12 + (taxDue.getMonth() + 1 - fpM);
      if (N <= 0) N += 12;
      if (N > 12) N = 12;
      let M = (insDue.getFullYear() - fpY) * 12 + (insDue.getMonth() + 1 - fpM);
      if (M <= 0) M += 12;
      if (M > 12) M = 12;

      taxReserveMonths = Math.max(2, 14 - N);
      insReserveMonths = Math.max(2, 14 - M);
      taxRes = Math.round(mTax * taxReserveMonths);
      insRes = Math.round(mIns * insReserveMonths);

      // 12-month aggregate adjustment simulation (same as Fee Sheet)
      const monthly = mTax + mIns;
      let bal = taxRes + insRes, minBal = bal;
      for (let mo = 1; mo <= 12; mo++) {
        bal += monthly;
        if (mo === N) bal -= (mTax * 12);
        if (mo === M) bal -= (mIns * 12);
        if (bal < minBal) minBal = bal;
      }
      aggregateAdj = Math.round(2 * monthly - minBal);
    } else {
      taxRes = Math.round(mTax * 3);
      insRes = Math.round(mIns * 3);
    }
  }

  const ins90    = (waiveEscrows && collect90Ins) ? Math.round((parseFloat(monthlyIns) || 0) * 3) : 0;
  const prepaids = prepaidInterest + taxRes + insRes + aggregateAdj + ins90;

  return {
    closingFees, prepaids,
    detail: {
      origination, discount, underwriting, processingFee, lenderFees,
      appraisal, creditReport, floodCert, taxService, docPrep, survey, thirdParty,
      lenderTitle, escrowFee, titleSearch, recording, courier, taxCert, titleFees,
      prepaidInterest, prepaidDays, dailyRate,
      taxRes, taxReserveMonths, insRes, insReserveMonths, aggregateAdj, ins90,
    }
  };
}

function RefinanceAnalyzer({ isInternal, user }) {
  const userId = user?.id || "default";
  const [curBalance, setCurBalance] = useLocalStorage("ra_cb", "320000");
  const [curRate, setCurRate] = useLocalStorage("ra_cr", "7.25");
  const [curTermOriginal, setCurTermOriginal] = useLocalStorage("ra_cto", "30");
  const [origLoanAmount, setOrigLoanAmount] = useLocalStorage("ra_ola", "340000");
  // Note date replaces "months paid" — skip first month after closing (close Jun → first pmt Aug)
  const [noteDate, setNoteDate] = useLocalStorage("ra_notedate", "2023-03-01");
  const todayRA = new Date();
  const defaultLastPmt = todayRA.getFullYear() + "-" + String(todayRA.getMonth() + 1).padStart(2, "0") + "-01";
  const [lastPaymentDate, setLastPaymentDate] = useLocalStorage("ra_lastpmt", defaultLastPmt);
  const [curPMI, setCurPMI] = useLocalStorage("ra_cpmi", "185");
  const [curHomeValue, setCurHomeValue] = useLocalStorage("ra_chv", "420000");
  // Property info
  const [raAddr, setRaAddr] = useLocalStorage("ra_addr", "");
  const [raCity, setRaCity] = useLocalStorage("ra_city", "");
  const [raState, setRaState] = useLocalStorage("ra_state", "TX");
  const [raZip, setRaZip] = useLocalStorage("ra_zip", "");
  // Loan metadata
  const [raOcc, setRaOcc] = useLocalStorage("ra_occ", "primary");
  const [raProg, setRaProg] = useLocalStorage("ra_prog", "conventional");
  const [raPropType, setRaPropType] = useLocalStorage("ra_proptype", "sfr");
  const [raLoanType, setRaLoanType] = useLocalStorage("ra_loantype", "fixed");
  const [raCurPI, setRaCurPI] = useLocalStorage("ra_curpi", "");
  // Split escrow (replaces single curEscrow)
  const [raInsRenew, setRaInsRenew] = useLocalStorage("ra_insrenew", "");
  // New loan metadata
  const [raNewProg, setRaNewProg] = useLocalStorage("ra_newprog", "conventional");
  const [raNewOcc, setRaNewOcc] = useLocalStorage("ra_newocc", "primary");
  // Second mortgage
  const [hasSecondMtg, setHasSecondMtg] = useLocalStorage("ra_has2nd", false);
  const [secondRate, setSecondRate] = useLocalStorage("ra_2rate", "9.0");
  const [secondTerm, setSecondTerm] = useLocalStorage("ra_2term", "20");
  const [secondOrigBal, setSecondOrigBal] = useLocalStorage("ra_2orig", "50000");
  const [secondBalance, setSecondBalance] = useLocalStorage("ra_2bal", "45000");
  const [secondPI, setSecondPI] = useLocalStorage("ra_2pi", "450");
  const [secondNoteDate, setSecondNoteDate] = useLocalStorage("ra_2nd", "");
  const [newRate, setNewRate] = useLocalStorage("ra_nr", "6.25");
  const [newTerm, setNewTerm] = useLocalStorage("ra_nt", "30");
  const [raClosingFees,    setRaClosingFees]    = useLocalStorage("fs_cf",  "");
  const [raPrepaids,       setRaPrepaids]       = useLocalStorage("fs_tpp", "");
  const [rollInCosts, setRollInCosts] = useLocalStorage("ra_ric", "all");  // "none" | "all" | "partial" | "partial-payment" | "principal-buydown"
  const [rollInAmount, setRollInAmount] = useLocalStorage("ra_ria", "");
  const [principalBuydown, setPrincipalBuydown] = useLocalStorage("ra_pbd", "");
  const [waiveEscrows, setWaiveEscrows] = useLocalStorage("ra_we", false);
  const [escrowBalance, setEscrowBalance] = useLocalStorage("ra_escbal", "");
  const [netEscrows, setNetEscrows] = useLocalStorage("ra_netesc", false);
  // Internal transaction flags
  const [piw, setPiw] = useLocalStorage("ra_piw", false);
  const [newSurvey, setNewSurvey] = useLocalStorage("ra_survey", false);
  // Fee Sheet keys — read by RA so fee estimate stays in sync with FSG
  const [fsOriginationPct] = useLocalStorage("fs_op",           "1.0");
  const [fsDiscountPts]    = useLocalStorage("fs_dp",           "0");
  const [fsNextTaxDue]     = useLocalStorage("fs_next_tax_due", "");
  const [fsInsRenew]       = useLocalStorage("fs_ins_renew",    "");
  // Per-transaction fee overrides (mirror Fee Sheet's fs_ov_* keys)
  const [fsOvUw]          = useLocalStorage("fs_ov_uw",      "");
  const [fsOvProc]        = useLocalStorage("fs_ov_proc",    "");
  const [fsOvAppr]        = useLocalStorage("fs_ov_appr",    "");
  const [fsOvCr]          = useLocalStorage("fs_ov_cr",      "");
  const [fsOvFlood]       = useLocalStorage("fs_ov_flood",   "");
  const [fsOvTaxSvc]      = useLocalStorage("fs_ov_taxsvc",  "");
  const [fsOvDocPrep]     = useLocalStorage("fs_ov_docprep", "");
  const [fsOvSurvey]      = useLocalStorage("fs_ov_survey",  "");
  const [fsOvEscFee]      = useLocalStorage("fs_ov_escfee",  "");
  const [fsOvTitleSearch] = useLocalStorage("fs_ov_tsrch",   "");
  // LO-level defaults (per-user, same keys as Fee Sheet)
  const [loDefUw]         = useLocalStorage(`${userId}_lo_uw`,      "1000");
  const [loDefProc]       = useLocalStorage(`${userId}_lo_proc`,    "595");
  const [loDefAppr]       = useLocalStorage(`${userId}_lo_appr`,    "750");
  const [loDefCr]         = useLocalStorage(`${userId}_lo_cr`,      "350");
  const [loDefFlood]      = useLocalStorage(`${userId}_lo_flood`,   "14");
  const [loDefTaxSvc]     = useLocalStorage(`${userId}_lo_taxsvc`,  "85");
  const [loDefDocPrep]    = useLocalStorage(`${userId}_lo_docprep`, "250");
  const [loDefSurvey]     = useLocalStorage(`${userId}_lo_survey`,  "450");
  const [loDefEscFee]     = useLocalStorage(`${userId}_lo_escrow`,  "");
  const [loDefTitleSearch]= useLocalStorage(`${userId}_lo_title`,   "250");
  // Global admin defaults (same keys as Fee Sheet)
  const [defUw]           = useLocalStorage("fs_def_uw",      "");
  const [defProc]         = useLocalStorage("fs_def_proc",    "");
  const [defAppr]         = useLocalStorage("fs_def_appr",    "");
  const [defCr]           = useLocalStorage("fs_def_cr",      "");
  const [defFlood]        = useLocalStorage("fs_def_flood",   "");
  const [defTaxSvc]       = useLocalStorage("fs_def_taxsvc",  "");
  const [defDocPrep]      = useLocalStorage("fs_def_docprep", "");
  const [defSurvey]       = useLocalStorage("fs_def_survey",  "");
  const [defEscFee]       = useLocalStorage("fs_def_escrow",  "");
  const [defTitleSearch]  = useLocalStorage("fs_def_title",   "");
  const [waiveTitle, setWaiveTitle] = useLocalStorage("ra_waivtitle", false);
  const [collect90Ins, setCollect90Ins] = useLocalStorage("ra_c90ins", false);
  // Shared short pay — same key as Fee Sheet so toggle stays in sync across both tabs
  const [shortPay, setShortPay] = useLocalStorage("fs_sp", false);
  const default30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  // Shared closing date key with Fee Sheet — both modules read/write the same slot
  const [newClosingDate, setNewClosingDate] = useLocalStorage("fs_closing_date", default30);
  const [cashOutEnabled, setCashOutEnabled] = useLocalStorage("ra_coe", false);
  const [cashOutAmount, setCashOutAmount] = useLocalStorage("ra_coa", "0");
  // Shared FICO — same localStorage key as Payment Calculator so both tabs stay in sync
  const [ficoScore, setFicoScore] = useLocalStorage("pc_fico", "740");
  // Shared tax/insurance — same localStorage keys as Payment Calculator so all tabs stay in sync.
  // Use pc_taxm/pc_insm (shared with PC) so mode changes propagate across all tabs.
  const [taxMode, setTaxMode] = useLocalStorage("pc_taxm", "rate");
  const [propertyTax, setPropertyTax] = useLocalStorage("pc_tax", "");
  const [propertyTaxRate, setPropertyTaxRate] = useLocalStorage("pc_taxr", "2.3");
  const [homesteadExemption, setHomesteadExemption] = useLocalStorage("pc_hse", false);
  const [insMode, setInsMode] = useLocalStorage("pc_insm", "rate");
  const [homeInsurance, setHomeInsurance] = useLocalStorage("pc_ins", "");
  const [homeInsuranceRate, setHomeInsuranceRate] = useLocalStorage("pc_insr", "0.7");
  const [activeTab, setActiveTab] = useState("summary");
  const [strikeTarget, setStrikeTarget] = useLocalStorage("ra_strike_target", "36");

  // ── Calculate months paid from note date (skip 1st month after closing) ──
  const monthsPaidCalc = useMemo(() => {
    if (!noteDate) return 0;
    const nd = new Date(noteDate + "T00:00:00");
    const now = new Date();
    // First payment is 2 months after note date (close Jun → first pmt Aug)
    const firstPmtYear = nd.getMonth() + 2 > 11 ? nd.getFullYear() + 1 : nd.getFullYear();
    const firstPmtMonth = (nd.getMonth() + 2) % 12;
    const pmtsMade = (now.getFullYear() - firstPmtYear) * 12 + (now.getMonth() - firstPmtMonth);
    return Math.max(0, pmtsMade);
  }, [noteDate]);

  // ── Calculate per-diem interest days for payoff ──
  const payoffDaysCalc = useMemo(() => {
    // Payoff date: use closing date when set, otherwise estimate today + 30 days
    const payoffDate = newClosingDate
      ? new Date(newClosingDate + "T00:00:00")
      : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();

    if (lastPaymentDate) {
      // Exact: days from last payment date through payoff date
      const lp = new Date(lastPaymentDate + "T00:00:00");
      const days = Math.ceil((payoffDate.getTime() - lp.getTime()) / (1000 * 60 * 60 * 24));
      // If last payment date is on or after closing date (data entry issue),
      // fall through to the standard fallback rather than showing 0
      if (days > 0) return days;
    }

    // Fallback when last payment date isn't entered: standard convention is that
    // the last payment covered through the end of the prior month, so per-diem
    // days owed to the existing servicer = the closing day number (days 1 through closing day).
    return payoffDate.getDate();
  }, [lastPaymentDate, newClosingDate]);

  const analysis = useMemo(() => {
    const cb = parseFloat(curBalance) || 0;
    const cr = (parseFloat(curRate) || 0) / 100 / 12;
    const crAnnual = (parseFloat(curRate) || 0) / 100;
    const cTermOrig = (parseFloat(curTermOriginal) || 30) * 12;
    const cPaid = monthsPaidCalc;
    const cRemaining = Math.max(cTermOrig - cPaid, 1);
    const cPmiMonthly = parseFloat(curPMI) || 0;
    const hv = parseFloat(curHomeValue) || 0;
    // Shared tax/ins from Payment Calculator state (dual-mode: rate or dollar)
    const useHomestead = raState === "TX" && taxMode === "rate" && raOcc === "primary";
    const taxBasis = useHomestead ? hv * 0.80 : hv;
    const monthlyTax = taxMode === "rate"
      ? (taxBasis * ((parseFloat(propertyTaxRate) || 0) / 100)) / 12
      : (parseFloat(propertyTax) || 0);
    const monthlyIns = insMode === "rate"
      ? (hv * ((parseFloat(homeInsuranceRate) || 0) / 100)) / 12
      : (parseFloat(homeInsurance) || 0);
    const escrow = monthlyTax + monthlyIns;
    const nr = (parseFloat(newRate) || 0) / 100 / 12;
    const nTermMonths = (parseFloat(newTerm) || 30) * 12;
    const cc = (parseFloat(raClosingFees) || 0) + (parseFloat(raPrepaids) || 0);
    // cf = closing fees ONLY (excludes prepaids). Used for ALL break-even math.
    // Prepaids (prepaid interest + escrow reserves) are paid by the homeowner
    // regardless of whether they refinance, so they are NOT a cost of the refi
    // and must not be included when calculating how long it takes to recover costs.
    const cf = parseFloat(raClosingFees) || 0;
    const co = parseFloat(cashOutAmount) || 0;
    // nPmiMonthly computed below after newLTV is known

    // ── Estimated payoff from original loan data ──
    const ola = parseFloat(origLoanAmount) || 0;
    let estimatedBalance = 0;
    let origPI = 0;
    if (ola > 0 && cr > 0 && cTermOrig > 0) {
      origPI = pmt(cr, cTermOrig, ola);
      // Amortize the original loan forward by cPaid months
      let bal = ola;
      for (let m = 0; m < cPaid; m++) {
        const interest = bal * cr;
        const princ = origPI - interest;
        bal = Math.max(0, bal - princ);
      }
      estimatedBalance = bal;
    }
    // Per-diem interest for payoff quote
    const dailyInterest = cb * crAnnual / 365;
    const perDiemDays = payoffDaysCalc;
    const payoffFee = 150;
    const escBal = parseFloat(escrowBalance) || 0;
    const escrowCredit = netEscrows ? escBal : 0;
    // Short pay: loan funds in first 5 days of month — existing servicer owes
    // back interest already collected, so per-diem is a credit (negative)
    const closingDay = newClosingDate ? parseInt(newClosingDate.split('-')[2]) : 0;
    const isShortPay = shortPay && closingDay >= 1 && closingDay <= 5;
    const perDiemAmount = isShortPay ? -(dailyInterest * perDiemDays) : (dailyInterest * perDiemDays);
    const estimatedPayoff = cb + perDiemAmount + payoffFee - escrowCredit;

    // Observation: has the borrower been making extra payments?
    const balanceDiff = estimatedBalance - cb;
    const extraPaymentObservation = (ola > 0 && estimatedBalance > 0 && balanceDiff > 500)
      ? { detected: true, amount: balanceDiff, message: "It appears approximately " + fmt(balanceDiff) + " in extra principal payments have been made. Great job! The stated balance is lower than expected based on the original amortization schedule." }
      : { detected: false, amount: 0, message: "" };

    // ── Second mortgage ──
    const s2bal = hasSecondMtg ? (parseFloat(secondBalance) || 0) : 0;
    const s2pi = hasSecondMtg ? (parseFloat(secondPI) || 0) : 0;

    const curPI = pmt(cr, cRemaining, cb);
    const curTotalPayment = curPI + cPmiMonthly + escrow + s2pi;
    const approxNewPI = pmt(nr, nTermMonths, cb + s2bal + co);
    const rolledIn = rollInCosts === "all" ? cc
      : rollInCosts === "partial-payment" ? Math.max(0, cc - approxNewPI)
      : rollInCosts === "partial" ? (parseFloat(rollInAmount) || 0) : 0;
    const costsDueAtClosing = cc - rolledIn;
    const pbd = rollInCosts === "principal-buydown" ? Math.max(0, parseFloat(principalBuydown) || 0) : 0;
    const newLoanAmt = estimatedPayoff + s2bal + rolledIn + co - pbd;
    const newLTV = hv > 0 ? (newLoanAmt / hv) * 100 : 0;
    const fico = parseInt(ficoScore) || 740;
    const pmiResult = lookupPMI({
      ltv: newLTV, fico, termYears: nTermMonths / 12, occupancy: raNewOcc,
      isFixed: true, isCashOut: co > 0, isMultiBorrower: false, highDTI: false
    });
    const nPmiRate = pmiResult.rate ? pmiResult.rate * 100 : 0;
    const nPmiMonthly = newLTV <= 80 ? 0 : (newLoanAmt * nPmiRate / 100) / 12;
    const newPI = pmt(nr, nTermMonths, newLoanAmt);
    const isVAProg = raNewProg === "va-new" || raNewProg === "va-non-irrrl" || raNewProg === "va-irrrl";
    const escrowWaiverBlocked = raNewProg === "fha" || raNewProg === "usda" || isVAProg
      || (raNewProg === "conventional" && newLTV > 90);
    const effectiveWaiveEscrows = waiveEscrows && !escrowWaiverBlocked;
    const vaLabel = raNewProg === "va-irrrl" ? "VA IRRRL" : raNewProg === "va-non-irrrl" ? "VA to VA" : "VA";
    const escrowWaiverBlockReason = raNewProg === "fha" || raNewProg === "usda"
      ? `Escrow waivers are not permitted on ${raNewProg.toUpperCase()} loans.`
      : isVAProg
      ? `Escrow waivers are not permitted on ${vaLabel} loans.`
      : (raNewProg === "conventional" && newLTV > 90)
      ? `Escrow waivers require LTV ≤ 90% for Conventional loans (current LTV: ${newLTV.toFixed(1)}%).`
      : null;
    const newTotalPayment = newPI + nPmiMonthly + (effectiveWaiveEscrows ? 0 : escrow);

    // APR (Reg Z): amount financed = loan amount minus all finance charges (closing costs)
    const amtFinanced = newLoanAmt - cc;
    let apr = 0;
    if (amtFinanced > 0 && newPI > 0 && nTermMonths > 0 && nr > 0) {
      let r = nr;
      for (let i = 0; i < 100; i++) {
        const factor = Math.pow(1 + r, nTermMonths);
        const fVal = newPI * (factor - 1) / (r * factor) - amtFinanced;
        const fDeriv = newPI * (nTermMonths * r - (factor - 1) * (1 + r)) / (r * r * factor * (1 + r));
        if (Math.abs(fDeriv) < 1e-15) break;
        const rNew = r - fVal / fDeriv;
        if (Math.abs(rNew - r) < 1e-10) { r = rNew; break; }
        r = Math.max(1e-8, rNew);
      }
      apr = r * 12 * 100;
    }
    const monthlySavings = (curPI + cPmiMonthly + s2pi) - (newPI + nPmiMonthly);

    // First payment date: close month + 2 (skip first month convention)
    let firstPaymentDate = null;
    if (newClosingDate) {
      const cd = new Date(newClosingDate + "T00:00:00");
      if (!isNaN(cd.getTime())) {
        const fpd = new Date(cd.getFullYear(), cd.getMonth() + 2, 1);
        firstPaymentDate = fpd;
      }
    }
    const curSchedule = buildAmortization(cb, cr, cRemaining, curPI);
    const newSchedule = buildAmortization(newLoanAmt, nr, nTermMonths, newPI);
    const curTotalInterest = curSchedule.reduce((s, r) => s + r.interest, 0);
    const newTotalInterest = newSchedule.reduce((s, r) => s + r.interest, 0);
    const interestSaved = curTotalInterest - newTotalInterest;
    const maxAnalysisMonths = Math.max(cRemaining, nTermMonths);
    const trueBreakEven = calcTrueBreakEven(curSchedule, newSchedule, cPmiMonthly, nPmiMonthly, cf, maxAnalysisMonths);
    const fiveYr = 60;
    const cur5YrInterest = curSchedule.slice(0, fiveYr).reduce((s, r) => s + r.interest, 0);
    const new5YrInterest = newSchedule.slice(0, fiveYr).reduce((s, r) => s + r.interest, 0);
    const cur5YrPMI = cPmiMonthly * Math.min(fiveYr, cRemaining);
    const new5YrPMI = nPmiMonthly * Math.min(fiveYr, nTermMonths);
    const fiveYearSavings = (cur5YrInterest + cur5YrPMI) - (new5YrInterest + new5YrPMI) - cf;
    const lazyBreakEven = monthlySavings > 0 ? Math.ceil(cf / monthlySavings) : null;
    const curLTV = hv > 0 ? (cb / hv) * 100 : 0;
    let npv = -cc;
    for (let m = 1; m <= Math.min(cRemaining, nTermMonths); m++) {
      const sav = (curSchedule[m - 1]?.interest || 0) + cPmiMonthly - (newSchedule[m - 1]?.interest || 0) - nPmiMonthly;
      npv += sav / Math.pow(1 + cr, m);
    }
    return {
      curPI, curTotalPayment, newPI, newTotalPayment, newLoanAmt, monthlySavings,
      curSchedule, newSchedule, curTotalInterest, newTotalInterest, interestSaved,
      fiveYearSavings, trueBreakEven, lazyBreakEven, curLTV, newLTV, npv, cRemaining,
      closingCosts: cc, closingFeesOnly: cf, costsDueAtClosing, rolledIn, cPmiMonthly, nPmiMonthly, nTermMonths,
      cashOut: co, escrow, monthlyTax, monthlyIns, escrowCredit, escBal,
      monthsPaid: cPaid, estimatedBalance, estimatedPayoff, dailyInterest, perDiemDays, perDiemAmount, isShortPay, payoffFee,
      extraPaymentObservation, origPI, secondBalance: s2bal, secondPI: s2pi,
      statedPIDiff: raCurPI ? ((parseFloat(raCurPI) || 0) - curPI) : null,
      firstPaymentDate, pmiResult, nPmiRate, apr, amtFinanced,
      escrowWaiverBlocked, effectiveWaiveEscrows, escrowWaiverBlockReason
    };
  }, [curBalance, curRate, curTermOriginal, monthsPaidCalc, origLoanAmount, curPMI, curHomeValue, taxMode, propertyTaxRate, propertyTax, raState, raOcc, insMode, homeInsuranceRate, homeInsurance, escrowBalance, netEscrows, raCurPI, newRate, newTerm, raClosingFees, raPrepaids, rollInCosts, rollInAmount, principalBuydown, waiveEscrows, newClosingDate, ficoScore, raNewOcc, raNewProg, cashOutEnabled, cashOutAmount, payoffDaysCalc, hasSecondMtg, secondBalance, secondPI, shortPay]);

  // ── Strike Rate: binary-search for the rate that achieves each target breakeven ──
  // Uses simple cash-flow method (closing fees ÷ monthly P&I savings) for speed.
  // nPmiMonthly is held constant — it depends on LTV/LA, not on the test rate.
  const strikeRates = useMemo(() => {
    const { newLoanAmt, nTermMonths, closingFeesOnly, curPI, cPmiMonthly, nPmiMonthly } = analysis;
    if (newLoanAmt <= 0 || nTermMonths <= 0 || curPI <= 0) return null;

    const pmtAt = (annualPct) => {
      const r = annualPct / 100 / 12;
      if (r <= 0) return newLoanAmt / nTermMonths;
      return newLoanAmt * r / (1 - Math.pow(1 + r, -nTermMonths));
    };

    const findRate = (targetMonths) => {
      if (closingFeesOnly <= 0 || targetMonths <= 0) return null;
      const maxPct = parseFloat(curRate) || 15;
      // savings needed per month = closingFeesOnly / targetMonths
      // newPI must be small enough that (curPI + curPMI) - newPI - nPMI >= needSavings
      const targetPI = (curPI + cPmiMonthly) - nPmiMonthly - (closingFeesOnly / targetMonths);
      if (targetPI <= 0) return 0.001; // near-zero rate achieves this
      if (pmtAt(0.001) > targetPI) return null; // impossible — even ~0% not enough
      if (pmtAt(maxPct) <= targetPI) return maxPct; // current rate already achieves it
      // Binary search: pmt() is monotonically increasing with rate
      let lo = 0.001, hi = maxPct;
      for (let i = 0; i < 80; i++) {
        const mid = (lo + hi) / 2;
        if (pmtAt(mid) > targetPI) hi = mid; else lo = mid;
        if (hi - lo < 0.0005) break;
      }
      return (lo + hi) / 2;
    };

    const tgt = Math.max(1, Math.min(120, parseInt(strikeTarget) || 36));
    return {
      custom: findRate(tgt),
      table:  [6, 12, 18, 24, 30, 36, 42, 48, 54, 60].map(t => ({ months: t, rate: findRate(t) })),
    };
  }, [analysis, strikeTarget, curRate]);

  // ── Sync + auto-estimate fees (single effect, fees computed BEFORE broadcast) ─
  // Merged into one effect so fee values are written to localStorage BEFORE
  // mtk_propagated fires. The previous two-effect design let the sync effect
  // broadcast a stale fs_cf/fs_tpp while the auto-estimate hadn't run yet,
  // causing the propagated handlers to reset fees to old values on rate/cashout changes.
  // Now: estimate → write LS → write PC keys → broadcast — in that order.
  // Converges in 2–4 renders when rolled-in costs shift the loan amount.
  useEffect(() => {
    const nla = analysis.newLoanAmt;
    if (!nla || nla <= 0) return;
    const setLS = (k, v) => { try { localStorage.setItem("mtk_" + k, JSON.stringify(v)); } catch {} };

    // ── 1. Auto-estimate fees (write to LS before broadcast) ─────────────────
    const est = estimateRefiFees({
      la:           nla,
      rate:         parseFloat(newRate) || 0,
      state:        raState || "TX",
      occupancy:    raNewOcc,
      closingDate:  newClosingDate,
      monthlyTax:   analysis.monthlyTax,
      monthlyIns:   analysis.monthlyIns,
      waiveEscrows: analysis.effectiveWaiveEscrows,
      piw, waiveTitle, newSurvey, collect90Ins,
      originationPct: fsOriginationPct,
      discountPts:    fsDiscountPts,
      nextTaxDueDate: fsNextTaxDue,
      insRenewalDate: fsInsRenew,
      fsOvUw, fsOvProc, fsOvAppr, fsOvCr, fsOvFlood, fsOvTaxSvc, fsOvDocPrep, fsOvSurvey, fsOvEscFee, fsOvTitleSearch,
      loDefUw, loDefProc, loDefAppr, loDefCr, loDefFlood, loDefTaxSvc, loDefDocPrep, loDefSurvey, loDefEscFee, loDefTitleSearch,
      defUw, defProc, defAppr, defCr, defFlood, defTaxSvc, defDocPrep, defSurvey, defEscFee, defTitleSearch,
    });
    if (est) {
      const cf = Math.round(est.closingFees);
      const pp = Math.round(est.prepaids);
      // Convergence guard — stop when stable to break the rolled-in-costs loop
      if (cf !== Math.round(parseFloat(raClosingFees) || 0) ||
          pp !== Math.round(parseFloat(raPrepaids)    || 0)) {
        // Write to localStorage FIRST so mtk_propagated reads fresh values below
        setLS("fs_cf",  String(cf));
        setLS("fs_tpp", String(pp));
        setRaClosingFees(String(cf));
        setRaPrepaids(String(pp));
      }
    }

    // ── 2. Sync to Payment Calculator ────────────────────────────────────────
    setLS("pc_rate",     newRate);
    setLS("pc_term",     newTerm);
    setLS("pc_la",       String(Math.round(nla)));
    setLS("pc_hp",       curHomeValue);
    setLS("pc_state",    raState);
    setLS("pc_occ",      raOcc);
    setLS("pc_purpose",  "refinance");
    // Push RA's computed monthly tax/ins to shared keys so all tabs stay in sync.
    // Only overwrite when RA actually has data entered — avoids clobbering FSG/PC when RA is blank.
    const hasTaxData = taxMode === "rate" ? (parseFloat(curHomeValue) > 0) : (propertyTax !== "" && propertyTax != null);
    const hasInsData = insMode === "rate" ? (parseFloat(curHomeValue) > 0) : (homeInsurance !== "" && homeInsurance != null);
    if (hasTaxData) setLS("fs_mt", String(Math.round(analysis.monthlyTax)));
    if (hasInsData) setLS("fs_mi", String(Math.round(analysis.monthlyIns)));

    // ── 3. Broadcast (fees already in LS, so handlers read fresh values) ─────
    window.dispatchEvent(new Event("mtk_propagated"));
  }, [analysis, newRate, raState, raNewOcc, newClosingDate, piw, waiveTitle, newSurvey, collect90Ins,
      fsOriginationPct, fsDiscountPts, fsNextTaxDue, fsInsRenew,
      fsOvUw, fsOvProc, fsOvAppr, fsOvCr, fsOvFlood, fsOvTaxSvc, fsOvDocPrep, fsOvSurvey, fsOvEscFee, fsOvTitleSearch,
      loDefUw, loDefProc, loDefAppr, loDefCr, loDefFlood, loDefTaxSvc, loDefDocPrep, loDefSurvey, loDefEscFee, loDefTitleSearch,
      defUw, defProc, defAppr, defCr, defFlood, defTaxSvc, defDocPrep, defSurvey, defEscFee, defTitleSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rate formatting: always 1 decimal minimum, max 3 decimals (e.g. "6" → "6.0", "6.1234" → "6.123")
  const fmtRateBlur = (v, setter) => {
    const n = parseFloat(v);
    if (isNaN(n) || v === "" || v === null) return;
    const decimals = (v.toString().split(".")[1] || "").length;
    setter(decimals === 0 ? n.toFixed(1) : decimals > 3 ? n.toFixed(3) : v);
  };

  const REFI_AMBER = "#B86B00"; // distinct warm amber — not the app's standard gold
  const getRecommendation = () => {
    const { trueBreakEven, fiveYearSavings, monthlySavings } = analysis;
    const be = trueBreakEven.breakEvenMonth;
    const beYrs = be ? (be / 12).toFixed(1) : null;
    if (monthlySavings <= 0 && fiveYearSavings <= 0) return { verdict: "⛔  NOT RECOMMENDED", color: COLORS.red, reason: "The new loan costs more than the current one — this refinance does not make financial sense." };
    if (!be) return { verdict: "⛔  NOT RECOMMENDED", color: COLORS.red, reason: "The new loan never costs less than keeping the current loan within the analysis window." };
    if (be <= 18 && fiveYearSavings > 5000) return { verdict: "✅  THIS REFINANCE MAKES STRONG SENSE", color: COLORS.green, reason: `Break-even in just ${be} months (${beYrs} yrs) — that's outstanding. You're recouping costs in well under 2 years with ${fmt(fiveYearSavings)} in real 5-year savings. We strongly recommend moving forward.` };
    if (be <= 36) return { verdict: "✅  THIS REFINANCE MAKES SENSE", color: COLORS.green, reason: `Break-even in ${be} months (${beYrs} yrs). Recouping closing costs in under 3 years is a solid result — this refinance makes sense and we recommend pursuing it.` };
    if (be <= 60) return { verdict: "⚠️  COULD MAKE SENSE — LET'S VALIDATE THE NUMBERS", color: REFI_AMBER, reason: `Break-even takes ${be} months (${beYrs} yrs). This could make sense depending on your situation, but it will depend on the circumstances. How long do you plan to stay in the home? Let's talk through the specifics and make sure the numbers hold up before moving forward.` };
    return { verdict: "⛔  NOT TYPICALLY RECOMMENDED", color: COLORS.red, reason: `Break-even of ${be} months (${beYrs} yrs) is too far out. We typically don't recommend refinancing when break-even exceeds 5 years — unless there are specific circumstances that justify it. Let's discuss before proceeding.` };
  };
  const rec = getRecommendation();
  const hasNewLoanData = (parseFloat(newRate) || 0) > 0 && (parseFloat(newTerm) || 0) > 0 && analysis.newLoanAmt > 0;

  // ── Two-way sync with Payment Calculator ─────────────────────────────────
  const isPushingToPC = useRef(false);
  const writeLS = (k, v) => { try { localStorage.setItem("mtk_" + k, JSON.stringify(v)); } catch {} };
  const readLS  = (k) => { try { const v = localStorage.getItem("mtk_" + k); return v !== null ? JSON.parse(v) : null; } catch { return null; } };

  // Auto-reset occupancy when program changes to a primary-only program
  useEffect(() => {
    const occLocked = raNewProg === "fha" || raNewProg === "usda" || raNewProg === "va-new" || raNewProg === "va-non-irrrl";
    if (occLocked && raNewOcc !== "primary") {
      setRaNewOcc("primary");
    }
  }, [raNewProg]);

  // Auto-reset waiveEscrows to false when escrow waiver becomes blocked
  useEffect(() => {
    if (analysis.escrowWaiverBlocked && waiveEscrows) {
      setWaiveEscrows(false);
    }
  }, [analysis.escrowWaiverBlocked]);

  // RA → PC: push Proposed New Loan fields to Payment Calculator keys
  useEffect(() => {
    if (isPushingToPC.current) return;
    isPushingToPC.current = true;
    writeLS("pc_rate", newRate);
    writeLS("pc_term", newTerm);
    writeLS("pc_prog", raNewProg);
    writeLS("pc_occ", raNewOcc);
    if (parseFloat(curHomeValue) > 0) writeLS("pc_hp", curHomeValue);
    if (analysis.newLoanAmt > 0) writeLS("pc_la", String(Math.round(analysis.newLoanAmt)));
    window.dispatchEvent(new Event("mtk_propagated"));
    isPushingToPC.current = false;
  }, [newRate, newTerm, raNewProg, raNewOcc, curHomeValue, analysis.newLoanAmt]);

  // PC → RA: listen for Payment Calculator changes, pull rate/term/home value back
  useEffect(() => {
    const handler = () => {
      if (isPushingToPC.current) return;
      const pcRate = readLS("pc_rate");
      const pcTerm = readLS("pc_term");
      const pcHp   = readLS("pc_hp");
      const pcProg = readLS("pc_prog");
      const pcOcc  = readLS("pc_occ");
      if (pcRate !== null) setNewRate(cur => cur !== pcRate ? pcRate : cur);
      if (pcTerm !== null) setNewTerm(cur => cur !== pcTerm ? pcTerm : cur);
      if (pcHp   !== null) setCurHomeValue(cur => cur !== pcHp ? pcHp : cur);
      if (pcProg !== null) setRaNewProg(cur => cur !== pcProg ? pcProg : cur);
      if (pcOcc  !== null) setRaNewOcc(cur => cur !== pcOcc ? pcOcc : cur);
    };
    window.addEventListener("mtk_propagated", handler);
    return () => window.removeEventListener("mtk_propagated", handler);
  }, []);

  return (
    <div>
      {/* ── Static informational header ── */}
      <div style={{ borderRadius: 12, marginBottom: 18, overflow: "hidden", border: `1px solid ${COLORS.blue}33`, boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}>
        <div style={{ background: `linear-gradient(135deg, ${COLORS.navy} 0%, #1a3a5c 100%)`, padding: "18px 22px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: font, letterSpacing: "0.04em", marginBottom: 4 }}>Is a Refinance Right for You?</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: font }}>Fill in your current and proposed loan details below — we'll do the math the right way.</div>
        </div>
        <div style={{ background: "#f8fafc", padding: "14px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.navy, fontFamily: font, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>The Right Way to Calculate Break-Even</div>
            <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, lineHeight: 1.65 }}>
              True break-even isn't simply dividing your closing costs by the payment difference. The accurate method compares the actual interest paid on your current loan versus your proposed loan — month by month. If you currently pay mortgage insurance, those savings factor in too.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.navy, fontFamily: font, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Why It Matters</div>
            <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, lineHeight: 1.65 }}>
              This approach requires more upfront information, but it gives you a truthful answer — not a back-of-napkin estimate. Our goal is to make sure a refinance is genuinely financially beneficial for you before you commit.
            </div>
            {cashOutEnabled && (
              <div style={{ fontSize: 11, color: "#92651a", marginTop: 8, padding: "6px 10px", background: "#fef9ec", border: "1px solid #f5d87a", borderRadius: 6, fontFamily: font, lineHeight: 1.5 }}>
                ⚠ <strong>Cash-Out Note:</strong> When taking cash out, the comparison is no longer apples-to-apples. The break-even analysis reflects the cost of the refi, not the value of the cash received.
              </div>
            )}
          </div>
        </div>
      </div>
      <SectionCard title="SUBJECT PROPERTY ADDRESS" accent={COLORS.gray} style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr 80px 90px", gap: 12, alignItems: "end" }}>
          <LabeledInput label="Street Address" value={raAddr} onChange={setRaAddr} type="text" small />
          <LabeledInput label="City" value={raCity} onChange={setRaCity} type="text" small />
          <Select label="State" value={raState} onChange={setRaState} small options={[
            {value:"AL",label:"AL"},{value:"AK",label:"AK"},{value:"AZ",label:"AZ"},{value:"AR",label:"AR"},{value:"CA",label:"CA"},
            {value:"CO",label:"CO"},{value:"CT",label:"CT"},{value:"DE",label:"DE"},{value:"FL",label:"FL"},{value:"GA",label:"GA"},
            {value:"HI",label:"HI"},{value:"ID",label:"ID"},{value:"IL",label:"IL"},{value:"IN",label:"IN"},{value:"IA",label:"IA"},
            {value:"KS",label:"KS"},{value:"KY",label:"KY"},{value:"LA",label:"LA"},{value:"ME",label:"ME"},{value:"MD",label:"MD"},
            {value:"MA",label:"MA"},{value:"MI",label:"MI"},{value:"MN",label:"MN"},{value:"MS",label:"MS"},{value:"MO",label:"MO"},
            {value:"MT",label:"MT"},{value:"NE",label:"NE"},{value:"NV",label:"NV"},{value:"NH",label:"NH"},{value:"NJ",label:"NJ"},
            {value:"NM",label:"NM"},{value:"NY",label:"NY"},{value:"NC",label:"NC"},{value:"ND",label:"ND"},{value:"OH",label:"OH"},
            {value:"OK",label:"OK"},{value:"OR",label:"OR"},{value:"PA",label:"PA"},{value:"RI",label:"RI"},{value:"SC",label:"SC"},
            {value:"SD",label:"SD"},{value:"TN",label:"TN"},{value:"TX",label:"TX"},{value:"UT",label:"UT"},{value:"VT",label:"VT"},
            {value:"VA",label:"VA"},{value:"WA",label:"WA"},{value:"WV",label:"WV"},{value:"WI",label:"WI"},{value:"WY",label:"WY"},{value:"DC",label:"DC"}
          ]} />
          <LabeledInput label="Zip" value={raZip} onChange={setRaZip} type="text" small />
        </div>
      </SectionCard>
      {/* ── TOP GRID: Current Loan (left = Type, right = Structure) ── */}
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── Section 1: Existing Loan Type ── */}
        <SectionCard title="EXISTING LOAN TYPE" accent={COLORS.navy}>
          <Select label="Loan Program" value={raProg} onChange={setRaProg} options={[
            {value:"conventional",label:"Conventional"},{value:"fha",label:"FHA"},{value:"va",label:"VA"},{value:"usda",label:"USDA"},{value:"unknown",label:"Unknown"}
          ]} />
          <Select label="Occupancy" value={raOcc} onChange={setRaOcc} options={[
            {value:"primary",label:"Owner Occupied"},{value:"vacation",label:"Vacation Home"},{value:"investment",label:"Investment Property"}
          ]} />
          <Select label="Property Type" value={raPropType} onChange={setRaPropType} options={[
            { value: "", label: "— Select —" },
            { value: "sfr", label: "Single Family Home" },
            { value: "townhome", label: "Townhome" },
            { value: "condo", label: "Condo" },
            { value: "duplex", label: "Duplex" },
            { value: "3plex", label: "3-Plex" },
            { value: "4plex", label: "4-Plex" },
            { value: "other", label: "Other" },
          ]} />
          {raPropType && raPropType !== "sfr" && (
            <div style={{ padding: "12px 14px", background: `${COLORS.red}18`, border: `2px solid ${COLORS.red}66`, borderRadius: 8, fontFamily: font, lineHeight: 1.6 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.red, marginBottom: 4 }}>⚠️ Non-Standard Property Type — Discuss with Your Loan Officer</div>
              <div style={{ fontSize: 12, color: COLORS.navy }}>
                {raPropType === "condo" && <>Condos require <strong>condo project approval</strong> and may carry pricing adjustments (LLPAs). Warrantable vs. non-warrantable status significantly impacts rate, down payment, and eligible loan programs.</>}
                {raPropType === "townhome" && <>Townhomes are generally treated like single-family homes but may have HOA-related requirements. Confirm with your Loan Officer that the project meets guidelines for your loan program.</>}
                {(raPropType === "duplex" || raPropType === "3plex" || raPropType === "4plex") && <>Multi-unit properties have <strong>different qualifying requirements</strong> — higher reserve requirements, rental income calculations, and program-specific rules. These numbers may not reflect the true scenario.</>}
                {raPropType === "other" && <>This property type may have unique eligibility, appraisal, or program restrictions. Your Loan Officer needs to evaluate this before any figures are relied upon.</>}
              </div>
            </div>
          )}
          <Select label="Loan Type" value={raLoanType} onChange={setRaLoanType} options={[
            { value: "", label: "— Select —" },
            { value: "fixed", label: "Fixed Rate" },
            { value: "arm", label: "Adjustable Rate (ARM)" },
            { value: "io", label: "Interest-Only" },
          ]} />
          <LabeledInput label="Original Loan Date" type="date" value={noteDate} onChange={setNoteDate} hint={monthsPaidCalc > 0 ? `${Math.floor(monthsPaidCalc / 12)}yr ${monthsPaidCalc % 12}mo into loan (${monthsPaidCalc} payments made)` : "Enter note date to calculate"} />
          {(() => {
            const ola = parseFloat(origLoanAmount) || 0;
            const cb  = parseFloat(curBalance)     || 0;
            const r   = (parseFloat(curRate)        || 0) / 100 / 12;
            const n   = (parseFloat(curTermOriginal) || 0) * 12;
            if (!noteDate) {
              const missing = [];
              if (!ola) missing.push("Original Loan Amount");
              if (!cb)  missing.push("Current Loan Balance");
              if (!r)   missing.push("Interest Rate");
              if (!n)   missing.push("Term");
              if (missing.length > 0) return (
                <div style={{ fontSize: 11, color: COLORS.gray, padding: "7px 10px", background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                  💡 Don't know the original loan date? Enter <strong>{missing.join(", ")}</strong> and we can estimate it.
                </div>
              );
            }
            if (!ola || !cb || !r || !n || cb >= ola) return null;
            const rn    = Math.pow(1 + r, n);
            const inner = rn - (cb / ola) * (rn - 1);
            if (inner <= 0 || inner > rn) return null;
            const N = Math.round(Math.log(inner) / Math.log(1 + r));
            if (N <= 0 || N >= n) return null;
            const today    = new Date();
            const calcDate = new Date(today.getFullYear(), today.getMonth() - N, 1);
            const calcStr  = calcDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const yrs = Math.floor(N / 12), mos = N % 12;
            const timeStr = yrs > 0 && mos > 0 ? `${yrs}yr ${mos}mo` : yrs > 0 ? `${yrs} yr` : `${mos} mo`;
            if (!noteDate) return (
              <div style={{ fontSize: 11, color: COLORS.navy, padding: "8px 10px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.7 }}>
                📊 Based on a <strong>{fmt(ola)}</strong> loan now at <strong>{fmt(cb)}</strong> at <strong>{parseFloat(curRate)||0}%</strong> / <strong>{parseFloat(curTermOriginal)||0} yrs</strong>, approximately <strong>{N} payments</strong> ({timeStr}) have been made — estimated origination around <strong>{calcStr}</strong>.
              </div>
            );
            // noteDate is filled — compare
            const enteredDate = new Date(noteDate + 'T12:00:00');
            const enteredN    = Math.round((today - enteredDate) / (1000 * 60 * 60 * 24 * 30.44));
            const diff        = Math.abs(N - enteredN);
            if (diff <= 3) return (
              <div style={{ fontSize: 11, color: COLORS.green, padding: "7px 10px", background: COLORS.greenLight, border: `1px solid ${COLORS.green}33`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                ✓ Entered date aligns with the amortization math (~{N} payments expected for this balance/rate/term).
              </div>
            );
            return (
              <div style={{ fontSize: 11, color: COLORS.gold, padding: "7px 10px", background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}55`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                ⚠ Entered date implies ~{enteredN} payments, but the math suggests ~{N} ({timeStr}) — origination around <strong>{calcStr}</strong>. Verify your balance and rate are accurate.
              </div>
            );
          })()}
          <LabeledInput label="Date of Most Recent Mortgage Payment" type="date" value={lastPaymentDate} onChange={setLastPaymentDate} hint="Used for payoff per-diem calculation" />
          <div style={{ fontSize: 11, color: COLORS.navy, padding: "9px 11px", background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}55`, borderRadius: 7, marginTop: -4, marginBottom: 4, fontFamily: font, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700 }}>📅 Using a future date?</span> If you expect to make another payment before closing, enter that date instead. <strong>We recommend turning off auto-draft on your current mortgage</strong> once you formally start the refi process — an unexpected payment can throw off the payoff figure and create unnecessary headaches.
          </div>
        </SectionCard>
        </div>
        {/* ── Right column of top grid: Existing Loan Structure ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionCard title="EXISTING LOAN STRUCTURE" accent={COLORS.navy}>
          <LabeledInput label="Original Loan Amount (of existing loan)" prefix="$" value={origLoanAmount} onChange={setOrigLoanAmount} useCommas noNegative />
          {(() => {
            const cb  = parseFloat(curBalance)      || 0;
            const r   = (parseFloat(curRate)         || 0) / 100 / 12;
            const n   = (parseFloat(curTermOriginal) || 0) * 12;
            const N   = monthsPaidCalc;
            const ola = parseFloat(origLoanAmount)  || 0;
            if (!ola) {
              const missing = [];
              if (!cb)         missing.push("Current Loan Balance");
              if (!r)          missing.push("Interest Rate");
              if (!n)          missing.push("Term");
              if (!noteDate)   missing.push("Original Loan Date");
              if (missing.length > 0) return (
                <div style={{ fontSize: 11, color: COLORS.gray, padding: "7px 10px", background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                  💡 Don't know the original loan amount? Enter <strong>{missing.join(", ")}</strong> and we can estimate it.
                </div>
              );
            }
            if (!cb || !r || !n || N <= 0) return null;
            const rn    = Math.pow(1 + r, n);
            const rN    = Math.pow(1 + r, N);
            const denom = rn - rN;
            if (denom <= 0) return null;
            const calcOLA = Math.round(cb * (rn - 1) / denom);
            if (!ola) return (
              <div style={{ fontSize: 11, color: COLORS.navy, padding: "8px 10px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.7 }}>
                📊 Based on a balance of <strong>{fmt(cb)}</strong> after <strong>{N} payments</strong> at <strong>{parseFloat(curRate)||0}%</strong> on a <strong>{parseFloat(curTermOriginal)||0}-yr</strong> loan, the original loan amount was approximately <strong>{fmt(calcOLA)}</strong>.
              </div>
            );
            const diff = Math.abs(ola - calcOLA);
            if (diff <= 500) return (
              <div style={{ fontSize: 11, color: COLORS.green, padding: "7px 10px", background: COLORS.greenLight, border: `1px solid ${COLORS.green}33`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                ✓ Entered amount matches the calculated original loan amount of <strong>{fmt(calcOLA)}</strong>.
              </div>
            );
            return (
              <div style={{ fontSize: 11, color: COLORS.gold, padding: "7px 10px", background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}55`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                ⚠ Entered <strong>{fmt(ola)}</strong> but the amortization math suggests <strong>{fmt(calcOLA)}</strong> — verify your balance, rate, term, and origination date.
              </div>
            );
          })()}
          <LabeledInput label="Term (of existing loan)" value={curTermOriginal} onChange={setCurTermOriginal} suffix="years" noNegative />
          <LabeledInput label="Interest Rate" value={curRate} onChange={setCurRate} onBlur={v => fmtRateBlur(v, setCurRate)} suffix="%" step="0.125" noNegative />
          <LabeledInput label="P&I Payment (i.e. only principal and interest)" prefix="$" value={raCurPI} onChange={setRaCurPI} suffix="/mo" useCommas noNegative />
          {(() => {
            const ola = parseFloat(origLoanAmount) || 0;
            const cr = (parseFloat(curRate) || 0) / 100 / 12;
            const cTermOrig = (parseFloat(curTermOriginal) || 0) * 12;
            const calcPI = (ola > 0 && cr > 0 && cTermOrig > 0) ? analysis.origPI : null;
            if (!calcPI) return (
              <div style={{ fontSize: 11, color: COLORS.gray, padding: "7px 10px", background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                💡 Enter original loan amount, term & rate above to auto-calculate P&I.
              </div>
            );
            if (!raCurPI) return (
              <div style={{ fontSize: 11, color: COLORS.navy, padding: "7px 10px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                📊 Calculated P&I: <strong>{fmt2(calcPI)}/mo</strong> — leave blank to use this, or enter your actual payment to compare.
              </div>
            );
            const stated = parseFloat(raCurPI) || 0;
            const diff = stated - calcPI;
            const absDiff = Math.abs(diff);
            if (absDiff < 1) return (
              <div style={{ fontSize: 11, color: COLORS.green, padding: "7px 10px", background: COLORS.greenLight, border: `1px solid ${COLORS.green}33`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                ✓ Stated P&I matches the calculated payment of <strong>{fmt2(calcPI)}/mo</strong>.
              </div>
            );
            return (
              <div style={{ fontSize: 11, color: COLORS.gold, padding: "7px 10px", background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}55`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                {diff > 0
                  ? <>⚠ Stated is <strong>{fmt2(absDiff)}</strong> higher than calculated <strong>{fmt2(calcPI)}/mo</strong> — possible extra payments or different terms.</>
                  : <>⚠ Stated is <strong>{fmt2(absDiff)}</strong> lower than calculated <strong>{fmt2(calcPI)}/mo</strong> — check your inputs.</>
                }
              </div>
            );
          })()}
          <LabeledInput label="Existing Monthly MI (if applicable)" prefix="$" value={curPMI} onChange={setCurPMI} suffix="/mo" useCommas noNegative hint="PMI or MIP currently being paid" />
          <LabeledInput label="Current Loan Balance" prefix="$" value={curBalance} onChange={setCurBalance} useCommas noNegative />
          {(() => {
            const ola = parseFloat(origLoanAmount) || 0;
            const cr = parseFloat(curRate) || 0;
            const term = parseFloat(curTermOriginal) || 0;
            const missing = [];
            if (!ola) missing.push("Original Loan Amount");
            if (!cr) missing.push("Interest Rate");
            if (!term) missing.push("Term");
            if (!noteDate) missing.push("Original Loan Date");
            if (missing.length > 0) {
              return (
                <div style={{ fontSize: 11, color: COLORS.gray, padding: "7px 10px", background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.6 }}>
                  💡 To auto-calculate an estimated balance, also enter: <strong>{missing.join(", ")}</strong>
                </div>
              );
            }
            const ndFmt = new Date(noteDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const yrs = Math.floor(monthsPaidCalc / 12);
            const mos = monthsPaidCalc % 12;
            const timeStr = yrs > 0 && mos > 0 ? `${yrs}yr ${mos}mo` : yrs > 0 ? `${yrs} yr` : `${mos} mo`;
            const eb = analysis.estimatedBalance;
            const userBal = parseFloat(curBalance) || 0;
            const diff = eb - userBal;
            const absDiff = Math.abs(diff);
            const hasUserBal = userBal > 0;
            const isLow  = hasUserBal && diff > 200;   // stated balance lower than expected (extra payments)
            const isHigh = hasUserBal && diff < -200;  // stated balance higher than expected
            const isMatch = hasUserBal && !isLow && !isHigh;
            const bg     = isHigh ? `${COLORS.gold}18`   : (isLow || isMatch) ? COLORS.greenLight : `${COLORS.blue}0d`;
            const border = isHigh ? `${COLORS.gold}55`   : (isLow || isMatch) ? `${COLORS.green}33` : `${COLORS.blue}33`;
            return (
              <div style={{ fontSize: 11, color: COLORS.navy, padding: "8px 10px", background: bg, border: `1px solid ${border}`, borderRadius: 6, marginTop: -4, marginBottom: 8, fontFamily: font, lineHeight: 1.7 }}>
                📊 Based on a <strong>{fmt(ola)}</strong> loan at <strong>{cr}%</strong> for <strong>{term} yrs</strong> originated on <strong>{ndFmt}</strong>, the amortization schedule estimates a balance of <strong>{fmt(Math.round(eb))}</strong> after {timeStr} ({monthsPaidCalc} payments).
                {isLow && (
                  <span style={{ color: COLORS.green, fontWeight: 600, display: "block", marginTop: 3 }}>
                    🎉 Your stated balance is <strong>{fmt(Math.round(absDiff))}</strong> lower than expected — looks like extra payments have been made!
                  </span>
                )}
                {isHigh && (
                  <span style={{ color: COLORS.gold, fontWeight: 600, display: "block", marginTop: 3 }}>
                    ⚠ Your stated balance is <strong>{fmt(Math.round(absDiff))}</strong> higher than expected — double-check the inputs above.
                  </span>
                )}
                {isMatch && (
                  <span style={{ color: COLORS.green, fontWeight: 600, display: "block", marginTop: 3 }}>
                    ✓ Stated balance matches the amortization schedule.
                  </span>
                )}
              </div>
            );
          })()}
        </SectionCard>
        <SectionCard title="2ND LIEN" accent={COLORS.gold}>
          <Toggle label="Has a Second Mortgage / 2nd Lien?" checked={hasSecondMtg} onChange={setHasSecondMtg} />
          {hasSecondMtg && (
            <div style={{ marginTop: 10 }}>
              <LabeledInput label="Original Loan Date" type="date" value={secondNoteDate} onChange={setSecondNoteDate} />
              <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <LabeledInput label="Original Term" value={secondTerm} onChange={setSecondTerm} suffix="years" small noNegative />
                <LabeledInput label="Interest Rate" value={secondRate} onChange={setSecondRate} onBlur={v => fmtRateBlur(v, setSecondRate)} suffix="%" step="0.125" small noNegative />
              </div>
              <LabeledInput label="Original Loan Amount" prefix="$" value={secondOrigBal} onChange={setSecondOrigBal} useCommas noNegative />
              <LabeledInput label="Current P&I Payment" prefix="$" value={secondPI} onChange={setSecondPI} suffix="/mo" useCommas noNegative />
              <LabeledInput label="Current Loan Balance" prefix="$" value={secondBalance} onChange={setSecondBalance} useCommas noNegative />
              <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 6, fontFamily: font }}>Second mortgage balance will be included in the new refinance loan amount for consolidation analysis.</div>
            </div>
          )}
        </SectionCard>
        </div>
      </div>

      {/* ── Full-width Escrow section ── */}
      <SectionCard title="CURRENT ESCROWS" accent={COLORS.navy}>
        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left: Homeowner's Insurance */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.gray, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.04em" }}>{insMode === "dollar" ? "Homeowner's Insurance (per month)" : "Homeowner's Insurance"}</span>
              <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                {[{ v: "dollar", l: "$" }, { v: "rate", l: "%" }].map(o => (
                  <button key={o.v} onClick={() => setInsMode(o.v)} style={{ padding: "2px 10px", fontSize: 11, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: insMode === o.v ? COLORS.blue : "transparent", color: insMode === o.v ? "#fff" : COLORS.gray, transition: "all 0.15s" }}>{o.l}</button>
                ))}
              </div>
            </div>
            {insMode === "rate" ? (
              <LabeledInput label="" value={homeInsuranceRate} onChange={setHomeInsuranceRate} suffix="% of home value" small noNegative hint={`${fmt2((parseFloat(curHomeValue) || 0) * (parseFloat(homeInsuranceRate) || 0) / 100 / 12)}/mo · ${fmt2((parseFloat(curHomeValue) || 0) * (parseFloat(homeInsuranceRate) || 0) / 100)}/yr`} />
            ) : (
              <LabeledInput label="" prefix="$" value={homeInsurance} onChange={setHomeInsurance} useCommas suffix="/mo" small noNegative hint={(() => {
                const hv = parseFloat(curHomeValue) || 0;
                if (!homeInsurance && hv > 0) {
                  const est = hv * (parseFloat(homeInsuranceRate) || 0.7) / 100 / 12;
                  return `est. ~${fmt2(est)}/mo (based on ${homeInsuranceRate}% rate)`;
                }
                return homeInsurance ? `${fmt2((parseFloat(homeInsurance) || 0) * 12)}/yr` : null;
              })()} />
            )}
            <div style={{ marginTop: 10 }}>
              <LabeledInput label="Insurance Renewal Date" type="date" value={raInsRenew} onChange={setRaInsRenew} hint="Used for closing cost timing" />
            </div>
            <div style={{ marginTop: 4 }}>
              <Toggle
                label="Waive Escrows on New Loan"
                checked={waiveEscrows}
                onChange={v => { if (!analysis.escrowWaiverBlocked) setWaiveEscrows(v); }}
              />
              {analysis.escrowWaiverBlocked && (
                <div style={{ fontSize: 11, color: COLORS.red, padding: "6px 10px", background: `${COLORS.red}18`, borderRadius: 6, marginTop: 4, fontFamily: font }}>
                  ⛔ {analysis.escrowWaiverBlockReason}
                </div>
              )}
              {!analysis.escrowWaiverBlocked && analysis.effectiveWaiveEscrows && (
                <div style={{ fontSize: 11, color: COLORS.gold, padding: "6px 10px", background: COLORS.goldLight, borderRadius: 6, marginTop: 4, fontFamily: font }}>Escrows waived — borrower pays taxes & insurance directly.</div>
              )}
            </div>
          </div>
          {/* Right: Property Taxes */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.gray, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.04em" }}>{taxMode === "dollar" ? "Property Taxes (per month)" : "Property Taxes"}</span>
              <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
                {[{ v: "dollar", l: "$" }, { v: "rate", l: "%" }].map(o => (
                  <button key={o.v} onClick={() => setTaxMode(o.v)} style={{ padding: "2px 10px", fontSize: 11, fontWeight: 700, fontFamily: font, border: "none", cursor: "pointer", background: taxMode === o.v ? COLORS.blue : "transparent", color: taxMode === o.v ? "#fff" : COLORS.gray, transition: "all 0.15s" }}>{o.l}</button>
                ))}
              </div>
            </div>
            {taxMode === "rate" ? (
              <LabeledInput label="" value={propertyTaxRate} onChange={setPropertyTaxRate} suffix="% of home value" small noNegative hint={(() => {
                const hv = parseFloat(curHomeValue) || 0;
                const rate = parseFloat(propertyTaxRate) || 0;
                const applyHomestead = raState === "TX" && raOcc === "primary";
                const basis = applyHomestead ? hv * 0.80 : hv;
                const mo = basis * rate / 100 / 12;
                const yr = basis * rate / 100;
                return `${fmt2(mo)}/mo · ${fmt2(yr)}/yr${applyHomestead ? " (80% TX homestead basis)" : ""}`;
              })()} />
            ) : (
              <LabeledInput label="" prefix="$" value={propertyTax} onChange={setPropertyTax} useCommas suffix="/mo" small noNegative hint={(() => {
                const hv = parseFloat(curHomeValue) || 0;
                if (!propertyTax && hv > 0) {
                  const applyHomestead = raState === "TX" && raOcc === "primary";
                  const basis = applyHomestead ? hv * 0.80 : hv;
                  const est = basis * (parseFloat(propertyTaxRate) || 2.3) / 100 / 12;
                  return `est. ~${fmt2(est)}/mo (based on ${propertyTaxRate}% rate${applyHomestead ? ", TX homestead" : ""})`;
                }
                return propertyTax ? `${fmt2((parseFloat(propertyTax) || 0) * 12)}/yr` : null;
              })()} />
            )}
            <div style={{ marginTop: 10 }}>
              <LabeledInput label="Current Escrow Balance" prefix="$" value={escrowBalance} onChange={setEscrowBalance} useCommas small noNegative />
            </div>
            {isInternal && (
              <div style={{ marginTop: 8 }}>
                <Toggle label="Net Escrows from Payoff" checked={netEscrows} onChange={setNetEscrows} />
                {netEscrows && (parseFloat(escrowBalance) || 0) > 0 && <div style={{ fontSize: 11, color: COLORS.green, padding: "6px 10px", background: COLORS.greenLight, borderRadius: 6, marginTop: 4, fontFamily: font }}>Escrow balance of {fmt(parseFloat(escrowBalance) || 0)} credited against payoff.</div>}
                {netEscrows && !(parseFloat(escrowBalance) || 0) && <div style={{ fontSize: 11, color: COLORS.grayLight, padding: "6px 10px", background: "#f5f5f5", borderRadius: 6, marginTop: 4, fontFamily: font }}>Enter an escrow balance to apply the credit.</div>}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Internal transaction flags ── */}
      {isInternal && (
        <SectionCard title="INTERNAL" accent={COLORS.navy}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px" }}>

            {/* PIW */}
            <div>
              <Toggle label="Property Inspection Waiver (PIW)" checked={piw} onChange={setPiw} />
              {piw && (
                <div style={{ marginTop: 5, padding: "7px 10px", background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}44`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.navy, lineHeight: 1.5 }}>
                  ✅ <strong>No appraisal required.</strong> Appraisal cost has been set to <strong>$0</strong> on the fee sheet.
                </div>
              )}
            </div>

            {/* Order New Survey */}
            <div>
              <Toggle label="Order New Survey" checked={newSurvey} onChange={setNewSurvey} />
              {newSurvey && (
                <div style={{ marginTop: 5, padding: "7px 10px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.navy, lineHeight: 1.5 }}>
                  📐 <strong>Survey added to fee sheet ({fmt(Math.round((() => { const n = v => { const p = parseFloat(v); return (v !== "" && v != null && !isNaN(p)) ? p : null; }; const st = (window.getStateFees || (() => ({})))(raState || "TX"); return n(fsOvSurvey) ?? n(loDefSurvey) ?? n(defSurvey) ?? st.surveyFee ?? 450; })()))}).</strong> No seller-paid survey on a refi — this is a borrower cost.
                </div>
              )}
            </div>

            {/* Waive Title Policy */}
            <div>
              <Toggle label="Waive Title Policy" checked={waiveTitle} onChange={setWaiveTitle} />
              {waiveTitle && (
                <div style={{ marginTop: 5, padding: "7px 10px", background: `${COLORS.red}10`, border: `2px solid ${COLORS.red}55`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.navy, lineHeight: 1.5 }}>
                  ⚠️ <strong style={{ color: COLORS.red }}>Non-standard.</strong> Lender's title policy removed from the fee sheet. This is only permitted when <strong>explicitly authorized</strong> — confirm with your supervisor before closing.
                </div>
              )}
            </div>

            {/* Collect 90 Days of Insurance */}
            <div>
              <Toggle label="Collect 90 Days of Insurance" checked={collect90Ins} onChange={setCollect90Ins} />
              {collect90Ins && (
                analysis.effectiveWaiveEscrows
                  ? (
                    <div style={{ marginTop: 5, padding: "7px 10px", background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}44`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.navy, lineHeight: 1.5 }}>
                      🛡️ <strong>3 months of insurance collected as a prepaid at closing.</strong> Escrows are waived — borrower pays HOI month-to-month directly. This ensures 90 days of coverage is funded upfront.
                    </div>
                  ) : (
                    <div style={{ marginTop: 5, padding: "7px 10px", background: `${COLORS.red}10`, border: `2px solid ${COLORS.red}55`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.navy, lineHeight: 1.5 }}>
                      ⚠️ <strong style={{ color: COLORS.red }}>Not applied — escrow account is in place.</strong> This toggle only applies when escrows are waived. With an escrow account, insurance reserves are collected as part of standard impounds (2 months). <em>Enable "Waive Escrows" on the new loan to activate this.</em>
                    </div>
                  )
              )}
            </div>

            {/* Short Pay */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Toggle label="Short Pay" checked={shortPay} onChange={setShortPay} />
              {shortPay && (() => {
                const closingDay = newClosingDate ? parseInt(newClosingDate.split('-')[2]) : 0;
                const qualifies  = closingDay >= 1 && closingDay <= 5;
                const pdAmt      = analysis.perDiemAmount;
                if (!newClosingDate) return (
                  <div style={{ marginTop: 5, padding: "7px 10px", background: "#f8fafc", border: `1px solid #cbd5e1`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.gray, lineHeight: 1.5 }}>
                    📅 <strong>Short Pay active.</strong> Enter a <strong>Closing Date</strong> (day 1–5 of the month) to confirm per-diem credit. The existing servicer has already collected a full month of interest — when the loan funds in the first 5 days, the excess is returned as a credit against payoff.
                  </div>
                );
                if (!qualifies) return (
                  <div style={{ marginTop: 5, padding: "7px 10px", background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}55`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.navy, lineHeight: 1.5 }}>
                    ⚠️ <strong>Closing date is day {closingDay}</strong> — Short Pay only applies when funding on <strong>days 1–5</strong> of the month. Per-diem is currently calculated as a <em>charge</em>, not a credit. Adjust the closing date or turn off this toggle.
                  </div>
                );
                return (
                  <div style={{ marginTop: 5, padding: "7px 10px", background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}44`, borderRadius: 6, fontFamily: font, fontSize: 11, color: COLORS.navy, lineHeight: 1.5 }}>
                    ✅ <strong>Short Pay confirmed (day {closingDay}).</strong> The per-diem interest on the existing payoff is a <strong style={{ color: COLORS.green }}>credit ({pdAmt !== undefined ? fmt2(Math.abs(pdAmt)) : "—"})</strong> — the servicer owes back the excess interest collected for the remainder of the month.
                  </div>
                );
              })()}
            </div>

          </div>
        </SectionCard>
      )}

      {/* ── Divider between Current Loan and New Loan ── */}
      <div style={{ margin: "20px 0", background: `linear-gradient(135deg, ${COLORS.gold} 0%, #e07b00 100%)`, borderRadius: 8, padding: "14px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: `0 3px 12px ${COLORS.gold}55` }}>
        <span style={{ fontSize: 15, fontWeight: 900, color: "#fff", fontFamily: font, letterSpacing: "0.1em", textTransform: "uppercase" }}>↓ Proposed New Loan</span>
        <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.3)", borderRadius: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: font }}>Enter your new loan details below</span>
      </div>

      {/* ── BOTTOM GRID: New Loan (left = Proposed New Loan + Escrow, right = Loan Amt + PMI + Breakdown) ── */}
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionCard title="PROPOSED NEW LOAN" accent={COLORS.blue}>
          <Select label="New Loan Program" value={raNewProg} onChange={setRaNewProg} options={[
            {value:"conventional",label:"Conventional"},
            {value:"fha",label:"FHA"},
            {value:"usda",label:"USDA"},
            {value:"va-new",label:"New VA Loan"},
            {value:"va-non-irrrl",label:"VA to VA (non-IRRRL)"},
            {value:"va-irrrl",label:"VA: IRRRL"},
          ]} />
          {(() => {
            const isVA = raNewProg === "va-new" || raNewProg === "va-non-irrrl" || raNewProg === "va-irrrl";
            const occLocked = raNewProg === "fha" || raNewProg === "usda" || raNewProg === "va-new" || raNewProg === "va-non-irrrl";
            return (
              <>
                <Select label="New Occupancy" value={raNewOcc} onChange={v => {
                  if (occLocked) return;
                  setRaNewOcc(v);
                }} options={[
                  {value:"primary",label:"Owner Occupied"},
                  ...(occLocked ? [] : [
                    {value:"vacation",label:"Vacation Home"},
                    {value:"investment",label:"Investment Property"},
                  ]),
                ]} />
                {occLocked && (
                  <div style={{ fontSize: 10, color: COLORS.blue, fontFamily: font, marginTop: -4, marginBottom: 4, fontStyle: "italic" }}>
                    {raNewProg === "fha" ? "FHA" : raNewProg === "usda" ? "USDA" : "VA"} requires owner-occupied. Occupancy locked.
                  </div>
                )}
                {raNewProg === "va-irrrl" && (
                  <div style={{ fontSize: 10, color: COLORS.green, fontFamily: font, marginTop: -4, marginBottom: 4, fontStyle: "italic" }}>
                    IRRRL: vacation and investment properties are eligible.
                  </div>
                )}
              </>
            );
          })()}
          <LabeledInput label="Estimated Home Value" prefix="$" value={curHomeValue} onChange={setCurHomeValue} useCommas noNegative
            hint={analysis.estimatedPayoff > 0 && (parseFloat(curHomeValue) || 0) > 0 ? `Payoff-based LTV: ${(analysis.estimatedPayoff / parseFloat(curHomeValue) * 100).toFixed(1)}% (est. payoff ÷ home value)` : undefined} />
          <LabeledInput label="New Term" value={newTerm} onChange={setNewTerm} suffix="years" noNegative />
          <LabeledInput label="New Interest Rate" value={newRate} onChange={v => {
            const n = parseFloat(v);
            // Only block >99 when current stored value is already valid (prevents getting stuck above 99)
            if (!isNaN(n) && n > 99 && (parseFloat(newRate) || 0) <= 99) return;
            setNewRate(v);
          }} onBlur={v => fmtRateBlur(v, setNewRate)} suffix="%" step="0.125" noNegative
            hint={analysis.apr > 0 ? `APR: ${analysis.apr.toFixed(3)}% (estimated, based on ${fmt(Math.round(analysis.closingCosts||0))} in closing costs)` : undefined} />
          <LabeledInput label="Closing Date" type="date" value={newClosingDate} onChange={setNewClosingDate}
            hint={(() => {
              const firstPmt = analysis.firstPaymentDate
                ? "First payment: " + analysis.firstPaymentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                : null;
              if (!newClosingDate) return firstPmt || "Enter closing date to calculate first payment";
              const isOO = raOcc === "primary";
              let fundingStr;
              if (isOO) {
                // 3-day right of rescission: counts Mon–Sat; skip Sundays and federal holidays
                const [cy, cm, cd2] = newClosingDate.split("-").map(Number);
                const cur = new Date(cy, cm - 1, cd2);
                let days = 0;
                while (days < 3) {
                  cur.setDate(cur.getDate() + 1);
                  if (cur.getDay() === 0) continue;               // skip Sunday
                  if (isHoliday && isHoliday(cur)) continue;      // skip federal holidays
                  days++;
                }
                fundingStr = "Funds: " + cur.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " (3-day rescission)";
              } else {
                fundingStr = "Funds: same day as closing";
              }
              // Short pay notation
              const closingDay = parseInt(newClosingDate.split('-')[2]);
              let shortPayStr = null;
              if (shortPay && analysis.isShortPay) {
                shortPayStr = "⚠ Short pay — per-diem interest credited back at closing";
              } else if (!shortPay && closingDay >= 1 && closingDay <= 5) {
                shortPayStr = "💡 Day " + closingDay + " close — short pay may apply (see toggle below)";
              }
              return [fundingStr, firstPmt, shortPayStr].filter(Boolean).join("  ·  ");
            })()} />
          <LabeledInput label="Cash Out" prefix="$" value={cashOutAmount} onChange={setCashOutAmount} useCommas noNegative hint="Leave blank or enter 0 if no cash-out" />
        </SectionCard>
        <SectionCard title="PMI" accent={COLORS.blue}>
          <LabeledInput label="Credit Score (FICO)" value={ficoScore} onChange={setFicoScore} noNegative />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", fontSize: 13, fontFamily: font, marginBottom: 8 }}>
            <span style={{ color: COLORS.gray }}>Estimated Monthly PMI</span>
            <span style={{ fontWeight: 700, textAlign: "right", color: analysis.nPmiMonthly > 0 ? COLORS.gold : COLORS.green }}>{analysis.nPmiMonthly > 0 ? fmt2(analysis.nPmiMonthly) + "/mo" : "$0"}</span>
          </div>
          {analysis.nPmiRate > 0 && <div style={{ fontSize: 11, color: COLORS.grayLight, marginBottom: 8, fontFamily: font }}>Annual PMI rate: {analysis.nPmiRate.toFixed(2)}% · Based on {analysis.newLTV.toFixed(1)}% LTV and {parseInt(ficoScore) || 740} FICO</div>}
          <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, fontFamily: font, background: analysis.newLTV <= 80 ? COLORS.greenLight : COLORS.goldLight, color: analysis.newLTV <= 80 ? COLORS.green : COLORS.gold }}>
            {analysis.newLTV <= 80
              ? `LTV is ${analysis.newLTV.toFixed(1)}% — No PMI required`
              : `LTV is ${analysis.newLTV.toFixed(1)}% — PMI of ${fmt2(analysis.nPmiMonthly)}/mo applies until 80% LTV reached`}
          </div>
        </SectionCard>
        </div>
        {/* ── Right column of bottom grid: Closing Costs + New Loan Amount ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SectionCard title="CLOSING COSTS" accent={COLORS.blue}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.navy, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fee Breakdown</span>
            <span style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginLeft: 8 }}>(auto-computed)</span>
          </div>
          <LabeledInput label="Closing Fees" prefix="$" value={raClosingFees} onChange={() => {}} useCommas noNegative hint="Lender fees · third-party · title" readOnly />
          <LabeledInput label="Prepaids" prefix="$" value={raPrepaids} onChange={() => {}} useCommas noNegative hint="Prepaid interest · escrow reserves" readOnly />
          {analysis.closingCosts > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", fontSize: 12, fontFamily: font, padding: "6px 10px", background: COLORS.blueLight, borderRadius: 6, marginBottom: 4, marginTop: 2 }}>
              <span style={{ fontWeight: 700, color: COLORS.navy }}>Total Closing Costs</span>
              <span style={{ fontWeight: 700, color: COLORS.blue, textAlign: "right" }}>{fmt(Math.round(analysis.closingCosts))}</span>
            </div>
          )}
          {analysis.closingCosts > 0 && (
            <div style={{ fontSize: 11, color: COLORS.navy, padding: "10px 12px", background: `${COLORS.gold}18`, border: `1px solid ${COLORS.gold}55`, borderRadius: 7, marginBottom: 6, fontFamily: font, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700 }}>💡 Lender Credits Option:</span> Some programs allow closing costs to be reduced or eliminated in exchange for a slightly higher interest rate. For example, accepting a rate 0.25% higher may generate a lender credit of roughly 0.75%{analysis.newLoanAmt > 0 ? <strong> ({fmt(Math.round(analysis.newLoanAmt * 0.0075))})</strong> : " of your loan amount"} — potentially offsetting a significant portion of your costs. Check with your Loan Officer to see if this tradeoff makes sense for your situation.
            </div>
          )}
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10, marginTop: 6 }}>
            <Select label="Roll Closing Costs Into Loan?" value={rollInCosts} onChange={setRollInCosts} options={[
              {value:"all",label:"Yes: Roll All Closing Costs Into the Loan"},
              {value:"partial-payment",label:"Cash due comparable to a monthly payment (recommended)"},
              {value:"partial",label:"Partial: Specify amount to bring to closing"},
              {value:"none",label:"No: Pay for all closing costs at closing"},
              {value:"principal-buydown",label:"No: I'll bring money to pay down the principal"},
            ]} />
            {rollInCosts === "all" && (
              <div style={{ fontSize: 11, color: COLORS.navy, padding: "9px 11px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 7, marginTop: 4, fontFamily: font, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700 }}>Note on Rolling Costs Into the Loan:</span> We'll do our best to roll all closing costs into the loan so you bring as little as possible to closing — ideally $0. That said, please be prepared to bring up to approximately <strong>$200</strong>. Fees are estimated at the start of the loan process and it's not uncommon for them to shift by tens of dollars as the final loan amount is confirmed. We'll always err on the side of caution, but a small buffer at closing is good practice.
              </div>
            )}
            {rollInCosts === "partial-payment" && analysis.newPI > 0 && (
              <div style={{ fontSize: 11, color: COLORS.navy, padding: "9px 11px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 7, marginTop: 4, fontFamily: font, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700 }}>⭐ Why we recommend this:</span> Cash due at closing ≈ <strong>{fmt2(analysis.costsDueAtClosing)}</strong> (roughly one monthly payment). The remaining <strong>{fmt(Math.round(analysis.rolledIn))}</strong> in costs are rolled into the loan.
                <div style={{ marginTop: 6 }}>
                  When you close, your first mortgage payment isn't due for nearly two months — that in-between month is effectively a "skipped" payment. Bringing cash equal to about one payment keeps your new loan balance lower without really costing you extra. <em>That said, this is a personal preference — rolling everything in is a perfectly valid choice if preserving cash is the priority.</em>
                </div>
                {newClosingDate && analysis.firstPaymentDate && (() => {
                  const cd = new Date(newClosingDate + 'T12:00:00');
                  const skipped = new Date(cd.getFullYear(), cd.getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long' });
                  const closing = cd.toLocaleDateString('en-US', { month: 'long' });
                  const firstPmt = analysis.firstPaymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  return (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${COLORS.blue}22`, color: COLORS.green, fontWeight: 600 }}>
                      🗓 Closing in <strong>{closing}</strong> — you skip your <strong>{skipped}</strong> payment. First payment not due until <strong>{firstPmt}</strong>.
                    </div>
                  );
                })()}
              </div>
            )}
            {rollInCosts === "partial" && (
              <LabeledInput label="Amount to Bring to Closing" prefix="$" value={rollInAmount} onChange={setRollInAmount} useCommas noNegative
                hint={`${fmt(Math.round(analysis.rolledIn))} rolled into loan · ${fmt(analysis.costsDueAtClosing)} due at closing`} />
            )}
            {rollInCosts === "principal-buydown" && (
              <>
                <LabeledInput label="Amount to Apply Toward Principal" prefix="$" value={principalBuydown} onChange={setPrincipalBuydown} useCommas noNegative
                  hint="All closing costs paid at closing · extra cash reduces loan balance" />
                {(parseFloat(principalBuydown) || 0) > 0 && analysis.newLoanAmt > 0 && (
                  <div style={{ fontSize: 11, color: COLORS.navy, padding: "9px 11px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 7, marginTop: 4, fontFamily: font, lineHeight: 1.6 }}>
                    {fmt(parseFloat(principalBuydown))} applied to principal — new loan starts at <strong>{fmt(analysis.newLoanAmt)}</strong> with a monthly payment of <strong>{fmt2(analysis.newPI)}/mo</strong>.
                  </div>
                )}
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="NEW LOAN AMOUNT" accent={COLORS.blue}>
          {(() => {
            const co = parseFloat(cashOutAmount) || 0;
            const hv = parseFloat(curHomeValue) || 0;
            const pbd = rollInCosts === "principal-buydown" ? (parseFloat(principalBuydown) || 0) : 0;
            const isTXViolation = co > 0 && raState === "TX" && raOcc === "primary" && analysis.newLTV > 80;
            const baseLoan = analysis.newLoanAmt - co;
            const maxCashOut = hv > 0 ? Math.max(0, Math.floor(hv * 0.80 - baseLoan)) : 0;
            const row = (label, value, opts = {}) => (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 12px", fontSize: 13, fontFamily: font,
                borderBottom: opts.last ? "none" : `1px solid ${COLORS.border}`,
                background: opts.highlight ? COLORS.blueLight : "transparent" }}>
                <span style={{ color: opts.strong ? COLORS.navy : COLORS.gray, fontWeight: opts.strong ? 700 : 400 }}>{label}</span>
                <span style={{ fontWeight: opts.strong ? 700 : 600, color: opts.valueColor || COLORS.navy,
                  fontSize: opts.large ? 15 : 13 }}>{value}</span>
              </div>
            );
            return (
              <>
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden", marginTop: 4, marginBottom: 10 }}>
                  {row("Existing Payoff", analysis.estimatedPayoff > 0 ? fmt(Math.round(analysis.estimatedPayoff)) : "—")}
                  {hasSecondMtg && analysis.secondBalance > 0 && row("+ 2nd Mortgage Balance", fmt(analysis.secondBalance))}
                  {row("+ Rolled-in Closing Costs", fmt(Math.round(analysis.rolledIn || 0)))}
                  {row("+ Cash Out", fmt(co))}
                  {pbd > 0 && row("− Cash Brought to Closing", "(" + fmt(pbd) + ")", { valueColor: COLORS.green })}
                  <div style={{ borderTop: `2px solid ${COLORS.blue}44` }} />
                  {row("= New Total Loan Amount", fmt(Math.round(analysis.newLoanAmt)), { strong: true, highlight: true, large: true, valueColor: COLORS.blue })}
                  {hv > 0 && row("LTV", analysis.newLTV.toFixed(1) + "%", { highlight: true, valueColor: analysis.newLTV > 80 ? COLORS.red : COLORS.green, last: true })}
                </div>
                {isTXViolation && (
                  <div style={{ padding: "14px 16px", background: COLORS.red, borderRadius: 8, color: "#fff", fontFamily: font, marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>🚫 Texas Cash-Out LTV Violation</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>
                      Texas law (Section 50(a)(6)) limits cash-out refinances on owner-occupied homesteads to <strong>80% LTV maximum</strong>. The current LTV is <strong>{analysis.newLTV.toFixed(1)}%</strong> — this loan cannot close as structured.
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>
                      {maxCashOut > 0
                        ? <>To comply, reduce the cash-out amount to <strong>{fmt(maxCashOut)}</strong> or less.</>
                        : <>No cash-out is possible at this home value and loan balance — the LTV already exceeds 80% before adding any cash-out. The cash-out must be removed entirely.</>
                      }
                    </div>
                  </div>
                )}
                {raNewProg === "conventional" && hv > 0 && analysis.newLTV > 80 && (() => {
                  // Ordered high→low so the easiest-to-reach tier shows first
                  const tiers = [
                    { ltv: 95, color: COLORS.gold },
                    { ltv: 90, color: COLORS.gold },
                    { ltv: 85, color: COLORS.gold },
                    { ltv: 80, color: COLORS.green },
                  ];
                  const rows = tiers
                    .map(t => ({ ...t, needed: Math.ceil(analysis.newLoanAmt - hv * (t.ltv / 100)) }))
                    .filter(t => t.needed > 0);
                  if (rows.length === 0) return null;
                  return (
                    <div style={{ padding: "12px 14px", background: COLORS.goldLight, border: `1px solid ${COLORS.gold}55`, borderRadius: 8, fontFamily: font, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, marginBottom: 8 }}>💡 LTV / PMI Benchmarks</div>
                      {rows.map((t, i) => (
                        <div key={t.ltv} style={{ fontSize: 12, color: COLORS.navy, lineHeight: 1.7, padding: "7px 0", borderBottom: i < rows.length - 1 ? `1px solid ${COLORS.gold}33` : "none" }}>
                          {t.ltv === 80
                            ? <>✅ <span style={{ color: COLORS.gray, fontStyle: "italic" }}>Just FYI:</span> PMI can be removed entirely when your LTV reaches <strong>80%</strong>. To achieve this, you'd need to reduce your loan amount by <strong style={{ color: COLORS.green }}>{fmt(t.needed)}</strong>.</>
                            : <>📉 <span style={{ color: COLORS.gray, fontStyle: "italic" }}>Just FYI:</span> At <strong>{t.ltv}% LTV</strong> you'd move to a lower PMI rate. To get there, reduce your loan amount by <strong style={{ color: t.color }}>{fmt(t.needed)}</strong>.</>
                          }
                        </div>
                      ))}
                      <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 8 }}>PMI rates step down at each 5% LTV threshold. Even reaching a lower tier can meaningfully reduce your monthly payment.</div>
                    </div>
                  );
                })()}

              </>
            );
          })()}
        </SectionCard>
        </div>
      </div>
      {/* ── Verdict: gated on new loan data being populated ── */}
      {hasNewLoanData ? (
        <div style={{ padding: "22px 24px", borderRadius: 12, color: "#fff", marginBottom: 18, background: rec.color === COLORS.green ? `linear-gradient(135deg, #1A9E5A, #22A06B)` : rec.color === REFI_AMBER ? `linear-gradient(135deg, #B86B00, #9A5900)` : `linear-gradient(135deg, #C0392B, #E74C3C)`, boxShadow: rec.color === COLORS.green ? "0 4px 18px rgba(26,158,90,0.35)" : rec.color === REFI_AMBER ? "0 4px 18px rgba(184,107,0,0.35)" : "0 4px 14px rgba(0,0,0,0.18)" }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 10, fontFamily: font }}>{rec.verdict}</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, opacity: 0.95, lineHeight: 1.85, fontFamily: font, marginBottom: rec.color === COLORS.green ? 14 : 0 }}>
            <li>{rec.reason}</li>
            {rec.color === COLORS.green && analysis.fiveYearSavings > 0 && <li>{fmt(analysis.fiveYearSavings)} in 5-year savings (avg. {fmt(analysis.fiveYearSavings / 5)}/year)</li>}
            {rec.color === COLORS.green && analysis.curTotalPayment > 0 && analysis.newTotalPayment > 0 && <li>Monthly cash flow improvement: {fmt2(analysis.curTotalPayment - analysis.newTotalPayment)}/mo ({fmt2(analysis.curTotalPayment)} → {fmt2(analysis.newTotalPayment)})</li>}
          </ul>
          {rec.color === COLORS.green && <a href="https://www.MortgageMark.com/Apply" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 28px", background: "rgba(255,255,255,0.22)", color: "#fff", fontWeight: 700, fontSize: 15, borderRadius: 8, textDecoration: "none", fontFamily: font, border: "2px solid rgba(255,255,255,0.5)", cursor: "pointer", letterSpacing: "0.03em", transition: "background 0.2s" }} onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.35)"} onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.22)"}>Start Saving: Apply Now →</a>}
        </div>
      ) : (
        <div style={{ padding: "16px 20px", borderRadius: 10, background: "#f8fafc", border: `1px dashed ${COLORS.border}`, marginBottom: 18, fontFamily: font, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: COLORS.grayLight, fontStyle: "italic" }}>Complete the proposed loan details above to see the refinance analysis.</div>
        </div>
      )}
      <div className="mtk-tab-bar" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ id: "summary", label: "Summary" }, { id: "payoff", label: "Payoff Math" }, { id: "math", label: "Show the Math" }, { id: "amort", label: "Amortization" }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: font, background: activeTab === t.id ? COLORS.navy : COLORS.border, color: activeTab === t.id ? "#fff" : COLORS.gray }}>{t.label}</button>
        ))}
      </div>
      {activeTab === "summary" && (
        <div>
          {/* Row 1 — headline metrics */}
          <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {analysis.cashOut > 0 ? (
              <div style={{ background: c.white, borderRadius: 12, padding: "20px 18px", border: `1px solid ${c.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: c.gray, marginBottom: 6, fontFamily: font }}>TRUE BREAK-EVEN</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b", fontFamily: font, lineHeight: 1.1 }}>N/A</div>
                <div style={{ fontSize: 11, color: c.grayLight, marginTop: 4, fontFamily: font }}>Cash-out refis don't have a true break-even. Call us to check the math!</div>
              </div>
            ) : (
              <MetricCard label="True Break-Even" value={analysis.trueBreakEven.breakEvenMonth ? `${analysis.trueBreakEven.breakEvenMonth} mo` : "N/A"} sublabel={analysis.trueBreakEven.breakEvenMonth ? `About ${(analysis.trueBreakEven.breakEvenMonth / 12).toFixed(1)} years` : "New loan costs more"} positive={analysis.trueBreakEven.breakEvenMonth && analysis.trueBreakEven.breakEvenMonth <= 36} large highlight />
            )}
            <MetricCard label="5-Year Real Savings" value={fmt(analysis.fiveYearSavings)} sublabel="Interest + PMI saved minus closing fees" positive={analysis.fiveYearSavings > 0} large />
            <MetricCard label="Lifetime Interest Saved" value={fmt(analysis.interestSaved)} sublabel="Over the life of the loan" positive={analysis.interestSaved > 0} large />
          </div>
          {/* Row 2 — Why our break-even is different (full width) */}
          <div style={{ background: COLORS.blueLight, borderRadius: 12, padding: 18, border: `1.5px solid ${COLORS.blue}`, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 10, fontFamily: font }}>WHY OUR BREAK-EVEN IS DIFFERENT</div>
            <div style={{ fontSize: 11, color: COLORS.navy, marginBottom: 12, fontFamily: font, lineHeight: 1.5 }}>
              Break-even uses <strong>closing fees only</strong> — not total closing costs. Prepaids (prepaid interest &amp; escrow reserves) are paid by the homeowner regardless of whether they refinance. They are not a cost of getting the loan, so including them would make the refi look harder to justify than it actually is.
            </div>
            <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, fontFamily: font }}>TYPICAL (WRONG) METHOD</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.red, fontFamily: font }}>{analysis.lazyBreakEven ? `${analysis.lazyBreakEven} months` : "N/A"}</div>
                <div style={{ fontSize: 12, color: COLORS.navy, marginTop: 6, fontFamily: font, fontWeight: 500 }}>
                  {analysis.lazyBreakEven && analysis.monthlySavings > 0
                    ? `${fmt(Math.round(analysis.closingFeesOnly))} ÷ ${fmt2(analysis.monthlySavings)}/mo = ${analysis.lazyBreakEven} mo (${(analysis.lazyBreakEven / 12).toFixed(1)} yrs)`
                    : "—"}
                </div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 3, fontFamily: font }}>Closing fees ÷ payment savings. Ignores amortization shift.</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, fontFamily: font }}>OUR METHOD (CORRECT)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.green, fontFamily: font }}>{analysis.trueBreakEven.breakEvenMonth ? `${analysis.trueBreakEven.breakEvenMonth} months` : "N/A"}</div>
                <div style={{ fontSize: 12, color: COLORS.navy, marginTop: 6, fontFamily: font, fontWeight: 500 }}>
                  {analysis.trueBreakEven.breakEvenMonth
                    ? `${fmt(Math.round(analysis.closingFeesOnly))} ÷ ${fmt2(analysis.closingFeesOnly / analysis.trueBreakEven.breakEvenMonth)}/mo = ${analysis.trueBreakEven.breakEvenMonth} mo (${(analysis.trueBreakEven.breakEvenMonth / 12).toFixed(1)} yrs)`
                    : "—"}
                </div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 3, fontFamily: font }}>Cumulative interest + PMI comparison. Month-by-month tracking.</div>
              </div>
            </div>
          </div>
          {/* Row 3 — loan details */}
          <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <MetricCard label="Monthly Savings" value={`${fmt(analysis.monthlySavings)}/mo`} sublabel="P&I + PMI difference" positive={analysis.monthlySavings > 0} />
            <MetricCard label="New P&I Payment" value={`${fmt2(analysis.newPI)}/mo`} sublabel={`Total w/ escrow: ${fmt2(analysis.newTotalPayment)}/mo`} positive={analysis.monthlySavings > 0} />
            <MetricCard label="New Loan Amount" value={fmt(analysis.newLoanAmt)} sublabel={analysis.cashOut > 0 ? `Includes ${fmt(analysis.cashOut)} cash-out` : "Payoff + rolled-in costs"} />
          </div>
        </div>
      )}
      {activeTab === "payoff" && (
        <div>
          <SectionCard title="UNDERSTANDING YOUR PAYOFF" accent={COLORS.navy}>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font, marginBottom: 14 }}>
              <strong>Why is my payoff higher than my balance?</strong> This is one of the most common questions borrowers ask — and it's a great one. Your <strong>mortgage balance</strong> is simply what you owe as of your last payment. But your <strong>payoff amount</strong> is what it actually costs to close out the loan on a specific date, and it's almost always higher.
            </div>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font, marginBottom: 14 }}>
              When you make your monthly payment, interest is <strong>paid in arrears</strong> — meaning each payment covers the previous month's interest. When you pay off a loan mid-month, the lender needs to collect interest for those extra days between your last payment and the payoff date. This is called <strong>per-diem interest</strong> (daily interest). On top of that, your servicer charges a small <strong>payoff processing fee</strong>.
            </div>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font }}>
              Here's how we estimate your payoff amount:
            </div>
          </SectionCard>
          {analysis.estimatedPayoff > 0 && (
            <SectionCard title="PAYOFF CALCULATION BREAKDOWN" accent={COLORS.blue}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, fontFamily: font }}>Current Balance</div>
                    <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Unpaid principal as of today</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt(parseFloat(curBalance) || 0)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, fontFamily: font }}>+ Per-Diem Interest</div>
                    <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>{fmt2(analysis.dailyInterest)}/day × {analysis.perDiemDays} days{lastPaymentDate ? " (from last payment)" : " (est. — enter last payment date above for exact)"} = {fmt2(analysis.dailyInterest * analysis.perDiemDays)}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.gold, fontFamily: font }}>+{fmt2(analysis.dailyInterest * analysis.perDiemDays)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, fontFamily: font }}>+ Payoff Fee</div>
                    <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Processing fee charged by current servicer</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.gold, fontFamily: font }}>+{fmt2(analysis.payoffFee)}</div>
                </div>
                {analysis.escrowCredit > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.green, fontFamily: font }}>− Escrow Credit</div>
                    <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Current escrow balance applied to payoff</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.green, fontFamily: font }}>−{fmt(analysis.escrowCredit)}</div>
                </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", alignItems: "center", background: COLORS.blueLight, borderRadius: 8, marginTop: 8, paddingLeft: 12, paddingRight: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.navy, fontFamily: font }}>= Estimated Payoff Amount</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.blue, fontFamily: font }}>{fmt(analysis.estimatedPayoff)}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.grayLight, lineHeight: 1.6, fontFamily: font, padding: "10px 12px", background: COLORS.bgAlt, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                <strong style={{ color: COLORS.gray }}>⚠ Important:</strong> This is an estimate. The ${analysis.payoffFee} payoff fee shown is a common industry figure, but every loan servicer sets their own fee — typically ranging from $0 to $300. Your actual payoff statement from your servicer will have the exact amount. Per-diem interest may also shift slightly depending on the exact payoff date.
              </div>
            </SectionCard>
          )}
          {!analysis.estimatedPayoff && (
            <SectionCard title="ENTER LOAN DETAILS">
              <div style={{ fontSize: 13, color: COLORS.grayLight, fontFamily: font, textAlign: "center", padding: 20 }}>Enter your current loan balance and rate above to see the payoff calculation breakdown.</div>
            </SectionCard>
          )}
        </div>
      )}
      {activeTab === "math" && (() => {
        const cashFlow = analysis.curTotalPayment - analysis.newTotalPayment;
        const naiveBreakEven = cashFlow > 0 ? Math.ceil(analysis.closingFeesOnly / cashFlow) : null;
        return (
        <div>
          <SectionCard title="THE WRONG WAY — CASH FLOW METHOD" accent={COLORS.red}>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font, marginBottom: 12 }}>
              <strong>This is how most people (and many loan officers) calculate break-even.</strong> They take total closing costs and divide by the monthly payment difference. It's simple, intuitive — and misleading.
            </div>
            <div style={{ background: COLORS.bgAlt, borderRadius: 10, padding: 16, border: `1px solid ${COLORS.border}`, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>Current total payment</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt2(analysis.curTotalPayment)}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>New total payment</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.blue, fontFamily: font }}>{fmt2(analysis.newTotalPayment)}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>Monthly cash flow savings</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: cashFlow > 0 ? COLORS.green : COLORS.red, fontFamily: font }}>{fmt2(cashFlow)}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>Closing fees (excl. prepaids)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt(analysis.closingFeesOnly)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt(analysis.closingFeesOnly)} ÷ {fmt2(cashFlow)}/mo =</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.red, fontFamily: font }}>{naiveBreakEven ? `${naiveBreakEven} months` : "N/A"}</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font }}>
              <strong>Why this is wrong:</strong> This method treats every dollar of your payment equally. But your payment is split between principal (money that builds equity) and interest (money that's gone forever). A lower rate shifts more of each payment toward principal from day one — that's real savings the cash flow method completely ignores.
            </div>
          </SectionCard>
          <SectionCard title="THE RIGHT WAY — TRUE INTEREST COST METHOD" accent={COLORS.green}>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font, marginBottom: 12 }}>
              <strong>We compare the actual cost of money — interest and PMI — month by month.</strong> The new loan starts "in the hole" by the closing fees. Each month, we track how much interest you burn on each loan, add any PMI, and see when the new loan's cumulative cost drops below what you'd have paid staying put.
            </div>
            <div style={{ background: COLORS.blueLight, borderRadius: 8, padding: "12px 14px", border: `1px solid ${COLORS.blue}`, marginBottom: 12, fontSize: 12, color: COLORS.navy, lineHeight: 1.7, fontFamily: font }}>
              <strong>Why we exclude prepaids from the break-even calculation:</strong> Your total closing costs include two separate buckets — <em>closing fees</em> and <em>prepaids</em>. Closing fees (lender fees, title, third-party charges) are the actual cost of getting the new loan — money you wouldn't spend if you didn't refinance. Prepaids (prepaid interest and escrow reserves for taxes and insurance) are a different story: you'd pay those regardless of whether you refinance. Your current escrow account gets refunded, and the new one just gets pre-funded. Including prepaids in the break-even would make every refi look harder to justify than it actually is. We isolate the true cost of the loan — closing fees only — and measure how long it takes your interest savings to recover that amount.
            </div>
            <div style={{ background: COLORS.bgAlt, borderRadius: 10, padding: 16, border: `1px solid ${COLORS.border}`, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>Current monthly interest (month 1)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{analysis.curSchedule[0] ? fmt2(analysis.curSchedule[0].interest) : "—"}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>New monthly interest (month 1)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.blue, fontFamily: font }}>{analysis.newSchedule[0] ? fmt2(analysis.newSchedule[0].interest) : "—"}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>Monthly interest saved</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.green, fontFamily: font }}>{analysis.curSchedule[0] && analysis.newSchedule[0] ? fmt2(analysis.curSchedule[0].interest - analysis.newSchedule[0].interest) : "—"}/mo</span>
              </div>
              {analysis.cPmiMonthly > 0 || analysis.nPmiMonthly > 0 ? (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>PMI difference (current − new)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: (analysis.cPmiMonthly - analysis.nPmiMonthly) >= 0 ? COLORS.green : COLORS.red, fontFamily: font }}>{fmt2(analysis.cPmiMonthly - analysis.nPmiMonthly)}/mo</span>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>Closing fees to recoup (excl. prepaids)</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt(analysis.closingFeesOnly)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>True break-even =</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.green, fontFamily: font }}>{analysis.trueBreakEven.breakEvenMonth ? `${analysis.trueBreakEven.breakEvenMonth} months` : "N/A"}</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font }}>
              <strong>Why it matters:</strong> Early in a mortgage, most of your payment is interest. A lower rate saves more in those early months than the simple payment difference suggests. The cash flow method said <strong>{naiveBreakEven ? `${naiveBreakEven} months` : "N/A"}</strong> — our method shows <strong>{analysis.trueBreakEven.breakEvenMonth ? `${analysis.trueBreakEven.breakEvenMonth} months` : "N/A"}</strong>. {naiveBreakEven && analysis.trueBreakEven.breakEvenMonth && naiveBreakEven > analysis.trueBreakEven.breakEvenMonth ? "You're actually recovering your costs faster than the simple math suggests." : naiveBreakEven && analysis.trueBreakEven.breakEvenMonth && naiveBreakEven < analysis.trueBreakEven.breakEvenMonth ? "The simple math makes it look faster, but real costs tell a different story." : ""}
            </div>
          </SectionCard>
        </div>
        );
      })()}
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

      {/* ── Strike Rate Calculator ─────────────────────────────────────────── */}
      {analysis.curPI > 0 && analysis.newLoanAmt > 0 && analysis.closingFeesOnly > 0 && (() => {
        const tgt        = Math.max(1, Math.min(120, parseInt(strikeTarget) || 36));
        const currentBE  = analysis.trueBreakEven && analysis.trueBreakEven.breakEvenMonth;
        const alreadyAchieved = currentBE && currentBE <= tgt;
        const custom     = strikeRates ? strikeRates.custom : null;
        const tableRates = strikeRates ? strikeRates.table  : [];
        const floor125   = (r) => Math.floor(r * 8) / 8;                          // floor to 0.125%
        const fmtRate    = (r) => r != null ? `${floor125(r).toFixed(3)}%` : "N/A";

        return (
          <SectionCard title="🎯 STRIKE RATE" accent={COLORS.gold}>

            {/* Intro */}
            <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, marginBottom: 16, lineHeight: 1.65 }}>
              Your <strong style={{ color: COLORS.navy }}>strike rate</strong> is the highest interest rate at which
              a refinance makes mathematical sense — the rate where your closing costs pay for themselves within your
              target timeframe. Use it to set a rate alert so you know exactly when to pull the trigger.
            </div>

            {/* Target breakeven input */}
            <LabeledInput
              label="Target Breakeven Period"
              value={strikeTarget}
              onChange={v => {
                const n = v.replace(/[^0-9]/g, "");
                if (n === "") { setStrikeTarget(""); return; }
                const num = parseInt(n);
                if (num >= 1 && num <= 120) setStrikeTarget(String(num));
              }}
              suffix="months"
              small
              hint={tgt >= 1 ? `${tgt} months = ${(tgt / 12).toFixed(1)} years` : undefined}
            />

            {/* ── Already achieved ── */}
            {alreadyAchieved && (
              <div style={{
                background: `${COLORS.green}12`, border: `1.5px solid ${COLORS.green}55`,
                borderRadius: 10, padding: "16px 18px", marginBottom: 16, textAlign: "center",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.green, fontFamily: font, marginBottom: 6 }}>
                  Target Already Achieved
                </div>
                <div style={{ fontSize: 12, color: COLORS.navy, fontFamily: font, lineHeight: 1.65 }}>
                  Your current refi at <strong>{parseFloat(newRate).toFixed(3)}%</strong> breaks even
                  in <strong>{currentBE} months</strong> — already within your {tgt}-month target.
                  The math works right now.
                </div>
              </div>
            )}

            {/* ── Strike rate hero display ── */}
            {!alreadyAchieved && custom != null && (
              <div style={{
                background: `${COLORS.gold}10`, border: `2px solid ${COLORS.gold}`,
                borderRadius: 12, padding: "20px 20px", marginBottom: 16, textAlign: "center",
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: COLORS.gold, fontFamily: font,
                  textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8,
                }}>
                  Strike Rate — {tgt}-Month Breakeven ({(tgt / 12).toFixed(1)} yrs)
                </div>
                <div style={{ fontSize: 52, fontWeight: 900, color: COLORS.navy, fontFamily: font, lineHeight: 1 }}>
                  {fmtRate(custom)}
                </div>
                <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginTop: 6 }}>
                  Floored to nearest 0.125% &nbsp;·&nbsp; Exact: {custom.toFixed(4)}%
                </div>
                <div style={{
                  marginTop: 12, fontSize: 13, color: COLORS.navy, fontFamily: font,
                  lineHeight: 1.6, background: COLORS.bg, borderRadius: 8, padding: "10px 14px",
                }}>
                  If rates drop to <strong style={{ color: COLORS.gold }}>{fmtRate(custom)}</strong>,
                  your refi pays for itself in under <strong>{tgt} months</strong>.
                  Set a rate alert — when you see it, call your loan officer immediately.
                </div>
              </div>
            )}

            {/* ── Not achievable ── */}
            {!alreadyAchieved && custom == null && (
              <div style={{
                background: `${COLORS.red}0f`, border: `1px solid ${COLORS.red}44`,
                borderRadius: 10, padding: "12px 16px", marginBottom: 16,
                fontSize: 12, color: COLORS.red, fontFamily: font, lineHeight: 1.6,
              }}>
                ⚠ A {tgt}-month breakeven is not achievable with the current cost structure.
                Try a longer target period, or see if closing costs can be reduced.
              </div>
            )}

            {/* ── Quick reference table ── */}
            <div style={{ marginTop: 6 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: COLORS.gray, fontFamily: font,
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
              }}>
                Quick Reference — Rate Needed by Breakeven Target
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.navy}` }}>
                    {["Breakeven", "Years", "Strike Rate", "Status"].map((h, i) => (
                      <th key={h} style={{
                        padding: "7px 10px", fontSize: 10, fontWeight: 700, color: COLORS.gray,
                        textAlign: i === 0 ? "left" : "right",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRates.map(({ months, rate }, i) => {
                    const isTarget    = months === tgt;
                    const beMo        = analysis.trueBreakEven && analysis.trueBreakEven.breakEvenMonth;
                    const achieved    = beMo && beMo <= months;
                    const impossible  = rate == null;
                    return (
                      <tr key={months} style={{
                        borderBottom: `1px solid ${COLORS.border}`,
                        background: isTarget ? `${COLORS.gold}12` : i % 2 === 0 ? COLORS.bgAlt : COLORS.white,
                      }}>
                        <td style={{ padding: "8px 10px", fontWeight: isTarget ? 700 : 500, color: COLORS.navy, fontSize: 13 }}>
                          {months} mo
                          {isTarget && (
                            <span style={{
                              fontSize: 9, background: COLORS.gold, color: "#fff",
                              borderRadius: 4, padding: "1px 5px", marginLeft: 6, fontWeight: 700,
                            }}>TARGET</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: COLORS.gray, fontSize: 12 }}>
                          {(months / 12).toFixed(1)} yr
                        </td>
                        <td style={{
                          padding: "8px 10px", textAlign: "right", fontWeight: 700, fontSize: 14,
                          color: achieved ? COLORS.green : impossible ? COLORS.gray : COLORS.navy,
                        }}>
                          {impossible ? "—" : fmtRate(rate)}
                        </td>
                        <td style={{
                          padding: "8px 10px", textAlign: "right", fontSize: 11,
                          color: achieved ? COLORS.green : impossible ? COLORS.red : COLORS.gray,
                        }}>
                          {achieved ? "✅ Achieved" : impossible ? "Not achievable" : "Watch for it"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tip */}
            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`,
              borderRadius: 8, fontSize: 11, color: COLORS.navy, fontFamily: font, lineHeight: 1.65,
            }}>
              💡 <strong>Set a rate alert:</strong> Use your lender's app, Zillow, or Bankrate to alert you when
              30-year rates hit your strike rate. Rates move fast — when you see it, call your loan officer the same day.
              These calculations assume your current cost structure; actual costs may differ at time of refi.
            </div>

          </SectionCard>
        );
      })()}

      {/* ── New Payment Breakdown — bottom of page ── */}
      <SectionCard title="NEW PAYMENT BREAKDOWN" accent={COLORS.blue}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", fontSize: 13, fontFamily: font }}>
          <span style={{ color: COLORS.gray }}>Principal & Interest</span>
          <span style={{ fontWeight: 600, textAlign: "right" }}>{fmt2(analysis.newPI)}/mo</span>
          {!analysis.effectiveWaiveEscrows && <>
            <span style={{ color: COLORS.gray }}>Taxes</span>
            <span style={{ fontWeight: 600, textAlign: "right" }}>{fmt2(analysis.monthlyTax)}/mo</span>
            <span style={{ color: COLORS.gray }}>Insurance</span>
            <span style={{ fontWeight: 600, textAlign: "right" }}>{fmt2(analysis.monthlyIns)}/mo</span>
          </>}
          {analysis.nPmiMonthly > 0 && <>
            <span style={{ color: COLORS.gray }}>PMI/MIP</span>
            <span style={{ fontWeight: 600, textAlign: "right" }}>{fmt2(analysis.nPmiMonthly)}/mo</span>
          </>}
          <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${COLORS.border}`, margin: "4px 0" }} />
          <span style={{ fontWeight: 700, color: COLORS.navy }}>Total Payment</span>
          <span style={{ fontWeight: 700, color: COLORS.blue, textAlign: "right", fontSize: 14 }}>{fmt2(analysis.newTotalPayment)}/mo</span>
          {analysis.effectiveWaiveEscrows && <span style={{ gridColumn: "1 / -1", fontSize: 10, color: COLORS.grayLight }}>Excludes taxes ({fmt2(analysis.monthlyTax)}) & insurance ({fmt2(analysis.monthlyIns)}) — paid separately</span>}
          {analysis.apr > 0 && <>
            <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${COLORS.border}`, margin: "4px 0" }} />
            <span style={{ color: COLORS.gray }}>Interest Rate</span>
            <span style={{ fontWeight: 600, textAlign: "right" }}>{parseFloat(newRate).toFixed(3)}%</span>
            <span style={{ color: COLORS.gray }}>APR <span style={{ fontSize: 10, fontWeight: 400 }}>(est.)</span></span>
            <span style={{ fontWeight: 700, textAlign: "right", color: COLORS.navy }}>{analysis.apr.toFixed(3)}%</span>
          </>}
        </div>
      </SectionCard>
    </div>
  );
}

window.RefinanceAnalyzer = RefinanceAnalyzer;
