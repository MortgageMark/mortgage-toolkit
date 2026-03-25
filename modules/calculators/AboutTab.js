// modules/calculators/AboutTab.js
const useLocalStorage = window.useLocalStorage;
const useThemeColors = window.useThemeColors;
const SectionCard = window.SectionCard;
const LabeledInput = window.LabeledInput;
const Select = window.Select;
const Toggle = window.Toggle;

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
}

function AboutTab() {
  const c = useThemeColors();

  // ── Client 1 ──
  const [c1FirstName, setC1FirstName] = useLocalStorage("abt_c1fn", "");
  const [c1Nickname, setC1Nickname]   = useLocalStorage("abt_c1nick", "");
  const [c1LastName, setC1LastName]   = useLocalStorage("abt_c1ln", "");
  const [c1Email, setC1Email]         = useLocalStorage("abt_c1em", "");
  const [c1Phone, setC1Phone]         = useLocalStorage("abt_c1ph", "");
  const [c1Address, setC1Address]     = useLocalStorage("abt_c1addr", "");

  // ── Client 2 ──
  const [c2FirstName, setC2FirstName]   = useLocalStorage("abt_c2fn", "");
  const [c2Nickname, setC2Nickname]     = useLocalStorage("abt_c2nick", "");
  const [c2LastName, setC2LastName]     = useLocalStorage("abt_c2ln", "");
  const [c2Email, setC2Email]           = useLocalStorage("abt_c2em", "");
  const [c2Phone, setC2Phone]           = useLocalStorage("abt_c2ph", "");
  const [c2Address, setC2Address]       = useLocalStorage("abt_c2addr", "");
  const [c2Relationship, setC2Relationship] = useLocalStorage("abt_c2rel", "Spouse");
  const [c2OnLoan, setC2OnLoan]         = useLocalStorage("abt_c2loan", false);
  const [c2OnTitle, setC2OnTitle]       = useLocalStorage("abt_c2title", false);

  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };

  return React.createElement(React.Fragment, null,

    React.createElement(SectionCard, { title: "Client 1" },
      React.createElement("div", { style: grid2 },
        React.createElement(LabeledInput, { label: "First Name", value: c1FirstName, onChange: setC1FirstName, type: "text" }),
        React.createElement(LabeledInput, { label: "Cell Phone", value: c1Phone, onChange: v => setC1Phone(formatPhone(v)), type: "text" }),
        React.createElement(LabeledInput, { label: "Nickname (optional)", value: c1Nickname, onChange: setC1Nickname, type: "text" }),
        React.createElement(LabeledInput, { label: "Email Address", value: c1Email, onChange: setC1Email, type: "text" }),
        React.createElement(LabeledInput, { label: "Last Name", value: c1LastName, onChange: setC1LastName, type: "text" }),
        React.createElement(LabeledInput, { label: "Home Address", value: c1Address, onChange: setC1Address, type: "text" })
      )
    ),

    React.createElement(SectionCard, { title: "Client 2" },
      React.createElement("div", { style: grid2 },
        React.createElement(LabeledInput, { label: "First Name", value: c2FirstName, onChange: setC2FirstName, type: "text" }),
        React.createElement(LabeledInput, { label: "Cell Phone", value: c2Phone, onChange: v => setC2Phone(formatPhone(v)), type: "text" }),
        React.createElement(LabeledInput, { label: "Nickname (optional)", value: c2Nickname, onChange: setC2Nickname, type: "text" }),
        React.createElement(LabeledInput, { label: "Email Address", value: c2Email, onChange: setC2Email, type: "text" }),
        React.createElement(LabeledInput, { label: "Last Name", value: c2LastName, onChange: setC2LastName, type: "text" }),
        React.createElement(LabeledInput, { label: "Home Address", value: c2Address, onChange: setC2Address, type: "text" })
      ),
      React.createElement("div", { style: { marginTop: "12px" } },
        React.createElement(Select, {
          label: "Relationship to Client 1",
          value: c2Relationship,
          onChange: setC2Relationship,
          options: ["Spouse", "Parent", "Child", "Family Member", "Other"].map(v => ({ value: v, label: v }))
        })
      ),
      React.createElement("div", { style: { marginTop: "12px" } },
        React.createElement(Toggle, { label: "Will Client 2 be on the loan?", checked: c2OnLoan, onChange: setC2OnLoan }),
        React.createElement(Toggle, { label: "Will Client 2 be on Title?", checked: c2OnTitle, onChange: setC2OnTitle })
      )
    )
  );
}

window.AboutTab = AboutTab;
