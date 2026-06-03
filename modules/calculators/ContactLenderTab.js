// modules/calculators/ContactLenderTab.js
// Vendor Contacts — two-tier: LO preferred vendors + client's own vendors
const { useState, useEffect } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors  = window.useThemeColors;
const SectionCard     = window.SectionCard;
const font            = window.font;

// ── Per-scenario client vendor storage ────────────────────────────────────────
function getClientVendorKey(scenarioId, vendor, field) {
  return "vnd_cli_" + (scenarioId || "default") + "_" + vendor + "_" + field;
}
function readClientVendor(scenarioId, vendor, field) {
  try { return localStorage.getItem(getClientVendorKey(scenarioId, vendor, field)) || ""; } catch(e) { return ""; }
}
function writeClientVendor(scenarioId, vendor, field, value) {
  try { localStorage.setItem(getClientVendorKey(scenarioId, vendor, field), value); } catch(e) {}
}
function hasClientVendors(scenarioId) {
  var vendors = ["bld", "rea", "ins", "ttl"];
  var fields  = ["name", "ph", "em"];
  return vendors.some(function(v) {
    return fields.some(function(f) {
      return !!readClientVendor(scenarioId, v, f);
    });
  });
}
function getClientVendorData(scenarioId) {
  var vendors = ["bld", "rea", "ins", "ttl"];
  var labels  = { bld: "Builder", rea: "Realtor", ins: "Insurance", ttl: "Title" };
  return vendors.map(function(v) {
    var name    = readClientVendor(scenarioId, v, "name");
    var company = readClientVendor(scenarioId, v, "co");
    var phone   = readClientVendor(scenarioId, v, "ph");
    var email   = readClientVendor(scenarioId, v, "em");
    return { key: v, label: labels[v], name: name, company: company, phone: phone, email: email };
  }).filter(function(v) { return v.name || v.phone || v.email; });
}
window.hasClientVendors    = hasClientVendors;
window.getClientVendorData = getClientVendorData;

// ── Main Component ─────────────────────────────────────────────────────────────
function ContactLenderTab({ isInternal, scenario, user }) {
  const c = useThemeColors();
  const scenarioId = scenario && scenario.id ? scenario.id : null;

  // ── LO info (from Pre-Qual Letter settings) ──
  const [loName]    = useLocalStorage("pq_lo",      "");
  const [loTitle]   = useLocalStorage("pq_lotitle", "");
  const [loNMLS]    = useLocalStorage("pq_lonmls",  "");
  const [loPhone]   = useLocalStorage("pq_loph",    "");
  const [loCell]    = useLocalStorage("pq_locell",  "");
  const [loEmail]   = useLocalStorage("pq_loem",    "");
  const [loWebsite] = useLocalStorage("pq_loweb",   "");
  const [brandName] = useLocalStorage("brand_name", "");

  // ── LO preferred vendors ──
  const [bldName,    setBldName]    = useLocalStorage("vnd_bld_name",  "");
  const [bldCompany, setBldCompany] = useLocalStorage("vnd_bld_co",    "");
  const [bldPhone,   setBldPhone]   = useLocalStorage("vnd_bld_ph",    "");
  const [bldEmail,   setBldEmail]   = useLocalStorage("vnd_bld_em",    "");
  const [bldWebsite, setBldWebsite] = useLocalStorage("vnd_bld_web",   "");
  const [reaName,    setReaName]    = useLocalStorage("vnd_rea_name",  "");
  const [reaCompany, setReaCompany] = useLocalStorage("vnd_rea_co",    "");
  const [reaPhone,   setReaPhone]   = useLocalStorage("vnd_rea_ph",    "");
  const [reaEmail,   setReaEmail]   = useLocalStorage("vnd_rea_em",    "");
  const [insName,    setInsName]    = useLocalStorage("vnd_ins_name",  "");
  const [insCompany, setInsCompany] = useLocalStorage("vnd_ins_co",    "");
  const [insPhone,   setInsPhone]   = useLocalStorage("vnd_ins_ph",    "");
  const [insEmail,   setInsEmail]   = useLocalStorage("vnd_ins_em",    "");
  const [ttlName,    setTtlName]    = useLocalStorage("vnd_ttl_name",  "");
  const [ttlCompany, setTtlCompany] = useLocalStorage("vnd_ttl_co",    "");
  const [ttlPhone,   setTtlPhone]   = useLocalStorage("vnd_ttl_ph",    "");
  const [ttlEmail,   setTtlEmail]   = useLocalStorage("vnd_ttl_em",    "");

  // ── Client vendors (per-scenario, local state synced to localStorage) ──
  function useClientVendor(vendor, field) {
    const [val, setVal] = useState(function() { return readClientVendor(scenarioId, vendor, field); });
    function update(v) {
      setVal(v);
      writeClientVendor(scenarioId, vendor, field, v);
      // Notify LO view
      try { window.dispatchEvent(new Event("storage")); } catch(e) {}
    }
    return [val, update];
  }

  const [cBldName,    setCBldName]    = useClientVendor("bld", "name");
  const [cBldCompany, setCBldCompany] = useClientVendor("bld", "co");
  const [cBldPhone,   setCBldPhone]   = useClientVendor("bld", "ph");
  const [cBldEmail,   setCBldEmail]   = useClientVendor("bld", "em");
  const [cReaName,    setCReaName]    = useClientVendor("rea", "name");
  const [cReaCompany, setCReaCompany] = useClientVendor("rea", "co");
  const [cReaPhone,   setCReaPhone]   = useClientVendor("rea", "ph");
  const [cReaEmail,   setCReaEmail]   = useClientVendor("rea", "em");
  const [cInsName,    setCInsName]    = useClientVendor("ins", "name");
  const [cInsCompany, setCInsCompany] = useClientVendor("ins", "co");
  const [cInsPhone,   setCInsPhone]   = useClientVendor("ins", "ph");
  const [cInsEmail,   setCInsEmail]   = useClientVendor("ins", "em");
  const [cTtlName,    setCTtlName]    = useClientVendor("ttl", "name");
  const [cTtlCompany, setCTtlCompany] = useClientVendor("ttl", "co");
  const [cTtlPhone,   setCTtlPhone]   = useClientVendor("ttl", "ph");
  const [cTtlEmail,   setCTtlEmail]   = useClientVendor("ttl", "em");

  // ── Helpers ──
  function fmtPhone(raw) {
    const d = (raw || "").replace(/\D/g, "");
    if (d.length < 4) return raw || "";
    if (d.length < 7) return "(" + d.slice(0,3) + ") " + d.slice(3);
    return "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6,10);
  }

  const labelSt = { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.gray, fontFamily: font, marginBottom: 4, display: "block" };
  const inputSt = { width: "100%", padding: "9px 12px", border: "1.5px solid " + c.border, borderRadius: 8, fontSize: 14, fontFamily: font, color: c.text, background: c.bg, outline: "none", boxSizing: "border-box" };

  // ── Contact row ──
  function ContactRow({ icon, label, value, href }) {
    if (!value) return null;
    return React.createElement("a", {
      href: href, target: href && href.startsWith("http") ? "_blank" : undefined, rel: "noopener noreferrer",
      style: { display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: c.text, padding: "9px 0", borderBottom: "1px solid " + c.border }
    },
      React.createElement("span", { style: { fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 } }, icon),
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: c.gray, fontFamily: font } }, label),
        React.createElement("div", { style: { fontSize: 14, fontWeight: 600, fontFamily: font } }, value)
      )
    );
  }

  // ── Read-only vendor card ──
  function VendorCard({ name, company, phone, email, website, title, nmls }) {
    const hasAny = name || company || phone || email || website;
    if (!hasAny) return React.createElement("div", { style: { fontSize: 13, color: c.gray, fontFamily: font, fontStyle: "italic", padding: "8px 0" } }, "Not set up yet.");
    return React.createElement("div", { style: { fontFamily: font } },
      (name || company) && React.createElement("div", { style: { marginBottom: 10 } },
        name    && React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: c.text } }, name),
        title   && React.createElement("div", { style: { fontSize: 12, color: c.gray, marginTop: 2 } }, title),
        nmls    && React.createElement("div", { style: { fontSize: 12, color: c.gray } }, "NMLS #" + nmls),
        company && React.createElement("div", { style: { fontSize: 13, color: c.gray, marginTop: 2 } }, company)
      ),
      React.createElement("div", null,
        React.createElement(ContactRow, { icon: "📞", label: "Phone",   value: fmtPhone(phone),   href: phone   ? "tel:" + phone.replace(/\D/g,"")   : undefined }),
        React.createElement(ContactRow, { icon: "✉️",  label: "Email",   value: email,             href: email   ? "mailto:" + email                   : undefined }),
        React.createElement(ContactRow, { icon: "🌐", label: "Website", value: website,           href: website ? (website.startsWith("http") ? website : "https://" + website) : undefined })
      )
    );
  }

  // ── Edit fields ──
  function VendorEdit({ nameVal, setName, companyVal, setCompany, phoneVal, setPhone, emailVal, setEmail, websiteVal, setWebsite, namePh, companyPh }) {
    return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
      React.createElement("div", null, React.createElement("label", { style: labelSt }, "Name"), React.createElement("input", { style: inputSt, value: nameVal, onChange: function(e) { setName(e.target.value); }, placeholder: namePh || "Name" })),
      React.createElement("div", null, React.createElement("label", { style: labelSt }, "Company"), React.createElement("input", { style: inputSt, value: companyVal, onChange: function(e) { setCompany(e.target.value); }, placeholder: companyPh || "Company" })),
      React.createElement("div", null, React.createElement("label", { style: labelSt }, "Phone"), React.createElement("input", { style: inputSt, type: "tel", inputMode: "tel", value: phoneVal, onChange: function(e) { setPhone(e.target.value); }, placeholder: "(555) 555-5555" })),
      React.createElement("div", null, React.createElement("label", { style: labelSt }, "Email"), React.createElement("input", { style: inputSt, type: "email", value: emailVal, onChange: function(e) { setEmail(e.target.value); }, placeholder: "email@example.com" })),
      websiteVal !== undefined && React.createElement("div", null, React.createElement("label", { style: labelSt }, "Website"), React.createElement("input", { style: inputSt, value: websiteVal || "", onChange: function(e) { if (setWebsite) setWebsite(e.target.value); }, placeholder: "https://..." }))
    );
  }

  // ── Two-tier vendor section ──
  function VendorSection({ title, accent, loName, loCompany, loPhone, loEmail, loWebsite,
                            setLoName, setLoCompany, setLoPhone, setLoEmail, setLoWebsite,
                            cName, cCompany, cPhone, cEmail, setCName, setCCompany, setCPhone, setCEmail,
                            namePh, companyPh }) {
    const hasLoData  = loName || loPhone || loEmail;
    const hasCliData = cName  || cPhone  || cEmail;
    return React.createElement(SectionCard, { title: title, accent: accent },
      // LO preferred vendor
      React.createElement("div", { style: { marginBottom: hasCliData || !isInternal ? 16 : 0 } },
        React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: c.gray, fontFamily: font, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 } },
          isInternal ? "Your Preferred Contact" : "From Your Loan Officer"
        ),
        isInternal
          ? React.createElement(VendorEdit, { nameVal: loName, setName: setLoName, companyVal: loCompany, setCompany: setLoCompany, phoneVal: loPhone, setPhone: setLoPhone, emailVal: loEmail, setEmail: setLoEmail, websiteVal: loWebsite, setWebsite: setLoWebsite, namePh: namePh, companyPh: companyPh })
          : React.createElement(VendorCard, { name: loName, company: loCompany, phone: loPhone, email: loEmail, website: loWebsite })
      ),
      // Divider
      (hasLoData || isInternal) && React.createElement("hr", { style: { border: "none", borderTop: "1px solid " + c.border, margin: "16px 0" } }),
      // Client's vendor
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: c.gray, fontFamily: font, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 } },
          isInternal ? "Client's Contact" : "Your Contact"
        ),
        isInternal
          ? React.createElement(VendorCard, { name: cName, company: cCompany, phone: cPhone, email: cEmail })
          : React.createElement(VendorEdit, { nameVal: cName, setName: setCName, companyVal: cCompany, setCompany: setCCompany, phoneVal: cPhone, setPhone: setCPhone, emailVal: cEmail, setEmail: setCEmail, namePh: namePh, companyPh: companyPh })
      )
    );
  }

  // ── Render ──
  return React.createElement("div", { style: { maxWidth: 640, margin: 0, padding: "16px 12px", fontFamily: font } },

    // 1 — Builder
    React.createElement(VendorSection, { title: "Builder", accent: "#f97316",
      loName: bldName, loCompany: bldCompany, loPhone: bldPhone, loEmail: bldEmail, loWebsite: bldWebsite,
      setLoName: setBldName, setLoCompany: setBldCompany, setLoPhone: setBldPhone, setLoEmail: setBldEmail, setLoWebsite: setBldWebsite,
      cName: cBldName, cCompany: cBldCompany, cPhone: cBldPhone, cEmail: cBldEmail,
      setCName: setCBldName, setCCompany: setCBldCompany, setCPhone: setCBldPhone, setCEmail: setCBldEmail,
      namePh: "Builder / Sales Rep", companyPh: "Builder company" }),

    // 2 — Realtor
    React.createElement(VendorSection, { title: "Realtor", accent: "#7c3aed",
      loName: reaName, loCompany: reaCompany, loPhone: reaPhone, loEmail: reaEmail,
      setLoName: setReaName, setLoCompany: setReaCompany, setLoPhone: setReaPhone, setLoEmail: setReaEmail,
      cName: cReaName, cCompany: cReaCompany, cPhone: cReaPhone, cEmail: cReaEmail,
      setCName: setCReaName, setCCompany: setCReaCompany, setCPhone: setCReaPhone, setCEmail: setCReaEmail,
      namePh: "Agent name", companyPh: "Brokerage" }),

    // 3 — Lender (read-only — from PQ settings)
    React.createElement(SectionCard, { title: "Lender", accent: "#0C4160" },
      React.createElement(VendorCard, { name: loName, company: brandName, phone: loPhone || loCell, email: loEmail, website: loWebsite, title: loTitle, nmls: loNMLS }),
      isInternal && React.createElement("div", { style: { marginTop: 8, fontSize: 12, color: c.gray, fontFamily: font, fontStyle: "italic" } }, "Pulled from Pre-Qual Letter settings.")
    ),

    // 4 — Insurance
    React.createElement(VendorSection, { title: "Insurance", accent: "#0891b2",
      loName: insName, loCompany: insCompany, loPhone: insPhone, loEmail: insEmail,
      setLoName: setInsName, setLoCompany: setInsCompany, setLoPhone: setInsPhone, setLoEmail: setInsEmail,
      cName: cInsName, cCompany: cInsCompany, cPhone: cInsPhone, cEmail: cInsEmail,
      setCName: setCInsName, setCCompany: setCInsCompany, setCPhone: setCInsPhone, setCEmail: setCInsEmail,
      namePh: "Agent name", companyPh: "Insurance company" }),

    // 5 — Title
    React.createElement(VendorSection, { title: "Title Company", accent: "#16a34a",
      loName: ttlName, loCompany: ttlCompany, loPhone: ttlPhone, loEmail: ttlEmail,
      setLoName: setTtlName, setLoCompany: setTtlCompany, setLoPhone: setTtlPhone, setLoEmail: setTtlEmail,
      cName: cTtlName, cCompany: cTtlCompany, cPhone: cTtlPhone, cEmail: cTtlEmail,
      setCName: setCTtlName, setCCompany: setCTtlCompany, setCPhone: setCTtlPhone, setCEmail: setCTtlEmail,
      namePh: "Title officer / attorney", companyPh: "Title company" })
  );
}

window.ContactLenderTab = ContactLenderTab;
