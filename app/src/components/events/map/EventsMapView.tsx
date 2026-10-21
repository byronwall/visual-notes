import { useSearchParams } from "@solidjs/router";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimpleSelect } from "~/components/ui/simple-select";
import { parseEventsFilters, parsePlaceKind } from "~/lib/events/filters";
import { PLACE_KINDS, PLACE_KIND_LABELS } from "~/lib/events/types";
import {
  fetchPlacesWithCounts,
  fetchShowsView,
} from "~/services/events/events-views.queries";
import { LeafletMap } from "./LeafletMap";
import { MapSideList } from "./MapSideList";
import { eventPoints, placePoints } from "./mapPoints";

const layout = css({
  display: "grid",
  gridTemplateColumns: { base: "minmax(0, 1fr)", md: "minmax(0, 1fr) 20rem" },
  gridTemplateRows: { base: "22rem auto", md: "minmax(0, 1fr)" },
  gap: "3",
  h: { base: "auto", md: "calc(100vh - 12rem)" },
  minH: { md: "28rem" },
});
const side = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  minH: "0",
  maxH: { base: "none", md: "full" },
});
const note = css({ fontSize: "xs", color: "fg.subtle", px: "2" });

const KIND_ITEMS = [
  { label: "All kinds", value: "" },
  ...PLACE_KINDS.map((k) => ({ label: PLACE_KIND_LABELS[k], value: k })),
];

/** Upcoming shows by place, or every mapped place, with a synced list. */
export function EventsMapView() {
  const [params, setParams] = useSearchParams();
  const mode = () => (params.layer === "places" ? "places" : "events");
  const kind = () => parsePlaceKind(params.kind);

  const [shows] = createResource(
    () => (mode() === "events" ? parseEventsFilters({}) : false),
    (input) => fetchShowsView(input),
  );
  const [places] = createResource(
    () => (mode() === "places" ? { kind: kind() } : false),
    (input) => fetchPlacesWithCounts(input),
  );

  const data = createMemo(() =>
    mode() === "events"
      ? eventPoints(shows.latest?.items ?? [])
      : placePoints(places.latest ?? []),
  );
  const ready = () =>
    mode() === "events" ? shows.latest != null : places.latest != null;

  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [focus, setFocus] = createSignal<{ id: string; seq: number } | null>(
    null,
  );
  const pick = (id: string) => {
    setSelectedId(id);
    setFocus((f) => ({ id, seq: (f?.seq ?? 0) + 1 }));
  };
  const setMode = (layer: "events" | "places") => {
    setSelectedId(null);
    setParams(
      { layer: layer === "places" ? "places" : undefined, kind: undefined },
      { replace: true },
    );
  };

  const unmappedText = () => {
    const n = data().unmapped;
    if (!n) return "";
    return mode() === "events"
      ? `${n} upcoming ${n === 1 ? "show has" : "shows have"} no mapped place.`
      : `${n} ${n === 1 ? "place lacks" : "places lack"} coordinates.`;
  };

  return (
    <>
      <HStack gap="2" mb="3" flexWrap="wrap">
        <HStack gap="0" role="group" aria-label="Map layer">
          <For each={["events", "places"] as const}>
            {(layer) => (
              <Button
                size="sm"
                variant={mode() === layer ? "subtle" : "plain"}
                aria-pressed={mode() === layer}
                onClick={() => setMode(layer)}
              >
                {layer === "events" ? "Upcoming shows" : "All places"}
              </Button>
            )}
          </For>
        </HStack>
        <Show when={mode() === "places"}>
          <Box w="9rem" flexShrink="0">
            <SimpleSelect
              items={KIND_ITEMS}
              value={kind() ?? ""}
              placeholder="All kinds"
              onChange={(v) =>
                setParams({ kind: v || undefined }, { replace: true })
              }
              size="sm"
              minW="9rem"
              sameWidth={false}
              skipPortal={false}
            />
          </Box>
        </Show>
      </HStack>
      <div class={layout}>
        <LeafletMap
          points={data().points}
          focus={focus()}
          onSelect={setSelectedId}
        />
        <div class={side}>
          <Show when={ready()}>
            <span class={note}>
              {data().points.length} on the map. {unmappedText()}
            </span>
            <Show
              when={data().points.length}
              fallback={
                <span class={note}>
                  {mode() === "events"
                    ? "No upcoming shows at mapped places."
                    : "No places with coordinates yet. Add latitude and longitude on the Places tab."}
                </span>
              }
            >
              <MapSideList
                points={data().points}
                selectedId={selectedId()}
                onPick={pick}
              />
            </Show>
          </Show>
        </div>
      </div>
    </>
  );
}
