// modules/calculators/LoanProgramComparison.js
const { useMemo } = React;
const useThemeColors = window.useThemeColors;
const useLocalStorage = window.useLocalStorage;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const COLORS = window.COLORS;
const fmt = window.fmt;
const font = window.font;

function LoanProgramComparison() {
  const c = useThemeColors();
  const [price, setPrice] = useLocalStorage("lpc_price", 350000);
  const [credit, setCredit] = useLocalStorage("lpc_credit", 720);
  const [convRate, setConvRate] = useLocalStorage("lpc_conv", 6.75);
  const [fhaRate, setFhaRate] = useLocalStorage("lpc_fha", 6.25);
  const [vaRate, setVaRate] = useLocalStorage("lpc_va", 6.0);
  const [usdaRate, setUsdaRate] = useLocalStorage("lpc_usda", 6.25);
  const [isVeteran, setIsVeteran] = useLocalStorage("lpc_vet", false);
  const [isRural, setIsRural] = useLocalStorage("lpc_rural", false);
  const [firstUseVA, setFirstUseVA] = useLocalStorage("lpc_vafirst", true);

  const programs = useMemo(() => {
    const p = Number(price), cs = Number(credit);
    const term = 360;
    const calcProgram = (name, downPct, rate, mipUp, mipMo, fundFee) => {
      const down = p * downPct;
      const base = p - down;
      const upfront = base * mipUp;
      const loan = base + upfront;
      const mr = rate / 100 / 12;
      const pmt = mr > 0 ? loan * mr / (1 - Math.pow(1 + mr, -term)) : 0;
      const mi = base * mipMo / 12;
      const totalPmt = pmt + mi;
      const totalCost = totalPmt * term;
      return { name, downPct: downPct * 100, down, loan, rate, pmt, mi, totalPmt, totalCost, upfront, fundFee: upfront, cashNeeded: down, color: "" };
    };
    const conv5 = calcProgram("Conventional 5%", 0.05, Number(convRate), 0, cs >= 740 ? 0.0035 : cs >= 720 ? 0.0045 : 0.006, 0);
    conv5.color = COLORS.blue;
    const conv20 = calcProgram("Conventional 20%", 0.20, Number(convRate), 0, 0, 0);
    conv20.color = COLORS.navy;
    const fha = calcProgram("FHA 3.5%", 0.035, Number(fhaRate), 0.0175, cs >= 580 ? 0.0055 : 0.008, 0);
    fha.color = COLORS.gold;
    const va = calcProgram("VA 0% Down", 0, Number(vaRate), firstUseVA ? 0.023 : 0.036, 0, 0);
    va.color = COLORS.green;
    const usda = calcProgram("USDA 0% Down", 0, Number(usdaRate), 0.01, 0.0035, 0);
    usda.color = COLORS.accent;
    const list = [conv5, conv20, fha];
    if (isVeteran) list.push(va);
    if (isRural) list.push(usda);
    return list;
  }, [price, credit, convRate, fhaRate, vaRate, usdaRate, isVeteran, isRural, firstUseVA]);

  const lowest = programs.reduce((a, b) => a.totalPmt < b.totalPmt ? a : b);

  return (
    <div>
      <SectionCard title="Loan Program Comparison" subtitle="Compare FHA, VA, USDA & Conventional side-by-side">
        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <LabeledInput label="Purchase Price" value={price} onChange={setPrice} prefix="$" />
          <LabeledInput label="Credit Score" value={credit} onChange={setCredit} />
          <LabeledInput label="Conventional Rate" value={convRate} onChange={setConvRate} suffix="%" step="0.125" />
          <LabeledInput label="FHA Rate" value={fhaRate} onChange={setFhaRate} suffix="%" step="0.125" />
          <LabeledInput label="VA Rate" value={vaRate} onChange={setVaRate} suffix="%" step="0.125" />
          <LabeledInput label="USDA Rate" value={usdaRate} onChange={setUsdaRate} suffix="%" step="0.125" />
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font, color: c.text || COLORS.navy, cursor: "pointer" }}>
            <input type="checkbox" checked={isVeteran} onChange={e => setIsVeteran(e.target.checked)} /> Veteran (show VA)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font, color: c.text || COLORS.navy, cursor: "pointer" }}>
            <input type="checkbox" checked={isRural} onChange={e => setIsRural(e.target.checked)} /> USDA Eligible Area
          </label>
          {isVeteran && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: font, color: c.text || COLORS.navy, cursor: "pointer" }}>
              <input type="checkbox" checked={firstUseVA} onChange={e => setFirstUseVA(e.target.checked)} /> First-time VA use
            </label>
          )}
        </div>
      </SectionCard>
      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <SectionCard title="Program Comparison">
          <table className="mtk-fee-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: font }}>
            <thead>
              <tr style={{ background: c.surface || "#F1F5F9" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>Program</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>Down</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>Rate</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>Loan Amt</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>P&I</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>MI</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>Total Pmt</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((pg, i) => (
                <tr key={i} style={{ background: pg === lowest ? (c.greenLight || COLORS.greenLight) : "transparent" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700, color: pg.color, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>
                    {pg.name} {pg === lowest && "\u2713"}
                  </td>
                  <td style={{ textAlign: "right", padding: "8px 10px", color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{fmt(Math.round(pg.down))} ({pg.downPct}%)</td>
                  <td style={{ textAlign: "right", padding: "8px 10px", color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{pg.rate}%</td>
                  <td style={{ textAlign: "right", padding: "8px 10px", color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{fmt(Math.round(pg.loan))}</td>
                  <td style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600, color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{fmt(Math.round(pg.pmt))}</td>
                  <td style={{ textAlign: "right", padding: "8px 10px", color: pg.mi > 0 ? COLORS.red : COLORS.green, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{pg.mi > 0 ? fmt(Math.round(pg.mi)) : "\u2014"}</td>
                  <td style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, color: pg.color, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{fmt(Math.round(pg.totalPmt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {programs.length > 1 && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: c.greenLight || COLORS.greenLight, borderRadius: 8, fontSize: 12, color: COLORS.green, fontFamily: font }}>
              <strong>{lowest.name}</strong> has the lowest monthly payment at {fmt(Math.round(lowest.totalPmt))}/mo
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
window.LoanProgramComparison = LoanProgramComparison;
