# Roadmap

Tracked against `AI_Compliance_Platform_Market_Gap_Product_Vision.docx` — the market-gap analysis
and product vision this project is built from. Updated as phases land; see git history and
README.md for implementation detail on any item marked done.

## Phases

| # | Phase (per vision doc) | Status |
|---|---|---|
| 1 | Company profiling + AI documents | ✅ Done |
| 2 | Gap analysis + compliance score | ✅ Done — overshot: also shipped Vendor Risk Register, Next Best Action, Framework Translator, Compliance Chat, Executive Report |
| 3 | Evidence intelligence + risk management | 🟡 Evidence Intelligence done (text-only); risk management is still just the Phase 2 vendor register |
| 4 | Cloud integrations + continuous monitoring | 🟡 One connector (GitHub), three org-level signals, auto re-sync every 24h — no other providers yet |
| 5 | AI Compliance Officer (memory, prediction, simulation) | 🟡 Memory/Timeline + proactive insights + business-change alerts done; prediction/simulation unbuilt |

## The 15 capabilities named in the vision doc

| Capability | Status | Notes |
|---|---|---|
| AI Framework Translator | ✅ Done | `server/src/templates/controlMapping.js` |
| AI Compliance Chat | ✅ Done | `server/src/services/complianceChat.js` |
| AI Executive Reports | ✅ Done | `server/src/services/executiveReport.js` |
| AI Evidence Intelligence | ✅ Done | Text documents only (PDF/DOCX/TXT/MD/CSV/LOG/JSON) — no vision/screenshot support yet |
| AI Compliance Memory | ✅ Done | `score_snapshots` table + Timeline tab — foundation only, not yet used for prediction |
| Compliance Timeline | ✅ Done | Real events only, never backfilled or put on a timer |
| AI Compliance Brain | 🟡 Partial | Reasoning exists (gap scoring, Next Best Action, Framework Translator, Chat) but isn't unified under one "brain" concept |
| Compliance Strategy Engine | ❌ Not built | Bigger than Next Best Action — a multi-step certification roadmap, not just single-action ranking |
| Compliance Simulation | ❌ Not built | "What if we drop this vendor / add this control" scenario modeling |
| AI Risk Prediction | ❌ Not built | Score history now exists as of Phase 5 foundation — this is the natural next consumer of it |
| AI Regulation Interpreter | ❌ Not built | |
| AI Compliance Coach | ❌ Not built | |
| AI Auditor Mode | ❌ Not built | |
| Compliance Marketplace | ❌ Not built | |
| Industry Packs | ❌ Not built | |

## What's actually shipped, beyond the doc's list

- **Next Best Action** ranking (cross-framework impact scoring) — the doc's "weak prioritization"
  competitor gap, addressed even though not named as its own capability
- **CMMC/NIST 800-171** and **ISO 42001/AI Governance** frameworks — the two underserved-market
  gaps identified before building anything
- Dual AI provider architecture (Groq cloud + local Ollama) with automatic rate-limit handling
- Full sidebar/dashboard UI matched to a reference SaaS design, including honest trend deltas
- **Proactive AI Compliance Officer** — deterministic, non-LLM insight generated after every
  score-moving action, shown on the dashboard instead of a static "ask me anything" prompt
- **Continuous monitoring** — connected GitHub connectors auto re-sync every 24h in-process, tagged
  distinctly from manual syncs in the Timeline
- **Two extra GitHub org-level signals** beyond 2FA enforcement — default repository permission and
  public-repo creation policy, still within `read:org` scope
- **Business change detection** — editing a company profile (Settings tab) now diffs before/after
  and raises a Dashboard alert for new vendors/tools, new AI systems, or new data-handling facts;
  additions only, dismissable, each with a quick-action jump to Vendors or Documents

## Known gaps / explicitly deferred (not oversights)

- **Evidence Intelligence is text-only.** Screenshots (the most common real compliance evidence)
  need a vision-capable model path the current Groq/Ollama providers don't have. A local Ollama
  vision model (`llava:7b`) was tried and abandoned — the machine only has 8GB RAM and hung loading
  it; a cloud vision provider (e.g. Claude Haiku 4.5) is the likely path if this gets picked back up.
- **Cloud Connectors cover GitHub only, three org-level signals** (2FA enforcement, default repo
  permission, public-repo creation). A personal-account 2FA fallback was attempted and reverted —
  GitHub's API genuinely doesn't expose that data. AWS/Azure/M365/Google are unbuilt; each needs a
  materially different auth model. Branch protection/secret scanning would need the broader `repo`
  OAuth scope (deliberate tradeoff, not built).
- **Trend deltas need 7+ days of real usage** before they appear, by design — no fallback to
  "closest available" data, which would mislabel a same-day comparison as a weekly trend.
- **Gap analysis checklist is curated**, not a full ISO 27001 Annex A (93 controls) or GDPR
  article-by-article mapping.
- **Business change detection only watches vendor/tool/AI-system/data-type/PII fields** — editing
  name, industry, size, country, or notes never raises an alert.

## Suggested next steps, in rough order of leverage

1. **AI Risk Prediction** — the score-history table Phase 5's foundation built is sitting there
   unused for this; it's the most natural next consumer of real data rather than a new subsystem.
2. **Widen Evidence Intelligence to screenshots** via a cloud vision-capable provider (local Ollama
   ruled out by hardware) — closes the biggest gap between "what evidence really looks like" and
   what the app can currently read.
3. **A second cloud connector provider** (AWS/Azure/M365/Google), or more GitHub signals (branch
   protection, secret scanning, Dependabot) using the now-proven OAuth + encrypted-token +
   evidence pipeline.
4. **Compliance Simulation / Strategy Engine** — the more ambitious Phase 5 capabilities, once
   Risk Prediction has proven out the data model.
