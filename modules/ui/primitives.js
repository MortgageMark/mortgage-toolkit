// LabeledInput, Toggle, Select, MetricCard, SectionCard, Button

// ── Mobile order counter ─────────────────────────────────────────────────────
// Injects a CSS counter that auto-numbers every SectionCard in DOM order.
// DOM order = mobile stacking order (when mtk-grid-2 collapses to 1 column).
// Numbers are intentionally tiny and near-invisible — planning aid only.
;(() => {
  if (document.getElementById("mtk-card-counter-style")) return;
  const s = document.createElement("style");
  s.id = "mtk-card-counter-style";
  s.textContent = `
    body { counter-reset: mtk-sc; }
    [data-sc-body] { counter-increment: mtk-sc; position: relative; }
    [data-sc-body]::after {
      content: counter(mtk-sc);
      position: absolute;
      bottom: 5px;
      right: 8px;
      font-size: 8px;
      font-weight: 700;
      font-family: monospace;
      color: rgba(0,0,0,0.55);
      pointer-events: none;
      user-select: none;
      line-height: 1;
    }
  `;
  document.head.appendChild(s);
})();

function LabeledInput({ label, value, onChange, onBlur, prefix, suffix, type = "number", step, hint, useCommas, disabled, small, noNegative, rightAddon }) {
  const c = useThemeColors();
  const displayVal = useCommas ? addCommas(value) : value;
  const handleChange = (raw) => {
    if (noNegative) {
      const n = parseFloat(String(raw).replace(/,/g, ''));
      if (!isNaN(n) && n < 0) return;
    }
    onChange(raw);
  };
  const inputBox = (
    <div style={{ flex: rightAddon ? 1 : undefined, display: "flex", alignItems: "center", background: disabled ? (c === COLORS_DARK ? "#1A2530" : "#f0f0f0") : c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
      {prefix && <span style={{ padding: "8px 0 8px 10px", color: c.navy, fontWeight: 600, fontSize: small ? 13 : 15, fontFamily: font }}>{prefix}</span>}
      <input type={useCommas ? "text" : type} value={displayVal}
        onChange={(e) => handleChange(useCommas ? stripCommas(e.target.value) : e.target.value)}
        onBlur={onBlur ? (e) => onBlur(useCommas ? stripCommas(e.target.value) : e.target.value) : undefined}
        step={step} disabled={disabled}
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: small ? "8px 10px" : "10px 12px", fontSize: small ? 13 : 15, fontWeight: 500, color: c.text || c.navy, fontFamily: font, width: "100%" }} />
      {suffix && <span style={{ padding: "8px 10px 8px 0", color: c.gray, fontSize: small ? 11 : 13, fontWeight: 500, fontFamily: font }}>{suffix}</span>}
    </div>
  );
  return (
    <div style={{ marginBottom: small ? 10 : 14, minWidth: 0 }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, marginBottom: 5, fontFamily: font }}>{label}</label>}
      {rightAddon
        ? <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>{inputBox}{rightAddon}</div>
        : inputBox}
      {hint && <div style={{ fontSize: 11, color: c.grayLight || c.textSecondary, marginTop: 3, fontFamily: font }}>{hint}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  const c = useThemeColors();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: "pointer" }} onClick={() => onChange(!checked)}>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: checked ? c.blue : c.border, position: "relative", transition: "background 0.2s" }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 2, left: checked ? 20 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: c.text || c.navy, fontFamily: font }}>{label}</span>
    </div>
  );
}

function Select({ label, value, onChange, options, small }) {
  const c = useThemeColors();
  return (
    <div style={{ marginBottom: small ? 10 : 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, marginBottom: 5, fontFamily: font }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: small ? "8px 10px" : "10px 12px", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, fontSize: small ? 13 : 15, fontWeight: 500, color: c.text || c.navy, fontFamily: font, cursor: "pointer" }}>
        {options.map((o) => <option key={o.value} value={o.value} style={{ background: c.white, color: c.text || c.navy }}>{o.label}</option>)}
      </select>
    </div>
  );
}

function MetricCard({ label, value, sublabel, positive, large, highlight, accent }) {
  const c = useThemeColors();
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 100%)` : c.white,
      borderRadius: 12, padding: large ? "20px 18px" : "16px 14px",
      border: highlight ? "none" : `1px solid ${c.border}`,
      boxShadow: highlight ? "0 4px 20px rgba(12,65,96,0.25)" : "0 1px 4px rgba(0,0,0,0.04)",
      flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: highlight ? "rgba(255,255,255,0.7)" : c.gray, marginBottom: 6, fontFamily: font }}>{label}</div>
      <div style={{ fontSize: large ? 28 : 22, fontWeight: 700, color: highlight ? "#fff" : positive ? c.green : positive === false ? c.red : (c.text || c.navy), fontFamily: font, lineHeight: 1.1 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11, color: highlight ? "rgba(255,255,255,0.6)" : (c.textSecondary || c.grayLight), marginTop: 4, fontFamily: font }}>{sublabel}</div>}
    </div>
  );
}

function SectionCard({ title, children, accent, collapsed, onToggle, style: cardStyle }) {
  const c = useThemeColors();
  return (
    <div style={{ background: c.white, borderRadius: 12, border: `1px solid ${c.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 16, overflow: "hidden", width: "100%", maxWidth: "100%", boxSizing: "border-box", ...cardStyle }}>
      {title && (
        <div onClick={onToggle} style={{ padding: "14px 18px", borderBottom: collapsed ? "none" : `1px solid ${c.border}`, display: "flex", alignItems: "center", gap: 8, cursor: onToggle ? "pointer" : "default" }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: accent || c.navy }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text || c.navy, fontFamily: font, flex: 1 }}>{title}</div>
          {onToggle && <span style={{ color: c.gray, fontSize: 14 }}>{collapsed ? "▸" : "▾"}</span>}
        </div>
      )}
      {!collapsed && <div data-sc-body style={{ padding: 18 }}>{children}</div>}
    </div>
  );
}

function Button({ label, onClick, primary, small, color, fullWidth, disabled }) {
  const c = useThemeColors();
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? "8px 16px" : "12px 24px", borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
      fontSize: small ? 12 : 14, fontWeight: 700, fontFamily: font, letterSpacing: "0.02em",
      background: disabled ? "#ccc" : primary ? (color || c.navy) : c.border,
      color: primary ? "#fff" : (c.text || c.navy), width: fullWidth ? "100%" : "auto",
      transition: "all 0.2s", opacity: disabled ? 0.6 : 1,
    }}>{label}</button>
  );
}

function WarningBanner({ warnings }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div style={{ marginBottom: 4 }}>
      {warnings.map(w => (
        <div key={w.id} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "10px 14px", borderRadius: 8, marginBottom: 8,
          background: w.severity === "error" ? "#FEF2F2" : "#FFFBEB",
          border: `1px solid ${w.severity === "error" ? "#FECACA" : "#FCD34D"}`,
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
            background: w.severity === "error" ? "#DC2626" : "#D97706",
            color: "#fff", fontSize: 11, fontWeight: 800, fontFamily: font,
            display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
          }}>!</div>
          <span style={{
            fontSize: 12, lineHeight: 1.5, fontFamily: font,
            color: w.severity === "error" ? "#991B1B" : "#92400E",
          }}>{w.message}</span>
        </div>
      ))}
    </div>
  );
}

window.LabeledInput = LabeledInput;
window.Toggle = Toggle;
window.Select = Select;
window.MetricCard = MetricCard;
window.SectionCard = SectionCard;
window.Button = Button;
window.WarningBanner = WarningBanner;
