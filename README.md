# AI Compliance Assistant

Generates first-draft compliance documents — ISO 27001 policies, GDPR policies, CMMC/NIST
800-171 packages, risk assessments, and audit evidence checklists — tailored to a company's
profile. Every generated document is a starting point for human/legal review, not a finished,
certifiable artifact.

**Positioning:** the SOC 2/ISO 27001 space (Vanta, Drata, Secureframe) is crowded and
expensive ($15k+/year even for small teams). Two adjacent frameworks are real, current gaps:
CMMC/NIST 800-171 for manufacturers in the defense supply chain (existing tools are template
kits, not software — only 4% of contractors feel audit-ready), and AI governance (ISO 42001 /
EU AI Act), where no incumbent has entrenched dominance yet since the EU AI Act only phases in
through 2026. Both are additive to the existing catalog, not a rebuild.

## UI

Each company opens into a workspace: a sidebar (company summary + Overview/Documents/Vendors/Chat
nav, with live counts) and a content pane that shows one section at a time. Earlier this was a
single long-scroll page with every panel stacked — functional but not something you'd hand to a
customer. Cross-tab actions (e.g. "Generate this" from a Next Best Action card) switch tabs and
pre-fill the target form rather than scrolling to an anchor. Collapses to horizontal tab pills
below 860px.

## Stack

- `server/`: Node.js + Express + PostgreSQL API, `docx` for export
- `client/`: React + Vite frontend
- Generation: dual-provider — [Groq](https://console.groq.com) (cloud, fast, default) or
  local [Ollama](https://ollama.com) (free, offline, lower quality), switchable per document
  from the UI

Groq's free tier gives frontier-adjacent instruction-following (correct table structure,
tailored content, no per-request billing setup beyond the free quota) at a few seconds per
document. Ollama is the zero-cost fallback for offline use, at the cost of noticeably weaker
structured output — see `server/src/services/providers/` to compare or add another provider.

## Setup

```bash
# Ollama (optional, only needed for the local provider)
ollama pull llama3.2:3b
ollama serve            # if not already running as a background service

# Database
createdb ai_compliance_assistant

# Server
cd server
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET (generate per the comment in .env.example), GROQ_API_KEY
npm install
npm run migrate
npm run dev             # http://localhost:4300

# Client (separate terminal)
cd client
npm install
npm run dev             # http://localhost:5300
```

## Security notes

- `JWT_SECRET` must be a long random string in any non-local environment — generate one with
  the command in `.env.example`, never reuse the placeholder
- `CLIENT_ORIGINS` (comma-separated) locks down CORS; add your deployed frontend's origin
  before deploying
- `/api/documents/generate` is rate-limited per account (`GENERATE_RATE_LIMIT_PER_HOUR`,
  default 20/hour) to bound provider costs and abuse
- `/api/auth/login` and `/api/auth/signup` are rate-limited (10 requests / 15 min / IP)
  against brute-force and mass signup

## Backups

Company and document data lives only in your local Postgres database — there is no cloud
copy. Back it up:

```bash
server/scripts/backup.sh   # dumps to server/backups/, keeps the last 30
```

To restore: `pg_restore -d <database_name> server/backups/backup_<timestamp>.dump`

**To automate daily backups (one-time setup, run yourself):** this session couldn't write
to crontab directly — macOS requires Full Disk Access for that, which a sandboxed process
doesn't have. Run this once in your own Terminal:

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /Users/ankithsa/ai-compliance-assistant/server/scripts/backup.sh >> /Users/ankithsa/ai-compliance-assistant/server/backups/backup.log 2>&1") | crontab -
```

That schedules a backup every day at 2am. Verify it's installed with `crontab -l`.

## How it works

1. Create a company profile (industry, size, data types handled, cloud providers, etc.)
2. Pick a framework (ISO 27001, GDPR, Risk Assessment, Audit Evidence) and a document type
3. The server builds a prompt from `server/src/templates/catalog.js`, calls the selected
   provider (Groq or local Ollama), and stores the result as markdown
4. Preview in-browser or download as a `.docx`

## Document catalog

- **ISO 27001**: Information Security Policy, Access Control Policy, Incident Response Plan
- **GDPR**: Privacy Policy, Data Processing Agreement, Record of Processing Activities (ROPA)
- **CMMC / NIST 800-171** (manufacturers/defense supply chain): System Security Plan (SSP),
  Plan of Action & Milestones (POA&M), CMMC Incident Response Plan (DFARS 72-hour reporting)
- **Risk Assessment**: Risk Register, Vendor Risk Assessment
- **Audit Evidence**: Evidence Checklist, Control Narrative Summary
- **ISO 42001 / AI Governance**: AI Management System Policy, AI Risk & Impact Assessment
  (per-AI-system risk tiering under the EU AI Act), EU AI Act Readiness Statement — driven by
  a company's stated `ai_systems_used`, correctly distinguishing "provider" (built/fine-tuned
  the model) from "deployer" (uses a third-party API as-is), which the model got wrong by
  default until the prompt explicitly required the distinction

Add new document types by adding entries to `CATALOG` in `server/src/templates/catalog.js` —
no other code changes needed.

## Vendor Risk Register

Beyond generating prose documents, the app reasons over a company's stated cloud providers
and `tools_used` to build a structured, risk-scored vendor register — not another markdown
document, but real rows in the `vendors` table rendered as an editable table (risk tier,
reasoning, recommended controls, review cadence). This is what separates "writes documents"
from "understands the company's actual risk surface." See `server/src/services/vendorRegister.js`
for the detection prompt and `client/src/pages/VendorRegister.jsx` for the UI. Clicking
"Re-detect vendors" replaces AI-sourced rows and regenerates from the current profile.

## Compliance Gap Analysis

Each company page opens on a scorecard, not a form. `server/src/templates/gapChecklist.js`
defines what "readiness" means per framework — a mix of items we can verify automatically
(a matching document is `ready`, the vendor register is populated) and items we honestly
can't check yet (asset register, security training records, backup/DR procedure, breach
notification, DPIA) — those show as real gaps rather than being silently omitted, since an
inflated score would be worse than an honest low one. The score updates live: generating a
document or detecting vendors immediately re-scores the relevant framework, no page reload.
See `server/src/services/gapAnalysis.js` for the scoring logic.

**Next best actions**: ranked purely from data already computed above — no extra AI call. The
key insight: some gaps are shared across frameworks (e.g. "populate the vendor register" appears
in all four framework checklists), so one action can lift multiple scores at once. Ranking
accounts for this — completing the vendor register on a fresh company outranks any single
document because it moves 4 frameworks simultaneously, not 1. Each action shows the honest
per-framework before/after (`ISO 27001 40%→50%`), not a fabricated blended percentage. Clicking
an action pre-fills and scrolls to the right form instead of firing generation without
confirmation, since that's a rate-limited/costed action the user should explicitly trigger.

**Framework Translator (control mapping)**: `server/src/templates/controlMapping.js` holds a
small, curated set of real cross-framework overlaps (e.g. an ISO 27001 Access Control Policy
covers much of what CMMC's SSP needs for its Access Control domain) — deliberately not an
exhaustive auto-generated matrix, since most cross-framework "equivalences" don't actually hold
up (CMMC's incident response needs a DFARS 72-hour clause ISO's doesn't have; each mapping entry
says so explicitly). This is purely informational — it never affects gap-analysis scoring, only
surfaces "you already did most of this work" hints when one side is done and the other isn't, or
"this is the identical gap in both frameworks" when neither side is done yet.

## Compliance Chat

A per-company chat, grounded only in that company's real data — profile, vendor register, gap
analysis scores, and document titles/status (not full document text, which isn't loaded into
context; the assistant says so rather than guessing if asked about specific document wording).
Multi-turn: recent history is replayed on each turn so follow-ups like "of the vendors you just
listed, which is lowest risk?" work correctly. See `server/src/services/complianceChat.js` for
context assembly and `client/src/pages/ComplianceChat.jsx` for the UI. Verified against a real
company profile: correctly cited exact missing gap-analysis items, pulled a certification
deadline from free-text notes rather than inventing one, and admitted when it didn't have
enough context (e.g. the general vendor risk-tiering rubric) instead of fabricating an answer.

## Executive Report

One-click leadership summary composed entirely from data already computed above — gap scores,
top (critical/high) vendor risks, ranked next-best-actions, and recent document activity — with
a short AI-written headline paragraph on top putting the numbers in plain language. It's stored
as a regular document (`framework: 'executive_report'`) so it reuses the existing docx export
and Documents grid with no new UI needed; the gap-analysis "documents ready" count explicitly
excludes it so the report doesn't inflate its own input data. See
`server/src/services/executiveReport.js`.

**Rate limits, for real**: building this surfaced Groq's free tier has two separate caps — a
short per-minute limit (already handled with an automatic retry) and a 100k-token **daily** cap,
which this session hit near the end of a long testing run. Retrying a multi-hour daily-limit wait
inside an HTTP request isn't viable, so the provider now fails fast with a clear message ("try
Ollama instead") rather than blocking. Worth knowing before demoing: heavy same-day testing on
the free tier will eventually hit this, and Ollama is the fallback.

## Known limitations (v1)

- Single account per company (no team seats yet)
- No versioning/diffing between regenerations of the same doc type
- DOCX export handles headings, paragraphs, bullet/numbered lists, tables, and blockquotes —
  not a full markdown spec
- No built-in e-signature or audit-trail logging of who approved a document
- No evidence upload/AI control mapping and no cloud connectors (AWS/Azure/M365/GitHub) yet —
  tracked as the next phases toward a full compliance platform rather than a document generator
- Gap analysis checklist items are curated, not a full ISO 27001 Annex A (93 controls) or
  GDPR article-by-article mapping — it's honest about what it checks, not exhaustive
