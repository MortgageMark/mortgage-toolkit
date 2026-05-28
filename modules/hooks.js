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

// Evaluates a structured conditions array (from Supabase) against calculator state.
// All conditions are AND-ed. Operators: is, is_not (strings); gt, gte, lt, lte, eq (numbers).
function evaluateCustomRule(conditions, state) {
  if (!conditions || conditions.length === 0) return false;
  return conditions.every(cond => {
    const val = state[cond.field];
    const cv  = cond.value;
    switch (cond.op) {
      case "is":     return String(val) === String(cv);
      case "is_not": return String(val) !== String(cv);
      case "gt":     return parseFloat(val) > parseFloat(cv);
      case "gte":    return parseFloat(val) >= parseFloat(cv);
      case "lt":     return parseFloat(val) < parseFloat(cv);
      case "lte":    return parseFloat(val) <= parseFloat(cv);
      case "eq":     return parseFloat(val) === parseFloat(cv);
      default:       return false;
    }
  });
}
window.evaluateCustomRule = evaluateCustomRule;

// Merges hardcoded WARNING_RULES with tenant custom rules from Supabase.
// suppressions: array of hardcoded rule IDs to skip.
// customRules: array of rule objects fetched from Supabase (already filtered for enabled).
function useWarnings(state, suppressions, customRules) {
  const sup    = suppressions || [];
  const custom = customRules  || [];
  return React.useMemo(() => {
    const hardcoded = (window.WARNING_RULES || [])
      .filter(r => !sup.includes(r.id))
      .filter(r => { try { return r.condition(state); } catch(e) { return false; } });
    const tenant = custom
      .filter(r => r.enabled !== false)
      .filter(r => { try { return evaluateCustomRule(r.conditions, state); } catch(e) { return false; } });
    return [...hardcoded, ...tenant];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state), JSON.stringify(sup), JSON.stringify(custom)]);
}
window.useWarnings = useWarnings;
