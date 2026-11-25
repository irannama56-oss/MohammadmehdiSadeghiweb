import dbJson from "../public/api/music-database.json" with { type: "json" };
import { executeMoodSearch } from "./_mood-engine.js";

/* ════════════════════════════════════════════════════════════════════
   Music catalogue + the legacy `/api/search` entry point.

   The old tag scorer that lived here disagreed with the mood engine on the
   same query (e.g. «عاشقانه» → Birds of a Feather vs Thinking Out Loud), so
   it has been removed. Both routes now run the single implementation in
   src/lib/moodEngine.js.
   ════════════════════════════════════════════════════════════════════ */

export const MUSIC_DB = dbJson;

export function runSearch(queryRaw, opts = {}) {
  const songs = (MUSIC_DB && MUSIC_DB.songs) || [];
  return executeMoodSearch(songs, queryRaw, opts);
}
