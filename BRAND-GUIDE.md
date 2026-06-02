# Home Loan Toolkit — Brand & Format Guide

> Reference for all UI decisions. When adding new components, match these specs exactly.

---

## Typography

### Font Family
**DM Sans** (primary) — loaded from Google Fonts  
Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

```
font-family: 'DM Sans', sans-serif;
```

### Font Size Scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| Page Title | 20px | 700 | Modal/screen headings |
| Section Header | 15–16px | 700 | SectionCard titles, form section labels |
| Body / Input | 15px | 400–500 | Input values, body text, dropdown values |
| Secondary | 13–14px | 400–500 | Descriptions, hints, secondary info |
| Label | 11px | 600 | ALL CAPS field labels above inputs |
| Fine Print | 11–12px | 400 | Disclaimers, footnotes, timestamps |

**Mobile rule:** All `<input>`, `<select>`, `<textarea>` must be **≥ 16px** on mobile to prevent iOS Safari from auto-zooming on focus.

**iOS Dynamic Type:** The viewport allows `maximum-scale=5.0` so users can pinch-zoom or use iOS Accessibility > Larger Text. Never set `maximum-scale=1.0`.

---

## Colors

### Light Theme (default)

| Token | Hex | Usage |
|---|---|---|
| `navy` | `#0C4160` | Primary brand, headings, active states |
| `navyLight` | `#164E72` | Hover states, gradients |
| `blue` | `#48A0CE` | Links, info accents, badges |
| `blueLight` | `#E8F4FA` | Blue tint backgrounds |
| `green` | `#1B8A5A` | Success, positive values, saved states |
| `greenLight` | `#E8F5EE` | Green tint backgrounds |
| `red` | `#C0392B` | Errors, negative values, warnings |
| `redLight` | `#FDECEB` | Error backgrounds |
| `gold` | `#D4920B` | Alerts, PMI warnings, attention |
| `goldLight` | `#FFF8E1` | Gold tint backgrounds |
| `gray` | `#6B7D8A` | Secondary text, icons |
| `grayLight` | `#94A3B0` | Placeholder text, disabled states |
| `border` | `#E0E8E8` | Input borders, dividers |
| `bg` | `#F7FAFB` | Page background, input backgrounds |
| `bgAlt` | `#FAFCFD` | Alternate card backgrounds |
| `white` | `#FFFFFF` | Card surfaces |

### Dark Theme

| Token | Hex |
|---|---|
| `navy` | `#8BB8D4` |
| `bg` | `#1A2530` |
| `border` | `#2A3A45` |
| `white` | `#1E2D38` |

### Sidebar / App Shell

| Element | Color |
|---|---|
| Sidebar background | `#1e3a5f` |
| Active nav item | `rgba(255,255,255,0.12)` + `#60a5fa` left border |
| Inactive nav text | `rgba(255,255,255,0.75)` |
| Section labels | `rgba(255,255,255,0.38)` |
| Header gradient | `linear-gradient(135deg, #0C4160, #1A5E8A)` |

---

## Spacing

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon gaps, tight inline spacing |
| sm | 8px | Between related elements |
| md | 12px | Between form fields |
| lg | 16px | Section padding, card padding |
| xl | 24px | Between sections |
| xxl | 40px | Page-level spacing |

---

## Border Radius

| Element | Radius |
|---|---|
| Input fields | 8px |
| Buttons (primary) | 8px |
| Buttons (small) | 6px |
| Cards / SectionCard | 12px |
| Badges / pills | 99px (fully rounded) |
| Tooltips (InfoTip) | 10px |
| Avatar circles | 50% |

---

## Touch Targets (Mobile)

Per Apple Human Interface Guidelines, all tappable elements must be **minimum 44 × 44px**.

| Element | Min Height |
|---|---|
| Sidebar nav buttons | 44px |
| Form inputs | 44px (via 10–12px padding + 16px font) |
| Primary buttons | 44px |
| Icon buttons | 44px |

---

## Components

### LabeledInput
- Border: `1.5px solid {border}`
- Border radius: 8px
- Padding: `10px 12px`
- Font size: 15px body, 11px label
- Label: ALL CAPS, 600 weight, `{gray}` color
- `infoTip` prop renders ⓘ icon after label

### Select
- Same border/radius/padding as LabeledInput
- Supports `infoTip` prop
- Label: ALL CAPS, 600 weight

### SectionCard
- Background: white
- Border: `1px solid {border}`
- Border radius: 12px
- Box shadow: `0 1px 4px rgba(0,0,0,0.04)`
- Title: 13px, 700, ALL CAPS, `{navy}` color
- Accent bar: 3px left border in accent color

### InfoTip (ⓘ icon)
- Circle: 16 × 16px, `#1A5E8A` background
- Popover: 280px wide, `#1B2A3B` background, white text, 13px
- Prefix `💡` in popover text = pro tip content
- Prefix none = factual/definitional content

### Primary Button
```
background: #0C4160
color: #fff
border-radius: 8px
padding: 10px 20px
font-size: 14px
font-weight: 600
min-height: 44px
```

### Secondary Button
```
background: #E8EEF4
color: #0C4160
border: none
border-radius: 8px
padding: 10px 20px
font-size: 14px
font-weight: 600
```

---

## Icons (Sidebar Navigation)

| Screen | Icon | Notes |
|---|---|---|
| Contacts | 👤 | grayscale filter applied |
| Scenarios | 📋 | grayscale filter applied |
| Teams & Users | 👥 | grayscale filter applied |

Icons use `filter: grayscale(1) brightness(1.8)` to neutralize emoji color on the dark sidebar background.

---

## Disclaimer

Every scenario view must show at the bottom (scroll to reach):

> *Not a commitment to lend. All loans subject to credit approval and underwriting. Rates shown are estimates only and subject to change without notice. Mark Pfeiffer | NMLS #729612 | CMG Home Loans | NMLS #1820 | Equal Housing Lender | NMLS Consumer Access: www.nmlsconsumeraccess.org*

**Shown:** Inside MortgageToolkit (scenario view) at bottom of scrollable content.  
**Not shown:** On login screen, scenario dashboard, or contacts.

---

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | ≤ 768px | Single column, sidebar hidden, tab bar horizontal scroll |
| Narrow mobile | ≤ 480px | All grids collapse to 1 column |
| Desktop | > 768px | Sidebar visible, multi-column layouts |

---

## NMLS / Legal Info

| Field | Value |
|---|---|
| LO Name | Mark Pfeiffer |
| LO NMLS | #729612 |
| Company | CMG Home Loans |
| Company NMLS | #1820 |
| Title | Senior Loan Officer |
