// modules/calculators/FeeSheetGenerator.js
const { useState, useEffect, useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const getStateFees = window.getStateFees;
const pmt = window.pmt;
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

// ── PDF print-div helpers — defined at FILE SCOPE so Babel never re-creates them ──
function PdfRow(props) {
  var label = props.label, amt = props.amt, indent = props.indent, bold = props.bold, isRed = props.isRed, muted = props.muted;
  var zero  = Math.round(Math.abs(amt||0)) === 0;
  var color = zero ? "#d1d5db" : isRed ? "#dc2626" : bold ? "#162447" : muted ? "#9ca3af" : "#374151";
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:(bold?"6px 0 6px ":"3px 0 3px ")+(indent?"14px":"0px"), fontSize:10, fontWeight:bold?700:400, color:color, borderTop:bold?"1px solid #e2e8f0":undefined, marginTop:bold?3:0 }}>
      <span style={{ paddingRight:4 }}>{label}</span>
      <span style={{ whiteSpace:"nowrap", fontWeight:bold?700:600 }}>{zero?(bold?fmt(0):"—"):(amt<0?"("+fmt(-Math.round(amt))+")":fmt(Math.round(amt)))}</span>
    </div>
  );
}
function PdfSection(props) {
  return <div style={{ fontSize:10, fontWeight:800, color:"#1d4ed8", letterSpacing:"0.09em", marginTop:10, marginBottom:3, paddingBottom:3, borderBottom:"1.5px solid #bfdbfe" }}>{props.title}</div>;
}

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

// Defined at module scope so React doesn't recreate it on every parent render.
function OtherFeeAmtInput({ amt, setAmt, border }) {
  const [focused, setFocused] = React.useState(false);
  const raw = amt || "";
  const parsed = parseFloat(raw);
  const display = (!focused && raw !== "" && !isNaN(parsed)) ? (parsed < 0 ? "-" : "") + Math.abs(Math.round(parsed)).toLocaleString("en-US") : raw;
  return (
    <input
      type="text"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => { const v = e.target.value.replace(/[^0-9\-]/g, "").replace(/(?!^)-/g, ""); setAmt(v); }}
      placeholder="0"
      style={{ width:100, padding:"6px 8px", border:`1px solid ${border || COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", textAlign:"right", outline:"none" }}
    />
  );
}

// New-construction property tax valuation percentages by closing month (Jan=0 … Dec=11).
// Jan–May sourced from builder CFO guidance. Jun–Dec extrapolated at –10%/mo, floor 10%.
// Logic: taxable value on Jan 1 reflects how complete the home was on that date.
// The earlier in the year you close, the more complete the home was on Jan 1 → higher %.
const NC_MONTH_PCT   = [90, 80, 70, 60, 50, 40, 30, 20, 10, 10, 10, 10];
const NC_MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Temporary buydown rate-reduction schedules (reductions in % per year)
const TEMP_BD_SCHEDULES_FS = { "3/2/1": [3, 2, 1], "2/1": [2, 1], "1/1": [1, 1], "1/0": [1] };

function FeeSheetGenerator({ isInternal = false, user = null }) {
  const userId  = user?.id   || "default";
  const isAdmin  = user?.role === "admin";
  const isClient = user?.role === "borrower";
  const canEditFees = isInternal || ['borrower', 'realtor', 'builder'].includes(user?.role);

  // ── Shared with Payment Calculator ─────────────────────────────────────────
  const [selectedState,   setSelectedState]   = useLocalStorage("pc_state",    "TX");
  const [transactionType] = useLocalStorage("pc_purpose",   "purchase");
  const [purchasePrice,   setPurchasePrice]   = useLocalStorage("pc_hp",       "425000");
  const [loanAmount,      setLoanAmount]      = useLocalStorage("pc_la",       "340000");
  const [loanType,        setLoanType]        = useLocalStorage("pc_prog",     "conventional");
  const [rate,            setRate]            = useLocalStorage("pc_rate",     "6.75");
  const [term]                               = useLocalStorage("pc_term",     "30");
  const [vaFirst,         setVaFirst]         = useLocalStorage("pc_va_first",  "true");
  const [vaExempt,        setVaExempt]        = useLocalStorage("pc_va_exempt", "false");
  const [vaDisabilityPct]                     = useLocalStorage("pc_va_dis",    "0");
  const [vaServiceType]                       = useLocalStorage("pc_va_svc",    "active");
  const [occupancy]                           = useLocalStorage("pc_occ",      "primary");
  const [fsFicoScore]                         = useLocalStorage("pc_fico",     "740");
  const [fsCoBorroFico]                       = useLocalStorage("pc_cofico",   "740");
  const [fsBorrowerCount]                     = useLocalStorage("pc_borrowers","1");
  const [fsMiPremiumType]                     = useLocalStorage("pc_mitype",   "monthly");
  const [fsDpaProgram]                        = useLocalStorage("pc_dpa_prog", "none");
  const [fsDpaAmount]                         = useLocalStorage("pc_dpa_amt",  "");
  const [fsDpaType]                           = useLocalStorage("pc_dpa_type", "grant");

  // ── Fee Sheet–specific ─────────────────────────────────────────────────────
  // Title Endorsement engine inputs — computed inline so no tab visit is required
  const [pcPropType]     = useLocalStorage("pc_proptype",   "sfr");
  const [pcUpfrontMode, setPcUpfrontMode] = useLocalStorage("pc_upfront_mode", "rolled_in");
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
    d.setDate(d.getDate() + 30);
    const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    // Advance past weekends and federal holidays
    while (d.getDay() === 0 || d.getDay() === 6 || (window.isHoliday && window.isHoliday(fmt(d)))) d.setDate(d.getDate() + 1);
    return fmt(d);
  })();
  const [closingDate,       setClosingDate]       = useLocalStorage("fs_closing_date", defaultCD);
  const [waiveEscrows,      setWaiveEscrows]      = useLocalStorage("fs_waive_esc",    false);
  const [collect90Ins,      setCollect90Ins]      = useLocalStorage("pc_collect_90_ins", true);
  const [monthlyTaxes,      setMonthlyTaxes]      = useLocalStorage("fs_mt",           "625");
  const [monthlyInsurance,  setMonthlyInsurance]  = useLocalStorage("fs_mi",           "200");
  const [originationPct,    setOriginationPct]    = useLocalStorage("fs_op",           "0");
  const [discountPoints,    setDiscountPoints]    = useLocalStorage("fs_dp",           "0");
  const [includeSurvey,     setIncludeSurvey]     = useLocalStorage("fs_sv",           true);
  const [includeHomeWarranty,setIncludeHomeWarranty]=useLocalStorage("fs_hw",          false);
  const [earnestMoney,      setEarnestMoney]      = useLocalStorage("fs_em",           "");
  const [optionMoney,       setOptionMoney]       = useLocalStorage("fs_om",           "");
  const [lenderCredits,     setLenderCredits]     = useLocalStorage("fs_lc",           "");
  const [convMiFinanced,    setConvMiFinanced]    = useLocalStorage("fs_conv_mi_fin",   "true");
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
  // Temporary buydown
  const [fsTempBd, setFsTempBd] = useLocalStorage("fs_temp_bd", "none");
  const [valuationForTaxes, setValuationForTaxes] = useLocalStorage("fs_val_tax",    "");
  const [ncEscrowType,      setNcEscrowType]       = useLocalStorage("fs_nc_escrow",  "improved");
  const [ncProratedType,    setNcProratedType]     = useLocalStorage("fs_nc_pror",    "unimproved");
  // Survey: Seller Providing Existing Survey (T47 affidavit fee in title section)
  const [sellerExistingSurvey, setSellerExistingSurvey] = useLocalStorage("fs_ses",      false);
  const [ovT47,                setOvT47]                = useLocalStorage("fs_ov_t47",   "");
  // DPA program-specific option toggles (TDHCA MCC fees)
  const [tdhcaMccCombo,      setTdhcaMccCombo]      = useLocalStorage("fs_tdhca_mcc_combo",      false);
  const [tdhcaMccStandalone, setTdhcaMccStandalone] = useLocalStorage("fs_tdhca_mcc_standalone", false);

  // Other Fees (three free-form user-defined fees)
  const [otherFee1Label, setOtherFee1Label] = useLocalStorage("fs_other1_label", "");
  const [otherFee1Amt,   setOtherFee1Amt]   = useLocalStorage("fs_other1_amt",   "");
  const [otherFee2Label, setOtherFee2Label] = useLocalStorage("fs_other2_label", "");
  const [otherFee2Amt,   setOtherFee2Amt]   = useLocalStorage("fs_other2_amt",   "");
  const [otherFee3Label, setOtherFee3Label] = useLocalStorage("fs_other3_label", "");
  const [otherFee3Amt,   setOtherFee3Amt]   = useLocalStorage("fs_other3_amt",   "");
  // Realtor Commissions: Buyer Paid (Contract Details section)
  const [rcBuyerVal,  setRcBuyerVal]  = useLocalStorage("fs_rc_buyer_val",  "");
  const [rcBuyerMode, setRcBuyerMode] = useLocalStorage("fs_rc_buyer_mode", "pct");

  // Homestead — mirrors Payment Calculator logic (TX primary = 80% tax basis)
  const [pcOccupancy] = useLocalStorage("pc_occ", "primary");
  const homesteadExemption = selectedState === "TX" && pcOccupancy === "primary";
  const homesteadFactor    = homesteadExemption ? 0.80 : 1.0;
  // hoaDues now shares pc_hoa key with PaymentCalculator — bidirectional sync
  // Debt payoffs at closing — written by DTICalculator, consumed here
  const [dtiPayoffBal] = useLocalStorage("dti_payoff_bal", "0");
  // Refi: estimated payoff — auto-populated from PC Loan Sizing Worksheet "Amount Due"
  const [rs2AmountDue] = useLocalStorage("pc_rs2_amount_due", "");
  // Cross-tab reads from Refi Analyzer (internal)
  const [raPiw, setRaPiw]             = useLocalStorage("ra_piw",       false);
  const [raSurveyOpt]                 = useLocalStorage("ra_survey_opt", "na");
  const raNewSurvey = raSurveyOpt === "order";
  const [raInsOpt]                    = useLocalStorage("ra_ins_opt",    "na");
  const [raWaiveTitle, setRaWaiveTitle] = useLocalStorage("ra_waivtitle", false);
  const [raEscBal]                      = useLocalStorage("ra_escbal", "");
  const [raNetEsc]                      = useLocalStorage("ra_netesc", false);
  const [raCurPI]                       = useLocalStorage("ra_curpi",          "");
  const [raFirstPmtDate]                = useLocalStorage("ra_first_pmt_date", "");

  // Per-transaction overrides (inline editing on right column)
  const [ovUnderwriting, setOvUnderwriting] = useLocalStorage("fs_ov_uw",      "");
  const [ovProcessing,   setOvProcessing]   = useLocalStorage("fs_ov_proc",    "");
  const [ovAppraisal,       setOvAppraisal]       = useLocalStorage("fs_ov_appr",    "");
  const [ovAppraisalReview, setOvAppraisalReview] = useLocalStorage("fs_ov_appr_rev","");
  const [s2LienEnabled]                           = useLocalStorage("pc_2nd_enabled", "false");
  const [insOutsideClosing,  setInsOutsideClosing]  = useLocalStorage("fs_ins_poc",       false);
  const [appraisalPOC,       setAppraisalPOC]       = useLocalStorage("fs_appr_poc",      true);
  const [ownerExistingSurvey,setOwnerExistingSurvey]= useLocalStorage("fs_owner_survey",  false);
  const [origTitleDate,      setOrigTitleDate]       = useLocalStorage("ra_notedate",      "");
  const [ovS2LienFee,       setOvS2LienFee]       = useLocalStorage("fs_ov_2nd_fee", "");
  const [ovCreditReport, setOvCreditReport] = useLocalStorage("fs_ov_cr",      "");
  const [ovFloodCert,    setOvFloodCert]    = useLocalStorage("fs_ov_flood",   "");
  const [ovTaxService,   setOvTaxService]   = useLocalStorage("fs_ov_taxsvc",  "");
  const [ovDocPrep,      setOvDocPrep]      = useLocalStorage("fs_ov_docprep", "");
  const [ovSurvey,       setOvSurvey]       = useLocalStorage("fs_ov_survey",  "");
  const [ovEscrowFee,    setOvEscrowFee]    = useLocalStorage("fs_ov_escfee",  "");
  const [ovTitleSearch,  setOvTitleSearch]  = useLocalStorage("fs_ov_tsrch",   "");
  const [ovRecordingFee, setOvRecordingFee] = useLocalStorage("fs_ov_rec",     "");
  const [ovTitleCourier, setOvTitleCourier] = useLocalStorage("fs_ov_cour",    "");
  const [ovTaxCert,      setOvTaxCert]      = useLocalStorage("fs_ov_taxcert", "");
  const [ovHomeWarranty,   setOvHomeWarranty]   = useLocalStorage("fs_ov_hw",      "");
  const [ovPestInspection, setOvPestInspection] = useLocalStorage("fs_ov_pest",   "");
  const [ovBondFee,        setOvBondFee]        = useLocalStorage("fs_ov_bond",   "");

  // PDF export
  const pdfRef     = React.useRef(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfDualCol, setPdfDualCol] = useState(false);
  // Reset to single-column whenever fees change, then measure and upgrade if needed
  React.useLayoutEffect(() => { setPdfDualCol(false); }, [fees]);
  React.useLayoutEffect(() => {
    if (pdfDualCol || !pdfRef.current) return;
    if (pdfRef.current.scrollHeight > 1020) setPdfDualCol(true);
  }, [pdfDualCol, fees]);

  // LO-specific defaults (per user, persistent)
  const [loDefOrigination, setLoDefOrigination] = useLocalStorage(`${userId}_lo_orig`,    "0");
  const [loDefDiscount,    setLoDefDiscount]    = useLocalStorage(`${userId}_lo_disc`,    "0");
  const [loDefUw,          setLoDefUw]          = useLocalStorage(`${userId}_lo_uw`,      "605");
  const [loDefProc,        setLoDefProc]        = useLocalStorage(`${userId}_lo_proc`,    "1045");
  const [loDefAppraisal,   setLoDefAppraisal]   = useLocalStorage(`${userId}_lo_appr`,   "625");
  const [loDefCreditReport,setLoDefCreditReport]= useLocalStorage(`${userId}_lo_cr`,     "445");
  const [loDefFloodCert,   setLoDefFloodCert]   = useLocalStorage(`${userId}_lo_flood`,  "");
  const [loDefTaxService,  setLoDefTaxService]  = useLocalStorage(`${userId}_lo_taxsvc`, "70");
  const [loDefSurvey,      setLoDefSurvey]      = useLocalStorage(`${userId}_lo_survey`, "510");
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
  // ownerExistingSurvey (refi) mirrors sellerExistingSurvey (purchase) — hides cost, shows T-47
  const isPurchase = transactionType === "purchase";
  const effectiveSurvey = includeSurvey || raNewSurvey;
  // For refi, only ownerExistingSurvey applies — sellerExistingSurvey from a prior purchase session must not bleed in
  const effectiveExistingSurvey = isPurchase ? sellerExistingSurvey : (ownerExistingSurvey || raSurveyOpt === "provide");
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
  const FS_PROG_LABELS = { conventional:"Conventional", homeready:"HomeReady", homeposs:"Home Possible", hfa_fannie:"HFA Preferred", hfa_freddie:"HFA Advantage", fha:"FHA", va:"VA", usda:"USDA", jumbo:"Jumbo" };
  const loanTypeLabel = FS_PROG_LABELS[loanType] || (loanType === "" ? "Conventional" : loanType);
  // HomeReady/HFA programs are conventional for all fee/title purposes
  const FS_CONV_PROGS = ["conventional","homeready","homeposs","hfa_fannie","hfa_freddie",""];
  const fsIsConvType  = FS_CONV_PROGS.includes(loanType);

  const parsedCD = useMemo(() => {
    const parts = (closingDate || defaultCD).split("-");
    return { year: parseInt(parts[0]) || today.getFullYear(), month: parseInt(parts[1]) || (today.getMonth()+2), day: parseInt(parts[2]) || 15 };
  }, [closingDate]);

  // RESPA date defaults
  // Taxes → user date or Dec 31 of closing year
  // Insurance → purchase: 1 yr from funding (policy starts at closing); refi: user date → Original Loan Date → 1 yr from funding
  const effectiveTaxDue = nextTaxDueDate || `${parsedCD.year}-12-31`;
  const _insDateFallback = (() => {
    const p = (closingDate || defaultCD).split("-");
    return `${parseInt(p[0]) + 1}-${p[1]}-${p[2]}`;
  })();
  // For refi: derive next upcoming renewal from origTitleDate's month/day (advance year to next occurrence)
  const _nextInsRenewal = (() => {
    if (!origTitleDate) return _insDateFallback;
    const parts = origTitleDate.split("-");
    if (parts.length < 3) return _insDateFallback;
    const mm = parts[1], dd = parts[2];
    const now = new Date();
    const yr = new Date(now.getFullYear(), parseInt(mm) - 1, parseInt(dd)) > now
      ? now.getFullYear() : now.getFullYear() + 1;
    return `${yr}-${mm}-${dd}`;
  })();
  const effectiveInsRenew = isPurchase
    ? _insDateFallback
    : (insRenewalDate || _nextInsRenewal);

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
  }, [selectedState, transactionType]);

  // Auto-clear short pay if the funding date moves past the 5th
  React.useEffect(() => {
    if (fundingDate && fundingDate.getDate() > 5 && shortPay) setShortPay(false);
  }, [fundingDate]);

  // New construction: auto-populate valuation using closing-month proration table when toggled on
  useEffect(() => {
    if (isNewConstruction && (!valuationForTaxes || valuationForTaxes === "")) {
      const pp = parseFloat(String(purchasePrice).replace(/,/g, "")) || 0;
      if (pp > 0) {
        const parts = closingDate ? closingDate.split(/[-/]/) : [];
        const monthIdx = parts.length >= 2
          ? Math.max(0, Math.min(11, parseInt(parts[1]) - 1))
          : new Date().getMonth();
        setValuationForTaxes(String(Math.round(pp * NC_MONTH_PCT[monthIdx] / 100)));
      }
    }
  }, [isNewConstruction]);

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
    // Homestead factor: purchase only — on a purchase, taxes are initially assessed at full value
    // and the exemption kicks in the following year, so we reduce to estimate the exempted amount.
    // On a refi, the borrower already has their exemption and their entered amount IS the actual tax.
    const mTaxBase = (homesteadExemption && isPurchase) ? mTax * homesteadFactor : mTax;
    // New construction tax rate + escrow base
    const ncValuation    = isNewConstruction ? (parseFloat(valuationForTaxes) || 0) : 0;
    const impliedTaxRate = (pp > 0 && mTax > 0) ? (mTax * 12) / pp : 0;  // true rate from full (non-homestead) monthly
    const effectiveTaxRate = impliedTaxRate;
    // Unimproved escrow: true rate × unimproved valuation × homestead factor
    const mTaxForEscrow  = (isNewConstruction && ncEscrowType === "unimproved" && ncValuation > 0 && effectiveTaxRate > 0)
      ? (effectiveTaxRate * ncValuation * homesteadFactor / 12)
      : isNewConstruction && ncEscrowType === "improved"
      ? mTax
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

    const isVALoan      = loanType === "va";
    const isIRRRL       = isVALoan && transactionType === "refinance";
    const uwRaw         = ov(ovUnderwriting,  lo(loDefUw,           def(defUnderwriting,  605)));
    const procRaw       = ov(ovProcessing,    lo(loDefProc,         def(defProcessing,    1045)));
    const underwriting  = isVALoan ? 0 : uwRaw;
    const processingFee = isVALoan ? 0 : procRaw;
    const secondLienFee = s2LienEnabled === "true" ? ov(ovS2LienFee, 600) : 0;
    const piw           = raPiw;
    const appraisal        = piw ? 0 : ov(ovAppraisal, lo(loDefAppraisal, def(defAppraisal, 625)));
    const apprReviewDefault = loanType === "nonqm" ? 150 : 50;
    const appraisalReview   = piw ? 0 : ov(ovAppraisalReview, apprReviewDefault);
    const appraisalPOCCredit = (!piw && appraisalPOC && appraisal > 0) ? appraisal : 0;
    const creditReportBase = ov(ovCreditReport, lo(loDefCreditReport, def(defCreditReport, 445)));
    const creditReport  = isIRRRL ? Math.min(60, creditReportBase) : creditReportBase;
    // Flood cert: old code seeded LO/admin defaults as "0"; treat any stored $0 as "not set" so $14 applies
    const loFloodEff  = (loDefFloodCert === "" || parseFloat(loDefFloodCert) === 0) ? "" : loDefFloodCert;
    const defFloodEff = (defFloodCert   === "" || parseFloat(defFloodCert)   === 0) ? "" : defFloodCert;
    const floodCert   = ov(ovFloodCert, lo(loFloodEff, def(defFloodEff, 14)));
    const taxService    = ov(ovTaxService,   lo(loDefTaxService,   def(defTaxService,    70)));
    const surveyDefault = lo(loDefSurvey,    def(defSurvey,        510));
    const survey        = effectiveSurvey ? ov(ovSurvey, surveyDefault) : 0;
    const docPrep       = ov(ovDocPrep,      lo(loDefDocPrep,      def(defDocPrep,       150)));
    const dpaDef        = (window.DPA_PROGRAMS || []).find(p => p.id === fsDpaProgram) || {};
    const dpaBondFee    = (dpaDef.dpa && dpaDef.bondFee) ? ov(ovBondFee, dpaDef.bondFee) : 0;

    // ── Structured DPA program fees (TSAHC / TDHCA) ────────────────────────
    // Required fixed fees — always included when program is active on a purchase
    const dpaProgFeesList = (isPurchase && dpaDef.programFees) ? dpaDef.programFees : [];
    const dpaProgFees     = dpaProgFeesList.reduce((s, f) => s + f.amount, 0);

    // Optional fees — user-toggled (TDHCA MCC options)
    const dpaOptFeesList = (isPurchase && dpaDef.optionalProgramFees)
      ? dpaDef.optionalProgramFees.filter(f =>
          (f.key === "mcc_combo"      && tdhcaMccCombo) ||
          (f.key === "mcc_standalone" && tdhcaMccStandalone)
        )
      : [];
    const dpaOptFees = dpaOptFeesList.reduce((s, f) => s + f.amount, 0);

    // Required origination % (e.g. TSAHC 1.00%, +0.25% if FICO 620–639)
    const dpaProgOriginationPct = (() => {
      if (!isPurchase || !dpaDef.requiredOriginationPct) return 0;
      const fico = parseInt(fsFicoScore) || 740;
      let pct = dpaDef.requiredOriginationPct;
      if (dpaDef.extraOriginationFico) {
        const { ficoMin, ficoMax, addPct } = dpaDef.extraOriginationFico;
        if (fico >= ficoMin && fico <= ficoMax) pct += addPct;
      }
      return pct;
    })();
    const dpaProgOriginationAmt = dpaProgOriginationPct > 0 ? Math.round(la * dpaProgOriginationPct / 100) : 0;

    // MHU Funding Fee — TDHCA 0.50% of loan amount
    const dpaMhuFundingAmt = (isPurchase && dpaDef.mhuFundingPct) ? Math.round(la * dpaDef.mhuFundingPct / 100) : 0;

    // Temporary buydown cost (builder/seller pays; shown as lender fee)
    const tempBdSchedule = TEMP_BD_SCHEDULES_FS[fsTempBd] || [];
    const tempBdCost = (tempBdSchedule.length > 0 && r > 0 && la > 0) ? (() => {
      const n = (parseInt(term) || 30) * 12;
      const basePI = pmt(r / 100 / 12, n, la);
      return Math.round(tempBdSchedule.reduce((total, reduction) => {
        const adjRate = Math.max(0, r - reduction) / 100 / 12;
        const reducedPI = adjRate > 0 ? pmt(adjRate, n, la) : la / ((parseInt(term) || 30) * 12);
        return total + (basePI - reducedPI) * 12;
      }, 0));
    })() : 0;

    const lenderFees    = origination + discount + underwriting + processingFee + secondLienFee + dpaProgOriginationAmt + dpaMhuFundingAmt + tempBdCost;

    const pestInspection = isVALoan && isPurchase ? ov(ovPestInspection, 85) : 0;
    const t47Fee         = effectiveExistingSurvey ? ov(ovT47, 175) : 0;
    const thirdPartyFees = appraisal + appraisalReview + creditReport + floodCert + taxService + docPrep + survey + t47Fee + pestInspection + dpaBondFee + dpaProgFees + dpaOptFees;
    const ownerTitlePolicy   = isPurchase ? st.basicRate(pp) : 0;
    const lenderTitlePolicy  = (!isPurchase && raWaiveTitle) ? 0
      : isPurchase ? (la <= 0 ? 0 : st.simultaneousFlatFee !== undefined ? st.simultaneousFlatFee : Math.round(st.basicRate(la) * (st.simultaneousRate || 0.35)))
      : Math.round(st.basicRate(la));
    // TX reissue credit: 40% within 2 yrs of prior policy, 25% within 2–4 yrs
    const txReissueCredit = (() => {
      if (isPurchase || selectedState !== "TX" || !origTitleDate || lenderTitlePolicy <= 0) return 0;
      const orig  = new Date(origTitleDate + "T00:00:00");
      if (isNaN(orig.getTime())) return 0;
      const close = new Date(parsedCD.year, parsedCD.month - 1, parsedCD.day);
      const yrs   = (close - orig) / (365.25 * 24 * 3600 * 1000);
      if (yrs <= 0 || yrs > 4) return 0;
      return Math.round(lenderTitlePolicy * 0.50);
    })();
    const escrowFeeDefaultCalc = Math.round(Math.max(500, (isPurchase ? pp : la) * 0.001));
    const escrowFeeDefault   = lo(loDefEscrowFee,   def(defEscrowFee,   escrowFeeDefaultCalc));
    const escrowFee          = ov(ovEscrowFee,   escrowFeeDefault);
    const titleSearch        = 0;
    const recordingFeesDefault = (!isPurchase && cashOutEnabled && (parseFloat(cashOutAmount) || 0) > 0) ? 240 : 180;
    const recordingFees      = ov(ovRecordingFee, recordingFeesDefault);
    const titleCourier       = ov(ovTitleCourier, 50);
    const taxCertERecording  = ov(ovTaxCert, selectedState === "TX" ? 25 : (st.taxCertERecording || 25));
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
    const prepaidFrom  = `${String(fundingMonth).padStart(2,"0")}/${String(fundingDay).padStart(2,"0")}/${fundingYear}`;
    const prepaidTo    = `${String(fundingMonth).padStart(2,"0")}/${String(daysInMonth).padStart(2,"0")}/${fundingYear}`;
    const dailyInterest    = (la * (r / 100)) / 365;
    const prepaidInterest  = Math.round(dailyInterest * prepaidDays);
    const homeownersInsurance = isPurchase ? Math.round(mIns * 12) : 0;
    const insurancePOCCredit  = (insOutsideClosing && homeownersInsurance > 0) ? homeownersInsurance : 0;

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

        // N = payments collected before tax disbursement (inclusive of payment in disbursement month,
        // since the monthly payment hits the 1st and disbursements are mid-to-late month)
        let N = (taxDueDate.getFullYear() - fpYear) * 12 + (taxDueDate.getMonth() + 1 - fpMonth) + 1;
        if (N <= 0) N += 12;
        if (N > 12) N = 12;

        // M = payments collected before insurance disbursement (same inclusive logic)
        let M = (insDueDate.getFullYear() - fpYear) * 12 + (insDueDate.getMonth() + 1 - fpMonth) + 1;
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
    if (isPurchase && mTax > 0 && (!simpleEscrow || !inclEscrow)) {
      const cYear = parsedCD.year;
      const cDate = new Date(cYear, parsedCD.month - 1, parsedCD.day);
      const janFirst = new Date(cYear, 0, 1);
      const daysSellerOwned = Math.floor((cDate - janFirst) / 86400000);
      const daysInYear = (cYear % 4 === 0 && (cYear % 100 !== 0 || cYear % 400 === 0)) ? 366 : 365;
      if (isNewConstruction && ncProratedType === "none") {
        sellerProratedTaxCredit = 0;
      } else if (isNewConstruction && ncProratedType !== "improved" && ncValuation > 0 && effectiveTaxRate > 0) {
        // Unimproved rate — seller credit based on land valuation × tax rate
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

    // Insurance prepaid for waived-escrow refis (set by RA Internal dropdown)
    const raInsCollect = (!inclEscrow && !isPurchase)
      ? raInsOpt === "60days"  ? Math.round(mIns * 2)
      : raInsOpt === "6months" ? Math.round(mIns * 6) : 0
      : 0;

    // 90-day insurance — waived escrows + renewal within 90 days of funding
    const ins90Check = (() => {
      if (inclEscrow || isPurchase || !effectiveInsRenew || !fundingDate) return false;
      const renewDate = new Date(effectiveInsRenew + "T12:00:00");
      const diffDays = (renewDate - fundingDate) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 90;
    })();
    const ins90Amount = (ins90Check && collect90Ins) ? Math.round(mIns * 3) : 0;

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
    const fsVaDisNum    = parseInt(vaDisabilityPct) || 0;
    const fsVaExempt    = vaExempt === "true" || (loanType === "va" && fsVaDisNum >= 10);
    const vaFeeRate = (() => {
      if (loanType !== "va") return 0;
      if (fsVaExempt) return 0;
      if (!isPurchase) return 0.005;
      if (dpPct >= 10) return 0.0125;
      if (dpPct >= 5)  return 0.0150;
      return vaFirst === "true" ? 0.0215 : 0.0330;
    })();
    const vaFundingFee   = Math.round(la * vaFeeRate);
    const fhaUfmipAmt    = loanType === "fha"  ? Math.round(la * 0.0175) : 0;
    const usdaUpfrontAmt = loanType === "usda" ? Math.round(la * 0.01)   : 0;
    const govUpfrontFee  = vaFundingFee + fhaUfmipAmt + usdaUpfrontAmt;
    const govMiAtClosing = pcUpfrontMode === "paid_closing";
    const govUpfrontForCTC = govMiAtClosing ? govUpfrontFee : 0;

    // Conventional MI upfront premiums (financed — not in cash to close)
    const fsLtv = pp > 0 ? (la / pp) * 100 : 100;
    const fsQualFico = fsBorrowerCount === "2"
      ? Math.min(parseInt(fsFicoScore) || 740, parseInt(fsCoBorroFico) || 740)
      : (parseInt(fsFicoScore) || 740);
    const isConvPMI_base = fsIsConvType && loanType !== "jumbo" && fsLtv > 80;
    const fsSinglePremRate = (fsMiPremiumType === "single" && isConvPMI_base && window.lookupSinglePremium)
      ? (window.lookupSinglePremium({ ltv: fsLtv, fico: fsQualFico, termYears: 30 }) || 0)
      : 0;
    const convSingleAmt   = Math.round(la * fsSinglePremRate);
    const convSplitAmt    = (fsMiPremiumType === "split" && isConvPMI_base) ? Math.round(la * 0.005) : 0;
    const convUpfrontPremium = convSingleAmt + convSplitAmt;
    const convMiAtClosing    = convMiFinanced !== "true";
    const convUpfrontForCTC  = convMiAtClosing ? convUpfrontPremium : 0;

    const shortPayAdj          = (shortPay && parsedCD.day <= 5) ? Math.round(dailyInterest * parsedCD.day) : 0;
    const adjustedPrepaidInterest = shortPay && parsedCD.day <= 5 ? 0 : prepaidInterest;
    const adjustedTotalPrepaids   = adjustedPrepaidInterest + homeownersInsurance + totalReserves + aggregateAdj + raInsCollect + ins90Amount;
    const transferTaxLabel     = st.transferTaxLabel || "Transfer Tax";
    const sellerPaidOwnerTitle = isPurchase && sellerPaidTitle ? ownerTitlePolicy : 0;
    const totalClosingCosts    = lenderFees + thirdPartyFees + titleFees;
    const thirdPartySubtotal   = thirdPartyFees - sellerSurveyCredit - appraisalPOCCredit;
    const titleSubtotal        = titleFees - sellerPaidOwnerTitle - txReissueCredit;
    const otherFee1     = parseFloat(otherFee1Amt) || 0;
    const otherFee2     = parseFloat(otherFee2Amt) || 0;
    const otherFee3     = parseFloat(otherFee3Amt) || 0;
    const otherFeesTotal = otherFee1 + otherFee2 + otherFee3;
    const rcBuyerNum = parseFloat(rcBuyerVal) || 0;
    const rcBuyerAmt = rcBuyerMode === "pct"
      ? (pp > 0 && rcBuyerNum > 0 ? Math.round(pp * rcBuyerNum / 100) : 0)
      : (rcBuyerNum > 0 ? Math.round(rcBuyerNum) : 0);
    const additionalFeesTotal  = homeWarranty - sellerHWCredit + hoaTransfer + hoaDuesAmt + otherFeesTotal + rcBuyerAmt;
    const displayClosingCosts  = lenderFees + thirdPartySubtotal + titleSubtotal + govUpfrontForCTC;
    const debtPayoffs          = parseFloat(dtiPayoffBal) || 0;
    const refiPayoffAmt        = !isPurchase ? (parseFloat(rs2AmountDue) || 0) : 0;
    const loanVsPayoffDelta    = refiPayoffAmt > 0 ? la - refiPayoffAmt : 0; // + = new loan covers more than payoff; - = borrower must bring diff
    // All DPA types reduce cash to close (grant = no repayment; 2nd lien = separate obligation)
    const fsDpaAmt      = parseFloat(fsDpaAmount) || 0;
    const dpaGrantCredit = (dpaDef.dpa && fsDpaAmt > 0) ? fsDpaAmt : 0;
    const grandTotal           = totalClosingCosts + adjustedTotalPrepaids + homeWarranty + optionalFees - totalCredits - sellerCred - realtor - sellerSurveyCredit - sellerHWCredit - sellerPaidOwnerTitle - shortPayAdj + debtPayoffs - sellerProratedTaxCredit + convUpfrontForCTC + govUpfrontForCTC - dpaGrantCredit - insurancePOCCredit - appraisalPOCCredit - txReissueCredit;

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
    const lenderCredMax = totalClosingCosts + adjustedTotalPrepaids + govUpfrontForCTC;

    return {
      isPurchase, piw, titleWaived: !isPurchase && !!raWaiveTitle, lenderFees, origination, discount, underwriting, processingFee, secondLienFee, tempBdCost, fsTempBdType: fsTempBd,
      thirdPartyFees, appraisal, appraisalReview, creditReport, floodCert, taxService, survey, docPrep, pestInspection, dpaBondFee,
      titleFees, ownerTitlePolicy, lenderTitlePolicy, txReissueCredit, escrowFee, titleSearch, t47Fee,
      recordingFees, titleCourier, taxCertERecording, transferTax, transferTaxLabel,
      attorneyFee, endorsementTotal,
      origPct, discPts,
      govUpfrontFee, govMiAtClosing, govUpfrontForCTC, vaFundingFee, vaFeeRate, fsVaExempt, fsVaDisNum, fhaUfmipAmt, usdaUpfrontAmt,
      convUpfrontPremium, convMiAtClosing, fsMiPremiumType, fsSinglePremRate,
      prepaidInterest, adjustedPrepaidInterest, homeownersInsurance, insurancePOCCredit, appraisalPOCCredit, prepaidDays, prepaidFrom, prepaidTo,
      taxReserves, insReserves, totalReserves, taxMonthly: mTaxForEscrow, insMonthly: mIns,
      aggregateAdj, taxReserveMonths, insReserveMonths, useRespaCalc, raInsCollect, ins90Amount, ins90Check,
      sellerProratedTaxCredit,
      sellerHoaProration, hoaMonthly, hoaProrationDays, nextHoaDateFmt, fundingDateFmt,
      mTaxForEscrow, effectiveTaxRate, ncValuation,
      sellerProratedDays: (isPurchase && mTax > 0)
        ? Math.floor((new Date(parsedCD.year, parsedCD.month - 1, parsedCD.day) - new Date(parsedCD.year, 0, 1)) / 86400000)
        : 0,
      earnest, option, lenderCred, hoaTransfer, hoaDuesAmt, optionalFees,
      totalCredits, sellerCred, realtor, sellerSurveyCredit, sellerHWCredit, shortPayAdj,
      homeWarranty, totalClosingCosts, displayClosingCosts, totalPrepaids: adjustedTotalPrepaids, debtPayoffs, refiPayoffAmt, loanVsPayoffDelta, grandTotal,
      thirdPartySubtotal, titleSubtotal, additionalFeesTotal, sellerPaidOwnerTitle,
      otherFee1, otherFee2, otherFee3, otherFeesTotal,
      otherFee1Label, otherFee2Label, otherFee3Label,
      rcBuyerAmt,
      fsDpaProgram, fsDpaType, fsDpaAmt, dpaGrantCredit, dpaDef,
      dpaProgFeesList, dpaProgFees, dpaOptFeesList, dpaOptFees,
      dpaProgOriginationPct, dpaProgOriginationAmt, dpaMhuFundingAmt,
      sellerConcPct, sellerConcMax, lenderCredMax,
      inclEscrow,
      regulation: st.regulation, disclaimer: st.disclaimer,
      attorneyRequired: st.attorneyRequired,
      surveyRequired: st.surveyRequired || "optional",
      _defaults: {
        underwriting:  isVALoan ? 0 : lo(loDefUw,          def(defUnderwriting,  605)),
        processingFee: isVALoan ? 0 : lo(loDefProc,        def(defProcessing,    1045)),
        escrowFee:     escrowFeeDefault,
        titleSearch:   lo(loDefTitleSearch, def(defTitleSearch,   250)),
        docPrep:       lo(loDefDocPrep,     def(defDocPrep,       150)),
        appraisal:     lo(loDefAppraisal,   def(defAppraisal,     625)),
        appraisalReview: apprReviewDefault,
        secondLienFee: 600,
        creditReport:  isIRRRL ? Math.min(60, lo(loDefCreditReport,def(defCreditReport, 445))) : lo(loDefCreditReport,def(defCreditReport, 445)),
        floodCert:     lo(loFloodEff,        def(defFloodEff,      14)),
        taxService:    lo(loDefTaxService,  def(defTaxService,    70)),
        survey:        surveyDefault,
        homeWarranty:  hwDefault,
        recordingFees: recordingFeesDefault,
        taxCertERecording: selectedState === "TX" ? 25 : (st.taxCertERecording || 25),
      }
    };
  }, [selectedState, transactionType, purchasePrice, loanAmount, loanType, rate,
      closingDate, fundingDate, firstPayDate, nextTaxDueDate, simpleEscrow, hoaFrequency,
      isNewConstruction, valuationForTaxes, ncEscrowType, homesteadExemption, homesteadFactor,
      effectiveTaxDue, effectiveInsRenew,
      monthlyTaxes, monthlyInsurance, originationPct, discountPoints,
      includeSurvey, includeHomeWarranty, waiveEscrows, insOutsideClosing, raPiw, raNewSurvey, raWaiveTitle, effectiveSurvey, raSurveyOpt, raInsOpt,
      ovUnderwriting, ovProcessing, ovEscrowFee, ovTitleSearch, ovRecordingFee, ovTitleCourier, ovTaxCert, ovAppraisal, ovAppraisalReview, ovS2LienFee,
      s2LienEnabled,
      ovCreditReport, ovFloodCert, ovTaxService, ovSurvey, ovHomeWarranty, ovPestInspection, ovBondFee,
      parsedCD, earnestMoney, optionMoney, lenderCredits, hoaTransferFee, hoaDues,
      sellerCredits, shortPay, sellerPaidSurvey, sellerPaidHomeWarranty, sellerPaidTitle, realtorContrib, ovDocPrep,
      defOrigination, defDiscount,
      defUnderwriting, defProcessing, defAppraisal, defCreditReport, defFloodCert,
      defTaxService, defSurvey, defDocPrep, defEscrowFee, defTitleSearch, defHomeWarranty,
      vaFirst, vaExempt, vaDisabilityPct, vaServiceType, fsFicoScore, fsCoBorroFico, fsBorrowerCount, fsMiPremiumType, convMiFinanced,
      fsDpaProgram, fsDpaAmount, fsDpaType,
      loDefOrigination, loDefDiscount,
      loDefUw, loDefProc, loDefAppraisal, loDefCreditReport, loDefFloodCert,
      loDefTaxService, loDefSurvey, loDefDocPrep, loDefEscrowFee, loDefTitleSearch,
      loDefHomeWarranty, computedEndorsementTotal, occupancy,
      otherFee1Amt, otherFee2Amt, otherFee3Amt, otherFee1Label, otherFee2Label, otherFee3Label,
      rcBuyerVal, rcBuyerMode,
      tdhcaMccCombo, tdhcaMccStandalone,
      ncProratedType, sellerExistingSurvey, ownerExistingSurvey, ovT47, cashOutEnabled, cashOutAmount,
      appraisalPOC, origTitleDate, insRenewalDate, rs2AmountDue, collect90Ins,
      fsTempBd, term, pcUpfrontMode]);

  // Publish exact FS totals for Loan Comparison Scenario A — avoids any re-computation drift
  useEffect(() => {
    try {
      const dp = fees.isPurchase
        ? (parseFloat(purchasePrice) || 0) - (parseFloat(loanAmount) || 0)
        : 0;
      // Prepaids: publish NET (after prorated tax credit) so Loan Comparison table reconciles visually
      const netPrepaidsForMC = Math.max(0, (fees.totalPrepaids || 0) - (fees.sellerProratedTaxCredit || 0));

      // Summary credits — same set as the CTC panel display uses
      const summaryCreditsForMC = (fees.option || 0) + (fees.earnest || 0)
        + (fees.isPurchase ? (fees.sellerCred || 0) : 0)
        + (fees.realtor || 0) + (fees.lenderCred || 0)
        + (fees.shortPayAdj || 0) + (fees.dpaGrantCredit || 0);

      // CTC — same formula as the navy CTC panel: dp + CC + additionalFees + netPrepaids - credits + debtPayoffs
      const ctcForMC = Math.round(
        dp
        + (fees.displayClosingCosts  || 0)
        + (fees.additionalFeesTotal  || 0)
        + netPrepaidsForMC
        - summaryCreditsForMC
        + (fees.debtPayoffs || 0)
      );

      localStorage.setItem("mtk_fs_mc_cc",          String(Math.round(fees.displayClosingCosts || 0)));
      localStorage.setItem("mtk_fs_mc_prepaids",    String(Math.round(netPrepaidsForMC)));
      localStorage.setItem("mtk_fs_mc_ctc",         String(ctcForMC));
      localStorage.setItem("mtk_fs_mc_escrow_dep",  String(Math.round((fees.totalReserves || 0) + (fees.aggregateAdj || 0))));
      // additionalFeesTotal published directly — includes HOA transfer, HOA dues, home warranty, other fees
      localStorage.setItem("mtk_fs_mc_addl",    String(Math.round(fees.additionalFeesTotal || 0)));
      localStorage.setItem("mtk_fs_mc_credits", String(Math.round(summaryCreditsForMC)));
      localStorage.setItem("mtk_fs_mc_gov_fee", String(Math.round(fees.govUpfrontFee || 0)));
      window.dispatchEvent(new Event("mtk_propagated"));
    } catch {}
  }, [fees.displayClosingCosts, fees.totalPrepaids, fees.additionalFeesTotal, fees.sellerProratedTaxCredit,
      fees.totalReserves, fees.aggregateAdj, fees.govUpfrontFee, fees.debtPayoffs,
      fees.option, fees.earnest, fees.sellerCred, fees.realtor, fees.lenderCred,
      fees.shortPayAdj, fees.dpaGrantCredit, fees.isPurchase,
      purchasePrice, loanAmount]);

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

  // LO info read directly from localStorage (set by propagation)
  const loName = localStorage.getItem("mtk_lo_name") || "";
  const loNmls = localStorage.getItem("mtk_lo_nmls") || "";
  // Borrower & scenario info for PDF header
  const pdfBorrowerFirst = localStorage.getItem("abt_c1fn") || "";
  const pdfBorrowerLast  = localStorage.getItem("abt_c1ln") || "";
  const pdfBorrowerName  = [pdfBorrowerFirst, pdfBorrowerLast].filter(Boolean).join(" ");
  const pdfScenarioName  = (() => { try { const s = JSON.parse(localStorage.getItem("mtk_active_scenario") || "null"); return (s && s.name) ? s.name : ""; } catch { return ""; } })();

  // PDF computed values (used in both the download function and the hidden print div)
  const pdfDP = fees.isPurchase ? Math.max(0, (parseFloat(purchasePrice)||0) - (parseFloat(loanAmount)||0)) : 0;
  const pdfSummaryCredits = (fees.lenderCred||0) + (fees.isPurchase ? (fees.sellerCred||0) : 0) + (fees.realtor||0) + (fees.earnest||0) + (fees.option||0) + (fees.shortPayAdj||0) + (fees.dpaGrantCredit||0);

  async function downloadFeeSheetPDF() {
    if (!pdfRef.current || pdfLoading) return;
    setPdfLoading(true);
    try {
      const h2c     = window.html2canvas;
      const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (!h2c || !jsPDFLib) { alert("PDF library not loaded — please refresh."); return; }
      const contentH = pdfRef.current.scrollHeight;
      const canvas = await h2c(pdfRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
        width: 816, windowWidth: 816, height: contentH,
      });
      const doc = new jsPDFLib({ orientation: "portrait", unit: "pt", format: "letter" });
      const PW = 612, PH = 792, M = 12;
      const usableW = PW - M * 2;
      const naturalH = (canvas.height / canvas.width) * usableW;
      const fits = naturalH <= PH - M * 2;
      const finalW = fits ? usableW : usableW * ((PH - M * 2) / naturalH);
      const finalH = fits ? naturalH : PH - M * 2;
      doc.addImage(canvas.toDataURL("image/png"), "PNG", (PW - finalW) / 2, M, finalW, finalH);
      const d = new Date();
      doc.save(`Fee-Sheet-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div>
      <div className="mtk-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:16 }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* CLOSING & FUNDING DATES */}
          <SectionCard title="CLOSING & FUNDING DATES" accent={COLORS.blue}>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:4, fontFamily:font, letterSpacing:"0.04em" }}>Closing Date</label>
              <input type="date" value={closingDate} onChange={e => {
                const val = e.target.value;
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
                  {closingDate && isWeekend(closingDate) ? <span style={{ color:"#c00", fontWeight:600 }}> · ⚠ Weekend — not a business day</span> : null}
                  {(() => { const hName = getHolidayName(closingDate, parsedCD.year); return hName ? <span style={{ color:"#c00", fontWeight:600 }}> · ⚠ {hName}</span> : ""; })()}
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
                {shortPay && (
                  <div style={{ fontSize:10, color:COLORS.green, marginTop:4, fontFamily:font, lineHeight:1.6 }}>
                    <div style={{ fontWeight:700, marginBottom:2 }}>⚡ Short Pay Active</div>
                    <div><strong>Availability:</strong> Short pays are only available when funding on days 1–5 of the month.</div>
                    <div style={{ marginTop:3 }}><strong>Cost impact:</strong> Prepaid interest is zeroed out — instead of collecting per diem interest through month-end, the servicer credits back any interest already collected. This reduces cash to close.</div>
                    <div style={{ marginTop:3 }}><strong>How mortgage interest works:</strong> Mortgage interest is paid <em>in arrears</em> — each monthly payment covers the prior month's interest. At a normal close (day 6+), prepaid interest bridges the gap from closing to month-end so the first payment can cover the full prior month.</div>
                    <div style={{ marginTop:3 }}><strong>First payment timing:</strong> With a short pay, there's no gap to bridge. The first payment starts the very next month — borrowers don't "skip" a month. Payments begin sooner compared to a standard close.</div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* REFI LOAN PAYOFF — auto-populated from PC Loan Sizing Worksheet */}
          {!fees.isPurchase && (
          <SectionCard title="LOAN PAYOFF" accent={COLORS.navy}>
            {(() => {
              const la = parseFloat(loanAmount) || 0;
              const payoff = fees.refiPayoffAmt;
              const delta = fees.loanVsPayoffDelta;
              const isShort = delta < 0;
              const bg     = payoff > 0 ? (isShort ? "#fef2f2" : "#f0fdf4") : "#f8fafc";
              const border = payoff > 0 ? (isShort ? "#fca5a5" : "#86efac") : COLORS.border;
              const clr    = isShort ? COLORS.red : COLORS.green;
              return (
                <div style={{ padding: "10px 12px", background: bg, border: `1px solid ${border}`, borderRadius: 6, fontSize: 11, fontFamily: font, lineHeight: 1.8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: COLORS.grayLight }}>New Loan Amount</span>
                    <span style={{ fontWeight: 700, color: COLORS.green }}>+ {fmt(la)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: COLORS.grayLight }}>Estimated Payoff</span>
                    <span style={{ fontWeight: 700, color: COLORS.navy }}>
                      {payoff > 0 ? fmt(payoff) : <span style={{ color: COLORS.grayLight, fontStyle: "italic" }}>enter data in Payment Calc → Loan Sizing</span>}
                    </span>
                  </div>
                </div>
              );
            })()}
            <div style={{ fontSize: 10, color: COLORS.grayLight, fontFamily: font, marginTop: 6 }}>
              Auto-filled from Payment Calc → Loan Sizing Worksheet "Amount Due"
            </div>
          </SectionCard>
          )}

          {/* FEES & OPTIONS */}
          {isInternal && <SectionCard title="FEES & OPTIONS (Internal)" accent={COLORS.blue}>
            <LabeledInput label="Origination Fee"  value={originationPct}  onChange={(v) => { if (!String(v).trimStart().startsWith("-")) setOriginationPct(v); }}  onBlur={() => { const n = parseFloat(originationPct); if (!isNaN(n)) { const s = Math.max(0,n).toFixed(Math.max(1, Math.min(3, (originationPct.split(".")[1]||"").length))); setOriginationPct(s); } }} suffix="%" hint={`${fmt(Math.round((parseFloat(loanAmount)||0)*(parseFloat(originationPct)||0)/100))}`} small />
            <LabeledInput label="Discount Points"  value={discountPoints}  onChange={(v) => { if (!String(v).trimStart().startsWith("-")) setDiscountPoints(v); }}  onBlur={() => { const n = parseFloat(discountPoints); if (!isNaN(n)) { const s = Math.max(0,n).toFixed(Math.max(1, Math.min(3, (discountPoints.split(".")[1]||"").length))); setDiscountPoints(s); } }} suffix="%" hint={`${fmt(Math.round((parseFloat(loanAmount)||0)*(parseFloat(discountPoints)||0)/100))}`} small />
            {fees.isPurchase && <Toggle label="Title: Seller Paid"         checked={sellerPaidTitle}         onChange={setSellerPaidTitle} />}
            {!fees.piw && <Toggle label="Appraisal: Paid Outside of Closing (POC)" checked={appraisalPOC} onChange={setAppraisalPOC} />}
            {!isClient && <Toggle label="Appraisal Waiver: PIW" checked={raPiw} onChange={setRaPiw} />}
            {!fees.isPurchase && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ flex:1 }}><Toggle label="Survey: Needed" checked={effectiveSurvey} onChange={v => { setIncludeSurvey(v); if (!v) setOwnerExistingSurvey(false); }} /></div>
                {(() => { const sr = getStateFees(selectedState).surveyRequired; if (!sr || sr==="optional") return null; const color = sr==="required"?COLORS.red:COLORS.blue; const text = sr==="required"?"⚠ required":sr==="recommended"?"ℹ recommended":null; return text ? React.createElement("span",{style:{fontSize:10,color,fontFamily:font,fontWeight:600,whiteSpace:"nowrap"}},text) : null; })()}
              </div>
            )}
            {!fees.isPurchase && effectiveSurvey && (
              <Toggle label="Survey: Owner Providing Existing Survey (T-47)" checked={ownerExistingSurvey} onChange={setOwnerExistingSurvey} />
            )}
            {!fees.isPurchase && !isClient && (
              <Toggle label="Title Policy: Waive" checked={raWaiveTitle} onChange={setRaWaiveTitle} />
            )}
            {!fees.isPurchase && raWaiveTitle && !isClient && (
              <div style={{ fontSize: 11, color: COLORS.red, padding: "6px 10px", background: `${COLORS.red}10`, border: `2px solid ${COLORS.red}55`, borderRadius: 6, marginTop: -4, marginBottom: 4, fontFamily: font, lineHeight: 1.5 }}>
                ⚠️ <strong style={{ color: COLORS.red }}>Non-standard.</strong> Lender's title policy removed from the fee sheet. Only use when explicitly authorized — confirm before closing.
              </div>
            )}
            {!fees.isPurchase && selectedState === "TX" && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:4, fontFamily:font, letterSpacing:"0.04em" }}>
                  Title Policy: Prior Title Policy Issue Date
                </div>
                <input
                  type="date"
                  value={origTitleDate}
                  onChange={e => setOrigTitleDate(e.target.value)}
                  style={{ width:"100%", padding:"6px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none" }}
                />
                {fees.txReissueCredit > 0 && (
                  <div style={{ fontSize:11, color:COLORS.green, fontWeight:600, marginTop:4, fontFamily:font }}>
                    ✓ 50% reissue credit applies — {fmt(fees.txReissueCredit)} saved
                  </div>
                )}
                {origTitleDate && fees.txReissueCredit === 0 && (() => { const orig = new Date(origTitleDate+"T00:00:00"); const close = new Date(parsedCD ? parsedCD.year : new Date().getFullYear(), parsedCD ? parsedCD.month-1 : new Date().getMonth(), parsedCD ? parsedCD.day : new Date().getDate()); const yrs = (close-orig)/(365.25*24*3600*1000); return yrs > 4; })() && (
                  <div style={{ fontSize:11, color:COLORS.grayLight, marginTop:4, fontFamily:font }}>
                    Prior policy &gt;4 years ago — no reissue credit applies
                  </div>
                )}
              </div>
            )}
            {fees.isPurchase && <Toggle label="Home Warranty: Include"    checked={includeHomeWarranty}      onChange={setIncludeHomeWarranty} />}
            {fees.isPurchase && includeHomeWarranty && <Toggle label="Home Warranty: Seller Paid" checked={sellerPaidHomeWarranty} onChange={setSellerPaidHomeWarranty} />}
            {fees.homeownersInsurance > 0 && <Toggle label="Insurance: Paid Outside of Closing (POC)" checked={insOutsideClosing} onChange={setInsOutsideClosing} />}
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
                {fees.fsVaExempt ? (
                  <div style={{ fontSize:11, color:COLORS.green, fontFamily:font, marginTop:4, fontWeight:600 }}>
                    Exempt — funding fee waived{fees.fsVaDisNum >= 10 ? ` (${fees.fsVaDisNum}% service-connected disability)` : ""}
                  </div>
                ) : (
                  <>
                    {fees.vaFundingFee > 0 && (
                      <div style={{ fontSize:11, color:COLORS.navy, fontFamily:font, marginTop:4 }}>
                        Fee: <strong>{(fees.vaFeeRate*100).toFixed(2)}%</strong> = <strong>{fmt(fees.vaFundingFee)}</strong> (financed into loan)
                      </div>
                    )}
                    {(() => {
                      const dp = parseFloat(purchasePrice) > 0
                        ? ((parseFloat(purchasePrice) - parseFloat(loanAmount)) / parseFloat(purchasePrice)) * 100 : 0;
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
                  </>
                )}
                <div style={{ fontSize:10, color:COLORS.gray, fontFamily:font, marginTop:4, lineHeight:1.4 }}>
                  Disability % and service type set in Payment Calculator tab.
                </div>
              </div>
            )}
            {fees.isPurchase && (
              <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${COLORS.border}` }}>
                <div style={{ fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:4, fontFamily:font, letterSpacing:"0.04em" }}>Survey</div>
                <select
                  value={!effectiveSurvey ? "not_required" : sellerExistingSurvey ? "existing" : sellerPaidSurvey ? "new" : "none"}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === "not_required") {
                      setIncludeSurvey(false);
                      setSellerPaidSurvey(false);
                      setSellerExistingSurvey(false);
                    } else {
                      if (!effectiveSurvey) { setIncludeSurvey(true); }
                      setSellerPaidSurvey(v === "new");
                      setSellerExistingSurvey(v === "existing");
                    }
                  }}
                  style={{ width:"100%", padding:"6px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none" }}
                >
                  <option value="none">Buyer Pays for Survey</option>
                  <option value="new">Seller Pays for New Survey</option>
                  <option value="existing">Seller Providing Existing Survey (T-47)</option>
                  <option value="not_required">Survey Not Required</option>
                </select>
              </div>
            )}
            {fees.govUpfrontFee > 0 && (
              <Select
                label="Upfront Cost: Finance Options"
                value={pcUpfrontMode}
                onChange={v => {
                  setPcUpfrontMode(v);
                  try { localStorage.setItem("mtk_pc_upfront_mode", JSON.stringify(v)); } catch {}
                  window.dispatchEvent(new Event("mtk_propagated"));
                }}
                options={[
                  { value: "rolled_in",    label: "Rolled In" },
                  { value: "paid_closing", label: "Paid at Closing" },
                ]}
              />
            )}
            {/* Reset Points / Reset All Fees */}
            <div style={{ marginTop:10, textAlign:"right" }}>
              <button onClick={() => {
                setOriginationPct(""); setDiscountPoints("");
                if (isInternal) {
                  setOvUnderwriting(""); setOvProcessing(""); setOvAppraisal(""); setOvAppraisalReview(""); setOvS2LienFee("");
                  setOvCreditReport(""); setOvFloodCert(""); setOvTaxService("");
                  setOvDocPrep(""); setOvSurvey(""); setOvEscrowFee("");
                  setOvTitleSearch(""); setOvHomeWarranty(""); setOvRecordingFee(""); setOvTitleCourier(""); setOvTaxCert("");
                  setOvPestInspection(""); setOvBondFee("");
                }
              }} style={{ padding:"6px 14px", background:COLORS.grayLight, color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:font }}>
                {isInternal ? "↺ Reset All Fees" : "↺ Reset Points"}
              </button>
            </div>
          </SectionCard>}

          {/* ESCROW DETAILS */}
          {isInternal && <SectionCard title="ESCROW DETAILS (Internal)" accent={COLORS.blue}>
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
                  {fees.isPurchase
                    ? "Enter the next tax disbursement date. Insurance reserves use 1 year from funding (policy starts at closing)."
                    : "Enter the next tax disbursement date and insurance renewal date for accurate reserve calculation."}
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
                {!fees.isPurchase && (
                  <React.Fragment>
                    <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:3, marginTop:8, fontFamily:font, letterSpacing:"0.04em" }}>
                      Insurance Renewal Date
                      {!insRenewalDate && origTitleDate && <span style={{ color:COLORS.blue, fontWeight:400 }}> — using Original Loan Date</span>}
                      {!insRenewalDate && !origTitleDate && <span style={{ color:COLORS.blue, fontWeight:400 }}> — default: 1 yr from closing</span>}
                    </label>
                    <input type="date" value={insRenewalDate || origTitleDate || ""} onChange={e => setInsRenewalDate(e.target.value)}
                      style={{ width:"100%", padding:"6px 10px", border:`1px solid ${insRenewalDate ? COLORS.border : COLORS.blue}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background: insRenewalDate ? "#fff" : "#f0f5ff", outline:"none", boxSizing:"border-box", marginBottom:4 }} />
                    {!insRenewalDate && origTitleDate && (
                      <div style={{ fontSize:10, color:COLORS.blue, marginTop:2, marginBottom:4, fontFamily:font, fontStyle:"italic" }}>
                        ℹ Using next renewal {_nextInsRenewal} (based on Original Loan Date month/day) — override above if different.
                      </div>
                    )}
                    {!insRenewalDate && !origTitleDate && (
                      <div style={{ fontSize:10, color:COLORS.blue, marginTop:2, marginBottom:4, fontFamily:font, fontStyle:"italic" }}>
                        ℹ Enter the insurance renewal date for accurate calculation. Set Original Loan Date in Refi Analyzer to auto-populate.
                      </div>
                    )}
                  </React.Fragment>
                )}
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
                {fees.ins90Check && (
                  <>
                    <div style={{ margin:"6px 0 4px", padding:"8px 10px", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:6, fontSize:10, fontFamily:font, lineHeight:1.6, color:"#92400e" }}>
                      <strong>⚠ Internal:</strong> Insurance renews within 90 days of funding. When escrows are waived, most lenders require 90 days of prepaid insurance at closing to ensure coverage during new loan setup.
                    </div>
                    <Toggle label="Internal: Collect 90 Days of Insurance" checked={collect90Ins} onChange={setCollect90Ins} />
                  </>
                )}
              </div>
            )}
          </SectionCard>}

          {/* CREDITS */}
          <SectionCard title="CREDITS" accent={COLORS.green}>
            {fees.isPurchase && <LabeledInput label="Seller Credits"  prefix="$" value={sellerCredits}  onChange={setSellerCredits}  useCommas />}
            {fees.isPurchase && <LabeledInput label="Realtor Credits" prefix="$" value={realtorContrib} onChange={setRealtorContrib} useCommas />}
            <LabeledInput label="Lender Credits" prefix="$" value={lenderCredits} onChange={setLenderCredits} useCommas />

            {/* Lender credit over-cap warning */}
            {fees.lenderCred > fees.lenderCredMax && fees.lenderCredMax > 0 && (
              <div style={{ marginTop:4, marginBottom:4, padding:"8px 10px", background:"#fef2f2", border:`2px solid ${COLORS.red}`, borderRadius:6, fontSize:11, fontFamily:font, color:COLORS.red, fontWeight:700, lineHeight:1.5 }}>
                ⚠ LENDER CREDIT EXCEEDS ALLOWABLE MAXIMUM — Lender credits cannot exceed total closing costs + prepaids ({fmt(fees.lenderCredMax)}). Credit must be reduced before closing.
              </div>
            )}

            {/* Seller concession program limit indicator — purchase only */}
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

            {/* Costs to cover + credit summary + delta */}
            {(() => {
              const creditsApplied = (fees.lenderCred || 0) + (fees.sellerCred || 0) + (fees.realtor || 0);
              const coverableCosts = (fees.displayClosingCosts || 0) + (fees.additionalFeesTotal || 0) + (fees.totalPrepaids || 0);
              const delta          = coverableCosts - creditsApplied;
              const deltaOver      = delta < 0;
              return (
                <div style={{ marginTop:8, padding:"8px 10px", background:"#f8f9fb", borderRadius:6, border:`1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize:10, fontWeight:700, color:COLORS.grayLight, marginBottom:6, fontFamily:font, letterSpacing:"0.04em" }}>COSTS TO COVER</div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:font, marginBottom:3 }}>
                    <span style={{ color:COLORS.grayLight }}>Closing Costs</span>
                    <span style={{ fontWeight:600, color:COLORS.navy }}>{fmt(fees.displayClosingCosts || 0)}</span>
                  </div>
                  {(fees.additionalFeesTotal > 0) && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:font, marginBottom:3 }}>
                      <span style={{ color:COLORS.grayLight }}>Additional Fees</span>
                      <span style={{ fontWeight:600, color:COLORS.navy }}>{fmt(fees.additionalFeesTotal)}</span>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:font, marginBottom:4 }}>
                    <span style={{ color:COLORS.grayLight }}>Prepaids &amp; Reserves</span>
                    <span style={{ fontWeight:600, color:COLORS.navy }}>{fmt(fees.totalPrepaids || 0)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:font, borderTop:`1px solid ${COLORS.border}`, paddingTop:4, marginBottom: creditsApplied > 0 ? 6 : 0 }}>
                    <span style={{ fontWeight:700, color:COLORS.grayLight }}>Total to Zero Out</span>
                    <span style={{ fontWeight:700, color:COLORS.navy }}>{fmt(coverableCosts)}</span>
                  </div>
                  {creditsApplied > 0 && (
                    <React.Fragment>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:font, marginBottom:3 }}>
                        <span style={{ color:COLORS.grayLight }}>
                          Total Credits Applied
                          <span style={{ fontSize:9, color:COLORS.grayLight, fontWeight:400, marginLeft:4 }}>(excl. option &amp; earnest)</span>
                        </span>
                        <span style={{ fontWeight:700, color:COLORS.red }}>({fmt(creditsApplied)})</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:font, borderTop:`1px solid ${COLORS.border}`, paddingTop:4 }}>
                        <span style={{ fontWeight:700, color: deltaOver ? COLORS.red : COLORS.green }}>
                          {deltaOver ? "⚠ Over Coverable Costs" : delta === 0 ? "✓ All Costs Covered" : "Remaining to Allocate"}
                        </span>
                        <span style={{ fontWeight:700, color: deltaOver ? COLORS.red : COLORS.green }}>
                          {deltaOver ? `(${fmt(Math.abs(delta))})` : fmt(delta)}
                        </span>
                      </div>
                    </React.Fragment>
                  )}
                </div>
              );
            })()}
          </SectionCard>


          {/* CONTRACT DETAILS */}
          {fees.isPurchase && (
          <SectionCard title="CONTRACT DETAILS" accent={COLORS.green}>
            {selectedState === "TX" && <LabeledInput label="Option Money"  prefix="$" value={optionMoney}  onChange={setOptionMoney}  useCommas />}
            <LabeledInput label="Earnest Money" prefix="$" value={earnestMoney} onChange={setEarnestMoney} useCommas />
            <LabeledInput
              label="Realtor Commissions: Buyer Paid"
              value={rcBuyerVal}
              prefix={rcBuyerMode === "dollar" ? "$" : undefined}
              suffix={rcBuyerMode === "pct" ? "%" : undefined}
              onChange={v => {
                if (rcBuyerMode === "pct") {
                  const n = parseFloat(v);
                  if (!isNaN(n) && n > 8) return;
                }
                setRcBuyerVal(v);
              }}
              hint={(() => {
                const num = parseFloat(rcBuyerVal) || 0;
                const pp2 = parseFloat(purchasePrice) || 0;
                if (num <= 0) return undefined;
                if (rcBuyerMode === "pct" && pp2 > 0) return fmt(Math.round(pp2 * num / 100)) + " based on " + fmt(pp2) + " purchase price";
                if (rcBuyerMode === "dollar" && pp2 > 0) return (num / pp2 * 100).toFixed(3) + "% of purchase price";
                return undefined;
              })()}
              rightAddon={
                <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:`1.5px solid ${COLORS.border}`, flexShrink:0 }}>
                  {[{v:"pct",label:"%"},{v:"dollar",label:"$"}].map(({v,label}) => (
                    <button key={v} tabIndex={-1} onClick={() => {
                      if (v === rcBuyerMode) return;
                      const num = parseFloat(rcBuyerVal) || 0;
                      const pp2 = parseFloat(purchasePrice) || 0;
                      if (v === "dollar" && rcBuyerMode === "pct") {
                        setRcBuyerVal(pp2 > 0 && num > 0 ? String(Math.round(num * pp2 / 100)) : "");
                      } else if (v === "pct" && rcBuyerMode === "dollar") {
                        setRcBuyerVal(pp2 > 0 && num > 0 ? String(parseFloat((num / pp2 * 100).toFixed(3))) : "");
                      }
                      setRcBuyerMode(v);
                    }} style={{
                      padding:"0 14px", fontSize:12, fontWeight:700, height:"100%",
                      cursor:"pointer", border:"none", fontFamily:font,
                      background: rcBuyerMode === v ? COLORS.navy : "#fff",
                      color: rcBuyerMode === v ? "#fff" : COLORS.navy,
                      transition:"all 0.15s",
                    }}>{label}</button>
                  ))}
                </div>
              }
            />
          </SectionCard>
          )}

          {/* HOA */}
          {fees.isPurchase && (
            <SectionCard title="HOMEOWNERS ASSOCIATION (HOA)" accent={COLORS.blue}>
              <LabeledInput label="HOA Transfer Fee"   prefix="$" value={hoaTransferFee} onChange={setHoaTransferFee} useCommas />
              <LabeledInput label="HOA Dues (monthly)" prefix="$" value={hoaDues} onChange={setHoaDues} useCommas />
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
          {fees.isPurchase && isInternal && (
            <SectionCard title="NEW CONSTRUCTION (Internal)" accent={COLORS.blue}>
              <Toggle label="New Construction" checked={isNewConstruction} onChange={setIsNewConstruction} />
              {isNewConstruction && (
                <div style={{ marginTop:8 }}>
                  {(() => {
                    const parts = closingDate ? closingDate.split(/[-/]/) : [];
                    const mIdx  = parts.length >= 2 ? Math.max(0, Math.min(11, parseInt(parts[1]) - 1)) : new Date().getMonth();
                    const pct   = NC_MONTH_PCT[mIdx];
                    const mName = NC_MONTH_NAMES[mIdx];
                    return (
                      <React.Fragment>
                        <LabeledInput
                          label="Valuation for Property Taxes"
                          prefix="$"
                          value={valuationForTaxes}
                          onChange={setValuationForTaxes}
                          useCommas
                          small
                          hint={`Suggested valuation for a ${mName} closing is ${pct}% of the purchase price. Enter your own value if you have more accurate information.`}
                        />
                      </React.Fragment>
                    );
                  })()}
                  <div style={{ marginTop:6 }}>
                    <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:3, fontFamily:font, letterSpacing:"0.04em" }}>Escrow Type</label>
                    <select value={ncEscrowType} onChange={e => setNcEscrowType(e.target.value)}
                      style={{ width:"100%", padding:"6px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none" }}>
                      <option value="improved">Improved Escrows (Full Tax)</option>
                      <option value="unimproved">Unimproved Escrows (ex: based off value lower than sales price)</option>
                    </select>
                  </div>
                  <div style={{ marginTop:6 }}>
                    <label style={{ display:"block", fontSize:11, fontWeight:600, color:COLORS.grayLight, marginBottom:3, fontFamily:font, letterSpacing:"0.04em" }}>Prorated Taxes from Seller</label>
                    <select value={ncProratedType} onChange={e => setNcProratedType(e.target.value)}
                      style={{ width:"100%", padding:"6px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none" }}>
                      <option value="unimproved">Unimproved Rate (Default)</option>
                      <option value="improved">Full Improved Rate</option>
                      <option value="none">No Seller Credit</option>
                    </select>
                  </div>
                  {fees.effectiveTaxRate > 0 && fees.ncValuation > 0 && (
                    <div style={{ marginTop:6, padding:"7px 10px", background:"#f8fafc", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:10, color:COLORS.grayLight, fontFamily:font, lineHeight:1.7 }}>
                      <div><strong>Estimated Tax Rate:</strong> {(fees.effectiveTaxRate * 100).toFixed(3)}% (derived from monthly taxes ÷ {homesteadExemption ? "estimated 70% tax basis" : "purchase price"})</div>
                      {homesteadExemption && (
                        <div style={{ color:COLORS.blue }}>Est. tax valuation uses approx. 70% of purchase price — a homestead exemption may reduce the taxable value for owner-occupied properties. Actual amounts will vary.</div>
                      )}
                      <div><strong>Improved monthly taxes:</strong> {fmt(Math.round(parseFloat(monthlyTaxes) || 0))} / mo
                        {homesteadExemption ? " (purchase price × 70% × rate)" : " (purchase price × rate)"}
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

          {/* TEMPORARY BUYDOWN */}
          {fees.isPurchase && isInternal && (
            <SectionCard title="TEMPORARY BUYDOWN (Internal)" accent={COLORS.blue}>
              <Select
                label="Buydown Type"
                value={fsTempBd}
                onChange={setFsTempBd}
                options={[
                  { value: "none",  label: "None — No Buydown" },
                  { value: "3/2/1", label: "3/2/1 Buydown" },
                  { value: "2/1",   label: "2/1 Buydown" },
                  { value: "1/1",   label: "1/1 Buydown" },
                  { value: "1/0",   label: "1/0 Buydown" },
                ]}
                small
              />
              {fsTempBd !== "none" && (
                <>
                  {(parseFloat(rate) || 0) > 0 && (parseFloat(loanAmount) || 0) > 0 ? (
                    <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 6, padding: "10px 12px", border: `1px solid ${COLORS.border}` }}>
                      {(() => {
                        const r2 = parseFloat(rate) || 0;
                        const la2 = parseFloat(loanAmount) || 0;
                        const n2 = (parseInt(term) || 30) * 12;
                        const basePI = pmt(r2 / 100 / 12, n2, la2);
                        const schedule = TEMP_BD_SCHEDULES_FS[fsTempBd] || [];
                        let runningTotal = 0;
                        return (
                          <>
                            {schedule.map((reduction, i) => {
                              const adjRate = Math.max(0, r2 - reduction);
                              const adjMo   = adjRate / 100 / 12;
                              const reducedPI = adjMo > 0 ? pmt(adjMo, n2, la2) : la2 / n2;
                              const monthlySavings = Math.round(basePI - reducedPI);
                              const yearCost = monthlySavings * 12;
                              runningTotal += yearCost;
                              return (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.navy, fontFamily: font, marginBottom: 5 }}>
                                  <span style={{ fontWeight: 600 }}>Year {i + 1}: {adjRate.toFixed(3)}% rate</span>
                                  <span>{fmt(monthlySavings)}/mo savings &nbsp;·&nbsp; <strong>{fmt(yearCost)}</strong></span>
                                </div>
                              );
                            })}
                            <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
                              <span>Total Buydown Cost</span>
                              <span style={{ color: COLORS.blue }}>{fmt(runningTotal)}</span>
                            </div>
                            <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginTop: 4, lineHeight: 1.4 }}>
                              Added to Lender Fees — typically covered by builder/seller concession.
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "#fef9c3", border: `1px solid #fde047`, borderRadius: 6, fontSize: 11, color: "#713f12", fontFamily: font }}>
                      Enter a rate and loan amount above to calculate buydown cost.
                    </div>
                  )}
                </>
              )}
            </SectionCard>
          )}

          {/* OTHER FEES */}
          {isInternal && <SectionCard title="OTHER FEES (Internal)" accent={COLORS.blue}>
            <div style={{ fontSize:11, color:COLORS.grayLight, fontFamily:font, marginBottom:10, lineHeight:1.4 }}>
              Add up to three custom fees. These will appear in the Additional Fees section of the fee sheet.
            </div>
            {[
              { label: otherFee1Label, setLabel: setOtherFee1Label, amt: otherFee1Amt, setAmt: setOtherFee1Amt, n: 1 },
              { label: otherFee2Label, setLabel: setOtherFee2Label, amt: otherFee2Amt, setAmt: setOtherFee2Amt, n: 2 },
              { label: otherFee3Label, setLabel: setOtherFee3Label, amt: otherFee3Amt, setAmt: setOtherFee3Amt, n: 3 },
            ].map(({ label, setLabel, amt, setAmt, n }) => (
              <div key={n} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder={`Fee ${n} description`}
                  style={{ flex:1, padding:"6px 10px", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:13, fontFamily:font, color:COLORS.navy, background:"#fff", outline:"none" }}
                />
                <span style={{ fontSize:13, fontWeight:600, color:COLORS.navy, fontFamily:font }}>$</span>
                <OtherFeeAmtInput amt={amt} setAmt={setAmt} />
              </div>
            ))}
          </SectionCard>}

          {/* DPA PROGRAM OPTIONS — shown when active program has optional fees (e.g. TDHCA MCC) */}
          {fees.isPurchase && fees.dpaDef && fees.dpaDef.optionalProgramFees && (
            <SectionCard title={`${fees.dpaDef.label} — OPTIONAL FEES`} accent={COLORS.blue}>
              <div style={{ fontSize:11, color:COLORS.grayLight, fontFamily:font, marginBottom:10, lineHeight:1.4 }}>
                Toggle optional program fees. Only check if this borrower is applying for an MCC.
              </div>
              {fees.dpaDef.optionalProgramFees.map(f => (
                <Toggle
                  key={f.key}
                  label={`${f.label} — ${fmt(f.amount)}`}
                  checked={f.key === "mcc_combo" ? tdhcaMccCombo : tdhcaMccStandalone}
                  onChange={f.key === "mcc_combo" ? setTdhcaMccCombo : setTdhcaMccStandalone}
                />
              ))}
            </SectionCard>
          )}

        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div>
          {/* Blue summary header */}
          <div style={{ background:`linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius:12, padding:20, color:"#fff", marginBottom:16, textAlign:"center" }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:"0.1em", opacity:0.7 }}>ESTIMATED TOTAL CASH TO CLOSE</div>
            <div style={{ fontSize:44, fontWeight:800, fontFamily:font }}>{fmt(fees.grandTotal + (fees.isPurchase?(parseFloat(purchasePrice)||0)-(parseFloat(loanAmount)||0):0))}</div>
            <div style={{ fontSize:13, opacity:0.8, marginTop:4, fontFamily:font }}>
              {stateName} · {fees.isPurchase ? "Purchase" : "Refinance"} · {loanTypeLabel}{fees.dpaDef && fees.dpaDef.dpa && fees.fsDpaAmt > 0 ? ` + ${fees.dpaDef.label}` : ""}
            </div>
            <div style={{ fontSize:13, opacity:0.65, marginTop:6, fontFamily:font }}>
              {fmt(parseFloat(purchasePrice)||0)} {fees.isPurchase ? "Purchase" : "Value"}&nbsp;&nbsp;|&nbsp;&nbsp;{fmt(parseFloat(loanAmount)||0)} Loan&nbsp;&nbsp;|&nbsp;&nbsp;{rate}% Rate
            </div>
          </div>

          <SectionCard title={`CLOSING COST ESTIMATE — ${stateName.toUpperCase()}`}>
            {/* LENDER FEES */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>LENDER FEES</div>
              <FeeRow label={fees.origination > 0 ? `Origination Fee (${parseFloat(fees.origPct)}%) *` : "Origination Fee *"}  amount={fees.origination}  indent />
              <FeeRow label={fees.discount > 0    ? `Discount Points (${parseFloat(fees.discPts)}%) *`  : "Discount Points *"}    amount={fees.discount}     indent />
              {ovUnderwriting !== "0" && <FeeRow label="Underwriting Fee *" amount={fees.underwriting}  indent editKey="uw"   editValue={ovUnderwriting} onEdit={setOvUnderwriting} defaultVal={fees._defaults.underwriting}  isInternal={canEditFees} />}
              {ovProcessing   !== "0" && <FeeRow label="Processing Fee *"   amount={fees.processingFee} indent editKey="proc" editValue={ovProcessing}   onEdit={setOvProcessing}   defaultVal={fees._defaults.processingFee} isInternal={canEditFees} />}
              {fees.secondLienFee > 0 && <FeeRow label="2nd Lien Fee" amount={fees.secondLienFee} indent editKey="2nd_fee" editValue={ovS2LienFee} onEdit={setOvS2LienFee} defaultVal={fees._defaults.secondLienFee} isInternal={canEditFees} />}
              {fees.dpaProgOriginationAmt > 0 && <FeeRow label={`${fees.dpaDef.label} ${fees.dpaDef.originationLabel || "Required Origination"} (${fees.dpaProgOriginationPct.toFixed(2)}%)`} amount={fees.dpaProgOriginationAmt} indent />}
              {fees.dpaMhuFundingAmt > 0 && <FeeRow label={`MHU Funding Fee (${fees.dpaDef.mhuFundingPct}%)`} amount={fees.dpaMhuFundingAmt} indent />}
              {fees.tempBdCost > 0 && <FeeRow label={`Temporary Buydown (${fees.fsTempBdType})`} amount={fees.tempBdCost} indent color={COLORS.blue} />}
              {fees.govUpfrontFee > 0 && (
                <div style={{ borderTop:`1px dashed ${COLORS.border}`, marginTop:4, paddingTop:4 }}>
                  <FeeRow
                    label={loanType==="va" ? `VA Funding Fee (${(fees.vaFeeRate*100).toFixed(2)}%) — ${fees.govMiAtClosing ? "paid at closing" : "rolled into loan"}` : loanType==="fha" ? `FHA Upfront MIP (1.75%) — ${fees.govMiAtClosing ? "paid at closing" : "rolled into loan"}` : `USDA Guarantee Fee (1.0%) — ${fees.govMiAtClosing ? "paid at closing" : "rolled into loan"}`}
                    amount={fees.govUpfrontFee} indent color={fees.govMiAtClosing ? COLORS.navy : COLORS.blue} />
                  {!fees.govMiAtClosing && (
                    <FeeRow
                      label={loanType==="va" ? `VA Funding Fee (${(fees.vaFeeRate*100).toFixed(2)}%) — being rolled into the loan` : loanType==="fha" ? "FHA Upfront MIP (1.75%) — being rolled into the loan" : "USDA Guarantee Fee (1.0%) — being rolled into the loan"}
                      amount={-fees.govUpfrontFee} indent color={COLORS.red} />
                  )}
                </div>
              )}
              {fees.convUpfrontPremium > 0 && (
                <div style={{ borderTop:`1px dashed ${COLORS.border}`, marginTop:4, paddingTop:4 }}>
                  <FeeRow
                    label={fees.fsMiPremiumType === "single"
                      ? `Single Premium MI (${((fees.fsSinglePremRate||0)*100).toFixed(2)}%) — ${fees.convMiAtClosing ? "paid at closing" : "rolled into loan"}`
                      : `Split Premium MI Upfront (0.50%) — ${fees.convMiAtClosing ? "paid at closing" : "rolled into loan"}`}
                    amount={fees.convUpfrontPremium} indent color={fees.convMiAtClosing ? COLORS.navy : COLORS.blue} />
                  {fees.convMiAtClosing
                    ? <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, paddingLeft:20, marginBottom:2, lineHeight:1.4 }}>↑ Included in cash to close</div>
                    : <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, paddingLeft:20, marginBottom:2, lineHeight:1.4 }}>↑ Financed into loan — not included in cash to close</div>
                  }
                  <Toggle
                    label="Finance into loan (vs. pay at closing)"
                    checked={convMiFinanced === "true"}
                    onChange={v => setConvMiFinanced(v ? "true" : "false")}
                  />
                </div>
              )}
              <FeeRow label="Subtotal — Lender Fees" amount={fees.lenderFees + fees.govUpfrontForCTC} bold />
            </div>

            {/* THIRD PARTY FEES */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>THIRD PARTY FEES</div>
              {(fees.piw || ovAppraisal !== "0") && <FeeRow label={fees.piw ? "Appraisal: Waived — Property Inspection Waiver granted" : "Appraisal"} amount={fees.appraisal} indent editKey={fees.piw ? null : "appr"} editValue={ovAppraisal} onEdit={setOvAppraisal} defaultVal={fees._defaults.appraisal} isInternal={canEditFees} />}
              {fees.appraisalPOCCredit > 0 && <FeeRow label="Appraisal: Paid Outside of Closing (POC)" amount={-fees.appraisalPOCCredit} indent color={COLORS.red} />}
              {!fees.piw && ovAppraisalReview !== "0" && <FeeRow label="Appraisal Review (if applicable)" amount={fees.appraisalReview} indent editKey="appr_rev" editValue={ovAppraisalReview} onEdit={setOvAppraisalReview} defaultVal={fees._defaults.appraisalReview} isInternal={canEditFees} />}
              {ovCreditReport !== "0" && <FeeRow label="Credit & Verifications (as needed)" amount={fees.creditReport} indent editKey="cr"      editValue={ovCreditReport} onEdit={setOvCreditReport} defaultVal={fees._defaults.creditReport}  isInternal={canEditFees} />}
              {ovFloodCert    !== "0" && <FeeRow label="Flood Certification *"          amount={fees.floodCert}    indent editKey="flood"   editValue={ovFloodCert}    onEdit={setOvFloodCert}    defaultVal={fees._defaults.floodCert}    isInternal={canEditFees} />}
              {ovTaxService   !== "0" && <FeeRow label="Tax Service Fee *"              amount={fees.taxService}   indent editKey="taxsvc"  editValue={ovTaxService}   onEdit={setOvTaxService}   defaultVal={fees._defaults.taxService}   isInternal={canEditFees} />}
              {ovDocPrep      !== "0" && <FeeRow label="Doc Prep *"                     amount={fees.docPrep}      indent editKey="docprep" editValue={ovDocPrep}      onEdit={setOvDocPrep}      defaultVal={fees._defaults.docPrep}      isInternal={canEditFees} />}
              {effectiveSurvey && !effectiveExistingSurvey && ovSurvey !== "0" && <FeeRow label="Survey" amount={fees.survey} indent editKey="survey" editValue={ovSurvey} onEdit={setOvSurvey} defaultVal={fees._defaults.survey} isInternal={canEditFees} />}
              {fees.isPurchase && sellerPaidSurvey && effectiveSurvey && !effectiveExistingSurvey && ovSurvey !== "0" && <FeeRow label="Survey: Seller Pays (New Survey)" amount={-fees.survey} indent color={COLORS.red} />}
              {effectiveExistingSurvey && ovT47 !== "0" && <FeeRow label={fees.isPurchase ? "Survey: T-47 Endorsement (Existing Survey)" : "Survey: T-47 Affidavit (Owner Existing Survey)"} amount={fees.t47Fee} indent editKey="t47" editValue={ovT47} onEdit={setOvT47} defaultVal={175} isInternal={canEditFees} />}
              {fees.pestInspection > 0 && <FeeRow label="Pest Inspection (mandatory for VA loans)" amount={fees.pestInspection} indent editKey="pest" editValue={ovPestInspection} onEdit={setOvPestInspection} defaultVal={85} isInternal={canEditFees} />}
              {fees.dpaBondFee > 0 && <FeeRow label={`Bond Fee${fees.dpaDef && fees.dpaDef.label ? ` — ${fees.dpaDef.label}` : ""}`} amount={fees.dpaBondFee} indent editKey="bond" editValue={ovBondFee} onEdit={setOvBondFee} defaultVal={fees.dpaBondFee} isInternal={canEditFees} />}
              {fees.dpaProgFeesList.map(f => (
                <FeeRow key={f.key} label={f.label} amount={f.amount} indent />
              ))}
              {fees.dpaOptFeesList.map(f => (
                <FeeRow key={f.key} label={f.label} amount={f.amount} indent />
              ))}
              <FeeRow label="Subtotal — Third Party" amount={fees.thirdPartySubtotal} bold />
            </div>

            {/* TITLE & CLOSING FEES */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>TITLE & CLOSING FEES</div>
              {fees.isPurchase && <FeeRow label="Owner's Title Policy" amount={fees.ownerTitlePolicy} indent />}
              {sellerPaidTitle && fees.ownerTitlePolicy > 0 && <FeeRow label="Owner's Title (Seller Paid)" amount={-fees.ownerTitlePolicy} indent color={COLORS.red} />}
              <FeeRow label={fees.titleWaived ? "Lender's Title Policy — Waived" : fees.isPurchase ? "Lender's Title (Simultaneous)" : "Lender's Title Policy"} amount={fees.lenderTitlePolicy} indent />
              {fees.txReissueCredit > 0 && <FeeRow label="Lender's Title: TX Reissue Rate Credit" amount={-fees.txReissueCredit} indent color={COLORS.red} />}
              {fees.titleWaived && <div style={{ fontSize:10, color:COLORS.green, fontFamily:font, paddingLeft:20, marginBottom:4, lineHeight:1.4 }}>✅ Title policy waived — special program</div>}
              {isInternal && fees.endorsementTotal>0 && <FeeRow label="Title Policy Endorsements" amount={fees.endorsementTotal} indent />}
              {ovEscrowFee    !== "0" && <FeeRow label="Escrow/Settlement Fee" amount={fees.escrowFee}   indent editKey="escfee" editValue={ovEscrowFee}   onEdit={setOvEscrowFee}   defaultVal={fees._defaults.escrowFee}   isInternal={canEditFees} />}
              {ovRecordingFee !== "0" && <FeeRow label="Recording Fees"                        amount={fees.recordingFees}     indent editKey="rec"     editValue={ovRecordingFee} onEdit={setOvRecordingFee} defaultVal={fees._defaults.recordingFees}   isInternal={canEditFees} />}
              {ovTitleCourier !== "0" && <FeeRow label="Title Courier"                         amount={fees.titleCourier}      indent editKey="cour"    editValue={ovTitleCourier} onEdit={setOvTitleCourier} defaultVal={50}                            isInternal={canEditFees} />}
              {ovTaxCert      !== "0" && <FeeRow label="Tax Cert / E-Recording / Estate Guar." amount={fees.taxCertERecording} indent editKey="taxcert" editValue={ovTaxCert}      onEdit={setOvTaxCert}      defaultVal={fees._defaults.taxCertERecording} isInternal={canEditFees} />}
              {fees.transferTax > 0    && <FeeRow label={fees.transferTaxLabel}       amount={fees.transferTax}    indent />}
              {fees.attorneyFee > 0    && <FeeRow label="Attorney / Closing Fee"      amount={fees.attorneyFee}    indent />}
              <FeeRow label="Subtotal — Title" amount={fees.titleSubtotal} bold />
            </div>

            {/* ADDITIONAL FEES */}
            {(fees.homeWarranty>0 || fees.hoaTransfer>0 || fees.hoaDuesAmt>0 || fees.otherFee1!==0 || fees.otherFee2!==0 || fees.otherFee3!==0 || fees.rcBuyerAmt>0) && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>ADDITIONAL FEES</div>
                {fees.homeWarranty  > 0 && <FeeRow label="Home Warranty"             amount={fees.homeWarranty}      indent editKey="hw" editValue={ovHomeWarranty} onEdit={setOvHomeWarranty} defaultVal={fees._defaults.homeWarranty} isInternal={canEditFees} />}
                {fees.sellerHWCredit> 0 && <FeeRow label="Home Warranty (Seller Paid)" amount={-fees.sellerHWCredit}  indent color={COLORS.red} />}
                {fees.hoaTransfer   > 0 && <FeeRow label="HOA Transfer Fee"            amount={fees.hoaTransfer}      indent />}
                {fees.otherFee1 !== 0 && <FeeRow label={fees.otherFee1Label || "Other Fee 1"} amount={fees.otherFee1} indent color={fees.otherFee1 < 0 ? COLORS.red : undefined} />}
                {fees.otherFee2 !== 0 && <FeeRow label={fees.otherFee2Label || "Other Fee 2"} amount={fees.otherFee2} indent color={fees.otherFee2 < 0 ? COLORS.red : undefined} />}
                {fees.otherFee3 !== 0 && <FeeRow label={fees.otherFee3Label || "Other Fee 3"} amount={fees.otherFee3} indent color={fees.otherFee3 < 0 ? COLORS.red : undefined} />}
                {fees.rcBuyerAmt > 0 && <FeeRow label="Realtor Commissions: Buyer Paid" amount={fees.rcBuyerAmt} indent />}
                {fees.hoaDuesAmt > 0 && (
                  <div>
                    <FeeRow label={`HOA Dues: ${fees.fundingDateFmt} through ${fees.nextHoaDateFmt}`} amount={fees.hoaDuesAmt} indent />
                    <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, fontStyle:"italic", paddingLeft:16, marginTop:-2, marginBottom:4 }}>
                      {`Credit to Seller's for Prepaid HOA Dues: ${fees.hoaProrationDays} days`}
                    </div>
                  </div>
                )}
                <FeeRow label="Subtotal — Additional Fees" amount={fees.additionalFeesTotal} bold />
              </div>
            )}

            {/* PREPAIDS & ESCROW */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>PREPAIDS & ESCROW</div>
              <FeeRow label={`Prepaid Interest (${fees.shortPayAdj>0?"Short Pay":fees.prepaidDays+" days, from "+fees.prepaidFrom+" to "+fees.prepaidTo})`} amount={fees.adjustedPrepaidInterest} indent />
              {fees.homeownersInsurance > 0 && (
                <FeeRow label={`Homeowners Insurance (12 mo × ${fmt(fees.insMonthly)}/mo)`} amount={fees.homeownersInsurance} indent />
              )}
              {fees.insurancePOCCredit > 0 && (
                <>
                  <FeeRow label="Homeowners Insurance — Paid Outside of Closing (POC)" amount={-fees.insurancePOCCredit} indent color={COLORS.red} />
                  <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, fontStyle:"italic", paddingLeft:16, marginTop:-2, marginBottom:4 }}>
                    Premium paid directly by borrower prior to closing; excluded from cash to close.
                  </div>
                </>
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
              {fees.raInsCollect > 0 && (
                <FeeRow label={`Insurance Prepaid — ${raInsOpt === "60days" ? "2 mo (60 days)" : "6 months"} × ${fmt(fees.insMonthly)}/mo`} amount={fees.raInsCollect} indent color={COLORS.green} />
              )}
              {fees.ins90Amount > 0 && (
                <FeeRow label={`Insurance Prepaid — 90 days × ${fmt(fees.insMonthly)}/mo (escrows waived; renewal within 90 days of funding)`} amount={fees.ins90Amount} indent color={COLORS.green} />
              )}
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
              <FeeRow label="Subtotal — Prepaids" amount={fees.totalPrepaids - fees.sellerProratedTaxCredit} bold />
              {fees.inclEscrow && (
                <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:4, fontFamily:font, lineHeight:1.4 }}>
                  Monthly escrow: {fmt(fees.taxMonthly)}/mo tax + {fmt(fees.insMonthly)}/mo ins = {fmt(fees.taxMonthly+fees.insMonthly)}/mo
                  {fees.aggregateAdj !== 0 && (
                    <span> · aggregate adj {fees.aggregateAdj < 0 ? `(${fmt(Math.abs(fees.aggregateAdj))}) credit` : `+${fmt(fees.aggregateAdj)}`}</span>
                  )}
                </div>
              )}
            </div>

            {/* CREDITS */}
            {(fees.earnest>0||fees.option>0||fees.lenderCred>0||fees.sellerCred>0||fees.realtor>0||fees.shortPayAdj>0||fees.dpaGrantCredit>0) && (() => {
              const creditsTotal = (fees.option||0) + (fees.earnest||0)
                + (fees.isPurchase ? (fees.sellerCred||0) : 0)
                + (fees.realtor||0) + (fees.lenderCred||0)
                + (fees.shortPayAdj||0) + (fees.dpaGrantCredit||0);
              return (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:COLORS.blue, letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>CREDITS</div>
                {fees.option      > 0 && <FeeRow label="Option Money"          amount={-fees.option}     indent color={COLORS.red} />}
                {fees.earnest     > 0 && <FeeRow label="Earnest Money Deposit" amount={-fees.earnest}    indent color={COLORS.red} />}
                {fees.isPurchase && fees.sellerCred > 0 && <FeeRow label="Seller Credits" amount={-fees.sellerCred} indent color={COLORS.red} />}
                {fees.realtor     > 0 && <FeeRow label="Realtor Credits"       amount={-fees.realtor}   indent color={COLORS.red} />}
                {fees.lenderCred  > 0 && <FeeRow label="Lender Credits"        amount={-fees.lenderCred} indent color={COLORS.red} />}
                {fees.dpaGrantCredit > 0 && (() => {
                  const prog   = (fees.dpaDef && fees.dpaDef.label) || "Down Payment Assistance";
                  const isGrant = fees.fsDpaType === "grant";
                  const isForg  = fees.fsDpaType === "forgivable";
                  const typeLabel = isGrant ? "DPA Grant" : isForg ? "DPA Forgivable 2nd Lien" : "DPA Deferred 2nd Lien";
                  const typeNote  = isGrant
                    ? "↑ Grant — no repayment required"
                    : isForg
                    ? `↑ Forgivable 2nd lien (${fmt(fees.dpaGrantCredit)}) — forgiven over time · separate loan obligation`
                    : `↑ Deferred 2nd lien (${fmt(fees.dpaGrantCredit)}) — 0% interest, due on sale or refi · separate loan obligation`;
                  return (
                    <div>
                      <FeeRow label={`${typeLabel} — ${prog}`} amount={-fees.dpaGrantCredit} indent color={COLORS.green} />
                      <div style={{ fontSize:10, color:COLORS.grayLight, fontFamily:font, paddingLeft:20, marginBottom:2, lineHeight:1.4 }}>{typeNote}</div>
                    </div>
                  );
                })()}
                {fees.shortPayAdj > 0 && <FeeRow label="Short Pay Adjustment"  amount={-fees.shortPayAdj} indent color={COLORS.red} />}
                {creditsTotal > 0 && <FeeRow label="Subtotal — Credits" amount={-creditsTotal} bold color={COLORS.red} />}
              </div>
              );
            })()}

            {/* DEBT PAYOFFS AT CLOSING */}
            {fees.debtPayoffs > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#92400e", letterSpacing:"0.06em", marginBottom:6, fontFamily:font }}>DEBT PAYOFFS AT CLOSING</div>
                <FeeRow label="Debt Payoffs (from DTI tab)" amount={fees.debtPayoffs} indent color="#92400e" />
              </div>
            )}

            {/* TOTAL CASH TO CLOSE summary box */}
            {(() => {
              const dp = fees.isPurchase ? ((parseFloat(purchasePrice)||0)-(parseFloat(loanAmount)||0)) : 0;
              const summaryCredits = (fees.option||0) + (fees.earnest||0)
                + (fees.isPurchase ? (fees.sellerCred||0) : 0)
                + (fees.realtor||0) + (fees.lenderCred||0)
                + (fees.shortPayAdj||0) + (fees.dpaGrantCredit||0);

              // ── Down payment integrity check (purchase only) ──────────────────
              // Rule: seller/realtor/lender credits cannot exceed closing costs + GROSS prepaids.
              // Seller's prorated tax credit is NOT a concession — it is excluded from both sides.
              // The buyer is allowed to bring down payment minus the prorated credit to closing.
              const grossPrepaids    = fees.totalPrepaids || 0;
              const coverableCosts   = (fees.displayClosingCosts||0) + (fees.additionalFeesTotal||0) + grossPrepaids;
              const applicableCredit = (fees.isPurchase ? (fees.sellerCred||0) : 0) + (fees.realtor||0) + (fees.lenderCred||0);
              const excessCredits    = applicableCredit - coverableCosts;  // >0 = over-credited
              // Warning: prorated tax credit causes CTC < DP, but is acceptable (buyer repays at year-end)
              const headroom         = Math.max(0, coverableCosts - applicableCredit);
              const proratedOverflow = Math.max(0, (fees.sellerProratedTaxCredit||0) - headroom);

              return (
                <>
                {fees.isPurchase && excessCredits > 0 && (
                  <div style={{ marginBottom:12, padding:"12px 14px", background:"#450a0a", border:"2px solid #ef4444", borderRadius:8 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:"#fca5a5", fontFamily:font, marginBottom:5 }}>
                      ⛔ OVER-CREDITING ERROR — Buyer Not Bringing Full Down Payment
                    </div>
                    <div style={{ fontSize:11, color:"#fecaca", fontFamily:font, lineHeight:1.6 }}>
                      Seller, realtor, and lender credits total <strong style={{color:"#fca5a5"}}>{fmt(applicableCredit)}</strong> but
                      closing costs + prepaids only total <strong style={{color:"#fca5a5"}}>{fmt(coverableCosts)}</strong>.
                      Credits exceed coverable costs by <strong style={{color:"#f87171"}}>{fmt(excessCredits)}</strong> —
                      the buyer will only bring <strong style={{color:"#f87171"}}>{fmt(Math.max(0, dp - excessCredits))}</strong> instead
                      of their full <strong style={{color:"#f87171"}}>{fmt(dp)}</strong> down payment.
                      Reduce credits or adjust the loan structure.
                    </div>
                  </div>
                )}
                {fees.isPurchase && excessCredits <= 0 && proratedOverflow > 0 && (
                  <div style={{ marginBottom:12, padding:"12px 14px", background:"#431407", border:"2px solid #f59e0b", borderRadius:8 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#fcd34d", fontFamily:font, marginBottom:4 }}>
                      ⚠ Prorated Tax Credit Notice
                    </div>
                    <div style={{ fontSize:11, color:"#fde68a", fontFamily:font, lineHeight:1.6 }}>
                      Seller/realtor/lender credits are within limits, but the seller's prorated tax credit
                      ({fmt(fees.sellerProratedTaxCredit)}) reduces cash to close
                      by <strong style={{color:"#fcd34d"}}>{fmt(proratedOverflow)}</strong> below the
                      down payment — buyer brings <strong style={{color:"#fcd34d"}}>{fmt(Math.max(0, fees.grandTotal+dp))}</strong> instead
                      of <strong style={{color:"#fcd34d"}}>{fmt(dp)}</strong>.
                      This is acceptable: the buyer will owe full-year taxes at year-end, covering this difference.
                    </div>
                  </div>
                )}
                <div style={{ marginTop:16, padding:"14px 16px", background:`linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius:8 }}>
                  {fees.isPurchase && (
                    <>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Purchase Price</span>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(parseFloat(purchasePrice)||0)}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:(fees.govUpfrontFee||0) > 0 ? 2 : 4 }}>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>
                          {(fees.govUpfrontFee||0) > 0 ? "Final Loan Amount" : "Loan Amount"}
                        </span>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>
                          ({fmt((parseFloat(loanAmount)||0) + (fees.govUpfrontFee||0))})
                        </span>
                      </div>
                      {(fees.govUpfrontFee||0) > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontSize:10, color:"rgba(255,255,255,0.45)", fontFamily:font, fontStyle:"italic" }}>
                            {loanType === "va"  ? `VA Funding Fee (${((fees.vaFeeRate||0)*100).toFixed(2)}%) — financed into loan` :
                             loanType === "fha" ? "FHA UFMIP (1.75%) — financed into loan" :
                                                  "USDA Guarantee Fee (1.0%) — financed into loan"}
                          </span>
                          <span style={{ fontSize:10, color:"rgba(255,255,255,0.45)", fontFamily:font, fontStyle:"italic" }}>
                            +{fmt(fees.govUpfrontFee)}
                          </span>
                        </div>
                      )}
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Down Payment</span>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>
                          {fmt(Math.max(0, (parseFloat(purchasePrice)||0) - (parseFloat(loanAmount)||0)))}
                        </span>
                      </div>
                    </>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Closing Costs</span>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(fees.displayClosingCosts)}</span>
                  </div>
                  {(fees.additionalFeesTotal > 0) && (
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Additional Fees</span>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(fees.additionalFeesTotal)}</span>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Prepaids & Escrow</span>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(Math.max(0, fees.totalPrepaids - fees.sellerProratedTaxCredit))}</span>
                  </div>
                  {summaryCredits > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Credits</span>
                      <span style={{ fontSize:12, color:"#f87171", fontFamily:font }}>− {fmt(summaryCredits)}</span>
                    </div>
                  )}
                  {fees.debtPayoffs > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>Debt Payoffs at Closing</span>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:font }}>{fmt(fees.debtPayoffs)}</span>
                    </div>
                  )}
                  {!fees.isPurchase && (
                    <>
                      <div style={{ borderTop:"1px solid rgba(255,255,255,0.2)", margin:"6px 0 4px" }} />
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", fontFamily:font }}>New Loan Amount</span>
                        <span style={{ fontSize:11, color:"#86efac", fontFamily:font, fontWeight:700 }}>+ {fmt(parseFloat(loanAmount)||0)}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", fontFamily:font }}>Estimated Payoff</span>
                        <span style={{ fontSize:11, color: fees.refiPayoffAmt > 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)", fontFamily:font, fontWeight:600, fontStyle: fees.refiPayoffAmt > 0 ? "normal" : "italic" }}>
                          {fees.refiPayoffAmt > 0 ? fmt(fees.refiPayoffAmt) : "see Loan Sizing ↑"}
                        </span>
                      </div>
                    </>
                  )}
                  {(() => {
                    const netPrepaids = Math.max(0, (fees.totalPrepaids||0)-(fees.sellerProratedTaxCredit||0));
                    const base = dp+(fees.displayClosingCosts||0)+(fees.additionalFeesTotal||0)+netPrepaids-summaryCredits+(fees.debtPayoffs||0);
                    // refiPayoffAmt = payoff-only (balance + per diem + escrow from PC Loan Sizing).
                    // CC + prepaids are already in base. loanVsPayoffDelta = la − payoff.
                    // net = base − loanVsPayoffDelta = (CC + prepaids − credits) − (la − payoff)
                    //     = CC + prepaids + payoff − la  → negative = cash out to borrower.
                    const net  = fees.refiPayoffAmt > 0 ? base - fees.loanVsPayoffDelta : base;
                    const cashBack = net < 0;
                    return (
                      <div style={{ borderTop:"1px solid rgba(255,255,255,0.3)", marginTop:6, paddingTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:14, fontWeight:700, color:"#fff", fontFamily:font }}>
                          {cashBack ? "CASH BACK TO BORROWER" : "TOTAL CASH TO CLOSE"}
                        </span>
                        <span style={{ fontSize:20, fontWeight:800, color: cashBack ? "#86efac" : "#fff", fontFamily:font }}>
                          {fmt(Math.abs(net))}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Cash-back refund notice ── */}
                {(() => {
                  // Use the same formula as the CTC breakdown box above
                  const displayedCTC = (fees.displayClosingCosts||0) + (fees.additionalFeesTotal||0)
                    + Math.max(0, (fees.totalPrepaids || 0) - (fees.sellerProratedTaxCredit || 0))
                    - summaryCredits + dp;
                  const rawCashBack    = Math.max(0, -displayedCTC);
                  const optAmt         = fees.option  || 0;
                  const earnAmt        = fees.earnest || 0;
                  const earnestAndOpt  = optAmt + earnAmt;
                  const cashBack       = Math.min(rawCashBack, earnestAndOpt);
                  if (!fees.isPurchase || cashBack <= 0) return null;

                  // Describe which pre-paid funds are being partially refunded
                  const parts = [];
                  if (optAmt > 0)   parts.push(`option money (${fmt(optAmt)})`);
                  if (earnAmt > 0)  parts.push(`earnest money deposit (${fmt(earnAmt)})`);
                  const fundsDesc = parts.length === 2
                    ? `${parts[0]} and ${parts[1]}`
                    : parts[0] || "pre-paid funds";

                  return (
                    <div style={{ marginTop:12, padding:"14px 16px", background:"#0c4a6e", border:"2px solid #38bdf8", borderRadius:8 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#7dd3fc", fontFamily:font, marginBottom:6 }}>
                        💰 Cash Back at Closing — {fmt(cashBack)} Refund
                      </div>
                      <div style={{ fontSize:12, color:"#e0f2fe", fontFamily:font, lineHeight:1.7 }}>
                        The total credits on this transaction exceed the closing costs, prepaids, and down payment due.
                        The buyer will receive a <strong style={{color:"#7dd3fc"}}>cash refund of {fmt(cashBack)} at closing</strong>,
                        applied against their pre-paid {fundsDesc}.
                      </div>
                    </div>
                  );
                })()}

                {/* ── Money left on the table warning ── */}
                {(() => {
                  if (!fees.isPurchase) return null;

                  // Credits that have been entered (given) — seller, lender, realtor
                  const sellerGiven  = fees.sellerCred  || 0;
                  const lenderGiven  = fees.lenderCred  || 0;
                  const realtorGiven = fees.realtor      || 0;
                  const creditsGiven = sellerGiven + lenderGiven + realtorGiven;
                  if (creditsGiven <= 0) return null;

                  // Total costs that credits can actually be applied toward
                  const coverableCosts = (fees.displayClosingCosts || 0) + (fees.additionalFeesTotal || 0) + (fees.totalPrepaids || 0);

                  // Amount of given credits that can't be absorbed — left on the table
                  const leftOnTable = Math.max(0, creditsGiven - coverableCosts);
                  if (leftOnTable <= 0) return null;

                  // Attribute the unused portion pro-rata to each credit source
                  const sellerUnused  = creditsGiven > 0 ? Math.round(leftOnTable * sellerGiven  / creditsGiven) : 0;
                  const lenderUnused  = creditsGiven > 0 ? Math.round(leftOnTable * lenderGiven  / creditsGiven) : 0;
                  const realtorUnused = leftOnTable - sellerUnused - lenderUnused;

                  return (
                    <div style={{ marginTop:12, padding:"14px 16px", background:"#450a0a", border:"2px solid #dc2626", borderRadius:8 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#fca5a5", fontFamily:font, marginBottom:6 }}>
                        ⚠ {fmt(leftOnTable)} Left on the Table — Credits Exceed Closing Costs &amp; Prepaids
                      </div>
                      <div style={{ fontSize:12, color:"#fecaca", fontFamily:font, lineHeight:1.7, marginBottom:8 }}>
                        Total credits entered ({fmt(creditsGiven)}) exceed the closing costs and prepaids that can be covered ({fmt(coverableCosts)}).
                        The remaining <strong style={{color:"#f87171"}}>{fmt(leftOnTable)}</strong> cannot be applied and is being left on the table.
                      </div>
                      <div style={{ padding:"8px 12px", background:"rgba(0,0,0,0.25)", borderRadius:6, fontSize:11, color:"#fecaca", fontFamily:font, lineHeight:1.8 }}>
                        {sellerUnused  > 0 && <div>Seller Concessions: {fmt(sellerGiven)} given → <strong style={{color:"#f87171"}}>{fmt(sellerUnused)}</strong> unused</div>}
                        {lenderUnused  > 0 && <div>Lender Credits: {fmt(lenderGiven)} given → <strong style={{color:"#f87171"}}>{fmt(lenderUnused)}</strong> unused</div>}
                        {realtorUnused > 0 && <div>Realtor Credits: {fmt(realtorGiven)} given → <strong style={{color:"#f87171"}}>{fmt(realtorUnused)}</strong> unused</div>}
                      </div>
                      <div style={{ marginTop:8, fontSize:11, color:"#fca5a5", fontFamily:font, fontStyle:"italic" }}>
                        Consider using unused credits for a permanent rate buydown, prepaid items, or negotiating a lower purchase price.
                      </div>
                    </div>
                  );
                })()}

                </>
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
                  setOvUnderwriting(""); setOvProcessing(""); setOvAppraisal(""); setOvAppraisalReview(""); setOvS2LienFee("");
                  setOvCreditReport(""); setOvFloodCert(""); setOvTaxService("");
                  setOvDocPrep(""); setOvSurvey(""); setOvEscrowFee("");
                  setOvTitleSearch(""); setOvHomeWarranty("");
                  setOvPestInspection(""); setOvBondFee("");
                }} style={{ padding:"8px 16px", background:COLORS.grayLight, color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:font }}>
                  ↺ Reset Fees
                </button>
              </div>
            )}
          </SectionCard>

          {/* PDF Download button — bottom of fee sheet */}
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:10 }}>
            <button
              onClick={downloadFeeSheetPDF}
              disabled={pdfLoading}
              style={{ padding:"9px 20px", background: pdfLoading ? COLORS.grayLight : COLORS.navy, color:"#fff", border:"none", borderRadius:8, cursor: pdfLoading ? "default" : "pointer", fontSize:13, fontWeight:700, fontFamily:font, letterSpacing:"0.03em", boxShadow:"0 2px 6px rgba(0,0,0,0.18)", transition:"background 0.15s" }}
            >
              {pdfLoading ? "⏳ Generating…" : "Download PDF"}
            </button>
          </div>

          {/* ── Zeroed-Out / Hidden Fees ── */}
          {(() => {
            const zItems = [
              { label: "Underwriting Fee",       ov: ovUnderwriting,    setOv: setOvUnderwriting,    def: fees._defaults.underwriting },
              { label: "Processing Fee",         ov: ovProcessing,      setOv: setOvProcessing,      def: fees._defaults.processingFee },
              { label: "Appraisal",              ov: ovAppraisal,       setOv: setOvAppraisal,       def: fees._defaults.appraisal,       skip: fees.piw },
              { label: "Appraisal Review",       ov: ovAppraisalReview, setOv: setOvAppraisalReview, def: fees._defaults.appraisalReview, skip: fees.piw },
              { label: "Credit & Verifications (as needed)", ov: ovCreditReport,    setOv: setOvCreditReport,    def: fees._defaults.creditReport },
              { label: "Flood Certification",    ov: ovFloodCert,       setOv: setOvFloodCert,       def: fees._defaults.floodCert },
              { label: "Tax Service Fee",        ov: ovTaxService,      setOv: setOvTaxService,      def: fees._defaults.taxService },
              { label: "Doc Prep",               ov: ovDocPrep,         setOv: setOvDocPrep,         def: fees._defaults.docPrep },
              { label: "Escrow/Settlement Fee",  ov: ovEscrowFee,       setOv: setOvEscrowFee,       def: fees._defaults.escrowFee },
              { label: "Recording Fees",         ov: ovRecordingFee,    setOv: setOvRecordingFee,    def: fees._defaults.recordingFees },
              { label: "Title Courier",          ov: ovTitleCourier,    setOv: setOvTitleCourier,    def: 50 },
              { label: "Tax Cert / E-Recording", ov: ovTaxCert,         setOv: setOvTaxCert,         def: fees._defaults.taxCertERecording },
              { label: "Survey",                 ov: ovSurvey,          setOv: setOvSurvey,          def: fees._defaults.survey,           skip: !effectiveSurvey || effectiveExistingSurvey },
              { label: fees.isPurchase ? "Survey: T-47 Endorsement" : "Survey: T-47 Affidavit", ov: ovT47, setOv: setOvT47, def: 175, skip: !effectiveExistingSurvey },
            ].filter(i => i.ov === "0" && !i.skip);
            if (zItems.length === 0) return null;
            return (
              <div className="mtk-no-print" style={{ marginTop: 16, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "#f1f5f9", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font, letterSpacing: "0.05em" }}>⊘ ZEROED-OUT FEES</span>
                  <span style={{ fontSize: 11, color: COLORS.gray, fontFamily: font }}>— hidden from sheet · click Restore to add back</span>
                </div>
                <div style={{ background: "#fff" }}>
                  {zItems.map((item, idx) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 14px", borderBottom: idx < zItems.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: COLORS.gray, fontFamily: font, textDecoration: "line-through" }}>{item.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.gray, fontFamily: font, minWidth: 48, textAlign: "right" }}>{fmt(item.def)}</span>
                        <button onClick={() => item.setOv("")} style={{ padding: "3px 12px", fontSize: 11, fontWeight: 600, color: COLORS.blue, background: `${COLORS.blue}12`, border: `1px solid ${COLORS.blue}33`, borderRadius: 5, cursor: "pointer", fontFamily: font, whiteSpace: "nowrap" }}>
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── CASH EXPENDITURES — 90-Day Cash Flow (Refi only) ── */}
          {!fees.isPurchase && (() => {
            const ctc      = fees.grandTotal || 0;
            const curPI    = parseFloat(raCurPI) || 0;
            const escBal   = parseFloat(raEscBal) || 0;
            const escRefund = (!raNetEsc && escBal > 0) ? escBal : 0;

            // Determine which month gets skipped (month before first payment)
            let skippedMonthLabel = "Transition Month";
            if (!shortPay && raFirstPmtDate) {
              const firstPmt  = new Date(raFirstPmtDate + "T00:00:00");
              const skippedMo = new Date(firstPmt.getFullYear(), firstPmt.getMonth() - 1, 1);
              skippedMonthLabel = skippedMo.toLocaleString("en-US", { month: "long", year: "numeric" });
            }

            // All amounts from homeowner's perspective: positive = inflow, negative = outflow
            const closingFlow  = -ctc;
            const skippedFlow  = shortPay ? 0 : curPI;
            const escRow       = escRefund;
            const netFlow      = closingFlow + skippedFlow + escRow;

            const fmtFlow = v => {
              if (v === 0) return fmt(0);
              return v > 0 ? `+${fmt(v)}` : `(${fmt(Math.abs(v))})`;
            };

            const FlowRow = ({ label, amount, note, muted }) => (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"9px 0", borderBottom:`1px solid ${COLORS.border}` }}>
                <div style={{ flex:1, paddingRight:16 }}>
                  <div style={{ fontSize:13, fontFamily:font, color: muted ? COLORS.grayLight : COLORS.navy }}>{label}</div>
                  {note && <div style={{ fontSize:10, color:COLORS.grayLight, marginTop:2, fontFamily:font, lineHeight:1.5 }}>{note}</div>}
                </div>
                <span style={{ fontSize:15, fontWeight:700, fontFamily:font, whiteSpace:"nowrap",
                  color: amount > 0 ? COLORS.green : amount < 0 ? COLORS.red : COLORS.grayLight }}>
                  {fmtFlow(amount)}
                </span>
              </div>
            );

            return (
              <div style={{ marginTop:16 }}>
                <SectionCard title="REFINANCE: 90-DAY CASH FLOW SNAPSHOT" accent={COLORS.navy}>
                  <div style={{ fontSize:11, color:COLORS.grayLight, fontFamily:font, marginBottom:14, lineHeight:1.6 }}>
                    A summary of every cash event in the 90 days surrounding your refinance — what leaves your account, what comes back, and what you save during the transition.
                  </div>

                  {/* AT CLOSING */}
                  <div style={{ fontSize:10, fontWeight:700, color:COLORS.blue, letterSpacing:"0.08em", marginBottom:2, fontFamily:font }}>AT CLOSING</div>
                  {ctc > 0 ? (
                    <FlowRow
                      label="Cash Due at Closing"
                      amount={closingFlow}
                      note="Closing costs, prepaids, and escrow reserves — net of any lender credits"
                    />
                  ) : ctc < 0 ? (
                    <FlowRow
                      label="Cash Received at Closing"
                      amount={closingFlow}
                      note="Credits exceed costs — net cash distributed to borrower at closing"
                    />
                  ) : (
                    <FlowRow
                      label="Cash to Close"
                      amount={0}
                      note="Closing costs fully offset by credits — nothing due at closing"
                    />
                  )}

                  {/* SKIPPED PAYMENT */}
                  <div style={{ fontSize:10, fontWeight:700, color:COLORS.blue, letterSpacing:"0.08em", marginTop:12, marginBottom:2, fontFamily:font }}>~ DAYS 15–45 — PAYMENT TIMING</div>
                  {shortPay ? (
                    <div style={{ padding:"9px 12px", background:`${COLORS.green}12`, border:`1px solid ${COLORS.green}44`, borderRadius:6, fontSize:11, color:COLORS.navy, fontFamily:font, lineHeight:1.6 }}>
                      <strong style={{ color:COLORS.green }}>Short Pay — First Payment Arrives Sooner.</strong> Because you're closing in the first 5 days of the month, there's no transition gap. Your first new payment is due the very next month — no "skipped" month, but also no free month. You simply start paying sooner.
                    </div>
                  ) : curPI > 0 ? (
                    <FlowRow
                      label={`No ${skippedMonthLabel} Payment Due`}
                      amount={skippedFlow}
                      note="Your old loan is paid off and your new loan's first payment isn't due yet — no payment is owed to anyone this month"
                    />
                  ) : (
                    <div style={{ padding:"9px 12px", background:"#f8f9fb", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:11, color:COLORS.grayLight, fontFamily:font }}>
                      Enter your current <strong>P&amp;I payment</strong> in the <strong>Refi: Existing Loan</strong> tab to see your skipped-payment savings here.
                    </div>
                  )}

                  {/* ESCROW REFUND */}
                  <div style={{ fontSize:10, fontWeight:700, color:COLORS.blue, letterSpacing:"0.08em", marginTop:12, marginBottom:2, fontFamily:font }}>~ DAYS 30–60 — ESCROW REFUND</div>
                  {raNetEsc ? (
                    <div style={{ padding:"9px 12px", background:`${COLORS.blue}10`, border:`1px solid ${COLORS.blue}33`, borderRadius:6, fontSize:11, color:COLORS.navy, fontFamily:font, lineHeight:1.6 }}>
                      <strong style={{ color:COLORS.blue }}>Escrow Netted from Payoff.</strong> Your escrow balance ({fmt(escBal)}) was credited against the loan payoff at closing — no separate refund check is coming.
                    </div>
                  ) : escBal > 0 ? (
                    <FlowRow
                      label="Escrow Refund from Prior Servicer"
                      amount={escRow}
                      note="The prior servicer refunds your existing escrow account balance — typically arrives as a check within 30 to 60 days of payoff"
                    />
                  ) : (
                    <div style={{ padding:"9px 12px", background:"#f8f9fb", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:11, color:COLORS.grayLight, fontFamily:font }}>
                      Enter your <strong>current escrow balance</strong> in the Escrow Details section to see your refund estimate here.
                    </div>
                  )}

                  {/* NET TOTAL */}
                  <div style={{ marginTop:16, padding:"14px 18px", background:`linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})`, borderRadius:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.75)", fontFamily:font, letterSpacing:"0.06em" }}>NET 90-DAY CASH IMPACT</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:3, fontFamily:font }}>
                          {curPI === 0 && !shortPay
                            ? "Add current P&I in Refi tab to complete this total"
                            : `Closing ${fmtFlow(closingFlow)}${skippedFlow ? `  +  Skipped Pmt ${fmtFlow(skippedFlow)}` : ""}${escRow ? `  +  Escrow Refund ${fmtFlow(escRow)}` : ""}`}
                        </div>
                      </div>
                      <span style={{ fontSize:28, fontWeight:800, fontFamily:font,
                        color: netFlow >= 0 ? "#4ade80" : "#f87171" }}>
                        {fmtFlow(netFlow)}
                      </span>
                    </div>
                  </div>

                  {/* Contextual explainer */}
                  <div style={{ marginTop:12, padding:"10px 14px", background:"#f8f9fb", border:`1px solid ${COLORS.border}`, borderRadius:6, fontSize:10, color:COLORS.grayLight, fontFamily:font, lineHeight:1.7 }}>
                    <strong style={{ color:COLORS.navy }}>How to read this:</strong> A positive net means the escrow refund and skipped payment more than offset what you spent at closing — the refi puts money back in your pocket within 90 days. A negative net means your upfront closing costs exceed those short-term inflows, but the long-term monthly savings (from a lower rate or payment) make up the difference over time.
                  </div>
                </SectionCard>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── HIDDEN PDF PRINT CONTAINER (816px = 8.5" @ 96dpi) ── */}
      <div ref={pdfRef} style={{ position:"fixed", left:-9999, top:0, width:816, background:"#fff", fontFamily:"'Segoe UI',Arial,sans-serif" }}>

        {/* HEADER */}
        <div style={{ background:"linear-gradient(135deg,#162447 0%,#1e3a5f 100%)", padding:"14px 24px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:24, fontWeight:800, color:"#fff", letterSpacing:"0.02em" }}>CLOSING COST ESTIMATE</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginTop:4, letterSpacing:"0.07em" }}>
              {stateName.toUpperCase()} · {fees.isPurchase ? "PURCHASE" : "REFINANCE"} · {loanTypeLabel.toUpperCase()}
            </div>
            {pdfBorrowerName && <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", marginTop:5, fontWeight:600 }}>Borrower: {pdfBorrowerName}</div>}
            {pdfScenarioName  && <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2 }}>Scenario: {pdfScenarioName}</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            {loName && <div style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{loName}</div>}
            {loNmls && <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)" }}>NMLS # {loNmls}</div>}
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginTop:2 }}>
              {new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:1 }}>
              {new Date().toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true })}
            </div>
          </div>
        </div>

        {/* LOAN SUMMARY STRIP */}
        <div style={{ background:"#f8fafc", borderBottom:"1.5px solid #e2e8f0", padding:"7px 24px", display:"flex", gap:24, flexWrap:"wrap", fontSize:11, color:"#64748b" }}>
          {[
            ["Loan Amount",   fmt(parseFloat(loanAmount)||0)],
            fees.isPurchase ? ["Purchase Price", fmt(parseFloat(purchasePrice)||0)] : null,
            ["Interest Rate", `${rate}%`],
            ["Term",          `${term} Years`],
            ["Closing Date",  closingDate || "TBD"],
            ["Program",       loanTypeLabel],
          ].filter(Boolean).map(function(pair) {
            return <div key={pair[0]}><span style={{ opacity:0.75 }}>{pair[0]}: </span><strong style={{ color:"#1e293b" }}>{pair[1]}</strong></div>;
          })}
        </div>

        {/* BODY — single column by default, dual when content exceeds one page */}
        <div style={{ padding:"7px 24px 6px", display: pdfDualCol ? "flex" : "block", gap:20, alignItems:"flex-start" }}>

          {/* LEFT COLUMN — Lender / Third Party / Title fees */}
          <div style={{ flex: pdfDualCol ? "1 1 0%" : undefined, minWidth:0 }}>

            <PdfSection title="LENDER FEES" />
            {fees.origination > 0 && <PdfRow label={`Origination Fee (${parseFloat(fees.origPct)}%) *`} amt={fees.origination} indent />}
            {fees.discount    > 0 && <PdfRow label={`Discount Points (${parseFloat(fees.discPts)}%) *`}  amt={fees.discount}    indent />}
            <PdfRow label="Underwriting Fee *"   amt={fees.underwriting}  indent />
            <PdfRow label="Processing Fee *"     amt={fees.processingFee} indent />
            {fees.secondLienFee > 0     && <PdfRow label="2nd Lien Fee"       amt={fees.secondLienFee} indent />}
            {fees.dpaProgOriginationAmt > 0 && <PdfRow label={`${fees.dpaDef.label} ${fees.dpaDef.originationLabel || "Required Origination"} (${fees.dpaProgOriginationPct.toFixed(2)}%)`} amt={fees.dpaProgOriginationAmt} indent />}
            {fees.dpaMhuFundingAmt > 0      && <PdfRow label={`MHU Funding Fee (${fees.dpaDef.mhuFundingPct}%)`} amt={fees.dpaMhuFundingAmt} indent />}
            {fees.tempBdCost > 0            && <PdfRow label={`Temporary Buydown (${fees.fsTempBdType})`} amt={fees.tempBdCost} indent />}
            {fees.govUpfrontFee > 0     && <PdfRow label={loanType==="va" ? `VA Funding Fee — ${fees.govMiAtClosing ? "paid at closing" : "financed"}` : loanType==="fha" ? `FHA Upfront MIP (1.75%) — ${fees.govMiAtClosing ? "paid at closing" : "financed"}` : `USDA Guarantee Fee (1%) — ${fees.govMiAtClosing ? "paid at closing" : "financed"}`} amt={fees.govUpfrontFee} indent muted={!fees.govMiAtClosing} />}
            {fees.convUpfrontPremium > 0 && <PdfRow label={fees.convMiAtClosing ? "MI Upfront Premium — at closing" : "MI Upfront Premium — financed"} amt={fees.convUpfrontPremium} indent muted={!fees.convMiAtClosing} />}
            <PdfRow label="Subtotal — Lender Fees" amt={fees.lenderFees + fees.govUpfrontForCTC} bold />

            <PdfSection title="THIRD PARTY FEES" />
            <PdfRow label={fees.piw ? "Appraisal — PIW Waived" : "Appraisal"} amt={fees.appraisal} indent muted={fees.piw} />
            {fees.appraisalPOCCredit > 0 && <PdfRow label="Appraisal — Paid Outside of Closing (POC)" amt={-fees.appraisalPOCCredit} indent isRed />}
            {!fees.piw && fees.appraisalReview > 0 && <PdfRow label="Appraisal Review (if applicable)" amt={fees.appraisalReview} indent />}
            <PdfRow label="Credit & Verifications (as needed)" amt={fees.creditReport} indent />
            <PdfRow label="Flood Certification *"  amt={fees.floodCert}   indent />
            <PdfRow label="Tax Service Fee *"       amt={fees.taxService}  indent />
            <PdfRow label="Doc Prep *"              amt={fees.docPrep}     indent />
            {effectiveSurvey && !effectiveExistingSurvey && ovSurvey !== "0" && <PdfRow label="Survey" amt={fees.survey} indent />}
            {fees.isPurchase && effectiveSurvey && !effectiveExistingSurvey && ovSurvey !== "0" && sellerPaidSurvey && <PdfRow label="Survey: Seller Pays (New Survey)" amt={-fees.survey} indent isRed />}
            {effectiveExistingSurvey && ovT47 !== "0" && <PdfRow label={fees.isPurchase ? "Survey: T-47 Endorsement (Existing Survey)" : "Survey: T-47 Affidavit (Owner Existing Survey)"} amt={fees.t47Fee} indent />}
            {fees.pestInspection > 0    && <PdfRow label="Pest Inspection (VA)"      amt={fees.pestInspection} indent />}
            {fees.dpaBondFee > 0        && <PdfRow label="Bond Fee"                  amt={fees.dpaBondFee}     indent />}
            {(fees.dpaProgFeesList || []).map(f => <PdfRow key={f.key} label={f.label} amt={f.amount} indent />)}
            {(fees.dpaOptFeesList  || []).map(f => <PdfRow key={f.key} label={f.label} amt={f.amount} indent />)}
            <PdfRow label="Subtotal — Third Party" amt={fees.thirdPartySubtotal} bold />

            <PdfSection title="TITLE &amp; CLOSING FEES" />
            {fees.isPurchase            && <PdfRow label="Owner's Title Policy"           amt={fees.ownerTitlePolicy}  indent />}
            {fees.isPurchase && sellerPaidTitle && fees.ownerTitlePolicy > 0 && <PdfRow label="Owner's Title (Seller Paid)" amt={-fees.ownerTitlePolicy} indent isRed />}
            <PdfRow label={fees.isPurchase ? "Lender's Title (Simultaneous)" : "Lender's Title Policy"} amt={fees.lenderTitlePolicy} indent />
            {fees.txReissueCredit > 0 && <PdfRow label="Lender's Title: TX Reissue Rate Credit" amt={-fees.txReissueCredit} indent isRed />}
            {fees.escrowFee   > 0       && <PdfRow label="Escrow / Settlement Fee"    amt={fees.escrowFee}   indent />}
            <PdfRow label="Recording Fees" amt={fees.recordingFees} indent />
            {fees.transferTax > 0       && <PdfRow label={fees.transferTaxLabel || "Transfer Tax"} amt={fees.transferTax} indent />}
            {fees.attorneyFee > 0       && <PdfRow label="Attorney / Closing Fee"     amt={fees.attorneyFee} indent />}
            <PdfRow label="Subtotal — Title" amt={fees.titleSubtotal} bold />

            {(fees.homeWarranty > 0 || fees.hoaTransfer > 0 || fees.hoaDuesAmt > 0 || fees.otherFee1 !== 0 || fees.otherFee2 !== 0 || fees.otherFee3 !== 0 || fees.rcBuyerAmt > 0) && (
              <React.Fragment>
                <PdfSection title="ADDITIONAL FEES" />
                {fees.homeWarranty   > 0 && <PdfRow label="Home Warranty"                                      amt={fees.homeWarranty}   indent />}
                {fees.sellerHWCredit > 0 && <PdfRow label="Home Warranty (Seller Paid)"                        amt={-fees.sellerHWCredit} indent isRed />}
                {fees.hoaTransfer    > 0 && <PdfRow label="HOA Transfer Fee"                                   amt={fees.hoaTransfer}    indent />}
                {fees.hoaDuesAmt     > 0 && <PdfRow label={`HOA Dues: ${fees.fundingDateFmt} – ${fees.nextHoaDateFmt}`} amt={fees.hoaDuesAmt} indent />}
                {fees.otherFee1 !== 0 && <PdfRow label={fees.otherFee1Label || "Other Fee 1"} amt={fees.otherFee1} indent isRed={fees.otherFee1 < 0} />}
                {fees.otherFee2 !== 0 && <PdfRow label={fees.otherFee2Label || "Other Fee 2"} amt={fees.otherFee2} indent isRed={fees.otherFee2 < 0} />}
                {fees.otherFee3 !== 0 && <PdfRow label={fees.otherFee3Label || "Other Fee 3"} amt={fees.otherFee3} indent isRed={fees.otherFee3 < 0} />}
                {fees.rcBuyerAmt > 0 && <PdfRow label="Realtor Commissions: Buyer Paid" amt={fees.rcBuyerAmt} indent />}
                <PdfRow label="Subtotal — Additional Fees" amt={fees.additionalFeesTotal} bold />
              </React.Fragment>
            )}

          </div>

          {/* RIGHT COLUMN — Prepaids, Credits, CTC */}
          <div style={{ flex: pdfDualCol ? "1 1 0%" : undefined, minWidth:0 }}>

            <PdfSection title="PREPAIDS &amp; ESCROW" />
            <PdfRow label={"Prepaid Interest (" + fees.prepaidDays + " days, from " + fees.prepaidFrom + " to " + fees.prepaidTo + ")"} amt={fees.adjustedPrepaidInterest} indent />
            {fees.homeownersInsurance > 0 && <PdfRow label={"Homeowners Ins. (12 mo \u00d7 " + fmt(fees.insMonthly) + "/mo)"} amt={fees.homeownersInsurance} indent />}
            {fees.insurancePOCCredit  > 0 && <PdfRow label="Insurance — POC" amt={-fees.insurancePOCCredit} indent isRed />}
            {fees.taxReserves  > 0        && <PdfRow label={"Tax Reserves (" + fees.taxReserveMonths + " mo \u00d7 " + fmt(fees.taxMonthly) + "/mo)"} amt={fees.taxReserves} indent />}
            {fees.insReserves  > 0        && <PdfRow label={"Ins. Reserves (" + fees.insReserveMonths + " mo \u00d7 " + fmt(fees.insMonthly) + "/mo)"} amt={fees.insReserves} indent />}
            {fees.aggregateAdj !== 0      && <PdfRow label="Aggregate Adjustment" amt={fees.aggregateAdj} indent isRed={fees.aggregateAdj < 0} />}
            {fees.raInsCollect > 0        && <PdfRow label={"Ins. Prepaid (" + (raInsOpt === "60days" ? "2 mo" : "6 mo") + " \u00d7 " + fmt(fees.insMonthly) + "/mo)"} amt={fees.raInsCollect} indent />}
            {fees.sellerProratedTaxCredit > 0 && <PdfRow label={"Seller's Prorated Tax Credit (" + fees.sellerProratedDays + " days)"} amt={-fees.sellerProratedTaxCredit} indent isRed />}
            <PdfRow label="Subtotal — Prepaids & Escrow" amt={(fees.totalPrepaids||0) - (fees.sellerProratedTaxCredit||0)} bold />

            {(pdfSummaryCredits > 0 || fees.debtPayoffs > 0) && <PdfSection title="CREDITS &amp; ADJUSTMENTS" />}
            {fees.option        > 0 && <PdfRow label="Option Money"            amt={-fees.option}         indent isRed />}
            {fees.earnest       > 0 && <PdfRow label="Earnest Money"           amt={-fees.earnest}        indent isRed />}
            {fees.sellerCred    > 0 && fees.isPurchase && <PdfRow label="Seller Concessions" amt={-fees.sellerCred} indent isRed />}
            {fees.realtor       > 0 && <PdfRow label="Realtor Contribution"    amt={-fees.realtor}        indent isRed />}
            {fees.lenderCred    > 0 && <PdfRow label="Lender Credits"          amt={-fees.lenderCred}     indent isRed />}
            {fees.dpaGrantCredit> 0 && <PdfRow label="DPA Grant Credit"        amt={-fees.dpaGrantCredit} indent isRed />}
            {fees.debtPayoffs   > 0 && <PdfRow label="Debt Payoffs at Closing" amt={fees.debtPayoffs}     indent />}
            {(pdfSummaryCredits > 0 || fees.debtPayoffs > 0) && <PdfRow label="Subtotal — Credits & Adj." amt={-(pdfSummaryCredits) + (fees.debtPayoffs||0)} bold isRed={pdfSummaryCredits > (fees.debtPayoffs||0)} />}

            {/* TOTAL CASH TO CLOSE BOX */}
            {(function() {
              var pdfClosingCosts     = fees.displayClosingCosts || 0;
              var pdfAdditionalFees   = fees.additionalFeesTotal || 0;
              var pdfPrepaids         = Math.max(0, (fees.totalPrepaids||0) - (fees.sellerProratedTaxCredit||0));
              var pdfCTC              = Math.max(0, pdfClosingCosts + pdfAdditionalFees + pdfPrepaids - pdfSummaryCredits + (fees.debtPayoffs||0) + pdfDP);
              return (
                <div style={{ marginTop:8, padding:"10px 12px", background:"linear-gradient(135deg,#162447,#1e3a5f)", borderRadius:8 }}>
                  {[
                    fees.isPurchase   ?     ["Purchase Price",  parseFloat(purchasePrice)||0,                                false   ] : null,
                    fees.isPurchase   ?     ["Loan Amount",    (parseFloat(loanAmount)||0) + (fees.govUpfrontFee||0),        "parens"] : null,
                    pdfDP             > 0 ? ["Down Payment",    pdfDP,             false] : null,
                    ["Closing Costs",       pdfClosingCosts,   false],
                    pdfAdditionalFees > 0 ? ["Additional Fees", pdfAdditionalFees, false] : null,
                    ["Prepaids & Escrow",   pdfPrepaids,       false],
                    pdfSummaryCredits > 0 ? ["Credits",        -pdfSummaryCredits, true]  : null,
                    fees.debtPayoffs  > 0 ? ["Debt Payoffs",    fees.debtPayoffs,  false] : null,
                  ].filter(Boolean).map(function(pair) {
                    var val      = pair[1];
                    var isRed    = pair[2] === true;
                    var isParens = pair[2] === "parens";
                    return (
                      <div key={pair[0]} style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>{pair[0]}</span>
                        <span style={{ fontSize:10, fontWeight:600, color: isRed ? "#fca5a5" : "rgba(255,255,255,0.9)" }}>
                          {isRed ? "− " + fmt(Math.abs(Math.round(val))) : isParens ? "(" + fmt(Math.round(val)) + ")" : fmt(Math.round(val))}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{ borderTop:"1px solid rgba(255,255,255,0.25)", marginTop:5, paddingTop:7, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, fontWeight:800, color:"#fff", letterSpacing:"0.05em" }}>TOTAL CASH TO CLOSE</span>
                    <span style={{ fontSize:22, fontWeight:800, color:"#fff" }}>{fmt(pdfCTC)}</span>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>

        {/* FULL-WIDTH WARNING BOXES */}
        {(() => {
          var pdfGrossPrepaids    = fees.totalPrepaids || 0;
          var pdfCoverableCosts   = (fees.displayClosingCosts||0) + (fees.additionalFeesTotal||0) + pdfGrossPrepaids;
          var pdfApplicableCredit = (fees.isPurchase ? (fees.sellerCred||0) : 0) + (fees.realtor||0) + (fees.lenderCred||0);
          var pdfExcessCredits    = pdfApplicableCredit - pdfCoverableCosts;
          var pdfHeadroom         = Math.max(0, pdfCoverableCosts - pdfApplicableCredit);
          var pdfProratedOverflow = Math.max(0, (fees.sellerProratedTaxCredit||0) - pdfHeadroom);

          var pdfDisplayedCTC = (fees.displayClosingCosts||0) + (fees.additionalFeesTotal||0)
            + Math.max(0, (fees.totalPrepaids||0) - (fees.sellerProratedTaxCredit||0))
            - pdfSummaryCredits + pdfDP;
          var pdfRawCashBack  = Math.max(0, -pdfDisplayedCTC);
          var optAmt  = fees.option  || 0;
          var earnAmt = fees.earnest || 0;
          var pdfCashBack = Math.min(pdfRawCashBack, optAmt + earnAmt);

          var sellerGiven  = fees.sellerCred || 0;
          var lenderGiven  = fees.lenderCred || 0;
          var realtorGiven = fees.realtor    || 0;
          var creditsGiven = sellerGiven + lenderGiven + realtorGiven;
          var leftOnTableCoverable = (fees.displayClosingCosts||0) + (fees.additionalFeesTotal||0) + (fees.totalPrepaids||0);
          var leftOnTable = creditsGiven > 0 ? Math.max(0, creditsGiven - leftOnTableCoverable) : 0;
          var sellerUnused  = creditsGiven > 0 ? Math.round(leftOnTable * sellerGiven  / creditsGiven) : 0;
          var lenderUnused  = creditsGiven > 0 ? Math.round(leftOnTable * lenderGiven  / creditsGiven) : 0;
          var realtorUnused = leftOnTable - sellerUnused - lenderUnused;

          var showProrated  = fees.isPurchase && pdfExcessCredits <= 0 && pdfProratedOverflow > 0;
          var showCashBack  = fees.isPurchase && pdfCashBack > 0;
          var showLeftOnTbl = fees.isPurchase && leftOnTable > 0;
          if (!showProrated && !showCashBack && !showLeftOnTbl) return null;

          return (
            <div style={{ padding:"0 24px 6px" }}>
              {showProrated && (
                <div style={{ marginTop:8, padding:"9px 12px", background:"#431407", border:"2px solid #f59e0b", borderRadius:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#fcd34d", marginBottom:3 }}>⚠ Prorated Tax Credit Notice</div>
                  <div style={{ fontSize:9, color:"#fde68a", lineHeight:1.6 }}>
                    Seller/realtor/lender credits are within limits, but the seller's prorated tax credit ({fmt(fees.sellerProratedTaxCredit)}) reduces
                    cash to close by <strong style={{color:"#fcd34d"}}>{fmt(pdfProratedOverflow)}</strong> below the down payment — buyer brings{" "}
                    <strong style={{color:"#fcd34d"}}>{fmt(Math.max(0, pdfDisplayedCTC))}</strong> instead of{" "}
                    <strong style={{color:"#fcd34d"}}>{fmt(pdfDP)}</strong>.
                    This is acceptable: the buyer will owe full-year taxes at year-end, covering this difference.
                  </div>
                </div>
              )}
              {showCashBack && (
                <div style={{ marginTop:8, padding:"9px 12px", background:"#0c4a6e", border:"2px solid #38bdf8", borderRadius:6 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:"#7dd3fc", marginBottom:3 }}>
                    💰 Cash Back at Closing — {fmt(pdfCashBack)} Refund
                  </div>
                  <div style={{ fontSize:9, color:"#e0f2fe", lineHeight:1.6 }}>
                    The total credits exceed the closing costs, prepaids, and down payment due.
                    The buyer will receive a cash refund of <strong style={{color:"#7dd3fc"}}>{fmt(pdfCashBack)}</strong> at closing,
                    applied against their pre-paid{optAmt > 0 ? " option money (" + fmt(optAmt) + ")" : ""}{optAmt > 0 && earnAmt > 0 ? " and" : ""}{earnAmt > 0 ? " earnest money deposit (" + fmt(earnAmt) + ")" : ""}.
                  </div>
                </div>
              )}
              {showLeftOnTbl && (
                <div style={{ marginTop:8, padding:"9px 12px", background:"#450a0a", border:"2px solid #dc2626", borderRadius:6 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:"#fca5a5", marginBottom:3 }}>
                    ⚠ {fmt(leftOnTable)} Left on the Table — Credits Exceed Closing Costs &amp; Prepaids
                  </div>
                  <div style={{ fontSize:9, color:"#fecaca", lineHeight:1.6 }}>
                    Total credits entered ({fmt(creditsGiven)}) exceed the closing costs and prepaids that can be covered ({fmt(leftOnTableCoverable)}).
                    The remaining <strong style={{color:"#f87171"}}>{fmt(leftOnTable)}</strong> cannot be applied.
                    {sellerUnused  > 0 && " Seller: " + fmt(sellerUnused) + " unused."}
                    {lenderUnused  > 0 && " Lender: " + fmt(lenderUnused) + " unused."}
                    {realtorUnused > 0 && " Realtor: " + fmt(realtorUnused) + " unused."}
                    {" "}Consider using unused credits for a rate buydown or price reduction.
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* FOOTER */}
        <div style={{ padding:"7px 24px 10px", borderTop:"1px solid #e2e8f0", fontSize:9, color:"#94a3b8", lineHeight:1.6, marginTop:10 }}>
          * Finance charges included in APR: Origination, Discount Points, Underwriting, Processing, Flood Cert, Tax Service, Doc Prep.{" "}
          {fees.disclaimer || "Title insurance rates are estimates and may vary by title company and lender."}{" "}
          This is a cost estimate only — not a loan commitment or guarantee of rates or terms. Subject to credit approval.
        </div>
      </div>
    </div>
  );
}

window.FeeSheetGenerator = FeeSheetGenerator;
