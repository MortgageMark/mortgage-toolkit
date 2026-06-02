# LOD — Continuation Prompt for New Claude Session

> Paste this entire prompt at the start of a new Claude Code session to pick up where we left off.
> Last updated: 2026-03-11 (session 12)

---

## WHO I AM

Mark Ningard, Sr. Loan Officer at CMG Home Loans (NMLS 729612, 469-631-3879, mymortgagemark@gmail.com).
Building **LOD (Loan Officer Dashboard)** — a cloud mortgage calculation + workflow platform.

**My preferences:**
- SHORT answers, less explanation
- Read the file before editing (specific sections only — never the whole file)
- I trust your judgment on implementation details

---

## PROJECT LOCATION

```
C:\Users\markn\OneDrive\Desktop\Claude Folder\Mortgage Calculators\
```

**Start the app:**
```bash
cd "C:/Users/markn/OneDrive/Desktop/Claude Folder/Mortgage Calculators" && python -m http.server 8080
```
Then open: `http://localhost:8080/mortgage-toolkit.html`

---

## CURRENT ARCHITECTURE

**Modular** — 34 separate JS files loaded via `<script type="text/babel" src="...">` in `mortgage-toolkit.html`. React 18.2.0 + Babel 7.23.9 via CDN. No build step.

**Cross-module sharing:** Everything via `window.X = X` exports. No globals leak between Babel script blocks.

**Backend:** Supabase (Postgres + Auth), URL: `https://sevilzviytfvviyqwska.supabase.co`

### Load order
```
CDN (React, ReactDOM, Babel, Supabase, SheetJS, jsPDF)
  └─ plain <script>: window._supabaseClient = createClient(...)

modules/constants.js
modules/utils.js
modules/hooks.js
modules/storage.js
modules/propagation.js
modules/ui/primitives.js
modules/ui/charts.js

modules/calculators/ (21 files):
  PaymentCalculator, RefinanceAnalyzer, FeeSheetGenerator, MortgageComparison,
  BreakEvenCalculator, PreQualLetter, ForwardCommitment, AffordabilityCalculator,
  AmortizationSchedule, DTICalculator, RentVsBuyCalculator, SellerNetSheet,
  BiWeeklyCalculator, ClosingCostEstimator, HELOCCalculator, LoanProgramComparison,
  BudgetPlanner, OpenHouseLeadCapture, RateWatchDashboard, FlyerGenerator, AboutTab

modules/screens/ (7 files):
  SettingsPanel, LOSelector, AdminPanel, LoginScreen, ScenarioDashboard,
  MortgageToolkit, App

inline <script type="text/babel">: ReactDOM.createRoot(...).render(<App />)
```

### CRITICAL: Supabase init rule
```html
<!-- Must be plain <script>, NOT Babel — or you get a white screen -->
window._supabaseClient = window.supabase.createClient(URL, KEY);
```

---

## WHAT WAS DONE IN SESSION 12 (most recent)

**File edited:** `modules/calculators/MortgageComparison.js` — complete rewrite

### 1. Vertical per-scenario buydowns
- Removed the single global `BUYDOWN ANALYSIS` SectionCard and the "Apply To" dropdown
- Each of the 3 scenarios now has its **own buydown card** in a matching 3-column grid
- Buydown fields stored inside each scenario object in `mc_sc`:
  `bdType`, `bdPermRate`, `bdPermCost`, `bdPermCostMode`, `bdTempType`
- Global `mc_bd_*` localStorage keys removed entirely
- `perScenarioBD` useMemo computes buydown results for all 3 scenarios

### 2. Buydown cost: % of Loan or $ Amount toggle
- Pill toggle **"% of Loan" | "$ Amount"** appears when Permanent buydown is selected
- Switching modes clears the cost field to avoid confusion
- Math hint shows automatically in small print:
  - `%` mode: `"0.5% × $400,000 = $2,000"`
  - `$` mode: `"$2,000 = 0.500% of $400,000"`

### 3. Closing costs + prepaids pulled from Fee Sheet
- Reads 27 `fs_*` localStorage keys (same ov/def logic as FeeSheetGenerator.js)
- Uses `window.getStateFees(fsState)` for state-specific title insurance per scenario's own loan amount
- **Discount points excluded** — scenarios have their own `points` field
- Per-scenario closing cost components:
  - Origination (scaled to each scenario's LA) + underwriting + processing
  - Fixed third-party fees: appraisal, credit, flood, tax service, doc prep, survey
  - Title: owner's title, lender's title (simultaneous), escrow fee, title search, + $225 fixed (recording + courier + tax cert)
- Per-scenario prepaids:
  - Prepaid interest (each scenario's rate/LA × days from fs_closing_date)
  - 12-mo homeowners insurance + 3-mo tax & insurance reserves (if escrow on)
- `cashNeeded` updated: `down + pts + closingCosts + prepaids − sellerConc`
- New rows in comparison table: **Closing Costs (est.)***, **Prepaids & Reserves (est.)***
- Disclaimer note in table header
- Both new rows included in PDF/Excel exports

---

## KEY FILES AND THEIR CURRENT STATE

| File | Status | Notes |
|------|--------|-------|
| `mortgage-toolkit.html` | ✅ Current entry point | Loads all 34 modules |
| `modules/calculators/PaymentCalculator.js` | ✅ Current | "Other…" loan term + custom years input; syncs with Amortization via `pc_term` |
| `modules/calculators/MortgageComparison.js` | ✅ Session 12 rewrite | Per-scenario buydowns, % or $ cost mode, Fee Sheet closing cost estimates |
| `modules/calculators/FeeSheetGenerator.js` | ✅ Unchanged | Uses `fs_*` keys; totals computed in useMemo (NOT stored in localStorage) |
| `modules/calculators/AmortizationSchedule.js` | ⚠️ Not yet updated | Pending overhaul (bidirectional PC sync, extra payments) — see below |
| `modules/screens/MortgageToolkit.js` | ✅ Current | RateWatch admin-only pending — see below |
| All other modules | ✅ Unchanged from session 11 | |

---

## PENDING ITEMS (not yet done)

### A. MortgageToolkit.js — Rate Watch admin-only (1-line edit)
Add `"ratewatch"` to the `ADMIN_ONLY_MODULE_IDS` array so the Rate Watch tab is hidden from non-admin users. Quick, straightforward.

### B. AmortizationSchedule.js — Overhaul (large rewrite, ~300 lines)
A plan file exists at:
```
C:\Users\markn\.claude\plans\steady-doodling-manatee.md
```
Read that file for the full spec. Key features:
- Bidirectional sync with Payment Calculator (`pc_*` keys)
- Remove the Export section (already handled globally)
- Extra Payments panel: extra monthly principal, bi-weekly toggle, up to 5 one-time lump sums
- Savings comparison: standard vs. extra-payment amortization (months saved, interest saved)
- Prominent view toggle (standard / extra payments)
- Highlight rows with extra payments in the table

---

## IMPORTANT PATTERNS

### useLocalStorage (in hooks.js)
```javascript
const useLocalStorage = window.useLocalStorage;
const [value, setValue] = useLocalStorage("key", defaultValue);
```
No `mtk_` prefix — the hook adds it internally. Same key in two modules = shared state.

### Bidirectional sync (PC ↔ Scenario A in MortgageComparison)
```javascript
// PC → Scenario A
useEffect(() => {
  setScenarios(prev => {
    const a = prev.find(s => s.id === 1);
    if (a.hp === pcHp && ...) return prev; // equality guard prevents loops
    return prev.map(s => s.id === 1 ? { ...s, hp: pcHp, ... } : s);
  });
}, [pcHp, pcRate, pcTerm, pcDp]);

// Scenario A → PC (inside updateScenario)
if (id === 1 && field === "hp") setPcHp(value);
```

### Fee sheet ov/def helpers
```javascript
const ov  = (val, fb)  => { const n = parseFloat(val);  return (val  !== "" && !isNaN(n)) ? n : fb; };
const def = (cust, hd) => { const n = parseFloat(cust); return (cust !== "" && !isNaN(n)) ? n : hd; };
// ov = per-transaction override, def = custom team default, fallback = hardcoded
```

### ThemeContext (DO NOT destructure)
```javascript
const c = useThemeColors();    // ✅ correct
const { border } = useThemeColors(); // ❌ crashes — c will be undefined
```

### Service worker cache fix
DevTools → Application → Service Workers → Unregister → hard refresh (`Ctrl+Shift+R`)

---

## SUPABASE — QUICK REFERENCE

- Valid roles (CHECK constraint): `'admin'`, `'internal'`, `'borrower'`, `'realtor'` — **never `'lo'`**
- `tenant_id` auto-set via `get_my_tenant_id()` SECURITY DEFINER — never pass it from frontend
- Deployed migrations: schema, profiles, tenant-migration, contacts, borrower-claim, leads-migration
- **Pending deploy** (⬜ not yet run in Supabase):
  - `supabase-contact-categories-migration.sql`
  - `supabase-referral-contact-migration.sql`

---

## CALCULATOR KEY PREFIXES

`pc_`, `ra_`, `fs_`, `mc_`, `be_`, `pq_`, `fc_`, `af_`, `am_`, `dti_`, `rvb_`, `sns_`, `biw_`, `cce_`, `hel_`, `lpc_`, `bud_`, `ohlc_`, `rw_`, `fly_`, `brand_`, `abt_`

---

## SESSION START INSTRUCTIONS FOR CLAUDE

1. Read `CLAUDE.md` in the Mortgage Calculators folder for full project context
2. Read the relevant module file(s) before touching anything — specific line ranges, not whole files
3. For the AmortizationSchedule overhaul, read `C:\Users\markn\.claude\plans\steady-doodling-manatee.md` first
4. Ask what to work on if the user doesn't specify
