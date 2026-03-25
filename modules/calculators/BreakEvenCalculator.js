// modules/calculators/BreakEvenCalculator.js
const { useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const COLORS = window.COLORS;
const font = window.font;
const pmt = window.pmt;
const buildAmortization = window.buildAmortization;
const calcTrueBreakEven = window.calcTrueBreakEven;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const MetricCard = window.MetricCard;

function BreakEvenCalculator() {
  const [currentPayment, setCurrentPayment] = useLocalStorage("be_cp", "2450");
  const [newPayment, setNewPayment] = useLocalStorage("be_np", "2150");
  const [closingCosts, setClosingCosts] = useLocalStorage("be_cc", "6500");
  const [currentRate, setCurrentRate] = useLocalStorage("be_cr", "7.25");
  const [newRate, setNewRate] = useLocalStorage("be_nr", "6.25");
  const [loanBalance, setLoanBalance] = useLocalStorage("be_lb", "320000");

  const calc = useMemo(() => {
    const curPmt = parseFloat(currentPayment) || 0;
    const newPmt = parseFloat(newPayment) || 0;
    const cc = parseFloat(closingCosts) || 0;
    const monthlySavings = curPmt - newPmt;
    const simpleBreakEven = monthlySavings > 0 ? Math.ceil(cc / monthlySavings) : null;
    const lb = parseFloat(loanBalance) || 0;
    const cr = (parseFloat(currentRate) || 0) / 100 / 12;
    const nr = (parseFloat(newRate) || 0) / 100 / 12;
    const curSchedule = buildAmortization(lb, cr, 360, pmt(cr, 360, lb));
    const newLb = lb + cc;
    const newSchedule = buildAmortization(newLb, nr, 360, pmt(nr, 360, newLb));
    const trueBreakEven = calcTrueBreakEven(curSchedule, newSchedule, 0, 0, cc, 360);
    const savingsAt1yr = monthlySavings * 12;
    const savingsAt3yr = monthlySavings * 36;
    const savingsAt5yr = monthlySavings * 60 - cc;
    return { monthlySavings, simpleBreakEven, trueBreakEven, savingsAt1yr, savingsAt3yr, savingsAt5yr, cc };
  }, [currentPayment, newPayment, closingCosts, currentRate, newRate, loanBalance]);

  return (
    <div>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
        <SectionCard title="INPUTS" accent={COLORS.navy}>
          <LabeledInput label="Current Monthly P&I" prefix="$" value={currentPayment} onChange={setCurrentPayment} useCommas />
          <LabeledInput label="New Monthly P&I" prefix="$" value={newPayment} onChange={setNewPayment} useCommas />
          <LabeledInput label="Total Closing Costs" prefix="$" value={closingCosts} onChange={setClosingCosts} useCommas />
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14, marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.gray, marginBottom: 8, fontFamily: font }}>FOR TRUE BREAK-EVEN (OPTIONAL)</div>
            <LabeledInput label="Loan Balance" prefix="$" value={loanBalance} onChange={setLoanBalance} useCommas small />
            <LabeledInput label="Current Rate" value={currentRate} onChange={setCurrentRate} suffix="%" small />
            <LabeledInput label="New Rate" value={newRate} onChange={setNewRate} suffix="%" small />
          </div>
        </SectionCard>
        <div>
          <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <MetricCard label="Monthly Savings" value={`${fmt(calc.monthlySavings)}/mo`} positive={calc.monthlySavings > 0} large highlight />
            <MetricCard label="Simple Break-Even" value={calc.simpleBreakEven ? `${calc.simpleBreakEven} mo` : "N/A"} sublabel="Closing costs ÷ savings" large />
            <MetricCard label="True Break-Even" value={calc.trueBreakEven.breakEvenMonth ? `${calc.trueBreakEven.breakEvenMonth} mo` : "N/A"} sublabel="Interest-based comparison" positive={calc.trueBreakEven.breakEvenMonth && calc.trueBreakEven.breakEvenMonth <= 36} large />
          </div>
          <SectionCard title="SAVINGS TIMELINE">
            <div className="mtk-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "1 Year", value: calc.savingsAt1yr, net: calc.savingsAt1yr - calc.cc },
                { label: "3 Years", value: calc.savingsAt3yr, net: calc.savingsAt3yr - calc.cc },
                { label: "5 Years", value: calc.savingsAt5yr + calc.cc, net: calc.savingsAt5yr },
              ].map((t) => (
                <div key={t.label} style={{ padding: 14, background: COLORS.bg, borderRadius: 8, border: `1px solid ${COLORS.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray, fontFamily: font }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Gross: {fmt(t.value)}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.net >= 0 ? COLORS.green : COLORS.red, fontFamily: font }}>{fmt(t.net)}</div>
                  <div style={{ fontSize: 11, color: COLORS.grayLight, fontFamily: font }}>Net (after costs)</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

window.BreakEvenCalculator = BreakEvenCalculator;
