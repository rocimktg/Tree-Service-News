-- Tree Service News — database schema
-- Run against your Netlify DB / Neon Postgres instance

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── categories ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  label       VARCHAR(50)  NOT NULL,  -- all-caps tag shown in UI, e.g. GEAR
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS categories_slug_idx ON categories (slug);

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── sources (optional MVP, useful for auto-detect later) ─────────────────────

CREATE TABLE IF NOT EXISTS sources (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  domain              VARCHAR(200) NOT NULL UNIQUE,
  default_category_id INTEGER REFERENCES categories (id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── links (briefs) ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS links (
  id                  SERIAL PRIMARY KEY,
  title               TEXT         NOT NULL,
  slug                VARCHAR(400) NOT NULL UNIQUE,
  source_url          TEXT         NOT NULL,
  source_name         VARCHAR(200),
  source_published_at DATE,
  summary             TEXT,
  tsn_take            TEXT,
  why_it_matters      TEXT,
  category_id         INTEGER      NOT NULL REFERENCES categories (id),
  status              VARCHAR(20)  NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived')),
  is_featured         BOOLEAN      NOT NULL DEFAULT FALSE,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS links_status_idx       ON links (status);
CREATE INDEX IF NOT EXISTS links_category_idx     ON links (category_id);
CREATE INDEX IF NOT EXISTS links_published_at_idx ON links (published_at DESC);
CREATE INDEX IF NOT EXISTS links_slug_idx         ON links (slug);
CREATE INDEX IF NOT EXISTS links_featured_idx     ON links (is_featured) WHERE is_featured = TRUE;

CREATE TRIGGER links_updated_at
  BEFORE UPDATE ON links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── submissions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS submissions (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  company             VARCHAR(200),
  email               VARCHAR(300) NOT NULL,
  story_type          VARCHAR(100),
  story_idea          TEXT,
  source_url          TEXT,
  photo_url           TEXT,
  permission_confirmed BOOLEAN     NOT NULL DEFAULT FALSE,
  status              VARCHAR(20)  NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'reviewed', 'approved', 'rejected', 'published')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS submissions_status_idx     ON submissions (status);
CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at DESC);

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── newsletter_signups ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS newsletter_signups (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(300) NOT NULL UNIQUE,
  source_page VARCHAR(300),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS newsletter_email_idx ON newsletter_signups (email);

-- ─── seed: categories ─────────────────────────────────────────────────────────

INSERT INTO categories (name, slug, label, description) VALUES
  ('Gear',          'gear',           'GEAR',      'Chippers, loaders, cranes, saws, ropes, PPE, trucks, trailers, and tools for tree crews.'),
  ('Safety',        'safety',         'SAFETY',    'Crew safety, climbing practices, jobsite hazards, storm work, and training resources.'),
  ('Storm Response','storm-response', 'STORMS',    'Emergency work, storm season prep, demand trends, and disaster recovery for tree crews.'),
  ('Business',      'business',       'BUSINESS',  'Pricing, hiring, scheduling, insurance, customer communication, and reviews.'),
  ('Marketing',     'marketing',      'MARKETING', 'Websites, reviews, local SEO, photography, and online presence for tree companies.'),
  ('Climbing',      'climbing',       'CLIMBING',  'Techniques, gear, certification, rigging, and aerial work for tree climbers.'),
  ('Insurance',     'insurance',      'INSURANCE', 'Coverage, claims, liability, workers comp, and industry-specific risk for tree companies.'),
  ('Hiring',        'hiring',         'HIRING',    'Recruiting, retention, pay, training, and building a crew for tree service businesses.'),
  ('Industry News', 'industry-news',  'INDUSTRY',  'Company news, manufacturer updates, trade show coverage, and industry announcements.'),
  ('Tree WTF',      'tree-wtf',       'TREE WTF',  'The wildest, most surprising, and occasionally absurd stories from the tree service world.')
ON CONFLICT (slug) DO NOTHING;
