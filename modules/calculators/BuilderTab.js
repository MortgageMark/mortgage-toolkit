// modules/calculators/BuilderTab.js
// Builder Incentive Analyzer
// Reads loan details from Payment Calculator and rate data from Interest Rates tab.
// Builder enters concessions ($  or %) to see which permanent buydown options fit their budget.

const { useMemo, useState, useEffect } = React;
const useLocalStorage       = window.useLocalStorage;
const useThemeColors        = window.useThemeColors;
const fetchGlobalRateConfig = window.fetchGlobalRateConfig;
const COLORS      = window.COLORS;
const COLORS_DARK = window.COLORS_DARK;
const font        = window.font;

function BuilderTab() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;

  // ── From Payment Calculator (read-only) ────────────────────────────────────
  const [pcHP]   = useLocalStorage("pc_hp",   "");   // home price / sales price
  const [pcDP]   = useLocalStorage("pc_dp",   "5");  // down payment %
  const [pcLA]   = useLocalStorage("pc_la",   "");   // loan amount
  const [pcTerm] = useLocalStorage("pc_term", "30"); // loan term (years)
  // Monthly T, I — from Payment Calculator propagation
  const [dtiTax]  = useLocalStorage("dti_tax",    "0");
  const [dtiIns]  = useLocalStorage("dti_ins",    "0");
  // PMI — read from pc_eff_mi (written directly by PaymentCalculator after its
  // useMemo runs). This is the authoritative effective monthly MI that accounts
  // for auto-lookup rates, FHA MIP, USDA fees, and split/LPMI premiums.
  // Falls back to dti_pmi (propagation estimate) only when pc_eff_mi is absent.
  const [pcEffMI] = useLocalStorage("pc_eff_mi",  "");
  const [dtiPMI]  = useLocalStorage("dti_pmi",    "0");

  // ── From Interest Rates tab (global, populated from Supabase below) ────────
  const [irMarket,   setIrMarket]   = useLocalStorage("ir_market",    "");
  const [irFloor,    setIrFloor]    = useLocalStorage("ir_floor",     "");
  const [irSteps,    setIrSteps]    = useLocalStorage("ir_steps",     {});
  const [irRateDate, setIrRateDate] = useLocalStorage("ir_rate_date", "");

  // FHA / VA rate configs (bundled inside step_costs on save, extracted below)
  const [fhaMarket, setFhaMarket] = useLocalStorage("ir_fha_market", "");
  const [fhaFloor,  setFhaFloor]  = useLocalStorage("ir_fha_floor",  "");
  const [fhaSteps,  setFhaSteps]  = useLocalStorage("ir_fha_steps",  {});
  const [vaMarket,  setVaMarket]  = useLocalStorage("ir_va_market",  "");
  const [vaFloor,   setVaFloor]   = useLocalStorage("ir_va_floor",   "");
  const [vaSteps,   setVaSteps]   = useLocalStorage("ir_va_steps",   {});

  // Loan program selected in Payment Calculator
  const [pcProg] = useLocalStorage("pc_prog", "conventional");

  // Fetch global rate config on mount — uses the useLocalStorage setters so
  // React state updates immediately without needing StorageEvent tricks
  useEffect(() => {
    if (!fetchGlobalRateConfig) return;
    fetchGlobalRateConfig().then(function({ data }) {
      if (!data) return;
      if (data.market_rate) setIrMarket(data.market_rate);
      if (data.floor_rate)  setIrFloor(data.floor_rate);
      if (data.rate_date)   setIrRateDate(data.rate_date);
      if (data.step_costs) {
        var raw    = data.step_costs;
        var fhaCfg = raw._fha || {};
        var vaCfg  = raw._va  || {};
        var convSteps = Object.fromEntries(
          Object.entries(raw).filter(function([k]) { return k !== "_fha" && k !== "_va"; })
        );
        setIrSteps(convSteps);
        if (fhaCfg.market) setFhaMarket(fhaCfg.market);
        if (fhaCfg.floor)  setFhaFloor(fhaCfg.floor);
        if (fhaCfg.steps)  setFhaSteps(fhaCfg.steps);
        if (vaCfg.market)  setVaMarket(vaCfg.market);
        if (vaCfg.floor)   setVaFloor(vaCfg.floor);
        if (vaCfg.steps)   setVaSteps(vaCfg.steps);
      }
    });
  }, []);

  // ── Builder input — SCENARIO-ISOLATED STORAGE ─────────────────────────────
  // Each scenario gets its OWN localStorage key: bld_conc_val_{scenarioId}.
  // Because keys are different per scenario, cross-scenario bleed is architecturally
  // impossible — Scenario A's value can never overwrite Scenario B's value.
  //
  // The scenario ID is read from mtk_active_scenario, which App.js writes
  // synchronously in handleSelectScenario BEFORE setActiveScenario triggers
  // this component to mount. useRef captures it once and it never changes
  // during a single BuilderTab lifetime.
  const _scenIdRef = useRef(null);
  if (_scenIdRef.current === null) {
    try {
      var _as = JSON.parse(localStorage.getItem("mtk_active_scenario") || "null");
      _scenIdRef.current = (_as && _as.id) ? _as.id : "default";
    } catch { _scenIdRef.current = "default"; }
  }
  var _concValKey  = "bld_conc_val_"  + _scenIdRef.current;
  var _concModeKey = "bld_conc_mode_" + _scenIdRef.current;

  const [concMode, setConcMode] = useLocalStorage(_concModeKey, "pct");
  const [concVal,  setConcVal]  = useLocalStorage(_concValKey,  "");
  const [concFocused, setConcFocused] = useState(false);
  const concInputRef = useRef(null);

  // ── Split allocation state (scenario-isolated) ─────────────────────────────
  const [permBudget, setPermBudget] = useLocalStorage("bld_perm_"  + _scenIdRef.current, "");
  const [permFocused, setPermFocused] = useState(false);

  // ── Target Payment Solver state (scenario-isolated) ───────────────────────
  const [targetPayment, setTargetPayment] = useLocalStorage("bld_target_pay_" + _scenIdRef.current, "");
  const [targetPayFocused, setTargetPayFocused] = useState(false);
  const [targetMode, setTargetMode] = useLocalStorage("bld_target_mode_" + _scenIdRef.current, "pi");

  // ── Active loan type — maps pc_prog to rate set ────────────────────────────
  const activeLoanType = pcProg === "fha" ? "fha" : pcProg === "va" ? "va" : "conv";
  const ltMeta = {
    conv: { label: "Conventional", color: COLORS.navy || "#1B3A5C", shortLabel: "CONV" },
    fha:  { label: "FHA",          color: "#1A6B5A",                 shortLabel: "FHA"  },
    va:   { label: "VA",           color: "#7B3F00",                 shortLabel: "VA"   },
  };
  const activeMeta = ltMeta[activeLoanType];

  // ── Numeric values ─────────────────────────────────────────────────────────
  const sp    = parseFloat(pcHP)   || 0;
  const dpPct = parseFloat(pcDP)   || 0;
  const la    = parseFloat(pcLA)   || 0;
  const term  = parseInt(pcTerm)   || 30;
  const tax   = parseFloat(dtiTax) || 0;
  const ins   = parseFloat(dtiIns) || 0;
  // Use pc_eff_mi when available (written by PaymentCalc — includes auto-lookup,
  // FHA MIP, USDA fee, split premium). Fall back to propagation estimate.
  const pmiM  = pcEffMI !== "" ? (parseFloat(pcEffMI) || 0) : (parseFloat(dtiPMI) || 0);

  // Active market/floor/steps derived from loan program
  const mkt         = activeLoanType === "fha" ? (parseFloat(fhaMarket) || 0)
                    : activeLoanType === "va"   ? (parseFloat(vaMarket)  || 0)
                    : (parseFloat(irMarket) || 0);
  const flr         = activeLoanType === "fha" ? (parseFloat(fhaFloor)  || 0)
                    : activeLoanType === "va"   ? (parseFloat(vaFloor)   || 0)
                    : (parseFloat(irFloor)  || 0);
  const activeSteps = activeLoanType === "fha" ? fhaSteps
                    : activeLoanType === "va"   ? vaSteps
                    : irSteps;

  const dpDollar   = sp * dpPct / 100;
  const concNum    = parseFloat(concVal) || 0;
  const concDollar = concMode === "pct"    ? concNum * sp / 100 : concNum;
  const concPct    = concMode === "dollar" ? (sp > 0 ? concNum / sp * 100 : 0) : concNum;

  const targetPayNum = parseFloat(String(targetPayment || "").replace(/[^0-9.]/g, "")) || 0;
  const targetPIGoal = targetMode === "piti"
    ? Math.max(0, targetPayNum - tax - ins - pmiM)
    : targetPayNum;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const calcPI = (rate, loanAmt, termYrs) => {
    if (!rate || !loanAmt || !termYrs) return 0;
    const mr = rate / 100 / 12;
    const n  = termYrs * 12;
    if (mr === 0) return loanAmt / n;
    return loanAmt * mr * Math.pow(1 + mr, n) / (Math.pow(1 + mr, n) - 1);
  };

  // Solve: given a target P&I payment, rate, and term — what loan amount produces it?
  const calcLoanForPI = (targetPI, rate, termYrs) => {
    if (!targetPI || !rate || !termYrs) return 0;
    const mr = rate / 100 / 12;
    const n  = termYrs * 12;
    if (mr === 0) return targetPI * n;
    return targetPI * (1 - Math.pow(1 + mr, -n)) / mr;
  };

  // Format a raw number string as a comma-separated integer (for dollar input display)
  const fmtInputVal = (v) => {
    if (!v && v !== 0) return "";
    const n = parseFloat(v);
    return isNaN(n) ? v : Math.round(n).toLocaleString("en-US");
  };

  const rKey       = r  => r.toFixed(3);
  const ceilEighth = n  => Math.ceil(n / 0.125) * 0.125;

  // For whole (X.000) and half (X.500) rates, prefer the companion X.490/X.990 rate —
  // same cost as the parent but 0.01% lower, so we always show the best rate.
  const preferCompanion = (rate) => {
    const r    = Math.round(rate * 1000) / 1000;
    const frac = Math.round((r % 1) * 1000) / 1000;
    if (frac < 0.0005 || Math.abs(frac - 0.5) < 0.0005) return Math.round((r - 0.01) * 1000) / 1000;
    return r;
  };

  // Format YYYY-MM-DD date string as "Month D, YYYY"
  const fmtDate = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${months[m - 1]} ${d}, ${y}`;
  };
  const fmtD       = n  => (n != null && n > 0) ? "$" + Math.round(n).toLocaleString("en-US") : "—";
  const fmtP       = (n, d = 3) => (n != null) ? n.toFixed(d) + "%" : "—";
  const fmtMo      = n  => (n != null && n > 0) ? "$" + Math.round(n).toLocaleString("en-US") + "/mo" : "—";

  // ── Row generation — mirrors InterestRates.js ──────────────────────────────
  const rows = useMemo(() => {
    if (!mkt || !flr || flr >= mkt - 0.00001) return [];
    const STEP = 0.125;
    const result = [];
    let r = Math.round(flr * 1000) / 1000;
    const m = Math.round(mkt * 1000) / 1000;
    while (r <= m + 0.00001) {
      const rate  = Math.round(r * 1000) / 1000;
      const frac  = Math.round((rate % 1) * 1000) / 1000;
      const isWhole = frac < 0.0005;
      const isHalf  = Math.abs(frac - 0.5) < 0.0005;
      if (isWhole || isHalf) {
        result.push({ rate: Math.round((rate - 0.01) * 1000) / 1000, isCompanion: true, companionOf: rate });
      }
      result.push({ rate, isCompanion: false });
      r = Math.round((r + STEP) * 1000) / 1000;
    }
    return result;
  }, [flr, mkt]);

  // ── Cumulative cost map — mirrors InterestRates.js ─────────────────────────
  const cumMap = useMemo(() => {
    const map  = {};
    const real = rows.filter(r => !r.isCompanion).slice().sort((a, b) => a.rate - b.rate);
    if (!real.length) return map;
    map[rKey(real[real.length - 1].rate)] = 0;
    for (let i = real.length - 2; i >= 0; i--) {
      const k  = rKey(real[i].rate);
      const kA = rKey(real[i + 1].rate);
      map[k] = (map[kA] || 0) + (parseFloat(activeSteps[k]) || 0);
    }
    rows.filter(r => r.isCompanion).forEach(r => {
      map[rKey(r.rate)] = map[rKey(r.companionOf)] || 0;
    });
    return map;
  }, [rows, activeSteps]);

  // ── Per-row computed values ────────────────────────────────────────────────
  const rowData = useMemo(() => {
    const mktPI = (mkt > 0 && la > 0 && term > 0) ? calcPI(mkt, la, term) : 0;

    // ── Pass 1: compute all per-row values ────────────────────────────────────
    const pass1 = rows.map(row => {
      const k    = rKey(row.rate);
      const cum  = cumMap[k] || 0;
      const col4 = la > 0 ? Math.round(cum / 100 * la) : null;
      const col5 = (col4 !== null && sp > 0) ? col4 / sp * 100 : null;
      const col6 = col5 !== null ? ceilEighth(col5) : null;
      const col7 = (col6 !== null && sp > 0) ? Math.round(col6 / 100 * sp) : null;
      const pi   = la > 0 && term > 0 ? Math.round(calcPI(row.rate, la, term)) : null;
      const piti = pi !== null ? Math.round(pi + tax + ins + pmiM) : null;
      const withinBudget = col7 !== null && concDollar > 0 && col7 <= concDollar;
      const piSavings = (pi !== null && mktPI > 0) ? Math.round(mktPI - pi) : null;
      const newLoan  = (pi !== null && pi > 0 && mkt > 0 && term > 0) ? calcLoanForPI(pi, mkt, term) : null;
      const ppPrice  = (newLoan !== null && dpDollar >= 0) ? Math.round(newLoan + dpDollar) : null;
      const ppGain   = (ppPrice !== null && sp > 0) ? Math.round(ppPrice - sp) : null;
      return { ...row, col6, col7, pi, piti, withinBudget, piSavings, ppPrice, ppGain };
    });

    // ── Pass 2: breakeven — incremental cost / incremental monthly savings ────
    // For each non-companion row, find the adjacent row one step higher (0.125%
    // up) and compute: (this cost − above cost) / (above P&I − this P&I).
    // Companion rows share cost with their parent so we skip them (show —).
    return pass1.map(row => {
      if (row.isCompanion) return { ...row, breakeven: null };
      const nextRate  = Math.round((row.rate + 0.125) * 1000) / 1000;
      const aboveRow  = pass1.find(r => !r.isCompanion && Math.abs(r.rate - nextRate) < 0.0005);
      if (!aboveRow) return { ...row, breakeven: null }; // market-rate row — no row above
      const stepCost    = (row.col7 != null && aboveRow.col7 != null) ? (row.col7 - (aboveRow.col7 || 0)) : null;
      const stepSavings = (row.pi  != null && aboveRow.pi  != null) ? (aboveRow.pi - row.pi)  : null;
      const breakeven   = (stepCost > 0 && stepSavings > 0) ? Math.ceil(stepCost / stepSavings) : null;
      return { ...row, breakeven };
    });
  }, [rows, cumMap, la, sp, dpDollar, term, tax, ins, pmiM, concDollar, mkt]);

  // ── Temporary buydown calculations ────────────────────────────────────────
  const tempBuydownData = useMemo(() => {
    if (!mkt || !la || !term) return [];
    const mktPI = calcPI(mkt, la, term);

    const PROGRAMS = [
      { id: "321", name: "3/2/1 Buydown", offsets: [3, 2, 1] },
      { id: "21",  name: "2/1 Buydown",   offsets: [2, 1] },
      { id: "111", name: "1/1/1 Buydown", offsets: [1, 1, 1] },
      { id: "11",  name: "1/1 Buydown",   offsets: [1, 1] },
      { id: "10",  name: "1/0 Buydown",   offsets: [1] },
    ];

    return PROGRAMS.map(function(prog) {
      var yearRows = prog.offsets.map(function(offset, i) {
        var rate     = preferCompanion(Math.max(mkt - offset, 0.001));
        var pi       = calcPI(rate, la, term);
        var savings  = mktPI - pi;
        return {
          year:    i + 1,
          rate:    rate,
          pi:      Math.round(pi),
          savings: Math.round(savings),
          subsidy: Math.round(savings * 12), // 12 months of subsidy per year
        };
      });

      var totalCost   = yearRows.reduce(function(s, r) { return s + r.subsidy; }, 0);
      var costPct     = sp > 0 ? totalCost / sp * 100 : null;
      var withinBudget = concDollar > 0 && totalCost <= concDollar;

      return { id: prog.id, name: prog.name, yearRows: yearRows, totalCost: totalCost, costPct: costPct, withinBudget: withinBudget, mktPI: Math.round(mktPI) };
    });
  }, [mkt, la, term, sp, concDollar]);

  // ── Combined (split) strategy results ─────────────────────────────────────
  // Finds the best permanent rate achievable with permBudget, then calculates
  // all 4 temp buydown programs on top of that lower note rate.
  const splitResults = useMemo(function() {
    if (!mkt || !la || !term) return null;
    var permNum = parseFloat(permBudget) || 0;
    var tempNum  = Math.max(0, concDollar - permNum);

    // rowData is sorted ascending (floor → market). col7 is descending (lower rate = higher cost).
    // Find the lowest rate row where col7 ≤ permNum — that's the best permanent buydown we can afford.
    var eligible = rowData.filter(function(r) {
      return !r.isCompanion && r.col7 != null && r.col7 > 0 && r.col7 <= permNum;
    });
    var bestPermRow = eligible.length > 0 ? eligible[0] : null;
    // Use preferCompanion so the note rate is X.490/X.990 — same cost, 0.01% lower
    var permRate = bestPermRow ? preferCompanion(bestPermRow.rate) : mkt;
    var permCost = bestPermRow ? (bestPermRow.col7 || 0) : 0;

    var notePI = Math.round(calcPI(permRate, la, term));
    var mktPI  = Math.round(calcPI(mkt,      la, term));
    var permSavings = mktPI - notePI; // permanent monthly savings vs market rate

    var PROGRAMS = [
      { id: "321", name: "3/2/1", offsets: [3, 2, 1] },
      { id: "21",  name: "2/1",   offsets: [2, 1] },
      { id: "111", name: "1/1/1", offsets: [1, 1, 1] },
      { id: "11",  name: "1/1",   offsets: [1, 1] },
      { id: "10",  name: "1/0",   offsets: [1] },
    ];

    var programs = PROGRAMS.map(function(prog) {
      var yearRows = prog.offsets.map(function(offset, i) {
        var rate = preferCompanion(Math.max(permRate - offset, 0.001));
        var pi   = Math.round(calcPI(rate, la, term));
        var subsidy = Math.round(Math.max(notePI - pi, 0) * 12); // builder funds difference each year
        return {
          year:         i + 1,
          rate:         rate,
          pi:           pi,
          savingsVsNote: Math.round(notePI - pi),     // temp savings on top of perm benefit
          savingsVsMkt:  Math.round(mktPI  - pi),     // total buyer benefit vs original market
          subsidy:      subsidy,
        };
      });
      var tempCost     = yearRows.reduce(function(s, r) { return s + r.subsidy; }, 0);
      var combinedCost = permCost + tempCost;
      var withinTempBudget = tempNum > 0 && tempCost <= tempNum;
      var withinTotal  = concDollar > 0 && combinedCost <= concDollar;

      return {
        id: prog.id, name: prog.name,
        yearRows: yearRows,
        tempCost: tempCost,
        combinedCost: combinedCost,
        withinTempBudget: withinTempBudget,
        withinTotal: withinTotal,
        overBy: Math.max(0, combinedCost - concDollar),
      };
    });

    return {
      permRate: permRate, permCost: permCost, permNum: permNum, tempNum: tempNum,
      bestPermRow: bestPermRow, permSavings: permSavings,
      notePI: notePI, mktPI: mktPI, programs: programs,
    };
  }, [permBudget, rowData, mkt, la, term, sp, concDollar]);

  // ── Target Payment Solver ─────────────────────────────────────────────────
  const solverResults = useMemo(function() {
    if (!targetPIGoal || targetPIGoal <= 0 || !mkt || !la || !term) return null;

    var mktPI = Math.round(calcPI(mkt, la, term));
    if (mktPI <= targetPIGoal) return { alreadyMet: true, mktPI, targetPIGoal };

    var PROGS = [
      { id: "321", name: "3/2/1", offsets: [3, 2, 1] },
      { id: "21",  name: "2/1",   offsets: [2, 1] },
      { id: "111", name: "1/1/1", offsets: [1, 1, 1] },
      { id: "11",  name: "1/1",   offsets: [1, 1] },
      { id: "10",  name: "1/0",   offsets: [1] },
    ];

    // 1. Permanent only — highest (cheapest) rate where pi ≤ goal
    var permCandidates = rowData.filter(function(r) {
      return !r.isCompanion && r.pi !== null && r.pi <= targetPIGoal && r.col7 != null && r.col7 > 0;
    });
    var bestPermRow = permCandidates.length > 0 ? permCandidates[permCandidates.length - 1] : null;
    var permResult = null;
    if (bestPermRow) {
      var pRate = preferCompanion(bestPermRow.rate);
      permResult = {
        rate: pRate,
        cost: bestPermRow.col7,
        costPct: sp > 0 ? bestPermRow.col7 / sp * 100 : null,
        pi: Math.round(calcPI(pRate, la, term)),
        savings: mktPI - Math.round(calcPI(pRate, la, term)),
      };
    }

    // 2. Temporary only — programs that hit goal in Year 1 at market rate
    var tempResults = [];
    PROGS.forEach(function(prog) {
      var y1Rate = preferCompanion(Math.max(mkt - prog.offsets[0], 0.001));
      var y1PI   = Math.round(calcPI(y1Rate, la, term));
      if (y1PI <= targetPIGoal) {
        var bdProg = tempBuydownData.find(function(p) { return p.id === prog.id; });
        tempResults.push({
          id: prog.id, name: prog.name, offsets: prog.offsets,
          year1Rate: y1Rate, year1PI: y1PI,
          cost: bdProg ? bdProg.totalCost : null,
          costPct: bdProg && sp > 0 ? bdProg.totalCost / sp * 100 : null,
        });
      }
    });

    // 3. Combined — minimum total cost per temp program type
    var combinedResults = [];
    var permRows = rowData.filter(function(r) { return !r.isCompanion && r.col7 != null && r.col7 > 0; });
    PROGS.forEach(function(prog) {
      var best = null;
      permRows.forEach(function(permRow) {
        var pRate = preferCompanion(permRow.rate);
        var pPI   = calcPI(pRate, la, term);
        if (Math.round(pPI) <= targetPIGoal) return; // perm alone sufficient, skip
        var y1Rate = preferCompanion(Math.max(pRate - prog.offsets[0], 0.001));
        var y1PI   = Math.round(calcPI(y1Rate, la, term));
        if (y1PI <= targetPIGoal) {
          var tempCost = prog.offsets.reduce(function(sum, offset) {
            var yr   = preferCompanion(Math.max(pRate - offset, 0.001));
            var yrPI = calcPI(yr, la, term);
            return sum + Math.round(Math.max(pPI - yrPI, 0) * 12);
          }, 0);
          var totalCost = permRow.col7 + tempCost;
          if (!best || totalCost < best.totalCost) {
            best = {
              id: prog.id, name: prog.name,
              permRate: pRate, permCost: permRow.col7,
              tempCost: tempCost, totalCost: totalCost,
              year1Rate: y1Rate, year1PI: y1PI,
              permSavings: mktPI - Math.round(pPI),
              totalCostPct: sp > 0 ? totalCost / sp * 100 : null,
            };
          }
        }
      });
      if (best) combinedResults.push(best);
    });
    combinedResults.sort(function(a, b) { return a.totalCost - b.totalCost; });

    // Overall cheapest cost across all three strategies
    var allCosts = [];
    if (permResult) allCosts.push(permResult.cost);
    tempResults.forEach(function(t) { if (t.cost != null) allCosts.push(t.cost); });
    combinedResults.forEach(function(c) { allCosts.push(c.totalCost); });
    var cheapestOverall = allCosts.length > 0 ? Math.min.apply(null, allCosts) : null;

    return {
      mktPI, targetPIGoal,
      permResult, tempResults, combinedResults,
      cheapestOverall,
      achievable: permResult !== null || tempResults.length > 0 || combinedResults.length > 0,
    };
  }, [targetPIGoal, rowData, tempBuydownData, mkt, la, term, sp]);

  // ── Style helpers ──────────────────────────────────────────────────────────
  const border = c.border || "#E0E8E8";
  const navy   = COLORS.navy;

  const labelSt = {
    fontSize: 11, fontWeight: 700, color: c.textSecondary || "#64748b",
    textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5,
  };
  const valSt  = { fontSize: 18, fontWeight: 800, color: c.navy || navy };
  const cardSt = { background: c.bgAlt || "#F9FBFC", border: "1px solid " + border, borderRadius: 10, padding: "18px 22px" };

  const TH    = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "right", whiteSpace: "normal", lineHeight: 1.3, letterSpacing: "0.03em" };
  const TH1   = { ...TH, textAlign: "left", minWidth: 90 };
  const ppBg  = "#1A6B5A";  // teal — purchasing power columns
  const THPP  = { ...TH, background: ppBg };
  const THPP1 = { ...THPP, textAlign: "center", borderLeft: "3px solid rgba(255,255,255,0.25)" };

  // Amber color for the split permanent buydown target rate
  const splitPermBg = isDark ? "#3D2800" : "#FFF0C2";

  const rowBg = (row) => {
    const isMarket    = !row.isCompanion && Math.abs(row.rate - mkt) < 0.0005;
    // Highlight the companion (X.490/X.990) AND its parent row in amber
    const splitPermParent = splitResults && splitResults.bestPermRow ? splitResults.bestPermRow.rate : null;
    const splitPermComp   = splitResults && splitResults.permRate    ? splitResults.permRate           : null;
    const isSplitPerm = parseFloat(permBudget) > 0 && splitResults && splitResults.bestPermRow && (
      (splitPermComp  !== null && Math.abs(row.rate - splitPermComp)   < 0.0005) ||
      (splitPermParent !== null && Math.abs(row.rate - splitPermParent) < 0.0005) ||
      (row.isCompanion && splitPermParent !== null && Math.abs(row.companionOf - splitPermParent) < 0.0005)
    );
    if (isMarket)         return c.blueLight  || (isDark ? "#1A2E3C" : "#EBF5FB");
    if (isSplitPerm)      return splitPermBg;
    if (row.withinBudget) return isDark ? "#1A3D28" : "#C6F0D4";
    if (row.isCompanion)  return c.bgAlt      || (isDark ? "#1E2D38" : "#F9FBFC");
    return "transparent";
  };

  const TD  = (row) => ({
    padding: "7px 14px", textAlign: "right", fontSize: 13,
    borderBottom: "1px solid " + border,
    background: rowBg(row), color: c.text || "#1B2A3B",
  });
  const TD1 = (row) => ({ ...TD(row), textAlign: "left", paddingLeft: row.isCompanion ? 28 : 14 });

  const badge = (label, bg) => (
    <span style={{
      marginLeft: 7, fontSize: 9, fontWeight: 800, background: bg, color: "#fff",
      padding: "2px 6px", borderRadius: 3, letterSpacing: "0.05em", verticalAlign: "middle",
    }}>{label}</span>
  );

  const hasRateTable = mkt > 0 && flr > 0 && flr < mkt && rows.length > 0;
  const marketPI   = mkt > 0 && la > 0 ? Math.round(calcPI(mkt, la, term)) : 0;
  const marketPITI = marketPI + tax + ins + pmiM;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: font }}>

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: c.navy || navy, letterSpacing: "-0.01em" }}>
          Builder Incentive Analyzer
        </div>
        <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginTop: 3 }}>
          Structure builder financing incentives — permanent rate buydowns, costs, and monthly payment impact
        </div>
      </div>

      {/* ── Top cards ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* Loan Details (read-only) */}
        <div style={cardSt}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || navy, marginBottom: 14 }}>
            Loan Details
            <span style={{ fontSize: 11, fontWeight: 400, color: c.textSecondary || "#64748b", marginLeft: 8 }}>from Payment Calculator</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

            <div>
              <span style={labelSt}>Sales Price</span>
              {sp > 0
                ? <div style={valSt}>{"$" + sp.toLocaleString("en-US")}</div>
                : <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>enter in Payment Calc</div>
              }
            </div>

            <div>
              <span style={labelSt}>Down Payment</span>
              {sp > 0 && dpPct > 0
                ? <div>
                    <div style={valSt}>{dpPct.toFixed(1)}%</div>
                    <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginTop: 2 }}>
                      {"$" + Math.round(dpDollar).toLocaleString("en-US")}
                    </div>
                  </div>
                : <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>—</div>
              }
            </div>

            <div>
              <span style={labelSt}>Loan Amount</span>
              {la > 0
                ? <div style={valSt}>{"$" + la.toLocaleString("en-US")}</div>
                : <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>—</div>
              }
            </div>

            <div>
              <span style={labelSt}>Loan Term</span>
              <div style={valSt}>{term} yr</div>
            </div>

            <div>
              <span style={labelSt}>P&amp;I at Market</span>
              {marketPI > 0
                ? <div style={valSt}>{fmtMo(marketPI)}</div>
                : <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>—</div>
              }
            </div>

            <div>
              <span style={labelSt}>PITI at Market</span>
              {marketPITI > 0
                ? <div style={valSt}>{fmtMo(marketPITI)}</div>
                : <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>—</div>
              }
            </div>

          </div>
        </div>

        {/* Builder Concessions (editable) */}
        <div style={cardSt}>
          <div style={{ fontSize: 14, fontWeight: 700, color: c.navy || navy, marginBottom: 14 }}>
            Builder Concessions
          </div>

          {/* Input row: field + %/$ toggle + inline math */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {concMode === "dollar" && (
              <span style={{ fontSize: 16, fontWeight: 700, color: c.text || "#1B2A3B" }}>$</span>
            )}
            <input
              ref={concInputRef}
              type={concMode === "dollar" ? "text" : "number"}
              min={concMode === "pct" ? "0" : undefined}
              step={concMode === "pct" ? "0.25" : undefined}
              value={concMode === "dollar"
                ? (concFocused ? concVal : fmtInputVal(concVal))
                : concVal}
              onChange={e => {
                if (concMode === "dollar") {
                  const raw = e.target.value.replace(/[^0-9.]/g, "");
                  setConcVal(raw);
                } else {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num > 25) return;
                  setConcVal(e.target.value);
                }
              }}
              onFocus={() => setConcFocused(true)}
              onBlur={() => setConcFocused(false)}
              onKeyDown={e => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  setTimeout(function() {
                    if (concInputRef.current) concInputRef.current.focus({ preventScroll: true });
                  }, 0);
                }
              }}
              placeholder={concMode === "pct" ? "0.00" : "0"}
              style={{
                width: 100, padding: "7px 10px", borderRadius: 6, textAlign: "right",
                border: "1px solid " + border, background: c.bg || "#fff",
                color: c.text || "#1B2A3B", fontSize: 15, fontWeight: 700, fontFamily: font,
              }}
            />
            {concMode === "pct" && (
              <span style={{ fontSize: 15, fontWeight: 700, color: c.text || "#1B2A3B" }}>%</span>
            )}
            {/* %/$ toggle */}
            <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid " + border, flexShrink: 0 }}>
              {[{ v: "pct", label: "%" }, { v: "dollar", label: "$" }].map(({ v, label }) => (
                <button key={v} tabIndex={-1} onClick={() => {
                  if (v === concMode) return;
                  const num = parseFloat(concVal) || 0;
                  if (v === "dollar" && concMode === "pct") {
                    if (sp > 0 && num > 0) setConcVal(String(Math.round(num * sp / 100)));
                  } else if (v === "pct" && concMode === "dollar") {
                    if (sp > 0 && num > 0) setConcVal(String(parseFloat((num / sp * 100).toFixed(3))));
                  }
                  setConcMode(v);
                }} style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", border: "none", fontFamily: font,
                  background: concMode === v ? navy : (c.bg || "#fff"),
                  color: concMode === v ? "#fff" : (c.text || "#1B2A3B"),
                  transition: "all 0.15s",
                }}>{label}</button>
              ))}
            </div>
            {/* Inline math */}
            {concNum > 0 && sp > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: c.navy || navy, marginLeft: 4 }}>
                {concMode === "pct"
                  ? `${concPct.toFixed(3)}%  =  $${Math.round(concDollar).toLocaleString("en-US")}`
                  : `$${Math.round(concDollar).toLocaleString("en-US")}  =  ${concPct.toFixed(3)}%`
                }
                <span style={{ fontWeight: 400, color: c.textSecondary || "#64748b" }}>{" "}(of ${sp.toLocaleString("en-US")})</span>
              </span>
            )}
            {concNum > 0 && !sp && (
              <span style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic" }}>
                Enter sales price in Payment Calc to see equivalents.
              </span>
            )}
          </div>

          {/* ── Permanent buydown allocation (always visible when applicable) ── */}
          {concDollar > 0 && mkt > 0 && la > 0 && (
            <div style={{ borderTop: "1px solid " + border, paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginBottom: 10, lineHeight: 1.5 }}>
                Optional: allocate a portion of the concessions for the permanent buydown.
              </div>

              {/* Permanent Buydown input — full width */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                  Permanent Buydown Budget
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 700, color: c.text || "#1B2A3B" }}>$</span>
                  <input
                    type="text"
                    value={permFocused ? permBudget : (parseFloat(permBudget) > 0 ? Math.round(parseFloat(permBudget)).toLocaleString("en-US") : permBudget)}
                    data-role="perm-budget"
                    tabIndex={-1}
                    onFocus={function() { setPermFocused(true); }}
                    onBlur={function()  { setPermFocused(false); }}
                    onChange={function(e) {
                      var raw = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
                      var clamped = Math.min(raw, concDollar);
                      setPermBudget(clamped > 0 ? String(clamped) : "");
                    }}
                    placeholder="0"
                    style={{
                      width: "100%", padding: "7px 10px", borderRadius: 6,
                      border: "1px solid " + border, background: c.bg || "#fff",
                      color: c.text || "#1B2A3B", fontSize: 14, fontWeight: 700,
                      fontFamily: font, textAlign: "right",
                    }}
                  />
                </div>
              </div>

              {/* Allocation summary bar */}
              {parseFloat(permBudget) > 0 && (function() {
                var pn = parseFloat(permBudget) || 0;
                var tn = Math.max(0, concDollar - pn);
                var permPct = concDollar > 0 ? Math.min(pn / concDollar * 100, 100) : 0;
                var tempPct = concDollar > 0 ? Math.min(tn / concDollar * 100, 100 - permPct) : 0;
                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ height: 8, borderRadius: 4, background: border, overflow: "hidden", display: "flex", marginBottom: 8 }}>
                      <div style={{ width: permPct + "%", background: navy, transition: "width 0.2s" }} />
                      <div style={{ width: tempPct + "%", background: "#1A6B5A", transition: "width 0.2s" }} />
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: c.textSecondary || "#64748b" }}>
                      <span><span style={{ display: "inline-block", width: 8, height: 8, background: navy, borderRadius: 2, marginRight: 4 }} />Perm: ${pn.toLocaleString("en-US")}</span>
                      <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#1A6B5A", borderRadius: 2, marginRight: 4 }} />Temp: ${Math.round(tn).toLocaleString("en-US")}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Quick hint */}
              {splitResults && splitResults.bestPermRow && (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: 7,
                  background: isDark ? "#0D1B26" : "#EBF5FB",
                  border: "1px solid " + (isDark ? "#1A3040" : "#C8E4F5"),
                  fontSize: 12, color: c.text || "#1B2A3B", lineHeight: 1.6,
                }}>
                  {(function() {
                    var afterPerm = Math.round(concDollar - splitResults.permCost);
                    var bestTemp  = splitResults.programs.find(function(p) { return p.tempCost <= afterPerm; });
                    var afterTemp = bestTemp ? Math.round(afterPerm - bestTemp.tempCost) : afterPerm;
                    var rowSt = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", borderBottom: "1px solid " + (isDark ? "#1A3040" : "#D6EAF8") };
                    var lastRowSt = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" };
                    var labelSt2 = { fontWeight: 600, color: c.textSecondary || "#64748b" };
                    var valSt2 = { fontWeight: 800, textAlign: "right" };
                    return (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={rowSt}>
                          <span style={labelSt2}>Permanent buydown to <span style={{ color: c.navy || navy }}>{splitResults.permRate.toFixed(3)}%</span></span>
                          <span style={{ ...valSt2, color: c.navy || navy }}>${Math.round(splitResults.permCost).toLocaleString("en-US")}</span>
                        </div>
                        <div style={rowSt}>
                          <span style={labelSt2}>Saves forever</span>
                          <span style={{ ...valSt2, color: "#1A7A3A" }}>${splitResults.permSavings.toLocaleString("en-US")}/mo</span>
                        </div>
                        <div style={rowSt}>
                          <span style={labelSt2}>Remaining after perm</span>
                          <span style={{ ...valSt2, color: c.navy || navy }}>${afterPerm.toLocaleString("en-US")}</span>
                        </div>
                        {bestTemp ? (
                          <>
                            <div style={rowSt}>
                              <span style={labelSt2}>{bestTemp.name} Buydown</span>
                              <span style={{ ...valSt2, color: c.navy || navy }}>${Math.round(bestTemp.tempCost).toLocaleString("en-US")}</span>
                            </div>
                            <div style={lastRowSt}>
                              <span style={{ fontWeight: 700, color: c.text || "#1B2A3B" }}>Left for closing costs</span>
                              <span style={{ ...valSt2, fontSize: 14, color: afterTemp > 0 ? "#1A7A3A" : "#DC2626" }}>
                                {afterTemp >= 0 ? "$" + afterTemp.toLocaleString("en-US") : "−$" + Math.abs(afterTemp).toLocaleString("en-US")}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div style={lastRowSt}>
                            <span style={{ color: "#B07800", fontStyle: "italic" }}>No temporary buydown fits within the remaining budget.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
              {splitResults && !splitResults.bestPermRow && parseFloat(permBudget) > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#B07800", fontStyle: "italic" }}>
                  No permanent buydown fits within ${parseFloat(permBudget).toLocaleString("en-US")}. Increase the permanent budget or set up the Interest Rates tab.
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Target Payment Solver ─────────────────────────────────────────── */}
      {mkt > 0 && la > 0 && (
        <div style={{ marginBottom: 30 }}>

          {/* Input card */}
          <div style={{ borderRadius: 10, border: "1.5px solid " + border, overflow: "hidden", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,20,60,0.06)" }}>
            <div style={{ background: navy, padding: "11px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Target Payment Solver</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Find the cheapest buydown structure to hit a specific monthly payment</div>
            </div>
            <div style={{ padding: "14px 18px", background: isDark ? "#0D1820" : "#F7FAFC", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: c.textSecondary || "#64748b" }}>Target:</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: c.text || "#1B2A3B" }}>$</span>
                <input
                  type="text"
                  value={targetPayFocused ? targetPayment : (targetPayNum > 0 ? Math.round(targetPayNum).toLocaleString("en-US") : targetPayment)}
                  onChange={function(e) { setTargetPayment(e.target.value.replace(/[^0-9.]/g, "")); }}
                  onFocus={function() { setTargetPayFocused(true); }}
                  onBlur={function() { setTargetPayFocused(false); }}
                  placeholder="0"
                  style={{ width: 110, padding: "7px 10px", borderRadius: 6, border: "1px solid " + border, background: c.bg || "#fff", color: c.text || "#1B2A3B", fontSize: 15, fontWeight: 700, fontFamily: font, textAlign: "right" }}
                />
                <span style={{ fontSize: 14, color: c.textSecondary || "#64748b" }}>/mo</span>
              </div>
              <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid " + border }}>
                {[{ v: "pi", label: "P&I" }, { v: "piti", label: "PITI" }].map(function(opt) {
                  return (
                    <button key={opt.v} tabIndex={-1} onClick={function() { setTargetMode(opt.v); }} style={{ padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none", fontFamily: font, background: targetMode === opt.v ? navy : (c.bg || "#fff"), color: targetMode === opt.v ? "#fff" : (c.text || "#1B2A3B") }}>{opt.label}</button>
                  );
                })}
              </div>
              {targetMode === "piti" && targetPayNum > 0 && (tax + ins + pmiM) > 0 && (
                <div style={{ padding: "5px 10px", background: c.bg || "#fff", border: "1px solid " + border, borderRadius: 6, fontSize: 11, color: c.textSecondary || "#64748b" }}>
                  = <strong style={{ color: c.text || "#1B2A3B" }}>${Math.max(0, Math.round(targetPayNum - tax - ins - pmiM)).toLocaleString("en-US")}</strong> P&amp;I target
                  {" "}(T+I+PMI = ${Math.round(tax + ins + pmiM).toLocaleString("en-US")}/mo)
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {(function() {
            var st = !solverResults ? "empty"
              : solverResults.alreadyMet ? "met"
              : !solverResults.achievable ? "none"
              : "ok";
            var emptyBody = (
              <div style={{ padding: "28px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, color: c.textSecondary || "#94A3B0", fontStyle: "italic" }}>Enter a target payment above</span>
              </div>
            );
            var metBody = (
              <div style={{ padding: "14px 16px", background: isDark ? "#1A3D28" : "#EEF9F0" }}>
                <div style={{ fontSize: 12, color: isDark ? "#5DE890" : "#1A7A3A", fontWeight: 600, lineHeight: 1.5 }}>
                  ✓ Market rate payment (${solverResults && solverResults.mktPI.toLocaleString("en-US")}/mo) already meets your target — no buydown needed.
                </div>
              </div>
            );
            var noneBody = (
              <div style={{ padding: "14px 16px", background: c.bgAlt || "#F9FBFC" }}>
                <div style={{ fontSize: 12, color: "#DC2626", fontStyle: "italic", lineHeight: 1.5 }}>Target not achievable with current rate options — try a higher target or set up the Interest Rates tab.</div>
              </div>
            );

            // Shared metric chip (used inside the 3 strategy cards)
            var mChip = function(label, val, sub, color) {
              return (
                <div style={{ textAlign: "center", padding: "11px 8px", borderRight: "1px solid " + border }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: color || (c.navy || navy), lineHeight: 1 }}>{val}</div>
                  {sub && <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 3 }}>{sub}</div>}
                </div>
              );
            };
            var rowStat = function(label, val, valColor) {
              return (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                  <span style={{ fontSize: 11, color: c.textSecondary || "#64748b" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: valColor || (c.text || "#1B2A3B") }}>{val}</span>
                </div>
              );
            };

            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

                  {/* ── Card 1: Permanent Buydown ── */}
                  {(function() {
                    var pr = st === "ok" ? solverResults.permResult : null;
                    var isBest = pr && pr.cost === solverResults.cheapestOverall;
                    var leftover = pr && concDollar > 0 ? Math.round(concDollar - pr.cost) : null;
                    var piti = pr ? Math.round(pr.pi + tax + ins + pmiM) : null;
                    var hasTI = (tax + ins + pmiM) > 0;
                    return (
                      <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid " + (isBest ? "#27AE60" : border), boxShadow: isBest ? "0 0 0 2px rgba(39,174,96,0.2)" : "0 2px 8px rgba(0,20,60,0.06)", display: "flex", flexDirection: "column" }}>
                        <div style={{ background: (st === "ok" && pr) ? navy : (isDark ? "#374151" : "#94A3B8"), padding: "12px 16px", position: "relative" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Permanent Buydown</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Locks in a lower rate for the life of the loan</div>
                          {isBest && <span style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 800, background: "#27AE60", color: "#fff", padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em" }}>BEST VALUE</span>}
                        </div>
                        {st === "empty" ? emptyBody : st === "met" ? metBody : st === "none" ? noneBody : pr ? (
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: isBest ? (isDark ? "#1A3D28" : "#F0FAF4") : (c.bgAlt || "#F9FBFC") }}>
                            <div style={{ display: "grid", gridTemplateColumns: hasTI ? "1fr 1fr 1fr" : "1fr 1fr", borderBottom: "1px solid " + border, overflow: "hidden" }}>
                              {mChip("Note Rate", pr.rate.toFixed(3) + "%", "permanent")}
                              {mChip("P&I /mo", "$" + pr.pi.toLocaleString("en-US"), "per month", isDark ? "#5DE890" : "#1A7A3A")}
                              {hasTI && <div style={{ textAlign: "center", padding: "11px 8px" }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>PITI /mo</div>
                                <div style={{ fontSize: 19, fontWeight: 800, color: c.navy || navy, lineHeight: 1 }}>${piti.toLocaleString("en-US")}</div>
                                <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 3 }}>all-in</div>
                              </div>}
                            </div>
                            <div style={{ padding: "10px 14px", flex: 1 }}>
                              {rowStat("Builder cost", "$" + pr.cost.toLocaleString("en-US") + " (" + (pr.costPct != null ? pr.costPct.toFixed(3) : (pr.cost / sp * 100).toFixed(3)) + "% of price)")}
                              {leftover != null && rowStat("Left for closing costs", (leftover >= 0 ? "$" : "−$") + Math.abs(leftover).toLocaleString("en-US"), leftover >= 0 ? (isDark ? "#5DE890" : "#1A7A3A") : "#DC2626")}
                            </div>
                            <div style={{ padding: "8px 14px", background: isDark ? "#0D2018" : "#E6F4EC", borderTop: "1px solid " + border, fontSize: 11, fontWeight: 700, color: isDark ? "#5DE890" : "#1A7A3A" }}>
                              Saves ${pr.savings.toLocaleString("en-US")}/mo forever vs. market rate
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: "14px 16px", background: c.bgAlt || "#F9FBFC" }}>
                            <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic", lineHeight: 1.6 }}>Not achievable via permanent buydown — target is below the floor rate payment.</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Card 2: Temporary Buydown ── */}
                  {(function() {
                    var results = st === "ok" ? solverResults.tempResults : [];
                    var cheapestTempCost = results.length > 0 ? Math.min.apply(null, results.filter(function(t) { return t.cost != null; }).map(function(t) { return t.cost; })) : null;
                    var isBest = cheapestTempCost != null && cheapestTempCost === solverResults.cheapestOverall;
                    var best = results.length > 0 ? results.reduce(function(b, t) { return (t.cost != null && (!b || t.cost < b.cost)) ? t : b; }, null) : null;
                    var bestPITI = best ? Math.round(best.year1PI + tax + ins + pmiM) : null;
                    var bestLeftover = best && concDollar > 0 ? Math.round(concDollar - best.cost) : null;
                    var hasTI = (tax + ins + pmiM) > 0;
                    return (
                      <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid " + (isBest ? "#27AE60" : border), boxShadow: isBest ? "0 0 0 2px rgba(39,174,96,0.2)" : "0 2px 8px rgba(0,20,60,0.06)", display: "flex", flexDirection: "column" }}>
                        <div style={{ background: (st === "ok" && results.length > 0) ? navy : (isDark ? "#374151" : "#94A3B8"), padding: "12px 16px", position: "relative" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Temporary Buydown</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{mkt > 0 ? "Hits target in Year 1 — note rate stays at " + mkt.toFixed(3) + "%" : "Hits target in Year 1 only"}</div>
                          {isBest && <span style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 800, background: "#27AE60", color: "#fff", padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em" }}>BEST VALUE</span>}
                        </div>
                        {st === "empty" ? emptyBody : st === "met" ? metBody : st === "none" ? noneBody : results.length > 0 && best ? (
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: isBest ? (isDark ? "#1A3D28" : "#F0FAF4") : (c.bgAlt || "#F9FBFC") }}>
                            <div style={{ display: "grid", gridTemplateColumns: hasTI ? "1fr 1fr 1fr" : "1fr 1fr", borderBottom: "1px solid " + border, overflow: "hidden" }}>
                              {mChip("Yr 1 Rate", best.year1Rate.toFixed(3) + "%", best.name)}
                              {mChip("Yr 1 P&I", "$" + best.year1PI.toLocaleString("en-US"), "per month", isDark ? "#5DE890" : "#1A7A3A")}
                              {hasTI && <div style={{ textAlign: "center", padding: "11px 8px" }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Yr 1 PITI</div>
                                <div style={{ fontSize: 19, fontWeight: 800, color: c.navy || navy, lineHeight: 1 }}>${bestPITI.toLocaleString("en-US")}</div>
                                <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 3 }}>all-in</div>
                              </div>}
                            </div>
                            <div style={{ padding: "10px 14px" }}>
                              {rowStat("Builder cost (" + best.name + ")", "$" + best.cost.toLocaleString("en-US"))}
                              {bestLeftover != null && rowStat("Left for closing costs", (bestLeftover >= 0 ? "$" : "−$") + Math.abs(bestLeftover).toLocaleString("en-US"), bestLeftover >= 0 ? (isDark ? "#5DE890" : "#1A7A3A") : "#DC2626")}
                            </div>
                            {results.length > 1 && (
                              <div style={{ borderTop: "1px solid " + border, flex: 1 }}>
                                <div style={{ padding: "4px 14px", fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", background: isDark ? "#0D1820" : "#EEF2F7" }}>All Options</div>
                                {results.map(function(t, i) {
                                  var isRowBest = t.cost === solverResults.cheapestOverall;
                                  return (
                                    <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 14px", background: isRowBest ? (isDark ? "#1C4830" : "#D4F5DF") : (i % 2 === 0 ? "transparent" : (isDark ? "#0D1820" : "#F9FBFC")), borderBottom: i < results.length - 1 ? "1px solid " + border : "none" }}>
                                      <span style={{ fontSize: 11, fontWeight: isRowBest ? 700 : 500, color: c.text || "#1B2A3B" }}>{t.name}{isRowBest ? " ✓" : ""}</span>
                                      <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 10, color: c.textSecondary || "#64748b" }}>{t.year1Rate.toFixed(3)}%</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: c.navy || navy }}>{t.cost != null ? "$" + t.cost.toLocaleString("en-US") : "—"}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{ padding: "7px 14px", background: isDark ? "#0D2018" : "#E6F4EC", borderTop: "1px solid " + border, fontSize: 10, fontWeight: 600, color: isDark ? "#5DE890" : "#1A7A3A", fontStyle: "italic" }}>
                              Resets to {mkt.toFixed(3)}% note rate after the buydown period
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: "14px 16px", background: c.bgAlt || "#F9FBFC" }}>
                            <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic", lineHeight: 1.6 }}>Not achievable in Year 1 via temporary buydown — even a 3/2/1 produces ${Math.round(calcPI(preferCompanion(Math.max(mkt - 3, 0.001)), la, term)).toLocaleString("en-US")}/mo.</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Card 3: Combined Strategy ── */}
                  {(function() {
                    var combos = st === "ok" ? solverResults.combinedResults.slice(0, 4) : [];
                    var isBest = combos.length > 0 && combos[0].totalCost === solverResults.cheapestOverall;
                    var best = combos.length > 0 ? combos[0] : null;
                    var bestPITI = best ? Math.round(best.year1PI + tax + ins + pmiM) : null;
                    var bestLeftover = best && concDollar > 0 ? Math.round(concDollar - best.totalCost) : null;
                    var hasTI = (tax + ins + pmiM) > 0;
                    return (
                      <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid " + (isBest ? "#27AE60" : border), boxShadow: isBest ? "0 0 0 2px rgba(39,174,96,0.2)" : "0 2px 8px rgba(0,20,60,0.06)", display: "flex", flexDirection: "column" }}>
                        <div style={{ background: (st === "ok" && combos.length > 0) ? navy : (isDark ? "#374151" : "#94A3B8"), padding: "12px 16px", position: "relative" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Combined Strategy</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Permanent buydown + temporary subsidy on top</div>
                          {isBest && <span style={{ position: "absolute", top: 10, right: 12, fontSize: 9, fontWeight: 800, background: "#27AE60", color: "#fff", padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em" }}>BEST VALUE</span>}
                        </div>
                        {st === "empty" ? emptyBody : st === "met" ? metBody : st === "none" ? noneBody : combos.length > 0 && best ? (
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: isBest ? (isDark ? "#1A3D28" : "#F0FAF4") : (c.bgAlt || "#F9FBFC") }}>
                            <div style={{ display: "grid", gridTemplateColumns: hasTI ? "1fr 1fr 1fr" : "1fr 1fr", borderBottom: "1px solid " + border, overflow: "hidden" }}>
                              {mChip("Yr 1 Rate", best.year1Rate.toFixed(3) + "%", best.permRate.toFixed(3) + "% perm")}
                              {mChip("Yr 1 P&I", "$" + best.year1PI.toLocaleString("en-US"), "per month", isDark ? "#5DE890" : "#1A7A3A")}
                              {hasTI && <div style={{ textAlign: "center", padding: "11px 8px" }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Yr 1 PITI</div>
                                <div style={{ fontSize: 19, fontWeight: 800, color: c.navy || navy, lineHeight: 1 }}>${bestPITI.toLocaleString("en-US")}</div>
                                <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 3 }}>all-in</div>
                              </div>}
                            </div>
                            <div style={{ padding: "10px 14px" }}>
                              {rowStat("Total cost (" + best.permRate.toFixed(3) + "% + " + best.name + ")", "$" + best.totalCost.toLocaleString("en-US"))}
                              {bestLeftover != null && rowStat("Left for closing costs", (bestLeftover >= 0 ? "$" : "−$") + Math.abs(bestLeftover).toLocaleString("en-US"), bestLeftover >= 0 ? (isDark ? "#5DE890" : "#1A7A3A") : "#DC2626")}
                            </div>
                            {combos.length > 1 && (
                              <div style={{ borderTop: "1px solid " + border, flex: 1 }}>
                                <div style={{ padding: "4px 14px", fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", background: isDark ? "#0D1820" : "#EEF2F7" }}>Other Combinations</div>
                                {combos.slice(1).map(function(combo, i) {
                                  return (
                                    <div key={combo.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 14px", background: i % 2 === 0 ? "transparent" : (isDark ? "#0D1820" : "#F9FBFC"), borderBottom: i < combos.length - 2 ? "1px solid " + border : "none" }}>
                                      <span style={{ fontSize: 11, color: c.text || "#1B2A3B" }}>{combo.permRate.toFixed(3)}% + {combo.name}</span>
                                      <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 10, color: c.textSecondary || "#64748b" }}>{combo.year1Rate.toFixed(3)}% Yr1</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: c.navy || navy }}>${combo.totalCost.toLocaleString("en-US")}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div style={{ padding: "7px 14px", background: isDark ? "#0D2018" : "#E6F4EC", borderTop: "1px solid " + border, fontSize: 10, fontWeight: 600, color: isDark ? "#5DE890" : "#1A7A3A", fontStyle: "italic" }}>
                              Year 1 hits target — stays at {best.permRate.toFixed(3)}% note rate thereafter
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: "14px 16px", background: c.bgAlt || "#F9FBFC" }}>
                            <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic", lineHeight: 1.6 }}>
                              {solverResults && solverResults.permResult ? "Permanent buydown alone achieves the target — no combined strategy needed." : "No combined strategy available with current rate options."}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>

                {/* ── Permanent Goal Card ── */}
                {solverResults && !solverResults.alreadyMet && targetPIGoal > 0 && (function() {
                  var pr         = solverResults.permResult;
                  var mktPIval   = solverResults.mktPI;
                  var tihoaPmt   = Math.round(tax + ins + pmiM);
                  var hasTIHOA   = tihoaPmt > 0;
                  var targetPITI = targetMode === "piti" ? Math.round(targetPayNum) : Math.round(targetPayNum + tihoaPmt);

                  var affordableRows = rowData.filter(function(r) {
                    return !r.isCompanion && r.col7 != null && r.col7 > 0 && concDollar > 0 && r.col7 <= concDollar;
                  });
                  var bestAffordRow  = affordableRows.length > 0 ? affordableRows[0] : null;
                  var bestAffordRate = bestAffordRow ? preferCompanion(bestAffordRow.rate) : null;
                  var bestAffordPI   = bestAffordRate ? Math.round(calcPI(bestAffordRate, la, term)) : null;
                  var bestAffordPITI = bestAffordPI != null ? Math.round(bestAffordPI + tihoaPmt) : null;
                  var bestAffordCost = bestAffordRow ? bestAffordRow.col7 : null;

                  var scenario  = pr && concDollar > 0 && pr.cost <= concDollar ? "achieved"
                                : pr ? "over-budget"
                                : "not-achievable";

                  var permRate  = pr ? pr.rate : null;
                  var permPI    = pr ? pr.pi : null;
                  var permPITI  = permPI != null ? Math.round(permPI + tihoaPmt) : null;
                  var permCost  = pr ? pr.cost : null;
                  var leftover  = (scenario === "achieved" && permCost != null) ? Math.round(concDollar - permCost) : null;
                  var shortfall = (scenario === "over-budget" && permCost != null) ? Math.round(permCost - concDollar) : null;
                  var shortfallPct = (shortfall != null && sp > 0) ? (shortfall / sp * 100).toFixed(2) : null;
                  var neededTotal  = shortfall != null ? Math.round(concDollar + shortfall) : null;
                  var neededPct    = (neededTotal != null && sp > 0) ? (neededTotal / sp * 100).toFixed(2) : null;

                  var monthlySav = (scenario === "achieved" && permPI != null) ? Math.round(mktPIval - permPI) : 0;
                  var beMonths   = (monthlySav > 0 && permCost > 0) ? Math.ceil(permCost / monthlySav) : null;
                  var beYrs      = beMonths ? Math.floor(beMonths / 12) : 0;
                  var beMos      = beMonths ? beMonths % 12 : 0;
                  var sav5       = monthlySav * 60;
                  var sav10      = monthlySav * 120;
                  var savLife    = monthlySav * (term * 12);
                  var roi        = (permCost > 0 && savLife > 0) ? Math.round(savLife / permCost * 10) / 10 : null;

                  var borderColor = scenario === "achieved" ? "#27AE60" : scenario === "over-budget" ? "#E6A817" : "#DC2626";
                  var hdrBg       = scenario === "achieved" ? "#1A6B5A" : scenario === "over-budget" ? "#B07800" : "#7B3F00";
                  var cardTitle   = scenario === "achieved"
                    ? "✓ Hitting Your Target: $" + targetPITI.toLocaleString("en-US") + "/mo " + (hasTIHOA ? "PITI" : "P&I") + " — Permanently"
                    : scenario === "over-budget"
                    ? "⚠ Almost There — $" + shortfall.toLocaleString("en-US") + " Short of $" + targetPITI.toLocaleString("en-US") + "/mo"
                    : "Can't Hit Your Target of $" + targetPITI.toLocaleString("en-US") + "/mo " + (hasTIHOA ? "PITI" : "P&I") + " — Even at Floor Rate";
                  var cardSub     = scenario === "achieved"
                    ? "A permanent buydown achieves this target within the current concession budget."
                    : scenario === "over-budget"
                    ? "A rate exists that hits this target, but the cost exceeds the available concession budget."
                    : "The target payment cannot be reached via permanent buydown — even the lowest available rate is too high.";

                  var chip = function(label, value, sub, color) {
                    return (
                      <div style={{ background: isDark ? "#111E2C" : "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid " + border }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: color || (c.navy || navy), lineHeight: 1 }}>{value}</div>
                        {sub && <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 3 }}>{sub}</div>}
                      </div>
                    );
                  };
                  var sChip = function(label, value, sub) {
                    return (
                      <div style={{ background: isDark ? "#111E2C" : "#fff", borderRadius: 8, padding: "9px 12px", border: "1px solid " + border }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? "#5DE890" : "#1A7A3A" }}>{value}</div>
                        {sub && <div style={{ fontSize: 10, color: c.textSecondary || "#64748b", marginTop: 2 }}>{sub}</div>}
                      </div>
                    );
                  };
                  var secLabel = function(text) {
                    return <div style={{ fontSize: 10, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, marginTop: 14 }}>{text}</div>;
                  };

                  return (
                    <div style={{ borderRadius: 10, overflow: "hidden", border: "2px solid " + borderColor, boxShadow: "0 2px 10px rgba(0,20,60,0.08)" }}>
                      <div style={{ background: hdrBg, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{cardTitle}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{cardSub}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Target</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>${targetPITI.toLocaleString("en-US")}/mo</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{hasTIHOA ? "PITI" : "P&I"}</div>
                        </div>
                      </div>

                      <div style={{ padding: "4px 16px 16px", background: isDark ? "#0D1820" : "#F7FAFC" }}>

                        {/* ACHIEVED */}
                        {scenario === "achieved" && (
                          <div>
                            {secLabel("What's Needed")}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                              {chip("Rate Needed", permRate.toFixed(3) + "%", "permanent note rate")}
                              {chip("Permanent P&I", "$" + permPI.toLocaleString("en-US") + "/mo", "principal & interest", isDark ? "#5DE890" : "#1A7A3A")}
                              {hasTIHOA && chip("Permanent PITI", "$" + permPITI.toLocaleString("en-US") + "/mo", "all-in monthly", isDark ? "#5DE890" : "#1A7A3A")}
                              {chip("Monthly Savings", "$" + monthlySav.toLocaleString("en-US") + "/mo", "vs. market rate", c.navy || navy)}
                            </div>
                            {secLabel("Builder's Investment")}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                              {chip("Buydown Cost", "$" + permCost.toLocaleString("en-US"), (permCost / sp * 100).toFixed(3) + "% of purchase price")}
                              {chip("Left for Closing Costs", (leftover >= 0 ? "$" : "−$") + Math.abs(leftover).toLocaleString("en-US"), "remaining from concession budget", leftover >= 0 ? (isDark ? "#5DE890" : "#1A7A3A") : "#DC2626")}
                              {beMonths && chip("Break-Even", (beYrs > 0 ? beYrs + "y " : "") + (beMos > 0 ? beMos + "m" : ""), "buyer recoups buydown cost")}
                            </div>
                            {secLabel("Long-Term Buyer Savings vs. Market Rate")}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                              {sChip("5-Year Savings", "$" + sav5.toLocaleString("en-US"))}
                              {sChip("10-Year Savings", "$" + sav10.toLocaleString("en-US"))}
                              {sChip("Lifetime Savings", "$" + savLife.toLocaleString("en-US"), "over " + term + " years")}
                              {roi != null && sChip("Buydown ROI", roi + "×", "return on builder's cost")}
                            </div>
                            {roi != null && (
                              <div style={{ marginTop: 10, padding: "9px 14px", background: isDark ? "#111E2C" : "#fff", borderRadius: 8, border: "1px solid " + border, fontSize: 12, color: c.textSecondary || "#64748b", lineHeight: 1.5 }}>
                                Builder spends <strong style={{ color: c.navy || navy }}>${permCost.toLocaleString("en-US")}</strong> today → buyer saves{" "}
                                <strong style={{ color: isDark ? "#5DE890" : "#1A7A3A" }}>${monthlySav.toLocaleString("en-US")}/mo</strong> forever →{" "}
                                <strong style={{ color: isDark ? "#5DE890" : "#1A7A3A" }}>${savLife.toLocaleString("en-US")}</strong> total over {term} years — a <strong style={{ color: c.navy || navy }}>{roi}× return</strong> on the builder's investment.
                              </div>
                            )}
                          </div>
                        )}

                        {/* OVER BUDGET */}
                        {scenario === "over-budget" && (
                          <div>
                            {secLabel("To Hit the Target Permanently")}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                              {chip("Rate Needed", permRate.toFixed(3) + "%", "permanent note rate", c.navy || navy)}
                              {chip("Cost to Get There", "$" + permCost.toLocaleString("en-US"), (permCost / sp * 100).toFixed(3) + "% of price", "#DC2626")}
                              {chip("Current Budget", "$" + Math.round(concDollar).toLocaleString("en-US"), "available concessions", "#B07800")}
                              {chip("Shortfall", "$" + shortfall.toLocaleString("en-US"), shortfallPct + "% more of price needed", "#DC2626")}
                            </div>
                            <div style={{ marginTop: 12, padding: "11px 16px", background: isDark ? "#2D1B00" : "#FFF8E7", border: "1px solid " + (isDark ? "#5C3A00" : "#F0D080"), borderLeft: "4px solid #E6A817", borderRadius: 8, fontSize: 12, color: c.text || "#1B2A3B", lineHeight: 1.6 }}>
                              <strong style={{ color: isDark ? "#FFD700" : "#B07800" }}>To permanently hit ${targetPITI.toLocaleString("en-US")}/mo {hasTIHOA ? "PITI" : "P&I"}:</strong>{" "}
                              Builder concessions would need to increase by <strong>${shortfall.toLocaleString("en-US")}</strong> ({shortfallPct}% of price) — from{" "}
                              <strong>${Math.round(concDollar).toLocaleString("en-US")}</strong> to <strong>${neededTotal.toLocaleString("en-US")}</strong> total ({neededPct}% of price).
                            </div>
                            {bestAffordRow && (
                              <div>
                                {secLabel("Best Achievable Within Current Budget")}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: 12, background: isDark ? "#0D1B26" : "#EBF5FB", border: "1px solid " + (isDark ? "#1A3040" : "#C8E4F5"), borderRadius: 8 }}>
                                  {chip("Best Perm Rate", bestAffordRate.toFixed(3) + "%", "within concession budget", c.navy || navy)}
                                  {chip("P&I at This Rate", "$" + bestAffordPI.toLocaleString("en-US") + "/mo", "principal & interest", c.navy || navy)}
                                  {hasTIHOA && chip("PITI at This Rate", "$" + bestAffordPITI.toLocaleString("en-US") + "/mo", "$" + Math.round(bestAffordPITI - targetPITI).toLocaleString("en-US") + " above target", "#B07800")}
                                  {chip("Cost Used", "$" + Math.round(bestAffordCost).toLocaleString("en-US"), "$" + Math.round(concDollar - bestAffordCost).toLocaleString("en-US") + " remaining", c.navy || navy)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* NOT ACHIEVABLE */}
                        {scenario === "not-achievable" && (function() {
                          var floorR    = rows.filter(function(r) { return !r.isCompanion; })[0];
                          var floorPI   = floorR ? Math.round(calcPI(floorR.rate, la, term)) : null;
                          var floorPITI = floorPI != null ? Math.round(floorPI + tihoaPmt) : null;
                          var gap       = (floorPITI != null) ? Math.round(floorPITI - targetPITI) : null;
                          return (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ padding: "12px 16px", background: isDark ? "#2D0A0A" : "#FFF0F0", border: "1px solid " + (isDark ? "#5C1A1A" : "#FCA5A5"), borderLeft: "4px solid #DC2626", borderRadius: 8, marginBottom: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", marginBottom: 4 }}>Why this target can't be reached via permanent rate buydown:</div>
                                <div style={{ fontSize: 12, color: c.text || "#1B2A3B", lineHeight: 1.6 }}>
                                  {floorPITI != null
                                    ? <>Even at the floor rate of <strong>{floorR.rate.toFixed(3)}%</strong>, the {hasTIHOA ? "PITI" : "P&I"} would be <strong>${floorPITI.toLocaleString("en-US")}/mo</strong> — still <strong style={{ color: "#DC2626" }}>${gap.toLocaleString("en-US")} above</strong> your ${targetPITI.toLocaleString("en-US")}/mo target. To reach this payment, the loan amount or purchase price would need to be reduced.</>
                                    : "No floor rate available — set up the Interest Rates tab first."}
                                </div>
                              </div>
                              {bestAffordRow && (
                                <div>
                                  {secLabel("Best Available Within Current Budget")}
                                  <div style={{ display: "grid", gridTemplateColumns: hasTIHOA ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
                                    {chip("Best Perm Rate", bestAffordRate.toFixed(3) + "%", "within concession budget", c.navy || navy)}
                                    {chip("P&I /mo", "$" + bestAffordPI.toLocaleString("en-US"), "principal & interest", c.navy || navy)}
                                    {hasTIHOA && chip("PITI /mo", "$" + bestAffordPITI.toLocaleString("en-US"), "$" + Math.round(bestAffordPITI - targetPITI).toLocaleString("en-US") + " above target", "#B07800")}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })()}
        </div>
      )}

      {/* ── Rate table ──────────────────────────────────────────────────────── */}

      {!hasRateTable && (
        <div style={{
          padding: "16px 20px",
          background: c.bgAlt || "#F7F9FC", border: "1px solid " + border,
          borderRadius: 8, fontSize: 13, color: c.textSecondary || "#64748b", fontStyle: "italic",
        }}>
          Set up the Interest Rates tab first — enter market rate, floor rate, and step costs for <strong>{activeMeta.label}</strong> to populate this table.
        </div>
      )}

      {hasRateTable && (
        <>
          {/* Table header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.navy || navy }}>
                Permanent Buydown Options
              </div>
              <span style={{
                fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
                padding: "3px 9px", borderRadius: 4,
                background: activeMeta.color, color: "#fff",
              }}>
                {activeMeta.label.toUpperCase()} RATES
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {concDollar > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.textSecondary || "#64748b" }}>
                  <div style={{ width: 12, height: 12, background: isDark ? "#1A3D28" : "#C6F0D4", border: "1px solid " + border, borderRadius: 2, flexShrink: 0 }} />
                  Within ${Math.round(concDollar).toLocaleString("en-US")} concession budget
                </div>
              )}
              {parseFloat(permBudget) > 0 && splitResults && splitResults.bestPermRow && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.textSecondary || "#64748b" }}>
                  <div style={{ width: 12, height: 12, background: splitPermBg, border: "1px solid #C9A84C", borderRadius: 2, flexShrink: 0 }} />
                  Split target: {splitResults.permRate.toFixed(3)}%
                </div>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{
            padding: "12px 16px", marginBottom: 14,
            background: isDark ? "#1A2535" : "#FFF8E7",
            border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"),
            borderLeft: "4px solid #E6A817",
            borderRadius: 7, fontSize: 12, color: c.text || "#1B2A3B", lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ For illustrative purposes only.</span>
            {" "}The interest rates shown in this table are sample rates provided as examples to illustrate the potential impact of a permanent rate buydown. <strong>These rates are not a commitment to lend and do not constitute a loan offer or guarantee.</strong>{" "}
            Actual interest rates change daily and are subject to a wide range of factors including, but not limited to: credit score and history, loan program (Conventional, FHA, VA, USDA, Jumbo, etc.), loan-to-value ratio, debt-to-income ratio, occupancy type, property type, loan amount, lock period, market conditions, and lender overlays.{" "}
            Borrowers should consult with a licensed mortgage professional for current rate quotes based on their specific financial profile.
            {fmtDate(irRateDate) && (
              <span style={{ display: "block", marginTop: 8, fontStyle: "italic", color: c.textSecondary || "#64748b" }}>
                Sample rates last updated: <strong style={{ color: c.text || "#1B2A3B" }}>{fmtDate(irRateDate)}</strong>
              </span>
            )}
          </div>

          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid " + border, boxShadow: "0 2px 10px rgba(0,20,60,0.07)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
              <thead>
                <tr style={{ background: navy }}>
                  <th rowSpan={2} style={TH1}>Rate</th>
                  <th rowSpan={2} style={{ ...TH, minWidth: 80 }}>Builder Points (%)</th>
                  <th rowSpan={2} style={{ ...TH, minWidth: 80 }}>Builder Cost ($)</th>
                  <th rowSpan={2} style={{ ...TH, minWidth: 75 }}>P&amp;I /mo</th>
                  <th rowSpan={2} style={{ ...TH, minWidth: 75 }}>PITI /mo</th>
                  <th rowSpan={2} style={{ ...TH, minWidth: 80 }}>Breakeven</th>
                  <th colSpan={3} style={{ ...THPP1, padding: "6px 14px", minWidth: 0 }}>
                    — Purchasing Power —
                  </th>
                </tr>
                <tr style={{ background: ppBg }}>
                  <th style={{ ...THPP1, padding: "6px 14px", minWidth: 90 }}>Monthly Savings</th>
                  <th style={{ ...THPP, padding: "6px 14px", minWidth: 100 }}>Equiv. Price @ Mkt</th>
                  <th style={{ ...THPP, padding: "6px 14px", minWidth: 90 }}>Effective Discount</th>
                </tr>
              </thead>
              <tbody>
                {rowData.slice().reverse().map((row, idx) => {
                  const isMarket = !row.isCompanion && Math.abs(row.rate - mkt) < 0.0005;
                  const isFloor  = !row.isCompanion && Math.abs(row.rate - flr)  < 0.0005;
                  return (
                    <tr key={row.rate.toFixed(3) + idx}>

                      {/* Col 1 — Rate */}
                      <td style={TD1(row)}>
                        <span style={{ fontWeight: isMarket ? 800 : isFloor ? 700 : row.isCompanion ? 400 : 500 }}>
                          {row.rate.toFixed(3)}%
                        </span>
                        {isMarket && badge("MARKET", COLORS.blue)}
                        {isFloor  && badge("FLOOR",  COLORS.green)}
                        {row.isCompanion && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: c.textSecondary || "#94A3B0", fontStyle: "italic" }}>
                            (= {row.companionOf.toFixed(3)}%)
                          </span>
                        )}
                      </td>

                      {/* Col 6 — Builder Points % (rounded to 0.125%) */}
                      <td style={TD(row)}>
                        <span style={{ color: row.col6 > 0 ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0") }}>
                          {row.col6 != null && row.col6 > 0 ? fmtP(row.col6) : "—"}
                        </span>
                      </td>

                      {/* Col 7 — Builder Cost $ */}
                      <td style={TD(row)}>
                        <span style={{
                          fontWeight: row.col7 > 0 ? 600 : 400,
                          color: row.col7 > 0 ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0"),
                        }}>
                          {row.col7 != null && row.col7 > 0 ? fmtD(row.col7) : "—"}
                        </span>
                      </td>

                      {/* P&I */}
                      <td style={TD(row)}>
                        <span style={{ fontWeight: 600, color: row.pi ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0") }}>
                          {row.pi ? fmtMo(row.pi) : "—"}
                        </span>
                      </td>

                      {/* PITI */}
                      <td style={TD(row)}>
                        <span style={{ fontWeight: 600, color: row.piti ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0") }}>
                          {row.piti ? fmtMo(row.piti) : "—"}
                        </span>
                      </td>

                      {/* Breakeven */}
                      <td style={TD(row)}>
                        {row.breakeven != null ? (
                          <span style={{ fontWeight: 600, color: row.breakeven <= 24 ? (c.green || "#16a34a") : row.breakeven <= 48 ? (c.gold || "#b45309") : (c.textSecondary || "#94A3B0") }}>
                            {row.breakeven < 12
                              ? row.breakeven + " mo"
                              : (Math.floor(row.breakeven / 12) + " yr" + (row.breakeven % 12 > 0 ? " " + (row.breakeven % 12) + " mo" : ""))}
                          </span>
                        ) : (
                          <span style={{ color: c.textSecondary || "#94A3B0" }}>—</span>
                        )}
                      </td>

                      {/* Monthly Savings */}
                      <td style={{ ...TD(row), borderLeft: "3px solid " + ppBg }}>
                        <span style={{ fontWeight: 600, color: (row.piSavings > 0) ? ppBg : (c.textSecondary || "#94A3B0") }}>
                          {row.piSavings > 0 ? ("$" + row.piSavings.toLocaleString("en-US") + "/mo") : (row.piSavings === 0 ? "—" : "—")}
                        </span>
                      </td>

                      {/* Equiv. Price @ Market Rate */}
                      <td style={TD(row)}>
                        <span style={{ fontWeight: 600, color: (row.ppPrice && row.ppPrice < sp) ? ppBg : (c.text || "#1B2A3B") }}>
                          {row.ppPrice ? ("$" + row.ppPrice.toLocaleString("en-US")) : "—"}
                        </span>
                      </td>

                      {/* Effective Discount */}
                      <td style={TD(row)}>
                        <span style={{ fontWeight: 700, color: (row.ppGain && row.ppGain < 0) ? ppBg : (c.textSecondary || "#94A3B0") }}>
                          {row.ppGain && row.ppGain < 0 ? ("−$" + Math.abs(row.ppGain).toLocaleString("en-US")) : "—"}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PITI breakdown footnote */}
          {(tax > 0 || ins > 0 || pmiM > 0) && (
            <div style={{ marginTop: 10, fontSize: 11, color: c.textSecondary || "#64748b" }}>
              PITI includes P&amp;I
              {tax  > 0 ? ` + taxes ($${Math.round(tax).toLocaleString("en-US")}/mo)`  : ""}
              {ins  > 0 ? ` + insurance ($${Math.round(ins).toLocaleString("en-US")}/mo)` : ""}
              {pmiM > 0 ? ` + PMI ($${Math.round(pmiM).toLocaleString("en-US")}/mo)`   : ""}
            </div>
          )}
        </>
      )}

      {/* ── Temporary Buydown Section ──────────────────────────────────────── */}
      {mkt > 0 && la > 0 && (
        <div style={{ marginTop: 40 }}>

          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.navy || navy }}>Temporary Buydown Options</div>
              <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginTop: 2 }}>
                Builder funds a subsidy account to reduce the buyer's rate for the first 1–3 years. Note rate stays at {mkt.toFixed(3)}%.
              </div>
            </div>
            {concDollar > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.textSecondary || "#64748b", flexShrink: 0, marginLeft: 16 }}>
                <div style={{ width: 12, height: 12, background: isDark ? "#1A3D28" : "#C6F0D4", border: "1px solid " + border, borderRadius: 2 }} />
                Within ${Math.round(concDollar).toLocaleString("en-US")} budget
              </div>
            )}
          </div>

          {/* Comparison table */}
          {(function() {
            var maxYrs = Math.max.apply(null, tempBuydownData.map(function(p) { return p.yearRows.length; }));
            var hdSt = { padding: "10px 14px", fontSize: 12, fontWeight: 800, color: "#fff", textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.15)" };
            var lbSt = { padding: "9px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: c.textSecondary || "#64748b", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid " + border, background: isDark ? "#0D1820" : "#F5F8FA" };
            var tdSt = { padding: "9px 10px", textAlign: "center", borderBottom: "1px solid " + border, borderLeft: "1px solid " + border, verticalAlign: "middle" };
            return (
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid " + border, boxShadow: "0 2px 8px rgba(0,20,60,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...hdSt, background: navy, textAlign: "left", width: 130 }}></th>
                      {tempBuydownData.map(function(prog) {
                        return (
                          <th key={prog.id} style={{ ...hdSt, background: prog.withinBudget ? "#27AE60" : navy }}>
                            {prog.name}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxYrs }, function(_, yi) {
                      var rowBg = yi % 2 === 0 ? (isDark ? "#111E2C" : "#fff") : (isDark ? "#0D1820" : "#F9FBFC");
                      return (
                        <tr key={"yr" + yi} style={{ background: rowBg }}>
                          <td style={lbSt}>Year {yi + 1}</td>
                          {tempBuydownData.map(function(prog) {
                            var yr = prog.yearRows[yi];
                            if (!yr) return <td key={prog.id} style={{ ...tdSt, background: rowBg, color: c.textSecondary || "#94A3B0", fontSize: 11, fontStyle: "italic" }}>full rate</td>;
                            return (
                              <td key={prog.id} style={{ ...tdSt, background: rowBg }}>
                                <div style={{ fontWeight: 800, color: c.navy || navy, fontSize: 15 }}>{yr.rate.toFixed(3)}%</div>
                                <div style={{ fontSize: 12, color: c.text || "#1B2A3B", marginTop: 2 }}>${yr.pi.toLocaleString("en-US")}/mo</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#5DE890" : "#1A7A3A", marginTop: 1 }}>+${yr.savings.toLocaleString("en-US")}/mo saved</div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr style={{ background: isDark ? "#0A1520" : "#EEF4F9" }}>
                      <td style={{ ...lbSt, background: isDark ? "#0A1520" : "#E8EFF6" }}>Year {maxYrs + 1}+</td>
                      {tempBuydownData.map(function(prog) {
                        return (
                          <td key={prog.id} style={{ ...tdSt, background: isDark ? "#0A1520" : "#EEF4F9" }}>
                            <div style={{ fontWeight: 800, color: c.navy || navy, fontSize: 14 }}>{mkt.toFixed(3)}%</div>
                            <div style={{ fontSize: 10, color: c.textSecondary || "#94A3B0" }}>note rate</div>
                            <div style={{ fontSize: 12, color: c.text || "#1B2A3B", marginTop: 1 }}>${prog.mktPI.toLocaleString("en-US")}/mo</div>
                          </td>
                        );
                      })}
                    </tr>
                    <tr><td colSpan={tempBuydownData.length + 1} style={{ padding: 0, height: 3, background: isDark ? "#1A3040" : "#C8E4F5" }}></td></tr>
                    <tr style={{ background: isDark ? "#0D1B26" : "#EBF5FB" }}>
                      <td style={{ ...lbSt, background: isDark ? "#0D1B26" : "#DDF0FB", color: c.navy || navy, borderBottom: concDollar > 0 ? ("1px solid " + border) : "none" }}>Builder Cost</td>
                      {tempBuydownData.map(function(prog) {
                        var over = concDollar > 0 && prog.totalCost > concDollar;
                        return (
                          <td key={prog.id} style={{ ...tdSt, background: isDark ? "#0D1B26" : "#EBF5FB", borderBottom: concDollar > 0 ? ("1px solid " + border) : "none" }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: prog.withinBudget ? (isDark ? "#5DE890" : "#1A7A3A") : over ? "#DC2626" : (c.navy || navy) }}>
                              ${prog.totalCost.toLocaleString("en-US")}
                            </div>
                            {prog.costPct != null && <div style={{ fontSize: 10, color: c.textSecondary || "#64748b" }}>{prog.costPct.toFixed(3)}% of price</div>}
                            {prog.withinBudget && <div style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#5DE890" : "#1A7A3A" }}>✓ within budget</div>}
                            {over && <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626" }}>${(prog.totalCost - concDollar).toLocaleString("en-US")} over</div>}
                          </td>
                        );
                      })}
                    </tr>
                    {concDollar > 0 && (
                      <tr style={{ background: isDark ? "#111E2C" : "#F7FAFC" }}>
                        <td style={{ ...lbSt, color: c.text || "#1B2A3B", borderBottom: "none" }}>Left for CC</td>
                        {tempBuydownData.map(function(prog) {
                          var rem = Math.round(concDollar - prog.totalCost);
                          return (
                            <td key={prog.id} style={{ ...tdSt, borderBottom: "none" }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: rem >= 0 ? (isDark ? "#5DE890" : "#1A7A3A") : "#DC2626" }}>
                                {rem >= 0 ? "$" + rem.toLocaleString("en-US") : "−$" + Math.abs(rem).toLocaleString("en-US")}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Disclaimer */}
          <div style={{
            marginTop: 14, padding: "11px 15px",
            background: isDark ? "#1A2535" : "#FFF8E7",
            border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"),
            borderLeft: "4px solid #E6A817",
            borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
            {" "}Temporary buydown costs shown are estimates based on the monthly P&I difference at each year's subsidized rate. Actual buydown amounts are set at closing and may vary by lender. The note rate remains at the contract rate for the full loan term. Savings shown are relative to the payment at the note rate.
          </div>
        </div>
      )}

      {/* ── Combined Strategy Section ────────────────────────────────────────── */}
      {parseFloat(permBudget) > 0 && splitResults && mkt > 0 && la > 0 && (
        <div style={{ marginTop: 40 }}>

          {/* Section header */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.navy || navy }}>Combined Strategy Results</div>
            <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", marginTop: 3 }}>
              {splitResults.bestPermRow
                ? <>Permanent buydown to <strong>{splitResults.permRate.toFixed(3)}%</strong> (cost: ${Math.round(splitResults.permCost).toLocaleString("en-US")}) + temporary subsidy on top of that lower note rate.</>
                : <>No permanent buydown fits the allocated budget — showing temporary buydowns at market rate ({mkt.toFixed(3)}%).</>
              }
            </div>
          </div>

          {/* Summary bar: perm achievement */}
          {splitResults.bestPermRow && splitResults.permSavings > 0 && (
            <div style={{
              marginBottom: 16, padding: "12px 18px", borderRadius: 9,
              background: isDark ? "#0D1F2E" : "#EBF5FB",
              border: "1px solid " + (isDark ? "#1A3550" : "#C8E4F5"),
              display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Original Market Rate</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.navy || navy }}>{mkt.toFixed(3)}%</div>
                <div style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>${splitResults.mktPI.toLocaleString("en-US")}/mo P&I</div>
              </div>
              <div style={{ fontSize: 22, color: c.textSecondary || "#94A3B0" }}>→</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Permanent Note Rate</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1A6B5A" }}>{splitResults.permRate.toFixed(3)}%</div>
                <div style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>${splitResults.notePI.toLocaleString("en-US")}/mo P&I — saves <strong style={{ color: "#1A7A3A" }}>${splitResults.permSavings.toLocaleString("en-US")}/mo forever</strong></div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Permanent Cost Used</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.navy || navy }}>${Math.round(splitResults.permCost).toLocaleString("en-US")}</div>
                <div style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>of ${Math.round(parseFloat(permBudget) || 0).toLocaleString("en-US")} budget</div>
              </div>
            </div>
          )}

          {/* Combined strategy table */}
          {(function() {
            var maxYrs = Math.max.apply(null, splitResults.programs.map(function(p) { return p.yearRows.length; }));
            var tealBg = "#1A6B5A";
            var hdSt = { padding: "10px 14px", fontSize: 12, fontWeight: 800, color: "#fff", textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.15)" };
            var lbSt = { padding: "9px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: c.textSecondary || "#64748b", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid " + border, background: isDark ? "#0D1820" : "#F5F8FA" };
            var tdSt = { padding: "9px 10px", textAlign: "center", borderBottom: "1px solid " + border, borderLeft: "1px solid " + border, verticalAlign: "middle" };
            return (
              <div style={{ borderRadius: 10, overflow: "hidden", border: "1.5px solid " + border, boxShadow: "0 2px 8px rgba(0,20,60,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...hdSt, background: navy, textAlign: "left", width: 130 }}></th>
                      {splitResults.programs.map(function(prog) {
                        return (
                          <th key={prog.id} style={{ ...hdSt, background: prog.withinTotal ? "#27AE60" : navy }}>
                            <div>{splitResults.permRate.toFixed(3)}% Note</div>
                            <div style={{ fontWeight: 600, opacity: 0.85 }}>+ {prog.name}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxYrs }, function(_, yi) {
                      var rowBg = yi % 2 === 0 ? (isDark ? "#111E2C" : "#fff") : (isDark ? "#0D1820" : "#F9FBFC");
                      return (
                        <tr key={"yr" + yi} style={{ background: rowBg }}>
                          <td style={lbSt}>Year {yi + 1}</td>
                          {splitResults.programs.map(function(prog) {
                            var yr = prog.yearRows[yi];
                            if (!yr) return <td key={prog.id} style={{ ...tdSt, background: rowBg, color: c.textSecondary || "#94A3B0", fontSize: 11, fontStyle: "italic" }}>note rate</td>;
                            return (
                              <td key={prog.id} style={{ ...tdSt, background: rowBg }}>
                                <div style={{ fontWeight: 800, color: c.navy || navy, fontSize: 15 }}>{yr.rate.toFixed(3)}%</div>
                                <div style={{ fontSize: 12, color: c.text || "#1B2A3B", marginTop: 2 }}>${yr.pi.toLocaleString("en-US")}/mo</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#5DE890" : "#1A7A3A", marginTop: 1 }}>+${yr.savingsVsMkt.toLocaleString("en-US")}/mo saved</div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {/* Permanent note rate row */}
                    <tr style={{ background: isDark ? "#0A1D14" : "#E8F5F1" }}>
                      <td style={{ ...lbSt, background: isDark ? "#0A1D14" : "#DAF0E8", color: tealBg }}>Year {maxYrs + 1}+</td>
                      {splitResults.programs.map(function(prog) {
                        return (
                          <td key={prog.id} style={{ ...tdSt, background: isDark ? "#0A1D14" : "#E8F5F1" }}>
                            <div style={{ fontWeight: 800, color: tealBg, fontSize: 14 }}>{splitResults.permRate.toFixed(3)}%</div>
                            <div style={{ fontSize: 10, color: c.textSecondary || "#94A3B0" }}>note rate (permanent)</div>
                            <div style={{ fontSize: 12, color: c.text || "#1B2A3B", marginTop: 1 }}>${splitResults.notePI.toLocaleString("en-US")}/mo</div>
                            {splitResults.permSavings > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#5DE890" : "#1A7A3A", marginTop: 1 }}>+${splitResults.permSavings.toLocaleString("en-US")}/mo forever</div>}
                          </td>
                        );
                      })}
                    </tr>
                    <tr><td colSpan={splitResults.programs.length + 1} style={{ padding: 0, height: 10, background: isDark ? "#0A1520" : "#E4EDF5", borderTop: "2px solid " + (isDark ? "#1A3040" : "#B8D4E8"), borderBottom: "2px solid " + (isDark ? "#1A3040" : "#B8D4E8") }}></td></tr>
                    {/* Perm cost row */}
                    {splitResults.bestPermRow && (
                      <tr style={{ background: isDark ? "#0D1B26" : "#EBF5FB" }}>
                        <td style={{ ...lbSt, background: isDark ? "#0D1B26" : "#DDF0FB", color: c.navy || navy }}>Perm Cost</td>
                        {splitResults.programs.map(function(prog) {
                          return (
                            <td key={prog.id} style={{ ...tdSt, background: isDark ? "#0D1B26" : "#EBF5FB" }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: c.navy || navy }}>${Math.round(splitResults.permCost).toLocaleString("en-US")}</div>
                            </td>
                          );
                        })}
                      </tr>
                    )}
                    {/* Temp cost row */}
                    <tr style={{ background: isDark ? "#111E2C" : "#fff" }}>
                      <td style={lbSt}>Temp Cost</td>
                      {splitResults.programs.map(function(prog) {
                        var tempOk = splitResults.tempNum > 0 && prog.tempCost <= splitResults.tempNum;
                        return (
                          <td key={prog.id} style={{ ...tdSt }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: tempOk ? (isDark ? "#5DE890" : "#1A7A3A") : (c.text || "#1B2A3B") }}>
                              ${prog.tempCost.toLocaleString("en-US")}
                            </div>
                            {tempOk && <div style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#5DE890" : "#1A7A3A" }}>✓ within budget</div>}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Total row */}
                    <tr style={{ background: isDark ? "#0D1B26" : "#EBF5FB" }}>
                      <td style={{ ...lbSt, background: isDark ? "#0D1B26" : "#DDF0FB", color: c.navy || navy, borderBottom: concDollar > 0 ? ("1px solid " + border) : "none" }}>Total Cost</td>
                      {splitResults.programs.map(function(prog) {
                        var over = concDollar > 0 && prog.combinedCost > concDollar;
                        return (
                          <td key={prog.id} style={{ ...tdSt, background: isDark ? "#0D1B26" : "#EBF5FB", borderBottom: concDollar > 0 ? ("1px solid " + border) : "none" }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: prog.withinTotal ? (isDark ? "#5DE890" : "#1A7A3A") : over ? "#DC2626" : (c.navy || navy) }}>
                              ${prog.combinedCost.toLocaleString("en-US")}
                            </div>
                            {prog.withinTotal && <div style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#5DE890" : "#1A7A3A" }}>✓ within budget</div>}
                            {over && <div style={{ fontSize: 10, fontWeight: 700, color: "#DC2626" }}>${prog.overBy.toLocaleString("en-US")} over</div>}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Left for closing costs row */}
                    {concDollar > 0 && (
                      <tr style={{ background: isDark ? "#111E2C" : "#F7FAFC" }}>
                        <td style={{ ...lbSt, color: c.text || "#1B2A3B", borderBottom: "none" }}>Left for CC</td>
                        {splitResults.programs.map(function(prog) {
                          var rem = Math.round(concDollar - prog.combinedCost);
                          return (
                            <td key={prog.id} style={{ ...tdSt, borderBottom: "none" }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: rem >= 0 ? (isDark ? "#5DE890" : "#1A7A3A") : "#DC2626" }}>
                                {rem >= 0 ? "$" + rem.toLocaleString("en-US") : "−$" + Math.abs(rem).toLocaleString("en-US")}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Disclaimer */}
          <div style={{
            marginTop: 14, padding: "11px 15px",
            background: isDark ? "#1A2535" : "#FFF8E7",
            border: "1px solid " + (isDark ? "#3A3010" : "#F0D080"),
            borderLeft: "4px solid #E6A817",
            borderRadius: 7, fontSize: 11, color: c.textSecondary || "#64748b", lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 700, color: "#B07800" }}>⚠ Illustrative only.</span>
            {" "}Combined strategy costs are estimates. Permanent buydown points reduce the note rate for the life of the loan; temporary buydown subsidy covers the rate reduction in early years only. "Saves vs market" compares each year's payment to the original market rate payment. Actual costs and eligibility vary by lender and loan program.
          </div>
        </div>
      )}

    </div>
  );
}

window.BuilderTab = BuilderTab;
