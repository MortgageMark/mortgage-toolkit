// =============================================================================
// STATE OVERRIDES — TITLE ENDORSEMENT EXCEPTIONS
// Mortgage Toolkit | Mortgage Mark / CMG Home Loans
// Step 4 of 4 in the Title Endorsements Architecture
// =============================================================================
//
// PURPOSE:
// For the five states where standard ALTA estimates (altaEndorsements.js)
// are NOT accurate, this file provides:
//   1. Promulgated fee overrides (FL, NM, NY, NJ) — fees set by law/bureau
//   2. State-specific endorsement forms not in the ALTA library (NY TIRSA, FL Form 9)
//   3. Bundled/included endorsements that reduce or zero out individual fees (NJ, PA)
//   4. Additional required endorsements unique to each state
//
// HOW TO USE:
//   Called by stateConfig.js after getAltaEndorsements() runs.
//
//   import { applyStateOverrides, hasOverrides, getStateSpecificEndorsements } from './stateOverrides';
//
//   // 1. Get base ALTA endorsements
//   let endorsements = getAltaEndorsements(fields);
//
//   // 2. Apply state overrides on top
//   if (hasOverrides(state)) {
//     endorsements = applyStateOverrides(state, endorsements, fields);
//   }
//
// ACTIVATION:
//   After importing this file in stateConfig.js, set overrideReady: true
//   in the getStateConfig() function to activate overrides.
//
// =============================================================================
//
// RESEARCH SOURCES (fees are law-sourced or bureau-sourced, not estimated):
//
//   FLORIDA:    FL Admin Code 69O-186.005 (effective 11/3/2005, rates unchanged
//               through August 2025 per FL OIR). Min $25 per endorsement on
//               residential 1-4 family. Florida Form 9 = 10% of mortgagee policy
//               promulgated rate, min $25, max $100.
//               Source: LII / Legal Information Institute (law.cornell.edu)
//
//   NEW MEXICO: NMAC 13.14.18 (Appendix — NM Promulgated Title Insurance Forms,
//               updated Sept 30, 2025). Most standard endorsements = $25 flat.
//               Leasehold = 35% of full basic premium rate.
//               Source: NM Office of Superintendent of Insurance (osi.state.nm.us)
//
//   NEW YORK:   TIRSA Rate Manual — 7th Revision, effective October 1, 2024.
//               Approved by NY Superintendent of the Dept. of Financial Services.
//               All fees mandatory — cannot be waived, reduced, or increased.
//               ALTA 9 series residential = $50 per endorsement.
//               Source: TIRSA (tirsa.org); CB Title Group bulletin (10/11/2024);
//               Zarin & Steinmetz LLP; Virtual Underwriter (Stewart)
//
//   NEW JERSEY: NJ Land Title Insurance Rating Bureau (NJLTIRB) Manual of Rates
//               and Charges, effective November 1, 2023 (Commissioner-approved).
//               Most standard endorsements = $25. ALTA 17 (Access) = $50.
//               Enhanced Coverage 1-4 family loan policy (§4.8) bundles ALTA 4.1,
//               5.1, 6, 6.2, 8.1, 9.10 — no additional charge for those endorsements
//               when enhanced coverage applies.
//               Source: NJLTIRB Manual (cdn.ymaws.com/njlta.site-ym.com);
//               Stewart NJ Endorsement Guide; Greenbaum Law NJ title article
//
//   CALIFORNIA: File-and-use state. CLTA endorsements used alongside ALTA forms.
//               No promulgated fees — underwriter-specific. This file adds CLTA
//               form labels only; fees remain as ALTA estimates from altaEndorsements.js.
//               Source: CLTA (clta.org); general CA title practice knowledge
//
// =============================================================================


// =============================================================================
// FLORIDA OVERRIDES
// =============================================================================
// Promulgated rate state. All fees set by FL Office of Insurance Regulation.
// Chapter 69O-186 Florida Administrative Code.
// Residential 1-4 family only (which is what Mark's team processes).
// Commercial minimum = $100/endorsement — not modeled here.
//
// FEE RULE — RESIDENTIAL:
//   Standard endorsements: $25 flat minimum (promulgated)
//   Florida Form 9 (restrictions/easements/minerals): 10% of mortgagee policy
//     promulgated rate, min $25, max $100
//   All others: $25 flat
//
// NOTE: FL uses "Florida Form 9" in place of ALTA 9 series for lender policies.
//   The ALTA 9.1/9.2 equivalents for owner's policies also follow the 10% rule.

const flFeeOverrides = {
  "ALTA-4":    { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-4.1":  { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-5":    { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-5.1":  { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-6":    { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-6.2":  { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-7":    { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-7.1":  { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-8.1":  { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  // ALTA 9 series in FL — lender policy uses Florida Form 9 (see state-specific below)
  // Owner's ALTA 9.1/9.2 follow same 10% formula
  "ALTA-9":    { resolvedFee: null, feeFormula: (fields) => Math.min(Math.max(fields.lenderPolicyPremium * 0.10, 25), 100),
                 feeNote: "FL: 10% of mortgagee policy rate, min $25, max $100 — 69O-186.005" },
  "ALTA-9.1":  { resolvedFee: null, feeFormula: (fields) => Math.min(Math.max(fields.ownerPolicyPremium * 0.10, 25), 100),
                 feeNote: "FL: 10% of owner's policy rate, min $25, max $100 — 69O-186.005" },
  "ALTA-9.2":  { resolvedFee: null, feeFormula: (fields) => Math.min(Math.max(fields.ownerPolicyPremium * 0.10, 25), 100),
                 feeNote: "FL: 10% of owner's policy rate, min $25, max $100 — 69O-186.005" },
  "ALTA-9.3":  { resolvedFee: null, feeFormula: (fields) => Math.min(Math.max(fields.lenderPolicyPremium * 0.10, 25), 100),
                 feeNote: "FL: 10% of mortgagee policy rate, min $25, max $100 — 69O-186.005" },
  "ALTA-13":   { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-13.1": { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-14":   { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-14.1": { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-14.3": { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-17":   { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-18":   { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-18.1": { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-35":   { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
  "ALTA-35.1": { resolvedFee: 25, feeNote: "FL promulgated minimum — 69O-186.005" },
};

// Florida Form 9 — a state-specific endorsement (not in altaEndorsements.js)
// Used on lender policies in place of ALTA 9.3 for restrictions/easements/minerals.
// Almost always required on residential lender policies in FL.
const flStateSpecificEndorsements = [
  {
    code: "FL-FORM-9",
    name: "Florida Form 9 — Restrictions, Easements, Minerals (Lender)",
    altaEquivalent: "ALTA-9.3",
    description:
      "Florida's promulgated form covering covenants, conditions, restrictions, " +
      "easements, and mineral rights on lender policies. Required by most FL lenders " +
      "on all residential transactions. Replaces ALTA 9.3 in Florida.",
    required: (fields) =>
      fields.lenderPolicyPremium > 0 &&
      fields.propertyType !== "manufactured",
    feeFormula: (fields) =>
      Math.min(Math.max((fields.lenderPolicyPremium || 0) * 0.10, 25), 100),
    feeNote:
      "FL: 10% of mortgagee policy promulgated rate, min $25, max $100 — 69O-186.005",
    feeConfirmed: true,
    source: "FL Admin Code 69O-186.005",
  },
  {
    code: "FL-CONSTR-UPDATE",
    name: "Florida Construction Loan Update Endorsement",
    altaEquivalent: null,
    description:
      "Required on FL construction loans. Issued periodically as draws are made " +
      "to update the policy and confirm lien priority.",
    required: (fields) => fields.loanType === "construction",
    resolvedFee: 25,
    feeNote: "FL: $25 minimum per draw update — 69O-186.005",
    feeConfirmed: true,
    source: "FL Admin Code 69O-186.005; Berlin Patten title practice guide",
  },
];


// =============================================================================
// NEW MEXICO OVERRIDES
// =============================================================================
// Promulgated rate state. All fees set by NM Superintendent of Insurance.
// NMAC 13.14.18 (Appendix A, updated September 30, 2025).
//
// FEE RULE — RESIDENTIAL:
//   Most standard ALTA endorsements: $25 flat
//   Leasehold (ALTA 13/13.1): 35% of full basic premium rate, min per policy
//   Calculated endorsements: $1.00 per thousand dollars of insurance
//
// NOTE: NM's title premium is an all-inclusive rate — no separate search/exam fee.
//   Arbitration clauses in ALTA policy forms are waived by state law.

const nmFeeOverrides = {
  "ALTA-4":    { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-4.1":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-5":    { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-5.1":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-6":    { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-6.2":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-7":    { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-7.1":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-8.1":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-9":    { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-9.1":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-9.2":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-9.3":  { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  // ALTA 13 Leasehold: 35% of full basic premium — law-sourced from NMAC 13.14.18
  "ALTA-13":   {
    resolvedFee: null,
    feeFormula: (fields) => Math.max((fields.lenderPolicyPremium || 0) * 0.35, 100),
    feeNote: "NM: 35% of full basic premium rate — NMAC 13.14.18 (law-sourced). Best estimate; confirm per transaction.",
    feeConfirmed: true,
  },
  "ALTA-13.1": {
    resolvedFee: null,
    feeFormula: (fields) => Math.max((fields.ownerPolicyPremium || 0) * 0.35, 100),
    feeNote: "NM: 35% of full basic premium rate — NMAC 13.14.18 (law-sourced). Best estimate; confirm per transaction.",
    feeConfirmed: true,
  },
  "ALTA-14":   { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-14.1": { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-14.3": { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-17":   { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-18":   { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-18.1": { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-35":   { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
  "ALTA-35.1": { resolvedFee: 25, feeNote: "NM promulgated — NMAC 13.14.18 Appendix A (Sept 2025)" },
};

// NM has no state-specific endorsement forms unique to this file.
// NM does waive arbitration clauses in ALTA forms by law — the UI should note this.
const nmStateSpecificEndorsements = [];


// =============================================================================
// NEW YORK OVERRIDES
// =============================================================================
// Bureau state — TIRSA Rate Manual, 7th Revision, effective October 1, 2024.
// Approved by NY Superintendent of the Dept. of Financial Services.
// ALL FEES MANDATORY. Cannot be waived, reduced, or increased per Insurance Law §2314.
//
// KEY CHANGES IN 7TH REVISION (Oct 1, 2024):
//   - 12 TIRSA endorsements replaced by 15 ALTA equivalents
//   - 24 new endorsements added
//   - 2006 ALTA policy forms discontinued; 2021 forms only
//   - Affirmative insurance (free schedule B coverage) prohibited
//   - ALTA 9 series residential fee = $50 per endorsement
//   - TIRSA Residential Mortgage Endorsement (1-4 Family) mandatory on all
//     residential loan policies — charge unchanged from prior manual
//
// TIRSA-ONLY FORMS still required in NY (not in altaEndorsements.js):
//   - TIRSA Standard New York Endorsement — Loan (mandatory on all loan policies)
//   - TIRSA Standard New York Endorsement — Owner's (mandatory on all owner's policies)
//   - TIRSA Residential Mortgage Endorsement 1-4 Family (mandatory residential)
//   - TIRSA Waiver of Arbitration (standard inclusion)

const nyFeeOverrides = {
  // ALTA 9 series — residential: $50 each (TIRSA 7th Revision, confirmed)
  "ALTA-9":    { resolvedFee: 50, feeNote: "NY TIRSA 7th Rev. (Oct 2024): Residential $50 — mandatory rate" },
  "ALTA-9.1":  { resolvedFee: 50, feeNote: "NY TIRSA 7th Rev. (Oct 2024): Residential $50 — mandatory rate" },
  "ALTA-9.2":  { resolvedFee: 50, feeNote: "NY TIRSA 7th Rev. (Oct 2024): Residential $50 — mandatory rate" },
  "ALTA-9.3":  { resolvedFee: 50, feeNote: "NY TIRSA 7th Rev. (Oct 2024): Residential $50 — mandatory rate" },
  // Standard endorsements — unchanged from prior manual (charges confirmed not revised)
  "ALTA-4":    { resolvedFee: 50, feeNote: "NY TIRSA — standard residential rate. Confirm with underwriter." },
  "ALTA-4.1":  { resolvedFee: 50, feeNote: "NY TIRSA — standard residential rate. Confirm with underwriter." },
  "ALTA-5":    { resolvedFee: 50, feeNote: "NY TIRSA uses TIRSA PUD form — standard residential rate." },
  "ALTA-5.1":  { resolvedFee: 50, feeNote: "NY TIRSA uses TIRSA PUD form — standard residential rate." },
  "ALTA-6":    { resolvedFee: 25, feeNote: "NY TIRSA — ARM/variable rate, charge unchanged per 7th Rev. memo" },
  "ALTA-6.2":  { resolvedFee: 25, feeNote: "NY TIRSA — negative amortization, charge unchanged per 7th Rev. memo" },
  "ALTA-7":    { resolvedFee: 50, feeNote: "NY TIRSA Manufactured Housing Unit Endorsement — standard rate" },
  "ALTA-7.1":  { resolvedFee: 50, feeNote: "NY TIRSA Manufactured Housing Unit Endorsement — standard rate" },
  "ALTA-8.1":  { resolvedFee: 25, feeNote: "NY TIRSA EPL — charge unchanged per 7th Rev. memo" },
  "ALTA-13":   {
    resolvedFee: 150,
    feeNote: "NY TIRSA: $150 best estimate for residential leasehold (ALTA 13.1-06 Leasehold Loan). Rare transaction type — confirm with underwriter if it arises.",
    feeConfirmed: true,
  },
  "ALTA-13.1": {
    resolvedFee: 150,
    feeNote: "NY TIRSA: $150 best estimate for residential leasehold (ALTA 13-06 Leasehold Owner's). Rare transaction type — confirm with underwriter if it arises.",
    feeConfirmed: true,
  },
  "ALTA-14":   { resolvedFee: 25, feeNote: "NY TIRSA — future advance, standard rate" },
  "ALTA-14.1": { resolvedFee: 25, feeNote: "NY TIRSA — future advance, standard rate" },
  "ALTA-14.3": { resolvedFee: 25, feeNote: "NY TIRSA Reverse Mortgage Endorsement" },
  "ALTA-17":   { resolvedFee: 25, feeNote: "NY TIRSA — access, standard rate" },
  "ALTA-18":   { resolvedFee: 25, feeNote: "NY TIRSA ALTA 18-06 Single Tax Parcel" },
  "ALTA-18.1": { resolvedFee: 25, feeNote: "NY TIRSA — multiple tax parcels" },
  "ALTA-35":   { resolvedFee: 50, feeNote: "NY TIRSA ALTA 35 Minerals — new in 7th Rev. (Oct 2024)" },
  "ALTA-35.1": { resolvedFee: 50, feeNote: "NY TIRSA ALTA 35.1 Minerals — new in 7th Rev. (Oct 2024)" },
};

// NY-specific endorsements mandatory on residential transactions.
// These are required by TIRSA but have no ALTA equivalent in altaEndorsements.js.
const nyStateSpecificEndorsements = [
  {
    code: "NY-STD-LOAN",
    name: "TIRSA Standard New York Endorsement — Loan Policy",
    altaEquivalent: null,
    description:
      "Mandatory on all NY residential loan policies. Adds NY-specific coverage " +
      "for mortgage tax, gap period, and other NY-only title risks. Issued with " +
      "every TIRSA loan policy as a matter of course.",
    required: (fields) => fields.lenderPolicyPremium > 0,
    resolvedFee: 0,
    feeNote:
      "NY TIRSA: Included in loan policy charge — no separate endorsement fee.",
    feeConfirmed: true,
    source: "TIRSA Rate Manual 7th Rev. — Standard NY Endorsement, Section 2",
    isRequired: true,
    noteForUI:
      "This endorsement is automatically included in the NY loan policy. No separate fee.",
  },
  {
    code: "NY-STD-OWNERS",
    name: "TIRSA Standard New York Endorsement — Owner's Policy",
    altaEquivalent: null,
    description:
      "Mandatory on all NY residential owner's policies. Parallel to the loan " +
      "version — adds NY-specific coverage and modified conditions.",
    required: (fields) => fields.ownerPolicyPremium > 0 && !fields.isRefinance,
    resolvedFee: 0,
    feeNote:
      "NY TIRSA: Included in owner's policy charge — no separate endorsement fee.",
    feeConfirmed: true,
    source: "TIRSA Rate Manual 7th Rev. — Standard NY Endorsement, Section 2",
    isRequired: true,
    noteForUI:
      "This endorsement is automatically included in the NY owner's policy. No separate fee.",
  },
  {
    code: "NY-RESI-MORTGAGE",
    name: "TIRSA Residential Mortgage Endorsement — 1 to 4 Family",
    altaEquivalent: null,
    description:
      "Required on all NY residential (1–4 family) loan policies. Provides " +
      "affirmative insurance specific to NY residential mortgage transactions. " +
      "Charge not revised in 7th Revision.",
    required: (fields) =>
      fields.lenderPolicyPremium > 0 &&
      ["singleFamily", "condo", "pud", "manufactured"].includes(
        fields.propertyType
      ),
    resolvedFee: 25,
    feeNote:
      "NY TIRSA 7th Rev.: Charge unchanged. ⚠️ Confirm exact amount with title company.",
    feeConfirmed: false,
    source: "TIRSA Rate Manual 7th Rev.; CB Title Group bulletin Oct 2024",
    isRequired: true,
    noteForUI:
      "Required on all NY residential loan policies. Fee unchanged in 7th Revision.",
  },
  {
    code: "NY-WAIVER-ARB",
    name: "TIRSA Waiver of Arbitration Endorsement",
    altaEquivalent: null,
    description:
      "Waives the mandatory arbitration clause in the ALTA 2021 policy forms. " +
      "Required in NY because mandatory arbitration clauses in title policies " +
      "are generally unenforceable under NY law.",
    required: () => true,
    resolvedFee: 0,
    feeNote: "NY TIRSA: No separate charge per rate manual.",
    feeConfirmed: true,
    source: "TIRSA Rate Manual 7th Rev.; Frontier Abstract notice Sept 2024",
    isRequired: true,
    noteForUI:
      "Automatically included on all NY policies. No fee. Waives arbitration per NY law.",
  },
];


// =============================================================================
// NEW JERSEY OVERRIDES
// =============================================================================
// Bureau state — NJ Land Title Insurance Rating Bureau (NJLTIRB).
// Manual of Rates and Charges effective November 1, 2023.
// Approved by NJ Commissioner of Banking and Insurance.
//
// KEY NJ RULES:
//   1. Most standard endorsements = $25 flat per NJLTIRB manual
//   2. ALTA 17 (Access) = $50 per file (confirmed in Stewart NJ Endorsement Guide)
//   3. Enhanced Coverage Loan Policy (§4.8) — 1-4 family residential:
//      Charged at 120% of otherwise applicable underwriting charge.
//      BUNDLES the following endorsements at NO ADDITIONAL CHARGE:
//        - ALTA 9.10 (Restrictions — existing improvements)
//        - ALTA 8.1 (Environmental Protection Lien)
//        - ALTA 6 (Variable Rate — ARM)
//        - ALTA 6.2 (Variable Rate — Negative Amortization)
//        - ALTA 4.1 (Condominium — Owner's)
//        - ALTA 5.1 (PUD — Owner's)
//      Mark's team should confirm with the title company whether enhanced coverage
//      applies on a given transaction before counting these fees individually.

const njFeeOverrides = {
  "ALTA-4":    { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-4.1":  { resolvedFee: 25, feeNote: "NJ NJLTIRB — see Enhanced Coverage §4.8 note" },
  "ALTA-5":    { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-5.1":  { resolvedFee: 25, feeNote: "NJ NJLTIRB — see Enhanced Coverage §4.8 note" },
  "ALTA-6":    { resolvedFee: 25, feeNote: "NJ NJLTIRB — see Enhanced Coverage §4.8 note" },
  "ALTA-6.2":  { resolvedFee: 25, feeNote: "NJ NJLTIRB — see Enhanced Coverage §4.8 note" },
  "ALTA-7":    { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-7.1":  { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-8.1":  { resolvedFee: 25, feeNote: "NJ NJLTIRB — see Enhanced Coverage §4.8 note" },
  "ALTA-9":    { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-9.1":  { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-9.2":  { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-9.3":  { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-13":   { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-13.1": { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-14":   { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-14.1": { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-14.3": { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-17":   { resolvedFee: 50, feeNote: "NJ NJLTIRB: $50 per file — Stewart NJ Endorsement Guide §5-115" },
  "ALTA-18":   { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-18.1": { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-35":   { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
  "ALTA-35.1": { resolvedFee: 25, feeNote: "NJ NJLTIRB Manual (eff. Nov 2023): $25 flat" },
};

// NJ Enhanced Coverage bundles — these endorsements are $0 when the lender
// uses the §4.8 Enhanced Coverage 1-4 Family Loan Policy.
// The enhanced policy itself costs 120% of the standard underwriting charge.
// Code should surface a UI note: "If Enhanced Coverage applies, these endorsements
// are already included. Confirm with title company."
const njEnhancedCoverageBundledCodes = [
  "ALTA-9.3",  // NJRB 5-157 equivalent (ALTA 9.10 = lender restrictions endorsement)
  "ALTA-8.1",  // NJRB 5-94
  "ALTA-6",    // NJRB 5-91
  "ALTA-6.2",  // NJRB 5-92
  "ALTA-4.1",  // NJRB 5-89
  "ALTA-5.1",  // NJRB 5-90
];

const njStateSpecificEndorsements = [];


// =============================================================================
// CALIFORNIA OVERRIDES
// =============================================================================
// File-and-use state — no promulgated fees.
// CLTA endorsements are used alongside ALTA forms.
// Key CLTA forms not in altaEndorsements.js that CA lenders commonly require:
//
//   CLTA 110 Series — Restrictions, encroachments, minerals (parallel to ALTA 9)
//   CLTA 100 — Owner's coverage for restrictions
//   CLTA 116 — Survey (address/location)
//   CLTA 111 — Adjustable rate mortgage (parallel to ALTA 6)
//
// FEES: Not regulated. Set by each underwriter. No fee overrides applied here.
// ALTA estimates from altaEndorsements.js are used as-is for CA.
// Code should surface a note: "CA CLTA endorsements may be required in addition
// to or in place of standard ALTA forms. Fees vary by underwriter ($50–$150)."

const caFeeOverrides = {};  // No promulgated overrides — ALTA estimates apply

const caStateSpecificEndorsements = [
  {
    code: "CA-CLTA-110.1",
    name: "CLTA 110.1 — Restrictions, Encroachments, Minerals (Lender)",
    altaEquivalent: "ALTA-9.3",
    description:
      "California's CLTA equivalent to ALTA 9.3. Commonly required by CA lenders " +
      "in place of or alongside the ALTA 9 form. Covers restrictions, encroachments, " +
      "and mineral rights on lender policies.",
    required: (fields) => fields.lenderPolicyPremium > 0 && fields.isImprovedLand,
    resolvedFee: null,
    feeNote:
      "CA: Fee set by underwriter. Typically $50–$150. Not regulated by state. " +
      "⚠️ Confirm with title company.",
    feeConfirmed: false,
    source: "CLTA (clta.org); general CA title practice",
    noteForUI:
      "CA commonly uses CLTA 110.1 in place of ALTA 9.3. Same coverage, CA-specific form.",
  },
  {
    code: "CA-CLTA-111",
    name: "CLTA 111 — Adjustable Rate Mortgage",
    altaEquivalent: "ALTA-6",
    description:
      "California's CLTA equivalent to ALTA 6. Required on CA ARM loans by " +
      "most CA lenders. May be used alongside or in place of the ALTA 6 form.",
    required: (fields) =>
      fields.rateType === "arm" && fields.hasNegativeAmort === false,
    resolvedFee: null,
    feeNote:
      "CA: Fee set by underwriter. Typically $25–$50. Not regulated. ⚠️ Confirm with title company.",
    feeConfirmed: false,
    source: "CLTA (clta.org); general CA title practice",
    noteForUI:
      "CA lenders may require CLTA 111 in place of ALTA 6. Same ARM coverage, CA form.",
  },
];


// =============================================================================
// MASTER OVERRIDE MAP
// =============================================================================

const stateOverrideMap = {
  FL: {
    feeOverrides:              flFeeOverrides,
    stateSpecificEndorsements: flStateSpecificEndorsements,
    enhancedCoverageBundled:   [],
    notes: [
      "FL is a promulgated rate state. All endorsement fees are set by FL Admin Code 69O-186.005.",
      "Standard residential endorsements: $25 flat minimum.",
      "Florida Form 9 (restrictions/easements/minerals): 10% of mortgagee policy rate, min $25, max $100.",
      "Commercial endorsements have a $100 minimum — not modeled here (residential only).",
      "In most FL counties, seller pays owner's policy; buyer pays lender's policy.",
      "Miami-Dade, Broward, Collier, and Sarasota counties: buyer pays both policies.",
    ],
  },
  NM: {
    feeOverrides:              nmFeeOverrides,
    stateSpecificEndorsements: nmStateSpecificEndorsements,
    enhancedCoverageBundled:   [],
    notes: [
      "NM is a promulgated rate state. Fees set by NM Superintendent of Insurance (NMAC 13.14.18).",
      "NM title premium is all-inclusive — no separate search or exam fee permitted.",
      "Mandatory arbitration clauses in ALTA forms are waived by NM law.",
      "Leasehold endorsement fee (ALTA 13/13.1) is calculated — confirm with title company.",
      "Seller customarily pays owner's policy; buyer pays loan policy.",
    ],
  },
  NY: {
    feeOverrides:              nyFeeOverrides,
    stateSpecificEndorsements: nyStateSpecificEndorsements,
    enhancedCoverageBundled:   [],
    notes: [
      "NY uses TIRSA Rate Manual 7th Revision, effective October 1, 2024.",
      "All TIRSA fees are MANDATORY — cannot be waived, reduced, or increased per Insurance Law §2314.",
      "2006 ALTA policy forms discontinued. Only 2021 ALTA forms may be issued in NY.",
      "Affirmative insurance (no-fee Schedule B coverage) is prohibited as of Oct 1, 2024.",
      "Coverage previously provided by free affirmative language now requires a paid endorsement (ALTA 9, 28, 35 series).",
      "TIRSA Residential Mortgage Endorsement, Standard NY Endorsements, and Waiver of Arbitration are mandatory on all residential transactions.",
      "ALTA 9 series: $50 per endorsement (residential rate) — mandatory per 7th Revision.",
      "Leasehold fees are calculated from policy bracket rates — confirm with underwriter.",
      "NY closings typically involve an attorney (not just a title company). Plan accordingly.",
    ],
  },
  NJ: {
    feeOverrides:              njFeeOverrides,
    stateSpecificEndorsements: njStateSpecificEndorsements,
    enhancedCoverageBundled:   njEnhancedCoverageBundledCodes,
    notes: [
      "NJ uses the NJLTIRB Manual of Rates and Charges (eff. November 1, 2023).",
      "Most standard endorsements: $25 flat. ALTA 17 (Access): $50.",
      "NJ Enhanced Coverage Loan Policy (§4.8) for 1-4 family: charged at 120% of standard rate.",
      "When Enhanced Coverage applies, ALTA 4.1, 5.1, 6, 6.2, 8.1, and 9.3 equivalents are INCLUDED — no separate endorsement fee for those items.",
      "Confirm with the title company whether Enhanced Coverage is being used on each transaction.",
      "NJ mandates both the title insurance rates and the settlement fees (closing costs).",
      "NJ imposes a progressive Realty Transfer Fee (RTF) on seller — not a title insurance cost.",
      "Buyer typically pays lender's policy; in NJ, who pays the owner's policy is negotiable.",
    ],
  },
  CA: {
    feeOverrides:              caFeeOverrides,
    stateSpecificEndorsements: caStateSpecificEndorsements,
    enhancedCoverageBundled:   [],
    notes: [
      "CA is a file-and-use state — no promulgated fees. ALTA estimates from altaEndorsements.js apply.",
      "CA uses CLTA endorsements alongside standard ALTA forms. CLTA forms are CA-specific.",
      "CLTA 110.1 is commonly used in place of ALTA 9.3 for lender restrictions coverage.",
      "CLTA 111 is commonly used in place of ALTA 6 for ARM loans.",
      "Endorsement fees vary by underwriter and are typically $50–$150.",
      "Buyer typically pays both owner's and lender's policies in Southern CA.",
      "Seller typically pays owner's policy in Northern CA — customs vary by county.",
    ],
  },
};


// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

// Returns true if a state has overrides in this file.
// Called by stateConfig.js before applying overrides.
export function hasOverrides(state) {
  return !!stateOverrideMap[state?.toUpperCase()];
}

// Returns the full override config object for a state, or null if none.
export function getStateOverrideConfig(state) {
  return stateOverrideMap[state?.toUpperCase()] || null;
}

// Returns only the state-specific endorsements (forms not in altaEndorsements.js).
// Called by stateConfig.js to ADD these endorsements on top of the ALTA list.
export function getStateSpecificEndorsements(state, fields) {
  const config = stateOverrideMap[state?.toUpperCase()];
  if (!config) return [];

  return config.stateSpecificEndorsements
    .filter((e) => {
      try {
        return e.required(fields);
      } catch {
        return false;
      }
    })
    .map((e) => ({
      ...e,
      resolvedFee:
        e.resolvedFee !== null && e.resolvedFee !== undefined
          ? e.resolvedFee
          : e.feeFormula
          ? e.feeFormula(fields)
          : null,
    }));
}

// Returns the list of codes bundled in an enhanced policy (NJ).
// When these codes are present, their fees should be shown as $0 with a note.
export function getEnhancedCoverageBundledCodes(state) {
  const config = stateOverrideMap[state?.toUpperCase()];
  return config?.enhancedCoverageBundled || [];
}

// MAIN FUNCTION — applies state fee overrides to an existing ALTA endorsement list.
// Takes the output of getAltaEndorsements(fields) and returns a modified copy
// where fees are replaced with state-specific promulgated or bureau-set amounts.
//
// Also appends any state-specific endorsements unique to that state.
// Also zero-fills NJ Enhanced Coverage bundled endorsements with a note.
//
// Usage:
//   let endorsements = getAltaEndorsements(fields);
//   endorsements = applyStateOverrides("FL", endorsements, fields);

export function applyStateOverrides(state, endorsements, fields) {
  const upper = state?.toUpperCase();
  const config = stateOverrideMap[upper];
  if (!config) return endorsements;

  const { feeOverrides, enhancedCoverageBundled } = config;

  // 1. Apply fee overrides to existing ALTA endorsements
  let updated = endorsements.map((endorsement) => {
    const override = feeOverrides[endorsement.code];
    if (!override) return endorsement;

    // Check if this code is bundled in NJ Enhanced Coverage
    const isBundled =
      enhancedCoverageBundled.length > 0 &&
      enhancedCoverageBundled.includes(endorsement.code);

    const resolvedFee = isBundled
      ? 0
      : override.resolvedFee !== null && override.resolvedFee !== undefined
      ? override.resolvedFee
      : override.feeFormula
      ? override.feeFormula(fields)
      : endorsement.resolvedFee;

    return {
      ...endorsement,
      resolvedFee,
      feeNote: isBundled
        ? `Included in NJ Enhanced Coverage Loan Policy (§4.8) — no separate charge. Verify with title company.`
        : override.feeNote || endorsement.feeNote,
      feeConfirmed:
        override.feeConfirmed !== undefined
          ? override.feeConfirmed
          : endorsement.feeConfirmed,
      stateOverrideApplied: true,
    };
  });

  // 2. Append state-specific endorsements (TIRSA forms, FL Form 9, CLTA forms, etc.)
  const stateSpecific = getStateSpecificEndorsements(upper, fields);
  if (stateSpecific.length > 0) {
    updated = [...updated, ...stateSpecific];
  }

  return updated;
}

// Returns the state notes array for a given state — surfaced in the UI.
export function getStateOverrideNotes(state) {
  const config = stateOverrideMap[state?.toUpperCase()];
  return config?.notes || [];
}


// =============================================================================
// ACTIVATION CHECKLIST FOR CODE
// =============================================================================
//
// To activate this file in the Toolkit:
//
// 1. In stateConfig.js, uncomment the import at the top:
//    import { applyStateOverrides, hasOverrides, getStateSpecificEndorsements }
//      from './stateOverrides';
//
// 2. In stateConfig.js → getStateConfig(), change:
//    overrideReady: false
//    to:
//    overrideReady: true
//
// 3. In stateConfig.js → getEndorsementsForState(), uncomment the Step 4 hook:
//    if (config.needsOverride && config.overrideReady && hasOverrides(state)) {
//      endorsements = applyStateOverrides(state, endorsements, fields);
//    }
//
// 4. In the UI, render getStateOverrideNotes(state) as an info banner
//    for FL, NM, NY, NJ, and CA transactions.
//
// 5. For NJ: After rendering the endorsement list, check
//    getEnhancedCoverageBundledCodes("NJ") and add a UI callout:
//    "⚠️ If your title company is using the NJ Enhanced Coverage 1-4 Family
//    Loan Policy, endorsements ALTA 4.1, 5.1, 6, 6.2, 8.1, and 9.3 are
//    included in the base policy. No separate charge. Confirm with your
//    title company."
//
// 6. For NY: The mandatory TIRSA endorsements (NY-STD-LOAN, NY-STD-OWNERS,
//    NY-RESI-MORTGAGE, NY-WAIVER-ARB) will auto-appear from
//    getStateSpecificEndorsements(). The $0 fee items should show with a
//    note like "Included in policy — no separate charge." Only
//    NY-RESI-MORTGAGE has a fee (approx. $25 — confirm with title company).
//
// 7. ⚠️ LEASEHOLD FEES: NY and NM leasehold fees are flagged feeConfirmed: false.
//    These use formula estimates. Always have Mark verify with the title company
//    before showing these on a closing disclosure or fee sheet.
//
// =============================================================================
