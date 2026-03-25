// modules/calculators/FlyerGenerator.js
const { useMemo } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const COLORS = window.COLORS;
const font = window.font;
const LabeledInput = window.LabeledInput;
const SectionCard = window.SectionCard;
const Button = window.Button;
const fmt = window.fmt;

function FlyerGenerator() {
  const c = useThemeColors();
  const [propAddr, setPropAddr] = useLocalStorage("fly_addr", "123 Main Street, Dallas, TX 75201");
  const [propPrice, setPropPrice] = useLocalStorage("fly_price", 425000);
  const [beds, setBeds] = useLocalStorage("fly_beds", 4);
  const [baths, setBaths] = useLocalStorage("fly_baths", 3);
  const [sqft, setSqft] = useLocalStorage("fly_sqft", 2400);
  const [rate, setRate] = useLocalStorage("fly_rate", 6.5);
  const [downPct, setDownPct] = useLocalStorage("fly_down", 5);
  const [agentName, setAgentName] = useLocalStorage("fly_agent", "");
  const [agentPhone, setAgentPhone] = useLocalStorage("fly_agentph", "");
  const [agentEmail, setAgentEmail] = useLocalStorage("fly_agentem", "");
  const [agentCompany, setAgentCompany] = useLocalStorage("fly_agentco", "");
  const [loName] = useLocalStorage("brand_sub", "MORTGAGE MARK · CMG HOME LOANS · NMLS #729612");
  const [headline, setHeadline] = useLocalStorage("fly_headline", "Your Dream Home Awaits!");
  const [brandColor] = useLocalStorage("brand_color", COLORS.navy);

  const calc = useMemo(() => {
    const p = Number(propPrice), r = Number(rate) / 100 / 12, dp = Number(downPct) / 100;
    const loan = p * (1 - dp);
    const n = 360;
    const pmt = r > 0 ? loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loan / n;
    return { loan, downPayment: p * dp, payment: pmt };
  }, [propPrice, rate, downPct]);

  const printFlyer = () => {
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'DM Sans', sans-serif; }
      .flyer { width: 8.5in; min-height: 11in; padding: 0.5in; }
      .header { background: ${brandColor}; color: white; padding: 28px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
      .header h1 { font-size: 28px; margin-bottom: 4px; }
      .header h2 { font-size: 16px; font-weight: 400; opacity: 0.9; }
      .details { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
      .detail-box { background: #F5F8FA; padding: 16px; border-radius: 10px; text-align: center; }
      .detail-box .value { font-size: 22px; font-weight: 700; color: ${brandColor}; }
      .detail-box .label { font-size: 12px; color: #6B7C93; margin-top: 2px; }
      .payment-box { background: ${brandColor}11; border: 2px solid ${brandColor}33; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
      .payment-box .big { font-size: 36px; font-weight: 700; color: ${brandColor}; }
      .payment-box .sub { font-size: 13px; color: #6B7C93; }
      .footer { display: flex; justify-content: space-between; border-top: 2px solid #E8ECF0; padding-top: 16px; margin-top: 20px; }
      .contact { font-size: 13px; line-height: 1.6; }
      .contact strong { color: ${brandColor}; }
      @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .mtk-fade-in { animation: fadeSlideIn 0.3s ease-out both; }
      .mtk-scale-in { animation: scaleIn 0.25s ease-out both; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
    <div class="flyer">
      <div class="header"><h1>${headline}</h1><h2>${propAddr}</h2></div>
      <div class="details">
        <div class="detail-box"><div class="value">${beds}</div><div class="label">Bedrooms</div></div>
        <div class="detail-box"><div class="value">${baths}</div><div class="label">Bathrooms</div></div>
        <div class="detail-box"><div class="value">${Number(sqft).toLocaleString()}</div><div class="label">Sq Ft</div></div>
      </div>
      <div class="payment-box">
        <div class="sub">Listed at</div>
        <div class="big">${Number(propPrice).toLocaleString()}</div>
      </div>
      <div class="details">
        <div class="detail-box"><div class="value">${Math.round(calc.payment).toLocaleString()}/mo</div><div class="label">Est. Payment*</div></div>
        <div class="detail-box"><div class="value">${downPct}% Down</div><div class="label">${Math.round(calc.downPayment).toLocaleString()}</div></div>
        <div class="detail-box"><div class="value">${rate}%</div><div class="label">Today's Rate</div></div>
      </div>
      <div style="font-size:10px;color:#999;text-align:center;margin:12px 0;">*Estimated P&I only. Does not include taxes, insurance, or MI. Rates subject to change.</div>
      <div class="footer">
        <div class="contact"><strong>Your Realtor</strong><br/>${agentName || "Agent Name"}<br/>${agentPhone || "Phone"}<br/>${agentEmail || "Email"}<br/>${agentCompany || "Company"}</div>
        <div class="contact" style="text-align:right;"><strong>Your Lender</strong><br/>${loName}<br/>mymortgagemark@gmail.com</div>
      </div>
    </div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900, margin: "0 auto" }}>
      <SectionCard title="Property Details" c={c}>
        <LabeledInput label="Property Address" value={propAddr} onChange={setPropAddr} c={c} />
        <LabeledInput label="List Price ($)" value={propPrice} onChange={setPropPrice} type="number" c={c} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <LabeledInput label="Beds" value={beds} onChange={setBeds} type="number" c={c} />
          <LabeledInput label="Baths" value={baths} onChange={setBaths} type="number" c={c} />
          <LabeledInput label="Sq Ft" value={sqft} onChange={setSqft} type="number" c={c} />
        </div>
        <LabeledInput label="Headline" value={headline} onChange={setHeadline} c={c} />
      </SectionCard>
      <SectionCard title="Loan Details" c={c}>
        <LabeledInput label="Rate (%)" value={rate} onChange={setRate} type="number" step="0.125" c={c} />
        <LabeledInput label="Down Payment (%)" value={downPct} onChange={setDownPct} type="number" c={c} />
        <div style={{ marginTop: 12, padding: 14, background: c.bg, borderRadius: 10, textAlign: "center", fontFamily: font }}>
          <div style={{ fontSize: 12, color: c.muted }}>Estimated Payment</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: c.navy }}>{fmt(Math.round(calc.payment))}/mo</div>
        </div>
      </SectionCard>
      <SectionCard title="Realtor Info (Co-Marketing)" c={c}>
        <LabeledInput label="Agent Name" value={agentName} onChange={setAgentName} c={c} />
        <LabeledInput label="Agent Phone" value={agentPhone} onChange={setAgentPhone} c={c} />
        <LabeledInput label="Agent Email" value={agentEmail} onChange={setAgentEmail} c={c} />
        <LabeledInput label="Company/Brokerage" value={agentCompany} onChange={setAgentCompany} c={c} />
      </SectionCard>
      <SectionCard title="Preview & Print" c={c}>
        <div style={{ padding: 16, background: c.bg, borderRadius: 10, textAlign: "center", fontFamily: font }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.navy, marginBottom: 4 }}>{headline}</div>
          <div style={{ fontSize: 13, color: c.muted, marginBottom: 12 }}>{propAddr}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: c.text }}>{beds} bd</span>
            <span style={{ fontSize: 13, color: c.text }}>{baths} ba</span>
            <span style={{ fontSize: 13, color: c.text }}>{Number(sqft).toLocaleString()} sqft</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: c.navy }}>{fmt(Number(propPrice))}</div>
          <div style={{ fontSize: 14, color: c.green, fontWeight: 600, marginTop: 4 }}>{fmt(Math.round(calc.payment))}/mo est.</div>
        </div>
        <Button onClick={printFlyer} c={c}>🖨️ Print Co-Marketing Flyer</Button>
      </SectionCard>
    </div>
  );
}
window.FlyerGenerator = FlyerGenerator;
