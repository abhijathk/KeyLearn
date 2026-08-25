import { test } from "node:test";
import { deepEqual } from "rich-assert";
import { parseEmails } from "./BulkInvite.tsx";

// What a school secretary actually exports, rather than what a CSV
// specification says they should.

test("reads one address per line", () => {
  deepEqual(parseEmails("a@example.com\nb@example.com"), [
    { email: "a@example.com", line: 1 },
    { email: "b@example.com", line: 2 },
  ]);
});

test("skips the header row without shifting the row numbers", () => {
  // The whole point of the row number is that it matches the row in the
  // spreadsheet still open on the coordinator's screen. Skipping the
  // header and then calling the next line "row 1" makes the number worse
  // than no number at all.
  deepEqual(parseEmails("name,email,class\nPriya,p@example.com,Anju"), [
    { email: "p@example.com", line: 2 },
  ]);
});

test("keeps the line number across blank lines", () => {
  deepEqual(parseEmails("a@example.com\n\n\nb@example.com"), [
    { email: "a@example.com", line: 1 },
    { email: "b@example.com", line: 4 },
  ]);
});

test("finds the address in whichever column it is in", () => {
  deepEqual(parseEmails("Priya Nair,p@example.com,Anju Thomas"), [
    { email: "p@example.com", line: 1 },
  ]);
  deepEqual(parseEmails("p@example.com,Priya Nair"), [
    { email: "p@example.com", line: 1 },
  ]);
});

test("accepts semicolon and tab separated files", () => {
  deepEqual(parseEmails("Priya;p@example.com;Anju"), [
    { email: "p@example.com", line: 1 },
  ]);
  deepEqual(parseEmails("Priya\tp@example.com\tAnju"), [
    { email: "p@example.com", line: 1 },
  ]);
});

test("strips the quotes a spreadsheet adds", () => {
  deepEqual(parseEmails('"Nair, Priya","p@example.com"'), [
    { email: "p@example.com", line: 1 },
  ]);
});

test("survives Windows line endings", () => {
  deepEqual(parseEmails("a@example.com\r\nb@example.com\r\n"), [
    { email: "a@example.com", line: 1 },
    { email: "b@example.com", line: 2 },
  ]);
});

test("passes a malformed address through to be reported, not dropped", () => {
  // It contains an @, so the person meant it as an address. Silently
  // dropping it would leave a parent uninvited with nothing on screen
  // to explain why; the server says "not an address" against its row.
  deepEqual(parseEmails("Suresh K,suresh@@example,Anju"), [
    { email: "suresh@@example", line: 1 },
  ]);
});

test("ignores a line with no address at all", () => {
  deepEqual(parseEmails("Totals,,\nb@example.com"), [
    { email: "b@example.com", line: 2 },
  ]);
});

test("reads an empty file as nothing rather than failing", () => {
  deepEqual(parseEmails(""), []);
  deepEqual(parseEmails("\n\n"), []);
});
