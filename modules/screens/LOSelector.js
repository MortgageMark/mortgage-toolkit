// modules/screens/LOSelector.js
const { useState, useEffect } = React;
const useLocalStorage      = window.useLocalStorage;
const useThemeColors       = window.useThemeColors;
const propagateLOToPreQual = window.propagateLOToPreQual;
const supabase             = window._supabaseClient;

// Map a Supabase profile row to the shape propagateLOToPreQual expects
function profileToMember(p) {
  return {
    id:          p.id,
    name:        p.display_name || p.email || "",
    nmls:        p.nmls         || "",
    phone:       p.phone        || "",
    cell:        p.cell_phone   || "",
    fax:         p.fax          || "",
    email:       p.email        || "",
    email_display: p.email_display || p.email || "",
    title:       p.title        || "",
    company:     p.company      || "",
    companyNMLS: p.company_nmls || "",
    branchNmls:  p.branch_nmls  || "",
    website:     p.website      || "",
    address:     p.address      || "",
    city:        p.city         || "",
    state:       p.state        || "",
    zip:         p.zip          || "",
  };
}

function LOSelector() {
  const c    = useThemeColors();
  const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const [members,    setMembers]    = useState([]);
  const [selectedLO, setSelectedLO] = useLocalStorage("lo_selected", "");

  // Fetch LO-eligible profiles from Supabase on mount
  useEffect(function() {
    if (!supabase) return;
    supabase
      .from("profiles")
      .select("id, display_name, email, email_display, nmls, branch_nmls, company_nmls, phone, cell_phone, title, company, website, address, city, state, zip")
      .in("role", ["admin", "super_admin", "branch_admin", "internal"])
      .order("display_name", { ascending: true })
      .then(function(res) {
        if (!res.error && res.data) {
          setMembers(res.data.map(profileToMember));
        }
      });
  }, []);

  // Re-propagate on mount so LO fields are always populated after scenario restore
  useEffect(function() {
    if (!selectedLO || members.length === 0) return;
    const member = members.find(function(m) { return m.id === selectedLO; });
    if (member) propagateLOToPreQual(member);
  }, [selectedLO, members]);

  function handleChange(e) {
    const memberId = e.target.value;
    try { localStorage.setItem("mtk_lo_selected", JSON.stringify(memberId)); } catch {}
    setSelectedLO(memberId);
    if (!memberId) return;
    const member = members.find(function(m) { return m.id === memberId; });
    if (member) propagateLOToPreQual(member);
    window.dispatchEvent(new Event("mtk_save_scenario"));
  }

  return React.createElement("div", {
    style: {
      background: c.blueLight || "#E8F4FA",
      border: "1px solid " + (c.blue || "#48A0CE") + "33",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    }
  },
    React.createElement("span", {
      style: { fontSize: 12, fontWeight: 700, color: c.navy, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em" }
    }, "LO of Record:"),
    React.createElement("select", {
      value: selectedLO,
      onChange: handleChange,
      style: {
        padding: "8px 12px",
        border: "1.5px solid " + c.border,
        borderRadius: 8,
        fontSize: 14,
        fontFamily: font,
        fontWeight: 500,
        color: c.text || c.navy,
        background: c.white,
        cursor: "pointer",
        minWidth: 200,
      }
    },
      React.createElement("option", { value: "" }, "-- Select LO --"),
      members.map(function(m) {
        return React.createElement("option", { key: m.id, value: m.id },
          m.name + (m.nmls ? " (NMLS #" + m.nmls + ")" : "")
        );
      })
    )
  );
}

window.LOSelector = LOSelector;
