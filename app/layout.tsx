import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DatabaseProvider } from "@/lib/db/DatabaseProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { Nav } from "@/components/Nav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Slalom-VW – Tävlingshantering",
  description: "Offline-first tävlingshantering för slalom-VW skateboard — ersätter Excel.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1c1f26",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <LocaleProvider>
          <DatabaseProvider>
            <ServiceWorkerRegister />
            <Nav />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          </DatabaseProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
