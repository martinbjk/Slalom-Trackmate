"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleProvider";
import { OfflineIndicator } from "./OfflineIndicator";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Nav() {
  const { t } = useT();
  const pathname = usePathname();

  const links = [
    { href: "/", label: t("nav_dashboard") },
    { href: "/participants", label: t("nav_participants") },
    { href: "/classes", label: t("nav_classes") },
    { href: "/results", label: t("nav_results") },
    { href: "/import-export", label: t("nav_importExport") },
  ];

  return (
    <header className="bg-track text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <span className="font-bold tracking-tight">{t("appName")}</span>
        <nav className="flex flex-1 flex-wrap gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-cone text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <OfflineIndicator />
        </div>
      </div>
    </header>
  );
}
