import ExcelJS from "exceljs";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Participant } from "../types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const PARTICIPANT_COLUMNS: { key: keyof Participant; header: string }[] = [
  { key: "bib_number", header: "Bib" },
  { key: "first_name", header: "First name" },
  { key: "last_name", header: "Last name" },
  { key: "country", header: "Country" },
  { key: "class_id", header: "Class" },
  { key: "birth_year", header: "Birth year" },
  { key: "gender", header: "Gender" },
  { key: "club", header: "Club" },
  { key: "status", header: "Status" },
];

export function exportParticipantsCsv(participants: Participant[], filename = "deltagare.csv") {
  const rows = participants.map((p) =>
    Object.fromEntries(PARTICIPANT_COLUMNS.map((c) => [c.header, p[c.key]]))
  );
  // BOM ensures Excel on Windows opens UTF-8 (åäö, ñ, ã, ç) correctly instead of mangling it.
  const csv = "\uFEFF" + Papa.unparse(rows);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

export async function exportParticipantsXlsx(participants: Participant[], filename = "deltagare.xlsx") {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Deltagare");
  sheet.columns = PARTICIPANT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 16 }));
  participants.forEach((p) => sheet.addRow(p));
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export function exportStartListPdf(
  title: string,
  heatLabel: string,
  rows: { bib: number; name: string; country: string; club: string }[],
  filename = "startlista.pdf"
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(11);
  doc.text(heatLabel, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [["Bib", "Namn", "Land", "Klubb"]],
    body: rows.map((r) => [String(r.bib), r.name, r.country, r.club]),
  });
  doc.save(filename);
}

export function exportResultsPdf(
  title: string,
  heatLabel: string,
  rows: { rank: string; bib: number; name: string; time: string; cones: number; status: string }[],
  filename = "resultat.pdf"
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(11);
  doc.text(heatLabel, 14, 24);
  autoTable(doc, {
    startY: 30,
    head: [["Placering", "Bib", "Namn", "Sluttid", "Koner", "Status"]],
    body: rows.map((r) => [r.rank, String(r.bib), r.name, r.time, String(r.cones), r.status]),
  });
  doc.save(filename);
}
