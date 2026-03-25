// modules/hooks.js
const { useState, useEffect } = React;

function useLocalStorage(key, defaultValue) {
  const fullKey = "mtk_" + key;
  const readFromLS = () => {
    try { const s = localStorage.getItem(fullKey); return s !== null ? JSON.parse(s) : defaultValue; }
    catch { return defaultValue; }
  };
  const [value, setValue] = useState(readFromLS);
  useEffect(() => { try { localStorage.setItem(fullKey, JSON.stringify(value)); } catch {} }, [value]);
  // Re-read from localStorage when shared values are propagated
  useEffect(() => {
    const handler = () => {
      const fresh = readFromLS();
      setValue(prev => JSON.stringify(prev) !== JSON.stringify(fresh) ? fresh : prev);
    };
    window.addEventListener("mtk_propagated", handler);
    return () => window.removeEventListener("mtk_propagated", handler);
  }, []);
  return [value, setValue];
}
window.useLocalStorage = useLocalStorage;

// ThemeContext — created here so all modules loaded after hooks.js can access it
const ThemeContext = React.createContext({ dark: false, colors: window.COLORS || {} });
window.ThemeContext = ThemeContext;

function useThemeColors() {
  const ctx = React.useContext(ThemeContext);
  return (ctx && ctx.colors) ? ctx.colors : (window.COLORS || {});
}
window.useThemeColors = useThemeColors;
