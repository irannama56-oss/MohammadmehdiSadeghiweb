import { MUSIC_DB } from "./_music.js";
import { executeMoodSearch } from "./_mood-engine.js";

/* GET /api/mood-search?q=...&recent=1,25,27&limit=5
   `recent` drives the soft cooldown so back-to-back searches do not repeat the
   same track; `limit` caps the result list (default 5, max 10). */

function parseOpts(req) {
  const recent = String(req.query.recent || "")
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 8);
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10);
  return { recent, limit };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const query = String(req.query.q || "").trim();
  if (!query) {
    return res.json({ error: "Query is required" });
  }
  if (query.length < 2 && !/\p{Extended_Pictographic}/u.test(query)) {
    return res.json({ error: "Query is too short (min 2 chars)" });
  }
  if (query.length > 500) {
    return res.json({ error: "Query is too long (max 500 chars)" });
  }

  const songs = (MUSIC_DB && MUSIC_DB.songs) || [];
  if (!songs.length) {
    return res.json({ found: false, results: [] });
  }

  const result = executeMoodSearch(songs, query, parseOpts(req));

  res.setHeader("Cache-Control", "no-store");
  return res.json(result);
}
