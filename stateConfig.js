// =============================================================================
// STATE CONFIG — TITLE ENDORSEMENT ROUTER
// Mortgage Toolkit | Mortgage Mark / CMG Home Loans
// Step 3 of 4 in the Title Endorsements Architecture
// =============================================================================
//
// PURPOSE:
// This file is the traffic cop. For any transaction, it determines:
//   1. Which endorsement file to use (TX vs. ALTA)
//   2. Whether any state-specific overrides apply on top
//   3. What UI warnings or notes to surface for the selected state
//
// HOW TO USE:
//   import { getEndorsementsForState, getStateConfig } from './stateConfig';
//
//   const endorsements = getEndorsementsForState(state, fields);
//   const config = getStateConfig(state);
//
// ARCHITECTURE OVERVIEW:
//
//   ┌─────────────────────────────────────────────────────────┐
//   │                   stateConfig.js                        │
//   │                   (this file)                           │
//   └────────────────────┬────────────────────────────────────┘
//                        │
//          ┌─────────────┴─────────────┐
//          ▼                           ▼
//   state === "TX"            all other states
//          │                           │
//          ▼                           ▼
//   texasTitleEndorsements.js    altaEndorsements.js
//                                      │
//                              + stateOverrides.js  ← Step 4
//                                (NY, FL, NJ, NM, CA)
//
// =============================================================================


import {
  getApplicableEndorsements,
  getTotalEndorsementFees,
  texasTitleEndorsements,
} from './texasTitleEndorsements.js';

import {
  getAltaEndorsements,
  getTotalAltaEndorsementFees,
  altaMutualExclusions,
  altaAlwaysPaired,
} from './altaEndorsements.js';

// Step 4 import — activated:
import { applyStateOverrides, hasOverrides } from './stateOverrides.js';


// =============================================================================
// STATE CLASSIFICATION MAP
// =============================================================================
// Every U.S. state and DC, classified by their title insurance rate system.
// This drives routing logic and UI warnings throughout the Toolkit.
//
// CATEGORIES:
//   "promulgated"  → State sets all rates by law. No shopping. TX, FL, NM only.
//   "bureau"       → Rates set by a state rating bureau (file-and-use or prior approval).
//                    Fees are more standardized than free states but not fully locked.
//   "file-and-use" → Insurers set rates and file with the state. Rates vary by company.
//   "use-and-file" → Insurers use rates immediately, file after. Similar to file-and-use.
//   "unregulated"  → No filing required. Fully competitive. Fees vary widely.
//
// OVERRIDE STATES: States that require stateOverrides.js due to unique
//   endorsement forms, rate structures, or significant fee deviations.

export const stateClassifications = {
  AL: { name: "Alabama",        system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  AK: { name: "Alaska",         system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  AZ: { name: "Arizona",        system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  AR: { name: "Arkansas",       system: "unregulated",   needsOverride: false, altaAvailable: true  },
  CA: { name: "California",     system: "file-and-use",  needsOverride: true,  altaAvailable: true,
        overrideNote: "CA uses CLTA endorsements alongside ALTA forms. Fees vary by underwriter ($50–$150). stateOverrides.js will add CLTA equivalents." },
  CO: { name: "Colorado",       system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  CT: { name: "Connecticut",    system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  DE: { name: "Delaware",       system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  DC: { name: "Washington D.C.", system: "file-and-use", needsOverride: false, altaAvailable: true  },
  FL: { name: "Florida",        system: "promulgated",   needsOverride: true,  altaAvailable: true,
        overrideNote: "FL is a promulgated rate state. Endorsement fees range from $25 to 10% of policy premium per FL Office of Insurance Regulation. Use stateOverrides.js for accurate FL fees." },
  GA: { name: "Georgia",        system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  HI: { name: "Hawaii",         system: "unregulated",   needsOverride: false, altaAvailable: true,
        noteForUI: "HI has a high prevalence of leasehold properties. ALTA 13/13.1 may be needed more frequently here." },
  ID: { name: "Idaho",          system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  IL: { name: "Illinois",       system: "unregulated",   needsOverride: false, altaAvailable: true  },
  IN: { name: "Indiana",        system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  IA: { name: "Iowa",           system: "unregulated",   needsOverride: false, altaAvailable: false,
        noteForUI: "Iowa is the only state where title insurance is provided by a state-run agency (Iowa Finance Authority), not private companies. ALTA endorsements may not apply. Prompt Mark before processing an Iowa transaction." },
  KS: { name: "Kansas",         system: "file-and-use",  needsOverride: false, altaAvailable: true,
        noteForUI: "KS: Standard endorsements (ALTA 4, 5, 6, 6.2, 7, 8.1, 9, 14.3) are issued at no additional charge on centralized refinance rate loans." },
  KY: { name: "Kentucky",       system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  LA: { name: "Louisiana",      system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  ME: { name: "Maine",          system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  MD: { name: "Maryland",       system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  MA: { name: "Massachusetts",  system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  MI: { name: "Michigan",       system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  MN: { name: "Minnesota",      system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  MS: { name: "Mississippi",    system: "unregulated",   needsOverride: false, altaAvailable: true  },
  MO: { name: "Missouri",       system: "unregulated",   needsOverride: false, altaAvailable: true,
        noteForUI: "MO has the lowest average title insurance costs in the country. Endorsement fees may be lower than national estimates." },
  MT: { name: "Montana",        system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  NE: { name: "Nebraska",       system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  NV: { name: "Nevada",         system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  NH: { name: "New Hampshire",  system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  NJ: { name: "New Jersey",     system: "bureau",        needsOverride: true,  altaAvailable: true,
        overrideNote: "NJ has a regulated rate manual (NJ Land Title Association). Endorsement fees are standardized but differ from ALTA estimates. Use stateOverrides.js." },
  NM: { name: "New Mexico",     system: "promulgated",   needsOverride: true,  altaAvailable: true,
        overrideNote: "NM is a promulgated rate state. All title insurance rates set by state law. Use stateOverrides.js for accurate NM endorsement fees." },
  NY: { name: "New York",       system: "bureau",        needsOverride: true,  altaAvailable: true,
        overrideNote: "NY uses the TIRSA Rate Manual (7th Revision, effective Oct 2024). Complex endorsement structure. 12 previous TIRSA endorsements replaced with 15 ALTA equivalents. Use stateOverrides.js." },
  NC: { name: "North Carolina", system: "bureau",        needsOverride: false, altaAvailable: true,
        noteForUI: "NC: Only ALTA-promulgated endorsements may be issued on title policies. NC Title Insurance Rating Bureau sets rates with prior-approval process." },
  ND: { name: "North Dakota",   system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  OH: { name: "Ohio",           system: "bureau",        needsOverride: false, altaAvailable: true,
        noteForUI: "OH: Ohio Title Insurance Rating Bureau (OTIRB) publishes rates. ALTA 9 variants = $75 flat. Estimates in altaEndorsements.js are calibrated to OTIRB published rates." },
  OK: { name: "Oklahoma",       system: "unregulated",   needsOverride: false, altaAvailable: true  },
  OR: { name: "Oregon",         system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  PA: { name: "Pennsylvania",   system: "bureau",        needsOverride: false, altaAvailable: true,
        noteForUI: "PA: TIRBOP Expanded Coverage Residential Loan Policy bundles ALTA 4.1, 5.1, 6, 6.2, 8.1, and 9.10 into a flat $400 package. Those endorsements may be $0 individually on qualifying loans." },
  RI: { name: "Rhode Island",   system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  SC: { name: "South Carolina", system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  SD: { name: "South Dakota",   system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  TN: { name: "Tennessee",      system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  TX: { name: "Texas",          system: "promulgated",   needsOverride: false, altaAvailable: false,
        noteForUI: "TX is a fully promulgated rate state. Use texasTitleEndorsements.js — ALTA forms do not apply." },
  UT: { name: "Utah",           system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  VT: { name: "Vermont",        system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  VA: { name: "Virginia",       system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  WA: { name: "Washington",     system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  WV: { name: "West Virginia",  system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  WI: { name: "Wisconsin",      system: "file-and-use",  needsOverride: false, altaAvailable: true  },
  WY: { name: "Wyoming",        system: "file-and-use",  needsOverride: false, altaAvailable: true  },
};


// =============================================================================
// STATES THAT NEED OVERRIDES (Step 4)
// =============================================================================
// These are the states where altaEndorsements.js alone is NOT sufficient.
// stateOverrides.js (Step 4) must be applied on top for accurate results.

export const overrideStates = Object.entries(stateClassifications)
  .filter(([, config]) => config.needsOverride)
  .map(([code]) => code);
// Result: ["CA", "FL", "NJ", "NM", "NY"]


// =============================================================================
// MAIN ROUTER: getStateConfig
// =============================================================================
// Returns the full config object for a given state, including routing
// instructions, UI notes, and whether overrides are needed.
//
// Usage: const config = getStateConfig("TX");

export function getStateConfig(state) {
  const upper = state?.toUpperCase();
  const config = stateClassifications[upper];

  if (!config) {
    return {
      state: upper,
      name: "Unknown State",
      system: "unknown",
      needsOverride: false,
      altaAvailable: true,
      useTxFile: false,
      overrideReady: false,
      noteForUI: `⚠️ State "${upper}" not recognized. Defaulting to ALTA estimates. Ask Mark to verify.`,
    };
  }

  return {
    state: upper,
    ...config,
    useTxFile: upper === "TX",
    // overrideReady will be true once stateOverrides.js is built (Step 4).
    // Until then, override states fall back to ALTA estimates with a UI warning.
    overrideReady: true,
  };
}


// =============================================================================
// MAIN ROUTER: getEndorsementsForState
// =============================================================================
// The single function Code calls to get the correct endorsement list
// for any U.S. state. Returns an array of applicable endorsement objects
// with resolved fees.
//
// Usage:
//   const endorsements = getEndorsementsForState("TX", fields);
//   const endorsements = getEndorsementsForState("OH", fields);
//   const endorsements = getEndorsementsForState("FL", fields); // falls back to ALTA + warning until Step 4

export function getEndorsementsForState(state, fields) {
  const config = getStateConfig(state);

  // ── IOWA SPECIAL CASE ──────────────────────────────────────────────────────
  // Iowa uses a state-run title system, not private title insurance.
  // Return empty array and surface warning. Mark must handle Iowa manually.
  if (state?.toUpperCase() === "IA") {
    return {
      endorsements: [],
      total: 0,
      warnings: [
        "⚠️ Iowa uses a state-run title insurance system (Iowa Finance Authority). " +
        "ALTA endorsements do not apply. This transaction requires manual handling — prompt Mark."
      ],
      stateConfig: config,
    };
  }

  // ── TEXAS ──────────────────────────────────────────────────────────────────
  if (config.useTxFile) {
    const endorsements = getApplicableEndorsements(fields);
    const total = getTotalEndorsementFees(fields);
    return {
      endorsements,
      total,
      warnings: [],
      stateConfig: config,
    };
  }

  // ── ALL OTHER STATES (ALTA base) ───────────────────────────────────────────
  let endorsements = getAltaEndorsements(fields);
  let warnings = [];

  // Surface a warning if this state needs overrides but Step 4 isn't built yet
  if (config.needsOverride && !config.overrideReady) {
    warnings.push(
      `⚠️ ${config.name} (${state.toUpperCase()}) has state-specific endorsement rules that differ from standard ALTA estimates. ` +
      `Fees shown are national averages. ${config.overrideNote || "State overrides are planned for Step 4."}`
    );
  }

  // Surface state-specific informational notes for the UI
  if (config.noteForUI) {
    warnings.push(`ℹ️ ${config.noteForUI}`);
  }

  // ── STEP 4 HOOK ─────────────────────────────────────────────────────────────
  if (config.needsOverride && config.overrideReady && hasOverrides(state)) {
    endorsements = applyStateOverrides(state, endorsements, fields);
  }

  const total = endorsements.reduce((sum, e) => sum + (e.resolvedFee || 0), 0);

  return {
    endorsements,
    total,
    warnings,
    stateConfig: config,
  };
}


// =============================================================================
// TOTAL FEE ROUTER
// =============================================================================
// Convenience function — returns just the total endorsement fee number
// for a given state and transaction.
//
// Usage: const total = getTotalFeesForState("CA", fields);

export function getTotalFeesForState(state, fields) {
  return getEndorsementsForState(state, fields).total;
}


// =============================================================================
// UI HELPERS
// =============================================================================

// Returns true if the selected state needs a user-facing fee accuracy warning.
export function stateNeedsWarning(state) {
  const config = getStateConfig(state);
  return config.needsOverride || config.noteForUI != null;
}

// Returns a sorted array of all 50 states + DC for a dropdown menu.
// Format: [{ code: "AL", name: "Alabama" }, ...]
export function getStateDropdownOptions() {
  return Object.entries(stateClassifications)
    .map(([code, config]) => ({ code, name: config.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Returns a human-readable label for the rate system of a given state.
// Useful for a tooltip or info icon next to the state selector.
export function getRateSystemLabel(state) {
  const systems = {
    "promulgated":  "Promulgated Rate State — all title companies charge the same amount by law.",
    "bureau":       "Rating Bureau State — rates set by a state rating bureau; less variation than free states.",
    "file-and-use": "File-and-Use State — each title company sets its own rates (filed with the state). Shop around.",
    "use-and-file": "Use-and-File State — similar to file-and-use. Rates vary by company.",
    "unregulated":  "Unregulated State — no rate filing required. Fees vary widely. Shop around.",
    "unknown":      "Unknown rate system for this state.",
  };
  const config = getStateConfig(state);
  return systems[config.system] || systems["unknown"];
}


// =============================================================================
// VALIDATION HELPERS
// =============================================================================

// Checks all mutual exclusions for the endorsements returned for a state.
// Returns an array of violations (should be empty on a well-configured transaction).
//
// Usage: const violations = validateExclusions(endorsements, state);
export function validateExclusions(endorsements, state) {
  const violations = [];
  const codes = endorsements.map((e) => e.code);

  // Texas has its own exclusion list
  if (state?.toUpperCase() === "TX") {
    const { mutualExclusions } = require('./texasTitleEndorsements');
    mutualExclusions.forEach(({ group, reason }) => {
      const found = group.filter((code) => codes.includes(code));
      if (found.length > 1) {
        violations.push({ codes: found, reason });
      }
    });
    return violations;
  }

  // ALTA exclusions
  altaMutualExclusions.forEach(({ group, reason }) => {
    const found = group.filter((code) => codes.includes(code));
    if (found.length > 1) {
      violations.push({ codes: found, reason });
    }
  });

  return violations;
}

// Checks always-paired rules and returns missing partners.
// Returns an array of pairing violations.
//
// Usage: const missing = validatePairings(endorsements, state);
export function validatePairings(endorsements, state) {
  const missing = [];
  const codes = endorsements.map((e) => e.code);

  const pairingRules = altaAlwaysPaired; // TX pairings are in texasTitleEndorsements.js

  pairingRules.forEach(({ pair, reason }) => {
    const presentInPair = pair.filter((code) => codes.includes(code));
    if (presentInPair.length === 1) {
      const missingCode = pair.find((code) => !codes.includes(code));
      missing.push({ presentCode: presentInPair[0], missingCode, reason });
    }
  });

  return missing;
}


// =============================================================================
// NOTES FOR CODE — READ BEFORE BUILDING
// =============================================================================
//
// 1. STEP 4 HOOK: The stateOverrides.js import and applyStateOverrides() call
//    are already stubbed out in getEndorsementsForState() — just uncomment
//    those two lines and set overrideReady: true once Step 4 is built.
//
// 2. IOWA: Iowa is the only state where ALTA endorsements don't apply.
//    It has a state-run title system. The router returns an empty array
//    and a warning. If Iowa transactions are expected, Mark needs a
//    separate handling path.
//
// 3. RETURN SHAPE: getEndorsementsForState() always returns:
//    {
//      endorsements: [],   ← array of endorsement objects with resolvedFee
//      total: 0,           ← sum of all resolvedFees
//      warnings: [],       ← array of strings to show in the UI
//      stateConfig: {}     ← full state config object
//    }
//    Code should always destructure this shape, not assume a flat array.
//
// 4. DROPDOWN: Use getStateDropdownOptions() to populate the state selector
//    in the UI. It returns all 50 states + DC, alphabetically sorted.
//
// 5. RATE SYSTEM LABEL: Use getRateSystemLabel(state) to populate a tooltip
//    next to the state selector explaining what kind of rate system applies.
//    This is a great UX touch that helps Mark's team understand accuracy.
//
// 6. VALIDATION: Call validateExclusions() and validatePairings() after
//    building the endorsement list to catch any logic errors before
//    showing the user a fee total.
//
// 7. WARNINGS: Always render the warnings array in the UI — even if it's
//    just a small info banner. These warnings tell the user when estimates
//    are less reliable (NY, FL, NJ, NM, CA) vs. well-calibrated (OH, TX).
//
// 8. REMINDER: NY, FL, NJ, NM, and CA are the override states. Mark will
//    address those in Step 4 (stateOverrides.js).
//
// =============================================================================
