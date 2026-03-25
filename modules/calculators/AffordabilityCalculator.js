// modules/calculators/AffordabilityCalculator.js
const { useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const pmt = window.pmt;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const MetricCard = window.MetricCard;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const Select = window.Select;
const DonutChart = window.DonutChart;
const COLORS = window.COLORS;
const font = window.font;

function AffordabilityCalculator() {
  const c = useThemeColors();
  const [annualIncome, setAnnualIncome] = useLocalStorage("af_inc", "100000");
  const [coIncome, setCoIncome] = useLocalStorage("af_coinc", "0");
  const [monthlyDebts, setMonthlyDebts] = useLocalStorage("af_debts", "500");
  const [rate, setRate] = useLocalStorage("af_rate", "6.75");
  const [term, setTerm] = useLocalStorage("af_term", "30");
  const [downPct, setDownPct] = useLocalStorage("af_dp", "20");
  const [taxRate, setTaxRate] = useLocalStorage("af_tax", "1.25");
  const [insRate, setInsRate] = useLocalStorage("af_ins", "0.35");
  const [frontDTI, setFrontDTI] = useLocalStorage("af_fdti", "28");
  const [backDTI, setBackDTI] = useLocalStorage("af_bdti", "43");
  const [hoaDues, setHoaDues] = useLocalStorage("af_hoa", "0");

  const calc = useMemo(() => {
    const grossMo = ((parseFloat(annualIncome) || 0) + (parseFloat(coIncome) || 0)) / 12;
    const debts = parseFloat(monthlyDebts) || 0;
    const r = (parseFloat(rate) || 6.75) / 100 / 12;
    const n = (parseInt(term) || 30) * 12;
    const dp = (parseFloat(downPct) || 20) / 100;
    const taxPct = (parseFloat(taxRate) || 1.25) / 100 / 12;
    const insPct = (parseFloat(insRate) || 0.35) / 100 / 12;
    const fd = (parseFloat(frontDTI) || 28) / 100;
    const bd = (parseFloat(backDTI) || 43) / 100;
    const hoa = parseFloat(hoaDues) || 0;
    const maxHousingFront = fd * grossMo;
    const maxHousingBack = bd * grossMo - debts;
    const maxHousing = Math.min(maxHousingFront, maxHousingBack);
    const limitedBy = maxHousingFront <= maxHousingBack ? "front" : "back";
    const pow = Math.pow(1 + r, n);
    const k = r > 0 ? (r * pow) / (pow - 1) : 1 / n;
    const pmiR = dp < 0.2 ? (1 - dp) * 0.005 / 12 : 0;
    const denom = (1 - dp) * k + taxPct + insPct + pmiR;
    const maxHome = denom > 0 ? Math.max(0, (maxHousing - hoa) / denom) : 0;
    const maxLoan = maxHome * (1 - dp);
    const downPayment = maxHome * dp;
    const piPayment = pmt(r, n, maxLoan);
    const taxMo = maxHome * taxPct;
    const insMo = maxHome * insPct;
    const pmiMo = dp < 0.2 ? maxLoan * 0.005 / 12 : 0;
    const totalPayment = piPayment + taxMo + insMo + pmiMo + hoa;
    const actualFrontDTI = grossMo > 0 ? (totalPayment / grossMo) * 100 : 0;
    const actualBackDTI = grossMo > 0 ? ((totalPayment + debts) / grossMo) * 100 : 0;
    return { grossMo, maxHome, maxLoan, downPayment, piPayment, taxMo, insMo, pmiMo, hoa, totalPayment, maxHousing, limitedBy, actualFrontDTI, actualBackDTI, debts };
  }, [annualIncome, coIncome, monthlyDebts, rate, term, downPct, taxRate, insRate, frontDTI, backDTI, hoaDues]);

  return (
    <div>
      <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <MetricCard label="Max Purchase Price" value={fmt(Math.round(calc.maxHome))} large highlight />
        <MetricCard label="Max Loan Amount" value={fmt(Math.round(calc.maxLoan))} />
        <MetricCard label="Down Payment" value={fmt(Math.round(calc.downPayment))} sub={`${downPct}%`} />
        <MetricCard label="Total Payment" value={fmt2(calc.totalPayment)} sub="/mo" />
      </div>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="INCOME & DEBTS" accent={c.green || COLORS.green}>
          <LabeledInput label="Annual Income" prefix="$" value={annualIncome} onChange={setAnnualIncome} useCommas />
          <LabeledInput label="Co-Borrower Annual Income" prefix="$" value={coIncome} onChange={setCoIncome} useCommas />
          <LabeledInput label="Monthly Debt Payments" prefix="$" value={monthlyDebts} onChange={setMonthlyDebts} useCommas info="Car, student loans, credit card minimums, etc." />
          <LabeledInput label="HOA Dues" prefix="$" value={hoaDues} onChange={setHoaDues} useCommas />
        </SectionCard>
        <SectionCard title="LOAN PARAMETERS" accent={c.blue || COLORS.blue}>
          <LabeledInput label="Interest Rate" value={rate} onChange={setRate} suffix="%" />
          <Select label="Loan Term" value={term} onChange={setTerm} options={[{ value: "30", label: "30-Year" }, { value: "20", label: "20-Year" }, { value: "15", label: "15-Year" }]} />
          <LabeledInput label="Down Payment" value={downPct} onChange={setDownPct} suffix="%" />
          <LabeledInput label="Property Tax Rate" value={taxRate} onChange={setTaxRate} suffix="% / yr" />
          <LabeledInput label="Homeowner's Insurance" value={insRate} onChange={setInsRate} suffix="% / yr" />
        </SectionCard>
        <SectionCard title="DTI LIMITS" accent={c.gold || COLORS.gold}>
          <LabeledInput label="Max Front-End DTI" value={frontDTI} onChange={setFrontDTI} suffix="%" info="Housing payment / gross income" />
          <LabeledInput label="Max Back-End DTI" value={backDTI} onChange={setBackDTI} suffix="%" info="(Housing + debts) / gross income" />
          <div style={{ padding: 10, borderRadius: 8, background: calc.limitedBy === "back" ? (c.redLight || COLORS.redLight) : (c.blueLight || COLORS.blueLight), marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: calc.limitedBy === "back" ? (c.red || COLORS.red) : (c.blue || COLORS.blue), fontFamily: font }}>
              {calc.limitedBy === "back" ? "⚠ Limited by back-end DTI (debts)" : "ℹ Limited by front-end DTI (housing)"}
            </div>
          </div>
        </SectionCard>
        <SectionCard title="PAYMENT BREAKDOWN" accent={c.navy || COLORS.navy}>
          {(() => {
            const breakItems = [
              { label: "Principal & Interest", value: calc.piPayment, color: c.navy || COLORS.navy },
              { label: "Property Tax", value: calc.taxMo, color: c.blue || COLORS.blue },
              { label: "Homeowner's Insurance", value: calc.insMo, color: c.green || COLORS.green },
              calc.pmiMo > 0 && { label: "PMI", value: calc.pmiMo, color: c.gold || COLORS.gold },
              calc.hoa > 0 && { label: "HOA Dues", value: calc.hoa, color: c.gray || COLORS.gray },
            ].filter(Boolean);
            return (<>
              <div style={{ margin: "0 auto 12px", maxWidth: 160 }}>
                <DonutChart
                  data={breakItems.map(d => ({ value: d.value, color: d.color }))}
                  size={140}
                  thickness={20}
                  centerLabel="PITI"
                  centerValue={fmt2(calc.totalPayment)}
                />
              </div>
              {breakItems.map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.border || COLORS.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                    <span style={{ fontSize: 13, color: c.text || c.navy || COLORS.navy, fontFamily: font }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy || COLORS.navy, fontFamily: font }}>{fmt2(item.value)}/mo</span>
                </div>
              ))}
            </>);
          })()}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: c.text || c.navy || COLORS.navy, fontFamily: font }}>Total PITI</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: c.blue || COLORS.blue, fontFamily: font }}>{fmt2(calc.totalPayment)}/mo</span>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, padding: 10, borderRadius: 8, background: c.bgAlt || c.blueLight || COLORS.blueLight }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font }}>FRONT DTI</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: calc.actualFrontDTI > parseFloat(frontDTI) ? (c.red || COLORS.red) : (c.green || COLORS.green), fontFamily: font }}>{calc.actualFrontDTI.toFixed(1)}%</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font }}>BACK DTI</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: calc.actualBackDTI > parseFloat(backDTI) ? (c.red || COLORS.red) : (c.green || COLORS.green), fontFamily: font }}>{calc.actualBackDTI.toFixed(1)}%</div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

window.AffordabilityCalculator = AffordabilityCalculator;
