// Pure duplicate matching for events: canonical URLs, normalized titles, and
// shared show dates. The MCP tools load candidates and call `matchEvent`.

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "ref",
  "ref_src",
]);

const isTrackingParam = (key: string) =>
  key.toLowerCase().startsWith("utm_") ||
  TRACKING_PARAMS.has(key.toLowerCase());

/**
 * `example.com/events/show?id=4` from any spelling of the same link: no
 * protocol, `www.`, hash, tracking params, or trailing slash; lowercase host;
 * remaining params sorted. Returns null for blank input.
 */
export function canonicalizeUrl(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(text)
    ? text
    : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return text.toLowerCase();
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port ? `:${url.port}` : "";
  const path = url.pathname.replace(/\/+$/, "");
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = params.length
    ? `?${new URLSearchParams(params).toString()}`
    : "";
  return `${host}${port}${path}${query}`;
}

/** Lowercased, accent- and punctuation-free title; drops a leading "the". */
export const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");

const tokens = (normalized: string) =>
  new Set(normalized.split(" ").filter(Boolean));

/**
 * 0..1 similarity of two titles: 1 when the normalized titles match or one
 * contains the other (and the shorter has at least 8 characters), otherwise
 * the token Dice coefficient.
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 8 && long.includes(short)) return 0.9;
  const ta = tokens(na);
  const tb = tokens(nb);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return (2 * shared) / (ta.size + tb.size);
}

export type DuplicateQuery = {
  title?: string | null;
  url?: string | null;
  /** Local show dates `YYYY-MM-DD`. */
  dates?: string[];
};

export type DuplicateCandidateInput = {
  title: string;
  url: string | null;
  /** Local show dates `YYYY-MM-DD`. */
  dates: string[];
};

export type DuplicateConfidence = "high" | "medium" | "possible";

export type DuplicateMatch = {
  confidence: DuplicateConfidence;
  reasons: string[];
  matchingDates: string[];
  titleSimilarity: number;
};

/** Titles at least this similar count as "similar". */
export const SIMILAR_TITLE = 0.6;
/** Titles at least this similar match even without a shared date. */
export const NEAR_SAME_TITLE = 0.85;

/** Why `candidate` looks like the event in `query`, or null when it doesn't. */
export function matchEvent(
  query: DuplicateQuery,
  candidate: DuplicateCandidateInput,
): DuplicateMatch | null {
  const queryUrl = canonicalizeUrl(query.url);
  const urlMatch =
    Boolean(queryUrl) && canonicalizeUrl(candidate.url) === queryUrl;
  const similarity = query.title
    ? titleSimilarity(query.title, candidate.title)
    : 0;
  const exactTitle =
    Boolean(query.title) &&
    normalizeTitle(query.title!) === normalizeTitle(candidate.title);
  const wanted = new Set(query.dates ?? []);
  const matchingDates = [
    ...new Set(candidate.dates.filter((d) => wanted.has(d))),
  ].sort();
  const sameDate = matchingDates.length > 0;

  const reasons: string[] = [];
  if (urlMatch) reasons.push("same canonical URL");
  if (exactTitle) reasons.push("same normalized title");
  else if (similarity >= NEAR_SAME_TITLE)
    reasons.push(`nearly the same title (${similarity.toFixed(2)})`);
  else if (similarity >= SIMILAR_TITLE && sameDate)
    reasons.push(`similar title (${similarity.toFixed(2)})`);
  if (sameDate && reasons.length)
    reasons.push(
      `show on the same date${matchingDates.length === 1 ? "" : "s"}: ${matchingDates.join(", ")}`,
    );
  if (!reasons.length) return null;

  const confidence: DuplicateConfidence =
    urlMatch || (similarity >= NEAR_SAME_TITLE && sameDate)
      ? "high"
      : exactTitle || similarity >= NEAR_SAME_TITLE
        ? "medium"
        : "possible";
  return { confidence, reasons, matchingDates, titleSimilarity: similarity };
}

const RANK: Record<DuplicateConfidence, number> = {
  high: 0,
  medium: 1,
  possible: 2,
};

/** Matches across candidates, most confident first. */
export function findDuplicateMatches<T extends DuplicateCandidateInput>(
  query: DuplicateQuery,
  candidates: T[],
): Array<{ candidate: T; match: DuplicateMatch }> {
  return candidates
    .flatMap((candidate) => {
      const match = matchEvent(query, candidate);
      return match ? [{ candidate, match }] : [];
    })
    .sort(
      (a, b) =>
        RANK[a.match.confidence] - RANK[b.match.confidence] ||
        b.match.titleSimilarity - a.match.titleSimilarity,
    );
}
