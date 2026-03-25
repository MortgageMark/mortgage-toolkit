// modules/calculators/AmortizationSchedule.js
const { useState, useMemo, useEffect, useCallback } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const pmt = window.pmt;
const fmt = window.fmt;
const fmt2 = window.fmt2;
const MetricCard = window.MetricCard;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const Select = window.Select;
const Button = window.Button;
const Toggle = window.Toggle;
const DonutChart = window.DonutChart;
const COLORS = window.COLORS;
const font = window.font;

// Local comma helpers (addCommas/stripCommas are not exported from primitives)
function addCommasLocal(v) {
  const s = String(v).replace(/[^0-9.]/g, "");
  const [int, dec] = s.split(".");
  const formatted = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? formatted + "." + dec : formatted;
}
function stripCommasLocal(v) { return String(v).replace(/,/g, ""); }

const PRESET_TERMS = ["30", "20", "15", "10"];

// Build a full amortization schedule given params
function buildSchedule(la, r, n, extraMonthly, lumps) {
  const payment = pmt(r, n, la);
  let balance = la;
  const months = [];
  let totalInterest = 0;
  let totalPrincipal = 0;

  for (let m = 1; m <= n && balance > 0.005; m++) {
    const intPmt = balance * r;
    const lumpAmt = lumps
      .filter(l => parseInt(l.month) === m && parseFloat(l.amount) > 0)
      .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    let prinPmt = payment - intPmt + extraMonthly + lumpAmt;
    if (prinPmt > balance) prinPmt = balance;
    balance -= prinPmt;
    if (balance < 0) balance = 0;
    totalInterest += intPmt;
    totalPrincipal += prinPmt;
    months.push({
      month: m,
      payment: intPmt + prinPmt,
      principal: prinPmt,
      interest: intPmt,
      balance,
      totalInterest,
      totalPrincipal,
      lumpAmt,
    });
  }

  // Yearly aggregation
  const years = [];
  for (let y = 0; y < Math.ceil(months.length / 12); y++) {
    const slice = months.slice(y * 12, (y + 1) * 12);
    if (slice.length === 0) break;
    years.push({
      year: y + 1,
      principal: slice.reduce((s, m) => s + m.principal, 0),
      interest: slice.reduce((s, m) => s + m.interest, 0),
      totalPayment: slice.reduce((s, m) => s + m.payment, 0),
      endBalance: slice[slice.length - 1].balance,
      totalInterest: slice[slice.length - 1].totalInterest,
      totalPrincipal: slice[slice.length - 1].totalPrincipal,
    });
  }

  return { months, years, totalInterest, totalPrincipal, payment, actualMonths: months.length };
}

function fmtPayoff(totalMonths) {
  const yrs = Math.floor(totalMonths / 12);
  const mo = totalMonths % 12;
  if (mo === 0) return `${yrs} yr${yrs !== 1 ? "s" : ""}`;
  return `${yrs} yr${yrs !== 1 ? "s" : ""} ${mo} mo`;
}

function AmortizationSchedule() {
  const c = useThemeColors();

  // Shared keys with Payment Calculator — bidirectional sync via same key
  const [loanAmount, setLoanAmount] = useLocalStorage("pc_la", "350000");
  const [rate, setRate] = useLocalStorage("pc_rate", "6.75");
  const [term, setTerm] = useLocalStorage("pc_term", "30");

  // Amortization-specific extras
  const [extraPrincipal, setExtraPrincipal] = useLocalStorage("am_extra", "0");
  const [biWeekly, setBiWeekly] = useLocalStorage("am_biweekly", "false");
  const [lumpsRaw, setLumpsRaw] = useLocalStorage("am_lumps", "[]");
  const [viewMode, setViewMode] = useLocalStorage("am_view", "yearly");
  const [biwExtra, setBiwExtra] = useLocalStorage("biw_extra", "0");

  // Read Payment Calculator values (read-only — shared keys)
  const [pcHomePrice] = useLocalStorage("pc_hp", "400000");
  const [pcAppr] = useLocalStorage("pc_appr", "3.5");
  const [pcPurpose] = useLocalStorage("pc_purpose", "purchase");

  // Dispatch mtk_values_changed when loan params change so other tabs (SNS etc.) stay in sync
  useEffect(() => {
    window.dispatchEvent(new Event("mtk_values_changed"));
  }, [loanAmount, rate, term]);

  // Parse lump sums safely
  const lumps = useMemo(() => {
    try { return JSON.parse(lumpsRaw) || []; } catch { return []; }
  }, [lumpsRaw]);

  const addLump = useCallback(() => {
    if (lumps.length >= 5) return;
    setLumpsRaw(JSON.stringify([...lumps, { month: "", amount: "" }]));
  }, [lumps, setLumpsRaw]);

  const removeLump = useCallback((i) => {
    setLumpsRaw(JSON.stringify(lumps.filter((_, idx) => idx !== i)));
  }, [lumps, setLumpsRaw]);

  const updateLump = useCallback((i, field, val) => {
    const updated = lumps.map((l, idx) => idx === i ? { ...l, [field]: val } : l);
    setLumpsRaw(JSON.stringify(updated));
  }, [lumps, setLumpsRaw]);

  // Compute both schedules
  const { base, enhanced, savings } = useMemo(() => {
    const la = parseFloat(loanAmount) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseInt(term) || 30) * 12;
    const extraAmt = parseFloat(extraPrincipal) || 0;
    const isBiWeekly = biWeekly === "true";

    if (la <= 0 || r <= 0 || n <= 0) {
      const empty = { months: [], years: [], totalInterest: 0, totalPrincipal: 0, payment: 0, actualMonths: 0 };
      return { base: empty, enhanced: empty, savings: { savedInterest: 0, savedMonths: 0, hasExtras: false } };
    }

    const baseSched = buildSchedule(la, r, n, 0, []);
    const biWeeklyExtra = isBiWeekly ? baseSched.payment / 12 : 0;
    const effectiveExtra = extraAmt + biWeeklyExtra;
    const validLumps = lumps.filter(l => parseInt(l.month) > 0 && parseFloat(l.amount) > 0);
    const enhSched = buildSchedule(la, r, n, effectiveExtra, validLumps);

    const hasExtras = effectiveExtra > 0 || validLumps.length > 0;
    const savedInterest = hasExtras ? baseSched.totalInterest - enhSched.totalInterest : 0;
    const savedMonths = hasExtras ? baseSched.actualMonths - enhSched.actualMonths : 0;

    return { base: baseSched, enhanced: enhSched, savings: { savedInterest, savedMonths, hasExtras } };
  }, [loanAmount, rate, term, extraPrincipal, biWeekly, lumpsRaw]);

  // Bi-weekly comparison using same loan params (pc_la/pc_rate/pc_term)
  const biwCalc = useMemo(() => {
    const L = parseFloat(loanAmount) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseInt(term) || 30) * 12;
    const extra = parseFloat(extraPrincipal) || 0;
    if (L <= 0 || r <= 0 || n <= 0) return null;
    const monthlyPmt = r > 0 ? L * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : L / n;
    const biWeeklyPmt = monthlyPmt / 2;

    let balStd = L, totalIntStd = 0, moStd = 0;
    while (balStd > 0.01 && moStd < n + 12) {
      const intPmt = balStd * r;
      const prinPmt = Math.min(monthlyPmt - intPmt, balStd);
      totalIntStd += intPmt; balStd -= prinPmt; moStd++;
    }

    const rBi = (parseFloat(rate) || 0) / 100 / 26;
    let balBi = L, totalIntBi = 0, pmtsBi = 0;
    while (balBi > 0.01 && pmtsBi < n * 3) {
      const intPmt = balBi * rBi;
      const prinPmt = Math.min(biWeeklyPmt - intPmt, balBi);
      totalIntBi += intPmt; balBi -= prinPmt; pmtsBi++;
    }
    const biYears = pmtsBi / 26;

    let balExtra = L, totalIntExtra = 0, moExtra = 0;
    while (balExtra > 0.01 && moExtra < n + 12) {
      const intPmt = balExtra * r;
      const prinPmt = Math.min(monthlyPmt + extra - intPmt, balExtra);
      totalIntExtra += intPmt; balExtra -= prinPmt; moExtra++;
    }

    return {
      monthlyPmt, biWeeklyPmt,
      stdYears: moStd / 12, stdInterest: totalIntStd,
      biYears, biInterest: totalIntBi,
      extraYears: moExtra / 12, extraInterest: totalIntExtra,
      biSaved: totalIntStd - totalIntBi, biTimeSaved: moStd / 12 - biYears,
      extraSaved: totalIntStd - totalIntExtra,
    };
  }, [loanAmount, rate, term, extraPrincipal]);

  const hasExtras = savings.hasExtras;
  const data = viewMode === "yearly" ? enhanced.years : enhanced.months;

  // Table headers/rows
  const headers = viewMode === "yearly"
    ? ["Year", "Principal", "Extra", "Interest", "Total Paid", "End Balance", "Cumul. Interest", "Cumul. Principal", "Home Value"]
    : ["Month", "Payment", "Principal", "Extra", "Interest", "Balance", "Cumul. Interest", "Cumul. Principal", "Home Value"];

  const lumpMonthSet = useMemo(() => {
    const s = {};
    lumps.forEach(l => {
      const m = parseInt(l.month);
      const a = parseFloat(l.amount);
      if (m > 0 && a > 0) s[m] = (s[m] || 0) + a;
    });
    return s;
  }, [lumps]);

  const gold = c.gold || COLORS.gold || "#D4A017";
  const blue = c.blue || COLORS.blue;
  const green = c.green || COLORS.green;
  const red = c.red || COLORS.red;
  const navy = c.navy || COLORS.navy;
  const gray = c.gray || COLORS.gray;
  const text = c.text || navy;
  const bgAlt = c.bgAlt || c.blueLight || COLORS.blueLight || "#f0f4fa";
  const border = c.border || COLORS.border || "#dde3ef";

  return (
    <div>
      {/* ── METRIC CARDS ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <MetricCard label="Monthly P&I" value={fmt2(enhanced.payment)} large highlight />
        <MetricCard label="Total Interest" value={fmt(Math.round(enhanced.totalInterest))} />
        {hasExtras && <MetricCard label="Interest Saved" value={fmt(Math.round(savings.savedInterest))} sublabel={`${savings.savedMonths} months early`} />}
        <MetricCard label="Payoff" value={fmtPayoff(enhanced.actualMonths)} sublabel={`${enhanced.actualMonths} payments`} />
        {hasExtras && <MetricCard label="Months Saved" value={String(savings.savedMonths)} sublabel={fmtPayoff(base.actualMonths) + " → " + fmtPayoff(enhanced.actualMonths)} />}
      </div>

      {/* ── TWO-COLUMN INPUT GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* LEFT — Loan Summary (read-only reminder) */}
        <div style={{ background: bgAlt, border: `1.5px solid ${border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.06em", marginBottom: 10 }}>LOAN SUMMARY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Loan Amount", value: fmt(Math.round(parseFloat(loanAmount) || 0)) },
              { label: "Interest Rate", value: `${rate}%` },
              { label: "Loan Term", value: `${term} Years` },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: c.bg || "#fff", borderRadius: 8, border: `1px solid ${border}` }}>
                <span style={{ fontSize: 11, color: gray, fontFamily: font, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 15, color: navy, fontFamily: font, fontWeight: 800 }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: gray, fontFamily: font, marginTop: 10, textAlign: "center", fontStyle: "italic" }}>
            Editable in Payment Calculator
          </div>
        </div>

        {/* RIGHT — Extra Payments */}
        <SectionCard title="EXTRA PAYMENTS" accent={green}>
          <LabeledInput
            label="Extra Monthly Principal"
            prefix="$"
            value={extraPrincipal}
            onChange={setExtraPrincipal}
            useCommas
            info="Applied every month on top of your regular payment"
          />

          <div style={{ marginTop: 10 }}>
            <Toggle
              label="Bi-Weekly Payment"
              checked={biWeekly === "true"}
              onChange={v => setBiWeekly(v ? "true" : "false")}
            />
            <div style={{ fontSize: 11, color: gray, fontFamily: font, marginTop: -10, marginBottom: 8, paddingLeft: 50 }}>
              Adds ~1 extra payment/yr{enhanced.payment > 0 ? ` (${fmt2(enhanced.payment / 12)}/mo equiv.)` : ""}
            </div>
          </div>

          {/* Lump Sums */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.05em", marginBottom: 6 }}>
              ONE-TIME LUMP SUMS
            </div>
            {lumps.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <div style={{ flex: "0 0 90px" }}>
                  <input
                    type="number"
                    min="1"
                    max="360"
                    placeholder="Month #"
                    value={l.month}
                    onChange={e => updateLump(i, "month", e.target.value)}
                    style={{
                      width: "100%", padding: "6px 8px", borderRadius: 6,
                      border: `1px solid ${border}`, fontSize: 12, fontFamily: font,
                      background: c.bg || "#fff", color: text, outline: "none",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Amount $"
                    value={l.amount ? addCommasLocal(l.amount) : ""}
                    onChange={e => updateLump(i, "amount", stripCommasLocal(e.target.value))}
                    style={{
                      width: "100%", padding: "6px 8px", borderRadius: 6,
                      border: `1px solid ${border}`, fontSize: 12, fontFamily: font,
                      background: c.bg || "#fff", color: text, outline: "none",
                    }}
                  />
                </div>
                <button
                  onClick={() => removeLump(i)}
                  style={{
                    background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
                    padding: "5px 9px", cursor: "pointer", color: red, fontSize: 14, fontWeight: 700,
                    lineHeight: 1,
                  }}
                  title="Remove"
                >×</button>
              </div>
            ))}
            {lumps.length < 5 && (
              <Button
                label="+ Add Lump Sum"
                onClick={addLump}
                small
                color={gold}
              />
            )}
            {lumps.length === 5 && (
              <div style={{ fontSize: 11, color: gray, fontFamily: font }}>Maximum of 5 lump sums</div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── SAVINGS COMPARISON (only when extras active) ── */}
      {hasExtras && (
        <SectionCard title="SAVINGS COMPARISON" accent={gold}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: font }}>
              <thead>
                <tr>
                  {["", "Standard", "With Extras", "Saved"].map((h, i) => (
                    <th key={h} style={{
                      padding: "8px 12px", textAlign: i === 0 ? "left" : "right",
                      fontSize: 10, fontWeight: 700, color: gray,
                      background: bgAlt, borderBottom: `2px solid ${border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>Total Interest</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: red }}>{fmt(Math.round(base.totalInterest))}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: red }}>{fmt(Math.round(enhanced.totalInterest))}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700 }}>{fmt(Math.round(savings.savedInterest))}</td>
                </tr>
                <tr style={{ background: bgAlt }}>
                  <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>Payoff Period</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmtPayoff(base.actualMonths)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmtPayoff(enhanced.actualMonths)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700 }}>{savings.savedMonths} mo</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>Total Cost</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: navy }}>{fmt(Math.round(base.totalPrincipal + base.totalInterest))}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: navy }}>{fmt(Math.round(enhanced.totalPrincipal + enhanced.totalInterest))}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700 }}>{fmt(Math.round((base.totalPrincipal + base.totalInterest) - (enhanced.totalPrincipal + enhanced.totalInterest)))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── BI-WEEKLY COMPARISON ── */}
      {biwCalc && (
        <SectionCard title="BI-WEEKLY COMPARISON" accent={blue}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { label: "Standard Monthly", pmt: fmt2(biwCalc.monthlyPmt) + "/mo", years: biwCalc.stdYears.toFixed(1), interest: biwCalc.stdInterest, saved: 0, color: navy },
              { label: "Bi-Weekly", pmt: fmt2(biwCalc.biWeeklyPmt) + " / 2 wks", years: biwCalc.biYears.toFixed(1), interest: biwCalc.biInterest, saved: biwCalc.biSaved, color: green },
              { label: "Monthly + Extra", pmt: parseFloat(extraPrincipal) > 0 ? fmt2(biwCalc.monthlyPmt) + "/mo + " + fmt2(parseFloat(extraPrincipal)) : fmt2(biwCalc.monthlyPmt) + "/mo", years: biwCalc.extraYears.toFixed(1), interest: biwCalc.extraInterest, saved: biwCalc.extraSaved, color: blue },
            ].map((s, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 10, border: `2px solid ${s.color}33`, background: s.color + "09", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, fontFamily: font, marginBottom: 6, letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: font }}>{s.pmt}</div>
                <div style={{ fontSize: 11, color: gray, fontFamily: font, marginTop: 5 }}>Payoff: <strong>{s.years} yrs</strong></div>
                <div style={{ fontSize: 11, color: gray, fontFamily: font }}>Total Interest: <strong style={{ color: s.color }}>{fmt(Math.round(s.interest))}</strong></div>
                {s.saved > 0 && <div style={{ marginTop: 8, padding: "3px 8px", background: s.color + "22", borderRadius: 6, fontSize: 11, fontWeight: 700, color: s.color, fontFamily: font }}>Save {fmt(Math.round(s.saved))}</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 4, padding: "8px 12px", background: green + "18", borderRadius: 6, fontSize: 11, fontFamily: font }}>
            <span style={{ color: green, fontWeight: 700 }}>Bi-weekly saves {fmt(Math.round(biwCalc.biSaved))} </span>
            <span style={{ color: gray }}>and pays off {biwCalc.biTimeSaved.toFixed(1)} yrs early (26 half-payments/yr ≈ 13 full payments)</span>
          </div>
        </SectionCard>
      )}

      {/* ── VIEW TOGGLE (above table) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.05em" }}>VIEW:</div>
        {["yearly", "monthly"].map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "5px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: font,
              cursor: "pointer", transition: "all 0.15s",
              background: viewMode === mode ? navy : "transparent",
              color: viewMode === mode ? "#fff" : gray,
              border: `2px solid ${viewMode === mode ? navy : border}`,
            }}
          >
            {mode === "yearly" ? "Annual" : "Monthly"}
          </button>
        ))}
      </div>

      {/* ── HOME VALUE NOTE ── */}
      {parseFloat(pcHomePrice) > 0 && (
        <div style={{ fontSize: 11, color: gray, fontFamily: font, marginBottom: 8, padding: "7px 12px", background: bgAlt, borderRadius: 8, border: `1px solid ${border}` }}>
          <span style={{ fontWeight: 700, color: navy }}>Home Value</span> column starts at {fmt(Math.round(parseFloat(pcHomePrice)))} ({pcPurpose === "purchase" ? "purchase price" : "home value"} from Payment Calculator) and grows at <span style={{ fontWeight: 700, color: navy }}>{pcAppr}%/yr</span> — set in Payment Calculator.
        </div>
      )}

      {/* ── AMORTIZATION TABLE ── */}
      <SectionCard title={`AMORTIZATION — ${viewMode === "yearly" ? "ANNUAL" : "MONTHLY"}`} accent={navy}>
        <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
          {(() => {
            const hp = parseFloat(pcHomePrice) || 0;
            const apprRate = parseFloat(pcAppr) || 0;
            return (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: font }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    {headers.map(h => {
                      const isBalCol = h === "Balance" || h === "End Balance";
                      const isHvCol = h === "Home Value";
                      return (
                        <th key={h} style={{
                          padding: "10px 12px",
                          textAlign: h === headers[0] ? "left" : "right",
                          fontSize: 10, fontWeight: 700, color: gray,
                          background: isBalCol ? blue + "18" : isHvCol ? green + "18" : bgAlt,
                          borderBottom: `2px solid ${border}`,
                          borderLeft: (isBalCol || isHvCol) ? `2px solid ${border}` : undefined,
                          whiteSpace: "nowrap",
                        }}>{h}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const isMonthly = viewMode === "monthly";
                    const lumpAmt = isMonthly ? (lumpMonthSet[row.month] || 0) : 0;
                    const hasLump = lumpAmt > 0;
                    const rowBg = hasLump
                      ? gold + "22"
                      : i % 2 === 0 ? "transparent" : bgAlt;
                    const period = isMonthly ? row.month : row.year;
                    const homeVal = hp > 0
                      ? (isMonthly
                          ? hp * Math.pow(1 + apprRate / 100 / 12, period)
                          : hp * Math.pow(1 + apprRate / 100, period))
                      : 0;

                    // Extra column: sum of extra monthly principal + bi-weekly equiv + lump sums
                    const extraAmt = parseFloat(extraPrincipal) || 0;
                    const isBiWeekly = biWeekly === "true";
                    const biWeeklyEquiv = isBiWeekly ? (base.payment / 12) : 0;
                    const perMonthExtra = extraAmt + biWeeklyEquiv;
                    let rowExtra;
                    if (isMonthly) {
                      rowExtra = perMonthExtra + lumpAmt;
                    } else {
                      const yearLumps = Object.entries(lumpMonthSet)
                        .filter(([mo]) => Math.ceil(parseInt(mo) / 12) === row.year)
                        .reduce((s, [, amt]) => s + amt, 0);
                      const monthsThisYear = enhanced.months.slice((row.year - 1) * 12, row.year * 12).length;
                      rowExtra = perMonthExtra * monthsThisYear + yearLumps;
                    }

                    return (
                      <tr key={i} style={{ background: rowBg }}>
                        {/* Period (Year or Month) */}
                        <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {isMonthly ? row.month : row.year}
                            {hasLump && (
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: gold,
                                background: gold + "33", borderRadius: 4,
                                padding: "1px 5px", whiteSpace: "nowrap",
                              }}>
                                +{fmt2(lumpAmt)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Monthly-only: Payment column */}
                        {isMonthly && (
                          <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmt2(row.payment)}</td>
                        )}

                        {/* Principal */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 600 }}>
                          {fmt2(row.principal)}
                        </td>

                        {/* Extra */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: rowExtra > 0 ? gold : gray, fontWeight: rowExtra > 0 ? 700 : 400 }}>
                          {rowExtra > 0 ? fmt2(rowExtra) : "—"}
                        </td>

                        {/* Interest */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: red }}>
                          {fmt2(row.interest)}
                        </td>

                        {/* Yearly-only: Total Paid */}
                        {!isMonthly && (
                          <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmt2(row.totalPayment)}</td>
                        )}

                        {/* Balance — shaded as visual divider */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: text, fontWeight: 600, borderLeft: `2px solid ${border}`, background: blue + "0d" }}>
                          {fmt(Math.round(isMonthly ? row.balance : row.endBalance))}
                        </td>

                        {/* Cumul. Interest */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: gray }}>
                          {fmt(Math.round(row.totalInterest))}
                        </td>

                        {/* Cumul. Principal */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: green }}>
                          {fmt(Math.round(row.totalPrincipal))}
                        </td>

                        {/* Home Value — shaded green */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: navy, fontWeight: 600, borderLeft: `2px solid ${border}`, background: green + "0d" }}>
                          {hp > 0 ? fmt(Math.round(homeVal)) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      </SectionCard>
    </div>
  );
}

window.AmortizationSchedule = AmortizationSchedule;
