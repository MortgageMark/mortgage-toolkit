// =============================================================================
// ALTA STANDARD ENDORSEMENTS — RULES ENGINE
// Mortgage Toolkit | Mortgage Mark / CMG Home Loans
// Applies to: All U.S. states EXCEPT Texas (use texasTitleEndorsements.js for TX)
// Special state overrides: see stateOverrides.js (NY, FL, NJ — coming in Step 4)
// =============================================================================
//
// ─── FEE METHODOLOGY — READ THIS FIRST ────────────────────────────────────────
//
// Unlike Texas (fully promulgated), ALTA endorsement fees in most states are set
// by the individual title company or underwriter — not by state law.
//
// Only three states have fully promulgated title insurance rates:
//   TX → texasTitleEndorsements.js (already built)
//   FL → stateOverrides.js (coming in Step 4)
//   NM → stateOverrides.js (coming in Step 4)
//
// For all other states, fees below are the best available market estimates
// based on: published rate manuals (Ohio OTIRB, Kansas, Pennsylvania TIRBOP),
// national industry averages from Rocket Mortgage and Quicken Loans ($75 avg),
// and the $25–$75 range consistently cited across the title insurance industry.
//
// FEE TIERS USED IN THIS FILE:
//   TIER 1 — $25 : Simple coverage, single risk, low underwriting complexity
//   TIER 2 — $50 : Moderate complexity (condo, PUD, manufactured, environmental)
//   TIER 3 — $75 : Higher complexity — most cited rate in published state manuals
//   TIER 4 — Calculated: Leasehold only (30% of premium, min $100 per Ohio manual)
//
// These estimates are appropriate for a calculator/estimator tool.
// They should NOT be presented as exact guaranteed fees on a Closing Disclosure.
//
// FIELDS EXPECTED (same as texasTitleEndorsements.js — prompt Mark if any are missing):
//   - loanAmount          (number)
//   - purchasePrice       (number)
//   - loanType            (string): "conventional"|"fha"|"va"|"usda"|"homeEquity"|"heloc"|"reverse"|"construction"
//   - propertyType        (string): "singleFamily"|"condo"|"pud"|"manufactured"|"multiFamily"
//   - surveyProvided      (boolean)
//   - rateType            (string): "fixed"|"arm"
//   - hasNegativeAmort    (boolean)
//   - hasBalloon          (boolean)
//   - hasFutureAdvances   (boolean)
//   - isRefinance         (boolean)
//   - mineralRiskArea     (boolean)
//   - nearIndustrialZone  (boolean)
//   - lenderPolicyPremium (number)
//   - ownerPolicyPremium  (number)
//   - isImprovedLand      (boolean): true if existing structures on the property
//   - multipleParcel      (boolean): true if property spans more than one tax parcel
//   - isLeasehold         (boolean): true if borrower holds a leasehold interest
//   - state               (string): 2-letter state code — used by stateConfig router
//
// NEW FIELDS vs. Texas file — prompt Mark if these don't exist yet:
//   - isImprovedLand, multipleParcel, isLeasehold
//
// =============================================================================


export const altaEndorsements = [


  // ---------------------------------------------------------------------------
  // ALTA 4 | CONDOMINIUM (LENDER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-4",
    name: "Condominium",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 4",
    shortDescription: "Protects lender against loss from issues with condo documents, maps, or unpaid assessment liens.",
    fullDescription:
      "Required on all condominium transactions. Insures the lender against loss resulting from defects in the condominium declaration, bylaws, plat or map, and other governing documents. Also covers mechanics liens from unpaid HOA assessments that could prime the lender's mortgage lien. The ALTA equivalent of Texas T-26.",

    required: (fields) => fields.propertyType === "condo",
    requiredNote: "Required on all condominium purchase and refinance transactions.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 4 (Condo — Lender)",
      feeSource: "Market average. Ohio rate manual and national industry range: $25–$75. $50 is the midpoint.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 4.1 | CONDOMINIUM (OWNER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-4.1",
    name: "Condominium (Owner's)",
    appliesTo: "owner",
    altaForm: "ALTA Endorsement Form 4.1",
    shortDescription: "Same condo protections as ALTA 4 but for the owner's policy.",
    fullDescription:
      "The owner's policy version of ALTA 4. Provides the homebuyer/owner with protection against loss from condo declaration defects, bylaw issues, and unpaid assessment liens. Issued simultaneously with ALTA 4 on purchase transactions.",

    required: (fields) => fields.propertyType === "condo" && fields.isRefinance === false,
    requiredNote: "Required on condo purchases where an owner's policy is issued. Not applicable on refinances.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 4.1 (Condo — Owner's)",
      feeSource: "Same tier as ALTA 4. Consistent with published manuals.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 5 | PLANNED UNIT DEVELOPMENT (LENDER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-5",
    name: "Planned Unit Development (PUD)",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 5",
    shortDescription: "Protects lender from HOA/CC&R provisions in a PUD that could cause forfeiture or reversion of title.",
    fullDescription:
      "Required when the property is in a Planned Unit Development. Insures the lender that the PUD's CC&Rs, HOA bylaws, and other governing documents do not contain provisions that could result in forfeiture of title, reversion, or loss of lien priority. The ALTA equivalent of Texas T-25.",

    required: (fields) => fields.propertyType === "pud",
    requiredNote: "Required on all PUD transactions.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 5 (PUD — Lender)",
      feeSource: "Same tier as ALTA 4 across published state manuals. Market range: $25–$75.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 5.1 | PLANNED UNIT DEVELOPMENT (OWNER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-5.1",
    name: "Planned Unit Development — Owner's",
    appliesTo: "owner",
    altaForm: "ALTA Endorsement Form 5.1",
    shortDescription: "Same PUD protections as ALTA 5 but for the owner's policy.",
    fullDescription:
      "The owner's policy version of ALTA 5. Provides the homebuyer/owner with protection against loss from PUD/HOA governing document provisions. Issued simultaneously with ALTA 5 on purchase transactions.",

    required: (fields) => fields.propertyType === "pud" && fields.isRefinance === false,
    requiredNote: "Required on PUD purchases where an owner's policy is issued.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 5.1 (PUD — Owner's)",
      feeSource: "Market average.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 6 | VARIABLE RATE MORTGAGE
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-6",
    name: "Variable Rate Mortgage",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 6",
    shortDescription: "Insures lender's lien remains valid as interest rate and payments adjust on an ARM.",
    fullDescription:
      "Required on all adjustable-rate mortgage (ARM) transactions without negative amortization. Insures the lender that changes in the interest rate, payment amount, or outstanding balance do not affect the validity or priority of the mortgage lien. The ALTA equivalent of Texas T-36.",

    required: (fields) => fields.rateType === "arm" && fields.hasNegativeAmort === false,
    requiredNote: "Required on ARM loans. Use ALTA 6.2 instead if the loan has negative amortization.",

    fee: {
      type: "flat",
      tier: 1,
      calculate: () => 25,
      displayLabel: "ALTA 6 (Variable Rate)",
      feeSource: "Tier 1. Often bundled at no charge in PA and KS expanded policy packages. $25 is the floor market rate where charged separately.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 6.2 | VARIABLE RATE MORTGAGE — NEGATIVE AMORTIZATION
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-6.2",
    name: "Variable Rate — Negative Amortization",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 6.2",
    shortDescription: "ARM endorsement for loans where the balance can increase over time (negative amortization).",
    fullDescription:
      "Required when the ARM loan has a negative amortization feature. Replaces ALTA 6 — do not issue both. The ALTA equivalent of Texas T-37.",

    required: (fields) => fields.rateType === "arm" && fields.hasNegativeAmort === true,
    requiredNote: "Required on ARM loans with negative amortization. Replaces ALTA 6 — do not issue both.",

    fee: {
      type: "flat",
      tier: 1,
      calculate: () => 25,
      displayLabel: "ALTA 6.2 (Neg. Amort ARM)",
      feeSource: "Same tier as ALTA 6. Market range: $25–$50.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 7 | MANUFACTURED HOUSING (LENDER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-7",
    name: "Manufactured Housing",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 7",
    shortDescription: "Required when the home is a manufactured unit that has been affixed to land and retired as personal property.",
    fullDescription:
      "Required on manufactured/mobile home transactions. Insures the lender that the manufactured unit has been properly affixed to the real property and that the certificate of title has been cancelled/retired with the appropriate state agency. The ALTA equivalent of Texas T-30.",

    required: (fields) => fields.propertyType === "manufactured",
    requiredNote: "Required on all manufactured/mobile home transactions.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 7 (Manufactured — Lender)",
      feeSource: "Tier 2 — additional underwriting required (title retirement verification). Market range: $50–$100.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 7.1 | MANUFACTURED HOUSING (OWNER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-7.1",
    name: "Manufactured Housing — Owner's",
    appliesTo: "owner",
    altaForm: "ALTA Endorsement Form 7.1",
    shortDescription: "Same manufactured home protections as ALTA 7 but for the owner's policy.",
    fullDescription:
      "The owner's policy version of ALTA 7. Provides the buyer/owner with protection against title issues related to manufactured home affixation and title retirement. Issued simultaneously with ALTA 7 on purchase transactions.",

    required: (fields) => fields.propertyType === "manufactured" && fields.isRefinance === false,
    requiredNote: "Required on manufactured home purchases where an owner's policy is issued.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 7.1 (Manufactured — Owner's)",
      feeSource: "Consistent with ALTA 7 market rate.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 8.1 | ENVIRONMENTAL PROTECTION LIEN
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-8.1",
    name: "Environmental Protection Lien",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 8.1",
    shortDescription: "Protects lender against federal or state environmental liens that could prime the insured mortgage.",
    fullDescription:
      "Insures the lender that no federal or state environmental protection liens have been recorded against the property that would take priority over the insured mortgage. The ALTA equivalent of Texas T-28.",

    required: (fields) => fields.nearIndustrialZone === true,
    requiredNote: "Required when property is near industrial/commercial zones or when lender requires it on all loans.",

    fee: {
      type: "flat",
      tier: 1,
      calculate: () => 25,
      displayLabel: "ALTA 8.1 (Environmental)",
      feeSource: "Tier 1. Often bundled at no charge in PA and KS expanded policy packages. $25 where charged separately.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 9 | RESTRICTIONS, ENCROACHMENTS, MINERALS (LENDER — UNIMPROVED LAND)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-9",
    name: "Restrictions, Encroachments, Minerals (Lender — Unimproved)",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 9",
    shortDescription: "Protects lender against deed restriction violations and encroachments on unimproved land.",
    fullDescription:
      "Covers the lender against loss from violations of CC&Rs, encroachments onto easements or adjoining land, and damage from mineral extraction on unimproved land. Use ALTA 9.3 for improved property. The ALTA equivalent of Texas T-19.",

    required: (fields) => fields.isImprovedLand === false,
    requiredNote: "For lender's policy on unimproved land. Use ALTA 9.3 for improved (existing structures) property.",

    fee: {
      type: "flat",
      tier: 3,
      calculate: () => 75,
      displayLabel: "ALTA 9 (Restrictions — Lender, Unimproved)",
      feeSource: "Ohio OTIRB rate manual (published): $75 flat for ALTA 9 variants. Most widely cited regulated rate. National average per Rocket Mortgage: ~$75.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 9.1 | RESTRICTIONS, ENCROACHMENTS, MINERALS (OWNER — UNIMPROVED LAND)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-9.1",
    name: "Restrictions, Encroachments, Minerals (Owner — Unimproved)",
    appliesTo: "owner",
    altaForm: "ALTA Endorsement Form 9.1",
    shortDescription: "Owner's policy version of ALTA 9 for unimproved land.",
    fullDescription:
      "The owner's policy version of ALTA 9 for unimproved land. Protects the buyer/owner against loss from CC&R violations, encroachments, and mineral extraction damage.",

    required: (fields) => fields.isImprovedLand === false && fields.isRefinance === false,
    requiredNote: "For owner's policy on unimproved land purchases. Not applicable on refinances.",

    fee: {
      type: "flat",
      tier: 3,
      calculate: () => 75,
      displayLabel: "ALTA 9.1 (Restrictions — Owner, Unimproved)",
      feeSource: "Ohio OTIRB: $75. Some states apply a 50% simultaneous discount when issued with lender's policy — estimate remains $75 pending state confirmation.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 9.2 | RESTRICTIONS, ENCROACHMENTS, MINERALS (OWNER — IMPROVED LAND)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-9.2",
    name: "Restrictions, Encroachments, Minerals (Owner — Improved)",
    appliesTo: "owner",
    altaForm: "ALTA Endorsement Form 9.2",
    shortDescription: "Owner's policy protection against deed restriction violations and encroachments on improved residential property.",
    fullDescription:
      "The owner's policy version of restrictions/encroachments coverage for improved land (property with existing structures). Most commonly issued on standard residential purchases. The ALTA equivalent of Texas T-19.1.",

    required: (fields) => fields.isImprovedLand === true && fields.isRefinance === false,
    requiredNote: "Required on owner's policy for improved property purchases. Most common residential scenario.",

    fee: {
      type: "flat",
      tier: 3,
      calculate: () => 75,
      displayLabel: "ALTA 9.2 (Restrictions — Owner, Improved)",
      feeSource: "Ohio OTIRB: $75 flat. National average per Rocket Mortgage/Quicken Loans: ~$75.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 9.3 | RESTRICTIONS, ENCROACHMENTS, MINERALS (LENDER — IMPROVED LAND)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-9.3",
    name: "Restrictions, Encroachments, Minerals (Lender — Improved)",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 9.3",
    shortDescription: "Lender's policy protection against deed restriction violations and encroachments on improved residential property.",
    fullDescription:
      "The most commonly issued restrictions/encroachments endorsement on standard residential transactions. Protects the lender against CC&R violations, encroachments of improvements, and mineral extraction damage on improved property. The primary ALTA equivalent of Texas T-19.",

    required: (fields) => fields.isImprovedLand === true,
    requiredNote: "Required on lender's policy for improved property. The most common residential endorsement scenario.",

    fee: {
      type: "flat",
      tier: 3,
      calculate: () => 75,
      displayLabel: "ALTA 9.3 (Restrictions — Lender, Improved)",
      feeSource: "Ohio OTIRB: $75. Most cited rate across all reviewed state rate manuals. National industry average.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 13 | LEASEHOLD (LENDER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-13",
    name: "Leasehold — Lender's",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 13",
    shortDescription: "Required when the borrower holds a leasehold interest in the land rather than fee simple ownership.",
    fullDescription:
      "Required when the borrower holds a long-term leasehold interest rather than fee simple ownership — common in Hawaii, parts of California, and some Native American land situations. Insures the lender's interest in the leasehold estate.",

    required: (fields) => fields.isLeasehold === true,
    requiredNote: "Required when borrower holds a leasehold interest rather than fee simple title.",

    fee: {
      type: "calculated",
      tier: 4,
      calculate: (fields) => Math.max(fields.lenderPolicyPremium * 0.30, 100),
      displayLabel: "ALTA 13 (Leasehold — Lender)",
      feeSource: "Ohio OTIRB rate manual: leasehold endorsement = 30% of applicable policy premium, minimum $100. Used as the best available industry reference.",
      flagForConfirmation: true,
      flagNote: "Leasehold transactions are uncommon. Confirm with title partner when one arises — 30% of premium with $100 min is Ohio's published rate and a reasonable industry estimate.",
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 13.1 | LEASEHOLD (OWNER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-13.1",
    name: "Leasehold — Owner's",
    appliesTo: "owner",
    altaForm: "ALTA Endorsement Form 13.1",
    shortDescription: "Owner's policy version of the leasehold endorsement.",
    fullDescription:
      "The owner's policy equivalent of ALTA 13. Protects the buyer/owner against loss from leasehold estate issues including lease termination or forfeiture.",

    required: (fields) => fields.isLeasehold === true && fields.isRefinance === false,
    requiredNote: "Required on leasehold purchase transactions where an owner's policy is issued.",

    fee: {
      type: "calculated",
      tier: 4,
      calculate: (fields) => Math.max(fields.ownerPolicyPremium * 0.30, 100),
      displayLabel: "ALTA 13.1 (Leasehold — Owner's)",
      feeSource: "Ohio OTIRB: 30% of applicable policy premium, minimum $100.",
      flagForConfirmation: true,
      flagNote: "Same as ALTA 13 — confirm with title partner on any actual leasehold transaction.",
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 14 | FUTURE ADVANCE — PRIORITY
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-14",
    name: "Future Advance — Priority",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 14",
    shortDescription: "Protects the lender's lien priority for future advances on HELOCs and construction loans.",
    fullDescription:
      "Required when the loan involves future advances (HELOCs, construction loans, draw loans). Insures that each future advance maintains the same lien priority as the original loan. The ALTA equivalent of Texas T-44.",

    required: (fields) =>
      fields.hasFutureAdvances === true ||
      fields.loanType === "heloc" ||
      fields.loanType === "construction",
    requiredNote: "Required on HELOCs, construction loans, and any loan with future advance provisions.",

    fee: {
      type: "flat",
      tier: 1,
      calculate: () => 25,
      displayLabel: "ALTA 14 (Future Advance — Priority)",
      feeSource: "Tier 1 — simple lien-priority coverage. Market range: $25–$50.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 14.1 | FUTURE ADVANCE — KNOWLEDGE
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-14.1",
    name: "Future Advance — Knowledge",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 14.1",
    shortDescription: "Companion to ALTA 14. Protects advance priority even when lender has actual knowledge of an intervening lien.",
    fullDescription:
      "Issued alongside ALTA 14 on all future advance transactions. Addresses the scenario where the lender has actual knowledge of an intervening lien at the time of a future advance. The ALTA equivalent of Texas T-45.",

    required: (fields) =>
      fields.hasFutureAdvances === true ||
      fields.loanType === "heloc" ||
      fields.loanType === "construction",
    requiredNote: "Always issued alongside ALTA 14. Required on all future advance transactions.",

    fee: {
      type: "flat",
      tier: 1,
      calculate: () => 25,
      displayLabel: "ALTA 14.1 (Future Advance — Knowledge)",
      feeSource: "Same tier as ALTA 14. Companion endorsement.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 14.3 | FUTURE ADVANCE — REVERSE MORTGAGE
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-14.3",
    name: "Future Advance — Reverse Mortgage",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 14.3",
    shortDescription: "Future advance coverage specifically for reverse mortgage disbursements.",
    fullDescription:
      "Required on all reverse mortgage transactions in non-Texas states. Insures that each disbursement maintains the lender's lien priority.",

    required: (fields) => fields.loanType === "reverse",
    requiredNote: "Required on all reverse mortgage transactions (non-Texas states).",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 14.3 (Future Advance — Reverse)",
      feeSource: "Tier 2 — slightly more complex than standard future advance. Market range: $50–$75.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 17 | ACCESS AND ENTRY
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-17",
    name: "Access and Entry",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 17",
    shortDescription: "Insures that the property has legal access to a public road or street.",
    fullDescription:
      "Insures the lender that the property has legal access to and from a public street or road. More common on rural, semi-rural, or flag lot properties. NOTE: Florida does NOT provide access endorsements.",

    required: (fields) => false, // Default off — manually triggered when access is a concern
    requiredNote: "Not auto-required. Manually add when access to a public road is unclear or lender requires it. Not available in Florida.",

    fee: {
      type: "flat",
      tier: 1,
      calculate: () => 25,
      displayLabel: "ALTA 17 (Access and Entry)",
      feeSource: "Tier 1 — straightforward coverage. Market range: $25–$50.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 18 | SINGLE TAX PARCEL
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-18",
    name: "Single Tax Parcel",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 18",
    shortDescription: "Confirms the property constitutes a single, separately assessed tax parcel.",
    fullDescription:
      "Insures the lender that the land described in the policy is assessed as a single, separate tax parcel. Protects against tax liens on adjacent parcels attaching to the insured property.",

    required: (fields) => fields.multipleParcel === false,
    requiredNote: "Required when property is a single tax parcel. Use ALTA 18.1 if property spans multiple tax parcels.",

    fee: {
      type: "flat",
      tier: 1,
      calculate: () => 25,
      displayLabel: "ALTA 18 (Single Tax Parcel)",
      feeSource: "Tier 1 — public record search-based. Market range: $25–$50.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 18.1 | MULTIPLE TAX PARCELS
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-18.1",
    name: "Multiple Tax Parcels",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 18.1",
    shortDescription: "Required when the property spans more than one tax parcel number.",
    fullDescription:
      "Required when the mortgaged property consists of more than one separately assessed tax parcel. Insures the lender that all parcel assessments are current and the lien attaches to all parcels.",

    required: (fields) => fields.multipleParcel === true,
    requiredNote: "Required when the property spans more than one tax parcel number.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 18.1 (Multiple Tax Parcels)",
      feeSource: "Tier 2 — more underwriting required for multi-parcel properties. Market range: $50–$100.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 35 | MINERALS AND SUBSURFACE SUBSTANCES (LENDER — UNIMPROVED)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-35",
    name: "Minerals and Subsurface Substances (Unimproved)",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 35",
    shortDescription: "Covers loss from mineral/subsurface extraction causing damage to unimproved land.",
    fullDescription:
      "Provides coverage for loss caused by mineral or subsurface substance extraction damaging the surface of unimproved land. For improved land use ALTA 35.1. The ALTA equivalent of Texas T-19.2.",

    required: (fields) => fields.mineralRiskArea === true && fields.isImprovedLand === false,
    requiredNote: "Required when unimproved property is in a mineral-active area.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 35 (Minerals — Unimproved)",
      feeSource: "Tier 2 — mineral rights research required. Market range: $50–$100.",
      flagForConfirmation: false,
    },
  },


  // ---------------------------------------------------------------------------
  // ALTA 35.1 | MINERALS AND SUBSURFACE SUBSTANCES (LENDER — IMPROVED)
  // ---------------------------------------------------------------------------
  {
    code: "ALTA-35.1",
    name: "Minerals and Subsurface Substances (Improved — Buildings)",
    appliesTo: "lender",
    altaForm: "ALTA Endorsement Form 35.1",
    shortDescription: "Covers loss from mineral/subsurface extraction causing damage to existing buildings and improvements.",
    fullDescription:
      "Covers damage caused by mineral or subsurface extraction to existing buildings and improvements on the property. The most relevant mineral endorsement for standard improved residential property in mineral-active areas.",

    required: (fields) => fields.mineralRiskArea === true && fields.isImprovedLand === true,
    requiredNote: "Required when improved property is in a mineral-active area.",

    fee: {
      type: "flat",
      tier: 2,
      calculate: () => 50,
      displayLabel: "ALTA 35.1 (Minerals — Improved/Buildings)",
      feeSource: "Same tier as ALTA 35. Market range: $50–$100.",
      flagForConfirmation: false,
    },
  },


]; // end altaEndorsements array


// =============================================================================
// RULES ENGINE HELPERS
// =============================================================================

export function getAltaEndorsements(fields) {
  return altaEndorsements
    .filter((e) => e.required(fields))
    .map((e) => ({
      ...e,
      resolvedFee: e.fee.calculate(fields),
    }));
}

export function getTotalAltaEndorsementFees(fields) {
  return getAltaEndorsements(fields).reduce(
    (sum, e) => sum + e.resolvedFee,
    0
  );
}

// Only leasehold endorsements remain flagged — everything else
// is calibrated from published industry data.
export function getUnconfirmedAltaFees(fields) {
  return getAltaEndorsements(fields)
    .filter((e) => e.fee.flagForConfirmation === true)
    .map((e) => ({
      code: e.code,
      name: e.name,
      flagNote: e.fee.flagNote,
    }));
}


// =============================================================================
// MUTUAL EXCLUSIONS
// =============================================================================

export const altaMutualExclusions = [
  {
    group: ["ALTA-6", "ALTA-6.2"],
    reason: "ALTA 6 and ALTA 6.2 are mutually exclusive. Only one ARM endorsement per transaction.",
  },
  {
    group: ["ALTA-9", "ALTA-9.3"],
    reason: "ALTA 9 (unimproved) and ALTA 9.3 (improved) are mutually exclusive for the lender's policy.",
  },
  {
    group: ["ALTA-9.1", "ALTA-9.2"],
    reason: "ALTA 9.1 (unimproved) and ALTA 9.2 (improved) are mutually exclusive for the owner's policy.",
  },
  {
    group: ["ALTA-18", "ALTA-18.1"],
    reason: "ALTA 18 (single parcel) and ALTA 18.1 (multiple parcels) are mutually exclusive.",
  },
  {
    group: ["ALTA-35", "ALTA-35.1"],
    reason: "ALTA 35 (unimproved) and ALTA 35.1 (improved) are mutually exclusive.",
  },
];


// =============================================================================
// ALWAYS-PAIRED ENDORSEMENTS
// =============================================================================

export const altaAlwaysPaired = [
  { pair: ["ALTA-14", "ALTA-14.1"], reason: "Always issued together on future advance transactions." },
  { pair: ["ALTA-4", "ALTA-4.1"], reason: "Typically issued together on condo purchases." },
  { pair: ["ALTA-5", "ALTA-5.1"], reason: "Typically issued together on PUD purchases." },
  { pair: ["ALTA-7", "ALTA-7.1"], reason: "Typically issued together on manufactured home purchases." },
  { pair: ["ALTA-13", "ALTA-13.1"], reason: "Typically issued together on leasehold purchases." },
];


// =============================================================================
// STATE REGULATION REFERENCE
// =============================================================================
// Code: surface a UI note when the selected state has known fee structures
// that differ materially from the estimates above.

export const stateRegulationNotes = {
  TX: "Fully promulgated — use texasTitleEndorsements.js instead.",
  FL: "Promulgated rate state — endorsements range from $25 to 10% of policy premium. Use stateOverrides.js.",
  NM: "Promulgated rate state — use stateOverrides.js for accurate NM fees.",
  NY: "TIRSA Rate Manual (7th Revision, Oct 2024). Complex endorsement structure. Use stateOverrides.js.",
  NJ: "Regulated rate manual. Use stateOverrides.js.",
  OH: "Ohio OTIRB publishes rates. ALTA 9 variants = $75 flat. Estimates in this file are calibrated to OH published rates and are the most accurate for OH.",
  PA: "TIRBOP rate manual. Expanded Coverage Residential Loan Policy bundles ALTA 4.1, 5.1, 6, 6.2, 8.1, and 9.10 into a flat $400 package — those endorsements may be $0 individually on qualifying loans.",
  KS: "Standard endorsements (ALTA 4, 5, 6, 6.2, 7, 8.1, 9, 14.3, 22, 28) issued at no additional charge on centralized refinance rate loans per Kansas rate manual.",
  CA: "File-and-use state. CLTA endorsements used alongside ALTA forms. Fees vary by underwriter — typically $50–$150/endorsement. stateOverrides.js will address CA-specific CLTA equivalents.",
};


// =============================================================================
// NOTES FOR CODE — READ BEFORE BUILDING
// =============================================================================
//
// 1. FEE CONFIDENCE: All fees except leasehold (ALTA 13/13.1) are calibrated
//    from published state rate manuals and national industry data. They are
//    appropriate for a calculator/estimator tool but should NOT be presented
//    as guaranteed exact fees on a Closing Disclosure.
//
// 2. BUNDLED STATES: PA and KS may bundle multiple standard endorsements into
//    the base policy at no extra charge on certain loan types. Consider adding
//    a UI note: "Fees may vary — some lenders include these at no extra charge."
//
// 3. STATE ROUTING: Use stateRegulationNotes to show a warning in the UI when
//    the selected state has a significantly different fee structure. The
//    stateConfig.js router (Step 3) handles directing to the right file.
//
// 4. IMPROVED vs UNIMPROVED: isImprovedLand drives ALTA 9/9.3 and 35/35.1.
//    In practice, 95%+ of residential transactions involve improved land.
//    Ask Mark if this field needs to be added to the UI.
//
// 5. NY / NJ / FL: Do NOT use this file alone for those states.
//    Mark will be reminded about stateOverrides.js after Step 4 is complete.
//
// =============================================================================
