// Reads one career-history collection row (Person URL, Company, Role, Start
// month, End month, Employment, Location, Source URL, Checked) into a role
// record. Values stay as precise as the row: a month stays a month and
// "Present" is a claim observed on the Checked day, not an end date.
import { isPartialDate, type RoleStatus } from "./career-periods";
import { isRealDay } from "./dates";

export type CareerRecord = {
  rowId: string;
  personId: string;
  company: string;
  role: string | null;
  startOn: string | null;
  endOn: string | null;
  status: RoleStatus;
  location: string | null;
  sourceUrl: string | null;
  observedOn: string | null;
  /** Stable identity of the source profile, e.g. "brian-rhode-116324b". */
  profileKey: string | null;
};

export const CAREER_ROW_SOURCE = "career-collection";
export const LINKEDIN_SOURCE = "linkedin";

/** The stable role key for a collection row. */
export const careerRowKey = (rowId: string) => `${CAREER_ROW_SOURCE}:${rowId}`;

const blank = (v: string | undefined) => v?.trim() || null;

/** The profile id from a Visual Notes People URL. */
export function personIdFromUrl(url: string | null): string | null {
  const m = url && /\/people\/([a-z0-9]+)\/?(?:[?#].*)?$/i.exec(url);
  return m ? m[1] : null;
}

/** The LinkedIn profile slug from any linkedin.com/in/<slug>/... URL. */
export function linkedinKey(url: string | null): string | null {
  const m = url && /linkedin\.com\/in\/([^/?#]+)/i.exec(url);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

/**
 * One row to a record, or the reason it cannot be read. `values` are the
 * row's property values as text by property name; Checked may be YYYY-MM-DD.
 */
export function parseCareerRow(
  rowId: string,
  values: Record<string, string | undefined>,
): { record: CareerRecord } | { problem: string } {
  const personId = personIdFromUrl(blank(values["Person URL"]));
  if (!personId) return { problem: "Person URL does not name a People profile" };
  const company = blank(values["Company"]);
  if (!company) return { problem: "No company" };
  const start = blank(values["Start month"]);
  const endText = blank(values["End month"]);
  const present = !!endText && /^present$/i.test(endText);
  const end = present ? null : endText;
  for (const v of [start, end])
    if (v && !isPartialDate(v))
      return { problem: `Date "${v}" is not YYYY, YYYY-MM, or YYYY-MM-DD` };
  const employment = blank(values["Employment"])?.toLowerCase();
  const status: RoleStatus =
    present || employment === "current"
      ? "current"
      : end || employment === "past"
        ? "ended"
        : "unknown";
  if (status === "current" && end)
    return { problem: "Marked current but has an end month" };
  const checked = blank(values["Checked"]);
  const sourceUrl = blank(values["Source URL"]);
  return {
    record: {
      rowId,
      personId,
      company,
      role: blank(values["Role"]),
      startOn: start,
      endOn: end,
      status,
      location: blank(values["Location"]),
      sourceUrl,
      observedOn: checked && isRealDay(checked) ? checked : null,
      profileKey: linkedinKey(sourceUrl),
    },
  };
}
