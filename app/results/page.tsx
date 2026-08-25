"use client";

import { useEffect, useMemo, useState } from "react";
import { useDatabase } from "@/lib/db/DatabaseProvider";
import { useT } from "@/lib/i18n/LocaleProvider";
import { DatabaseErrorBanner } from "@/components/DatabaseErrorBanner";
import { listClasses, listHeats, listParticipants, listResultsForHeat, upsertResult } from "@/lib/db/repository";
import { exportResultsPdf } from "@/lib/export/exporters";
import { formatMsToTime, parseTimeToMs } from "@/lib/time";
import { computeResultantTimeMs } from "@/lib/conePenalty";
import { StatusBadge } from "@/components/StatusBadge";
import { TrackmateLiveTiming } from "@/components/TrackmateLiveTiming";
import type { ParticipantStatus } from "@/lib/types";

const STATUSES: ParticipantStatus[] = ["active", "DNS", "DSQ", "DNF"];

export default function ResultsPage() {
  const { db, ready, error, version, notifyChange } = useDatabase();
  const { t } = useT();

  const classes = useMemo(() => (db ? listClasses(db) : []), [db, version]);
  const [classId, setClassId] = useState<string>("");
  const heats = useMemo(() => (db && classId ? listHeats(db, classId) : []), [db, version, classId]);
  const [heatId, setHeatId] = useState<string>("");

  useEffect(() => {
    if (!classId && classes.length > 0) setClassId(classes[0].id);
  }, [classes, classId]);

  useEffect(() => {
    setHeatId(heats[0]?.id ?? "");
  }, [heats]);

  const participants = useMemo(() => (db ? listParticipants(db) : []), [db, version]);
  const participantsById = useMemo(() => Object.fromEntries(participants.map((p) => [p.id, p])), [participants]);
  const results = useMemo(() => (db && heatId ? listResultsForHeat(db, heatId) : []), [db, version, heatId]);
  const resultsByParticipant = useMemo(() => Object.fromEntries(results.map((r) => [r.participant_id, r])), [results]);

  const [timeInputs, setTimeInputs] = useState<Record<string, string>>({});
  const [coneInputs, setConeInputs] = useState<Record<string, string>>({});
  const [statusInputs, setStatusInputs] = useState<Record<string, ParticipantStatus>>({});
  const [timeErrors, setTimeErrors] = useState<Record<string, string>>({});

  const currentClass = classes.find((c) => c.id === classId);
  const conePenaltyMs = currentClass?.cone_penalty_ms ?? 100;

  if (error) return <DatabaseErrorBanner error={error} />;
  if (!ready || !db) return <p className="text-foreground/60">Laddar lokal databas…</p>;

  const heat = heats.find((h) => h.id === heatId);
  const selectClass = "rounded border border-line bg-white px-3 py-2 text-sm focus:border-cone focus:outline-none focus:ring-1 focus:ring-cone";

  const save = (participantId: string) => {
    const existing = resultsByParticipant[participantId];
    const status = statusInputs[participantId] ?? existing?.status ?? "active";
    const timeStr = timeInputs[participantId] ?? (existing?.time_ms != null ? formatMsToTime(existing.time_ms) : "");
    const conesStr = coneInputs[participantId] ?? String(existing?.cones_displaced ?? 0);
    const cones = Math.max(0, parseInt(conesStr, 10) || 0);

    if (status === "active" && timeStr.trim() !== "") {
      const parsed = parseTimeToMs(timeStr);
      if (parsed === null) {
        setTimeErrors((prev) => ({ ...prev, [participantId]: `Ogiltigt tidsformat: "${timeStr}". Använd mm:ss.xx, t.ex. 45.32 eller 1:12.05.` }));
        return; // Don't save — keep whatever was there before.
      }
    }
    setTimeErrors((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });

    const timeMs = status === "active" ? parseTimeToMs(timeStr) : null;
    upsertResult(db, { participant_id: participantId, heat_id: heatId, time_ms: timeMs, cones_displaced: cones, rank: null, status });
    notifyChange();
  };

  /** Used by the Trackmate live-timing integration — the device already gives us an exact ms value. Cones (if any) are entered separately, since the timer doesn't track those. */
  const saveTimeMs = (participantId: string, timeMs: number) => {
    const existingCones = resultsByParticipant[participantId]?.cones_displaced ?? 0;
    upsertResult(db, { participant_id: participantId, heat_id: heatId, time_ms: timeMs, cones_displaced: existingCones, rank: null, status: "active" });
    notifyChange();
  };

  const rankedRows = heat
    ? [...heat.participant_ids]
        .map((pid) => ({ p: participantsById[pid], r: resultsByParticipant[pid] }))
        .sort((a, b) => {
          const ra = a.r?.rank ?? Infinity;
          const rb = b.r?.rank ?? Infinity;
          return ra - rb;
        })
    : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t("results_title")}</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">{t("field_class")}</label>
          <select className={selectClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">{t("results_selectHeat")}</label>
          <select className={selectClass} value={heatId} onChange={(e) => setHeatId(e.target.value)}>
            {heats.map((h) => (
              <option key={h.id} value={h.id}>
                Heat {h.heat_number}
              </option>
            ))}
          </select>
        </div>
        {heat && (
          <button
            onClick={() =>
              exportResultsPdf(
                classes.find((c) => c.id === classId)?.name ?? "",
                `Heat ${heat.heat_number}`,
                rankedRows.map(({ p, r }) => ({
                  rank: r?.rank ? String(r.rank) : "—",
                  bib: p?.bib_number ?? 0,
                  name: p ? `${p.first_name} ${p.last_name}` : "?",
                  time:
                    r?.time_ms != null
                      ? formatMsToTime(computeResultantTimeMs(r.time_ms, r.cones_displaced, conePenaltyMs))
                      : formatMsToTime(null),
                  cones: r?.cones_displaced ?? 0,
                  status: r?.status ?? "active",
                }))
              )
            }
            className="rounded bg-track px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t("export_pdf")}
          </button>
        )}
      </div>

      {!heat && <p className="text-foreground/50">Ingen startlista genererad för denna klass ännu.</p>}

      {heat && (
        <TrackmateLiveTiming
          pendingParticipants={rankedRows
            .filter(({ r }) => !r || (r.status === "active" && r.time_ms == null))
            .map(({ p }) => p)
            .filter((p): p is NonNullable<typeof p> => p != null)}
          onFinish={saveTimeMs}
        />
      )}

      {heat && (
        <div className="overflow-x-auto rounded border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-black/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
              <tr>
                <th className="px-3 py-2">Placering</th>
                <th className="px-3 py-2">{t("field_bib")}</th>
                <th className="px-3 py-2">Namn</th>
                <th className="px-3 py-2">Rå tid ({t("results_time")})</th>
                <th className="px-3 py-2">Koner</th>
                <th className="px-3 py-2">Sluttid</th>
                <th className="px-3 py-2">{t("field_status")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rankedRows.map(({ p, r }) => {
                if (!p) return null;
                const currentStatus = statusInputs[p.id] ?? r?.status ?? "active";
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-semibold tabular-time">{r?.rank ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="bib-badge">{p.bib_number}</span>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={currentStatus !== "active"}
                        placeholder="mm:ss.xx"
                        defaultValue={r?.time_ms != null ? formatMsToTime(r.time_ms) : ""}
                        onChange={(e) => setTimeInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className={`tabular-time w-28 rounded border bg-white px-2 py-1 text-sm disabled:bg-black/5 ${
                          timeErrors[p.id] ? "border-signal-red" : "border-line"
                        }`}
                      />
                      {timeErrors[p.id] && <p className="mt-1 max-w-40 text-xs text-signal-red">{timeErrors[p.id]}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        disabled={currentStatus !== "active"}
                        defaultValue={r?.cones_displaced ?? 0}
                        onChange={(e) => setConeInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="tabular-time w-16 rounded border border-line bg-white px-2 py-1 text-sm disabled:bg-black/5"
                      />
                    </td>
                    <td className="px-3 py-2 tabular-time font-medium">
                      {r?.time_ms != null
                        ? formatMsToTime(computeResultantTimeMs(r.time_ms, r.cones_displaced, conePenaltyMs))
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={currentStatus}
                        onChange={(e) => setStatusInputs((prev) => ({ ...prev, [p.id]: e.target.value as ParticipantStatus }))}
                        className="rounded border border-line bg-white px-2 py-1 text-sm"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className="ml-2">
                        <StatusBadge status={r?.status ?? "active"} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => save(p.id)} className="rounded bg-cone px-3 py-1.5 text-xs font-semibold text-white hover:bg-cone-dark">
                        {t("action_save")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
