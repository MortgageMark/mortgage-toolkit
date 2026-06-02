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
const getHolidayName = window.getHolidayName;

// ── Refi fee estimator (mirrors Fee Sheet logic, no UI state needed) ──────────
function estimateRefiFees({ la, rate, state, occupancy, closingDate, monthlyTax, monthlyIns, waiveEscrows, piw, waiveTitle, newSurvey, insOpt, originationPct, discountPts, nextTaxDueDate, insRenewalDate,
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

  const mIns_ = parseFloat(monthlyIns) || 0;
  const insCollect = !waiveEscrows ? 0
    : insOpt === "60days"  ? Math.round(mIns_ * 2)
    : insOpt === "6months" ? Math.round(mIns_ * 6) : 0;
  const prepaids = prepaidInterest + taxRes + insRes + aggregateAdj + insCollect;

  return {
    closingFees, prepaids,
    detail: {
      origination, discount, underwriting, processingFee, lenderFees,
      appraisal, creditReport, floodCert, taxService, docPrep, survey, thirdParty,
      lenderTitle, escrowFee, titleSearch, recording, courier, taxCert, titleFees,
      prepaidInterest, prepaidDays, dailyRate,
      taxRes, taxReserveMonths, insRes, insReserveMonths, aggregateAdj, insCollect,
    }
  };
}

function RefinanceAnalyzer({ isInternal, user }) {
  const userId = user?.id || "default";
  const [curBalance, setCurBalance] = useLocalStorage("ra_cb", "");
  const [curRate, setCurRate] = useLocalStorage("ra_cr", "7.25");
  const [curTermOriginal, setCurTermOriginal] = useLocalStorage("ra_cto", "30");
  const [origLoanAmount, setOrigLoanAmount] = useLocalStorage("ra_ola", "");
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
  // New loan metadata
  const [raNewProg, setRaNewProg] = useLocalStorage("ra_newprog", "conventional");
  const [raNewOcc, setRaNewOcc] = useLocalStorage("ra_newocc", "primary");
  // Second mortgage
  const [hasSecondMtg, setHasSecondMtg] = useLocalStorage("ra_has2nd", false);
  const [secondRate, setSecondRate] = useLocalStorage("ra_2rate", "");
  const [secondTerm, setSecondTerm] = useLocalStorage("ra_2term", "");
  const [secondOrigBal, setSecondOrigBal] = useLocalStorage("ra_2orig", "");
  const [secondBalance, setSecondBalance] = useLocalStorage("ra_2bal", "");
  const [secondPI, setSecondPI] = useLocalStorage("ra_2pi", "");
  const [secondNoteDate, setSecondNoteDate] = useLocalStorage("ra_2nd", "");
  const [newRate, setNewRate] = useLocalStorage("ra_nr", "6.25");
  const [newTerm, setNewTerm] = useLocalStorage("ra_nt", "30");
  const [raClosingFees,    setRaClosingFees]    = useLocalStorage("fs_cf",  "");
  const [raPrepaids,       setRaPrepaids]       = useLocalStorage("fs_tpp", "");
  const [rollInCosts, setRollInCosts] = useLocalStorage("ra_ric", "all");  // "none" | "all" | "partial" | "partial-payment" | "principal-buydown"
  const [rollInAmount, setRollInAmount] = useLocalStorage("ra_ria", "");
  const [principalBuydown, setPrincipalBuydown] = useLocalStorage("ra_pbd", "");
  const [waiveEscrows, setWaiveEscrows] = useLocalStorage("ra_we", false);
  const [escrowBalance, setEscrowBalance]       = useLocalStorage("ra_escbal",       "");
  const [netEscrows, setNetEscrows]             = useLocalStorage("ra_netesc",       false);
  const [existingMonthlyEscrow, setExistingMonthlyEscrow] = useLocalStorage("pc_exist_esc_mo", ""); // shared with PC Escrows
  // Internal transaction flags
  const [piw, setPiw] = useLocalStorage("ra_piw", false);
  const [surveyOpt, setSurveyOpt] = useLocalStorage("ra_survey_opt", "na");
  const newSurvey = surveyOpt === "order";
  // Fee Sheet keys — read by RA so fee estimate stays in sync with FSG
  const [fsOriginationPct] = useLocalStorage("fs_op",           "1.0");
  const [fsDiscountPts]    = useLocalStorage("fs_dp",           "0");
  const [fsNextTaxDue]     = useLocalStorage("fs_next_tax_due", "");
  const [fsInsRenew, setFsInsRenew] = useLocalStorage("fs_ins_renew", "");
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
  const [insOpt, setInsOpt] = useLocalStorage("ra_ins_opt", "na");
  // Shared short pay — same key as Fee Sheet so toggle stays in sync across both tabs
  const [shortPay, setShortPay] = useLocalStorage("fs_sp", false);
  const default30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  // Shared closing date key with Fee Sheet — both modules read/write the same slot
  const [newClosingDate, setNewClosingDate] = useLocalStorage("fs_closing_date", default30);
  const [raFundingDate, setRaFundingDate] = useLocalStorage("ra_funding_date", "");
  const [pmtUnchecked, setPmtUnchecked] = useLocalStorage("ra_pmt_unchecked", "[]");
  const [pmtSmartSeed, setPmtSmartSeed] = useLocalStorage("ra_pmt_smart_seed", "");
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

  // Auto-default insurance renewal date to noteDate month/day + upcoming year
  useEffect(() => {
    if (fsInsRenew || !noteDate) return;
    const parts = noteDate.split("-");
    if (parts.length < 3) return;
    const mm = parts[1], dd = parts[2];
    const now = new Date();
    const yr = new Date(now.getFullYear(), parseInt(mm)-1, parseInt(dd)) > now ? now.getFullYear() : now.getFullYear()+1;
    setFsInsRenew(`${yr}-${mm}-${dd}`);
  }, [noteDate]);

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

  // ── Compute effective funding date ──────────────────────────────────────────
  // TX primary refi = wet funding (closes and funds same day).
  // All other refis have a 3-business-day right of rescission (excludes Sundays + federal holidays;
  // Saturdays count per TILA). Returns date string + any holidays that pushed the date out.
  const computedFundingInfo = useMemo(() => {
    const base = newClosingDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const isTXHomestead = raState === "TX" && raOcc === "primary";
    // Match Fee Sheet exactly:
    // TX homestead refi → closing + 3 rescission days (Sundays + federal holidays excluded; Saturdays count)
    // All other loans (including non-TX owner-occupied, investment, vacation) → same day as closing
    if (!isTXHomestead) return { date: base, holidays: [], isTXRescission: false };
    const p = base.split("-");
    let d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    let added = 0;
    const skippedHolidays = [];
    while (added < 3) {
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      if (d.getDay() === 0) continue; // skip Sundays; Saturdays count per TX TILA
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if (isHoliday && isHoliday(iso, d.getFullYear())) {
        const name = getHolidayName ? getHolidayName(iso, d.getFullYear()) : "Federal Holiday";
        skippedHolidays.push({ iso, name });
        continue;
      }
      added++;
    }
    return { date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`, holidays: skippedHolidays, isTXRescission: true };
  }, [newClosingDate, raState, raOcc]);

  const computedFundingDate = computedFundingInfo.date;

  // Funding date: always auto-computed (no manual override)
  const effectiveFundingDate = computedFundingDate;

  // ── Payments before closing — auto-detect 1st-of-months between last payment and funding ──
  const autoPaymentDates = useMemo(() => {
    if (!lastPaymentDate || !effectiveFundingDate) return [];
    const last = new Date(lastPaymentDate + "T12:00:00");
    const fund = new Date(effectiveFundingDate + "T12:00:00");
    const dates = [];
    let d = new Date(last.getFullYear(), last.getMonth() + 1, 1);
    while (d < fund) {
      dates.push(d.toISOString().slice(0, 10));
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return dates;
  }, [lastPaymentDate, effectiveFundingDate]);

  const uncheckedSet = useMemo(() => {
    try { return new Set(JSON.parse(pmtUnchecked)); } catch { return new Set(); }
  }, [pmtUnchecked]);

  const checkedPayments = useMemo(() =>
    autoPaymentDates.filter(d => !uncheckedSet.has(d)),
  [autoPaymentDates, uncheckedSet]);

  function togglePayment(dateStr) {
    const next = new Set(uncheckedSet);
    if (next.has(dateStr)) next.delete(dateStr); else next.add(dateStr);
    // Only persist dates still in the current auto-detected window
    setPmtUnchecked(JSON.stringify([...next].filter(d => autoPaymentDates.includes(d))));
  }

  // Auto-default the closing-month payment to unchecked when funding ≤ 10th
  useEffect(() => {
    if (!autoPaymentDates.length || !effectiveFundingDate) return;
    const day = parseInt(effectiveFundingDate.split('-')[2]);
    const closingMonthDate = autoPaymentDates[autoPaymentDates.length - 1];
    if (day >= 1 && day <= 10) {
      if (pmtSmartSeed !== closingMonthDate) {
        const next = new Set(uncheckedSet);
        next.add(closingMonthDate);
        setPmtUnchecked(JSON.stringify([...next].filter(d => autoPaymentDates.includes(d))));
        setPmtSmartSeed(closingMonthDate);
      }
    } else {
      // Funding ≥ 11th — if our smart seed matches the closing month, remove it
      if (pmtSmartSeed && pmtSmartSeed === closingMonthDate) {
        const next = new Set(uncheckedSet);
        next.delete(pmtSmartSeed);
        setPmtUnchecked(JSON.stringify([...next].filter(d => autoPaymentDates.includes(d))));
        setPmtSmartSeed("");
      }
    }
  }, [effectiveFundingDate, autoPaymentDates.join(",")]);

  // ── Project balance & escrow forward through checked payments ──
  const paymentProjection = useMemo(() => {
    const cb = parseFloat(String(curBalance).replace(/,/g, "")) || 0;
    const r  = (parseFloat(curRate) || 0) / 100 / 12;
    const remaining = Math.max(1, (parseFloat(curTermOriginal) || 30) * 12 - monthsPaidCalc);
    const monthlyPmt = (cb > 0 && r > 0)
      ? (window.pmt ? window.pmt(r, remaining, cb) : cb * r / (1 - Math.pow(1 + r, -remaining)))
      : 0;
    const escMo  = parseFloat(String(existingMonthlyEscrow).replace(/,/g, "")) || 0;
    const escBal = parseFloat(String(escrowBalance).replace(/,/g, ""))         || 0;

    let bal = cb, esc = escBal, lastPmtDate = lastPaymentDate;
    const rows = [];
    for (const dateStr of checkedPayments) {
      const interest   = bal * r;
      const principal  = r > 0 ? Math.max(0, monthlyPmt - interest) : 0;
      bal = Math.max(0, bal - principal);
      esc += escMo;
      lastPmtDate = dateStr;
      rows.push({ date: dateStr, balance: Math.round(bal), escrow: Math.round(esc),
                  principal: Math.round(principal), interest: Math.round(interest) });
    }
    return { projectedBalance: Math.round(bal), projectedEscrow: Math.round(esc),
             effectiveLastPmtDate: lastPmtDate, rows };
  }, [curBalance, curRate, curTermOriginal, monthsPaidCalc,
      existingMonthlyEscrow, escrowBalance, checkedPayments, lastPaymentDate]);

  // ── Per-diem days — from effective last payment date (post-projection) to funding ──
  const payoffDaysCalc = useMemo(() => {
    const payoffDate = effectiveFundingDate
      ? new Date(effectiveFundingDate + "T00:00:00")
      : (() => { const d = new Date(); d.setDate(d.getDate() + 33); return d; })();
    const refDate = paymentProjection.effectiveLastPmtDate || lastPaymentDate;
    if (refDate) {
      const lp   = new Date(refDate + "T00:00:00");
      const days = Math.ceil((payoffDate.getTime() - lp.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) return days;
    }
    return payoffDate.getDate();
  }, [paymentProjection.effectiveLastPmtDate, lastPaymentDate, effectiveFundingDate]);

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
    const s2bal = parseFloat(secondBalance) || 0;
    const s2pi = parseFloat(secondPI) || 0;

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
  }, [curBalance, curRate, curTermOriginal, monthsPaidCalc, origLoanAmount, curPMI, curHomeValue, taxMode, propertyTaxRate, propertyTax, raState, raOcc, insMode, homeInsuranceRate, homeInsurance, escrowBalance, netEscrows, raCurPI, newRate, newTerm, raClosingFees, raPrepaids, rollInCosts, rollInAmount, principalBuydown, waiveEscrows, newClosingDate, ficoScore, raNewOcc, raNewProg, cashOutEnabled, cashOutAmount, payoffDaysCalc, secondBalance, secondPI, shortPay]);

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
      piw, waiveTitle, newSurvey, insOpt,
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
    // Only push loan amount when a new rate has been entered — prevents RA from
    // overwriting the user's PC loan amount just because shared fields (like ra_cb) changed.
    // pc_la intentionally not synced — user manages loan amount in Payment Calculator directly
    setLS("pc_state",    raState);
    setLS("pc_occ",      raOcc);
    // Push computed refi breakdown values for PC's Refi: Structure section
    // Compute payoff matching the payoff breakdown panel: use projected balance
    // (after payments-before-closing) + per-diem on that balance + $150 fee + late fee.
    // analysis.estimatedPayoff uses raw curBalance, which produces a different (higher) number.
    const _cb2 = parseFloat(String(curBalance).replace(/,/g, "")) || 0;
    const _projBal = paymentProjection.rows.length > 0 ? paymentProjection.projectedBalance : _cb2;
    const _daily2 = _projBal * (parseFloat(curRate) || 0) / 100 / 365;
    const _fundDay2 = effectiveFundingDate ? parseInt(effectiveFundingDate.split('-')[2]) : 0;
    const _closingMo2 = autoPaymentDates.length > 0 ? autoPaymentDates[autoPaymentDates.length - 1] : null;
    const _late2 = _fundDay2 > 15 && _closingMo2 && uncheckedSet.has(_closingMo2) ? 100 : 0;
    setLS("ra_est_payoff", String(Math.round(_projBal + _daily2 * payoffDaysCalc + 150 + _late2)));
    setLS("ra_costs_due",     String(Math.round(analysis.costsDueAtClosing || 0)));
    setLS("ra_rolled_in_amt", String(Math.round(analysis.rolledIn || 0)));
    if (analysis.firstPaymentDate instanceof Date && !isNaN(analysis.firstPaymentDate.getTime())) {
      const fpy = analysis.firstPaymentDate.getFullYear();
      const fpm = String(analysis.firstPaymentDate.getMonth() + 1).padStart(2, "0");
      const fpd = String(analysis.firstPaymentDate.getDate()).padStart(2, "0");
      setLS("ra_first_pmt_date", `${fpy}-${fpm}-${fpd}`);
    } else {
      setLS("ra_first_pmt_date", "");
    }
    // Push RA's computed monthly tax/ins to shared keys so all tabs stay in sync.
    // Only overwrite when RA actually has data entered — avoids clobbering FSG/PC when RA is blank.
    const hasTaxData = taxMode === "rate" ? (parseFloat(curHomeValue) > 0) : (propertyTax !== "" && propertyTax != null);
    const hasInsData = insMode === "rate" ? (parseFloat(curHomeValue) > 0) : (homeInsurance !== "" && homeInsurance != null);
    if (hasTaxData) setLS("fs_mt", String(Math.round(analysis.monthlyTax)));
    if (hasInsData) setLS("fs_mi", String(Math.round(analysis.monthlyIns)));

    // ── 3. Broadcast (fees already in LS, so handlers read fresh values) ─────
    window.dispatchEvent(new Event("mtk_propagated"));
  }, [analysis, paymentProjection, effectiveFundingDate, payoffDaysCalc, newRate, raState, raNewOcc, newClosingDate, piw, waiveTitle, surveyOpt, insOpt,
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


  // PC → RA: listen for Payment Calculator changes, pull rate/term/home value back
  useEffect(() => {
    const handler = () => {
      if (isPushingToPC.current) return;
      const pcRate = readLS("pc_rate");
      const pcTerm = readLS("pc_term");
      const pcHp   = readLS("pc_hp");
      const pcProg = readLS("pc_prog");
      const pcOcc  = readLS("pc_occ");
      const coa    = readLS("ra_coa");
      const ric    = readLS("ra_ric");
      const ria    = readLS("ra_ria");
      const pbd    = readLS("ra_pbd");
      if (pcRate !== null) setNewRate(cur => cur !== pcRate ? pcRate : cur);
      if (pcTerm !== null) setNewTerm(cur => cur !== pcTerm ? pcTerm : cur);
      if (pcHp   !== null) setCurHomeValue(cur => cur !== pcHp ? pcHp : cur);
      if (pcProg !== null) setRaNewProg(cur => cur !== pcProg ? pcProg : cur);
      if (pcOcc  !== null) setRaNewOcc(cur => cur !== pcOcc ? pcOcc : cur);
      if (coa    !== null) setCashOutAmount(cur => cur !== coa ? coa : cur);
      if (ric    !== null) setRollInCosts(cur => cur !== ric ? ric : cur);
      if (ria    !== null) setRollInAmount(cur => cur !== ria ? ria : cur);
      if (pbd    !== null) setPrincipalBuydown(cur => cur !== pbd ? pbd : cur);
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
          <LabeledInput label="Street Address" value={raAddr} onChange={setRaAddr} type="text" />
          <LabeledInput label="City" value={raCity} onChange={setRaCity} type="text" />
          <Select label="State" value={raState} onChange={setRaState} options={[
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
          <LabeledInput label="Zip" value={raZip} onChange={setRaZip} type="text" />
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
        </SectionCard>

        <SectionCard title="EXISTING LOAN STRUCTURE" accent={COLORS.navy} infoTip={"💡 To find these numbers, pull up your most recent mortgage statement or call your servicer.\n\n• Original loan amount: what you borrowed at closing (not the current balance).\n• Current balance: the exact payoff amount today — this changes daily as interest accrues.\n• Rate: found on your note or monthly statement.\n• Note date: the date you signed your loan documents at closing."}>
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
          <LabeledInput label="Current Loan Balance" prefix="$" value={curBalance} onChange={setCurBalance} useCommas noNegative hint="Synced with Payment Calculator tab" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.gray, marginBottom: 5, fontFamily: font }}>Date of Most Recent Mortgage Payment</label>
            <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `1.5px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              <input type="date" value={lastPaymentDate} onChange={e => setLastPaymentDate(e.target.value)}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontSize: 15, fontWeight: 500, color: COLORS.navy, fontFamily: font, width: "100%" }} />
            </div>
            <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 3, fontFamily: font }}>Synced with Payment Calculator tab.</div>
          </div>
        </SectionCard>

        </div>
        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* ── EXISTING ESCROWS card ── */}
        <SectionCard title="EXISTING ESCROWS" accent={COLORS.blue}>
          {/* Insurance Renewal Date */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: COLORS.gray, marginBottom: 5, fontFamily: font }}>Insurance Renewal Date</label>
            <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `1.5px solid ${fsInsRenew && fsInsRenew < new Date().toISOString().slice(0,10) ? "#f87171" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              <input type="date" value={fsInsRenew} onChange={e => setFsInsRenew(e.target.value)}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontSize: 15, fontWeight: 500, color: COLORS.navy, fontFamily: font, width: "100%" }} />
            </div>
            {fsInsRenew && fsInsRenew < new Date().toISOString().slice(0, 10) && (
              <div style={{ marginTop: 4, padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, color: "#b91c1c", fontFamily: font, fontWeight: 600 }}>
                ⚠ Insurance renewal date is in the past — policy may have lapsed or needs renewal before closing.
              </div>
            )}
            {fsInsRenew && fsInsRenew >= new Date().toISOString().slice(0, 10) && (
              <div style={{ fontSize: 10, color: COLORS.grayLight, fontFamily: font, marginTop: 3, fontStyle: "italic" }}>Synced with Fee Sheet escrow calculation.</div>
            )}
          </div>
          <LabeledInput label="Current Escrow Balance" prefix="$" value={escrowBalance} onChange={setEscrowBalance} useCommas noNegative hint="Balance held by existing servicer at payoff" />
          <LabeledInput label="Existing Monthly Escrow" prefix="$" value={existingMonthlyEscrow} onChange={setExistingMonthlyEscrow} useCommas noNegative hint="Shared with Payment Calculator — taxes + insurance portion" />
          <LabeledInput label="Existing Monthly MI (if applicable)" prefix="$" value={curPMI} onChange={setCurPMI} suffix="/mo" useCommas noNegative hint="PMI or MIP currently being paid" />
        </SectionCard>
        {/* ── 2ND MORTGAGE toggle + card — bottom right ── */}
        <div style={{ border: `1.5px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", background: hasSecondMtg ? "transparent" : "#fafafa" }}>
          <Toggle label="Existing 2nd Mortgage (if applicable)" checked={hasSecondMtg} onChange={setHasSecondMtg} />
          {hasSecondMtg && (
            <div style={{ marginTop: 8 }}>
              <LabeledInput label="Original Loan Date (2nd Lien)" type="date" value={secondNoteDate} onChange={setSecondNoteDate} />
              <LabeledInput label="Original Term (2nd Lien)" value={secondTerm} onChange={setSecondTerm} suffix="years" noNegative />
              <LabeledInput label="Interest Rate (2nd Lien)" value={secondRate} onChange={setSecondRate} onBlur={v => fmtRateBlur(v, setSecondRate)} suffix="%" step="0.125" noNegative />
              <LabeledInput label="Original Loan Amount (2nd Lien)" prefix="$" value={secondOrigBal} onChange={setSecondOrigBal} useCommas noNegative />
              <LabeledInput label="Current P&I Payment (2nd Lien)" prefix="$" value={secondPI} onChange={setSecondPI} suffix="/mo" useCommas noNegative />
              <LabeledInput label="Current Loan Balance (2nd Lien)" prefix="$" value={secondBalance} onChange={setSecondBalance} useCommas noNegative />
              <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 6, fontFamily: font }}>Second mortgage balance will be included in the new refinance loan amount for consolidation analysis.</div>
            </div>
          )}
        </div>
        </div>
      </div>

        <div className="mtk-grid-2-REMOVED" style={{ display: "none" }}>

          {/* LEFT — dates & payments before closing */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.grayLight, fontFamily: font, marginBottom: 4, letterSpacing: "0.05em" }}>DATE OF MOST RECENT MORTGAGE PAYMENT</div>
              <input type="date" value={lastPaymentDate} onChange={e => setLastPaymentDate(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: COLORS.navy, background: "#fff", outline: "none", boxSizing: "border-box" }} />
              <div style={{ fontSize: 10, color: COLORS.grayLight, fontFamily: font, marginTop: 3, fontStyle: "italic" }}>Synced with Payment Calc Escrows section.</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.grayLight, fontFamily: font, marginBottom: 4, letterSpacing: "0.05em" }}>CLOSING DATE</div>
              <input type="date" value={newClosingDate} onChange={e => setNewClosingDate(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: COLORS.navy, background: "#fff", outline: "none", boxSizing: "border-box" }} />
              <div style={{ fontSize: 10, color: COLORS.grayLight, fontFamily: font, marginTop: 3, fontStyle: "italic" }}>Synced with Fee Sheet closing date.</div>
              {/* Funding date — auto-calculated, displayed below closing date */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.grayLight, fontFamily: font, marginBottom: 3, letterSpacing: "0.05em" }}>FUNDING DATE (AUTO-CALCULATED)</div>
                <div style={{ padding: "7px 10px", background: computedFundingInfo.isTXRescission ? `${COLORS.blue}0d` : `${COLORS.green}10`, border: `1px solid ${computedFundingInfo.isTXRescission ? COLORS.blue + "33" : COLORS.green + "44"}`, borderRadius: 6, fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
                  {new Date(computedFundingDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                </div>
                {computedFundingInfo.isTXRescission ? (
                  <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginTop: 3, lineHeight: 1.5 }}>
                    TX homestead refi — 3-day TILA right of rescission applied (Saturdays count; Sundays &amp; federal holidays excluded).
                    {computedFundingInfo.holidays.length > 0 && (
                      <span style={{ display: "block", marginTop: 3, color: COLORS.gold, fontWeight: 600 }}>
                        ⚠ Holiday accounted for: {computedFundingInfo.holidays.map(h => h.name).join(", ")} — funding date pushed out an extra day.
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: COLORS.green, fontFamily: font, marginTop: 3, fontWeight: 600 }}>Funds same day as closing.</div>
                )}
              </div>
            </div>
            {/* Payments before closing — toggle list */}
            {lastPaymentDate && effectiveFundingDate && (() => {
              const fundingDay = parseInt(effectiveFundingDate.split('-')[2]);
              const isEarlyFunding = fundingDay >= 1 && fundingDay <= 10;
              const isLateFunding = fundingDay >= 16;
              return (
              <div style={{ padding: "10px 12px", background: "#fafafa", border: `1px solid ${COLORS.border}`, borderRadius: 7, fontSize: 11, fontFamily: font }}>
                <div style={{ fontWeight: 700, color: COLORS.navy, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📅 Payments Before Closing</span>
                  {autoPaymentDates.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 400, color: COLORS.grayLight, fontStyle: "italic" }}>click to toggle</span>
                  )}
                </div>

                {/* Instructions */}
                {autoPaymentDates.length > 0 && (
                  <div style={{ fontSize: 10, color: COLORS.gray, marginBottom: 8, lineHeight: 1.55 }}>
                    Check the boxes for each monthly payment you plan to make before closing. This updates the projected loan balance used in the payoff estimate.
                  </div>
                )}

                {autoPaymentDates.length === 0 ? (
                  <div style={{ color: COLORS.green, fontWeight: 600 }}>✓ No payments expected before closing.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {autoPaymentDates.map((dateStr) => {
                      const checked = !uncheckedSet.has(dateStr);
                      const isClosingMonth = dateStr === autoPaymentDates[autoPaymentDates.length - 1];
                      const projRow = paymentProjection.rows.find(r => r.date === dateStr);
                      const _pmtD = new Date(dateStr + "T12:00:00");
                      const _ABBR = [null,"Feb.","March","April","May","June","July","Aug.","Sept.","Oct.","Nov.","Dec."];
                      const _mName = _ABBR[_pmtD.getMonth()] || ["January","February","March","April","May","June","July","August","September","October","November","December"][_pmtD.getMonth()];
                      const pmtLabel = _mName + " " + _pmtD.getDate();
                      return (
                        <div key={dateStr}>
                          <div
                            onClick={() => togglePayment(dateStr)}
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
                              <span style={{ color: COLORS.gray, fontSize: 10 }}>
                                Loan Balance: <strong style={{ color: COLORS.navy }}>{fmt(projRow.balance)}</strong>
                                {projRow.escrow > 0 && <> · Escrow Balance: <strong style={{ color: COLORS.blue }}>{fmt(projRow.escrow)}</strong></>}
                              </span>
                            ) : (
                              <span style={{ color: COLORS.gold, fontSize: 10, fontStyle: "italic" }}>skipped</span>
                            )}
                          </div>
                          {/* Advisory note for the closing-month payment */}
                          {isClosingMonth && isEarlyFunding && (
                            <div style={{ marginTop: 4, marginBottom: 2, padding: "7px 10px", background: `${COLORS.gold}14`, border: `1px solid ${COLORS.gold}55`, borderRadius: 6, fontSize: 10, color: COLORS.navy, lineHeight: 1.55, fontFamily: font }}>
                              <span style={{ fontWeight: 700, color: "#92651a" }}>⚠ Funding on the {fundingDay}{fundingDay===1?"st":fundingDay===2?"nd":fundingDay===3?"rd":"th"} — we recommend skipping this payment.</span> When closing and funding within the first 10 days of the month, making the payment can cause last-minute payoff figure issues as servicers may not update the balance in time. We've unchecked this by default.
                              <span style={{ display: "block", marginTop: 4, color: COLORS.gray }}>
                                <strong>Will this hurt my credit?</strong> No. Mortgage lates are only reported when the payment is 30+ days past due.
                              </span>
                            </div>
                          )}
                          {isClosingMonth && !isEarlyFunding && isLateFunding && (
                            <div style={{ marginTop: 4, marginBottom: 2, padding: "7px 10px", background: `${COLORS.blue}0d`, border: `1px solid ${COLORS.blue}33`, borderRadius: 6, fontSize: 10, color: COLORS.navy, lineHeight: 1.55, fontFamily: font }}>
                              <span style={{ fontWeight: 700 }}>💡 Go ahead and make this payment.</span> Funding after the 10th generally gives the servicer enough time to update the payoff. Note: if funding falls after the 15th, your servicer may charge a late fee (~$100). <strong>This will NOT affect your credit</strong> — mortgage lates only report when 30+ days past due.
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {checkedPayments.length > 0 && (
                      <div style={{ marginTop: 4, paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.navy, fontWeight: 700 }}>
                        <span>Payoff balance ({checkedPayments.length} pmt{checkedPayments.length > 1 ? "s" : ""} made)</span>
                        <span style={{ color: COLORS.green }}>{fmt(paymentProjection.projectedBalance)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-draft tip */}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${COLORS.border}`, fontSize: 10, color: COLORS.navy, lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 700 }}>Turn off auto-draft once you start the refi.</span> An unexpected payment after the payoff is ordered can throw off the final payoff figure and cause last-minute delays.
                </div>
              </div>
              );
            })()}
          </div>

          {/* RIGHT — line-item payoff breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(() => {
              const cb = parseFloat(String(curBalance).replace(/,/g,"")) || 0;
              const rate = (parseFloat(curRate) || 0) / 100;
              const projBal = paymentProjection.projectedBalance || cb;
              const balAtFunding = paymentProjection.rows.length > 0 ? paymentProjection.projectedBalance : cb;
              if (!cb || !rate || !lastPaymentDate) return (
                <div style={{ padding: "12px 14px", background: "#f8fafc", border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 11, color: COLORS.gray, fontFamily: font, lineHeight: 1.6 }}>
                  💡 Enter Current Loan Balance, Interest Rate, and last payment date to calculate the estimated payoff.
                </div>
              );
              const dailyAmt = balAtFunding * rate / 365;
              const days = payoffDaysCalc;
              const perDiem = dailyAmt * days;
              const servicerFeeMin = 150;
              const servicerFeeMax = 200;
              const servicerFeeEst = 150;
              // Late fee: funding after 15th AND closing-month payment is unchecked
              const fundingDay = effectiveFundingDate ? parseInt(effectiveFundingDate.split('-')[2]) : 0;
              const closingMonthDate = autoPaymentDates.length > 0 ? autoPaymentDates[autoPaymentDates.length - 1] : null;
              const closingMonthSkipped = closingMonthDate && uncheckedSet.has(closingMonthDate);
              const lateFeeApplies = fundingDay > 15 && closingMonthSkipped;
              const lateFee = lateFeeApplies ? 100 : 0;
              const estimatedPayoff = balAtFunding + perDiem + servicerFeeEst + lateFee;
              const refDate = paymentProjection.effectiveLastPmtDate || lastPaymentDate;
              const fundingFmt = new Date(effectiveFundingDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
                  <Row label={paymentProjection.rows.length > 0 ? `Current balance after ${paymentProjection.rows.length} payment${paymentProjection.rows.length > 1 ? "s" : ""} made before closing` : "Current loan balance"} value={fmt(Math.round(balAtFunding))} />
                  <div style={{ marginBottom: 10 }} />

                  {/* Step 2: Per-diem interest */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.grayLight, letterSpacing: "0.07em", marginBottom: 4, textTransform: "uppercase" }}>Step 2 — Per-Diem Interest Due</div>
                  <Row label={`Daily rate: ${parseFloat(curRate)||0}% ÷ 365 days`} value={`${fmt2(dailyAmt)}/day`} />
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
                    <div style={{ fontSize: 10, color: COLORS.grayLight, marginTop: 5, lineHeight: 1.5 }}>
                      Actual payoff must be ordered directly from your current servicer. This estimate is for planning purposes only. Good-through date on the official payoff will determine final per-diem days.
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3-month balance projection */}
            {(() => {
              const cb = parseFloat(String(curBalance).replace(/,/g, "")) || 0;
              const r  = (parseFloat(curRate) || 0) / 100 / 12;
              const remaining = Math.max(1, (parseFloat(curTermOriginal) || 30) * 12 - monthsPaidCalc);
              if (!cb || !r || !lastPaymentDate) return null;
              const monthlyPmt = window.pmt ? window.pmt(r, remaining, cb) : cb * r / (1 - Math.pow(1 + r, -remaining));
              const lastPmt = new Date(lastPaymentDate + "T12:00:00");
              const rows = [];
              let bal = cb;
              for (let i = 1; i <= 3; i++) {
                const d = new Date(lastPmt.getFullYear(), lastPmt.getMonth() + i, 1);
                const interest = bal * r;
                const principal = monthlyPmt - interest;
                bal = Math.max(0, bal - principal);
                rows.push({ label: (d.getMonth() + 1) + "/" + d.getDate() + "/" + String(d.getFullYear()).slice(2), bal: Math.round(bal) });
              }
              return (
                <div style={{ padding: "8px 10px", background: "#f0f9ff", border: `1px solid ${COLORS.blue}44`, borderRadius: 6, fontSize: 11, fontFamily: font }}>
                  <div style={{ fontWeight: 700, color: COLORS.navy, marginBottom: 5 }}>📅 Estimated balance after next payments:</div>
                  {rows.map(({ label, bal: b }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", color: COLORS.navy, marginBottom: 2 }}>
                      <span style={{ color: COLORS.gray }}>After {label} payment</span>
                      <span style={{ fontWeight: 600 }}>{fmt(b)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

        </div>

    </div>
  );
}

window.RefinanceAnalyzer = RefinanceAnalyzer;

function RefinanceAnalysis({ isInternal }) {
  const todayRA = new Date();
  const defaultLastPmt = todayRA.getFullYear() + "-" + String(todayRA.getMonth() + 1).padStart(2, "0") + "-01";
  const default30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [curBalance]        = useLocalStorage("ra_cb",           "");
  const [curRate]           = useLocalStorage("ra_cr",           "7.25");
  const [curTermOriginal]   = useLocalStorage("ra_cto",          "30");
  const [origLoanAmount]    = useLocalStorage("ra_ola",          "");
  const [noteDate]          = useLocalStorage("ra_notedate",     "2023-03-01");
  const [lastPaymentDate]   = useLocalStorage("ra_lastpmt",      defaultLastPmt);
  const [curPMI]            = useLocalStorage("ra_cpmi",         "185");
  const [curHomeValue]      = useLocalStorage("ra_chv",          "420000");
  const [raState]           = useLocalStorage("ra_state",        "TX");
  const [raOcc]             = useLocalStorage("ra_occ",          "primary");
  const [raCurPI]           = useLocalStorage("ra_curpi",        "");
  const [raNewProg]         = useLocalStorage("ra_newprog",      "conventional");
  const [raNewOcc]          = useLocalStorage("ra_newocc",       "primary");
  const [hasSecondMtg]      = useLocalStorage("ra_has2nd",       false);
  const [secondBalance]     = useLocalStorage("ra_2bal",         "");
  const [secondPI]          = useLocalStorage("ra_2pi",          "");
  const [newRate]           = useLocalStorage("ra_nr",           "6.25");
  const [newTerm]           = useLocalStorage("ra_nt",           "30");
  const [raClosingFees]     = useLocalStorage("fs_cf",           "");
  const [raPrepaids]        = useLocalStorage("fs_tpp",          "");
  const [rollInCosts]       = useLocalStorage("ra_ric",          "all");
  const [rollInAmount]      = useLocalStorage("ra_ria",          "");
  const [principalBuydown]  = useLocalStorage("ra_pbd",          "");
  const [waiveEscrows]      = useLocalStorage("ra_we",           false);
  const [escrowBalance]     = useLocalStorage("ra_escbal",       "");
  const [netEscrows]        = useLocalStorage("ra_netesc",       false);
  const [shortPay]          = useLocalStorage("fs_sp",           false);
  const [newClosingDate]    = useLocalStorage("fs_closing_date", default30);
  const [cashOutEnabled]    = useLocalStorage("ra_coe",          false);
  const [cashOutAmount]     = useLocalStorage("ra_coa",          "0");
  const [ficoScore]         = useLocalStorage("pc_fico",         "740");
  const [taxMode]           = useLocalStorage("pc_taxm",         "rate");
  const [propertyTax]       = useLocalStorage("pc_tax",          "");
  const [propertyTaxRate]   = useLocalStorage("pc_taxr",         "2.3");
  const [insMode]           = useLocalStorage("pc_insm",         "rate");
  const [homeInsurance]     = useLocalStorage("pc_ins",          "");
  const [homeInsuranceRate] = useLocalStorage("pc_insr",         "0.7");
  const [pcLoanAmt]         = useLocalStorage("pc_la",             "");
  const [raEstPayoff]       = useLocalStorage("ra_est_payoff",     "");
  const [fsMcCc]            = useLocalStorage("fs_mc_cc",          "0");
  const [fsMcPrepaids]      = useLocalStorage("fs_mc_prepaids",    "0");
  const [pmtUnchecked]      = useLocalStorage("ra_pmt_unchecked",  "[]");
  const [existingMoEscrow]  = useLocalStorage("pc_exist_esc_mo",   "");
  const [strikeTarget, setStrikeTarget] = useLocalStorage("ra_strike_target", "36");

  const monthsPaidCalc = useMemo(() => {
    if (!noteDate) return 0;
    const nd = new Date(noteDate + "T00:00:00");
    const now = new Date();
    const firstPmtYear = nd.getMonth() + 2 > 11 ? nd.getFullYear() + 1 : nd.getFullYear();
    const firstPmtMonth = (nd.getMonth() + 2) % 12;
    const pmtsMade = (now.getFullYear() - firstPmtYear) * 12 + (now.getMonth() - firstPmtMonth);
    return Math.max(0, pmtsMade);
  }, [noteDate]);

  // ── Correct payoff computation (mirrors RefinanceAnalyzer form logic) ──
  // The form is unmounted when this tab is active, so we replicate here from stored data.
  const displayFundingDate = useMemo(() => {
    const base = newClosingDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    if (!(raState === "TX" && raOcc === "primary")) return base;
    const p = base.split("-");
    let d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    let added = 0;
    while (added < 3) {
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      if (d.getDay() === 0) continue;
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      if (window.isHoliday && window.isHoliday(iso, d.getFullYear())) continue;
      added++;
    }
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, [newClosingDate, raState, raOcc]);

  const displayAutoPayDates = useMemo(() => {
    if (!lastPaymentDate || !displayFundingDate) return [];
    const last = new Date(lastPaymentDate + "T12:00:00");
    const fund = new Date(displayFundingDate + "T12:00:00");
    const dates = [];
    let d = new Date(last.getFullYear(), last.getMonth() + 1, 1);
    while (d < fund) { dates.push(d.toISOString().slice(0, 10)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    return dates;
  }, [lastPaymentDate, displayFundingDate]);

  const displayUncheckedSet = useMemo(() => {
    try { return new Set(JSON.parse(pmtUnchecked)); } catch { return new Set(); }
  }, [pmtUnchecked]);

  const displayProjection = useMemo(() => {
    const cb = parseFloat(String(curBalance).replace(/,/g, "")) || 0;
    const r = (parseFloat(curRate) || 0) / 100 / 12;
    const remaining = Math.max(1, (parseFloat(curTermOriginal) || 30) * 12 - monthsPaidCalc);
    const monthlyPmt = (cb > 0 && r > 0) ? cb * r / (1 - Math.pow(1 + r, -remaining)) : 0;
    const checked = displayAutoPayDates.filter(d => !displayUncheckedSet.has(d));
    let bal = cb, lastPmtDate = lastPaymentDate;
    for (const dateStr of checked) {
      const interest = bal * r;
      bal = Math.max(0, bal - Math.max(0, monthlyPmt - interest));
      lastPmtDate = dateStr;
    }
    return { projectedBalance: Math.round(bal), effectiveLastPmtDate: lastPmtDate, checkedCount: checked.length };
  }, [curBalance, curRate, curTermOriginal, monthsPaidCalc, displayAutoPayDates, displayUncheckedSet, lastPaymentDate]);

  const displayPayoffDays = useMemo(() => {
    const payoffDate = displayFundingDate
      ? new Date(displayFundingDate + "T00:00:00")
      : (() => { const d = new Date(); d.setDate(d.getDate() + 33); return d; })();
    const refDate = displayProjection.effectiveLastPmtDate || lastPaymentDate;
    if (refDate) {
      const lp = new Date(refDate + "T00:00:00");
      const days = Math.ceil((payoffDate.getTime() - lp.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) return days;
    }
    return payoffDate.getDate();
  }, [displayProjection.effectiveLastPmtDate, lastPaymentDate, displayFundingDate]);

  const displayPayoff = useMemo(() => {
    const projBal = displayProjection.projectedBalance;
    const dailyRate = (parseFloat(curRate) || 0) / 100 / 365;
    const perDiem = projBal * dailyRate * displayPayoffDays;
    const fundingDay = displayFundingDate ? parseInt(displayFundingDate.split("-")[2]) : 0;
    const closingMo = displayAutoPayDates.length > 0 ? displayAutoPayDates[displayAutoPayDates.length - 1] : null;
    const lateFee = fundingDay > 15 && closingMo && displayUncheckedSet.has(closingMo) ? 100 : 0;
    return Math.round(projBal + perDiem + 150 + lateFee);
  }, [displayProjection, displayPayoffDays, curRate, displayFundingDate, displayAutoPayDates, displayUncheckedSet]);

  const payoffDaysCalc = useMemo(() => {
    const payoffDate = newClosingDate
      ? new Date(newClosingDate + "T00:00:00")
      : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();
    if (lastPaymentDate) {
      const lp = new Date(lastPaymentDate + "T00:00:00");
      const days = Math.ceil((payoffDate.getTime() - lp.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) return days;
    }
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
    const cf = parseFloat(raClosingFees) || 0;
    const co = parseFloat(cashOutAmount) || 0;
    const ola = parseFloat(origLoanAmount) || 0;
    let estimatedBalance = 0;
    let origPI = 0;
    if (ola > 0 && cr > 0 && cTermOrig > 0) {
      origPI = pmt(cr, cTermOrig, ola);
      let bal = ola;
      for (let m = 0; m < cPaid; m++) {
        const interest = bal * cr;
        const princ = origPI - interest;
        bal = Math.max(0, bal - princ);
      }
      estimatedBalance = bal;
    }
    const dailyInterest = cb * crAnnual / 365;
    const perDiemDays = payoffDaysCalc;
    const payoffFee = 150;
    const escBal = parseFloat(escrowBalance) || 0;
    const escrowCredit = netEscrows ? escBal : 0;
    const closingDay = newClosingDate ? parseInt(newClosingDate.split('-')[2]) : 0;
    const isShortPay = shortPay && closingDay >= 1 && closingDay <= 5;
    const perDiemAmount = isShortPay ? -(dailyInterest * perDiemDays) : (dailyInterest * perDiemDays);
    const estimatedPayoff = cb + perDiemAmount + payoffFee - escrowCredit;
    const balanceDiff = estimatedBalance - cb;
    const extraPaymentObservation = (ola > 0 && estimatedBalance > 0 && balanceDiff > 500)
      ? { detected: true, amount: balanceDiff, message: "It appears approximately " + fmt(balanceDiff) + " in extra principal payments have been made. Great job! The stated balance is lower than expected based on the original amortization schedule." }
      : { detected: false, amount: 0, message: "" };
    const s2bal = parseFloat(secondBalance) || 0;
    const s2pi = parseFloat(secondPI) || 0;
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
  }, [curBalance, curRate, curTermOriginal, monthsPaidCalc, origLoanAmount, curPMI, curHomeValue, taxMode, propertyTaxRate, propertyTax, raState, raOcc, insMode, homeInsuranceRate, homeInsurance, escrowBalance, netEscrows, raCurPI, newRate, newTerm, raClosingFees, raPrepaids, rollInCosts, rollInAmount, principalBuydown, waiveEscrows, newClosingDate, ficoScore, raNewOcc, raNewProg, cashOutEnabled, cashOutAmount, payoffDaysCalc, secondBalance, secondPI, shortPay]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const targetPI = (curPI + cPmiMonthly) - nPmiMonthly - (closingFeesOnly / targetMonths);
      if (targetPI <= 0) return 0.001;
      if (pmtAt(0.001) > targetPI) return null;
      if (pmtAt(maxPct) <= targetPI) return maxPct;
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

  const REFI_AMBER = "#B86B00";
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

  if (!hasNewLoanData) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", fontFamily: font }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.navy, marginBottom: 10 }}>Analysis Not Yet Available</div>
        <div style={{ fontSize: 13, color: COLORS.gray, lineHeight: 1.7, maxWidth: 460, margin: "0 auto", marginBottom: 20 }}>
          Complete the current loan details and proposed loan fields in the <strong>Refi: Existing Loan</strong> tab,
          and verify the <strong>Payment Calculator</strong> is configured, to see the full refinance analysis here.
        </div>
        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: COLORS.bgAlt, border: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.navy, fontFamily: font }}>
            1. Fill in <strong>Refi: Existing Loan</strong>
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: COLORS.bgAlt, border: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.navy, fontFamily: font }}>
            2. Enter proposed rate &amp; term
          </div>
          <div style={{ padding: "10px 18px", borderRadius: 8, background: COLORS.bgAlt, border: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.navy, fontFamily: font }}>
            3. Return here for the analysis
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Verdict banner ── */}
      <div style={{ padding: "22px 24px", borderRadius: 12, color: "#fff", marginBottom: 18, background: rec.color === COLORS.green ? `linear-gradient(135deg, #1A9E5A, #22A06B)` : rec.color === REFI_AMBER ? `linear-gradient(135deg, #B86B00, #9A5900)` : `linear-gradient(135deg, #C0392B, #E74C3C)`, boxShadow: rec.color === COLORS.green ? "0 4px 18px rgba(26,158,90,0.35)" : rec.color === REFI_AMBER ? "0 4px 18px rgba(184,107,0,0.35)" : "0 4px 14px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 10, fontFamily: font }}>{rec.verdict}</div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, opacity: 0.95, lineHeight: 1.85, fontFamily: font, marginBottom: rec.color === COLORS.green ? 14 : 0 }}>
          <li>{rec.reason}</li>
          {rec.color === COLORS.green && analysis.fiveYearSavings > 0 && <li>{fmt(analysis.fiveYearSavings)} in 5-year savings (avg. {fmt(analysis.fiveYearSavings / 5)}/year)</li>}
          {rec.color === COLORS.green && analysis.curTotalPayment > 0 && analysis.newTotalPayment > 0 && <li>Monthly cash flow improvement: {fmt2(analysis.curTotalPayment - analysis.newTotalPayment)}/mo ({fmt2(analysis.curTotalPayment)} → {fmt2(analysis.newTotalPayment)})</li>}
        </ul>
        {rec.color === COLORS.green && <a href="https://www.MortgageMark.com/Apply" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 28px", background: "rgba(255,255,255,0.22)", color: "#fff", fontWeight: 700, fontSize: 15, borderRadius: 8, textDecoration: "none", fontFamily: font, border: "2px solid rgba(255,255,255,0.5)", cursor: "pointer", letterSpacing: "0.03em", transition: "background 0.2s" }} onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.35)"} onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.22)"}>Start Saving: Apply Now →</a>}
      </div>

      {/* ── Payment Comparison ── */}
      {(() => {
        const escrow = analysis.effectiveWaiveEscrows ? 0 : (analysis.monthlyTax + analysis.monthlyIns);
        const curTotal = analysis.curPI + analysis.cPmiMonthly + analysis.monthlyTax + analysis.monthlyIns + analysis.secondPI;
        const curBal = parseFloat(curBalance) || 0;
        const pcLA = parseFloat(pcLoanAmt) || 0;

        // Recompute new P&I from the Payment Calc loan amount so it matches exactly
        const nr0 = parseFloat(newRate) / 100 / 12;
        const nm0 = parseInt(newTerm) * 12;
        const pcNewPI = nr0 > 0 && nm0 > 0 && pcLA > 0
          ? pcLA * nr0 / (1 - Math.pow(1 + nr0, -nm0))
          : analysis.newPI;

        const newTotal = pcNewPI + analysis.nPmiMonthly + escrow;
        const totalDiff = newTotal - curTotal;

        const rows = [
          { label: "Principal & Interest", cur: analysis.curPI, nw: pcNewPI },
          ...(analysis.cPmiMonthly > 0 || analysis.nPmiMonthly > 0 ? [{ label: "Mortgage Insurance", cur: analysis.cPmiMonthly, nw: analysis.nPmiMonthly }] : []),
          { label: "Property Taxes", cur: analysis.monthlyTax, nw: analysis.effectiveWaiveEscrows ? 0 : analysis.monthlyTax, waivedNote: analysis.effectiveWaiveEscrows },
          { label: "Home Insurance", cur: analysis.monthlyIns, nw: analysis.effectiveWaiveEscrows ? 0 : analysis.monthlyIns, waivedNote: analysis.effectiveWaiveEscrows },
          ...(analysis.secondPI > 0 ? [{ label: "2nd Mortgage P&I", cur: analysis.secondPI, nw: 0, paidOff: true }] : []),
        ];

        const DiffCell = ({ cur, nw, paidOff, isTotal, isDollar }) => {
          if (paidOff) return <div style={{ padding: isTotal ? "12px 14px" : "9px 14px", textAlign: "right", fontFamily: font }}><span style={{ fontSize: 11, fontWeight: 700, color: isTotal ? "#86efac" : COLORS.green }}>✓ paid off</span></div>;
          const d = nw - cur;
          if (Math.abs(d) < 0.5) return <div style={{ padding: isTotal ? "12px 14px" : "9px 14px", textAlign: "right", fontFamily: font }}><span style={{ fontSize: 11, color: isTotal ? "rgba(255,255,255,0.3)" : COLORS.grayLight }}>—</span></div>;
          const color = d < 0 ? (isTotal ? "#86efac" : COLORS.green) : (isTotal ? "#fca5a5" : COLORS.red);
          const prefix = d > 0 ? "+" : "";
          const val = isDollar ? `${prefix}${fmt(Math.round(d))}` : `${prefix}${fmt2(d)}/mo`;
          return <div style={{ padding: isTotal ? "12px 14px" : "9px 14px", textAlign: "right", fontFamily: font }}><span style={{ fontSize: isTotal ? 14 : 12, fontWeight: 700, color }}>{val}</span></div>;
        };

        const cols = "1.6fr 1fr 1fr 1fr";

        return (
          <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            {/* LEFT — Payment comparison table */}
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: cols, background: COLORS.navy }}>
                <div style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: font }} />
                <div style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: font, textAlign: "right" }}>Current</div>
                <div style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#7dd3fc", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: font, textAlign: "right" }}>New</div>
                <div style={{ padding: "10px 14px", fontSize: 10, fontWeight: 700, color: "#86efac", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: font, textAlign: "right" }}>Difference</div>
              </div>
              {/* Rate / term info row */}
              <div style={{ display: "grid", gridTemplateColumns: cols, background: `${COLORS.navy}12`, borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ padding: "7px 14px", fontSize: 10, color: COLORS.gray, fontFamily: font }}>Rate &amp; Term</div>
                <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 600, color: COLORS.navy, fontFamily: font, textAlign: "right" }}>{parseFloat(curRate).toFixed(3)}% · {Math.round(analysis.cRemaining / 12)}yr</div>
                <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 600, color: COLORS.blue, fontFamily: font, textAlign: "right" }}>{parseFloat(newRate).toFixed(3)}% · {newTerm}yr</div>
                <div style={{ padding: "7px 14px", fontSize: 10, color: COLORS.grayLight, fontFamily: font, textAlign: "right" }}>APR {analysis.apr > 0 ? analysis.apr.toFixed(3) + "%" : "—"}</div>
              </div>
              {/* Balance row */}
              <div style={{ display: "grid", gridTemplateColumns: cols, background: COLORS.bgAlt, borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ padding: "7px 14px", fontSize: 10, color: COLORS.gray, fontFamily: font }}>Loan Balance <span style={{ fontSize: 9, color: COLORS.grayLight }}>LTV {analysis.newLTV.toFixed(1)}%</span></div>
                <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 600, color: COLORS.navy, fontFamily: font, textAlign: "right" }}>{fmt(curBal)}</div>
                <div style={{ padding: "7px 14px", fontSize: 10, fontWeight: 600, color: COLORS.navy, fontFamily: font, textAlign: "right" }}>{fmt(Math.round(pcLA))}</div>
                <DiffCell cur={curBal} nw={pcLA} isDollar />
              </div>
              {/* Payment rows */}
              {rows.map(({ label, cur, nw, paidOff, waivedNote }, i) => (
                <div key={label} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "#fff" : COLORS.bgAlt }}>
                  <div style={{ padding: "9px 14px", fontSize: 12, fontWeight: 400, color: COLORS.gray, fontFamily: font }}>{label}{waivedNote ? <span style={{ fontSize: 9, color: COLORS.blue, marginLeft: 6, fontWeight: 700 }}>(waived)</span> : null}</div>
                  <div style={{ padding: "9px 14px", fontSize: 12, fontWeight: 600, color: COLORS.navy, fontFamily: font, textAlign: "right" }}>{fmt2(cur)}<span style={{ fontSize: 10, fontWeight: 400, color: COLORS.grayLight }}>/mo</span></div>
                  <div style={{ padding: "9px 14px", fontSize: 12, fontWeight: 600, color: COLORS.navy, fontFamily: font, textAlign: "right" }}>
                    {paidOff ? <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.green }}>—</span> : <>{fmt2(nw)}<span style={{ fontSize: 10, fontWeight: 400, color: COLORS.grayLight }}>/mo</span></>}
                  </div>
                  <DiffCell cur={cur} nw={nw} paidOff={paidOff} />
                </div>
              ))}
              {/* Total row */}
              <div style={{ display: "grid", gridTemplateColumns: cols, background: COLORS.navy }}>
                <div style={{ padding: "12px 14px", fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: font }}>TOTAL / MONTH</div>
                <div style={{ padding: "12px 14px", fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: font, textAlign: "right" }}>{fmt2(curTotal)}</div>
                <div style={{ padding: "12px 14px", fontSize: 15, fontWeight: 800, color: totalDiff < 0 ? "#86efac" : "#fca5a5", fontFamily: font, textAlign: "right" }}>{fmt2(newTotal)}</div>
                <DiffCell cur={curTotal} nw={newTotal} isTotal />
              </div>
            </div>

            {/* RIGHT — Closing cost summary (vertical) */}
            {(() => {
              const sumLA     = parseFloat(pcLoanAmt)       || 0;
              const sumPayoff = (parseFloat(raEstPayoff) > 0 ? parseFloat(raEstPayoff) : null) || displayPayoff;
              const sumFees   = parseInt(fsMcCc)          || 0;
              const sumPre    = parseInt(fsMcPrepaids)    || 0;
              const sumNet    = sumLA - sumPayoff - sumFees - sumPre;
              // sumNet > 0 → cash back; sumNet < 0 → cash to close
              const isCashBack = sumNet > 0;
              const ctcAmt = Math.abs(Math.round(sumNet));
              const rolledIn = analysis.rolledIn || 0;
              return (
                <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                  {/* Header */}
                  <div style={{ background: COLORS.navy, padding: "10px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: font }}>Closing Summary</div>
                  </div>
                  {/* Rows */}
                  {[
                    { label: "Loan Amount",        val: fmt(sumLA),      sub: false },
                    { label: "Estimated Payoff",   val: fmt(sumPayoff),  sub: true },
                    { label: "Closing Costs",      val: fmt(sumFees),    sub: true },
                    { label: "Prepaids & Reserves",val: fmt(sumPre),     sub: true },
                  ].map(({ label, val, sub }, i) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? "#fff" : COLORS.bgAlt }}>
                      <span style={{ fontSize: 12, color: sub ? COLORS.gray : COLORS.navy, fontFamily: font, fontWeight: sub ? 400 : 600 }}>{sub ? "− " : ""}{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: sub ? COLORS.navy : COLORS.blue, fontFamily: font }}>{sub ? `(${val})` : val}</span>
                    </div>
                  ))}
                  {/* Cash to Close / Cash Back */}
                  <div style={{ padding: "14px 16px", background: isCashBack ? `${COLORS.green}12` : `${COLORS.gold}15`, borderTop: `2px solid ${isCashBack ? COLORS.green : COLORS.gold}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.navy, fontFamily: font }}>{isCashBack ? "Cash Back at Closing" : "Cash to Close"}</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: isCashBack ? COLORS.green : COLORS.gold, fontFamily: font }}>{fmt(ctcAmt)}</span>
                  </div>
                  {/* Footer notes */}
                  <div style={{ padding: "10px 16px", background: COLORS.bgAlt, borderTop: `1px solid ${COLORS.border}` }}>
                    {rolledIn > 0 && (
                      <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginBottom: analysis.firstPaymentDate instanceof Date ? 4 : 0 }}>
                        <span style={{ fontWeight: 700, color: COLORS.navy }}>{fmt(Math.round(rolledIn))}</span> rolled into new loan
                      </div>
                    )}
                    {analysis.firstPaymentDate instanceof Date && (
                      <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font }}>
                        First payment: <strong style={{ color: COLORS.navy }}>{analysis.firstPaymentDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      <div>
          {/* Row 1 — headline metrics */}
          <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {analysis.cashOut > 0 ? (
              <div style={{ background: COLORS.white, borderRadius: 12, padding: "20px 18px", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.gray, marginBottom: 6, fontFamily: font }}>TRUE BREAK-EVEN</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b", fontFamily: font, lineHeight: 1.1 }}>N/A</div>
                <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 4, fontFamily: font }}>Cash-out refis don't have a true break-even. Call us to check the math!</div>
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
      {(() => {
        const cashFlow = analysis.curTotalPayment - analysis.newTotalPayment;
        const naiveBreakEven = cashFlow > 0 ? Math.ceil(analysis.closingFeesOnly / cashFlow) : null;
        return (
        <div>
          <SectionCard title="THE WRONG WAY — CASH FLOW METHOD" accent={COLORS.red}>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font, marginBottom: 12 }}>
              <strong>This is how most people (and many loan officers) calculate break-even.</strong> They take total closing costs and divide by the monthly payment difference. It's simple, intuitive — and deeply misleading.
            </div>
            <div style={{ background: COLORS.bgAlt, borderRadius: 10, padding: 16, border: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
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

            {/* Why it's wrong — expanded */}
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.8, fontFamily: font, marginBottom: 10 }}>
              <strong>Why this is wrong — the payment drop doesn't tell the whole story.</strong>
            </div>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.8, fontFamily: font, marginBottom: 10 }}>
              Your monthly payment is split into two very different buckets: <strong>principal</strong> (money that builds equity — yours to keep) and <strong>interest</strong> (money paid to the lender — gone forever). The cash flow method adds them together and treats both the same. That's the mistake.
            </div>

            {/* Refi-at-year-11 callout box */}
            <div style={{ background: "#fff7ed", borderRadius: 8, padding: "12px 14px", border: "1px solid #fed7aa", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 6, fontFamily: font, letterSpacing: "0.04em" }}>⚠ REAL-WORLD EXAMPLE: THE "LOWER PAYMENT" TRAP</div>
              <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.75, fontFamily: font }}>
                Imagine someone is <strong>11 years into a 30-year mortgage</strong>. They refinance into a new 30-year loan at a slightly lower rate. Their monthly payment drops — and the cash flow method says "great, break even in 18 months." But here's what it misses: they just reset the clock on 19 years of remaining payments back to 30. They're now paying interest on a full new amortization schedule, heavily front-loaded with interest all over again. In many cases, <strong>they'll pay tens of thousands more in total interest</strong> over the life of the new loan — even though the monthly payment went down.
              </div>
            </div>

            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.8, fontFamily: font, marginBottom: 10 }}>
              <strong>Lower payment ≠ saving money.</strong> Cash flow and interest cost are two different things. A refinance can improve your monthly cash flow while simultaneously costing you more money over time. Both can be true at once.
            </div>
            <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.8, fontFamily: font }}>
              <strong>That doesn't mean cash flow is the wrong priority</strong> — sometimes freeing up monthly cash is exactly the right move. But that's a <em>lifestyle decision</em>, not a statement about financial efficiency. Don't let a lower payment fool you into thinking you're saving money if the interest cost tells a different story.
            </div>
          </SectionCard>
          {(() => {
            const hasMI = analysis.cPmiMonthly > 0 || analysis.nPmiMonthly > 0;
            const yearData = [1, 2, 3, 4, 5].map(yr => {
              const mo = yr * 12;
              const curSlice = analysis.curSchedule.slice((yr - 1) * 12, mo);
              const newSlice = analysis.newSchedule.slice((yr - 1) * 12, mo);
              const curInterest = curSlice.reduce((s, r) => s + r.interest, 0);
              const newInterest = newSlice.reduce((s, r) => s + r.interest, 0);
              const curMI = analysis.cPmiMonthly * 12;
              const newMI = analysis.nPmiMonthly * 12;
              return { yr, curInterest, curMI, curTotal: curInterest + curMI, newInterest, newMI, newTotal: newInterest + newMI };
            });
            const totalCurInterest5 = yearData.reduce((s, d) => s + d.curInterest, 0);
            const totalNewInterest5 = yearData.reduce((s, d) => s + d.newInterest, 0);
            const totalCurMI5 = analysis.cPmiMonthly * 60;
            const totalNewMI5 = analysis.nPmiMonthly * 60;
            const totalCur5 = totalCurInterest5 + totalCurMI5;
            const totalNew5 = totalNewInterest5 + totalNewMI5;
            const totalSavings5 = totalCur5 - totalNew5;
            const avgAnnualSavings = totalSavings5 / 5;
            const closingCosts = analysis.closingFeesOnly;
            const breakEvenYrs = avgAnnualSavings > 0 ? closingCosts / avgAnnualSavings : null;
            const thS = { padding: "7px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: font };
            const tdS = (align) => ({ padding: "8px 10px", textAlign: align || "right", fontSize: 12, fontFamily: font });
            return (
              <SectionCard title="THE RIGHT WAY — 5-YEAR INTEREST & MI BREAKDOWN" accent={COLORS.green}>
                {/* Context notes — moved from the old "Right Way" section */}
                <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font, marginBottom: 12 }}>
                  <strong>We compare the actual cost of money — interest and MI — not the payment.</strong> Instead of dividing the payment difference into closing costs, we measure what you'll actually spend in interest and mortgage insurance on each loan, year by year. The savings on those real costs are what recoup your closing fees — and that's what tells you the true break-even.
                </div>
                <div style={{ background: COLORS.blueLight, borderRadius: 8, padding: "12px 14px", border: `1px solid ${COLORS.blue}`, marginBottom: 14, fontSize: 12, color: COLORS.navy, lineHeight: 1.7, fontFamily: font }}>
                  <strong>Why we use closing fees only — not total closing costs:</strong> Your closing costs include two buckets. <em>Closing fees</em> (lender fees, title, third-party charges) are the true cost of getting the new loan — money you only spend if you refinance. <em>Prepaids</em> (prepaid interest, escrow reserves) are paid regardless — your existing escrow gets refunded and the new one gets pre-funded. Including prepaids in break-even makes every refi look harder to justify than it actually is. We use closing fees only.
                </div>
                <div style={{ fontSize: 13, color: COLORS.navy, lineHeight: 1.7, fontFamily: font, marginBottom: 16 }}>
                  How much interest{analysis.cPmiMonthly > 0 || analysis.nPmiMonthly > 0 ? " and MI" : ""} will each loan cost you over the next five years? Here it is, broken down by year — then averaged to calculate the true break-even.
                </div>
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
                    <thead>
                      <tr style={{ background: COLORS.navy }}>
                        <th style={{ ...thS, color: "rgba(255,255,255,0.45)", textAlign: "left", width: 52 }}></th>
                        <th colSpan={hasMI ? 3 : 2} style={{ ...thS, color: "#93c5fd", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.15)" }}>Current Loan</th>
                        <th colSpan={hasMI ? 3 : 2} style={{ ...thS, color: "#86efac", textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.15)" }}>New Loan</th>
                        <th style={{ ...thS, color: "#fcd34d", textAlign: "right" }}>Savings</th>
                      </tr>
                      <tr style={{ background: `${COLORS.navy}e0`, borderBottom: `2px solid ${COLORS.navy}` }}>
                        <th style={{ ...thS, color: "rgba(255,255,255,0.4)", textAlign: "left" }}>Year</th>
                        <th style={{ ...thS, color: "#93c5fd", textAlign: "right" }}>Interest</th>
                        {hasMI && <th style={{ ...thS, color: "#93c5fd", textAlign: "right" }}>MI</th>}
                        <th style={{ ...thS, color: "#93c5fd", textAlign: "right", borderRight: `1px solid ${COLORS.border}` }}>Total</th>
                        <th style={{ ...thS, color: "#86efac", textAlign: "right" }}>Interest</th>
                        {hasMI && <th style={{ ...thS, color: "#86efac", textAlign: "right" }}>MI</th>}
                        <th style={{ ...thS, color: "#86efac", textAlign: "right", borderRight: `1px solid ${COLORS.border}` }}>Total</th>
                        <th style={{ ...thS, color: "#fcd34d", textAlign: "right" }}>This Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearData.map(({ yr, curInterest, curMI, curTotal, newInterest, newMI, newTotal }) => {
                        const sav = curTotal - newTotal;
                        return (
                          <tr key={yr} style={{ borderBottom: `1px solid ${COLORS.border}`, background: yr % 2 === 0 ? COLORS.bgAlt : COLORS.white }}>
                            <td style={{ ...tdS("left"), fontWeight: 700, color: COLORS.navy }}>Yr {yr}</td>
                            <td style={tdS()}>{fmt(Math.round(curInterest))}</td>
                            {hasMI && <td style={{ ...tdS(), color: curMI > 0 ? COLORS.navy : COLORS.grayLight }}>{curMI > 0 ? fmt(curMI) : "—"}</td>}
                            <td style={{ ...tdS(), fontWeight: 600, borderRight: `1px solid ${COLORS.border}` }}>{fmt(Math.round(curTotal))}</td>
                            <td style={{ ...tdS(), color: COLORS.blue }}>{fmt(Math.round(newInterest))}</td>
                            {hasMI && <td style={{ ...tdS(), color: newMI > 0 ? COLORS.blue : COLORS.grayLight }}>{newMI > 0 ? fmt(newMI) : "—"}</td>}
                            <td style={{ ...tdS(), fontWeight: 600, color: COLORS.blue, borderRight: `1px solid ${COLORS.border}` }}>{fmt(Math.round(newTotal))}</td>
                            <td style={{ ...tdS(), fontWeight: 700, color: sav >= 0 ? COLORS.green : COLORS.red }}>{sav >= 0 ? "" : "−"}{fmt(Math.abs(Math.round(sav)))}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ borderTop: `2px solid ${COLORS.navy}`, background: COLORS.navy }}>
                        <td style={{ ...tdS("left"), fontWeight: 800, color: "#fff" }}>5-Yr Total</td>
                        <td style={{ ...tdS(), fontWeight: 700, color: "#93c5fd" }}>{fmt(Math.round(totalCurInterest5))}</td>
                        {hasMI && <td style={{ ...tdS(), fontWeight: 700, color: "#93c5fd" }}>{totalCurMI5 > 0 ? fmt(totalCurMI5) : "—"}</td>}
                        <td style={{ ...tdS(), fontWeight: 800, color: "#93c5fd", borderRight: "1px solid rgba(255,255,255,0.15)" }}>{fmt(Math.round(totalCur5))}</td>
                        <td style={{ ...tdS(), fontWeight: 700, color: "#86efac" }}>{fmt(Math.round(totalNewInterest5))}</td>
                        {hasMI && <td style={{ ...tdS(), fontWeight: 700, color: "#86efac" }}>{totalNewMI5 > 0 ? fmt(totalNewMI5) : "—"}</td>}
                        <td style={{ ...tdS(), fontWeight: 800, color: "#86efac", borderRight: "1px solid rgba(255,255,255,0.15)" }}>{fmt(Math.round(totalNew5))}</td>
                        <td style={{ ...tdS(), fontWeight: 800, color: "#fcd34d" }}>{fmt(Math.round(totalSavings5))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Equity built section */}
                {(() => {
                  const equityRows = [1, 2, 3, 4, 5].map(yr => {
                    const curSlice = analysis.curSchedule.slice((yr - 1) * 12, yr * 12);
                    const newSlice = analysis.newSchedule.slice((yr - 1) * 12, yr * 12);
                    const curEquity = curSlice.reduce((s, r) => s + r.principal, 0);
                    const newEquity = newSlice.reduce((s, r) => s + r.principal, 0);
                    return { yr, curEquity, newEquity, diff: newEquity - curEquity };
                  });
                  const totalCurEq = equityRows.reduce((s, r) => s + r.curEquity, 0);
                  const totalNewEq = equityRows.reduce((s, r) => s + r.newEquity, 0);
                  const totalEqDiff = totalNewEq - totalCurEq;
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, fontFamily: font }}>Equity Built (Principal Paid)</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
                        <thead>
                          <tr style={{ background: COLORS.bgAlt, borderBottom: `2px solid ${COLORS.navy}` }}>
                            <th style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: COLORS.gray, textAlign: "left", fontFamily: font }}>Year</th>
                            <th style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: COLORS.navy, textAlign: "right", fontFamily: font }}>Current Loan</th>
                            <th style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: COLORS.blue, textAlign: "right", fontFamily: font }}>New Loan</th>
                            <th style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: COLORS.green, textAlign: "right", fontFamily: font }}>Extra Equity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equityRows.map(({ yr, curEquity, newEquity, diff }) => (
                            <tr key={yr} style={{ borderBottom: `1px solid ${COLORS.border}`, background: yr % 2 === 0 ? COLORS.bgAlt : COLORS.white }}>
                              <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 600, color: COLORS.navy, fontFamily: font }}>Yr {yr}</td>
                              <td style={{ padding: "7px 10px", fontSize: 12, textAlign: "right", color: COLORS.navy, fontFamily: font }}>{fmt(Math.round(curEquity))}</td>
                              <td style={{ padding: "7px 10px", fontSize: 12, textAlign: "right", color: COLORS.blue, fontFamily: font }}>{fmt(Math.round(newEquity))}</td>
                              <td style={{ padding: "7px 10px", fontSize: 12, textAlign: "right", fontWeight: 700, color: diff >= 0 ? COLORS.green : COLORS.red, fontFamily: font }}>{diff >= 0 ? "+" : "−"}{fmt(Math.abs(Math.round(diff)))}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: `2px solid ${COLORS.navy}`, background: COLORS.navy }}>
                            <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 800, color: "#fff", fontFamily: font }}>5-Yr Total</td>
                            <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700, textAlign: "right", color: "#93c5fd", fontFamily: font }}>{fmt(Math.round(totalCurEq))}</td>
                            <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700, textAlign: "right", color: "#86efac", fontFamily: font }}>{fmt(Math.round(totalNewEq))}</td>
                            <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 800, textAlign: "right", color: totalEqDiff >= 0 ? "#fcd34d" : "#fca5a5", fontFamily: font }}>{totalEqDiff >= 0 ? "+" : "−"}{fmt(Math.abs(Math.round(totalEqDiff)))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Summary / break-even */}
                <div style={{ background: avgAnnualSavings > 0 ? `${COLORS.green}0d` : `${COLORS.red}0d`, borderRadius: 10, padding: "4px 0", border: `1px solid ${avgAnnualSavings > 0 ? COLORS.green + "33" : COLORS.red + "33"}` }}>
                  {[
                    { label: "5-year total cost savings (interest + MI)", val: fmt(Math.round(totalSavings5)), color: avgAnnualSavings > 0 ? COLORS.green : COLORS.red },
                    { label: "Average annual savings  (÷ 5 years)", val: `${fmt(Math.round(avgAnnualSavings))}/yr`, color: avgAnnualSavings > 0 ? COLORS.green : COLORS.red },
                    { label: "Closing fees to recoup (excl. prepaids)", val: fmt(Math.round(closingCosts)), color: COLORS.navy },
                  ].map(({ label, val, color }, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                      <span style={{ fontSize: 13, color: COLORS.gray, fontFamily: font }}>{label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: font }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderTop: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.03)", borderRadius: "0 0 10px 10px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
                      {fmt(Math.round(closingCosts))} ÷ {fmt(Math.round(avgAnnualSavings))}/yr =
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 800, fontFamily: font, color: breakEvenYrs ? (breakEvenYrs <= 3 ? COLORS.green : breakEvenYrs <= 5 ? "#b45309" : COLORS.red) : COLORS.red }}>
                      {breakEvenYrs ? `${breakEvenYrs.toFixed(1)} years` : "N/A"}
                    </span>
                  </div>
                </div>
              </SectionCard>
            );
          })()}

        </div>
        );
      })()}
      {/* ── Alternative Paths — Make it Work ─────────────────────────────── */}
      {rec.color !== COLORS.green && analysis.curPI > 0 && analysis.newLoanAmt > 0 && (() => {
        const nr = parseFloat(newRate) || 0;
        const cf = analysis.closingFeesOnly;
        const tgt = Math.max(1, Math.min(120, parseInt(strikeTarget) || 36));
        const curBaseline = analysis.curPI + analysis.cPmiMonthly + analysis.secondPI;
        const altPMI = analysis.nPmiMonthly;

        const pmtCalc = (annualRate, termMonths, loanAmt) => {
          const r = annualRate / 100 / 12;
          if (r <= 0 || termMonths <= 0) return loanAmt;
          return loanAmt * r / (1 - Math.pow(1 + r, -termMonths));
        };

        const alt26PI = pmtCalc(nr, 26 * 12, analysis.newLoanAmt);
        const alt26Sav = curBaseline - (alt26PI + altPMI);

        const rate20 = Math.max(0.1, nr - 0.25);
        const alt20PI = pmtCalc(rate20, 20 * 12, analysis.newLoanAmt);
        const alt20Sav = curBaseline - (alt20PI + altPMI);

        const rate15 = Math.max(0.1, nr - 0.50);
        const alt15PI = pmtCalc(rate15, 15 * 12, analysis.newLoanAmt);
        const alt15Sav = curBaseline - (alt15PI + altPMI);

        const neededSavings = cf > 0 ? cf / tgt : 0;
        const targetPI = curBaseline - altPMI - neededSavings;
        const r0 = nr / 100 / 12;
        const n0 = analysis.nTermMonths;
        const factor0 = r0 > 0 ? (1 - Math.pow(1 + r0, -n0)) / r0 : n0;
        const targetLA = factor0 > 0 && targetPI > 0 ? targetPI * factor0 : 0;
        const paydownAmount = Math.max(0, Math.round(analysis.newLoanAmt - targetLA));
        const pdLoanAmt = analysis.newLoanAmt - paydownAmount;
        const pdPI = paydownAmount > 0 ? pmtCalc(nr, n0, pdLoanAmt) : 0;
        const pdSav = paydownAmount > 0 ? curBaseline - (pdPI + altPMI) : 0;

        // Interest-cost break-even: closing fees ÷ avg annual interest savings vs proposed 30yr
        // Baseline is the 30yr refi schedule so alts with lower rates/shorter terms always rank better
        const baseInterest5yr = analysis.newSchedule.slice(0, 60).reduce((s, r) => s + r.interest, 0);
        const interestBE = (altRate, altTermMonths, altPI) => {
          if (cf <= 0 || analysis.newLoanAmt <= 0) return null;
          const altSched = buildAmortization(analysis.newLoanAmt, altRate / 100 / 12, altTermMonths, altPI);
          const altInterest5yr = altSched.slice(0, 60).reduce((s, r) => s + r.interest, 0);
          const annualSavings = (baseInterest5yr - altInterest5yr) / 5;
          if (annualSavings <= 0) return null;
          return Math.ceil(cf / annualSavings * 12);
        };

        const beColor = (be) => {
          if (!be) return COLORS.red;
          if (be <= tgt) return COLORS.green;
          if (be <= 60) return REFI_AMBER;
          return COLORS.red;
        };

        const scenarios = [
          { label: "26-Year Note", rateLabel: `${nr.toFixed(3)}%`, termLabel: "26 yr", pi: alt26PI, savings: alt26Sav, be: interestBE(nr, 26 * 12, alt26PI), note: "Same rate, shorter term — preserves payoff date if ~26 years remain on current loan." },
          { label: "20-Year Note", rateLabel: `${rate20.toFixed(3)}% (est.)`, termLabel: "20 yr", pi: alt20PI, savings: alt20Sav, be: interestBE(rate20, 20 * 12, alt20PI), note: "20-year rates typically ~0.25% below 30-year. Builds equity faster." },
          { label: "15-Year Note", rateLabel: `${rate15.toFixed(3)}% (est.)`, termLabel: "15 yr", pi: alt15PI, savings: alt15Sav, be: interestBE(rate15, 15 * 12, alt15PI), note: "15-year rates typically ~0.50% below 30-year. Lowest total interest cost." },
        ];

        const hasAnyWorking = scenarios.some(s => s.be && s.be <= tgt) || (paydownAmount > 0 && pdSav > 0);

        return (
          <SectionCard title="💡 ALTERNATIVE PATHS — HOW TO MAKE THIS WORK" accent={COLORS.blue}>
            <div style={{ fontSize: 12, color: COLORS.navy, fontFamily: font, lineHeight: 1.65, marginBottom: 16 }}>
              Here are some alternative loan structures to explore. Each approaches the numbers differently — consider which best fits your goals.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 16 }}>
              {scenarios.map(({ label, rateLabel, termLabel, pi, savings, be, note }) => {
                const works = be && be <= tgt;
                const mayWork = be && be <= 60;
                const bColor = beColor(be);
                return (
                  <div key={label} style={{
                    padding: "14px 15px", borderRadius: 10,
                    border: `1.5px solid ${works ? COLORS.green + "66" : mayWork ? COLORS.gold + "66" : COLORS.border}`,
                    background: works ? `${COLORS.green}08` : mayWork ? `${COLORS.gold}06` : COLORS.bgAlt,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.navy, fontFamily: font, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginBottom: 10 }}>{rateLabel} · {termLabel}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: COLORS.gray, fontFamily: font }}>Est. payment</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{fmt2(pi)}/mo</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: COLORS.gray, fontFamily: font }}>Monthly savings</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: savings > 0 ? COLORS.green : COLORS.red, fontFamily: font }}>{savings > 0 ? "+" : ""}{fmt2(savings)}/mo</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: `1px solid ${COLORS.border}`, marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: COLORS.gray, fontFamily: font }}>Interest break-even</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: bColor, fontFamily: font }}>
                        {!be ? "⛔ N/A" : be <= tgt ? `✅ ${be} mo` : `${be} mo`}
                      </span>
                    </div>
                    {note && <div style={{ marginTop: 8, fontSize: 10, color: COLORS.grayLight, fontFamily: font, lineHeight: 1.5 }}>{note}</div>}
                  </div>
                );
              })}
            </div>

            {paydownAmount > 0 && (
              <div style={{ padding: "14px 16px", borderRadius: 10, border: `1.5px solid ${COLORS.blue}44`, background: `${COLORS.blue}06`, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.navy, fontFamily: font, marginBottom: 8 }}>
                  💰 Principal Buydown — Exactly What's Needed for a {tgt}-Month Break-Even
                </div>
                <div style={{ fontSize: 12, color: COLORS.navy, fontFamily: font, lineHeight: 1.7, marginBottom: 12 }}>
                  Bring <strong style={{ color: COLORS.blue }}>{fmt(paydownAmount)}</strong> cash to closing to reduce the loan principal. At this lower balance, your monthly savings recoup all closing costs in {tgt} months.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                  {[
                    { label: "Paydown Amount", value: fmt(paydownAmount), color: COLORS.blue },
                    { label: "New Balance", value: fmt(Math.round(pdLoanAmt)), color: COLORS.navy },
                    { label: "New Payment", value: `${fmt2(pdPI)}/mo`, color: COLORS.navy },
                    { label: "Monthly Savings", value: `+${fmt2(pdSav)}/mo`, color: COLORS.green },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ padding: "10px 12px", background: "#fff", borderRadius: 7, border: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.gray, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: font, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: font }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 10, color: COLORS.grayLight, fontFamily: font, lineHeight: 1.55, padding: "8px 12px", background: COLORS.bgAlt, borderRadius: 7, border: `1px solid ${COLORS.border}` }}>
              ⚠ <strong>Estimates only.</strong> 20-year and 15-year rates shown at {(nr - 0.25).toFixed(3)}% and {(nr - 0.50).toFixed(3)}% — actual market rates vary. Interest break-even compares each term's 5-year interest cost vs the standard {analysis.nTermMonths / 12}-year option. PMI recalculation not shown for alternative terms. Call us for current pricing.
            </div>
          </SectionCard>
        );
      })()}

      {/* ── Strike Rate Calculator ─────────────────────────────────────────── */}
      {analysis.curPI > 0 && analysis.newLoanAmt > 0 && analysis.closingFeesOnly > 0 && (() => {
        const tgt        = Math.max(1, Math.min(120, parseInt(strikeTarget) || 36));
        const currentBE  = analysis.trueBreakEven && analysis.trueBreakEven.breakEvenMonth;
        const alreadyAchieved = currentBE && currentBE <= tgt;
        const custom     = strikeRates ? strikeRates.custom : null;
        const tableRates = strikeRates ? strikeRates.table  : [];
        const floor125   = (r) => Math.floor(r * 8) / 8;
        const fmtRate    = (r) => r != null ? `${floor125(r).toFixed(3)}%` : "N/A";

        return (
          <SectionCard title="🎯 STRIKE RATE" accent={COLORS.gold}>
            <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, marginBottom: 16, lineHeight: 1.65 }}>
              Your <strong style={{ color: COLORS.navy }}>strike rate</strong> is the highest interest rate at which
              a refinance makes mathematical sense — the rate where your closing costs pay for themselves within your
              target timeframe. Use it to set a rate alert so you know exactly when to pull the trigger.
            </div>
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
    </div>
  );
}

window.RefinanceAnalysis = RefinanceAnalysis;
