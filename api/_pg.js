/* ════════════════════════════════════════════════════════════════════
   Postgres (Supabase) store — the durable backend for the admin panel.

   WHY THIS EXISTS
     Serverless instances each got their own /tmp, so every panel save
     (telegram token, site info, projects order, skills, messages) was
     gone on the next cold start or redeploy. The panel looked like it
     "just doesn't save".

   HOW IT WORKS
     One generic key/value table (admin_settings) holds every JSON-shaped
     document, and three normal tables hold the collections that are
     queried relationally (projects, skills, contact_messages).

     Collisions are resolved per-key: `admin_settings.key` is the PRIMARY
     KEY and every write is an upsert, so two lambdas saving different
     things can never clobber each other's rows.

   CONFIG
     SUPABASE_DB_URL  (preferred)  or  DATABASE_URL
     Use the Supabase "Connection pooling" / Transaction pooler URI —
     the direct 5432 connection runs out of slots on serverless.
     Example:
       postgresql://postgres.xxxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
     If the URI carries `?pgbouncer=true`, the adapter is switched to
     `prepare: false` automatically.

   FALLBACK
     No connection string => every function is a no-op and callers keep
     using the file store. Nothing breaks; it just isn't durable.
   ════════════════════════════════════════════════════════════════════ */

let sql = null; // postgres.js client
let ready = null; // memoised init promise
let available = false;

export function dbUrl() {
  return (
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

export function dbConfigured() {
  return !!dbUrl();
}

/* True once the client is actually usable — callers use this to decide
   whether to show the "not stored permanently" warning. */
export function dbReady() {
  return available;
}

async function init() {
  if (!dbConfigured()) return null;
  if (sql) return sql;
  try {
    const { default: postgres } = await import("postgres");
    const url = dbUrl();
    sql = postgres(url, {
      max: Number(process.env.SUPABASE_DB_POOL_MAX || 3),
      idle_timeout: 20,
      connect_timeout: 10,
      /* pgbouncer / transaction pooler cannot do prepared statements */
      prepare: !/pgbouncer=true/i.test(url) && process.env.SUPABASE_DB_PREPARE !== "false",
      onnotice: () => {},
    });
    /* fail fast if the schema/db is unreachable */
    await sql`SELECT 1`;
    available = true;
    return sql;
  } catch (err) {
    console.error("[pg] connection failed:", err?.message || err);
    sql = null;
    available = false;
    return null;
  }
}

export async function pg() {
  if (!ready) ready = init();
  /* a previously failed init should be retried on a later cold path */
  const client = await ready;
  if (!client && dbConfigured()) return null;
  return client;
}

const KEY_MAP = {
  "telegram.json": "telegram",
  "site.json": "site",
  "admin-auth.json": "admin_auth",
  "visits.json": "visits",
  "clicks.json": "clicks",
  "online.json": "online",
  "skills.json": "skills",
  "projects.json": "projects",
  "mini-projects.json": "mini_projects",
  "messages.json": "messages",
  "blog.json": "blog",
};

export function normalizeKey(k) {
  if (!k) return "";
  const s = String(k);
  return KEY_MAP[s] || s.replace(/\.json$/i, "").replace(/-/g, "_");
}

/* ── generic JSON documents (admin_settings & KV) ───────────────────── */

async function kvRestGet(key) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url) return null;
  const ns = process.env.STORE_NAMESPACE ? `${process.env.STORE_NAMESPACE}:` : "";
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(ns + key)}`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    });
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

async function kvRestSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url) return false;
  const ns = process.env.STORE_NAMESPACE ? `${process.env.STORE_NAMESPACE}:` : "";
  try {
    const res = await fetch(`${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify(["SET", ns + key, value]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function kvRestDel(key) {
  const url = process.env.KV_REST_API_URL;
  const tok = process.env.KV_REST_API_TOKEN;
  if (!url) return false;
  const ns = process.env.STORE_NAMESPACE ? `${process.env.STORE_NAMESPACE}:` : "";
  try {
    const res = await fetch(`${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify(["DEL", ns + key]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function kvGet(key, fallback = null) {
  const c = await pg();
  if (c) {
    const k1 = key;
    const k2 = normalizeKey(key);
    try {
      const rows = await c`
        SELECT value FROM admin_settings
        WHERE key = ${k1} OR key = ${k2}
        ORDER BY (key = ${k2}) DESC, updated_at DESC
        LIMIT 1
      `;
      if (rows.length && rows[0].value != null) return rows[0].value;
    } catch (err) {
      console.error(`[pg] kvGet(${key}) failed:`, err?.message || err);
    }
  }
  const restVal = await kvRestGet(key);
  if (restVal !== null && restVal !== undefined) return restVal;
  const restNorm = await kvRestGet(normalizeKey(key));
  if (restNorm !== null && restNorm !== undefined) return restNorm;
  return fallback;
}

export async function kvSet(key, value) {
  let ok = false;
  const c = await pg();
  if (c) {
    const norm = normalizeKey(key);
    try {
      await c`
        INSERT INTO admin_settings (key, value, updated_at)
        VALUES (${norm}, ${c.json(value)}, NOW())
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = NOW()
      `;
      if (key !== norm) {
        await c`
          INSERT INTO admin_settings (key, value, updated_at)
          VALUES (${key}, ${c.json(value)}, NOW())
          ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = NOW()
        `;
      }
      ok = true;
    } catch (err) {
      console.error(`[pg] kvSet(${key}) failed:`, err?.message || err);
    }
  }
  const rOk = await kvRestSet(key, value);
  return ok || rOk;
}

export async function kvDel(key) {
  let ok = false;
  const c = await pg();
  if (c) {
    const norm = normalizeKey(key);
    try {
      await c`DELETE FROM admin_settings WHERE key = ${key} OR key = ${norm}`;
      ok = true;
    } catch (err) {
      console.error(`[pg] kvDel(${key}) failed:`, err?.message || err);
    }
  }
  const rOk = await kvRestDel(key);
  return ok || rOk;
}

/* ── analytics visits & clicks ───────────────────────────────────────── */

export async function pgInsertVisit({
  visitDate,
  visitHour,
  pagePath = "/",
  countryCode = "UNKNOWN",
  sessionId,
  ipHash = null,
  userAgent = null,
}) {
  const c = await pg();
  if (!c) return false;
  try {
    const d = visitDate || new Date().toISOString().slice(0, 10);
    const h = Number.isInteger(visitHour) ? visitHour : new Date().getHours();
    const p = String(pagePath || "/").slice(0, 255);
    const cc = String(countryCode || "UNKNOWN").slice(0, 10);
    const s = String(sessionId || "anon").slice(0, 128);
    await c`
      INSERT INTO site_visits (visit_date, visit_hour, page_path, country_code, session_id, ip_hash, user_agent)
      VALUES (${d}, ${h}, ${p}, ${cc}, ${s}, ${ipHash}, ${userAgent})
    `;
    return true;
  } catch (err) {
    console.error("[pg] insertVisit failed:", err?.message || err);
    return false;
  }
}

export async function pgInsertClick({
  targetId,
  targetType,
  targetLabel = null,
  pagePath = "/",
  sessionId = null,
}) {
  const c = await pg();
  if (!c) return false;
  try {
    const tid = String(targetId || "unknown").slice(0, 100);
    const ttype = String(targetType || "unknown").slice(0, 50);
    const tlabel = targetLabel ? String(targetLabel).slice(0, 150) : null;
    const p = String(pagePath || "/").slice(0, 255);
    const s = sessionId ? String(sessionId).slice(0, 128) : null;
    await c`
      INSERT INTO site_clicks (target_id, target_type, target_label, page_path, session_id)
      VALUES (${tid}, ${ttype}, ${tlabel}, ${p}, ${s})
    `;
    return true;
  } catch (err) {
    console.error("[pg] insertClick failed:", err?.message || err);
    return false;
  }
}

export async function pgGetStats() {
  const c = await pg();
  if (!c) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const [todayRow] = await c`
      SELECT COUNT(*)::int AS views, COUNT(DISTINCT session_id)::int AS uniques
      FROM site_visits WHERE visit_date = ${today}
    `;
    const [yestRow] = await c`
      SELECT COUNT(*)::int AS views, COUNT(DISTINCT session_id)::int AS uniques
      FROM site_visits WHERE visit_date = ${yesterday}
    `;
    const [totalRow] = await c`
      SELECT COUNT(*)::int AS views, COUNT(DISTINCT session_id)::int AS uniques
      FROM site_visits
    `;
    const topPaths = await c`
      SELECT page_path AS path, COUNT(*)::int AS total
      FROM site_visits
      GROUP BY page_path
      ORDER BY total DESC
      LIMIT 15
    `;
    const countries = await c`
      SELECT country_code AS country, COUNT(*)::int AS count
      FROM site_visits
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 15
    `;
    const [clicksRow] = await c`
      SELECT COUNT(*)::int AS total_clicks
      FROM site_clicks
    `;
    const topClicks = await c`
      SELECT target_id AS "targetId", target_type AS "targetType", target_label AS "targetLabel", COUNT(*)::int AS total
      FROM site_clicks
      GROUP BY target_id, target_type, target_label
      ORDER BY total DESC
      LIMIT 15
    `;

    return {
      today: todayRow?.views || 0,
      todayUnique: todayRow?.uniques || 0,
      yesterday: yestRow?.views || 0,
      yesterdayUnique: yestRow?.uniques || 0,
      totalAllTime: totalRow?.views || 0,
      totalUnique: totalRow?.uniques || 0,
      topPaths: topPaths.map((r) => ({ path: r.path, total: r.total })),
      countries: countries.map((r) => ({ country: r.country, count: r.count })),
      totalClicks: clicksRow?.total_clicks || 0,
      topClickItems: topClicks,
    };
  } catch (err) {
    console.error("[pg] getStats failed:", err?.message || err);
    return null;
  }
}

/* ── projects ───────────────────────────────────────────────────────── */

let cloneColumnEnsured = false;
async function ensureProjectsCloneColumn(client) {
  if (cloneColumnEnsured || !client) return;
  try {
    await client`ALTER TABLE projects ADD COLUMN IF NOT EXISTS clone BOOLEAN NOT NULL DEFAULT FALSE`;
    cloneColumnEnsured = true;
  } catch {
    /* ignore if user lacks permission or column already exists */
  }
}

const PROJECT_COLS = (r) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description || "",
  category: Array.isArray(r.category) ? r.category : [],
  image: r.image_url || "",
  url: r.url || "",
  githubUrl: r.github_url || null,
  projectType: r.project_type,
  clone: Boolean(r.clone),
});

export async function pgListProjects(type) {
  const c = await pg();
  if (!c) return null;
  try {
    await ensureProjectsCloneColumn(c);
    const rows = cloneColumnEnsured
      ? await c`
          SELECT id, slug, title, description, category, image_url, url,
                 github_url, project_type, clone
          FROM projects
          WHERE project_type = ${type}
          ORDER BY display_order ASC, id ASC
        `
      : await c`
          SELECT id, slug, title, description, category, image_url, url,
                 github_url, project_type
          FROM projects
          WHERE project_type = ${type}
          ORDER BY display_order ASC, id ASC
        `;
    return rows.map(PROJECT_COLS);
  } catch (err) {
    console.error("[pg] listProjects failed:", err?.message || err);
    return null;
  }
}

export async function pgReplaceProjects(type, list) {
  const c = await pg();
  if (!c) return false;
  await ensureProjectsCloneColumn(c);
  const rows = Array.isArray(list) ? list : [];
  try {
    await c.begin(async (tx) => {
      await tx`DELETE FROM projects WHERE project_type = ${type}`;
      let order = 0;
      for (const p of rows) {
        order += 1;
        if (cloneColumnEnsured) {
          await tx`
            INSERT INTO projects
              (slug, title, description, category, image_url, url,
               project_type, github_url, display_order, is_published, clone)
            VALUES (
              ${p.slug || null},
              ${String(p.title || "Untitled")},
              ${String(p.description || "")},
              ${tx.json(Array.isArray(p.category) ? p.category : [])},
              ${String(p.image || "")},
              ${String(p.url || "")},
              ${type},
              ${p.githubUrl || null},
              ${Number(p.displayOrder ?? order)},
              TRUE,
              ${Boolean(p.clone)}
            )
          `;
        } else {
          await tx`
            INSERT INTO projects
              (slug, title, description, category, image_url, url,
               project_type, github_url, display_order, is_published)
            VALUES (
              ${p.slug || null},
              ${String(p.title || "Untitled")},
              ${String(p.description || "")},
              ${tx.json(Array.isArray(p.category) ? p.category : [])},
              ${String(p.image || "")},
              ${String(p.url || "")},
              ${type},
              ${p.githubUrl || null},
              ${Number(p.displayOrder ?? order)},
              TRUE
            )
          `;
        }
      }
    });
    return true;
  } catch (err) {
    console.error("[pg] replaceProjects failed:", err?.message || err);
    return false;
  }
}

/* ── skills ─────────────────────────────────────────────────────────── */

export async function pgListSkills() {
  const c = await pg();
  if (!c) return null;
  try {
    await c`
      DELETE FROM skills
      WHERE LOWER(TRIM(name)) IN ('node', 'node.js', 'nodejs', 'express', 'express.js')
    `.catch(() => {});

    const rows = await c`
      SELECT id, name, icon_url, display_order
      FROM skills
      WHERE LOWER(TRIM(name)) NOT IN ('node', 'node.js', 'nodejs', 'express', 'express.js')
      ORDER BY display_order ASC, id ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      img: r.icon_url || "",
      order: r.display_order,
    }));
  } catch (err) {
    console.error("[pg] listSkills failed:", err?.message || err);
    return null;
  }
}

export async function pgReplaceSkills(list) {
  const c = await pg();
  if (!c) return false;
  const rawRows = Array.isArray(list) ? list : [];
  const rows = rawRows.filter(
    (s) => !/^(node(\.js)?|express(\.js)?)$/i.test(String(s.name || "").trim())
  );
  try {
    await c.begin(async (tx) => {
      await tx`DELETE FROM skills`;
      let order = 0;
      for (const s of rows) {
        order += 1;
        await tx`
          INSERT INTO skills (name, icon_url, display_order)
          VALUES (
            ${String(s.name || "Unknown")},
            ${String(s.img || "")},
            ${Number(s.displayOrder ?? order)}
          )
        `;
      }
    });
    return true;
  } catch (err) {
    console.error("[pg] replaceSkills failed:", err?.message || err);
    return false;
  }
}

/* ── contact messages ───────────────────────────────────────────────── */

export async function pgListMessages() {
  const c = await pg();
  if (!c) return null;
  try {
    const rows = await c`
      SELECT id, name, phone_number, message, status, created_at
      FROM contact_messages
      ORDER BY created_at DESC, id DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phoneNumber: r.phone_number || "",
      message: r.message,
      status: r.status,
      date: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } catch (err) {
    console.error("[pg] listMessages failed:", err?.message || err);
    return null;
  }
}

export async function pgInsertMessage({ name, phoneNumber, message }) {
  const c = await pg();
  if (!c) return null;
  try {
    const rows = await c`
      INSERT INTO contact_messages (name, phone_number, message, status)
      VALUES (${name}, ${phoneNumber || ""}, ${message}, 'unseen')
      RETURNING id, name, phone_number, message, status, created_at
    `;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      phoneNumber: r.phone_number || "",
      message: r.message,
      status: r.status,
      date: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    };
  } catch (err) {
    console.error("[pg] insertMessage failed:", err?.message || err);
    return null;
  }
}

export async function pgSetMessageStatus(id, status) {
  const c = await pg();
  if (!c) return false;
  try {
    const rows = await c`
      UPDATE contact_messages SET status = ${status}
      WHERE id = ${Number(id)}
      RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error("[pg] setMessageStatus failed:", err?.message || err);
    return false;
  }
}

export async function pgDeleteMessage(id) {
  const c = await pg();
  if (!c) return false;
  try {
    const rows = await c`
      DELETE FROM contact_messages WHERE id = ${Number(id)} RETURNING id
    `;
    return rows.length > 0;
  } catch (err) {
    console.error("[pg] deleteMessage failed:", err?.message || err);
    return false;
  }
}

/* ── blog posts ──────────────────────────────────────────────────────── */

let blogTableEnsured = false;
async function ensureBlogPostsTable(client) {
  if (blogTableEnsured || !client) return;
  try {
    await client`
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
      )
    `;
    blogTableEnsured = true;
  } catch {
    /* ignore if user lacks permission or table exists */
  }
}

const parseTags = (t) => {
  if (Array.isArray(t)) return t;
  if (typeof t === "string") {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fallback to comma-separated string */
    }
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const BLOG_POST_COLS = (r) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt || "",
  content: r.content || "",
  cover: r.cover_image || "",
  coverAlt: r.cover_alt || "",
  tags: parseTags(r.tags),
  date: r.date || (r.published_date ? String(r.published_date).slice(0, 10) : ""),
  published: Boolean(r.is_published),
});

export async function pgListBlogPosts() {
  const c = await pg();
  if (!c) return null;
  try {
    await ensureBlogPostsTable(c);
    const rows = await c`
      SELECT id, slug, title, excerpt, content, cover_image, cover_alt, tags,
             is_published, TO_CHAR(published_date, 'YYYY-MM-DD') AS date
      FROM blog_posts
      ORDER BY published_date DESC, id DESC
    `;
    return rows.map(BLOG_POST_COLS);
  } catch (err) {
    console.error("[pg] listBlogPosts failed:", err?.message || err);
    return null;
  }
}

export async function pgReplaceBlogPosts(list) {
  const c = await pg();
  if (!c) return false;
  await ensureBlogPostsTable(c);
  const rows = Array.isArray(list) ? list : [];
  try {
    await c.begin(async (tx) => {
      await tx`DELETE FROM blog_posts`;
      for (const p of rows) {
        const dateStr = p.date && /^\d{4}-\d{2}-\d{2}/.test(p.date) ? p.date : new Date().toISOString().slice(0, 10);
        const tagsArr = Array.isArray(p.tags) ? p.tags : [];
        await tx`
          INSERT INTO blog_posts
            (id, slug, title, excerpt, content, cover_image, cover_alt, tags, is_published, published_date)
          VALUES (
            ${Number(p.id)},
            ${String(p.slug || "")},
            ${String(p.title || "Untitled")},
            ${String(p.excerpt || "")},
            ${String(p.content || "")},
            ${String(p.cover || "")},
            ${String(p.coverAlt || "")},
            ${tx.json(tagsArr)},
            ${p.published !== false},
            ${dateStr}::DATE
          )
        `;
      }
      await tx`
        SELECT setval(pg_get_serial_sequence('blog_posts', 'id'), COALESCE((SELECT MAX(id) FROM blog_posts), 1), true)
      `.catch(() => {});
    });
    return true;
  } catch (err) {
    console.error("[pg] replaceBlogPosts failed:", err?.message || err);
    return false;
  }
}


