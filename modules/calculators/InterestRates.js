// modules/calculators/InterestRates.js
// Internal-only: Interest Rate Pricing Sheet
// Reads loan amount (pc_la) and sales price (pc_hp) from Payment Calculator.
// LO enters market rate, floor rate, and per-step costs for each loan type.
// Rate config is stored globally in Supabase (one record per tenant) so all
// builders see the same rates without the LO being present.
// FHA and VA configs are bundled inside step_costs JSON as _fha/_va keys.

const { useMemo, useEffect, useRef, useState } = React;
const useLocalStorage        = window.useLocalStorage;
const useThemeColors         = window.useThemeColors;
const fetchGlobalRateConfig  = window.fetchGlobalRateConfig;
const saveGlobalRateConfig   = window.saveGlobalRateConfig;
const COLORS      = window.COLORS;
const COLORS_DARK = window.COLORS_DARK;
const font        = window.font;

function InterestRates() {
  const c      = useThemeColors();
  const isDark = c === COLORS_DARK;
  const [isMobileIR, setIsMobileIR] = useState(window.innerWidth < 700);
  useEffect(function() {
    var h = function() { setIsMobileIR(window.innerWidth < 700); };
    window.addEventListener("resize", h);
    return function() { window.removeEventListener("resize", h); };
  }, []);

  // ── Conventional state ────────────────────────────────────────────────────
  const [marketStr, setMarketStr] = useLocalStorage("ir_market",    "6.750");
  const [floorStr,  setFloorStr]  = useLocalStorage("ir_floor",     "5.500");
  const [stepCosts, setStepCosts] = useLocalStorage("ir_steps",     {});
  const [rateDate,  setRateDate]  = useLocalStorage("ir_rate_date", "");

  // ── FHA state ─────────────────────────────────────────────────────────────
  const [fhaMarket, setFhaMarket] = useLocalStorage("ir_fha_market", "");
  const [fhaFloor,  setFhaFloor]  = useLocalStorage("ir_fha_floor",  "");
  const [fhaSteps,  setFhaSteps]  = useLocalStorage("ir_fha_steps",  {});

  // ── VA state ──────────────────────────────────────────────────────────────
  const [vaMarket, setVaMarket] = useLocalStorage("ir_va_market", "");
  const [vaFloor,  setVaFloor]  = useLocalStorage("ir_va_floor",  "");
  const [vaSteps,  setVaSteps]  = useLocalStorage("ir_va_steps",  {});

  // ── USDA + Non-QM (market rate only — no detailed grid) ───────────────────
  const [usdaMarket,  setUsdaMarket]  = useLocalStorage("ir_usda_market",  "");
  const [nonqmMarket, setNonqmMarket] = useLocalStorage("ir_nonqm_market", "");

  // ── Active loan type tab ───────────────────────────────────────────────────
  const [loanType, setLoanType] = useState("conv"); // "conv" | "fha" | "va"

  // ── Global sync state ──────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle"|"saving"|"saved"|"error"
  const [isDirty,    setIsDirty]    = useState(false);
  const initialLoad = useRef(true);

  // ── MND sync state ─────────────────────────────────────────────────────────
  const [mndStatus,  setMndStatus]  = useState("idle"); // "idle"|"fetching"|"ok"|"error"
  const [mndMsg,     setMndMsg]     = useState("");
  const [mnd15yr,    setMnd15yr]    = useState(""); // reference-only, not stored

  // ── Active config derived from loanType ───────────────────────────────────
  const activeMarket    = loanType === "fha" ? fhaMarket : loanType === "va" ? vaMarket : marketStr;
  const activeFloor     = loanType === "fha" ? fhaFloor  : loanType === "va" ? vaFloor  : floorStr;
  const activeSteps     = loanType === "fha" ? fhaSteps  : loanType === "va" ? vaSteps  : stepCosts;
  const setActiveMarket = loanType === "fha" ? setFhaMarket : loanType === "va" ? setVaMarket : setMarketStr;
  const setActiveFloor  = loanType === "fha" ? setFhaFloor  : loanType === "va" ? setVaFloor  : setFloorStr;
  const setActiveSteps  = loanType === "fha" ? setFhaSteps  : loanType === "va" ? setVaSteps  : setStepCosts;

  // ── On mount: fetch global config and extract FHA/VA from step_costs ───────
  useEffect(() => {
    if (!fetchGlobalRateConfig) return;
    fetchGlobalRateConfig().then(function({ data }) {
      if (!data) { initialLoad.current = false; return; }
      if (data.market_rate) setMarketStr(data.market_rate);
      if (data.floor_rate)  setFloorStr(data.floor_rate);
      if (data.rate_date)   setRateDate(data.rate_date);
      if (data.step_costs) {
        // FHA/VA configs are stored as _fha/_va keys inside step_costs JSON
        var raw = data.step_costs;
        var fhaCfg = raw._fha || {};
        var vaCfg  = raw._va  || {};
        var convSteps = Object.fromEntries(
          Object.entries(raw).filter(function([k]) { return k !== "_fha" && k !== "_va"; })
        );
        setStepCosts(convSteps);
        if (fhaCfg.market) setFhaMarket(fhaCfg.market);
        if (fhaCfg.floor)  setFhaFloor(fhaCfg.floor);
        if (fhaCfg.steps)  setFhaSteps(fhaCfg.steps);
        if (vaCfg.market)  setVaMarket(vaCfg.market);
        if (vaCfg.floor)   setVaFloor(vaCfg.floor);
        if (vaCfg.steps)   setVaSteps(vaCfg.steps);
        var usdaCfg  = raw._usda  || {};
        var nonqmCfg = raw._nonqm || {};
        if (usdaCfg.market)  setUsdaMarket(usdaCfg.market);
        if (nonqmCfg.market) setNonqmMarket(nonqmCfg.market);
      }
      setTimeout(function() { initialLoad.current = false; }, 400);
    });
  }, []);

  // Track unsaved changes across all loan types
  useEffect(() => {
    if (initialLoad.current) return;
    setIsDirty(true);
  }, [marketStr, floorStr, rateDate, stepCosts, fhaMarket, fhaFloor, fhaSteps, vaMarket, vaFloor, vaSteps, usdaMarket, nonqmMarket]);

  async function handleSyncMND() {
    const supabase = window._supabaseClient;
    if (!supabase) { setMndMsg("Supabase not available."); setMndStatus("error"); return; }
    setMndStatus("fetching");
    setMndMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("fetch-mnd-rates");
      if (error || !data || data.error) {
        setMndMsg(data?.error || (error?.message) || "Fetch failed.");
        setMndStatus("error");
        return;
      }
      // Populate market rates — only overwrite if the value came back
      if (data.fixed30) { setMarketStr(data.fixed30); }
      if (data.fixed15) { setMnd15yr(data.fixed15); }
      if (data.fha30)   { setFhaMarket(data.fha30);  }
      if (data.va30)    { setVaMarket(data.va30);     }
      // Stamp today's date
      const today = new Date().toISOString().slice(0, 10);
      setRateDate(today);
      setIsDirty(true);
      const filled = [
        data.fixed30 && `30yr: ${data.fixed30}%`,
        data.fixed15 && `15yr: ${data.fixed15}%`,
        data.fha30   && `FHA: ${data.fha30}%`,
        data.va30    && `VA: ${data.va30}%`,
      ].filter(Boolean).join("  ·  ");
      setMndMsg(filled);
      setMndStatus("ok");
    } catch (e) {
      setMndMsg(String(e));
      setMndStatus("error");
    }
  }

  function handleSave() {
    if (!saveGlobalRateConfig) return;
    setSaveStatus("saving");
    setIsDirty(false);
    // Bundle FHA/VA into step_costs as reserved _fha/_va keys
    var bundledSteps = Object.assign({}, stepCosts, {
      _fha:   { market: fhaMarket,  floor: fhaFloor, steps: fhaSteps },
      _va:    { market: vaMarket,   floor: vaFloor,  steps: vaSteps  },
      _usda:  { market: usdaMarket  },
      _nonqm: { market: nonqmMarket },
    });
    saveGlobalRateConfig({ market: marketStr, floor: floorStr, rateDate, stepCosts: bundledSteps })
      .then(function({ error }) {
        setSaveStatus(error ? "error" : "saved");
        if (error) setIsDirty(true);
        setTimeout(function() { setSaveStatus("idle"); }, 2500);
      });
  }

  // ── Read from Payment Calculator (read-only) ───────────────────────────────
  const [pcLA] = useLocalStorage("pc_la", "");
  const [pcHP] = useLocalStorage("pc_hp", "");

  const la     = parseFloat(pcLA)       || 0;
  const sp     = parseFloat(pcHP)       || 0;
  const market = parseFloat(activeMarket) || 0;
  const floor  = parseFloat(activeFloor)  || 0;
  const convMkt = parseFloat(marketStr)   || 0;

  const rKey = r => r.toFixed(3);

  // ── Row generation (uses active loan type config) ──────────────────────────
  const rows = useMemo(() => {
    if (!market || !floor || floor >= market - 0.00001) return [];
    const STEP = 0.125;
    const result = [];
    let r = Math.round(floor * 1000) / 1000;
    const m = Math.round(market * 1000) / 1000;
    while (r <= m + 0.00001) {
      const rate  = Math.round(r * 1000) / 1000;
      const frac  = Math.round((rate % 1) * 1000) / 1000;
      const isWhole = frac < 0.0005;
      const isHalf  = Math.abs(frac - 0.5) < 0.0005;
      if (isWhole || isHalf) {
        const companion = Math.round((rate - 0.01) * 1000) / 1000;
        result.push({ rate: companion, isCompanion: true, companionOf: rate });
      }
      result.push({ rate, isCompanion: false });
      r = Math.round((r + STEP) * 1000) / 1000;
    }
    return result;
  }, [floor, market]);

  // ── Cumulative cost map ────────────────────────────────────────────────────
  const cumMap = useMemo(() => {
    const map  = {};
    const real = rows.filter(r => !r.isCompanion).slice().sort((a, b) => a.rate - b.rate);
    if (!real.length) return map;
    map[rKey(real[real.length - 1].rate)] = 0;
    for (let i = real.length - 2; i >= 0; i--) {
      const k      = rKey(real[i].rate);
      const kAbove = rKey(real[i + 1].rate);
      map[k] = (map[kAbove] || 0) + (parseFloat(activeSteps[k]) || 0);
    }
    rows.filter(r => r.isCompanion).forEach(r => {
      map[rKey(r.rate)] = map[rKey(r.companionOf)] || 0;
    });
    return map;
  }, [rows, activeSteps]);

  const handleStep = (k, v) => setActiveSteps(prev => ({ ...prev, [k]: v }));

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtD       = n  => (n != null && !isNaN(n) && n > 0) ? "$" + Math.round(n).toLocaleString("en-US") : "—";
  const fmtP       = (n, d = 3) => (n != null && !isNaN(n)) ? n.toFixed(d) + "%" : "—";
  const ceilEighth = n  => Math.ceil(n / 0.125) * 0.125;

  const validRange = market > 0 && floor > 0 && floor < market - 0.00001;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const border = c.border || "#E0E8E8";
  const navy   = COLORS.navy;

  const ltMeta = {
    conv: { label: "Conventional", color: navy,      note: null },
    fha:  { label: "FHA",          color: "#1A6B5A",  note: "FHA rates typically run 0.125–0.500% below Conventional. Step costs below reflect points per rate increment for FHA loans." },
    va:   { label: "VA",           color: "#7B3F00",  note: "VA rates typically run 0.250–0.750% below Conventional. Note: VA loans do not allow seller-funded permanent buydowns — temporary buydowns are permitted." },
  };
  const activeMeta = ltMeta[loanType];

  const TH  = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#fff", textAlign: "right", whiteSpace: "nowrap", letterSpacing: "0.03em" };
  const TH1 = { ...TH, textAlign: "left", minWidth: 160 };

  const rowBg = (isMarket, isFloor, isComp) => {
    if (isMarket) return c.blueLight  || (isDark ? "#1A2E3C" : "#EBF5FB");
    if (isFloor)  return c.greenLight || (isDark ? "#1A2E24" : "#EBF5EC");
    if (isComp)   return c.bgAlt      || (isDark ? "#1E2D38" : "#F9FBFC");
    return "transparent";
  };

  const TD  = (isMarket, isFloor, isComp) => ({
    padding: "7px 14px", textAlign: "right", fontSize: 13,
    borderBottom: "1px solid " + border,
    background: rowBg(isMarket, isFloor, isComp),
    color: c.text || "#1B2A3B",
    fontWeight: (isMarket || isFloor) ? 700 : 400,
  });
  const TD1 = (isMarket, isFloor, isComp) => ({
    ...TD(isMarket, isFloor, isComp),
    textAlign: "left",
    paddingLeft: isComp ? 28 : 14,
    color: isMarket ? (c.blue || COLORS.blue) : isFloor ? (c.green || COLORS.green) : (c.text || "#1B2A3B"),
  });

  const numInp = {
    width: 90, padding: "5px 8px", borderRadius: 5, textAlign: "right",
    border: "1px solid " + border, background: c.bg || "#fff",
    color: c.text || "#1B2A3B", fontSize: 13, fontFamily: font,
  };
  const bigInp = { ...numInp, width: 110, fontSize: 15, fontWeight: 700, padding: "7px 10px", borderRadius: 6 };

  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: c.textSecondary || "#64748b",
    textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6,
  };

  const badge = (label, bg) => (
    <span style={{
      marginLeft: 8, fontSize: 9, fontWeight: 800, background: bg, color: "#fff",
      padding: "2px 6px", borderRadius: 3, letterSpacing: "0.05em", verticalAlign: "middle",
    }}>{label}</span>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: font }}>

      {/* Page title */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: c.navy || navy, letterSpacing: "-0.01em" }}>
            Interest Rate Pricing Sheet
          </div>
          <div style={{ fontSize: 13, color: c.textSecondary || "#64748b", marginTop: 3 }}>
            Internal use only &nbsp;·&nbsp; Changes sync globally to all builder scenarios
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveStatus === "saving" && <span style={{ fontSize: 12, color: c.textSecondary || "#64748b" }}>Saving…</span>}
          {saveStatus === "saved"  && <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>✓ Saved globally</span>}
          {saveStatus === "error"  && <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626" }}>⚠ Save failed — check console</span>}
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving" || !isDirty}
            style={{
              padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 700,
              border: "none", cursor: (!isDirty || saveStatus === "saving") ? "default" : "pointer",
              background: !isDirty ? (isDark ? "#2A3540" : "#E2E8F0") : navy,
              color: !isDirty ? (c.textSecondary || "#94a3b8") : "#fff",
              transition: "background 0.2s",
            }}
          >
            {saveStatus === "saving" ? "Saving…" : isDirty ? "Save Rates" : "Saved"}
          </button>
        </div>
      </div>

      {/* ── ARM pricing note ───────────────────────────────────────────────── */}
      <div style={{ background: (isDark ? "#1A2530" : "#EFF6FF"), border: "1px solid " + (isDark ? "#2A3F55" : "#BFDBFE"), borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: isDark ? "#93C5FD" : "#1E40AF", fontFamily: font, lineHeight: 1.6 }}>
        ℹ️ <strong>ARM rate adjustments</strong> — the rates below represent <strong>30-year fixed</strong> pricing. When an ARM is selected in the Payment Calculator, the builder buydown tabs automatically apply these offsets to the current rate:
        <span style={{ display: "inline-flex", gap: 16, marginLeft: 10 }}>
          <span><strong>10-yr ARM:</strong> −0.125%</span>
          <span><strong>7-yr ARM:</strong> −0.250%</span>
          <span><strong>5-yr ARM:</strong> −0.375%</span>
        </span>
      </div>

      {/* ── Quick Rate Entry ───────────────────────────────────────────────── */}
      <div style={{ background: c.bg || "#fff", border: "1px solid " + border, borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.textSecondary || "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
          Current Rates — Quick Entry
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 260 }}>
          {[
            { label: "Conventional",           value: marketStr,   set: setMarketStr,  color: navy },
            { label: "FHA",                    value: fhaMarket,   set: setFhaMarket,  color: "#1A6B5A" },
            { label: "USDA",                   value: usdaMarket,  set: setUsdaMarket, color: "#2d7a22" },
            { label: "VA",                     value: vaMarket,    set: setVaMarket,   color: "#7B3F00" },
            { label: "Non-QM / Non-Traditional", value: nonqmMarket, set: setNonqmMarket, color: "#5b21b6" },
          ].map(function(prog) {
            return (
              <div key={prog.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: prog.color, width: 160, flexShrink: 0 }}>
                  {prog.label}
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.125"
                    min="0"
                    max="20"
                    value={prog.value}
                    onChange={function(e) { prog.set(e.target.value); }}
                    placeholder="0.000"
                    style={{ ...bigInp, width: 90, borderColor: prog.value ? prog.color : border, paddingRight: 26 }}
                  />
                  <span style={{ position: "absolute", right: 8, fontSize: 13, fontWeight: 600, color: c.textSecondary || "#94a3b8", pointerEvents: "none" }}>%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Loan type tabs ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid " + border, width: "fit-content" }}>
        {[
          { id: "conv", label: "Conventional" },
          { id: "fha",  label: "FHA" },
          { id: "va",   label: "VA" },
        ].map(function(lt, i, arr) {
          var active = loanType === lt.id;
          var col = ltMeta[lt.id].color;
          return (
            <button key={lt.id} onClick={function() { setLoanType(lt.id); }} style={{
              padding: "10px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: "none", fontFamily: font,
              background: active ? col : (c.bgAlt || "#F9FBFC"),
              color: active ? "#fff" : (c.textSecondary || "#64748b"),
              borderRight: i < arr.length - 1 ? "1px solid " + border : "none",
              transition: "all 0.15s",
            }}>
              {lt.label}
              {/* Show a dot if that type has rates configured */}
              {!active && (
                (lt.id === "fha" && parseFloat(fhaMarket) > 0) ||
                (lt.id === "va"  && parseFloat(vaMarket)  > 0) ||
                (lt.id === "conv" && parseFloat(marketStr) > 0)
              ) && (
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: col, marginLeft: 7, verticalAlign: "middle", opacity: 0.8 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Config bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobileIR ? "1fr 1fr" : "auto auto auto 1fr 1fr",
        gap: isMobileIR ? 16 : 28, alignItems: "start", padding: "20px 24px",
        background: c.bgAlt || "#F9FBFC", border: "1px solid " + border,
        borderTop: "3px solid " + activeMeta.color,
        borderRadius: 10, marginBottom: 8,
      }}>

        {/* Market Rate */}
        <div>
          <label style={labelStyle}>{activeMeta.label} Market Rate</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number" inputMode="decimal" onFocus={(e) => e.target.select()} step="0.125" min="1" max="20"
              value={activeMarket}
              onChange={e => setActiveMarket(e.target.value)}
              style={bigInp}
            />
            <span style={{ fontSize: 15, fontWeight: 700, color: c.text || "#1B2A3B" }}>%</span>
          </div>
          {/* Spread vs Conventional (FHA/VA only) */}
          {loanType !== "conv" && convMkt > 0 && parseFloat(activeMarket) > 0 && (
            <div style={{ fontSize: 10, marginTop: 5, color: c.textSecondary || "#94A3B0" }}>
              Conv: {convMkt.toFixed(3)}%
              <span style={{ marginLeft: 6, fontWeight: 700, color: parseFloat(activeMarket) < convMkt ? "#1A7A3A" : "#DC2626" }}>
                ({parseFloat(activeMarket) < convMkt ? "−" : "+"}{Math.abs(parseFloat(activeMarket) - convMkt).toFixed(3)}%)
              </span>
            </div>
          )}
        </div>

        {/* Floor Rate */}
        <div>
          <label style={labelStyle}>{activeMeta.label} Floor Rate</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number" inputMode="decimal" onFocus={(e) => e.target.select()} step="0.125" min="1" max="20"
              value={activeFloor}
              onChange={e => setActiveFloor(e.target.value)}
              style={bigInp}
            />
            <span style={{ fontSize: 15, fontWeight: 700, color: c.text || "#1B2A3B" }}>%</span>
          </div>
        </div>

        {/* Rates Last Updated */}
        <div>
          <label style={labelStyle}>Rates Last Updated</label>
          <input
            type="date"
            value={rateDate}
            onChange={e => setRateDate(e.target.value)}
            style={{ ...bigInp, width: 145, fontSize: 13, fontWeight: 500 }}
          />
          {loanType !== "conv" && (
            <div style={{ fontSize: 10, color: c.textSecondary || "#94A3B0", marginTop: 5 }}>Shared across all loan types</div>
          )}
        </div>

        {/* Loan Amount (read-only) */}
        <div>
          <label style={labelStyle}>Loan Amount</label>
          {la > 0
            ? <div style={{ fontSize: 20, fontWeight: 800, color: c.navy || navy, paddingTop: 4 }}>{"$" + la.toLocaleString("en-US")}</div>
            : <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic", paddingTop: 8 }}>Enter in Payment Calculator</div>
          }
        </div>

        {/* Sales Price (read-only) */}
        <div>
          <label style={labelStyle}>Sales Price</label>
          {sp > 0
            ? <div style={{ fontSize: 20, fontWeight: 800, color: c.navy || navy, paddingTop: 4 }}>{"$" + sp.toLocaleString("en-US")}</div>
            : <div style={{ fontSize: 12, color: c.textSecondary || "#64748b", fontStyle: "italic", paddingTop: 8 }}>Enter in Payment Calculator</div>
          }
        </div>

      </div>

      {/* FHA / VA contextual notes */}
      {activeMeta.note && (
        <div style={{
          marginBottom: 8, padding: "8px 14px", borderRadius: 6, fontSize: 11, lineHeight: 1.6,
          background: loanType === "fha" ? (isDark ? "#0F2018" : "#F0FDF4") : (isDark ? "#1A0F00" : "#FFFBF0"),
          border: "1px solid " + (loanType === "fha" ? (isDark ? "#1A4030" : "#BBF7D0") : (isDark ? "#4A2800" : "#FDE68A")),
          color: loanType === "fha" ? (isDark ? "#86EFAC" : "#166534") : (isDark ? "#FCD34D" : "#92400E"),
        }}>
          {activeMeta.note}
        </div>
      )}


      {/* Validation */}
      {!validRange && (
        <div style={{
          padding: "11px 16px",
          background: isDark ? "#2E1A1A" : "#FEF2F2",
          border: "1px solid " + (isDark ? "#5A2A2A" : "#FECACA"),
          borderRadius: 8, color: c.red || COLORS.red || "#C0392B",
          fontSize: 13, fontWeight: 600, marginBottom: 20,
        }}>
          {(!market || !floor)
            ? `Enter the ${activeMeta.label} market and floor rates above to generate the table.`
            : "Floor rate must be lower than market rate."}
        </div>
      )}

      {/* ── Rate table ─────────────────────────────────────────────────────── */}
      {validRange && rows.length > 0 && (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid " + border, boxShadow: "0 2px 10px rgba(0,20,60,0.07)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>

            <thead>
              <tr style={{ background: activeMeta.color }}>
                <th style={TH1}>
                  Rate
                  <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 600, opacity: 0.75, letterSpacing: "0.06em" }}>
                    {activeMeta.label.toUpperCase()}
                  </span>
                </th>
                <th style={{ ...TH, minWidth: 150 }}>Step Cost (%)</th>
                <th style={{ ...TH, minWidth: 130 }}>Total Points (%)</th>
                <th style={{ ...TH, minWidth: 130 }}>Total Cost ($)</th>
                <th style={{ ...TH, minWidth: 140 }}>Builder Points (%)</th>
                <th style={{ ...TH, minWidth: 155 }}>Bldr Pts Rounded (%)</th>
                <th style={{ ...TH, minWidth: 140 }}>Builder Cost ($)</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, idx) => {
                const isMarket = !row.isCompanion && Math.abs(row.rate - market) < 0.0005;
                const isFloor  = !row.isCompanion && Math.abs(row.rate - floor)  < 0.0005;
                const k        = rKey(row.rate);
                const cum      = cumMap[k] || 0;

                const col4 = la > 0 ? Math.round(cum / 100 * la) : null;
                const col5 = (col4 !== null && sp > 0) ? (col4 / sp * 100) : null;
                const col6 = col5 !== null ? ceilEighth(col5) : null;
                const col7 = (col6 !== null && sp > 0) ? Math.round(col6 / 100 * sp) : null;

                const isLocked = row.isCompanion || isMarket;

                return (
                  <tr key={k + idx}>

                    {/* Rate */}
                    <td style={TD1(isMarket, isFloor, row.isCompanion)}>
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

                    {/* Step Cost */}
                    <td style={TD(isMarket, isFloor, row.isCompanion)}>
                      {isLocked
                        ? <span style={{ color: c.textSecondary || "#94A3B0", fontSize: 12 }}>—</span>
                        : <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                            <input
                              type="number" inputMode="decimal" onFocus={(e) => e.target.select()} step="0.125" min="0"
                              value={activeSteps[k] !== undefined ? activeSteps[k] : ""}
                              onChange={e => handleStep(k, e.target.value)}
                              placeholder="0.000"
                              style={numInp}
                            />
                            <span style={{ fontSize: 12, color: c.textSecondary || "#94A3B0" }}>%</span>
                          </div>
                      }
                    </td>

                    {/* Total Points */}
                    <td style={TD(isMarket, isFloor, row.isCompanion)}>
                      <span style={{ color: cum > 0 ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0") }}>
                        {fmtP(cum)}
                      </span>
                    </td>

                    {/* Total Cost $ */}
                    <td style={TD(isMarket, isFloor, row.isCompanion)}>
                      <span style={{ color: col4 && col4 > 0 ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0") }}>
                        {col4 !== null && col4 > 0 ? fmtD(col4) : "—"}
                      </span>
                    </td>

                    {/* Builder Points % */}
                    <td style={TD(isMarket, isFloor, row.isCompanion)}>
                      <span style={{ color: col5 && col5 > 0 ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0") }}>
                        {col5 !== null && col5 > 0 ? fmtP(col5) : "—"}
                      </span>
                    </td>

                    {/* Bldr Pts Rounded */}
                    <td style={TD(isMarket, isFloor, row.isCompanion)}>
                      <span style={{
                        color: col6 && col6 > 0 ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0"),
                        fontWeight: col6 && col6 > 0 ? 600 : 400,
                      }}>
                        {col6 !== null && col6 > 0 ? fmtP(col6) : "—"}
                      </span>
                    </td>

                    {/* Builder Cost $ */}
                    <td style={TD(isMarket, isFloor, row.isCompanion)}>
                      <span style={{
                        color: col7 && col7 > 0 ? (c.text || "#1B2A3B") : (c.textSecondary || "#94A3B0"),
                        fontWeight: col7 && col7 > 0 ? 600 : 400,
                      }}>
                        {col7 !== null && col7 > 0 ? fmtD(col7) : "—"}
                      </span>
                    </td>

                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      )}

      {/* ── Legend + column key ─────────────────────────────────────────────── */}
      {validRange && (
        <div style={{ marginTop: 18 }}>

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 11, color: c.textSecondary || "#64748b", marginBottom: 12 }}>
            {[
              { bg: c.blueLight  || "#EBF5FB", label: "Market Rate — baseline, no cost" },
              { bg: c.greenLight || "#EBF5EC", label: "Floor Rate — maximum buydown" },
              { bg: c.bgAlt      || "#F9FBFC", label: "Companion Row — same cost as adjacent X.0% or X.5% rate" },
            ].map(({ bg, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 14, height: 14, background: bg, border: "1px solid " + border, borderRadius: 2, flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>

          <div style={{
            padding: "12px 16px", background: c.bgAlt || "#F9FBFC",
            border: "1px solid " + border, borderRadius: 8, fontSize: 11,
            color: c.textSecondary || "#64748b", lineHeight: 1.8,
          }}>
            <span style={{ fontWeight: 700, color: c.navy || navy }}>Column Definitions: </span>
            <span><strong>Step Cost</strong> — points to go from the next-higher rate down to this rate &nbsp;·&nbsp; </span>
            <span><strong>Total Points</strong> — cumulative points from market rate to this rate &nbsp;·&nbsp; </span>
            <span><strong>Total Cost</strong> — Total Points × Loan Amount &nbsp;·&nbsp; </span>
            <span><strong>Builder Points</strong> — Total Cost ÷ Sales Price &nbsp;·&nbsp; </span>
            <span><strong>Bldr Pts Rounded</strong> — Builder Points rounded up to nearest 0.125% &nbsp;·&nbsp; </span>
            <span><strong>Builder Cost</strong> — Bldr Pts Rounded × Sales Price</span>
          </div>

        </div>
      )}

    </div>
  );
}

window.InterestRates = InterestRates;
