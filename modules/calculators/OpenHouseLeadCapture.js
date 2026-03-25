// modules/calculators/OpenHouseLeadCapture.js
const { useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const COLORS = window.COLORS;
const font = window.font;
const SectionCard = window.SectionCard;
const Select = window.Select;
const Button = window.Button;

function OpenHouseLeadCapture() {
  const c = useThemeColors();
  const [leads, setLeads] = useLocalStorage("ohlc_leads", []);
  const [propertyAddr, setPropertyAddr] = useLocalStorage("ohlc_addr", "");
  const [openDate, setOpenDate] = useLocalStorage("ohlc_date", new Date().toISOString().split("T")[0]);
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "", agent: "", preapproved: false, timeframe: "3-6 months", notes: "" });

  const addLead = () => {
    if (!newLead.name.trim()) return;
    const lead = { ...newLead, id: Date.now(), timestamp: new Date().toLocaleString(), property: propertyAddr, date: openDate };
    setLeads([lead, ...leads]);
    setNewLead({ name: "", email: "", phone: "", agent: "", preapproved: false, timeframe: "3-6 months", notes: "" });
  };

  const deleteLead = (id) => setLeads(leads.filter(l => l.id !== id));

  const exportCSV = () => {
    if (leads.length === 0) return;
    const headers = ["Name","Email","Phone","Agent","Pre-Approved","Timeframe","Notes","Property","Date","Timestamp"];
    const rows = leads.map(l => [l.name, l.email, l.phone, l.agent, l.preapproved ? "Yes" : "No", l.timeframe, l.notes, l.property, l.date, l.timestamp]);
    const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `open-house-leads-${openDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const inp = (label, field, type = "text") => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>{label}</div>
      <input type={type} value={newLead[field]} onChange={e => setNewLead({ ...newLead, [field]: e.target.value })}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border || "#D8E2EA"}`, background: c.surface || "#fff", color: c.text || COLORS.navy, fontFamily: font, fontSize: 13, outline: "none" }}
      />
    </div>
  );

  return (
    <div>
      <SectionCard title="Open House Details">
        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>Property Address</div>
            <input type="text" value={propertyAddr} onChange={e => setPropertyAddr(e.target.value)} placeholder="123 Main St, Frisco, TX 75034"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border || "#D8E2EA"}`, background: c.surface || "#fff", color: c.text || COLORS.navy, fontFamily: font, fontSize: 13, outline: "none" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>Date</div>
            <input type="date" value={openDate} onChange={e => setOpenDate(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border || "#D8E2EA"}`, background: c.surface || "#fff", color: c.text || COLORS.navy, fontFamily: font, fontSize: 13, outline: "none" }}
            />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Add Lead" subtitle={"Total: " + leads.length + " leads captured"} style={{ marginTop: 12 }}>
        <div className="mtk-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {inp("Full Name *", "name")}
          {inp("Email", "email", "email")}
          {inp("Phone", "phone", "tel")}
          {inp("Their Agent", "agent")}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>Timeframe</div>
            <Select value={newLead.timeframe} onChange={v => setNewLead({ ...newLead, timeframe: v })} options={[
              { value: "Immediately", label: "Immediately" },
              { value: "1-3 months", label: "1-3 months" },
              { value: "3-6 months", label: "3-6 months" },
              { value: "6-12 months", label: "6-12 months" },
              { value: "Just looking", label: "Just looking" },
            ]} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>&nbsp;</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: font, color: c.text || COLORS.navy, cursor: "pointer", height: 38 }}>
              <input type="checkbox" checked={newLead.preapproved} onChange={e => setNewLead({ ...newLead, preapproved: e.target.checked })} /> Pre-Approved
            </label>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary || COLORS.gray, marginBottom: 4, fontFamily: font }}>Notes</div>
          <textarea value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} rows={2} placeholder="Interested in 4bed/3bath, budget ~$400k..."
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border || "#D8E2EA"}`, background: c.surface || "#fff", color: c.text || COLORS.navy, fontFamily: font, fontSize: 13, outline: "none", resize: "vertical" }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Button onClick={addLead}>✚ Add Lead</Button>
          {leads.length > 0 && <Button onClick={exportCSV} style={{ background: COLORS.green }}>📥 Export CSV</Button>}
          {leads.length > 0 && <Button onClick={() => setLeads([])} style={{ background: COLORS.red }}>🗑 Clear All</Button>}
        </div>
      </SectionCard>
      {leads.length > 0 && (
        <SectionCard title={"Captured Leads (" + leads.length + ")"} style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="mtk-fee-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: font }}>
              <thead>
                <tr style={{ background: c.surface || "#F1F5F9" }}>
                  {["Name","Email","Phone","Timeframe","Pre-Apprvd","Notes",""].map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "6px 8px", color: c.textSecondary || COLORS.gray, fontWeight: 600, borderBottom: `2px solid ${c.border || "#E2E8F0"}`, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l, i) => (
                  <tr key={l.id}>
                    <td style={{ padding: "6px 8px", fontWeight: 600, color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{l.name}</td>
                    <td style={{ padding: "6px 8px", color: COLORS.blue, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{l.email || "—"}</td>
                    <td style={{ padding: "6px 8px", color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{l.phone || "—"}</td>
                    <td style={{ padding: "6px 8px", color: c.text || COLORS.navy, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{l.timeframe}</td>
                    <td style={{ padding: "6px 8px", color: l.preapproved ? COLORS.green : COLORS.gray, borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>{l.preapproved ? "✓ Yes" : "No"}</td>
                    <td style={{ padding: "6px 8px", color: c.textSecondary || COLORS.gray, borderBottom: `1px solid ${c.border || "#EEF2F6"}`, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.notes || "—"}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${c.border || "#EEF2F6"}` }}>
                      <button onClick={() => deleteLead(l.id)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
window.OpenHouseLeadCapture = OpenHouseLeadCapture;
