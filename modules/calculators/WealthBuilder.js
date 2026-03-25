// modules/calculators/WealthBuilder.js
const { useState, useEffect, useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const LabeledInput = window.LabeledInput;
const SectionCard = window.SectionCard;
const Select = window.Select;
const MetricCard = window.MetricCard;
const Toggle = window.Toggle;
const Button = window.Button;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const pmt = window.pmt;
const COLORS = window.COLORS;
const font = window.font;
const STATE_LIST = window.STATE_LIST;
const STATE_APPR_RATES = window.STATE_APPR_RATES;
const exportToPDF = window.exportToPDF;

// ── Inline SVG equity timeline chart ──────────────────────────────────────
function WbEquityChart({ timeline, c }) {
  if (!timeline || timeline.length < 2) return null;
  const W = 560, H = 200;
  const pad = { t: 10, r: 20, b: 28, l: 76 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const maxVal = Math.max(...timeline.map(d => d.homeValue), 1);
  const xFn = i => pad.l + (i / (timeline.length - 1)) * w;
  const yFn = v => pad.t + h - (Math.max(0, v) / maxVal) * h;
  const valuePath = timeline.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.homeValue).toFixed(1)}`).join(" ");
  const balancePath = timeline.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.balance).toFixed(1)}`).join(" ");
  const equityArea = `${timeline.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.homeValue).toFixed(1)}`).join(" ")} ${[...timeline].reverse().map((d, i, arr) => `L${xFn(arr.length - 1 - i).toFixed(1)},${yFn(d.balance).toFixed(1)}`).join(" ")} Z`;
  const fmtK = v => { const a = Math.abs(v); return a >= 1000000 ? `${(a/1000000).toFixed(1)}M` : a >= 1000 ? `${Math.round(a/1000)}K` : `${Math.round(a)}`; };
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(p => p * maxVal);
  const xTickYrs = [5, 10, 15, 20, 25, 30].filter(y => y <= timeline.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, display: "block", margin: "0 auto" }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={yFn(v)} x2={W - pad.r} y2={yFn(v)} stroke="#E0E8E8" strokeWidth={1} strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={pad.l - 5} y={yFn(v) + 4} textAnchor="end" fontSize={9} fill="#6B7D8A">${fmtK(v)}</text>
        </g>
      ))}
      {xTickYrs.map(yr => (
        <text key={yr} x={xFn(yr - 1)} y={H - 6} textAnchor="middle" fontSize={9} fill="#6B7D8A">{yr}yr</text>
      ))}
      <path d={equityArea} fill={COLORS.green} fillOpacity={0.15} />
      <path d={valuePath} fill="none" stroke={COLORS.green} strokeWidth={2.5} strokeLinejoin="round" />
      <path d={balancePath} fill="none" stroke={COLORS.red} strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" />
      <circle cx={pad.l + 8} cy={12} r={4} fill={COLORS.green} />
      <text x={pad.l + 16} y={16} fontSize={9} fontWeight="700" fill={COLORS.green}>Home Value</text>
      <circle cx={pad.l + 108} cy={12} r={4} fill={COLORS.red} />
      <text x={pad.l + 116} y={16} fontSize={9} fontWeight="700" fill={COLORS.red}>Loan Balance</text>
      <rect x={pad.l + 208} y={7} width={9} height={9} fill={COLORS.green} fillOpacity={0.3} />
      <text x={pad.l + 220} y={16} fontSize={9} fontWeight="700" fill={COLORS.green} fillOpacity={0.9}>Equity</text>
    </svg>
  );
}

// ── Net worth comparison chart (own vs rent + invest) ─────────────────────
function WbNetWorthChart({ timeline }) {
  if (!timeline || timeline.length < 2) return null;
  const W = 560, H = 180;
  const pad = { t: 20, r: 20, b: 28, l: 76 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const allVals = timeline.flatMap(d => [d.ownerNetWorth, d.renterNetWorth]);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals, 1);
  const range = maxV - minV;
  const xFn = i => pad.l + (i / (timeline.length - 1)) * w;
  const yFn = v => pad.t + h - ((v - minV) / range) * h;
  const ownerPath = timeline.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.ownerNetWorth).toFixed(1)}`).join(" ");
  const renterPath = timeline.map((d, i) => `${i === 0 ? "M" : "L"}${xFn(i).toFixed(1)},${yFn(d.renterNetWorth).toFixed(1)}`).join(" ");
  const fmtK = v => { const a = Math.abs(v); const s = v < 0 ? "-" : ""; return `${s}${a >= 1000000 ? (a/1000000).toFixed(1)+"M" : a >= 1000 ? Math.round(a/1000)+"K" : Math.round(a)}`; };
  const yTicks = [0, 0.33, 0.66, 1].map(p => minV + p * range);
  const xTickYrs = [5, 10, 15, 20, 25, 30].filter(y => y <= timeline.length);
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
      <circle cx={pad.l + 8} cy={12} r={4} fill={COLORS.green} />
      <text x={pad.l + 16} y={16} fontSize={9} fontWeight="700" fill={COLORS.green}>Owner Net Worth</text>
      <circle cx={pad.l + 140} cy={12} r={4} fill={COLORS.blue} />
      <text x={pad.l + 148} y={16} fontSize={9} fontWeight="700" fill={COLORS.blue}>Renter (invested DP)</text>
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
function WealthBuilder() {
  const c = useThemeColors();

  // Propagated loan inputs (read from pc_ keys, same pattern as other calculators)
  const [purchasePrice, setPurchasePrice] = useLocalStorage("pc_hp", "437500");
  const [loanAmount, setLoanAmount] = useLocalStorage("pc_la", "350000");
  const [wbRate, setWbRate] = useLocalStorage("pc_rate", "6.75");
  const [wbTerm, setWbTerm] = useLocalStorage("pc_term", "30");

  // WealthBuilder-specific inputs
  const [wbAppr, setWbAppr] = useLocalStorage("wb_appr", "3.5");
  const [wbState, setWbState] = useLocalStorage("wb_state", "TX");
  const [wbMarket, setWbMarket] = useLocalStorage("wb_market", "7");
  const [wbBracket, setWbBracket] = useLocalStorage("wb_bracket", "22");
  const [wbPropTax, setWbPropTax] = useLocalStorage("wb_proptax", "1.5");
  const [wbRent, setWbRent] = useLocalStorage("wb_rent", "2000");

  // Auto-populate appreciation from state
  const apprStateInitRef = React.useRef(true);
  useEffect(() => {
    if (apprStateInitRef.current) { apprStateInitRef.current = false; return; }
    const r = STATE_APPR_RATES[wbState];
    if (r != null) setWbAppr(String(r));
  }, [wbState]);

  // ── 30-year equity timeline ──────────────────────────────────────────────
  const equityTimeline = useMemo(() => {
    const hp = parseFloat(purchasePrice) || 0;
    const la = parseFloat(loanAmount) || 0;
    const r = (parseFloat(wbRate) || 0) / 100 / 12;
    const n = (parseInt(wbTerm) || 30) * 12;
    const appr = (parseFloat(wbAppr) || 0) / 100;
    if (hp <= 0 || la <= 0 || r <= 0 || n <= 0) return [];
    const monthlyPI = pmt(r, n, la);
    let balance = la;
    const timeline = [];
    for (let y = 0; y < 30; y++) {
      for (let m = 0; m < 12 && balance > 0.005; m++) {
        const intPmt = balance * r;
        const prinPmt = Math.min(monthlyPI - intPmt, balance);
        balance = Math.max(0, balance - prinPmt);
      }
      const homeValue = hp * Math.pow(1 + appr, y + 1);
      const equity = homeValue - balance;
      timeline.push({ year: y + 1, homeValue, balance, equity, equityPct: homeValue > 0 ? equity / homeValue * 100 : 0 });
      if (balance <= 0.005) break;
    }
    return timeline;
  }, [purchasePrice, loanAmount, wbRate, wbTerm, wbAppr]);

  // ── Net worth: owner vs rent + invest ────────────────────────────────────
  const netWorthTimeline = useMemo(() => {
    const hp = parseFloat(purchasePrice) || 0;
    const la = parseFloat(loanAmount) || 0;
    const r = (parseFloat(wbRate) || 0) / 100 / 12;
    const n = (parseInt(wbTerm) || 30) * 12;
    const appr = (parseFloat(wbAppr) || 0) / 100;
    const mktR = (parseFloat(wbMarket) || 7) / 100 / 12;
    const rent0 = parseFloat(wbRent) || 0;
    const ptaxMo = hp * (parseFloat(wbPropTax) || 0) / 100 / 12;
    if (hp <= 0 || la <= 0 || r <= 0 || n <= 0) return [];
    const dp = hp - la;
    const monthlyPI = pmt(r, n, la);
    const totalOwnerMo = monthlyPI + ptaxMo;
    let balance = la;
    let renterPortfolio = dp; // invested down payment + monthly savings
    const timeline = [];
    for (let y = 0; y < 30; y++) {
      for (let m = 0; m < 12; m++) {
        if (balance > 0.005) {
          const intPmt = balance * r;
          const prinPmt = Math.min(monthlyPI - intPmt, balance);
          balance = Math.max(0, balance - prinPmt);
        }
        renterPortfolio = renterPortfolio * (1 + mktR) + Math.max(0, totalOwnerMo - rent0);
      }
      const homeValue = hp * Math.pow(1 + appr, y + 1);
      const ownerNetWorth = homeValue - balance - homeValue * 0.06; // after 6% selling costs
      timeline.push({ year: y + 1, ownerNetWorth, renterNetWorth: renterPortfolio });
    }
    return timeline;
  }, [purchasePrice, loanAmount, wbRate, wbTerm, wbAppr, wbMarket, wbRent, wbPropTax]);

  // ── Tax benefit estimates ─────────────────────────────────────────────────
  const taxBenefits = useMemo(() => {
    const la = parseFloat(loanAmount) || 0;
    const r = (parseFloat(wbRate) || 0) / 100 / 12;
    const n = (parseInt(wbTerm) || 30) * 12;
    const bracket = (parseFloat(wbBracket) || 22) / 100;
    const hp = parseFloat(purchasePrice) || 0;
    const ptaxAnnual = hp * (parseFloat(wbPropTax) || 0) / 100;
    if (la <= 0 || r <= 0 || n <= 0) return null;
    const monthlyPI = pmt(r, n, la);
    let balance = la;
    let firstYrInterest = 0;
    for (let m = 0; m < 12 && balance > 0.005; m++) {
      const intPmt = balance * r;
      firstYrInterest += intPmt;
      const prinPmt = Math.min(monthlyPI - intPmt, balance);
      balance = Math.max(0, balance - prinPmt);
    }
    const saltCap = 10000; // SALT deduction cap
    const deductiblePtax = Math.min(ptaxAnnual, saltCap);
    const mortgageDeduction = firstYrInterest * bracket;
    const ptaxDeduction = deductiblePtax * bracket;
    return { firstYrInterest, mortgageDeduction, ptaxDeduction, totalDeduction: mortgageDeduction + ptaxDeduction, bracket };
  }, [loanAmount, wbRate, wbTerm, wbBracket, purchasePrice, wbPropTax]);

  // ── Break-even year ───────────────────────────────────────────────────────
  const breakEvenYear = useMemo(() => {
    const beIdx = netWorthTimeline.findIndex(d => d.ownerNetWorth > d.renterNetWorth);
    return beIdx >= 0 ? beIdx + 1 : null;
  }, [netWorthTimeline]);

  // ── Key milestones ────────────────────────────────────────────────────────
  const eq20yr = equityTimeline.find(d => d.equityPct >= 20);
  const eqAtYr5 = equityTimeline[4];
  const eqAtYr10 = equityTimeline[9];
  const eqAtPayoff = equityTimeline[equityTimeline.length - 1];

  const navy = c.navy || COLORS.navy;
  const blue = c.blue || COLORS.blue;
  const green = c.green || COLORS.green;
  const gold = c.gold || COLORS.gold;
  const gray = c.gray || COLORS.gray;

  return (
    <div id="wb-content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── INPUTS ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* LEFT — Loan Inputs */}
        <SectionCard title="LOAN INPUTS" accent={navy}>
          <div style={{ fontSize: 10, color: gray, fontFamily: font, marginBottom: 6, fontStyle: "italic" }}>Synced from Payment Calculator</div>
          <LabeledInput label="Purchase Price" prefix="$" value={purchasePrice} onChange={setPurchasePrice} useCommas />
          <LabeledInput label="Loan Amount" prefix="$" value={loanAmount} onChange={setLoanAmount} useCommas />
          <LabeledInput label="Interest Rate" value={wbRate} onChange={setWbRate} suffix="%" />
          <LabeledInput label="Loan Term" value={wbTerm} onChange={setWbTerm} suffix="years" />
          <LabeledInput label="Monthly Rent (comparison)" prefix="$" value={wbRent} onChange={setWbRent} useCommas small />
        </SectionCard>

        {/* RIGHT — Appreciation & Returns */}
        <SectionCard title="APPRECIATION & ASSUMPTIONS" accent={green}>
          <Select label="State (auto-fills appreciation)" value={wbState} onChange={setWbState} options={STATE_LIST.map(s => ({ value: s.value, label: s.label }))} />
          {STATE_APPR_RATES[wbState] != null && (
            <div style={{ fontSize: 10, color: c.grayLight || COLORS.grayLight, fontFamily: font, marginTop: -4, marginBottom: 6, fontStyle: "italic" }}>
              * {wbState} FHFA avg ≈ {STATE_APPR_RATES[wbState]}%
            </div>
          )}
          <LabeledInput label="Appreciation Rate" value={wbAppr} onChange={setWbAppr} suffix="%" />
          <LabeledInput label="Market Return (renter invests DP)" value={wbMarket} onChange={setWbMarket} suffix="%" small hint="Default 7% (historical S&P avg)" />
          <LabeledInput label="Property Tax Rate" value={wbPropTax} onChange={setWbPropTax} suffix="% of value" small />
          <Select label="Federal Tax Bracket" value={wbBracket} onChange={setWbBracket} options={[
            { value: "12", label: "12%" }, { value: "22", label: "22%" },
            { value: "24", label: "24%" }, { value: "32", label: "32%" },
          ]} />
        </SectionCard>
      </div>

      {/* ── EQUITY TIMELINE ─────────────────────────────────────────────── */}
      {equityTimeline.length > 1 && (
        <SectionCard title="EQUITY TIMELINE — HOME VALUE vs LOAN BALANCE" accent={green}>
          <WbEquityChart timeline={equityTimeline} c={c} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            {[
              eq20yr && { label: `20% Equity`, sub: `Year ${eq20yr.year}`, val: fmt(Math.round(eq20yr.equity)), color: green },
              eqAtYr5 && { label: "Equity at Yr 5", sub: fmt(Math.round(eqAtYr5.homeValue)) + " value", val: fmt(Math.round(eqAtYr5.equity)), color: blue },
              eqAtYr10 && { label: "Equity at Yr 10", sub: fmt(Math.round(eqAtYr10.homeValue)) + " value", val: fmt(Math.round(eqAtYr10.equity)), color: blue },
              eqAtPayoff && { label: `Equity at Payoff (Yr ${eqAtPayoff.year})`, sub: fmt(Math.round(eqAtPayoff.homeValue)) + " value", val: fmt(Math.round(eqAtPayoff.equity)), color: navy },
            ].filter(Boolean).map((m, i) => (
              <div key={i} style={{ flex: "1 1 130px", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${m.color}33`, background: m.color + "0d" }}>
                <div style={{ fontSize: 10, color: gray, fontFamily: font, marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: font }}>{m.val}</div>
                <div style={{ fontSize: 10, color: gray, fontFamily: font, marginTop: 1 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── NET WORTH PROJECTION ─────────────────────────────────────────── */}
      {netWorthTimeline.length > 1 && (
        <SectionCard title="NET WORTH — OWN vs RENT + INVEST" accent={blue}>
          <WbNetWorthChart timeline={netWorthTimeline} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            {[5, 10, 20, 30].map(yr => {
              const d = netWorthTimeline[yr - 1];
              if (!d) return null;
              const ownerWins = d.ownerNetWorth > d.renterNetWorth;
              const diff = Math.abs(d.ownerNetWorth - d.renterNetWorth);
              return (
                <div key={yr} style={{ flex: "1 1 120px", padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border || COLORS.border}`, background: c.bg || "#fff" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: gray, fontFamily: font, marginBottom: 4, letterSpacing: "0.04em" }}>YEAR {yr}</div>
                  <div style={{ fontSize: 11, color: gray, fontFamily: font }}>Own:</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: green, fontFamily: font }}>{fmt(Math.round(d.ownerNetWorth))}</div>
                  <div style={{ fontSize: 11, color: gray, fontFamily: font, marginTop: 3 }}>Rent+Invest:</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: blue, fontFamily: font }}>{fmt(Math.round(d.renterNetWorth))}</div>
                  <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: ownerWins ? green : blue, fontFamily: font }}>
                    {ownerWins ? "🏠 +" : "📈 +"}{fmt(Math.round(diff))}
                  </div>
                </div>
              );
            })}
          </div>
          {breakEvenYear && (
            <div style={{ marginTop: 12, padding: "8px 14px", background: gold + "22", border: `1px solid ${gold}`, borderRadius: 8, fontSize: 12, fontWeight: 700, color: gold, fontFamily: font, textAlign: "center" }}>
              ⚖️ Break-even vs renting: Year {breakEvenYear} — total ownership cost (incl. opportunity cost) offset by equity + appreciation
            </div>
          )}
        </SectionCard>
      )}

      {/* ── TAX BENEFIT SUMMARY ──────────────────────────────────────────── */}
      {taxBenefits && (
        <SectionCard title="TAX BENEFIT SUMMARY (YEAR 1)" accent={gold}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${gold}33`, background: gold + "0d" }}>
              <div style={{ fontSize: 10, color: gray, fontFamily: font, marginBottom: 2 }}>Mortgage Interest (Yr 1)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: gold, fontFamily: font }}>{fmt(Math.round(taxBenefits.firstYrInterest))}</div>
              <div style={{ fontSize: 11, color: gray, fontFamily: font, marginTop: 2 }}>
                × {Math.round(taxBenefits.bracket * 100)}% bracket = <strong style={{ color: navy }}>{fmt(Math.round(taxBenefits.mortgageDeduction))} saved</strong>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${blue}33`, background: blue + "0d" }}>
              <div style={{ fontSize: 10, color: gray, fontFamily: font, marginBottom: 2 }}>Property Tax Deduction (SALT)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: blue, fontFamily: font }}>{fmt(Math.round(taxBenefits.ptaxDeduction))}</div>
              <div style={{ fontSize: 11, color: gray, fontFamily: font, marginTop: 2 }}>
                Capped at $10K SALT limit × {Math.round(taxBenefits.bracket * 100)}% bracket
              </div>
            </div>
          </div>
          <div style={{ padding: "10px 14px", background: navy + "12", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: navy, fontFamily: font }}>Total Est. Annual Tax Savings</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: navy, fontFamily: font }}>{fmt(Math.round(taxBenefits.totalDeduction))}</span>
          </div>
          <div style={{ fontSize: 10, color: gray, fontFamily: font, marginTop: 8, lineHeight: 1.5, fontStyle: "italic" }}>
            * Estimates only. Assumes itemized deductions exceed standard deduction ($29,200 MFJ / $14,600 single for 2024). Consult a tax advisor.
          </div>
        </SectionCard>
      )}

      {/* ── EXPORT ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          label="📄 Export to PDF"
          onClick={() => exportToPDF && exportToPDF("wb-content", "Wealth Builder Report")}
          color={navy}
        />
      </div>

    </div>
  );
}

window.WealthBuilder = WealthBuilder;
