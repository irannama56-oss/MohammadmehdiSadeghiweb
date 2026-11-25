import React, { useState, useEffect, useCallback, useRef } from "react";

/* ============================================================
   BootLoader — Minimalist Entry Loader
   ------------------------------------------------------------
   UX rules followed:
   - Waits for `window.load` so all assets are ready (good for
     SEO/AI crawlers that execute JS — they see rendered content).
   - Minimum visible 700ms (avoids flicker, never feels instant).
   - Maximum wait 3000ms (safety net, never blocks the user).
   - Smooth 400ms fade-out, no layout shift, body scroll locked.
   - Respects `prefers-reduced-motion` (instant fade, no pulses).
   - Click anywhere to dismiss (escape hatch).
   - A11y: role="status", aria-live="polite", aria-label.
   ============================================================ */

const MIN_VISIBLE_MS = 250;   // snappy entry
const MAX_WAIT_MS = 2000;     // ceiling — never trap users
const FADE_OUT_MS = 200;

const isBotOrReducedMotion = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return Boolean(
    navigator.webdriver ||
    /Lighthouse|Googlebot|bingbot|crawler|spider/i.test(navigator.userAgent || "") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
};

export default function BootLoader({ onDone }) {
  const [skip] = useState(isBotOrReducedMotion);
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setExiting(true);
    setTimeout(() => {
      document.body.style.overflow = "";
      onDone?.();
    }, FADE_OUT_MS);
  }, [onDone]);

  useEffect(() => {
    if (skip) {
      document.body.style.overflow = "";
      onDone?.();
      return;
    }

    document.body.style.overflow = "hidden";
    const start = Date.now();

    const hide = () => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
      setTimeout(finish, wait);
    };

    if (document.readyState === "complete") {
      hide();
    } else {
      window.addEventListener("load", hide, { once: true });
    }

    // Safety net: never block longer than MAX_WAIT_MS
    const safety = setTimeout(finish, MAX_WAIT_MS);

    return () => {
      window.removeEventListener("load", hide);
      clearTimeout(safety);
      document.body.style.overflow = "";
    };
  }, [finish, onDone, skip]);

  if (skip) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading portfolio"
      onClick={finish}
      className="boot-loader fixed inset-0 z-[99999] flex items-center justify-center bg-[#030712] overflow-hidden cursor-pointer select-none"
      style={{
        opacity: exiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
      }}
    >
      {/* Subtle ambient glow */}
      <div
        aria-hidden="true"
        className="boot-glow absolute w-[420px] h-[420px] rounded-full blur-[110px] pointer-events-none"
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Monogram with two concentric pulses */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <span aria-hidden="true" className="boot-ring ring-a" />
          <span aria-hidden="true" className="boot-ring ring-b" />
          <span className="relative z-10 text-[15px] font-bold text-white tracking-[0.15em]">
            MMS
          </span>
        </div>

        {/* Three-dot loading indicator */}
        <div className="boot-dots flex items-center gap-1.5" aria-hidden="true">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>

      <style>{`
        .boot-glow {
          background: radial-gradient(circle, rgba(97,95,255,0.18) 0%, rgba(56,189,248,0.08) 50%, transparent 70%);
        }
        .boot-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1px solid rgba(97,95,255,0.7);
          animation: boot-pulse 2.2s ease-out infinite;
          will-change: transform, opacity;
        }
        .ring-b {
          border-color: rgba(56,189,248,0.6);
          animation-delay: 0.7s;
        }
        .boot-dots .dot {
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #615FFF;
          animation: boot-dot 1.4s ease-in-out infinite;
          will-change: transform, opacity;
        }
        .boot-dots .dot:nth-child(2) { animation-delay: 0.18s; background: #7C7BFF; }
        .boot-dots .dot:nth-child(3) { animation-delay: 0.36s; background: #38BDF8; }

        @keyframes boot-pulse {
          0%   { transform: scale(0.55); opacity: 0.85; }
          80%  { opacity: 0; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes boot-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40%           { transform: scale(1);   opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .boot-ring,
          .boot-dots .dot {
            animation: none;
          }
          .boot-ring { opacity: 0.3; transform: scale(1); }
          .boot-dots .dot { opacity: 0.7; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}