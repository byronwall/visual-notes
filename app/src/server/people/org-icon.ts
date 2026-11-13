// Organization logos: fetched once from the organization's own website (never
// a third-party favicon service), stored on the row, and served from there.
// A miss is remembered for a week so a dead site costs one request.
import { fetchPublicFile } from "~/server/lib/public-fetch";
import { prisma } from "~/server/db";

const RETRY_MS = 7 * 86_400_000;
const MAX_ICON_BYTES = 300_000;

/** Icon links in a page's <head>, best first: touch icons, then the largest. */
export function iconLinks(html: string, base: string): string[] {
  const found: { href: string; score: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1].toLowerCase();
    const href = /\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (!rel || !href || !/\bicon\b|apple-touch-icon/.test(rel)) continue;
    const size = Number(/\bsizes\s*=\s*["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    const score = (rel.includes("apple-touch") ? 1000 : 0) + size;
    try {
      found.push({ href: new URL(href, base).toString(), score });
    } catch {
      // A malformed href is skipped.
    }
  }
  return found.sort((a, b) => b.score - a.score).map((f) => f.href);
}

async function findIcon(
  site: string,
): Promise<{ data: Buffer; type: string } | null> {
  let base: URL;
  try {
    base = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
  } catch {
    return null;
  }
  const candidates: string[] = [];
  try {
    const page = await fetchPublicFile(base.toString(), {
      maxBytes: 800_000,
      timeoutMs: 5_000,
      accept: "text/html",
    });
    candidates.push(...iconLinks(page.buffer.toString("utf8"), page.finalUrl));
  } catch (err) {
    console.debug("[people] icon page fetch failed", base.host, String(err));
  }
  candidates.push(new URL("/favicon.ico", base).toString());
  for (const url of candidates.slice(0, 4)) {
    try {
      const file = await fetchPublicFile(url, {
        maxBytes: MAX_ICON_BYTES,
        timeoutMs: 5_000,
      });
      const type = file.contentType.split(";")[0].trim().toLowerCase();
      // Raster only: an SVG from another site could carry script.
      if (
        type.startsWith("image/") &&
        type !== "image/svg+xml" &&
        file.buffer.length > 0
      )
        return { data: file.buffer, type };
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/** The stored icon, fetching it first when the site was never (or long ago) tried. */
export async function organizationIcon(
  id: string,
): Promise<{ data: Uint8Array; type: string } | null> {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { url: true, iconData: true, iconType: true, iconCheckedAt: true },
  });
  if (!org) return null;
  if (org.iconData && org.iconType)
    return { data: org.iconData, type: org.iconType };
  if (!org.url) return null;
  if (org.iconCheckedAt && Date.now() - org.iconCheckedAt.getTime() < RETRY_MS)
    return null;
  const icon = await findIcon(org.url);
  await prisma.organization.update({
    where: { id },
    data: {
      iconData: icon ? new Uint8Array(icon.data) : null,
      iconType: icon?.type ?? null,
      iconCheckedAt: new Date(),
    },
  });
  console.info("[people] organization icon", id, icon ? "found" : "none");
  return icon ? { data: new Uint8Array(icon.data), type: icon.type } : null;
}
