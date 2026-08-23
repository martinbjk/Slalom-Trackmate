"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDatabase } from "@/lib/db/DatabaseProvider";
import { useT } from "@/lib/i18n/LocaleProvider";
import { listClasses, listHeats, listParticipants } from "@/lib/db/repository";

export default function Dashboard() {
  const { db, ready, version } = useDatabase();
  const { t } = useT();

  const classes = useMemo(() => (db ? listClasses(db) : []), [db, version]);
  const participants = useMemo(() => (db ? listParticipants(db) : []), [db, version]);
  const heats = useMemo(() => (db ? listHeats(db) : []), [db, version]);

  if (!ready) return <p className="text-foreground/60">Laddar lokal databas…</p>;

  const cards = [
    { label: t("nav_participants"), count: participants.length, href: "/participants" },
    { label: t("nav_classes"), count: classes.length, href: "/classes" },
    { label: "Heat", count: heats.length, href: "/results" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("appName")}</h1>
        <p className="mt-1 text-sm text-foreground/60">
          All data lagras lokalt i denna webbläsare. Ingen internetuppkoppling krävs under tävlingen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-lg border border-line bg-surface p-5 transition hover:border-cone hover:shadow-sm"
          >
            <p className="text-3xl font-bold tabular-time">{c.count}</p>
            <p className="mt-1 text-sm text-foreground/60">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-2 font-semibold">Kom igång</h2>
        <ol className="ml-4 list-decimal space-y-1 text-sm text-foreground/70">
          <li>
            Skapa klasser under <Link href="/classes" className="text-cone underline">Klasser &amp; startlistor</Link>.
          </li>
          <li>
            Importera eller lägg till deltagare under{" "}
            <Link href="/import-export" className="text-cone underline">Import / Export</Link> eller{" "}
            <Link href="/participants" className="text-cone underline">Deltagare</Link>.
          </li>
          <li>Generera startlistor per klass.</li>
          <li>
            Mata in tider under <Link href="/results" className="text-cone underline">Resultat</Link> — rankingen räknas ut automatiskt.
          </li>
          <li>Ta en backup regelbundet under tävlingen (Import/Export-sidan).</li>
        </ol>
      </div>
    </div>
  );
}
