// Translates between collections as stored (ids for properties and options)
// and as an agent talks about them (names and plain text), for the
// collection tools.
import { prisma } from "~/server/db";
import { operatorsFor, TITLE_PROPERTY, withTitle } from "~/lib/collections/query";
import type {
  FILTER_OPERATORS,
  CollectionProperty,
  CollectionRow,
  FilterCondition,
  FilterTree,
  PropertyValue,
  SortRule,
} from "~/lib/collections/types";
import {
  formatValueText,
  isComputedKind,
  optionByName,
  parseLooseText,
  readValue,
  validateValue,
} from "~/lib/collections/values";
import { loadLiveProperties } from "~/services/collections/collections.server";
import { ConnectorError } from "./notes-shared";

export type AgentFilter = { property: string; op: (typeof FILTER_OPERATORS)[number]; value?: unknown };
export type AgentSort = { property: string; direction?: "asc" | "desc" };

export async function resolveCollection(ref: string) {
  const value = ref.trim();
  const found =
    (await prisma.collection.findFirst({ where: { id: value, deletedAt: null } })) ??
    (await prisma.collection.findFirst({
      where: { name: { equals: value, mode: "insensitive" }, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    }));
  if (!found) throw new ConnectorError("not_found", `No collection "${value}". Use collections_list.`);
  return found;
}

export function propertyByName(properties: CollectionProperty[], name: string, { allowTitle = false } = {}) {
  const key = name.trim().toLowerCase();
  const pool = allowTitle ? withTitle(properties) : properties;
  // The title column answers to "Title" (its id) as well as "Name".
  const match = pool.find((p) => p.id.toLowerCase() === key || p.name.toLowerCase() === key);
  if (!match) {
    const names = pool.map((p) => p.name).join(", ");
    throw new ConnectorError("invalid", `No property "${name}". Properties: ${names || "(none)"}.`);
  }
  return match;
}

/** Plain-text summary of a property for agents: kind, options, and filter ops. */
export const describeProperty = (property: CollectionProperty) => ({
  id: property.id,
  name: property.name,
  kind: property.kind,
  ...(property.config.options?.length
    ? {
        options: property.config.options.map((o) =>
          property.kind === "status" ? `${o.name} (${o.group ?? "todo"})` : o.name,
        ),
      }
    : {}),
  ...(property.config.format ? { format: property.config.format } : {}),
  readOnly: isComputedKind(property.kind),
});

type Planned = { patch: Record<string, PropertyValue>; newOptions: Record<string, string[]> };

/**
 * Turns `{ "Status": "In progress", "Tags": ["a", "b"], "Due": "2026-11-01" }`
 * into a patch keyed by property id. Option names that don't exist yet are
 * collected in `newOptions` (the caller creates them, then plans again).
 */
export function planValues(properties: CollectionProperty[], input: Record<string, unknown>): Planned {
  const patch: Record<string, PropertyValue> = {};
  const newOptions: Record<string, string[]> = {};
  const problems: string[] = [];
  for (const [name, raw] of Object.entries(input)) {
    let property: CollectionProperty;
    try {
      property = propertyByName(properties, name);
    } catch (error) {
      problems.push((error as Error).message);
      continue;
    }
    if (isComputedKind(property.kind)) {
      problems.push(`"${property.name}" is set automatically`);
      continue;
    }
    if (raw === null || raw === "") {
      patch[property.id] = null;
      continue;
    }
    const asText =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && property.kind === "multi_select"
          ? raw.map(String).join(", ")
          : null;
    if (asText !== null) {
      const parsed = parseLooseText(property, asText);
      if (parsed.failed) {
        problems.push(`"${asText}" is not a valid ${property.kind} for "${property.name}"`);
        continue;
      }
      if (parsed.newOptions.length) newOptions[property.id] = parsed.newOptions;
      if (parsed.value !== null || !parsed.newOptions.length) patch[property.id] = parsed.value;
      continue;
    }
    const checked = validateValue(property, raw);
    if (!checked.ok) problems.push(`"${property.name}": ${checked.error}`);
    else patch[property.id] = checked.value;
  }
  if (problems.length) {
    throw new ConnectorError("invalid", `Nothing was written. Fix these and retry:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  }
  return { patch, newOptions };
}

const SELECT_VALUE_OPS = new Set(["is", "is_not", "any_of", "none_of", "contains_all"]);

/** Builds an AND filter from `{ property, op, value }` items, mapping option names to ids. */
export function buildFilter(properties: CollectionProperty[], where: AgentFilter[]): FilterTree {
  const items: FilterCondition[] = where.map((item, index) => {
    const property = propertyByName(properties, item.property, { allowTitle: true });
    const allowed = operatorsFor(property.kind);
    if (!allowed.includes(item.op)) {
      throw new ConnectorError("invalid", `"${item.op}" doesn't apply to ${property.kind} "${property.name}". Use one of: ${allowed.join(", ")}.`);
    }
    let value = item.value;
    const selectLike = ["select", "status", "multi_select"].includes(property.kind);
    if (selectLike && SELECT_VALUE_OPS.has(item.op)) {
      const names = Array.isArray(value) ? value.map(String) : [String(value ?? "")];
      const ids = names.map((name) => {
        const option = optionByName(property.config, name);
        if (!option) throw new ConnectorError("invalid", `"${name}" is not an option of "${property.name}".`);
        return option.id;
      });
      value = item.op === "is" || item.op === "is_not" ? ids[0] : ids;
    }
    return { id: `agent-${index}`, propertyId: property.id, op: item.op, value };
  });
  return { conjunction: "and", items };
}

export const buildSorts = (properties: CollectionProperty[], sort: AgentSort[]): SortRule[] =>
  sort.map((rule) => ({
    propertyId: propertyByName(properties, rule.property, { allowTitle: true }).id,
    direction: rule.direction ?? "asc",
  }));

/** A row as an agent reads it: property values as text, keyed by name. */
export const rowView = (origin: string, row: CollectionRow, properties: CollectionProperty[]) => {
  const values: Record<string, string> = {};
  for (const property of properties) {
    if (property.id === TITLE_PROPERTY.id) continue;
    const text = formatValueText(property, readValue(row, property));
    if (text) values[property.name] = text;
  }
  return {
    id: row.id,
    title: row.title,
    url: `${origin}/docs/${row.id}`,
    properties: values,
    updatedAt: row.updatedAt,
  };
};

export { loadLiveProperties };
