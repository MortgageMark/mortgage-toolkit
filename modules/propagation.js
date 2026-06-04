// modules/propagation.js
// No React hooks needed — pure DOM event system
// Extracted from mortgage-toolkit.html
// Sources: propagateLOToPreQual (lines 401–416), readLS/writeLS (lines 7986–7987), propagateSharedValues (lines 7989–8058)

const readLS = (k) => { try { const v = localStorage.getItem("mtk_" + k); return v !== null ? JSON.parse(v) : null; } catch { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem("mtk_" + k, JSON.stringify(v)); } catch {} };

function fmtPhoneDashes(val) {
  if (!val) return "";
  const d = String(val).replace(/\D/g, "");
  if (d.length === 10) return d.slice(0,3) + "-" + d.slice(3,6) + "-" + d.slice(6);
  if (d.length === 11 && d[0] === "1") return d.slice(1,4) + "-" + d.slice(4,7) + "-" + d.slice(7);
  return val;
}

function propagateLOToPreQual(member) {
  if (!member) return;
  const streetParts = [member.address].filter(Boolean);
  const stateZip = [member.state, member.zip].filter(Boolean).join(" ");
  const cityParts = [member.city, stateZip].filter(Boolean);
  const keys = {
    "mtk_pq_lo": member.name,
    "mtk_pq_lonmls": member.nmls || "",
    "mtk_pq_loph": fmtPhoneDashes(member.phone),
    "mtk_pq_loem": member.email_display || member.email || "",
    "mtk_pq_loaddr": streetParts.join(", "),
    "mtk_pq_loaddr2": cityParts.join(", "),
    "mtk_pq_lotitle": member.title || "",
    "mtk_pq_locell": fmtPhoneDashes(member.cell),
    "mtk_pq_lofax": fmtPhoneDashes(member.fax),
    "mtk_pq_loweb": member.website || "",
    "mtk_pq_brnmls": member.branchNmls || "",
    "mtk_pq_co": member.company || "",
    "mtk_pq_cnmls": member.companyNMLS || ""
  };
  Object.entries(keys).forEach(function(pair) {
    localStorage.setItem(pair[0], JSON.stringify(pair[1]));
  });
  window.dispatchEvent(new Event("mtk_propagated"));
}

function propagateSharedValues() {
  const hp = readLS("pc_hp");
  const la = readLS("pc_la");
  const rt = readLS("pc_rate");

  if (hp !== null) {
    writeLS("fs_pp", hp);
    writeLS("mc_hp", hp);
    writeLS("rvb_price", hp);
    writeLS("hel_value", hp);
    // sns_price intentionally NOT synced — Seller Net Sheet sales price is standalone
    writeLS("cce_price", parseFloat(hp) || 0);
    // pq_pp (Max Purchase Price) is intentionally NOT synced from pc_hp —
    // it's an LO-set authorization ceiling, independent of the PC home price.
    writeLS("lpc_price", hp);
    writeLS("ra_chv", hp);  // sync PC home value → Refi Analyzer home value
  }
  if (la !== null) {
    writeLS("fs_la", la);
    writeLS("am_la", la);
    writeLS("biw_loan", la);
    writeLS("be_lb", la);
    writeLS("cce_loan", parseFloat(la) || 0);
  }
  if (rt !== null) {
    writeLS("fs_rate", rt);
    writeLS("af_rate", rt);
    writeLS("am_rate", rt);
    writeLS("rvb_rate", rt);
    writeLS("biw_rate", rt);
    writeLS("hel_mrate", rt);
    writeLS("be_nr", rt);
    writeLS("cce_rate", parseFloat(rt) || 0);
    writeLS("ra_nr", rt);   // sync PC rate → Refi Analyzer new rate
  }
  const term = readLS("pc_term");
  if (term !== null) {
    writeLS("ra_nt", term);   // sync PC term → Refi Analyzer new term
  }

  if (la !== null && rt !== null) {
    const laNum = parseFloat(la) || 0;
    const hpNum = parseFloat(hp) || 0;
    const monthlyR = ((parseFloat(rt) || 0) / 100) / 12;
    const n = 360;
    const pi = monthlyR > 0 ? laNum * (monthlyR * Math.pow(1 + monthlyR, n)) / (Math.pow(1 + monthlyR, n) - 1) : laNum / n;
    writeLS("dti_pi", String(Math.round(pi)));

    const taxM = readLS("pc_taxm");
    const taxR = readLS("pc_taxr");
    const taxD = readLS("pc_tax");
    const pcState = readLS("pc_state");
    const pcOcc = readLS("pc_occ");
    const hse = pcState === "TX" && pcOcc === "primary";
    const taxBasis = hse ? hpNum * 0.70 : hpNum;
    const monthlyTaxProp = taxM === "rate" ? Math.round(taxBasis * ((parseFloat(taxR) || 0) / 100) / 12) : Math.round(parseFloat(taxD) || 0);
    writeLS("dti_tax", String(monthlyTaxProp));
    writeLS("fs_mt", String(monthlyTaxProp));

    const insM = readLS("pc_insm");
    const insR = readLS("pc_insr");
    const insD = readLS("pc_ins");
    const monthlyInsProp = insM === "rate" ? Math.round(hpNum * ((parseFloat(insR) || 0) / 100) / 12) : Math.round(parseFloat(insD) || 0);
    writeLS("dti_ins", String(monthlyInsProp));
    writeLS("fs_mi", String(monthlyInsProp));

    const dp = parseFloat(readLS("pc_dp")) || 0;
    const pmiR = parseFloat(readLS("pc_pmi")) || 0;
    const monthlyPMI = dp < 20 ? (laNum * pmiR / 100) / 12 : 0;
    writeLS("dti_pmi", String(Math.round(monthlyPMI)));
  }
  window.dispatchEvent(new Event("mtk_propagated"));
}

// Event listener setup — must be included exactly as written
window.addEventListener('mtk_values_changed', () => {
  propagateSharedValues();
});

window.propagateLOToPreQual = propagateLOToPreQual;
window.propagateSharedValues = propagateSharedValues;
