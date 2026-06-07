// modules/calculators/PreQualLetter.js
const useLocalStorage = window.useLocalStorage;
const LabeledInput = window.LabeledInput;
const COLORS = window.COLORS;
const font = window.font;
const fmt = window.fmt;
const formatPhone = window.formatPhone;
const LOSelector = window.LOSelector;
const SectionCard = window.SectionCard;
const Select = window.Select;
const Toggle = window.Toggle;
const Button = window.Button;
const savePQSnapshot = window.savePQSnapshot;
const fetchPQSnapshots = window.fetchPQSnapshots;
const useThemeColors = window.useThemeColors;
const sharePQLetter = window.sharePQLetter;
const fetchPQShares = window.fetchPQShares;
const supabase = window._supabaseClient;
const InfoTip = window.InfoTip;

function buildLetterId(seq) {
  const n = new Date();
  const ymd = n.getFullYear().toString()
    + String(n.getMonth() + 1).padStart(2, "0")
    + String(n.getDate()).padStart(2, "0");
  return "PQ-" + ymd + "-" + String(seq).padStart(4, "0");
}

function PreQualLetter({ user, scenario, isInternal, contact }) {
  const c = useThemeColors();
  const isClient = user?.role === "borrower";
  const isAdmin  = !!(user && user.role === "admin");

  // Collapse to single column on iPad and smaller (≤1024px)
  const [isNarrow, setIsNarrow] = React.useState(() => window.innerWidth <= 1024);
  React.useEffect(function() {
    function onResize() { setIsNarrow(window.innerWidth <= 1024); }
    window.addEventListener("resize", onResize);
    return function() { window.removeEventListener("resize", onResize); };
  }, []);
  const cols2 = isNarrow ? "1fr" : "1fr 1fr";

  // ── State ──
  const [purchasePrice, setPurchasePrice] = useLocalStorage("pq_pp", "");
  const [loanAmount, setLoanAmount] = useLocalStorage("pq_la", "");
  const [loanType, setLoanType] = useLocalStorage("pq_lt", "Conventional");
  const [loanTerm, setLoanTerm] = useLocalStorage("pq_lterm", "30 Year");
  const [maxRate, setMaxRate] = useLocalStorage("pq_mr", "");
  const [maxDTI, setMaxDTI] = useLocalStorage("pq_dti", "");
  const [company, setCompany] = useLocalStorage("pq_co", "");
  const [companyNMLS, setCompanyNMLS] = useLocalStorage("pq_cnmls", "");
  const [loName, setLoName] = useLocalStorage("pq_lo", "");
  const [loNMLS, setLoNMLS] = useLocalStorage("pq_lonmls", "");
  const [loPhone, setLoPhone] = useLocalStorage("pq_loph", "");
  const [loEmail, setLoEmail] = useLocalStorage("pq_loem", "");
  const [loAddress, setLoAddress] = useLocalStorage("pq_loaddr", "");
  const [branchNMLS, setBranchNMLS] = useLocalStorage("pq_brnmls", "");
  const [loTitle, setLoTitle] = useLocalStorage("pq_lotitle", "");
  const [loCell, setLoCell] = useLocalStorage("pq_locell", "");
  const [loFax, setLoFax] = useLocalStorage("pq_lofax", "");
  const [loWebsite, setLoWebsite] = useLocalStorage("pq_loweb", "");
  const [loAddrCity, setLoAddrCity] = useLocalStorage("pq_loaddr2", "");
  const [companyLogo, setCompanyLogo] = useLocalStorage("pq_company_logo", ""); // upper-left: company logo
  const [teamLogo,    setTeamLogo]    = useLocalStorage("pq_team_logo",    ""); // upper-right: LO team logo
  const [showLetter, setShowLetter] = React.useState(false);
  const [loSigCollapsed, setLoSigCollapsed] = React.useState(true);
  const [letterHistory, setLetterHistory] = React.useState([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [displaySnap, setDisplaySnap] = React.useState(null);
  const [showHistory, setShowHistory] = React.useState(false);

  // Send/email workflow state
  const [sendModal, setSendModal] = React.useState(null);       // snap object when modal open
  const [recipientName, setRecipientName] = React.useState("");
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [recipientType, setRecipientType] = React.useState("Realtor"); // Realtor | Self | Spouse | Other
  const [sendNote, setSendNote] = React.useState("");
  const [createContact, setCreateContact] = React.useState(false);
  const [shareHistory, setShareHistory] = React.useState([]);   // send log (pq_letter_shares)
  const [showShareLog, setShowShareLog] = React.useState(false);

  // Auto-save PQ params 2s after the LO changes them by asking MortgageToolkit
  // to do the save — it uses its own auth-aware save path, which handles RLS correctly.
  React.useEffect(() => {
    if (!isInternal) return; // only LOs trigger saves
    const t = setTimeout(function() {
      window.dispatchEvent(new Event("mtk_save_scenario"));
    }, 2000);
    return function() { clearTimeout(t); };
  }, [purchasePrice, loanAmount, maxRate, loanType, loanTerm]);

  // Reset generated-letter state when LO clears PQ params
  React.useEffect(() => {
    if (!purchasePrice || !loanAmount) {
      setShowLetter(false);
      setDisplaySnap(null);
    }
  }, [purchasePrice, loanAmount]);

  // LOSelector (child) dispatches mtk_propagated before this component's useLocalStorage
  // listeners are registered (React runs child effects before parent effects). Re-propagate
  // the selected LO here — by the time this parent effect runs, all listeners are ready.
  React.useEffect(() => {
    const memberId = (() => { try { return JSON.parse(localStorage.getItem("mtk_lo_selected")) || ""; } catch { return ""; } })();
    const roster   = (() => { try { return JSON.parse(localStorage.getItem("mtk_roster"))      || []; } catch { return []; } })();
    if (memberId && roster.length && window.propagateLOToPreQual) {
      const member = roster.find(function(m) { return m.id === memberId; });
      if (member) window.propagateLOToPreQual(member);
    }
  }, []);

  // Fetch letter history + share log when scenario changes
  React.useEffect(() => {
    if (!scenario || !scenario.id) {
      setLetterHistory([]);
      setShareHistory([]);
      return;
    }
    setHistoryLoading(true);
    Promise.all([
      fetchPQSnapshots(scenario.id),
      fetchPQShares(scenario.id),
    ]).then(([snapResult, shareResult]) => {
      setLetterHistory(snapResult.data || []);
      setShareHistory(shareResult.data || []);
    }).catch(() => {})
    .finally(() => setHistoryLoading(false));
  }, [scenario && scenario.id]);

  // provided-info toggles
  const [pIncome, setPIncome] = useLocalStorage("pq_p_inc", true);
  const [pCashToClose, setPCashToClose] = useLocalStorage("pq_p_ctc", true);
  const [pDebts, setPDebts] = useLocalStorage("pq_p_dbt", true);
  const [pAssets, setPAssets] = useLocalStorage("pq_p_ast", true);
  const [pOther, setPOther] = useLocalStorage("pq_p_oth", false);
  const [pOtherText, setPOtherText] = useLocalStorage("pq_p_othtxt", "");

  // contingency toggles
  // funds for down payment toggles
  const [fdpReady,    setFdpReady]    = useLocalStorage("pq_fdp_ready",    false);
  const [fdpGift,     setFdpGift]     = useLocalStorage("pq_fdp_gift",     false);
  const [fdpREOSale,  setFdpREOSale]  = useLocalStorage("pq_fdp_reosale",  false);
  const [fdpCashRefi, setFdpCashRefi] = useLocalStorage("pq_fdp_cashrefi", false);

  // contingency toggles
  const [cREO, setCREO] = useLocalStorage("pq_c_reo", false);
  const [cREONonConting, setCREONonConting] = useLocalStorage("pq_c_reo_nc", false);
  const [cCredit, setCCredit] = useLocalStorage("pq_c_cred", false);
  const [cCreditScore, setCCreditScore] = useLocalStorage("pq_c_credscore", false);
  const [cDebts, setCDebts] = useLocalStorage("pq_c_dbt", false);
  const [cDebtsClosing, setCDebtsClosing] = useLocalStorage("pq_c_dbtcl", false);
  const [cOther, setCOther] = useLocalStorage("pq_c_oth", false);
  const [cOtherText, setCOtherText] = useLocalStorage("pq_c_othtxt", "");

  // LO Heartburn toggles + editable text
  const [hbDTI,        setHbDTI]        = useLocalStorage("pq_hb_dti",         false);
  const [hbDTIText,    setHbDTIText]    = useLocalStorage("pq_hb_dti_txt",      "This borrower is qualifying near the upper limit of their debt-to-income ratio. The approval is solid as structured — any change in monthly obligations prior to closing would require re-evaluation before funding. This could include taking on a new car payment, opening a credit card, co-signing on another loan, or an adjustment to the projected housing payment due to a change in taxes, insurance, or HOA dues.");
  const [hbTiming,     setHbTiming]     = useLocalStorage("pq_hb_timing",       false);
  const [hbTimingText, setHbTimingText] = useLocalStorage("pq_hb_timing_txt",   "There is a timing dependency that must be addressed before this loan can close. A delay in resolving this item may directly impact the closing timeline. This could include waiting on the sale and closing of an existing home, the seasoning of recently transferred gift funds, a lease expiration that must occur first, or a new job start date that income cannot be counted until after.");
  const [hbDocs,       setHbDocs]       = useLocalStorage("pq_hb_docs",         false);
  const [hbDocsText,   setHbDocsText]   = useLocalStorage("pq_hb_docs_txt",     "Final approval depends on documentation that is not yet available. Any delay in receiving this document may impact the closing timeline. This could include a P&L statement not yet prepared, tax returns that have not been filed yet, a bank statement for a month that has not closed, a divorce decree still pending finalization, or a gift letter with supporting sourcing documentation.");
  const [hbCredit,     setHbCredit]     = useLocalStorage("pq_hb_credit",       false);
  const [hbCreditText, setHbCreditText] = useLocalStorage("pq_hb_credit_txt",   "Steps are currently being taken to strengthen the credit profile. Projected score improvements are estimates — final scores will be confirmed prior to submission and are not guaranteed. This may include a pay-for-delete negotiation on a collection account, removal of an authorized user tradeline, disputing inaccurate derogatory items, or paying down revolving balances to improve credit utilization.");
  const [hbIncome,     setHbIncome]     = useLocalStorage("pq_hb_income",       false);
  const [hbIncomeText, setHbIncomeText] = useLocalStorage("pq_hb_income_txt",   "Income qualification is based on a variable or non-traditional earning pattern. Any deviation from the documented income history would require re-review prior to closing. This may apply to self-employed borrowers whose income is averaged over two years of tax returns, commission or bonus income subject to continuity requirements, a recent job change even at higher pay, or rental income dependent on lease agreements and depreciation schedules.");
  const [hbAppr,       setHbAppr]       = useLocalStorage("pq_hb_appr",         false);
  const [hbApprText,   setHbApprText]   = useLocalStorage("pq_hb_appr_txt",     "This approval is sensitive to the appraised value of the subject property. A meaningful gap between the purchase price and the appraised value may require renegotiation or additional funds at closing. This is most common in new construction with limited comparable sales, unique or custom properties, markets where prices are moving faster than appraised values, or properties with condition issues that an appraiser may flag prior to funding.");

  // PQ Fields (borrower-facing)
  const [pqApplicant, setPqApplicant] = useLocalStorage("pq_applicant", "");
  const [bPurchasePrice, setBPurchasePrice] = useLocalStorage("pq_bpp", "");
  const [bLoanAmount, setBLoanAmount] = useLocalStorage("pq_bla", "");
  const [propertyAddress, setPropertyAddress] = useLocalStorage("pq_addr", "");
  const [bInterestRate, setBInterestRate] = useLocalStorage("pq_bir", "");
  const [bPoints, setBPoints] = useLocalStorage("pq_bpts", "");
  // Shared with Fee Sheet — writing here updates fs_dp there and vice versa
  const [discountPts, setDiscountPts] = useLocalStorage("fs_dp", "0");
  const [bClosingDate, setBClosingDate] = useLocalStorage("pq_bcd", (() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  })());

  // Clamped handlers for PQ Fields
  const handleBPurchasePrice = (val) => {
    const num = parseFloat(String(val).replace(/,/g, "")) || 0;
    const max = parseFloat(String(purchasePrice).replace(/,/g, ""));
    setBPurchasePrice(max && num > max ? String(max) : val);
  };
  const handleBLoanAmount = (val) => {
    const num = parseFloat(String(val).replace(/,/g, "")) || 0;
    const max = parseFloat(String(loanAmount).replace(/,/g, ""));
    setBLoanAmount(max && num > max ? String(max) : val);
  };
  const handleBInterestRate = (val) => {
    const num = parseFloat(val) || 0;
    const max = parseFloat(maxRate);
    setBInterestRate(max && num > max ? String(max) : val);
  };

  // ── Provided-info list builder ──
  const providedItems = [];
  if (pIncome) providedItems.push("Income");
  if (pCashToClose) providedItems.push("Available Cash to Close");
  if (pDebts) providedItems.push("Debts");
  if (pAssets) providedItems.push("Assets");
  if (pOther && pOtherText.trim()) providedItems.push(pOtherText.trim());
  const providedStr = providedItems.length > 0 ? providedItems.join(", ") : "None specified";

  // ── Funds for down payment list builder ──
  const fundsItems = [];
  if (fdpReady)    fundsItems.push("Liquid Accounts (ex: checking, savings, etc.)");
  if (fdpGift)     fundsItems.push("Semi-Liquid Accounts (ex: brokerage account, retirement account, etc.)");
  if (fdpREOSale)  fundsItems.push("Proceeds from the sale of Real Estate Owned (REO)");
  if (fdpCashRefi) fundsItems.push("Proceeds from the refinance of existing Real Estate Owned (REO)");
  const fundsStr = fundsItems.length > 0 ? fundsItems : null;

  // ── Contingencies list builder ──
  const contingencyItems = [];
  if (cREO) contingencyItems.push({ key: "REO", text: "An existing home will need to be sold, closed, and funded before this closing." });
  if (cREONonConting) contingencyItems.push({ key: "REO", text: "Existing home does NOT need to sell before closing. This loan is non contingent." });
  if (cCredit) contingencyItems.push({ key: "CREDIT", text: "The credit report will need to be updated — and acceptable — for underwriting." });
  if (cCreditScore) contingencyItems.push({ key: "CREDIT", text: "Credit scores MUST be increased before closing in order to qualify and close." });
  if (cDebts) contingencyItems.push({ key: "DEBTS (before closing)", text: "Existing debt(s) will need to be paid off before closing." });
  if (cDebtsClosing) contingencyItems.push({ key: "DEBTS (at closing)", text: "Existing debt(s) will need to be paid at closing." });
  if (cOther && cOtherText.trim()) contingencyItems.push({ key: "OTHER", text: cOtherText.trim() });

  // ── LO Heartburn items builder ──
  const heartburnItems = [];
  if (hbDTI    && hbDTIText.trim())    heartburnItems.push({ key: "DTI SENSITIVITY",    text: hbDTIText.trim() });
  if (hbTiming && hbTimingText.trim()) heartburnItems.push({ key: "TIMING",              text: hbTimingText.trim() });
  if (hbDocs   && hbDocsText.trim())   heartburnItems.push({ key: "PENDING DOCUMENTS",  text: hbDocsText.trim() });
  if (hbCredit && hbCreditText.trim()) heartburnItems.push({ key: "CREDIT IN PROGRESS", text: hbCreditText.trim() });
  if (hbIncome && hbIncomeText.trim()) heartburnItems.push({ key: "INCOME / EMPLOYMENT",text: hbIncomeText.trim() });
  if (hbAppr   && hbApprText.trim())   heartburnItems.push({ key: "APPRAISAL SENSITIVITY", text: hbApprText.trim() });

  // ── Client names (read-only for primary; writable for co-borrower) ──
  const [abtC1First]                    = useLocalStorage("abt_c1fn",    "");
  const [abtC1Last]                     = useLocalStorage("abt_c1ln",    "");
  const [abtC2First,  setAbtC2First]    = useLocalStorage("abt_c2fn",    "");
  const [abtC2Last,   setAbtC2Last]     = useLocalStorage("abt_c2ln",    "");
  const [abtC2OnLoan, setAbtC2OnLoan]   = useLocalStorage("abt_c2loan",  false);
  const [abtC2OnTitle,setAbtC2OnTitle]  = useLocalStorage("abt_c2title", false);

  // Applicant name comes from the linked Contact; co-borrower appended when on loan
  const primaryName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : [abtC1First, abtC1Last].filter(Boolean).join(" ");
  const coName = [abtC2First, abtC2Last].filter(Boolean).join(" ");
  const applicantLine = [primaryName, coName].filter(Boolean).join(" & ") || "—";

  // ── Live data object — passed to letterContent when no frozen snap is active ──
  const todayFormatted = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const liveData = {
    letterId:        null,
    letterDate:      todayFormatted,
    applicantLine:   applicantLine,
    company:         company,
    companyNMLS:     companyNMLS,
    propertyAddress: propertyAddress,
    purchasePrice:   bPurchasePrice || purchasePrice,
    loanAmount:      bLoanAmount || loanAmount,
    loanType:        loanType,
    loanTerm:        loanTerm,
    maxRate:         bInterestRate || maxRate,
    maxDTI:          maxDTI,
    points:          bPoints || discountPts || "0",
    providedStr:     providedStr,
    fundsStr:        fundsStr,
    contingencyItems: contingencyItems,
    heartburnItems:  heartburnItems,
    loName:          loName,
    loTitle:         loTitle,
    loAddress:       loAddress,
    loAddrCity:      loAddrCity,
    loPhone:         loPhone,
    loCell:          loCell,
    loFax:           loFax,
    loEmail:         loEmail,
    loWebsite:       loWebsite,
    loNMLS:          loNMLS,
    branchNMLS:      branchNMLS,
    companyLogo:     companyLogo,
    teamLogo:        teamLogo,
  };

  const sectionLabel = { fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.4px", color: "#999", marginBottom: "3px", fontWeight: 600 };
  const cardStyle = { background: "#f7f9fb", borderRadius: "5px", padding: "10px 14px", marginBottom: "10px" };
  const nameStyle = { fontSize: "15px", fontWeight: 700, color: COLORS.navy };
  const valStyle = { fontSize: "13px", color: "#333" };
  const labelStyle = { fontSize: "11px", color: "#888", marginBottom: "2px" };

  // ── EHL logo SVG (small) ──
  const ehlLogo = React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 28 31", width: 22, height: 25, style: { display: "inline-block", verticalAlign: "middle" } },
    React.createElement("path", { d: "M14 0L0 10.5V31H28V10.5L14 0ZM14 2.5L25.5 11V28.5H2.5V11L14 2.5Z", fill: "#333" }),
    React.createElement("text", { x: "14", y: "22", textAnchor: "middle", fontSize: "7", fontWeight: "bold", fill: "#333" }, "=")
  );

  // ── Letter Content — parameterized; accepts live or frozen data object ──
  const letterContent = (d) => React.createElement("div", {
    className: "mtk-prequal-letter",
    // LETTER PADDING — DO NOT CHANGE: 20px sides ≈ 0.21" at 760px canvas width
    // Combined with PDF margin of 0.25", total visible margin ≈ 0.46" — standard letter feel
    style: { maxWidth: "750px", margin: "0 auto", background: "#fff", borderRadius: "8px", padding: "24px 20px", fontFamily: font, color: "#333", fontSize: "13px", lineHeight: "1.6", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
  },
    (d.companyLogo || d.teamLogo) && React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" } },
      d.companyLogo
        ? React.createElement("img", { src: d.companyLogo, alt: d.company || "Company", style: { maxHeight: "60px", maxWidth: "200px", objectFit: "contain" } })
        : React.createElement("div", null),
      d.teamLogo
        ? React.createElement("img", { src: d.teamLogo, alt: "Team", style: { maxHeight: "60px", maxWidth: "160px", objectFit: "contain" } })
        : React.createElement("div", null)
    ),
    React.createElement("h1", { style: { fontSize: "20px", fontWeight: 700, color: COLORS.navy, margin: "0 0 8px 0", letterSpacing: "-0.3px", textAlign: "center" } }, "Conditional Pre-Qualification Letter"),
    React.createElement("div", { style: { height: "2px", background: "linear-gradient(to right, #1B8A5A, #1a5fa8)", marginBottom: "14px" } }),
    React.createElement("p", { style: { fontSize: "12px", color: "#777", margin: "0 0 12px 0", fontStyle: "italic" } },
      "This is not a loan approval or commitment to lend. Final approval is subject to full underwriting review."
    ),
    React.createElement("p", { style: { fontSize: "12px", color: "#555", margin: "0 0 10px 0" } }, d.letterDate),
    React.createElement("div", { style: { marginBottom: "10px" } },
      React.createElement("div", { style: { fontSize: "13px", marginBottom: "1px" } },
        React.createElement("strong", null, "APPLICANT: "),
        React.createElement("strong", { style: { color: "#333" } }, d.applicantLine)
      )
    ),
    React.createElement("div", { style: { fontSize: "13px", color: "#444", marginBottom: "10px" } },
      React.createElement("span", { style: { ...sectionLabel, display: "inline", marginBottom: 0 } }, "SUBJECT PROPERTY: "),
      React.createElement("span", null, d.propertyAddress || "TBD")
    ),
    React.createElement("div", { style: sectionLabel }, "LOAN DETAILS"),
    React.createElement("div", { style: { ...cardStyle, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" } },
      React.createElement("div", null,
        React.createElement("div", { style: labelStyle }, "Loan Type"),
        React.createElement("div", { style: valStyle }, d.loanType || "—")
      ),
      React.createElement("div", null,
        React.createElement("div", { style: labelStyle }, "Sales Price"),
        React.createElement("div", { style: valStyle }, d.purchasePrice ? fmt(d.purchasePrice) : "—")
      ),
      React.createElement("div", null,
        React.createElement("div", { style: labelStyle }, "Interest Rate"),
        React.createElement("div", { style: valStyle }, "Not Locked")
      ),
      React.createElement("div", null,
        React.createElement("div", { style: labelStyle }, "Term"),
        React.createElement("div", { style: valStyle }, d.loanTerm || "—")
      ),
      React.createElement("div", null,
        React.createElement("div", { style: labelStyle }, "Loan Amount"),
        React.createElement("div", { style: valStyle }, d.loanAmount ? fmt(d.loanAmount) : "—")
      ),
      React.createElement("div", null,
        React.createElement("div", { style: labelStyle }, "Discount Points"),
        React.createElement("div", { style: valStyle }, d.points != null && d.points !== "" ? d.points : "—")
      )
    ),
    React.createElement("div", { style: { marginBottom: "8px" } },
      React.createElement("div", { style: sectionLabel }, "INFORMATION PROVIDED"),
      React.createElement("div", { style: { fontSize: "13px", color: "#444" } }, d.providedStr)
    ),
    React.createElement("div", { style: sectionLabel }, "ELIGIBILITY DETERMINATION"),
    React.createElement("p", { style: { fontSize: "13px", color: "#444", margin: "0 0 10px 0" } },
      "Based on the information provided, the applicant(s) appear eligible for the financing described above, subject to satisfactory property appraisal, title review, and complete underwriting evaluation."
    ),
    React.createElement("div", { style: { border: "1px solid #e0e0e0", borderRadius: "5px", padding: "8px 12px", marginBottom: "10px" } },
      React.createElement("div", { style: { ...sectionLabel, color: "#c0392b", marginBottom: "4px" } }, "THIS IS NOT A LOAN APPROVAL — CONDITIONS FOR FINAL APPROVAL"),
      React.createElement("ul", { style: { margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#444", lineHeight: "1.6" } },
        React.createElement("li", null, "Acceptable property appraisal and title commitment"),
        React.createElement("li", null, "Satisfactory homeowner" + String.fromCharCode(8217) + "s insurance and flood determination"),
        React.createElement("li", null, "Compliance with all investor and agency guidelines"),
        React.createElement("li", null, "No material changes in financial condition prior to closing")
      )
    ),
    React.createElement("div", { className: "pq-footer", style: { borderTop: "1px solid #ddd", paddingTop: "10px", marginTop: "10px" } },
      React.createElement("div", { style: { marginBottom: "10px" } },
        d.loName ? React.createElement("div", { style: { ...nameStyle, marginBottom: "1px" } }, d.loName) : null,
        (d.loTitle || d.loNMLS) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } },
          [d.loTitle, d.loNMLS ? "NMLS: #" + d.loNMLS : null].filter(Boolean).join(", ")
        ) : null,
        (d.company || d.companyNMLS) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } },
          [d.company, d.companyNMLS ? "NMLS #" + d.companyNMLS : null].filter(Boolean).join(", ")
        ) : null,
        (d.loAddress || d.loAddrCity) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } },
          [d.loAddress, d.loAddrCity].filter(Boolean).join(", ")
        ) : null,
        (d.loPhone || d.loCell || d.loFax) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555", marginTop: "4px" } },
          [d.loPhone ? "Office: " + formatPhone(d.loPhone) : null, d.loCell ? "Cell: " + formatPhone(d.loCell) : null, d.loFax ? "Fax: " + formatPhone(d.loFax) : null].filter(Boolean).join("  |  ")
        ) : null,
        d.loEmail ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } }, d.loEmail) : null,
        d.loWebsite ? React.createElement("a", { href: d.loWebsite, style: { fontSize: "12.5px", color: "#1a5fa8", textDecoration: "none" } }, d.loWebsite) : null
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: "12px" } },
        React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: "34px", paddingTop: "1px" } },
          ehlLogo,
          React.createElement("span", { style: { fontSize: "6.5px", color: "#888", textAlign: "center", lineHeight: "1.2", marginTop: "3px", fontWeight: 600 } }, "EQUAL HOUSING", React.createElement("br"), "OPPORTUNITY")
        ),
        React.createElement("div", { style: { fontSize: "8.5px", color: "#888", lineHeight: "1.5", flex: 1 } },
          "This pre-approval is contingent upon, and subject to, the availability of this loan product and program in the secondary market from the issuance of this pre-approval through the closing and funding of the loan. CMG Home Loans reserves the right to revoke this pre-approval at any time if there is a change in your financial condition or credit history which would impair your ability to repay this obligation which would make you ineligible for the loan program, and/or if any information contained in your application is untrue, incomplete or incorrect. CMG Mortgage, Inc. dba CMG Home Loans, NMLS# 1820, is an equal housing lender. To verify our complete list of state licences, please visit ",
          React.createElement("a", { href: "https://www.cmgfi.com/corporate/licensing", style: { color: "#1B8A5A" } }, "www.cmgfi.com/corporate/licensing"),
          " and ",
          React.createElement("a", { href: "https://www.nmlsconsumeraccess.org", style: { color: "#1B8A5A" } }, "www.nmlsconsumeraccess.org"),
          "."
        )
      ),
      d.letterId ? React.createElement("div", { style: { marginTop: "5px", fontSize: "8px", color: "#bbb", textAlign: "right", letterSpacing: "0.5px" } },
        "Letter ID: " + d.letterId
      ) : null
    )
  );

  // ── Letter Page 2 — Funds & Contingencies (internal details, same branding) ──
  const letterPage2Content = (d) => {
    const hasFunds     = d.fundsStr && d.fundsStr.length > 0;
    const hasConting   = d.contingencyItems && d.contingencyItems.length > 0;
    const hasHeartburn = d.heartburnItems && d.heartburnItems.length > 0;
    if (!hasFunds && !hasConting && !hasHeartburn) return null;
    return React.createElement("div", {
      className: "mtk-prequal-letter",
      // LETTER PADDING — DO NOT CHANGE: 20px sides ≈ 0.21" at 760px canvas width
    // Combined with PDF margin of 0.25", total visible margin ≈ 0.46" — standard letter feel
    style: { maxWidth: "750px", margin: "0 auto", background: "#fff", borderRadius: "8px", padding: "24px 20px", fontFamily: font, color: "#333", fontSize: "13px", lineHeight: "1.6", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
    },
      // Header (same as page 1)
      React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontSize: "28px", fontWeight: 800, color: "#1B8A5A", letterSpacing: "-0.5px", lineHeight: "1" } }, "CMG"),
          React.createElement("div", { style: { fontSize: "9px", color: "#1B8A5A", textTransform: "uppercase", letterSpacing: "3.5px", fontWeight: 700, lineHeight: "1.2", marginTop: "2px" } }, "Home Loans")
        ),
        React.createElement("img", { src: "modules/images/mortgage-mark-logo.png", alt: "MortgageMark.com", style: { height: "71px", objectFit: "contain" } })
      ),
      React.createElement("h1", { style: { fontSize: "20px", fontWeight: 700, color: COLORS.navy, margin: "0 0 8px 0", letterSpacing: "-0.3px", textAlign: "center" } }, "Heartburn Letter"),
      React.createElement("div", { style: { height: "2px", background: "linear-gradient(to right, #1B8A5A, #1a5fa8)", marginBottom: "14px" } }),
      // Intro box
      React.createElement("div", { style: { background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: "6px", padding: "10px 14px", marginBottom: "14px" } },
        React.createElement("div", { style: { fontSize: "12px", color: "#78350f", fontWeight: 700, marginBottom: "3px" } }, "Important — Please Read"),
        React.createElement("p", { style: { fontSize: "12px", color: "#78350f", margin: 0 } },
          "This letter contains loan conditions and notable concerns for the applicant(s) listed below. Contingency items must be addressed prior to or at closing."
        )
      ),
      // Date + Applicant + Subject Property
      React.createElement("p", { style: { fontSize: "12px", color: "#555", margin: "0 0 10px 0" } }, d.letterDate),
      React.createElement("div", { style: { marginBottom: "10px" } },
        React.createElement("div", { style: { fontSize: "13px", marginBottom: "1px" } },
          React.createElement("strong", null, "APPLICANT: "),
          React.createElement("strong", { style: { color: "#333" } }, d.applicantLine)
        )
      ),
      React.createElement("div", { style: { fontSize: "13px", color: "#444", marginBottom: "10px" } },
        React.createElement("span", { style: { ...sectionLabel, display: "inline", marginBottom: 0 } }, "SUBJECT PROPERTY: "),
        React.createElement("span", null, d.propertyAddress || "TBD")
      ),
      // Funds for down payment
      hasFunds ? React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("div", { style: sectionLabel }, "SOURCE OF FUNDS FOR DOWN PAYMENT"),
        React.createElement("p", { style: { fontSize: "13px", color: "#444", margin: "0 0 4px 0" } }, "Funds for the down payment and closing costs will be coming from the following:"),
        React.createElement("ul", { style: { margin: 0, paddingLeft: "16px", fontSize: "13px", color: "#444", lineHeight: "1.6" } },
          d.fundsStr.map(function(item) { return React.createElement("li", { key: item }, item); })
        )
      ) : null,
      // Contingencies
      hasConting ? React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("div", { style: sectionLabel }, "CONTINGENCIES FOR LOAN APPROVAL"),
        React.createElement("ul", { style: { margin: "0 0 10px 0", paddingLeft: "16px", fontSize: "12px", color: "#444", lineHeight: "1.6" } },
          d.contingencyItems.map(function(item) {
            return React.createElement("li", { key: item.key },
              React.createElement("strong", null, item.key + ": "),
              item.text
            );
          })
        )
      ) : null,
      // Notable Mentions (LO Heartburn — internal only, rendered as professional notes)
      hasHeartburn ? React.createElement("div", { style: { marginBottom: "12px" } },
        React.createElement("div", { style: sectionLabel }, "NOTABLE MENTIONS"),
        React.createElement("div", { style: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "10px 14px" } },
          d.heartburnItems.map(function(item) {
            return React.createElement("div", { key: item.key, style: { marginBottom: "8px" } },
              React.createElement("div", { style: { fontSize: "10px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" } }, item.key),
              React.createElement("div", { style: { fontSize: "12px", color: "#374151", lineHeight: "1.6" } }, item.text)
            );
          })
        )
      ) : null,
      // Footer (same as page 1, "Page 2 of 2") — LO block moved inside, above disclaimer
      React.createElement("div", { className: "pq-footer", style: { borderTop: "1px solid #ddd", paddingTop: "10px", marginTop: "10px" } },
        // LO contact block — first inside footer, before disclaimer
        React.createElement("div", { style: { marginBottom: "10px" } },
          d.loName ? React.createElement("div", { style: { ...nameStyle, marginBottom: "1px" } }, d.loName) : null,
          (d.loTitle || d.loNMLS) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } },
            [d.loTitle, d.loNMLS ? "NMLS: #" + d.loNMLS : null].filter(Boolean).join(", ")
          ) : null,
          (d.company || d.companyNMLS) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } },
            [d.company, d.companyNMLS ? "NMLS #" + d.companyNMLS : null].filter(Boolean).join(", ")
          ) : null,
          (d.loAddress || d.loAddrCity) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } },
            [d.loAddress, d.loAddrCity].filter(Boolean).join(", ")
          ) : null,
          (d.loPhone || d.loCell || d.loFax) ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555", marginTop: "4px" } },
            [d.loPhone ? "Office: " + formatPhone(d.loPhone) : null, d.loCell ? "Cell: " + formatPhone(d.loCell) : null, d.loFax ? "Fax: " + formatPhone(d.loFax) : null].filter(Boolean).join("  |  ")
          ) : null,
          d.loEmail ? React.createElement("div", { style: { fontSize: "12.5px", color: "#555" } }, d.loEmail) : null,
          d.loWebsite ? React.createElement("a", { href: d.loWebsite, style: { fontSize: "12.5px", color: "#1a5fa8", textDecoration: "none" } }, d.loWebsite) : null
        ),
        React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: "12px" } },
          React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: "34px", paddingTop: "1px" } },
            ehlLogo,
            React.createElement("span", { style: { fontSize: "6.5px", color: "#888", textAlign: "center", lineHeight: "1.2", marginTop: "3px", fontWeight: 600 } }, "EQUAL HOUSING", React.createElement("br"), "OPPORTUNITY")
          ),
          React.createElement("div", { style: { fontSize: "8.5px", color: "#888", lineHeight: "1.5", flex: 1 } },
            "This pre-approval is contingent upon, and subject to, the availability of this loan product and program in the secondary market from the issuance of this pre-approval through the closing and funding of the loan. CMG Home Loans reserves the right to revoke this pre-approval at any time if there is a change in your financial condition or credit history which would impair your ability to repay this obligation which would make you ineligible for the loan program, and/or if any information contained in your application is untrue, incomplete or incorrect. CMG Mortgage, Inc. dba CMG Home Loans, NMLS# 1820, is an equal housing lender. To verify our complete list of state licences, please visit ",
            React.createElement("a", { href: "https://www.cmgfi.com/corporate/licensing", style: { color: "#1B8A5A" } }, "www.cmgfi.com/corporate/licensing"),
            " and ",
            React.createElement("a", { href: "https://www.nmlsconsumeraccess.org", style: { color: "#1B8A5A" } }, "www.nmlsconsumeraccess.org"),
            "."
          )
        ),
        React.createElement("div", { style: { marginTop: "5px", fontSize: "8px", color: "#bbb", textAlign: "right", letterSpacing: "0.5px" } },
          (d.letterId ? "Letter ID: " + d.letterId + "  ·  " : "") + "Page 2 of 2"
        )
      )
    );
  };

  // ── Input form ──
  const paramsReady = purchasePrice && loanAmount;

  const inputForm = () => React.createElement("div", { style: { maxWidth: 640 } },
    // Warning for non-internal users without params
    !isInternal && !paramsReady
      ? React.createElement("div", {
          style: { background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 8, padding: "16px 20px", marginBottom: 16, fontFamily: font }
        },
          React.createElement("div", { style: { fontWeight: 700, color: "#92400e", marginBottom: 4, fontSize: 14 } }, "Your PQ letter is not ready yet."),
          React.createElement("div", { style: { color: "#78350f", fontSize: 13 } }, "Please contact your loan officer to set up your pre-qualification parameters before generating a letter.")
        )
      : null,
    // Cards (single column)
    React.createElement("div", {
      style: { display: "grid", gridTemplateColumns: "1fr", gap: "12px", alignItems: "start" }
    },
      // Card 1: Customize PQ Letter (all users)
      React.createElement(SectionCard, { title: "Customize PQ Letter (Optional)" },
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: cols2, gap: "12px" } },
          React.createElement(LabeledInput, { label: "Purchase Price", value: bPurchasePrice, onChange: handleBPurchasePrice, prefix: "$", useCommas: true, hint: purchasePrice ? "Max: $" + Number(String(purchasePrice).replace(/,/g, "")).toLocaleString() : undefined, infoTip: "The maximum purchase price the buyer can be pre-qualified for. It's common practice to write the letter for the actual offer price rather than the maximum, so the seller doesn't know the buyer's full budget ceiling." }),
          React.createElement(LabeledInput, { label: "Loan Amount", value: bLoanAmount, onChange: handleBLoanAmount, prefix: "$", useCommas: true, hint: loanAmount ? "Max: $" + Number(String(loanAmount).replace(/,/g, "")).toLocaleString() : undefined, infoTip: "The maximum loan amount the buyer is pre-qualified for based on their income, debts, and credit profile. This is a preliminary estimate — the final approved amount is determined after full underwriting. The letter can be written for any amount up to this maximum." }),
          React.createElement(LabeledInput, { label: "Property Address (optional)", value: propertyAddress, onChange: setPropertyAddress, type: "text" }),
          React.createElement(LabeledInput, { label: "Closing Date", value: bClosingDate, onChange: setBClosingDate, type: "date", infoTip: "Pre-qualification letters typically expire in 60-90 days. After expiration, income, assets, and credit should be re-verified. Some lenders issue 30-day letters to encourage urgency." })
        ),
        React.createElement("div", { style: { borderTop: "1px solid #e2e8f0", marginTop: "16px", paddingTop: "16px" } },
          React.createElement("div", { style: { fontSize: "13px", fontWeight: 700, color: "#1e3a5f", marginBottom: "10px" } }, "Co-Borrower: Optional"),
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: cols2, gap: "12px", marginBottom: "10px" } },
            React.createElement(LabeledInput, { label: "First Name", value: abtC2First, onChange: setAbtC2First, type: "text", placeholder: "Co-borrower first name", infoTip: "The name(s) as they should appear on the letter. This should match their legal name as it appears on their ID and will appear on all loan documents." }),
            React.createElement(LabeledInput, { label: "Last Name",  value: abtC2Last,  onChange: setAbtC2Last,  type: "text", placeholder: "Co-borrower last name", infoTip: "The name(s) as they should appear on the letter. This should match their legal name as it appears on their ID and will appear on all loan documents." })
          ),
          React.createElement("div", {
            style: { fontSize: 12, color: "#64748b", background: "#f8fafc", padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }
          }, "Enter a co-borrower name above and it will appear on the letter automatically.")
        )
      ),
      // Card 2: PQ Parameters — editable for internal, read-only display for clients when params are set
      (isInternal || paramsReady) ? React.createElement(SectionCard, { title: "PQ Parameters (only LO can edit)" },
        isInternal
          ? React.createElement("div", { style: { display: "grid", gridTemplateColumns: cols2, gap: "12px" } },
              React.createElement(LabeledInput, { label: "Max Purchase Price", value: purchasePrice, onChange: setPurchasePrice, prefix: "$", useCommas: true, infoTip: "The maximum purchase price the buyer can be pre-qualified for. It's common practice to write the letter for the actual offer price rather than the maximum, so the seller doesn't know the buyer's full budget ceiling." }),
              React.createElement(LabeledInput, { label: "Max Loan Amount", value: loanAmount, onChange: setLoanAmount, prefix: "$", useCommas: true, infoTip: "The maximum loan amount the buyer is pre-qualified for based on their income, debts, and credit profile. This is a preliminary estimate — the final approved amount is determined after full underwriting. The letter can be written for any amount up to this maximum." }),
              React.createElement(Select, { label: "Loan Type", value: loanType, onChange: setLoanType, options: ["Conventional", "FHA", "VA", "USDA"].map(v => ({ value: v, label: v })) }),
              React.createElement(Select, { label: "Loan Term", value: loanTerm, onChange: setLoanTerm, options: ["30 Year", "20 Year", "15 Year", "10 Year"].map(v => ({ value: v, label: v })) })
            )
          : React.createElement("div", null,
              React.createElement("div", { style: { fontSize: 12, color: c.textSecondary || "#64748b", marginBottom: 12, fontStyle: "italic" } },
                "These parameters were set by your Loan Officer."
              ),
              React.createElement("div", { style: { display: "grid", gridTemplateColumns: cols2, gap: "10px 24px" } },
                [
                  { label: "Max Purchase Price", val: purchasePrice ? "$" + Number(String(purchasePrice).replace(/,/g, "")).toLocaleString("en-US") : "—" },
                  { label: "Max Loan Amount",    val: loanAmount    ? "$" + Number(String(loanAmount).replace(/,/g, "")).toLocaleString("en-US")    : "—" },
                  { label: "Loan Type",          val: loanType  || "—" },
                  { label: "Loan Term",          val: loanTerm  || "—" },
                ].map(function(item) {
                  return React.createElement("div", { key: item.label },
                    React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: c.textSecondary || "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 } }, item.label),
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: c.text || "#1B2A3B" } }, item.val)
                  );
                })
              )
            )
      ) : null,
    ),
    // Cards 3–5: full width, internal only
    !isInternal ? null : React.createElement(SectionCard, { title: "Documents (Internal)" },
      React.createElement(Toggle, { label: "Income", checked: pIncome, onChange: setPIncome }),
      React.createElement(Toggle, { label: "Available Cash to Close", checked: pCashToClose, onChange: setPCashToClose }),
      React.createElement(Toggle, { label: "Debts", checked: pDebts, onChange: setPDebts }),
      React.createElement(Toggle, { label: "Assets", checked: pAssets, onChange: setPAssets }),
      React.createElement(Toggle, { label: "Other", checked: pOther, onChange: setPOther }),
      pOther ? React.createElement(LabeledInput, { label: "Other (specify)", value: pOtherText, onChange: setPOtherText, type: "text" }) : null
    ),
    !isAdmin ? null : React.createElement(SectionCard, { title: "Source of Funds for Down Payment (Admin)" },
      React.createElement(Toggle, { label: "Liquid Accounts (ex: checking, savings, etc.)", checked: fdpReady, onChange: setFdpReady }),
      React.createElement(Toggle, { label: "Semi-Liquid Accounts (ex: brokerage account, retirement account, etc.)", checked: fdpGift, onChange: setFdpGift }),
      React.createElement(Toggle, { label: "Proceeds from the sale of Real Estate Owned (REO)", checked: fdpREOSale, onChange: setFdpREOSale }),
      React.createElement(Toggle, { label: "Proceeds from the refinance of existing Real Estate Owned (REO)", checked: fdpCashRefi, onChange: setFdpCashRefi })
    ),
    !isAdmin ? null : React.createElement(SectionCard, { title: "Contingencies (Admin)" },
      React.createElement(Toggle, { label: "REAL ESTATE OWNED (REO): existing home must sell/close/fund before this closing", checked: cREO, onChange: setCREO }),
      React.createElement(Toggle, { label: "REAL ESTATE OWNED (REO): existing home does NOT need to be sold before closing (i.e. this is not contingent)", checked: cREONonConting, onChange: setCREONonConting }),
      React.createElement(Toggle, { label: "CREDIT: credit report will need to be updated and acceptable for underwriting", checked: cCredit, onChange: setCCredit }),
      React.createElement(Toggle, { label: "CREDIT: credit scores MUST be increased before closing in order to qualify and close.", checked: cCreditScore, onChange: setCCreditScore }),
      React.createElement(Toggle, { label: "DEBTS (before closing): existing debt(s) must be paid off before closing", checked: cDebts, onChange: setCDebts }),
      React.createElement(Toggle, { label: "DEBTS (at closing): existing debt(s) will be paid at closing", checked: cDebtsClosing, onChange: setCDebtsClosing }),
      React.createElement(Toggle, { label: "OTHER", checked: cOther, onChange: setCOther }),
      cOther ? React.createElement(LabeledInput, { label: "Other contingency (specify)", value: cOtherText, onChange: setCOtherText, type: "text" }) : null
    ),
    // LO Heartburn — renders as "Notable Mentions" on the letter (admin only)
    !isAdmin ? null : React.createElement(SectionCard, { title: "LO Heartburn (Admin)" },
      React.createElement("div", { style: { fontSize: 12, color: "#6B7280", marginBottom: 12, lineHeight: 1.5 } },
        "Toggle items on to include them in the letter as \u201cNotable Mentions.\u201d Edit the text to fit the specific situation."
      ),
      ...[
        { checked: hbDTI,    setChecked: setHbDTI,    label: "DTI Sensitivity",       text: hbDTIText,    setText: setHbDTIText    },
        { checked: hbTiming, setChecked: setHbTiming, label: "Timing Dependency",     text: hbTimingText, setText: setHbTimingText  },
        { checked: hbDocs,   setChecked: setHbDocs,   label: "Pending Documents",     text: hbDocsText,   setText: setHbDocsText    },
        { checked: hbCredit, setChecked: setHbCredit, label: "Credit In Progress",    text: hbCreditText, setText: setHbCreditText  },
        { checked: hbIncome, setChecked: setHbIncome, label: "Income / Employment",   text: hbIncomeText, setText: setHbIncomeText  },
        { checked: hbAppr,   setChecked: setHbAppr,   label: "Appraisal Sensitivity", text: hbApprText,   setText: setHbApprText    },
      ].map(function(item) {
        return React.createElement("div", { key: item.label, style: { marginBottom: 10 } },
          React.createElement(Toggle, { label: item.label, checked: item.checked, onChange: item.setChecked }),
          item.checked ? React.createElement("textarea", {
            value: item.text,
            onChange: function(e) { item.setText(e.target.value); },
            rows: 3,
            style: {
              width: "100%", marginTop: 6, padding: "7px 10px",
              borderRadius: 6, border: "1px solid #d0d5dd",
              fontSize: 12, fontFamily: font, lineHeight: 1.5,
              boxSizing: "border-box", resize: "vertical", outline: "none",
              color: "#333", background: "#fff",
            }
          }) : null
        );
      })
    ),
    // Buttons: Print + Download PQ (all internal); Heartburn buttons admin-only
    !isInternal ? null : React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: "4px", marginBottom: "8px" } },
      React.createElement(Button, { label: "🖨️ Print PQ", small: true, onClick: () => printLetter() }),
      React.createElement(Button, { label: pdfLoading ? "Generating…" : "⬇️ Download PQ PDF", small: true, primary: true, onClick: downloadPDF, disabled: pdfLoading }),
      React.createElement(Button, { label: shareLoading ? "Preparing…" : "📤 Email PDF", small: true, primary: true, onClick: sharePDF, disabled: shareLoading }),
      isAdmin && React.createElement(Button, { label: "🖨️ Print Heartburn", small: true, onClick: () => printHeartburnLetter() }),
      isAdmin && React.createElement(Button, { label: "⬇️ Download Heartburn PDF", small: true, onClick: () => downloadHeartburnPDF() })
    ),
    // LOSelector + LO Signature — full width, internal only
    !isInternal ? null : React.createElement(React.Fragment, null,
      React.createElement(LOSelector, null),
      React.createElement(SectionCard, { title: "LO Signature Details (Internal)", collapsed: loSigCollapsed, onToggle: function() { setLoSigCollapsed(function(v) { return !v; }); } },
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: "12px" } },
          React.createElement(LabeledInput, { label: "LO Name", value: loName, onChange: setLoName, type: "text", placeholder: "e.g. Mark Ningard", infoTip: "The loan officer's name as it should appear on the letter. This is pulled from your profile settings — update it in the Pre-Qual Letter settings section." }),
          React.createElement(LabeledInput, { label: "Title / Role", value: loTitle, onChange: setLoTitle, type: "text", placeholder: "e.g. Senior Loan Officer" }),
          React.createElement(LabeledInput, { label: "LO NMLS #", value: loNMLS, onChange: setLoNMLS, type: "text", placeholder: "e.g. 729612", infoTip: "Your personal NMLS license number. Required to appear on all pre-qualification and pre-approval letters by law. Verify this matches your state licensing." }),
          React.createElement(LabeledInput, { label: "Company", value: company, onChange: setCompany, type: "text", placeholder: "e.g. CMG Home Loans" }),
          React.createElement(LabeledInput, { label: "Company NMLS #", value: companyNMLS, onChange: setCompanyNMLS, type: "text", placeholder: "e.g. 1820" }),
          React.createElement(LabeledInput, { label: "Branch NMLS #", value: branchNMLS, onChange: setBranchNMLS, type: "text", placeholder: "e.g. 123456" }),
          React.createElement(LabeledInput, { label: "Street Address", value: loAddress, onChange: setLoAddress, type: "text", placeholder: "e.g. 1234 Main St, Suite 100" }),
          React.createElement(LabeledInput, { label: "City, State, Zip", value: loAddrCity, onChange: setLoAddrCity, type: "text", placeholder: "e.g. Houston, TX 77001" }),
          React.createElement(LabeledInput, { label: "Office Phone", value: loPhone, onChange: setLoPhone, onBlur: function(v) { const d = String(v).replace(/\D/g,""); setLoPhone(d.length === 10 ? d.slice(0,3)+"-"+d.slice(3,6)+"-"+d.slice(6) : d.length === 11 && d[0]==="1" ? d.slice(1,4)+"-"+d.slice(4,7)+"-"+d.slice(7) : v); }, type: "text", placeholder: "XXX-XXX-XXXX" }),
          React.createElement(LabeledInput, { label: "Cell Phone", value: loCell, onChange: setLoCell, type: "text", placeholder: "(XXX) XXX-XXXX" }),
          React.createElement(LabeledInput, { label: "Fax", value: loFax, onChange: setLoFax, onBlur: function(v) { const d = String(v).replace(/\D/g,""); setLoFax(d.length === 10 ? d.slice(0,3)+"-"+d.slice(3,6)+"-"+d.slice(6) : d.length === 11 && d[0]==="1" ? d.slice(1,4)+"-"+d.slice(4,7)+"-"+d.slice(7) : v); }, type: "text", placeholder: "XXX-XXX-XXXX" }),
          React.createElement(LabeledInput, { label: "Display Email", value: loEmail, onChange: setLoEmail, type: "text", placeholder: "e.g. mark@cmghomeloans.com" }),
          React.createElement(LabeledInput, { label: "Website URL", value: loWebsite, onChange: setLoWebsite, type: "text", placeholder: "e.g. www.markningard.com" })
        )
      )
    ),
    // Auto-generate snapshot on mount / when params change (replaces manual Generate button)
    React.createElement(React.Fragment, null,
      React.createElement("div", { style: { display: "none" } },
      React.createElement(Button, { onClick: () => {
        const missing = [];
        if (!purchasePrice) missing.push("Max Purchase Price");
        if (!loanAmount)    missing.push("Max Loan Amount");
        if (missing.length > 0) { return; }
        const seq = letterHistory.length + 1;
        const id = buildLetterId(seq);
        const now = new Date();
        const date = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        const la = parseFloat(String(bLoanAmount || loanAmount).replace(/,/g, "")) || 0;
        const pp = parseFloat(String(bPurchasePrice || purchasePrice).replace(/,/g, "")) || 0;
        const ltv = pp > 0 ? ((la / pp) * 100).toFixed(1) + "%" : "—";
        const snap = {
          letterId:        id,
          createdAt:       now.toISOString(),
          scenarioId:      scenario ? scenario.id : "guest",
          applicantName:   applicantLine,
          loanAmount:      bLoanAmount || loanAmount,
          propertyValue:   bPurchasePrice || purchasePrice,
          ltv:             ltv,
          program:         loanType,
          rate:            bInterestRate || maxRate,
          term:            loanTerm,
          expirationDate:  bClosingDate,
          letterType:      "Pre-Qualification",
          loName:          loName,
          loNMLS:          loNMLS,
          loPhone:         loPhone,
          loEmail:         loEmail,
          // all fields needed to fully re-render the frozen letter
          letterDate:      date,
          applicantLine:   applicantLine,
          company:         company,
          companyNMLS:     companyNMLS,
          propertyAddress: propertyAddress,
          loanType:        loanType,
          loanTerm:        loanTerm,
          maxRate:         bInterestRate || maxRate,
          maxDTI:          maxDTI,
          points:          bPoints || "0",
          purchasePrice:   bPurchasePrice || purchasePrice,
          providedStr:     providedStr,
          fundsStr:        fundsStr,
          contingencyItems: contingencyItems,
          heartburnItems:  heartburnItems,
          loAddress:       loAddress,
          loAddrCity:      loAddrCity,
          loTitle:         loTitle,
          loCell:          loCell,
          loFax:           loFax,
          loWebsite:       loWebsite,
          branchNMLS:      branchNMLS,
          companyLogo:     companyLogo,
          teamLogo:        teamLogo,
        };
        setDisplaySnap(snap);
        setShowLetter(true);
        savePQSnapshot(snap).then(({ error }) => {
          if (!error) {
            setLetterHistory(prev => [{ id: id, letter_id: id, created_at: now.toISOString(), snapshot: snap }, ...prev]);
          } else {
            console.warn("PQ snapshot save failed:", error);
          }
        }).catch(err => console.warn("PQ snapshot save error:", err));
        window.dispatchEvent(new Event("mtk_save_scenario"));
      }, label: "Generate", primary: true })
      ))  // hidden generate button kept for snapshot logic
  );

  // ── Letter History section ──
  const letterHistorySection = () => {
    if (!scenario || !scenario.id) return null;
    return React.createElement("div", { style: { marginTop: "28px" } },
      React.createElement("div", {
        onClick: () => setShowHistory(h => !h),
        style: { fontSize: "11px", fontWeight: 700, color: c.navy, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", userSelect: "none" }
      },
        React.createElement("span", null, showHistory ? "▾" : "▸"),
        React.createElement("span", null, "Previously Generated Letters"),
        letterHistory.length > 0 ? React.createElement("span", { style: { fontWeight: 400, color: "#888", textTransform: "none", letterSpacing: "normal" } }, "(" + letterHistory.length + ")") : null
      ),
      showHistory && (
        historyLoading
          ? React.createElement("div", { style: { fontSize: "11px", color: "#888" } }, "Loading…")
          : letterHistory.length === 0
            ? React.createElement("div", { style: { fontSize: "11px", color: "#aaa", paddingLeft: "16px" } }, "No letters generated yet for this scenario.")
            : React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "11px" } },
                React.createElement("thead", null,
                  React.createElement("tr", { style: { borderBottom: "1px solid #e0e0e0", color: "#888" } },
                    React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Letter ID"),
                    React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Generated"),
                    React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Applicant"),
                    React.createElement("th", { style: { textAlign: "right", padding: "4px 8px", fontWeight: 600 } }, "Loan Amount"),
                    React.createElement("th", { style: { textAlign: "center", padding: "4px 8px", fontWeight: 600 } }, "")
                  )
                ),
                React.createElement("tbody", null,
                  letterHistory.map(row => {
                    const s = row.snapshot || {};
                    const ts = row.created_at ? new Date(row.created_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "—";
                    return React.createElement("tr", { key: row.id, style: { borderBottom: "1px solid #f0f0f0" } },
                      React.createElement("td", { style: { padding: "5px 8px", fontFamily: "monospace", color: c.navy, fontWeight: 600 } }, row.letter_id),
                      React.createElement("td", { style: { padding: "5px 8px", color: "#555" } }, ts),
                      React.createElement("td", { style: { padding: "5px 8px", color: "#555" } }, s.applicantName || "—"),
                      React.createElement("td", { style: { padding: "5px 8px", textAlign: "right", color: "#555" } }, s.loanAmount ? fmt(s.loanAmount) : "—"),
                      React.createElement("td", { style: { padding: "5px 8px", textAlign: "center" } },
                        React.createElement("div", { style: { display: "flex", gap: "6px", justifyContent: "center" } },
                          React.createElement(Button, { label: "⬇️ PDF", small: true, onClick: () => {
                            setDisplaySnap(s);
                            setShowLetter(true);
                            setTimeout(() => downloadPDF(), 300);
                          }}),
                          React.createElement(Button, { label: "📧 Email", small: true, onClick: () => {
                            setSendModal(s);
                            setRecipientName("");
                            setRecipientEmail("");
                            setRecipientType("Realtor");
                            setSendNote("");
                            setCreateContact(false);
                          }})
                        )
                      )
                    );
                  })
                )
              )
      )
    );
  };

  // ── Send Log section ──
  const sendLogSection = () => {
    if (!scenario || !scenario.id) return null;
    return React.createElement("div", { style: { marginTop: "18px" } },
      React.createElement("div", {
        onClick: () => setShowShareLog(v => !v),
        style: { fontSize: "11px", fontWeight: 700, color: c.navy, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", userSelect: "none" }
      },
        React.createElement("span", null, showShareLog ? "▾" : "▸"),
        React.createElement("span", null, "Send Log"),
        shareHistory.length > 0 ? React.createElement("span", { style: { fontWeight: 400, color: "#888", textTransform: "none", letterSpacing: "normal" } }, "(" + shareHistory.length + ")") : null
      ),
      showShareLog && (
        shareHistory.length === 0
          ? React.createElement("div", { style: { fontSize: "11px", color: "#aaa", paddingLeft: "16px" } }, "No letters sent yet for this scenario.")
          : React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "11px" } },
              React.createElement("thead", null,
                React.createElement("tr", { style: { borderBottom: "1px solid #e0e0e0", color: "#888" } },
                  React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Letter ID"),
                  React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Sent"),
                  React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Realtor"),
                  React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Email"),
                  React.createElement("th", { style: { textAlign: "left", padding: "4px 8px", fontWeight: 600 } }, "Note")
                )
              ),
              React.createElement("tbody", null,
                shareHistory.map(row => {
                  const ts = row.sent_at ? new Date(row.sent_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "—";
                  return React.createElement("tr", { key: row.id, style: { borderBottom: "1px solid #f0f0f0" } },
                    React.createElement("td", { style: { padding: "5px 8px", fontFamily: "monospace", color: c.navy, fontWeight: 600 } }, row.letter_id),
                    React.createElement("td", { style: { padding: "5px 8px", color: "#555" } }, ts),
                    React.createElement("td", { style: { padding: "5px 8px", color: "#555" } }, row.realtor_name || "—"),
                    React.createElement("td", { style: { padding: "5px 8px", color: "#555" } }, row.realtor_email || "—"),
                    React.createElement("td", { style: { padding: "5px 8px", color: "#888", fontStyle: row.note ? "normal" : "italic" } }, row.note || "—")
                  );
                })
              )
            )
      )
    );
  };

  // ── Send / Email modal (enhanced share with optional contact creation) ──
  const sendModalEl = () => {
    if (!sendModal) return null;
    const sm = sendModal;
    const lid = sm.letterId || sm.letter_id || "";
    const inputSt = { width: "100%", padding: "7px 10px", borderRadius: "5px", border: "1px solid " + (c.border || "#d0d5dd"), fontSize: "12px", boxSizing: "border-box", fontFamily: font, outline: "none", color: "#333", background: "#fff" };
    const TYPES = ["Realtor", "Self", "Spouse", "Other"];

    const handleSend = async () => {
      const email = recipientEmail.trim();
      if (!email) return;

      // Optionally create contact in Supabase
      if (createContact && recipientName.trim() && supabase) {
        try {
          const parts = recipientName.trim().split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "";
          const catMap = { Realtor: "Realtor", Self: "Client", Spouse: "Client", Other: "Other" };
          const typeMap = { Realtor: "business", Self: "client", Spouse: "client", Other: "client" };
          await supabase.from("contacts").insert({
            first_name: firstName,
            last_name: lastName,
            email: email.toLowerCase(),
            contact_type: typeMap[recipientType] || "client",
            contact_category: catMap[recipientType] || "Other",
            status: "active",
            tags: [],
            notes: "Added from PQ Letter send — " + new Date().toLocaleDateString(),
          });
        } catch (err) {
          console.warn("Contact creation from PQ send failed:", err);
        }
      }

      // Build mailto body
      const appName = sm.applicantName || sm.applicantLine || "—";
      const la = sm.loanAmount ? fmt(sm.loanAmount) : "—";
      const prog = sm.program || sm.loanType || "—";
      const genDate = sm.letterDate
        ? sm.letterDate
        : sm.createdAt
          ? new Date(sm.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : "—";
      const sig = [sm.loName, sm.loNMLS ? "NMLS #" + sm.loNMLS : null, sm.loPhone || sm.loCell, sm.loEmail].filter(Boolean).join(" · ");
      const bodyLines = [
        "Applicant: " + appName,
        "Loan Amount: " + la,
        "Program: " + prog,
        "Letter ID: " + lid,
        "Generated: " + genDate,
      ];
      if (sendNote.trim()) bodyLines.push("Note: " + sendNote.trim());
      if (sig) { bodyLines.push(""); bodyLines.push("Loan Officer: " + sig); }
      const subject = encodeURIComponent("Pre-Qualification Letter " + lid + " \u2014 " + appName);
      const body = encodeURIComponent(bodyLines.join("\n"));
      window.open("mailto:" + email + "?subject=" + subject + "&body=" + body);

      // Log the send
      const scenId = scenario ? scenario.id : "guest";
      sharePQLetter({
        letterId:     lid,
        scenarioId:   scenId,
        realtorName:  recipientName.trim(),
        realtorEmail: email,
        note:         (recipientType !== "Realtor" ? "[" + recipientType + "] " : "") + sendNote.trim(),
      }).catch(() => {});

      // Optimistic update to send log
      setShareHistory(prev => [{
        id:           Date.now().toString(),
        letter_id:    lid,
        sent_at:      new Date().toISOString(),
        realtor_name: recipientName.trim(),
        realtor_email: email,
        note:         sendNote.trim(),
      }, ...prev]);

      setSendModal(null);
      setRecipientName("");
      setRecipientEmail("");
      setSendNote("");
      setCreateContact(false);
    };

    const canCreate = recipientName.trim().length > 0 && recipientEmail.trim().length > 0;

    return React.createElement("div", {
      style: { position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" },
      onClick: (e) => { if (e.target === e.currentTarget) setSendModal(null); }
    },
      React.createElement("div", {
        style: { background: "#fff", borderRadius: "12px", padding: "28px 32px", width: "460px", maxWidth: "92vw", boxShadow: "0 8px 32px rgba(0,0,0,0.22)", fontFamily: font }
      },
        // Header
        React.createElement("div", { style: { fontSize: "16px", fontWeight: 700, color: c.navy || COLORS.navy, marginBottom: "3px" } }, "📧 Email Letter"),
        React.createElement("div", { style: { fontSize: "11px", color: "#888", marginBottom: "18px", fontFamily: "monospace" } }, lid),

        // Recipient type pills
        React.createElement("div", { style: { marginBottom: "14px" } },
          React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" } }, "Send To"),
          React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
            TYPES.map(t => React.createElement("button", {
              key: t,
              onClick: () => setRecipientType(t),
              style: {
                padding: "5px 14px", borderRadius: "20px", border: "1.5px solid " + (recipientType === t ? (c.navy || COLORS.navy) : "#d0d5dd"),
                background: recipientType === t ? (c.navy || COLORS.navy) : "#fff",
                color: recipientType === t ? "#fff" : "#555",
                fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: font,
              }
            }, t))
          )
        ),

        // Name
        React.createElement("div", { style: { marginBottom: "12px" } },
          React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" } },
            recipientType === "Self" ? "Your Name" : recipientType === "Spouse" ? "Spouse Name" : "Recipient Name"
          ),
          React.createElement("input", { style: inputSt, placeholder: "Full name", value: recipientName, onChange: e => setRecipientName(e.target.value) })
        ),

        // Email
        React.createElement("div", { style: { marginBottom: "12px" } },
          React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" } }, "Email Address *"),
          React.createElement("input", { style: inputSt, type: "email", placeholder: recipientType === "Realtor" ? "agent@brokerage.com" : "you@email.com", value: recipientEmail, onChange: e => setRecipientEmail(e.target.value) })
        ),

        // Note
        React.createElement("div", { style: { marginBottom: "16px" } },
          React.createElement("div", { style: { fontSize: "10px", color: "#888", marginBottom: "4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" } }, "Message (optional)"),
          React.createElement("textarea", { style: { ...inputSt, resize: "vertical", minHeight: "56px" }, placeholder: "Any notes to include in the email…", value: sendNote, onChange: e => setSendNote(e.target.value) })
        ),

        // Add as contact toggle (only show when name + email filled)
        canCreate && React.createElement("div", {
          style: { background: "#f0f4ff", borderRadius: "8px", padding: "10px 14px", marginBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" },
          onClick: () => setCreateContact(v => !v)
        },
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: "12px", fontWeight: 700, color: COLORS.navy } },
              "Save " + recipientName.trim().split(" ")[0] + " as a Contact"
            ),
            React.createElement("div", { style: { fontSize: "10px", color: "#666", marginTop: "2px" } },
              "Add to your " + recipientType + " contacts list"
            )
          ),
          React.createElement("div", {
            style: { width: 36, height: 20, borderRadius: 10, background: createContact ? "#22c55e" : "#d1d5db", position: "relative", flexShrink: 0, transition: "background 0.2s" }
          },
            React.createElement("div", {
              style: { position: "absolute", top: 2, left: createContact ? 17 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }
            })
          )
        ),

        // Action buttons
        React.createElement("div", { style: { display: "flex", gap: "10px", justifyContent: "flex-end" } },
          React.createElement(Button, { label: "Cancel", small: true, onClick: () => setSendModal(null) }),
          React.createElement(Button, {
            label: "Open Email Client →",
            primary: true, small: true,
            onClick: handleSend,
          })
        )
      )
    );
  };

  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [shareLoading, setShareLoading] = React.useState(false);

  // ── PDF DOWNLOAD ─────────────────────────────────────────────────────────────
  // Strategy: mutate the live element directly before capture, restore after.
  // This bypasses onclone entirely — what you set IS what gets captured.
  // PDF page: 8.5"×11" letter | margins: 0.25" all sides | content: 8.0"×10.5"
  // Canvas: element forced to exactly 760px wide before capture → no ambiguity.
  // ─────────────────────────────────────────────────────────────────────────────
  async function captureToPDF(elementId, fileName) {
    const wrapper = document.getElementById(elementId);
    if (!wrapper || !window.html2canvas || !window.jspdf) return;
    const el = wrapper.querySelector(".mtk-prequal-letter") || wrapper;

    // Save original inline styles
    const savedStyle = el.getAttribute("style") || "";

    // Force exact dimensions and clean appearance
    el.style.cssText = [
      savedStyle,
      "width:760px !important",
      "max-width:760px !important",
      "min-width:760px !important",
      "margin:0 !important",
      "box-shadow:none !important",
      "border-radius:0 !important",
      "zoom:1 !important",
      "transform:none !important",
      "padding:24px 20px !important",
    ].join(";");

    try {
      const { jsPDF } = window.jspdf;
      const pdf     = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
      const margin  = 0.25;
      const pageW   = 8.5;
      const pageH   = 11;
      const printW  = pageW - margin * 2;  // 8.0"
      const maxH    = pageH - margin * 2;  // 10.5"

      const canvas  = await window.html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
        logging: false,
      });

      const ratio   = canvas.height / canvas.width;
      const imgH    = Math.min(printW * ratio, maxH);
      const imgW    = imgH < maxH ? printW : maxH / ratio;

      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
      pdf.save(fileName + ".pdf");
    } catch(e) {
      console.error("PDF error:", e);
    }

    // Restore original styles
    if (savedStyle) el.setAttribute("style", savedStyle);
    else el.removeAttribute("style");
  }

  // ── CAPTURE TO BLOB (for sharing) ────────────────────────────────────────────
  async function captureToPDFBlob(elementId) {
    const wrapper = document.getElementById(elementId);
    if (!wrapper || !window.html2canvas || !window.jspdf) return null;
    const el = wrapper.querySelector(".mtk-prequal-letter") || wrapper;
    const savedStyle = el.getAttribute("style") || "";
    el.style.cssText = [
      savedStyle,
      "width:760px !important", "max-width:760px !important", "min-width:760px !important",
      "margin:0 !important", "box-shadow:none !important", "border-radius:0 !important",
      "zoom:1 !important", "transform:none !important", "padding:24px 20px !important",
    ].join(";");
    let blob = null;
    try {
      const { jsPDF } = window.jspdf;
      const pdf    = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
      const margin = 0.25, printW = 8.0, maxH = 10.5;
      const canvas = await window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
      const ratio  = canvas.height / canvas.width;
      const imgH   = Math.min(printW * ratio, maxH);
      const imgW   = imgH < maxH ? printW : maxH / ratio;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
      blob = pdf.output("blob");
    } catch(e) {
      console.error("PDF blob error:", e);
    }
    if (savedStyle) el.setAttribute("style", savedStyle);
    else el.removeAttribute("style");
    return blob;
  }

  // ── BUILD EMAIL SUBJECT + BODY ────────────────────────────────────────────────
  function buildEmailContent(d) {
    const name   = d.applicantLine || "Borrower";
    const pp     = d.purchasePrice ? parseFloat(String(d.purchasePrice).replace(/,/g,"")) : 0;
    const la     = d.loanAmount    ? parseFloat(String(d.loanAmount).replace(/,/g,""))    : 0;
    const dpPct  = pp > 0 && la > 0 ? Math.round((1 - la / pp) * 100) : null;
    const prog   = d.loanType  || "Conventional";
    const term   = d.loanTerm  || "30 Year";
    const ppFmt  = pp > 0 ? "$" + pp.toLocaleString("en-US") : null;
    const laFmt  = la > 0 ? "$" + la.toLocaleString("en-US") : null;
    const dpStr  = dpPct !== null ? dpPct + "% down" : null;

    const subjectParts = ["Pre-Qualification Letter for " + name];
    if (ppFmt) subjectParts.push(ppFmt);
    if (dpStr) subjectParts.push(dpStr);
    if (prog)  subjectParts.push(prog + " Loan");
    const subject = subjectParts.join(" · ");

    const bodyLines = [
      "Please find the attached Pre-Qualification Letter for " + name + ".",
      "",
    ];
    if (ppFmt) bodyLines.push("Sales Price:   " + ppFmt);
    if (laFmt) bodyLines.push("Loan Amount:   " + laFmt);
    if (dpStr) bodyLines.push("Down Payment:  " + dpStr);
    bodyLines.push("Loan Program:  " + prog + " — " + term);
    if (d.propertyAddress) bodyLines.push("Property:      " + d.propertyAddress);
    bodyLines.push("");
    bodyLines.push("This letter is valid as of today's date and is subject to full underwriting review.");
    bodyLines.push("");
    const loSig = [d.loName, d.loTitle, d.loNMLS ? "NMLS #" + d.loNMLS : null, d.loCell || d.loPhone, d.loEmail].filter(Boolean);
    if (loSig.length) { bodyLines.push(...loSig); }

    return { subject, body: bodyLines.join("\n"), fileName: name.replace(/\s+/g, "-") + "-PreQual-Letter" };
  }

  // ── SHARE / EMAIL PDF ─────────────────────────────────────────────────────────
  // Mobile (Web Share API with files): opens native share sheet with PDF attached.
  // Desktop fallback: downloads PDF + opens pre-filled mailto link.
  const sharePDF = async () => {
    setShareLoading(true);
    const d = activeData;
    const { subject, body, fileName } = buildEmailContent(d);
    const blob = await captureToPDFBlob("pq-letter-page1");
    setShareLoading(false);
    if (!blob) { alert("PDF generation failed. Please try again."); return; }

    const file = new File([blob], fileName + ".pdf", { type: "application/pdf" });

    // Try Web Share API with file (works on iOS Safari, Android Chrome)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: subject, text: body });
        return;
      } catch(e) {
        if (e.name === "AbortError") return; // user cancelled — don't fall through to download
      }
    }

    // Desktop fallback: download PDF + open mailto
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName + ".pdf"; a.click();
    URL.revokeObjectURL(url);

    // Open pre-filled email after a brief delay so the download starts first
    setTimeout(function() {
      window.location.href = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body + "\n\n(Attach the downloaded PDF file to this email.)");
    }, 800);
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    const name = (activeData.applicantLine || "PreQual").replace(/\s+/g, "-");
    await captureToPDF("pq-letter-page1", name + "-PQ-Letter");
    setPdfLoading(false);
  };

  const downloadHeartburnPDF = async () => {
    const name = (activeData.applicantLine || "Concerns").replace(/\s+/g, "-");
    await captureToPDF("pq-letter-page2", name + "-Heartburn-Letter");
  };

  const printLetter = () => {
    const el = document.getElementById("pq-letter-print");
    if (!el) return;
    const css = [
      "@page { size: letter; margin: 0.35in 0.4in; }",
      "html, body { margin: 0; padding: 0; }",
      "* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }",
      "a { color: #1B8A5A !important; }",
      "#pq-letter-print { overflow: visible !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; }",
      ".mtk-prequal-letter { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }"
    ].join(" ");
    const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const win = window.open("", "_blank", "width=900,height=750");
    win.document.write("<!DOCTYPE html><html><head><base href=\"" + baseHref + "\"><title>Pre-Qualification Letter</title><style>" + css + "</style></head><body>" + el.outerHTML + "</body></html>");
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const printHeartburnLetter = () => {
    const el = document.getElementById("pq-heartburn-print");
    if (!el) return;
    const css = [
      "@page { size: letter; margin: 0.35in 0.4in; }",
      "html, body { margin: 0; padding: 0; }",
      "* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }",
      "a { color: #1B8A5A !important; }",
      ".mtk-prequal-letter { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }"
    ].join(" ");
    const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const win = window.open("", "_blank", "width=900,height=750");
    win.document.write("<!DOCTYPE html><html><head><base href=\"" + baseHref + "\"><title>Heartburn Letter</title><style>" + css + "</style></head><body>" + el.outerHTML + "</body></html>");
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const activeData = displaySnap || liveData;

  return React.createElement("div", null,
    // Hidden heartburn container — always present when there's content
    letterPage2Content(activeData)
      ? React.createElement("div", {
          id: "pq-heartburn-print",
          style: { position: "absolute", left: "-9999px", top: 0, width: "760px", overflow: "hidden", pointerEvents: "none" }
        },
          React.createElement("div", { id: "pq-letter-page2" }, letterPage2Content(activeData))
        )
      : null,

    // Two-column layout: form left, live letter preview right
    React.createElement("div", {
      className: "mtk-grid-2",
      style: { display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "minmax(300px, 640px) 1fr", gap: "24px", alignItems: "start" }
    },

      // ── LEFT column: form + history + share log
      React.createElement("div", null,
        inputForm(),
        letterHistorySection(),
        sendLogSection()
      ),

      // ── RIGHT column: always-visible letter preview
      React.createElement("div", { style: { position: "sticky", top: 16 } },

        // Action bar — client download + archived letter navigation
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 } },
          displaySnap
            ? React.createElement("div", { style: { fontSize: 12, color: "#888", fontStyle: "italic", fontFamily: font } }, "Archived: " + (displaySnap.letterId || ""))
            : React.createElement("div", null),
          React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
            !isInternal && React.createElement(Button, { label: pdfLoading ? "Generating..." : "⬇️ Download PDF", small: true, primary: true, onClick: downloadPDF, disabled: pdfLoading }),
            React.createElement(Button, { label: shareLoading ? "Preparing…" : "📤 Email PDF", small: true, primary: true, onClick: sharePDF, disabled: shareLoading }),
            displaySnap && React.createElement(Button, { label: "Back to Live", small: true, onClick: () => { setDisplaySnap(null); } })
          )
        ),

        // Letter preview + SAMPLE watermark
        React.createElement("div", { style: { position: "relative" } },
          React.createElement("div", {
            id: "pq-letter-print",
            style: { border: "1px solid " + COLORS.border, borderRadius: "10px", overflow: "hidden" }
          },
            React.createElement("div", { id: "pq-letter-page1" }, letterContent(activeData))
          ),
          // SAMPLE overlay — shown when params not set OR letter not yet generated
          (!showLetter || !paramsReady) && React.createElement("div", {
            style: {
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", zIndex: 5, overflow: "hidden", borderRadius: "10px"
            }
          },
            React.createElement("div", {
              style: {
                fontSize: 130, fontWeight: 900,
                color: "rgba(180, 30, 30, 0.13)",
                transform: "rotate(-35deg)",
                letterSpacing: 14, userSelect: "none",
                whiteSpace: "nowrap", fontFamily: "Arial, sans-serif"
              }
            }, "SAMPLE")
          )
        )
      )
    ),

    sendModalEl()
  );
}

window.PreQualLetter = PreQualLetter;
