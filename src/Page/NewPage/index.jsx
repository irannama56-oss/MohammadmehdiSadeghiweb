import { useEffect, useRef } from "react";

function detectDevice() {
  const ua = navigator.userAgent || "";
  let deviceModel = "Desktop / PC";
  let os = "Unknown";
  let browser = "Unknown";

  // OS
  if (/windows phone/i.test(ua)) os = "Windows Phone";
  else if (/win64|wow64|win32|windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/ipad/i.test(ua)) os = "iPadOS";
  else if (/iphone|ipod/i.test(ua)) os = "iOS";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // Device model / phone name
  if (/iphone/i.test(ua)) {
    deviceModel = "iPhone";
  } else if (/ipad/i.test(ua)) {
    deviceModel = "iPad";
  } else if (/android/i.test(ua)) {
    const match = ua.match(/;\s*([^;]+?)\s+Build\//i) || ua.match(/\(([^;)]+?);\s*([^;)]+?)\)/);
    if (match && match[1]) {
      deviceModel = match[1].replace(/Linux;\s*U?;\s*/i, "").trim();
    } else {
      deviceModel = "Android Phone";
    }
  }

  // Modern Client Hints for exact browser
  if (navigator.userAgentData?.brands) {
    const brandObj = navigator.userAgentData.brands.find((b) => !b.brand.includes("Brand") && !b.brand.includes("Not"));
    if (brandObj) browser = brandObj.brand;
  }

  if (browser === "Unknown") {
    if (/edg\//i.test(ua)) browser = "Edge";
    else if (/opr\/|opera/i.test(ua)) browser = "Opera";
    else if (/samsungbrowser/i.test(ua)) browser = "Samsung Internet";
    else if (/chrome|crios/i.test(ua)) browser = "Chrome";
    else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  }

  return { deviceModel, os, browser };
}

export default function NewPage() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    async function sendCapture() {
      const basic = detectDevice();
      let deviceModel = basic.deviceModel;
      let os = basic.os;

      // Try High Entropy Client Hints (gives exact phone model e.g. "SM-S918B" or "Pixel 7")
      try {
        if (navigator.userAgentData?.getHighEntropyValues) {
          const high = await navigator.userAgentData.getHighEntropyValues(["model", "platform", "platformVersion"]);
          if (high?.model) deviceModel = high.model;
          if (high?.platform) os = high.platform;
        }
      } catch {
        // fallback to UA
      }

      const payload = {
        deviceModel,
        browser: basic.browser,
        os,
        userAgent: navigator.userAgent || "",
        screen: `${window.screen?.width || 0}x${window.screen?.height || 0} (${window.devicePixelRatio || 1}x)`,
        language: navigator.language || "",
        timeZone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || "",
        referrer: document.referrer || "",
      };

      try {
        await fetch("/api/admin/traps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // silent fail
      }
    }

    sendCapture();
  }, []);

  // Completely blank page for the visitor
  return null;
}
