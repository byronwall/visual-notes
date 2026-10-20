import type { CollectionProperty, PropertyValue, RowProperties } from "./types";
import {
  coerceValue,
  isComputedKind,
  optionByName,
  parseLooseText,
} from "./values";

const norm = (s: string) => s.trim().toLowerCase();

export type MappedValues = {
  values: RowProperties;
  /** Option names to create, per property id, before saving `values`. */
  newOptions: Record<string, string[]>;
  /** Names of properties that received a value. */
  carried: string[];
  /** Names of source fields that had a value but no home. */
  dropped: string[];
};

const empty = (): MappedValues => ({
  values: {},
  newOptions: {},
  carried: [],
  dropped: [],
});

/** Maps a note's loose `meta` key/values onto properties whose names match (case-insensitive). */
export function mapMetaToProperties(
  meta: Record<string, unknown> | null | undefined,
  properties: CollectionProperty[],
): MappedValues {
  const out = empty();
  if (!meta) return out;
  const byName = new Map(
    properties
      .filter((p) => !isComputedKind(p.kind))
      .map((p) => [norm(p.name), p]),
  );
  for (const [key, raw] of Object.entries(meta)) {
    if (raw === null || raw === undefined || raw === "") continue;
    const property = byName.get(norm(key));
    if (!property) {
      out.dropped.push(key);
      continue;
    }
    const parsed = parseLooseText(property, String(raw));
    if (parsed.failed) {
      out.dropped.push(key);
      continue;
    }
    if (parsed.newOptions.length)
      out.newOptions[property.id] = parsed.newOptions;
    if (parsed.value !== null || parsed.newOptions.length) {
      if (parsed.value !== null) out.values[property.id] = parsed.value;
      out.carried.push(property.name);
    }
  }
  return out;
}

/**
 * Maps values from one collection's schema to another's by property name,
 * converting between kinds where possible. Options are matched by name.
 */
export function mapBetweenCollections(
  from: CollectionProperty[],
  to: CollectionProperty[],
  values: RowProperties,
): MappedValues {
  const out = empty();
  const targets = new Map(
    to.filter((p) => !isComputedKind(p.kind)).map((p) => [norm(p.name), p]),
  );
  for (const source of from) {
    const value = values[source.id];
    if (value === null || value === undefined) continue;
    const target = targets.get(norm(source.name));
    if (!target) {
      out.dropped.push(source.name);
      continue;
    }
    const selectLike = (k: string) =>
      k === "select" || k === "status" || k === "multi_select";
    if (selectLike(source.kind) && selectLike(target.kind)) {
      // Option ids differ between collections; carry by option name.
      const ids = Array.isArray(value) ? (value as string[]) : [String(value)];
      const names = ids
        .map((id) => source.config.options?.find((o) => o.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      const parsed = parseLooseText(target, names.join(", "));
      if (parsed.newOptions.length)
        out.newOptions[target.id] = parsed.newOptions;
      const mapped =
        target.kind === "multi_select" ? parsed.value : parsed.value ?? null;
      if (mapped !== null)
        out.values[target.id] =
          Array.isArray(mapped) && target.kind !== "multi_select"
            ? mapped[0]!
            : mapped;
      out.carried.push(target.name);
      continue;
    }
    const result = coerceValue(source, target, value);
    if (result.lost && result.value === null && !result.newOptions.length) {
      out.dropped.push(source.name);
      continue;
    }
    if (result.newOptions.length) out.newOptions[target.id] = result.newOptions;
    if (result.value !== null)
      out.values[target.id] = result.value as PropertyValue;
    out.carried.push(target.name);
  }
  return out;
}

/** Resolves option names created after mapping into the ids they now have. */
export function resolveNewOptions(
  mapped: MappedValues,
  properties: CollectionProperty[],
): RowProperties {
  const values = { ...mapped.values };
  for (const [propertyId, names] of Object.entries(mapped.newOptions)) {
    const property = properties.find((p) => p.id === propertyId);
    if (!property) continue;
    const ids = names
      .map((n) => optionByName(property.config, n)?.id)
      .filter((id): id is string => Boolean(id));
    if (!ids.length) continue;
    if (property.kind === "multi_select") {
      const existing = Array.isArray(values[propertyId])
        ? (values[propertyId] as string[])
        : [];
      values[propertyId] = [...new Set([...existing, ...ids])];
    } else if (values[propertyId] === undefined) {
      values[propertyId] = ids[0]!;
    }
  }
  return values;
}
