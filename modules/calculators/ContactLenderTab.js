// modules/calculators/ContactLenderTab.js
const { useState, useRef } = React;
const useLocalStorage  = window.useLocalStorage;
const useThemeColors   = window.useThemeColors;
const SectionCard      = window.SectionCard;
const font             = window.font;

function ContactLenderTab({ isInternal }) {
  const c = useThemeColors();

  // ── LO profile data (shared with PreQualLetter) ──
  const [loName]     = useLocalStorage("pq_lo",      "");
  const [loTitle]    = useLocalStorage("pq_lotitle", "");
  const [loNMLS]     = useLocalStorage("pq_lonmls",  "");
  const [loPhone]    = useLocalStorage("pq_loph",    "");
  const [loCell]     = useLocalStorage("pq_locell",  "");
  const [loEmail]    = useLocalStorage("pq_loem",    "");
  const [loWebsite]  = useLocalStorage("pq_loweb",   "");
  const [brandName]  = useLocalStorage("brand_name", "");
  const [brandLogo]  = useLocalStorage("brand_logo", "");

  // ── New keys managed by this tab ──
  const [headshot, setHeadshot] = useLocalStorage("lo_headshot", "");
  const [bio, setBio]           = useLocalStorage("lo_bio",      "");

  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = function(e) { setHeadshot(e.target.result); };
    reader.readAsDataURL(file);
  }

  function fmtPhone(raw) {
    const d = (raw || "").replace(/\D/g, "");
    if (d.length < 4) return raw;
    if (d.length < 7) return "(" + d.slice(0,3) + ") " + d.slice(3);
    return "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6,10);
  }

  const hasContact = loName || loPhone || loCell || loEmail || loWebsite;

  // ── Shared styles ─────────────────────────────────────────────────────────
  const labelSt = {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", color: c.gray, fontFamily: font,
    marginBottom: 4, display: "block",
  };
  const inputSt = {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid " + c.border, borderRadius: 8,
    fontSize: 14, fontFamily: font, color: c.text,
    background: c.bg, outline: "none", boxSizing: "border-box",
    resize: "vertical",
  };

  // ── Contact row (phone / email / website) ──────────────────────────────
  function ContactRow({ icon, label, value, href }) {
    return React.createElement("a", {
      href: href,
      target: href && href.startsWith("http") ? "_blank" : undefined,
      rel: "noopener noreferrer",
      style: {
        display: "flex", alignItems: "center", gap: 14,
        textDecoration: "none", color: c.text,
        padding: "10px 0",
        borderBottom: "1px solid " + c.border,
      }
    },
      React.createElement("span", { style: { fontSize: 22, width: 30, textAlign: "center", flexShrink: 0 } }, icon),
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: c.gray, fontFamily: font } }, label),
        React.createElement("div", { style: { fontSize: 14, fontWeight: 600, fontFamily: font } }, value)
      )
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERNAL VIEW — edit headshot + bio, preview card
  // ══════════════════════════════════════════════════════════════════════════
  if (isInternal) {
    return React.createElement(React.Fragment, null,

      // ── Edit Section ──
      React.createElement(SectionCard, { title: "Contact Lender Page" },
        React.createElement("p", {
          style: { fontSize: 13, color: c.gray, fontFamily: font, marginBottom: 20, lineHeight: 1.6 }
        }, "This page is shown to clients and realtors. Upload your headshot and write a brief intro about yourself and your team. Your contact info is pulled from your Pre-Qual Letter settings."),

        // Headshot upload
        React.createElement("label", { style: labelSt }, "Headshot Photo"),
        React.createElement("div", {
          onDragOver: function(e) { e.preventDefault(); setDragOver(true); },
          onDragLeave: function() { setDragOver(false); },
          onDrop: function(e) {
            e.preventDefault(); setDragOver(false);
            loadFile(e.dataTransfer.files[0]);
          },
          onClick: function() { fileInputRef.current && fileInputRef.current.click(); },
          style: {
            border: "2px dashed " + (dragOver ? c.navy : c.border),
            borderRadius: 12, padding: 20, textAlign: "center",
            cursor: "pointer", marginBottom: 16, transition: "border-color 0.15s",
            background: dragOver ? (c.navy + "11") : c.bg,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }
        },
          headshot
            ? React.createElement("img", {
                src: headshot, alt: "Headshot preview",
                style: { width: 90, height: 90, borderRadius: "50%", objectFit: "cover", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }
              })
            : React.createElement("div", { style: { fontSize: 36 } }, "🧑‍💼"),
          React.createElement("div", { style: { fontSize: 13, color: c.gray, fontFamily: font } },
            headshot ? "Click or drag to replace photo" : "Click or drag to upload headshot"
          )
        ),
        React.createElement("input", {
          ref: fileInputRef, type: "file", accept: "image/*",
          style: { display: "none" },
          onChange: function(e) { loadFile(e.target.files[0]); }
        }),
        headshot && React.createElement("button", {
          onClick: function() { setHeadshot(""); },
          style: {
            background: "none", border: "none", color: "#dc2626",
            fontSize: 12, cursor: "pointer", fontFamily: font,
            marginBottom: 16, padding: 0,
          }
        }, "✕ Remove photo"),

        // Bio
        React.createElement("label", { style: { ...labelSt, marginTop: 8 } }, "Bio / Team Excerpt"),
        React.createElement("textarea", {
          value: bio,
          onChange: function(e) { setBio(e.target.value); },
          rows: 5,
          placeholder: "Write a brief intro — who you are, your team, and why clients love working with you...",
          style: inputSt,
        }),
        React.createElement("div", {
          style: { fontSize: 12, color: c.gray, fontFamily: font, marginTop: 4 }
        }, bio.length + " characters")
      ),

      // ── Live Preview ──
      React.createElement(SectionCard, { title: "Client Preview" },
        React.createElement(ClientCard, {
          headshot, bio, loName, loTitle, loNMLS, loPhone, loCell, loEmail,
          loWebsite, brandName, brandLogo, c, fmtPhone, ContactRow,
        })
      )
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENT / REALTOR VIEW — read-only card
  // ══════════════════════════════════════════════════════════════════════════
  return React.createElement(SectionCard, { title: "Your Loan Officer" },
    React.createElement(ClientCard, {
      headshot, bio, loName, loTitle, loNMLS, loPhone, loCell, loEmail,
      loWebsite, brandName, brandLogo, c, fmtPhone, ContactRow,
    })
  );
}

// ── Shared read-only card (used in both internal preview + client view) ────
function ClientCard({ headshot, bio, loName, loTitle, loNMLS, loPhone, loCell,
                      loEmail, loWebsite, brandName, brandLogo, c, fmtPhone, ContactRow }) {

  const hasContact = loPhone || loCell || loEmail || loWebsite;
  const noContent  = !headshot && !bio && !loName && !hasContact;

  if (noContent) {
    return React.createElement("div", {
      style: { textAlign: "center", padding: "32px 0", color: c.gray, fontFamily: font, fontSize: 14 }
    }, "No lender info set up yet. Fill in your details above.");
  }

  return React.createElement("div", { style: { fontFamily: font } },

    // ── Hero row: headshot + name/title ──
    (headshot || loName) && React.createElement("div", {
      style: { display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }
    },
      headshot && React.createElement("img", {
        src: headshot, alt: loName || "Loan Officer",
        style: { width: 96, height: 96, borderRadius: "50%", objectFit: "cover", flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }
      }),
      React.createElement("div", null,
        brandLogo && React.createElement("img", {
          src: brandLogo, alt: brandName || "",
          style: { maxHeight: 28, marginBottom: 8, display: "block" }
        }),
        loName && React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: c.text } }, loName),
        (loTitle || loNMLS) && React.createElement("div", { style: { fontSize: 13, color: c.gray, marginTop: 2 } },
          [loTitle, loNMLS ? "NMLS #" + loNMLS : null].filter(Boolean).join(" · ")
        ),
        brandName && React.createElement("div", { style: { fontSize: 12, color: c.gray, marginTop: 2 } }, brandName)
      )
    ),

    // ── Bio ──
    bio && React.createElement("p", {
      style: { fontSize: 14, color: c.text, lineHeight: 1.75, marginBottom: 20,
               padding: "16px 18px", background: c.border + "44",
               borderRadius: 10, borderLeft: "3px solid #0C4160" }
    }, bio),

    // ── Contact rows ──
    React.createElement("div", { style: { marginTop: 4 } },
      loPhone  && React.createElement(ContactRow, { icon: "📞", label: "Office",   value: fmtPhone(loPhone),  href: "tel:" + loPhone.replace(/\D/g,"")  }),
      loCell   && React.createElement(ContactRow, { icon: "📱", label: "Cell",     value: fmtPhone(loCell),   href: "tel:" + loCell.replace(/\D/g,"")   }),
      loEmail  && React.createElement(ContactRow, { icon: "✉️",  label: "Email",    value: loEmail,            href: "mailto:" + loEmail                  }),
      loWebsite && React.createElement(ContactRow, { icon: "🌐", label: "Website",  value: loWebsite,          href: loWebsite.startsWith("http") ? loWebsite : "https://" + loWebsite })
    )
  );
}

window.ContactLenderTab = ContactLenderTab;
