import type { JSX } from "solid-js";

/** Minimal shape of a navigable destination (see sidebar/nav-items.ts). */
export type PaletteDestination = {
  label: string;
  href: string;
  keywords?: string;
};

export type PaletteIcon = (props: {
  size?: number;
  strokeWidth?: number;
}) => JSX.Element;

/** An app-level command contributed by the shell (chat, sidebar, logs). */
export type PaletteAction = {
  key: string;
  label: string;
  keywords?: string;
  shortcut?: string;
  icon: PaletteIcon;
  run: () => void;
};

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Score a label/keywords pair against a query: prefix of the label beats a
 * word prefix, which beats a keyword hit. Returns 0 when there is no match.
 */
export const scoreCommand = (
  query: string,
  label: string,
  keywords = ""
): number => {
  const q = normalize(query);
  if (!q) return 0;
  const name = label.toLowerCase();
  if (name.startsWith(q)) return 3;
  if (name.split(/\s+/).some((word) => word.startsWith(q))) return 2;
  if (name.includes(q)) return 2;
  if (
    keywords
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(q))
  )
    return 1;
  return 0;
};

const rank = <T>(
  query: string,
  items: T[],
  fields: (item: T) => [string, string | undefined],
  limit: number
): T[] =>
  items
    .map((item, index) => {
      const [label, keywords] = fields(item);
      return { item, index, score: scoreCommand(query, label, keywords) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);

export const matchDestinations = <T extends PaletteDestination>(
  query: string,
  destinations: T[],
  limit = 4
): T[] =>
  rank(query, destinations, (item) => [item.label, item.keywords], limit);

export const matchActions = (
  query: string,
  actions: PaletteAction[],
  limit = 3
): PaletteAction[] =>
  rank(query, actions, (item) => [item.label, item.keywords], limit);
