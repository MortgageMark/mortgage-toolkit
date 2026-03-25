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

function buildLetterId(seq) {
  const n = new Date();
  const ymd = n.getFullYear().toString()
    + String(n.getMonth() + 1).padStart(2, "0")
    + String(n.getDate()).padStart(2, "0");
  return "PQ-" + ymd + "-" + String(seq).padStart(4, "0");
}

function PreQualLetter({ user, scenario, isInternal }) {
  const c = useThemeColors();
  const isClient = user?.role === "borrower";

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
  const [showLetter, setShowLetter] = React.useState(false);
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
  const [cREO, setCREO] = useLocalStorage("pq_c_reo", false);
  const [cCredit, setCCredit] = useLocalStorage("pq_c_cred", false);
  const [cDebts, setCDebts] = useLocalStorage("pq_c_dbt", false);
  const [cDebtsClosing, setCDebtsClosing] = useLocalStorage("pq_c_dbtcl", false);
  const [cOther, setCOther] = useLocalStorage("pq_c_oth", false);
  const [cOtherText, setCOtherText] = useLocalStorage("pq_c_othtxt", "");

  // PQ Fields (borrower-facing)
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

  // ── Contingencies list builder ──
  const contingencyItems = [];
  if (cREO) contingencyItems.push({ key: "REO", text: "An existing home will need to be sold, closed, and funded before this closing." });
  if (cCredit) contingencyItems.push({ key: "CREDIT", text: "The credit report will need to be updated — and acceptable — for underwriting." });
  if (cDebts) contingencyItems.push({ key: "DEBTS (before closing)", text: "Existing debt(s) will need to be paid off before closing." });
  if (cDebtsClosing) contingencyItems.push({ key: "DEBTS (at closing)", text: "Existing debt(s) will need to be paid at closing." });
  if (cOther && cOtherText.trim()) contingencyItems.push({ key: "OTHER", text: cOtherText.trim() });

  // ── About tab client names (read-only) ──
  const [abtC1First]  = useLocalStorage("abt_c1fn", "");
  const [abtC1Last]   = useLocalStorage("abt_c1ln", "");
  const [abtC2First]  = useLocalStorage("abt_c2fn", "");
  const [abtC2Last]   = useLocalStorage("abt_c2ln", "");
  const [abtC2OnLoan] = useLocalStorage("abt_c2loan", false);

  const c1Name = [abtC1First, abtC1Last].filter(Boolean).join(" ");
  const c2Name = abtC2OnLoan ? [abtC2First, abtC2Last].filter(Boolean).join(" ") : "";
  const applicantLine = c1Name
    ? (c2Name ? c1Name + " & " + c2Name : c1Name)
    : "—";

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
    purchasePrice:   bPurchasePrice || purchasePrice,
    providedStr:     providedStr,
    contingencyItems: contingencyItems,
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
  };

  const sectionLabel = { fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "1.4px", color: "#999", marginBottom: "2px", fontWeight: 600 };
  const cardStyle = { background: "#f7f9fb", borderRadius: "5px", padding: "8px 12px", marginBottom: "8px" };
  const nameStyle = { fontSize: "12.5px", fontWeight: 700, color: COLORS.navy };
  const valStyle = { fontSize: "11.5px", color: "#333" };
  const labelStyle = { fontSize: "9.5px", color: "#888", marginBottom: "1px" };

  // ── EHL logo SVG (small) ──
  const ehlLogo = React.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 28 31", width: 22, height: 25, style: { display: "inline-block", verticalAlign: "middle" } },
    React.createElement("path", { d: "M14 0L0 10.5V31H28V10.5L14 0ZM14 2.5L25.5 11V28.5H2.5V11L14 2.5Z", fill: "#333" }),
    React.createElement("text", { x: "14", y: "22", textAnchor: "middle", fontSize: "7", fontWeight: "bold", fill: "#333" }, "=")
  );

  // ── Letter Content — parameterized; accepts live or frozen data object ──
  const letterContent = (d) => React.createElement("div", {
    className: "mtk-prequal-letter",
    style: { maxWidth: "750px", margin: "0 auto", background: "#fff", borderRadius: "8px", padding: "18px 24px", fontFamily: font, color: "#333", fontSize: "11.5px", lineHeight: "1.5", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
  },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: "28px", fontWeight: 800, color: "#1B8A5A", letterSpacing: "-0.5px", lineHeight: "1" } }, "CMG"),
        React.createElement("div", { style: { fontSize: "9px", color: "#1B8A5A", textTransform: "uppercase", letterSpacing: "3.5px", fontWeight: 700, lineHeight: "1.2", marginTop: "2px" } }, "Home Loans")
      ),
      React.createElement("img", { src: "modules/images/mortgage-mark-logo.png", alt: "MortgageMark.com", style: { height: "71px", objectFit: "contain" } })
    ),
    React.createElement("h1", { style: { fontSize: "17px", fontWeight: 700, color: COLORS.navy, margin: "0 0 6px 0", letterSpacing: "-0.3px", textAlign: "center" } }, "Conditional Pre-Qualification Letter"),
    React.createElement("div", { style: { height: "2px", background: "linear-gradient(to right, #1B8A5A, #1a5fa8)", marginBottom: "12px" } }),
    React.createElement("p", { style: { fontSize: "10.5px", color: "#777", margin: "0 0 10px 0", fontStyle: "italic" } },
      "This is not a loan approval or commitment to lend. Final approval is subject to full underwriting review."
    ),
    React.createElement("p", { style: { fontSize: "10.5px", color: "#555", margin: "0 0 8px 0" } }, d.letterDate),
    React.createElement("div", { style: { marginBottom: "8px" } },
      React.createElement("div", { style: { fontSize: "11px", marginBottom: "1px" } },
        React.createElement("strong", null, "APPLICANT: "),
        React.createElement("strong", { style: { color: "#333" } }, d.applicantLine)
      )
    ),
    React.createElement("div", { style: { fontSize: "11px", color: "#444", marginBottom: "8px" } },
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
        React.createElement("div", { style: valStyle }, d.maxRate ? d.maxRate + "%" : "—")
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
      React.createElement("div", { style: { fontSize: "11px", color: "#444" } }, d.providedStr)
    ),
    React.createElement("div", { style: sectionLabel }, "ELIGIBILITY DETERMINATION"),
    React.createElement("p", { style: { fontSize: "11px", color: "#444", margin: "0 0 8px 0" } },
      "Based on the information provided, the applicant(s) appear eligible for the financing described above, subject to satisfactory property appraisal, title review, and complete underwriting evaluation."
    ),
    React.createElement("div", { style: { border: "1px solid #e0e0e0", borderRadius: "5px", padding: "6px 10px", marginBottom: "8px" } },
      React.createElement("div", { style: { ...sectionLabel, color: "#c0392b", marginBottom: "4px" } }, "THIS IS NOT A LOAN APPROVAL — CONDITIONS FOR FINAL APPROVAL"),
      React.createElement("ul", { style: { margin: 0, paddingLeft: "16px", fontSize: "10.5px", color: "#444", lineHeight: "1.55" } },
        React.createElement("li", null, "Acceptable property appraisal and title commitment"),
        React.createElement("li", null, "Satisfactory homeowner" + String.fromCharCode(8217) + "s insurance and flood determination"),
        React.createElement("li", null, "Compliance with all investor and agency guidelines"),
        React.createElement("li", null, "No material changes in financial condition prior to closing")
      )
    ),
    d.contingencyItems && d.contingencyItems.length > 0
      ? React.createElement(React.Fragment, null,
          React.createElement("div", { style: sectionLabel }, "CONTINGENCIES FOR LOAN APPROVAL"),
          React.createElement("ul", { style: { margin: "0 0 8px 0", paddingLeft: "16px", fontSize: "11px", color: "#444", lineHeight: "1.55" } },
            d.contingencyItems.map(function(item) {
              return React.createElement("li", { key: item.key },
                React.createElement("strong", null, item.key + ": "),
                item.text
              );
            })
          )
        )
      : null,
    React.createElement("div", { style: { marginTop: "14px", marginBottom: "10px" } },
      d.loName ? React.createElement("div", { style: { ...nameStyle, marginBottom: "1px" } }, d.loName) : null,
      (d.loTitle || d.loNMLS) ? React.createElement("div", { style: { fontSize: "11px", color: "#555" } },
        [d.loTitle, d.loNMLS ? "NMLS: #" + d.loNMLS : null].filter(Boolean).join(", ")
      ) : null,
      (d.company || d.companyNMLS) ? React.createElement("div", { style: { fontSize: "11px", color: "#555" } },
        [d.company, d.companyNMLS ? "NMLS #" + d.companyNMLS : null].filter(Boolean).join(", ")
      ) : null,
      (d.loAddress || d.loAddrCity) ? React.createElement("div", { style: { fontSize: "11px", color: "#555" } },
        [d.loAddress, d.loAddrCity].filter(Boolean).join(", ")
      ) : null,
      (d.loPhone || d.loCell || d.loFax) ? React.createElement("div", { style: { fontSize: "11px", color: "#555", marginTop: "3px" } },
        [d.loPhone ? "Office: " + formatPhone(d.loPhone) : null, d.loCell ? "Cell: " + formatPhone(d.loCell) : null, d.loFax ? "Fax: " + formatPhone(d.loFax) : null].filter(Boolean).join("  |  ")
      ) : null,
      d.loEmail ? React.createElement("div", { style: { fontSize: "11px", color: "#555" } }, d.loEmail) : null,
      d.loWebsite ? React.createElement("a", { href: d.loWebsite, style: { fontSize: "11px", color: "#1a5fa8", textDecoration: "none" } }, d.loWebsite) : null
    ),
    React.createElement("div", { className: "pq-footer", style: { borderTop: "1px solid #ddd", paddingTop: "8px", marginTop: "6px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: "12px" } },
        React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: "34px", paddingTop: "1px" } },
          ehlLogo,
          React.createElement("span", { style: { fontSize: "5.5px", color: "#888", textAlign: "center", lineHeight: "1.2", marginTop: "3px", fontWeight: 600 } }, "EQUAL HOUSING", React.createElement("br"), "OPPORTUNITY")
        ),
        React.createElement("div", { style: { fontSize: "7.5px", color: "#888", lineHeight: "1.5", flex: 1 } },
          "This pre-approval is contingent upon, and subject to, the availability of this loan product and program in the secondary market from the issuance of this pre-approval through the closing and funding of the loan. CMG Home Loans reserves the right to revoke this pre-approval at any time if there is a change in your financial condition or credit history which would impair your ability to repay this obligation which would make you ineligible for the loan program, and/or if any information contained in your application is untrue, incomplete or incorrect. CMG Mortgage, Inc. dba CMG Home Loans, NMLS# 1820, is an equal housing lender. To verify our complete list of state licences, please visit ",
          React.createElement("a", { href: "https://www.cmgfi.com/corporate/licensing", style: { color: "#1B8A5A" } }, "www.cmgfi.com/corporate/licensing"),
          " and ",
          React.createElement("a", { href: "https://www.nmlsconsumeraccess.org", style: { color: "#1B8A5A" } }, "www.nmlsconsumeraccess.org"),
          "."
        )
      ),
      d.letterId ? React.createElement("div", { style: { marginTop: "5px", fontSize: "7px", color: "#bbb", textAlign: "right", letterSpacing: "0.5px" } },
        "Letter ID: " + d.letterId
      ) : null
    )
  );

  // ── Input form ──
  const inputForm = () => React.createElement(React.Fragment, null,
    React.createElement(SectionCard, { title: "Optional: Enter values for the PQ letter" },
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" } },
        React.createElement(LabeledInput, { label: "Purchase Price", value: bPurchasePrice, onChange: handleBPurchasePrice, prefix: "$", useCommas: true, hint: purchasePrice ? "Max: $" + Number(String(purchasePrice).replace(/,/g, "")).toLocaleString() : undefined }),
        React.createElement(LabeledInput, { label: "Interest Rate (%)", value: bInterestRate, onChange: handleBInterestRate, hint: maxRate ? "Max: " + maxRate + "%" : undefined }),
        React.createElement(LabeledInput, { label: "Property Address (optional)", value: propertyAddress, onChange: setPropertyAddress, type: "text" }),
        React.createElement(LabeledInput, { label: "Loan Amount", value: bLoanAmount, onChange: handleBLoanAmount, prefix: "$", useCommas: true, hint: loanAmount ? "Max: $" + Number(String(loanAmount).replace(/,/g, "")).toLocaleString() : undefined }),
        React.createElement(LabeledInput, { label: "Points Paid", value: bPoints, onChange: setBPoints }),
        React.createElement(LabeledInput, { label: "Closing Date", value: bClosingDate, onChange: setBClosingDate, type: "date" })
      )
    ),
    React.createElement("div", { style: isClient ? { pointerEvents: "none", opacity: 0.55, userSelect: "none" } : {} },
    React.createElement(SectionCard, { title: "Internal: PQ Parameters" },
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" } },
        React.createElement(LabeledInput, { label: "Max Purchase Price", value: purchasePrice, onChange: setPurchasePrice, prefix: "$", useCommas: true }),
        React.createElement(LabeledInput, { label: "Max Interest Rate (%)", value: maxRate, onChange: setMaxRate }),
        React.createElement(Select, { label: "Loan Type", value: loanType, onChange: setLoanType, options: ["Conventional", "FHA", "VA", "USDA"].map(v => ({ value: v, label: v })) }),
        React.createElement(LabeledInput, { label: "Max Loan Amount", value: loanAmount, onChange: setLoanAmount, prefix: "$", useCommas: true }),
        React.createElement(LabeledInput, { label: "Discount Points", value: discountPts, onChange: setDiscountPts, suffix: "pts", hint: "Synced with Fee Sheet" }),
        React.createElement(Select, { label: "Loan Term", value: loanTerm, onChange: setLoanTerm, options: ["30 Year", "20 Year", "15 Year", "10 Year"].map(v => ({ value: v, label: v })) })
      )
    ),
    React.createElement("div", { style: { marginBottom: "16px" } },
      React.createElement(SectionCard, { title: "Internal: Documentation Reviewed" },
        React.createElement(Toggle, { label: "Income", checked: pIncome, onChange: setPIncome }),
        React.createElement(Toggle, { label: "Available Cash to Close", checked: pCashToClose, onChange: setPCashToClose }),
        React.createElement(Toggle, { label: "Debts", checked: pDebts, onChange: setPDebts }),
        React.createElement(Toggle, { label: "Assets", checked: pAssets, onChange: setPAssets }),
        React.createElement(Toggle, { label: "Other", checked: pOther, onChange: setPOther }),
        pOther ? React.createElement(LabeledInput, { label: "Other (specify)", value: pOtherText, onChange: setPOtherText, type: "text" }) : null
      )
    ),
    React.createElement(SectionCard, { title: "Internal: Contingencies" },
      React.createElement(Toggle, { label: "REAL ESTATE OWNED (REO): existing home must sell/close/fund before this closing", checked: cREO, onChange: setCREO }),
      React.createElement(Toggle, { label: "CREDIT: credit report will need to be updated and acceptable for underwriting", checked: cCredit, onChange: setCCredit }),
      React.createElement(Toggle, { label: "DEBTS (before closing): existing debt(s) must be paid off before closing", checked: cDebts, onChange: setCDebts }),
      React.createElement(Toggle, { label: "DEBTS (at closing): existing debt(s) will be paid at closing", checked: cDebtsClosing, onChange: setCDebtsClosing }),
      React.createElement(Toggle, { label: "OTHER", checked: cOther, onChange: setCOther }),
      cOther ? React.createElement(LabeledInput, { label: "Other contingency (specify)", value: cOtherText, onChange: setCOtherText, type: "text" }) : null
    ),
    React.createElement(LOSelector, null),
    React.createElement(SectionCard, { title: "LO Signature Details" },
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" } },
        React.createElement(LabeledInput, { label: "LO Name", value: loName, onChange: setLoName, type: "text", placeholder: "e.g. Mark Ningard" }),
        React.createElement(LabeledInput, { label: "Title / Role", value: loTitle, onChange: setLoTitle, type: "text", placeholder: "e.g. Senior Loan Officer" }),
        React.createElement(LabeledInput, { label: "LO NMLS #", value: loNMLS, onChange: setLoNMLS, type: "text", placeholder: "e.g. 729612" }),
        React.createElement(LabeledInput, { label: "Company", value: company, onChange: setCompany, type: "text", placeholder: "e.g. CMG Home Loans" }),
        React.createElement(LabeledInput, { label: "Company NMLS #", value: companyNMLS, onChange: setCompanyNMLS, type: "text", placeholder: "e.g. 1820" }),
        React.createElement(LabeledInput, { label: "Branch NMLS #", value: branchNMLS, onChange: setBranchNMLS, type: "text", placeholder: "e.g. 123456" }),
        React.createElement(LabeledInput, { label: "Street Address", value: loAddress, onChange: setLoAddress, type: "text", placeholder: "e.g. 1234 Main St, Suite 100" }),
        React.createElement(LabeledInput, { label: "City, State, Zip", value: loAddrCity, onChange: setLoAddrCity, type: "text", placeholder: "e.g. Houston, TX 77001" }),
        React.createElement(LabeledInput, { label: "Office Phone", value: loPhone, onChange: setLoPhone, type: "text", placeholder: "(XXX) XXX-XXXX" }),
        React.createElement(LabeledInput, { label: "Cell Phone", value: loCell, onChange: setLoCell, type: "text", placeholder: "(XXX) XXX-XXXX" }),
        React.createElement(LabeledInput, { label: "Fax", value: loFax, onChange: setLoFax, type: "text", placeholder: "(XXX) XXX-XXXX" }),
        React.createElement(LabeledInput, { label: "Email", value: loEmail, onChange: setLoEmail, type: "text", placeholder: "e.g. mark@cmghomeloans.com" }),
        React.createElement(LabeledInput, { label: "Website URL", value: loWebsite, onChange: setLoWebsite, type: "text", placeholder: "e.g. www.markningard.com" })
      )
    )
    ),
    React.createElement("div", { style: { display: "flex", gap: "12px", justifyContent: "flex-end" } },
      React.createElement(Button, { onClick: () => {
        const missing = [];
        if (!purchasePrice) missing.push("Max Purchase Price");
        if (!loanAmount) missing.push("Max Loan Amount");
        if (!maxRate) missing.push("Max Interest Rate");
        if (missing.length > 0) {
          alert("Cannot generate letter. Please fill in the following required fields in Internal: PQ Parameters:\n\n• " + missing.join("\n• "));
          return;
        }
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
          contingencyItems: contingencyItems,
          loAddress:       loAddress,
          loAddrCity:      loAddrCity,
          loTitle:         loTitle,
          loCell:          loCell,
          loFax:           loFax,
          loWebsite:       loWebsite,
          branchNMLS:      branchNMLS,
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
      }, label: "Generate", primary: true })
    )
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
                          isInternal && React.createElement(Button, { label: "Re-export PDF", small: true, onClick: () => {
                            setDisplaySnap(s);
                            setShowLetter(true);
                            setTimeout(() => printLetter(), 100);
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

  const printLetter = () => {
    const el = document.getElementById("pq-letter-print");
    if (!el) return;
    const css = [
      "@page { size: letter; margin: 0; }",
      "html, body { margin: 0; padding: 0; width: 8.5in; }",
      "body { padding: 0.45in 0.55in; box-sizing: border-box; }",
      "* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }",
      "a { color: #1B8A5A !important; }",
      "#pq-letter-print { overflow: visible !important; border: none !important; border-radius: 0 !important; }"
    ].join(" ");
    const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const win = window.open("", "_blank", "width=900,height=750");
    win.document.write("<!DOCTYPE html><html><head><base href=\"" + baseHref + "\"><title>Pre-Qualification Letter</title><style>" + css + "</style></head><body>" + el.outerHTML + "</body></html>");
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const activeData = displaySnap || liveData;

  return React.createElement("div", null,
    inputForm(),
    showLetter && React.createElement("div", { style: { marginTop: "24px" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" } },
        displaySnap
          ? React.createElement("div", { style: { fontSize: "11px", color: "#888", fontStyle: "italic" } },
              "Viewing archived letter: " + (displaySnap.letterId || "")
            )
          : React.createElement("div", null),
        React.createElement("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          React.createElement(Button, { label: "📧 Email Letter", small: true, primary: true, onClick: () => {
            const snap = displaySnap || liveData;
            setSendModal(snap);
            setRecipientName("");
            setRecipientEmail("");
            setRecipientType("Realtor");
            setSendNote("");
            setCreateContact(false);
          }}),
          isInternal && React.createElement(Button, { label: "🖨️ Save / Print PDF", small: true, onClick: () => printLetter() }),
          React.createElement(Button, { label: "Close Preview", small: true, onClick: () => { setShowLetter(false); setDisplaySnap(null); } })
        )
      ),
      React.createElement("div", { id: "pq-letter-print", style: { border: "1px solid " + COLORS.border, borderRadius: "10px", overflow: "hidden" } },
        letterContent(activeData)
      )
    ),
    letterHistorySection(),
    sendLogSection(),
    sendModalEl()
  );
}

window.PreQualLetter = PreQualLetter;
