"use client";

import { usePathname, useRouter } from "next/navigation";
import { languageNames, languages, type Lang } from "@/lib/lang";

const supportedSwitcherLanguages: Lang[] = ["en", "zh"];

export function LanguageSwitcher({ lang }: { lang: Lang }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLang(nextLang: Lang) {
    const parts = pathname.split("/");
    if (languages.includes(parts[1] as Lang)) {
      parts[1] = nextLang;
      router.push(parts.join("/") || `/${nextLang}`);
      return;
    }
    router.push(`/${nextLang}${pathname === "/" ? "/assistant" : pathname}`);
  }

  return (
    <label className="flex items-center gap-2 rounded-md border border-black/10 bg-white/65 px-2 py-1 text-xs text-ink/70 shadow-sm">
      <span className="hidden sm:inline">{lang === "zh" ? "\u8bed\u8a00" : "Lang"}</span>
      <select
        value={lang}
        onChange={(event) => switchLang(event.target.value as Lang)}
        className="bg-transparent py-1 text-xs outline-none"
      >
        {supportedSwitcherLanguages.map((item) => (
          <option key={item} value={item}>
            {languageNames[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
