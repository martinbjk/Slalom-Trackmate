"use client";

import initSqlJs, { Database, SqlJsStatic, SqlValue } from "sql.js";
import { SCHEMA_SQL } from "./schema";
import { idbLoadBlob, idbSaveBlob } from "./idb-blob-store";
import { BASE_PATH } from "../basePath";

const PERSIST_KEY = "main-db";

let sqlModule: SqlJsStatic | null = null;
let dbInstance: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initializes (or loads) the local SQLite database. Safe to call multiple
 * times — subsequent calls return the same in-memory instance.
 *
 * All data lives in the browser: the .wasm SQLite engine runs entirely
 * client-side, and the resulting database file is persisted to IndexedDB.
 * No network request is made after the first page load (the wasm binary is
 * cached by the service worker for offline use).
 */
export async function getDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: (file: string) => `${BASE_PATH}/${file}`,
    });
  }

  const existing = await idbLoadBlob(PERSIST_KEY);
  dbInstance = existing ? new sqlModule.Database(existing) : new sqlModule.Database();
  dbInstance.run(SCHEMA_SQL);

  if (!existing) {
    await persistNow(dbInstance);
  }

  return dbInstance;
}

async function persistNow(db: Database): Promise<void> {
  const bytes = db.export();
  await idbSaveBlob(PERSIST_KEY, bytes);
}

/**
 * Schedules a debounced save to IndexedDB. Call this after every write so
 * data survives a closed tab/browser, without serializing the whole database
 * on every single keystroke.
 */
export function scheduleSave(): void {
  if (!dbInstance) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (dbInstance) void persistNow(dbInstance);
  }, 400);
}

/** Forces an immediate save — used before generating a backup file or navigating away. */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (dbInstance) await persistNow(dbInstance);
}

/** Returns the raw database bytes for a manual "download backup" action. */
export async function exportDatabaseFile(): Promise<Uint8Array> {
  await flushSave();
  const db = await getDatabase();
  return db.export();
}

/**
 * Replaces the entire working database with the contents of a backup file.
 * This is a destructive restore — callers must confirm with the user first.
 */
export async function restoreDatabaseFromFile(bytes: Uint8Array): Promise<void> {
  if (!sqlModule) {
    sqlModule = await initSqlJs({ locateFile: (file: string) => `${BASE_PATH}/${file}` });
  }
  if (dbInstance) dbInstance.close();
  dbInstance = new sqlModule.Database(bytes);
  dbInstance.run(SCHEMA_SQL); // ensure schema is present even if restoring an older/partial file
  await persistNow(dbInstance);
}

/** Generic SELECT helper — returns rows as plain objects keyed by column name. */
export function queryAll<T = Record<string, SqlValue>>(
  db: Database,
  sql: string,
  params: SqlValue[] = []
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

/** Generic INSERT/UPDATE/DELETE helper. Schedules a debounced persist. */
export function execWrite(db: Database, sql: string, params: SqlValue[] = []): void {
  db.run(sql, params);
  scheduleSave();
}
