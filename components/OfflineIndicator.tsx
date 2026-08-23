"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleProvider";

export function OfflineIndicator() {
  const { t } = useT();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        online ? "bg-white/10 text-white/70" : "bg-cone text-white"
      }`}
      title={online ? t("offline_online") : t("offline_offline")}
    >
      <span className={`h-2 w-2 rounded-full ${online ? "bg-signal-green" : "bg-white"}`} />
      {online ? t("offline_online") : t("offline_offline")}
    </span>
  );
}
