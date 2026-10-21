import { useAction, useSearchParams } from "@solidjs/router";
import { PlusIcon, SearchIcon } from "lucide-solid";
import { For, Show, createResource, createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { Input } from "~/components/ui/input";
import { SimpleSelect } from "~/components/ui/simple-select";
import { parsePlaceKind } from "~/lib/events/filters";
import {
  PLACE_KINDS,
  PLACE_KIND_LABELS,
  type PlaceKind,
} from "~/lib/events/types";
import type { PlaceWithCounts } from "~/lib/events/view-types";
import { removePlace } from "~/services/events/events.actions";
import { fetchPlacesWithCounts } from "~/services/events/events-views.queries";
import { PlaceDialog } from "./PlaceDialog";
import { PlaceRow, placeGrid } from "./PlaceRow";

const KIND_ITEMS = [
  { label: "All kinds", value: "" },
  ...PLACE_KINDS.map((k) => ({ label: PLACE_KIND_LABELS[k], value: k })),
];

const searchWrap = css({
  position: "relative",
  flex: "1 1 12rem",
  minW: "0",
  maxW: { md: "18rem" },
  "& svg": {
    position: "absolute",
    left: "2",
    top: "50%",
    transform: "translateY(-50%)",
    color: "fg.subtle",
    pointerEvents: "none",
  },
});
const head = css({
  display: { base: "none", md: "grid" },
  px: "2",
  pb: "1",
  fontSize: "xs",
  color: "fg.subtle",
  borderBottomWidth: "1px",
  borderColor: "border",
  mb: "1",
});
const empty = css({
  p: "4",
  borderRadius: "l3",
  bg: "bg.subtle",
  fontSize: "sm",
  color: "fg.muted",
});

type Editing = { place: PlaceWithCounts | null } | null;

/** Venues, restaurants, and shops: filter, add, edit, and delete. */
export function PlacesView() {
  const [params, setParams] = useSearchParams();
  const kind = () => parsePlaceKind(params.kind);
  const q = () => (typeof params.q === "string" ? params.q : "");
  // createResource does not follow action revalidation; writes refetch.
  const [places, { refetch }] = createResource<
    PlaceWithCounts[],
    { kind?: PlaceKind; search?: string }
  >(
    () => ({ kind: kind(), search: q() || undefined }),
    // A refetch after a write skips the query cache with a fresh key.
    (input, info) =>
      fetchPlacesWithCounts(
        info.refetching ? { ...input, refresh: Date.now() } : input,
      ),
  );

  const [draft, setDraft] = createSignal(q());
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const onSearch = (value: string) => {
    setDraft(value);
    clearTimeout(timer);
    timer = setTimeout(
      () => setParams({ q: value.trim() || undefined }, { replace: true }),
      250,
    );
  };

  const [editing, setEditing] = createSignal<Editing>(null);
  const [deleting, setDeleting] = createSignal<PlaceWithCounts | null>(null);
  const runRemove = useAction(removePlace);

  return (
    <>
      <HStack gap="2" flexWrap="wrap" mb="4">
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
        <div class={searchWrap}>
          <SearchIcon size={14} />
          <Input
            size="sm"
            ps="7"
            type="search"
            placeholder="Search name or city"
            aria-label="Search places"
            value={draft()}
            onInput={(e) => onSearch(e.currentTarget.value)}
          />
        </div>
        <Button
          size="sm"
          variant="solid"
          ml="auto"
          onClick={() => setEditing({ place: null })}
        >
          <PlusIcon size={14} /> New place
        </Button>
      </HStack>

      <Show when={places.latest}>
        {(list) => (
          <Show
            when={list().length}
            fallback={
              <div class={empty}>
                {kind() || q()
                  ? "No places match."
                  : "No places yet. Add venues, restaurants, and shops to pin them on the map and pick them for shows."}
              </div>
            }
          >
            <div class={`${placeGrid} ${head}`}>
              <span>Name</span>
              <span>Kind</span>
              <span>Address</span>
              <span>Upcoming</span>
              <span />
            </div>
            <For each={list()}>
              {(place) => (
                <PlaceRow
                  place={place}
                  onEdit={() => setEditing({ place })}
                  onDelete={() => setDeleting(place)}
                />
              )}
            </For>
          </Show>
        )}
      </Show>

      <Show when={editing()}>
        {(e) => (
          <PlaceDialog
            place={e().place}
            onClose={() => setEditing(null)}
            onSaved={() => void refetch()}
          />
        )}
      </Show>
      <ConfirmDialog
        open={deleting() != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting()?.name ?? "place"}?`}
        description={
          deleting()?.upcomingCount
            ? `${deleting()!.upcomingCount} upcoming shows use this place; they will lose their place.`
            : "Shows and events that use this place will lose their place."
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const p = deleting();
          if (p) void runRemove(p.id).then(() => refetch());
        }}
      />
    </>
  );
}
