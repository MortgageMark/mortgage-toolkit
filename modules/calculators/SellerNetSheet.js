// modules/calculators/SellerNetSheet.js
const { useState, useEffect, useMemo, useRef } = React;
const useLocalStorage = window.useLocalStorage;
const SectionCard = window.SectionCard;
const Select = window.Select;
const Toggle = window.Toggle;
const LabeledInput = window.LabeledInput;
const fmt = window.fmt;
const fmtCredit = window.fmtCredit;
const COLORS = window.COLORS;
const font = window.font;
const STATE_LIST = window.STATE_LIST;
const getStateFees = window.getStateFees;

// ── Seller-side state fee defaults ──────────────────────────────────────────
// transferTaxRate: seller's share per $1,000 of sale price (0 = no tax)
// ownerTitleBySeller: true if seller customarily pays owner's title policy
const SNS_STATE_FEES = {
  AL: { transferTaxRate: 1.0,   transferTaxLabel: "State Transfer Tax",               ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 25,  recording: 100, stateGuarantyFee: 0  },
  AK: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 600, docPrep: 200, courier: 50, taxCert: 25,  recording: 50,  stateGuarantyFee: 0  },
  AZ: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 20,  stateGuarantyFee: 0  },
  AR: { transferTaxRate: 3.3,   transferTaxLabel: "Real Property Transfer Tax",        ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 100, stateGuarantyFee: 0  },
  CA: { transferTaxRate: 1.1,   transferTaxLabel: "Documentary Transfer Tax",          ownerTitleBySeller: false, settlementFee: 600, docPrep: 200, courier: 75, taxCert: 75,  recording: 150, stateGuarantyFee: 0  },
  CO: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  CT: { transferTaxRate: 7.5,   transferTaxLabel: "Connecticut Transfer Tax",          ownerTitleBySeller: false, settlementFee: 600, docPrep: 250, courier: 50, taxCert: 50,  recording: 200, stateGuarantyFee: 0  },
  DE: { transferTaxRate: 20.0,  transferTaxLabel: "Delaware Realty Transfer Tax",      ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  FL: { transferTaxRate: 7.0,   transferTaxLabel: "Doc Stamps on Deed",                ownerTitleBySeller: true,  settlementFee: 600, docPrep: 250, courier: 75, taxCert: 75,  recording: 150, stateGuarantyFee: 0  },
  GA: { transferTaxRate: 1.0,   transferTaxLabel: "Real Estate Transfer Tax",          ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 25,  recording: 100, stateGuarantyFee: 0  },
  HI: { transferTaxRate: 1.5,   transferTaxLabel: "Conveyance Tax (graduated, est.)",  ownerTitleBySeller: false, settlementFee: 600, docPrep: 250, courier: 75, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  ID: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 50,  stateGuarantyFee: 0  },
  IL: { transferTaxRate: 0.75,  transferTaxLabel: "State Transfer Tax",                ownerTitleBySeller: false, settlementFee: 550, docPrep: 200, courier: 50, taxCert: 75,  recording: 150, stateGuarantyFee: 0  },
  IN: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  IA: { transferTaxRate: 1.6,   transferTaxLabel: "Real Estate Transfer Tax",          ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  KS: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  KY: { transferTaxRate: 1.0,   transferTaxLabel: "Kentucky Transfer Tax",             ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 25,  recording: 100, stateGuarantyFee: 0  },
  LA: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 500, docPrep: 250, courier: 75, taxCert: 50,  recording: 150, stateGuarantyFee: 0  },
  ME: { transferTaxRate: 4.4,   transferTaxLabel: "Transfer Tax (seller share)",       ownerTitleBySeller: false, settlementFee: 550, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  MD: { transferTaxRate: 5.0,   transferTaxLabel: "State Transfer Tax",                ownerTitleBySeller: false, settlementFee: 600, docPrep: 250, courier: 50, taxCert: 75,  recording: 200, stateGuarantyFee: 0  },
  MA: { transferTaxRate: 4.56,  transferTaxLabel: "Massachusetts Excise Tax",          ownerTitleBySeller: false, settlementFee: 600, docPrep: 250, courier: 50, taxCert: 75,  recording: 150, stateGuarantyFee: 0  },
  MI: { transferTaxRate: 4.3,   transferTaxLabel: "State Transfer Tax",                ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  MN: { transferTaxRate: 3.33,  transferTaxLabel: "State Deed Tax",                    ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  MS: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  MO: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  MT: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 50,  stateGuarantyFee: 0  },
  NE: { transferTaxRate: 2.25,  transferTaxLabel: "Documentary Stamp Tax",             ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  NV: { transferTaxRate: 1.95,  transferTaxLabel: "Real Property Transfer Tax",        ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  NH: { transferTaxRate: 7.5,   transferTaxLabel: "NH Transfer Tax (seller share)",    ownerTitleBySeller: false, settlementFee: 550, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  NJ: { transferTaxRate: 4.0,   transferTaxLabel: "Realty Transfer Fee",               ownerTitleBySeller: true,  settlementFee: 600, docPrep: 250, courier: 50, taxCert: 75,  recording: 150, stateGuarantyFee: 0  },
  NM: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  NY: { transferTaxRate: 4.0,   transferTaxLabel: "NY State Transfer Tax",             ownerTitleBySeller: false, settlementFee: 700, docPrep: 300, courier: 75, taxCert: 100, recording: 250, stateGuarantyFee: 0  },
  NC: { transferTaxRate: 2.0,   transferTaxLabel: "Excise / Revenue Stamps",           ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  ND: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 50,  stateGuarantyFee: 0  },
  OH: { transferTaxRate: 1.0,   transferTaxLabel: "Conveyance Fee",                    ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  OK: { transferTaxRate: 1.5,   transferTaxLabel: "Documentary Stamps",                ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  OR: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  PA: { transferTaxRate: 10.0,  transferTaxLabel: "Realty Transfer Tax (seller 1%)",   ownerTitleBySeller: false, settlementFee: 550, docPrep: 250, courier: 50, taxCert: 75,  recording: 150, stateGuarantyFee: 0  },
  RI: { transferTaxRate: 4.6,   transferTaxLabel: "Realty Conveyance Tax",             ownerTitleBySeller: false, settlementFee: 550, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  SC: { transferTaxRate: 3.7,   transferTaxLabel: "Deed Recording Fee",                ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 25,  recording: 100, stateGuarantyFee: 0  },
  SD: { transferTaxRate: 0.5,   transferTaxLabel: "Realty Transfer Fee",               ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 50,  stateGuarantyFee: 0  },
  TN: { transferTaxRate: 3.7,   transferTaxLabel: "Tennessee Transfer Tax",            ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  TX: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: true,  settlementFee: 600, docPrep: 250, courier: 75, taxCert: 100, recording: 150, stateGuarantyFee: 45 },
  UT: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 50,  recording: 75,  stateGuarantyFee: 0  },
  VT: { transferTaxRate: 12.5,  transferTaxLabel: "Property Transfer Tax",             ownerTitleBySeller: false, settlementFee: 550, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  VA: { transferTaxRate: 2.5,   transferTaxLabel: "Grantor's Tax",                     ownerTitleBySeller: false, settlementFee: 550, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  WA: { transferTaxRate: 11.0,  transferTaxLabel: "REET (graduated — est. at 1.1%)",   ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 50,  recording: 100, stateGuarantyFee: 0  },
  WV: { transferTaxRate: 3.3,   transferTaxLabel: "Excise Tax (seller share)",         ownerTitleBySeller: false, settlementFee: 500, docPrep: 200, courier: 50, taxCert: 25,  recording: 100, stateGuarantyFee: 0  },
  WI: { transferTaxRate: 3.0,   transferTaxLabel: "Real Estate Transfer Fee",          ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 75,  stateGuarantyFee: 0  },
  WY: { transferTaxRate: 0,     transferTaxLabel: "",                                  ownerTitleBySeller: false, settlementFee: 450, docPrep: 200, courier: 50, taxCert: 25,  recording: 50,  stateGuarantyFee: 0  },
  DC: { transferTaxRate: 11.0,  transferTaxLabel: "Recordation / Transfer Tax",        ownerTitleBySeller: false, settlementFee: 700, docPrep: 300, courier: 75, taxCert: 100, recording: 250, stateGuarantyFee: 0  },
};

function getSNSFees(abbr) {
  return SNS_STATE_FEES[abbr] || SNS_STATE_FEES["TX"];
}

function addCommasLocal(v) {
  const s = String(v).replace(/[^0-9.]/g, "");
  const [int, dec] = s.split(".");
  const formatted = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? formatted + "." + dec : formatted;
}
function stripCommasLocal(v) { return String(v).replace(/,/g, ""); }

function dayOfYear(dateStr) {
  if (!dateStr) return 0;
  const parts = dateStr.split("-");
  const y = parseInt(parts[0]) || new Date().getFullYear();
  const m = parseInt(parts[1]) || 1;
  const d = parseInt(parts[2]) || 1;
  return Math.round((new Date(y, m - 1, d) - new Date(y, 0, 0)) / 86400000);
}

// ── Component ────────────────────────────────────────────────────────────────
function SellerNetSheet({ isInternal = false, user = null }) {
  const today = new Date();
  const defaultCD = `${today.getFullYear()}-${String(today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2).padStart(2, "0")}-15`;

  // Sale details
  const [selectedState, setSelectedState] = useLocalStorage("sns_state", "TX");
  const [salePrice, setSalePrice]         = useLocalStorage("sns_price", "400000");
  const [closingDate, setClosingDate]     = useLocalStorage("sns_closing_date", defaultCD);

  // Mortgage payoffs
  const [mort1, setMort1]         = useLocalStorage("sns_mort1", "280000");
  const [mort2, setMort2]         = useLocalStorage("sns_mort2", "");
  const [escrowBal, setEscrowBal] = useLocalStorage("sns_escrow_bal", "");

  // Commission & credits
  const [commissionPct, setCommissionPct]   = useLocalStorage("sns_comm", "5");
  const [sellerConc, setSellerConc]         = useLocalStorage("sns_conc", "");
  const [repairCredits, setRepairCredits]   = useLocalStorage("sns_repair", "");
  const [realtorCredit, setRealtorCredit]   = useLocalStorage("sns_realtor_credit", "");

  // Property & HOA
  const [annualTax, setAnnualTax]   = useLocalStorage("sns_anntax", "");
  const [taxMode, setTaxMode]       = useLocalStorage("sns_taxmode", "auto");
  const [taxManual, setTaxManual]   = useLocalStorage("sns_taxmanual", "");
  const [hoaTransfer, setHoaTransfer] = useLocalStorage("sns_hoatrans2", "");
  const [prepaidHOA, setPrepaidHOA]   = useLocalStorage("sns_hoapre", "");

  // Options
  const [sellerPaysTitle, setSellerPaysTitle] = useLocalStorage("sns_title_on", true);
  const [includeHW, setIncludeHW]             = useLocalStorage("sns_hw_on", false);
  const [hwAmt, setHwAmt]                     = useLocalStorage("sns_hw_amt", "550");
  const [includeSurvey, setIncludeSurvey]     = useLocalStorage("sns_survey_on", false);
  const [surveyAmt, setSurveyAmt]             = useLocalStorage("sns_survey_amt", "450");

  // Internal fee overrides
  const [ovSettlement, setOvSettlement] = useLocalStorage("sns_ov_settlement", "");
  const [ovDocPrep, setOvDocPrep]       = useLocalStorage("sns_ov_docprep2", "");
  const [ovCourier, setOvCourier]       = useLocalStorage("sns_ov_courier", "");
  const [ovTaxCert, setOvTaxCert]       = useLocalStorage("sns_ov_taxcert2", "");
  const [ovRecording, setOvRecording]   = useLocalStorage("sns_ov_recording", "");
  const [ovTransfer, setOvTransfer]     = useLocalStorage("sns_ov_transfer", "");
  const [ovAttorney, setOvAttorney]     = useLocalStorage("sns_ov_attorney", "");
  const [ovGuaranty, setOvGuaranty]     = useLocalStorage("sns_ov_guaranty", "");

  // Other Expenses (3 custom line items)
  const [otherLabel1, setOtherLabel1] = useLocalStorage("sns_oth_lbl1", "");
  const [otherAmt1,   setOtherAmt1]   = useLocalStorage("sns_oth_amt1", "");
  const [otherLabel2, setOtherLabel2] = useLocalStorage("sns_oth_lbl2", "");
  const [otherAmt2,   setOtherAmt2]   = useLocalStorage("sns_oth_amt2", "");
  const [otherLabel3, setOtherLabel3] = useLocalStorage("sns_oth_lbl3", "");
  const [otherAmt3,   setOtherAmt3]   = useLocalStorage("sns_oth_amt3", "");

  // Seller name (for PDF header)
  const [sellerName, setSellerName] = useLocalStorage("sns_seller_name", "");

  // Reset seller-pays-title to state default when state changes
  useEffect(() => {
    const stF = getSNSFees(selectedState);
    setSellerPaysTitle(stF.ownerTitleBySeller);
  }, [selectedState]);

  // ── Calculations ────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const stF = getSNSFees(selectedState);
    const stT = getStateFees(selectedState);

    const ov = (val, fallback) => {
      const n = parseFloat(val);
      return (val !== "" && !isNaN(n)) ? n : fallback;
    };

    const sp  = parseFloat(salePrice) || 0;
    const m1  = parseFloat(mort1) || 0;
    const m2  = parseFloat(mort2) || 0;
    const esc = parseFloat(escrowBal) || 0;
    const totalMortPayoffs = m1 + m2;

    const commPct    = parseFloat(commissionPct) || 0;
    const commission = Math.round(sp * commPct / 100);

    const annTax    = parseFloat(annualTax) || 0;
    const taxProrate = taxMode === "auto"
      ? (annTax > 0 && closingDate ? Math.round(annTax / 365 * dayOfYear(closingDate)) : 0)
      : (parseFloat(taxManual) || 0);

    const hoaTrans   = parseFloat(hoaTransfer) || 0;
    const repair     = parseFloat(repairCredits) || 0;
    const totalPropAdj = taxProrate + hoaTrans + repair;

    const conc       = parseFloat(sellerConc) || 0;
    const titleAmt     = sellerPaysTitle ? Math.round(stT.basicRate(sp)) : 0;
    const titleAmtFull = Math.round(stT.basicRate(sp));
    const hwAmount     = includeHW ? (parseFloat(hwAmt) || stT.homeWarranty || 550) : 0;
    const hwAmtFull    = parseFloat(hwAmt) || stT.homeWarranty || 550;
    const survAmount   = includeSurvey ? (parseFloat(surveyAmt) || stT.surveyFee || 450) : 0;
    const survAmtFull  = parseFloat(surveyAmt) || stT.surveyFee || 450;
    const totalBuyerCosts = conc + titleAmt + hwAmount + survAmount;

    const calcTransferDefault = sp > 0 ? Math.round(sp * stF.transferTaxRate / 1000) : 0;
    const settlement  = ov(ovSettlement, stF.settlementFee);
    const docPrep     = ov(ovDocPrep, stF.docPrep);
    const courier     = ov(ovCourier, stF.courier);
    const taxCert     = ov(ovTaxCert, stF.taxCert);
    const recording   = ov(ovRecording, stF.recording);
    const transferTax = ov(ovTransfer, calcTransferDefault);
    const guaranty    = ov(ovGuaranty, stF.stateGuarantyFee);
    const attorney    = ov(ovAttorney, stT.attorneyRequired ? (stT.attorneyFee || 0) : 0);
    const totalSellerFees = settlement + docPrep + courier + taxCert + recording + transferTax + guaranty + attorney;

    const oth1 = parseFloat(otherAmt1) || 0;
    const oth2 = parseFloat(otherAmt2) || 0;
    const oth3 = parseFloat(otherAmt3) || 0;
    const totalOtherExpenses = oth1 + oth2 + oth3;

    const totalDeductions = totalMortPayoffs + commission + totalBuyerCosts + totalPropAdj + totalSellerFees + totalOtherExpenses;

    const realtorCred    = parseFloat(realtorCredit) || 0;
    const prepaidHOAAmt  = parseFloat(prepaidHOA) || 0;
    const totalAddBacks  = realtorCred + prepaidHOAAmt + esc;

    const netProceeds = sp - totalDeductions + totalAddBacks;

    return {
      sp, m1, m2, esc, totalMortPayoffs,
      commission, commPct,
      taxProrate, hoaTrans, repair, totalPropAdj,
      conc, titleAmt, titleAmtFull, hwAmount, hwAmtFull, survAmount, survAmtFull, totalBuyerCosts,
      settlement, docPrep, courier, taxCert, recording, transferTax, guaranty, attorney, totalSellerFees,
      oth1, oth2, oth3, totalOtherExpenses,
      totalDeductions,
      realtorCred, prepaidHOAAmt, escRefund: esc, totalAddBacks,
      netProceeds,
      transferTaxLabel: stF.transferTaxLabel,
      stateName: stT.name || selectedState,
      hasAttorney: stT.attorneyRequired,
      defaults: {
        settlement: stF.settlementFee,
        docPrep: stF.docPrep,
        courier: stF.courier,
        taxCert: stF.taxCert,
        recording: stF.recording,
        transfer: calcTransferDefault,
        guaranty: stF.stateGuarantyFee,
        attorney: stT.attorneyRequired ? (stT.attorneyFee || 0) : 0,
      },
    };
  }, [selectedState, salePrice, closingDate, mort1, mort2, escrowBal,
      commissionPct, sellerConc, repairCredits, realtorCredit,
      annualTax, taxMode, taxManual, hoaTransfer, prepaidHOA,
      sellerPaysTitle, includeHW, hwAmt, includeSurvey, surveyAmt,
      ovSettlement, ovDocPrep, ovCourier, ovTaxCert, ovRecording, ovTransfer, ovAttorney, ovGuaranty,
      otherAmt1, otherAmt2, otherAmt3]);

  // ── FeeRow ───────────────────────────────────────────────────────────────
  const FeeRow = ({ label, amount, bold, indent, color, editKey, editValue, onEdit, defaultVal, last }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: `${bold ? 10 : 6}px 0`,
      borderBottom: last ? "none" : bold ? `2px solid ${COLORS.navy}` : `1px solid ${COLORS.border}`,
      marginLeft: indent ? 20 : 0, gap: 8,
    }}>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 400, color: color || COLORS.navy, fontFamily: font, flex: 1 }}>
        {label}
      </span>
      {isInternal && editKey ? (
        <input
          type="text" value={editValue} placeholder={fmt(defaultVal)}
          onChange={e => onEdit(e.target.value.replace(/[^0-9.]/g, ""))}
          style={{ width: 90, textAlign: "right", fontSize: 13, fontWeight: 600, fontFamily: font,
            color: editValue !== "" ? COLORS.blue : COLORS.navy,
            border: `1px solid ${editValue !== "" ? COLORS.blue : COLORS.border}`,
            borderRadius: 4, padding: "2px 6px",
            background: editValue !== "" ? "#EAF4FB" : "transparent", outline: "none" }}
        />
      ) : (
        <span style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 800 : 500, color: color || COLORS.navy, fontFamily: font }}>
          {amount < 0 ? fmtCredit(amount) : fmt(Math.round(amount))}
        </span>
      )}
    </div>
  );

  const GroupHeader = ({ label }) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.blue, letterSpacing: "0.06em", marginBottom: 6, marginTop: 4, fontFamily: font }}>
      {label}
    </div>
  );

  // ── PDF export ───────────────────────────────────────────────────────────
  const rightColRef = useRef(null);

  const downloadPDF = () => {
    const el = rightColRef.current;
    if (!el) return;
    window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false }).then(canvas => {
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 30;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      const ratio = canvas.width / canvas.height;
      let imgW = maxW;
      let imgH = imgW / ratio;
      if (imgH > maxH) { imgH = maxH; imgW = imgH * ratio; }
      const cx = margin + (maxW - imgW) / 2;
      pdf.addImage(imgData, "PNG", cx, margin, imgW, imgH);
      const safeName = sellerName ? sellerName.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_") : "Net_Sheet";
      pdf.save(`Seller_Net_Sheet_${safeName}.pdf`);
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>

        {/* ── LEFT COLUMN ── */}
        <div>

          {/* SALE DETAILS */}
          <SectionCard title="SALE DETAILS" accent={COLORS.navy}>
            <LabeledInput label="Seller Name" value={sellerName} onChange={setSellerName} />
            <Select label="State" value={selectedState} onChange={setSelectedState}
              options={STATE_LIST.map(s => ({ value: s.value, label: `${s.label} (${s.value})` }))} />
            <LabeledInput label="Sale Price" prefix="$" value={salePrice} onChange={setSalePrice} useCommas />
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: COLORS.grayLight, marginBottom: 4, fontFamily: font, letterSpacing: "0.04em" }}>
                Closing Date (for the sale of your home)
              </label>
              <input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  fontSize: 13, fontFamily: font, color: COLORS.navy, background: "#fff", outline: "none", boxSizing: "border-box" }} />
              {closingDate && taxMode === "auto" && parseFloat(annualTax) > 0 && (
                <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 2, fontFamily: font }}>
                  Day {dayOfYear(closingDate)} of year — tax prorate auto-calculated
                </div>
              )}
            </div>
          </SectionCard>

          {/* MORTGAGE PAYOFFS */}
          <SectionCard title="MORTGAGE PAYOFFS" accent={COLORS.red}>
            <LabeledInput label="1st Mortgage Payoff" prefix="$" value={mort1} onChange={setMort1} useCommas />
            <LabeledInput label="2nd Mortgage Payoff" prefix="$" value={mort2} onChange={setMort2} useCommas />
            <div style={{ margin: "2px 0 10px", padding: "9px 12px", borderRadius: 7, background: "#FFF8E7", border: "1px solid #F0D080", borderLeft: "3px solid #E6A817", fontSize: 11, color: "#7A5800", fontFamily: font, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700 }}>Your payoff is not the same as your balance.</span> Your payoff includes your remaining principal + accrued daily interest through the closing date + lender payoff processing fees ($150–$175). If you don't have the exact number, add $1,500–$2,000 to your current balance as a buffer — it's better to overestimate here than come up short at closing.
            </div>
            <LabeledInput label="Current Escrow Balance (add-back)" prefix="$" value={escrowBal} onChange={setEscrowBal} useCommas
              hint="Returned to seller at closing" />
          </SectionCard>

          {/* COMMISSION & CREDITS */}
          <SectionCard title="COMMISSION & CREDITS" accent={COLORS.gold || "#C9A84C"}>
            <LabeledInput label="Realtor Commission(s)" value={commissionPct} onChange={setCommissionPct} suffix="%"
              hint={salePrice ? fmt(Math.round((parseFloat(salePrice) || 0) * (parseFloat(commissionPct) || 0) / 100)) : ""} />
            <LabeledInput label="Seller Concessions" prefix="$" value={sellerConc} onChange={setSellerConc} useCommas />
            <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: -8, marginBottom: 10, fontFamily: font, fontStyle: "italic", paddingLeft: 2 }}>
              Money paid to the buyer at closing
            </div>
            <LabeledInput label="Repair Costs" prefix="$" value={repairCredits} onChange={setRepairCredits} useCommas />
            {(isInternal || (user && user.role === "realtor") || !!realtorCredit) && (
              <LabeledInput label="Realtor Credit (paid to Seller)" prefix="$" value={realtorCredit} onChange={setRealtorCredit} useCommas />
            )}
            {!!realtorCredit && (
              <div style={{ fontSize: 11, color: "#2A9150", marginTop: -8, marginBottom: 4, fontFamily: font, fontStyle: "italic", paddingLeft: 2 }}>
                ↑ Add-back — this amount is returned to the seller at closing
              </div>
            )}
            {(isInternal || (user && user.role === "realtor")) && (
              <div style={{ fontSize: 11, color: "#5A6FA8", marginBottom: 10, fontFamily: font, paddingLeft: 2 }}>
                🔒 Realtor Credit is hidden from the client until a dollar amount is entered.
              </div>
            )}
          </SectionCard>

          {/* PROPERTY & HOA */}
          <SectionCard title="PROPERTY & HOA" accent={COLORS.blue}>
            <LabeledInput label="Annual Property Taxes" prefix="$" value={annualTax} onChange={setAnnualTax} useCommas />
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <button onClick={() => setTaxMode("auto")} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${taxMode === "auto" ? COLORS.blue : COLORS.border}`, background: taxMode === "auto" ? COLORS.blue : "#fff", color: taxMode === "auto" ? "#fff" : COLORS.navy, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>
                Auto Prorate
              </button>
              <button onClick={() => setTaxMode("manual")} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${taxMode === "manual" ? COLORS.blue : COLORS.border}`, background: taxMode === "manual" ? COLORS.blue : "#fff", color: taxMode === "manual" ? "#fff" : COLORS.navy, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>
                Manual
              </button>
            </div>
            {taxMode === "manual" && (
              <LabeledInput label="Tax Prorate (manual)" prefix="$" value={taxManual} onChange={setTaxManual} useCommas />
            )}
            {taxMode === "auto" && (
              <div style={{ fontSize: 11, color: COLORS.grayLight, marginBottom: 8, fontFamily: font }}>
                Auto: days elapsed ÷ 365 × annual taxes
              </div>
            )}
            <LabeledInput label="HOA Transfer Fee" prefix="$" value={hoaTransfer} onChange={setHoaTransfer} useCommas />
            <LabeledInput label="Prepaid HOA Dues (add-back)" prefix="$" value={prepaidHOA} onChange={setPrepaidHOA} useCommas
              hint="Reimbursed to seller by buyer" />
          </SectionCard>

          {/* OPTIONAL: SELLER PAID ITEMS */}
          <SectionCard title="OPTIONAL: SELLER PAID ITEMS" accent={COLORS.blue}>
            <Toggle label={"Title Policy (" + fmt(calc.titleAmtFull) + ")"} checked={sellerPaysTitle} onChange={setSellerPaysTitle} />
            <Toggle label={"Home Warranty (" + fmt(calc.hwAmtFull) + ")"} checked={includeHW} onChange={setIncludeHW} />
            <Toggle label={"Survey: Pay for New Survey (" + fmt(calc.survAmtFull) + ")"} checked={includeSurvey} onChange={setIncludeSurvey} />
          </SectionCard>

          {/* OTHER EXPENSES */}
          <SectionCard title="OTHER EXPENSES" accent={COLORS.blue}>
            <div style={{ fontSize: 11, color: COLORS.grayLight, marginBottom: 8, fontFamily: font }}>
              Add up to three additional seller expenses.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: COLORS.grayLight, marginBottom: 4, fontFamily: font, letterSpacing: "0.04em" }}>Description</label>
                <input value={otherLabel1} onChange={e => setOtherLabel1(e.target.value)} placeholder="e.g. Termite Inspection"
                  style={{ width: "100%", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: COLORS.navy, boxSizing: "border-box", outline: "none" }} />
              </div>
              <div style={{ width: 100 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: COLORS.grayLight, marginBottom: 4, fontFamily: font, letterSpacing: "0.04em" }}>Amount</label>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: "hidden" }}>
                  <span style={{ padding: "7px 6px", background: "#f5f5f5", fontSize: 13, color: COLORS.grayLight, fontFamily: font }}>$</span>
                  <input type="text" value={addCommasLocal(otherAmt1)} onChange={e => setOtherAmt1(stripCommasLocal(e.target.value))} placeholder="0"
                    style={{ flex: 1, padding: "7px 6px", border: "none", fontSize: 13, fontFamily: font, color: COLORS.navy, outline: "none", minWidth: 0 }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <input value={otherLabel2} onChange={e => setOtherLabel2(e.target.value)} placeholder="e.g. HOA Docs Fee"
                  style={{ width: "100%", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: COLORS.navy, boxSizing: "border-box", outline: "none" }} />
              </div>
              <div style={{ width: 100 }}>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: "hidden" }}>
                  <span style={{ padding: "7px 6px", background: "#f5f5f5", fontSize: 13, color: COLORS.grayLight, fontFamily: font }}>$</span>
                  <input type="text" value={addCommasLocal(otherAmt2)} onChange={e => setOtherAmt2(stripCommasLocal(e.target.value))} placeholder="0"
                    style={{ flex: 1, padding: "7px 6px", border: "none", fontSize: 13, fontFamily: font, color: COLORS.navy, outline: "none", minWidth: 0 }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <input value={otherLabel3} onChange={e => setOtherLabel3(e.target.value)} placeholder="e.g. Lien Release"
                  style={{ width: "100%", padding: "7px 10px", border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: font, color: COLORS.navy, boxSizing: "border-box", outline: "none" }} />
              </div>
              <div style={{ width: 100 }}>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: "hidden" }}>
                  <span style={{ padding: "7px 6px", background: "#f5f5f5", fontSize: 13, color: COLORS.grayLight, fontFamily: font }}>$</span>
                  <input type="text" value={addCommasLocal(otherAmt3)} onChange={e => setOtherAmt3(stripCommasLocal(e.target.value))} placeholder="0"
                    style={{ flex: 1, padding: "7px 6px", border: "none", fontSize: 13, fontFamily: font, color: COLORS.navy, outline: "none", minWidth: 0 }} />
                </div>
              </div>
            </div>
          </SectionCard>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div>

          {/* PDF capture zone */}
          <div ref={rightColRef} style={{ background: "#fff", borderRadius: 10, padding: 4 }}>

          {/* Prepared-for header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, padding: "10px 14px", borderRadius: 8, background: "#F5F8FA", border: `1px solid ${COLORS.border}`, fontFamily: font }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: COLORS.grayLight, textTransform: "uppercase" }}>Prepared For</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, marginTop: 2 }}>
                {sellerName ? sellerName : <span style={{ color: COLORS.grayLight, fontStyle: "italic", fontWeight: 400, fontSize: 12 }}>Add seller name in Sale Details →</span>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: COLORS.grayLight, textTransform: "uppercase" }}>Date</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy, marginTop: 2 }}>
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Net Proceeds Banner */}
          <div style={{ background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight || "#1E3A5F"})`, borderRadius: 12, padding: 20, color: "#fff", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", opacity: 0.7, fontFamily: font }}>
              SELLER'S ESTIMATED NET PROCEEDS
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, fontFamily: font, color: calc.netProceeds >= 0 ? "#fff" : "#FF8A80" }}>
              {fmt(Math.round(calc.netProceeds))}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6, fontFamily: font }}>
              {calc.stateName} · {fmt(calc.sp)} sale price · {calc.commPct}% commission
            </div>
          </div>

          {/* Itemized Breakdown */}
          <SectionCard title={`NET SHEET — ${calc.stateName.toUpperCase()}`}>

            {/* MORTGAGE PAYOFFS */}
            <div style={{ marginBottom: 14 }}>
              <GroupHeader label="MORTGAGE PAYOFFS" />
              <FeeRow label="1st Mortgage Payoff" amount={calc.m1} indent color={COLORS.red} />
              {calc.m2 > 0 && <FeeRow label="2nd Mortgage Payoff" amount={calc.m2} indent color={COLORS.red} />}
              <FeeRow label="Subtotal — Mortgage Payoffs" amount={calc.totalMortPayoffs} bold color={COLORS.red} />
            </div>

            {/* COMMISSION */}
            <div style={{ marginBottom: 14 }}>
              <GroupHeader label="COMMISSION" />
              <FeeRow label={`Agent Commission (${calc.commPct}%)`} amount={calc.commission} indent />
              <FeeRow label="Subtotal — Commission" amount={calc.commission} bold />
            </div>

            {/* BUYER'S COSTS PAID BY SELLER */}
            {calc.totalBuyerCosts > 0 && (
              <div style={{ marginBottom: 14 }}>
                <GroupHeader label="BUYER'S COSTS PAID BY SELLER" />
                {calc.conc > 0 && <FeeRow label="Seller Concessions" amount={calc.conc} indent />}
                {calc.titleAmt > 0 && <FeeRow label="Owner's Title Policy" amount={calc.titleAmt} indent />}
                {calc.hwAmount > 0 && <FeeRow label="Home Warranty" amount={calc.hwAmount} indent />}
                {calc.survAmount > 0 && <FeeRow label="Survey" amount={calc.survAmount} indent />}
                <FeeRow label="Subtotal — Buyer's Costs" amount={calc.totalBuyerCosts} bold />
              </div>
            )}

            {/* SELLER'S CLOSING FEES */}
            <div style={{ marginBottom: 14 }}>
              <GroupHeader label="SELLER'S CLOSING FEES" />
              <FeeRow label="Settlement / Closing Fee" amount={calc.settlement} indent
                editKey="settlement" editValue={ovSettlement} onEdit={setOvSettlement} defaultVal={calc.defaults.settlement} />
              <FeeRow label="Doc Prep" amount={calc.docPrep} indent
                editKey="docprep" editValue={ovDocPrep} onEdit={setOvDocPrep} defaultVal={calc.defaults.docPrep} />
              <FeeRow label="Courier / Copy / Overnight" amount={calc.courier} indent
                editKey="courier" editValue={ovCourier} onEdit={setOvCourier} defaultVal={calc.defaults.courier} />
              <FeeRow label="Tax Cert" amount={calc.taxCert} indent
                editKey="taxcert" editValue={ovTaxCert} onEdit={setOvTaxCert} defaultVal={calc.defaults.taxCert} />
              <FeeRow label="Recording Fee" amount={calc.recording} indent
                editKey="recording" editValue={ovRecording} onEdit={setOvRecording} defaultVal={calc.defaults.recording} />
              {(calc.transferTax > 0 || calc.defaults.transfer > 0) && (
                <FeeRow label={calc.transferTaxLabel || "Transfer / Doc Stamp Tax"} amount={calc.transferTax} indent
                  editKey="transfer" editValue={ovTransfer} onEdit={setOvTransfer} defaultVal={calc.defaults.transfer} />
              )}
              {calc.guaranty > 0 && (
                <FeeRow label="State Guaranty / Escrow Fund Fee" amount={calc.guaranty} indent
                  editKey="guaranty" editValue={ovGuaranty} onEdit={setOvGuaranty} defaultVal={calc.defaults.guaranty} />
              )}
              {calc.attorney > 0 && (
                <FeeRow label="Attorney / Closing Fee" amount={calc.attorney} indent
                  editKey="attorney" editValue={ovAttorney} onEdit={setOvAttorney} defaultVal={calc.defaults.attorney} />
              )}
              <FeeRow label="Subtotal — Seller's Fees" amount={calc.totalSellerFees} bold />
            </div>

            {/* PROPERTY ADJUSTMENTS */}
            {calc.totalPropAdj > 0 && (
              <div style={{ marginBottom: 14 }}>
                <GroupHeader label="PROPERTY ADJUSTMENTS" />
                {calc.taxProrate > 0 && (
                  <FeeRow label={`Property Tax Prorate${taxMode === "auto" ? " (auto)" : " (manual)"}`} amount={calc.taxProrate} indent />
                )}
                {calc.hoaTrans > 0 && <FeeRow label="HOA Transfer Fee" amount={calc.hoaTrans} indent />}
                {calc.repair > 0 && <FeeRow label="Repair Credits" amount={calc.repair} indent />}
                <FeeRow label="Subtotal — Property Adjustments" amount={calc.totalPropAdj} bold />
              </div>
            )}

            {/* OTHER EXPENSES */}
            {calc.totalOtherExpenses > 0 && (
              <div style={{ marginBottom: 14 }}>
                <GroupHeader label="OTHER EXPENSES" />
                {calc.oth1 > 0 && <FeeRow label={otherLabel1 || "Other Expense 1"} amount={calc.oth1} indent />}
                {calc.oth2 > 0 && <FeeRow label={otherLabel2 || "Other Expense 2"} amount={calc.oth2} indent />}
                {calc.oth3 > 0 && <FeeRow label={otherLabel3 || "Other Expense 3"} amount={calc.oth3} indent />}
                <FeeRow label="Subtotal — Other Expenses" amount={calc.totalOtherExpenses} bold />
              </div>
            )}

            {/* TOTAL DEDUCTIONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: `3px solid ${COLORS.navy}`, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14, fontFamily: font }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.navy }}>TOTAL DEDUCTIONS</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.navy }}>{fmt(Math.round(calc.totalDeductions))}</span>
            </div>

            {/* ADD-BACKS */}
            {calc.totalAddBacks > 0 && (
              <div style={{ marginBottom: 14 }}>
                <GroupHeader label="ADD-BACKS (RETURNED TO SELLER)" />
                {calc.realtorCred > 0 && <FeeRow label="Realtor Credit to Seller" amount={calc.realtorCred} indent color={COLORS.green} />}
                {calc.prepaidHOAAmt > 0 && <FeeRow label="Prepaid HOA Reimbursement" amount={calc.prepaidHOAAmt} indent color={COLORS.green} />}
                {calc.escRefund > 0 && <FeeRow label="Escrow Account Balance Refund" amount={calc.escRefund} indent color={COLORS.green} />}
                <FeeRow label="Total Add-Backs" amount={calc.totalAddBacks} bold color={COLORS.green} />
              </div>
            )}

            {/* FINAL SUMMARY BOX */}
            <div style={{ marginTop: 16, padding: "16px 18px", background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight || "#1E3A5F"})`, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>Sale Price</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>{fmt(calc.sp)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>− Total Deductions</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>{fmt(Math.round(calc.totalDeductions))}</span>
              </div>
              {calc.totalAddBacks > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>+ Add-Backs</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: font }}>{fmt(Math.round(calc.totalAddBacks))}</span>
                </div>
              )}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.3)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: font }}>ESTIMATED NET PROCEEDS</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: calc.netProceeds >= 0 ? "#fff" : "#FF8A80", fontFamily: font }}>
                  {fmt(Math.round(calc.netProceeds))}
                </span>
              </div>
              {calc.netProceeds < 0 && (
                <div style={{ fontSize: 11, color: "#FF8A80", marginTop: 6, fontFamily: font, textAlign: "center" }}>
                  ⚠ Negative proceeds — seller may need to bring funds to closing
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 10, lineHeight: 1.5, fontFamily: font }}>
              * Estimates only. Fees vary by title company, county, and negotiated terms. Transfer tax and title rates are approximate — verify with your title company. Tax prorate is based on a 365-day year.
            </div>
          </SectionCard>

          </div>{/* end PDF capture zone */}

          {/* Action buttons */}
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={() => { setOvSettlement(""); setOvDocPrep(""); setOvCourier(""); setOvTaxCert(""); setOvRecording(""); setOvTransfer(""); setOvAttorney(""); setOvGuaranty(""); }}
              style={{ padding: "7px 16px", background: "#fff", color: COLORS.navy, border: `1.5px solid ${COLORS.border}`, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font }}>
              ↺ Reset Fees to Defaults
            </button>
            <button
              onClick={downloadPDF}
              style={{ padding: "7px 16px", background: COLORS.navy, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: font, display: "flex", alignItems: "center", gap: 6 }}>
              🖨 Print to PDF
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

window.SellerNetSheet = SellerNetSheet;
