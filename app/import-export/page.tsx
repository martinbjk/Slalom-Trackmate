"use client";

import { useMemo, useRef, useState } from "react";
import { useDatabase } from "@/lib/db/DatabaseProvider";
import { useT } from "@/lib/i18n/LocaleProvider";
import { DatabaseErrorBanner } from "@/components/DatabaseErrorBanner";
import { listClasses, listParticipants, createParticipant } from "@/lib/db/repository";
import { parseUploadedFile, type ParsedFile } from "@/lib/import/parseFile";
import { buildImportRows, guessColumnMapping } from "@/lib/import/validate";
import { exportParticipantsCsv, exportParticipantsXlsx } from "@/lib/export/exporters";
import { exportDatabaseFile, restoreDatabaseFromFile } from "@/lib/db/database";
import type { ColumnMapping, ImportRow, Participant } from "@/lib/types";

export default function ImportExportPage() {
  const { db, ready, error, version, notifyChange } = useDatabase();
  const { t } = useT();

  const classes = useMemo(() => (db ? listClasses(db) : []), [db, version]);
  const participants = useMemo(() => (db ? listParticipants(db) : []), [db, version]);

  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importError, setImportError] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  const rows: ImportRow[] = useMemo(() => {
    if (!parsed || !db) return [];
    const existingBibs = new Set(participants.map((p) => p.bib_number));
    return buildImportRows(parsed.rows, mapping, existingBibs);
  }, [parsed, mapping, participants, db]);

  const validRows = rows.filter((r) => r.issues.every((i) => i.severity !== "error"));
  const errorCount = rows.reduce((sum, r) => sum + r.issues.filter((i) => i.severity === "error").length, 0);

  const handleFile = async (file: File) => {
    setImportError(null);
    try {
      const result = await parseUploadedFile(file);
      setParsed(result);
      setMapping(guessColumnMapping(result.headers));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
      setParsed(null);
    }
  };

  const confirmImport = () => {
    if (!db) return;
    for (const row of validRows) {
      const m = row.mapped;
      const classId = classes.find((c) => c.id === m.class_id || c.name === m.class_id)?.id ?? classes[0]?.id;
      if (!classId) continue;
      createParticipant(db, {
        first_name: m.first_name ?? "",
        last_name: m.last_name ?? "",
        country: (m.country ?? "").toUpperCase(),
        class_id: classId,
        birth_year: m.birth_year ?? 0,
        gender: m.gender ?? "O",
        club: m.club ?? "",
        bib_number: m.bib_number ?? 0,
        status: m.status ?? "active",
      } as Omit<Participant, "id" | "created_at" | "updated_at">);
    }
    notifyChange();
    setParsed(null);
    setMapping({});
  };

  const downloadBackup = async () => {
    const bytes = await exportDatabaseFile();
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `slalom-comp-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sqlite`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const doRestore = async () => {
    if (!pendingRestoreFile) return;
    const buffer = await pendingRestoreFile.arrayBuffer();
    await restoreDatabaseFromFile(new Uint8Array(buffer));
    setRestoreConfirm(false);
    setPendingRestoreFile(null);
    window.location.reload(); // simplest reliable way to make every page re-read the restored db
  };

  if (error) return <DatabaseErrorBanner error={error} />;
  if (!ready || !db) return <p className="text-foreground/60">Laddar lokal databas…</p>;

  const fieldOptions: { value: keyof Participant | ""; label: string }[] = [
    { value: "", label: "— Ignorera —" },
    { value: "first_name", label: t("field_firstName") },
    { value: "last_name", label: t("field_lastName") },
    { value: "country", label: t("field_country") },
    { value: "class_id", label: t("field_class") },
    { value: "birth_year", label: t("field_birthYear") },
    { value: "gender", label: t("field_gender") },
    { value: "club", label: t("field_club") },
    { value: "bib_number", label: t("field_bib") },
    { value: "status", label: t("field_status") },
  ];

  return (
    <div className="space-y-10">
      {/* Import */}
      <section>
        <h1 className="mb-3 text-xl font-bold">{t("import_title")}</h1>
        <label className="inline-block cursor-pointer rounded border border-dashed border-line bg-surface px-4 py-3 text-sm font-medium hover:border-cone">
          {t("import_selectFile")}
          <input
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>

        {importError && <p className="mt-3 rounded bg-signal-red/10 px-3 py-2 text-sm text-signal-red">{importError}</p>}

        {parsed && (
          <div className="mt-5 space-y-4">
            <div>
              <h2 className="mb-2 font-semibold">{t("import_mapColumns")}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {parsed.headers.map((h) => (
                  <div key={h} className="flex items-center gap-2 rounded border border-line bg-surface px-2 py-1.5">
                    <span className="flex-1 truncate text-xs font-medium" title={h}>
                      {h}
                    </span>
                    <select
                      value={mapping[h] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as keyof Participant | "" })}
                      className="rounded border border-line bg-white px-1 py-1 text-xs"
                    >
                      {fieldOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 font-semibold">
                {t("import_preview")} — {validRows.length}/{rows.length} giltiga, {errorCount} {t("import_errorsFound")}
              </h2>
              <div className="max-h-80 overflow-y-auto rounded border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 border-b border-line bg-black/[0.03] text-left uppercase tracking-wide text-foreground/50">
                    <tr>
                      <th className="px-2 py-1.5">Rad</th>
                      <th className="px-2 py-1.5">{t("field_bib")}</th>
                      <th className="px-2 py-1.5">Namn</th>
                      <th className="px-2 py-1.5">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const hasError = r.issues.some((i) => i.severity === "error");
                      return (
                        <tr key={r.rowIndex} className={`border-b border-line last:border-0 ${hasError ? "bg-signal-red/5" : ""}`}>
                          <td className="px-2 py-1.5">{r.rowIndex + 1}</td>
                          <td className="px-2 py-1.5">{r.mapped.bib_number ?? "—"}</td>
                          <td className="px-2 py-1.5">
                            {r.mapped.first_name ?? ""} {r.mapped.last_name ?? ""}
                          </td>
                          <td className="px-2 py-1.5">
                            {r.issues.length === 0 ? (
                              <span className="text-signal-green">OK</span>
                            ) : (
                              r.issues.map((i, idx) => (
                                <div key={idx} className={i.severity === "error" ? "text-signal-red" : "text-signal-gray"}>
                                  {i.message}
                                </div>
                              ))
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setParsed(null)} className="rounded px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-black/5">
                {t("action_cancel")}
              </button>
              <button
                onClick={confirmImport}
                disabled={validRows.length === 0}
                className="rounded bg-cone px-4 py-2 text-sm font-semibold text-white hover:bg-cone-dark disabled:opacity-40"
              >
                {t("import_confirm")} ({validRows.length})
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Export */}
      <section>
        <h2 className="mb-3 text-lg font-bold">{t("nav_importExport")}</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportParticipantsCsv(participants)} className="rounded bg-track px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            {t("export_csv")}
          </button>
          <button onClick={() => exportParticipantsXlsx(participants)} className="rounded bg-track px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            {t("export_xlsx")}
          </button>
        </div>
      </section>

      {/* Backup */}
      <section className="rounded border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold">Backup &amp; återställning</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={downloadBackup} className="rounded bg-cone px-4 py-2 text-sm font-semibold text-white hover:bg-cone-dark">
            {t("backup_export")}
          </button>
          <button
            onClick={() => restoreInputRef.current?.click()}
            className="rounded border border-line px-4 py-2 text-sm font-medium hover:bg-black/5"
          >
            {t("backup_restore")}
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".sqlite,.db"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setPendingRestoreFile(file);
                setRestoreConfirm(true);
              }
            }}
          />
        </div>
        <p className="mt-2 text-xs text-foreground/50">
          En backup är hela den lokala databasen som en enda .sqlite-fil. Spara den på USB eller e-posta den till dig själv innan/efter tävlingen.
        </p>
      </section>

      {restoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-xl">
            <p className="mb-4 text-sm font-medium text-signal-red">{t("backup_restoreWarning")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRestoreConfirm(false);
                  setPendingRestoreFile(null);
                }}
                className="rounded px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-black/5"
              >
                {t("action_cancel")}
              </button>
              <button onClick={doRestore} className="rounded bg-signal-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                {t("backup_restore")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
