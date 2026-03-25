// modules/calculators/ForwardCommitment.js
const { useState } = React;
const useLocalStorage = window.useLocalStorage;
const COLORS = window.COLORS;
const font = window.font;
const fmt = window.fmt;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const Select = window.Select;
const MetricCard = window.MetricCard;
const Button = window.Button;

function ForwardCommitment() {
  const [locks, setLocks] = useLocalStorage("fc_locks", [
    { id: 1, borrower: "Sample Borrower", loanAmount: "350000", rate: "6.75", lockDate: "2025-01-15", lockDays: "60", expiration: "2025-03-16", status: "active", loanType: "Conv 30yr", notes: "" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLock, setNewLock] = useState({ borrower: "", loanAmount: "", rate: "", lockDays: "60", loanType: "Conv 30yr", notes: "" });

  const addLock = () => {
    const today = new Date();
    const exp = new Date(today.getTime() + parseInt(newLock.lockDays) * 86400000);
    setLocks(prev => [...prev, { id: Date.now(), ...newLock, lockDate: today.toISOString().split("T")[0], expiration: exp.toISOString().split("T")[0], status: "active" }]);
    setNewLock({ borrower: "", loanAmount: "", rate: "", lockDays: "60", loanType: "Conv 30yr", notes: "" });
    setShowAdd(false);
  };

  const getStatusColor = (lock) => {
    const exp = new Date(lock.expiration);
    const today = new Date();
    const daysLeft = Math.ceil((exp - today) / 86400000);
    if (lock.status === "closed") return { bg: COLORS.greenLight, text: COLORS.green, label: "CLOSED" };
    if (lock.status === "expired" || daysLeft < 0) return { bg: COLORS.redLight, text: COLORS.red, label: "EXPIRED" };
    if (daysLeft <= 7) return { bg: COLORS.goldLight, text: COLORS.gold, label: `${daysLeft}d LEFT` };
    return { bg: COLORS.blueLight, text: COLORS.blue, label: `${daysLeft}d LEFT` };
  };

  const totalPipeline = locks.filter(l => l.status === "active").reduce((s, l) => s + (parseFloat(l.loanAmount) || 0), 0);

  return (
    <div>
      <div className="mtk-metrics" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <MetricCard label="Active Locks" value={locks.filter(l => l.status === "active").length} large highlight />
        <MetricCard label="Pipeline Volume" value={fmt(totalPipeline)} />
        <MetricCard label="Avg Rate" value={locks.length > 0 ? (locks.reduce((s, l) => s + (parseFloat(l.rate) || 0), 0) / locks.length).toFixed(3) + "%" : "—"} />
      </div>
      <div className="mtk-header-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>RATE LOCKS</div>
        <Button label="+ Add Lock" onClick={() => setShowAdd(!showAdd)} primary small />
      </div>
      {showAdd && (
        <SectionCard title="NEW RATE LOCK" accent={COLORS.green}>
          <div className="mtk-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <LabeledInput label="Borrower" value={newLock.borrower} onChange={(v) => setNewLock(p => ({ ...p, borrower: v }))} type="text" small />
            <LabeledInput label="Loan Amount" prefix="$" value={newLock.loanAmount} onChange={(v) => setNewLock(p => ({ ...p, loanAmount: v }))} useCommas small />
            <LabeledInput label="Rate" value={newLock.rate} onChange={(v) => setNewLock(p => ({ ...p, rate: v }))} suffix="%" small />
            <Select label="Lock Period" value={newLock.lockDays} onChange={(v) => setNewLock(p => ({ ...p, lockDays: v }))} options={[{ value: "30", label: "30 Days" }, { value: "45", label: "45 Days" }, { value: "60", label: "60 Days" }, { value: "90", label: "90 Days" }, { value: "120", label: "120 Days" }, { value: "180", label: "180 Days (Extended)" }]} small />
            <LabeledInput label="Loan Type" value={newLock.loanType} onChange={(v) => setNewLock(p => ({ ...p, loanType: v }))} type="text" small />
            <LabeledInput label="Notes" value={newLock.notes} onChange={(v) => setNewLock(p => ({ ...p, notes: v }))} type="text" small />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button label="Save Lock" onClick={addLock} primary small color={COLORS.green} />
            <Button label="Cancel" onClick={() => setShowAdd(false)} small />
          </div>
        </SectionCard>
      )}
      {locks.map((lock) => {
        const status = getStatusColor(lock);
        return (
          <div key={lock.id} className="mtk-lock-row" style={{ background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, marginBottom: 12, display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy, fontFamily: font }}>{lock.borrower}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: status.bg, color: status.text, fontFamily: font }}>{status.label}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.gray, fontFamily: font }}>{fmt(parseFloat(lock.loanAmount) || 0)} · {lock.rate}% · {lock.loanType} · Locked {lock.lockDate} · Expires {lock.expiration}</div>
              {lock.notes && <div style={{ fontSize: 11, color: COLORS.grayLight, marginTop: 4, fontFamily: font }}>{lock.notes}</div>}
            </div>
            <div className="mtk-lock-btns" style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setLocks(prev => prev.map(l => l.id === lock.id ? { ...l, status: "closed" } : l))} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.green}`, background: "transparent", color: COLORS.green, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Close</button>
              <button onClick={() => setLocks(prev => prev.filter(l => l.id !== lock.id))} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Remove</button>
            </div>
          </div>
        );
      })}
      {locks.length === 0 && <div style={{ padding: 40, textAlign: "center", color: COLORS.grayLight, fontFamily: font }}>No rate locks yet. Click "+ Add Lock" to start tracking.</div>}
    </div>
  );
}

window.ForwardCommitment = ForwardCommitment;
