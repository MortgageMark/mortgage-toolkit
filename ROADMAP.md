# Home Loan Toolkit — Architecture Roadmap & MVP Plan

> **Purpose:** This file memorializes architectural decisions, the agreed data flow, and ordered next steps so they are available in future Claude sessions via the Read tool.
> **Last updated:** 2026-03-09

---

## 1. Product Vision

A vertically integrated mortgage SaaS platform consisting of three tightly connected layers:

| Layer | Product | Audience | Status |
|---|---|---|---|
| **Hub** | Home Loan Toolkit (this app) | Loan Officer / Team | ✅ In Production |
| **Intake** | 1003 Loan Application (standalone) | Borrower-facing | 🔲 Planned |
| **Backend** | Supabase (shared DB) | Both apps | 🟢 Schema Complete |

---

## 2. Agreed Architecture

```
┌─────────────────────────────────────────────────────┐
│               MORTGAGE TOOLKIT (CRM Hub)            │
│  - Contacts / CMS (leads, borrowers, realtors, etc) │
│  - Calculators (Payment, Refi, Compare, Amort, etc) │
│  - Scenarios / PreQual Letters                      │
│  - User & Permission Management                     │
│  - Admin Dashboard                                  │
└──────────────────┬──────────────────────────────────┘
                   │  Seed payload (name, phone, email,
                   │  address, loan purpose, etc.)
                   ▼
┌─────────────────────────────────────────────────────┐
│           1003 INTAKE APP (Standalone URL)          │
│  - Borrower-facing, public/semi-public URL          │
│  - Pre-filled with seed data from Toolkit           │
│  - Full 1003 data collection                        │
│  - On submit → returns DELTA to Toolkit             │
└──────────────────┬──────────────────────────────────┘
                   │  Delta return (new/updated fields only)
                   ▼
┌─────────────────────────────────────────────────────┐
│                  SUPABASE (Shared DB)               │
│  - Single source of truth for both apps             │
│  - Row-Level Security (RLS) enforced                │
│  - Multi-tenant via tenant_id on every table        │
└─────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Detail

### Toolkit → 1003 (Seed)
When an LO is ready to send a borrower to complete their loan application:
1. Toolkit generates a unique, time-limited intake link (tied to the contact record)
2. Link carries a payload (or lookup token) with: name, phone, email, address, loan purpose, estimated price, scenario data
3. 1003 app pre-fills known fields so borrower doesn't start from scratch

### 1003 → Toolkit (Delta Return)
When borrower submits their 1003:
1. Only NEW or UPDATED fields are written back (delta, not a full overwrite)
2. Contact record in Toolkit is updated
3. Full 1003 application record is stored and linked to the contact
4. LO is notified (email/in-app alert)

---

## 4. Supabase Schema (Current State)

> **Rule:** Every table has a `tenant_id` column. RLS policies filter all queries by `tenant_id`. This is the foundation for licensing to other LOs/companies.
> **Status:** Core schema is deployed. ✅ = live/written. 🔲 = Phase 2.

```
✅ tenants
  id, name, slug, plan_tier, branding_config, created_at

✅ profiles  (replaces "users" — Supabase Auth owns auth.users)
  id (FK → auth.users), tenant_id, email, display_name
  role ('admin'|'internal'|'borrower'|'realtor'), borrower_permissions (jsonb)
  created_at

✅ contacts
  id, tenant_id, created_by_user_id
  first_name, last_name, email, phone, address, city, state, zip
  contact_type (lead | borrower | realtor | builder | other)
  status (active | archived | converted), tags (text[]), source, notes
  created_at, updated_at

✅ contact_notes  (append-only — no UPDATE/DELETE ever)
  id, tenant_id, contact_id, user_id
  body, created_at

✅ scenarios
  id, tenant_id, contact_id (nullable FK → contacts)
  user_id, name, notes, status, calculation_data (jsonb)
  created_at, updated_at

✅ pq_letters / pq_letter_shares  (immutable — insert-only)
  (see CLAUDE.md for full column list)

✅ scenario_audit_log
  id, scenario_id, user_id, action, changes (jsonb), note, created_at

✅ intake_links  (Phase 2 placeholder — table exists, no UI yet)
  id, tenant_id, contact_id, created_by_user_id
  token (unique), seed_payload (jsonb), expires_at, used_at, created_at

🔲 loan_applications (1003)  — Phase 2
  id, tenant_id, contact_id, intake_token
  seed_payload (jsonb), borrower_responses (jsonb)
  status (pending | in_progress | submitted | reviewed)
  submitted_at, created_at, updated_at
```

---

## 5. Multi-Tenancy / Licensing Model

The Toolkit will eventually be licensed to other Loan Officers and mortgage companies.

### Tenant Tiers (Planned)
| Tier | Features |
|---|---|
| **Solo** | Single LO, all calculators, CMS basics |
| **Team** | Multiple users, borrower portal, permissions |
| **Pro** | 1003 intake, white-label branding, advanced reporting |
| **Enterprise** | Custom domain, SSO, API access, dedicated support |

### What "tenant_id" Means in Practice
- Each LO or company that licenses the app is a **tenant**
- All their data (contacts, scenarios, users) is isolated by `tenant_id`
- RLS in Supabase ensures tenant A can never see tenant B's data
- **This column must be added BEFORE significant data accumulates** — retrofitting is painful

---

## 6. MVP Definition (Internal Team First)

> **Goal:** Get the Toolkit production-ready for Mark's internal team before building licensing infrastructure.

### MVP Scope (Phase 1)
- [x] All existing calculators working (Payment, Refi, Compare, Amort, Breakeven, Fees)
- [x] Borrower portal with tab permissions
- [x] Scenario Dashboard
- [x] PreQual Letter generator
- [ ] **Contacts Module (CMS)** — the primary new feature
  - List view of all contacts (leads, borrowers, realtors, etc.)
  - Contact detail page: info, notes, linked scenarios
  - Add / Edit / Archive contacts
  - Contact type tagging (lead, borrower, realtor, builder, other)
  - Basic search and filter
- [x] **Supabase schema for Contacts** — DB layer complete (`supabase-tenant-migration.sql` + `supabase-contacts.sql` written; run both in order to deploy)
- [x] **tenant_id added to schema** ✅ — `tenants` table created, `tenant_id` on all tables, `get_my_tenant_id()` SECURITY DEFINER deployed, `'lo'` role bug fixed

### Out of Scope for Phase 1
- 1003 Intake App
- Multi-tenant login / licensing
- White-label branding
- Advanced reporting / analytics

---

## 7. Ordered Next Steps

### ✅ Immediate — COMPLETE (session 5, 2026-03-09)
1. ✅ **Add `tenant_id` to Supabase schema** — `supabase-tenant-migration.sql`: creates `tenants` table, adds `tenant_id` to all 5 existing tables, seeds Mark's tenant (`slug: 'ningard-cmg'`), creates `get_my_tenant_id()`, fixes `'lo'` role bug in all policies.
2. ✅ **Design the Contacts table** in Supabase — `supabase-contacts.sql`: creates `contacts`, `contact_notes` (append-only), `intake_links` (Phase 2 placeholder), adds `contact_id` to `scenarios`, 9 indexes, full RLS on all three tables.
3. ✅ **Audit existing Supabase tables** — completed (sessions 3–4); findings drove the migration file design.

### 🟡 Phase 1 — Contacts Module (CMS)
4. **Build `ContactsTab.js`** — list view with search, filter by type/status, add new button
5. **Build `ContactDetail.js`** — individual contact page: info fields, notes log, linked scenarios
6. **Wire Contacts to Supabase** — CRUD operations with RLS
7. **Add Contacts to Toolkit navigation** — new tab or sidebar entry for LO view
8. **Link Scenarios to Contacts** — when saving a scenario, associate it with a contact record

### 🟢 Phase 2 — 1003 Integration
9. **Design intake token / seed payload schema**
10. **Build 1003 standalone app** (separate repo/URL, shared Supabase)
11. **Build "Send to Borrower" flow** in Toolkit — generates intake link from contact record
12. **Build delta-return handler** — on 1003 submission, update contact in Toolkit
13. **Notification system** — alert LO when borrower submits 1003

### 🔵 Phase 3 — Licensing / SaaS
14. **Multi-tenant auth** — Supabase Auth with tenant isolation
15. **Tenant onboarding flow** — sign up, create tenant, invite users
16. **Billing integration** (Stripe)
17. **White-label branding** — tenant-level logo, colors, domain
18. **Admin portal** — manage tenants, plans, usage

---

## 8. Current Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18.2.0 + Babel 7.23.9 | CDN, no build step |
| Modules | 34 `.js` files | Loaded via `<script>` tags, exported via `window.X` |
| State | `useLocalStorage` hook | Persists to browser localStorage per key |
| Backend | Supabase | Postgres + Auth + RLS + Realtime |
| Hosting | TBD | Current: local / OneDrive |
| 1003 App | TBD | Separate repo, shared Supabase instance |

---

## 9. Key Principles to Preserve

1. **No build step** — keep CDN + vanilla React until scale demands otherwise
2. **localStorage first** — calculators stay fast and offline-capable; only contacts/scenarios need DB
3. **Supabase RLS is the security boundary** — never trust the client for access control
4. **tenant_id on everything** — non-negotiable, even in single-tenant MVP
5. **Delta returns, not overwrites** — 1003 data flows back as changes only, never clobbers Toolkit data
6. **Toolkit is the source of truth** — 1003 is an intake form, not a CRM; Toolkit owns the record

---

*This file is readable by Claude via the Read tool at the start of future sessions. Update it as decisions evolve.*
