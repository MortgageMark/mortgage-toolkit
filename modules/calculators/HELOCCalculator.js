// modules/calculators/HELOCCalculator.js
const { useMemo } = React;
const useThemeColors = window.useThemeColors;
const useLocalStorage = window.useLocalStorage;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const MetricCard = window.MetricCard;
const DonutChart = window.DonutChart;
const COLORS = window.COLORS;
const fmt = window.fmt;
const font = window.font;

function HELOCCalculator() {
  const c = useThemeColors();
  const [homeValue, setHomeValue] = useLocalStorage("hel_value", 500000);
  const [mortBal, setMortBal] = useLocalStorage("hel_bal", 300000);
  const [mortRate, setMortRate] = useLocalStorage("hel_mrate", 6.5);
  const [mortPayment, setMortPayment] = useLocalStorage("hel_mpay", 1896);
  const [helocAmt, setHelocAmt] = useLocalStorage("hel_amt", 50000);
  const [helocRate, setHelocRate] = useLocalStorage("hel_hrate", 8.5);
  const [helocTerm, setHelocTerm] = useLocalStorage("hel_term", 10);
  const [maxLTV, setMaxLTV] = useLocalStorage("hel_maxltv", 80);

  const calc = useMemo(() => {
    const hv = Number(homeValue), mb = Number(mortBal), ha = Number(helocAmt), hr = Number(helocRate), ht = Number(helocTerm), ml = Number(maxLTV);
    const equity = hv - mb;
    const equityPct = hv > 0 ? (equity / hv) * 100 : 0;
    const currentLTV = hv > 0 ? (mb / hv) * 100 : 0;
    const maxBorrow = (hv * ml / 100) - mb;
    const cltv = hv > 0 ? ((mb + ha) / hv) * 100 : 0;
    const monthlyRate = hr / 100 / 12;
    const n = ht * 12;
    const helocPayment = monthlyRate > 0 && n > 0 ? ha * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n)) : 0;
    const interestOnly = ha * (hr / 100 / 12);
    const totalInterest = (helocPayment * n) - ha;
    const totalCombinedPayment = Number(mortPayment) + helocPayment;
    return { equity, equityPct, currentLTV, maxBorrow: Math.max(0, maxBorrow), cltv, helocPayment, interestOnly, totalInterest, totalCombinedPayment };
  }, [homeValue, mortBal, helocAmt, helocRate, helocTerm, mortPayment, maxLTV]);

  const eligible = calc.maxBorrow > 0;
  const requestedOk = Number(helocAmt) <= calc.maxBorrow;

  const donut = [
    { label: "Mortgage Balance", value: Number(mortBal), color: COLORS.blue },
    { label: "HELOC Amount", value: Number(helocAmt), color: COLORS.gold },
    { label: "Remaining Equity", value: Math.max(0, Number(homeValue) - Number(mortBal) - Number(helocAmt)), color: COLORS.green },
  ];

  return (
    <div>
      <SectionCard title="Home Equity Position" subtitle="Your current equity and borrowing power">
        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <LabeledInput label="Home Value" value={homeValue} onChange={setHomeValue} prefix="$" />
          <LabeledInput label="Mortgage Balance" value={mortBal} onChange={setMortBal} prefix="$" />
          <LabeledInput label="Current Mortgage Payment" value={mortPayment} onChange={setMortPayment} prefix="$" />
          <LabeledInput label="Current Mortgage Rate" value={mortRate} onChange={setMortRate} suffix="%" step="0.125" />
        </div>
      </SectionCard>
      <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
        <MetricCard label="Total Equity" value={fmt(Math.round(calc.equity))} color={COLORS.green} />
        <MetricCard label="Equity %" value={calc.equityPct.toFixed(1) + "%"} color={COLORS.blue} />
        <MetricCard label="Current LTV" value={calc.currentLTV.toFixed(1) + "%"} color={COLORS.gold} />
        <MetricCard label={"Max Borrowable (" + maxLTV + "% CLTV)"} value={fmt(Math.round(calc.maxBorrow))} color={eligible ? COLORS.green : COLORS.red} />
      </div>
      <SectionCard title="HELOC / Home Equity Loan" subtitle="Calculate payments on equity borrowing">
        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <LabeledInput label="HELOC Amount" value={helocAmt} onChange={setHelocAmt} prefix="$" />
          <LabeledInput label="HELOC Rate" value={helocRate} onChange={setHelocRate} suffix="%" step="0.25" />
          <LabeledInput label="Repayment Term (years)" value={helocTerm} onChange={setHelocTerm} suffix="yr" />
          <LabeledInput label="Max CLTV Allowed" value={maxLTV} onChange={setMaxLTV} suffix="%" />
        </div>
        {!requestedOk && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#FDECEA", borderRadius: 8, fontSize: 12, color: "#C62828", fontFamily: font }}>
            Warning: Requested amount exceeds max borrowable at {maxLTV}% CLTV. Maximum available: {fmt(Math.round(calc.maxBorrow))}
          </div>
        )}
      </SectionCard>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 12 }}>
        <SectionCard title="Payment Summary">
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { label: "HELOC Monthly (P&I)", val: fmt(Math.round(calc.helocPayment)), color: COLORS.gold },
              { label: "HELOC Interest-Only", val: fmt(Math.round(calc.interestOnly)), color: COLORS.accent },
              { label: "Total HELOC Interest", val: fmt(Math.round(calc.totalInterest)), color: COLORS.red },
              { label: "Combined Monthly Payment", val: fmt(Math.round(calc.totalCombinedPayment)), color: COLORS.blue },
              { label: "Combined LTV (CLTV)", val: calc.cltv.toFixed(1) + "%", color: calc.cltv > Number(maxLTV) ? COLORS.red : COLORS.green },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: c.surface || "#F8FAFC", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: c.textSecondary || COLORS.gray, fontFamily: font }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: r.color, fontFamily: font }}>{r.val}</span>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Equity Breakdown">
          <DonutChart data={donut} size={200} label={calc.equityPct.toFixed(0) + "%"} subLabel="Equity" />
        </SectionCard>
      </div>
    </div>
  );
}
window.HELOCCalculator = HELOCCalculator;
