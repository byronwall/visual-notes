// Collection property values given by property name, as agents write them
// ("Category": "Comedy"), turned into stored values keyed by property id.
import type {
  CollectionProperty,
  PropertyValue,
} from "~/lib/collections/types";
import {
  optionByName,
  parseLooseText,
  validateValue,
} from "~/lib/collections/values";
import { loadLiveProperties } from "~/services/collections/collections.server";
import { ConnectorError } from "./notes-shared";

const optionNames = (p: CollectionProperty) =>
  (p.config.options ?? []).map((o) => o.name).join(", ") || "none";

/** Converts one agent-supplied value; select names resolve to option ids. */
export function toStoredValue(
  property: CollectionProperty,
  raw: unknown,
): PropertyValue {
  let value: unknown = raw;
  if (typeof raw === "string" && property.kind !== "text") {
    const parsed = parseLooseText(property, raw);
    if (parsed.newOptions.length)
      throw new ConnectorError(
        "invalid",
        `${property.name}: unknown option ${parsed.newOptions.map((n) => `"${n}"`).join(", ")}. Options: ${optionNames(property)}`,
      );
    if (parsed.failed)
      throw new ConnectorError(
        "invalid",
        `${property.name}: could not read "${raw}" as ${property.kind}`,
      );
    value = parsed.value;
  } else if (property.kind === "multi_select" && Array.isArray(raw)) {
    value = raw.map((name) => {
      const option =
        typeof name === "string"
          ? optionByName(property.config, name)
          : undefined;
      if (!option)
        throw new ConnectorError(
          "invalid",
          `${property.name}: unknown option "${String(name)}". Options: ${optionNames(property)}`,
        );
      return option.id;
    });
  }
  const result = validateValue(property, value);
  if (!result.ok) throw new ConnectorError("invalid", result.error);
  return result.value;
}

/** A patch keyed by property id from values keyed by property name. */
export async function rowPatchByName(
  collectionId: string,
  values: Record<string, unknown>,
): Promise<Record<string, PropertyValue>> {
  const properties = await loadLiveProperties(collectionId);
  const byName = new Map(
    properties.map((p) => [p.name.trim().toLowerCase(), p]),
  );
  const patch: Record<string, PropertyValue> = {};
  for (const [name, raw] of Object.entries(values)) {
    const property = byName.get(name.trim().toLowerCase());
    if (!property)
      throw new ConnectorError(
        "invalid",
        `Unknown property "${name}". Properties: ${properties.map((p) => p.name).join(", ") || "none"}`,
      );
    patch[property.id] = toStoredValue(property, raw);
  }
  return patch;
}
