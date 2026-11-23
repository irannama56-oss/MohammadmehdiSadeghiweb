import React, { useState } from "react";
import SubjectBox from "./SubjectBox";
import Bio from "./Bio";
import usePageSEO from "../../Hooks/usePageSEO";

export default function About() {
  usePageSEO({
    title: "About Mohammad Mehdi Sadeghi | محمد مهدی صادقی — Frontend Developer",
    description:
      "About Mohammad Mehdi Sadeghi (محمد مهدی صادقی) — frontend developer and corporate website designer in Mashhad, working with React, TypeScript, Tailwind CSS and WordPress.",
    canonical: "https://mohammad-mehdi-sadeghi.vercel.app/about",
    image: "/og-preview.png",
    schema: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "name": "About Mohammad Mehdi Sadeghi",
        "url": "https://mohammad-mehdi-sadeghi.vercel.app/about",
        "inLanguage": "en-US",
        "mainEntity": {
          "@type": "Person",
          "name": "Mohammad Mehdi Sadeghi",
          "alternateName": [
            "محمد مهدی صادقی",
            "محمد‌مهدی صادقی",
            "MohammadMehdi Sadeghi",
            "Mohammad-Mehdi Sadeghi"
          ],
          "jobTitle": "Frontend Developer",
          "alumniOf": "Rokad Startup School",
          "url": "https://mohammad-mehdi-sadeghi.vercel.app",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "مشهد",
            "addressRegion": "خراسان رضوی",
            "addressCountry": "IR"
          },
          "knowsLanguage": ["fa-IR", "en"],
          "knowsAbout": [
            "HTML",
            "CSS",
            "JavaScript",
            "React",
            "Tailwind CSS",
            "TypeScript",
            "WordPress",
            "Corporate Website Design",
            "Technical SEO"
          ]
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "طراحی سایت شرکتی در مشهد",
        "alternateName": "Corporate Website Design in Mashhad",
        "serviceType": "طراحی سایت شرکتی",
        "description":
          "طراحی و پیاده‌سازی سایت شرکتی سریع، ریسپانسیو و سئو‌شده در مشهد با React، TypeScript و وردپرس.",
        "provider": {
          "@type": "Person",
          "name": "Mohammad Mehdi Sadeghi",
          "url": "https://mohammad-mehdi-sadeghi.vercel.app"
        },
        "areaServed": {
          "@type": "City",
          "name": "Mashhad",
          "containedInPlace": { "@type": "Country", "name": "Iran" }
        },
        "availableLanguage": ["fa-IR", "en"]
      }
    ]
  });

  const [activeTab, setActiveTab] = useState("aboutMe");
  const [personalInfoOpen, setPersonalInfoOpen] = useState(true);
  return (
    <section className="bg-[#0F172B] min-h-[calc(100vh-116px)] flex flex-col md:flex-row md:h-[calc(100vh-116px)] md:overflow-hidden">
      <h1 className="sr-only">
        About Mohammad Mehdi Sadeghi (محمد مهدی صادقی) — Frontend Developer &amp;
        Corporate Website Designer in Mashhad
      </h1>
      <SubjectBox
        setActiveTab={setActiveTab}
        activeTab={activeTab}
        personalInfoOpen={personalInfoOpen}
        setPersonalInfoOpen={setPersonalInfoOpen}
        mobileContent={
          <Bio
            activeTab={activeTab}
            personalInfoOpen={personalInfoOpen}
            variant="mobile"
          />
        }
      />
      <Bio
        activeTab={activeTab}
        personalInfoOpen={personalInfoOpen}
        variant="desktop"
      />
    </section>
  );
}
