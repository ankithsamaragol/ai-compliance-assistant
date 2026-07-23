-- AI Compliance Assistant schema

CREATE TABLE IF NOT EXISTS accounts (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name TEXT;

CREATE TABLE IF NOT EXISTS companies (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
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

ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tools_used TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_systems_used TEXT[] NOT NULL DEFAULT '{}';

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

CREATE INDEX IF NOT EXISTS idx_companies_account ON companies(account_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_company ON chat_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_evidence_company ON evidence(company_id);
CREATE INDEX IF NOT EXISTS idx_connectors_company ON connectors(company_id);
