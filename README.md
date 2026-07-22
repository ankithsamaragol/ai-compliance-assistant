# AI Compliance Assistant

Generates first-draft compliance documents — ISO 27001 policies, GDPR policies,
risk assessments, and audit evidence checklists — tailored to a company's profile.
Every generated document is a starting point for human/legal review, not a finished,
certifiable artifact.

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

## How it works

1. Create a company profile (industry, size, data types handled, cloud providers, etc.)
2. Pick a framework (ISO 27001, GDPR, Risk Assessment, Audit Evidence) and a document type
3. The server builds a prompt from `server/src/templates/catalog.js`, calls the local
   Ollama model, and stores the result as markdown
4. Preview in-browser or download as a `.docx`

## Document catalog

- **ISO 27001**: Information Security Policy, Access Control Policy, Incident Response Plan
- **GDPR**: Privacy Policy, Data Processing Agreement, Record of Processing Activities (ROPA)
- **Risk Assessment**: Risk Register, Vendor Risk Assessment
- **Audit Evidence**: Evidence Checklist, Control Narrative Summary

Add new document types by adding entries to `CATALOG` in `server/src/templates/catalog.js` —
no other code changes needed.

## Known limitations (v1)

- Single account per company (no team seats yet)
- No versioning/diffing between regenerations of the same doc type
- DOCX export handles headings, paragraphs, bullet/numbered lists, tables, and blockquotes —
  not a full markdown spec
- No built-in e-signature or audit-trail logging of who approved a document
