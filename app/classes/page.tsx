"use client";

import { useMemo, useState } from "react";
import { useDatabase } from "@/lib/db/DatabaseProvider";
import { useT } from "@/lib/i18n/LocaleProvider";
import { DatabaseErrorBanner } from "@/components/DatabaseErrorBanner";
import { deleteClass, generateStartList, listClasses, listHeats, listParticipants, upsertClass } from "@/lib/db/repository";
import { exportStartListPdf } from "@/lib/export/exporters";
import type { Gender } from "@/lib/types";

const GENDER_OPTIONS: (Gender | "MIXED")[] = ["M", "F", "MIXED"];

export default function ClassesPage() {
  const { db, ready, error, version, notifyChange } = useDatabase();
  const { t } = useT();
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<Gender | "MIXED">("MIXED");
  const [newAgeGroup, setNewAgeGroup] = useState("");
  const [heatSize, setHeatSize] = useState<Record<string, number>>({});

  const classes = useMemo(() => (db ? listClasses(db) : []), [db, version]);
  const participants = useMemo(() => (db ? listParticipants(db) : []), [db, version]);
  const heats = useMemo(() => (db ? listHeats(db) : []), [db, version]);

  if (error) return <DatabaseErrorBanner error={error} />;
  if (!ready || !db) return <p className="text-foreground/60">Laddar lokal databas…</p>;

  const participantsById = Object.fromEntries(participants.map((p) => [p.id, p]));

  const addClass = () => {
    if (!newName.trim()) return;
    upsertClass(db, { name: newName.trim(), gender: newGender, age_group: newAgeGroup.trim() });
    setNewName("");
    setNewAgeGroup("");
    notifyChange();
  };

  const inputClass =
    "rounded border border-line bg-white px-3 py-2 text-sm focus:border-cone focus:outline-none focus:ring-1 focus:ring-cone";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-bold">{t("classes_title")}</h1>

        <div className="mb-4 flex flex-wrap items-end gap-2 rounded border border-line bg-surface p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/70">Namn</label>
            <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="T.ex. Junior Herrar" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/70">{t("field_gender")}</label>
            <select className={inputClass} value={newGender} onChange={(e) => setNewGender(e.target.value as Gender | "MIXED")}>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground/70">Åldersgrupp</label>
            <input className={inputClass} value={newAgeGroup} onChange={(e) => setNewAgeGroup(e.target.value)} placeholder="12-15" />
          </div>
          <button onClick={addClass} className="rounded bg-cone px-4 py-2 text-sm font-semibold text-white hover:bg-cone-dark">
            + {t("classes_add")}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => {
            const classParticipants = participants.filter((p) => p.class_id === c.id);
            const classHeats = heats.filter((h) => h.class_id === c.id);
            return (
              <div key={c.id} className="rounded border border-line bg-surface p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-foreground/50">
                      {c.gender} · {c.age_group || "—"} · {classParticipants.length} deltagare
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      deleteClass(db, c.id);
                      notifyChange();
                    }}
                    className="text-xs font-medium text-signal-red hover:underline"
                  >
                    {t("action_delete")}
                  </button>
                </div>

                <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground/70">{t("classes_heatSize")}</label>
                    <input
                      type="number"
                      min={2}
                      className={`${inputClass} w-20`}
                      value={heatSize[c.id] ?? 8}
                      onChange={(e) => setHeatSize({ ...heatSize, [c.id]: parseInt(e.target.value, 10) || 8 })}
                    />
                  </div>
                  <button
                    onClick={() => {
                      generateStartList(db, c.id, heatSize[c.id] ?? 8);
                      notifyChange();
                    }}
                    className="rounded bg-track px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    {t("classes_generate")}
                  </button>
                </div>

                {classHeats.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-line pt-3">
                    {classHeats.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-sm">
                        <span>
                          Heat {h.heat_number} ({h.participant_ids.length} åkare)
                        </span>
                        <button
                          onClick={() =>
                            exportStartListPdf(
                              c.name,
                              `Heat ${h.heat_number}`,
                              h.participant_ids.map((pid) => {
                                const p = participantsById[pid];
                                return {
                                  bib: p?.bib_number ?? 0,
                                  name: p ? `${p.first_name} ${p.last_name}` : "?",
                                  country: p?.country ?? "",
                                  club: p?.club ?? "",
                                };
                              }),
                              `startlista-${c.name}-heat${h.heat_number}.pdf`
                            )
                          }
                          className="text-xs font-medium text-cone hover:underline"
                        >
                          {t("export_pdf")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {classes.length === 0 && <p className="text-foreground/50">Inga klasser ännu — lägg till en ovan.</p>}
        </div>
      </div>
    </div>
  );
}
