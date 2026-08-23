export type ParticipantStatus = "active" | "DNS" | "DSQ" | "DNF";
export type Gender = "M" | "F" | "O";

export interface Participant {
  id: string;
  first_name: string;
  last_name: string;
  country: string; // ISO 3166-1 alpha-3, e.g. "SWE", "BRA", "ARG"
  class_id: string;
  birth_year: number;
  gender: Gender;
  club: string;
  bib_number: number;
  status: ParticipantStatus;
  created_at: string;
  updated_at: string;
}

export interface CompClass {
  id: string;
  name: string;
  gender: Gender | "MIXED";
  age_group: string;
}

export interface Heat {
  id: string;
  class_id: string;
  heat_number: number;
  participant_ids: string[];
}

export interface Result {
  id: string;
  participant_id: string;
  heat_id: string;
  time_ms: number | null; // null when status is not "active"
  rank: number | null;
  status: ParticipantStatus;
  updated_at: string;
}

export interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportRow {
  rowIndex: number;
  raw: Record<string, string>;
  mapped: Partial<Participant>;
  issues: ValidationIssue[];
}

export type ColumnMapping = Record<string, keyof Participant | "">;

export type Locale = "sv" | "en" | "es" | "pt";
