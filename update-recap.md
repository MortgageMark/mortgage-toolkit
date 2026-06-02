# Loan Officer Dashboard (LOD) — Update Recap

## Completed Updates

### 1. Login Screen Bug Fix
- Fixed the login flow so users can successfully authenticate
- Pre-seeded team roster: Mark Ningard (Admin), Paige "PJ" Minden (LOA)
- Default password: `changeme`
- Password hashing via Web Crypto API (SHA-256)

### 2. Scenario Dashboard
- New screen that appears after login for internal users (Admin, Internal Loan Partner)
- Full CRUD: create, view, duplicate, and delete scenarios
- Each scenario stores: client name, notes, status, creator info, timestamps
- Data persisted in localStorage under `mtk_scenarios`

### 3. Create New Scenario
- Modal form to create scenarios with client name and notes
- Auto-populates creator info from logged-in user
- New scenarios start with empty calculator data

### 4. Back to Scenarios Button
- Added "← Scenarios" button in the MortgageToolkit header
- Only visible to internal users
- Auto-saves current calculator data before navigating back

### 5. Wire Scenarios to Existing Calculators
- **Snapshot/Restore system**: When you select a scenario, its saved calculator data loads into localStorage. When you leave, it saves back.
- **Key prop re-mount**: Switching scenarios forces all 20+ calculator modules to re-read their data fresh — no need to modify each module individually.
- **Start Fresh option**: Clears all calculator data for a blank workspace.
- Covers all calculator prefixes: `pc_`, `ra_`, `fs_`, `mc_`, `be_`, `pq_`, `fc_`, `af_`, `am_`, `dti_`, `rvb_`, `sns_`, `biw_`, `cce_`, `hel_`, `lpc_`, `bud_`, `ohlc_`, `rw_`, `fly_`, `brand_`

---

## How to Run
- Open `mortgage-toolkit.html` in your browser (double-click or right-click → Open with → Chrome)
- Do **not** use the `.jsx` file — it's an older copy

---

## Suggested Next Steps

1. **Test the scenario flow end-to-end** — Log in → create a scenario → enter data in a few calculators → go back to scenarios → reopen it and verify data persisted
2. **Auto-save on a timer** — Right now data only saves when you click "← Scenarios". Adding a periodic auto-save (e.g., every 30 seconds) would prevent data loss if the browser closes unexpectedly.
3. **Scenario status workflow** — The status field exists but isn't used yet. Could add filters (Active / Archived / Closed) and the ability to change status from the dashboard.
4. **Export/share scenarios** — Allow exporting a scenario as JSON or PDF for sharing with team members or borrowers.
5. **Borrower/Realtor view** — External users currently skip the scenario dashboard. Could build a simplified read-only view where they see scenarios shared with them.
6. **Version log update** — Update `version-log.md` with these changes for project history tracking.
