import React, { useState, useEffect } from "react";
import FilterBox from "./FilterBox";
import ProjectSection from "./ProjectSection";
import usePageSEO from "../../Hooks/usePageSEO";

export default function Project() {
  usePageSEO({
    title: "Projects & Portfolio | Mohammad Mehdi Sadeghi — محمد مهدی صادقی",
    description: "Frontend web projects, corporate websites and interactive UI demos by Mohammad Mehdi Sadeghi (محمد مهدی صادقی) — built with React, Next.js, Tailwind CSS and JavaScript.",
    canonical: "https://mohammad-mehdi-sadeghi.vercel.app/project",
    image: "/og-preview.png",
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Projects by Mohammad Mehdi Sadeghi",
      "description": "Showcase of frontend development projects, web applications, and interactive user interfaces.",
      "url": "https://mohammad-mehdi-sadeghi.vercel.app/project",
      "author": {
        "@type": "Person",
        "name": "Mohammad Mehdi Sadeghi",
        "url": "https://mohammad-mehdi-sadeghi.vercel.app"
      }
    }
  });

  const [activeCategory, setActiveCategory] = useState("All Web Project");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        let data;
        if (activeCategory === "All Web Project") {
          const res = await fetch(`/api/projects`);
          const json = await res.json();
          data = Array.isArray(json) ? json : json.projects || [];
        } else if (activeCategory === "All Mini Project") {
          const res = await fetch(`/api/mini-projects`);
          const json = await res.json();
          data = Array.isArray(json) ? json : json.projects || [];
        } else {
          const res = await fetch(`/api/projects`);
          const json = await res.json();
          const all = Array.isArray(json) ? json : json.projects || [];
          data = all.filter(
            (p) =>
              Array.isArray(p.category) &&
              p.category.includes(activeCategory),
          );
        }
        setProjects(data);
      } catch (err) {
        console.error("Error fetching projects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [activeCategory]);

  return (
    <section className="bg-[#0F172B] min-h-[calc(100vh-116px)] flex flex-col md:flex-row md:h-[calc(100vh-116px)] md:overflow-hidden">
      <h1 className="sr-only">
        Projects &amp; Portfolio — Mohammad Mehdi Sadeghi (محمد مهدی صادقی)
      </h1>
      <FilterBox
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        projects={projects}
        loading={loading}
      />
      <ProjectSection
        projects={projects}
        loading={loading}
        className="hidden md:block"
      />
    </section>
  );
}
