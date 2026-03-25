// modules/calculators/SellerNetSheet.js
const { useState, useEffect, useMemo } = React;
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
  const [perDiem, setPerDiem]     = useLocalStorage("sns_perdiem", "");
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
    const pd  = parseFloat(perDiem) || 0;
    const esc = parseFloat(escrowBal) || 0;
    const totalMortPayoffs = m1 + m2 + pd;

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
    const titleAmt   = sellerPaysTitle ? Math.round(stT.basicRate(sp)) : 0;
    const hwAmount   = includeHW ? (parseFloat(hwAmt) || stT.homeWarranty || 550) : 0;
    const survAmount = includeSurvey ? (parseFloat(surveyAmt) || stT.surveyFee || 450) : 0;
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

    const totalDeductions = totalMortPayoffs + commission + totalBuyerCosts + totalPropAdj + totalSellerFees;

    const realtorCred    = parseFloat(realtorCredit) || 0;
    const prepaidHOAAmt  = parseFloat(prepaidHOA) || 0;
    const totalAddBacks  = realtorCred + prepaidHOAAmt + esc;

    const netProceeds = sp - totalDeductions + totalAddBacks;

    return {
      sp, m1, m2, pd, esc, totalMortPayoffs,
      commission, commPct,
      taxProrate, hoaTrans, repair, totalPropAdj,
      conc, titleAmt, hwAmount, survAmount, totalBuyerCosts,
      settlement, docPrep, courier, taxCert, recording, transferTax, guaranty, attorney, totalSellerFees,
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
  }, [selectedState, salePrice, closingDate, mort1, mort2, perDiem, escrowBal,
      commissionPct, sellerConc, repairCredits, realtorCredit,
      annualTax, taxMode, taxManual, hoaTransfer, prepaidHOA,
      sellerPaysTitle, includeHW, hwAmt, includeSurvey, surveyAmt,
      ovSettlement, ovDocPrep, ovCourier, ovTaxCert, ovRecording, ovTransfer, ovAttorney, ovGuaranty]);

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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>

        {/* ── LEFT COLUMN ── */}
        <div>

          {/* SALE DETAILS */}
          <SectionCard title="SALE DETAILS" accent={COLORS.navy}>
            <Select label="State" value={selectedState} onChange={setSelectedState}
              options={STATE_LIST.map(s => ({ value: s.value, label: `${s.label} (${s.value})` }))} />
            <LabeledInput label="Sale Price" prefix="$" value={salePrice} onChange={setSalePrice} useCommas />
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: COLORS.grayLight, marginBottom: 4, fontFamily: font, letterSpacing: "0.04em" }}>
                Closing Date
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
            <LabeledInput label="2nd Mortgage Payoff" prefix="$" value={mort2} onChange={setMort2} useCommas small />
            <LabeledInput label="Per Diem Interest (total at closing)" prefix="$" value={perDiem} onChange={setPerDiem} useCommas small />
            <LabeledInput label="Current Escrow Balance (add-back)" prefix="$" value={escrowBal} onChange={setEscrowBal} useCommas small
              hint="Returned to seller at closing" />
          </SectionCard>

          {/* COMMISSION & CREDITS */}
          <SectionCard title="COMMISSION & CREDITS" accent={COLORS.gold || "#C9A84C"}>
            <LabeledInput label="Agent Commission" value={commissionPct} onChange={setCommissionPct} suffix="%"
              hint={salePrice ? fmt(Math.round((parseFloat(salePrice) || 0) * (parseFloat(commissionPct) || 0) / 100)) : ""} />
            <LabeledInput label="Seller Concessions" prefix="$" value={sellerConc} onChange={setSellerConc} useCommas small />
            <LabeledInput label="Repair Credits" prefix="$" value={repairCredits} onChange={setRepairCredits} useCommas small />
            <LabeledInput label="Realtor Credit to Seller (add-back)" prefix="$" value={realtorCredit} onChange={setRealtorCredit} useCommas small
              hint="Included in add-backs" />
          </SectionCard>

          {/* PROPERTY & HOA */}
          <SectionCard title="PROPERTY & HOA" accent={COLORS.blue}>
            <LabeledInput label="Annual Property Taxes" prefix="$" value={annualTax} onChange={setAnnualTax} useCommas small />
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <button onClick={() => setTaxMode("auto")} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${taxMode === "auto" ? COLORS.blue : COLORS.border}`, background: taxMode === "auto" ? COLORS.blue : "#fff", color: taxMode === "auto" ? "#fff" : COLORS.navy, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>
                Auto Prorate
              </button>
              <button onClick={() => setTaxMode("manual")} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${taxMode === "manual" ? COLORS.blue : COLORS.border}`, background: taxMode === "manual" ? COLORS.blue : "#fff", color: taxMode === "manual" ? "#fff" : COLORS.navy, fontSize: 11, fontWeight: 600, fontFamily: font, cursor: "pointer" }}>
                Manual
              </button>
            </div>
            {taxMode === "manual" && (
              <LabeledInput label="Tax Prorate (manual)" prefix="$" value={taxManual} onChange={setTaxManual} useCommas small />
            )}
            {taxMode === "auto" && (
              <div style={{ fontSize: 11, color: COLORS.grayLight, marginBottom: 8, fontFamily: font }}>
                Auto: days elapsed ÷ 365 × annual taxes
              </div>
            )}
            <LabeledInput label="HOA Transfer Fee" prefix="$" value={hoaTransfer} onChange={setHoaTransfer} useCommas small />
            <LabeledInput label="Prepaid HOA Dues (add-back)" prefix="$" value={prepaidHOA} onChange={setPrepaidHOA} useCommas small
              hint="Reimbursed to seller by buyer" />
          </SectionCard>

          {/* OPTIONS */}
          <SectionCard title="OPTIONS" accent={COLORS.blue}>
            <Toggle label="Seller Pays Owner's Title Policy" checked={sellerPaysTitle} onChange={setSellerPaysTitle} />
            {sellerPaysTitle && (
              <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: -4, marginBottom: 6, fontFamily: font }}>
                {fmt(Math.round(calc.titleAmt))} — {calc.stateName} rate
              </div>
            )}
            <Toggle label="Include Home Warranty" checked={includeHW} onChange={setIncludeHW} />
            {includeHW && <LabeledInput label="Home Warranty Amount" prefix="$" value={hwAmt} onChange={setHwAmt} small />}
            <Toggle label="Include Survey" checked={includeSurvey} onChange={setIncludeSurvey} />
            {includeSurvey && <LabeledInput label="Survey Amount" prefix="$" value={surveyAmt} onChange={setSurveyAmt} small />}
          </SectionCard>

          {/* FEE OVERRIDES — internal only */}
          {isInternal && (
            <SectionCard title="FEE OVERRIDES (INTERNAL)" accent={COLORS.red}>
              <div style={{ fontSize: 11, color: COLORS.grayLight, marginBottom: 8, fontFamily: font }}>
                Leave blank to use state defaults. Type to override.
              </div>
              <LabeledInput label="Settlement / Closing Fee" prefix="$" value={ovSettlement} onChange={setOvSettlement} hint={`Default: ${fmt(calc.defaults.settlement)}`} small />
              <LabeledInput label="Doc Prep" prefix="$" value={ovDocPrep} onChange={setOvDocPrep} hint={`Default: ${fmt(calc.defaults.docPrep)}`} small />
              <LabeledInput label="Courier / Copy / Overnight" prefix="$" value={ovCourier} onChange={setOvCourier} hint={`Default: ${fmt(calc.defaults.courier)}`} small />
              <LabeledInput label="Tax Cert" prefix="$" value={ovTaxCert} onChange={setOvTaxCert} hint={`Default: ${fmt(calc.defaults.taxCert)}`} small />
              <LabeledInput label="Recording Fee" prefix="$" value={ovRecording} onChange={setOvRecording} hint={`Default: ${fmt(calc.defaults.recording)}`} small />
              {calc.defaults.transfer > 0 && (
                <LabeledInput label={calc.transferTaxLabel || "Transfer / Doc Stamp Tax"} prefix="$" value={ovTransfer} onChange={setOvTransfer} hint={`Default: ${fmt(calc.defaults.transfer)}`} small />
              )}
              {calc.hasAttorney && (
                <LabeledInput label="Attorney / Closing Fee" prefix="$" value={ovAttorney} onChange={setOvAttorney} hint={`Default: ${fmt(calc.defaults.attorney)}`} small />
              )}
              {calc.defaults.guaranty > 0 && (
                <LabeledInput label="State Guaranty / Escrow Fund Fee" prefix="$" value={ovGuaranty} onChange={setOvGuaranty} hint={`Default: ${fmt(calc.defaults.guaranty)}`} small />
              )}
              <button
                onClick={() => { setOvSettlement(""); setOvDocPrep(""); setOvCourier(""); setOvTaxCert(""); setOvRecording(""); setOvTransfer(""); setOvAttorney(""); setOvGuaranty(""); }}
                style={{ marginTop: 8, padding: "6px 14px", background: COLORS.grayLight, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: font }}>
                Reset All to Defaults
              </button>
            </SectionCard>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div>

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
              {calc.pd > 0 && <FeeRow label="Per Diem Interest" amount={calc.pd} indent color={COLORS.red} />}
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

        </div>
      </div>
    </div>
  );
}

window.SellerNetSheet = SellerNetSheet;
