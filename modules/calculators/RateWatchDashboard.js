// modules/calculators/RateWatchDashboard.js
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const COLORS = window.COLORS;
const font = window.font;
const SectionCard = window.SectionCard;
const Button = window.Button;

function RateWatchDashboard() {
  const c = useThemeColors();
  const [conv30, setConv30] = useLocalStorage("rw_conv30", 6.75);
  const [conv15, setConv15] = useLocalStorage("rw_conv15", 6.0);
  const [fha30, setFha30] = useLocalStorage("rw_fha30", 6.25);
  const [va30, setVa30] = useLocalStorage("rw_va30", 6.0);
  const [jumbo30, setJumbo30] = useLocalStorage("rw_jumbo30", 7.0);
  const [usda30, setUsda30] = useLocalStorage("rw_usda30", 6.25);
  const [asOf, setAsOf] = useLocalStorage("rw_date", new Date().toISOString().split("T")[0]);
  const [history, setHistory] = useLocalStorage("rw_history", []);

  const saveSnapshot = () => {
    const snap = { date: asOf, conv30: Number(conv30), conv15: Number(conv15), fha30: Number(fha30), va30: Number(va30), jumbo30: Number(jumbo30), usda30: Number(usda30) };
    const existing = history.filter(h => h.date !== asOf);
    const updated = [...existing, snap].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    setHistory(updated);
  };

  const rates = [
    { label: "Conv 30yr", value: conv30, set: setConv30, color: COLORS.blue },
    { label: "Conv 15yr", value: conv15, set: setConv15, color: COLORS.navy },
    { label: "FHA 30yr", value: fha30, set: setFha30, color: COLORS.gold },
    { label: "VA 30yr", value: va30, set: setVa30, color: COLORS.green },
    { label: "Jumbo 30yr", value: jumbo30, set: setJumbo30, color: COLORS.accent },
    { label: "USDA 30yr", value: usda30, set: setUsda30, color: "#8E99A4" },
  ];

  const Sparkline = ({ field, color }) => {
    if (history.length < 2) return null;
    const vals = history.map(h => h[field]).filter(v => v != null);
    if (vals.length < 2) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 0.1;
    const w = 100, h2 = 30;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h2 - ((v - min) / range) * h2}`).join(" ");
    return (
      <svg width={w} height={h2} style={{ display: "block" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  };

  const lastSnap = history.length > 1 ? history[history.length - 2] : null;

  return (
    <div>
      <SectionCard title="Rate Watch Dashboard" subtitle="Track and snapshot today's mortgage rates">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>As Of Date</div>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border || "#D8E2EA"}`, background: c.surface || "#fff", color: c.text || COLORS.navy, fontFamily: font, fontSize: 13, outline: "none" }}
            />
          </div>
          <Button onClick={saveSnapshot}>📌 Save Snapshot</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="mtk-grid-3">
          {rates.map((r, i) => {
            const prev = lastSnap ? lastSnap[Object.keys(lastSnap).find(k => k !== "date" && rates.findIndex(rt => "rw_" + Object.keys({ conv30, conv15, fha30, va30, jumbo30, usda30 }).find(kk => eval(kk) === r.value) === k.replace("rw_","")) >= 0)] : null;
            const field = ["conv30","conv15","fha30","va30","jumbo30","usda30"][i];
            const prevVal = lastSnap ? lastSnap[field] : null;
            const diff = prevVal != null ? Number(r.value) - prevVal : null;
            return (
              <div key={i} style={{ background: c.surface || "#F8FAFC", borderRadius: 10, padding: 14, border: `1px solid ${c.border || "#EEF2F6"}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, fontFamily: font, marginBottom: 4 }}>{r.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" step="0.125" value={r.value} onChange={e => r.set(Number(e.target.value))}
                    style={{ width: 80, padding: "6px 8px", borderRadius: 6, border: `1px solid ${c.border || "#D8E2EA"}`, background: c.bg || "#fff", color: r.color, fontFamily: font, fontSize: 16, fontWeight: 800, outline: "none", textAlign: "center" }}
                  />
                  <span style={{ fontSize: 14, color: r.color, fontWeight: 700 }}>%</span>
                  {diff !== null && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: diff > 0 ? COLORS.red : diff < 0 ? COLORS.green : COLORS.gray }}>
                      {diff > 0 ? "▲" : diff < 0 ? "▼" : "—"} {diff !== 0 ? Math.abs(diff).toFixed(3) : ""}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Sparkline field={field} color={r.color} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      {history.length > 0 && (
        <SectionCard title={"Rate History (" + history.length + " snapshots)"} style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="mtk-fee-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: font }}>
              <thead>
                <tr style={{ background: c.surface || "#F1F5F9" }}>
                  {["Date","Conv 30","Conv 15","FHA 30","VA 30","Jumbo 30","USDA 30"].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 0 ? "left" : "center", padding: "6px 8px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 8px", fontWeight: 600, color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{h.date}</td>
                    {["conv30","conv15","fha30","va30","jumbo30","usda30"].map((f, j) => (
                      <td key={j} style={{ textAlign: "center", padding: "6px 8px", color: rates[j].color, fontWeight: 600, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{h[f]}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, textAlign: "right" }}>
            <Button onClick={() => setHistory([])} style={{ background: COLORS.red, fontSize: 11, padding: "4px 12px" }}>Clear History</Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
window.RateWatchDashboard = RateWatchDashboard;
