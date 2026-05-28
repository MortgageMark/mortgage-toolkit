// modules/calculators/RecastCalculator.js
const { useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const pmt             = window.pmt;
const fmt             = window.fmt;
const fmt2            = window.fmt2;
const SectionCard     = window.SectionCard;
const LabeledInput    = window.LabeledInput;
const font            = window.font;

function stripCommas(v) { return String(v).replace(/,/g, ""); }
function addCommas(v) {
  const s = String(v).replace(/[^0-9.]/g, "");
  const [int, dec] = s.split(".");
  const formatted = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? formatted + "." + dec : formatted;
}

// Remaining balance after m payments on a loan of L at monthly rate r over N months
function balanceAfterPayments(L, r, N, m) {
  if (L <= 0 || N <= 0 || m < 0) return L;
  if (r === 0) return Math.max(0, L - (L / N) * m);
  const P = pmt(r, N, L);
  const growth = Math.pow(1 + r, m);
  return Math.max(0, L * growth - P * (growth - 1) / r);
}

// Months to pay off balance B at fixed payment P and monthly rate r
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

  // ── Read loan details from Payment Calculator (shared keys) ───────────────
  const [pcRate] = useLocalStorage("pc_rate", "");
  const [pcLa]   = useLocalStorage("pc_la",   "");
  const [pcTerm] = useLocalStorage("pc_term",  "30");

  // ── Recast-specific inputs ─────────────────────────────────────────────────
  const [lumpSum,       setLumpSum]       = useLocalStorage("rc_lump",         "");
  const [recastAtMonth, setRecastAtMonth] = useLocalStorage("rc_recast_month", "");

  // ── Calculation ────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
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

    // ── After recast ──────────────────────────────────────────────────────
    const newBal         = Math.max(0, currentBal - lump);
    const newPI          = newBal > 0 ? pmt(r, remainingMonths, newBal) : 0;
    const monthlySavings = Math.max(0, currentPI - newPI);
    const interestRecast = Math.max(0, newPI * remainingMonths - newBal);

    // ── "Keep old payment" scenario ────────────────────────────────────────
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

  const labelStyle = {
    fontSize: 11, fontWeight: 600,
    color: c.gray || "#5A7A95",
    textTransform: "uppercase", letterSpacing: "0.08em",
    marginBottom: 5, display: "block", fontFamily: font,
  };

  const ResultRow = ({ label, value, green, red, dim }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: `1px solid ${c.border || "#E8F0F7"}`,
      fontFamily: font,
    }}>
      <span style={{ fontSize: 13, fontFamily: font, fontWeight: 500, color: c.gray || "#6B7C93", flex: 1, paddingRight: 8, lineHeight: 1.4 }}>{label}</span>
      <span style={{
        fontSize: 15, fontWeight: 700, fontFamily: font,
        color: green ? (c.green || "#166534")
             : red   ? "#DC2626"
             : dim   ? (c.grayLight || "#94A3B8")
             :         (c.navy || "#133155"),
        whiteSpace: "nowrap",
      }}>{value}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 640, margin: 0, padding: "16px 12px", fontFamily: font }}>

      {/* ── What is a Recast? ───────────────────────────────────────────────── */}
      <SectionCard title="WHAT IS A LOAN RECAST?">
        <div style={{ fontSize: 13, color: c.text || c.navy, fontFamily: font, lineHeight: 1.8, marginBottom: 14 }}>
          A <strong>recast</strong> (also called re-amortization) is when you make a large lump-sum payment toward your principal balance, then ask your loan servicer to recalculate your monthly payment based on the new, lower balance — keeping your existing interest rate and remaining loan term exactly the same.
        </div>

        {/* Key fact chips */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Not a refinance", sub: "This is not a refinance. Your interest rate and loan duration do not change — only the monthly payment is recalculated.", color: c.green || "#166534", bg: "#F0FDF4", border: "#86EFAC" },
            { label: "One-time", sub: "Most servicers — the company you make your mortgage payments to — only allow one recast over the life of the loan.", color: c.navy, bg: c.bgAlt || "#F0F6FB", border: c.border },
            { label: "Costs $300–$500", sub: "The cost varies by servicer. Typical range is $300–$500, paid as a one-time fee when you request the recast.", color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
            { label: "Term stays the same", sub: "Your loan end date and interest rate are unchanged. Only the required monthly payment drops.", color: c.gray, bg: c.bgAlt || "#F0F6FB", border: c.border },
            { label: "Minimum lump sum required", sub: "Most servicers require a minimum payment before they will process a recast — often $10,000 or more. Check with your servicer before planning.", color: c.navy, bg: c.bgAlt || "#F0F6FB", border: c.border, span: true },
          ].map(f => (
            <div key={f.label} style={{ padding: "10px 12px", background: f.bg, border: `1px solid ${f.border}`, borderRadius: 8, ...(f.span ? { gridColumn: "1 / -1" } : {}) }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: f.color, fontFamily: font, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 11, color: c.gray, fontFamily: font, lineHeight: 1.5 }}>{f.sub}</div>
            </div>
          ))}
        </div>

        {/* Recast vs. keeping payment */}
        <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, fontFamily: font, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recast vs. Keeping Your Current Payment</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ padding: "10px 12px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", marginBottom: 4 }}>Recast (lower payment)</div>
            <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.6 }}>Your monthly P&I drops permanently. Payoff date stays the same. You'll pay more in total interest because the balance is spread over the full remaining term.</div>
          </div>
          <div style={{ padding: "10px 12px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", marginBottom: 4 }}>Keep the payment (faster payoff)</div>
            <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.6 }}>If you skip the recast and simply keep making your normal payment, the lump sum still reduces your balance — so a larger portion of each payment goes toward principal. The loan pays off faster than originally scheduled, and you pay less in total interest.</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: c.gray, fontFamily: font, lineHeight: 1.6, padding: "8px 10px", background: c.bgAlt || "#F0F6FB", borderRadius: 6 }}>
          <strong style={{ color: c.navy }}>Rule of thumb:</strong> If you need cash flow relief, recast. If you want to build wealth faster and pay less interest, keep the higher payment. The "Should You Recast?" section below runs both scenarios with your numbers.
        </div>
      </SectionCard>

      {/* ── Loan details + inputs ────────────────────────────────────────────── */}
      <SectionCard title="Recast: Lump Sum Details">

        {/* Source note */}
        <div style={{
          marginBottom: 14, padding: "10px 12px",
          background: c.bgAlt || "#F0F6FB",
          borderRadius: 8, border: `1.5px solid ${c.border || "#D1E3F0"}`,
          fontSize: 13, color: c.gray, lineHeight: 1.6, fontFamily: font,
        }}>
          {hasDetails
            ? <>Enter the month you plan to do the recast and the lump-sum amount you intend to put down. Your original loan amount is <strong>{fmt(Math.round(parseFloat(stripCommas(pcLa))))}</strong> at <strong>{pcRate}%</strong> on a <strong>{pcTerm}-year</strong> term.</>
            : <span style={{ color: "#DC2626" }}>Please enter your loan details in the Payment Calculator tab first — rate, loan amount, and term are needed to run this calculator.</span>
          }
        </div>

        {/* Recast at Month # */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Planned Recast — Month #</label>
          <div style={{ display: "flex", alignItems: "center", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
            <input
              type="number"
              min="1"
              max={(parseInt(pcTerm) || 30) * 12 - 1}
              value={recastAtMonth}
              onChange={e => {
                const v = e.target.value;
                if (v === "" || parseInt(v) >= 1) setRecastAtMonth(v);
              }}
              placeholder=""
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "10px 12px", fontSize: 15, fontWeight: 500, color: c.text || c.navy, fontFamily: font, width: "100%" }}
            />
          </div>
          <div style={{ fontSize: 11, color: c.gray, marginTop: 4, lineHeight: 1.5, fontFamily: font }}>
            {calc && calc.mElapsed > 0
              ? <>
                  Month {calc.mElapsed} = {Math.floor(calc.mElapsed / 12) > 0 ? `${Math.floor(calc.mElapsed / 12)}yr ` : ""}{calc.mElapsed % 12 > 0 ? `${calc.mElapsed % 12}mo ` : ""}into the loan · <strong>{Math.floor(calc.remainingMonths / 12)}yr {calc.remainingMonths % 12}mo</strong> remaining
                </>
              : "Enter the month you want to recast"
            }
          </div>
        </div>

        {/* Lump sum */}
        <LabeledInput
          label="Lump sum payment toward principal"
          prefix="$"
          value={addCommas(lumpSum)}
          onChange={v => setLumpSum(stripCommas(v))}
          useCommas
          hint="Most servicers require a minimum of $10,000 or more"
        />

        {/* Balance at recast / new balance */}
        {calc && calc.currentBal > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: hasResult ? "1fr 1fr" : "1fr", gap: 10, marginTop: 4 }}>
            <div>
              <label style={labelStyle}>Balance at Recast</label>
              <div style={{
                padding: "10px 12px", background: c.bgAlt || "#F0F6FB",
                border: `1.5px solid ${c.border || "#D1E3F0"}`, borderRadius: 8,
                fontSize: 15, fontWeight: 500, color: c.navy || "#133155", fontFamily: font,
              }}>
                {fmt(Math.round(calc.currentBal))}
              </div>
              <div style={{ fontSize: 11, color: c.gray, marginTop: 3, fontFamily: font }}>From amortization schedule · read-only</div>
            </div>
            {hasResult && (
              <div>
                <label style={labelStyle}>New Balance After Lump Sum</label>
                <div style={{
                  padding: "10px 12px", background: c.bgAlt || "#F0F6FB",
                  border: `1.5px solid ${c.border || "#D1E3F0"}`, borderRadius: 8,
                  fontSize: 15, fontWeight: 500, color: c.green || "#166534", fontFamily: font,
                }}>
                  {fmt(Math.round(calc.newBal))}
                </div>
                <div style={{ fontSize: 11, color: c.gray, marginTop: 3, fontFamily: font }}>
                  Reduced by {fmt(Math.round(calc.lump))}
                </div>
              </div>
            )}
          </div>
        )}

      </SectionCard>

      {/* ── Monthly Payment ────────────────────────────────────────────────── */}
      {calc !== null && (
        <SectionCard title="Monthly Payment">
          <ResultRow label="Current P&I at recast date" value={fmt2(calc.currentPI)} bold />
          {hasResult && (
            <>
              <ResultRow label="New P&I after recast" value={fmt2(calc.newPI)} bold />
              <ResultRow label="Monthly savings" value={fmt2(calc.monthlySavings) + " / mo"} large green />
              <ResultRow
                label="Term after recast"
                value={`${Math.floor(calc.remainingMonths / 12)}yr ${calc.remainingMonths % 12}mo (unchanged)`}
                dim
              />
            </>
          )}
        </SectionCard>
      )}

      {/* ── Should You Recast? ─────────────────────────────────────────────── */}
      {hasResult && calc.extraInterestFromRecast !== null && (
        <SectionCard title="Should You Recast?">

          {/* Option A — Recast */}
          <div style={{
            borderLeft: "4px solid #FCA5A5", borderRadius: "0 8px 8px 0",
            background: "#FEF2F2", padding: "12px 14px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 8, fontFamily: font }}>If you recast</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, fontFamily: font }}>
              <div>Monthly payment drops to <strong style={{ color: "#133155" }}>{fmt2(calc.newPI)}</strong>, saving you <strong style={{ color: "#166534" }}>{fmt2(calc.monthlySavings)}/mo</strong></div>
              <div>Remaining term stays at <strong>{Math.floor(calc.remainingMonths / 12)}yr {calc.remainingMonths % 12}mo</strong> (unchanged)</div>
              <div>Total interest you'll still pay: <strong style={{ color: "#DC2626" }}>{fmt(Math.round(calc.interestRecast))}</strong></div>
            </div>
          </div>

          {/* Option B — Keep payment */}
          <div style={{
            borderLeft: "4px solid #86EFAC", borderRadius: "0 8px 8px 0",
            background: "#F0FDF4", padding: "12px 14px", marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 8, fontFamily: font }}>If you keep your current payment instead</div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, fontFamily: font }}>
              <div>Monthly payment stays at <strong style={{ color: "#133155" }}>{fmt2(calc.origPayment)}</strong></div>
              {calc.n_extra < Infinity && (
                <div>Loan paid off in <strong>{Math.floor(calc.n_extra / 12)}yr {calc.n_extra % 12}mo</strong>
                  {calc.monthsSaved !== null && calc.monthsSaved > 0 &&
                    <span style={{ color: "#166534" }}>, paying off <strong>{Math.floor(calc.monthsSaved / 12) > 0 ? `${Math.floor(calc.monthsSaved / 12)}yr ` : ""}{calc.monthsSaved % 12 > 0 ? `${calc.monthsSaved % 12}mo ` : ""}sooner</strong></span>
                  }
                </div>
              )}
              <div>Total interest you'll still pay: <strong style={{ color: "#166534" }}>{fmt(Math.round(calc.interestExtraPrincipal))}</strong>, saving you <strong style={{ color: "#166634" }}>{fmt(Math.round(calc.extraInterestFromRecast))}</strong> compared to recasting</div>
            </div>
          </div>

          {/* Bottom line */}
          <div style={{
            padding: "10px 12px",
            background: "#FFFBEB", border: "1.5px solid #FDE68A",
            borderRadius: 8, fontSize: 13, color: "#78350F", lineHeight: 1.7, fontFamily: font,
          }}>
            <strong>Bottom line:</strong> A recast gives you a lower payment but costs you {fmt(Math.round(calc.extraInterestFromRecast))} more in total interest. If cash flow is tight, recast. If you want to pay less overall and own your home sooner, keep the higher payment.
          </div>

        </SectionCard>
      )}


    </div>
  );
}

window.RecastCalculator = RecastCalculator;
