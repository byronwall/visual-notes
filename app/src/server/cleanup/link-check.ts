/**
 * Link-only notes are often breadcrumbs: a saved or shared link the owner
 * meant to come back to. Whether that link still works is a fact code can
 * check, so the sweep checks it and the decision model never has to guess.
 */

export type LinkStatus = "ok" | "dead" | "blocked";

export type LinkCheck = {
  url: string;
  status: LinkStatus;
  /** HTTP status, or null when the request never got a response. */
  httpStatus: number | null;
  /** The page's <title>, when it loaded. */
  title: string | null;
  checkedAt: string;
};

const URL_RE = /https?:\/\/[^\s)\]>"']+/g;
/** More words than this outside the links means the owner wrote something. */
const MAX_OWN_WORDS = 15;
const MAX_LINKS = 3;
const TIMEOUT_MS = 8_000;
const HEAD_BYTES = 64_000;

/** Status codes that mean the page is gone, not that the site said no. */
const GONE = new Set([404, 410]);

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/**
 * The first link when the note is only links (1–3) plus a few words, such
 * as a title line or "check this out". Null for anything with real content.
 */
export function linkOnlyUrl(body: string): string | null {
  const urls = body.match(URL_RE) ?? [];
  const first = urls[0];
  if (!first || urls.length > MAX_LINKS) return null;
  const rest = body
    .replace(URL_RE, " ")
    .replace(/\[([^\]]*)\]\(\s*\)/g, "$1")
    .replace(/[[\]()<>*_#>-]/g, " ");
  const words = rest.match(/\w+/g)?.length ?? 0;
  return words <= MAX_OWN_WORDS ? first.replace(/[.,;:]+$/, "") : null;
}

export const statusFor = (
  httpStatus: number | null,
  timedOut = false,
): LinkStatus => {
  // A slow site is not a dead one; only a failed lookup or 404/410 is.
  if (timedOut) return "blocked";
  if (httpStatus === null || GONE.has(httpStatus)) return "dead";
  if (httpStatus < 400) return "ok";
  // 401/403/429 and 5xx: the site refused a bot or hiccuped. Not proof the
  // page is gone, so it never sends the note to delete.
  return "blocked";
};

const decode = (text: string) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

export function pageTitle(html: string): string | null {
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
  )?.[1];
  const title = og ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const clean = title ? decode(title).replace(/\s+/g, " ").trim() : "";
  return clean ? clean.slice(0, 200) : null;
}

/** Readable text of a page: scripts, styles, and tags removed. */
export function pageText(html: string): string {
  return decode(
    html
      .replace(
        /<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

type FetchLike = typeof fetch;

/** GETs the page; `maxBytes` caps how much of the body is read. */
export async function fetchPage(
  url: string,
  maxBytes: number,
  fetchImpl: FetchLike = fetch,
): Promise<{ httpStatus: number | null; html: string; timedOut: boolean }> {
  try {
    const res = await fetchImpl(url, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("html") || !res.body) {
      await res.body?.cancel();
      return { httpStatus: res.status, html: "", timedOut: false };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    while (html.length < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
    return { httpStatus: res.status, html, timedOut: false };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { httpStatus: null, html: "", timedOut };
  }
}

export async function checkLink(
  url: string,
  fetchImpl: FetchLike = fetch,
  now = new Date(),
): Promise<LinkCheck> {
  const { httpStatus, html, timedOut } = await fetchPage(
    url,
    HEAD_BYTES,
    fetchImpl,
  );
  return {
    url,
    status: statusFor(httpStatus, timedOut),
    httpStatus,
    title: html ? pageTitle(html) : null,
    checkedAt: now.toISOString(),
  };
}
