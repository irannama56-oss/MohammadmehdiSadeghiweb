import React from "react";
import SnakeBar from "../../../Components/SnakeBar";
import { useSiteInfo } from "../../../Hooks/useSiteInfo";

const gray = "#90A1B9";

export default function ContactBox() {
  const site = useSiteInfo();
  const email = site?.email != null ? site.email : "mohammad.m.sadeghi09@gmail.com";
  const phone = site?.phone != null ? site.phone : "+989150669620";
  const phoneLabel = site?.phoneLabel != null ? site.phoneLabel : (phone || "+98 915 066 9620");
  const telegram = site?.telegram != null ? site.telegram : "https://t.me/Mohammad_sadeghi34";
  const telegramHandle = site?.telegramHandle != null && site.telegramHandle !== ""
    ? `@${site.telegramHandle.replace(/^@/, "")}`
    : (site?.telegramHandle === "" ? "" : "@Mohammad_sadeghi34");
  const instagram = site?.instagram != null ? site.instagram : "https://www.instagram.com/Mohammad_sadeghi3447";
  const instagramHandle = site?.instagramHandle != null && site.instagramHandle !== ""
    ? `@${site.instagramHandle.replace(/^@/, "")}`
    : (site?.instagramHandle === "" ? "" : "@Mohammad_sadeghi3447");

  return (
    <section className="flex justify-start md:h-full border-b md:border-b-0 border-[#90a1b977]">
      <div className="hidden lg:block relative w-14 border-r-[1px] border-[#90a1b977] h-[calc(100vh-116px)]">
        <SnakeBar />
      </div>
      <nav
        className="w-full md:w-60 lg:w-72 xl:w-[360px] 2xl:w-[457px] shrink-0 md:border-r-[1px] border-[#90a1b977] md:max-h-none md:h-[calc(100vh-116px)] md:overflow-y-auto"
        style={{ color: gray }}
      >
        <ul className="flex flex-col pb-3 gap-1.5 h-fit">
          <h2 className="px-4 sm:px-7 py-3.5 w-full flex items-center gap-2.5 border-b-[1px] text-white border-[#90a1b977]">
            contacts{" "}
            <img loading="lazy" decoding="async" className="w-3" src="/assets/Images/Vector.svg" alt="" />
          </h2>
          {Boolean(email) && (
            <li>
              <a
                className="w-full flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 md:px-5 lg:px-8 py-2.5 text-[12px] sm:text-[14px] hover:text-white hover:bg-[#7888a01a] transition-all duration-150 cursor-pointer min-w-0"
                href={`mailto:${email}`}
              >
                <img loading="lazy" decoding="async"
                  className="w-5 shrink-0"
                  src="/assets/Images/icon message.svg"
                  alt=""
                />
                <span className="truncate">{email}</span>
              </a>
            </li>
          )}
          {Boolean(phone) && (
            <li>
              <a
                className="w-full flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 md:px-5 lg:px-8 py-2.5 text-[12px] sm:text-[14px] hover:text-white hover:bg-[#7888a01a] transition-all duration-150 cursor-pointer min-w-0"
                href={`tel:${phone}`}
              >
                <img loading="lazy" decoding="async"
                  className="w-5 shrink-0"
                  src="/assets/Images/icon phone.svg"
                  alt=""
                />
                <span>{phoneLabel}</span>
              </a>
            </li>
          )}
          {Boolean(telegram) && (
            <li>
              <a
                className="w-full flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 md:px-5 lg:px-8 py-2.5 text-[12px] sm:text-[14px] hover:text-white hover:bg-[#7888a01a] transition-all duration-150 cursor-pointer min-w-0"
                href={telegram}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img loading="lazy" decoding="async"
                  className="w-5 shrink-0"
                  src="/assets/Images/BasilTelegramSolid.webp"
                  alt=""
                />
                <span className="truncate">{telegramHandle || telegram}</span>
              </a>
            </li>
          )}
          {Boolean(instagram) && (
            <li className="border-b md:border-b-0">
              <a
                className="w-full flex items-center gap-2.5 sm:gap-3 px-4 sm:px-6 md:px-5 lg:px-8 py-2.5 text-[12px] sm:text-[14px] hover:text-white hover:bg-[#7888a01a] transition-all duration-150 cursor-pointer min-w-0"
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img loading="lazy" decoding="async"
                  className="w-5 shrink-0"
                  src="/assets/Images/TablerBrandInstagram.webp"
                  alt=""
                />
                <span className="truncate">{instagramHandle || instagram}</span>
              </a>
            </li>
          )}
        </ul>
      </nav>
    </section>
  );
}
