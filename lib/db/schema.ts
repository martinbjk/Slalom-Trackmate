// SQLite schema. Kept intentionally simple and normalized so it can be
// exported as a single .sqlite file and opened in any standard SQLite tool
// (e.g. DB Browser for SQLite) for manual inspection or emergency recovery.

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('M','F','O','MIXED')),
  age_group TEXT NOT NULL DEFAULT '',
  discipline TEXT NOT NULL DEFAULT 'TS',
  cone_penalty_ms INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  birth_year INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('M','F','O')),
  club TEXT NOT NULL DEFAULT '',
  bib_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','DNS','DSQ','DNF')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(bib_number)
);

CREATE INDEX IF NOT EXISTS idx_participants_class ON participants(class_id);
CREATE INDEX IF NOT EXISTS idx_participants_name ON participants(last_name, first_name);

CREATE TABLE IF NOT EXISTS heats (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  heat_number INTEGER NOT NULL,
  UNIQUE(class_id, heat_number)
);

CREATE TABLE IF NOT EXISTS heat_participants (
  heat_id TEXT NOT NULL REFERENCES heats(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  start_order INTEGER NOT NULL,
  PRIMARY KEY (heat_id, participant_id)
);

CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  heat_id TEXT NOT NULL REFERENCES heats(id) ON DELETE CASCADE,
  time_ms INTEGER,
  cones_displaced INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','DNS','DSQ','DNF')),
  updated_at TEXT NOT NULL,
  UNIQUE(participant_id, heat_id)
);

CREATE TABLE IF NOT EXISTS backups_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
`;
