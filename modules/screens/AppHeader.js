// modules/screens/AppHeader.js
// Universal top-right header actions — profile circle, gear dropdown, nav buttons.
// Used across MortgageToolkit, ScenarioDashboard, and ContactsTab.

const { useState: _ahUseState, useEffect: _ahUseEffect, useRef: _ahUseRef } = React;
const _ahUseLocalStorage = window.useLocalStorage;

function AppHeader({
  user,
  darkMode,
  setDarkMode,
  userRole,
  setUserRole,
  onContacts,
  onScenarios,
  onMyProfile,
  onContactInfo,
  onLoginSettings,
  onTeam,
  onTemplates,
  onWarnings,
  onModules,
  onLogout,
  isInternal,
  isAdmin,
}) {
  const [showProfile, setShowProfile] = _ahUseState(false);
  const [dropPos, setDropPos] = _ahUseState(null);
  const [appLang, setAppLangAH] = _ahUseLocalStorage ? _ahUseLocalStorage("app_lang", "en") : _ahUseState("en");
  const rootRef = _ahUseRef(null);
  const btnRef  = _ahUseRef(null);
  const f = window.font || "'DM Sans', sans-serif";

  function getInitials(u) {
    if (!u) return "?";
    const name = (u.name || u.display_name || u.email || "").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return name.slice(0, 1).toUpperCase() || "?";
  }

  _ahUseEffect(() => {
    if (!showProfile) return;
    function handleOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showProfile]);

  const navBtn = {
    padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer",
    fontSize: 13, fontWeight: 600, fontFamily: f,
    background: "rgba(255,255,255,0.15)", color: "#fff", whiteSpace: "nowrap",
  };

  const circleBtn = (active) => ({
    width: 34, height: 34, borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.4)",
    background: active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.18)",
    color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: f,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  });

  // Dropdown uses position:fixed so it escapes overflow:hidden sidebar containers.
  // Position is calculated from the button's bounding rect on open.
  function openAtBtn() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({
        // Open upward when button is in lower half of screen, downward otherwise
        openUp: r.bottom > window.innerHeight * 0.55,
        top: r.bottom + 8,
        bottom: window.innerHeight - r.top + 8,
        left: r.left,
      });
    }
  }

  const dropdown = {
    position: "fixed", zIndex: 2000,
    background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    minWidth: 190, overflow: "hidden", border: "1px solid #E5EAF0",
  };

  const dropItem = {
    display: "block", width: "100%", padding: "11px 16px",
    border: "none", background: "transparent", cursor: "pointer",
    fontSize: 13, fontWeight: 500, color: "#1B2A3B", textAlign: "left",
    fontFamily: f,
  };

  const sectionLabel = {
    padding: "6px 16px 4px", fontSize: 10, fontWeight: 700,
    color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase",
  };

  const divider = { margin: "4px 0", borderTop: "1px solid #E5EAF0", borderBottom: "none" };

  const roleLabels = {
    admin:   "Admin View",
    lo:      "LO View",
    realtor: "Realtor View",
    builder: "Builder View",
    client:  "Client View",
  };

  const initials = getInitials(user);

  return (
    <div ref={rootRef} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>

      {/* ── View label ── */}
      {userRole && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase", letterSpacing: "0.07em",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {roleLabels[userRole] || userRole}
          </div>
          {(user?.name || user?.email) && (
            <div style={{
              fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              marginTop: 1,
            }}>
              {user.name || user.email}
            </div>
          )}
        </div>
      )}

      {/* ── Profile circle dropdown (includes all settings) ── */}
      <div style={{ position: "relative" }}>
        <button
          ref={btnRef}
          onClick={function() { if (!showProfile) { openAtBtn(); } setShowProfile(function(p) { return !p; }); }}
          style={circleBtn(showProfile)}
          title={user?.name || user?.email || "Profile"}
        >{initials}</button>

        {showProfile && dropPos && (
          <div style={{
            ...dropdown,
            top:    dropPos.openUp ? "auto"       : dropPos.top,
            bottom: dropPos.openUp ? dropPos.bottom : "auto",
            left:   dropPos.left,
          }}>
            {(user?.name || user?.email) && (
              <>
                <div style={{
                  padding: "10px 16px 8px",
                  fontSize: 13, fontWeight: 700, color: "#1B2A3B", fontFamily: f,
                }}>
                  {user?.name || user?.email}
                </div>
                <hr style={divider} />
              </>
            )}

            {onContactInfo && (
              <button
                style={dropItem}
                onClick={() => { onContactInfo(); setShowProfile(false); }}
              >
                📋 My Profile &amp; NMLS
              </button>
            )}

            {onLoginSettings && (
              <button
                style={dropItem}
                onClick={() => { onLoginSettings(); setShowProfile(false); }}
              >
                🔑 Login & Password
              </button>
            )}

            {onMyProfile && !onContactInfo && (
              <button
                style={dropItem}
                onClick={() => { onMyProfile(); setShowProfile(false); }}
              >
                👤 My Profile
              </button>
            )}

            {isAdmin && onTeam && (
              <button
                style={dropItem}
                onClick={() => { onTeam(); setShowProfile(false); }}
              >
                👥 Team
              </button>
            )}

            <hr style={divider} />
            <div style={sectionLabel}>Settings</div>

            <button
              style={dropItem}
              onClick={() => { setDarkMode(!darkMode); setShowProfile(false); }}
            >
              {darkMode ? "☀️  Light Mode" : "🌙  Dark Mode"}
            </button>

            {isInternal && onTemplates && (
              <button
                style={dropItem}
                onClick={() => { onTemplates(); setShowProfile(false); }}
              >
                📋 Templates
              </button>
            )}

            {isInternal && onWarnings && (
              <button
                style={dropItem}
                onClick={() => { onWarnings(); setShowProfile(false); }}
              >
                ⚠️ Warnings
              </button>
            )}

            {isInternal && onModules && (
              <button
                style={dropItem}
                onClick={() => { onModules(); setShowProfile(false); }}
              >
                🧩 Modules
              </button>
            )}

            {isAdmin && setUserRole && (
              <>
                <hr style={divider} />
                <div style={sectionLabel}>View Options</div>
                {["admin", "lo", "realtor", "builder", "client"].map(r => (
                  <button
                    key={r}
                    style={{
                      ...dropItem,
                      fontWeight: userRole === r ? 700 : 500,
                      color: userRole === r ? "#2563eb" : "#1B2A3B",
                    }}
                    onClick={() => { setUserRole(r); setShowProfile(false); }}
                  >
                    {userRole === r ? "✓ " : "   "}{roleLabels[r]}
                  </button>
                ))}
              </>
            )}

            <hr style={divider} />
            <button
              style={dropItem}
              onClick={() => {
                var next = appLang === "es" ? "en" : "es";
                try { localStorage.setItem("app_lang", next); } catch(e) {}
                setShowProfile(false);
                setTimeout(function() { window.location.reload(); }, 50);
              }}
            >
              {appLang === "es" ? "🇺🇸 Switch to English" : "🇲🇽 Cambiar a Español"}
            </button>

            <hr style={divider} />
            <button
              style={{ ...dropItem, color: "#dc2626" }}
              onClick={() => { setShowProfile(false); onLogout(); }}
            >
              Log Out
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

window.AppHeader = AppHeader;
