// Contact methods. The original value is always kept; matchValue is only a
// conservative key for finding duplicate candidates. Phone numbers keep their
// country code only when one was typed; URLs keep their path.

export const CONTACT_KINDS = [
  "email",
  "phone",
  "url",
  "social",
  "address",
  "other",
] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  email: "Email",
  phone: "Phone",
  url: "Website",
  social: "Social profile",
  address: "Address",
  other: "Other",
};

export function contactMatchValue(kind: ContactKind, value: string): string {
  const v = value.trim();
  switch (kind) {
    case "email":
      return v.toLowerCase();
    case "phone": {
      const digits = v.replace(/[^\d]/g, "");
      return v.startsWith("+") ? `+${digits}` : digits;
    }
    case "url":
    case "social":
      return v
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/[?#].*$/, "")
        .replace(/\/+$/, "");
    default:
      return v.toLowerCase().replace(/\s+/g, " ");
  }
}

/** A clickable href for a contact, or null when it is not a link. */
export function contactHref(kind: ContactKind, value: string): string | null {
  const v = value.trim();
  if (kind === "email") return `mailto:${v}`;
  if (kind === "phone") return `tel:${v.replace(/[^\d+]/g, "")}`;
  if (kind === "url" || kind === "social") {
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }
  return null;
}
