import type { ResourceFetcherInfo } from "solid-js";
import type { ShowsView, ShowsViewInput } from "~/lib/events/view-types";
import { fetchShowsView } from "~/services/events/events-views.queries";

/**
 * Resource fetcher for the shows views. A refetch after a write skips the
 * query cache with a fresh key, and a failed refetch (for example one cut off
 * by navigating to a note) keeps the rows already on screen.
 */
export async function refetchableShows(
  input: ShowsViewInput,
  info: ResourceFetcherInfo<ShowsView, unknown>,
): Promise<ShowsView> {
  if (!info.refetching) return fetchShowsView(input);
  try {
    return await fetchShowsView({ ...input, refresh: Date.now() });
  } catch (err) {
    if (!info.value) throw err;
    console.warn("[events-views] refetch failed; keeping current rows", err);
    return info.value;
  }
}
