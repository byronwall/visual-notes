import { type TocItem } from "./types";
import { slugify } from "./utils";

export function extractTocItems(root: HTMLElement): TocItem[] {
  const occurrenceByKey = new Map<string, number>();
  const mapped = Array.from(
    root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
  ).map((el, index) => {
    const tag = el.tagName.toLowerCase();
    const parsedLevel = Number(tag.slice(1));
    const level = (parsedLevel >= 1 && parsedLevel <= 6 ? parsedLevel : 1) as TocItem["level"];
    const text = (el.textContent || "").trim();
    const key = `${level}:${text}`;
    const occurrence = occurrenceByKey.get(key) ?? 0;
    occurrenceByKey.set(key, occurrence + 1);
    const id = el.id || slugify(text) || `section-${level}-${index + 1}-${occurrence}`;
    return { id, text, level, occurrence, el } as TocItem;
  });

  const h1Count = mapped.filter((item) => item.level === 1).length;
  const first = mapped[0];
  if (h1Count === 1 && first?.level === 1) {
    return mapped.filter((_, idx) => idx !== 0);
  }

  return mapped;
}

export function findHeadingByLevelAndText(
  root: HTMLElement | null,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  text: string,
  occurrence: number
): HTMLElement | null {
  if (!root) return null;

  const nodes = root.querySelectorAll<HTMLElement>(`h${level}`);
  const targetText = (text || "").trim();
  let seen = 0;

  for (const el of Array.from(nodes)) {
    if ((el.textContent || "").trim() !== targetText) continue;
    if (seen === occurrence) return el;
    seen += 1;
  }

  return null;
}
