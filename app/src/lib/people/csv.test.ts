import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { guessMapping, toImportRecord } from "./import-mapping";

describe("parseCsv", () => {
  it("reads quotes, embedded commas and newlines, CRLF, and a BOM", () => {
    const text =
      '﻿Name,Notes\r\n"Doe, Jane","Line one\nLine ""two"""\r\n\r\nSam,\r\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Notes"],
      ["Doe, Jane", 'Line one\nLine "two"'],
      ["Sam", ""],
    ]);
  });
});

describe("import mapping", () => {
  const headers = [
    "First Name",
    "Last Name",
    "URL",
    "Email Address",
    "Company",
    "Position",
    "Connected On",
  ];

  it("guesses a LinkedIn connections export", () => {
    expect(guessMapping(headers)).toEqual({
      firstName: "First Name",
      lastName: "Last Name",
      url: "URL",
      email: "Email Address",
      organization: "Company",
      role: "Position",
    });
  });

  it("derives a stable key and never invents values for empty cells", () => {
    const mapping = guessMapping(headers);
    const withEmail = toImportRecord(
      headers,
      ["Sam", "Q", "", "Sam@Example.com", "", "", ""],
      0,
      mapping,
    );
    expect(withEmail).toMatchObject({
      displayName: "Sam Q",
      sourceKey: "email:sam@example.com",
      organization: null,
    });
    const withUrl = toImportRecord(
      headers,
      ["Al", "B", "https://www.linkedin.com/in/al-b/", "", "Acme", "", ""],
      1,
      mapping,
    );
    expect(withUrl.sourceKey).toBe("url:linkedin.com/in/al-b");
    const none = toImportRecord(
      headers,
      ["Cy", "", "", "", "", "", ""],
      2,
      mapping,
    );
    expect(none.sourceKey).toBeNull();
  });
});
