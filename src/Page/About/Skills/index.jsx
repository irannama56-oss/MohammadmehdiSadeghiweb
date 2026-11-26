import React, { useEffect, useState } from "react";
import useClickTrack from "../../../Hooks/useClickTrack";
import Loading from "../../../Components/Loading";

const gray = "#90A1B9";
const purple = "#615FFF";

const SKILL_ICONS = {
  html: "/assets/Images/html_1051277.webp",
  html5: "/assets/Images/html_1051277.webp",
  css: "/assets/Images/css_919826.webp",
  css3: "/assets/Images/css_919826.webp",
  javascript: "/assets/Images/js_5968292.webp",
  js: "/assets/Images/js_5968292.webp",
  react: "/assets/Images/react.webp",
  "next.js": "/assets/Images/nextjs.webp",
  nextjs: "/assets/Images/nextjs.webp",
  next: "/assets/Images/nextjs.webp",
  "tailwind css": "/assets/Images/tailwind.webp",
  tailwind: "/assets/Images/tailwind.webp",
  typescript: "/assets/Images/typescript.webp",
  ts: "/assets/Images/typescript.webp",
  wordpress: "/assets/Images/wordpress_174881.webp",
  git: "/assets/Images/MdiGithub.webp",
  "git & github": "/assets/Images/MdiGithub.webp",
};

export function resolveSkillIcon(skill) {
  const name = String(skill?.name || "").toLowerCase().trim();
  if (SKILL_ICONS[name]) return SKILL_ICONS[name];
  let img = String(skill?.img || "").trim();
  if (img.endsWith(".png")) img = img.replace(/\.png$/i, ".webp");
  if (img.includes("/assets/icon/skills/") || !img || img.includes(".svg")) {
    for (const [k, v] of Object.entries(SKILL_ICONS)) {
      if (name.includes(k) || img.toLowerCase().includes(k)) return v;
    }
  }
  return img || "/assets/Images/react.webp";
}

// used only if the API request fails, so the section never renders empty
const fallbackSkills = [
  { name: "HTML", img: "/assets/Images/html_1051277.webp" },
  { name: "CSS", img: "/assets/Images/css_919826.webp" },
  { name: "JavaScript", img: "/assets/Images/js_5968292.webp" },
  { name: "React", img: "/assets/Images/react.webp" },
  { name: "Next.js", img: "/assets/Images/nextjs.webp" },
  { name: "Tailwind CSS", img: "/assets/Images/tailwind.webp" },
  { name: "TypeScript", img: "/assets/Images/typescript.webp" },
  { name: "WordPress", img: "/assets/Images/wordpress_174881.webp" },
];

let cachedSkills = null;
let pendingPromise = null;

function fetchSkillsOnce() {
  if (cachedSkills) return Promise.resolve(cachedSkills);
  if (!pendingPromise) {
    pendingPromise = fetch(`/api/skills?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.skills) && data.skills.length > 0) {
          const seen = new Set();
          const clean = [];
          for (const s of data.skills) {
            let normName = s.name?.trim() || "";
            if (normName.toLowerCase() === "html5") normName = "HTML";
            if (normName.toLowerCase() === "css3") normName = "CSS";
            const key = normName.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            clean.push({
              ...s,
              name: normName,
              img: resolveSkillIcon({ ...s, name: normName }),
            });
          }
          cachedSkills = clean.length > 0 ? clean : fallbackSkills;
        }
        return cachedSkills;
      })
      .catch(() => null)
      .finally(() => {
        pendingPromise = null;
      });
  }
  return pendingPromise;
}

export default function Skills() {
  const [hovered, setHovered] = useState(null);
  const [skills, setSkills] = useState(() => cachedSkills || fallbackSkills);
  const [loading, setLoading] = useState(() => !cachedSkills);
  const { withTracking } = useClickTrack();

  useEffect(() => {
    if (cachedSkills) return;
    let alive = true;
    fetchSkillsOnce().then((res) => {
      if (!alive) return;
      if (res) setSkills(res);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="w-full min-w-0 py-6 sm:py-8 px-3 sm:px-6 md:px-8 lg:px-12 md:h-[calc(100vh-116px)] md:overflow-y-auto">
      {loading ? (
        <Loading variant="skills" count={6} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
        {skills.map((skill, i) => (
          <div
            key={skill.name}
            onMouseEnter={() => setHovered(skill.name)}
            onMouseLeave={() => setHovered(null)}
            className="relative flex items-center gap-5 p-5 rounded-lg cursor-pointer duration-300"
            style={{
              background: hovered === skill.name ? "#0F172B" : "#081224",
              border: `1px solid ${hovered === skill.name ? purple : "#90a1b933"}`,
              transform:
                hovered === skill.name ? "translateY(-3px)" : "translateY(0)",
            }}
            onClick={withTracking({
              targetType: "skill",
              targetId: skill.name?.toLowerCase().replace(/\s+/g, "-") || "unknown",
              targetLabel: skill.name || "Unknown Skill",
            })}
          >
            <span
              className="absolute top-3 right-3 text-[11px] select-none"
              style={{ color: "#3d4f6b", fontFamily: "monospace" }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>

            <img loading="lazy" decoding="async"
              className="w-14 h-14 object-contain flex-shrink-0"
              src={resolveSkillIcon(skill)}
              alt={skill.name}
              onError={(e) => {
                const fb = SKILL_ICONS[skill.name?.toLowerCase()?.trim()] || "/assets/Images/react.webp";
                if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
              }}
            />

            <div className="flex flex-col gap-1">
              <h3
                className="text-[15px] font-semibold duration-300"
                style={{ color: hovered === skill.name ? "#ffffff" : gray }}
              >
                {skill.name}
              </h3>
            </div>

            <div
              className="absolute bottom-3 right-3 w-2 h-2 rounded-full duration-300"
              style={{
                background: hovered === skill.name ? "#00D5BE" : "transparent",
                boxShadow: hovered === skill.name ? "0 0 6px #00D5BE" : "none",
              }}
            />
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
