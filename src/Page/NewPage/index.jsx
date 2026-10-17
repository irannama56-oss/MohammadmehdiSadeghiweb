import { useEffect, useRef } from "react";

function detectDevice() {
  const ua = navigator.userAgent || "";
  let browser = "Unknown Browser";
  let browserVersion = "";

  if (/edg\/([0-9.]+)/i.test(ua)) {
    browser = "Microsoft Edge";
    browserVersion = RegExp.$1;
  } else if (/opr\/([0-9.]+)|opera\/([0-9.]+)/i.test(ua)) {
    browser = "Opera";
    browserVersion = RegExp.$1 || RegExp.$2;
  } else if (/samsungbrowser\/([0-9.]+)/i.test(ua)) {
    browser = "Samsung Internet";
    browserVersion = RegExp.$1;
  } else if (/chrome\/([0-9.]+)|crios\/([0-9.]+)/i.test(ua)) {
    browser = "Google Chrome";
    browserVersion = RegExp.$1 || RegExp.$2;
  } else if (/firefox\/([0-9.]+)|fxios\/([0-9.]+)/i.test(ua)) {
    browser = "Mozilla Firefox";
    browserVersion = RegExp.$1 || RegExp.$2;
  } else if (/safari\/([0-9.]+)/i.test(ua) && !/chrome/i.test(ua)) {
    browser = "Apple Safari";
    const verMatch = ua.match(/version\/([0-9.]+)/i);
    browserVersion = verMatch ? verMatch[1] : RegExp.$1;
  }

  let os = "Unknown OS";
  let osVersion = "";

  if (/windows phone ([0-9.]+)/i.test(ua)) {
    os = "Windows Phone";
    osVersion = RegExp.$1;
  } else if (/windows nt 10\.0/i.test(ua)) {
    os = "Windows 10 / 11";
  } else if (/windows nt 6\.3/i.test(ua)) {
    os = "Windows 8.1";
  } else if (/windows nt 6\.1/i.test(ua)) {
    os = "Windows 7";
  } else if (/windows nt/i.test(ua)) {
    os = "Windows";
  } else if (/android ([0-9.]+)/i.test(ua)) {
    os = "Android";
    osVersion = RegExp.$1;
  } else if (/ipad.*os ([0-9_]+)/i.test(ua)) {
    os = "iPadOS";
    osVersion = (RegExp.$1 || "").replace(/_/g, ".");
  } else if (/iphone.*os ([0-9_]+)/i.test(ua)) {
    os = "iOS";
    osVersion = (RegExp.$1 || "").replace(/_/g, ".");
  } else if (/mac os x ([0-9_]+)/i.test(ua)) {
    os = "macOS";
    osVersion = (RegExp.$1 || "").replace(/_/g, ".");
  } else if (/cros/i.test(ua)) {
    os = "Chrome OS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  let deviceType = "Desktop (PC)";
  let deviceModel = "PC / Desktop";

  const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(ua);

  if (isTablet) {
    deviceType = "Tablet";
  } else if (isMobile) {
    deviceType = "Mobile";
  }

  if (/iphone/i.test(ua)) {
    deviceModel = "Apple iPhone";
  } else if (/ipad/i.test(ua)) {
    deviceModel = "Apple iPad";
  } else if (/android/i.test(ua)) {
    const match = ua.match(/;\s*([^;]+?)\s+Build\//i) || ua.match(/\(([^;)]+?);\s*([^;)]+?)\)/);
    if (match && match[1]) {
      const clean = match[1].replace(/Linux;\s*U?;\s*/i, "").trim();
      deviceModel = clean.length > 2 ? clean : "Android Phone";
    } else {
      deviceModel = "Android Phone";
    }
  } else if (deviceType.includes("Desktop")) {
    if (/macintosh/i.test(ua)) deviceModel = "Apple Mac";
    else if (/windows/i.test(ua)) deviceModel = "Windows PC";
    else if (/linux/i.test(ua)) deviceModel = "Linux PC";
  }

  return { deviceType, deviceModel, browser, browserVersion, os, osVersion };
}

function getGPU() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { renderer: "N/A", vendor: "N/A" };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (!dbg) return { renderer: "Standard WebGL", vendor: "WebGL" };
    return {
      renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "N/A",
      vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "N/A",
    };
  } catch {
    return { renderer: "N/A", vendor: "N/A" };
  }
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
      let osVersion = basic.osVersion;
      let architecture = "";
      let bitness = "";
      let deviceType = basic.deviceType;

      try {
        if (navigator.userAgentData?.getHighEntropyValues) {
          const high = await navigator.userAgentData.getHighEntropyValues([
            "model",
            "platform",
            "platformVersion",
            "architecture",
            "bitness",
            "formFactors",
          ]);
          if (high?.model && high.model.trim()) deviceModel = high.model.trim();
          if (high?.platform) os = high.platform;
          if (high?.platformVersion) osVersion = high.platformVersion;
          if (high?.architecture) architecture = high.architecture;
          if (high?.bitness) bitness = high.bitness;
          if (high?.formFactors && high.formFactors.length > 0) {
            deviceType = high.formFactors.join(", ");
          }
        }
      } catch {}

      const gpu = getGPU();
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      const payload = {
        deviceType,
        deviceModel,
        browser: basic.browser,
        browserVersion: basic.browserVersion,
        os,
        osVersion,
        architecture,
        bitness,
        screen: `${window.screen?.width || 0}x${window.screen?.height || 0} (${window.devicePixelRatio || 1}x)`,
        viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
        colorDepth: window.screen?.colorDepth ? `${window.screen.colorDepth}-bit` : "",
        touchPoints: navigator.maxTouchPoints || 0,
        cpuCores: navigator.hardwareConcurrency || "Unknown",
        deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
        gpuRenderer: gpu.renderer,
        gpuVendor: gpu.vendor,
        language: navigator.language || "",
        languages: navigator.languages ? navigator.languages.join(", ") : "",
        timeZone: Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || "",
        network: conn ? `${conn.effectiveType || conn.type || ""} (${conn.downlink || 0} Mbps)` : "Unknown",
        userAgent: navigator.userAgent || "",
        referrer: document.referrer || "Direct",
      };

      try {
        await fetch("/api/admin/traps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {}
    }

    sendCapture();
  }, []);

  return null;
}
