// modules/calculators/RecastCalculator.js
const { useMemo, useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const fmt             = window.fmt;
const fmt2            = window.fmt2;
const SectionCard     = window.SectionCard;
const LabeledInput    = window.LabeledInput;
const font            = window.font;
const InfoTip         = window.InfoTip;

function stripCommas(v) { return String(v).replace(/,/g, ""); }
function addCommas(v) {
  const s = String(v).replace(/[^0-9.]/g, "");
  const [int, dec] = s.split(".");
  const formatted = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? formatted + "." + dec : formatted;
}

function balanceAfterPayments(L, r, N, m) {
  if (L <= 0 || N <= 0 || m < 0) return L;
  if (r === 0) return Math.max(0, L - (L / N) * m);
  const P = pmt(r, N, L);
  const growth = Math.pow(1 + r, m);
  return Math.max(0, L * growth - P * (growth - 1) / r);
}

function monthsToPayoff(r, P, B) {
  if (B <= 0) return 0;
  if (P <= 0) return Infinity;
  if (r === 0) return Math.ceil(B / P);
  const x = P - r * B;
  if (x <= 0) return Infinity;
  return Math.ceil(-Math.log(x / P) / Math.log(1 + r));
}

function RecastCalculator() {
  const c = useThemeColors();
  const [infoOpen, setInfoOpen] = useState(false);

  const [pcRate] = useLocalStorage("pc_rate", "");
  const [pcLa]   = useLocalStorage("pc_la",   "");
  const [pcTerm] = useLocalStorage("pc_term",  "30");

  const [lumpSum,       setLumpSum]       = useLocalStorage("rc_lump",         "");
  const [recastAtMonth, setRecastAtMonth] = useLocalStorage("rc_recast_month", "");

  const calc = useMemo(function() {
    const annRate = parseFloat(pcRate)               || 0;
    const origLA  = parseFloat(stripCommas(pcLa))    || 0;
    const termYr  = parseInt(pcTerm)                 || 30;
    const lump    = parseFloat(stripCommas(lumpSum)) || 0;
    const N       = termYr * 12;

    if (annRate <= 0 || origLA <= 0 || N <= 0) return null;

    const r           = annRate / 100 / 12;
    const origPayment = pmt(r, N, origLA);

    const mElapsed        = Math.max(0, Math.min(parseInt(recastAtMonth) || 0, N - 1));
    const remainingMonths = Math.max(1, N - mElapsed);
    const currentBal      = balanceAfterPayments(origLA, r, N, mElapsed);

    if (currentBal <= 0) return null;

    const currentPI = pmt(r, remainingMonths, currentBal);

    if (lump <= 0) {
      return { currentPI, currentBal, remainingMonths, origPayment, mElapsed, r };
    }

    const newBal         = Math.max(0, currentBal - lump);
    const newPI          = newBal > 0 ? pmt(r, remainingMonths, newBal) : 0;
    const monthlySavings = Math.max(0, currentPI - newPI);
    const interestRecast = Math.max(0, newPI * remainingMonths - newBal);

    const n_extra = monthsToPayoff(r, origPayment, newBal);
    const interestExtraPrincipal = (n_extra < Infinity && origPayment > 0)
      ? Math.max(0, origPayment * n_extra - newBal)
      : null;
    const extraInterestFromRecast = interestExtraPrincipal !== null
      ? Math.max(0, interestRecast - interestExtraPrincipal)
      : null;
    const monthsSaved = (interestExtraPrincipal !== null && n_extra < remainingMonths)
      ? remainingMonths - n_extra
      : null;

    return {
      currentPI, currentBal, remainingMonths, origPayment, mElapsed, r,
      newBal, newPI, monthlySavings,
      interestRecast, interestExtraPrincipal, extraInterestFromRecast,
      n_extra, monthsSaved, lump,
    };
  }, [pcRate, pcLa, pcTerm, lumpSum, recastAtMonth]);

  const hasResult  = calc !== null && (parseFloat(stripCommas(lumpSum)) || 0) > 0;
  const hasDetails = (parseFloat(pcRate) > 0) && (parseFloat(stripCommas(pcLa)) > 0);

  // Standard label style used throughout the toolkit
  const sectionLabel = {
    fontSize: 11, fontWeight: 700, color: c.gray,
    textTransform: "uppercase", letterSpacing: "0.06em",
    fontFamily: font, marginBottom: 4,
  };

  return (
    <div style={{ maxWidth: 640, margin: 0, padding: "16px 12px", fontFamily: font }}>

      {/* ── Collapsible info ─────────────────────────────────────────────────── */}
      <div style={{
        marginBottom: 16,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        overflow: "hidden",
        background: c.bgAlt,
      }}>
        <button
          onClick={function() { setInfoOpen(function(o) { return !o; }); }}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer",
            fontFamily: font,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: c.navy, letterSpacing: "0.04em" }}>ℹ️  What is a Loan Recast?</span>
          <span style={{ fontSize: 11, color: c.gray }}>{infoOpen ? "▲ Hide" : "▼ Show"}</span>
        </button>

        {infoOpen && (
          <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${c.border}` }}>
            <p style={{ fontSize: 13, color: c.text || c.navy, lineHeight: 1.7, margin: "12px 0 12px" }}>
              A <strong>recast</strong> means you make a large lump-sum payment toward your principal, then ask your servicer to recalculate your monthly payment based on the new lower balance — keeping your rate and remaining term the same.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Not a refinance", text: "Rate and loan term stay the same." },
                { label: "One-time only", text: "Most servicers allow just one recast per loan." },
                { label: "$300–$500 fee", text: "One-time fee paid to your servicer." },
                { label: "$10K+ minimum", text: "Most servicers require at least $10,000." },
              ].map(function(f) {
                return React.createElement("div", {
                  key: f.label,
                  style: { padding: "8px 10px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6 },
                },
                  React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: c.navy, marginBottom: 2, fontFamily: font } }, f.label),
                  React.createElement("div", { style: { fontSize: 11, color: c.gray, lineHeight: 1.5, fontFamily: font } }, f.text)
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: c.gray, lineHeight: 1.6, padding: "8px 10px", background: c.bg, borderRadius: 6, border: `1px solid ${c.border}` }}>
              <strong style={{ color: c.navy }}>Rule of thumb:</strong> Need lower monthly payments? Recast. Want to pay less interest and own your home sooner? Keep the higher payment.
            </div>
          </div>
        )}
      </div>

      {/* ── No loan details warning ──────────────────────────────────────────── */}
      {!hasDetails && (
        <div style={{
          marginBottom: 14, padding: "10px 12px",
          background: "#FEF2F2", borderRadius: 8, border: "1px solid #FCA5A5",
          fontSize: 13, color: "#DC2626", fontFamily: font, lineHeight: 1.6,
        }}>
          Enter your loan details in the <strong>Payment Calculator</strong> tab first — rate, loan amount, and term are needed.
        </div>
      )}

      {/* ── Inputs ──────────────────────────────────────────────────────────── */}
      <SectionCard title="Lump Sum Details">

        {hasDetails && (
          <div style={{
            marginBottom: 14, padding: "8px 12px",
            background: c.bgAlt, borderRadius: 6, border: `1px solid ${c.border}`,
            fontSize: 13, color: c.gray, lineHeight: 1.6, fontFamily: font,
          }}>
            Loan: <strong style={{ color: c.navy }}>{fmt(Math.round(parseFloat(stripCommas(pcLa))))}</strong> at{" "}
            <strong style={{ color: c.navy }}>{pcRate}%</strong> · <strong style={{ color: c.navy }}>{pcTerm}-year</strong> term
          </div>
        )}

        <LabeledInput
          label="Planned Recast — Month #"
          value={recastAtMonth}
          onChange={function(v) { if (v === "" || parseInt(v) >= 1) setRecastAtMonth(v); }}
          hint={calc && calc.mElapsed > 0
            ? "Remaining: " + Math.floor(calc.remainingMonths / 12) + "yr " + (calc.remainingMonths % 12) + "mo"
            : "Month number into your loan"}
        />

        <LabeledInput
          label="Lump Sum Payment"
          prefix="$"
          value={addCommas(lumpSum)}
          onChange={function(v) { setLumpSum(stripCommas(v)); }}
          useCommas
          hint="Most servicers require a minimum of $10,000"
          infoTip="The extra principal payment you're making to trigger the recast. Most lenders require a minimum of $5,000-$10,000. This payment is applied directly to your principal balance, reducing what you owe."
        />

        {calc && calc.currentBal > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: hasResult ? "1fr 1fr" : "1fr", gap: 10, marginTop: 4 }}>
            <div style={{ padding: "10px 12px", background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8 }}>
              <div style={sectionLabel}>Balance at Recast</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.navy, fontFamily: font }}>{fmt(Math.round(calc.currentBal))}</div>
              <div style={{ fontSize: 11, color: c.gray, marginTop: 2, fontFamily: font }}>From amortization · read-only</div>
            </div>
            {hasResult && (
              <div style={{ padding: "10px 12px", background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8 }}>
                <div style={sectionLabel}>New Balance</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.green || "#166534", fontFamily: font }}>{fmt(Math.round(calc.newBal))}</div>
                <div style={{ fontSize: 11, color: c.gray, marginTop: 2, fontFamily: font }}>After {fmt(Math.round(calc.lump))} lump sum</div>
              </div>
            )}
          </div>
        )}

      </SectionCard>

      {/* ── Payment results ─────────────────────────────────────────────────── */}
      {calc !== null && (
        <SectionCard title="Monthly Payment">
          <div style={{ display: "grid", gridTemplateColumns: hasResult ? "1fr 1fr" : "1fr", gap: 10 }}>

            <div style={{ padding: "10px 12px", background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8 }}>
              <div style={sectionLabel}>Current P&I</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.navy, fontFamily: font }}>{fmt2(calc.currentPI)}</div>
              <div style={{ fontSize: 11, color: c.gray, marginTop: 2, fontFamily: font }}>At recast date</div>
            </div>

            {hasResult && (
              <div style={{ padding: "10px 12px", background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8 }}>
                <div style={sectionLabel}>New P&I</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: c.navy, fontFamily: font }}>{fmt2(calc.newPI)}</div>
                <div style={{ fontSize: 11, color: c.gray, marginTop: 2, fontFamily: font }}>After recast</div>
              </div>
            )}

          </div>

          {hasResult && (
            <div style={{
              marginTop: 10, padding: "10px 14px",
              background: c.bgAlt, border: `1px solid ${c.border}`, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={sectionLabel}>Monthly Savings</div>
                <div style={{ fontSize: 11, color: c.gray, fontFamily: font }}>
                  Term unchanged · {Math.floor(calc.remainingMonths / 12)}yr {calc.remainingMonths % 12}mo remaining
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.green || "#166534", fontFamily: font }}>
                {fmt2(calc.monthlySavings)}<span style={{ fontSize: 13, fontWeight: 500 }}>/mo</span>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Should You Recast? ─────────────────────────────────────────────── */}
      {hasResult && calc.extraInterestFromRecast !== null && (
        <SectionCard title="Should You Recast?">

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>

            <div style={{ padding: "12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 10, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em" }}>↓ Recast It</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#6B7280", fontFamily: font, marginBottom: 2 }}>New payment</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#133155", fontFamily: font }}>{fmt2(calc.newPI)}<span style={{ fontSize: 11, fontWeight: 400, color: "#6B7280" }}>/mo</span></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6B7280", fontFamily: font, marginBottom: 2 }}>Total interest</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626", fontFamily: font }}>{fmt(Math.round(calc.interestRecast))}</div>
              </div>
              <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5, borderTop: "1px solid #FCA5A5", paddingTop: 8, marginTop: 10, fontFamily: font }}>
                Best if: you need lower monthly cash flow
              </div>
            </div>

            <div style={{ padding: "12px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 10, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em" }}>→ Keep Paying</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#6B7280", fontFamily: font, marginBottom: 2 }}>Payment stays</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#133155", fontFamily: font }}>{fmt2(calc.origPayment)}<span style={{ fontSize: 11, fontWeight: 400, color: "#6B7280" }}>/mo</span></div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6B7280", fontFamily: font, marginBottom: 2 }}>Total interest</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#166534", fontFamily: font }}>{fmt(Math.round(calc.interestExtraPrincipal))}</div>
              </div>
              <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5, borderTop: "1px solid #86EFAC", paddingTop: 8, marginTop: 10, fontFamily: font }}>
                {calc.monthsSaved && calc.monthsSaved > 0
                  ? "Pays off " + (Math.floor(calc.monthsSaved / 12) > 0 ? Math.floor(calc.monthsSaved / 12) + "yr " : "") + (calc.monthsSaved % 12 > 0 ? calc.monthsSaved % 12 + "mo " : "") + "sooner · best if: you want to build equity faster"
                  : "Best if: you want to pay less interest overall"
                }
              </div>
            </div>

          </div>

          <div style={{
            padding: "10px 12px",
            background: "#FFFBEB", border: "1px solid #FDE68A",
            borderRadius: 8, fontSize: 13, color: "#78350F", lineHeight: 1.7, fontFamily: font,
          }}>
            <strong>Bottom line:</strong> Recasting costs {fmt(Math.round(calc.extraInterestFromRecast))} more in total interest but saves {fmt2(calc.monthlySavings)}/mo. If your rate is low, keeping the higher payment usually wins.
          </div>

        </SectionCard>
      )}

    </div>
  );
}

window.RecastCalculator = RecastCalculator;
