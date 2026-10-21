// Address → coordinates through OpenStreetMap Nominatim. Server-only; keeps to
// Nominatim's usage policy (descriptive User-Agent, at most 1 request/second).
import { formatAddress } from "~/lib/events/types";

const LOG_PREFIX = "[geocode]";
const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "visual-notes/1.0 (personal event calendar; https://github.com/byronwall/visual-notes)";
const TIMEOUT_MS = 8000;
const MIN_INTERVAL_MS = 1100;

export type GeocodeResult =
  | {
      ok: true;
      latitude: number;
      longitude: number;
      displayName: string;
      query: string;
    }
  | { ok: false; reason: string };

type Fetch = typeof fetch;

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Serializes requests so they stay at least one second apart. */
function throttled<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return work();
  });
  queue = next.catch(() => undefined);
  return next;
}

async function search(query: string, fetchImpl: Fetch): Promise<GeocodeResult> {
  const url = `${ENDPOINT}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const response = await throttled(() =>
      fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    );
    if (!response.ok)
      return {
        ok: false,
        reason: `Nominatim returned HTTP ${response.status}`,
      };
    const rows = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
    }>;
    const first = rows[0];
    if (!first) return { ok: false, reason: `No match for "${query}"` };
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return { ok: false, reason: "Nominatim returned no coordinates" };
    return {
      ok: true,
      latitude,
      longitude,
      displayName: first.display_name ?? "",
      query,
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `Timed out after ${TIMEOUT_MS / 1000}s`
        : `Request failed: ${error instanceof Error ? error.message : String(error)}`;
    return { ok: false, reason };
  }
}

/**
 * Geocodes a place by its street address, falling back to its name plus
 * city/state. Failures never throw; they return `ok: false` with a reason.
 */
export async function geocodePlace(
  place: {
    name: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  },
  fetchImpl: Fetch = fetch,
): Promise<GeocodeResult> {
  const queries: string[] = [];
  if (place.street) queries.push(formatAddress(place));
  const region = [place.city, place.state].filter(Boolean).join(", ");
  queries.push([place.name, region].filter(Boolean).join(", "));
  let last: GeocodeResult = { ok: false, reason: "Nothing to geocode" };
  for (const query of queries) {
    last = await search(query, fetchImpl);
    if (last.ok) {
      console.info(`${LOG_PREFIX} found "${query}"`);
      return last;
    }
    // A timeout or HTTP error will not get better with a second query.
    if (!last.reason.startsWith("No match")) break;
  }
  console.info(
    `${LOG_PREFIX} failed for "${place.name}": ${last.ok ? "" : last.reason}`,
  );
  return last;
}
