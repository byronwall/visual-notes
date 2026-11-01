import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  type JSX,
} from "solid-js";
import { isServer } from "solid-js/web";
import { ChevronRightIcon, XIcon } from "lucide-solid";
import { DateInput } from "~/components/DateInput";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Input } from "~/components/ui/input";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import type { DocsFacets } from "../data/docs.types";
import type { DocsQueryStore } from "../state/docsQuery";
import { FacetList, type FacetItem } from "./FacetList";
import { activityLabel, orderActivity, updatedLabel } from "./facet-labels";

/**
 * The same element is the sticky rail from `xl` up and a bottom sheet below,
 * so it mounts once and only CSS changes.
 */
const railClass = css({
  xl: {
    position: "sticky",
    top: "0",
    alignSelf: "start",
    maxH: "100dvh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarWidth: "thin",
    pb: "8",
    // Room for the rows' negative margin inside the scroll box.
    px: "2",
    mx: "-2",
  },
  xlDown: {
    position: "fixed",
    insetX: "0",
    bottom: "0",
    zIndex: "modal",
    maxH: "82dvh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    bg: "bg.default",
    borderTopRadius: "l3",
    boxShadow: "lg",
    px: "4",
    visibility: "hidden",
    transform: "translateY(100%)",
    transitionProperty: "transform, visibility",
    transitionDuration: "200ms",
    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
    _motionReduce: { transitionDuration: "0ms" },
    "&[data-open]": { visibility: "visible", transform: "translateY(0)" },
  },
  "&[data-stale] .count": { opacity: 0.5 },
  "& .count": { transitionProperty: "opacity", transitionDuration: "160ms" },
});

// Stays on screen so Clear all and Close never scroll away. The search row is
// 36px below 16px of padding, so this line centers on it.
const railHeaderClass = css({
  position: "sticky",
  top: "0",
  zIndex: "1",
  bg: "bg.default",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  pt: "4",
  h: "calc(token(spacing.4) + token(spacing.9))",
  fontSize: "sm",
  fontWeight: "semibold",
});

const clearClass = css({
  fontSize: "xs",
  fontWeight: "normal",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { color: "fg.default", textDecoration: "underline" },
});

// Bottom of the sheet only: the list is hidden behind it, so say what is next.
const sheetFooterClass = css({
  xl: { display: "none" },
  position: "sticky",
  bottom: "0",
  bg: "bg.default",
  mt: "4",
  pt: "2",
  pb: "max(0.75rem, env(safe-area-inset-bottom))",
});

const backdropClass = css({
  display: "none",
  xlDown: {
    position: "fixed",
    inset: "0",
    zIndex: "overlay",
    bg: "black.a6",
    "&[data-open]": { display: "block" },
  },
});

const headingClass = css({
  h: "6",
  display: "flex",
  alignItems: "center",
  fontSize: "xs",
  fontWeight: "semibold",
  color: "fg.muted",
});

const crumbClass = css({
  py: "0.5",
  fontSize: "xs",
  color: "fg.muted",
  fontFamily: "mono",
  overflowWrap: "anywhere",
  cursor: "pointer",
  _hover: { color: "fg.default", textDecoration: "underline" },
  "&[aria-current]": { color: "fg.default", fontWeight: "medium" },
  smDown: { py: "1.5" },
});

const moreClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1",
  h: "6",
  fontSize: "xs",
  fontWeight: "semibold",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { color: "fg.default" },
  "& svg": {
    transitionProperty: "transform",
    transitionDuration: "120ms",
    _motionReduce: { transitionDuration: "0ms" },
  },
  "&[aria-expanded=true] svg": { transform: "rotate(90deg)" },
});

const Section = (props: { title: string; children: JSX.Element }) => (
  <Stack as="section" gap="0" aria-label={props.title}>
    <h3 class={headingClass}>{props.title}</h3>
    {props.children}
  </Stack>
);

const Crumbs = (props: {
  rootLabel: string;
  onRoot: () => void;
  parts: { label: string; onSelect: () => void }[];
}) => (
  <Box display="flex" flexWrap="wrap" columnGap="1" pb="1" fontSize="xs">
    <button type="button" class={crumbClass} onClick={props.onRoot}>
      {props.rootLabel}
    </button>
    <For each={props.parts}>
      {(part, i) => (
        <>
          <Box as="span" color="fg.subtle">
            /
          </Box>
          <button
            type="button"
            class={crumbClass}
            aria-current={i() === props.parts.length - 1 ? "true" : undefined}
            onClick={part.onSelect}
          >
            {part.label}
          </button>
        </>
      )}
    </For>
  </Box>
);

const DateRange = (props: {
  label: string;
  from: string;
  to: string;
  onFrom: (v?: string) => void;
  onTo: (v?: string) => void;
}) => (
  <Stack gap="1">
    <Box fontSize="xs" color="fg.muted">
      {props.label}
    </Box>
    {/* Stacked: two native date inputs clip their text side by side here. */}
    <DateInput
      value={props.from || undefined}
      onChange={props.onFrom}
      aria-label={`${props.label} from`}
      size="xs"
    />
    <DateInput
      value={props.to || undefined}
      onChange={props.onTo}
      aria-label={`${props.label} to`}
      size="xs"
    />
  </Stack>
);

export const FacetRail = (props: {
  q: DocsQueryStore;
  facets?: DocsFacets;
  /** Counts describe the browse list, so they drop out during a search. */
  hideCounts: boolean;
  /** New counts are on the way; dim the old ones. */
  stale: boolean;
  total?: number;
  open: boolean;
  onClose: () => void;
}) => {
  const q = props.q;
  const count = (n: number) => (props.hideCounts ? undefined : n);

  const updatedItems = createMemo<FacetItem[]>(() =>
    (props.facets?.updated ?? []).map(({ days, count: n }) => ({
      key: String(days),
      label: updatedLabel(days),
      count: count(n),
      selected: q.updatedWithinDays() === days,
      onSelect: () => {
        q.setUpdatedFrom(undefined);
        q.setUpdatedTo(undefined);
        q.setUpdatedWithinDays(q.updatedWithinDays() === days ? 0 : days);
      },
    })),
  );

  const pathSegments = () => (q.pathPrefix() ? q.pathPrefix().split(".") : []);
  const setPath = (path: string) => {
    q.setBlankPathOnly(false);
    q.setPathPrefix(path);
  };
  const pathItems = createMemo<FacetItem[]>(() => {
    const children: FacetItem[] = (props.facets?.paths ?? []).map((p) => ({
      key: p.value,
      label: p.value.split(".").pop()!,
      count: count(p.count),
      selected: false,
      mono: true,
      onSelect: () => setPath(p.value),
    }));
    const blank = props.facets?.blankPaths ?? 0;
    if (q.pathPrefix() || blank === 0) return children;
    return [
      ...children,
      {
        key: "(blank)",
        label: "No path",
        count: count(blank),
        selected: q.blankPathOnly(),
        onSelect: () => {
          const next = !q.blankPathOnly();
          q.setPathPrefix("");
          q.setBlankPathOnly(next);
        },
      },
    ];
  });

  const collectionItems = createMemo<FacetItem[]>(() => {
    const collections = props.facets?.collections ?? [];
    const rows = collections.reduce((sum, c) => sum + c.count, 0);
    return [
      {
        key: "(all)",
        label: "All collection rows",
        count: count(rows),
        selected: q.collectionRows() === "only" && !q.collectionId(),
        onSelect: () => {
          const next = q.collectionRows() === "only" ? "" : "only";
          q.setCollectionId("");
          q.setCollectionRows(next);
        },
      },
      ...collections.map((c) => ({
        key: c.value,
        label: `${c.icon ? `${c.icon} ` : ""}${c.name}`,
        count: count(c.count),
        selected: q.collectionId() === c.value,
        onSelect: () =>
          q.setCollectionId(q.collectionId() === c.value ? "" : c.value),
      })),
    ];
  });

  const sourceItems = createMemo<FacetItem[]>(() =>
    (props.facets?.sources ?? []).map((s) => ({
      key: s.value,
      label: s.value,
      count: count(s.count),
      selected: q.source() === s.value,
      onSelect: () => q.setSource(q.source() === s.value ? "" : s.value),
    })),
  );

  const activityItems = createMemo<FacetItem[]>(() =>
    orderActivity(props.facets?.activity ?? []).map((a) => ({
      key: a.value,
      label: activityLabel(a.value),
      count: count(a.count),
      selected: q.activityClass() === a.value,
      onSelect: () =>
        q.setActivityClass(q.activityClass() === a.value ? "" : a.value),
    })),
  );

  const metaItems = createMemo<FacetItem[]>(() =>
    q.metaKey()
      ? (props.facets?.metaValues ?? []).map((v) => ({
          key: v.value,
          label: v.value,
          count: count(v.count),
          selected: q.metaValue() === v.value,
          onSelect: () =>
            q.setMetaValue(q.metaValue() === v.value ? "" : v.value),
        }))
      : (props.facets?.metaKeys ?? []).map((k) => ({
          key: k.value,
          label: k.value,
          count: count(k.count),
          selected: false,
          onSelect: () => q.setMetaKey(k.value),
        })),
  );

  const moreActive = () =>
    !!(
      q.originalContentId() ||
      q.createdFrom() ||
      q.createdTo() ||
      q.updatedFrom() ||
      q.updatedTo()
    );
  const [moreOpen, setMoreOpen] = createSignal(moreActive());

  let closeButton: HTMLButtonElement | undefined;
  createEffect(() => {
    if (isServer || !props.open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeButton?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    });
  });

  const totalLabel = () => {
    const n = props.total ?? 0;
    return `Show ${n.toLocaleString()} ${n === 1 ? "note" : "notes"}`;
  };

  return (
    <>
      <div
        class={backdropClass}
        data-open={props.open ? "" : undefined}
        aria-hidden="true"
        onClick={props.onClose}
      />
      <aside
        class={railClass}
        data-open={props.open ? "" : undefined}
        data-stale={props.stale ? "" : undefined}
        aria-label="Filter notes"
      >
        <div class={railHeaderClass}>
          Filter
          <HStack gap="3">
            <Show when={q.hasFilters()}>
              <button
                type="button"
                class={clearClass}
                onClick={() => q.resetFilters()}
              >
                Clear all
              </button>
            </Show>
            <Box hideFrom="xl">
              <IconButton
                ref={closeButton}
                size="xs"
                variant="plain"
                aria-label="Close filters"
                onClick={props.onClose}
              >
                <XIcon size={15} />
              </IconButton>
            </Box>
          </HStack>
        </div>
        <Stack gap="4" pt="2">
          <Section title="Updated">
            <FacetList items={updatedItems()} />
          </Section>

          <Show when={pathItems().length > 0 || q.pathPrefix()}>
            <Section title="Path">
              <Show when={q.pathPrefix()}>
                <Crumbs
                  rootLabel="All"
                  onRoot={() => setPath("")}
                  parts={pathSegments().map((label, i) => ({
                    label,
                    onSelect: () =>
                      setPath(
                        pathSegments()
                          .slice(0, i + 1)
                          .join("."),
                      ),
                  }))}
                />
              </Show>
              <FacetList items={pathItems()} />
            </Section>
          </Show>

          <Show when={collectionItems().length > 1}>
            <Section title="Collections">
              <FacetList items={collectionItems()} limit={5} />
            </Section>
          </Show>

          <Show when={metaItems().length > 0 || q.metaKey()}>
            <Section title="Meta">
              <Show when={q.metaKey()}>
                <Crumbs
                  rootLabel="All"
                  onRoot={() => q.resetMeta()}
                  parts={[
                    { label: q.metaKey(), onSelect: () => q.setMetaValue("") },
                  ]}
                />
              </Show>
              <FacetList items={metaItems()} limit={5} />
            </Section>
          </Show>

          <Show when={sourceItems().length > 0}>
            <Section title="Source">
              <FacetList items={sourceItems()} limit={5} />
            </Section>
          </Show>

          <Show when={activityItems().length > 0}>
            <Section title="Activity">
              <FacetList items={activityItems()} />
            </Section>
          </Show>

          <Stack gap="2">
            <button
              type="button"
              class={moreClass}
              aria-expanded={moreOpen()}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <ChevronRightIcon size={13} />
              More filters
            </button>
            <Show when={moreOpen()}>
              <Stack gap="2.5">
                <DateRange
                  label="Updated between"
                  from={q.updatedFrom()}
                  to={q.updatedTo()}
                  onFrom={(v) => {
                    q.setUpdatedWithinDays(0);
                    q.setUpdatedFrom(v);
                  }}
                  onTo={(v) => {
                    q.setUpdatedWithinDays(0);
                    q.setUpdatedTo(v);
                  }}
                />
                <DateRange
                  label="Created between"
                  from={q.createdFrom()}
                  to={q.createdTo()}
                  onFrom={q.setCreatedFrom}
                  onTo={q.setCreatedTo}
                />
                <Stack gap="1">
                  <Box fontSize="xs" color="fg.muted">
                    Original ID
                  </Box>
                  <Input
                    size="xs"
                    placeholder="contains…"
                    aria-label="Original ID contains"
                    value={q.originalContentId()}
                    onInput={(e) =>
                      q.setOriginalContentId(e.currentTarget.value)
                    }
                    autocomplete="off"
                    spellcheck={false}
                  />
                </Stack>
              </Stack>
            </Show>
          </Stack>
        </Stack>
        <div class={sheetFooterClass}>
          <Button size="sm" w="full" onClick={props.onClose}>
            {totalLabel()}
          </Button>
        </div>
      </aside>
    </>
  );
};
