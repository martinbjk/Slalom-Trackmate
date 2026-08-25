import type { Database } from "sql.js";

interface ColumnInfo {
  name: string;
}

function addColumnIfMissing(db: Database, table: string, column: string, definition: string): void {
  const cols = db.exec(`PRAGMA table_info(${table})`);
  const existing = cols[0]?.values.map((row) => row[1] as string) ?? [];
  if (!existing.includes(column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Adds any columns introduced after a user's database was first created.
 * Safe to run every time the app starts — each check is a no-op once the
 * column already exists. Never touches or deletes existing data.
 */
export function runMigrations(db: Database): void {
  addColumnIfMissing(db, "classes", "discipline", "TEXT NOT NULL DEFAULT 'TS'");
  addColumnIfMissing(db, "classes", "cone_penalty_ms", "INTEGER NOT NULL DEFAULT 100");
  addColumnIfMissing(db, "results", "cones_displaced", "INTEGER NOT NULL DEFAULT 0");
}
