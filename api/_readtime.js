/* Reading-time estimate shared by both blog feeds (Vercel handler and the
   local express server). Same formula as src/lib/blog.js readTime(), but
   computed from the stored content so list payloads — which intentionally
   omit `content` — can still show the real number instead of falling back
   to the excerpt and reporting "1 min read" for every card. */

export function readTimeFrom(content) {
  const text = String(content || "")
    .replace(/!\[.*?\]\s*\(.*?\)/g, "")
    .trim();
  if (!text) return "1 min read";
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}
