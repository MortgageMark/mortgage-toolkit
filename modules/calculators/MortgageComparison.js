// modules/calculators/MortgageComparison.js
const { useMemo, useEffect } = React;
const useLocalStorage = window.useLocalStorage;
const COLORS          = window.COLORS;
const font            = window.font;
const pmt             = window.pmt;
const calcAPR         = window.calcAPR;
const fmt             = window.fmt;
const fmt2            = window.fmt2;
const getStateFees    = window.getStateFees;
const SectionCard     = window.SectionCard;
const LabeledInput    = window.LabeledInput;
const Select          = window.Select;
const MetricCard      = window.MetricCard;
const exportToPDF     = window.exportToPDF;
const exportToExcel   = window.exportToExcel;

const PRESET_TERMS_MC = ["30", "20", "15"];

// X/Y format: each number = % rate reduction for that year
const TEMP_BD_SCHEDULES = {
  "3/2/1": [3, 2, 1],
  "2/1":   [2, 1],
  "1/1":   [1, 1],
  "1/0":   [1],
};

// Default scenarios — start at zero/blank so fresh scenarios show empty fields.
// Once the user enters values in Payment Calculator the useEffect below syncs Scenario A.
function getDefaultScenarios() {
  const tryLS = (k) => { try { const v = localStorage.getItem("mtk_" + k); return v !== null ? JSON.parse(v) : ""; } catch { return ""; } };
  const hp   = tryLS("pc_hp")   || "";
  const rate = tryLS("pc_rate") || "";
  const term = tryLS("pc_term") || "30";
  const dp   = tryLS("pc_dp")   || "20";
  const base = { points: "0", sellerConc: "0", bdType: "none", bdPermRate: "", bdPermCost: "", bdPermCostMode: "pct", bdTempType: "2/1" };
  return [
    { ...base, id: 1, label: "Scenario A", hp, downPct: dp, rate, term, color: COLORS.navy  },
    { ...base, id: 2, label: "Scenario B", hp: "", downPct: "20", rate: "", term: "30", color: COLORS.blue  },
    { ...base, id: 3, label: "Scenario C", hp: "", downPct: "20", rate: "", term: "30", color: "#E07B2A" },
  ];
}

function MortgageComparison() {

  // ── Payment Calculator bidirectional sync (Scenario A shares pc_* keys) ──
  const [pcHp,   setPcHp]   = useLocalStorage("pc_hp",   "437500");
  const [pcRate, setPcRate] = useLocalStorage("pc_rate", "6.75");
  const [pcTerm, setPcTerm] = useLocalStorage("pc_term", "30");
  const [pcDp,   setPcDp]   = useLocalStorage("pc_dp",   "20");

  const [pcLa]    = useLocalStorage("pc_la",    "350000");
  const [pcState] = useLocalStorage("pc_state", "TX");

  const [scenarios, setScenarios] = useLocalStorage("mc_sc", getDefaultScenarios());

  // ── Fee Sheet keys (read-only — pulled for closing cost estimates) ──
  const [fsState]      = useLocalStorage("fs_state",        "TX");
  const [fsClosingDate]= useLocalStorage("fs_closing_date", "");
  const [fsMt]         = useLocalStorage("fs_mt",           "625");
  const [fsMi]         = useLocalStorage("fs_mi",           "200");
  const [fsEsc]        = useLocalStorage("fs_esc",          true);
  const [fsSv]         = useLocalStorage("fs_sv",           true);
  const [fsOrigPct]    = useLocalStorage("fs_op",           "1.0");
  const [fsOvUw]       = useLocalStorage("fs_ov_uw",        "");
  const [fsDefUw]      = useLocalStorage("fs_def_uw",       "");
  const [fsOvProc]     = useLocalStorage("fs_ov_proc",      "");
  const [fsDefProc]    = useLocalStorage("fs_def_proc",     "");
  const [fsOvAppr]     = useLocalStorage("fs_ov_appr",      "");
  const [fsDefAppr]    = useLocalStorage("fs_def_appr",     "");
  const [fsOvCr]       = useLocalStorage("fs_ov_cr",        "");
  const [fsDefCr]      = useLocalStorage("fs_def_cr",       "");
  const [fsOvFlood]    = useLocalStorage("fs_ov_flood",     "");
  const [fsDefFlood]   = useLocalStorage("fs_def_flood",    "");
  const [fsOvTaxsvc]   = useLocalStorage("fs_ov_taxsvc",    "");
  const [fsDefTaxsvc]  = useLocalStorage("fs_def_taxsvc",   "");
  const [fsOvDocprep]  = useLocalStorage("fs_ov_docprep",   "");
  const [fsDefDocprep] = useLocalStorage("fs_def_docprep",  "");
  const [fsOvSurvey]   = useLocalStorage("fs_ov_survey",    "");
  const [fsDefSurvey]  = useLocalStorage("fs_def_survey",   "");
  const [fsOvEscfee]   = useLocalStorage("fs_ov_escfee",    "");
  const [fsDefEscrow]  = useLocalStorage("fs_def_escrow",   "");
  const [fsOvTsrch]    = useLocalStorage("fs_ov_tsrch",     "");
  const [fsDefTitle]   = useLocalStorage("fs_def_title",    "");

  // ── PC → Scenario A (push PC values into Scenario A) ──
  useEffect(() => {
    setScenarios(prev => {
      const a = prev.find(s => s.id === 1);
      if (!a) return prev;
      if (a.hp === pcHp && a.rate === pcRate && a.term === pcTerm && a.downPct === pcDp) return prev;
      return prev.map(s => s.id === 1 ? { ...s, hp: pcHp, rate: pcRate, term: pcTerm, downPct: pcDp } : s);
    });
  }, [pcHp, pcRate, pcTerm, pcDp]);

  // ── One-time migration: fix Scenario C color if still stored as green ──
  useEffect(() => {
    setScenarios(prev => {
      const c = prev.find(s => s.id === 3);
      if (!c || c.color === "#E07B2A") return prev;
      return prev.map(s => s.id === 3 ? { ...s, color: "#E07B2A" } : s);
    });
  }, []);

  // Update a field; Scenario A also writes back to pc_* keys
  const updateScenario = (id, field, value) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    if (id === 1) {
      if (field === "hp")      setPcHp(value);
      if (field === "rate")    setPcRate(value);
      if (field === "term")    setPcTerm(value);
      if (field === "downPct") setPcDp(value);
    }
  };

  // Reset a scenario's core fields back to current Payment Calculator values
  const resetScenarioToPC = (id) => {
    setScenarios(prev => prev.map(s =>
      s.id === id ? { ...s, hp: pcHp, rate: pcRate, term: pcTerm, downPct: pcDp } : s
    ));
  };

  // ── Fee sheet fixed values (not per-loan) ──
  // Uses same ov/def logic as FeeSheetGenerator. Discount points are EXCLUDED
  // since each scenario has its own "points" field.
  const fsHelpers = useMemo(() => {
    const st  = getStateFees(fsState);
    const ov  = (val, fb)  => { const n = parseFloat(val);    return (val    !== "" && !isNaN(n)) ? n : fb; };
    const def = (cust, hd) => { const n = parseFloat(cust);   return (cust   !== "" && !isNaN(n)) ? n : hd; };

    const underwriting  = ov(fsOvUw,      def(fsDefUw,      1000));
    const processingFee = ov(fsOvProc,    def(fsDefProc,    595));
    const appraisal     = ov(fsOvAppr,    def(fsDefAppr,    750));
    const creditReport  = ov(fsOvCr,      def(fsDefCr,      350));
    const floodCert     = ov(fsOvFlood,   def(fsDefFlood,   st.floodCert     || 14));
    const taxService    = ov(fsOvTaxsvc,  def(fsDefTaxsvc,  st.taxServiceFee || 85));
    const docPrep       = ov(fsOvDocprep, def(fsDefDocprep, 250));
    const survey        = fsSv ? ov(fsOvSurvey, def(fsDefSurvey, st.surveyFee || 450)) : 0;
    // Sum of fees that do NOT change per scenario loan amount
    const fixedThirdParty = appraisal + creditReport + floodCert + taxService + docPrep + survey;
    // APR finance charges (fixed portion — origination/discount added per scenario)
    const aprFixedFees = floodCert + taxService + docPrep;

    // Prepaid interest days from Fee Sheet closing date
    const today     = new Date();
    const defaultCD = `${today.getFullYear()}-${String(today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2).padStart(2, "0")}-15`;
    const cdStr     = fsClosingDate || defaultCD;
    const [cdY, cdM, cdD] = cdStr.split("-").map(Number);
    const cdYear    = cdY || today.getFullYear();
    const cdMonth   = cdM || (today.getMonth() + 2);
    const cdDay     = cdD || 15;
    const daysInMo  = new Date(cdYear, cdMonth, 0).getDate();
    const prepaidDays = Math.max(1, daysInMo - cdDay + 1);

    // Insurance/tax-based prepaids (same across all scenarios)
    const mIns = parseFloat(fsMi) || 0;
    const mTax = parseFloat(fsMt) || 0;
    const homeownersInsAmt = Math.round(mIns * 12);          // 12-mo premium
    const taxRes = fsEsc ? Math.round(mTax * 3) : 0;         // 3-mo tax reserves
    const insRes = fsEsc ? Math.round(mIns * 3) : 0;         // 3-mo ins reserves
    const fixedPrepaids = homeownersInsAmt + taxRes + insRes; // prepaid interest added per-loan

    return { st, underwriting, processingFee, fixedThirdParty, aprFixedFees, prepaidDays, fixedPrepaids };
  }, [fsState, fsClosingDate, fsMt, fsMi, fsEsc, fsSv,
      fsOvUw, fsDefUw, fsOvProc, fsDefProc, fsOvAppr, fsDefAppr,
      fsOvCr, fsDefCr, fsOvFlood, fsDefFlood, fsOvTaxsvc, fsDefTaxsvc,
      fsOvDocprep, fsDefDocprep, fsOvSurvey, fsDefSurvey]);

  // ── Core scenario math + closing cost estimates ──
  const analyses = useMemo(() => {
    const { st, underwriting, processingFee, fixedThirdParty, aprFixedFees, prepaidDays, fixedPrepaids } = fsHelpers;
    const ov  = (val, fb)  => { const n = parseFloat(val);  return (val  !== "" && !isNaN(n)) ? n : fb; };
    const def = (cust, hd) => { const n = parseFloat(cust); return (cust !== "" && !isNaN(n)) ? n : hd; };

    return scenarios.map(s => {
      const hp          = parseFloat(s.hp || "425000") || 0;
      const dpPct       = parseFloat(s.downPct) || 0;
      const dp          = dpPct / 100;
      const la          = Math.round(hp * (1 - dp));
      const downPayment = Math.round(hp * dp);
      const r           = (parseFloat(s.rate) || 0) / 100 / 12;
      const termYrs     = parseFloat(s.term) || 30;
      const n           = Math.round(termYrs * 12);
      const pts         = Math.round(la * (parseFloat(s.points) || 0) / 100);
      const sellerConc  = Math.round(parseFloat(s.sellerConc || "0") || 0);
      const monthlyPI   = pmt(r, n, la);
      const pmiMonthly  = dp < 0.20 ? Math.round(la * 0.005 / 12) : 0;
      const totalInterest = (n > 0 && monthlyPI > 0) ? (monthlyPI * n) - la : 0;
      const ltv         = hp > 0 ? (la / hp * 100) : 0;

      // ── Closing costs (excl. discount points — entered per scenario) ──
      const origination = Math.round(la * (parseFloat(fsOrigPct) || 0) / 100);
      const lenderFees  = origination + underwriting + processingFee; // no discount pts

      // Title fees scaled to this scenario's HP and LA
      const ownerTitle  = hp > 0 ? (st.basicRate ? st.basicRate(hp) : 0) : 0;
      const lenderTitle = la > 0 ? Math.round((st.basicRate ? st.basicRate(la) : 0) * (st.simultaneousRate || 0.35)) : 0;
      const escrowCalc  = Math.round(Math.max(500, hp * 0.001));
      const escrowFee   = ov(fsOvEscfee, def(fsDefEscrow, escrowCalc));
      const titleSearch = ov(fsOvTsrch,  def(fsDefTitle,  250));
      // 150 recording + 50 courier + 25 tax cert/e-recording
      const titleFees   = ownerTitle + lenderTitle + escrowFee + titleSearch + 225;

      const closingCosts = lenderFees + fixedThirdParty + titleFees;

      // ── Prepaids (prepaid interest is loan/rate-specific) ──
      const dailyInterest   = la > 0 ? (la * (parseFloat(s.rate) || 0) / 100) / 365 : 0;
      const prepaidInterest = Math.round(dailyInterest * prepaidDays);
      const prepaids        = prepaidInterest + fixedPrepaids;

      const cashNeeded = Math.max(0, downPayment + pts + closingCosts + prepaids - sellerConc);

      // APR: origination + discount pts + UW + processing + flood + tax svc + doc prep
      const aprFees = origination + pts + underwriting + processingFee + aprFixedFees;
      const annualRate = parseFloat(s.rate) || 0;
      const apr = la > 0 && annualRate > 0 ? calcAPR(la, annualRate, termYrs, aprFees) : annualRate;

      return {
        ...s,                   // preserves raw buydown fields (bdType, bdPermRate, etc.)
        hp, la, downPayment, dpPct, monthlyPI, pmiMonthly, totalInterest, ltv,
        pts, sellerConc, cashNeeded, n, termYrs, closingCosts, prepaids, apr,
      };
    });
  }, [scenarios, fsHelpers, fsOrigPct, fsOvEscfee, fsDefEscrow, fsOvTsrch, fsDefTitle]);

  // ── Per-scenario buydown calculations ──
  const perScenarioBD = useMemo(() => analyses.map(a => {
    const bdType = a.bdType || "none";
    if (bdType === "none") return { type: "none" };

    const { la, monthlyPI: baseMPI, termYrs, n } = a;
    const baseRate = parseFloat(a.rate) || 0;

    const calcPerm = () => {
      const bdRate = parseFloat(a.bdPermRate) || 0;
      if (!bdRate)            return { type: "permanent", noRate: true };
      if (bdRate >= baseRate) return { type: "permanent", rateError: true, baseRate };
      const bdMPI          = pmt(bdRate / 100 / 12, n, la);
      const monthlySavings = baseMPI - bdMPI;
      const costMode       = a.bdPermCostMode || "pct";
      const costVal        = parseFloat(a.bdPermCost) || 0;
      const cost           = costMode === "pct" ? Math.round(la * costVal / 100) : Math.round(costVal);
      const costPct        = la > 0 ? (costMode === "pct" ? costVal : costVal / la * 100) : 0;
      const breakevenMonths = (cost > 0 && monthlySavings > 0) ? Math.ceil(cost / monthlySavings) : null;
      return {
        type: "permanent", baseRate, bdRate, baseMPI, bdMPI, monthlySavings,
        cost, costPct, la, breakevenMonths, termYrs,
        net5yr:  monthlySavings * 60  - cost,
        net10yr: monthlySavings * 120 - cost,
      };
    };

    const calcTemp = () => {
      const tempType   = a.bdTempType || "2/1";
      const reductions = TEMP_BD_SCHEDULES[tempType] || [2, 1];
      let totalSubsidy = 0;
      const years = reductions.map((redPct, i) => {
        const yRate          = Math.max(0.01, baseRate - redPct);
        const yMPI           = pmt(yRate / 100 / 12, n, la);
        const monthlySavings = baseMPI - yMPI;
        const yearSubsidy    = monthlySavings * 12;
        totalSubsidy += yearSubsidy;
        return { year: i + 1, rate: yRate, payment: yMPI, monthlySavings, yearSubsidy };
      });
      years.push({ year: reductions.length + 1, rate: baseRate, payment: baseMPI, monthlySavings: 0, yearSubsidy: 0, isFull: true });
      return { type: "temporary", baseRate, baseMPI, years, totalSubsidy, tempType, la };
    };

    if (bdType === "permanent") return calcPerm();
    if (bdType === "temporary") return calcTemp();
    if (bdType === "both")      return { type: "both", perm: calcPerm(), temp: calcTemp() };

    return { type: "none" };
  }), [analyses]);

  // ── Inline sub-components ──────────────────────────────────────────────

  const StatBox = ({ label, value, color }) => (
    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  padding: "6px 8px", flex: 1, minWidth: 70 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.gray, fontFamily: font,
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: color || COLORS.navy, fontFamily: font }}>{value}</div>
    </div>
  );

  // Pill toggle for buydown cost mode
  const CostModePills = ({ mode, onChange }) => (
    <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
      {[["pct", "% of Loan"], ["dollar", "$ Amount"]].map(([v, lbl]) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: "4px 0", borderRadius: 5, cursor: "pointer", fontFamily: font,
          border: `1px solid ${mode === v ? COLORS.gold : COLORS.border}`,
          background: mode === v ? `${COLORS.gold}22` : "transparent",
          color: mode === v ? COLORS.gold : COLORS.gray,
          fontSize: 10, fontWeight: 700,
        }}>{lbl}</button>
      ))}
    </div>
  );

  // Renders one buydown card for a given scenario
  const renderBDCard = (a, bd) => {
    const bdType   = a.bdType  || "none";
    const costMode = a.bdPermCostMode || "pct";
    const upd      = (f, v) => updateScenario(a.id, f, v);

    const rawCost = parseFloat(a.bdPermCost) || 0;
    let costHint = "";
    if (a.la > 0 && rawCost > 0) {
      costHint = `${rawCost} pts × ${fmt(a.la)} = ${fmt(Math.round(a.la * rawCost / 100))}`;
    }

    const showPerm = bdType === "permanent" || bdType === "both";
    const showTemp = bdType === "temporary" || bdType === "both";
    const permBd   = bd.type === "both" ? bd.perm : bd;
    const tempBd   = bd.type === "both" ? bd.temp : bd;

    const PermResults = ({ pbd }) => {
      if (pbd.noRate) return (
        <div style={{ fontSize: 11, color: COLORS.gray, fontFamily: font, padding: "8px 0" }}>
          Enter a buydown rate above to see analysis.
        </div>
      );
      if (pbd.rateError) return (
        <div style={{ fontSize: 11, color: COLORS.red, fontFamily: font, padding: "8px 0" }}>
          Rate must be lower than the base rate ({pbd.baseRate}%).
        </div>
      );
      return (<>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10, marginBottom: 6 }}>
          <StatBox label="Base Pmt"  value={fmt2(pbd.baseMPI)}        color={COLORS.navy}  />
          <StatBox label="BD Pmt"    value={fmt2(pbd.bdMPI)}          color={COLORS.green} />
          <StatBox label="Saves/mo"  value={fmt2(pbd.monthlySavings)} color={COLORS.green} />
        </div>
        {pbd.cost > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            <StatBox label="BD Cost"  value={fmt(pbd.cost)} color={COLORS.gold} />
            {pbd.breakevenMonths && <StatBox label="Breakeven" value={`${pbd.breakevenMonths} mo`} color={COLORS.blue} />}
            <StatBox label="Net 5yr"
              value={pbd.net5yr  >= 0 ? fmt(Math.round(pbd.net5yr))  : `(${fmt(Math.round(-pbd.net5yr))})`}
              color={pbd.net5yr  >= 0 ? COLORS.green : COLORS.red} />
            <StatBox label="Net 10yr"
              value={pbd.net10yr >= 0 ? fmt(Math.round(pbd.net10yr)) : `(${fmt(Math.round(-pbd.net10yr))})`}
              color={pbd.net10yr >= 0 ? COLORS.green : COLORS.red} />
          </div>
        )}
        {pbd.breakevenMonths && (() => {
          const bkPct  = Math.min(100, (pbd.breakevenMonths / (pbd.termYrs * 12)) * 100);
          const bkYrs  = (pbd.breakevenMonths / 12).toFixed(1);
          const rdxPct = (pbd.baseRate - pbd.bdRate).toFixed(3).replace(/\.?0+$/, "");
          return (
            <div style={{ background: COLORS.bgAlt, borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.navy, fontFamily: font, marginBottom: 6 }}>
                Breakeven Analysis
              </div>
              <div style={{ fontSize: 10, color: COLORS.navy, fontFamily: font, lineHeight: 1.65, marginBottom: 8 }}>
                Reducing your rate from <strong>{pbd.baseRate}%</strong> to <strong>{pbd.bdRate}%</strong> (a <strong>{rdxPct}%</strong> reduction) saves{" "}
                <strong style={{ color: COLORS.green }}>{fmt2(pbd.monthlySavings)}/mo</strong>.{" "}
                At a cost of <strong style={{ color: COLORS.gold }}>{fmt(pbd.cost)}</strong>, you won't see the benefit of this buydown until{" "}
                <strong style={{ color: COLORS.blue }}>month {pbd.breakevenMonths} ({bkYrs} yrs)</strong>.{" "}
                After that, you pocket {fmt2(pbd.monthlySavings)}/mo for the remaining life of the loan.
              </div>
              <div style={{ height: 8, background: COLORS.border, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${bkPct.toFixed(1)}%`, height: "100%", background: COLORS.gold,
                              borderRadius: 4, transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 9, color: COLORS.gray, fontFamily: font, marginTop: 3, textAlign: "right" }}>
                Month {pbd.breakevenMonths} of {Math.round(pbd.termYrs * 12)}
              </div>
            </div>
          );
        })()}
      </>);
    };

    const TempResults = ({ tbd }) => (<>
      <Select label="Structure" value={a.bdTempType || "2/1"} onChange={(v) => upd("bdTempType", v)} options={[
        { value: "3/2/1", label: "3/2/1 Buydown" },
        { value: "2/1",   label: "2/1 Buydown"   },
        { value: "1/1",   label: "1/1 Buydown"   },
        { value: "1/0",   label: "1/0 Buydown"   },
      ]} small />
      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${COLORS.navy}` }}>
              {["Yr", "Rate", "Payment", "Subsidy/yr"].map(h => (
                <th key={h} style={{ padding: "5px 6px", textAlign: h === "Yr" ? "left" : "right",
                                     fontSize: 10, fontWeight: 700, color: COLORS.gray }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tbd.years && tbd.years.map((y, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`,
                                   background: y.isFull ? COLORS.bgAlt : COLORS.bg }}>
                <td style={{ padding: "5px 6px", fontWeight: 600, color: COLORS.navy }}>
                  {y.isFull ? `${y.year}+` : `Yr ${y.year}`}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700,
                              color: y.isFull ? COLORS.navy : COLORS.green }}>
                  {y.rate.toFixed(2)}%
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700,
                              color: y.isFull ? COLORS.navy : COLORS.green }}>
                  {fmt2(y.payment)}
                </td>
                <td style={{ padding: "5px 6px", textAlign: "right",
                              fontWeight: y.isFull ? 400 : 700,
                              color: y.isFull ? COLORS.gray : COLORS.gold }}>
                  {y.isFull ? "—" : fmt(Math.round(y.yearSubsidy))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tbd.totalSubsidy > 0 && (
        <div style={{ marginTop: 8, background: `${COLORS.gold}18`,
                      border: `1.5px solid ${COLORS.gold}55`, borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>
            💰 Seller/Builder Subsidy:{" "}
            <span style={{ color: COLORS.gold, fontSize: 15 }}>{fmt(Math.round(tbd.totalSubsidy))}</span>
          </div>
          <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginTop: 2, lineHeight: 1.4 }}>
            Deposited into escrow at closing to cover the payment gap each month during the buydown period.
          </div>
        </div>
      )}
    </>);

    return (
      <SectionCard key={a.id} title={`${a.label} — Buydown`} accent={COLORS.gold}>

        <Select label="Buydown Type" value={bdType} onChange={(v) => upd("bdType", v)} options={[
          { value: "none",      label: "— No Buydown —" },
          { value: "permanent", label: "Permanent Buydown" },
          { value: "temporary", label: "Temporary Buydown" },
          { value: "both",      label: "Combo: Permanent & Temporary" },
        ]} small />

        {/* ─ No buydown placeholder ─ */}
        {bdType === "none" && (
          <div style={{ textAlign: "center", padding: "14px 0", color: COLORS.gray, fontSize: 11, fontFamily: font }}>
            Select <strong>Permanent</strong> or <strong>Temporary</strong> to analyze.
          </div>
        )}

        {/* ─ Permanent section ─ */}
        {showPerm && (<>
          {bdType === "both" && (
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.navy, fontFamily: font,
                          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Permanent Buydown
            </div>
          )}
          <LabeledInput label="New Interest Rate after Buydown" value={a.bdPermRate || ""} onChange={(v) => upd("bdPermRate", v)} suffix="%" step="0.125" small />
          <LabeledInput
            label="Buydown Cost in Points (i.e. % of Loan)"
            value={a.bdPermCost || ""}
            onChange={(v) => upd("bdPermCost", v)}
            suffix="%"
            step="0.125"
            hint={costHint}
            small
          />
          <PermResults pbd={permBd} />
          {/* ─ Pricing education note — last item in permanent section ─ */}
          <div style={{
            background: `${COLORS.gold}0f`,
            border: `1px solid ${COLORS.gold}55`,
            borderRadius: 7,
            padding: "9px 11px",
            marginBottom: 4,
            marginTop: 8,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.gold, fontFamily: font, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ⚠ Pricing Changes Daily
            </div>
            <div style={{ fontSize: 10, color: COLORS.navy, fontFamily: font, lineHeight: 1.55 }}>
              Buydown costs are set by current market pricing and vary by loan program, credit score, LTV, and lender-level adjustments (LLPAs). A rough starting point:{" "}
              <strong>~0.5% in discount points typically buys ~0.125% in rate reduction</strong> — but this is not linear, not guaranteed, and not a substitute for actual lender pricing.
            </div>
            <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginTop: 5, fontStyle: "italic" }}>
              Always verify current costs with your lender before quoting a buydown to a borrower.
            </div>
          </div>
        </>)}

        {/* ─ Divider between sections when both ─ */}
        {bdType === "both" && (
          <div style={{ height: 1, background: COLORS.border, margin: "14px 0" }} />
        )}

        {/* ─ Temporary section ─ */}
        {showTemp && (<>
          {bdType === "both" && (
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.navy, fontFamily: font,
                          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Temporary Buydown
            </div>
          )}
          <TempResults tbd={tempBd} />
        </>)}

      </SectionCard>
    );
  };

  // Returns the valid permanent-buydown result (or null) so the matrix can use BD rate/cost
  const getPermBD = (bd) => {
    if (!bd) return null;
    if (bd.type === "permanent" && !bd.noRate && !bd.rateError && bd.bdMPI) return bd;
    if (bd.type === "both" && bd.perm && !bd.perm.noRate && !bd.perm.rateError && bd.perm.bdMPI) return bd.perm;
    return null;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ══ CURRENT VALUES REFERENCE ════════════════════════════════════════ */}
      <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, fontStyle: "italic", marginBottom: 14 }}>
        Default values are pulled from the Payment Calculator and Fee Sheet. Adjust each scenario independently below.
      </div>

      {/* ══ Scenario input cards ══════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
        {scenarios.map((s) => {
          const isCustomTerm = !PRESET_TERMS_MC.includes(s.term);
          const hp       = parseFloat(s.hp || "0") || 0;
          const dpDollar = Math.round(hp * (parseFloat(s.downPct) || 0) / 100);
          const scAnalysis = analyses.find(a => a.id === s.id);
          return (
            <SectionCard key={s.id} title={s.label} accent={s.color}>
              <button
                onClick={() => resetScenarioToPC(s.id)}
                style={{
                  display: "block", width: "100%", marginBottom: 10,
                  padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: font,
                  border: `1px solid ${s.color}66`, background: `${s.color}11`,
                  color: s.color, fontSize: 11, fontWeight: 700,
                }}
                title="Copy current Payment Calculator values into this scenario"
              >
                ↺ Reset to Current Values
              </button>
              <LabeledInput label="Purchase Price"     prefix="$" value={s.hp || ""}       onChange={(v) => updateScenario(s.id, "hp", v)}       useCommas small />
              <LabeledInput label="Down Payment"       value={s.downPct}    onChange={(v) => updateScenario(s.id, "downPct", v)} suffix="%" small
                hint={dpDollar > 0 ? `${fmt(dpDollar)} down · Loan: ${fmt(Math.round(hp - dpDollar))}` : undefined} />
              <LabeledInput label="Interest Rate"      value={s.rate}       onChange={(v) => updateScenario(s.id, "rate", v)}    suffix="%" step="0.125" small />
              {scAnalysis && scAnalysis.apr && scAnalysis.apr !== parseFloat(s.rate) && (() => {
                const rStr = String(s.rate || "").trim(); const d = rStr.indexOf("."); const dec = d === -1 ? 2 : Math.max(2, rStr.length - d - 1);
                return <div style={{ fontSize: 9, color: COLORS.gray, fontFamily: font, marginTop: -4, marginBottom: 4 }}>APR {scAnalysis.apr.toFixed(dec)}%</div>;
              })()}
              <Select label="Term" value={isCustomTerm ? "other" : s.term} onChange={(v) => {
                if (v === "other") updateScenario(s.id, "term", "");
                else               updateScenario(s.id, "term", v);
              }} options={[
                { value: "30", label: "30 Years" }, { value: "20", label: "20 Years" },
                { value: "15", label: "15 Years" }, { value: "other", label: "Other…" },
              ]} small />
              {isCustomTerm && (
                <LabeledInput label="Custom Years" value={s.term} onChange={(v) => {
                  const str = v.replace(/[^0-9]/g, "");
                  if (!str) { updateScenario(s.id, "term", ""); return; }
                  const yr = parseInt(str);
                  if (yr >= 1 && yr <= 30) updateScenario(s.id, "term", String(yr));
                  else if (yr > 30)        updateScenario(s.id, "term", "30");
                }} suffix="yr" small hint="1–30 years" />
              )}
              <LabeledInput label="Discount Points"    value={s.points}     onChange={(v) => updateScenario(s.id, "points", v)}    suffix="pts" small />
              <LabeledInput label="Seller Concessions" prefix="$" value={s.sellerConc || "0"} onChange={(v) => updateScenario(s.id, "sellerConc", v)} useCommas small hint="Reduces cash to close" />
            </SectionCard>
          );
        })}
      </div>

      {/* ══ Per-scenario buydown cards ════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${scenarios.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
        {analyses.map((a, i) => renderBDCard(a, perScenarioBD[i]))}
      </div>

      {/* ══ Side-by-side comparison table ════════════════════════════════ */}
      <SectionCard title="SIDE-BY-SIDE COMPARISON">
        <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginBottom: 8, fontStyle: "italic" }}>
          * Closing costs &amp; prepaids are estimates using your Fee Sheet settings (state-specific title insurance, overrides, and prepaid calendar).
          Discount points are excluded — entered per scenario above.
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${COLORS.navy}` }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: COLORS.gray }}></th>
                {analyses.map(a => (
                  <th key={a.id} style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Purchase Price",              fn: (a, bd) => fmt(a.hp) },
                { label: "Down Payment",                fn: (a, bd) => `${fmt(a.downPayment)} (${a.dpPct.toFixed(1)}%)` },
                { label: "Loan Amount",                 fn: (a, bd) => fmt(a.la) },
                { label: "Rate / APR",                  fn: (a, bd) => {
                    const pb  = getPermBD(bd);
                    const rStr = String(a.rate || "").trim(); const d = rStr.indexOf("."); const dec = d === -1 ? 2 : Math.max(2, rStr.length - d - 1);
                    if (pb) return `${pb.bdRate.toFixed(dec)}% (BD ↓ from ${a.rate}%)`;
                    return a.apr && a.apr !== parseFloat(a.rate) ? `${a.rate}% (${a.apr.toFixed(dec)}% APR)` : `${a.rate}%`;
                  } },
                { label: "Term",                        fn: (a, bd) => `${a.termYrs} yr` },
                { label: "Monthly P&I",                 fn: (a, bd) => { const pb = getPermBD(bd); return fmt2(pb ? pb.bdMPI : a.monthlyPI); }, highlight: true },
                { label: "Monthly PMI",                 fn: (a, bd) => a.pmiMonthly > 0 ? fmt2(a.pmiMonthly) : "None" },
                { label: "Total Monthly",               fn: (a, bd) => { const pb = getPermBD(bd); return fmt2((pb ? pb.bdMPI : a.monthlyPI) + a.pmiMonthly); }, tier: "strong" },
                { label: "Points / BD Cost",            fn: (a, bd) => { const pb = getPermBD(bd); const total = a.pts + (pb ? pb.cost : 0); return total > 0 ? fmt(total) : "—"; } },
                { label: "Seller Concessions",          fn: (a, bd) => a.sellerConc > 0 ? `(${fmt(a.sellerConc)})` : "—" },
                { label: "LTV",                         fn: (a, bd) => `${a.ltv.toFixed(1)}%` },
                { label: "Total Interest",              fn: (a, bd) => { const pb = getPermBD(bd); const piAmt = pb ? pb.bdMPI : a.monthlyPI; return fmt(Math.round(Math.max(0, piAmt * a.n - a.la))); } },
                { label: "Closing Costs (est.)*",       fn: (a, bd) => fmt(a.closingCosts), tier: "soft" },
                { label: "Prepaids & Reserves (est.)*", fn: (a, bd) => fmt(a.prepaids) },
                { label: "Cash to Close",               fn: (a, bd) => { const pb = getPermBD(bd); return fmt(a.cashNeeded + (pb ? pb.cost : 0)); }, tier: "strong" },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`,
                                     background: row.tier === "strong" ? `${COLORS.blue}0d`
                                               : row.tier === "soft"   ? `${COLORS.gold}0a`
                                               : i % 2 === 0 ? COLORS.bgAlt : COLORS.white }}>
                  <td style={{ padding: row.tier === "strong" ? "10px 12px" : "8px 12px",
                                fontSize: row.tier === "strong" ? 13 : 12,
                                fontWeight: row.tier ? 700 : 500,
                                color: row.tier === "strong" ? COLORS.navy : COLORS.navy,
                                borderLeft: row.tier === "strong" ? `3px solid ${COLORS.blue}` : "3px solid transparent" }}>{row.label}</td>
                  {analyses.map((a, ai) => (
                    <td key={a.id} style={{ padding: row.tier === "strong" ? "10px 12px" : "8px 12px",
                                            textAlign: "right",
                                            fontSize: row.tier === "strong" ? 15 : 13,
                                            fontWeight: row.tier ? 700 : 500,
                                            color: row.tier === "strong" ? a.color : COLORS.navy }}>
                      {row.fn(a, perScenarioBD[ai])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ══ Summary cards ═════════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${analyses.length}, 1fr)`, gap: 14, marginTop: 4 }}>
        {analyses.map(a => (
          <div key={a.id} style={{
            border: `2px solid ${a.color}`,
            borderRadius: 12,
            padding: "18px 16px",
            textAlign: "center",
            background: COLORS.bg,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: a.color, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>
              {a.label}
            </div>

            {/* Monthly Payment */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.gray, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Monthly Payment</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: a.color, fontFamily: font, lineHeight: 1 }}>
                {fmt2(a.monthlyPI + a.pmiMonthly)}
              </div>
              {a.pmiMonthly > 0 && (
                <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginTop: 3 }}>
                  incl. {fmt2(a.pmiMonthly)}/mo PMI
                </div>
              )}
            </div>

            <div style={{ height: 1, background: COLORS.border, margin: "0 0 14px 0" }} />

            {/* Cash to Close */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.gray, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Cash to Close</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: a.color, fontFamily: font, lineHeight: 1 }}>
                {fmt(a.cashNeeded)}
              </div>
            </div>

            <div style={{ fontSize: 10, color: COLORS.gray, fontFamily: font, marginTop: 6 }}>
              {a.rate}% · {a.termYrs}yr
            </div>
            {a.apr && a.apr !== parseFloat(a.rate) && (() => {
              const rStr = String(a.rate || "").trim(); const d = rStr.indexOf("."); const dec = d === -1 ? 2 : Math.max(2, rStr.length - d - 1);
              return <div style={{ fontSize: 9, color: COLORS.gray, fontFamily: font, opacity: 0.75 }}>APR {a.apr.toFixed(dec)}%</div>;
            })()}
          </div>
        ))}
      </div>

    </div>
  );
}

window.MortgageComparison = MortgageComparison;
