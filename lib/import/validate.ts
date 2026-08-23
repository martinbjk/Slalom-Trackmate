import type { ColumnMapping, ImportRow, Participant, ValidationIssue } from "../types";

const REQUIRED_FIELDS: (keyof Participant)[] = [
  "first_name",
  "last_name",
  "country",
  "class_id",
  "birth_year",
  "gender",
  "bib_number",
];

const VALID_GENDERS = new Set(["M", "F", "O"]);
const VALID_STATUS = new Set(["active", "DNS", "DSQ", "DNF"]);
const CURRENT_YEAR = new Date().getFullYear();

/** Best-effort auto-guess of a column mapping based on common header names in sv/en/es/pt. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const guesses: Record<string, keyof Participant> = {
    firstname: "first_name", förnamn: "first_name", nombre: "first_name", primeiro: "first_name", "first name": "first_name",
    lastname: "last_name", efternamn: "last_name", apellido: "last_name", sobrenome: "last_name", "last name": "last_name",
    country: "country", land: "country", pais: "country", país: "country",
    class: "class_id", klass: "class_id", categoria: "class_id", categoría: "class_id",
    birthyear: "birth_year", födelseår: "birth_year", "birth year": "birth_year", "año de nacimiento": "birth_year", "ano de nascimento": "birth_year",
    gender: "gender", kön: "gender", genero: "gender", género: "gender", genero_pt: "gender",
    club: "club", klubb: "club", clube: "club",
    bib: "bib_number", bibnumber: "bib_number", startnummer: "bib_number", "bib number": "bib_number", numero: "bib_number", número: "bib_number",
    status: "status",
  };
  const mapping: ColumnMapping = {};
  for (const h of headers) {
    const key = h.toLowerCase().trim();
    mapping[h] = guesses[key] ?? "";
  }
  return mapping;
}

export function buildImportRows(
  rawRows: Record<string, string>[],
  mapping: ColumnMapping,
  existingBibs: Set<number>
): ImportRow[] {
  const seenBibsInBatch = new Set<number>();

  return rawRows.map((raw, index) => {
    const issues: ValidationIssue[] = [];
    const mapped: Partial<Participant> = {};

    for (const [column, field] of Object.entries(mapping)) {
      if (!field) continue;
      const value = (raw[column] ?? "").trim();

      switch (field) {
        case "birth_year": {
          const year = parseInt(value, 10);
          if (Number.isNaN(year) || year < 1930 || year > CURRENT_YEAR) {
            issues.push({ row: index, field, message: `Ogiltigt födelseår: "${value}"`, severity: "error" });
          } else {
            mapped.birth_year = year;
          }
          break;
        }
        case "bib_number": {
          const bib = parseInt(value, 10);
          if (Number.isNaN(bib) || bib <= 0) {
            issues.push({ row: index, field, message: `Ogiltigt startnummer: "${value}"`, severity: "error" });
          } else if (existingBibs.has(bib)) {
            issues.push({ row: index, field, message: `Startnummer ${bib} finns redan i databasen`, severity: "error" });
          } else if (seenBibsInBatch.has(bib)) {
            issues.push({ row: index, field, message: `Startnummer ${bib} är dubblett inom importfilen`, severity: "error" });
          } else {
            seenBibsInBatch.add(bib);
            mapped.bib_number = bib;
          }
          break;
        }
        case "gender": {
          const g = value.toUpperCase().charAt(0);
          if (!VALID_GENDERS.has(g)) {
            issues.push({ row: index, field, message: `Okänt kön: "${value}" (förväntar M/F/O)`, severity: "error" });
          } else {
            mapped.gender = g as Participant["gender"];
          }
          break;
        }
        case "status": {
          const s = value || "active";
          if (!VALID_STATUS.has(s)) {
            issues.push({ row: index, field, message: `Okänd status: "${value}"`, severity: "warning" });
            mapped.status = "active";
          } else {
            mapped.status = s as Participant["status"];
          }
          break;
        }
        default:
          (mapped as Record<string, unknown>)[field] = value;
      }
    }

    for (const field of REQUIRED_FIELDS) {
      const val = mapped[field];
      if (val === undefined || val === null || val === "") {
        issues.push({ row: index, field, message: `Obligatoriskt fält saknas: ${field}`, severity: "error" });
      }
    }

    if (!mapped.status) mapped.status = "active";
    if (!mapped.club) mapped.club = "";

    return { rowIndex: index, raw, mapped, issues };
  });
}
