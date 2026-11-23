/* ════════════════════════════════════════════════════════════════════
   Per-route <head> pre-render.

   WHY THIS EXISTS
     The site is a Vite SPA: every route is served the same dist/index.html,
     whose static canonical points at "/". Crawlers that don't execute JS
     therefore see /about, /project, /blog… as duplicates of the homepage,
     even though usePageSEO fixes the tags in the browser afterwards.

   WHAT IT DOES
     After `vite build`, writes dist/<route>/index.html for each public
     route with the correct title, description, canonical and social tags
     already in the HTML. Static hosting serves those files directly, so
     the meta is correct before any JavaScript runs.

   NOTE
     Keep the copy below in sync with each page's usePageSEO() call.
   ════════════════════════════════════════════════════════════════════ */

import fs from "node:fs";
import path from "node:path";

const ORIGIN = "https://mohammad-mehdi-sadeghi.vercel.app";
const DIST = path.resolve("dist");
const TEMPLATE = path.join(DIST, "index.html");

const ROUTES = [
  {
    path: "/about",
    title: "About Mohammad Mehdi Sadeghi | محمد مهدی صادقی — Frontend Developer",
    description:
      "About Mohammad Mehdi Sadeghi (محمد مهدی صادقی) — frontend developer and corporate website designer in Mashhad, working with React, TypeScript, Tailwind CSS and WordPress.",
  },
  {
    path: "/project",
    title: "Projects & Portfolio | Mohammad Mehdi Sadeghi — محمد مهدی صادقی",
    description:
      "Frontend web projects, corporate websites and interactive UI demos by Mohammad Mehdi Sadeghi (محمد مهدی صادقی) — built with React, Next.js, Tailwind CSS and JavaScript.",
  },
  {
    path: "/blog",
    title: "Blog & Frontend Insights | Mohammad Mehdi Sadeghi",
    description:
      "Read frontend development insights, React architectural patterns, debugging stories, and UI engineering case studies by Mohammad Mehdi Sadeghi.",
  },
  {
    path: "/contact",
    title: "Contact | Mohammad Mehdi Sadeghi — محمد مهدی صادقی",
    description:
      "Contact Mohammad Mehdi Sadeghi (محمد مهدی صادقی) for frontend development and corporate website design in Mashhad — by email, Telegram or LinkedIn.",
  },
];

/* blog posts are data-driven — read them from the bundled JSON */
function blogRoutes() {
  try {
    const posts = JSON.parse(fs.readFileSync("public/api/blog.json", "utf8"));
    const list = Array.isArray(posts) ? posts : posts.posts || [];
    return list
      .filter((p) => p && p.slug)
      .map((p) => ({
        path: `/blog/${p.slug}`,
        title: `${p.title} | Mohammad Mehdi Sadeghi`,
        description: String(p.excerpt || p.description || p.title || "").slice(0, 300),
      }));
  } catch (err) {
    console.warn("[prerender] could not read blog.json:", err.message);
    return [];
  }
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function replaceMeta(html, attr, key, value) {
  const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*/?>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function render(template, route) {
  const url = ORIGIN + route.path;
  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(route.title)}</title>`);
  html = replaceMeta(html, "name", "title", route.title);
  html = replaceMeta(html, "name", "description", route.description);
  html = replaceMeta(html, "property", "og:title", route.title);
  html = replaceMeta(html, "property", "og:description", route.description);
  html = replaceMeta(html, "property", "og:url", url);
  html = replaceMeta(html, "name", "twitter:title", route.title);
  html = replaceMeta(html, "name", "twitter:description", route.description);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`);

  return html;
}

if (!fs.existsSync(TEMPLATE)) {
  console.warn("[prerender] dist/index.html not found — skipping");
  process.exit(0);
}

const template = fs.readFileSync(TEMPLATE, "utf8");
const routes = [...ROUTES, ...blogRoutes()];
let written = 0;

for (const route of routes) {
  const outDir = path.join(DIST, route.path.replace(/^\//, ""));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), render(template, route), "utf8");
  written++;
}

console.log(`[prerender] wrote ${written} route shells with per-page meta`);
