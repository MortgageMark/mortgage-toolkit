// modules/calculators/FeeSheetGenerator.js
const { useState, useEffect, useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const getStateFees = window.getStateFees;
const fmt = window.fmt;
const fmtCredit = window.fmtCredit;
const exportToPDF = window.exportToPDF;
const exportToExcel = window.exportToExcel;
const SectionCard = window.SectionCard;
const Select = window.Select;
const Toggle = window.Toggle;
const LabeledInput = window.LabeledInput;
const COLORS = window.COLORS;
const font = window.font;
const STATE_LIST = window.STATE_LIST;
const isWeekend = window.isWeekend;
const isHoliday = window.isHoliday;
const getHolidayName = window.getHolidayName;
const getFederalHolidays = window.getFederalHolidays;

// State property tax due dates (primary/first installment due date per state)
// Sources: state revenue department schedules; "varies" = significant county-level variation
const STATE_TAX_DUE_DATES = {
  AL: { name: "Alabama",        due: "October 1"                       },
  AZ: { name: "Arizona",        due: "November 1 (1st installment)"    },
  AR: { name: "Arkansas",       due: "October 15"                      },
  CA: { name: "California",     due: "December 10 (1st installment)"   },
  CO: { name: "Colorado",       due: "April 30"                        },
  CT: { name: "Connecticut",    due: "July 1"                          },
  DE: { name: "Delaware",       due: "September 30"                    },
  FL: { name: "Florida",        due: "March 31"                        },
  HI: { name: "Hawaii",         due: "August 20 (1st installment)"     },
  ID: { name: "Idaho",          due: "December 20"                     },
  IN: { name: "Indiana",        due: "May 10 (1st installment)"        },
  IA: { name: "Iowa",           due: "March 31 (1st installment)"      },
  KS: { name: "Kansas",         due: "December 20"                     },
  KY: { name: "Kentucky",       due: "October 31"                      },
  LA: { name: "Louisiana",      due: "December 31"                     },
  MD: { name: "Maryland",       due: "September 30"                    },
  MI: { name: "Michigan",       due: "July 1 (summer) / Nov 30 (winter)" },
  MN: { name: "Minnesota",      due: "May 15 (1st installment)"        },
  MS: { name: "Mississippi",    due: "February 1"                      },
  MO: { name: "Missouri",       due: "December 31"                     },
  MT: { name: "Montana",        due: "May 31 (1st installment)"        },
  NE: { name: "Nebraska",       due: "March 31 (1st installment)"      },
  NJ: { name: "New Jersey",     due: "February 1 (quarterly)"          },
  NM: { name: "New Mexico",     due: "November 10 (1st installment)"   },
  NC: { name: "North Carolina", due: "January 5"                       },
  ND: { name: "North Dakota",   due: "March 1 (1st installment)"       },
  OK: { name: "Oklahoma",       due: "December 31"                     },
  OR: { name: "Oregon",         due: "November 15"                     },
  SC: { name: "South Carolina", due: "January 15"                      },
  SD: { name: "South Dakota",   due: "April 30 (1st installment)"      },
  TN: { name: "Tennessee",      due: "February 28"                     },
  TX: { name: "Texas",          due: "January 31"                      },
  UT: { name: "Utah",           due: "November 30"                     },
  VA: { name: "Virginia",       due: "June 5 (1st installment)"        },
  WA: { name: "Washington",     due: "April 30 (1st installment)"      },
  WV: { name: "West Virginia",  due: "September 30"                    },
  WI: { name: "Wisconsin",      due: "January 31"                      },
  WY: { name: "Wyoming",        due: "November 10"                     },
  // AK, GA, IL, MA, ME, NH, NV, NY, OH, PA, RI, VT — vary significantly by county/municipality
};

// Fee hierarchy helpers
function _def(custom, hardcoded) { const n = parseFloat(custom); return (custom !== "" && !isNaN(n)) ? n : hardcoded; }
function _lo(val, fallback)      { const n = parseFloat(val);    return (val    !== "" && !isNaN(n)) ? n : fallback;  }

// Date helpers
function dateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addBusinessDays(dateStr, n) {
  const p = dateStr.split("-");
  let d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  let added = 0;
  while (added < n) {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);
    const iso = dateToISO(d);
    if (!isWeekend(iso) && !isHoliday(iso, d.getFullYear())) added++;
  }
  return d;
}
function addRescissionDays(dateStr, n) {
  // TX homestead TILA: Saturdays count; Sundays + federal holidays excluded
  const p = dateStr.split("-");
  let d = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
  let added = 0;
  while (added < n) {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);
    if (d.getDay() !== 0) { // not Sunday
      const iso = dateToISO(d);
      if (!isHoliday(iso, d.getFullYear())) added++;
    }
  }
  return d;
}
function fmtDate(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// FeeRow must be at module level — if defined inside FeeSheetGenerator, React
// creates a new function reference on every parent render, causing unmount/remount
// on every keystroke (destroying cursor position and limiting visible digits).
function FeeRow({ label, amount, bold, indent, color, editKey, editValue, onEdit, defaultVal, isInternal }) {
  const [localVal, setLocalVal] = React.useState(editValue != null ? String(editValue) : "");
  const [focused,  setFocused]  = React.useState(false);
  // Sync local copy from external when NOT focused (e.g. Reset button was clicked)
  React.useEffect(() => {
    if (!focused) setLocalVal(editValue != null ? String(editValue) : "");
  }, [editValue, focused]);
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:`${bold?10:6}px 0`, borderBottom: bold?`2px solid ${COLORS.navy}`:`1px solid ${COLORS.border}`, marginLeft: indent?20:0, gap:8 }}>
      <span style={{ fontSize:bold?14:13, fontWeight:bold?700:400, color:color||COLORS.navy, fontFamily:font, flex:1 }}>{label}</span>
      {isInternal && editKey ? (
        <input type="text"
          value={focused ? localVal : (localVal !== "" ? Number(localVal).toLocaleString() : "")}
          placeholder={fmt(defaultVal)}
          onFocus={() => setFocused(true)}
          onBlur={()  => setFocused(false)}
          onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g,""); setLocalVal(raw); if (onEdit) onEdit(raw); }}
          style={{ width:120, textAlign:"right", fontSize:13, fontWeight:600, fontFamily:font, color:localVal!==""?COLORS.blue:COLORS.navy, border:`1px solid ${localVal!==""?COLORS.blue:COLORS.border}`, borderRadius:4, padding:"2px 6px", background:localVal!==""?"#EAF4FB":"transparent", outline:"none" }} />
      ) : (
        <span style={{ fontSize:bold?14:13, fontWeight:bold?700:500, color:color||COLORS.navy, fontFamily:font }}>{amount<0?fmtCredit(amount):fmt(amount)}</span>
      )}
    </div>
  );
}

function FeeSheetGenerator({ isInternal = false, user = null }) {
  const userId  = user?.id   || "default";
  const isAdmin  = user?.role === "admin";
  const isClient = user?.role === "borrower";

  // ── Shared with Payment Calculator ─────────────────────────────────────────
  const [selectedState,   setSelectedState]   = useLocalStorage("pc_state",    "TX");
  const [transactionType, setTransactionType] = useLocalStorage("pc_purpose",  "purchase");
  const [purchasePrice,   setPurchasePrice]   = useLocalStorage("pc_hp",       "425000");
  const [loanAmount,      setLoanAmount]      = useLocalStorage("pc_la",       "340000");
  const [loanType,        setLoanType]        = useLocalStorage("pc_prog",     "conventional");
  const [rate,            setRate]            = useLocalStorage("pc_rate",     "6.75");
  const [vaFirst,         setVaFirst]         = useLocalStorage("pc_va_first", "true");
  const [vaExempt,        setVaExempt]        = useLocalStorage("pc_va_exempt","false");
  const [occupancy]                           = useLocalStorage("pc_occ",      "primary");

  // ── Fee Sheet–specific ─────────────────────────────────────────────────────
  // Title Endorsement engine inputs — computed inline so no tab visit is required
  const [pcPropType]     = useLocalStorage("pc_proptype",   "sfr");
  const [pcRateType]     = useLocalStorage("pc_lt",         "fixed");
  const [hasNegAmort]    = useLocalStorage("te_neg_amort",  false);
  const [hasBalloon]     = useLocalStorage("te_balloon",    false);
  const [hasFutureAdv]   = useLocalStorage("te_future_adv", false);
  const [mineralRisk]    = useLocalStorage("te_mineral",    false);
  const [nearIndustrial] = useLocalStorage("te_industrial", false);
  const [isImprovedLand] = useLocalStorage("te_improved",   true);
  const [multipleParcel] = useLocalStorage("te_multi_parc", false);
  const [isLeasehold]    = useLocalStorage("te_leasehold",  false);
  const [tePropType]     = useLocalStorage("te_proptype",   "");
  const [teLoanType]     = useLocalStorage("te_loantype",   "");
  // Cash-out from Refinance Analyzer
  const [cashOutEnabled] = useLocalStorage("ra_coe", false);
  const [cashOutAmount]  = useLocalStorage("ra_coa", "0");
  // Engine ready state — mirrors TitleEndorsements.js pattern
  const [engineLoaded, setEngineLoaded] = useState(!!window._titleEngineLoaded);
  const today = new Date();
  const defaultCD = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 32);
    // Advance past weekends so closing lands on a business day
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [closingDate,       setClosingDate]       = useLocalStorage("fs_closing_date", defaultCD);
  const [waiveEscrows,      setWaiveEscrows]      = useLocalStorage("fs_waive_esc",    false);
  const [monthlyTaxes,      setMonthlyTaxes]      = useLocalStorage("fs_mt",           "625");
  const [monthlyInsurance,  setMonthlyInsurance]  = useLocalStorage("fs_mi",           "200");
  const [originationPct,    setOriginationPct]    = useLocalStorage("fs_op",           "0");
  const [discountPoints,    setDiscountPoints]    = useLocalStorage("fs_dp",           "0");
  const [includeSurvey,     setIncludeSurvey]     = useLocalStorage("fs_sv",           true);
  const [includeHomeWarranty,setIncludeHomeWarranty]=useLocalStorage("fs_hw",          false);
  const [earnestMoney,      setEarnestMoney]      = useLocalStorage("fs_em",           "");
  const [optionMoney,       setOptionMoney]       = useLocalStorage("fs_om",           "");
  const [lenderCredits,     setLenderCredits]     = useLocalStorage("fs_lc",           "");
  const [hoaTransferFee,    setHoaTransferFee]    = useLocalStorage("fs_hoat",         "");
  const [hoaDues,           setHoaDues]           = useLocalStorage("pc_hoa",          "");
  const [sellerPaidTitle,   setSellerPaidTitle]   = useLocalStorage("fs_spt",          true);
  const [sellerCredits,     setSellerCredits]     = useLocalStorage("fs_sc",           "");
  const [shortPay,          setShortPay]          = useLocalStorage("fs_sp",           false);
  const [sellerPaidSurvey,        setSellerPaidSurvey]        = useLocalStorage("fs_sps",  true);
  const [sellerPaidHomeWarranty,  setSellerPaidHomeWarranty]  = useLocalStorage("fs_sphw", false);
  const [realtorContrib,          setRealtorContrib]          = useLocalStorage("fs_rc",   "");
  // RESPA escrow date inputs
  const [nextTaxDueDate, setNextTaxDueDate] = useLocalStorage("fs_next_tax_due", "");
  const [insRenewalDate, setInsRenewalDate] = useLocalStorage("fs_ins_renew",    "");
  // Escrow calculation mode: true = simple 12/3/3 (default), false = proper RESPA aggregate adjustment
  const [simpleEscrow,   setSimpleEscrow]   = useLocalStorage("fs_simple_escrow", true);
  // HOA collection frequency for seller proration calculation
  const [hoaFrequency,   setHoaFrequency]   = useLocalStorage("fs_hoa_freq", "annual");
  // New construction
  const [isNewConstruction, setIsNewConstruction] = useLocalStorage("fs_new_const",  false);
  const [valuationForTaxes, setValuationForTaxes] = useLocalStorage("fs_val_tax",    "");
  const [ncEscrowType,      setNcEscrowType]       = useLocalStorage("fs_nc_escrow",  "improved");
  // Homestead — mirrors Payment Calculator logic (TX primary = 80% tax basis)
  const [pcOccupancy] = useLocalStorage("pc_occ", "primary");
  const homesteadExemption = selectedState === "TX" && pcOccupancy === "primary";
  const homesteadFactor    = homesteadExemption ? 0.80 : 1.0;
  // hoaDues now shares pc_hoa key with PaymentCalculator — bidirectional sync
  // Debt payoffs at closing — written by DTICalculator, consumed here
  const [dtiPayoffBal] = useLocalStorage("dti_payoff_bal", "0");
  // Cross-tab reads from Refi Analyzer (internal)
  const [raPiw, setRaPiw]             = useLocalStorage("ra_piw",       false);
  const [raNewSurvey, setRaNewSurvey] = useLocalStorage("ra_survey",    false);
  const [raWaiveTitle]                = useLocalStorage("ra_waivtitle", false);

  // Per-transaction overrides (inline editing on right column)
  const [ovUnderwriting, setOvUnderwriting] = useLocalStorage("fs_ov_uw",      "");
  const [ovProcessing,   setOvProcessing]   = useLocalStorage("fs_ov_proc",    "");
  const [ovAppraisal,    setOvAppraisal]    = useLocalStorage("fs_ov_appr",    "");
  const [ovCreditReport, setOvCreditReport] = useLocalStorage("fs_ov_cr",      "");
  const [ovFloodCert,    setOvFloodCert]    = useLocalStorage("fs_ov_flood",   "");
  const [ovTaxService,   setOvTaxService]   = useLocalStorage("fs_ov_taxsvc",  "");
  const [ovDocPrep,      setOvDocPrep]      = useLocalStorage("fs_ov_docprep", "");
  const [ovSurvey,       setOvSurvey]       = useLocalStorage("fs_ov_survey",  "");
  const [ovEscrowFee,    setOvEscrowFee]    = useLocalStorage("fs_ov_escfee",  "");
  const [ovTitleSearch,  setOvTitleSearch]  = useLocalStorage("fs_ov_tsrch",   "");
  const [ovHomeWarranty, setOvHomeWarranty] = useLocalStorage("fs_ov_hw",      "");

  // LO-specific defaults (per user, persistent)
  const [loDefOrigination, setLoDefOrigination] = useLocalStorage(`${userId}_lo_orig`,    "0");
  const [loDefDiscount,    setLoDefDiscount]    = useLocalStorage(`${userId}_lo_disc`,    "0");
  const [loDefUw,          setLoDefUw]          = useLocalStorage(`${userId}_lo_uw`,      "1000");
  const [loDefProc,        setLoDefProc]        = useLocalStorage(`${userId}_lo_proc`,    "595");
  const [loDefAppraisal,   setLoDefAppraisal]   = useLocalStorage(`${userId}_lo_appr`,   "750");
  const [loDefCreditReport,setLoDefCreditReport]= useLocalStorage(`${userId}_lo_cr`,     "350");
  const [loDefFloodCert,   setLoDefFloodCert]   = useLocalStorage(`${userId}_lo_flood`,  "14");
  const [loDefTaxService,  setLoDefTaxService]  = useLocalStorage(`${userId}_lo_taxsvc`, "85");
  const [loDefSurvey,      setLoDefSurvey]      = useLocalStorage(`${userId}_lo_survey`, "450");
  const [loDefDocPrep,     setLoDefDocPrep]     = useLocalStorage(`${userId}_lo_docprep`,"250");
  const [loDefEscrowFee,   setLoDefEscrowFee]   = useLocalStorage(`${userId}_lo_escrow`, "");
  const [loDefTitleSearch, setLoDefTitleSearch] = useLocalStorage(`${userId}_lo_title`,  "250");
  const [loDefHomeWarranty,setLoDefHomeWarranty]= useLocalStorage(`${userId}_lo_hw`,     "550");

  // Global admin defaults
  const [defOrigination,  setDefOrigination]  = useLocalStorage("fs_def_orig",    "");
  const [defDiscount,     setDefDiscount]     = useLocalStorage("fs_def_disc",    "");
  const [defUnderwriting, setDefUnderwriting] = useLocalStorage("fs_def_uw",      "");
  const [defProcessing,   setDefProcessing]   = useLocalStorage("fs_def_proc",    "");
  const [defAppraisal,    setDefAppraisal]    = useLocalStorage("fs_def_appr",    "");
  const [defCreditReport, setDefCreditReport] = useLocalStorage("fs_def_cr",      "");
  const [defFloodCert,    setDefFloodCert]    = useLocalStorage("fs_def_flood",   "");
  const [defTaxService,   setDefTaxService]   = useLocalStorage("fs_def_taxsvc",  "");
  const [defSurvey,       setDefSurvey]       = useLocalStorage("fs_def_survey",  "");
  const [defDocPrep,      setDefDocPrep]      = useLocalStorage("fs_def_docprep", "");
  const [defEscrowFee,    setDefEscrowFee]    = useLocalStorage("fs_def_escrow",  "");
  const [defTitleSearch,  setDefTitleSearch]  = useLocalStorage("fs_def_title",   "");
  const [defHomeWarranty, setDefHomeWarranty] = useLocalStorage("fs_def_hw",      "");

  // ── Derived values ─────────────────────────────────────────────────────────
  // Survey is active if either the Fee Sheet toggle or the Refi Analyzer toggle is on
  const effectiveSurvey = includeSurvey || raNewSurvey;
  const stFees   = getStateFees(selectedState);
  const stateName = stFees.name;
  const stateAbbr = stFees.abbr;
  const isGovLoan      = loanType === "fha" || loanType === "va" || loanType === "usda";
  const dpPctDisplay   = parseFloat(purchasePrice) > 0
    ? ((parseFloat(purchasePrice) - parseFloat(loanAmount)) / parseFloat(purchasePrice)) * 100 : 0;
  const canWaiveEscrows        = !isGovLoan && dpPctDisplay >= 10;
  const effectiveIncludeEscrow = isGovLoan ? true : (canWaiveEscrows ? !waiveEscrows : true);

  // For clients: force Simple 12/3/3 escrows on so they never see RESPA date inputs
  useEffect(() => {
    if (isClient && !simpleEscrow) setSimpleEscrow(true);
  }, [isClient]);
  const waiveLLPA              = Math.round((parseFloat(loanAmount) || 0) * 0.0025);
  const isRefiTXHomestead      = transactionType === "refinance" && selectedState === "TX" && occupancy === "primary";
  const loanTypeLabel = loanType === "va" ? "VA" : loanType === "fha" ? "FHA" : loanType === "usda" ? "USDA"
    : loanType === "conventional" ? "Conventional" : loanType === "jumbo" ? "Jumbo" : loanType;

  const parsedCD = useMemo(() => {
    const parts = (closingDate || defaultCD).split("-");
    return { year: parseInt(parts[0]) || today.getFullYear(), month: parseInt(parts[1]) || (today.getMonth()+2), day: parseInt(parts[2]) || 15 };
  }, [closingDate]);

  // RESPA date defaults: taxes → Dec 31 current year; insurance → funding date + 1 year (always fixed)
  const effectiveTaxDue = nextTaxDueDate || `${parsedCD.year}-12-31`;
  const effectiveInsRenew = (() => {
    const base = fundingDate
      ? `${fundingDate.getFullYear()}-${String(fundingDate.getMonth()+1).padStart(2,"0")}-${String(fundingDate.getDate()).padStart(2,"0")}`
      : (closingDate || defaultCD);
    const p = base.split("-");
    return `${parseInt(p[0]) + 1}-${p[1]}-${p[2]}`;
  })();

  const fundingDate = useMemo(() => {
    if (!closingDate) return null;
    try {
      if (isRefiTXHomestead) {
        return addRescissionDays(closingDate, 3); // 3 rescission days after closing; no extra +1
      }
      // All other loans: funding = same day as closing
      const p = closingDate.split("-");
      return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    } catch(e) { return null; }
  }, [closingDate, isRefiTXHomestead]);

  const firstPayDate = useMemo(() => {
    if (!fundingDate) return null;
    const m = fundingDate.getMonth() + 2;
    const y = fundingDate.getFullYear() + Math.floor((fundingDate.getMonth() + 2) / 12);
    return new Date(y, m % 12, 1);
  }, [fundingDate]);

  React.useEffect(() => {
    const st = getStateFees(selectedState);
    if (st.surveyRequired === "required" || st.surveyRequired === "recommended") setIncludeSurvey(true);
    else if (st.surveyRequired === "none") setIncludeSurvey(false);
  }, [selectedState]);

  // Auto-clear short pay if the funding date moves past the 5th
  React.useEffect(() => {
    if (fundingDate && fundingDate.getDate() > 5 && shortPay) setShortPay(false);
  }, [fundingDate]);

  // Watch for title endorsement engine readiness — chain any existing callback
  useEffect(() => {
    if (window._titleEngineLoaded) { setEngineLoaded(true); return; }
    const prev = window._titleEngineReadyCallback;
    window._titleEngineReadyCallback = () => {
      setEngineLoaded(true);
      if (typeof prev === "function") prev();
    };
  }, []);

  // ── Inline endorsement engine — runs without visiting the Title Endorsements tab ──
  const computedEndorsementTotal = useMemo(() => {
    if (!engineLoaded || !window.getEndorsementsForState) return 0;
    const st      = getStateFees(selectedState);
    const la      = parseFloat(loanAmount) || 0;
    const pp      = parseFloat(purchasePrice) || 0;
    const isPurch = transactionType === "purchase";
    const co      = parseFloat(cashOutAmount) || 0;
    const propTypeMap = {
      sfr: "singleFamily", townhome: "pud", condo: "condo",
      duplex: "multiFamily", "3plex": "multiFamily", "4plex": "multiFamily", other: "singleFamily",
    };
    // Policy premiums needed by endorsement engine (same formula as fees useMemo)
    const lenderPrem = (!isPurch && raWaiveTitle) ? 0
      : isPurch ? (la <= 0 ? 0 : Math.round(st.basicRate(la) * (st.simultaneousRate || 0.35)))
      : Math.round(st.basicRate(la));
    const ownerPrem = isPurch ? Math.round(st.basicRate(pp)) : 0;
    // If cash-out refi, treat as homeEquity loan (triggers T-42 / 50(a)(6) endorsements in TX)
    const engineLoanType = teLoanType || (cashOutEnabled && co > 0 ? "homeEquity" : loanType);
    const enginePropType = tePropType || propTypeMap[pcPropType] || "singleFamily";
    const fields = {
      loanAmount:          la,
      purchasePrice:       pp,
      loanType:            engineLoanType,
      propertyType:        enginePropType,
      surveyProvided:      effectiveSurvey,
      rateType:            pcRateType,
      hasNegativeAmort:    hasNegAmort,
      hasBalloon,
      hasFutureAdvances:   hasFutureAdv || (cashOutEnabled && co > 0),
      isRefinance:         !isPurch,
      mineralRiskArea:     mineralRisk,
      nearIndustrialZone:  nearIndustrial,
      lenderPolicyPremium: lenderPrem,
      ownerPolicyPremium:  ownerPrem,
      state:               selectedState,
      isImprovedLand,
      multipleParcel,
      isLeasehold,
      cashOut:             co,
    };
    try {
      const result = window.getEndorsementsForState(selectedState, fields);
      return (result?.endorsements || []).reduce((sum, e) => sum + (e.resolvedFee || 0), 0);
    } catch { return 0; }
  }, [engineLoaded, selectedState, loanAmount, purchasePrice, transactionType, loanType,
      pcPropType, pcRateType, effectiveSurvey, hasNegAmort, hasBalloon, hasFutureAdv,
      mineralRisk, nearIndustrial, isImprovedLand, multipleParcel, isLeasehold,
      tePropType, teLoanType, cashOutEnabled, cashOutAmount, raWaiveTitle]);

  const fees = useMemo(() => {
    const st  = getStateFees(selectedState);
    const pp  = parseFloat(purchasePrice) || 0;
    const la  = parseFloat(loanAmount)    || 0;
    const r   = parseFloat(rate)          || 0;
    const mTax = parseFloat(monthlyTaxes) || 0;
    const mIns = parseFloat(monthlyInsurance) || 0;
    // Homestead-adjusted monthly tax — propagation writes the full (non-homestead) value to fs_mt,
    // so we apply the homestead factor here to match what the Payment Calculator displays.
    const mTaxBase = homesteadExemption ? mTax * homesteadFactor : mTax;
    // New construction tax rate + escrow base
    const ncValuation    = isNewConstruction ? (parseFloat(valuationForTaxes) || 0) : 0;
    const impliedTaxRate = (pp > 0 && mTax > 0) ? (mTax * 12) / pp : 0;  // true rate from full (non-homestead) monthly
    const effectiveTaxRate = impliedTaxRate;
    // Unimproved escrow: true rate × unimproved valuation × homestead factor
    const mTaxForEscrow  = (isNewConstruction && ncEscrowType === "unimproved" && ncValuation > 0 && effectiveTaxRate > 0)
      ? (effectiveTaxRate * ncValuation * homesteadFactor / 12)
      : mTaxBase;
    const hoaMonthly = parseFloat(hoaDues) || 0;
    const lo_pre  = (val, fb) => { const n = parseFloat(val); return (val !== "" && !isNaN(n)) ? n : fb; };
    const def_pre = (cust, hc) => { const n = parseFloat(cust); return (cust !== "" && !isNaN(n)) ? n : hc; };
    const origPct = originationPct !== "" ? (parseFloat(originationPct) || 0) : lo_pre(loDefOrigination, def_pre(defOrigination, 0));
    const discPts = discountPoints  !== "" ? (parseFloat(discountPoints) || 0) : lo_pre(loDefDiscount,    def_pre(defDiscount,   0));
    const isPurchase = transactionType === "purchase";
    const origination = Math.round(la * origPct / 100);
    const discount    = Math.round(la * discPts / 100);

    const ov  = (val, fb)  => { const n = parseFloat(val); return (val !== "" && !isNaN(n)) ? n : fb; };
    const lo  = (val, fb)  => { const n = parseFloat(val); return (val !== "" && !isNaN(n)) ? n : fb; };
    const def = (cust, hc) => { const n = parseFloat(cust); return (cust !== "" && !isNaN(n)) ? n : hc; };

    const underwriting  = ov(ovUnderwriting,  lo(loDefUw,           def(defUnderwriting,  1000)));
    const processingFee = ov(ovProcessing,    lo(loDefProc,         def(defProcessing,    595)));
    const lenderFees    = origination + discount + underwriting + processingFee;
    const piw           = raPiw;
    const appraisal     = piw ? 0 : ov(ovAppraisal, lo(loDefAppraisal, def(defAppraisal, 750)));
    const creditReport  = ov(ovCreditReport, lo(loDefCreditReport, def(defCreditReport,  350)));
    const floodCert     = ov(ovFloodCert,    lo(loDefFloodCert,    def(defFloodCert,     st.floodCert     || 14)));
    const taxService    = ov(ovTaxService,   lo(loDefTaxService,   def(defTaxService,    st.taxServiceFee || 85)));
    const surveyDefault = lo(loDefSurvey,    def(defSurvey,        st.surveyFee || 450));
    const survey        = effectiveSurvey ? ov(ovSurvey, surveyDefault) : 0;
    const docPrep       = ov(ovDocPrep,      lo(loDefDocPrep,      def(defDocPrep,       250)));
    const thirdPartyFees = appraisal + creditReport + floodCert + taxService + docPrep + survey;
    const ownerTitlePolicy   = isPurchase ? st.basicRate(pp) : 0;
    const lenderTitlePolicy  = (!isPurchase && raWaiveTitle) ? 0
      : isPurchase ? (la <= 0 ? 0 : Math.round(st.basicRate(la) * (st.simultaneousRate || 0.35)))
      : Math.round(st.basicRate(la));
    const escrowFeeDefaultCalc = Math.round(Math.max(500, (isPurchase ? pp : la) * 0.001));
    const escrowFeeDefault   = lo(loDefEscrowFee,   def(defEscrowFee,   escrowFeeDefaultCalc));
    const escrowFee          = ov(ovEscrowFee,   escrowFeeDefault);
    const titleSearch        = ov(ovTitleSearch, lo(loDefTitleSearch, def(defTitleSearch, 250)));
    const recordingFees      = 150;
    const titleCourier       = 50;
    const taxCertERecording  = selectedState === "TX" ? 25 : (st.taxCertERecording || 25);
    const transferTax        = isPurchase ? Math.round(pp * (st.transferTax || 0) / 1000) : 0;
    const attorneyFee        = st.attorneyRequired ? (st.attorneyFee || 0) : 0;
    const endorsementTotal   = computedEndorsementTotal;
    const titleFees = ownerTitlePolicy + lenderTitlePolicy + escrowFee + titleSearch + recordingFees + titleCourier + taxCertERecording + transferTax + attorneyFee + endorsementTotal;

    // Per diem prepaid interest is calculated from the funding date, not closing date
    const fundingDay   = fundingDate ? fundingDate.getDate()          : parsedCD.day;
    const fundingMonth = fundingDate ? fundingDate.getMonth() + 1     : parsedCD.month;
    const fundingYear  = fundingDate ? fundingDate.getFullYear()      : parsedCD.year;
    const daysInMonth  = new Date(fundingYear, fundingMonth, 0).getDate();
    const prepaidDays  = Math.max(1, daysInMonth - fundingDay + 1);
    const dailyInterest    = (la * (r / 100)) / 365;
    const prepaidInterest  = Math.round(dailyInterest * prepaidDays);
    const homeownersInsurance = isPurchase ? Math.round(mIns * 12) : 0;

    // Escrow uses effectiveIncludeEscrow (accounts for waiveEscrows + gov loan rules)
    const isGovLoanInner     = loanType === "fha" || loanType === "va" || loanType === "usda";
    const dpPctInner         = pp > 0 ? ((pp - la) / pp) * 100 : 0;
    const canWaiveInner      = !isGovLoanInner && dpPctInner >= 10;
    const inclEscrow         = isGovLoanInner ? true : (canWaiveInner ? !waiveEscrows : true);
    let taxReserves = 0, insReserves = 0, aggregateAdj = 0;
    let taxReserveMonths = 3, insReserveMonths = 3;
    // Use RESPA calc for refis (always) OR for purchases when simple 12/3/3 is OFF
    // Effective date defaults (Dec 31 / anniversary) ensure RESPA always has valid dates
    const useRespaCalc = firstPayDate && (!isPurchase || !simpleEscrow);
    if (inclEscrow) {
      if (useRespaCalc) {
        // RESPA aggregate escrow calculation
        const fpYear  = firstPayDate.getFullYear();
        const fpMonth = firstPayDate.getMonth() + 1; // 1-based

        // Parse due dates (use effective dates which always have fallback defaults)
        const taxParts   = effectiveTaxDue.split("-");
        const insParts   = effectiveInsRenew.split("-");
        const taxDueDate = new Date(parseInt(taxParts[0]), parseInt(taxParts[1]) - 1, parseInt(taxParts[2]));
        const insDueDate = new Date(parseInt(insParts[0]), parseInt(insParts[1]) - 1, parseInt(insParts[2]));

        // N = months from first payment date to next tax disbursement
        let N = (taxDueDate.getFullYear() - fpYear) * 12 + (taxDueDate.getMonth() + 1 - fpMonth);
        if (N <= 0) N += 12;
        if (N > 12) N = 12;

        // M = months from first payment date to insurance renewal
        let M = (insDueDate.getFullYear() - fpYear) * 12 + (insDueDate.getMonth() + 1 - fpMonth);
        if (M <= 0) M += 12;
        if (M > 12) M = 12;

        // RESPA formula: collect enough so balance never drops below 2-month cushion
        taxReserveMonths = Math.max(2, 14 - N);
        insReserveMonths = Math.max(2, 14 - M);
        taxReserves = Math.round(mTaxForEscrow * taxReserveMonths);
        insReserves = Math.round(mIns * insReserveMonths);

        // 12-month aggregate adjustment simulation
        const monthlyEscrow = mTaxForEscrow + mIns;
        let balance    = taxReserves + insReserves;
        let minBalance = balance;
        for (let mo = 1; mo <= 12; mo++) {
          balance += monthlyEscrow;
          if (mo === N) balance -= (mTaxForEscrow * 12);
          if (mo === M) balance -= (mIns * 12);
          if (balance < minBalance) minBalance = balance;
        }
        const cushionTarget = 2 * monthlyEscrow;
        aggregateAdj = Math.round(cushionTarget - minBalance);
        // aggregateAdj < 0 = credit back to borrower (typical); > 0 = additional charge
      } else {
        // Dates not entered or simple 12/3/3 mode: use standard 3-month formula
        taxReserves = Math.round(mTaxForEscrow * 3);
        insReserves = Math.round(mIns * 3);
      }
    }

    // Seller's prorated tax credit — purchase only, proper RESPA escrow mode
    // Seller owes buyer for taxes accrued from Jan 1 through the day before closing
    let sellerProratedTaxCredit = 0;
    if (isPurchase && mTax > 0) {
      const cYear = parsedCD.year;
      const cDate = new Date(cYear, parsedCD.month - 1, parsedCD.day);
      const janFirst = new Date(cYear, 0, 1);
      const daysSellerOwned = Math.floor((cDate - janFirst) / 86400000);
      const daysInYear = (cYear % 4 === 0 && (cYear % 100 !== 0 || cYear % 400 === 0)) ? 366 : 365;
      if (isNewConstruction && ncValuation > 0 && effectiveTaxRate > 0) {
        // Seller owned unimproved land — credit based on valuation × tax rate
        const dailyUnimprovedTax = (effectiveTaxRate * ncValuation) / daysInYear;
        sellerProratedTaxCredit = Math.round(dailyUnimprovedTax * daysSellerOwned);
      } else {
        sellerProratedTaxCredit = Math.round((mTax * 12) * (daysSellerOwned / daysInYear));
      }
    }

    // HOA proration — purchase only; calculated from funding date through next HOA payment date
    let sellerHoaProration = 0;
    let hoaProrationDays   = 0;
    let nextHoaDateFmt     = "";   // "MM/DD/YYYY" for display
    let fundingDateFmt     = "";   // "MM/DD/YYYY" for display
    if (isPurchase && hoaMonthly > 0 && fundingDate) {
      const fd     = fundingDate;
      const fYear  = fd.getFullYear();
      const fMonth = fd.getMonth() + 1; // 1-based
      let nextHoaDate, periodStart, periodAmount;
      if (hoaFrequency === "semi-annual") {
        if (fMonth <= 6) { periodStart = new Date(fYear,0,1); nextHoaDate = new Date(fYear,6,1); }
        else             { periodStart = new Date(fYear,6,1); nextHoaDate = new Date(fYear+1,0,1); }
        periodAmount = hoaMonthly * 6;
      } else if (hoaFrequency === "quarterly") {
        if      (fMonth <= 3) { periodStart = new Date(fYear,0,1); nextHoaDate = new Date(fYear,3,1); }
        else if (fMonth <= 6) { periodStart = new Date(fYear,3,1); nextHoaDate = new Date(fYear,6,1); }
        else if (fMonth <= 9) { periodStart = new Date(fYear,6,1); nextHoaDate = new Date(fYear,9,1); }
        else                  { periodStart = new Date(fYear,9,1); nextHoaDate = new Date(fYear+1,0,1); }
        periodAmount = hoaMonthly * 3;
      } else { // annual (default)
        periodStart  = new Date(fYear,0,1);
        nextHoaDate  = new Date(fYear+1,0,1);
        periodAmount = hoaMonthly * 12;
      }
      const daysInPeriod = Math.round((nextHoaDate - periodStart) / 86400000);
      hoaProrationDays   = Math.round((nextHoaDate - fd) / 86400000);
      if (hoaProrationDays > 0 && daysInPeriod > 0)
        sellerHoaProration = Math.round(periodAmount * (hoaProrationDays / daysInPeriod));
      const fmtD = d => `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
      fundingDateFmt = fmtD(fd);
      nextHoaDateFmt = fmtD(nextHoaDate);
    }

    const totalReserves = taxReserves + insReserves;

    const hwDefault     = lo(loDefHomeWarranty, def(defHomeWarranty, st.homeWarranty || 550));
    const homeWarranty  = (isPurchase && includeHomeWarranty) ? ov(ovHomeWarranty, hwDefault) : 0;
    const earnest       = isPurchase ? (parseFloat(earnestMoney)   || 0) : 0;
    const option        = isPurchase ? (parseFloat(optionMoney)    || 0) : 0;
    const lenderCred    = parseFloat(lenderCredits)  || 0;
    const hoaTransfer   = isPurchase ? (parseFloat(hoaTransferFee) || 0) : 0;
    const hoaDuesAmt    = isPurchase ? sellerHoaProration : 0; // prorated funding→next HOA date
    const optionalFees  = hoaTransfer + hoaDuesAmt;
    const totalCredits  = earnest + option + lenderCred;
    const sellerCred    = isPurchase ? (parseFloat(sellerCredits) || 0) : 0;
    const realtor       = isPurchase ? (parseFloat(realtorContrib) || 0) : 0;
    const sellerSurveyCredit = (isPurchase && sellerPaidSurvey && includeSurvey) ? survey : 0;
    const sellerHWCredit     = (isPurchase && sellerPaidHomeWarranty && includeHomeWarranty) ? homeWarranty : 0;

    // Gov upfront fees (financed — not in cash to close)
    const dpPct    = pp > 0 ? ((pp - la) / pp) * 100 : 0;
    const vaFeeRate = (() => {
      if (loanType !== "va") return 0;
      if (vaExempt === "true") return 0;
      if (!isPurchase) return 0.005;
      if (dpPct >= 10) return 0.0125;
      if (dpPct >= 5)  return 0.0150;
      return vaFirst === "true" ? 0.0215 : 0.0330;
    })();
    const vaFundingFee   = Math.round(la * vaFeeRate);
    const fhaUfmipAmt    = loanType === "fha"  ? Math.round(la * 0.0175) : 0;
    const usdaUpfrontAmt = loanType === "usda" ? Math.round(la * 0.01)   : 0;
    const govUpfrontFee  = vaFundingFee + fhaUfmipAmt + usdaUpfrontAmt;

    const shortPayAdj          = (shortPay && parsedCD.day <= 5) ? Math.round(dailyInterest * parsedCD.day) : 0;
    const adjustedPrepaidInterest = shortPay && parsedCD.day <= 5 ? 0 : prepaidInterest;
    const adjustedTotalPrepaids   = adjustedPrepaidInterest + homeownersInsurance + totalReserves + aggregateAdj;
    const transferTaxLabel     = st.transferTaxLabel || "Transfer Tax";
    const totalClosingCosts    = lenderFees + thirdPartyFees + titleFees;
    const debtPayoffs          = parseFloat(dtiPayoffBal) || 0;
    const grandTotal           = totalClosingCosts + adjustedTotalPrepaids + homeWarranty + optionalFees - totalCredits - sellerCred - realtor - sellerSurveyCredit - sellerHWCredit - shortPayAdj + debtPayoffs - sellerProratedTaxCredit;

    // ── Credit limit calculations ────────────────────────────────────────────
    // Seller concession cap by program / LTV
    const sellerConcPct = (() => {
      if (!isPurchase) return 0;
      if (loanType === "fha")  return 6;
      if (loanType === "va")   return 4;   // "concessions" cap; actual closing costs are extra
      if (loanType === "usda") return 6;
      if (loanType === "jumbo") return 3;
      // Conventional — depends on LTV and occupancy
      if (occupancy === "investment") return 2;
      const ltv = pp > 0 ? (la / pp) * 100 : 100;
      if (ltv > 90) return 3;
      if (ltv > 75) return 6;
      return 9;
    })();
    const sellerConcMax = isPurchase ? Math.round(pp * sellerConcPct / 100) : 0;
    // Lender credits cap = can't exceed total loan costs (closing costs + prepaids)
    const lenderCredMax = totalClosingCosts + adjustedTotalPrepaids;

    return {
      isPurchase, piw, titleWaived: !isPurchase && !!raWaiveTitle, lenderFees, origination, discount, underwriting, processingFee,
      thirdPartyFees, appraisal, creditReport, floodCert, taxService, survey, docPrep,
      titleFees, ownerTitlePolicy, lenderTitlePolicy, escrowFee, titleSearch,
      recordingFees, titleCourier, taxCertERecording, transferTax, transferTaxLabel,
      attorneyFee, endorsementTotal,
      govUpfrontFee, vaFundingFee, vaFeeRate, fhaUfmipAmt, usdaUpfrontAmt,
      prepaidInterest, adjustedPrepaidInterest, homeownersInsurance, prepaidDays,
      taxReserves, insReserves, totalReserves, taxMonthly: mTaxBase, insMonthly: mIns,
      aggregateAdj, taxReserveMonths, insReserveMonths, useRespaCalc,
      sellerProratedTaxCredit,
      sellerHoaProration, hoaMonthly, hoaProrationDays, nextHoaDateFmt, fundingDateFmt,
      mTaxForEscrow, effectiveTaxRate, ncValuation,
      sellerProratedDays: (isPurchase && mTax > 0)
        ? Math.floor((new Date(parsedCD.year, parsedCD.month - 1, parsedCD.day) - new Date(parsedCD.year, 0, 1)) / 86400000)
        : 0,
      earnest, option, lenderCred, hoaTransfer, hoaDuesAmt, optionalFees,
      totalCredits, sellerCred, realtor, sellerSurveyCredit, sellerHWCredit, shortPayAdj,
      homeWarranty, totalClosingCosts, totalPrepaids: adjustedTotalPrepaids, debtPayoffs, grandTotal,
      sellerConcPct, sellerConcMax, lenderCredMax,
      inclEscrow,
      regulation: st.regulation, disclaimer: st.disclaimer,
      attorneyRequired: st.attorneyRequired,
      surveyRequired: st.surveyRequired || "optional",
      _defaults: {
        underwriting:  lo(loDefUw,          def(defUnderwriting,  1000)),
        processingFee: lo(loDefProc,        def(defProcessing,    595)),
        escrowFee:     escrowFeeDefault,
        titleSearch:   lo(loDefTitleSearch, def(defTitleSearch,   250)),
        docPrep:       lo(loDefDocPrep,     def(defDocPrep,       250)),
        appraisal:     lo(loDefAppraisal,   def(defAppraisal,     750)),
        creditReport:  lo(loDefCreditReport,def(defCreditReport,  350)),
        floodCert:     lo(loDefFloodCert,   def(defFloodCert,     st.floodCert     || 14)),
        taxService:    lo(loDefTaxService,  def(defTaxService,    st.taxServiceFee || 85)),
        survey:        surveyDefault,
        homeWarranty:  hwDefault,
      }
    };
  }, [selectedState, transactionType, purchasePrice, loanAmount, loanType, rate,
      closingDate, fundingDate, firstPayDate, nextTaxDueDate, simpleEscrow, hoaFrequency,
      isNewConstruction, valuationForTaxes, ncEscrowType, homesteadExemption, homesteadFactor,
      effectiveTaxDue, effectiveInsRenew,
      monthlyTaxes, monthlyInsurance, originationPct, discountPoints,
      includeSurvey, includeHomeWarranty, waiveEscrows, raPiw, raNewSurvey, raWaiveTitle, effectiveSurvey,
      ovUnderwriting, ovProcessing, ovEscrowFee, ovTitleSearch, ovAppraisal,
      ovCreditReport, ovFloodCert, ovTaxService, ovSurvey, ovHomeWarranty,
      parsedCD, earnestMoney, optionMoney, lenderCredits, hoaTransferFee, hoaDues,
      sellerCredits, shortPay, sellerPaidSurvey, sellerPaidHomeWarranty, realtorContrib, ovDocPrep,
      defOrigination, defDiscount,
      defUnderwriting, defProcessing, defAppraisal, defCreditReport, defFloodCert,
      defTaxService, defSurvey, defDocPrep, defEscrowFee, defTitleSearch, defHomeWarranty,
      vaFirst, vaExempt,
      loDefOrigination, loDefDiscount,
      loDefUw, loDefProc, loDefAppraisal, loDefCreditReport, loDefFloodCert,
      loDefTaxService, loDefSurvey, loDefDocPrep, loDefEscrowFee, loDefTitleSearch,
      loDefHomeWarranty, computedEndorsementTotal, occupancy]);

  // Auto-publish FSG's computed fee totals → shared keys so RA stays in sync automatically
  useEffect(() => {
    // Round each major group individually — matches how FSG renders line items, avoids $1-2 float drift
    const cf = Math.round(fees.lenderFees || 0) + Math.round(fees.thirdPartyFees || 0) + Math.round(fees.titleFees || 0);
    const pp = Math.round(fees.totalPrepaids || 0);
    try {
      const curCF = parseInt(JSON.parse(localStorage.getItem("mtk_fs_cf")  || '"0"'));
      const curPP = parseInt(JSON.parse(localStorage.getItem("mtk_fs_tpp") || '"0"'));
      if (cf === curCF && pp === curPP) return; // already in sync — skip to break any loop
      localStorage.setItem("mtk_fs_cf",  JSON.stringify(String(cf)));
      localStorage.setItem("mtk_fs_tpp", JSON.stringify(String(pp)));
      window.dispatchEvent(new Event("mtk_propagated"));
    } catch {}
  }, [fees.totalClosingCosts, fees.totalPrepaids]);

  return (
    <div>
      <div className="mtk-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:16 }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* FEES & OPTIONS */}
          <SectionCard title="FEES & OPTIONS" accent={COLORS.blue}>
            <LabeledInput label="Origination Fee"  value={originationPct}  onChange={setOriginationPct}  onBlur={() => { const n = parseFloat(originationPct); if (!isNaN(n)) { const s = n.toFixed(Math.max(1, Math.min(3, (originationPct.split(".")[1]||"").length))); setOriginationPct(s); } }} suffix="%" hint={`${fmt(Math.round((parseFloat(loanAmount)||0)*(parseFloat(originationPct)||0)/100))}`} small />
            <LabeledInput label="Discount Points"  value={discountPoints}  onChange={setDiscountPoints}  onBlur={() => { const n = parseFloat(discountPoints); if (!isNaN(n)) { const s = n.toFixed(Math.max(1, Math.min(3, (discountPoints.split(".")[1]||"").length))); setDiscountPoints(s); } }} suffix="%" hint={`${fmt(Math.round((parseFloat(loanAmount)||0)*(parseFloat(discountPoints)||0)/100))}`} small />
            {fees.isPurchase && <Toggle label="Title: Seller Paid"         checked={sellerPaidTitle}         onChange={setSellerPaidTitle} />}
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ flex:1 }}><Toggle label="Survey: Needed" checked={effectiveSurvey} onChange={v => { setIncludeSurvey(v); setRaNewSurvey(v); }} /></div>
              {(() => { const sr = getStateFees(selectedState).surveyRequired; if (!sr || sr==="optional") return null; const color = sr==="required"?COLORS.red:COLORS.blue; const text = sr==="required"?"⚠ required":sr==="recommended"?"ℹ recommended":null; return text ? React.createElement("span",{style:{fontSize:10,color,fontFamily:font,fontWeight:600,whiteSpace:"nowrap"}},text) : null; })()}
            </div>
            {fees.isPurchase && effectiveSurvey       && <Toggle label="Survey: Seller Paid"        checked={sellerPaidSurvey}       onChange={setSellerPaidSurvey} />}
            {fees.isPurchase && <Toggle label="Home Warranty: Include"    checked={includeHomeWarranty}      onChange={setIncludeHomeWarranty} />}
            {fees.isPurchase && includeHomeWarranty && <Toggle label="Home Warranty: Seller Paid" checked={sellerPaidHomeWarranty} onChange={setSellerPaidHomeWarranty} />}
            {!isClient && <Toggle label="Appraisal Waiver: PIW" checked={raPiw} onChange={setRaPiw} />}
            {loanType === "va" && (
              <div style={{ background:"#f0f5ff", border:`1px solid ${COLORS.border}`, borderRadius:8, padding:10, marginTop:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:COLORS.blue, marginBottom:6, fontFamily:font, letterSpacing:"0.06em" }}>VA FUNDING FEE</div>
                <div style={{ display:"flex", gap:0, borderRadius:6, overflow:"hidden", border:`1px solid ${COLORS.border}`, marginBottom:6 }}>
                  {[{ v:"true", l:"First Use" },{ v:"false", l:"Subsequent Use" }].map(o => (
                    <button key={o.v} onClick={() => setVaFirst(o.v)}
                      style={{ flex:1, padding:"6px 0", fontSize:11, fontWeight:700, fontFamily:font, border:"none", cursor:"pointer", background:vaFirst===o.v?COLORS.navy:"transparent", color:vaFirst===o.v?"#fff":COLORS.gray, transition:"all 0.2s" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <Toggle label="Disability Exempt (waives funding fee)" checked={vaExempt==="true"} onChange={v => setVaExempt(v?"true":"false")} />
                {fees.vaFundingFee > 0 && (
                  <div style={{ fontSize:11, color:COLORS.navy, fontFamily:font, marginTop:4 }}>
                    Fee: <strong>{(fees.vaFeeRate*100).toFixed(2)}%</strong> = <strong>{fmt(fees.vaFundingFee)}</strong> (financed into loan)
                  </div>
                )}
                {(() => {
                  const dp = parseFloat(purchasePrice) > 0
                    ? ((parseFloat(purchasePrice) - parseFloat(loanAmount)) / parseFloat(purchasePrice)) * 100 : 0;
                  if (vaExempt === "true") return null;
                  if (loanType !== "va") return null;
                  if (dp >= 5) {
                    const tier = dp >= 10 ? "10%+" : "5–10%";
                    const tRate = dp >= 10 ? "1.25%" : "1.50%";
                    return (
                      <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, marginTop:4, fontStyle:"italic" }}>
                        At {tier} down, first &amp; subsequent use rates are both {tRate} (VA schedule). First/subsequent only differs at &lt;5% down.
                      </div>
                    );
                  }
                  return null;
                })()}
                {vaExempt === "true" && (
                  <div style={{ fontSize:11, color:COLORS.green, fontFamily:font, marginTop:4, fontWeight:600 }}>Exempt — funding fee waived</div>
                )}
              </div>
            )}
            {/* Reset Fees */}
            <div style={{ marginTop:10, textAlign:"right" }}>
              <button onClick={() => {
                setOriginationPct(""); setDiscountPoints("");
              }} style={{ padding:"6px 14px", background:COLORS.grayLight, color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:font }}>
                ↺ Reset Fees
              </button>
            </div>
          </SectionCard>

          {/* ESCROWS — hidden for clients unless they can waive escrows */}
          {(!isClient || canWaiveEscrows) && <SectionCard title="ESCROWS" accent={COLORS.blue}>
            {isGovLoan && (
              <div style={{ fontSize:10, color:COLORS.blue, marginBottom:8, fontFamily:font }}>
                Escrows are mandatory for {loanTypeLabel} loans.
              </div>
            )}
            {fees.isPurchase && fees.inclEscrow && !isClient && (
              <div style={{ marginBottom:8 }}>
                <Toggle label="Simple 12/3/3 Escrows" checked={simpleEscrow} onChange={setSimpleEscrow} />
                {!simpleEscrow && (
                  <div style={{ fontSize:10, color:COLORS.blue, marginTop:2, fontFamily:font, lineHeight:1.5, fontStyle:"italic" }}>
                    Proper RESPA aggregate adjustment active — enter disbursement dates below.
                  </div>
                )}
              </div>
            )}
            {fees.inclEscrow && (!fees.isPurchase || !simpleEscrow) && (
              <div style={{ padding:"10px 12px", background:"#f0f5ff", border:`1px solid ${COLORS.border}`, borderRadius:8, marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:COLORS.blue, letterSpacing:"0.05em", marginBottom:6, fontFamily:font }}>RESPA ESCROW DATES</div>
                <div style={{ fontSize:10, color:COLORS.grayLight, marginBottom:8, fontFamily:font, lineHeight:1.4 }}>
                  Enter the next tax disbursement date for exact reserve calculation. Insurance renewal is always set to 1 year from funding date.
                </div>
                <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:3, fontFamily:font, letterSpacing:"0.04em" }}>
                  Next Tax Due Date{!nextTaxDueDate && <span style={{ color:COLORS.blue, fontWeight:400 }}> — default: Dec 31</span>}
                </label>
                <input type="date" value={nextTaxDueDate || effectiveTaxDue} onChange={e => setNextTaxDueDate(e.target.value)}
                  style={{ width:"100%", padding:"6px 10px", border:`1px solid ${nextTaxDueDate ? COLORS.border : COLORS.blue}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background: nextTaxDueDate ? "#fff" : "#f0f5ff", outline:"none", boxSizing:"border-box", marginBottom:4 }} />
                {!nextTaxDueDate && (() => {
                  const stateInfo = STATE_TAX_DUE_DATES[selectedState];
                  return (
                    <div style={{ fontSize:10, color:COLORS.blue, marginTop:2, marginBottom:4, fontFamily:font, fontStyle:"italic" }}>
                      {stateInfo
                        ? `ℹ In ${stateInfo.name}, property taxes are typically due ${stateInfo.due}. Using Dec 31 default — override above.`
                        : "ℹ Using Dec 31 default — override above to customize."
                      }
                    </div>
                  );
                })()}
                <div style={{ fontSize:10, color:COLORS.green, marginTop:6, fontFamily:font, fontWeight:600 }}>
                  ✓ RESPA calculation active · {fees.taxReserveMonths} mo tax + {fees.insReserveMonths} mo ins
                  {fees.aggregateAdj < 0 ? ` · adj: (${fmt(Math.abs(fees.aggregateAdj))}) credit` : fees.aggregateAdj > 0 ? ` · adj: +${fmt(fees.aggregateAdj)}` : " · adj: $0"}
                </div>
              </div>
            )}
            {canWaiveEscrows && (
              <div>
                <Toggle label="Waive Escrows" checked={waiveEscrows} onChange={setWaiveEscrows} />
                {waiveEscrows && (
                  <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:2, marginBottom:4, fontFamily:font, lineHeight:1.5, fontStyle:"italic" }}>
                    Note: Waiving escrows may incur a 0.25% LLPA pricing adjustment ({fmt(waiveLLPA)}) from the lender.
                    {fees.isPurchase && fees.sellerProratedTaxCredit > 0 && " Seller's prorated tax credit still applies."}
                  </div>
                )}
              </div>
            )}
          </SectionCard>}

          {/* HOA */}
          {fees.isPurchase && (
            <SectionCard title="Homeowners Association (HOA)" accent={COLORS.blue}>
              <LabeledInput label="HOA Transfer Fee"   prefix="$" value={hoaTransferFee} onChange={setHoaTransferFee} useCommas small />
              <LabeledInput label="HOA Dues (monthly)" prefix="$" value={hoaDues} onChange={setHoaDues} useCommas small />
              {fees.hoaMonthly > 0 && (
                <div style={{ marginTop:4, marginBottom:4 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:3, fontFamily:font, letterSpacing:"0.04em" }}>HOA Collection Frequency</label>
                  <select value={hoaFrequency} onChange={e => setHoaFrequency(e.target.value)}
                    style={{ width:"100%", padding:"6px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none" }}>
                    <option value="annual">Annual</option>
                    <option value="semi-annual">Semi-Annual</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                  <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:3, fontFamily:font, fontStyle:"italic", lineHeight:1.4 }}>
                    {hoaFrequency === "annual"      && "Using Jan 1st as the payment date for HOA dues"}
                    {hoaFrequency === "semi-annual" && "Using Jan. 1 and July 1 as payment dates for HOA dues"}
                    {hoaFrequency === "quarterly"   && "Using Jan. 1, Apr. 1, July 1, and Oct. 1 as payment dates for HOA dues"}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* NEW CONSTRUCTION */}
          {fees.isPurchase && (
            <SectionCard title="NEW CONSTRUCTION" accent={COLORS.blue}>
              <Toggle label="New Construction" checked={isNewConstruction} onChange={setIsNewConstruction} />
              {isNewConstruction && (
                <div style={{ marginTop:8 }}>
                  <LabeledInput
                    label="Valuation for Property Taxes"
                    prefix="$"
                    value={valuationForTaxes}
                    onChange={setValuationForTaxes}
                    useCommas
                    small
                    hint="Unimproved land value used by taxing authority for seller proration"
                  />
                  <div style={{ marginTop:6 }}>
                    <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:3, fontFamily:font, letterSpacing:"0.04em" }}>Escrow Type</label>
                    <select value={ncEscrowType} onChange={e => setNcEscrowType(e.target.value)}
                      style={{ width:"100%", padding:"6px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none" }}>
                      <option value="improved">Improved Escrows</option>
                      <option value="unimproved">Unimproved Escrows</option>
                    </select>
                  </div>
                  {fees.effectiveTaxRate > 0 && fees.ncValuation > 0 && (
                    <div style={{ marginTop:6, padding:"7px 10px", background:"#f8fafc", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:10, color:COLORS.grayLight, fontFamily:font, lineHeight:1.7 }}>
                      <div><strong>Estimated Tax Rate:</strong> {(fees.effectiveTaxRate * 100).toFixed(3)}% (derived from monthly taxes ÷ {homesteadExemption ? "estimated 80% tax basis" : "purchase price"})</div>
                      {homesteadExemption && (
                        <div style={{ color:COLORS.blue }}>Est. tax valuation uses approx. 80% of purchase price — a homestead exemption may reduce the taxable value for owner-occupied properties. Actual amounts will vary.</div>
                      )}
                      <div><strong>Improved monthly taxes:</strong> {fmt(Math.round(parseFloat(monthlyTaxes) || 0))} / mo
                        {homesteadExemption ? " (purchase price × 80% × rate)" : " (purchase price × rate)"}
                      </div>
                      <div><strong>Unimproved monthly taxes:</strong> {fmt(Math.round(fees.effectiveTaxRate * fees.ncValuation * homesteadFactor / 12))} / mo
                        {homesteadExemption ? ` (${`$${fees.ncValuation.toLocaleString()}`} × 80% × rate)` : ` (${`$${fees.ncValuation.toLocaleString()}`} × rate)`}
                      </div>
                    </div>
                  )}
                  {ncEscrowType === "improved" && (
                    <div style={{ marginTop:8, padding:"8px 10px", background:"#f0fdf4", border:`1px solid #86efac`, borderRadius:6 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#166534", fontFamily:font, marginBottom:2 }}>✓ Improved Escrows — Good Shape</div>
                      <div style={{ fontSize:10, color:"#166534", fontFamily:font, lineHeight:1.5 }}>
                        Escrows are based on the full improved value. Since the seller owned during the unimproved period, the buyer is paying taxes at the higher rate from day one — they'll likely receive a refund at the first escrow analysis.
                      </div>
                    </div>
                  )}
                  {ncEscrowType === "unimproved" && (
                    <div style={{ marginTop:8, padding:"8px 10px", background:"#fef2f2", border:`1px solid #fca5a5`, borderRadius:6 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#991b1b", fontFamily:font, marginBottom:2 }}>⚠ WARNING: Escrow Shortage Likely</div>
                      <div style={{ fontSize:10, color:"#991b1b", fontFamily:font, lineHeight:1.5 }}>
                        Escrows are based on the unimproved valuation ({fees.ncValuation > 0 ? `$${fees.ncValuation.toLocaleString()}` : "enter valuation above"}). When the full improved assessment is applied — typically within 12–24 months — the escrow account will almost certainly be short, resulting in a significant rebalance and higher monthly payment.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {/* CREDITS & CONTRIBUTIONS */}
          <SectionCard title="CREDITS & CONTRIBUTIONS" accent={COLORS.green}>
            {fees.isPurchase && selectedState === "TX" && <LabeledInput label="Option Money"           prefix="$" value={optionMoney}    onChange={setOptionMoney}    useCommas small />}
            {fees.isPurchase && <LabeledInput label="Earnest Money"         prefix="$" value={earnestMoney}   onChange={setEarnestMoney}   useCommas small />}
            {fees.isPurchase && <LabeledInput label="Realtor Credits" prefix="$" value={realtorContrib} onChange={setRealtorContrib} useCommas small />}

            {/* ── Lender & Seller Credits — inputs first, then side-by-side indicators ── */}
            <LabeledInput label="Lender Credits" prefix="$" value={lenderCredits} onChange={setLenderCredits} useCommas small />
            {fees.isPurchase && <LabeledInput label="Seller Credits" prefix="$" value={sellerCredits} onChange={setSellerCredits} useCommas small />}

            {/* Lender credit over-cap warning */}
            {fees.lenderCred > fees.lenderCredMax && fees.lenderCredMax > 0 && (
              <div style={{ marginTop:4, marginBottom:4, padding:"8px 10px", background:"#fef2f2", border:`2px solid ${COLORS.red}`, borderRadius:6, fontSize:11, fontFamily:font, color:COLORS.red, fontWeight:700, lineHeight:1.5 }}>
                ⚠ LENDER CREDIT EXCEEDS ALLOWABLE MAXIMUM — Lender credits cannot exceed total closing costs + prepaids ({fmt(fees.lenderCredMax)}). Credit must be reduced before closing.
              </div>
            )}

            {/* Seller Credits indicator — purchase only */}
            {fees.isPurchase && fees.sellerConcMax > 0 && (() => {
              const used      = fees.sellerCred + fees.realtor + fees.lenderCred;
              const max       = fees.sellerConcMax;
              const over      = used > max;
              const barPct    = max > 0 ? Math.min(used / max, 1) * 100 : 0;
              const barColor  = over ? COLORS.red : COLORS.green;
              const nearLimit = !over && max > 0 && (max - used) / max < 0.15;
              const ltv       = Math.round((parseFloat(loanAmount)||0) / (parseFloat(purchasePrice)||1) * 100);
              const programLine = loanType === "va"
                ? `Max concessions allowed: ${fees.sellerConcPct}% (${fmt(max)}) for VA loans`
                : loanType === "fha"
                  ? `Max concessions allowed: ${fees.sellerConcPct}% (${fmt(max)}) for FHA loans`
                  : loanType === "usda"
                    ? `Max concessions allowed: ${fees.sellerConcPct}% (${fmt(max)}) for USDA loans`
                    : `Max concessions allowed: ${fees.sellerConcPct}% (${fmt(max)}) for Conventional loans at ${ltv}% LTV${occupancy === "investment" ? " — investment property" : ""}`;
              return (
                <div style={{ marginTop:2, marginBottom:6, fontSize:10, fontFamily:font, background: over ? "#fef2f2" : "#f8f9fb", border: over ? `2px solid ${COLORS.red}` : "none", borderRadius:6, padding:"6px 8px" }}>
                  <div style={{ color:COLORS.grayLight, marginBottom:4 }}>{programLine}</div>
                  {used > 0 && (
                    <div style={{ height:4, borderRadius:2, background:COLORS.border, overflow:"hidden", marginBottom:4 }}>
                      <div style={{ height:"100%", width:`${barPct}%`, background:barColor, borderRadius:2, transition:"width 0.3s" }} />
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ color:COLORS.navy, fontWeight:600 }}>Current Concessions = {fmt(used)}</span>
                    {over
                      ? <span style={{ color:COLORS.red, fontWeight:700 }}>⚠ {fmt(used - max)} over limit</span>
                      : nearLimit
                        ? <span style={{ color:COLORS.red, fontWeight:600 }}>{fmt(max - used)} from limit</span>
                        : null}
                  </div>
                  {over && (
                    <div style={{ marginTop:8, padding:"8px 10px", background:"#fef2f2", border:`1px solid ${COLORS.red}`, borderRadius:6, fontSize:11, color:COLORS.red, fontFamily:font, fontWeight:600, lineHeight:1.6 }}>
                      ⛔ CONCESSION LIMIT EXCEEDED — Concessions are {fmt(used - max)} over the allowable maximum.<br/>
                      <span style={{ fontWeight:400 }}>Concessions can only be applied toward closing costs and prepaids — they cannot be used to cover the down payment. The buyer must source any excess from their own funds. Reduce concessions or adjust the loan structure.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const totalUsed = fees.earnest + fees.option + fees.lenderCred + fees.sellerCred + fees.realtor + fees.sellerSurveyCredit + fees.sellerHWCredit;
              if (totalUsed === 0) return <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:4, fontFamily:font }}>Credits reduce cash to close.</div>;
              return (
                <div style={{ borderTop:`1px solid ${COLORS.border}`, marginTop:4, paddingTop:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:font }}>
                    <span style={{ color:COLORS.grayLight, fontWeight:600 }}>Total Credits Applied</span>
                    <span style={{ fontWeight:700, color:COLORS.red }}>{fmt(totalUsed)}</span>
                  </div>
                </div>
              );
            })()}
            <div style={{ marginTop:10, textAlign:"right" }}>
              <button onClick={() => {
                setOptionMoney(""); setEarnestMoney(""); setRealtorContrib("");
                setLenderCredits(""); setSellerCredits("");
              }} style={{ padding:"6px 14px", background:COLORS.grayLight, color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:font }}>
                ↺ Reset Credits
              </button>
            </div>
          </SectionCard>

          {/* CLOSING & FUNDING DATES */}
          <SectionCard title="CLOSING & FUNDING DATES" accent={COLORS.blue}>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:4, fontFamily:font, letterSpacing:"0.04em" }}>Closing Date</label>
              <input type="date" value={closingDate} onChange={e => {
                const val = e.target.value;
                if (!val) { setClosingDate(val); return; }
                if (isWeekend(val)) { alert("Closing date cannot be on a weekend. Please select a business day."); return; }
                const yr = parseInt(val.split("-")[0]);
                if (isHoliday(val, yr)) { alert("Closing date falls on " + getHolidayName(val, yr) + ". Please select a business day."); return; }
                setClosingDate(val);
              }} style={{ width:"100%", padding:"8px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none", boxSizing:"border-box" }} />
              {fees.shortPayAdj > 0 ? (
                <div style={{ marginTop:4, padding:"4px 8px", borderRadius:5, background:"#FFF3E0", border:"1px solid #B86B00", fontFamily:font }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#B86B00" }}>⚠ Short Pay Active</span>
                  <span style={{ fontSize:11, color:"#7A4500" }}> — prepaid interest zeroed; servicer credits back interest already collected</span>
                </div>
              ) : (
                <div style={{ fontSize:11, color:COLORS.grayLight, marginTop:2, fontFamily:font }}>
                  {fees.prepaidDays + " days prepaid interest"}
                  {fees.totalReserves > 0 ? " · escrow reserves" : ""}
                  {parsedCD.day >= 1 && parsedCD.day <= 5 && !shortPay
                    ? <span style={{ color:"#B86B00", fontWeight:600 }}> · 💡 Day {parsedCD.day} close — short pay may apply</span>
                    : null}
                  {(() => { const hName = getHolidayName(closingDate, parsedCD.year); return hName ? " · ⚠ " + hName : ""; })()}
                </div>
              )}
              <details style={{ marginTop:4 }}>
                <summary style={{ fontSize:10, color:COLORS.blue, cursor:"pointer", fontFamily:font }}>View Federal Holidays ({parsedCD.year})</summary>
                <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:4, fontFamily:font, lineHeight:1.8, paddingLeft:8 }}>
                  {getFederalHolidays(parsedCD.year).map((h, i) => <div key={i}>{h.observed.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} — {h.name}</div>)}
                </div>
              </details>
            </div>
            {fundingDate && (
              <div style={{ background:"#f0f5ff", border:`1px solid ${COLORS.border}`, borderRadius:8, padding:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:COLORS.blue, fontFamily:font }}>Funding Date</span>
                  <span style={{ fontSize:13, fontWeight:700, color:COLORS.navy, fontFamily:font }}>{fmtDate(fundingDate)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, fontWeight:600, color:COLORS.blue, fontFamily:font }}>1st Payment Due</span>
                  <span style={{ fontSize:13, fontWeight:700, color:COLORS.navy, fontFamily:font }}>{fmtDate(firstPayDate)}</span>
                </div>
                {firstPayDate && fundingDate && (() => {
                  const fundMo   = fundingDate.getMonth() + 1;
                  const fundDay  = fundingDate.getDate();
                  const fundYear = fundingDate.getFullYear();
                  const endDay   = new Date(fundYear, fundMo, 0).getDate();
                  const firstMo  = firstPayDate.getMonth() + 1;
                  const firstDay = firstPayDate.getDate();
                  const coversMo = firstMo === 1 ? 12 : firstMo - 1;
                  return (
                    <div style={{ marginTop:8, padding:"8px 10px", background:"#f0f5ff", borderRadius:6, fontSize:10, color:COLORS.grayLight, fontFamily:font, lineHeight:1.6 }}>
                      <span style={{ fontWeight:700, color:COLORS.navy }}>Why does my first payment skip a month?</span>
                      <div style={{ marginTop:4 }}>
                        Mortgage interest is paid <em>in arrears</em> — each payment covers the <em>prior</em> month's interest. At closing, prepaid interest is collected from {fundMo}/{fundDay} through {fundMo}/{endDay}. Your {firstMo}/{firstDay} payment then covers the interest for {coversMo}/1 through {coversMo}/{endDay}.
                      </div>
                    </div>
                  );
                })()}
                {isRefiTXHomestead && (
                  <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:8, fontFamily:font, fontStyle:"italic", lineHeight:1.4 }}>
                    TX homestead refi — 3-day TILA right of rescission applied (Sat counts; Sun &amp; federal holidays excluded)
                  </div>
                )}
              </div>
            )}
            {fundingDate && fundingDate.getDate() <= 5 && (
              <div style={{ borderTop:`1px solid ${COLORS.border}`, marginTop:10, paddingTop:10 }}>
                <Toggle label="Short Pay (1st–5th closing)" checked={shortPay} onChange={setShortPay} />
                {shortPay && <div style={{ fontSize:10, color:COLORS.green, marginTop:2, fontFamily:font }}>Short pay active — prepaid interest zeroed, first payment starts same month</div>}
              </div>
            )}
          </SectionCard>

        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div>
          {/* Blue summary header */}
          <div style={{ background:`linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius:12, padding:20, color:"#fff", marginBottom:16, textAlign:"center" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:"0.1em", opacity:0.7 }}>ESTIMATED TOTAL CASH TO CLOSE</div>
            <div style={{ fontSize:44, fontWeight:800, fontFamily:font }}>{fmt(fees.grandTotal + (fees.isPurchase?(parseFloat(purchasePrice)||0)-(parseFloat(loanAmount)||0):0))}</div>
            <div style={{ fontSize:13, opacity:0.8, marginTop:4, fontFamily:font }}>
              {stateName} · {fees.isPurchase ? "Purchase" : "Refinance"} · {loanTypeLabel}
            </div>
            <div style={{ fontSize:13, opacity:0.65, marginTop:6, fontFamily:font }}>
              {fmt(parseFloat(purchasePrice)||0)} {fees.isPurchase ? "Purchase" : "Value"}&nbsp;&nbsp;|&nbsp;&nbsp;{fmt(parseFloat(loanAmount)||0)} Loan&nbsp;&nbsp;|&nbsp;&nbsp;{rate}% Rate
            </div>
          </div>

          <SectionCard title={`CLOSING COST ESTIMATE — ${stateName.toUpperCase()}`}>
            {/* LENDER FEES */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>LENDER FEES</div>
              <FeeRow label="Origination Fee *"  amount={fees.origination}  indent />
              <FeeRow label="Discount Points *"  amount={fees.discount}     indent />
              <FeeRow label="Underwriting Fee *" amount={fees.underwriting}  indent editKey="uw"   editValue={ovUnderwriting} onEdit={setOvUnderwriting} defaultVal={fees._defaults.underwriting}  isInternal={isInternal} />
              <FeeRow label="Processing Fee *"   amount={fees.processingFee} indent editKey="proc" editValue={ovProcessing}   onEdit={setOvProcessing}   defaultVal={fees._defaults.processingFee} isInternal={isInternal} />
              {fees.govUpfrontFee > 0 && (
                <div style={{ borderTop:`1px dashed ${COLORS.border}`, marginTop:4, paddingTop:4 }}>
                  <FeeRow
                    label={loanType==="va" ? `VA Funding Fee (${(fees.vaFeeRate*100).toFixed(2)}%) — rolled into loan` : loanType==="fha" ? "FHA Upfront MIP (1.75%) — rolled into loan" : "USDA Guarantee Fee (1.0%) — rolled into loan"}
                    amount={fees.govUpfrontFee} indent color={COLORS.blue} />
                  <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, paddingLeft:20, marginBottom:4, lineHeight:1.4 }}>↑ Financed into loan — not included in cash to close</div>
                </div>
              )}
              <FeeRow label="Subtotal — Lender Fees" amount={fees.lenderFees} bold />
            </div>

            {/* THIRD PARTY FEES */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>THIRD PARTY FEES</div>
              <FeeRow label={fees.piw ? "Appraisal: Waived — Property Inspection Waiver granted" : "Appraisal"} amount={fees.appraisal} indent editKey={fees.piw ? null : "appr"} editValue={ovAppraisal} onEdit={setOvAppraisal} defaultVal={fees._defaults.appraisal} isInternal={isInternal} />
              <FeeRow label="Credit & Verifications" amount={fees.creditReport} indent editKey="cr"      editValue={ovCreditReport} onEdit={setOvCreditReport} defaultVal={fees._defaults.creditReport}  isInternal={isInternal} />
              <FeeRow label="Flood Certification *"          amount={fees.floodCert}    indent editKey="flood"   editValue={ovFloodCert}    onEdit={setOvFloodCert}    defaultVal={fees._defaults.floodCert}    isInternal={isInternal} />
              <FeeRow label="Tax Service Fee *"              amount={fees.taxService}   indent editKey="taxsvc"  editValue={ovTaxService}   onEdit={setOvTaxService}   defaultVal={fees._defaults.taxService}   isInternal={isInternal} />
              <FeeRow label="Doc Prep *"                     amount={fees.docPrep}      indent editKey="docprep" editValue={ovDocPrep}      onEdit={setOvDocPrep}      defaultVal={fees._defaults.docPrep}      isInternal={isInternal} />
              {fees.survey > 0 && <FeeRow label="Survey" amount={fees.survey} indent editKey="survey" editValue={ovSurvey} onEdit={setOvSurvey} defaultVal={fees._defaults.survey} isInternal={isInternal} />}
              {fees.isPurchase && sellerPaidSurvey && fees.survey > 0 && <FeeRow label="Survey (Seller Paid)" amount={-fees.survey} indent color={COLORS.red} />}
              <FeeRow label="Subtotal — Third Party" amount={fees.thirdPartyFees} bold />
            </div>

            {/* TITLE & CLOSING FEES */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>TITLE & CLOSING FEES</div>
              {fees.isPurchase && <FeeRow label="Owner's Title Policy" amount={fees.ownerTitlePolicy} indent />}
              {sellerPaidTitle && fees.ownerTitlePolicy > 0 && <FeeRow label="Owner's Title (Seller Paid)" amount={-fees.ownerTitlePolicy} indent color={COLORS.red} />}
              <FeeRow label={fees.titleWaived ? "Lender's Title Policy — Waived" : fees.isPurchase ? "Lender's Title (Simultaneous)" : "Lender's Title Policy"} amount={fees.lenderTitlePolicy} indent />
              {fees.titleWaived && <div style={{ fontSize:10, color:COLORS.green, fontFamily:font, paddingLeft:20, marginBottom:4, lineHeight:1.4 }}>✅ Title policy waived — special program</div>}
              {isInternal && fees.endorsementTotal>0 && <FeeRow label="Title Policy Endorsements" amount={fees.endorsementTotal} indent />}
              <FeeRow label="Escrow/Settlement Fee" amount={fees.escrowFee}   indent editKey="escfee" editValue={ovEscrowFee}   onEdit={setOvEscrowFee}   defaultVal={fees._defaults.escrowFee}   isInternal={isInternal} />
              <FeeRow label="Title Search"          amount={fees.titleSearch} indent editKey="tsrch"  editValue={ovTitleSearch} onEdit={setOvTitleSearch} defaultVal={fees._defaults.titleSearch}  isInternal={isInternal} />
              <FeeRow label="Recording Fees"                      amount={fees.recordingFees}     indent />
              <FeeRow label="Title Courier"                       amount={fees.titleCourier}      indent />
              <FeeRow label="Tax Cert / E-Recording / Estate Guar." amount={fees.taxCertERecording} indent />
              {fees.transferTax > 0    && <FeeRow label={fees.transferTaxLabel}       amount={fees.transferTax}    indent />}
              {fees.attorneyFee > 0    && <FeeRow label="Attorney / Closing Fee"      amount={fees.attorneyFee}    indent />}
              <FeeRow label="Subtotal — Title" amount={fees.titleFees} bold />
            </div>

            {/* PREPAIDS & ESCROW */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>PREPAIDS & ESCROW</div>
              <FeeRow label={`Prepaid Interest (${fees.shortPayAdj>0?"Short Pay":fees.prepaidDays+" days"})`} amount={fees.adjustedPrepaidInterest} indent />
              {fees.homeownersInsurance > 0 && (
                <FeeRow label={`Homeowners Insurance (12 mo × ${fmt(fees.insMonthly)}/mo)`} amount={fees.homeownersInsurance} indent />
              )}
              {fees.totalReserves > 0 && (
                <>
                  <FeeRow label={`Tax Reserves (${fees.taxReserveMonths} mo × ${fmt(fees.taxMonthly)}/mo)`}       amount={fees.taxReserves} indent color={COLORS.green} />
                  {isNewConstruction && fees.effectiveTaxRate > 0 && fees.ncValuation > 0 && (() => {
                    const improvedMo   = Math.round(fees.taxMonthly);
                    const unimprovedMo = Math.round(fees.effectiveTaxRate * fees.ncValuation * homesteadFactor / 12);
                    const isUnimp      = ncEscrowType === "unimproved";
                    return (
                      <div style={{ fontSize:10, color: isUnimp ? "#991b1b" : "#166534", fontFamily:font, fontStyle:"italic", marginTop:-4, marginBottom:4, paddingLeft:16, lineHeight:1.5 }}>
                        {isUnimp
                          ? `⚠ New construction — escrows collected at unimproved rate (${fmt(unimprovedMo)}/mo). Once the full improved assessment is applied, taxes will jump to ${fmt(improvedMo)}/mo — escrows will likely be short and a rebalance is expected within 12–24 months.`
                          : `✓ New construction — escrows collected at full improved rate (${fmt(improvedMo)}/mo). Seller owned during the unimproved period (${fmt(unimprovedMo)}/mo), so buyer is over-collecting from day one — a refund is likely at the first escrow analysis.`
                        }
                      </div>
                    );
                  })()}
                  <FeeRow label={`Insurance Reserves (${fees.insReserveMonths} mo × ${fmt(fees.insMonthly)}/mo)`} amount={fees.insReserves} indent color={COLORS.green} />
                  {fees.aggregateAdj !== 0 && (
                    <FeeRow
                      label="Escrow Aggregate Adjustment"
                      amount={fees.aggregateAdj}
                      indent
                      color={fees.aggregateAdj < 0 ? COLORS.red : COLORS.green}
                    />
                  )}
                </>
              )}
              {!fees.inclEscrow && waiveEscrows && (
                <FeeRow label="Escrow Account: None — Escrows Waived" amount={0} indent color={COLORS.grayLight} />
              )}
              <FeeRow label="Subtotal — Prepaids" amount={fees.totalPrepaids} bold />
              {fees.inclEscrow && (
                <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:4, fontFamily:font, lineHeight:1.4 }}>
                  Monthly escrow: {fmt(fees.taxMonthly)}/mo tax + {fmt(fees.insMonthly)}/mo ins = {fmt(fees.taxMonthly+fees.insMonthly)}/mo
                  {fees.aggregateAdj !== 0 && (
                    <span> · aggregate adj {fees.aggregateAdj < 0 ? `(${fmt(Math.abs(fees.aggregateAdj))}) credit` : `+${fmt(fees.aggregateAdj)}`}</span>
                  )}
                </div>
              )}
            </div>

            {/* ADDITIONAL FEES */}
            {(fees.homeWarranty>0 || fees.hoaTransfer>0 || fees.hoaDuesAmt>0) && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>ADDITIONAL FEES</div>
                {fees.homeWarranty  > 0 && <FeeRow label="Home Warranty"             amount={fees.homeWarranty}      indent editKey="hw" editValue={ovHomeWarranty} onEdit={setOvHomeWarranty} defaultVal={fees._defaults.homeWarranty} isInternal={isInternal} />}
                {fees.sellerHWCredit> 0 && <FeeRow label="Home Warranty (Seller Paid)" amount={-fees.sellerHWCredit}  indent color={COLORS.red} />}
                {fees.hoaTransfer   > 0 && <FeeRow label="HOA Transfer Fee"            amount={fees.hoaTransfer}      indent />}
                {fees.hoaDuesAmt > 0 && (
                  <div>
                    <FeeRow label={`HOA Dues: ${fees.fundingDateFmt} through ${fees.nextHoaDateFmt}`} amount={fees.hoaDuesAmt} indent />
                    <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, fontStyle:"italic", paddingLeft:16, marginTop:-2, marginBottom:4 }}>
                      {`Credit to Seller's for Prepaid HOA Dues: ${fees.hoaProrationDays} days`}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CREDITS */}
            {(fees.earnest>0||fees.option>0||fees.lenderCred>0||fees.sellerCred>0||fees.realtor>0||fees.shortPayAdj>0||fees.sellerProratedTaxCredit>0) && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>CREDITS</div>
                {fees.option      > 0 && <FeeRow label="Option Money"          amount={-fees.option}     indent color={COLORS.red} />}
                {fees.earnest     > 0 && <FeeRow label="Earnest Money Deposit" amount={-fees.earnest}    indent color={COLORS.red} />}
                {fees.isPurchase && fees.sellerCred > 0 && <FeeRow label="Seller Credits" amount={-fees.sellerCred} indent color={COLORS.red} />}
                {fees.realtor     > 0 && <FeeRow label="Realtor Credits"  amount={-fees.realtor}   indent color={COLORS.red} />}
                {fees.lenderCred  > 0 && <FeeRow label="Lender Credits"         amount={-fees.lenderCred} indent color={COLORS.red} />}
                {fees.shortPayAdj > 0 && <FeeRow label="Short Pay Adjustment"   amount={-fees.shortPayAdj} indent color={COLORS.red} />}
                {fees.sellerProratedTaxCredit > 0 && (
                  <div>
                    <FeeRow label={`Seller's Prorated Tax Credit (${fees.sellerProratedDays} days)`} amount={-fees.sellerProratedTaxCredit} indent color={COLORS.red} />
                    <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, fontStyle:"italic", paddingLeft:16, marginTop:-2, marginBottom:4 }}>
                      {isNewConstruction && fees.effectiveTaxRate > 0 && fees.ncValuation > 0
                        ? `New construction — seller credit calculated at unimproved rate (${fmt(Math.round(fees.effectiveTaxRate * fees.ncValuation * homesteadFactor / 12))}/mo) for ${fees.sellerProratedDays} days. Buyer will be assessed at the improved rate (${fmt(Math.round(fees.taxMonthly))}/mo) once full assessment is applied.`
                        : `Buyer pays full-year taxes at year-end; seller credits their prorated share (${fmt(Math.round(fees.taxMonthly))}/mo) for ${fees.sellerProratedDays} days owned.`
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DEBT PAYOFFS AT CLOSING */}
            {fees.debtPayoffs > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#92400e", letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>DEBT PAYOFFS AT CLOSING</div>
                <FeeRow label="Debt Payoffs (from DTI tab)" amount={fees.debtPayoffs} indent color="#92400e" />
              </div>
            )}

            {/* TOTAL CASH TO CLOSE summary box */}
            {(() => {
              const dp = fees.isPurchase ? (parseFloat(purchasePrice)||0)-(parseFloat(loanAmount)||0) : 0;
              return (
                <div style={{ marginTop:16, padding:"14px 16px", background:`linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Closing Costs</span>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(fees.totalClosingCosts)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Prepaids & Escrow</span>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(fees.totalPrepaids)}</span>
                  </div>
                  {fees.debtPayoffs > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Debt Payoffs at Closing</span>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(fees.debtPayoffs)}</span>
                    </div>
                  )}
                  {dp > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Down Payment</span>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(dp)}</span>
                    </div>
                  )}
                  <div style={{ borderTop:"1px solid rgba(255,255,255,0.3)", marginTop:6, paddingTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"#fff", fontFamily:font }}>TOTAL CASH TO CLOSE</span>
                    <span style={{ fontSize:20, fontWeight:800, color:"#fff", fontFamily:font }}>{fmt(fees.grandTotal+dp)}</span>
                  </div>
                </div>
              );
            })()}

            <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:10, lineHeight:1.5, fontFamily:font }}>
              * Fees marked with * are finance charges included in the APR calculation (Origination, Discount Points, Underwriting, Processing, Flood Cert, Tax Service, Doc Prep).
            </div>
            <div style={{ fontSize:11, color:COLORS.grayLight, marginTop:4, lineHeight:1.5, fontFamily:font }}>
              ** {fees.disclaimer || `Title insurance rates in ${stateName} are estimates. Fees may vary by title company and lender.`}
            </div>

            {/* Reset Fees */}
            {isInternal && (
              <div className="mtk-no-print" style={{ marginTop:12, textAlign:"right" }}>
                <button onClick={() => {
                  setOvUnderwriting(""); setOvProcessing(""); setOvAppraisal("");
                  setOvCreditReport(""); setOvFloodCert(""); setOvTaxService("");
                  setOvDocPrep(""); setOvSurvey(""); setOvEscrowFee("");
                  setOvTitleSearch(""); setOvHomeWarranty("");
                }} style={{ padding:"8px 16px", background:COLORS.grayLight, color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:font }}>
                  ↺ Reset Fees
                </button>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

window.FeeSheetGenerator = FeeSheetGenerator;
