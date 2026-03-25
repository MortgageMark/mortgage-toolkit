// modules/screens/LOSelector.js
const { useState } = React;
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const propagateLOToPreQual = window.propagateLOToPreQual;

function LOSelector() {
  const c = useThemeColors();
  const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const [roster] = useLocalStorage("roster", []);
  const [selectedLO, setSelectedLO] = useLocalStorage("lo_selected", "");
  const eligibleLOs = roster.filter(function(m) {
    return m.active && (m.role === "admin" || m.role === "lo" || m.role === "internal");
  });

  const handleChange = function(e) {
    const memberId = e.target.value;
    // Write to localStorage immediately so mtk_propagated doesn't revert the selection
    try { localStorage.setItem("mtk_lo_selected", JSON.stringify(memberId)); } catch {}
    setSelectedLO(memberId);
    if (!memberId) return;
    const member = roster.find(function(m) { return m.id === memberId; });
    if (member) propagateLOToPreQual(member);
  };

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
      flexWrap: "wrap"
    }
  },
    React.createElement("span", {
      style: { fontSize: 12, fontWeight: 700, color: c.navy, fontFamily: font, textTransform: "uppercase", letterSpacing: "0.06em" }
    }, "\uD83D\uDC64 LO of Record:"),
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
        minWidth: 200
      }
    },
      React.createElement("option", { value: "" }, "-- Select LO --"),
      eligibleLOs.map(function(m) {
        return React.createElement("option", { key: m.id, value: m.id },
          m.name + (m.nmls ? " (NMLS #" + m.nmls + ")" : "")
        );
      })
    ),
  );
}

window.LOSelector = LOSelector;
