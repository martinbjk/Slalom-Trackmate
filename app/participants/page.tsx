"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDatabase } from "@/lib/db/DatabaseProvider";
import { useT } from "@/lib/i18n/LocaleProvider";
import { deleteParticipant, listClasses, listParticipants } from "@/lib/db/repository";
import type { Participant } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { ParticipantForm } from "./ParticipantForm";

export default function ParticipantsPage() {
  const { db, ready, version, notifyChange } = useDatabase();
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Participant | null | "new">(null);
  const [confirmDelete, setConfirmDelete] = useState<Participant | null>(null);

  const classes = useMemo(() => (db ? listClasses(db) : []), [db, version]);
  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);
  const participants = useMemo(() => (db ? listParticipants(db, search) : []), [db, version, search]);

  if (!ready || !db) return <p className="text-foreground/60">Laddar lokal databas…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("participants_title")}</h1>
        <div className="flex flex-1 max-w-sm gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("participants_search")}
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm focus:border-cone focus:outline-none focus:ring-1 focus:ring-cone"
          />
        </div>
        {classes.length > 0 ? (
          <button
            onClick={() => setEditing("new")}
            className="rounded bg-cone px-4 py-2 text-sm font-semibold text-white hover:bg-cone-dark"
          >
            + {t("participants_add")}
          </button>
        ) : (
          <Link href="/classes" className="text-sm font-medium text-cone underline">
            Skapa en klass först →
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-black/[0.02] text-left text-xs uppercase tracking-wide text-foreground/50">
            <tr>
              <th className="px-3 py-2">{t("field_bib")}</th>
              <th className="px-3 py-2">Namn</th>
              <th className="px-3 py-2">{t("field_country")}</th>
              <th className="px-3 py-2">{t("field_class")}</th>
              <th className="px-3 py-2">{t("field_club")}</th>
              <th className="px-3 py-2">{t("field_status")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0 hover:bg-black/[0.015]">
                <td className="px-3 py-2">
                  <span className="bib-badge">{p.bib_number}</span>
                </td>
                <td className="px-3 py-2 font-medium">
                  {p.first_name} {p.last_name}
                </td>
                <td className="px-3 py-2 text-foreground/70">{p.country}</td>
                <td className="px-3 py-2 text-foreground/70">{classById[p.class_id] ?? "—"}</td>
                <td className="px-3 py-2 text-foreground/70">{p.club}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEditing(p)} className="mr-3 text-xs font-medium text-cone hover:underline">
                    {t("action_edit")}
                  </button>
                  <button onClick={() => setConfirmDelete(p)} className="text-xs font-medium text-signal-red hover:underline">
                    {t("action_delete")}
                  </button>
                </td>
              </tr>
            ))}
            {participants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-foreground/50">
                  Inga deltagare ännu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          title={editing === "new" ? t("participants_add") : t("action_edit")}
          onClose={() => setEditing(null)}
        >
          <ParticipantForm
            db={db}
            classes={classes}
            existing={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              notifyChange();
            }}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title={t("action_delete")} onClose={() => setConfirmDelete(null)}>
          <p className="mb-4 text-sm">{t("action_confirmDelete")}</p>
          <p className="mb-4 rounded bg-black/[0.03] px-3 py-2 text-sm">
            <span className="bib-badge mr-2">{confirmDelete.bib_number}</span>
            {confirmDelete.first_name} {confirmDelete.last_name}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="rounded px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-black/5">
              {t("action_cancel")}
            </button>
            <button
              onClick={() => {
                deleteParticipant(db, confirmDelete.id);
                setConfirmDelete(null);
                notifyChange();
              }}
              className="rounded bg-signal-red px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("action_delete")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
