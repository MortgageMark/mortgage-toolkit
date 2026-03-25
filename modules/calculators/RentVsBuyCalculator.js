// modules/calculators/RentVsBuyCalculator.js
const { useEffect, useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const LabeledInput = window.LabeledInput;
const SectionCard = window.SectionCard;
const Select = window.Select;
const DonutChart = window.DonutChart;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const COLORS = window.COLORS;
const font = window.font;
const STATE_LIST = window.STATE_LIST;
const STATE_APPR_RATES = window.STATE_APPR_RATES;

// Simple owner vs renter net worth line chart
function RvbWealthChart({ data }) {
  if (!data || data.length < 2) return null;
  const W = 520, H = 180;
  const pad = { t: 20, r: 20, b: 28, l: 72 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const allVals = data.flatMap(d => [d.ownerNetWorth, d.renterNetWorth]);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const xFn = i => pad.l + (i / (data.length - 1)) * w;
  const yFn = v => pad.t + h - ((v - minV) / range) * h;
  const ownerPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.ownerNetWorth).toFixed(1)}`).join(" ");
  const renterPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.renterNetWorth).toFixed(1)}`).join(" ");
  const fmtK = v => {
    const absV = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (absV >= 1000000) return `${sign}${(absV / 1000000).toFixed(1)}M`;
    if (absV >= 1000) return `${sign}${Math.round(absV / 1000)}K`;
    return `${sign}${Math.round(absV)}`;
  };
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => minV + p * range);
  const xTickYrs = [5, 10, 15, 20, 25, 30].filter(y => y <= data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block", margin: "0 auto" }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={yFn(v)} x2={W - pad.r} y2={yFn(v)} stroke="#E0E8E8" strokeWidth={1} strokeDasharray={v === 0 ? "0" : "3 3"} />
          <text x={pad.l - 5} y={yFn(v) + 4} textAnchor="end" fontSize={9} fill="#6B7D8A">${fmtK(v)}</text>
        </g>
      ))}
      {xTickYrs.map(yr => (
        <text key={yr} x={xFn(yr - 1)} y={H - 6} textAnchor="middle" fontSize={9} fill="#6B7D8A">{yr}yr</text>
      ))}
      <path d={ownerPath} fill="none" stroke={COLORS.green} strokeWidth={2.5} strokeLinejoin="round" />
      <path d={renterPath} fill="none" stroke={COLORS.blue} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={pad.l + 8} cy={12} r={5} fill={COLORS.green} />
      <text x={pad.l + 17} y={16} fontSize={9} fontWeight="700" fill={COLORS.green}>Owner Net Worth</text>
      <circle cx={pad.l + 130} cy={12} r={5} fill={COLORS.blue} />
      <text x={pad.l + 139} y={16} fontSize={9} fontWeight="700" fill={COLORS.blue}>Renter Net Worth</text>
    </svg>
  );
}

function RentVsBuyCalculator() {
  const c = useThemeColors();
  const [homePrice, setHomePrice] = useLocalStorage("rvb_price", "350000");
  const [downPct, setDownPct] = useLocalStorage("rvb_down", "10");
  const [rate, setRate] = useLocalStorage("rvb_rate", "6.75");
  const [termYrs, setTermYrs] = useLocalStorage("rvb_term", "30");
  const [propTaxRate, setPropTaxRate] = useLocalStorage("rvb_ptax", "1.25");
  const [insurance, setInsurance] = useLocalStorage("rvb_ins", "1200");
  const [hoa, setHoa] = useLocalStorage("rvb_hoa", "0");
  const [maint, setMaint] = useLocalStorage("rvb_maint", "1");
  const [appreciation, setAppreciation] = useLocalStorage("rvb_appr", "3.5");
  const [monthlyRent, setMonthlyRent] = useLocalStorage("rvb_rent", "2000");
  const [rentIncrease, setRentIncrease] = useLocalStorage("rvb_rentinc", "3");
  const [investReturn, setInvestReturn] = useLocalStorage("rvb_invest", "7");
  const [taxBracket, setTaxBracket] = useLocalStorage("rvb_taxbrk", "22");
  const [stayYears, setStayYears] = useLocalStorage("rvb_stay", "7");
  const [rvbState, setRvbState] = useLocalStorage("rvb_state", "TX");

  // Auto-populate appreciation when state changes (skip mount)
  const apprStateInitRef = React.useRef(true);
  useEffect(() => {
    if (apprStateInitRef.current) { apprStateInitRef.current = false; return; }
    const defaultRate = STATE_APPR_RATES[rvbState];
    if (defaultRate != null) setAppreciation(String(defaultRate));
  }, [rvbState]);

  // 30-year owner vs renter wealth timeline for chart + milestones
  const wealthTimeline = useMemo(() => {
    const hp = parseFloat(homePrice) || 0;
    const dp = hp * (parseFloat(downPct) || 0) / 100;
    const loan = hp - dp;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseFloat(termYrs) || 30) * 12;
    const appr = (parseFloat(appreciation) || 0) / 100;
    const inv = (parseFloat(investReturn) || 0) / 100 / 12;
    const rent0 = parseFloat(monthlyRent) || 0;
    const rentInc = (parseFloat(rentIncrease) || 0) / 100;
    const ptaxMo = hp * (parseFloat(propTaxRate) || 0) / 100 / 12;
    const insMo = (parseFloat(insurance) || 0) / 12;
    const hoaMo = parseFloat(hoa) || 0;
    const maintMo = hp * (parseFloat(maint) || 0) / 100 / 12;
    const pmiMo = (parseFloat(downPct) || 0) < 20 ? loan * 0.007 / 12 : 0;
    if (hp <= 0 || loan < 0 || r <= 0) return [];
    const pmtVal = r > 0 ? loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : loan / n;
    const totalBuyMo = pmtVal + ptaxMo + insMo + hoaMo + maintMo + pmiMo;
    let balance = loan;
    let renterWealth = dp;
    const timeline = [];
    for (let y = 1; y <= 30; y++) {
      const currentRent = rent0 * Math.pow(1 + rentInc, y - 1);
      for (let m = 0; m < 12; m++) {
        if (balance > 0) {
          const intPmt = balance * r;
          const prinPmt = Math.min(pmtVal - intPmt, balance);
          balance = Math.max(0, balance - prinPmt);
        }
        renterWealth = renterWealth * (1 + inv) + Math.max(0, totalBuyMo - currentRent);
      }
      const homeValue = hp * Math.pow(1 + appr, y);
      const ownerNetWorth = homeValue - balance - homeValue * 0.06;
      timeline.push({ year: y, ownerNetWorth, renterNetWorth: renterWealth, homeValue, balance });
    }
    return timeline;
  }, [homePrice, downPct, rate, termYrs, appreciation, investReturn, monthlyRent, rentIncrease, propTaxRate, insurance, hoa, maint]);

  const calc = useMemo(() => {
    const hp = parseFloat(homePrice) || 0;
    const dp = hp * (parseFloat(downPct) || 0) / 100;
    const loan = hp - dp;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseFloat(termYrs) || 30) * 12;
    const pmt = r > 0 ? loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : loan / n;
    const ptaxMo = hp * (parseFloat(propTaxRate) || 0) / 100 / 12;
    const insMo = (parseFloat(insurance) || 0) / 12;
    const hoaMo = parseFloat(hoa) || 0;
    const maintMo = hp * (parseFloat(maint) || 0) / 100 / 12;
    const pmiMo = (parseFloat(downPct) || 0) < 20 ? loan * 0.007 / 12 : 0;
    const totalBuyMo = pmt + ptaxMo + insMo + hoaMo + maintMo + pmiMo;
    const rent0 = parseFloat(monthlyRent) || 0;
    const rentInc = (parseFloat(rentIncrease) || 0) / 100;
    const appr = (parseFloat(appreciation) || 0) / 100;
    const inv = (parseFloat(investReturn) || 0) / 100 / 12;
    const taxBr = (parseFloat(taxBracket) || 0) / 100;
    const years = parseInt(stayYears) || 7;

    let balance = loan;
    let totalBuyCost = dp;
    let totalRentCost = 0;
    let rentInvestment = dp;
    let yearData = [];

    for (let y = 1; y <= years; y++) {
      let yearInterest = 0;
      let yearPrincipal = 0;
      let yearRent = 0;
      const currentRent = rent0 * Math.pow(1 + rentInc, y - 1);
      for (let m = 0; m < 12; m++) {
        const intPmt = balance * r;
        const prinPmt = pmt - intPmt;
        yearInterest += intPmt;
        yearPrincipal += prinPmt;
        balance = Math.max(0, balance - prinPmt);
        totalBuyCost += totalBuyMo;
        yearRent += currentRent;
        totalRentCost += currentRent;
        const rentSavings = totalBuyMo > currentRent ? totalBuyMo - currentRent : 0;
        rentInvestment = (rentInvestment) * (1 + inv) + rentSavings;
      }
      const homeValue = hp * Math.pow(1 + appr, y);
      const equity = homeValue - balance;
      const taxSaving = yearInterest * taxBr;
      const netBuyCost = totalBuyCost - (equity) - taxSaving * y / y;
      yearData.push({ year: y, equity, homeValue, balance, totalBuyCost, totalRentCost, rentInvestment, rentMo: currentRent, taxSaving: yearInterest * taxBr });
    }

    const finalHomeVal = hp * Math.pow(1 + appr, years);
    const sellingCosts = finalHomeVal * 0.06;
    const netBuyWealth = finalHomeVal - balance - sellingCosts;
    const netRentWealth = rentInvestment;
    const buyWins = netBuyWealth > netRentWealth;
    const breakEvenYr = yearData.findIndex(d => {
      const sv = d.homeValue * 0.06;
      return (d.homeValue - d.balance - sv) > d.rentInvestment;
    });

    return { pmt, totalBuyMo, ptaxMo, insMo, hoaMo, maintMo, pmiMo, dp, loan, yearData, netBuyWealth, netRentWealth, buyWins, breakEvenYr: breakEvenYr >= 0 ? breakEvenYr + 1 : null, finalHomeVal, balance, sellingCosts, rentInvestment, years };
  }, [homePrice, downPct, rate, termYrs, propTaxRate, insurance, hoa, maint, appreciation, monthlyRent, rentIncrease, investReturn, taxBracket, stayYears]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard title="BUYING COSTS" accent={c.navy || COLORS.navy}>
        <div style={{ marginBottom: 10 }}>
          <Select label="State (auto-fills appreciation)" value={rvbState} onChange={setRvbState} options={STATE_LIST.map(s => ({ value: s.value, label: s.label }))} />
          {STATE_APPR_RATES[rvbState] != null && (
            <div style={{ fontSize: 10, color: c.grayLight || COLORS.grayLight, fontFamily: font, marginTop: -4, marginBottom: 4, fontStyle: "italic" }}>
              * {rvbState} FHFA avg ≈ {STATE_APPR_RATES[rvbState]}% — override as needed
            </div>
          )}
        </div>
        <div className="mtk-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <LabeledInput label="Home Price" value={homePrice} onChange={setHomePrice} prefix="$" />
          <LabeledInput label="Down Payment %" value={downPct} onChange={setDownPct} suffix="%" />
          <LabeledInput label="Interest Rate" value={rate} onChange={setRate} suffix="%" />
          <LabeledInput label="Loan Term (years)" value={termYrs} onChange={setTermYrs} />
          <LabeledInput label="Property Tax Rate" value={propTaxRate} onChange={setPropTaxRate} suffix="%" />
          <LabeledInput label="Annual Insurance" value={insurance} onChange={setInsurance} prefix="$" />
          <LabeledInput label="Monthly HOA" value={hoa} onChange={setHoa} prefix="$" />
          <LabeledInput label="Maintenance %" value={maint} onChange={setMaint} suffix="%" />
          <LabeledInput label="Appreciation Rate" value={appreciation} onChange={setAppreciation} suffix="%" />
        </div>
      </SectionCard>
      <SectionCard title="RENTING COSTS" accent={c.blue || COLORS.blue}>
        <div className="mtk-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <LabeledInput label="Monthly Rent" value={monthlyRent} onChange={setMonthlyRent} prefix="$" />
          <LabeledInput label="Annual Rent Increase" value={rentIncrease} onChange={setRentIncrease} suffix="%" />
          <LabeledInput label="Investment Return" value={investReturn} onChange={setInvestReturn} suffix="%" />
          <LabeledInput label="Tax Bracket" value={taxBracket} onChange={setTaxBracket} suffix="%" />
          <LabeledInput label="Years to Stay" value={stayYears} onChange={setStayYears} />
        </div>
      </SectionCard>
      <SectionCard title="VERDICT" accent={calc.buyWins ? (c.green || COLORS.green) : (c.blue || COLORS.blue)}>
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: calc.buyWins ? (c.green || COLORS.green) : (c.blue || COLORS.blue), fontFamily: font }}>{calc.buyWins ? "🏠 BUYING WINS" : "🏢 RENTING WINS"}</div>
          <div style={{ fontSize: 13, color: c.gray || COLORS.gray, fontFamily: font, marginTop: 4 }}>After {calc.years} years with 6% selling costs</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font, letterSpacing: "0.05em" }}>BUY NET WEALTH</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.green || COLORS.green, fontFamily: font }}>{fmt(Math.round(calc.netBuyWealth))}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font, letterSpacing: "0.05em" }}>RENT NET WEALTH</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.blue || COLORS.blue, fontFamily: font }}>{fmt(Math.round(calc.netRentWealth))}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font, letterSpacing: "0.05em" }}>DIFFERENCE</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.navy || COLORS.navy, fontFamily: font }}>{fmt(Math.round(Math.abs(calc.netBuyWealth - calc.netRentWealth)))}</div>
            </div>
          </div>
          {calc.breakEvenYr && <div style={{ fontSize: 12, color: c.gold || COLORS.gold, fontWeight: 700, fontFamily: font, marginTop: 12, padding: "6px 14px", background: c.goldLight || COLORS.goldLight, borderRadius: 6, display: "inline-block" }}>Break-even point: Year {calc.breakEvenYr}</div>}
        </div>
      </SectionCard>
      {/* ── NET WORTH OVER TIME ── */}
      {wealthTimeline.length > 0 && (
        <SectionCard title="NET WORTH OVER TIME" accent={c.green || COLORS.green}>
          <RvbWealthChart data={wealthTimeline} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16 }}>
            {[5, 10, 20].map(yr => {
              const d = wealthTimeline[yr - 1];
              if (!d) return null;
              const ownerWins = d.ownerNetWorth > d.renterNetWorth;
              const diff = Math.abs(d.ownerNetWorth - d.renterNetWorth);
              return (
                <div key={yr} style={{ padding: 10, borderRadius: 8, border: `1px solid ${c.border || COLORS.border}`, background: c.bg || "#fff" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.gray || COLORS.gray, fontFamily: font, letterSpacing: "0.05em", marginBottom: 6 }}>YEAR {yr}</div>
                  <div style={{ fontSize: 11, color: c.gray || COLORS.gray, fontFamily: font }}>Owner:</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.green || COLORS.green, fontFamily: font }}>{fmt(Math.round(d.ownerNetWorth))}</div>
                  <div style={{ fontSize: 11, color: c.gray || COLORS.gray, fontFamily: font, marginTop: 4 }}>Renter:</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.blue || COLORS.blue, fontFamily: font }}>{fmt(Math.round(d.renterNetWorth))}</div>
                  <div style={{ marginTop: 6, padding: "3px 6px", borderRadius: 5, background: ownerWins ? (c.green || COLORS.green) + "20" : (c.blue || COLORS.blue) + "20", fontSize: 10, fontWeight: 700, color: ownerWins ? (c.green || COLORS.green) : (c.blue || COLORS.blue), fontFamily: font, textAlign: "center" }}>
                    {ownerWins ? "🏠" : "🏢"} {ownerWins ? "Own +" : "Rent +"}{fmt(Math.round(diff))}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard title="MONTHLY COST COMPARISON" accent={c.navy || COLORS.navy}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
          <DonutChart data={[
            { value: calc.pmt, color: c.navy || COLORS.navy },
            { value: calc.ptaxMo, color: c.blue || COLORS.blue },
            { value: calc.insMo, color: c.green || COLORS.green },
            { value: calc.hoaMo + calc.maintMo, color: c.gold || COLORS.gold },
            { value: calc.pmiMo, color: c.red || COLORS.red }
          ]} size={130} thickness={20} centerLabel="BUY/MO" centerValue={fmt2(calc.totalBuyMo)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "center", minWidth: 150 }}>
            {[
              { label: "P&I", val: calc.pmt, clr: c.navy || COLORS.navy },
              { label: "Tax", val: calc.ptaxMo, clr: c.blue || COLORS.blue },
              { label: "Insurance", val: calc.insMo, clr: c.green || COLORS.green },
              { label: "HOA + Maint.", val: calc.hoaMo + calc.maintMo, clr: c.gold || COLORS.gold },
              { label: "PMI", val: calc.pmiMo, clr: c.red || COLORS.red },
            ].filter(d => d.val > 0).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: font }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.clr, flexShrink: 0 }} />
                <span style={{ color: c.gray || COLORS.gray }}>{d.label}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700, color: c.text || COLORS.navy }}>{fmt2(d.val)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "8px 0", background: c.blueLight || COLORS.blueLight, borderRadius: 6 }}>
          <span style={{ fontSize: 11, color: c.gray || COLORS.gray, fontFamily: font }}>Monthly Rent: </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: c.blue || COLORS.blue, fontFamily: font }}>{fmt2(parseFloat(monthlyRent) || 0)}</span>
          <span style={{ fontSize: 11, color: c.gray || COLORS.gray, fontFamily: font, marginLeft: 8 }}>Difference: </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: calc.totalBuyMo > (parseFloat(monthlyRent) || 0) ? (c.red || COLORS.red) : (c.green || COLORS.green), fontFamily: font }}>{fmt2(Math.abs(calc.totalBuyMo - (parseFloat(monthlyRent) || 0)))}/mo</span>
        </div>
      </SectionCard>
      <SectionCard title="YEAR-BY-YEAR PROJECTION" accent={c.navy || COLORS.navy}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: font }}>
            <thead>
              <tr>{["Year", "Home Value", "Equity", "Buy Cost", "Rent Cost", "Rent Invest."].map((h, i) => (
                <th key={i} style={{ padding: "8px 6px", textAlign: i === 0 ? "center" : "right", borderBottom: `2px solid ${c.navy || COLORS.navy}`, color: c.gray || COLORS.gray, fontWeight: 700, fontSize: 10, letterSpacing: "0.03em" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>{calc.yearData.map((d, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : (c.bgAlt || c.blueLight || COLORS.blueLight) }}>
                <td style={{ padding: "6px", textAlign: "center", fontWeight: 700, color: c.navy || COLORS.navy }}>{d.year}</td>
                <td style={{ padding: "6px", textAlign: "right", color: c.text || COLORS.navy }}>{fmt(Math.round(d.homeValue))}</td>
                <td style={{ padding: "6px", textAlign: "right", color: c.green || COLORS.green, fontWeight: 600 }}>{fmt(Math.round(d.equity))}</td>
                <td style={{ padding: "6px", textAlign: "right", color: c.text || COLORS.navy }}>{fmt(Math.round(d.totalBuyCost))}</td>
                <td style={{ padding: "6px", textAlign: "right", color: c.text || COLORS.navy }}>{fmt(Math.round(d.totalRentCost))}</td>
                <td style={{ padding: "6px", textAlign: "right", color: c.blue || COLORS.blue, fontWeight: 600 }}>{fmt(Math.round(d.rentInvestment))}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

window.RentVsBuyCalculator = RentVsBuyCalculator;
