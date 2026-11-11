import type { CollectionProperty } from "~/lib/collections/types";
import { isComputedKind } from "~/lib/collections/values";

export const isRating = (property: CollectionProperty) =>
  property.kind === "number" && property.config.format === "rating";

/** Kinds that edit in a picker instead of in place. */
export const isPopoverKind = (property: CollectionProperty) =>
  property.kind === "select" ||
  property.kind === "status" ||
  property.kind === "multi_select" ||
  property.kind === "date";

/** Kinds typed straight into the value. */
export const isInlineKind = (property: CollectionProperty) =>
  (property.kind === "text" || property.kind === "number") &&
  !isRating(property);

/** Plain text, which may run to several lines. Links stay on one line. */
export const isPlainText = (property: CollectionProperty) =>
  property.kind === "text" && (property.config.format ?? "plain") === "plain";

/** What an empty field offers to do, so blank values still read as inputs. */
export const emptyPrompt = (property: CollectionProperty) => {
  if (isComputedKind(property.kind)) return "—";
  switch (property.kind) {
    case "select":
    case "status":
      return "Choose…";
    case "multi_select":
      return "Add…";
    case "date":
      return "Pick a date";
    case "number":
      return property.config.format === "currency"
        ? "Add amount"
        : "Add number";
    default:
      if (property.config.format === "url") return "Add link";
      if (property.config.format === "email") return "Add email";
      if (property.config.format === "phone") return "Add phone";
      return "Add text";
  }
};
