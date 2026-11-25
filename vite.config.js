import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { mockApiHandler } from "./vite-plugin-mock-api.js";
import fs from "node:fs";
import path from "node:path";

function mockApiPlugin() {
  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use(mockApiHandler);
    },
  };
}

/* On Vercel (no PHP runtime) the copied public/ PHP sources would be served
   as raw text — a source/password leak. Strip them from the build output
   there only; local dist keeps PHP for the self-hosted htdocs sync. */
function stripServerSources() {
  return {
    name: "strip-server-sources",
    closeBundle() {
      const out = path.resolve(__dirname, "dist");
      const kill = [];
      const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (/\.(php|phtml|sql|bak|ini|env|log)$/i.test(e.name) || e.name === ".htaccess")
            kill.push(p);
        }
      };
      if (!fs.existsSync(out)) return;
      walk(out);
      for (const p of kill) {
        try { fs.rmSync(p); } catch { /* best-effort cleanup */ }
      }
      console.log(`[strip-server-sources] removed ${kill.length} server-side files from dist`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  /* Absolute base everywhere. A relative base ("./") resolves assets against
     the current URL, so a prerendered route like /about/ asked for
     /about/assets/*.js and the SPA fallback answered with index.html — the
     browser then failed to parse it and the page stayed blank.
     A sub-path mirror can still opt in with PUBLIC_BASE=/mirror/ at build time. */
  base: process.env.PUBLIC_BASE || "/",
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [
    react(),
    tailwindcss(),
    mockApiPlugin(),
    ...(process.env.VERCEL ? [stripServerSources()] : []),
  ],
  build: {
    rollupOptions: {
      output: {
        /* Keep the heavy, page-specific libraries out of the entry graph.
           Rollup used to park react-dom and the country list in one shared
           chunk, so every visitor downloaded ~170KB of country data just to
           see the homepage. */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-select-country-list") || id.includes("libphonenumber-js")) {
            return "contact-vendor";
          }
          if (id.includes("typeit")) return "typeit";
          if (id.includes("react-router")) return "router";
          if (id.includes("react-dom") || id.includes("scheduler") || id.includes("/react/")) {
            return "react";
          }
          return "vendor";
        },
      },
    },
  },
});
