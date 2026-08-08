-- AI Compliance Assistant schema

CREATE TABLE IF NOT EXISTS accounts (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_data_url TEXT; -- personal profile photo, same inline data: URI pattern as companies.logo_data_url

-- Team support: every account belongs to exactly one organization (its own,
-- auto-created at signup, unless a signup joins via an invite token instead).
-- All company ownership is scoped by org_id, not account_id directly, so
-- teammates in the same org share the same companies.
CREATE TABLE IF NOT EXISTS organizations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  id          SERIAL PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',  -- owner | member
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, account_id)
);

CREATE TABLE IF NOT EXISTS org_invites (
  id          SERIAL PRIMARY KEY,
  org_id      INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  created_by  INTEGER NOT NULL REFERENCES accounts(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill: every account that predates this table gets its own org, as owner.
-- Iterates accounts directly (not companies) so an account with zero
-- companies still gets an org — otherwise it couldn't create its first one.
-- Idempotent: the LEFT JOIN/WHERE IS NULL skips accounts already migrated.
DO $$
DECLARE
  acc RECORD;
  new_org_id INTEGER;
BEGIN
  FOR acc IN
    SELECT a.id, a.name, a.email FROM accounts a
    LEFT JOIN org_members om ON om.account_id = a.id
    WHERE om.id IS NULL
  LOOP
    INSERT INTO organizations (name) VALUES (COALESCE(acc.name, acc.email) || '''s Workspace')
      RETURNING id INTO new_org_id;
    INSERT INTO org_members (org_id, account_id, role) VALUES (new_org_id, acc.id, 'owner');
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS companies (
  id              SERIAL PRIMARY KEY,
  org_id          INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  industry        TEXT NOT NULL,
  size_band       TEXT NOT NULL,           -- e.g. '1-10', '11-50', '51-200', '200+'
  country         TEXT NOT NULL,
  processes_pii   BOOLEAN NOT NULL DEFAULT false,
  processes_eu_data BOOLEAN NOT NULL DEFAULT false,
  data_types      TEXT[] NOT NULL DEFAULT '{}',   -- e.g. {customer_pii, payment_data, health_data}
  cloud_providers TEXT[] NOT NULL DEFAULT '{}',   -- e.g. {aws, gcp, azure}
  contact_email   TEXT,
  tools_used      TEXT[] NOT NULL DEFAULT '{}',   -- e.g. {Stripe, GitHub, Google Workspace}
  ai_systems_used TEXT[] NOT NULL DEFAULT '{}',   -- e.g. {"GPT-4 API customer chatbot", "internal fraud-detection model"}
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time migration for a pre-existing companies.account_id column (a live DB
-- created before org support existed). Add/populate/drop rather than renaming
-- in place: org ids don't align 1:1 with account ids (account ids have gaps
-- from earlier deleted test accounts), so org_id is populated via an explicit
-- join, never by reinterpreting the old column's raw integers. No-op on a
-- fresh database (the CREATE TABLE above already created org_id directly).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN org_id INTEGER;
    UPDATE companies c SET org_id = om.org_id
      FROM org_members om WHERE c.account_id = om.account_id;
    ALTER TABLE companies ALTER COLUMN org_id SET NOT NULL;
    ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_account_id_fkey;
    ALTER TABLE companies DROP COLUMN account_id;
    ALTER TABLE companies ADD CONSTRAINT companies_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tools_used TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_systems_used TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_data_url TEXT; -- small logo, stored inline as a data: URI (no file-serving route exists yet)

CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  framework     TEXT NOT NULL,   -- iso27001 | gdpr | risk_assessment | audit_evidence
  doc_type      TEXT NOT NULL,   -- e.g. information_security_policy, privacy_policy, ropa, risk_register
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft | generating | ready | failed
  content_md    TEXT,            -- generated markdown content
  model         TEXT,
  provider      TEXT,            -- groq | ollama
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS provider TEXT;

CREATE TABLE IF NOT EXISTS vendors (
  id                    SERIAL PRIMARY KEY,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,             -- hosting | payments | authentication | code_repository | email | analytics | other
  risk_tier             TEXT NOT NULL,              -- critical | high | medium | low
  reasoning             TEXT,
  recommended_controls  TEXT[] NOT NULL DEFAULT '{}',
  review_frequency      TEXT,                       -- e.g. "Every 6 months", "Annual"
  source                TEXT NOT NULL DEFAULT 'ai',  -- ai | manual
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,   -- user | assistant
  content     TEXT NOT NULL,
  provider    TEXT,            -- groq | ollama (null for user messages)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,        -- name on disk under server/uploads/evidence/<company_id>/, or a synthetic id for connector-sourced rows
  original_name   TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | analyzed | unsupported | failed
  summary         TEXT,
  mapped_controls JSONB NOT NULL DEFAULT '[]',       -- [{framework,key,confidence,reasoning}]
  provider        TEXT,
  model           TEXT,
  error           TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_at     TIMESTAMPTZ
);

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload'; -- upload | github

CREATE TABLE IF NOT EXISTS connectors (
  id                      SERIAL PRIMARY KEY,
  company_id              INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL,   -- 'github' (v1); more providers later
  external_account        TEXT,            -- e.g. GitHub org login
  access_token_encrypted  TEXT NOT NULL,   -- AES-256-GCM, never stored in plaintext
  scopes                  TEXT,
  status                  TEXT NOT NULL DEFAULT 'connected', -- connected | error
  error                   TEXT,
  last_synced_at          TIMESTAMPTZ,
  connected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, provider)
);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  overall_score     INTEGER NOT NULL,
  framework_scores  JSONB NOT NULL,     -- {iso27001: 40, gdpr: 33, cmmc: 29, iso42001: 14}
  documents_ready   INTEGER NOT NULL,
  vendor_count      INTEGER NOT NULL,
  evidence_count    INTEGER NOT NULL,
  open_risks        INTEGER NOT NULL,
  trigger           TEXT NOT NULL,      -- document_generated | vendor_detected | evidence_analyzed | connector_synced
  trigger_detail    TEXT,               -- e.g. document title, "4 vendors detected", filename
  insight           TEXT,               -- deterministic, computed message: what changed + what's next
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE score_snapshots ADD COLUMN IF NOT EXISTS insight TEXT;

CREATE TABLE IF NOT EXISTS profile_change_alerts (
  id                SERIAL PRIMARY KEY,
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  message           TEXT NOT NULL,
  suggested_action  TEXT,          -- 'vendors' | 'documents' | null
  dismissed         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risks (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'other',  -- operational | technical | vendor | data | personnel | other
  likelihood    TEXT NOT NULL,                  -- low | medium | high
  impact        TEXT NOT NULL,                  -- low | medium | high
  risk_level    TEXT NOT NULL,                  -- critical | high | medium | low — computed from likelihood x impact, never AI-assigned directly
  mitigation    TEXT,
  owner         TEXT,
  status        TEXT NOT NULL DEFAULT 'open',   -- open | mitigated | accepted
  source        TEXT NOT NULL DEFAULT 'manual', -- ai | manual
  reasoning     TEXT,                            -- set when source = 'ai'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_account ON org_members(account_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_company ON chat_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_evidence_company ON evidence(company_id);
CREATE INDEX IF NOT EXISTS idx_connectors_company ON connectors(company_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_company ON score_snapshots(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risks_company ON risks(company_id);
CREATE INDEX IF NOT EXISTS idx_profile_change_alerts_company ON profile_change_alerts(company_id);
