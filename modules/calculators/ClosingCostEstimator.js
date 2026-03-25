// modules/calculators/ClosingCostEstimator.js
const { useMemo } = React;
const useThemeColors = window.useThemeColors;
const useLocalStorage = window.useLocalStorage;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const Select = window.Select;
const MetricCard = window.MetricCard;
const DonutChart = window.DonutChart;
const COLORS = window.COLORS;
const fmt = window.fmt;
const font = window.font;

function ClosingCostEstimator() {
  const c = useThemeColors();
  const [purchPrice, setPurchPrice] = useLocalStorage("cce_price", 400000);
  const [loanAmt, setLoanAmt] = useLocalStorage("cce_loan", 360000);
  const [rate, setRate] = useLocalStorage("cce_rate", 6.75);
  const [propTaxRate, setPropTaxRate] = useLocalStorage("cce_taxrate", 2.1);
  const [homeIns, setHomeIns] = useLocalStorage("cce_ins", 1800);
  const [state, setState] = useLocalStorage("cce_state", "TX");
  const [isRefi, setIsRefi] = useLocalStorage("cce_refi", false);

  const calc = useMemo(() => {
    const p = Number(purchPrice), l = Number(loanAmt), r = Number(rate), tr = Number(propTaxRate), hi = Number(homeIns);
    const ltv = p > 0 ? (l / p) * 100 : 0;
    const origination = l * 0.01;
    const discount = 0;
    const appraisal = 550;
    const creditReport = 65;
    const floodCert = 20;
    const taxService = 85;
    const underwriting = 895;
    const processing = 450;
    const lenderFees = origination + discount + appraisal + creditReport + floodCert + taxService + underwriting + processing;
    const titleSearch = 350;
    const titleIns = p * 0.005;
    const settlement = 650;
    const recording = 150;
    const survey = state === "TX" ? 450 : 0;
    const titleFees = titleSearch + titleIns + settlement + recording + survey;
    const monthlyTax = (p * (tr / 100)) / 12;
    const monthlyIns = hi / 12;
    const escrowTax = monthlyTax * 3;
    const escrowIns = monthlyIns * 3;
    const prepaidInt = (l * (r / 100) / 365) * 15;
    const prepaidIns = hi;
    const prepaidTax = 0;
    const prepaidsEscrow = escrowTax + escrowIns + prepaidInt + prepaidIns + prepaidTax;
    const transferTax = state === "TX" ? 0 : p * 0.002;
    const attFee = 0;
    const pestInspect = state === "TX" ? 150 : 0;
    const govtOther = transferTax + attFee + pestInspect;
    const totalClosing = lenderFees + titleFees + prepaidsEscrow + govtOther;
    const pctOfLoan = l > 0 ? (totalClosing / l) * 100 : 0;
    const cashToClose = isRefi ? totalClosing : (p - l) + totalClosing;
    return { lenderFees, titleFees, prepaidsEscrow, govtOther, totalClosing, pctOfLoan, cashToClose, ltv,
      items: {
        lender: [
          { label: "Origination Fee (1%)", amt: origination },
          { label: "Appraisal", amt: appraisal },
          { label: "Credit Report", amt: creditReport },
          { label: "Flood Certification", amt: floodCert },
          { label: "Tax Service Fee", amt: taxService },
          { label: "Underwriting", amt: underwriting },
          { label: "Processing", amt: processing },
        ],
        title: [
          { label: "Title Search", amt: titleSearch },
          { label: "Owner's Title Insurance", amt: titleIns },
          { label: "Settlement/Closing Fee", amt: settlement },
          { label: "Recording Fees", amt: recording },
          ...(survey > 0 ? [{ label: "Survey", amt: survey }] : []),
        ],
        prepaids: [
          { label: "Prepaid Interest (15 days)", amt: prepaidInt },
          { label: "Homeowner's Insurance (12 mo)", amt: prepaidIns },
          { label: "Property Tax Escrow (3 mo)", amt: escrowTax },
          { label: "Insurance Escrow (3 mo)", amt: escrowIns },
        ],
        govt: [
          ...(transferTax > 0 ? [{ label: "Transfer Tax", amt: transferTax }] : []),
          ...(pestInspect > 0 ? [{ label: "Pest Inspection", amt: pestInspect }] : []),
        ],
      }
    };
  }, [purchPrice, loanAmt, rate, propTaxRate, homeIns, state, isRefi]);

  const feeSection = (title, items, total, color) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: c.text || COLORS.navy, fontFamily: font }}>{title}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: font }}>{fmt(Math.round(total))}</span>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>
          <span style={{ fontSize: 12, color: c.textSecondary || COLORS.gray, fontFamily: font }}>{it.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: c.text || COLORS.navy, fontFamily: font }}>{fmt(Math.round(it.amt))}</span>
        </div>
      ))}
    </div>
  );

  const donut = [
    { label: "Lender Fees", value: calc.lenderFees, color: COLORS.blue },
    { label: "Title Fees", value: calc.titleFees, color: COLORS.gold },
    { label: "Prepaids/Escrow", value: calc.prepaidsEscrow, color: COLORS.green },
    { label: "Govt/Other", value: calc.govtOther, color: COLORS.accent },
  ].filter(d => d.value > 0);

  return (
    <div>
      <SectionCard title="Closing Cost Estimator" subtitle="TRID-style itemized breakdown">
        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <LabeledInput label="Purchase Price" value={purchPrice} onChange={setPurchPrice} prefix="$" />
          <LabeledInput label="Loan Amount" value={loanAmt} onChange={setLoanAmt} prefix="$" />
          <LabeledInput label="Interest Rate" value={rate} onChange={setRate} suffix="%" step="0.125" />
          <LabeledInput label="Property Tax Rate" value={propTaxRate} onChange={setPropTaxRate} suffix="%" step="0.1" />
          <LabeledInput label="Annual Home Insurance" value={homeIns} onChange={setHomeIns} prefix="$" />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>State</div>
            <Select value={state} onChange={setState} options={[
              { value: "TX", label: "Texas" }, { value: "CA", label: "California" }, { value: "FL", label: "Florida" },
              { value: "NY", label: "New York" }, { value: "IL", label: "Illinois" }, { value: "OTHER", label: "Other" },
            ]} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: font, color: c.text || COLORS.navy, cursor: "pointer" }}>
            <input type="checkbox" checked={isRefi} onChange={e => setIsRefi(e.target.checked)} />
            This is a refinance (no down payment in cash-to-close)
          </label>
        </div>
      </SectionCard>
      <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
        <MetricCard label="Total Closing Costs" value={fmt(Math.round(calc.totalClosing))} color={COLORS.blue} />
        <MetricCard label={isRefi ? "Cash to Close" : "Cash to Close (Down + Costs)"} value={fmt(Math.round(calc.cashToClose))} color={COLORS.green} />
        <MetricCard label="% of Loan" value={calc.pctOfLoan.toFixed(2) + "%"} color={COLORS.gold} />
        <MetricCard label="LTV" value={calc.ltv.toFixed(1) + "%"} color={COLORS.accent} />
      </div>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <SectionCard title="Itemized Breakdown">
          {feeSection("Lender / Origination Fees", calc.items.lender, calc.lenderFees, COLORS.blue)}
          {feeSection("Title & Settlement Fees", calc.items.title, calc.titleFees, COLORS.gold)}
          {feeSection("Prepaids & Escrow", calc.items.prepaids, calc.prepaidsEscrow, COLORS.green)}
          {calc.items.govt.length > 0 && feeSection("Government & Other", calc.items.govt, calc.govtOther, COLORS.accent)}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${c.border || COLORS.navy}`, marginTop: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: c.text || COLORS.navy, fontFamily: font }}>Total Estimated Closing Costs</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.blue, fontFamily: font }}>{fmt(Math.round(calc.totalClosing))}</span>
          </div>
        </SectionCard>
        <SectionCard title="Cost Distribution">
          <DonutChart data={donut} size={200} label={fmt(Math.round(calc.totalClosing))} subLabel="Total Costs" />
        </SectionCard>
      </div>
    </div>
  );
}
window.ClosingCostEstimator = ClosingCostEstimator;
