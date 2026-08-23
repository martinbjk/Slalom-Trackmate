"use client";

import { useT } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/types";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "sv", label: "SV" },
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
  { value: "pt", label: "PT" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useT();
  return (
    <div className="flex gap-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setLocale(opt.value)}
          className={`rounded px-2 py-1 text-xs font-semibold transition ${
            locale === opt.value ? "bg-cone text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
