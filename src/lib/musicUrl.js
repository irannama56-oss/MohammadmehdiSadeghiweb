/* Resolve a song src to Supabase Storage or /assets/Music/<filename> with proper URI encoding.
 *
 * WHY THIS DEFAULT EXISTS
 *   The .mp3 files are git-ignored, so they are NOT part of the deployed
 *   bundle. Every /assets/Music/<file> request on Vercel therefore 404s and
 *   the player silently fails to load. The audio actually lives in the public
 *   Supabase Storage bucket `music`, so that bucket is the default source.
 *
 *   VITE_MUSIC_BASE can still override it (e.g. a CDN); if it is set to an
 *   empty string the resolver falls back to the local /assets/Music path,
 *   which is what the local dev server serves.
 */
const SUPABASE_MUSIC_STORAGE =
  "https://fahjtsbfzavburpvkhhp.supabase.co/storage/v1/object/public/music";

const RAW_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_MUSIC_BASE) ||
  SUPABASE_MUSIC_STORAGE;

export function musicUrl(src) {
  if (!src) return src;
  /* already absolute (external CDN / Supabase row) — leave untouched */
  if (/^(?:https?:)?\/\//i.test(src) || String(src).startsWith("data:")) return src;
  const filename = decodeURIComponent(String(src).split("/").pop() || "");
  if (RAW_BASE) {
    return `${RAW_BASE.replace(/\/+$/, "")}/${encodeURIComponent(filename)}`;
  }
  return `/assets/Music/${encodeURIComponent(filename)}`;
}
