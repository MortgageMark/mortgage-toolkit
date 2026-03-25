// modules/constants.js
// No React or window dependencies needed
// All values copied verbatim from mortgage-toolkit.html
// NOTE: const ROLES and const TABS do not exist in the source file.
//       Role strings are inline magic strings; MODULES (line 6207) contains
//       React component refs and cannot be fully extracted as pure data.

// line 118
const MTK_PREFIX = "mtk_";

// lines 140-143
const CALC_KEY_PREFIXES = [
  "pc_","ra_","fs_","mc_","be_","pq_","fc_","af_","am_","dti_",
  "rvb_","sns_","biw_","cce_","hel_","lpc_","bud_","ohlc_","rw_","fly_","brand_","abt_","wb_","te_",
  "uid"  // scenario unique ID — must be last so "uid" doesn't shadow "uid_*" prefixes
];

// lines 177-185
const CALC_SECTION_NAMES = {
  "pc_": "Purchase Calculator", "ra_": "Rate/APR", "fs_": "Fee Sheet",
  "mc_": "Monthly Cost", "be_": "Break-Even", "pq_": "Pre-Qualification",
  "fc_": "FHA Calculator", "af_": "Affordability", "am_": "Amortization",
  "dti_": "DTI", "rvb_": "Rent vs Buy", "sns_": "Scenario Comparison",
  "biw_": "Bi-Weekly", "cce_": "Closing Cost Est.", "hel_": "HELOC",
  "lpc_": "Loan Product Compare", "bud_": "Budget", "ohlc_": "Overhead",
  "rw_": "Refinance", "fly_": "Flyer", "brand_": "Branding", "abt_": "About",
  "wb_": "Wealth Builder",
  "te_": "Title Endorsements"
};

// line 425
const PMI_FICO_BUCKETS = [760, 740, 720, 700, 680, 660, 640, 620];

// lines 432-462
const PMI_RATES = {
  over20: [
    { ltvMin: 95.01, ltvMax: 97, cov: 35, rates: [0.0057,0.0078,0.0097,0.0117,0.0143,0.0195,0.0213,0.0251] },
    { ltvMin: 95.01, ltvMax: 97, cov: 25, rates: [0.0044,0.0063,0.0077,0.0093,0.0115,0.0152,0.0167,0.0181] },
    { ltvMin: 90.01, ltvMax: 95, cov: 30, rates: [0.0040,0.0057,0.0072,0.0086,0.0107,0.0141,0.0150,0.0162] },
    { ltvMin: 90.01, ltvMax: 95, cov: 25, rates: [0.0037,0.0052,0.0064,0.0075,0.0094,0.0121,0.0128,0.0137] },
    { ltvMin: 85.01, ltvMax: 90, cov: 25, rates: [0.0029,0.0040,0.0049,0.0058,0.0072,0.0098,0.0104,0.0110] },
    { ltvMin: 85.01, ltvMax: 90, cov: 12, rates: [0.0023,0.0030,0.0036,0.0041,0.0050,0.0065,0.0069,0.0077] },
    { ltvMin: 80.01, ltvMax: 85, cov: 12, rates: [0.0019,0.0020,0.0023,0.0027,0.0032,0.0041,0.0043,0.0056] },
    { ltvMin: 80.01, ltvMax: 85, cov: 6,  rates: [0.0018,0.0019,0.0022,0.0026,0.0031,0.0040,0.0042,0.0043] },
  ],
  under20: [
    { ltvMin: 95.01, ltvMax: 97, cov: 35, rates: [0.0038,0.0052,0.0066,0.0079,0.0099,0.0133,0.0149,0.0169] },
    { ltvMin: 95.01, ltvMax: 97, cov: 25, rates: [0.0030,0.0040,0.0050,0.0061,0.0075,0.0098,0.0112,0.0127] },
    { ltvMin: 90.01, ltvMax: 95, cov: 30, rates: [0.0030,0.0041,0.0050,0.0060,0.0075,0.0092,0.0104,0.0122] },
    { ltvMin: 90.01, ltvMax: 95, cov: 25, rates: [0.0028,0.0038,0.0045,0.0054,0.0065,0.0080,0.0093,0.0109] },
    { ltvMin: 85.01, ltvMax: 90, cov: 25, rates: [0.0024,0.0030,0.0036,0.0043,0.0050,0.0065,0.0073,0.0087] },
    { ltvMin: 85.01, ltvMax: 90, cov: 12, rates: [0.0019,0.0021,0.0025,0.0028,0.0033,0.0042,0.0047,0.0055] },
    { ltvMin: 80.01, ltvMax: 85, cov: 12, rates: [0.0018,0.0019,0.0022,0.0022,0.0025,0.0031,0.0033,0.0039] },
    { ltvMin: 80.01, ltvMax: 85, cov: 6,  rates: [0.0017,0.0018,0.0019,0.0020,0.0020,0.0022,0.0024,0.0027] },
  ],
  adjustments: {
    secondHome:  [0.0012,0.0013,0.0014,0.0017,0.0020,0.0035,0.0040,0.0045],
    investment:  [0.0034,0.0038,0.0038,null,null,null,null,null],
    cashOut:     [0.0018,0.0022,0.0025,0.0035,0.0042,0.0058,0.0068,0.0089],
    highDTI:     [0.0003,0.0004,0.0005,0.0008,0.0010,0.0018,0.0028,0.0057],
    multiBorrow: [-0.0003,-0.0005,-0.0006,-0.0010,-0.0012,-0.0015,-0.0020,-0.0027],
  },
  nonFixedMultiplier: 1.25,
  minRate: 0.0015,
};

// lines 465-491
const PMI_ENACT = {
  over20: [
    { ltv: "97-95.01%", cov: 35, rates: [0.0058,0.0082,0.0100,0.0120,0.0147,0.0200,0.0222,0.0277] },
    { ltv: "95-90.01%", cov: 30, rates: [0.0038,0.0055,0.0070,0.0085,0.0106,0.0140,0.0150,0.0162] },
    { ltv: "95-90.01%", cov: 25, rates: [0.0035,0.0049,0.0062,0.0074,0.0093,0.0120,0.0128,0.0137] },
    { ltv: "90-85.01%", cov: 25, rates: [0.0028,0.0038,0.0048,0.0057,0.0071,0.0097,0.0103,0.0110] },
    { ltv: "90-85.01%", cov: 12, rates: [0.0022,0.0029,0.0036,0.0041,0.0050,0.0065,0.0069,0.0077] },
    { ltv: "85% & below", cov: 12, rates: [0.0019,0.0020,0.0023,0.0027,0.0032,0.0042,0.0044,0.0066] },
  ],
  under20: [
    { ltv: "97-95.01%", cov: 35, rates: [0.0039,0.0054,0.0067,0.0080,0.0101,0.0135,0.0153,0.0173] },
    { ltv: "95-90.01%", cov: 30, rates: [0.0029,0.0039,0.0048,0.0058,0.0073,0.0089,0.0102,0.0121] },
    { ltv: "95-90.01%", cov: 25, rates: [0.0027,0.0037,0.0044,0.0052,0.0064,0.0078,0.0091,0.0108] },
    { ltv: "90-85.01%", cov: 25, rates: [0.0023,0.0030,0.0036,0.0042,0.0049,0.0064,0.0072,0.0086] },
    { ltv: "90-85.01%", cov: 12, rates: [0.0018,0.0021,0.0025,0.0028,0.0033,0.0042,0.0047,0.0055] },
    { ltv: "85% & below", cov: 12, rates: [0.0017,0.0019,0.0022,0.0022,0.0025,0.0031,0.0033,0.0039] },
  ],
  adjustments: {
    multiBorrow: [-0.0003,-0.0005,-0.0006,-0.0010,-0.0012,-0.0015,-0.0020,-0.0027],
    investment:  [0.0034,0.0038,0.0042,0.0052,0.0062,0.0080,0.0095,0.0112],
    secondHome:  [0.0012,0.0014,0.0018,0.0022,0.0028,0.0042,0.0052,0.0067],
    cashOut:     [0.0018,0.0022,0.0025,0.0035,0.0042,0.0058,0.0068,0.0089],
    highDTI:     [0.0003,0.0004,0.0005,0.0008,0.0010,0.0018,0.0028,0.0057],
    highDTI50:   [0.0006,0.0009,0.0012,0.0019,0.0026,0.0052,0.0082,0.0149],
  },
  effective: "Jun 4, 2018 (Updated Jan 27, 2022)",
};

// lines 493-519
const PMI_ESSENT = {
  over20: [
    { ltv: "97-95.01%", cov: 35, rates: [0.0055,0.0075,0.0095,0.0115,0.0140,0.0190,0.0205,0.0225] },
    { ltv: "97-95.01%", cov: 25, rates: [0.0044,0.0063,0.0077,0.0093,0.0115,0.0152,0.0167,0.0181] },
    { ltv: "95-90.01%", cov: 30, rates: [0.0041,0.0059,0.0073,0.0087,0.0108,0.0142,0.0150,0.0161] },
    { ltv: "95-90.01%", cov: 25, rates: [0.0037,0.0052,0.0064,0.0075,0.0094,0.0121,0.0128,0.0137] },
    { ltv: "90-85.01%", cov: 25, rates: [0.0030,0.0041,0.0050,0.0060,0.0073,0.0100,0.0105,0.0110] },
    { ltv: "90-85.01%", cov: 12, rates: [0.0023,0.0030,0.0036,0.0041,0.0050,0.0065,0.0069,0.0077] },
    { ltv: "85% & below", cov: 12, rates: [0.0019,0.0020,0.0023,0.0027,0.0032,0.0041,0.0043,0.0045] },
    { ltv: "85% & below", cov: 6,  rates: [0.0018,0.0019,0.0022,0.0026,0.0031,0.0040,0.0042,0.0043] },
  ],
  under20: [
    { ltv: "97-95.01%", cov: 35, rates: [0.0037,0.0050,0.0065,0.0077,0.0097,0.0130,0.0145,0.0165] },
    { ltv: "97-95.01%", cov: 25, rates: [0.0030,0.0040,0.0050,0.0061,0.0075,0.0098,0.0112,0.0127] },
    { ltv: "95-90.01%", cov: 30, rates: [0.0030,0.0041,0.0050,0.0060,0.0075,0.0092,0.0104,0.0122] },
    { ltv: "95-90.01%", cov: 25, rates: [0.0028,0.0038,0.0045,0.0054,0.0065,0.0080,0.0093,0.0109] },
    { ltv: "90-85.01%", cov: 25, rates: [0.0024,0.0030,0.0036,0.0043,0.0050,0.0065,0.0073,0.0087] },
    { ltv: "90-85.01%", cov: 12, rates: [0.0019,0.0021,0.0025,0.0028,0.0033,0.0042,0.0047,0.0055] },
    { ltv: "85% & below", cov: 12, rates: [0.0018,0.0019,0.0022,0.0022,0.0025,0.0031,0.0033,0.0039] },
    { ltv: "85% & below", cov: 6,  rates: [0.0017,0.0018,0.0019,0.0020,0.0020,0.0022,0.0024,0.0027] },
  ],
  adjustments: {
    secondHome:  [0.0012,0.0013,0.0014,0.0017,0.0020,0.0035,0.0040,0.0045],
    investment:  [0.0034,0.0038,0.0038,null,null,null,null,null],
  },
  effective: "Dec 18, 2017",
};

// lines 612-618
const COLORS_DARK = {
  navy: "#8BB8D4", navyLight: "#A0CBE3", blue: "#48A0CE", blueLight: "#1A2E3C",
  green: "#3DB87A", greenLight: "#1A2E24", red: "#E86B5C", redLight: "#2E1A1A",
  gold: "#F0B840", goldLight: "#2E2818", gray: "#94A3B0", grayLight: "#6B7D8A",
  border: "#2A3A45", bg: "#1A2530", bgAlt: "#1E2D38", white: "#1E2D38",
  text: "#E0E8EE", textSecondary: "#94A3B0",
};

// lines 751-756
const COLORS = {
  navy: "#0C4160", navyLight: "#164E72", blue: "#48A0CE", blueLight: "#E8F4FA",
  green: "#1B8A5A", greenLight: "#E8F5EE", red: "#C0392B", redLight: "#FDECEB",
  gold: "#D4920B", goldLight: "#FFF8E1", gray: "#6B7D8A", grayLight: "#94A3B0",
  border: "#E0E8E8", bg: "#F7FAFB", bgAlt: "#FAFCFD", white: "#fff",
};

// line 758
const font = "'DM Sans', sans-serif";

// lines 6207-6228 — pure-data extract from MODULES (component: refs omitted)
const MODULE_DEFS = [
  { id: "about",     label: "About",              icon: "👤" },
  { id: "payment",   label: "Payment Calculator", icon: "💰" },
  { id: "refi",      label: "Refi Analyzer",       icon: "🔄" },
  { id: "fees",      label: "Fee Sheet",            icon: "📋" },
  { id: "compare",   label: "Compare Loans",        icon: "⚖️" },
  { id: "breakeven", label: "Break-Even",           icon: "📊" },
  { id: "prequal",   label: "Pre-Qual Letter",      icon: "✉️" },
  { id: "locks",     label: "Rate Locks",           icon: "🔒" },
  { id: "afford",    label: "Affordability",        icon: "🏠" },
  { id: "amort",     label: "Amortization",         icon: "📅" },
  { id: "dti",       label: "DTI Calculator",       icon: "📐" },
  { id: "rentvsbuy", label: "Rent vs Buy",          icon: "🏘️" },
  { id: "sellernet", label: "Seller Net Sheet",     icon: "💵" },
  { id: "biweekly",  label: "Bi-Weekly",            icon: "⚡" },
  { id: "closing",   label: "Closing Costs",        icon: "🏦" },
  { id: "heloc",     label: "HELOC",                icon: "🏡" },
  { id: "programs",  label: "Loan Programs",        icon: "🎯" },
  { id: "budget",    label: "Budget Planner",       icon: "📒" },
  { id: "openhouse", label: "Open House",           icon: "🏘️" },
  { id: "flyer",     label: "Flyer Generator",      icon: "📰" },
  { id: "ratewatch", label: "Rate Watch",           icon: "📈" },
];

const CONFORMING_LIMITS = {
  baseline: 832750,
  highCost: 1249125,
  getLimit: function(stateCode, county) { return this.baseline; }
};

const FHA_LIMITS = {
  floor: 541287,
  ceiling: 1249125,
  TX: {
    "Dallas": 563500, "Collin": 563500, "Denton": 563500,
    "Rockwall": 563500, "Hunt": 563500, "Kaufman": 563500,
    "Harris": 563500, "Fort Bend": 563500, "Montgomery": 563500,
    "Brazoria": 563500, "Liberty": 563500, "Waller": 563500,
    "Chambers": 563500, "Austin": 563500, "Galveston": 563500,
    "Travis": 563500, "Williamson": 563500, "Hays": 563500,
    "Bastrop": 563500, "Caldwell": 563500,
    "Midland": 563500, "Martin": 563500,
    "Bexar": 563500, "Comal": 563500, "Guadalupe": 563500,
    "Bandera": 563500, "Kendall": 563500, "Medina": 563500,
    "Wilson": 563500, "Atascosa": 563500,
    "Tarrant": 563500, "Johnson": 563500, "Parker": 563500,
    "Wise": 563500, "Ellis": 563500, "Somervell": 563500,
    "Hood": 563500, "Erath": 563500, "Palo Pinto": 563500,
  },
  getLimit: function(stateCode, county) {
    if (stateCode === "TX" && this.TX[county]) return this.TX[county];
    if (stateCode === "TX") return this.floor;
    return this.floor;
  }
};

// ── Lead Pipeline Status Taxonomy ────────────────────────────────────────
// group: "pre" → shows in Active tab (pre-pipeline)
// group: "active" → shows in Active tab (in-pipeline)
// group: "waiting" → shows in Waiting tab
// group: "archived" → shows in Archived tab
const LEAD_STATUSES = [
  { value: "?",                                        label: "?",                                        group: "pre"      },
  { value: "(A) Loan App: Sent",                       label: "(A) Loan App: Sent",                       group: "pre"      },
  { value: "(B) Loan App: Received",                   label: "(B) Loan App: Received",                   group: "pre"      },
  { value: "(C) Pre-Qualified",                        label: "(C) Pre-Qualified",                        group: "pre"      },
  { value: "(D) Pre-Approved",                         label: "(D) Pre-Approved",                         group: "pre"      },
  { value: "01. Contract / Go",                        label: "01. Contract / Go",                        group: "active"   },
  { value: "02. Disclosures: Ordered",                 label: "02. Disclosures: Ordered",                 group: "active"   },
  { value: "03. Disclosures Sent",                     label: "03. Disclosures Sent",                     group: "active"   },
  { value: "04. Disclosures Received",                 label: "04. Disclosures Received",                 group: "active"   },
  { value: "05. Supporting Docs In / Ready for Setup", label: "05. Supporting Docs In / Ready for Setup", group: "active"   },
  { value: "06. To Setup",                             label: "06. To Setup",                             group: "active"   },
  { value: "07. To Processing",                        label: "07. To Processing",                        group: "active"   },
  { value: "08. UW: Submitted",                        label: "08. UW: Submitted",                        group: "active"   },
  { value: "09. UW: Approved",                         label: "09. UW: Approved",                         group: "active"   },
  { value: "10. CTC: Submitted",                       label: "10. CTC: Submitted",                       group: "active"   },
  { value: "11. CTC",                                  label: "11. CTC",                                  group: "active"   },
  { value: "12. CD: Finalized & Sent",                 label: "12. CD: Finalized & Sent",                 group: "active"   },
  { value: "13. Instructions Out",                     label: "13. Instructions Out",                     group: "active"   },
  { value: "14. Closed",                               label: "14. Closed",                               group: "active"   },
  { value: "15. Funded",                               label: "15. Funded",                               group: "active"   },
  { value: "Waiting",                                  label: "Waiting",                                  group: "waiting"  },
  { value: "Waiting - Building",                       label: "Waiting - Building",                       group: "waiting"  },
  { value: "z- Can't",                                 label: "z- Can't",                                 group: "archived" },
  { value: "z- Didn't",                                label: "z- Didn't",                                group: "archived" },
  { value: "z- Lead",                                  label: "z- Lead",                                  group: "archived" },
  { value: "z- Lost (cash/relo/builder)",              label: "z- Lost (cash/relo/builder)",              group: "archived" },
  { value: "z- Lost (rate/unknown)",                   label: "z- Lost (rate/unknown)",                   group: "archived" },
  { value: "z- Lost (rel/mid-proc/we better)",         label: "z- Lost (rel/mid-proc/we better)",         group: "archived" },
  { value: "z- Lost (special prog)",                   label: "z- Lost (special prog)",                   group: "archived" },
  { value: "zz- Junk",                                 label: "zz- Junk",                                 group: "archived" },
];

const LOAN_PURPOSES = [
  { value: "purchase",         label: "Purchase"         },
  { value: "refi_rate_term",   label: "Refi \u2013 Rate/Term" },
  { value: "refi_cashout",     label: "Refi \u2013 Cash Out"  },
  { value: "heloc",            label: "HELOC"            },
  { value: "new_construction", label: "New Construction" },
];

// FHFA-style 5-year annualized appreciation rates by state (2019-2024 estimates)
const STATE_APPR_RATES = {
  AL:4.0, AK:2.5, AZ:5.5, AR:3.5, CA:5.5, CO:5.0, CT:4.5, DE:4.5,
  FL:6.0, GA:5.0, HI:4.0, ID:6.0, IL:3.5, IN:4.0, IA:3.5, KS:3.5,
  KY:4.0, LA:2.5, ME:5.5, MD:5.0, MA:5.5, MI:4.5, MN:4.0, MS:3.0,
  MO:4.0, MT:6.0, NE:4.0, NV:5.5, NH:6.0, NJ:5.5, NM:4.5, NY:4.0,
  NC:5.5, ND:3.0, OH:4.0, OK:3.5, OR:5.0, PA:4.5, RI:6.0, SC:5.5,
  SD:4.0, TN:5.5, TX:4.5, UT:6.0, VT:5.5, VA:5.0, WA:5.5, WV:3.0,
  WI:4.5, WY:3.5, DC:4.5,
};

window.MTK_PREFIX       = MTK_PREFIX;
window.CALC_KEY_PREFIXES = CALC_KEY_PREFIXES;
window.CALC_SECTION_NAMES = CALC_SECTION_NAMES;
window.PMI_FICO_BUCKETS = PMI_FICO_BUCKETS;
window.PMI_RATES        = PMI_RATES;
window.PMI_ENACT        = PMI_ENACT;
window.PMI_ESSENT       = PMI_ESSENT;
window.COLORS_DARK      = COLORS_DARK;
window.COLORS           = COLORS;
window.font             = font;
window.MODULE_DEFS        = MODULE_DEFS;
window.CONFORMING_LIMITS  = CONFORMING_LIMITS;
window.FHA_LIMITS         = FHA_LIMITS;
window.LEAD_STATUSES      = LEAD_STATUSES;
window.LOAN_PURPOSES      = LOAN_PURPOSES;
window.STATE_APPR_RATES   = STATE_APPR_RATES;
