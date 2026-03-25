// modules/calculators/TitleEndorsements.js
// Title Endorsements Calculator — UI layer only.
// All business logic lives in stateConfig.js, altaEndorsements.js,
// texasTitleEndorsements.js, and stateOverrides.js (loaded as ES module).

const { useState, useEffect, useMemo } = React;
const useLocalStorage  = window.useLocalStorage;
const useThemeColors   = window.useThemeColors;
const getStateFees     = window.getStateFees;
const fmt              = window.fmt;
const SectionCard      = window.SectionCard;
const Select           = window.Select;
const Toggle           = window.Toggle;
const COLORS           = window.COLORS;
const font             = window.font;


// ─────────────────────────────────────────────────────────────────────────────
// Endorsement row component
// ─────────────────────────────────────────────────────────────────────────────
function EndorsementRow({ endorsement, isNJBundled }) {
  const c = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  const e = endorsement;
  const resolvedFee    = e.resolvedFee;
  const isUnconfirmed  = e.fee?.flagForConfirmation === true || e.feeConfirmed === false;
  const isTBD          = resolvedFee === null || resolvedFee === undefined;
  const feeNote        = e.feeNote || e.fee?.flagNote || "";
  const shortDesc      = e.shortDescription || e.description || "";
  const fullDesc       = e.fullDescription  || e.description || shortDesc;
  const appliesTo      = e.appliesTo;
  const applyLabel     = appliesTo === "lender" ? "Lender" : appliesTo === "owner" ? "Owner" : appliesTo === "both" ? "Both" : "";
  const isIncluded     = resolvedFee === 0 && (e.feeNote || "").toLowerCase().includes("included");
  const stateOverride  = e.stateOverrideApplied === true;

  const feeColor = isTBD
    ? "#d97706"
    : isUnconfirmed
    ? "#d97706"
    : resolvedFee === 0
    ? (c.text || c.navy)
    : (c.text || c.navy);

  const feeBg = isNJBundled
    ? "#f0fdf4"
    : isUnconfirmed || isTBD
    ? "#fffbeb"
    : "transparent";

  return (
    <div style={{ borderBottom: `1px solid ${c.border}`, background: feeBg }}>
      {/* Main row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", cursor: "pointer" }}
      >
        {/* Code badge */}
        <div style={{ flexShrink: 0, background: stateOverride ? "#dbeafe" : (c.bg || "#f5f8fa"), border: `1px solid ${stateOverride ? "#93c5fd" : c.border}`, borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 700, color: stateOverride ? "#1d4ed8" : (c.text || c.navy), fontFamily: font, minWidth: 60, textAlign: "center", marginTop: 2 }}>
          {e.code}
        </div>

        {/* Name + applies-to */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text || c.navy, fontFamily: font, lineHeight: 1.3 }}>
            {e.name}
            {applyLabel && (
              <span style={{ fontSize: 10, fontWeight: 600, background: appliesTo === "lender" ? "#e0f2fe" : appliesTo === "owner" ? "#f0fdf4" : "#fef3c7", color: appliesTo === "lender" ? "#0369a1" : appliesTo === "owner" ? "#166534" : "#92400e", borderRadius: 4, padding: "1px 5px", marginLeft: 6, verticalAlign: "middle" }}>
                {applyLabel}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: c.gray || "#6b7280", fontFamily: font, marginTop: 2, lineHeight: 1.4 }}>
            {shortDesc}
          </div>
        </div>

        {/* Fee */}
        <div style={{ flexShrink: 0, textAlign: "right", minWidth: 90 }}>
          {isTBD ? (
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706", fontFamily: font }}>TBD</span>
              <div style={{ fontSize: 10, color: "#d97706", fontFamily: font }}>Confirm w/ title</div>
            </div>
          ) : resolvedFee === 0 ? (
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.text || c.navy, fontFamily: font }}>$0</span>
              <div style={{ fontSize: 10, color: "#6b7280", fontFamily: font }}>Included</div>
            </div>
          ) : (
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: feeColor, fontFamily: font }}>{fmt(resolvedFee)}</span>
              {isUnconfirmed && <div style={{ fontSize: 10, color: "#d97706", fontFamily: font }}>⚠️ Estimate</div>}
              {stateOverride && !isUnconfirmed && <div style={{ fontSize: 10, color: "#1d4ed8", fontFamily: font }}>State rate</div>}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <div style={{ flexShrink: 0, color: c.gray, fontSize: 11, marginTop: 4 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 14px 12px 14px", paddingLeft: 88 }}>
          {fullDesc !== shortDesc && (
            <div style={{ fontSize: 12, color: c.text || c.navy, fontFamily: font, lineHeight: 1.5, marginBottom: 8 }}>
              {fullDesc}
            </div>
          )}
          {e.requiredNote && (
            <div style={{ fontSize: 11, color: "#0369a1", fontFamily: font, marginBottom: 4 }}>
              <strong>When required:</strong> {e.requiredNote}
            </div>
          )}
          {feeNote && (
            <div style={{ fontSize: 11, color: isUnconfirmed || isTBD ? "#92400e" : "#374151", background: isUnconfirmed || isTBD ? "#fef3c7" : "#f5f8fa", borderRadius: 5, padding: "4px 8px", fontFamily: font, marginBottom: 4 }}>
              {isUnconfirmed && "⚠️ "}{feeNote}
            </div>
          )}
          {e.noteForUI && (
            <div style={{ fontSize: 11, color: "#166534", background: "#f0fdf4", borderRadius: 5, padding: "4px 8px", fontFamily: font, marginBottom: 4 }}>
              ℹ️ {e.noteForUI}
            </div>
          )}
          {isNJBundled && (
            <div style={{ fontSize: 11, color: "#166534", background: "#f0fdf4", borderRadius: 5, padding: "4px 8px", fontFamily: font }}>
              Included in NJ Enhanced Coverage Loan Policy (§4.8). Confirm with title company.
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
function TitleEndorsements({ isInternal = false, user = null }) {
  const c = useThemeColors();

  // ── Shared read-only values (from Payment Calculator / Fee Sheet) ──────────
  const [selectedState]   = useLocalStorage("pc_state",    "TX");
  const [transactionType] = useLocalStorage("pc_purpose",  "purchase");
  const [purchasePrice]   = useLocalStorage("pc_hp",       "425000");
  const [loanAmount]      = useLocalStorage("pc_la",       "340000");
  const [loanProgram]     = useLocalStorage("pc_prog",     "conventional");
  const [pcPropType]      = useLocalStorage("pc_proptype", "sfr");
  const [pcRateType]      = useLocalStorage("pc_lt",       "fixed");
  const [fsSurvey]        = useLocalStorage("fs_sv",       true);

  // ── Title Endorsements–specific fields (te_ prefix) ───────────────────────
  const [hasNegAmort,    setHasNegAmort]    = useLocalStorage("te_neg_amort",   false);
  const [hasBalloon,     setHasBalloon]     = useLocalStorage("te_balloon",     false);
  const [hasFutureAdv,   setHasFutureAdv]   = useLocalStorage("te_future_adv",  false);
  const [mineralRisk,    setMineralRisk]    = useLocalStorage("te_mineral",     false);
  const [nearIndustrial, setNearIndustrial] = useLocalStorage("te_industrial",  false);
  const [isImprovedLand, setIsImprovedLand] = useLocalStorage("te_improved",    true);
  const [multipleParcel, setMultipleParcel] = useLocalStorage("te_multi_parc",  false);
  const [isLeasehold,    setIsLeasehold]    = useLocalStorage("te_leasehold",   false);
  // Property type override — engine values (singleFamily/condo/pud/manufactured/multiFamily)
  const [tePropType,     setTePropType]     = useLocalStorage("te_proptype",    "");
  // Loan type override — for exotic types not in pc_prog
  const [teLoanType,     setTeLoanType]     = useLocalStorage("te_loantype",    "");
  // Accordion state
  const [notesOpen,      setNotesOpen]      = useState(false);

  // ── Engine loading state ───────────────────────────────────────────────────
  const [engineLoaded, setEngineLoaded] = useState(!!window._titleEngineLoaded);
  const [engineError,  setEngineError]  = useState(window._titleEngineError || null);

  useEffect(() => {
    if (window._titleEngineLoaded) { setEngineLoaded(true); return; }
    window._titleEngineReadyCallback = () => setEngineLoaded(true);
    if (window._titleEngineError) setEngineError(window._titleEngineError);
  }, []);

  // ── Field mapping ──────────────────────────────────────────────────────────
  const propTypeMap = {
    sfr:       "singleFamily",
    townhome:  "pud",
    condo:     "condo",
    duplex:    "multiFamily",
    "3plex":   "multiFamily",
    "4plex":   "multiFamily",
    other:     "singleFamily",
  };
  const enginePropType = tePropType || propTypeMap[pcPropType] || "singleFamily";
  const engineLoanType = teLoanType || loanProgram;

  const la         = parseFloat(loanAmount)   || 0;
  const pp         = parseFloat(purchasePrice) || 0;
  const isPurchase = transactionType !== "refinance";

  // ── Policy premium calculation (mirrors FeeSheetGenerator) ────────────────
  const lenderPolicyPremium = useMemo(() => {
    const stFees = getStateFees(selectedState);
    if (!stFees?.basicRate) return 0;
    return isPurchase
      ? (la <= 0 ? 0 : Math.round(stFees.basicRate(la) * (stFees.simultaneousRate || 0.35)))
      : Math.round(stFees.basicRate(la));
  }, [la, isPurchase, selectedState]);

  const ownerPolicyPremium = useMemo(() => {
    const stFees = getStateFees(selectedState);
    if (!stFees?.basicRate) return 0;
    return isPurchase ? Math.round(stFees.basicRate(pp)) : 0;
  }, [pp, isPurchase, selectedState]);

  // ── Fields object for engine ───────────────────────────────────────────────
  const fields = useMemo(() => ({
    loanAmount:         la,
    purchasePrice:      pp,
    loanType:           engineLoanType,
    propertyType:       enginePropType,
    surveyProvided:     fsSurvey,
    rateType:           pcRateType,
    hasNegativeAmort:   hasNegAmort,
    hasBalloon,
    hasFutureAdvances:  hasFutureAdv,
    isRefinance:        !isPurchase,
    mineralRiskArea:    mineralRisk,
    nearIndustrialZone: nearIndustrial,
    lenderPolicyPremium,
    ownerPolicyPremium,
    state:              selectedState,
    isImprovedLand,
    multipleParcel,
    isLeasehold,
  }), [la, pp, engineLoanType, enginePropType, fsSurvey, pcRateType,
       hasNegAmort, hasBalloon, hasFutureAdv, isPurchase,
       mineralRisk, nearIndustrial, lenderPolicyPremium, ownerPolicyPremium,
       selectedState, isImprovedLand, multipleParcel, isLeasehold]);

  // ── Engine call ────────────────────────────────────────────────────────────
  const engineResult = useMemo(() => {
    if (!engineLoaded || !window.getEndorsementsForState) return null;
    try {
      return window.getEndorsementsForState(selectedState, fields);
    } catch(err) {
      return { endorsements: [], total: 0, warnings: [`Engine error: ${err.message}`], stateConfig: null };
    }
  }, [engineLoaded, selectedState, fields]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const exclusionViolations = useMemo(() => {
    if (!engineLoaded || !engineResult?.endorsements?.length || !window.validateExclusions) return [];
    try { return window.validateExclusions(engineResult.endorsements, selectedState) || []; } catch { return []; }
  }, [engineLoaded, engineResult, selectedState]);

  const pairingViolations = useMemo(() => {
    if (!engineLoaded || !engineResult?.endorsements?.length || !window.validatePairings) return [];
    try { return window.validatePairings(engineResult.endorsements, selectedState) || []; } catch { return []; }
  }, [engineLoaded, engineResult, selectedState]);

  // ── State override notes (FL, NM, NY, NJ, CA) ─────────────────────────────
  const overrideNotes = useMemo(() => {
    if (!engineLoaded || !window.getStateOverrideNotes) return [];
    const overrideStates = ["FL", "NM", "NY", "NJ", "CA"];
    if (!overrideStates.includes(selectedState?.toUpperCase())) return [];
    try { return window.getStateOverrideNotes(selectedState) || []; } catch { return []; }
  }, [engineLoaded, selectedState]);

  // ── Rate system label ──────────────────────────────────────────────────────
  const rateSystemLabel = useMemo(() => {
    if (!engineLoaded || !window.getRateSystemLabel) return "";
    try { return window.getRateSystemLabel(selectedState); } catch { return ""; }
  }, [engineLoaded, selectedState]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isIowa = selectedState?.toUpperCase() === "IA";
  const isNJ   = selectedState?.toUpperCase() === "NJ";

  const njBundledCodes = useMemo(() => {
    if (!engineLoaded || !isNJ || !window.getEnhancedCoverageBundledCodes) return [];
    try { return window.getEnhancedCoverageBundledCodes("NJ") || []; } catch { return []; }
  }, [engineLoaded, isNJ]);

  const endorsementTotal = useMemo(() => {
    if (!engineResult?.endorsements) return 0;
    return engineResult.endorsements.reduce((sum, e) => sum + (e.resolvedFee || 0), 0);
  }, [engineResult]);

  // Publish total to localStorage so Fee Sheet can read it as a line item
  useEffect(() => {
    localStorage.setItem("mtk_te_total", JSON.stringify(endorsementTotal));
    window.dispatchEvent(new StorageEvent("storage", { key: "mtk_te_total" }));
  }, [endorsementTotal]);

  const hasUnconfirmed = useMemo(() => {
    if (!engineResult?.endorsements) return false;
    return engineResult.endorsements.some(e => e.fee?.flagForConfirmation === true || e.feeConfirmed === false || e.resolvedFee === null);
  }, [engineResult]);

  const stateDisplayName = useMemo(() => {
    const stFees = getStateFees(selectedState);
    return stFees?.name || selectedState;
  }, [selectedState]);

  // ── Loading / error states ─────────────────────────────────────────────────
  if (engineError) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: font }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Title Endorsements Engine Failed to Load</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{engineError}</div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>
          Make sure stateConfig.js, altaEndorsements.js, texasTitleEndorsements.js, and stateOverrides.js are in the project root folder.
        </div>
      </div>
    );
  }

  if (!engineLoaded) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: font }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e0e8ef", borderTopColor: COLORS.navy, borderRadius: "50%", margin: "0 auto 12px", animation: "mtk-spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 13, color: c.gray || "#6b7280" }}>Loading endorsement engine…</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const loanTypeOptions = [
    { value: "",             label: `Auto (${loanProgram})` },
    { value: "conventional", label: "Conventional" },
    { value: "fha",          label: "FHA" },
    { value: "va",           label: "VA" },
    { value: "usda",         label: "USDA" },
    { value: "jumbo",        label: "Jumbo" },
    { value: "homeEquity",   label: "Home Equity (50(a)(6))" },
    { value: "heloc",        label: "HELOC" },
    { value: "reverse",      label: "Reverse Mortgage" },
    { value: "construction", label: "Construction" },
  ];

  const propTypeOptions = [
    { value: "singleFamily",  label: "Single Family" },
    { value: "condo",         label: "Condominium" },
    { value: "pud",           label: "PUD / Townhome" },
    { value: "manufactured",  label: "Manufactured Home" },
    { value: "multiFamily",   label: "Multi-Family (2–4 unit)" },
  ];

  const isArm = pcRateType === "arm";
  const hasViolations = exclusionViolations.length > 0 || pairingViolations.length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20, padding: 20, maxWidth: 1400, margin: "0 auto", alignItems: "start" }}>

      {/* ── LEFT: Inputs ─────────────────────────────────────────────────── */}
      <div>

        {/* Transaction Details (read-only, synced) */}
        <SectionCard title="Transaction Details">
          <div style={{ background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: "#1d4ed8", fontFamily: font }}>
            ℹ️ State, loan amount, and transaction type sync automatically from the Payment Calculator.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
            {[
              { label: "State",         value: stateDisplayName },
              { label: "Transaction",   value: isPurchase ? "Purchase" : "Refinance" },
              { label: "Loan Amount",   value: fmt(la) },
              { label: "Purchase Price",value: isPurchase ? fmt(pp) : "N/A" },
              { label: "Rate Type",     value: pcRateType === "arm" ? "Adjustable (ARM)" : "Fixed" },
              { label: "Loan Program",  value: loanProgram.charAt(0).toUpperCase() + loanProgram.slice(1) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: c.bg, borderRadius: 6, padding: "6px 10px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: c.gray, fontFamily: font }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text || c.navy, fontFamily: font }}>{value}</div>
              </div>
            ))}
          </div>
          {rateSystemLabel && (
            <div style={{ fontSize: 11, color: "#374151", background: "#f9fafb", border: `1px solid ${c.border}`, borderRadius: 6, padding: "6px 10px", fontFamily: font, marginTop: 6 }}>
              <strong>Rate System:</strong> {rateSystemLabel}
            </div>
          )}
        </SectionCard>

        {/* Property Details */}
        <SectionCard title="Property Details">
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, marginBottom: 5, fontFamily: font }}>Property Type</label>
            <select
              value={enginePropType}
              onChange={e => setTePropType(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, fontSize: 14, fontWeight: 500, color: c.text || c.navy, fontFamily: font, cursor: "pointer" }}
            >
              {propTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {tePropType && tePropType !== (propTypeMap[pcPropType] || "singleFamily") && (
              <div style={{ fontSize: 11, color: "#d97706", fontFamily: font, marginTop: 3 }}>
                Manual override active.{" "}
                <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setTePropType("")}>Reset to auto</span>
              </div>
            )}
            {!tePropType && pcPropType && (
              <div style={{ fontSize: 11, color: c.gray, fontFamily: font, marginTop: 3 }}>
                Auto-mapped from Payment Calculator ({pcPropType} → {enginePropType})
              </div>
            )}
          </div>
          <Toggle label="Survey Provided / T-47 Affidavit Available" checked={fsSurvey} onChange={() => {}} />
          <div style={{ fontSize: 11, color: c.gray, fontFamily: font, marginTop: -10, marginBottom: 14 }}>
            Survey toggle is set in the Fee Sheet. Change it there to update here.
          </div>
          <Toggle label="Improved Land (existing structures on property)" checked={isImprovedLand} onChange={setIsImprovedLand} />
          <Toggle label="Multiple Tax Parcels" checked={multipleParcel} onChange={setMultipleParcel} />
          <Toggle label="Leasehold Interest (borrower holds leasehold, not fee simple)" checked={isLeasehold} onChange={setIsLeasehold} />
        </SectionCard>

        {/* Loan Features */}
        <SectionCard title="Loan Features">
          {isArm && (
            <Toggle label="Negative Amortization (ARM with neg-am feature)" checked={hasNegAmort} onChange={setHasNegAmort} />
          )}
          {!isArm && (
            <div style={{ fontSize: 11, color: c.gray, fontFamily: font, marginBottom: 14 }}>
              Negative amortization toggle only applies to ARM loans.
            </div>
          )}
          <Toggle label="Balloon Payment" checked={hasBalloon} onChange={setHasBalloon} />
          <Toggle label="Future Advances (HELOC, construction draws)" checked={hasFutureAdv} onChange={setHasFutureAdv} />
          <Toggle label="Mineral Risk Area (active oil/gas/mineral activity)" checked={mineralRisk} onChange={setMineralRisk} />
          <Toggle label="Near Industrial Zone (lender requires env. lien coverage)" checked={nearIndustrial} onChange={setNearIndustrial} />
          <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 14, marginTop: 4 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, marginBottom: 5, fontFamily: font }}>Loan Type Override</label>
            <select
              value={teLoanType}
              onChange={e => setTeLoanType(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", background: c.bg, border: `1.5px solid ${teLoanType ? COLORS.blue : c.border}`, borderRadius: 8, fontSize: 14, fontWeight: 500, color: c.text || c.navy, fontFamily: font, cursor: "pointer" }}
            >
              {loanTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: c.gray, fontFamily: font, marginTop: 3 }}>
              Use for homeEquity, HELOC, reverse, or construction loans not tracked in pc_prog.
            </div>
          </div>
        </SectionCard>

      </div>

      {/* ── RIGHT: Results ────────────────────────────────────────────────── */}
      <div>

        {/* Warnings banner */}
        {engineResult?.warnings?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {engineResult.warnings.map((w, i) => (
              <div key={i} style={{ background: w.startsWith("⚠️") ? "#fffbeb" : "#eff6ff", border: `1px solid ${w.startsWith("⚠️") ? "#fcd34d" : "#93c5fd"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, fontSize: 12, color: w.startsWith("⚠️") ? "#92400e" : "#1e40af", fontFamily: font, lineHeight: 1.5 }}>
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Validation errors */}
        {hasViolations && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", fontFamily: font, marginBottom: 8 }}>⚠️ Endorsement Conflicts Detected</div>
            {exclusionViolations.map((v, i) => (
              <div key={`ex-${i}`} style={{ fontSize: 12, color: "#b91c1c", fontFamily: font, marginBottom: 4 }}>
                <strong>Exclusion:</strong> {v.codes.join(" + ")} — {v.reason}
              </div>
            ))}
            {pairingViolations.map((v, i) => (
              <div key={`pr-${i}`} style={{ fontSize: 12, color: "#b91c1c", fontFamily: font, marginBottom: 4 }}>
                <strong>Missing pair:</strong> {v.presentCode} requires {v.missingCode} — {v.reason}
              </div>
            ))}
          </div>
        )}

        {/* Iowa special case */}
        {isIowa ? (
          <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 10, padding: "18px 20px", fontFamily: font }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#854d0e", marginBottom: 8 }}>Iowa — Manual Handling Required</div>
            {engineResult?.warnings?.map((w, i) => (
              <div key={i} style={{ fontSize: 13, color: "#713f12", lineHeight: 1.5 }}>{w}</div>
            ))}
          </div>
        ) : (
          <>
            {/* Endorsement list */}
            <SectionCard title={`Endorsements — ${stateDisplayName} · ${engineResult?.endorsements?.length || 0} applicable`}>
              {!engineResult?.endorsements?.length ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: c.gray, fontSize: 13, fontFamily: font }}>
                  No endorsements applicable for this transaction.
                </div>
              ) : (
                <div style={{ margin: "0 -18px" }}>
                  {engineResult.endorsements.map((e, i) => (
                    <EndorsementRow
                      key={e.code || i}
                      endorsement={e}
                      isNJBundled={isNJ && njBundledCodes.includes(e.code)}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Fee total */}
            {engineResult?.endorsements?.length > 0 && (
              <div style={{ background: COLORS.navy, borderRadius: 10, padding: "14px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: font }}>Total Endorsement Fees</div>
                  {hasUnconfirmed && (
                    <div style={{ fontSize: 10, color: "#fcd34d", fontFamily: font, marginTop: 2 }}>
                      ⚠️ Includes estimated fees — confirm with title company
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: font }}>{fmt(endorsementTotal)}</div>
              </div>
            )}

            {/* NJ Enhanced Coverage callout */}
            {isNJ && (
              <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontFamily: font }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>⚠️ NJ Enhanced Coverage — 1-4 Family Loan Policy</div>
                <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.5 }}>
                  If your title company is using the NJ Enhanced Coverage 1-4 Family Loan Policy, endorsements ALTA 4.1, 5.1, 6, 6.2, 8.1, and 9.3 are already included in the base policy — no separate charge for those items. Confirm with your title company.
                </div>
              </div>
            )}

            {/* State-specific rules accordion (FL, NM, NY, NJ, CA) */}
            {overrideNotes.length > 0 && (
              <div style={{ background: c.white, borderRadius: 12, border: `1px solid ${c.border}`, marginBottom: 16, overflow: "hidden" }}>
                <div
                  onClick={() => setNotesOpen(!notesOpen)}
                  style={{ padding: "13px 18px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderBottom: notesOpen ? `1px solid ${c.border}` : "none" }}
                >
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0284c7" }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy, fontFamily: font, flex: 1 }}>
                    State-Specific Rules — {stateDisplayName}
                  </div>
                  <span style={{ color: c.gray, fontSize: 14 }}>{notesOpen ? "▾" : "▸"}</span>
                </div>
                {notesOpen && (
                  <div style={{ padding: 18 }}>
                    {overrideNotes.map((note, i) => (
                      <div key={i} style={{ fontSize: 12, color: c.text || c.navy, fontFamily: font, padding: "5px 0", borderBottom: i < overrideNotes.length - 1 ? `1px solid ${c.border}` : "none", lineHeight: 1.5 }}>
                        • {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </>
        )}

      </div>
    </div>
  );
}

window.TitleEndorsements = TitleEndorsements;
