import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <!-- Deep Cosmic Dark Background -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172B"/>
      <stop offset="60%" stop-color="#0A0F1E"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>

    <!-- Border Glow Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#615FFF"/>
      <stop offset="45%" stop-color="#43D9AD"/>
      <stop offset="100%" stop-color="#FEA55F"/>
    </linearGradient>

    <!-- Electric Cyan/Teal Bracket -->
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5EEAD4"/>
      <stop offset="100%" stop-color="#14B8A6"/>
    </linearGradient>

    <!-- Warm Amber/Orange Bracket -->
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D"/>
      <stop offset="100%" stop-color="#FEA55F"/>
    </linearGradient>

    <!-- Crisp White/Silver M -->
    <linearGradient id="mGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </linearGradient>

    <!-- Subtle Center Glow -->
    <filter id="mGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#615FFF" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Base Rounded Squircle with Gradient Border -->
  <rect x="20" y="20" width="472" height="472" rx="116" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="16"/>

  <!-- Inner Ambient Light -->
  <circle cx="256" cy="256" r="140" fill="#615FFF" opacity="0.12" filter="blur(36px)"/>

  <!-- Left Code Bracket < -->
  <path d="M 148 180 L 86 256 L 148 332" fill="none" stroke="url(#tealGrad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Center Monogram M -->
  <path d="M 188 332 L 188 180 L 256 268 L 324 180 L 324 332" fill="none" stroke="url(#mGrad)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round" filter="url(#mGlow)"/>

  <!-- Right Code Bracket > -->
  <path d="M 364 180 L 426 256 L 364 332" fill="none" stroke="url(#orangeGrad)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Write public/favicon.svg
const publicSvg = path.resolve("public", "favicon.svg");
fs.writeFileSync(publicSvg, svgContent, "utf8");
console.log("Wrote:", publicSvg);

// Create an ICO buffer from multiple PNG buffers (16, 32, 48)
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  let offset = headerSize + count * entrySize;
  const entries = [];

  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // Image data size
    entry.writeUInt32LE(offset, 12); // Offset of image data
    offset += buffer.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

// Render PNGs using headless Chrome CDP
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PROF = path.join(os.tmpdir(), "chrome-fav-gen-" + Date.now());
const cdpPort = 9760;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${PROF}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1024,1024",
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] }
);

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    const target = list.find((t) => t.type === "page");
    if (target?.webSocketDebuggerUrl) {
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((res) => (ws.onopen = res));

      let id = 0;
      const send = (method, params = {}) =>
        new Promise((resolve) => {
          const curId = ++id;
          const handler = (e) => {
            const data = JSON.parse(e.data);
            if (data.id === curId) {
              ws.removeEventListener("message", handler);
              resolve(data.result);
            }
          };
          ws.addEventListener("message", handler);
          ws.send(JSON.stringify({ id: curId, method, params }));
        });

      await send("Page.enable");

      // HTML container to render SVG cleanly with zero margin and transparent background
      const b64Svg = Buffer.from(svgContent).toString("base64");
      const dataUri = `data:text/html;charset=utf-8,<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;"><img id="icon" src="data:image/svg+xml;base64,${b64Svg}" style="display:block;width:100%;height:100%;" /></body></html>`;
      await send("Page.navigate", { url: dataUri });
      await new Promise((r) => setTimeout(r, 500));

      const sizes = [
        { size: 16, file: "favicon-16.png" },
        { size: 32, file: "favicon-32.png" },
        { size: 48, file: "favicon-48.png" },
        { size: 180, file: "apple-touch-icon.png" },
        { size: 192, file: "favicon.png" },
        { size: 512, file: "favicon-512.png" },
      ];

      const capturedIcoPngs = [];

      for (const { size, file } of sizes) {
        await send("Emulation.setDeviceMetricsOverride", {
          width: size,
          height: size,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await new Promise((r) => setTimeout(r, 100));

        const shot = await send("Page.captureScreenshot", {
          format: "png",
          clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
        });

        const buf = Buffer.from(shot.data, "base64");
        const outPub = path.resolve("public", file);
        fs.writeFileSync(outPub, buf);
        console.log(`Rendered ${size}x${size} -> ${outPub} (${buf.length} bytes)`);

        if (size === 16 || size === 32 || size === 48) {
          capturedIcoPngs.push({ width: size, height: size, buffer: buf });
        }
      }

      // Generate multi-res favicon.ico
      const icoBuf = createIco(capturedIcoPngs);
      const outIco = path.resolve("public", "favicon.ico");
      fs.writeFileSync(outIco, icoBuf);
      console.log(`Generated favicon.ico -> ${outIco} (${icoBuf.length} bytes)`);

      // Copy to dist/ if dist exists
      const distDir = path.resolve("dist");
      if (fs.existsSync(distDir)) {
        fs.copyFileSync(publicSvg, path.join(distDir, "favicon.svg"));
        fs.copyFileSync(outIco, path.join(distDir, "favicon.ico"));
        for (const { file } of sizes) {
          fs.copyFileSync(path.resolve("public", file), path.join(distDir, file));
        }
        console.log("Synchronized all favicon files to dist/");
      }

      chrome.kill();
      process.exit(0);
    }
  } catch (err) {
    // retry
  }
}

chrome.kill();
