-- =============================================================================
-- UNIFIED SUPABASE & POSTGRESQL MASTER SCHEMA
-- Portfolio of Mohammad Mehdi Sadeghi (محمد مهدی صادقی)
--
-- INSTRUCTIONS FOR SUPABASE:
--   1. Go to your Supabase Dashboard -> SQL Editor
--   2. Click "New query"
--   3. Copy & paste the ENTIRE contents of this file
--   4. Click "Run" (or Ctrl + Enter)
--
-- This script is 100% IDEMPOTENT (safe to re-run multiple times):
--   * Uses CREATE ... IF NOT EXISTS
--   * Uses ON CONFLICT DO UPDATE / DO NOTHING
--   * Configures Row Level Security (RLS) policies for Supabase
--   * Seeds all Site Data, 11 Web Projects, 7 Mini-Projects, 8 Skills,
--     Telegram Bot configuration, Music Library, and Blog data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ADMIN SETTINGS (Durable Key-Value Store for Admin Panel)
--    Holds Telegram credentials, Site Info, Admin Auth, and Widget Settings.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_settings (
    key         VARCHAR(64) PRIMARY KEY,
    value       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_settings IS 'Generic JSON settings store for admin panel configurations.';

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_settings_touch ON admin_settings;
CREATE TRIGGER trg_admin_settings_touch
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2. PORTFOLIO PROJECTS (Web & Mini Projects)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id            SERIAL PRIMARY KEY,
    slug          VARCHAR(120) UNIQUE,
    title         VARCHAR(200) NOT NULL,
    description   TEXT        NOT NULL DEFAULT '',
    category      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    image_url     TEXT        NOT NULL DEFAULT '',
    url           TEXT        NOT NULL DEFAULT '',
    project_type  VARCHAR(20) NOT NULL DEFAULT 'web'
                  CHECK (project_type IN ('web', 'mini')),
    github_url    TEXT,
    display_order INT         NOT NULL DEFAULT 0,
    is_published  BOOLEAN     NOT NULL DEFAULT TRUE,
    clone         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing table if created from an older migration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS clone BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_projects_type  ON projects(project_type);
CREATE INDEX IF NOT EXISTS idx_projects_order ON projects(project_type, display_order);

DROP TRIGGER IF EXISTS trg_projects_touch ON projects;
CREATE TRIGGER trg_projects_touch
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. DEVELOPER SKILLS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    icon_url      TEXT         NOT NULL DEFAULT '',
    display_order INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Upgrade existing table if created from an older migration
ALTER TABLE skills ADD COLUMN IF NOT EXISTS icon_url      TEXT NOT NULL DEFAULT '';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_skills_order ON skills(display_order);

-- -----------------------------------------------------------------------------
-- 4. CONTACT MESSAGES (Inbox)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    phone_number VARCHAR(40)  NOT NULL DEFAULT '',
    message      TEXT         NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'unseen'
                 CHECK (status IN ('unseen', 'seen', 'archived')),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Upgrade existing table if created from an older migration
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone_number VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS status       VARCHAR(20) NOT NULL DEFAULT 'unseen';

CREATE INDEX IF NOT EXISTS idx_messages_status  ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON contact_messages(created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. ANALYTICS: PAGE VISITS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_visits (
    id           BIGSERIAL PRIMARY KEY,
    visit_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    visit_hour   SMALLINT NOT NULL CHECK (visit_hour BETWEEN 0 AND 23),
    page_path    VARCHAR(255) NOT NULL DEFAULT '/',
    country_code VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN',
    session_id   VARCHAR(128) NOT NULL,
    ip_hash      VARCHAR(64),
    user_agent   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade existing table if created from an older migration
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visit_date   DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visit_hour   SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS session_id   VARCHAR(128);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS ip_hash      VARCHAR(64);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS user_agent   TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_visits_date    ON site_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_session ON site_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_visits_path    ON site_visits(page_path);
CREATE INDEX IF NOT EXISTS idx_visits_country ON site_visits(country_code);

-- -----------------------------------------------------------------------------
-- 6. ANALYTICS: INTERACTIVE CLICKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_clicks (
    id           BIGSERIAL PRIMARY KEY,
    target_id    VARCHAR(100) NOT NULL,
    target_text  VARCHAR(150),
    target_label VARCHAR(150),
    target_type  VARCHAR(50) DEFAULT 'button',
    page_path    VARCHAR(255) NOT NULL DEFAULT '/',
    button_page  VARCHAR(100) DEFAULT '',
    session_id   VARCHAR(128),
    click_date   DATE DEFAULT CURRENT_DATE,
    click_hour   SMALLINT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade existing table if created from an older migration
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS target_text  VARCHAR(150);
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS target_label VARCHAR(150);
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS target_type  VARCHAR(50) DEFAULT 'button';
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS page_path    VARCHAR(255) NOT NULL DEFAULT '/';
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS button_page  VARCHAR(100) DEFAULT '';
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS session_id   VARCHAR(128);
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS click_date   DATE DEFAULT CURRENT_DATE;
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS click_hour   SMALLINT DEFAULT 0;
ALTER TABLE site_clicks ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ DEFAULT NOW();

-- Backfill click_date and click_hour from created_at if null
UPDATE site_clicks
SET click_date = COALESCE(click_date, created_at::DATE, CURRENT_DATE),
    click_hour = COALESCE(click_hour, EXTRACT(HOUR FROM created_at)::SMALLINT, 0)
WHERE click_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_clicks_target  ON site_clicks(target_id);
CREATE INDEX IF NOT EXISTS idx_clicks_date    ON site_clicks(click_date);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON site_clicks(created_at);

-- -----------------------------------------------------------------------------
-- 7. BLOG POSTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
    id             SERIAL PRIMARY KEY,
    slug           VARCHAR(150) UNIQUE NOT NULL,
    title          VARCHAR(255) NOT NULL,
    excerpt        TEXT,
    content        TEXT NOT NULL,
    cover_image    TEXT,
    cover_alt      TEXT,
    tags           JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_published   BOOLEAN NOT NULL DEFAULT TRUE,
    published_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade existing table if created from an older migration
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cover_alt      TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tags           JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_published   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS published_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_blog_slug      ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(is_published, published_date);

DROP TRIGGER IF EXISTS trg_blog_posts_touch ON blog_posts;
CREATE TRIGGER trg_blog_posts_touch
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -----------------------------------------------------------------------------
-- 8. MUSIC CATALOG & DIMENSIONAL MOOD DATABASE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS music_tracks (
    id                INT PRIMARY KEY,
    title             VARCHAR(150) NOT NULL,
    artist            VARCHAR(120) NOT NULL,
    audio_path        TEXT NOT NULL,
    cover_image       TEXT,
    mood_dimensions   JSONB NOT NULL DEFAULT '{}'::jsonb,
    acoustic_features JSONB NOT NULL DEFAULT '{}'::jsonb,
    lyrics_snippets   TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_artist ON music_tracks(artist);
CREATE INDEX IF NOT EXISTS idx_music_title  ON music_tracks(title);

-- -----------------------------------------------------------------------------
-- 9. ANALYTICS AGGREGATION VIEWS (For Dashboard Stats & Charts)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS view_popular_clicks CASCADE;
DROP VIEW IF EXISTS view_popular_pages CASCADE;
DROP VIEW IF EXISTS view_country_distribution CASCADE;
DROP VIEW IF EXISTS view_daily_traffic CASCADE;

CREATE OR REPLACE VIEW view_daily_traffic AS
SELECT 
    visit_date,
    COUNT(*) AS total_page_views,
    COUNT(DISTINCT session_id) AS unique_visitors
FROM site_visits
GROUP BY visit_date
ORDER BY visit_date DESC;

CREATE OR REPLACE VIEW view_country_distribution AS
SELECT 
    country_code,
    COUNT(*) AS total_visits,
    COUNT(DISTINCT session_id) AS unique_visitors,
    ROUND((COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM site_visits), 0)) * 100, 2) AS percentage
FROM site_visits
GROUP BY country_code
ORDER BY total_visits DESC;

CREATE OR REPLACE VIEW view_popular_pages AS
SELECT 
    page_path,
    COUNT(*) AS visit_count,
    COUNT(DISTINCT session_id) AS unique_visitors
FROM site_visits
GROUP BY page_path
ORDER BY visit_count DESC;

CREATE OR REPLACE VIEW view_popular_clicks AS
SELECT 
    target_id,
    COALESCE(target_text, target_label) AS label,
    COUNT(*) AS click_count,
    COUNT(DISTINCT session_id) AS unique_clickers
FROM site_clicks
GROUP BY target_id, COALESCE(target_text, target_label)
ORDER BY click_count DESC;

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- -----------------------------------------------------------------------------
ALTER TABLE admin_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_clicks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_tracks      ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency (including older migration naming variants)
DROP POLICY IF EXISTS "public read published projects" ON projects;
DROP POLICY IF EXISTS "Public can view published projects" ON projects;
DROP POLICY IF EXISTS "public read skills"             ON skills;
DROP POLICY IF EXISTS "Public can view skills"         ON skills;
DROP POLICY IF EXISTS "public read published blogs"    ON blog_posts;
DROP POLICY IF EXISTS "Public can view published blog posts" ON blog_posts;
DROP POLICY IF EXISTS "public read music tracks"       ON music_tracks;
DROP POLICY IF EXISTS "public insert messages"         ON contact_messages;
DROP POLICY IF EXISTS "Public can submit contact messages" ON contact_messages;
DROP POLICY IF EXISTS "public insert visits"           ON site_visits;
DROP POLICY IF EXISTS "Public can insert visits"       ON site_visits;
DROP POLICY IF EXISTS "public insert clicks"           ON site_clicks;
DROP POLICY IF EXISTS "Public can insert clicks"       ON site_clicks;

-- Public (anon) permissions
CREATE POLICY "public read published projects" ON projects
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "public read skills" ON skills
    FOR SELECT USING (TRUE);

CREATE POLICY "public read published blogs" ON blog_posts
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "public read music tracks" ON music_tracks
    FOR SELECT USING (TRUE);

CREATE POLICY "public insert messages" ON contact_messages
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "public insert visits" ON site_visits
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "public insert clicks" ON site_clicks
    FOR INSERT WITH CHECK (TRUE);

-- NOTE: admin_settings remains protected without anon policies.
-- Serverless & backend APIs use direct pooler connection / service role.

-- -----------------------------------------------------------------------------
-- 11. DATA SEEDING (Complete & Up-to-Date Baseline)
-- -----------------------------------------------------------------------------

-- 11a. Telegram Bot Configuration
INSERT INTO admin_settings (key, value) VALUES (
    'telegram',
    '{"enabled": true, "botToken": "8755286653:AAHWCCa0ueaBLh5iCsdAhW1VlJEp4luDvrA", "chatId": "8834580318"}'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 11b. Site Identity & Social Links
INSERT INTO admin_settings (key, value) VALUES (
    'site',
    '{
      "brand": "Mohammad-Mehdi-Sadeghi",
      "email": "mohammad.m.sadeghi09@gmail.com",
      "phone": "+989150669620",
      "phoneLabel": "+98 915 066 9620",
      "github": "https://github.com/MohammadMehdiSadeghi",
      "githubHandle": "MohammadMehdiSadeghi",
      "linkedin": "https://www.linkedin.com/in/mohammad-mehdi-sadeghi",
      "telegram": "https://t.me/Mohammad_sadeghi34",
      "telegramHandle": "Mohammad_sadeghi34",
      "instagram": "https://www.instagram.com/Mohammad_sadeghi3447",
      "instagramHandle": "Mohammad_sadeghi3447"
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 11c. Admin Authentication Credentials
INSERT INTO admin_settings (key, value) VALUES (
    'admin_auth',
    '{
      "username": "mohammad.m.sadeghi09@gmail.com",
      "password_sha256": "b5935771f43bbca6b350f841baa5ed7fb25fbaa8168ebdff549fa16295f46680",
      "token_version": 3
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 11d. Developer Skills (8 Frontend Skills)
INSERT INTO skills (name, icon_url, display_order)
SELECT v.name, v.icon_url, v.display_order
FROM (VALUES
    ('HTML',         '/assets/Images/html_1051277.webp', 1),
    ('CSS',          '/assets/Images/css_919826.webp',   2),
    ('JavaScript',   '/assets/Images/js_5968292.webp',   3),
    ('React',        '/assets/Images/react.webp',        4),
    ('Next.js',      '/assets/Images/nextjs.webp',       5),
    ('Tailwind CSS', '/assets/Images/tailwind.webp',     6),
    ('TypeScript',   '/assets/Images/typescript.webp',   7),
    ('WordPress',    '/assets/Images/wordpress_174881.webp', 8)
) AS v(name, icon_url, display_order)
WHERE NOT EXISTS (SELECT 1 FROM skills s WHERE s.name = v.name);

-- Ensure legacy Node.js / Express skills are permanently purged
DELETE FROM skills WHERE LOWER(TRIM(name)) IN ('node', 'node.js', 'nodejs', 'express', 'express.js');

-- 11e. Web Projects (All 11 Web Projects)
INSERT INTO projects (title, description, category, image_url, project_type, url, display_order, clone)
SELECT v.title, v.description, v.category, v.image_url, v.project_type, v.url, v.display_order, v.clone
FROM (VALUES
    ('Rokad Web', 'Rokad — a modern multi-page platform built with Next.js 14, Tailwind CSS, and Framer Motion. Features news, events, alumni, honors, blog, and fully responsive pages, now live in production.', '["Next.js","React","Tailwind"]'::jsonb, '', 'web', 'https://rokadschool.ir', 1, FALSE),
    ('DigiKala', 'A responsive clone of the DigiKala e-commerce website built with HTML, CSS, and JavaScript, including product listings, navigation, and a clean shopping interface.', '["HTML","CSS","JavaScript"]'::jsonb, '/assets/previews/Digikala.webp', 'web', '../Projects/Web-Project/Digikala/index.html', 2, TRUE),
    ('Porskad', 'Porskad — a dedicated form and survey management system for educational institutes. Built with React, Tailwind CSS, and Framer Motion, featuring an interactive admin dashboard, embeddable forms, and a responsive UI.', '["React","Tailwind","JavaScript"]'::jsonb, '/assets/previews/porskad.webp', 'web', 'https://porskad.vercel.app', 3, FALSE),
    ('Rokad College', 'Rokad College — a modern online learning platform built with React 18, Tailwind CSS, and Swiper. Features hero sections, course pillars, statistics, and fully responsive pages, now live in production.', '["React","Tailwind","JavaScript"]'::jsonb, '', 'web', 'https://college.rokadschool.ir', 4, FALSE),
    ('Crypto Market', 'A cryptocurrency market dashboard built with React, Vite and Tailwind CSS. Live CoinGecko data through a shared context, instant currency switching, dynamic coin pages with routing, and interactive price charts.', '["React","Tailwind","JavaScript"]'::jsonb, '', 'web', '../Projects/Web-Project/cryptoproject', 5, FALSE),
    ('NovaBank', 'A modern banking and payments landing page built with React, Vite, and Tailwind CSS. Features a hero with layered card artwork, feature grid, billing and business sections, client logos, testimonials, and a fully responsive layout.', '["React","Tailwind"]'::jsonb, '', 'web', '../Projects/Web-Project/novabank', 6, FALSE),
    ('Ubisoft', 'A responsive clone of the Ubisoft website built with HTML, CSS, and JavaScript, featuring a modern UI, interactive sections, and smooth user experience.', '["HTML","CSS","JavaScript"]'::jsonb, '/assets/previews/Ubisoft.webp', 'web', '../Projects/Web-Project/Ubisoft/index.html', 7, TRUE),
    ('Khodrochini 110', 'A Persian WordPress site for a specialised Chinese-car repair workshop in Tehran. Custom theme with service pages, workshop gallery, FAQ, blog, and local SEO structure, all fully right-to-left.', '[]'::jsonb, '', 'web', 'https://khodrochini110.com/', 8, FALSE),
    ('Study Timer', 'A study tracker and exam countdown app built with Next.js, React, and Supabase. Features task management, study session tracking, and a clean modern interface.', '["Next.js","React","Supabase"]'::jsonb, '/assets/previews/konkortimer.webp', 'web', '../Projects/Web-Project/konkortimer-dist/', 9, FALSE),
    ('Sabz Learn', 'A modern online learning platform inspired by Sabz Learn, built with React and Tailwind CSS, featuring course browsing, reusable components, responsive design, and a clean user experience.', '["React","Tailwind"]'::jsonb, '/assets/previews/Sabz-Learn.webp', 'web', '../Projects/Web-Project/Sabz-Learn', 10, TRUE),
    ('Todo App', 'A task management application built with React and Tailwind CSS, allowing users to create, organize, edit, and track daily tasks through a clean and responsive interface.', '["React","Tailwind"]'::jsonb, '/assets/previews/Todo-App.webp', 'web', '../Projects/Web-Project/Todo-App/index.html', 11, FALSE)
) AS v(title, description, category, image_url, project_type, url, display_order, clone)
WHERE NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.project_type = v.project_type AND p.title = v.title
);

-- 11f. Mini Projects (All 7 Mini Projects)
INSERT INTO projects (slug, title, description, category, image_url, project_type, url, display_order)
SELECT v.slug, v.title, v.description, v.category, v.image_url, v.project_type, v.url, v.display_order
FROM (VALUES
    ('calculator', 'Calculator', 'A clean, responsive calculator built with React. Features basic arithmetic operations, keyboard support, and a modern minimal UI design.', '["React"]'::jsonb, '/assets/previews/Calculator.webp', 'mini', '../Projects/Mini-Project/Calculator/index.html', 1),
    ('timer', 'Timer', 'A countdown and stopwatch timer with start, pause, and reset controls. Built with clean HTML, CSS, and vanilla JavaScript.', '["JavaScript","HTML","CSS"]'::jsonb, '/assets/previews/timer.webp', 'mini', '../Projects/Mini-Project/timer/index.html', 2),
    ('currency-converter', 'Currency Converter', 'A clean, fully offline currency converter built with React and TypeScript. Supports 20+ major world currencies plus Iranian Toman, with a searchable dropdown, manual exchange rate input, and live-as-you-type conversion.', '["React","TypeScript"]'::jsonb, '/assets/previews/currency-converter.webp', 'mini', '../Projects/Mini-Project/currency-converter/', 3),
    ('css-playground', 'CSS Playground', 'A collection of 31 pure CSS animations — buttons, cards, loaders, motion, text effects, and backgrounds. Copy any snippet and use it anywhere.', '["HTML","CSS","JavaScript"]'::jsonb, '/assets/previews/css-playground.webp', 'mini', '../Projects/Mini-Project/css-playground-project/', 4),
    ('netbridge', 'NetBridge', 'Share your phone internet to PC with the phone''s VPN applied to the shared connection — free, open source, and under your control. Features Hotspot and USB tethering modes.', '[]'::jsonb, '', 'mini', 'https://github.com/MohammadMehdiSadeghi/NetBridge', 5),
    ('cachecleaner', 'CacheCleaner', 'A Windows cache cleaner desktop GUI app. Scans ~490 cache locations across applications, reports sizes, and safely deletes contents while preserving crucial profiles and keys.', '[]'::jsonb, '', 'mini', 'https://github.com/MohammadMehdiSadeghi/CacheCleaner', 6),
    ('work-buddy-rtl', 'WorkBuddy RTL', 'A Persian font and right-to-left layer for the WorkBuddy desktop app. Injects Vazir typography, automatic per-message direction, and RTL composer alignment at runtime, while the app''s own files stay byte-for-byte untouched. Works on Windows, macOS and Linux.', '[]'::jsonb, '', 'mini', 'https://github.com/MohammadMehdiSadeghi/work-buddy-rtl', 7)
) AS v(slug, title, description, category, image_url, project_type, url, display_order)
WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.slug = v.slug);

-- 11g. Music Tracks Catalog (26 Songs with Mood Engine Features)
INSERT INTO music_tracks (id, title, artist, audio_path, cover_image, mood_dimensions, acoustic_features) VALUES
(1, 'Without Me', 'Eminem', '/assets/Music/Without Me.mp3', '', '{"energy": 0.95, "euphoria": 0.85, "playfulness": 0.9, "power": 0.88}'::jsonb, '{"bpm": 112, "valence": 0.85}'::jsonb),
(2, 'Skyfall', 'Adele', '/assets/Music/Skyfall.mp3', '', '{"darkness": 0.88, "melancholy": 0.85, "power": 0.9, "tension": 0.85}'::jsonb, '{"bpm": 76, "valence": 0.35}'::jsonb),
(3, 'Set Fire to the Rain', 'Adele', '/assets/Music/Set Fire to the Rain.mp3', '', '{"heartbreak": 0.9, "power": 0.92, "sadness": 0.85}'::jsonb, '{"bpm": 108, "valence": 0.45}'::jsonb),
(4, 'Someone Like You', 'Adele', '/assets/Music/Someone Like You.mp3', '', '{"heartbreak": 0.98, "longing": 0.92, "sadness": 0.95}'::jsonb, '{"bpm": 67, "valence": 0.28}'::jsonb),
(5, 'The Winner Takes It All', 'ABBA', '/assets/Music/The Winner Takes It All.mp3', '', '{"heartbreak": 0.92, "nostalgia": 0.9, "sadness": 0.85}'::jsonb, '{"bpm": 127, "valence": 0.55}'::jsonb),
(6, 'Gimme! Gimme! Gimme!', 'ABBA', '/assets/Music/Gimme! Gimme! Gimme!.mp3', '', '{"energy": 0.92, "euphoria": 0.88, "longing": 0.75}'::jsonb, '{"bpm": 120, "valence": 0.8}'::jsonb),
(7, 'Lovely', 'Billie Eilish & Khalid', '/assets/Music/Lovely.mp3', '', '{"calm": 0.8, "darkness": 0.85, "loneliness": 0.92, "melancholy": 0.95}'::jsonb, '{"bpm": 115, "valence": 0.2}'::jsonb),
(8, 'Everything I Wanted', 'Billie Eilish', '/assets/Music/Everything I Wanted.mp3', '', '{"calm": 0.85, "dreaminess": 0.9, "reflection": 0.9, "warmth": 0.8}'::jsonb, '{"bpm": 120, "valence": 0.35}'::jsonb),
(9, 'As It Was', 'Harry Styles', '/assets/Music/As It Was.mp3', '', '{"energy": 0.85, "loneliness": 0.75, "nostalgia": 0.88}'::jsonb, '{"bpm": 174, "valence": 0.7}'::jsonb),
(10, 'Falling', 'Harry Styles', '/assets/Music/Falling.mp3', '', '{"heartbreak": 0.95, "loneliness": 0.9, "melancholy": 0.92, "sadness": 0.92}'::jsonb, '{"bpm": 80, "valence": 0.25}'::jsonb),
(11, 'Summertime Sadness', 'Lana Del Rey', '/assets/Music/Summertime Sadness.mp3', '', '{"dreaminess": 0.85, "melancholy": 0.92, "nostalgia": 0.9, "sensuality": 0.8}'::jsonb, '{"bpm": 112, "valence": 0.45}'::jsonb),
(12, 'Young and Beautiful', 'Lana Del Rey', '/assets/Music/Young and Beautiful.mp3', '', '{"dreaminess": 0.95, "longing": 0.9, "romance": 0.92, "warmth": 0.85}'::jsonb, '{"bpm": 114, "valence": 0.4}'::jsonb),
(13, 'Hips Don''t Lie', 'Shakira', '/assets/Music/Hips Don''t Lie.mp3', '', '{"energy": 0.98, "euphoria": 0.92, "playfulness": 0.9, "sensuality": 0.95}'::jsonb, '{"bpm": 100, "valence": 0.9}'::jsonb),
(14, 'Billie Jean', 'Michael Jackson', '/assets/Music/Billie Jean.mp3', '', '{"energy": 0.9, "mystery": 0.85, "power": 0.88, "tension": 0.82}'::jsonb, '{"bpm": 117, "valence": 0.75}'::jsonb),
(15, 'Smooth Criminal', 'Michael Jackson', '/assets/Music/Smooth Criminal.mp3', '', '{"energy": 0.98, "power": 0.92, "tension": 0.95}'::jsonb, '{"bpm": 118, "valence": 0.7}'::jsonb),
(16, 'Blinding Lights', 'The Weeknd', '/assets/Music/Blinding Lights.mp3', '', '{"energy": 0.98, "euphoria": 0.9, "longing": 0.78, "nostalgia": 0.85}'::jsonb, '{"bpm": 171, "valence": 0.65}'::jsonb),
(17, 'Starboy', 'The Weeknd', '/assets/Music/Starboy.mp3', '', '{"darkness": 0.8, "energy": 0.9, "power": 0.92}'::jsonb, '{"bpm": 186, "valence": 0.6}'::jsonb),
(18, 'Believer', 'Imagine Dragons', '/assets/Music/Believer.mp3', '', '{"defiance": 0.95, "energy": 0.98, "power": 0.98, "rebellion": 0.88}'::jsonb, '{"bpm": 125, "valence": 0.75}'::jsonb),
(19, 'Demons', 'Imagine Dragons', '/assets/Music/Demons.mp3', '', '{"darkness": 0.88, "hope": 0.8, "melancholy": 0.85, "power": 0.85}'::jsonb, '{"bpm": 90, "valence": 0.45}'::jsonb),
(20, 'Blank Space', 'Taylor Swift', '/assets/Music/Blank Space.mp3', '', '{"energy": 0.88, "playfulness": 0.92, "power": 0.85, "sensuality": 0.8}'::jsonb, '{"bpm": 96, "valence": 0.8}'::jsonb),
(21, 'Shake It Off', 'Taylor Swift', '/assets/Music/Shake It Off.mp3', '', '{"defiance": 0.85, "energy": 0.98, "euphoria": 0.95, "joy": 0.98}'::jsonb, '{"bpm": 160, "valence": 0.95}'::jsonb),
(22, 'Je Veux', 'ZAZ', '/assets/Music/Je Veux.mp3', '', '{"defiance": 0.85, "energy": 0.9, "joy": 0.95, "playfulness": 0.92}'::jsonb, '{"bpm": 154, "valence": 0.9}'::jsonb),
(23, 'Cornfield Chase', 'Hans Zimmer', '/assets/Music/Cornfield Chase.mp3', '', '{"dreaminess": 0.95, "hope": 0.92, "power": 0.95, "reflection": 0.92, "tension": 0.85}'::jsonb, '{"bpm": 96, "valence": 0.5}'::jsonb),
(24, 'Amour plastique', 'Videoclub', '/assets/Music/Amour plastique.mp3', '', '{"dreaminess": 0.9, "nostalgia": 0.92, "romance": 0.95, "warmth": 0.88}'::jsonb, '{"bpm": 124, "valence": 0.75}'::jsonb),
(25, 'Cigarettes out the Window', 'TV Girl', '/assets/Music/Cigarettes out the Window.mp3', '', '{"melancholy": 0.88, "nostalgia": 0.92, "reflection": 0.85}'::jsonb, '{"bpm": 118, "valence": 0.55}'::jsonb),
(26, 'Counting Stars', 'OneRepublic', '/assets/Music/Counting Stars.mp3', '', '{"energy": 0.95, "euphoria": 0.9, "hope": 0.88, "joy": 0.85}'::jsonb, '{"bpm": 122, "valence": 0.8}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    artist = EXCLUDED.artist,
    audio_path = EXCLUDED.audio_path,
    mood_dimensions = EXCLUDED.mood_dimensions,
    acoustic_features = EXCLUDED.acoustic_features;

-- 11h. Blog Post Baseline
INSERT INTO blog_posts (slug, title, excerpt, content, tags, is_published, published_date)
VALUES (
    'benefits-of-a-professional-website-for-small-businesses',
    'Benefits of a professional website for small businesses',
    'A website is not a brochure. Here is what a professional site actually changes for a small business: how people find you, why they trust you, and the enquiries you never see.',
    'Most small businesses already have a website. Very few have one that earns its keep.

The story is almost always the same: a five-page site was built a few years ago, nobody has touched it since, and every new customer still arrives through Instagram or a phone call. The site sits in the background like a business card in a drawer.

That is not a website problem. It is a definition problem. A website is not a brochure you hang on the internet. It is the only part of a small business that keeps working while the owner sleeps, in every city, for every customer who is searching instead of scrolling.

Here are the benefits of a professional website for small businesses, in the order they usually show up.

## You get found by people who are already looking

Social media gives you rented attention. A feed shows your post to a slice of your followers, then forgets it. Search works the other way around: someone types what they need, and the results are answers to a question they already have.

That difference matters more than it sounds. A person who finds you through search has already decided they want what you sell. They are not being interrupted; they are looking. A business that shows up in those results starts every conversation a step ahead.

None of that happens with a site that has one page and no text. Search engines need words to match against. A professional website is written around the services people actually search for, in the language they use for them.

## Trust is decided before the first message

People judge a business in seconds, and they do it before they contact you. If the only thing they can find is a social profile with no address, no prices, and no clear description of what you do, they keep scrolling.

A well-built site does the quiet work of answering the questions a cautious customer has: who are you, what exactly do you do, where are you, who have you worked with, and how do I reach a human being.

That is also why a broken site is worse than no site. Slow pages, dead links and a phone number that no longer works do not read as small business. They read as probably gone.

## Your shop is open while you sleep

A website does not close. Somebody comparing three suppliers at eleven at night, or on a Friday when your office is shut, can read your services, check your prices and send a message. By the time you open, the enquiry is waiting.

For a business that runs on appointments, this is the difference between a full week and an empty one. The site takes the first step so your calendar fills itself.

## You stop answering the same questions

Every small business has a list of questions it answers ten times a week: how much does it cost, how long does it take, do you deliver, what are your hours, can I pay in instalments.

A professional website answers them once, in writing, in a place customers can find at any hour. That is not just convenience. It filters out the enquiries that were never going to convert, and it means the conversations you do have start further along.

## You can finally see what is working

Offline marketing is mostly guesswork. You pay for a banner, you get some calls, and you never really know which one caused which.

A site with analytics tells you which pages people read, where they leave, which service they searched for, and which channel sent them. After a few months you are no longer guessing where to spend the next budget. You are reading it.

## What a cheap website actually costs

The cheapest quote is rarely the cheapest outcome. A site that loads in six seconds, breaks on a phone, and cannot be edited without a developer does not save money. It spends it slowly, in enquiries you never hear about.

There is a second cost that is easier to miss: the site that cannot grow. If adding a service page or a new language means calling someone and waiting two weeks, the site stops matching the business within a year.

## What professional should mean in practice

The word gets used loosely, so here is what it should actually promise:

- Loads in under two seconds on a normal phone connection
- Works properly on a phone before it works on a desktop
- Says clearly what the business does, for whom, and where
- Can be updated by the owner without calling a developer
- Has one obvious way to get in touch, repeated on every page
- Is built so search engines can read it, not just so it looks good
- Has someone responsible for it after launch

If a proposal cannot tick those boxes, the price is not the interesting part of the conversation.

## Do you need one right now

Not every business needs a website today. If all your work comes from referrals, you are booked for months, and your customers never search online, a site will not change much.

But if any of this sounds familiar, it is probably already costing you:

- Customers ask for your address or prices by message every week
- You cannot explain what you do with a single link
- Competitors with weaker work show up above you in search
- You have no idea how many people looked at your offer last month

Those are the signals. The benefits of a professional website for small businesses are not abstract. They show up as fewer repeated questions, better enquiries, and a business that is findable exactly when someone is ready to buy.',
    '["Business", "SEO", "Small Business"]'::jsonb,
    TRUE,
    '2026-11-23'
)
ON CONFLICT (slug) DO NOTHING;

-- 11i. Seed baseline for admin_settings blog JSON key (fallback compatibility)
INSERT INTO admin_settings (key, value) VALUES (
    'blog',
    '{"posts": [
        {
          "id": 3,
          "slug": "benefits-of-a-professional-website-for-small-businesses",
          "title": "Benefits of a professional website for small businesses",
          "excerpt": "A website is not a brochure. Here is what a professional site actually changes for a small business: how people find you, why they trust you, and the enquiries you never see.",
          "cover": "",
          "coverAlt": "",
          "tags": ["Business", "SEO", "Small Business"],
          "date": "2026-11-23",
          "published": true
        }
    ]}'::jsonb
) ON CONFLICT (key) DO NOTHING;
