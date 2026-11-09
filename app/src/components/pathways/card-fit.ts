import type { PathwayNode } from "~/lib/pathways/types";
import { isFaint, type Box } from "./layout";
import { fitText } from "./textfit";

/** Titles never drop under this many px on screen. */
const MIN_PX = 12;
/** Badges stay at least this many px on screen. */
const BADGE_PX = 10;
/** Badges never grow past this share of the title size; past it the row hides. */
const BADGE_MAX = 0.75;

export type CardFit = {
  pad: number;
  badgeF: number;
  headH: number;
  size: number;
  lines: number;
  badges: boolean;
};

type Card = { n: PathwayNode; box: Box; badges: boolean };

/**
 * Title sizes for zoomed-out cards (below full detail). Each card's title
 * grows to fill its card, but cards of one class (question, important,
 * normal, faint) share one size, so a column of cards reads as one set. The
 * shared size is a low quantile of the classes' own fits; a card whose own
 * fit is smaller (a long title) keeps its own. A badge row that would crush
 * the title, or outgrow it, hides.
 */
export function fitCards(cards: Card[], k: number, far: boolean) {
  const pad = far ? 6 : 8;
  const own = cards.map((c) => ({ c, ...fitOne(c, k, pad) }));
  const groups = new Map<string, number[]>();
  for (const o of own) {
    const g = cls(o.c.n);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(o.size);
  }
  const shared = new Map<string, number>();
  for (const [g, sizes] of groups) {
    sizes.sort((a, b) => a - b);
    shared.set(g, sizes[Math.floor((sizes.length - 1) * 0.25)]);
  }

  const out = new Map<string, CardFit>();
  for (const o of own) {
    const b = o.c.box;
    let size = Math.min(o.size, shared.get(cls(o.c.n))!);
    // Badges scale with the title (half its size, at least BADGE_PX on screen),
    // never above what the card's own fit allowed.
    const badgeF = Math.min(o.badgeF, Math.max(BADGE_PX / k, size * 0.5));
    const badges = o.badges && badgeF <= size * BADGE_MAX;
    const headH = badges ? badgeF * 1.4 + 4 : 0;
    const room = Math.max(8, b.h - 2 * pad - headH - 4);
    size = Math.max(size, Math.min(MIN_PX / k, room / 1.2));
    out.set(o.c.n.id, {
      pad,
      badgeF,
      headH,
      size,
      lines: Math.max(1, Math.floor(room / (size * 1.2))),
      badges,
    });
  }
  return out;
}

const cls = (n: PathwayNode) =>
  n.kind === "root"
    ? "root"
    : isFaint(n)
      ? "faint"
      : n.weight === "key"
        ? "key"
        : "normal";

function fitOne(c: Card, k: number, pad: number) {
  const b = c.box;
  // Content box: card minus padding and borders (4-6px left rail, 1-2px others), with 3% slack.
  const textW = (b.w - 2 * (pad + 2) - 8) * 0.97;
  const solve = (badgeF: number, badges: boolean) => {
    const headH = badges ? badgeF * 1.4 + 4 : 0;
    const room = Math.max(8, b.h - 2 * pad - headH - 4);
    return { badgeF, size: fitText(c.n.title, textW, room, 650, 64 / k) };
  };
  const bare = solve(0, false);
  if (!c.badges) return { ...bare, badges: false };
  let r = solve(BADGE_PX / k, true);
  if (r.size * 0.5 > r.badgeF) r = solve(r.size * 0.5, true);
  // A short card cannot fit a readable badge row and title: keep the title.
  if (r.size < bare.size * 0.7 || r.badgeF > r.size * BADGE_MAX)
    return { ...bare, badges: false };
  return { ...r, badges: true };
}
