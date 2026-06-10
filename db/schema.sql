-- Brève database schema
-- Run once against a fresh Neon project (free tier, 0.5 GB).
-- Requires: pgvector extension for semantic clustering.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Raw ingested articles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_key  TEXT NOT NULL,
  source_name TEXT NOT NULL,
  url         TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  snippet     TEXT,
  image_url   TEXT,
  category    TEXT NOT NULL DEFAULT 'world',
  region      TEXT NOT NULL DEFAULT 'global',
  pub_date    TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  embedding   vector(768),        -- text-embedding-004 native dim
  cluster_id  UUID
);
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles (url);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles (pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_embedding
  ON articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── Story clusters (semantic dedup groups) ─────────────────────────
CREATE TABLE IF NOT EXISTS article_clusters (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  article_count        INT NOT NULL DEFAULT 0,
  centroid             vector(768),
  representative_title TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed')),
  pipeline_started_at  TIMESTAMPTZ,
  pipeline_finished_at TIMESTAMPTZ,
  error_message        TEXT
);
CREATE INDEX IF NOT EXISTS idx_clusters_status ON article_clusters (status);

-- ── Agent pipeline runs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id        UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  compiled_facts    JSONB,
  conflicting_data  JSONB,
  sourcing_done_at  TIMESTAMPTZ,
  fact_check_notes  JSONB,
  verified_facts    JSONB,
  factcheck_done_at TIMESTAMPTZ,
  draft_summary     TEXT,
  writer_done_at    TIMESTAMPTZ,
  guardrail_passed  BOOLEAN,
  guardrail_notes   TEXT,
  final_summary     TEXT,
  guardrail_done_at TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sourcing','factcheck','writing','guardrail','approved','rejected'))
);

-- ── Verified published stories ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS processed_stories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id      UUID NOT NULL,
  pipeline_run_id UUID NOT NULL,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'world',
  region          TEXT NOT NULL DEFAULT 'global',
  source_keys     TEXT[] NOT NULL,
  source_names    TEXT[] NOT NULL,
  primary_url     TEXT NOT NULL,
  image_url       TEXT,
  conflict_flag   BOOLEAN NOT NULL DEFAULT FALSE,
  guardrail_notes TEXT,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '6 hours',
  translations    JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_stories_published ON processed_stories (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON processed_stories (expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_category ON processed_stories (category);

-- ── Global coverage discovered by the Scout agent ─────────────────
-- Populated during ingest for clusters with ≥2 articles.
-- Not embedded — pure breadth data for the coverage bar + Newsroom.
CREATE TABLE IF NOT EXISTS cluster_coverage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id    UUID NOT NULL REFERENCES article_clusters(id) ON DELETE CASCADE,
  publisher     TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL UNIQUE,
  country       TEXT,
  lang          TEXT,
  pub_date      TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cluster_coverage_cluster ON cluster_coverage(cluster_id);

-- ── User preferences (mirror of localStorage for signed-in users) ──
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id    TEXT PRIMARY KEY,
  edition    TEXT DEFAULT 'US:en',
  lang       TEXT DEFAULT 'English',
  follows    JSONB NOT NULL DEFAULT '[]',
  affinity   JSONB NOT NULL DEFAULT '{}',
  streak     JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Maintenance: purge articles and coverage older than 30 days ────
-- Run this periodically (or add to ingest cron):
-- DELETE FROM cluster_coverage WHERE discovered_at < NOW() - INTERVAL '30 days';
-- DELETE FROM articles WHERE ingested_at < NOW() - INTERVAL '30 days';
