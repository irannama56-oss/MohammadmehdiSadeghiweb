import React from "react";
import { useSiteInfo } from "../../Hooks/useSiteInfo";

export default function Footer() {
  const site = useSiteInfo();
  const linkedin = site?.linkedin != null ? site.linkedin : "https://www.linkedin.com/in/mohammad-mehdi-sadeghi";
  const telegram = site?.telegram != null ? site.telegram : "https://t.me/Mohammad_sadeghi34";
  const github = site?.github != null ? site.github : "https://github.com/MohammadMehdiSadeghi";
  const githubHandle = site?.githubHandle != null && site.githubHandle !== ""
    ? site.githubHandle
    : (site?.githubHandle === "" ? "" : "MohammadMehdiSadeghi");

  return (
    <footer className="w-full min-h-[58px] bg-[#0F172B] flex items-center justify-center">
      <nav
        className="w-full h-full flex flex-row justify-between items-center text-[#90A1B9] border-t-[1px] border-[#90a1b977] px-2 sm:px-4 md:px-0 py-1.5 sm:py-0"
      >
        <ul className="flex items-center gap-1 sm:gap-2 lg:gap-0">
          <li className="py-2 sm:py-[15px] px-2 sm:px-4 lg:px-[24px] text-[12px] sm:text-[14px] lg:text-[16px] text-center border-r-0 lg:border-r-[1px] border-[#90a1b977]">
            <p>find-me-in :</p>
          </li>
          <li className="py-1.5 sm:py-[8px] px-2 sm:px-[14px] border-r-0 lg:border-r-[1px] border-[#90a1b977] lg:rounded-none bg-[#1D293D] rounded-md lg:bg-transparent flex items-center justify-center">
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
            >
              <img loading="lazy" decoding="async"
                width="38"
                height="38"
                className="w-6 sm:w-[32px] lg:w-[38px] h-auto aspect-square"
                src="/assets/Images/RiLinkedinFill.webp"
                alt="LinkedIn"
              />
            </a>
          </li>
          <li className="py-1.5 sm:py-[10px] px-2 sm:px-[14px] border-r-0 lg:border-r-[1px] border-[#90a1b977] bg-[#1D293D] lg:rounded-none rounded-md lg:bg-transparent flex items-center justify-center">
            <a
              href={telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram Profile"
            >
              <img loading="lazy" decoding="async"
                width="34"
                height="34"
                className="w-6 sm:w-[30px] lg:w-[34px] h-auto aspect-square"
                src="/assets/Images/BasilTelegramSolid.webp"
                alt="Telegram"
              />
            </a>
          </li>
        </ul>
        <ul className="shrink-0">
          <li
            className="py-2 sm:py-[11px] px-2.5 sm:px-4 lg:px-[24px] sm:border-l-[1px] text-[12px] sm:text-[14px] border-[#90a1b977] flex items-center justify-center gap-2 sm:gap-4"
          >
            <p className="hidden lg:block">
              <span className="m-1">@</span>{githubHandle}
            </p>
            <p className="lg:hidden block text-[12px] sm:text-[13px]">Github :</p>
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
            >
              <img loading="lazy" decoding="async" width="28" height="28" className="w-6 sm:w-7 h-auto aspect-square" src="/assets/Images/MdiGithub.webp" alt="GitHub" />
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
