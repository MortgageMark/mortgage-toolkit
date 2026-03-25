// modules/calculators/BudgetPlanner.js
const { useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const COLORS = window.COLORS;
const font = window.font;
const LabeledInput = window.LabeledInput;
const SectionCard = window.SectionCard;
const MetricCard = window.MetricCard;
const DonutChart = window.DonutChart;
const fmt = window.fmt;

function BudgetPlanner() {
  const c = useThemeColors();
  const [income, setIncome] = useLocalStorage("bud_income", 8500);
  const [mortgagePmt, setMortgagePmt] = useLocalStorage("bud_mort", 2400);
  const [propTax, setPropTax] = useLocalStorage("bud_tax", 700);
  const [homeIns, setHomeIns] = useLocalStorage("bud_ins", 150);
  const [hoa, setHoa] = useLocalStorage("bud_hoa", 0);
  const [utilities, setUtilities] = useLocalStorage("bud_util", 350);
  const [carPayment, setCarPayment] = useLocalStorage("bud_car", 450);
  const [carIns, setCarIns] = useLocalStorage("bud_carins", 150);
  const [groceries, setGroceries] = useLocalStorage("bud_groc", 600);
  const [childcare, setChildcare] = useLocalStorage("bud_child", 0);
  const [studentLoan, setStudentLoan] = useLocalStorage("bud_student", 0);
  const [creditCards, setCreditCards] = useLocalStorage("bud_cc", 200);
  const [subscriptions, setSubscriptions] = useLocalStorage("bud_subs", 120);
  const [entertainment, setEntertainment] = useLocalStorage("bud_ent", 200);
  const [savings, setSavings] = useLocalStorage("bud_save", 500);
  const [other, setOther] = useLocalStorage("bud_other", 100);

  const calc = useMemo(() => {
    const inc = Number(income);
    const housing = Number(mortgagePmt) + Number(propTax) + Number(homeIns) + Number(hoa) + Number(utilities);
    const transport = Number(carPayment) + Number(carIns);
    const living = Number(groceries) + Number(childcare) + Number(entertainment) + Number(subscriptions);
    const debt = Number(studentLoan) + Number(creditCards);
    const save = Number(savings);
    const oth = Number(other);
    const totalExp = housing + transport + living + debt + save + oth;
    const remaining = inc - totalExp;
    const housingPct = inc > 0 ? (housing / inc) * 100 : 0;
    const dtiPct = inc > 0 ? ((Number(mortgagePmt) + Number(propTax) + Number(homeIns) + Number(hoa) + Number(carPayment) + Number(studentLoan) + Number(creditCards)) / inc) * 100 : 0;
    return { housing, transport, living, debt, save, oth, totalExp, remaining, housingPct, dtiPct };
  }, [income, mortgagePmt, propTax, homeIns, hoa, utilities, carPayment, carIns, groceries, childcare, studentLoan, creditCards, subscriptions, entertainment, savings, other]);

  const donut = [
    { label: "Housing", value: calc.housing, color: COLORS.blue },
    { label: "Transportation", value: calc.transport, color: COLORS.gold },
    { label: "Living", value: calc.living, color: COLORS.green },
    { label: "Debt", value: calc.debt, color: COLORS.red },
    { label: "Savings", value: calc.save, color: COLORS.accent },
    { label: "Other", value: calc.oth, color: "#8E99A4" },
  ].filter(d => d.value > 0);

  const inputRow = (label, value, onChange) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: c.textSecondary || COLORS.gray, fontFamily: font }}>{label}</span>
      <div style={{ width: 120 }}><LabeledInput value={value} onChange={onChange} prefix="$" /></div>
    </div>
  );

  return (
    <div>
      <SectionCard title="Monthly Income">
        <LabeledInput label="Total Monthly Income (after tax)" value={income} onChange={setIncome} prefix="$" />
      </SectionCard>
      <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
        <MetricCard label="Total Expenses" value={fmt(Math.round(calc.totalExp))} color={COLORS.blue} />
        <MetricCard label="Remaining" value={fmt(Math.round(calc.remaining))} color={calc.remaining >= 0 ? COLORS.green : COLORS.red} />
        <MetricCard label="Housing Ratio" value={calc.housingPct.toFixed(1) + "%"} color={calc.housingPct > 35 ? COLORS.red : COLORS.green} />
        <MetricCard label="DTI Ratio" value={calc.dtiPct.toFixed(1) + "%"} color={calc.dtiPct > 43 ? COLORS.red : calc.dtiPct > 36 ? COLORS.gold : COLORS.green} />
      </div>
      <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <SectionCard title="🏠 Housing" subtitle={fmt(Math.round(calc.housing)) + "/mo"}>
            {inputRow("Mortgage P&I", mortgagePmt, setMortgagePmt)}
            {inputRow("Property Tax", propTax, setPropTax)}
            {inputRow("Home Insurance", homeIns, setHomeIns)}
            {inputRow("HOA", hoa, setHoa)}
            {inputRow("Utilities", utilities, setUtilities)}
          </SectionCard>
          <SectionCard title="🚗 Transportation" subtitle={fmt(Math.round(calc.transport)) + "/mo"} style={{ marginTop: 12 }}>
            {inputRow("Car Payment", carPayment, setCarPayment)}
            {inputRow("Auto Insurance", carIns, setCarIns)}
          </SectionCard>
        </div>
        <div>
          <SectionCard title="🛒 Living Expenses" subtitle={fmt(Math.round(calc.living)) + "/mo"}>
            {inputRow("Groceries", groceries, setGroceries)}
            {inputRow("Childcare", childcare, setChildcare)}
            {inputRow("Entertainment", entertainment, setEntertainment)}
            {inputRow("Subscriptions", subscriptions, setSubscriptions)}
          </SectionCard>
          <SectionCard title="💳 Debt & Savings" subtitle={fmt(Math.round(calc.debt + calc.save + calc.oth)) + "/mo"} style={{ marginTop: 12 }}>
            {inputRow("Student Loans", studentLoan, setStudentLoan)}
            {inputRow("Credit Cards", creditCards, setCreditCards)}
            {inputRow("Savings/Invest", savings, setSavings)}
            {inputRow("Other", other, setOther)}
          </SectionCard>
        </div>
      </div>
      <SectionCard title="Budget Breakdown" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <DonutChart data={donut} size={220} label={fmt(Math.round(calc.totalExp))} subLabel="Monthly" />
        </div>
        {calc.remaining < 0 && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#FDECEA", borderRadius: 8, fontSize: 12, color: "#C62828", fontFamily: font, textAlign: "center" }}>
            ⚠️ You're <strong>{fmt(Math.abs(Math.round(calc.remaining)))}</strong> over budget. Consider reducing expenses or increasing income.
          </div>
        )}
      </SectionCard>
    </div>
  );
}
window.BudgetPlanner = BudgetPlanner;
