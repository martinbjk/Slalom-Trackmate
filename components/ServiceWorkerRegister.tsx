"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/basePath";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
        .catch((err) => {
          console.error("Service worker registration failed", err);
        });
    }
  }, []);
  return null;
}
