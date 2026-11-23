import React from "react";

const lines = [
  "/**",
  "* About me",
  "* I'm a Front-end developer with experience in building modern and",
  "* responsive websites using HTML, CSS, JavaScript, React and WordPress.",
  "*",
  "* I have worked on educational platforms, startup projects and business",
  "* websites, focusing on clean design, user experience and performance optimization.",
  "*",
  "* I focus on delivering real-world projects that improve user experience",
  "* and solve practical problems.",
  "*",
  "* I also work with AI-powered tools for content production and digital solutions.",
  "*",
  "* Currently, I am expanding my knowledge in backend development and",
  "* software architecture to become a full-stack developer in the future.",
  "*/",
];

export default function AboutMe() {
  const gray = "#90A1B9";
  return (
    <div className="w-full min-w-0 py-6 sm:py-8 px-3 sm:px-6 md:px-8 lg:px-12 md:h-[calc(100vh-116px)] md:overflow-y-auto">
      <div
        className="flex flex-col gap-1 text-[12px] sm:text-[14px] lg:text-[15px] leading-6 sm:leading-7 font-mono"
        style={{ color: gray }}
      >
        {lines.map((text, idx) => (
          <div key={idx} className="flex items-start gap-2.5 sm:gap-5">
            <span className="text-[#3d4f6b] select-none text-[11px] sm:text-[13px] w-5 sm:w-6 text-right shrink-0 mt-0.5">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 break-words">{text}</span>
          </div>
        ))}
      </div>

      {/* Persian summary — keeps the bilingual name and service searchable */}
      <div
        dir="rtl"
        lang="fa"
        className="mt-7 sm:mt-9 rounded-xl border border-[#615FFF33] bg-[#615FFF0D] p-4 sm:p-6"
      >
        <h2 className="mb-2.5 text-[14px] sm:text-[17px] font-bold text-white">
          طراحی سایت شرکتی در مشهد
        </h2>
        <p
          className="text-[12px] sm:text-[14px] leading-7 sm:leading-8"
          style={{ color: gray }}
        >
          محمد مهدی صادقی، توسعه‌دهنده فرانت‌اند و طراح سایت در مشهد است.
          طراحی سایت شرکتی در مشهد با تمرکز بر سرعت بارگذاری، سئوی فنی و رابط
          کاربری فارسی انجام می‌شود — با React، TypeScript و وردپرس. اگر به دنبال
          یک سایت شرکتی سریع، ریسپانسیو و آماده‌ی گوگل در مشهد هستید، از صفحه‌ی
          تماس پیام بدهید.
        </p>
      </div>
    </div>
  );
}
