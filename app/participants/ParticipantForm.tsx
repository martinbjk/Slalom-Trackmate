"use client";

import { useState } from "react";
import type { Database } from "sql.js";
import type { CompClass, Gender, Participant, ParticipantStatus } from "@/lib/types";
import { createParticipant, findDuplicateBib, updateParticipant } from "@/lib/db/repository";
import { useT } from "@/lib/i18n/LocaleProvider";

const GENDERS: Gender[] = ["M", "F", "O"];
const STATUSES: ParticipantStatus[] = ["active", "DNS", "DSQ", "DNF"];

export function ParticipantForm({
  db,
  classes,
  existing,
  onDone,
}: {
  db: Database;
  classes: CompClass[];
  existing: Participant | null;
  onDone: () => void;
}) {
  const { t } = useT();
  const [firstName, setFirstName] = useState(existing?.first_name ?? "");
  const [lastName, setLastName] = useState(existing?.last_name ?? "");
  const [country, setCountry] = useState(existing?.country ?? "");
  const [classId, setClassId] = useState(existing?.class_id ?? classes[0]?.id ?? "");
  const [birthYear, setBirthYear] = useState(String(existing?.birth_year ?? ""));
  const [gender, setGender] = useState<Gender>(existing?.gender ?? "M");
  const [club, setClub] = useState(existing?.club ?? "");
  const [bib, setBib] = useState(String(existing?.bib_number ?? ""));
  const [status, setStatus] = useState<ParticipantStatus>(existing?.status ?? "active");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const bibNum = parseInt(bib, 10);
    const yearNum = parseInt(birthYear, 10);

    if (!firstName.trim() || !lastName.trim() || !country.trim() || !classId || !bibNum || !yearNum) {
      setError(t("error_required"));
      return;
    }
    const dup = findDuplicateBib(db, bibNum, existing?.id);
    if (dup) {
      setError(t("error_bibTaken"));
      return;
    }

    if (existing) {
      updateParticipant(db, {
        ...existing,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        country: country.trim().toUpperCase(),
        class_id: classId,
        birth_year: yearNum,
        gender,
        club: club.trim(),
        bib_number: bibNum,
        status,
      });
    } else {
      createParticipant(db, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        country: country.trim().toUpperCase(),
        class_id: classId,
        birth_year: yearNum,
        gender,
        club: club.trim(),
        bib_number: bibNum,
        status,
      });
    }
    onDone();
  };

  const inputClass =
    "w-full rounded border border-line bg-white px-3 py-2 text-sm focus:border-cone focus:outline-none focus:ring-1 focus:ring-cone";
  const labelClass = "mb-1 block text-xs font-medium text-foreground/70";

  return (
    <div className="space-y-3">
      {error && <p className="rounded bg-signal-red/10 px-3 py-2 text-sm text-signal-red">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("field_firstName")}</label>
          <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className={labelClass}>{t("field_lastName")}</label>
          <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>{t("field_country")}</label>
          <input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="BRA" maxLength={3} />
        </div>
        <div>
          <label className={labelClass}>{t("field_birthYear")}</label>
          <input className={inputClass} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label className={labelClass}>{t("field_gender")}</label>
          <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("field_class")}</label>
          <select className={inputClass} value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t("field_club")}</label>
          <input className={inputClass} value={club} onChange={(e) => setClub(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("field_bib")}</label>
          <input className={inputClass} value={bib} onChange={(e) => setBib(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label className={labelClass}>{t("field_status")}</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ParticipantStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onDone} className="rounded px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-black/5">
          {t("action_cancel")}
        </button>
        <button onClick={submit} className="rounded bg-cone px-4 py-2 text-sm font-semibold text-white hover:bg-cone-dark">
          {t("action_save")}
        </button>
      </div>
    </div>
  );
}
