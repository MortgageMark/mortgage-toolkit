# Home Loan Toolkit — Version Log

## Backup Policy
Save a new backup after every **5 major revisions**. A "major revision" is a change that adds, removes, or significantly rewrites a feature or module — not minor tweaks like fixing a typo or adjusting a color.

## Current Revision Count Since Last Backup: 3

## Versions

### v1 — 2026-02-27
**Backup file:** `mortgage-toolkit-v1-2026-02-27.html`
**Lines:** 4,182 | **Size:** ~304 KB
**Features at this point:**
- Core payment calculator with purchase/refi toggle
- Loan programs (Conventional, FHA, VA, USDA, HELOC)
- Tax & insurance dual-input (annual/monthly)
- Occupancy selector (Primary, Second Home, Investment)
- PMI auto-lookup with FICO input (industry avg, Enact, Essent data)
- Internal-only PMI company comparison panel
- Fee Sheet, Pre-Qual Letter, DTI module
- Cover page with login gating
- Internal person module selector
- Shared value propagation across modules
- Dark mode theming

### v3 — 2026-02-27
**Backup file:** `mortgage-toolkit-v3-2026-02-27.html`
**Lines:** 5,729 | **Size:** ~391 KB
**New features since v2:**
- Fee Sheet overhaul: updated defaults (UW $1,000, Appraisal $750, Credit Report $350), simplified escrow to 3-month fixed reserves, flat $150 recording fee
- New fee line items: Doc Prep ($250), Title Courier ($50), Tax Cert / E-Recording ($25 TX)
- Left-column section reorganization: ESCROW & RESERVES split from FEES & OPTIONS; CREDITS & CONTRIBUTIONS reordered
- Seller-Paid Survey toggle with inline green credit under Survey line
- Seller-Paid Title credit displayed inline under Owner's Title Policy
- Realtor Contributions input with green credit display
- 4-line bottom summary: Closing Costs | Prepaids/Escrow | Down Payment | Total Cash to Close
- Title Endorsements refactor: internal checklist with per-state persistence, single summary line for consumers
- Fee Defaults (Internal) panel: 11 editable default fee amounts persisted in localStorage with team-wide baselines
- Three-layer priority chain: per-transaction override > team custom default > hardcoded default
- `def()` helper function for custom default resolution
- Seller Paid Title toggle relocated from Credits to Fees & Options section

### v2 — 2026-02-27
**Backup file:** `mortgage-toolkit-v2-2026-02-27.html`
**Lines:** 5,718 | **Size:** ~386 KB
**New features since v1:**
- 50-state title policy integration with tiered/flat rate calculations
- RESPA escrow engine with aggregate low-point analysis
- Editable fee overrides (internal) with localStorage persistence
- Closing date picker with prepaid interest, weekend/holiday validation
- Optional fees & credits (earnest money, option money, lender credits, HOA)
- Seller contributions section with owner's title policy toggle
- Short pay toggle (internal)
- Texas homestead exemption (80% tax basis)
- Monthly-first tax & insurance dollar inputs
- State/City/County location selectors
- FHFA conforming loan limits ($832,750 baseline)
- FHA loan limits by county (TX-specific data)
- Jumbo/over-limit warning banners

---

## Revision Tracking (since last backup)

### Revision 1 (post-v3) — 2026-02-27
**Pre-Qual Letter Overhaul: CMG Conditional Pre-Qualification Format**
- **Complete rewrite** of `PreQualLetter` function to match CMG Home Loans "Conditional Pre-Qualification Letter" PDF format
- **New inline SVG logos:** `CmgLogo` (CMG HOME LOANS wordmark) and `EhlLogo` (Equal Housing Opportunity house icon) — keeps single-file architecture
- **Structured letter sections:** Date with full weekday, "Conditional Pre-Qualification Letter" title, Prospective Applicant(s), Mortgage Company, Loan Details table (Sales Price, Loan Amount, Qualifying Rate, Term in months, Max LTV, Loan Type & Description), Secondary Financing Terms 5-column table
- **Credit review section:** "has/has not" checkmark display with `Xm` helper component and `chk()` function; toggleable via `hasReviewed` state
- **Information provided checklist:** 4-row grid (Income, Cash to Close, Debts, Assets) with Yes/No/Not Applicable columns; each row toggleable via `provIncome`, `provCash`, `provDebts`, `provAssets` states
- **Eligibility paragraph and disclaimer** matching CMG letter verbiage
- **7-item numbered approval requirements** list
- **Expiration date** calculated from `expirationDays` with underlined display
- **LO contact block** with new fields: Address, City/State/ZIP, Branch NMLS
- **Fixed footer** with EHL logo, fine print disclaimer, and "Page 1" label
- **New state variables:** `loanPurpose`, `qualRate`, `maxLtv`, `loAddress`, `loCityStZip`, `branchNmls`, `hasReviewed`, `provIncome`, `provCash`, `provDebts`, `provAssets`, `additionalItems` (all `useLocalStorage` with `pq_` prefix)
- **Removed state variables:** `propertyAddress`, `downPaymentPct`, `conditions` (no longer needed in new format)
- **Input form reorganized** into: APPLICANT INFO, LOAN DETAILS (with USDA option, Purpose select, Qualifying Rate, Max LTV, 20-yr term), LOAN OFFICER INFO (Address, City/State/ZIP, Branch NMLS), VERIFICATION & OPTIONS (credit review toggle, 4 applicant-provided toggles), ADDITIONAL ITEMS textarea
- **Print CSS updated:** Tighter spacing (30px/50px padding), smaller base font (12px), table font (11px), fixed-position footer
- File changed from ~5,729 lines / 391 KB to ~5,872 lines / 399 KB

### Revision 2 (post-v3) — 2026-02-27
**Pre-Qual Letter Clean Redesign: Modern Layout with Reduced Verbiage**
- **Complete visual redesign** of `PreQualLetter` function — replaced cluttered PDF-mimicking format with clean, modern layout
- **Green CMG branding:** Replaced inline SVG logo with styled text — "CMG" in 28px bold #1B8A5A + "Home Loans" in 11px uppercase tracking, all on one line
- **Green 2px divider bar** below branding replaces old header treatment
- **Bigger title:** "Conditional Pre-Qualification Letter" promoted to `<h1>` at 22px navy bold
- **Non-bold disclaimer:** "This is not a loan approval…" moved below title as 11px italic gray text instead of bold centered block
- **Small uppercase section labels** (9px, letter-spacing 1.5px, gray #999) for visual hierarchy
- **Loan details card:** Replaced full-width table with `#f7f9fb` background card using CSS grid (2 columns, 6 fields)
- **Credit review as prose:** Converted checkbox table to natural sentence — "The mortgage company has/has not reviewed…"
- **Provided info as comma list:** Converted 4-row Yes/No/N-A grid into `providedItems.join(", ")` inline text
- **Condensed eligibility paragraph** — reduced verbiage while preserving compliance intent
- **Bullet-point requirements:** Replaced 7 numbered items with 6 `<ul>` bullets inside bordered card; red "THIS IS NOT A LOAN APPROVAL" section label
- **Removed Secondary Financing table** entirely
- **Removed Interest Only** option and display
- **Condensed LO signature block:** Name in navy bold, address/phone in #555, NMLS numbers with pipe separator on one line
- **Simplified footer:** Condensed disclaimer to 7.5px gray text; EHL logo (22×25 SVG) + "EQUAL HOUSING OPPORTUNITY" text; removed "Page 1" label
- **Simplified print CSS:** Replaced multi-rule block with clean `.mtk-prequal-letter` base styles + `.pq-footer` fixed positioning
- File changed from ~5,872 lines / 399 KB to ~5,856 lines / 399 KB

### Revision 3 (post-v3) — 2026-02-28
**Login & Persona System: Team Roster, Admin Panel, LO-of-Record Switching**
- **CoverPage fully replaced** with new `LoginScreen` component — two-tab login: "Team Login" (roster dropdown + password) and "Guest Access" (name/phone/email registration)
- **Team roster system:** `mtk_roster` localStorage key stores JSON array of team members with fields: id, name, title, company, phone, email, NMLS, branch NMLS, address, city, state, zip, role (admin/lo/assistant), passwordHash, active status
- **Default roster seed:** `getDefaultRoster()` pre-populates Mark Ningard (admin, Sr. Loan Officer, CMG Home Loans, NMLS 729612) and Paige "PJ" Minden (admin, Loan Officer Assistant, CMG Home Loans) with default passwords requiring change on first login
- **SHA-256 password hashing:** `hashPassword()` utility using Web Crypto API (`crypto.subtle.digest`) — MVP authentication with backend migration path to bcrypt/Argon2
- **Login security:** 5-attempt lockout with 30-second cooldown; first-login detection forces password change modal when logging in with default password
- **Session management:** `mtk_app_user` stores logged-in user session (id, name, role, isInternal); session validation on page load checks roster for active membership — deactivated users forced to re-login
- **Roster-based internal detection:** Replaced manual "I am an internal team member" checkbox with automatic detection — `isInternal` now checks if user ID exists in active roster
- **External user memory:** `mtk_external_users` stores guest visitors by email for returning-user recognition
- **AdminPanel component:** Full team member CRUD accessible via 👥 button in header (admin role only); modal forms for add/edit using existing `LabeledInput` and `SectionCard` components; search/filter, deactivate/reactivate, password reset; self-lockout prevention (admins cannot remove their own admin role)
- **LOSelector component:** Dropdown at top of Pre-Qual Letter (internal users only) listing all active admin/lo roster members; selecting a member calls `propagateLOToPreQual()` which writes their name, NMLS, phone, email, address, and branch NMLS to `pq_*` localStorage keys; address override field for outside-branch LOs; default selection is logged-in user
- **`propagateLOToPreQual()` helper:** Writes 6 keys (`mtk_pq_lo`, `mtk_pq_lonmls`, `mtk_pq_loph`, `mtk_pq_loem`, `mtk_pq_loaddr`, `mtk_pq_brnmls`) and dispatches storage event for cross-component sync
- **MortgageToolkit modifications:** `showAdmin` state toggle; Team Admin button in header bar (admin only); AdminPanel conditional render; roster and currentUserRole variables wired through
- **App root modifications:** LoginScreen replaces CoverPage; logout handler clears session; session validation useEffect on mount
- **PreQualLetter integration:** LOSelector inserted at top of letter form; LO fields populated from roster selection
- **Data structures designed for backend migration:** Roster and external users as JSON arrays ready to become API endpoints; session management can transition to JWT tokens
- File changed from ~5,856 lines / 399 KB to ~6,955 lines / ~460 KB

---

## Previous Revision History (v2 → v3)
### Revision 1 — 2026-02-27
**50-State Title Policy Integration**
- Replaced hardcoded `TEXAS_FEES` object with comprehensive `STATE_TITLE_DATA` covering all 50 states + DC
- Added `tieredRate()` and `flatRate()` helper functions for title insurance calculation
- Added `getStateFees()` lookup helper with TX fallback, `STATE_LIST` sorted dropdown array, and `SHARED_FEES` object
- Tiered rate structures for promulgated states (TX, FL, NM, CA, NY); flat per-$1000 rates for remaining states
- State selector dropdown in Fee Sheet — TRANSACTION DETAILS section
- Dynamic header, section title, disclaimer, and export filenames based on selected state
- Transfer tax, attorney fee, and endorsement line items added to both UI and PDF/Excel exports
- Simultaneous issue discount calculations per state
- File grew from ~4,182 lines / 304 KB to ~5,133 lines / 335 KB

### Revision 2 — 2026-02-27
**RESPA Escrow Engine + Editable Fee Overrides + Closing Date Picker**
- Built `STATE_ESCROW_RULES` with tax disbursement schedules for 16 states (TX, FL, CA, NY, IL, PA, NJ, OH, GA, NC, VA, WA, CO, AZ, MI, MA) plus a default fallback
- Implemented `respaAggregate()` — RESPA aggregate accounting low-point analysis to determine initial escrow deposit
- Implemented `calculateEscrow()` — full escrow computation returning itemized tax reserves, insurance reserves, monthly amounts, disbursement months, and cushion
- Texas-priority accuracy: taxes due January 31 (arrears), insurance annual upfront at closing, 2-month RESPA cushion
- Added full closing date picker (HTML `<input type="date">`) with prepaid interest days auto-calculation
- Closing date info line shows prepaid days, tax due months, and cushion months
- 10 editable fee override fields for internal users (`useLocalStorage` persistence with `fs_ov_` prefix)
- `FeeRow` component: inline editable amounts for internal users, static display for external users
- Internal-only "FEE OVERRIDES (INTERNAL)" panel with defaults shown as hints and "Reset All to Defaults" button
- Override values highlighted in blue with light blue background when active
- RESPA escrow reserves shown as itemized line items in Prepaids section with disbursement month labels
- Monthly escrow breakdown displayed below prepaids (tax/mo + insurance/mo = total/mo)
- All fee data fully wired into PDF and Excel export arrays
- File grew from ~5,133 lines / 335 KB to ~5,359 lines / 359 KB

### Revision 3 — 2026-02-27
**Optional Fees, Transfer Tax Labels, Survey Auto-Logic & Short Pay**
- Added `surveyRequired` (required/recommended/optional/none) and `transferTaxLabel` properties to all 51 state entries in `STATE_TITLE_DATA`
- Survey auto-logic: `useEffect` on state change auto-toggles survey based on `surveyRequired`; "optional" states preserve user's choice
- Survey toggle now shows state hint (e.g., "Survey: required in TX")
- Transfer tax line item uses state-specific label (e.g., "Documentary Stamps" for FL, "Conveyance Fee" for OH, "Excise Tax" for NC) in both UI and PDF/Excel exports
- New OPTIONAL FEES & CREDITS panel in left column with: Earnest Money, Option Money (TX-only), Lender Credits, HOA Transfer Fee, HOA Dues
- All optional fees wired into `grandTotal`: `totalClosingCosts + adjustedTotalPrepaids + homeWarranty + optionalFees - lenderCred - shortPayAdj`
- Optional fees section in right column displays line items with credits shown as negatives
- Short Pay toggle (internal only) in Fee Overrides panel — zeroes prepaid interest when closing day ≤ 5; shows validation when day > 5
- `adjustedPrepaidInterest` replaces raw `prepaidInterest` in UI and exports when short pay is active
- Closing date info line updated with short pay indicator
- All new fields fully wired into PDF and Excel export arrays
- File grew from ~5,359 lines / 359 KB to ~5,486 lines / 370 KB

### Revision 4 — 2026-02-27
**Bug Fix + Credits Rework + Seller Section + Closing Date Validation + TX Homestead**
- **Bug fix:** State dropdown on Fee Sheet now shows proper state names (was using `s.code`/`s.name` instead of `s.value`/`s.label` from `STATE_LIST`)
- **Tax & insurance propagation:** Payment calculator tax/insurance values now sync to Fee Sheet via `propagateSharedValues()`; watch keys expanded to include `pc_taxm`, `pc_taxr`, `pc_tax`, `pc_insm`, `pc_insr`, `pc_ins`
- **Credits display rework:** Earnest Money, Option Money, and Lender Credits now treated as credits — subtracted from grand total via new `totalCredits` variable; displayed as negative amounts in green in the right column; user enters positive numbers; export arrays show negative values
- **Seller Contributions section:** New `SELLER CONTRIBUTIONS` panel in left column with "Seller Pays Owner's Title Policy" toggle (`fs_spt`, default true) and Seller Credits input (`fs_sc`); right column shows seller section with title policy info line and seller credits as negative; all wired into PDF/Excel exports
- **Grand total formula:** `totalClosingCosts + adjustedTotalPrepaids + homeWarranty + optionalFees - totalCredits - sellerCred - shortPayAdj`
- **Dollar formatting:** Added `useCommas` prop to all dollar-amount inputs (monthly taxes, monthly insurance, earnest money, option money, lender credits, HOA transfer fee, HOA dues, seller credits)
- **Closing date validation:** Weekends and federal holidays blocked with alert messages; `getFederalHolidays()` with observed-date logic (Sat→Fri, Sun→Mon) for all 11 federal holidays; collapsible holiday reference list under date picker; holiday warning in info line
- **Texas homestead exemption:** Toggle in payment calculator tax section (visible when state = TX); applies 80% multiplier to home price for tax basis; shows calculated basis when active; propagated through `propagateSharedValues()` and watch keys
- File grew from ~5,486 lines / 370 KB to ~5,599 lines / 369 KB

### Revision 5 — 2026-02-27
**Monthly Tax/Insurance Inputs + Location Fields + FHFA/FHA Loan Limits**
- **Tax & insurance monthly-first inputs:** Dollar-mode inputs now accept monthly amounts (not annual); hint text shows annual in small gray (e.g., "$4,800/yr"); rate mode unchanged
- **Calc useMemo updated:** Dollar-mode values used directly as monthly — no `/12` division; `annualTax = monthlyTaxInput * 12`
- **Propagation updated:** `propagateSharedValues()` passes dollar-mode values directly as monthly to DTI and Fee Sheet
- **Location fields:** Added State, City, County selectors in payment calculator (defaults: TX → Dallas → Dallas County); `TX_CITIES` mapping for 16 major TX metros; `TX_METRO_COUNTIES` mapping for metro-area counties; State dropdown uses full `STATE_LIST`; non-TX states show "Other" for city/county
- **FHFA conforming loan limits:** `CONFORMING_LIMITS` object with 2026 baseline $832,750 (all TX counties at baseline); `getLimit(stateCode, county)` lookup function
- **FHA loan limits:** `FHA_LIMITS` object with floor $541,287 and county-specific TX limits (Dallas/Collin/Denton/Harris/Travis/Williamson/Hays/Midland and MSA partners at $563,500); `getLimit(stateCode, county)` lookup
- **Loan limit warnings:** Amber "Jumbo Loan" warning when conventional loan > conforming limit; red "Exceeds FHA Limit" warning when FHA loan > FHA limit; blue info banners when within 5% of either limit; warnings show limit amount and overage
- **Homestead toggle fix:** Now reads `pcState` React variable instead of `localStorage.getItem("mtk_fs_state")`
- **Dependency arrays updated:** `pcState`, `pcCity`, `pcCounty` added to useEffect dispatch and watchKeys
- File grew from ~5,599 lines / 369 KB to ~5,718 lines / 386 KB

---

## Revision Tracking (since last backup)

### Revision 1 (post-v2) — 2026-02-27
**Fee Sheet Overhaul: Defaults, Escrow Simplification, New Fees & Section Reorganization**
- **Default fee updates:** Underwriting $995→$1,000; Appraisal fallback $550→$750; Credit Report fallback $65→$350
- **RESPA escrow engine removed:** Deleted `STATE_ESCROW_RULES`, `getEscrowRules()`, `respaAggregate()`, and `calculateEscrow()` (~100 lines). Replaced with simple 3-month fixed reserves: `taxReserves = mTax * 3`, `insReserves = mIns * 3`. When escrows waived → both $0
- **Recording fees simplified:** Removed dynamic state-based deed/mortgage/release calculation; replaced with flat $150
- **New fee line items:** Title Courier ($50); Tax Cert / E-Recording / Estate Guarantee ($25 in TX, configurable per state via `st.taxCertERecording`)
- **`titleFees` sum updated** to include `titleCourier + taxCertERecording`
- **Left-column reorganization:** Split "OPTIONAL FEES & CREDITS" into two SectionCards — "OPTIONAL FEES" (HOA Transfer Fee, HOA Dues) and "CREDITS & CONTRIBUTIONS" (Seller section first with toggle + seller credits, then Other Credits: Lender Credits, Option Money, Earnest Money)
- **Right-column reorganization:** Title & Closing section gains Title Courier and Tax Cert lines; Prepaids/Escrow section uses "Tax Reserves (3 mo)" and "Insurance Reserves (3 mo)" labels; Optional/Credits/Seller section restructured into OPTIONAL FEES → SELLER CONTRIBUTIONS → CREDITS
- **Export arrays updated** to match all new structure and labels
- **Removed:** `moName` helper (no longer needed without RESPA disbursement month display)
- **Closing date info line** simplified — removed tax due month and cushion references
- File changed from ~5,718 lines / 386 KB to ~5,617 lines / 381 KB

### Revision 2 (post-v2) — 2026-02-27
**Title Endorsements Refactor: Internal Checklist + Single Summary Line**
- **Bug fix:** Endorsement fees were always $0 — state data uses `cost` (flat $) and `costPct` (% of loan amount) but calculation referenced non-existent `e.fee`. Fixed with proper mapping: `costPct ? Math.round(loanAmount * costPct / 100) : cost`
- **Consumer view simplified:** Replaced individual endorsement line items with single "Title Endorsements" summary line (only shows when total > 0)
- **Internal endorsement checklist:** New "TITLE ENDORSEMENTS (INTERNAL)" SectionCard visible only to internal users; checkbox per endorsement showing name and computed fee; Select All / Clear All buttons; running total display
- **Checked state persisted** via `useLocalStorage("mtk_fs_endorsements", {})` keyed by `selectedState + "_" + index` so selections persist per-state
- **Export arrays updated** to match single summary line
- File changed from ~5,617 lines / 381 KB to ~5,669 lines / 384 KB

### Revision 3 (post-v2) — 2026-02-27
**Fee Sheet Restructure: New Fees, Section Reorganization & Bottom Summary**
- **New Doc Prep fee:** $250 default in Third Party Fees section; internal override field (`fs_ov_docprep`) added to Fee Overrides panel; included in `thirdPartyFees` sum
- **ESCROW & RESERVES SectionCard:** Split from FEES & OPTIONS — new left-column section contains Monthly Taxes, Monthly Insurance, Include Escrow toggle, HOA Transfer Fee, HOA Dues
- **OPTIONAL FEES SectionCard removed** from left column — HOA fields moved into ESCROW & RESERVES
- **Credits & Contributions reordered** as flat list: Option Money (TX-only) → Earnest Money → Seller Credits → Realtor Contributions (NEW) → Lender Credits; removed nested seller subsection
- **Seller-Paid Survey toggle:** New toggle in FEES & OPTIONS (visible when survey included); when active, adds green credit line "Survey (Seller Paid)" inline under Survey in right column; deducted from grand total via `sellerSurveyCredit`
- **Seller title credit moved inline:** "Owner's Title (Seller Paid)" green credit line now appears directly under Owner's Title Policy in TITLE & CLOSING section; separate SELLER CONTRIBUTIONS right-column section removed
- **Realtor Contributions:** New `useLocalStorage("mtk_fs_rc")` dollar input in Credits & Contributions; displays as green credit in right column when > 0; deducted from grand total
- **4-line bottom summary:** Replaced single grand total with: Closing Costs | Prepaids/Escrow | Down Payment (purchase only) | TOTAL CASH TO CLOSE (bold); down payment computed as `purchasePrice - loanAmount`
- **Grand total formula updated:** `totalClosingCosts + adjustedTotalPrepaids + homeWarranty + optionalFees - totalCredits - sellerCred - shortPayAdj - realtor - sellerSurveyCredit`
- **Export arrays updated** to match all right-column changes: Doc Prep line, seller survey credit, seller title credit inline, realtor contributions, removed SELLER CONTRIBUTIONS section, updated bottom summary
- **Reset All button** updated to include `setOvDocPrep("")`
- File changed from ~5,669 lines / 384 KB to ~5,694 lines / 387 KB

### Revision 4 (post-v2) — 2026-02-27
**Fee Sheet Polish: Defaults, Reordering, Renames & Cleanup**
- **Appraisal default simplified:** Replaced per-state/per-loan-type lookup `(st.appraisal && st.appraisal[loanType]) || st.appraisal?.conventional || 750` with flat `750`
- **Credit Report default simplified:** Replaced per-state lookup `st.creditReport || 350` with flat `350`
- **FEES & OPTIONS section moved:** Relocated from between TRANSACTION DETAILS and ESCROW & RESERVES to between CREDITS & CONTRIBUTIONS and FEE OVERRIDES (internal) on left column
- **Fee Overrides reordered** to match right-column fee sheet order: Underwriting → Processing → Appraisal → Credit Report & Verifications → Flood Cert → Tax Service → Doc Prep → Survey → Escrow/Settlement → Title Search → Home Warranty
- **"Credit Report" renamed** to "Credit Report & Verifications" in Fee Overrides, right-column FeeRow, and export array
- **Heading colors unified:** PREPAIDS & ESCROW, OPTIONAL FEES, and CREDITS right-column headings changed from `COLORS.green` to `COLORS.blue` to match LENDER FEES, THIRD PARTY FEES, and TITLE & CLOSING FEES
- **Home Warranty indent fixed:** Added missing `indent` prop to Home Warranty FeeRow under OPTIONAL FEES
- **Survey (Seller Paid) removed from CREDITS:** Removed display line and condition from right-column CREDITS section and export array; credit already displayed inline under Survey in THIRD PARTY FEES and deducted directly in `grandTotal` formula
- File changed from ~5,694 lines / 387 KB to ~5,692 lines / 387 KB

### Revision 5 (post-v2) — 2026-02-27
**Fee Defaults Settings Panel + Seller Paid Title Toggle Relocation**
- **Fee Defaults (Internal) panel:** New `FEE DEFAULTS (INTERNAL)` SectionCard visible only to internal users; 11 editable default fee fields persisted via `useLocalStorage` with `fs_def_` prefix; covers Underwriting, Processing, Appraisal, Credit Report & Verifications, Flood Cert, Tax Service, Survey, Doc Prep, Escrow/Settlement, Title Search, Home Warranty
- **Three-layer priority chain:** `ov(override, def(customDefault, hardcodedDefault))` — per-transaction override beats team custom default beats hardcoded default
- **`def()` helper function:** `const def = (custom, hardcoded) => { const n = parseFloat(custom); return (custom !== "" && !isNaN(n)) ? n : hardcoded; };` — mirrors `ov()` pattern for default resolution
- **All 11 fee calculations updated** to use `def()` wrapped fallbacks: underwriting, processing, appraisal, creditReport, floodCert, taxService, survey, docPrep, escrowFee, titleSearch, homeWarranty
- **`_defaults` object updated** to use `def()` values for hint text in Fee Overrides panel
- **Reset All to Built-in Defaults button** clears all 11 `defXxx` values back to empty (reverts to hardcoded)
- **Hint text** on each field shows the built-in hardcoded default (e.g., "Built-in: $1,000")
- **Seller Paid Title toggle moved:** Removed from CREDITS & CONTRIBUTIONS section; inserted into FEES & OPTIONS section above Seller Pays Survey toggle (purchase-only conditional preserved)
- **useMemo dependency array** expanded with all 11 `def*` variables
- File changed from ~5,692 lines / 387 KB to ~5,729 lines / 391 KB
- **v3 backup created** (5 major revisions since v2)
