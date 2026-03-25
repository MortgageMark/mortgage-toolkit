// modules/calculators/BiWeeklyCalculator.js
const { useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const LabeledInput = window.LabeledInput;
const SectionCard = window.SectionCard;
const DonutChart = window.DonutChart;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const COLORS = window.COLORS;
const font = window.font;

function BiWeeklyCalculator() {
  const c = useThemeColors();
  const [loanAmt, setLoanAmt] = useLocalStorage("biw_loan", "300000");
  const [rate, setRate] = useLocalStorage("biw_rate", "6.75");
  const [termYrs, setTermYrs] = useLocalStorage("biw_term", "30");
  const [extraMo, setExtraMo] = useLocalStorage("biw_extra", "0");

  const calc = useMemo(() => {
    const L = parseFloat(loanAmt) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseFloat(termYrs) || 30) * 12;
    const monthlyPmt = r > 0 ? L * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : L / n;
    const biWeeklyPmt = monthlyPmt / 2;
    const extra = parseFloat(extraMo) || 0;

    let balStd = L, totalIntStd = 0, moStd = 0;
    while (balStd > 0.01 && moStd < n + 12) {
      const intPmt = balStd * r;
      const prinPmt = Math.min(monthlyPmt - intPmt, balStd);
      totalIntStd += intPmt;
      balStd -= prinPmt;
      moStd++;
    }

    const rBi = (parseFloat(rate) || 0) / 100 / 26;
    let balBi = L, totalIntBi = 0, pmtsBi = 0;
    while (balBi > 0.01 && pmtsBi < n * 3) {
      const intPmt = balBi * rBi;
      const prinPmt = Math.min(biWeeklyPmt - intPmt, balBi);
      totalIntBi += intPmt;
      balBi -= prinPmt;
      pmtsBi++;
    }
    const biYears = pmtsBi / 26;

    let balExtra = L, totalIntExtra = 0, moExtra = 0;
    while (balExtra > 0.01 && moExtra < n + 12) {
      const intPmt = balExtra * r;
      const prinPmt = Math.min(monthlyPmt + extra - intPmt, balExtra);
      totalIntExtra += intPmt;
      balExtra -= prinPmt;
      moExtra++;
    }

    return {
      monthlyPmt, biWeeklyPmt, L,
      stdMonths: moStd, stdYears: moStd / 12, stdInterest: totalIntStd,
      biMonths: pmtsBi, biYears, biInterest: totalIntBi,
      extraMonths: moExtra, extraYears: moExtra / 12, extraInterest: totalIntExtra,
      biSaved: totalIntStd - totalIntBi, biTimeSaved: moStd / 12 - biYears,
      extraSaved: totalIntStd - totalIntExtra, extraTimeSaved: (moStd - moExtra) / 12,
    };
  }, [loanAmt, rate, termYrs, extraMo]);

  const scenarios = [
    { label: "Standard Monthly", pmt: fmt2(calc.monthlyPmt) + "/mo", years: calc.stdYears.toFixed(1), interest: calc.stdInterest, saved: 0, color: c.navy || COLORS.navy, icon: "📅" },
    { label: "Bi-Weekly", pmt: fmt2(calc.biWeeklyPmt) + " every 2 wks", years: calc.biYears.toFixed(1), interest: calc.biInterest, saved: calc.biSaved, color: c.green || COLORS.green, icon: "⚡" },
    { label: "Monthly + Extra", pmt: fmt2(calc.monthlyPmt + (parseFloat(extraMo) || 0)) + "/mo", years: calc.extraYears.toFixed(1), interest: calc.extraInterest, saved: calc.extraSaved, color: c.blue || COLORS.blue, icon: "💪" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard title="LOAN DETAILS" accent={c.navy || COLORS.navy}>
        <div className="mtk-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <LabeledInput label="Loan Amount" value={loanAmt} onChange={setLoanAmt} prefix="$" />
          <LabeledInput label="Interest Rate" value={rate} onChange={setRate} suffix="%" />
          <LabeledInput label="Loan Term (years)" value={termYrs} onChange={setTermYrs} />
          <LabeledInput label="Extra Monthly Payment" value={extraMo} onChange={setExtraMo} prefix="$" />
        </div>
      </SectionCard>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {scenarios.map((s, i) => (
          <SectionCard key={i} title={s.label} accent={s.color}>
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: font }}>{s.pmt}</div>
              <div style={{ fontSize: 11, color: c.gray || COLORS.gray, fontFamily: font, marginTop: 6 }}>Payoff: <strong>{s.years} yrs</strong></div>
              <div style={{ fontSize: 11, color: c.gray || COLORS.gray, fontFamily: font }}>Total Interest: <strong style={{ color: s.color }}>{fmt(Math.round(s.interest))}</strong></div>
              {s.saved > 0 && <div style={{ marginTop: 8, padding: "4px 10px", background: s.color + "20", borderRadius: 6, fontSize: 11, fontWeight: 700, color: s.color, fontFamily: font }}>Save {fmt(Math.round(s.saved))}</div>}
            </div>
          </SectionCard>
        ))}
      </div>
      <SectionCard title="INTEREST COMPARISON" accent={c.navy || COLORS.navy}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
          <DonutChart data={[
            { value: calc.stdInterest, color: c.navy || COLORS.navy },
            { value: calc.biInterest, color: c.green || COLORS.green },
            { value: calc.extraInterest, color: c.blue || COLORS.blue },
          ]} size={140} thickness={22} centerLabel="STD INT" centerValue={fmt(Math.round(calc.stdInterest))} />
          <div style={{ flex: 1, minWidth: 200 }}>
            {[
              { label: "Standard Monthly", val: calc.stdInterest, clr: c.navy || COLORS.navy },
              { label: "Bi-Weekly", val: calc.biInterest, clr: c.green || COLORS.green },
              { label: "Monthly + Extra", val: calc.extraInterest, clr: c.blue || COLORS.blue },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 2 ? `1px solid ${c.border || "#E8EDF0"}` : "none", fontFamily: font }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: d.clr }} />
                  <span style={{ fontSize: 12, color: c.text || COLORS.navy }}>{d.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: d.clr }}>{fmt(Math.round(d.val))}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, padding: "8px 12px", background: c.greenLight || COLORS.greenLight || "#e8f5e9", borderRadius: 6, fontSize: 11, fontFamily: font }}>
              <span style={{ color: c.green || COLORS.green, fontWeight: 700 }}>Bi-weekly saves {fmt(Math.round(calc.biSaved))} </span>
              <span style={{ color: c.gray || COLORS.gray }}>and pays off {calc.biTimeSaved.toFixed(1)} yrs early by making 26 half-payments per year (= 13 full payments)</span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

window.BiWeeklyCalculator = BiWeeklyCalculator;
