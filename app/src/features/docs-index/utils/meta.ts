export type MetaRecord = Record<string, string | number | boolean | null>;

export function getTopMetaEntries(meta?: MetaRecord | null): [string, string][] {
  if (!meta) return [];
  const entries = Object.entries(meta)
    .filter(([, v]) => v !== null && String(v).trim() !== "")
    .slice(0, 3)
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return entries;
}


