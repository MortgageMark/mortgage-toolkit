// modules/utils.js
// Pure utility functions extracted verbatim from mortgage-toolkit.html
// No imports needed — pure functions only (references STATE_TITLE_DATA and TX_METRO_COUNTIES as globals from main file)

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

// line 140
const CALC_KEY_PREFIXES = [
  "pc_","ra_","fs_","mc_","be_","pq_","fc_","af_","am_","dti_",
  "rvb_","sns_","biw_","cce_","hel_","lpc_","bud_","ohlc_","rw_","fly_","brand_"
];

// line 177
const CALC_SECTION_NAMES = {
  "pc_": "Purchase Calculator", "ra_": "Rate/APR", "fs_": "Fee Sheet",
  "mc_": "Monthly Cost", "be_": "Break-Even", "pq_": "Pre-Qualification",
  "fc_": "FHA Calculator", "af_": "Affordability", "am_": "Amortization",
  "dti_": "DTI", "rvb_": "Rent vs Buy", "sns_": "Scenario Comparison",
  "biw_": "Bi-Weekly", "cce_": "Closing Cost Est.", "hel_": "HELOC",
  "lpc_": "Loan Product Compare", "bud_": "Budget", "ohlc_": "Overhead",
  "rw_": "Refinance", "fly_": "Flyer", "brand_": "Branding"
};

// line 425
const PMI_FICO_BUCKETS = [760, 740, 720, 700, 680, 660, 640, 620];

// line 432
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

// line 465
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

// line 493
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

// Single Premium MI rate table (% of original loan balance paid upfront)
// Approximate MGIC-style rates; actual rates vary by MI company
const PMI_SINGLE = {
  over20: [
    { ltvMin: 95.01, ltvMax: 97, rates: [0.0150,0.0175,0.0200,0.0225,0.0250,0.0300,0.0350,0.0400] },
    { ltvMin: 90.01, ltvMax: 95, rates: [0.0120,0.0140,0.0160,0.0180,0.0210,0.0250,0.0280,0.0325] },
    { ltvMin: 85.01, ltvMax: 90, rates: [0.0085,0.0100,0.0115,0.0130,0.0155,0.0185,0.0210,0.0240] },
    { ltvMin: 80.01, ltvMax: 85, rates: [0.0055,0.0065,0.0075,0.0090,0.0105,0.0125,0.0140,0.0160] },
  ],
  under20: [
    { ltvMin: 95.01, ltvMax: 97, rates: [0.0095,0.0110,0.0130,0.0145,0.0165,0.0200,0.0225,0.0255] },
    { ltvMin: 90.01, ltvMax: 95, rates: [0.0075,0.0090,0.0105,0.0115,0.0135,0.0165,0.0185,0.0210] },
    { ltvMin: 85.01, ltvMax: 90, rates: [0.0055,0.0065,0.0075,0.0085,0.0100,0.0125,0.0140,0.0160] },
    { ltvMin: 80.01, ltvMax: 85, rates: [0.0035,0.0040,0.0050,0.0060,0.0070,0.0085,0.0095,0.0110] },
  ],
};

// ─── FUNCTIONS ────────────────────────────────────────────────────────────────

// line 187
function diffCalculatorData(before, after) {
  if (!before || !after) return { sections: [], details: {} };
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = {};
  allKeys.forEach(function(key) {
    const a = JSON.stringify(before[key] ?? null);
    const b = JSON.stringify(after[key] ?? null);
    if (a !== b) {
      const prefix = CALC_KEY_PREFIXES.find(function(p) { return key.startsWith(p); }) || "";
      const section = CALC_SECTION_NAMES[prefix] || prefix || "Other";
      if (!changed[section]) changed[section] = [];
      changed[section].push(key);
    }
  });
  const sections = Object.keys(changed);
  return { sections: sections, details: changed };
}

// line 360
function getDefaultRoster() {
  return [
    {
      id: "m1", name: "Mark Ningard", title: "Sr. Loan Officer", company: "CMG Home Loans",
      phone: "469-631-3879", email: "mymortgagemark@gmail.com", nmls: "729612",
      branchNmls: "", address: "", city: "", state: "TX", zip: "",
      role: "admin", passwordHash: "", active: true, firstLogin: true
    },
    {
      id: "m2", name: "Paige Minden", title: "Loan Officer Assistant", company: "CMG Home Loans",
      phone: "", email: "", nmls: "", branchNmls: "", address: "", city: "", state: "TX", zip: "",
      role: "admin", passwordHash: "", active: true, firstLogin: true
    }
  ];
}

// line 418
function generateId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// line 426
function ficoIndex(fico) {
  if (fico >= 760) return 0; if (fico >= 740) return 1; if (fico >= 720) return 2;
  if (fico >= 700) return 3; if (fico >= 680) return 4; if (fico >= 660) return 5;
  if (fico >= 640) return 6; return 7;
}

// line 522
function lookupPMI({ ltv, fico, termYears, occupancy, isFixed, isCashOut, isMultiBorrower, highDTI }) {
  if (ltv <= 80) return { rate: 0, coverage: 0, tier: "No PMI required" };
  if (fico < 620) return { rate: null, coverage: 0, tier: "FICO below 620 — manual quote needed" };
  const fi = ficoIndex(fico);
  const table = termYears > 20 ? PMI_RATES.over20 : PMI_RATES.under20;
  let match = null;
  for (const row of table) {
    if (ltv > row.ltvMin && ltv <= row.ltvMax) { match = row; break; }
  }
  if (!match && ltv > 80 && ltv <= 85) match = table.find(r => r.ltvMax === 85);
  if (!match) return { rate: null, coverage: 0, tier: "LTV out of range" };
  let baseRate = match.rates[fi];
  if (!isFixed) baseRate *= PMI_RATES.nonFixedMultiplier;
  const adj = PMI_RATES.adjustments;
  let totalAdj = 0;
  if (occupancy === "vacation") totalAdj += (adj.secondHome[fi] || 0);
  if (occupancy === "investment") { const v = adj.investment[fi]; if (v === null) return { rate: null, coverage: 0, tier: "Investment — FICO ≥720 required for PMI" }; totalAdj += v; }
  if (isCashOut) totalAdj += (adj.cashOut[fi] || 0);
  if (highDTI) totalAdj += (adj.highDTI[fi] || 0);
  if (isMultiBorrower) totalAdj += (adj.multiBorrow[fi] || 0);
  let finalRate = Math.max(baseRate + totalAdj, PMI_RATES.minRate);
  return { rate: finalRate, coverage: match.cov, tier: `${match.ltvMin < 85.01 ? "80.01-85" : match.ltvMin + "-" + match.ltvMax}%`, baseRate, totalAdj };
}

// line 548
function lookupPMICompany(company, { ltv, fico, termYears, isMultiBorrower = false, highDTI = false, isCashOut = false, occupancy = "primary" } = {}) {
  const data = company === "enact" ? PMI_ENACT : PMI_ESSENT;
  if (ltv <= 80 || fico < 620) return null;
  const fi = ficoIndex(fico);
  const table = termYears > 20 ? data.over20 : data.under20;
  let baseRate = null;
  for (const row of table) {
    const parts = row.ltv.replace("%","").split("-");
    let lo, hi;
    if (parts.length === 2 && !row.ltv.includes("below")) { lo = parseFloat(parts[1]); hi = parseFloat(parts[0]); }
    else { lo = 80.01; hi = 85; }
    if (ltv > lo && ltv <= hi) { baseRate = row.rates[fi]; break; }
  }
  if (baseRate === null) return null;
  const adj = data.adjustments || {};
  let totalAdj = 0;
  if (occupancy === "vacation" && adj.secondHome) totalAdj += adj.secondHome[fi] || 0;
  if (occupancy === "investment" && adj.investment) { const v = adj.investment[fi]; if (v === null) return null; totalAdj += v; }
  if (isCashOut && adj.cashOut) totalAdj += adj.cashOut[fi] || 0;
  if (highDTI && adj.highDTI) totalAdj += adj.highDTI[fi] || 0;
  if (isMultiBorrower && adj.multiBorrow) totalAdj += adj.multiBorrow[fi] || 0;
  return Math.max(baseRate + totalAdj, PMI_RATES.minRate);
}

// Single premium: returns rate as decimal (e.g. 0.0150 = 1.50% of loan amount paid upfront)
function lookupSinglePremium({ ltv, fico, termYears }) {
  if (ltv <= 80 || fico < 620) return 0;
  const fi = ficoIndex(fico);
  const table = termYears > 20 ? PMI_SINGLE.over20 : PMI_SINGLE.under20;
  for (const row of table) {
    if (ltv > row.ltvMin && ltv <= row.ltvMax) return row.rates[fi];
  }
  return 0;
}

// LPMI rate adjustment in percentage points (e.g. 0.375 = add 0.375% to note rate)
function lookupLPMIAdj(ltv) {
  if (ltv > 95) return 0.500;
  if (ltv > 90) return 0.375;
  if (ltv > 85) return 0.250;
  if (ltv > 80) return 0.125;
  return 0;
}

// line 628
function pmt(rate, nper, pv) {
  if (rate === 0) return pv / nper;
  const x = Math.pow(1 + rate, nper);
  return (pv * rate * x) / (x - 1);
}

// APR fees = origination + discount points + underwriting + processing + flood cert + tax service + doc prep
// Uses binary search to solve: netLA = monthlyPmt * [1-(1+r)^-n]/r  for r, then APR = r*12*100
function calcAPR(la, annualRate, termYrs, aprFees) {
  const n = Math.round((termYrs || 30) * 12);
  if (!la || !annualRate || !n) return annualRate;
  const r = annualRate / 100 / 12;
  const monthlyPmt = pmt(r, n, la);
  const netLA = la - (aprFees || 0);
  if (netLA <= 0 || monthlyPmt <= 0) return annualRate;
  let lo = 0.000001, hi = 1.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const pv = monthlyPmt * (1 - Math.pow(1 + mid, -n)) / mid;
    if (pv > netLA) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 12 * 100;
}

// line 634
function buildAmortization(balance, monthlyRate, totalPayments, monthlyPmt) {
  const schedule = [];
  let remaining = balance;
  for (let i = 1; i <= totalPayments; i++) {
    const interest = remaining * monthlyRate;
    const principal = monthlyPmt - interest;
    remaining = Math.max(0, remaining - principal);
    schedule.push({
      month: i, payment: monthlyPmt, principal, interest, balance: remaining,
      totalInterest: schedule.length > 0 ? schedule[schedule.length - 1].totalInterest + interest : interest,
    });
    if (remaining <= 0.01) break;
  }
  return schedule;
}

// line 650
function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

// line 655
function fmt2(val) {
  if (val === null || val === undefined || isNaN(val)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(val));
}

// line 660
function fmtCredit(val) {
  if (val === null || val === undefined || isNaN(val) || val >= 0) return fmt(val);
  return "(" + fmt(Math.abs(val)) + ")";
}

// line 665
function addCommas(str) {
  const cleaned = String(str).replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// line 673
function getFederalHolidays(year) {
  const holidays = [];
  holidays.push({ date: new Date(year, 0, 1), name: "New Year's Day" });
  holidays.push({ date: nthWeekday(year, 0, 1, 3), name: "Martin Luther King Jr. Day" });
  holidays.push({ date: nthWeekday(year, 1, 1, 3), name: "Presidents' Day" });
  holidays.push({ date: lastWeekday(year, 4, 1), name: "Memorial Day" });
  holidays.push({ date: new Date(year, 5, 19), name: "Juneteenth" });
  holidays.push({ date: new Date(year, 6, 4), name: "Independence Day" });
  holidays.push({ date: nthWeekday(year, 8, 1, 1), name: "Labor Day" });
  holidays.push({ date: nthWeekday(year, 9, 1, 2), name: "Columbus Day" });
  holidays.push({ date: new Date(year, 10, 11), name: "Veterans Day" });
  holidays.push({ date: nthWeekday(year, 10, 4, 4), name: "Thanksgiving Day" });
  holidays.push({ date: new Date(year, 11, 25), name: "Christmas Day" });
  return holidays.map(h => {
    const d = h.date;
    const day = d.getDay();
    const observed = day === 0 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
                   : day === 6 ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
                   : d;
    return { ...h, observed, dateStr: toDateStr(observed) };
  });
}

// line 707
function nthWeekday(year, month, dow, n) {
  const first = new Date(year, month, 1);
  let d = 1 + ((dow - first.getDay() + 7) % 7);
  d += (n - 1) * 7;
  return new Date(year, month, d);
}

// line 713
function lastWeekday(year, month, dow) {
  const last = new Date(year, month + 1, 0);
  let d = last.getDate() - ((last.getDay() - dow + 7) % 7);
  return new Date(year, month, d);
}

// line 718
function toDateStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// line 721
function isWeekend(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

// line 725
function isHoliday(dateStr, year) {
  return getFederalHolidays(year).some(h => h.dateStr === dateStr);
}

// line 728
function getHolidayName(dateStr, year) {
  const h = getFederalHolidays(year).find(h => h.dateStr === dateStr);
  return h ? h.name : null;
}

// line 733
function stripCommas(str) { return String(str).replace(/,/g, ""); }

// line 735
function calcTrueBreakEven(curSchedule, newSchedule, curPMI, newPMI, closingCosts, maxMonths) {
  let curCumulative = 0, newCumulative = closingCosts, breakEvenMonth = null;
  const timeline = [];
  for (let m = 0; m < maxMonths; m++) {
    const curInterest = curSchedule[m] ? curSchedule[m].interest : 0;
    const newInterest = newSchedule[m] ? newSchedule[m].interest : 0;
    curCumulative += curInterest + curPMI;
    newCumulative += newInterest + newPMI;
    const netSavings = curCumulative - newCumulative;
    timeline.push({ month: m + 1, curMonthInterest: curInterest, newMonthInterest: newInterest, curCumulative, newCumulative, netSavings });
    if (breakEvenMonth === null && netSavings >= 0) breakEvenMonth = m + 1;
  }
  return { breakEvenMonth, timeline };
}

// line 762
function tieredRate(amount, tiers) {
  if (amount <= 0) return 0;
  let premium = 0, prev = 0;
  for (const t of tiers) {
    const cap = t.upTo === Infinity ? amount : t.upTo;
    if (amount <= cap) { premium += (amount - prev) * t.perThousand / 1000; break; }
    premium += (cap - prev) * t.perThousand / 1000;
    prev = cap;
  }
  return Math.round(premium);
}

// line 774
function flatRate(amount, ratePerThousand) {
  return amount <= 0 ? 0 : Math.round(amount * ratePerThousand / 1000);
}

// ─── exportToExcel (line 564) ─────────────────────────────────────────────────
function exportToExcel(headers, rows, filename) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const colWidths = headers.map((h, i) => {
    const max = Math.max(h.length, ...rows.map(r => String(r[i] || "").length));
    return { wch: max + 2 };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

// ─── exportToPDF (line 577) ───────────────────────────────────────────────────
function exportToPDF(title, headers, rows, filename, options = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: options.landscape ? "landscape" : "portrait" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(12, 65, 96);
  doc.text(title, 14, 18); doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 125, 138);
  doc.text("Mortgage Mark · CMG Home Loans · NMLS #729612", 14, 25);
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 14, 30);
  doc.autoTable({
    head: [headers], body: rows, startY: 36,
    styles: { fontSize: 9, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: [12, 65, 96], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 250, 251] },
    margin: { left: 14, right: 14 }, ...(options.columnStyles || {}),
  });
  if (options.footer) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 176);
      doc.text("This is an estimate for educational purposes. Actual amounts may vary.", 14, doc.internal.pageSize.height - 10);
    }
  }
  doc.save(filename);
}

// ─── STATE_TITLE_DATA (line 787) ─────────────────────────────────────────────
const STATE_TITLE_DATA = {
  TX: {
    name: "Texas", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.75},{upTo:200000,perThousand:5.00},
      {upTo:500000,perThousand:4.50},{upTo:1000000,perThousand:3.50},
      {upTo:Infinity,perThousand:2.75}]),
    simultaneousRate: 0.40, transferTaxRate: 0,
    recording: {deed:26,mortgage:44,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"T-36",cost:125},{name:"T-42",cost:150}],
    surveyFee: 450, appraisal:{conv:550,fha:600,va:550,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 550, escrowMonths: 2, surveyRequired: "required"
  },
  FL: {
    name: "Florida", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.75},{upTo:1000000,perThousand:5.00},
      {upTo:5000000,perThousand:2.50},{upTo:Infinity,perThousand:2.25}]),
    simultaneousRate: 0.25, transferTaxRate: 7.00,
    recording: {deed:70,mortgage:35,release:10},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 3, surveyRequired: "required"
  },
  NM: {
    name: "New Mexico", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.50},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.50, transferTaxRate: 0,
    recording: {deed:25,mortgage:25,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:525,fha:575,va:525,jumbo:725},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  CA: {
    name: "California", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:6.00},{upTo:500000,perThousand:5.00},
      {upTo:1000000,perThousand:4.00},{upTo:Infinity,perThousand:3.00}]),
    simultaneousRate: 0.30, transferTaxRate: 1.10,
    recording: {deed:15,mortgage:15,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50},{name:"CLTA 100",cost:100}],
    surveyFee: 0, appraisal:{conv:600,fha:650,va:600,jumbo:900},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 600, escrowMonths: 2, surveyRequired: "none"
  },
  NY: {
    name: "New York", basicRate: (a) => tieredRate(a, [
      {upTo:150000,perThousand:5.00},{upTo:500000,perThousand:4.50},
      {upTo:1000000,perThousand:3.75},{upTo:Infinity,perThousand:3.25}]),
    simultaneousRate: 0.30, transferTaxRate: 4.00,
    recording: {deed:315,mortgage:100,release:30},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"NY 300.2",cost:50}],
    surveyFee: 600, appraisal:{conv:625,fha:675,va:625,jumbo:900},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1500,
    homeWarranty: 600, escrowMonths: 2, surveyRequired: "required"
  },
  PA: {
    name: "Pennsylvania", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:4.00},
      {upTo:Infinity,perThousand:3.25}]),
    simultaneousRate: 0.40, transferTaxRate: 4.00,
    recording: {deed:75,mortgage:125,release:30},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 800,
    homeWarranty: 550, escrowMonths: 2, surveyRequired: "recommended"
  },
  IL: {
    name: "Illinois", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:4.00},
      {upTo:Infinity,perThousand:3.00}]),
    simultaneousRate: 0.35, transferTaxRate: 1.50,
    recording: {deed:62,mortgage:60,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:775},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 750,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "recommended"
  },
  OH: {
    name: "Ohio", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:4.50},{upTo:500000,perThousand:3.50},
      {upTo:Infinity,perThousand:2.75}]),
    simultaneousRate: 0.35, transferTaxRate: 1.00,
    recording: {deed:34,mortgage:34,release:14},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  GA: {
    name: "Georgia", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.75},{upTo:500000,perThousand:5.00},
      {upTo:Infinity,perThousand:4.00}]),
    simultaneousRate: 0.35, transferTaxRate: 1.00,
    recording: {deed:25,mortgage:25,release:10},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:775},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 700,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "recommended"
  },
  NC: {
    name: "North Carolina", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:4.00},
      {upTo:Infinity,perThousand:3.25}]),
    simultaneousRate: 0.35, transferTaxRate: 2.00,
    recording: {deed:26,mortgage:64,release:14},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:775},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 750,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "required"
  },
  VA: {
    name: "Virginia", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.50},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 3.33,
    recording: {deed:25,mortgage:25,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 450, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 700,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "required"
  },
  CO: {
    name: "Colorado", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.50},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 0.01,
    recording: {deed:13,mortgage:13,release:13},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "recommended"
  },
  AZ: {
    name: "Arizona", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.50},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:15,mortgage:15,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 0, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "none"
  },
  NV: {
    name: "Nevada", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.50},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 2.55,
    recording: {deed:19,mortgage:19,release:19},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 0, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "none"
  },
  WA: {
    name: "Washington", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.50},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 3.00,
    recording: {deed:14,mortgage:14,release:14},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 0, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 550, escrowMonths: 2, surveyRequired: "none"
  },
  OR: {
    name: "Oregon", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.50},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 0.10,
    recording: {deed:15,mortgage:15,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 0, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "none"
  },
  MI: {
    name: "Michigan", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:4.50},{upTo:500000,perThousand:3.75},
      {upTo:Infinity,perThousand:3.00}]),
    simultaneousRate: 0.35, transferTaxRate: 8.60,
    recording: {deed:30,mortgage:30,release:14},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 3, surveyRequired: "recommended"
  },
  NJ: {
    name: "New Jersey", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:4.25},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 1.50,
    recording: {deed:150,mortgage:100,release:35},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"NJ 1",cost:100}],
    surveyFee: 500, appraisal:{conv:575,fha:625,va:575,jumbo:850},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1200,
    homeWarranty: 575, escrowMonths: 3, surveyRequired: "required"
  },
  MA: {
    name: "Massachusetts", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.50},{upTo:500000,perThousand:4.75},
      {upTo:Infinity,perThousand:4.00}]),
    simultaneousRate: 0.35, transferTaxRate: 4.56,
    recording: {deed:155,mortgage:205,release:105},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 600, appraisal:{conv:600,fha:650,va:600,jumbo:900},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1200,
    homeWarranty: 600, escrowMonths: 2, surveyRequired: "required"
  },
  MD: {
    name: "Maryland", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.75},{upTo:500000,perThousand:5.00},
      {upTo:Infinity,perThousand:4.00}]),
    simultaneousRate: 0.35, transferTaxRate: 5.50,
    recording: {deed:60,mortgage:115,release:20},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 400, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 800,
    homeWarranty: 550, escrowMonths: 3, surveyRequired: "recommended"
  },
  CT: {
    name: "Connecticut", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:4.00},
      {upTo:Infinity,perThousand:3.25}]),
    simultaneousRate: 0.35, transferTaxRate: 7.50,
    recording: {deed:53,mortgage:159,release:53},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 500, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1100,
    homeWarranty: 575, escrowMonths: 2, surveyRequired: "required"
  },
  SC: {
    name: "South Carolina", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:4.25},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 3.70,
    recording: {deed:25,mortgage:60,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:775},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 700,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "required"
  },
  TN: {
    name: "Tennessee", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:4.25},
      {upTo:Infinity,perThousand:3.50}]),
    simultaneousRate: 0.35, transferTaxRate: 3.70,
    recording: {deed:12,mortgage:12,release:12},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  MN: {
    name: "Minnesota", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:4.50},{upTo:500000,perThousand:3.75},
      {upTo:Infinity,perThousand:3.00}]),
    simultaneousRate: 0.35, transferTaxRate: 3.30,
    recording: {deed:46,mortgage:46,release:46},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 3, surveyRequired: "recommended"
  },
  WI: {
    name: "Wisconsin", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:4.50},{upTo:500000,perThousand:3.75},
      {upTo:Infinity,perThousand:3.00}]),
    simultaneousRate: 0.35, transferTaxRate: 3.00,
    recording: {deed:30,mortgage:30,release:30},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 3, surveyRequired: "recommended"
  },
  MO: {
    name: "Missouri", basicRate: (a) => flatRate(a, 2.25),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:24,mortgage:36,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended",
    disclaimer: "Missouri title rates are unregulated and competitive. No state transfer tax."
  },
  IN: {
    name: "Indiana", basicRate: (a) => flatRate(a, 3.00),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:25,mortgage:35,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  AL: {
    name: "Alabama", basicRate: (a) => flatRate(a, 3.00),
    simultaneousRate: 0.35, transferTaxRate: 1.00,
    recording: {deed:30,mortgage:40,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 650,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  OK: {
    name: "Oklahoma", basicRate: (a) => tieredRate(a, [
      {upTo:100000,perThousand:5.00},{upTo:500000,perThousand:3.50},
      {upTo:Infinity,perThousand:2.75}]),
    simultaneousRate: 0.35, transferTaxRate: 0.75,
    recording: {deed:20,mortgage:20,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  LA: {
    name: "Louisiana", basicRate: (a) => flatRate(a, 3.75),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:50,mortgage:75,release:25},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 450, appraisal:{conv:550,fha:600,va:550,jumbo:775},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 800,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "required"
  },
  KY: {
    name: "Kentucky", basicRate: (a) => flatRate(a, 3.25),
    simultaneousRate: 0.35, transferTaxRate: 1.00,
    recording: {deed:46,mortgage:46,release:46},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  IA: {
    name: "Iowa", basicRate: (a) => flatRate(a, 2.00),
    simultaneousRate: 0.35, transferTaxRate: 1.60,
    recording: {deed:7,mortgage:7,release:7},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  KS: {
    name: "Kansas", basicRate: (a) => flatRate(a, 2.75),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:20,mortgage:20,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  AR: {
    name: "Arkansas", basicRate: (a) => flatRate(a, 3.00),
    simultaneousRate: 0.35, transferTaxRate: 3.30,
    recording: {deed:15,mortgage:15,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  MS: {
    name: "Mississippi", basicRate: (a) => flatRate(a, 3.00),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:25,mortgage:25,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 650,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  NE: {
    name: "Nebraska", basicRate: (a) => flatRate(a, 2.75),
    simultaneousRate: 0.35, transferTaxRate: 2.25,
    recording: {deed:10,mortgage:10,release:10},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  UT: {
    name: "Utah", basicRate: (a) => flatRate(a, 3.25),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:15,mortgage:15,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 0, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "none"
  },
  HI: {
    name: "Hawaii", basicRate: (a) => flatRate(a, 4.75),
    simultaneousRate: 0.35, transferTaxRate: 2.00,
    recording: {deed:36,mortgage:36,release:36},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 500, appraisal:{conv:650,fha:700,va:650,jumbo:900},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 600, escrowMonths: 2, surveyRequired: "recommended"
  },
  NH: {
    name: "New Hampshire", basicRate: (a) => flatRate(a, 3.25),
    simultaneousRate: 0.35, transferTaxRate: 7.50,
    recording: {deed:10,mortgage:10,release:10},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 500, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1000,
    homeWarranty: 550, escrowMonths: 2, surveyRequired: "recommended"
  },
  ME: {
    name: "Maine", basicRate: (a) => flatRate(a, 3.25),
    simultaneousRate: 0.35, transferTaxRate: 4.40,
    recording: {deed:19,mortgage:19,release:19},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 500, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 900,
    homeWarranty: 550, escrowMonths: 2, surveyRequired: "recommended"
  },
  RI: {
    name: "Rhode Island", basicRate: (a) => flatRate(a, 3.50),
    simultaneousRate: 0.35, transferTaxRate: 4.60,
    recording: {deed:92,mortgage:92,release:92},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 500, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1100,
    homeWarranty: 575, escrowMonths: 2, surveyRequired: "required"
  },
  VT: {
    name: "Vermont", basicRate: (a) => flatRate(a, 3.00),
    simultaneousRate: 0.35, transferTaxRate: 14.50,
    recording: {deed:10,mortgage:10,release:10},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 500, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1000,
    homeWarranty: 550, escrowMonths: 2, surveyRequired: "required"
  },
  DE: {
    name: "Delaware", basicRate: (a) => flatRate(a, 3.50),
    simultaneousRate: 0.35, transferTaxRate: 15.00,
    recording: {deed:24,mortgage:24,release:24},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 450, appraisal:{conv:575,fha:625,va:575,jumbo:825},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1000,
    homeWarranty: 550, escrowMonths: 2, surveyRequired: "recommended"
  },
  WV: {
    name: "West Virginia", basicRate: (a) => flatRate(a, 2.75),
    simultaneousRate: 0.35, transferTaxRate: 3.30,
    recording: {deed:20,mortgage:20,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 700,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  ID: {
    name: "Idaho", basicRate: (a) => flatRate(a, 3.25),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:15,mortgage:15,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 0, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "none"
  },
  MT: {
    name: "Montana", basicRate: (a) => flatRate(a, 3.25),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:14,mortgage:14,release:14},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 450, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "recommended"
  },
  WY: {
    name: "Wyoming", basicRate: (a) => flatRate(a, 3.00),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:14,mortgage:14,release:10},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 400, appraisal:{conv:550,fha:600,va:550,jumbo:800},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 525, escrowMonths: 2, surveyRequired: "recommended"
  },
  ND: {
    name: "North Dakota", basicRate: (a) => flatRate(a, 2.50),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:20,mortgage:20,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  SD: {
    name: "South Dakota", basicRate: (a) => flatRate(a, 2.75),
    simultaneousRate: 0.35, transferTaxRate: 1.00,
    recording: {deed:30,mortgage:30,release:15},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 375, appraisal:{conv:525,fha:575,va:525,jumbo:750},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 500, escrowMonths: 2, surveyRequired: "recommended"
  },
  AK: {
    name: "Alaska", basicRate: (a) => flatRate(a, 4.00),
    simultaneousRate: 0.35, transferTaxRate: 0,
    recording: {deed:30,mortgage:30,release:20},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"}],
    surveyFee: 600, appraisal:{conv:650,fha:700,va:650,jumbo:900},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 0,
    homeWarranty: 575, escrowMonths: 2, surveyRequired: "recommended"
  },
  DC: {
    name: "District of Columbia", basicRate: (a) => flatRate(a, 4.50),
    simultaneousRate: 0.35, transferTaxRate: 11.00,
    recording: {deed:55,mortgage:55,release:25},
    endorsements: [{name:"ALTA 8.1",cost:75},{name:"ALTA 9",cost:"0.10%"},{name:"ALTA 22",cost:50}],
    surveyFee: 500, appraisal:{conv:625,fha:675,va:625,jumbo:900},
    creditReport: 65, floodCert: 15, taxServiceFee: 85, attorneyFee: 1200,
    homeWarranty: 600, escrowMonths: 2, surveyRequired: "required"
  },
};

// ─── STATE_LIST (line 1753) ───────────────────────────────────────────────────
const STATE_LIST = [
  { value: "TX", label: "Texas" },
  ...Object.keys(STATE_TITLE_DATA)
    .filter(k => k !== "TX")
    .sort((a, b) => STATE_TITLE_DATA[a].name.localeCompare(STATE_TITLE_DATA[b].name))
    .map(k => ({ value: k, label: STATE_TITLE_DATA[k].name }))
];

// line 1762
// NOTE: references STATE_TITLE_DATA — large constant that remains as a global in mortgage-toolkit.html
function getStateFees(stateCode) {
  return STATE_TITLE_DATA[stateCode] || STATE_TITLE_DATA.TX;
}

// line 6424
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

// line 6430
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

window.CALC_KEY_PREFIXES   = CALC_KEY_PREFIXES;
window.CALC_SECTION_NAMES  = CALC_SECTION_NAMES;
window.PMI_FICO_BUCKETS    = PMI_FICO_BUCKETS;
window.PMI_RATES           = PMI_RATES;
window.PMI_ENACT           = PMI_ENACT;
window.PMI_ESSENT          = PMI_ESSENT;

window.diffCalculatorData  = diffCalculatorData;
window.getDefaultRoster    = getDefaultRoster;
window.generateId          = generateId;
window.ficoIndex           = ficoIndex;
window.lookupPMI           = lookupPMI;
window.lookupPMICompany    = lookupPMICompany;
window.PMI_SINGLE          = PMI_SINGLE;
window.lookupSinglePremium = lookupSinglePremium;
window.lookupLPMIAdj       = lookupLPMIAdj;
window.pmt                 = pmt;
window.calcAPR             = calcAPR;
window.buildAmortization   = buildAmortization;
function formatPhone(val) {
  if (!val) return "";
  const digits = String(val).replace(/\D/g, "");
  if (digits.length === 10) return "(" + digits.slice(0,3) + ") " + digits.slice(3,6) + "-" + digits.slice(6);
  if (digits.length === 11 && digits[0] === "1") return "(" + digits.slice(1,4) + ") " + digits.slice(4,7) + "-" + digits.slice(7);
  return val;
}
window.formatPhone         = formatPhone;
window.fmt                 = fmt;
window.fmt2                = fmt2;
window.fmtCredit           = fmtCredit;
window.addCommas           = addCommas;
window.getFederalHolidays  = getFederalHolidays;
window.nthWeekday          = nthWeekday;
window.lastWeekday         = lastWeekday;
window.toDateStr           = toDateStr;
window.isWeekend           = isWeekend;
window.isHoliday           = isHoliday;
window.getHolidayName      = getHolidayName;
window.stripCommas         = stripCommas;
window.calcTrueBreakEven   = calcTrueBreakEven;
window.tieredRate          = tieredRate;
window.flatRate            = flatRate;
window.getStateFees        = getStateFees;
window.formatDate          = formatDate;
window.formatTime          = formatTime;
window.STATE_TITLE_DATA    = STATE_TITLE_DATA;
window.STATE_LIST          = STATE_LIST;
window.exportToExcel       = exportToExcel;
window.exportToPDF         = exportToPDF;
