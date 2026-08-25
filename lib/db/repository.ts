import type { Database } from "sql.js";
import { v4 as uuid } from "uuid";
import { execWrite, queryAll } from "./database";
import type { CompClass, Heat, Participant, Result } from "../types";
import { DEFAULT_CONE_PENALTY_MS, computeResultantTimeMs } from "../conePenalty";

const nowIso = () => new Date().toISOString();

// ---------- Classes ----------

export function listClasses(db: Database): CompClass[] {
  return queryAll<CompClass>(db, "SELECT * FROM classes ORDER BY name");
}

export function upsertClass(db: Database, c: Partial<CompClass> & { name: string }): CompClass {
  const id = c.id ?? uuid();
  const discipline = c.discipline ?? "TS";
  const conePenaltyMs = c.cone_penalty_ms ?? DEFAULT_CONE_PENALTY_MS[discipline];
  execWrite(
    db,
    `INSERT INTO classes (id, name, gender, age_group, discipline, cone_penalty_ms) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, gender=excluded.gender, age_group=excluded.age_group, discipline=excluded.discipline, cone_penalty_ms=excluded.cone_penalty_ms`,
    [id, c.name, c.gender ?? "MIXED", c.age_group ?? "", discipline, conePenaltyMs]
  );
  return { id, name: c.name, gender: c.gender ?? "MIXED", age_group: c.age_group ?? "", discipline, cone_penalty_ms: conePenaltyMs };
}

export function deleteClass(db: Database, id: string): void {
  execWrite(db, "DELETE FROM classes WHERE id = ?", [id]);
}

// ---------- Participants ----------

export function listParticipants(db: Database, search = ""): Participant[] {
  if (!search.trim()) {
    return queryAll<Participant>(
      db,
      "SELECT * FROM participants ORDER BY bib_number ASC"
    );
  }
  const like = `%${search.toLowerCase()}%`;
  return queryAll<Participant>(
    db,
    `SELECT * FROM participants
     WHERE lower(first_name) LIKE ? OR lower(last_name) LIKE ? OR lower(club) LIKE ? OR lower(country) LIKE ? OR CAST(bib_number AS TEXT) LIKE ?
     ORDER BY bib_number ASC`,
    [like, like, like, like, like]
  );
}

export function findDuplicateBib(db: Database, bib: number, excludeId?: string): Participant | null {
  const rows = queryAll<Participant>(
    db,
    "SELECT * FROM participants WHERE bib_number = ? AND id != ?",
    [bib, excludeId ?? ""]
  );
  return rows[0] ?? null;
}

export function createParticipant(db: Database, p: Omit<Participant, "id" | "created_at" | "updated_at">): Participant {
  const id = uuid();
  const ts = nowIso();
  execWrite(
    db,
    `INSERT INTO participants
     (id, first_name, last_name, country, class_id, birth_year, gender, club, bib_number, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, p.first_name, p.last_name, p.country, p.class_id, p.birth_year, p.gender, p.club, p.bib_number, p.status, ts, ts]
  );
  return { ...p, id, created_at: ts, updated_at: ts };
}

export function updateParticipant(db: Database, p: Participant): void {
  const ts = nowIso();
  execWrite(
    db,
    `UPDATE participants SET first_name=?, last_name=?, country=?, class_id=?, birth_year=?, gender=?, club=?, bib_number=?, status=?, updated_at=?
     WHERE id = ?`,
    [p.first_name, p.last_name, p.country, p.class_id, p.birth_year, p.gender, p.club, p.bib_number, p.status, ts, p.id]
  );
}

export function deleteParticipant(db: Database, id: string): void {
  execWrite(db, "DELETE FROM participants WHERE id = ?", [id]);
}

// ---------- Heats & start lists ----------

export function listHeats(db: Database, classId?: string): Heat[] {
  const heatRows = queryAll<{ id: string; class_id: string; heat_number: number }>(
    db,
    classId
      ? "SELECT id, class_id, heat_number FROM heats WHERE class_id = ? ORDER BY heat_number"
      : "SELECT id, class_id, heat_number FROM heats ORDER BY class_id, heat_number",
    classId ? [classId] : []
  );
  return heatRows.map((h) => ({
    ...h,
    participant_ids: queryAll<{ participant_id: string }>(
      db,
      "SELECT participant_id FROM heat_participants WHERE heat_id = ? ORDER BY start_order",
      [h.id]
    ).map((r) => r.participant_id),
  }));
}

/** Regenerates start lists for a class: clears existing heats and re-splits participants into heats of `heatSize`. */
export function generateStartList(db: Database, classId: string, heatSize: number): Heat[] {
  const participants = queryAll<Participant>(
    db,
    "SELECT * FROM participants WHERE class_id = ? AND status = 'active' ORDER BY bib_number",
    [classId]
  );

  execWrite(db, "DELETE FROM heat_participants WHERE heat_id IN (SELECT id FROM heats WHERE class_id = ?)", [classId]);
  execWrite(db, "DELETE FROM heats WHERE class_id = ?", [classId]);

  const heats: Heat[] = [];
  let heatNumber = 1;
  for (let i = 0; i < participants.length; i += heatSize) {
    const chunk = participants.slice(i, i + heatSize);
    const heatId = uuid();
    execWrite(db, "INSERT INTO heats (id, class_id, heat_number) VALUES (?, ?, ?)", [heatId, classId, heatNumber]);
    chunk.forEach((p, idx) => {
      execWrite(
        db,
        "INSERT INTO heat_participants (heat_id, participant_id, start_order) VALUES (?, ?, ?)",
        [heatId, p.id, idx + 1]
      );
    });
    heats.push({ id: heatId, class_id: classId, heat_number: heatNumber, participant_ids: chunk.map((p) => p.id) });
    heatNumber += 1;
  }
  return heats;
}

// ---------- Results ----------

export function listResultsForHeat(db: Database, heatId: string): Result[] {
  return queryAll<Result>(db, "SELECT * FROM results WHERE heat_id = ?", [heatId]);
}

export function upsertResult(db: Database, r: Omit<Result, "id" | "updated_at" | "cones_displaced"> & { id?: string; cones_displaced?: number }): void {
  const ts = nowIso();
  const id = r.id ?? uuid();
  const cones = r.cones_displaced ?? 0;
  execWrite(
    db,
    `INSERT INTO results (id, participant_id, heat_id, time_ms, cones_displaced, rank, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(participant_id, heat_id) DO UPDATE SET time_ms=excluded.time_ms, cones_displaced=excluded.cones_displaced, status=excluded.status, updated_at=excluded.updated_at`,
    [id, r.participant_id, r.heat_id, r.time_ms, cones, r.rank, r.status, ts]
  );
  recomputeRanking(db, r.heat_id);
}

/**
 * Recomputes rank within a heat using the RESULTANT time (raw time + cone
 * penalty), per World Skate rules 6.1: RT = ET + (Cones Displaced × Penalty).
 * The cone penalty is looked up from the participant's class.
 */
export function recomputeRanking(db: Database, heatId: string): void {
  const rows = queryAll<Result & { cone_penalty_ms: number }>(
    db,
    `SELECT r.*, c.cone_penalty_ms as cone_penalty_ms
     FROM results r
     JOIN participants p ON p.id = r.participant_id
     JOIN classes c ON c.id = p.class_id
     WHERE r.heat_id = ? AND r.status = 'active' AND r.time_ms IS NOT NULL`,
    [heatId]
  );
  const ranked = rows
    .map((row) => ({ ...row, resultant: computeResultantTimeMs(row.time_ms as number, row.cones_displaced, row.cone_penalty_ms) }))
    .sort((a, b) => a.resultant - b.resultant);

  ranked.forEach((row, idx) => {
    execWrite(db, "UPDATE results SET rank = ? WHERE id = ?", [idx + 1, row.id]);
  });
  execWrite(
    db,
    "UPDATE results SET rank = NULL WHERE heat_id = ? AND (status != 'active' OR time_ms IS NULL)",
    [heatId]
  );
}
