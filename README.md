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

See [ROADMAP.md](./ROADMAP.md) for phase-by-phase status against the product-vision doc this was
built from, and what's next.

## UI

Each company opens into a workspace with a fixed-left icon sidebar (brand at top, company
switcher, Dashboard/AI Compliance Officer/Documents/Vendors nav with live counts, user profile
pinned at the bottom) and a content pane that shows one section at a time. The sidebar also lists
sections that don't exist yet as real features (Risks, Frameworks, Controls, Evidence, Tasks &
Actions, Reports, Timeline, Settings) — visibly disabled and marked "Soon" rather than either
omitted or (worse) linking to an empty page. Matching a reference SaaS dashboard design was a
deliberate exercise in staying honest at the navigation level: every number and widget on the
Dashboard tab (readiness ring, stat tiles, priorities, framework progress, risk distribution,
recent activity) is computed from real data — no fabricated deadlines or a fake 2-axis risk
heatmap, since we don't track the underlying likelihood/impact data that would require. The hero
readiness card and AI Compliance Officer card use decorative-only touches (an inline SVG mountain
illustration, a chat-bubble-style message) for visual depth; the "High/Medium/Low Impact" pill on
the top recommendation is derived from the real point-lift value, not fabricated. Cross-tab actions
(e.g. "Generate this" from a Next Best Action card, "Ask AI Officer" from the Dashboard) switch
tabs and pre-fill the target form. Sidebar collapses to a horizontal bar above the content below
860px.

The Dashboard greets the signed-in user by name ("Good afternoon, Ankith 👋", based on real
wall-clock time and an optional `name` on the account — falls back to email if not set), stat
tiles use distinct colored icon treatments per metric, and the hero readiness card and AI
Compliance Officer card use gradient/depth styling to read as a designed product rather than a
form. All still driven by real computed numbers — the polish pass changed presentation, not data.

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
                        # GITHUB_CLIENT_ID/SECRET are optional — only needed for the GitHub connector (Phase 4)
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

## Evidence Intelligence (Phase 3)

Ten checklist items that were previously honest, permanently-unchecked gaps (security training
records, backup procedures, config baselines, DPIAs, bias-testing evidence, etc. — the ones
`gapChecklist.js` marked `type: 'unavailable'`) are now real, closeable checks: upload a real
document and AI reads it, decides which specific checklist item(s) it genuinely supports, and
scores accordingly. This is the direct fix for the "evidence collection without intelligence"
gap named in the product-vision doc — competitors let you attach a file to a control; this reads
the file and tells you which control(s) it actually satisfies.

v1 scope is deliberately text-only: PDF, DOCX, TXT, MD, CSV, LOG, JSON (10MB max), via
`server/src/services/evidenceExtract.js` (`pdf-parse` / `mammoth` for PDF/DOCX, direct read for
plain text). Screenshots and other images can still be uploaded for record-keeping but are marked
`unsupported` rather than silently ignored or fake-analyzed — real evidence is overwhelmingly
screenshots (MFA settings, IAM policies, S3 config) in practice, but that needs a vision-capable
model path the current text-only Groq/Ollama providers don't have; deferred rather than faked.

`server/src/services/evidenceIntelligence.js` gives the model a fixed list of valid
`framework:key` targets pulled from the checklist itself (never lets it invent a control), and
requires per-item confidence (`high`/`medium`/`low`) with a reasoning sentence citing the actual
text. Only `high`/`medium` confidence matches close a gap and move the score — a `low` match still
shows in the evidence list (so nothing's hidden) but doesn't inflate readiness on a shaky guess.
One upload can close a gap in multiple frameworks at once (a single security-training log
satisfies both ISO 27001's and CMMC's training-records requirement) — the same cross-framework
reuse principle as Next Best Action, just triggered by real uploaded proof instead of a generated
document. Files are stored locally under `server/uploads/evidence/<company_id>/` (gitignored, no
cloud copy — consistent with the rest of this app's data-storage posture) and deleted from disk
when the evidence row is deleted.

## Cloud Connectors (Phase 4, v1: GitHub)

Instead of manually uploading proof, a connector pulls a compliance signal directly from a live
API call. v1 is scoped to a single provider and a single signal, deliberately: OAuth app
registration is something only the account owner can do (not something this session can create on
your behalf), and each provider (AWS/Azure/M365/Google/GitHub) has a materially different auth
model — building all five at once wasn't realistic. GitHub was picked first because its OAuth flow
is the simplest of the five (AWS has no real OAuth — it's IAM roles/access keys, a worse place to
start; Azure/Google need multi-step tenant consent).

**Scope is intentionally minimal**: the `read:org` OAuth scope only — no `repo` access, so it never
sees repository contents, and adding branch protection / secret scanning checks would require
expanding to that broader scope. That tradeoff was surfaced explicitly rather than silently
expanded; the decision was to stay within `read:org` and get more value out of org-level policy
fields instead. Three signals, all from a single `GET /orgs/{org}` call:
- `two_factor_requirement_enabled` — org-wide 2FA enforcement
- `members_can_create_public_repositories` — combined with the 2FA signal into one access-control
  finding (they speak to the same checklist item, so they don't render as two duplicate pills)
- `default_repository_permission` — a distinct signal (configuration baseline), `"none"`/`"read"`
  counts as a least-privilege default

GitHub's docs mark the "Security & Analysis" fields on this same endpoint (dependency graph, secret
scanning, Dependabot enablement) as **deprecated** — confirmed by reading the current API docs
before building, not assumed from memory. Those were excluded entirely rather than built against a
field GitHub might remove, the same live-verify-before-trusting discipline that led to reverting
the personal-2FA fallback below. `computeOrgFindings()` in `server/src/services/connectors/github.js`
is a pure function kept separate from the API call specifically so it's unit-testable with synthetic
org payloads — the account this was built against has no live GitHub organization, so the branching
logic was verified with 5 synthetic scenarios (strong posture, weak posture, mixed, non-owner
visibility, least-privilege permission), but GitHub's actual field behavior for these three fields
hasn't been confirmed against a real org the way the original 2FA signal was.

If the account belongs to multiple orgs, only the first is monitored and the evidence summary says
so explicitly rather than silently picking one. Sync results are stored as a regular `evidence` row
(`source: 'github'`) with the same shape AI-analyzed uploads use, so gap scoring, the checklist, and
the dashboard all treat a connector fact identically to an uploaded document — verified end-to-end:
connecting and syncing moved CMMC's "Access Control Implementation Evidence" item the same way an
uploaded PDF would.

**No org on the account, no signal — and that's a real API limit, not a bug**: if the connected
account isn't part of a GitHub organization, there's genuinely nothing to check. A personal-account
2FA fallback (`GET /user`'s `two_factor_authentication` field) was tried and reverted after live
testing showed GitHub simply doesn't return that field to OAuth Apps anymore — it exposes org-wide
enforcement *policy* (something the org controls) but not an individual's own 2FA status (private
user data). The connector reports this honestly ("no org found, and no fallback signal exists")
rather than guessing or silently succeeding.

**Security specifics**:
- OAuth tokens are encrypted at rest (AES-256-GCM, `CONNECTOR_ENCRYPTION_KEY`) — never stored in
  plaintext — via `server/src/services/crypto.js`.
- The redirect flow is split into two endpoints because a page navigation (GitHub redirecting the
  browser back to us) can't carry an `Authorization` header the way a normal API `fetch()` call
  does: `/connectors/github/start` (normal Bearer-token auth, called via `fetch()`, returns the
  GitHub authorize URL) and `/connectors/github/callback` (hit directly by GitHub's redirect, no
  Authorization header exists — trust comes from a short-lived signed JWT `state` param instead,
  verified with the same `JWT_SECRET` used for login).
- Setup requires registering a GitHub OAuth App yourself at
  https://github.com/settings/developers with its callback URL set to `GITHUB_REDIRECT_URI`
  (`.env.example` has the exact values needed) — this app cannot and should not create that
  registration on your behalf.

**Known limitation**: single-org only, three org-level policy signals. Branch protection and secret
scanning would need the broader `repo` scope (a deliberate tradeoff, not built yet); additional
providers are the other natural next increment.

## Compliance Memory / Timeline (Phase 5 foundation)

The product-vision doc's Phase 5 is a unified "AI Compliance Officer" with memory, prediction, and
simulation — a big step with no existing data to build on. This is the first piece of that
foundation: a `score_snapshots` table that records the full compliance state (overall score,
per-framework scores, document/vendor/evidence counts) every time something that could actually
move the score happens — a document is generated, vendors are detected, evidence is analyzed, or a
connector syncs (`server/src/services/scoreHistory.js`, called from each of those four routes).

**Never on a timer, never backfilled.** There's no cron job manufacturing daily data points, and
no synthetic history was inserted for existing companies — the timeline starts empty and only
gains entries from real actions going forward. This directly resolves something deliberately left
unbuilt during the earlier dashboard redesign: trend deltas like "↑8% this week" were refused at
the time because there was no historical data to compute them from honestly. They're real now —
`getWeeklyTrend()` compares the current score to the nearest snapshot **at least 7 days old**, and
returns `null` (not a fallback to whatever's closest) until a company has that much real history.
The dashboard and stat tiles simply omit the trend badges until then, rather than showing a
same-day comparison mislabeled as "this week."

The **Timeline** tab (`client/src/pages/Timeline.jsx`) lists every recorded snapshot chronologically
with the score at that point and the delta from the previous one — a real, auditable history of
compliance progress, which is also literally the vision doc's "Compliance Timeline" capability.

## Proactive AI Compliance Officer

An early informal review of this project (fed the README into ChatGPT for a founder-style
critique) landed on one piece of actionable feedback worth keeping: "the product waits for
users" — the AI Officer was a chat window you had to go ask, never something that told you
anything on its own. This closes that gap using the same four trigger points score history
already hooks into.

Every `recordSnapshot()` call (document generated, vendors detected, evidence analyzed, connector
synced) also composes an `insight` — a short message describing what changed and what's next —
and stores it on that snapshot. The Dashboard's AI Compliance Officer card shows the most recent
one instead of a static "ask me anything" prompt, e.g. *"Document generated — Data Processing
Agreement (DPA). This moved your score 25%→30%. Next: 'Record of Processing Activities (ROPA)'
would add 17 more points."*

**Deliberately not AI-generated.** `composeInsight()` in `server/src/services/scoreHistory.js` is
a plain template over numbers already computed (previous score, current score, top next action) —
no LLM call. It fires on every single action across four different routes, so it has to be
instant, free, and structurally unable to hallucinate; an AI call there would add latency, cost,
and a new failure surface to something that needs to be reliable every time. The deep-dive
reasoning surface remains Compliance Chat, which already does full grounded AI reasoning — this is
just the proactive "here's what happened" layer sitting on top of it.

## Continuous monitoring

The other half of "the product waits for users": connected cloud connectors now re-sync
themselves automatically instead of relying solely on a manual "Sync now" click.
`server/src/services/connectorScheduler.js` runs an in-process interval (`CONNECTOR_SYNC_INTERVAL_HOURS`,
default 24) that re-syncs every connected GitHub connector across every company, sharing the exact
same sync logic the manual button uses (`server/src/services/connectors/syncConnector.js` —
refactored out of the route handler so there's one code path, not two that could drift apart).
Auto-syncs are tagged distinctly from manual ones in the Timeline (`"GitHub (auto-sync)"` vs
`"GitHub"`), so it's always clear which happened when.

**In-process, not a cron job — and that's a deliberate, disclosed limitation.** This only runs
while the server process is alive, same as the rest of this local-first app; there's no OS-level
scheduling (that would need the same Full Disk Access workaround already documented for backups,
for something that only matters while the server is running anyway). It also does **not** sync on
startup — `node --watch` restarts on every file save during development, and firing a real GitHub
API call on each of those would be wasteful and a good way to trip a rate limit while iterating.

## Known limitations (v1)

- Single account per company (no team seats yet)
- No versioning/diffing between regenerations of the same doc type
- DOCX export handles headings, paragraphs, bullet/numbered lists, tables, and blockquotes —
  not a full markdown spec
- No built-in e-signature or audit-trail logging of who approved a document
- Evidence Intelligence is text-only (see above) — screenshot/image analysis needs a vision-capable
  provider path, not yet built
- Cloud Connectors cover GitHub only, three org-level policy signals (2FA enforcement, default repo
  permission, public-repo creation policy) — AWS/Azure/M365/Google are the natural next provider;
  branch protection/secret scanning would need the broader `repo` OAuth scope (deliberate tradeoff)
- Gap analysis checklist items are curated, not a full ISO 27001 Annex A (93 controls) or
  GDPR article-by-article mapping — it's honest about what it checks, not exhaustive
- Trend deltas need 7+ days of real usage history before they appear — by design, not a bug
