import type { PropertyConfig, PropertyKind } from "~/lib/collections/types";

export type PropertyPreset = {
  key: string;
  label: string;
  kind: PropertyKind;
  config?: PropertyConfig;
};

/** What the "add property" menu offers: the kinds plus common formats. */
export const PROPERTY_PRESETS: PropertyPreset[] = [
  { key: "text", label: "Text", kind: "text", config: { format: "plain" } },
  { key: "number", label: "Number", kind: "number", config: { format: "plain" } },
  { key: "select", label: "Select", kind: "select" },
  { key: "status", label: "Status", kind: "status" },
  { key: "multi_select", label: "Multi-select", kind: "multi_select" },
  { key: "date", label: "Date", kind: "date" },
  { key: "checkbox", label: "Checkbox", kind: "checkbox" },
  { key: "url", label: "URL", kind: "text", config: { format: "url" } },
  { key: "email", label: "Email", kind: "text", config: { format: "email" } },
  { key: "phone", label: "Phone", kind: "text", config: { format: "phone" } },
  { key: "rating", label: "Rating", kind: "number", config: { format: "rating", ratingMax: 5 } },
  { key: "progress", label: "Progress", kind: "number", config: { format: "progress" } },
  { key: "currency", label: "Currency", kind: "number", config: { format: "currency", currency: "USD" } },
  { key: "created_time", label: "Created time", kind: "created_time" },
  { key: "updated_time", label: "Updated time", kind: "updated_time" },
];

export const TEXT_FORMAT_LABELS = { plain: "Plain text", url: "URL", email: "Email", phone: "Phone" } as const;
export const NUMBER_FORMAT_LABELS = {
  plain: "Number",
  decimal: "Decimal",
  percent: "Percent",
  currency: "Currency",
  rating: "Rating",
  progress: "Progress bar",
} as const;
