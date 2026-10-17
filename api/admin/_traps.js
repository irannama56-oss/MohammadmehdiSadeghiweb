import {
  requireAuth,
  readStore,
  writeStore,
  withLock,
  rateCheck,
  clientIP,
} from "../_lib.js";
import {
  dbConfigured,
  pgInsertTrap,
  pgListTraps,
  pgDeleteTrap,
  pgClearTraps,
} from "../_pg.js";
import { resolveCountry } from "../_country.js";

function parseUserAgent(ua = "") {
  let browser = "Unknown";
  let os = "Unknown";
  let deviceModel = "Desktop / PC";

  const u = String(ua);

  // OS
  if (/windows phone/i.test(u)) os = "Windows Phone";
  else if (/win64|wow64|win32|windows/i.test(u)) os = "Windows";
  else if (/android/i.test(u)) os = "Android";
  else if (/ipad/i.test(u)) os = "iPadOS";
  else if (/iphone|ipod/i.test(u)) os = "iOS";
  else if (/macintosh|mac os x/i.test(u)) os = "macOS";
  else if (/linux/i.test(u)) os = "Linux";

  // Device model
  if (/iphone/i.test(u)) {
    deviceModel = "iPhone";
  } else if (/ipad/i.test(u)) {
    deviceModel = "iPad";
  } else if (/android/i.test(u)) {
    const match = u.match(/;\s*([^;]+?)\s+Build\//i) || u.match(/\(([^;)]+?);\s*([^;)]+?)\)/);
    if (match && match[1]) {
      deviceModel = match[1].replace(/Linux;\s*U?;\s*/i, "").trim();
    } else {
      deviceModel = "Android Device";
    }
  } else if (/mobile/i.test(u)) {
    deviceModel = "Mobile Device";
  }

  // Browser
  if (/edg\//i.test(u)) browser = "Edge";
  else if (/opr\/|opera/i.test(u)) browser = "Opera";
  else if (/samsungbrowser/i.test(u)) browser = "Samsung Internet";
  else if (/chrome|crios/i.test(u)) browser = "Chrome";
  else if (/firefox|fxios/i.test(u)) browser = "Firefox";
  else if (/safari/i.test(u) && !/chrome/i.test(u)) browser = "Safari";

  return { browser, os, deviceModel };
}

export default async function handler(req, res) {
  // Public POST to record a trap trigger
  if (req.method === "POST") {
    const allowed = await rateCheck(req, "trap", true);
    if (!allowed) return res.json({ ok: true, dropped: true });

    const body = req.body || {};
    const ip = clientIP(req);
    const country = resolveCountry(req, body);
    const ua = req.headers["user-agent"] || body.userAgent || "";

    const parsed = parseUserAgent(ua);
    const deviceType = body.deviceType || (parsed.deviceModel.includes("PC") ? "Desktop" : "Mobile");
    const deviceModel = body.deviceModel || parsed.deviceModel;
    const browser = body.browser || parsed.browser;
    const os = body.os || parsed.os;

    const extra = {
      browserVersion: body.browserVersion || null,
      osVersion: body.osVersion || null,
      architecture: body.architecture || null,
      bitness: body.bitness || null,
      screen: body.screen || null,
      viewport: body.viewport || null,
      colorDepth: body.colorDepth || null,
      touchPoints: body.touchPoints ?? null,
      cpuCores: body.cpuCores || null,
      deviceMemory: body.deviceMemory || null,
      gpuRenderer: body.gpuRenderer || null,
      gpuVendor: body.gpuVendor || null,
      network: body.network || null,
      language: req.headers["accept-language"] || body.language || null,
      languages: body.languages || null,
      timeZone: body.timeZone || null,
      referrer: req.headers["referer"] || body.referrer || null,
    };

    // Deduplication check: If this IP already triggered within the last 15 minutes, update or ignore
    if (dbConfigured()) {
      const recent = await pgListTraps(20);
      const isDuplicate = (recent || []).some(
        (r) => r.ip === ip && (Date.now() - new Date(r.createdAt).getTime()) < 15 * 60 * 1000
      );
      if (isDuplicate) {
        return res.json({ ok: true, ignored: "duplicate_recent" });
      }

      const saved = await pgInsertTrap({
        ip,
        country,
        deviceType,
        deviceModel,
        browser,
        os,
        userAgent: ua,
        extra,
      });
      if (saved) return res.json({ ok: true, logged: true });
    }

    // JSON file fallback
    let duplicateFile = false;
    await withLock("traps", async () => {
      const store = await readStore("traps.json", { traps: [], nextId: 1 });
      if (!store.nextId) store.nextId = 1;
      if (!Array.isArray(store.traps)) store.traps = [];

      const exists = store.traps.find(
        (r) => r.ip === ip && (Date.now() - new Date(r.createdAt).getTime()) < 15 * 60 * 1000
      );
      if (exists) {
        duplicateFile = true;
        return;
      }

      store.traps.unshift({
        id: store.nextId++,
        ip,
        country,
        deviceType,
        deviceModel,
        browser,
        os,
        userAgent: ua,
        extra,
        createdAt: new Date().toISOString(),
      });
      if (store.traps.length > 500) {
        store.traps = store.traps.slice(0, 500);
      }
      await writeStore("traps.json", store);
    });

    if (duplicateFile) return res.json({ ok: true, ignored: "duplicate_recent" });
    return res.json({ ok: true, logged: true });
  }

  // Admin authentication required for viewing / managing
  if (requireAuth(req, res) === null) return;

  if (req.method === "GET") {
    if (dbConfigured()) {
      const rows = await pgListTraps(req.query.limit || 150);
      if (rows) return res.json({ traps: rows });
    }
    const store = await readStore("traps.json", { traps: [] });
    return res.json({ traps: store.traps || [] });
  }

  if (req.method === "DELETE") {
    const { id, clearAll } = req.body || req.query || {};

    if (clearAll) {
      if (dbConfigured()) {
        await pgClearTraps();
      }
      await writeStore("traps.json", { traps: [], nextId: 1 });
      return res.json({ ok: true, cleared: true });
    }

    if (id == null) {
      return res.status(400).json({ error: "id or clearAll required" });
    }

    if (dbConfigured()) {
      await pgDeleteTrap(id);
    }

    const store = await readStore("traps.json", { traps: [] });
    store.traps = (store.traps || []).filter((x) => String(x.id) !== String(id));
    await writeStore("traps.json", store);

    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "method not allowed" });
}
