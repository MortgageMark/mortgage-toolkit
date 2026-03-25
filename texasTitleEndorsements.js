// =============================================================================
// TEXAS TITLE ENDORSEMENTS — RULES ENGINE SPEC
// Mortgage Toolkit | Mortgage Mark / CMG Home Loans
// =============================================================================
//
// HOW TO USE THIS FILE:
// This file defines all Texas residential title endorsements including:
//   - When each endorsement is required (logic rules)
//   - How to calculate each fee
//   - What fields are needed from the UI
//
// IMPORTANT NOTES FOR CODE:
// - All fees marked with ⚠️ FLAG need to be confirmed with Mark before hardcoding.
//   Prompt Mark: "I need to confirm the fee for [endorsement]. What do you charge?"
// - All fields referenced below assume they already exist in the Toolkit.
//   If a field is missing or named differently, prompt Mark before proceeding.
// - Texas title insurance rates are promulgated by TDI (Texas Dept of Insurance).
//   Base policy premiums are calculated separately. This file covers ENDORSEMENTS only.
// - "Required" = must be included. "Available" = only show if triggered.
//   "Never" = do not show for this scenario.
//
// FIELDS THIS FILE EXPECTS TO EXIST (prompt Mark if any are missing or named differently):
//   - loanAmount          (number)
//   - purchasePrice       (number)
//   - loanType            (string): "conventional" | "fha" | "va" | "usda" | "homeEquity" | "heloc" | "reverse" | "construction"
//   - propertyType        (string): "singleFamily" | "condo" | "pud" | "manufactured" | "multiFamily"
//   - surveyProvided      (boolean): true if a current survey OR existing survey + T-47 affidavit is available
//   - rateType            (string): "fixed" | "arm"
//   - hasNegativeAmort    (boolean): true if ARM has negative amortization feature
//   - hasBalloon          (boolean): true if loan has balloon payment
//   - hasFutureAdvances   (boolean): true if loan involves future advances (HELOC, construction)
//   - isRefinance         (boolean): true if refi, false if purchase
//   - mineralRiskArea     (boolean): true if property is in an area with active oil/gas/mineral activity
//   - nearIndustrialZone  (boolean): true if lender requires environmental lien coverage
//   - lenderPolicyPremium (number): calculated base lender policy premium (used for T-23 calc)
//   - ownerPolicyPremium  (number): calculated base owner policy premium (used for T-23 calc)
//
// =============================================================================


export const texasTitleEndorsements = [


  // ---------------------------------------------------------------------------
  // T-19 | RESTRICTIONS, ENCROACHMENTS, MINERALS (LENDER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "T-19",
    name: "Restrictions, Encroachments, Minerals",
    appliesTo: "lender",
    shortDescription: "Protects lender against loss from deed restriction violations and encroachments onto easements or adjoining land.",
    fullDescription:
      "Insures the lender against loss resulting from: (1) violations of deed restrictions, (2) encroachments of improvements onto easements or adjoining land, and (3) damage from the extraction of minerals. One of the most common endorsements in Texas residential transactions.",

    // WHEN REQUIRED:
    // Required on virtually all residential transactions with a lender's policy.
    // The only exception is if the lender explicitly waives it (rare).
    required: (fields) => {
      // Required whenever a lender's policy is being issued
      return fields.loanType !== null; // any loan = lender's policy = T-19 required
    },
    requiredNote: "Required on all transactions with a lender's policy.",

    // FEE:
    // Flat fee — promulgated by TDI.
    // ⚠️ FLAG: Confirm exact current promulgated rate with Mark. Commonly $50.
    fee: {
      type: "flat",
      calculate: () => 50,
      displayLabel: "T-19 (Lender)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-19 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-19.1 | RESTRICTIONS, ENCROACHMENTS, MINERALS (OWNER'S POLICY)
  // ---------------------------------------------------------------------------
  {
    code: "T-19.1",
    name: "Restrictions, Encroachments, Minerals (Owner's)",
    appliesTo: "owner",
    shortDescription: "Same protections as T-19 but for the homebuyer's owner's policy.",
    fullDescription:
      "The owner's policy equivalent of the T-19. Protects the buyer/owner against loss from deed restriction violations, encroachments, and mineral extraction damage. Typically issued simultaneously with the T-19 on purchase transactions.",

    // WHEN REQUIRED:
    // Required on all purchase transactions where an owner's policy is issued.
    // Not applicable on refinances (no owner's policy issued on refis).
    required: (fields) => {
      return fields.isRefinance === false; // purchases only
    },
    requiredNote: "Required on all purchase transactions. Not applicable on refinances.",

    fee: {
      type: "flat",
      calculate: () => 50,
      displayLabel: "T-19.1 (Owner's)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-19.1 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-19.2 | MINERALS AND SURFACE DAMAGE
  // ---------------------------------------------------------------------------
  {
    code: "T-19.2",
    name: "Minerals and Surface Damage",
    appliesTo: "both",
    shortDescription: "Covers loss from mineral extraction causing damage to the surface or existing improvements.",
    fullDescription:
      "Extends mineral coverage beyond T-19 to specifically cover physical damage to the land's surface and improvements caused by the extraction or development of mineral rights. Most relevant in areas with active or likely oil, gas, or other mineral activity.",

    // WHEN REQUIRED:
    // Not universally required. Triggered when:
    //   (1) Property is in an area with known mineral activity, OR
    //   (2) Lender specifically requires it, OR
    //   (3) Mineral rights are severed from the surface estate
    // Use the mineralRiskArea field to auto-trigger. Lender may also require it independently.
    required: (fields) => {
      return fields.mineralRiskArea === true;
    },
    requiredNote: "Required when property is in a mineral-active area or lender requires it.",

    fee: {
      type: "flat",
      calculate: () => 50,
      displayLabel: "T-19.2 (Minerals)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-19.2 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-23 | SURVEY DELETION
  // ---------------------------------------------------------------------------
  {
    code: "T-23",
    name: "Survey Deletion",
    appliesTo: "both",
    shortDescription: "Removes the survey exception from the title policy, insuring matters that an accurate survey would reveal.",
    fullDescription:
      "Deletes the standard survey exception from both the lender's and owner's policies, meaning the title company accepts the risk of survey-related issues rather than excluding them. Required by most lenders. Can be issued when: (1) a new survey is provided, or (2) an existing survey is provided along with a signed T-47 Affidavit (seller or borrower swears no changes since survey date).",

    // WHEN REQUIRED:
    // Required by most lenders when a survey is available.
    // Triggered when surveyProvided = true.
    // Note: A T-47 affidavit must accompany an existing (not new) survey.
    required: (fields) => {
      return fields.surveyProvided === true;
    },
    requiredNote: "Required when a current survey or existing survey + T-47 affidavit is provided. Most lenders require this.",

    // FEE:
    // Calculated as a percentage of the BASE POLICY PREMIUM (lender + owner combined or separately).
    // ⚠️ FLAG: The TDI-promulgated rate for survey deletion is typically calculated as a
    // percentage of each policy's premium. Confirm the exact percentage with Mark.
    // Common structure: ~5% of each policy premium, with a minimum floor.
    fee: {
      type: "calculated",
      calculate: (fields) => {
        const lenderPortion = fields.lenderPolicyPremium * 0.05;
        const ownerPortion = fields.isRefinance ? 0 : fields.ownerPolicyPremium * 0.05;
        return lenderPortion + ownerPortion;
      },
      displayLabel: "T-23 Survey Deletion",
      flagForConfirmation: true,
      flagNote: "Confirm the percentage used to calculate T-23 fee and any minimum floor amount with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-25 | PLANNED UNIT DEVELOPMENT (PUD)
  // ---------------------------------------------------------------------------
  {
    code: "T-25",
    name: "Planned Unit Development (PUD)",
    appliesTo: "lender",
    shortDescription: "Protects lender from HOA provisions in a PUD that could cause forfeiture or reversion of title.",
    fullDescription:
      "Required when the property is part of a Planned Unit Development. Insures the lender that the HOA's CC&Rs, bylaws, or other governing documents do not contain provisions that would cause a forfeiture of title, reversion, or loss of lender's priority if assessments go unpaid or HOA rules are violated.",

    // WHEN REQUIRED:
    // Required when propertyType = "pud"
    required: (fields) => {
      return fields.propertyType === "pud";
    },
    requiredNote: "Required on all PUD transactions.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-25 (PUD)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-25 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-26 | CONDOMINIUM
  // ---------------------------------------------------------------------------
  {
    code: "T-26",
    name: "Condominium",
    appliesTo: "lender",
    shortDescription: "Protects lender from issues with the condo declaration, bylaws, or map including unpaid assessment liens.",
    fullDescription:
      "Required on all condominium transactions. Insures the lender against loss from defects in the condo declaration, bylaws, plat/map, or other condo governing documents. Also covers mechanics liens arising from unpaid HOA assessments that could affect the lender's lien priority.",

    // WHEN REQUIRED:
    // Required when propertyType = "condo"
    required: (fields) => {
      return fields.propertyType === "condo";
    },
    requiredNote: "Required on all condominium transactions.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-26 (Condo)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-26 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-28 | ENVIRONMENTAL PROTECTION LIEN
  // ---------------------------------------------------------------------------
  {
    code: "T-28",
    name: "Environmental Protection Lien",
    appliesTo: "lender",
    shortDescription: "Protects lender against federal or state environmental liens that could take priority over the insured mortgage.",
    fullDescription:
      "Insures the lender that no federal or state environmental protection liens (such as EPA Superfund liens) have been filed or recorded that would take priority over the insured mortgage. Increasingly required by lenders, particularly on properties near or in areas with prior industrial, commercial, or agricultural use.",

    // WHEN REQUIRED:
    // Not universally required. Triggered when:
    //   (1) nearIndustrialZone = true, OR
    //   (2) Lender specifically requires it (some lenders require on all transactions)
    required: (fields) => {
      return fields.nearIndustrialZone === true;
    },
    requiredNote: "Required when property is near industrial/commercial zones or when lender requires it on all loans.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-28 (Environmental)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-28 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-30 | MANUFACTURED HOUSING
  // ---------------------------------------------------------------------------
  {
    code: "T-30",
    name: "Manufactured Housing",
    appliesTo: "both",
    shortDescription: "Required when the home is a manufactured/mobile home that has been affixed to land and retired as personal property.",
    fullDescription:
      "Required when the subject property is a manufactured or mobile home. Insures that the unit has been properly affixed to the real property and that the certificate of title has been properly cancelled/retired with the Texas DMV so that the home is legally treated as real property (not personal property). Without this, the lender's lien on the structure could be invalid.",

    // WHEN REQUIRED:
    // Required when propertyType = "manufactured"
    required: (fields) => {
      return fields.propertyType === "manufactured";
    },
    requiredNote: "Required on all manufactured/mobile home transactions.",

    fee: {
      type: "flat",
      calculate: () => 50,
      displayLabel: "T-30 (Manufactured Home)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-30 and whether it differs for lender vs. owner policy with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-36 | VARIABLE RATE MORTGAGE (ALTA 6)
  // ---------------------------------------------------------------------------
  {
    code: "T-36",
    name: "Variable Rate Mortgage",
    appliesTo: "lender",
    shortDescription: "Insures that the lender's lien remains valid as interest rate and payments change on an ARM loan.",
    fullDescription:
      "Required when the loan is an adjustable-rate mortgage (ARM). Insures the lender that the validity and priority of the mortgage lien are not affected by changes in the interest rate, payment amounts, or loan balance over the life of the loan. Without this, rate changes could theoretically create lien enforceability questions.",

    // WHEN REQUIRED:
    // Required when rateType = "arm" AND hasNegativeAmort = false
    // (If negative amort, use T-37 instead)
    required: (fields) => {
      return fields.rateType === "arm" && fields.hasNegativeAmort === false;
    },
    requiredNote: "Required on all ARM loans without negative amortization. Use T-37 instead if loan has negative amortization feature.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-36 (Variable Rate)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-36 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-37 | VARIABLE RATE MORTGAGE — NEGATIVE AMORTIZATION (ALTA 6.2)
  // ---------------------------------------------------------------------------
  {
    code: "T-37",
    name: "Variable Rate — Negative Amortization",
    appliesTo: "lender",
    shortDescription: "Covers ARMs where the loan balance can increase (negative amortization), insuring lien validity as balance grows.",
    fullDescription:
      "Similar to T-36 but specifically designed for ARM products with a negative amortization feature — meaning the loan balance can increase over time if payments don't cover accruing interest. Insures the lender that the lien remains valid and enforceable as the outstanding balance grows beyond the original loan amount.",

    // WHEN REQUIRED:
    // Required when rateType = "arm" AND hasNegativeAmort = true
    // Replaces T-36 — do not issue both
    required: (fields) => {
      return fields.rateType === "arm" && fields.hasNegativeAmort === true;
    },
    requiredNote: "Required on ARM loans with negative amortization. Replaces T-36 — do not issue both.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-37 (Neg. Amort ARM)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-37 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-38 | BALLOON MORTGAGE
  // ---------------------------------------------------------------------------
  {
    code: "T-38",
    name: "Balloon Mortgage",
    appliesTo: "lender",
    shortDescription: "Insures the lender's lien remains valid through the balloon maturity date.",
    fullDescription:
      "Required when the loan has a balloon payment feature — meaning the full remaining balance is due at a set date before the loan is fully amortized. Insures that the lender's lien remains valid and enforceable through the balloon maturity date and that the balloon payment provision does not affect lien priority.",

    // WHEN REQUIRED:
    // Required when hasBalloon = true
    required: (fields) => {
      return fields.hasBalloon === true;
    },
    requiredNote: "Required on all loans with a balloon payment feature.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-38 (Balloon)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-38 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-42 | EQUITY LOAN MORTGAGE ENDORSEMENT
  // ---------------------------------------------------------------------------
  {
    code: "T-42",
    name: "Equity Loan Mortgage",
    appliesTo: "lender",
    shortDescription: "Required on all Texas Home Equity Loans (50a6). Protects lender if the lien is challenged due to Texas constitutional violations.",
    fullDescription:
      "Required on ALL Texas Home Equity Loans (Section 50(a)(6) of the Texas Constitution). Texas has strict constitutional requirements governing home equity lending — loan-to-value limits, fee caps, waiting periods, right of rescission, etc. This endorsement insures the lender against loss if the lien is found invalid or unenforceable because one of those constitutional requirements was violated.",

    // WHEN REQUIRED:
    // Required when loanType = "homeEquity"
    // Also required on HELOCs in some forms — confirm with Mark
    required: (fields) => {
      return fields.loanType === "homeEquity";
    },
    requiredNote: "Required on ALL Texas Home Equity (50a6) transactions. One of the most critical endorsements in Texas.",

    // FEE:
    // CONFIRMED: 10% of the Basic Premium Rate for the mortgagee (lender) policy.
    // Source: TDI promulgated rate — confirmed by Mark.
    fee: {
      type: "calculated",
      calculate: (fields) => fields.lenderPolicyPremium * 0.10,
      displayLabel: "T-42 (Home Equity)",
      flagForConfirmation: false,
      flagNote: "10% of mortgagee policy Basic Premium Rate — TDI promulgated, confirmed.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-42.1 | EQUITY LOAN MORTGAGE (SUPPLEMENTAL)
  // ---------------------------------------------------------------------------
  {
    code: "T-42.1",
    name: "Equity Loan Mortgage (Supplemental)",
    appliesTo: "lender",
    shortDescription: "Supplements the T-42 with expanded coverage for constitutional compliance issues including future advances.",
    fullDescription:
      "Issued alongside the T-42 to provide supplemental/expanded coverage for Texas Home Equity loans. Specifically addresses additional constitutional compliance scenarios not fully covered by T-42, including provisions related to future advances and ongoing compliance with the 50(a)(6) requirements throughout the life of the loan.",

    // WHEN REQUIRED:
    // Always issued together with T-42. Required whenever T-42 is required.
    required: (fields) => {
      return fields.loanType === "homeEquity";
    },
    requiredNote: "Always issued alongside T-42. Required on all Home Equity (50a6) transactions.",

    // FEE:
    // CONFIRMED: 15% of the Basic Premium Rate for the mortgagee (lender) policy.
    // Source: TDI promulgated rate — confirmed by Mark.
    fee: {
      type: "calculated",
      calculate: (fields) => fields.lenderPolicyPremium * 0.15,
      displayLabel: "T-42.1 (Home Equity Supp.)",
      flagForConfirmation: false,
      flagNote: "15% of mortgagee policy Basic Premium Rate — TDI promulgated, confirmed.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-43 | TEXAS REVERSE MORTGAGE
  // ---------------------------------------------------------------------------
  {
    code: "T-43",
    name: "Texas Reverse Mortgage",
    appliesTo: "lender",
    shortDescription: "Required on all Texas reverse mortgage transactions. Insures lien validity under Texas reverse mortgage law.",
    fullDescription:
      "Required on all Texas reverse mortgage transactions. Texas has specific constitutional and statutory requirements for reverse mortgages (Section 50(k)-(p) of the Texas Constitution). This endorsement insures the lender that the reverse mortgage lien is valid and enforceable under applicable Texas law and that constitutional requirements were properly met.",

    // WHEN REQUIRED:
    // Required when loanType = "reverse"
    required: (fields) => {
      return fields.loanType === "reverse";
    },
    requiredNote: "Required on ALL Texas reverse mortgage transactions.",

    fee: {
      type: "flat",
      calculate: () => 50,
      displayLabel: "T-43 (Reverse Mortgage)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-43 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-44 | FUTURE ADVANCE — PRIORITY
  // ---------------------------------------------------------------------------
  {
    code: "T-44",
    name: "Future Advance — Priority",
    appliesTo: "lender",
    shortDescription: "Protects the lender's lien priority for future advances (draws) on HELOCs and construction loans.",
    fullDescription:
      "Used when a loan involves future advances — meaning the lender will disburse funds over time rather than in a single lump sum (e.g., HELOCs, construction loans, draw loans). Insures that each future advance maintains the same lien priority as the original loan, protecting the lender against intervening liens that are filed between the original closing and any subsequent advance.",

    // WHEN REQUIRED:
    // Required when hasFutureAdvances = true (HELOCs, construction loans, draw loans)
    required: (fields) => {
      return (
        fields.hasFutureAdvances === true ||
        fields.loanType === "heloc" ||
        fields.loanType === "construction"
      );
    },
    requiredNote: "Required on HELOCs, construction loans, and any loan with future advance provisions.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-44 (Future Advance — Priority)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-44 with Mark.",
    },
  },


  // ---------------------------------------------------------------------------
  // T-45 | FUTURE ADVANCE — KNOWLEDGE
  // ---------------------------------------------------------------------------
  {
    code: "T-45",
    name: "Future Advance — Knowledge",
    appliesTo: "lender",
    shortDescription: "Companion to T-44. Protects lender's advance priority even when lender has actual knowledge of an intervening lien.",
    fullDescription:
      "A companion endorsement to T-44. While T-44 protects lender priority generally, T-45 specifically addresses the scenario where the lender has actual knowledge of an intervening lien at the time of a future advance. Without T-45, that knowledge could potentially defeat the lender's priority claim for that advance. Issued together with T-44 on all future advance transactions.",

    // WHEN REQUIRED:
    // Always issued with T-44. Required whenever T-44 is required.
    required: (fields) => {
      return (
        fields.hasFutureAdvances === true ||
        fields.loanType === "heloc" ||
        fields.loanType === "construction"
      );
    },
    requiredNote: "Always issued alongside T-44. Required on all future advance transactions.",

    fee: {
      type: "flat",
      calculate: () => 25,
      displayLabel: "T-45 (Future Advance — Knowledge)",
      flagForConfirmation: true,
      flagNote: "Confirm current TDI promulgated rate for T-45 with Mark.",
    },
  },


]; // end texasTitleEndorsements array


// =============================================================================
// RULES ENGINE HELPER FUNCTION
// =============================================================================
// Call this with the current fields object to get back only the endorsements
// that apply to this transaction.
//
// Usage: const applicable = getApplicableEndorsements(fields);
//
// Returns an array of endorsement objects with a resolved fee amount added.

export function getApplicableEndorsements(fields) {
  return texasTitleEndorsements
    .filter((e) => e.required(fields))
    .map((e) => ({
      ...e,
      resolvedFee: e.fee.calculate(fields),
    }));
}


// =============================================================================
// TOTAL FEE CALCULATOR
// =============================================================================
// Returns the total of all applicable endorsement fees for a given transaction.
//
// Usage: const total = getTotalEndorsementFees(fields);

export function getTotalEndorsementFees(fields) {
  return getApplicableEndorsements(fields).reduce(
    (sum, e) => sum + e.resolvedFee,
    0
  );
}


// =============================================================================
// FLAGS CHECKER
// =============================================================================
// Returns a list of all endorsements that have unconfirmed fees.
// Code should surface these to Mark during QA/review before going live.
//
// Usage: const flags = getUnconfirmedFees(fields);

export function getUnconfirmedFees(fields) {
  return getApplicableEndorsements(fields)
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
// These endorsements should NEVER appear together.
// Code should enforce these rules and surface a warning if both are triggered.

export const mutualExclusions = [
  {
    group: ["T-36", "T-37"],
    reason: "T-36 and T-37 are mutually exclusive. T-36 is for standard ARMs; T-37 is for negative amortization ARMs. Only one should ever be issued.",
  },
];


// =============================================================================
// ALWAYS-PAIRED ENDORSEMENTS
// =============================================================================
// These endorsements should always appear together.
// Code should enforce these rules and warn if one is present without the other.

export const alwaysPaired = [
  {
    pair: ["T-42", "T-42.1"],
    reason: "T-42 and T-42.1 are always issued together on Home Equity (50a6) transactions.",
  },
  {
    pair: ["T-44", "T-45"],
    reason: "T-44 and T-45 are always issued together on future advance transactions.",
  },
];


// =============================================================================
// T-47 AFFIDAVIT REMINDER
// =============================================================================
// Not an endorsement, but a required companion document when an existing
// (non-new) survey is used with the T-23 Survey Deletion.
// Code should surface this reminder when surveyProvided = true AND
// the survey is not a newly commissioned survey.

export const t47AffidavitNote = {
  code: "T-47",
  name: "Survey Affidavit",
  type: "affidavit",
  description:
    "Not an endorsement — a required sworn affidavit from the seller or borrower confirming that no improvements, encroachments, or changes have occurred since the survey date. Required when an existing survey (not a new one) is being used to satisfy the T-23 Survey Deletion requirement.",
  requiredWith: "T-23 (when using an existing survey)",
  fee: {
    type: "none",
    note: "No separate fee — included in closing. Confirm with Mark if a doc prep fee applies.",
  },
};


// =============================================================================
// NOTES FOR CODE — READ BEFORE BUILDING
// =============================================================================
//
// 1. MISSING FIELDS: If any field referenced in the required() functions above
//    doesn't exist in the Toolkit yet, stop and ask Mark what the field is named
//    or whether it needs to be added.
//
// 2. FEE CONFIRMATION: Before going live, run getUnconfirmedFees() and show
//    Mark the list. He needs to confirm or correct each flagged fee amount.
//    Do not hardcode fees without his confirmation.
//
// 3. T-42 FEE: This one is highest priority to confirm. The placeholder formula
//    (loanAmount * 0.001) is a guess. Replace it with the correct formula
//    once Mark confirms.
//
// 4. T-23 FEE: The 5% of premium calculation is an estimate. Mark may use a
//    different percentage or a flat fee schedule. Confirm before using.
//
// 5. DISPLAY: Consider showing endorsements in two groups in the UI:
//    "Auto-Added" (required by rule) and "Manually Added" (optional/lender-specific).
//
// 6. LENDER OVERRIDES: Some lenders require endorsements beyond the defaults
//    (e.g., T-28 on all transactions). Consider adding a lender-specific
//    override layer if needed. Ask Mark if this is a priority.
//
// 7. OWNER vs LENDER: The "appliesTo" field is "lender", "owner", or "both".
//    Use this to display endorsements under the correct policy section in the UI.
//
// =============================================================================
