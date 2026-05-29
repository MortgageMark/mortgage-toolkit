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
const InfoTip = window.InfoTip;
const DonutChart = window.DonutChart;
const BalanceCurveChart = window.BalanceCurveChart;
const PIStackedBarChart = window.PIStackedBarChart;
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

  // Shared keys with Payment Calculator — read-only here; edit in Payment Calculator tab
  const [loanAmount] = useLocalStorage("pc_la", "350000");
  const [rate]       = useLocalStorage("pc_rate", "6.75");
  const [term]       = useLocalStorage("pc_term", "30");

  // Amortization-specific extras
  const [extraPrincipal, setExtraPrincipal] = useLocalStorage("am_extra", "0");
  const [extraEnabled, setExtraEnabled] = useLocalStorage("am_extra_enabled", "false");
  const [biWeekly, setBiWeekly] = useLocalStorage("am_biweekly", "false");
  const [lumpsRaw, setLumpsRaw] = useLocalStorage("am_lumps", "[]");
  const [lumpsEnabled, setLumpsEnabled] = useLocalStorage("am_lumps_enabled", "false");
  const [viewMode, setViewMode] = useLocalStorage("am_view", "monthly");
  const [biwExtra, setBiwExtra] = useLocalStorage("biw_extra", "0");
  const [lumpsTarget, setLumpsTarget] = useLocalStorage("am_lumps_target", "second");

  // Read Payment Calculator values (read-only — shared keys)
  const [pcHomePrice] = useLocalStorage("pc_hp", "400000");
  const [pcAppr] = useLocalStorage("pc_appr", "3.5");
  const [pcPurpose] = useLocalStorage("pc_purpose", "purchase");

  // 2nd lien reads (piggyback — from Payment Calculator)
  const [s2Enabled] = useLocalStorage("pc_2nd_enabled", "false");
  const [s2Mode]    = useLocalStorage("pc_2nd_mode",    "pct");
  const [s2Amt]     = useLocalStorage("pc_2nd_amt",     "");
  const [s2Rate]    = useLocalStorage("pc_2nd_rate",    "");
  const [s2Term]    = useLocalStorage("pc_2nd_term",    "20");

  // Derive 1st & 2nd lien amounts at component level (mirrors PaymentCalculator logic)
  const s2On = s2Enabled === "true";
  const s2LA = (() => {
    if (!s2On) return 0;
    const hp = parseFloat(pcHomePrice) || 0;
    return s2Mode === "pct"
      ? Math.round(hp * (parseFloat(s2Amt) || 0) / 100)
      : Math.round(parseFloat(s2Amt) || 0);
  })();
  const firstLienLA = s2On ? Math.max(0, (parseFloat(loanAmount) || 0) - s2LA) : (parseFloat(loanAmount) || 0);

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

  // Compute both schedules — uses firstLienLA so piggyback doesn't inflate the 1st-lien schedule
  const { base, enhanced, savings } = useMemo(() => {
    const la = firstLienLA; // 1st lien only (equals full loanAmount when no piggyback)
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseInt(term) || 30) * 12;
    // Respect toggle state — paused cards contribute $0 to calculations
    const extraAmt = extraEnabled === "true" ? (parseFloat(extraPrincipal) || 0) : 0;
    const isBiWeekly = biWeekly === "true";

    if (la <= 0 || r <= 0 || n <= 0) {
      const empty = { months: [], years: [], totalInterest: 0, totalPrincipal: 0, payment: 0, actualMonths: 0 };
      return { base: empty, enhanced: empty, savings: { savedInterest: 0, savedMonths: 0, hasExtras: false } };
    }

    const baseSched = buildSchedule(la, r, n, 0, []);
    const biWeeklyExtra = isBiWeekly ? baseSched.payment / 12 : 0;
    const effectiveExtra = extraAmt + biWeeklyExtra;
    const validLumps = lumpsEnabled === "true"
      ? lumps.filter(l => parseInt(l.month) > 0 && parseFloat(l.amount) > 0)
      : [];
    // Route lump sums to 2nd lien when recommended setting is active
    const firstLienLumps = (s2On && lumpsTarget === "second") ? [] : validLumps;
    const enhSched = buildSchedule(la, r, n, effectiveExtra, firstLienLumps);

    const hasExtras = effectiveExtra > 0 || firstLienLumps.length > 0;
    const savedInterest = hasExtras ? baseSched.totalInterest - enhSched.totalInterest : 0;
    const savedMonths = hasExtras ? baseSched.actualMonths - enhSched.actualMonths : 0;

    return { base: baseSched, enhanced: enhSched, savings: { savedInterest, savedMonths, hasExtras } };
  }, [firstLienLA, rate, term, extraPrincipal, extraEnabled, biWeekly, lumpsRaw, lumpsEnabled, lumpsTarget, s2On]);

  // Bi-weekly comparison — uses firstLienLA so piggyback is excluded
  const biwCalc = useMemo(() => {
    const L = firstLienLA;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseInt(term) || 30) * 12;
    const extra = extraEnabled === "true" ? (parseFloat(extraPrincipal) || 0) : 0;
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
  }, [firstLienLA, rate, term, extraPrincipal, extraEnabled]);

  // 2nd lien amortization schedule — applies lump sums here when routing is set to "second"
  const s2Sched = useMemo(() => {
    if (!s2On || s2LA <= 0) return null;
    const r2 = (parseFloat(s2Rate) || 0) / 100 / 12;
    const n2 = (parseInt(s2Term) || 20) * 12;
    if (r2 <= 0 || n2 <= 0) return null;
    // Respect toggle — paused lump sums don't apply to 2nd lien either
    const validLumps = lumpsEnabled === "true"
      ? lumps.filter(l => parseInt(l.month) > 0 && parseFloat(l.amount) > 0)
      : [];
    const s2Lumps = lumpsTarget === "second" ? validLumps : [];
    return buildSchedule(s2LA, r2, n2, 0, s2Lumps);
  }, [s2On, s2LA, s2Rate, s2Term, lumpsRaw, lumpsEnabled, lumpsTarget]);

  // Cascade strategy calculation — applies extra to 2nd lien until payoff, then redirects to 1st
  const cascadeCalc = useMemo(() => {
    if (!s2On || !s2Sched || firstLienLA <= 0) return null;
    const r1 = (parseFloat(rate) || 0) / 100 / 12;
    const n1 = (parseInt(term) || 30) * 12;
    const r2 = (parseFloat(s2Rate) || 0) / 100 / 12;
    const n2 = (parseInt(s2Term) || 20) * 12;
    const la1 = firstLienLA;
    const la2 = s2LA;
    // Respect toggle state in cascade simulation
    const extra = extraEnabled === "true" ? (parseFloat(extraPrincipal) || 0) : 0;
    if (r1 <= 0 || r2 <= 0 || la2 <= 0) return null;

    const pmt1 = la1 * r1 * Math.pow(1 + r1, n1) / (Math.pow(1 + r1, n1) - 1);
    const pmt2 = la2 * r2 * Math.pow(1 + r2, n2) / (Math.pow(1 + r2, n2) - 1);

    // Build per-month lump sum map for Phase 1 (2nd lien) when lump sums are routed there
    const lumpMap2 = {};
    if (lumpsTarget === "second" && lumpsEnabled === "true") {
      lumps.forEach(l => {
        const m = parseInt(l.month);
        const a = parseFloat(l.amount);
        if (m > 0 && a > 0) lumpMap2[m] = (lumpMap2[m] || 0) + a;
      });
    }
    const hasLumps = Object.keys(lumpMap2).length > 0;
    const totalLumpAmt = Object.values(lumpMap2).reduce((s, v) => s + v, 0);

    // Phase 1: run 2nd lien with extra + lump sums applied — find the payoff month
    let bal2 = la2, totalInt2 = 0, cascadeMonth = n2;
    for (let m = 1; m <= n2 && bal2 > 0.005; m++) {
      const int2 = bal2 * r2;
      const lumpAmt = lumpMap2[m] || 0;
      const prin2 = Math.min(pmt2 - int2 + extra + lumpAmt, bal2);
      bal2 -= prin2;
      if (bal2 < 0) bal2 = 0;
      totalInt2 += int2;
      if (bal2 <= 0.005) { cascadeMonth = m; break; }
    }

    // Phase 2: run 1st lien with no extra until cascadeMonth, then redirected = extra + pmt2
    const redirected = extra + pmt2;
    let bal1 = la1, totalInt1 = 0, payoff1 = n1;
    for (let m = 1; m <= n1 && bal1 > 0.005; m++) {
      const int1 = bal1 * r1;
      const addl = m > cascadeMonth ? redirected : 0;
      const prin1 = Math.min(pmt1 - int1 + addl, bal1);
      bal1 -= prin1;
      if (bal1 < 0) bal1 = 0;
      totalInt1 += int1;
      if (bal1 <= 0.005) { payoff1 = m; break; }
    }

    // "Current path" baseline: extra goes to 1st lien (enhanced), 2nd lien runs normally
    const baselineCombined = enhanced.totalInterest + s2Sched.totalInterest;
    const cascadeCombined  = totalInt2 + totalInt1;
    const savedInterest    = baselineCombined - cascadeCombined;

    return {
      cascadeMonth,               // month 2nd lien is paid off
      payoff1,                    // month 1st lien pays off after cascade
      savedInterest,              // total combined interest saved vs current path
      baselineCombined,           // combined interest — current path
      cascadeCombined,            // combined interest — cascade
      pmt2,                       // freed 2nd lien payment after payoff
      extra,                      // extra monthly entered in Card 2
      redirected,                 // total going to 1st lien in Phase 2
      baselinePayoff1: enhanced.actualMonths,    // 1st lien payoff — current path
      baseline2Payoff: s2Sched.actualMonths,     // 2nd lien payoff — current path
      hasLumps,                   // true when lump sums are concentrated on 2nd lien
      totalLumpAmt,               // total lump sum dollars applied to 2nd lien
    };
  }, [s2On, s2Sched, firstLienLA, rate, term, s2Rate, s2Term, s2LA, extraPrincipal, extraEnabled, enhanced, lumpsRaw, lumpsEnabled, lumpsTarget]);

  const hasExtras = savings.hasExtras;
  const data = viewMode === "yearly" ? enhanced.years : enhanced.months;

  // Example calc — computes $200/mo savings on the actual loan terms for educational text
  const exampleCalc = useMemo(() => {
    const la = firstLienLA;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseInt(term) || 30) * 12;
    if (la <= 0 || r <= 0 || n <= 0) return null;
    const baseSched = buildSchedule(la, r, n, 0, []);
    const exSched   = buildSchedule(la, r, n, 200, []);
    return {
      savedInterest: baseSched.totalInterest - exSched.totalInterest,
      savedMonths:   baseSched.actualMonths  - exSched.actualMonths,
    };
  }, [firstLienLA, rate, term]);

  // Table headers/rows
  const headers = viewMode === "yearly"
    ? ["Year", "Principal", "Extra", "Interest", "Total Paid", "End Balance", "Cumul. Interest", "Cumul. Principal", "Home Value", "Equity"]
    : ["Month", "Payment", "Principal", "Extra", "Interest", "Balance", "Cumul. Interest", "Cumul. Principal", "Home Value", "Equity"];

  const lumpMonthSet = useMemo(() => {
    if (lumpsEnabled !== "true") return {};
    const s = {};
    lumps.forEach(l => {
      const m = parseInt(l.month);
      const a = parseFloat(l.amount);
      if (m > 0 && a > 0) s[m] = (s[m] || 0) + a;
    });
    return s;
  }, [lumps, lumpsEnabled]);

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
      {/* ── CARDS 1–4: constrained width ── */}
      <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>

        {/* Card 1 — LOAN SUMMARY */}
        <SectionCard title="LOAN SUMMARY" accent={navy}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <MetricCard label="Monthly P&I" value={fmt2(enhanced.payment)} large highlight />
            <MetricCard label="Total Interest" value={fmt(Math.round(enhanced.totalInterest))} />
            <MetricCard label="Payoff" value={fmtPayoff(enhanced.actualMonths)} sublabel={`${enhanced.actualMonths} payments`} />
            {hasExtras
              ? <MetricCard label="Interest Saved" value={fmt(Math.round(savings.savedInterest))} sublabel={`${savings.savedMonths} mo early`} />
              : <MetricCard label="Total Cost" value={fmt(Math.round(enhanced.totalPrincipal + enhanced.totalInterest))} />
            }
          </div>

          {/* Loan Details strip — read-only */}
          <div style={{
            display: "flex", alignItems: "stretch",
            background: bgAlt, border: `1px solid ${border}`, borderRadius: 8,
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", padding: "10px 12px",
              background: navy + "0e", borderRight: `1px solid ${border}`, gap: 6, flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div>
                <div style={{ fontSize: 8, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>FROM</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: navy, fontFamily: font, whiteSpace: "nowrap" }}>PMT CALC</div>
              </div>
            </div>
            {[
              ...(s2On
                ? [
                    { label: "1st Lien", value: firstLienLA > 0 ? "$" + addCommasLocal(String(firstLienLA)) : "—" },
                    { label: "2nd Lien", value: s2LA > 0 ? "$" + addCommasLocal(String(s2LA)) : "—" },
                  ]
                : [{ label: "Loan Amount", value: loanAmount ? "$" + addCommasLocal(loanAmount) : "—" }]
              ),
              { label: "Rate", value: rate ? rate + "%" : "—" },
              { label: "Term", value: term ? term + " yrs" : "—" },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "10px 8px",
                borderRight: i < arr.length - 1 ? `1px solid ${border}` : "none",
              }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: gray, fontFamily: font, letterSpacing: "0.04em", marginBottom: 2, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: navy, fontFamily: font }}>{value}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Card 2 — EXTRA MONTHLY PAYMENTS */}
        <div data-sc-body style={{ background: c.bg || "#fff", borderRadius: 12, border: `1px solid ${border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div
            onClick={() => setExtraEnabled(extraEnabled === "true" ? "false" : "true")}
            style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderBottom: extraEnabled === "true" ? `1px solid ${border}` : "none" }}
          >
            <div style={{ width: 4, height: 18, borderRadius: 2, background: green, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: text, fontFamily: font }}>EXTRA MONTHLY PAYMENTS</div>
              {extraEnabled === "false" && parseFloat(extraPrincipal) > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: gray, fontFamily: font, background: border, borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {fmt(Math.round(parseFloat(extraPrincipal)))}/mo · paused
                </span>
              )}
            </div>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: extraEnabled === "true" ? blue : border, position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 2, left: extraEnabled === "true" ? 18 : 2 }} />
            </div>
          </div>
          {extraEnabled === "true" && (
            <div style={{ padding: 18 }}>
              <LabeledInput
                label="Extra Monthly Principal"
                prefix="$"
                value={extraPrincipal}
                onChange={setExtraPrincipal}
                useCommas
                info="Applied to principal every month on top of your regular payment"
                infoTip="Any additional principal you pay each month above the required payment. Even small extra payments applied directly to principal can shave years off your loan and save tens of thousands in interest. There is typically no prepayment penalty on conventional, FHA, VA, or USDA loans."
              />
              <div style={{ fontSize: 12, color: text, fontFamily: font, lineHeight: 1.7 }}>
                This section is for adding a <strong style={{ color: navy }}>consistent, recurring amount</strong> to your principal every single month, rather than a one-time or sporadic payment. Even a modest addition can have a dramatic effect over time. Every extra dollar applied to principal reduces the balance that interest is calculated on the following month, which in turn reduces the interest charged, which lets even more of your regular payment go to principal. That compounding benefit grows every year the loan is outstanding.
                <br /><br />
                {parseFloat(extraPrincipal) > 0 && savings.savedInterest > 0 ? (
                  <>
                    Adding <strong style={{ color: navy }}>{fmt2(parseFloat(extraPrincipal))}/month</strong> to your {fmt(Math.round(firstLienLA))} loan at {rate}% saves <strong style={{ color: navy }}>{fmt(Math.round(savings.savedInterest))}</strong> in interest and pays off <strong style={{ color: navy }}>{fmtPayoff(savings.savedMonths)} sooner</strong>, all without refinancing.
                  </>
                ) : exampleCalc ? (
                  <>
                    For example, adding <strong style={{ color: navy }}>$200/month</strong> to your {fmt(Math.round(firstLienLA))} loan at {rate}% would save <strong style={{ color: navy }}>{fmt(Math.round(exampleCalc.savedInterest))}</strong> in interest and pay off <strong style={{ color: navy }}>{fmtPayoff(exampleCalc.savedMonths)} sooner</strong>, all without refinancing.
                  </>
                ) : null}
              </div>
              {s2On && (
                <div style={{ marginTop: 14, padding: "11px 14px", background: gold + "18", borderRadius: 8, border: `1px solid ${gold}55`, fontSize: 12, color: text, fontFamily: font, lineHeight: 1.7 }}>
                  <strong style={{ color: gold }}>You have an active second lien on this loan.</strong> Before directing extra monthly payments toward your first mortgage, consider putting that money toward your second lien instead. Second liens typically carry a higher interest rate than first mortgages, which means every extra dollar applied there eliminates more interest overall. Once the second lien is paid off, those freed-up funds can be redirected to your first mortgage and accelerate your payoff even further.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 3 — ONE-TIME LUMP SUMS */}
        <div data-sc-body style={{ background: c.bg || "#fff", borderRadius: 12, border: `1px solid ${border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div
            onClick={() => setLumpsEnabled(lumpsEnabled === "true" ? "false" : "true")}
            style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderBottom: lumpsEnabled === "true" ? `1px solid ${border}` : "none" }}
          >
            <div style={{ width: 4, height: 18, borderRadius: 2, background: gold, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: text, fontFamily: font }}>ONE-TIME LUMP SUMS</div>
              {lumpsEnabled === "false" && (() => {
                const n = lumps.filter(l => parseInt(l.month) > 0 && parseFloat(l.amount) > 0).length;
                return n > 0 ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: gray, fontFamily: font, background: border, borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {n} lump sum{n > 1 ? "s" : ""} · paused
                  </span>
                ) : null;
              })()}
            </div>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: lumpsEnabled === "true" ? blue : border, position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 2, left: lumpsEnabled === "true" ? 18 : 2 }} />
            </div>
          </div>
          {lumpsEnabled === "true" && (
            <div style={{ padding: 18 }}>
              {lumps.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <div style={{ flex: "0 0 90px", fontSize: 10, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", paddingLeft: 2 }}>Month</div>
                  <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", paddingLeft: 2 }}>Amount</div>
                  <div style={{ width: 34 }} />{/* spacer for × button */}
                </div>
              )}
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
                        width: "100%", padding: "10px 12px", borderRadius: 8,
                        border: `1px solid ${border}`, fontSize: 15, fontFamily: font,
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
                        width: "100%", padding: "10px 12px", borderRadius: 8,
                        border: `1px solid ${border}`, fontSize: 15, fontFamily: font,
                        background: c.bg || "#fff", color: text, outline: "none",
                      }}
                    />
                  </div>
                  <button
                    onClick={() => removeLump(i)}
                    style={{
                      background: "transparent", border: `1px solid ${border}`, borderRadius: 8,
                      padding: "10px 11px", cursor: "pointer", color: red, fontSize: 15, fontWeight: 700,
                      lineHeight: 1,
                    }}
                    title="Remove"
                  >×</button>
                </div>
              ))}
              {lumps.length < 5 && (
                <Button label="+ Add Lump Sum" onClick={addLump} small color={gold} />
              )}
              {lumps.length === 5 && (
                <div style={{ fontSize: 12, color: gray, fontFamily: font, marginBottom: 14 }}>Maximum of 5 lump sums</div>
              )}

              {/* ── Lump sum routing selector (only when 2nd lien active) ── */}
              {s2On && (
                <div style={{ marginTop: 14, padding: "12px 14px", background: bgAlt, borderRadius: 8, border: `1px solid ${border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>Apply Lump Sums To</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[
                      { val: "second", label: "2nd Lien", sub: "Recommended" },
                      { val: "first",  label: "1st Mortgage", sub: "" },
                    ].map(opt => {
                      const isActive = lumpsTarget === opt.val;
                      const btnColor = opt.val === "second" ? "#f97316" : navy;
                      return (
                        <button key={opt.val} onClick={() => setLumpsTarget(opt.val)} style={{
                          flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                          border: `2px solid ${isActive ? btnColor : border}`,
                          background: isActive ? btnColor + "15" : "transparent",
                          fontFamily: font, textAlign: "center",
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? btnColor : gray }}>{opt.label}</div>
                          {opt.sub && <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? btnColor : gray }}>{opt.sub}</div>}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: gray, fontFamily: font, marginTop: 8, lineHeight: 1.5 }}>
                    {lumpsTarget === "second"
                      ? "✓ Lump sums are applied to the second lien (higher rate = more interest saved). The Piggyback Payoff Strategy card below shows your projected savings."
                      : "Lump sums will be applied directly to the first mortgage."}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: text, fontFamily: font, lineHeight: 1.7, marginTop: 14 }}>
                A lump sum payment is a <strong style={{ color: navy }}>one-time, isolated principal payment</strong> made at a specific point during your loan, rather than a recurring commitment. Common sources include a year-end bonus, a tax refund, an inheritance, or proceeds from a sale.
                <br /><br />
                Every dollar of a lump sum goes <strong style={{ color: navy }}>directly to principal</strong> on that payment date. This reduces your outstanding balance immediately, which lowers the interest that accrues from that month forward and shortens your remaining term.
                <br /><br />
                <strong>Important:</strong> a lump sum payment does <em>not</em> reduce your required monthly payment. Your scheduled payment stays the same and you simply pay the loan off sooner. If you would like your monthly payment to decrease after a large principal paydown, look into a <strong style={{ color: navy }}>mortgage recast</strong>. See the Recast tab for details.
              </div>
            </div>
          )}
        </div>

        {/* Card 4 — BI-WEEKLY PAYMENTS */}
        {biwCalc && (
          <div data-sc-body style={{ background: c.bg || "#fff", borderRadius: 12, border: `1px solid ${border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div
              onClick={() => setBiWeekly(biWeekly === "true" ? "false" : "true")}
              style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderBottom: biWeekly === "true" ? `1px solid ${border}` : "none" }}
            >
              <div style={{ width: 4, height: 18, borderRadius: 2, background: blue, flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: text, flex: 1, fontFamily: font }}>BI-WEEKLY PAYMENTS</div>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: biWeekly === "true" ? blue : border, position: "relative", flexShrink: 0 }}>
                <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 2, left: biWeekly === "true" ? 18 : 2 }} />
              </div>
            </div>
            {biWeekly === "true" && (
              <div style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: text, fontFamily: font, lineHeight: 1.7, marginBottom: 14 }}>
                  Instead of making one payment per month, a bi-weekly payment program has you make a half-payment every two weeks. Because there are 52 weeks in a year, that works out to <strong style={{ color: navy }}>26 half-payments, which is equivalent to 13 full monthly payments instead of 12</strong>. That one extra payment per year is applied entirely to principal, reducing your balance faster and saving a significant amount of interest over the life of the loan.
                </div>
                {s2On && (
                  <div style={{ marginBottom: 14, padding: "11px 14px", background: gold + "18", borderRadius: 8, border: `1px solid ${gold}55`, fontSize: 12, color: text, fontFamily: font, lineHeight: 1.7 }}>
                    <strong style={{ color: gold }}>You have an active second lien on this loan.</strong> Rather than setting up bi-weekly payments on your first mortgage, consider applying that equivalent extra amount toward your second lien each month. The second lien almost certainly carries a higher rate, so reducing it first is the more cost-effective strategy. Once the second lien is paid off, a bi-weekly program on the first mortgage becomes a much more impactful tool.
                  </div>
                )}
                {/* Servicer cost warning */}
                <div style={{ marginBottom: 14, padding: "12px 14px", background: "#fffbeb", borderRadius: 8, border: "1px solid #f59e0b55", fontSize: 12, color: "#92400e", fontFamily: font, lineHeight: 1.75 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Before enrolling, understand the costs:</div>
                  Most loan servicers charge a fee to administer a bi-weekly payment program. <strong>Setup fees typically range from $200 to $400</strong>, and many servicers also charge a <strong>per-transaction fee of $2 to $10 per payment</strong>. A small number of servicers offer the program at no charge. Always ask before signing up.
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f59e0b44" }}>
                    A simple and free alternative: make one extra principal-only payment on your own each year. You get the same payoff benefit without any enrollment fees.
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${border}`, margin: "16px 0" }} />
                {/* Comparison cards */}
                {(() => {
                  const showExtra = extraEnabled === "true" && parseFloat(extraPrincipal) > 0;
                  const cards = [
                    { label: "Standard Monthly", pmt: fmt2(biwCalc.monthlyPmt) + "/month", years: biwCalc.stdYears.toFixed(1), interest: biwCalc.stdInterest, saved: 0, color: navy },
                    { label: "Bi-Weekly", pmt: fmt2(biwCalc.biWeeklyPmt) + " every 2 weeks", years: biwCalc.biYears.toFixed(1), interest: biwCalc.biInterest, saved: biwCalc.biSaved, color: green },
                    ...(showExtra ? [{ label: "Monthly + Extra", pmt: fmt2(biwCalc.monthlyPmt) + "/month + " + fmt2(parseFloat(extraPrincipal)), years: biwCalc.extraYears.toFixed(1), interest: biwCalc.extraInterest, saved: biwCalc.extraSaved, color: blue }] : []),
                  ];
                  return (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 12, marginBottom: 12 }}>
                  {cards.map((s, i) => (
                    <div key={i} style={{ padding: 12, borderRadius: 10, border: `2px solid ${s.color}33`, background: s.color + "09", textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: s.color, fontFamily: font, marginBottom: 6, letterSpacing: "0.04em" }}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: font }}>{s.pmt}</div>
                      <div style={{ fontSize: 12, color: gray, fontFamily: font, marginTop: 5 }}>Payoff: <strong>{s.years} years</strong></div>
                      <div style={{ fontSize: 12, color: gray, fontFamily: font }}>Total Interest: <strong style={{ color: s.color }}>{fmt(Math.round(s.interest))}</strong></div>
                      {s.saved > 0 && <div style={{ marginTop: 8, padding: "3px 8px", background: s.color + "22", borderRadius: 6, fontSize: 12, fontWeight: 700, color: s.color, fontFamily: font }}>Save {fmt(Math.round(s.saved))}</div>}
                    </div>
                  ))}
                </div>
                  );
                })()}
                {/* Savings summary */}
                <div style={{ padding: "8px 12px", background: green + "18", borderRadius: 6, fontSize: 12, fontFamily: font }}>
                  <span style={{ color: green, fontWeight: 700 }}>Bi-weekly saves {fmt(Math.round(biwCalc.biSaved))} </span>
                  <span style={{ color: gray }}>and pays off {biwCalc.biTimeSaved.toFixed(1)} years early, based on 26 half-payments per year, equal to 13 full payments.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Card 5 — EXTRA PAYMENT IMPACT (only when extras active) */}
        {hasExtras && (
          <SectionCard title="EXTRA PAYMENT IMPACT" accent={gold}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: font }}>
                <thead>
                  <tr>
                    {["", "Standard", "With Extras", "Saved"].map((h, i) => (
                      <th key={h} style={{
                        padding: "8px 12px", textAlign: i === 0 ? "left" : "right",
                        fontSize: 12, fontWeight: 700, color: gray,
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

        {/* Card 6 — PIGGYBACK PAYOFF STRATEGY (only when 2nd lien active AND at least one extra payment card is on) */}
        {s2On && cascadeCalc && (extraEnabled === "true" || lumpsEnabled === "true" || biWeekly === "true") && (
          <SectionCard title="PIGGYBACK PAYOFF STRATEGY" accent="#f97316">

            {/* Intro */}
            <div style={{ fontSize: 12, color: text, fontFamily: font, lineHeight: 1.7, marginBottom: 16 }}>
              Because your second lien carries a higher interest rate than your first mortgage, every extra dollar you apply there eliminates more total interest. The most cost-effective strategy is a <strong style={{ color: navy }}>cascade</strong>: direct any extra payments toward the second lien until it is gone, then redirect that freed-up amount — plus your second lien payment — entirely toward your first mortgage.
              {cascadeCalc.extra === 0 && (
                <span> Even without adding anything extra, simply redirecting your freed second lien payment once it is paid off gives your first mortgage a meaningful boost.</span>
              )}
            </div>

            {/* Phase boxes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ padding: "12px 14px", background: "#f97316" + "12", border: "1px solid #f97316" + "44", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316", fontFamily: font, letterSpacing: "0.06em", marginBottom: 6 }}>PHASE 1 — PAY OFF 2ND LIEN</div>
                <div style={{ fontSize: 12, color: text, fontFamily: font, lineHeight: 1.6, marginBottom: 8 }}>
                  {cascadeCalc.extra > 0
                    ? `Apply your ${fmt2(cascadeCalc.extra)}/mo extra toward the second lien alongside your regular payment.`
                    : "Continue regular second lien payments."}
                  {cascadeCalc.hasLumps && (
                    <span> Lump sum payments ({fmt(Math.round(cascadeCalc.totalLumpAmt))} total) are also concentrated here first.</span>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f97316", fontFamily: font }}>
                  Paid off in {fmtPayoff(cascadeCalc.cascadeMonth)}
                </div>
                {cascadeCalc.cascadeMonth < cascadeCalc.baseline2Payoff && (
                  <div style={{ fontSize: 12, color: gray, fontFamily: font, marginTop: 2 }}>
                    {cascadeCalc.baseline2Payoff - cascadeCalc.cascadeMonth} months sooner than scheduled
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 14px", background: navy + "0e", border: `1px solid ${navy}33`, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: navy, fontFamily: font, letterSpacing: "0.06em", marginBottom: 6 }}>PHASE 2 — REDIRECT TO 1ST MORTGAGE</div>
                <div style={{ fontSize: 12, color: text, fontFamily: font, lineHeight: 1.6, marginBottom: 8 }}>
                  Redirect {fmt2(cascadeCalc.redirected)}/mo to the first mortgage
                  {cascadeCalc.extra > 0 ? ` (${fmt2(cascadeCalc.pmt2)} freed payment + ${fmt2(cascadeCalc.extra)} extra).` : "."}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: navy, fontFamily: font }}>
                  1st lien done in {fmtPayoff(cascadeCalc.payoff1)}
                </div>
              </div>
            </div>

            {/* Comparison table */}
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: font }}>
                <thead>
                  <tr>
                    {["", cascadeCalc.extra > 0 ? "Extra → 1st Lien" : "Normal Payments", "Cascade Strategy", "Saved"].map((h, i) => (
                      <th key={h} style={{
                        padding: "8px 12px", textAlign: i === 0 ? "left" : "right",
                        fontSize: 12, fontWeight: 700, color: gray,
                        background: bgAlt, borderBottom: `2px solid ${border}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>2nd Lien Payoff</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmtPayoff(cascadeCalc.baseline2Payoff)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#f97316", fontWeight: 700 }}>{fmtPayoff(cascadeCalc.cascadeMonth)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700 }}>
                      {cascadeCalc.baseline2Payoff > cascadeCalc.cascadeMonth ? `${cascadeCalc.baseline2Payoff - cascadeCalc.cascadeMonth} mo` : "—"}
                    </td>
                  </tr>
                  <tr style={{ background: bgAlt }}>
                    <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>1st Lien Payoff</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmtPayoff(cascadeCalc.baselinePayoff1)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: navy, fontWeight: 700 }}>{fmtPayoff(cascadeCalc.payoff1)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700 }}>
                      {cascadeCalc.baselinePayoff1 > cascadeCalc.payoff1 ? `${cascadeCalc.baselinePayoff1 - cascadeCalc.payoff1} mo` : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>Combined Interest</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: red }}>{fmt(Math.round(cascadeCalc.baselineCombined))}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: red }}>{fmt(Math.round(cascadeCalc.cascadeCombined))}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700 }}>{fmt(Math.round(cascadeCalc.savedInterest))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary pill */}
            {cascadeCalc.savedInterest > 0 && (
              <div style={{ padding: "8px 12px", background: green + "18", borderRadius: 6, fontSize: 12, fontFamily: font }}>
                <span style={{ color: green, fontWeight: 700 }}>Cascade saves {fmt(Math.round(cascadeCalc.savedInterest))} in combined interest </span>
                <span style={{ color: gray }}>across both loans compared to {cascadeCalc.extra > 0 ? "applying extra payments to the first mortgage" : "normal payments on both loans"}.</span>
              </div>
            )}

          </SectionCard>
        )}

      </div>

      {/* ── VIEW TOGGLE (above table) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: gray, fontFamily: font, letterSpacing: "0.05em" }}>VIEW:</div>
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
        <div style={{ fontSize: 12, color: gray, fontFamily: font, marginBottom: 8, padding: "7px 12px", background: bgAlt, borderRadius: 8, border: `1px solid ${border}` }}>
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
                      const isEqCol = h === "Equity";
                      return (
                        <th key={h} style={{
                          padding: "10px 12px",
                          textAlign: h === headers[0] ? "left" : "right",
                          fontSize: 12, fontWeight: 700, color: gray,
                          background: isBalCol ? blue + "18" : (isHvCol || isEqCol) ? green + "18" : bgAlt,
                          borderBottom: `2px solid ${border}`,
                          borderLeft: (isBalCol || isHvCol || isEqCol) ? `2px solid ${border}` : undefined,
                          whiteSpace: "nowrap",
                        }}>{h}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const isMonthly = viewMode === "monthly";
                    // Only highlight lump sum months in 1st lien table when lumps are routed here
                    const lumpAmt = (isMonthly && (!s2On || lumpsTarget === "first")) ? (lumpMonthSet[row.month] || 0) : 0;
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
                    const extraAmt = extraEnabled === "true" ? (parseFloat(extraPrincipal) || 0) : 0;
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
                                fontSize: 12, fontWeight: 700, color: gold,
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

                        {/* Equity — home value minus remaining balance */}
                        <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700, borderLeft: `2px solid ${border}`, background: green + "0d" }}>
                          {hp > 0 ? fmt(Math.round(homeVal - (isMonthly ? row.balance : row.endBalance))) : "—"}
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

      {/* ── 2ND LIEN SUMMARY + TABLE (immediately after 1st lien table) ── */}
      {s2On && s2Sched && (() => {
        const s2Data = viewMode === "yearly" ? s2Sched.years : s2Sched.months;
        const s2Headers = viewMode === "yearly"
          ? ["Year", "Principal", "Interest", "Total Paid", "End Balance", "Cumul. Interest", "Cumul. Principal", "Equity"]
          : ["Month", "Payment", "Principal", "Interest", "Balance", "Cumul. Interest", "Cumul. Principal", "Equity"];
        return (
          <>
            {/* 2nd Lien Summary Card */}
            <SectionCard title="2ND LIEN SUMMARY" accent="#f97316">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                <MetricCard label="2nd Lien P&I" value={fmt2(s2Sched.payment)} large highlight />
                <MetricCard label="Loan Amount" value={fmt(s2LA)} />
                <MetricCard label="Total Interest" value={fmt(Math.round(s2Sched.totalInterest))} />
                <MetricCard label="Payoff" value={fmtPayoff(s2Sched.actualMonths)} sublabel={`${s2Sched.actualMonths} payments`} />
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "10px 14px", background: navy + "0d", border: `1px solid ${navy}33`, borderRadius: 8, fontSize: 12, fontFamily: font }}>
                <span><span style={{ color: gray }}>Rate: </span><strong style={{ color: navy }}>{s2Rate || "—"}%</strong></span>
                <span><span style={{ color: gray }}>Term: </span><strong style={{ color: navy }}>{s2Term || 20} Years</strong></span>
                <span><span style={{ color: gray }}>Balance: </span><strong style={{ color: navy }}>{fmt(s2LA)}</strong></span>
                <span><span style={{ color: gray }}>Monthly P&I: </span><strong style={{ color: "#f97316" }}>{fmt2(s2Sched.payment)}</strong></span>
                <span><span style={{ color: gray }}>Total Interest: </span><strong style={{ color: red }}>{fmt(Math.round(s2Sched.totalInterest))}</strong></span>
              </div>
            </SectionCard>

            {/* 2nd Lien Amortization Table */}
            <SectionCard title={`2ND LIEN AMORTIZATION — ${viewMode === "yearly" ? "ANNUAL" : "MONTHLY"}`} accent={navy}>
              <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: font }}>
                  <thead>
                    <tr style={{ position: "sticky", top: 0, zIndex: 1 }}>
                      {s2Headers.map(h => {
                        const isBalCol = h === "Balance" || h === "End Balance";
                        const isEqCol  = h === "Equity";
                        return (
                          <th key={h} style={{
                            padding: "10px 12px",
                            textAlign: h === s2Headers[0] ? "left" : "right",
                            fontSize: 12, fontWeight: 700, color: gray,
                            background: isBalCol ? blue + "18" : isEqCol ? green + "18" : bgAlt,
                            borderBottom: `2px solid ${border}`,
                            borderLeft: (isBalCol || isEqCol) ? `2px solid ${border}` : undefined,
                            whiteSpace: "nowrap",
                          }}>{h}</th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {s2Data.map((row, i) => {
                      const isMonthly = viewMode === "monthly";
                      // Highlight lump sum months in 2nd lien table when lumps are routed here
                      const s2LumpAmt = (isMonthly && lumpsTarget === "second") ? (lumpMonthSet[row.month] || 0) : 0;
                      const s2HasLump = s2LumpAmt > 0;
                      const rowBg = s2HasLump ? gold + "22" : (i % 2 === 0 ? "transparent" : bgAlt);
                      return (
                        <tr key={i} style={{ background: rowBg }}>
                          <td style={{ padding: "8px 12px", color: text, fontWeight: 600 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isMonthly ? row.month : row.year}
                              {s2HasLump && (
                                <span style={{
                                  fontSize: 12, fontWeight: 700, color: gold,
                                  background: gold + "33", borderRadius: 4,
                                  padding: "1px 5px", whiteSpace: "nowrap",
                                }}>+{fmt2(s2LumpAmt)}</span>
                              )}
                            </div>
                          </td>
                          {isMonthly && <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmt2(row.payment)}</td>}
                          <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 600 }}>{fmt2(row.principal)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: red }}>{fmt2(row.interest)}</td>
                          {!isMonthly && <td style={{ padding: "8px 12px", textAlign: "right", color: text }}>{fmt2(row.totalPayment)}</td>}
                          <td style={{ padding: "8px 12px", textAlign: "right", color: text, fontWeight: 600, borderLeft: `2px solid ${border}`, background: blue + "0d" }}>
                            {fmt(Math.round(isMonthly ? row.balance : row.endBalance))}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: gray }}>{fmt(Math.round(row.totalInterest))}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: green }}>{fmt(Math.round(row.totalPrincipal))}</td>
                          {/* Equity — original 2nd lien balance minus current balance */}
                          <td style={{ padding: "8px 12px", textAlign: "right", color: green, fontWeight: 700, borderLeft: `2px solid ${border}`, background: green + "0d" }}>
                            {fmt(Math.round(s2LA - (isMonthly ? row.balance : row.endBalance)))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        );
      })()}

      {/* ── LOAN VISUALIZATIONS — side-by-side when 2nd lien active ── */}
      <SectionCard title="BALANCE OVER TIME" accent={navy} style={{ maxWidth: 700 }}>
        <div style={{ display: "grid", gridTemplateColumns: s2On && s2Sched ? "1fr 1fr" : "1fr", gap: 20 }}>
          <div>
            {s2On && s2Sched && (
              <div style={{ fontSize: 10, fontWeight: 700, color: navy, fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${navy}33` }}>1st Lien</div>
            )}
            <BalanceCurveChart years={enhanced.years} />
          </div>
          {s2On && s2Sched && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316", fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #f9731633" }}>2nd Lien</div>
              <BalanceCurveChart years={s2Sched.years} />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="PRINCIPAL vs INTEREST BY YEAR" accent={navy} style={{ maxWidth: 700 }}>
        <div style={{ display: "grid", gridTemplateColumns: s2On && s2Sched ? "1fr 1fr" : "1fr", gap: 20 }}>
          <div>
            {s2On && s2Sched && (
              <div style={{ fontSize: 10, fontWeight: 700, color: navy, fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${navy}33` }}>1st Lien</div>
            )}
            <PIStackedBarChart years={enhanced.years} />
          </div>
          {s2On && s2Sched && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316", fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, paddingBottom: 6, borderBottom: "2px solid #f9731633" }}>2nd Lien</div>
              <PIStackedBarChart years={s2Sched.years} />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="TOTAL COST BREAKDOWN" accent={navy} style={{ maxWidth: 700 }}>
        <div style={{ display: "grid", gridTemplateColumns: s2On && s2Sched ? "1fr 1fr" : "1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {s2On && s2Sched && (
              <div style={{ fontSize: 10, fontWeight: 700, color: navy, fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", paddingBottom: 6, borderBottom: `2px solid ${navy}33`, width: "100%", textAlign: "center" }}>1st Lien</div>
            )}
            <DonutChart
              data={[
                { value: Math.round(enhanced.totalPrincipal), color: green },
                { value: Math.round(enhanced.totalInterest), color: red },
                ...(savings.hasExtras ? [{ value: Math.round(savings.savedInterest), color: gold }] : []),
              ]}
              size={160}
              thickness={32}
              centerLabel="Total Cost"
              centerValue={fmt(Math.round(enhanced.totalPrincipal + enhanced.totalInterest))}
            />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", fontSize: 12, fontFamily: font }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: green }} />
                <span style={{ color: gray }}>Principal <strong style={{ color: text }}>{fmt(Math.round(enhanced.totalPrincipal))}</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: red }} />
                <span style={{ color: gray }}>Interest <strong style={{ color: text }}>{fmt(Math.round(enhanced.totalInterest))}</strong></span>
              </div>
              {savings.hasExtras && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: gold }} />
                  <span style={{ color: gray }}>Saved <strong style={{ color: gold }}>{fmt(Math.round(savings.savedInterest))}</strong></span>
                </div>
              )}
            </div>
          </div>
          {s2On && s2Sched && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#f97316", fontFamily: font, letterSpacing: "0.06em", textTransform: "uppercase", paddingBottom: 6, borderBottom: "2px solid #f9731633", width: "100%", textAlign: "center" }}>2nd Lien</div>
              <DonutChart
                data={[
                  { value: Math.round(s2Sched.totalPrincipal), color: green },
                  { value: Math.round(s2Sched.totalInterest),  color: red   },
                ]}
                size={160}
                thickness={32}
                centerLabel="Total Cost"
                centerValue={fmt(Math.round(s2Sched.totalPrincipal + s2Sched.totalInterest))}
              />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", fontSize: 12, fontFamily: font }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: green }} />
                  <span style={{ color: gray }}>Principal <strong style={{ color: text }}>{fmt(Math.round(s2Sched.totalPrincipal))}</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: red }} />
                  <span style={{ color: gray }}>Interest <strong style={{ color: text }}>{fmt(Math.round(s2Sched.totalInterest))}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── COMBINED TOTALS (only when piggyback active) ── */}
      {s2On && s2Sched && (() => {
        const combinedLA       = firstLienLA + s2LA;
        const combinedPI       = enhanced.payment + s2Sched.payment;
        const combinedInterest = enhanced.totalInterest + s2Sched.totalInterest;
        const combinedCost     = combinedLA + combinedInterest;
        const col1 = navy;
        const col2 = "#f97316"; // orange — 2nd lien brand color
        const colC = blue;

        const rows = [
          {
            label: "Loan Balance",
            v1: fmt(firstLienLA),
            v2: fmt(s2LA),
            vc: fmt(combinedLA),
            c1: col1, c2: col2, cc: colC,
          },
          {
            label: "Monthly P&I",
            v1: fmt2(enhanced.payment),
            v2: fmt2(s2Sched.payment),
            vc: fmt2(combinedPI),
            c1: col1, c2: col2, cc: colC,
            highlight: true,
          },
          {
            label: "Payoff Period",
            v1: fmtPayoff(enhanced.actualMonths),
            v2: fmtPayoff(s2Sched.actualMonths),
            vc: fmtPayoff(Math.max(enhanced.actualMonths, s2Sched.actualMonths)),
            c1: gray, c2: gray, cc: gray,
          },
          {
            label: "Total Interest Paid",
            v1: fmt(Math.round(enhanced.totalInterest)),
            v2: fmt(Math.round(s2Sched.totalInterest)),
            vc: fmt(Math.round(combinedInterest)),
            c1: red, c2: red, cc: red,
          },
          {
            label: "Total Cost (P+I)",
            v1: fmt(Math.round(firstLienLA + enhanced.totalInterest)),
            v2: fmt(Math.round(s2LA + s2Sched.totalInterest)),
            vc: fmt(Math.round(combinedCost)),
            c1: col1, c2: col2, cc: colC,
            bold: true,
          },
        ];

        return (
          <SectionCard title="COMBINED TOTALS — 1ST & 2ND LIEN" accent={navy}>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, marginBottom: 4 }}>
              <div />
              {[
                { label: "1st Lien", color: col1 },
                { label: "2nd Lien", color: col2 },
                { label: "Combined", color: colC },
              ].map(({ label, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "6px 4px", fontSize: 10, fontWeight: 700, color, fontFamily: font, letterSpacing: "0.06em", borderBottom: `2px solid ${color}44` }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {rows.map((row, i) => (
              <div key={row.label} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 0,
                background: i % 2 === 0 ? "transparent" : bgAlt,
                borderRadius: 6,
                padding: "2px 0",
              }}>
                <div style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: gray, fontFamily: font }}>
                  {row.label}
                </div>
                {[
                  { val: row.v1, color: row.c1 },
                  { val: row.v2, color: row.c2 },
                  { val: row.vc, color: row.cc, isCombined: true },
                ].map(({ val, color, isCombined }, ci) => (
                  <div key={ci} style={{
                    padding: "10px 8px",
                    textAlign: "center",
                    fontSize: row.highlight ? 15 : row.bold ? 13 : 12,
                    fontWeight: (row.highlight || row.bold || isCombined) ? 800 : 600,
                    color,
                    fontFamily: font,
                    background: isCombined ? color + "08" : "transparent",
                    borderLeft: isCombined ? `2px solid ${color}33` : undefined,
                  }}>
                    {val}
                  </div>
                ))}
              </div>
            ))}
          </SectionCard>
        );
      })()}

    </div>
  );
}

window.AmortizationSchedule = AmortizationSchedule;
