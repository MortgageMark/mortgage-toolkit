# CLAUDE.md — LOD Project Memory

> Auto-maintained project context file. Update at the end of each session or after significant changes.
> Last updated: 2026-04-19 (session 19)

---

## QUICK REFERENCE

- **Primary file:** `mortgage-toolkit.html` — **now the modular entry point** (36 separate module files)
- **Monolith backup:** `mortgage-toolkit-MONOLITH.html` (~7,800 lines, single file)
- **Tech:** React 18.2.0 + Babel 7.23.9 via CDN, no build step, no bundler
- **Backend:** Supabase (Postgres + Auth) — LIVE
- **Supabase URL:** `https://sevilzviytfvviyqwska.supabase.co`
- **User:** Mark Pfeiffer, Sr. Loan Officer, CMG Home Loans (NMLS 729612)
- **Preferences:** SHORT answers, one change per message, always read before editing

---

## MODULAR ARCHITECTURE (current as of 2026-03-08)

The app has been refactored from a single ~7,800-line HTML file into 34 separate module files loaded via `<script type="text/babel" src="...">` tags.

### Load Order (in `mortgage-toolkit.html`)
```
CDN libs (React, ReactDOM, Babel, Supabase, SheetJS, jsPDF)
  └─ plain <script>: window._supabaseClient = createClient(...)
  └─ plain <script>: service worker registration

modules/constants.js
modules/utils.js
modules/hooks.js
modules/storage.js
modules/propagation.js
modules/ui/primitives.js
modules/ui/charts.js

modules/calculators/ (22 files):
  PaymentCalculator, RefinanceAnalyzer, FeeSheetGenerator, MortgageComparison,
  BreakEvenCalculator, PreQualLetter, ForwardCommitment, AffordabilityCalculator,
  AmortizationSchedule, DTICalculator, RentVsBuyCalculator, SellerNetSheet,
  BiWeeklyCalculator (loaded but not in MODULES — content folded into AmortizationSchedule),
  ClosingCostEstimator, HELOCCalculator, LoanProgramComparison,
  BudgetPlanner, OpenHouseLeadCapture, RateWatchDashboard, FlyerGenerator,
  WealthBuilder, AboutTab

modules/sync/ (1 file):
  ScenarioSync  ← NEW session 14; must load BEFORE MortgageToolkit

modules/screens/ (7 files):
  SettingsPanel, LOSelector, AdminPanel, LoginScreen, ScenarioDashboard,
  MortgageToolkit, App

inline <script type="text/babel">: ReactDOM.createRoot(...).render(<App />)
```

### Cross-Module Communication Rule
Every Babel `<script>` runs in its own scope. All inter-module sharing is via **explicit `window.X = X` exports**. Never assume a variable leaks between script blocks.

### CRITICAL: Supabase Init
```html
<!-- Plain <script> (NOT Babel) -->
window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```
Then in any Babel module:
```javascript
const supabase = window._supabaseClient;
```
**Never move `createClient` into a Babel block — causes white screen.**

### Module File Reference

| File | Exports to window |
|------|-------------------|
| `constants.js` | MTK_PREFIX, CALC_KEY_PREFIXES, CALC_SECTION_NAMES, PMI_FICO_BUCKETS, PMI_RATES, PMI_ENACT, PMI_ESSENT, COLORS_DARK, COLORS, font, MODULE_DEFS, CONFORMING_LIMITS, FHA_LIMITS, LEAD_STATUSES, LOAN_PURPOSES, STATE_APPR_RATES |
| `utils.js` | generateId, pmt, buildAmortization, fmt, fmt2, fmtCredit, formatCurrency, formatNum, calcMonthlyPayment, calcTotalInterest, isWeekend, isHoliday, calcTrueBreakEven, getStateFees, getCountiesForCity, formatDate, formatTime, STATE_TITLE_DATA, STATE_LIST, TX_METRO_COUNTIES, TX_CITIES, exportToExcel, exportToPDF |
| `hooks.js` | useLocalStorage, ThemeContext, useThemeColors |
| `storage.js` | fetchScenariosFromSupabase, saveScenarioToSupabase, deleteScenarioFromSupabase, snapshotCalculatorData, restoreCalculatorData, diffCalculatorData, savePQSnapshot, fetchPQSnapshots, sharePQLetter, fetchPQShares, writeAuditLog, fetchAuditLog, fetchContactsFromSupabase, saveContactToSupabase, archiveContactInSupabase, addContactNoteToSupabase, fetchContactNotesFromSupabase |
| `propagation.js` | propagateLOToPreQual, propagateSharedValues |
| `ui/primitives.js` | Button, Toggle, Select, MetricCard, SectionCard, Labeled, DonutChart *(or similar)* |
| `ui/charts.js` | PIStack, Gauge, Balance *(or similar)* |
| `calculators/*.js` | One default component each, e.g. `window.PaymentCalculator = PaymentCalculator` |
| `sync/ScenarioSync.js` | `useSyncSession`, `LiveSessionBar` |
| `screens/App.js` | App (root component, not exported — rendered inline) |

### ThemeContext Pattern
```javascript
// hooks.js exports:
window.ThemeContext = ThemeContext;      // React.createContext()
window.useThemeColors = useThemeColors; // returns ctx.colors directly

// Usage in any component:
const c = useThemeColors();  // c.border, c.navy, c.bg, etc.
// DO NOT destructure: const { border } = useThemeColors()  ← breaks
```

### App Routing (App.js)
- `loggedInUser === null` → `<LoginScreen />`
- `activeScenario === null` → `<ScenarioDashboard />`
- `activeScenario` is object → `<MortgageToolkit key={activeScenario.id} />` (key forces re-mount)

---

## WHAT'S WORKING

- **Supabase Auth:** Sign In / Sign Up / Guest tabs, session restoration, auth state listener
- **Cloud Scenarios:** Full CRUD (create, duplicate, delete) persists to Supabase for authenticated users
- **Scenario Enter/Exit:** Calculator data snapshots save to Supabase when exiting via "← Scenarios"
- **Hybrid Storage:** Cloud users → Supabase; guest/local users → localStorage
- **Login System:** Team roster (Mark = Admin, PJ = LOA), password hashing (SHA-256), LO-of-record selector
- **All 21 Calculator Modules:** 20 previously verified; AboutTab added 2026-03-09 (not yet browser-verified)
- **Modular Architecture:** All bugs fixed (Bugs 1–11), all window exports in place
- **Immutable PQ Letter Snapshots:** `pq_letters` Supabase table + `savePQSnapshot`/`fetchPQSnapshots` (hybrid cloud/guest); PreQualLetter.js fully rewritten with `buildLetterId()`, `displaySnap` state, parameterized `letterContent(d)`, collapsible history, Re-export PDF
- **Share-with-Realtor Workflow:** `pq_letter_shares` table (immutable, insert-only, RLS) + `sharePQLetter`/`fetchPQShares` (hybrid cloud/guest in storage.js) + Share button per history row, `shareModalEl()` inline modal (mailto: + log), `sendLogSection()` collapsible send log in PreQualLetter.js
- **Leads System (session 9):** 30 lead statuses + 5 loan purposes in constants.js; 6 new columns on scenarios table (supabase-leads-migration.sql deployed); ScenarioDashboard.js fully rewritten with 3 grouped tabs (Active/Waiting/Archived), `LeadStatusSelect` grouped dropdown, per-card lead status changer, pipeline metrics strip (Pre-Pipeline / Active Pipeline / Waiting / **Closing This Month** counts — internal only); ContactDetail.js shows linked scenario cards with lead status + loan purpose badges + property address + "Open →" button that fetches full scenario and opens it in the calculators
- **Open Scenario from Contacts:** ContactDetail "Open →" button fetches full scenario row (with calculation_data), calls combined App.js callback that sets showContacts(false) + handleSelectScenario — wired through App.js → ContactsTab → ContactDetail
- **Edit Lead Details (session 9 phase 3):** ✏️ button on every scenario card (internal cloud only) expands an inline panel to edit `loan_purpose`, `property_address`, `lead_source`, `target_close_date`, `actual_close_date` — saves to Supabase via `saveScenarioToSupabase` + writes audit log
- **Scenario Count Badges on Contacts (session 9 phase 3):** ContactsTab fetches scenario counts per contact after load; displays "N scenarios" badge on each ContactCard
- **mapFromCloud expanded:** `lead_source`, `target_close_date`, `actual_close_date` now mapped from Supabase rows into local scenario shape

## WHAT'S NOT DONE YET (Phase 1 Remaining)

1. ~~Role enforcement / RLS policies beyond basic ownership~~ ✅ Done — localStorage isolation fixed (ScenarioDashboard.js); profiles RLS + get_my_role() SECURITY DEFINER function deployed to Supabase (2026-03-09)
2. ~~Authorization toggles (pre-approval guardrails)~~ ✅ Done (borrower_permissions column in profiles, App.js, MortgageToolkit.js, AdminPanel.js, 2026-03-09)
3. ~~Immutable letter snapshots with Letter ID~~ ✅ Done (pq_letters table, savePQSnapshot/fetchPQSnapshots, PreQualLetter.js rewrite, 2026-03-09)
4. ~~Share-with-Realtor email workflow + logs~~ ✅ Done (pq_letter_shares table, sharePQLetter/fetchPQShares in storage.js, Share button + modal + Send Log in PreQualLetter.js, 2026-03-09)
5. ~~Auto-save on timer~~ ✅ Done (60s setInterval in MortgageToolkit.js, 2026-03-09)
6. ~~Scenario status workflow~~ ✅ Done (STATUS_TABS/filter/changeStatus all wired in ScenarioDashboard.js)
7. ~~Link Scenarios to Contacts~~ ✅ Done — `storage.js` (`saveScenarioToSupabase` now accepts `contact_id`); `ContactDetail.js` (Linked Scenarios section card with live Supabase query); `ScenarioDashboard.js` (contact picker on New Scenario form for internal cloud users, session 6)
8. ~~Borrower accounts / scenario claiming~~ ✅ Done — email-match auto-discovery: `fetchClaimableScenariosForBorrower` + `claimScenarioInSupabase` in storage.js; "Scenarios prepared for you" banner in ScenarioDashboard.js (borrower role only); supabase-borrower-claim.sql deployed (2 new RLS policies: SELECT + UPDATE on scenarios)
9. ~~Lead pipeline system~~ ✅ Done (session 9) — LEAD_STATUSES + LOAN_PURPOSES in constants.js; supabase-leads-migration.sql deployed; ScenarioDashboard.js rewritten with grouped tabs, lead status changer, pipeline metrics strip; ContactDetail.js updated with lead badges + "Open →" button

---

## SUPABASE SCHEMA

### Multi-Tenancy Foundation (supabase-tenant-migration.sql — session 5)
- **CRITICAL**: Every table has a `tenant_id` column. This is non-negotiable even in single-tenant MVP.
- `tenant_id` defaults via `public.get_my_tenant_id()` SECURITY DEFINER — frontend never passes it explicitly.
- Mark's tenant: `slug = 'ningard-cmg'` (seeded in migration; UUID stored in `tenants` table).
- Tables with `tenant_id` added: `scenarios`, `profiles`, `pq_letters`, `pq_letter_shares`, `scenario_audit_log`.
- **'lo' role bug FIXED**: Deployed policies used `get_my_role() IN ('admin', 'lo')` but `'lo'` is NOT in the CHECK constraint. Migration drops all old policies and recreates them with `('admin', 'internal')`. Never use `'lo'` in any policy.
- Valid roles: `'admin'`, `'internal'`, `'borrower'`, `'realtor'` — nothing else.

### tenants table (supabase-tenant-migration.sql)
```sql
id (uuid, PK), name (text), slug (text UNIQUE), plan_tier (text default 'solo'),
branding_config (jsonb default '{}'), created_at (timestamptz)
```

### get_my_tenant_id() SECURITY DEFINER
```sql
-- Mirrors get_my_role() pattern exactly. Bypasses RLS with SET LOCAL row_security = off.
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$;
```

### get_my_role() SECURITY DEFINER
```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$;
```

### profiles table
```sql
id (uuid, PK, FK → auth.users), tenant_id (uuid, FK → tenants),
email (text), display_name (text), role (text, default 'borrower'),
created_at (timestamptz), borrower_permissions (jsonb, default '{}')
```
- Valid roles (CHECK constraint): `'admin'`, `'internal'`, `'borrower'`, `'realtor'`, `'builder'` ← builder added session 19
- Auto-created via trigger on `auth.users` insert
- Schema file: `supabase-profiles.sql` + `supabase-tenant-migration.sql`
- RLS: 5 policies — see below (all corrected to use `'internal'` not `'lo'`)

#### profiles RLS — all policies (corrected in supabase-tenant-migration.sql)
```sql
-- "Admins can read all profiles"
USING (get_my_role() IN ('admin', 'internal'));

-- "Admins can update borrower permissions"
USING + WITH CHECK (get_my_role() IN ('admin', 'internal'));

-- "Users can insert their own profile"
WITH CHECK (id = auth.uid());  -- no tenant_id check: profile doesn't exist yet at INSERT

-- "Users can read own profile"
USING (id = auth.uid());

-- "Users can update their own profile"
USING + WITH CHECK (id = auth.uid());
```

### scenarios table
```sql
id (uuid, PK), user_id (uuid, FK → auth.users), tenant_id (uuid, FK → tenants),
contact_id (uuid, FK → contacts, nullable),  -- ← added in supabase-contacts.sql
scenario_id (text, unique per user), name (text), notes (text),
status (text, default 'active'), calculation_data (jsonb),
lead_status (text, default '?'),             -- ← added in supabase-leads-migration.sql
loan_purpose (text, default 'purchase'),     -- ← added in supabase-leads-migration.sql
property_address (text, nullable),           -- ← added in supabase-leads-migration.sql
lead_source (text, nullable),                -- ← added in supabase-leads-migration.sql
target_close_date (date, nullable),          -- ← added in supabase-leads-migration.sql
actual_close_date (date, nullable),          -- ← added in supabase-leads-migration.sql
created_at (timestamptz), updated_at (timestamptz)
```
- RLS enabled; `tenant_id` defaults automatically via `get_my_tenant_id()`. **`contact_id` does NOT default** — it is a nullable FK with no DEFAULT expression and must be explicitly passed by the frontend. `saveScenarioToSupabase()` accepts `contact_id` (session 6) and all 6 lead fields (session 9).
- Index: `scenarios_lead_status_idx ON public.scenarios (lead_status)` — added in supabase-leads-migration.sql

### contacts table (supabase-contacts.sql — session 5, updated session 11)
```sql
id (uuid, PK), tenant_id (uuid, NOT NULL, DEFAULT get_my_tenant_id()),
created_by_user_id (uuid, DEFAULT auth.uid(), FK → profiles),
first_name (text), last_name (text), email (text), phone (text),
address (text), city (text), state (text), zip (text),
contact_type (text: 'business'|'client', default 'client'),  -- ← changed in session 11
contact_category (text, nullable),                           -- ← added in session 11
referred_by_contact_id (uuid, nullable, FK → contacts self-ref), -- ← added in session 11
status (text: 'active'|'archived'|'converted', default 'active'),
tags (text[], default '{}'), source (text), notes (text),
created_at (timestamptz), updated_at (timestamptz)
```
Business categories: Employee, Financial Partner, Home Builder, Loan: Third Party, Loan Officer, Marketing, Other, Personal, Realtor, Recruit, Work Relationship, zz-Junk
Client categories: Client, CCR, PC, PCR, Client (Import)
- RLS: 5 policies — internal CRUD + borrower/realtor read-own-record (email match) + admin-only delete
- `updated_at` trigger: `contacts_set_updated_at`
- No unique constraint on email (duplicates are expected in mortgage CRM)
- Borrower self-access uses `lower(email) = lower(auth.jwt() ->> 'email')` for case-insensitive match

### contact_notes table (supabase-contacts.sql — session 5, append-only)
```sql
id (uuid, PK), tenant_id (uuid, NOT NULL, DEFAULT get_my_tenant_id()),
contact_id (uuid, NOT NULL, FK → contacts CASCADE),
user_id (uuid, DEFAULT auth.uid(), FK → profiles),
body (text), created_at (timestamptz)
-- NO updated_at — append-only, no edits ever
```
- RLS: 2 policies only (SELECT + INSERT for internal team). No UPDATE/DELETE policies = immutability enforced.

### intake_links table (supabase-contacts.sql — session 5, Phase 2 placeholder)
```sql
id (uuid, PK), tenant_id (uuid, NOT NULL, DEFAULT get_my_tenant_id()),
contact_id (uuid, NOT NULL, FK → contacts CASCADE),
created_by_user_id (uuid, DEFAULT auth.uid(), FK → profiles),
token (text, UNIQUE, DEFAULT encode(gen_random_bytes(32), 'hex')),
seed_payload (jsonb, default '{}'), expires_at (timestamptz),
used_at (timestamptz), created_at (timestamptz)
```
- RLS: 3 policies (SELECT + INSERT + UPDATE for internal). No DELETE policy (audit trail).
- Token verification will use Edge Function + service-role key in Phase 2. No anon grants.

### scenario_audit_log table
```sql
id (uuid, PK), scenario_id (uuid), user_id (uuid),
action (text), changes (jsonb), note (text), created_at (timestamptz)
```
- Used by `writeAuditLog()` / `fetchAuditLog()` in storage.js

### pq_letters table (immutable — insert-only)
```sql
id (uuid, PK), user_id (uuid, FK → auth.users), tenant_id (uuid),
scenario_id (text), letter_id (text), created_at (timestamptz), snapshot (jsonb)
```
- INSERT + SELECT RLS only — no UPDATE/DELETE policies (enforces immutability)
- Hybrid storage: cloud users → this table; guests → localStorage `pq_snapshots_[scenarioId]`

### pq_letter_shares table (immutable — insert-only)
```sql
id (uuid, PK), user_id (uuid, FK → auth.users), tenant_id (uuid),
letter_id (text), scenario_id (text), sent_at (timestamptz default now()),
realtor_name (text), realtor_email (text), note (text default '')
```
- INSERT + SELECT RLS only — no UPDATE/DELETE policies (immutable share log)
- Hybrid storage: cloud users → this table; guests → localStorage `pq_shares_[scenarioId]`

### Migration / Schema Files
| File | Purpose | Status |
|------|---------|--------|
| `supabase-schema.sql` | Original scenarios + pq tables DDL | ✅ Deployed |
| `supabase-profiles.sql` | profiles table + get_my_role() DDL | ✅ Deployed |
| `supabase-tenant-migration.sql` | tenants table, tenant_id on all tables, get_my_tenant_id(), fix 'lo' bug in policies | ✅ Deployed |
| `supabase-contacts.sql` | contacts, contact_notes, intake_links, contact_id on scenarios, 9 indexes, RLS | ✅ Deployed |
| `supabase-borrower-claim.sql` | 2 RLS policies on scenarios: borrower SELECT + UPDATE by email match | ✅ Deployed |
| `supabase-leads-migration.sql` | 6 new columns on scenarios (lead_status, loan_purpose, property_address, lead_source, target_close_date, actual_close_date) + lead_status index | ✅ Deployed (session 9) |
| `supabase-contact-categories-migration.sql` | Drop old contact_type CHECK, add contact_category column, migrate existing rows, new CHECK ('business'\|'client') | ✅ Deployed (session 13) |
| `supabase-referral-contact-migration.sql` | Add referred_by_contact_id (uuid, self-ref FK → contacts, nullable) + index | ✅ Deployed (session 13) |
| `supabase-templates-migration.sql` | scenario_templates table (name, description, is_global, loan_purpose, calculation_data) + RLS + default_template_id on profiles | ✅ Deployed (session 13) |

---

## KNOWN FIXED BUGS (do not reintroduce)

### 1. White Screen on Load (Supabase scoping)
**Fix:** Init Supabase in plain `<script>` as `window._supabaseClient`. Never in Babel block.

### 2. Scenario Selection Race Condition
**Fix:** Synchronous `localStorage.setItem` BEFORE `setActiveScenario` in `handleSelectScenario`.

### 3. Purchase Price Not Flowing to Other Tabs
**Fix:** Added propagation targets in `propagateSharedValues()` + dispatch `mtk_propagated`.

### 4. Service Worker Cache
Cache name `mtk-v1` may serve stale HTML. If edits don't appear: DevTools → Application → Service Workers → Unregister, then hard refresh.

### 5. storage.js — wrong key name (Bug 1)
**Fix:** `const CALC_KEY_PREFIXES = window.CALC_KEY_PREFIXES;` (was `window.CALCULATOR_KEYS`).

### 6. hooks.js — ThemeContext + useThemeColors not exported (Bugs 3+4)
**Fix:** Added `window.ThemeContext = ThemeContext` and `window.useThemeColors = useThemeColors`.

### 7. SettingsPanel.js — useThemeColors destructuring crash (Bug 6)
**Fix:** `const c = useThemeColors();` — no destructuring.

### 8. utils.js — STATE_TITLE_DATA, STATE_LIST, TX_METRO_COUNTIES, TX_CITIES, exportToExcel, exportToPDF missing (Bugs 2, 7, 8)
**Fix:** All data and functions inserted into utils.js; all exported to window.

### 9. constants.js — CONFORMING_LIMITS and FHA_LIMITS missing (Bug 7)
**Fix:** Both constants added and exported to window.

### 10. FeeSheetGenerator.js — `st.simultaneous is not a function` (Bug 10)
`STATE_TITLE_DATA` entries have `basicRate` (function) and `simultaneousRate` (number), but the code called `st.simultaneous(la, pp)` which doesn't exist.
**Fix:** Replaced with inline formula:
```javascript
const lenderTitlePolicy = isPurchase
  ? (la <= 0 ? 0 : Math.round(st.basicRate(la) * (st.simultaneousRate || 0.35)))
  : st.basicRate(la);
```

### 13. Builder Concession cross-scenario bleed (session 20)
`bld_conc_val` and `bld_conc_mode` were stored under shared keys (`mtk_bld_conc_val`, `mtk_bld_conc_mode`). Any scenario that wrote these keys would overwrite the value for ALL other scenarios. Multiple attempts using `restoreCalculatorData` + `localStorage.setItem` overrides failed because `useLocalStorage`'s `useState` lazy initializer reads from the shared key at mount time — after any write from the previous scenario's exit.
**Fix:** Store these values under **scenario-specific keys**: `bld_conc_val_{scenarioId}` and `bld_conc_mode_{scenarioId}`. In `BuilderTab.js`, read `mtk_active_scenario` to get the scenario ID at mount, then pass the per-scenario key to `useLocalStorage`. Different scenarios use physically different keys — bleed is architecturally impossible.
**Pattern:** Any per-scenario field that must NOT bleed across scenarios should use `{prefix}_{scenarioId}` keys, not shared `{prefix}` keys.

### 12. Cross-user data leakage via localStorage cache (session 4)
`useLocalStorage("scenarios", [])` uses a shared key across all users. When admin (Mark) populated it, then a borrower (Soozie) logged in and the cloud fetch failed, Soozie saw Mark's cached scenarios.
**Fix:** Added `setScenarios([])` before `setCloudLoading(true)` in the mount `useEffect` in `ScenarioDashboard.js`. Cache is wiped the moment a cloud fetch begins, so failed fetches show empty state instead of another user's data.

### 11. useThemeColors() destructuring crash in 7 calculator files (Bug 11)
`useThemeColors()` returns `ctx.colors` directly (the colors object itself). Seven files had:
```javascript
const { colors: c } = useThemeColors();  // ❌ c = undefined → crash
```
**Fix applied to all 7 files:**
```javascript
const c = useThemeColors();  // ✅
```
**Affected files:** `RateWatchDashboard.js`, `BudgetPlanner.js`, `ClosingCostEstimator.js`, `HELOCCalculator.js`, `FlyerGenerator.js`, `OpenHouseLeadCapture.js`, `LoanProgramComparison.js`

---

## CALCULATOR KEY PREFIXES (23 total)
`pc_`, `ra_`, `fs_`, `mc_`, `be_`, `pq_`, `fc_`, `af_`, `am_`, `dti_`, `rvb_`, `sns_`, `biw_`, `cce_`, `hel_`, `lpc_`, `bud_`, `ohlc_`, `rw_`, `fly_`, `brand_`, `abt_`, `wb_`

---

## TWO-EVENT PROPAGATION SYSTEM

1. Payment Calculator dispatches `mtk_values_changed`
2. `propagateSharedValues()` distributes values across tabs' localStorage keys
3. Dispatches `mtk_propagated` at the end
4. All `useLocalStorage` hooks re-read their values

---

## DATA RULES

**Allowed:** Name, email, phone, address (refi), all scenario numbers (property value, loan amount, rate, term, taxes, insurance, HOA, PMI, fees, credits), credit score range, income/debt numbers, state/county.

**Prohibited:** SSN, DOB, bank accounts, account numbers, documents/uploads.

---

## ROLES AND PERMISSIONS

| Role | Access |
|------|--------|
| **Admin** (Mark, PJ) | Full access, manage users, modify defaults/fees/presets, permanent delete, pre-approval toggles, analytics |
| **Internal Loan Partner** | Broad scenario access, fee overrides, view all scenarios. No system defaults, structural config, or permanent delete |
| **Borrower** | Create/claim scenarios, soft-delete own, generate letters when authorized, share letters via system email |
| **Realtor** | Run standalone scenarios only. No borrower data, letters, or financials. May receive PDF if borrower shares |

---

## VERSION HISTORY

| Version | Lines | Key Changes |
|---------|-------|-------------|
| v1 | 4,182 | Core payment calc, PMI, Fee Sheet, Pre-Qual Letter, DTI, Cover page, Dark mode |
| v2 | 5,718 | 50-state title insurance, RESPA escrow, fee overrides, closing date picker, seller contributions, TX homestead, loan limits |
| v3 (backup) | 5,729 | Fee Sheet overhauls, Fee Defaults Settings Panel |
| Post-v3 Rev 1-2 | 5,856 | Pre-Qual Letter PDF redesign |
| Post-v3 Rev 3 | 6,955 | Login & Persona System |
| Post-Rev 3 | 7,513 | Scenario Dashboard, purchase price fix, race condition fix |
| Supabase Integration | ~7,800 | Auth, cloud scenarios, CRUD, enter/exit flow |
| **Modular Refactor** | **34 files** | **Extracted monolith into modules/; Bugs 1–11 fixed; all 20 tabs verified 20/20 in browser; mortgage-toolkit.html is now the modular entry point** |
| **Share-with-Realtor** | — | pq_letter_shares table + sharePQLetter/fetchPQShares + Share modal + Send Log in PreQualLetter.js |
| **Session 9 — Leads System** | — | LEAD_STATUSES (30) + LOAN_PURPOSES (5) in constants.js; supabase-leads-migration.sql (6 new scenario columns); ScenarioDashboard.js full rewrite (grouped tabs, LeadStatusSelect, pipeline metrics strip); ContactDetail.js lead badges + "Open →" button; App.js + ContactsTab.js wired for scenario open from Contacts |
| **Session 9 Phase 3** | — | mapFromCloud + lead_source/target_close_date/actual_close_date; "Closing This Month" 4th metrics chip; ✏️ Edit Lead Details inline panel per scenario card; ContactsTab scenario count badges per contact card; backup mortgage-toolkit-2026-03-09.html |
| **Session 10** | — | ScenarioDashboard: lead_source + close dates surfaced on cards; New Scenario form gets lead_source field; "Closing This Month" chip is now clickable (toggles closingFilter, overrides group tab); formatDateOnly helper (UTC-safe); ContactDetail: SELECT expanded + lead_source/close dates shown on linked scenario cards |
| **Session 11** | — | Contact type/category restructure (Business/Client + subcategories); Referred By contact picker (replaces Source text field) — ReferralPickerCT (dark theme, ContactsTab) + ReferralPickerCD (light theme, ContactDetail); read view shows referred-by name with "Open →" button; self-referential FK referred_by_contact_id on contacts; 2 new migration files (⬜ not yet deployed) |
| **Session 12** | — | Phase 1: BalanceCurveChart + PIStackedBarChart moved from AmortizationSchedule → PaymentCalculator (below DonutChart). BiWeeklyCalculator content folded into AmortizationSchedule (bi-weekly comparison + extra payments); BiWeekly tab removed from MODULES. Phase 2: RentVsBuyCalculator — STATE_APPR_RATES state selector + rvb_state key, skip-on-mount appr auto-populate, wealthTimeline useMemo, RvbWealthChart SVG, owner vs renter net worth milestones (yr5/10/20). Phase 3: PaymentCalculator — pc_appr appreciation input + state selector, equityTimeline useMemo, equityMilestones, inline SVG equity projection overlay on loan visualizations. Phase 4: NEW WealthBuilder.js — wb_ prefix keys, WbEquityChart + WbNetWorthChart SVG components, equityTimeline/netWorthTimeline/taxBenefits/breakEvenYear useMemos, export PDF, wired into mortgage-toolkit.html + MortgageToolkit.js (admin-only tab 🏦); STATE_APPR_RATES added to constants.js + exported to window. |
| **Session 13** | — | Contact type/category restructure (Business/Client + subcategories). Referred By contact picker. 2 migration files: supabase-contact-categories-migration.sql + supabase-referral-contact-migration.sql + supabase-templates-migration.sql (scenario_templates table). |
| **Session 15** | — | **MortgageComparison.js** — Full overhaul: (1) Program details panels (VA first use/subsequent/disability exemption, FHA UFMIP + monthly MIP, USDA upfront + annual); (2) Comparison table restructured into 4 navy-header sections (Loan Structure / Monthly Payment / Costs & Credits / Cash to Close Summary); (3) Scenario card `CardSection` full-bleed navy section headers ("Loan Details", "Rate & Term", "Costs & Credits"); (4) Fixed-height alignment slots (`minHeight`) for sync note (22px), program panel (148px), APR note (20px); (5) Loan Program + program panel moved above "Loan Details" section; (6) Seller concessions (`sellerConc`) bidirectionally synced with Fee Sheet `fs_sc` key (Scenario A only); (7) VA fields (`vaExempt`, `vaFirstUse`) bidirectionally synced with Payment Calculator `pc_va_exempt` / `pc_va_first` (Scenario A only); (8) Buydown removed from Scenario A entirely — `perScenarioBD` returns `{type:"none"}` for id===1, one-time cleanup wipes stale localStorage; (9) Buydown grid uses `repeat(analyses.length, 1fr)` — Scenario A gets dashed baseline placeholder, B/C get actual buydown cards; (10) Max seller concessions hint below each scenario's field (program-specific limits, dollar + %, red warning if exceeded); (11) Rate/APR row shows only rate (no pts/APR text); permanent buydown shows `↓ from X% · saves $Y/mo`; (12) Discount Points row shows percentage in parens. **mortgage-toolkit.html** — Mobile tab bar fix: `.mtk-tab-bar` changed from `flex-wrap: wrap` to `flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none` + webkit scrollbar hidden. **MortgageToolkit.js** — Tab bar: `flexShrink: 0` on all tab buttons; `tabBarRef` + `useEffect` scrolls active tab into view on tab change via `data-tab-active` attribute. |
| **Session 14** | — | **FeeSheetGenerator**: hardcoded fallback values updated; VA zero-fee logic (no UW/processing on VA); IRRRL credit report capped at $60; Unimproved Escrows removed from UI dropdown; New Construction auto-populates valuation at 70% of purchase price. **Real-time Sync**: NEW `modules/sync/ScenarioSync.js` — `useSyncSession` hook (Supabase Realtime Broadcast + Presence, localStorage interceptor, debounced 300ms batch broadcast, full-state sync on join, applyingRef echo prevention) + `LiveSessionBar` component (connection dots, peer status, Exploring/Agreed mode toggle, Invite Client, Share Link). **MortgageToolkit.js**: wired sync session, renders LiveSessionBar below tab bar, read-only overlay when mode=agreed and !isLO (except prequal tab). **ScenarioDashboard.js**: borrower subscribes to `invite_scenario_{id}` channels for each scenario; receives `live_invite` broadcast; shows pulsing green banner with "Join Live Session →" button. **NotifyClientButton.js**: added 📡 Live Session button + `handleSendLive` that emails `?live=SCENARIO_ID` URL via existing Edge Function; green confirmation modal with copy button. **RecastCalculator.js**: full rewrite — rate/amount/term pulled read-only from Payment Calculator; origination + recast date pickers (month/year) replace remaining-term inputs; balance auto-calculated from amortization schedule (`balanceAfterPayments` helper) with user-override; recast fee removed from inputs (moved to notes); new "Recast vs. Keeping Your Current Payment" section showing interest cost comparison + months paid off sooner. |
| **Session 17** | — | **Display Email on PQ letter**: `email_display` field added to AdminPanel.js edit form + Supabase UPDATE; LoginScreen.js team sync + App.js restoreSession fetch and store `email_display`; propagation.js uses `member.email_display \|\| member.email`. **Phone formatting**: `fmtPhoneDashes()` in propagation.js formats phone/cell/fax as `XXX-XXX-XXXX` on propagate and on blur in PreQualLetter.js. **PDF download**: html2canvas CDN added to mortgage-toolkit.html; `downloadPDF()` in PreQualLetter.js (windowWidth:760, scale:2, proportional single-page fit). **PQ letter font sizes**: body 13px, title 20px, LO name 15px. **Print CSS**: `zoom:0.93` on `.mtk-prequal-letter`. **On-demand save system**: `mtk_save_scenario` window event dispatched by PreQualLetter (2s debounce on pq_la/pq_mr/loanType/loanTerm/purchasePrice changes + on Generate); MortgageToolkit.js listener snapshots localStorage and calls Supabase UPDATE. `lo_selected` added to `snapshotCalculatorData` + `restoreCalculatorData` in storage.js. **App.js restoreSession**: full team roster sync from Supabase on every page load for internal users. **LOSelector.js**: roster added to propagation useEffect deps. |
| **Session 20** | — | **Builder Concession isolation fix**: `bld_conc_val`/`bld_conc_mode` now stored under scenario-specific keys (`bld_conc_val_{scenarioId}`) in BuilderTab.js — eliminates cross-scenario bleed permanently. **Global Interest Rates tab**: LO-only tab, rates saved to Supabase `global_rate_config` table via explicit Save button; BuilderTab fetches on mount via `fetchGlobalRateConfig`. **Realtor/Builder Contacts**: `onContacts` prop in App.js and guards in ContactsTab.js extended to include realtor/builder roles. **Race condition fix in handleBackToScenarios**: `setActiveScenario(null)` moved inside `.then()`/`.catch()` of cloud save promise; `calculationData: afterSnap` passed explicitly. **Green highlight**: Builder tab "in the money" green changed to `#C6F0D4` (light) / `#1A3D28` (dark). Cache: mtk-v22. |
| **Session 19** | — | **Realtor/Builder profiles + Scenario Sharing**: (1) LoginScreen.js — "I AM A" dropdown on signup (Client/Realtor/Builder/LO → maps to borrower/realtor/builder/internal); (2) MortgageToolkit.js — builder role sees Builder tab only from INTERNAL_MODULE_IDS; realtor/builder role filters applied; (3) supabase-builder-role-migration.sql — adds 'builder' to profiles_role_check constraint (with UPDATE cleanup for stale 'lo' rows); (4) **scenario_shares table** (`supabase-scenario-shares-migration.sql`) — share_type ('share'|'referral'), shared_with_user_id nullable (NULL = team referral), RLS: internal can share, partners can referral, recipients can view; new RLS policies on scenarios for shared access; (5) **storage.js** — 5 new functions: `shareScenarioWithPartner`, `referScenarioToLO`, `fetchScenarioShares`, `fetchSharedScenariosFromSupabase`, `fetchPartnerProfiles`; (6) **ScenarioDashboard.js** — LO sees "⭐ Referred" badge + "🔗 N shared" badge on scenario names; LO gets 🔗 action button → Share with Partner modal (picker + permission + note); Partner gets "My Pipeline" / "Shared With Me" tab switcher; Partner gets "⭐ Refer / ⭐ Referred" button per scenario; Refer modal with optional note. **Valid Supabase roles now**: admin, internal, borrower, realtor, builder. |
| **Session 18** | — | **Supabase RLS cleanup**: Removed 5 redundant/weaker scenario policies (scenarios table now has clean 10-policy set: 2 DELETE, 1 INSERT, 4 SELECT, 3 UPDATE). **PreQualLetter.js**: fixed duplicate `purchasePrice` key in `liveData` object. **MortgageToolkit.js**: on-demand save handler now logs Supabase errors instead of silently swallowing them. **LOSelector.js**: dispatches `mtk_save_scenario` on LO dropdown change so lo_selected saves immediately. |
| **Session 21** | — | **PaymentCalculator.js**: `noRate` flag added to calc useMemo — when rate is blank/zero, payment display shows `--` + "Enter an interest rate" pill instead of a misleadingly low number. **BuilderTab.js**: % concession input capped at 25 max — keystrokes above 25 are silently blocked; dollar mode uncapped. **FeeSheetGenerator.js**: `canEditFees` variable added (`isInternal \|\| borrower/realtor/builder role`) — all three partner roles now get editable blue-highlight fee row inputs, same as LO/Admin. **NEW BuyDownsTab.js**: read-only temporary buydown comparison tab (5 programs: 3/2/1, 2/1, 1/1/1, 1/1, 1/0); reads `pc_rate`/`pc_la`/`pc_term`/`pc_hp` + PITI components from Payment Calculator; shows rate, P&I, PITI, monthly savings, annual savings per year, and builder cost per program; empty state if no rate/LA entered; visible to builder role + internal/admin. Wired into `mortgage-toolkit.html` + `MortgageToolkit.js` (`INTERNAL_MODULE_IDS` + builder exception updated). |

### Backup Files
- `mortgage-toolkit-MONOLITH.html` — last monolith build (~7,800 lines)
- `mortgage-toolkit-v1-2026-02-27.html`
- `mortgage-toolkit-v2-2026-02-27.html`
- `mortgage-toolkit-v3-2026-02-27.html`
- `mortgage-toolkit-2026-03-09.html` — pre-session-9-phase-3 snapshot

**Backup rule:** Every 5 Major Iterations, or before permission/integration changes.

---

## SESSION PROTOCOL

**Start:** Read relevant module file(s) in `modules/` (NOT the whole monolith). Confirm what you're editing. Ask what to work on.

**End:** Summarize changes, count Major Iterations since last backup, recommend next steps. Update this CLAUDE.md if significant changes were made.

---

## OTHER DOCS

- `LOD-continuation-prompt.md` — Detailed continuation prompt (paste into new session)
- `mobile-lead-magnet-continuation-prompt.md` — Continuation prompt for building standalone mobile lead magnet pages (deferred from session 15)
- `version-log.md` — Full version history with line-by-line details
- `update-recap.md` — Summary of scenario dashboard work
- `supabase-schema.sql` — scenarios + pq tables DDL (original)
- `supabase-profiles.sql` — profiles table DDL (original)
- `supabase-tenant-migration.sql` — ✅ tenants table, tenant_id, get_my_tenant_id(), fixes 'lo' role bug (deployed)
- `supabase-contacts.sql` — ✅ contacts, contact_notes, intake_links, contact_id FK, 9 indexes, all RLS (deployed)
- `supabase-borrower-claim.sql` — ✅ 2 RLS policies on scenarios: borrower SELECT + UPDATE by email match (deployed)
- `supabase-leads-migration.sql` — ✅ 6 new columns on scenarios + lead_status index (deployed session 9)
