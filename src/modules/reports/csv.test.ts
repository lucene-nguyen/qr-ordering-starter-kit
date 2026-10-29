import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, toCsv } from "./csv.ts";

test("a file starts with the UTF-8 BOM and every line ends with CRLF", () => {
  assert.equal(toCsv([["Dish", "Sold"], ["Phở bò tái", 5]]), "﻿Dish,Sold\r\nPhở bò tái,5\r\n");
});

test("commas, quotes and line breaks are quoted (RFC 4180)", () => {
  assert.equal(csvCell("Phở, large"), '"Phở, large"');
  assert.equal(csvCell('The "special"'), '"The ""special"""');
  assert.equal(csvCell("two\nlines"), '"two\nlines"');
  assert.equal(csvCell("plain"), "plain");
});

test("text a spreadsheet would run as a formula gets a leading '", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://evil\",\"Click\")"), "\"'=HYPERLINK(\"\"http://evil\"\",\"\"Click\"\")\"");
  assert.equal(csvCell("+1+1"), "'+1+1");
  assert.equal(csvCell("-2+3"), "'-2+3");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("\t=1"), "'\t=1");
  assert.equal(csvCell("Phở = love"), "Phở = love"); // only the first character matters
});

test("numbers are written as they are", () => {
  assert.equal(csvCell(65000), "65000");
  assert.equal(csvCell(0), "0");
});
