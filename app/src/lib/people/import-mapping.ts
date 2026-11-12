// Turns CSV rows into People import records: which column feeds which field,
// a guess from common export headers, and the stable key for repeat imports.
import { contactMatchValue } from "./contacts";

export const IMPORT_FIELDS = [
  "externalKey",
  "displayName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "url",
  "organization",
  "role",
  "location",
  "contexts",
  "summary",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  externalKey: "Stable id",
  displayName: "Full name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  url: "Profile URL",
  organization: "Organization",
  role: "Role",
  location: "Location",
  contexts: "Contexts",
  summary: "Summary",
};

/** Column header for each mapped field; unmapped fields are absent. */
export type ImportMapping = Partial<Record<ImportField, string>>;

const GUESSES: [ImportField, RegExp][] = [
  ["externalKey", /^(id|contact id|uid|external id|resource name)$/i],
  ["displayName", /^(name|full name|display name)$/i],
  ["firstName", /^(first name|given name|first)$/i],
  ["lastName", /^(last name|family name|surname|last)$/i],
  ["email", /^(e-?mail( address)?|e-mail 1 - value|email 1)$/i],
  ["phone", /^(phone( number)?|mobile|phone 1 - value|cell)$/i],
  ["url", /^(url|profile url|linkedin|linkedin url|website)$/i],
  [
    "organization",
    /^(company|organization|organisation|employer|organization 1 - name)$/i,
  ],
  ["role", /^(position|title|job title|role|organization 1 - title)$/i],
  ["location", /^(location|city|address)$/i],
  ["contexts", /^(contexts?|labels|groups|tags)$/i],
  ["summary", /^(notes?|summary|description)$/i],
];

/** Guesses a mapping from header names (LinkedIn, Google, and plain exports). */
export function guessMapping(headers: string[]): ImportMapping {
  const out: ImportMapping = {};
  for (const [field, re] of GUESSES) {
    const header = headers.find((h) => re.test(h.trim()));
    if (header) out[field] = header;
  }
  return out;
}

export type ImportRecord = {
  rowIndex: number;
  /** Stable source key, from the id column or derived from email / URL. */
  sourceKey: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  url: string | null;
  organization: string | null;
  role: string | null;
  location: string | null;
  contexts: string[];
  summary: string | null;
};

/** Maps one row; empty cells become null and never clear existing data. */
export function toImportRecord(
  headers: string[],
  row: string[],
  rowIndex: number,
  mapping: ImportMapping,
): ImportRecord {
  const get = (field: ImportField) => {
    const header = mapping[field];
    if (!header) return null;
    const v = row[headers.indexOf(header)]?.trim();
    return v ? v : null;
  };
  const name =
    get("displayName") ??
    [get("firstName"), get("lastName")].filter(Boolean).join(" ");
  const email = get("email");
  const url = get("url");
  const key = get("externalKey");
  return {
    rowIndex,
    sourceKey: key
      ? `id:${key}`
      : email
        ? `email:${contactMatchValue("email", email)}`
        : url
          ? `url:${contactMatchValue("url", url)}`
          : null,
    displayName: name.trim(),
    email,
    phone: get("phone"),
    url,
    organization: get("organization"),
    role: get("role"),
    location: get("location"),
    contexts: (get("contexts") ?? "")
      .split(/[;,]/)
      .map((c) => c.trim())
      .filter(Boolean),
    summary: get("summary"),
  };
}
