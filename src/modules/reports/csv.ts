// CSV for Excel and Google Sheets: UTF-8 with a BOM (else Excel shows "Phá»Ÿ" for "Phở"), CRLF
// line ends, RFC 4180 quoting. Text that a spreadsheet would run as a formula gets a leading '.

// = + - @ start a formula; tab and CR do too in some spreadsheet apps (OWASP "CSV injection").
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number) {
  if (typeof value === "number") return String(value); // our numbers are VND or counts, never formulas
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const toCsv = (rows: (string | number)[][]) =>
  "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
