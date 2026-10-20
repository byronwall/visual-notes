import { For, Show } from "solid-js";
import { GlobeIcon } from "lucide-solid";
import { formatAbsoluteTime, formatRelativeTime } from "../utils/time";
import { renderHighlighted } from "../utils/highlight";
import { getTopMetaEntries } from "../utils/meta";
import { stripLeadingTitle } from "../utils/snippet";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import * as Checkbox from "~/components/ui/checkbox";
import { Box } from "styled-system/jsx";
import { css } from "styled-system/css";
import { pathToRoute } from "~/utils/path-links";

export type DocRowProps = {
  id: string;
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  share?: { slug: string; shareUrl: string } | null;
  collection?: { id: string; name: string; icon: string | null } | null;
  snippet?: string | null;
  query?: string;
  active?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onFilterMeta?: (k: string, v: string) => void;
  onResultOpen?: (id: string) => void;
  onToggleSelect?: (id: string, next: boolean, shiftKey: boolean) => void;
  onActivate?: (id: string) => void;
  previewDoc?: {
    previewText?: string;
    path?: string | null;
    meta?: Record<string, unknown> | null;
  } | null;
};

const collectionChipClass = css({
  display: "inline-flex",
  alignItems: "center",
  ml: "1.5",
  px: "1.5",
  h: "4.5",
  borderRadius: "l1",
  bg: "bg.subtle",
  borderWidth: "1px",
  borderColor: "border",
  color: "fg.muted",
  fontSize: "2xs",
  verticalAlign: "1px",
  textDecoration: "none",
  _hover: { color: "fg.default", borderColor: "border.emphasized" },
});

// Fixed columns so paths and times scan as columns; the title column always
// keeps room. Meta shows only where there is width for it.
// Phones have no hover to reveal the checkbox, so its column only exists in
// selection mode there instead of leaving an empty gutter on every row.
const rowClass = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gridTemplateAreas: `"title title" "path time" "snippet snippet"`,
  "&[data-selection-mode]": {
    gridTemplateColumns: "1.5rem minmax(0, 1fr) auto",
    gridTemplateAreas: `"check title title" ". path time" ". snippet snippet"`,
  },
  "&:not([data-selection-mode]) > .row-check": { display: "none" },
  columnGap: "3",
  rowGap: "0.5",
  alignItems: "baseline",
  "& > .row-check": { alignSelf: "start" },
  px: "2",
  py: "1.5",
  borderRadius: "l2",
  cursor: "pointer",
  scrollMarginTop: "8rem",
  scrollMarginBottom: "1rem",
  transitionProperty: "background-color",
  transitionDuration: "120ms",
  _hover: { bg: "gray.a2" },
  "&[data-active]": { bg: "gray.a3" },
  "&[data-selected]": { bg: "gray.a4" },
  "&[data-selected][data-active]": { bg: "gray.a5" },
  "& .row-check": {
    opacity: 0,
    transitionProperty: "opacity",
    transitionDuration: "120ms",
  },
  "&:hover .row-check, &[data-selected] .row-check, &[data-selection-mode] .row-check, & .row-check:focus-within":
    { opacity: 1 },
  "& .row-meta": { display: "none" },
  sm: {
    "&, &[data-selection-mode]": {
      gridTemplateColumns: "1.5rem minmax(0, 1fr) 9rem 3.5rem",
      gridTemplateAreas: `"check title path time" ". snippet snippet ."`,
    },
    "&:not([data-selection-mode]) > .row-check": { display: "flex" },
  },
  lg: {
    "&, &[data-selection-mode]": {
      gridTemplateColumns: "1.5rem minmax(0, 1fr) 12rem 3.5rem",
    },
  },
  xl: {
    "&, &[data-selection-mode]": {
      gridTemplateColumns: "1.5rem minmax(12rem, 1fr) auto 14rem 3.5rem",
      gridTemplateAreas: `"check title meta path time" ". snippet snippet . ."`,
    },
    "& .row-meta": { display: "flex" },
  },
});

const checkCellClass = css({
  gridArea: "check",
  alignSelf: "center",
  display: "flex",
  // Grow the 18px box to a 26px hit target without moving it.
  "& label": { p: "1", m: "-1", cursor: "pointer" },
});

const titleLinkClass = css({
  display: "inline",
  color: "fg.default",
  fontSize: "sm",
  fontWeight: "medium",
  lineHeight: "1.35",
  textDecoration: "none",
  overflowWrap: "break-word",
  _hover: { textDecoration: "underline", textUnderlineOffset: "2px" },
});

const cellTextClass = css({
  minW: "0",
  fontSize: "xs",
  color: "fg.muted",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const metaCellClass = css({
  gridArea: "meta",
  justifyContent: "flex-end",
  gap: "3",
  minW: "0",
  maxW: "16rem",
  overflow: "hidden",
});

const pathLinkClass = css({
  gridArea: "path",
  justifySelf: "start",
  maxW: "full",
  fontFamily: "mono",
  textDecoration: "none",
  _hover: { color: "fg.default", textDecoration: "underline" },
});

const metaButtonClass = css({
  flexShrink: "1",
  maxW: "10rem",
  cursor: "pointer",
  bg: "transparent",
  borderRadius: "l1",
  px: "1",
  mx: "-1",
  transitionProperty: "color, background-color",
  transitionDuration: "120ms",
  _hover: { color: "fg.default", bg: "gray.a3" },
  "& .meta-key": { color: "fg.subtle" },
});

const timeClass = css({
  gridArea: "time",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
});

export const DocRow = (props: DocRowProps) => {
  const snippet = () => stripLeadingTitle(props.snippet, props.title);
  const isInteractive = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest("a, button, input, label, [data-row-control]");

  return (
    <li
      class={rowClass}
      data-doc-id={props.id}
      data-active={props.active ? "" : undefined}
      data-selected={props.selected ? "" : undefined}
      data-selection-mode={props.selectionMode ? "" : undefined}
      aria-selected={props.active ? "true" : undefined}
      onClick={(e) => {
        if (isInteractive(e.target)) return;
        if (props.selectionMode) {
          props.onToggleSelect?.(props.id, !props.selected, e.shiftKey);
          return;
        }
        props.onActivate?.(props.id);
      }}
    >
      <div class={`row-check ${checkCellClass}`} data-row-control>
        <Checkbox.Root
          size="sm"
          checked={!!props.selected}
          onCheckedChange={(details) =>
            props.onToggleSelect?.(props.id, details.checked === true, false)
          }
          onClick={(e: MouseEvent) => {
            e.preventDefault();
            props.onToggleSelect?.(props.id, !props.selected, e.shiftKey);
          }}
        >
          <Checkbox.HiddenInput aria-label={`Select ${props.title}`} />
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Root>
      </div>

      <Box gridArea="title" minW="0">
        <DocHoverPreviewLink
          href={`/docs/${props.id}`}
          title={props.title}
          updatedAt={props.updatedAt}
          path={props.path}
          meta={props.meta}
          snippet={props.snippet}
          previewDoc={props.previewDoc}
          triggerClass={titleLinkClass}
          onNavigate={() => props.onResultOpen?.(props.id)}
        >
          <Show when={props.query} fallback={props.title || "Untitled"}>
            {(query) => renderHighlighted(props.title, query())}
          </Show>
        </DocHoverPreviewLink>
        <Show when={props.share}>
          {(share) => (
            <Box
              as="span"
              display="inline-flex"
              verticalAlign="-2px"
              ml="1.5"
              color="green.11"
              title={`Shared at ${share().shareUrl}`}
              aria-label="Shared"
            >
              <GlobeIcon size={13} />
            </Box>
          )}
        </Show>
        <Show when={props.collection}>
          {(collection) => (
            <a
              href={`/collections/${collection().id}`}
              class={collectionChipClass}
              title={`Row in ${collection().name}`}
            >
              {collection().icon ? `${collection().icon} ` : ""}
              {collection().name}
            </a>
          )}
        </Show>
      </Box>

      <div class={`row-meta ${metaCellClass}`}>
        <For each={getTopMetaEntries(props.meta as never)}>
          {([k, v]) => (
            <button
              type="button"
              class={`${cellTextClass} ${metaButtonClass}`}
              title={`Filter by ${k}: ${v}`}
              onClick={() => props.onFilterMeta?.(k, v)}
            >
              <span class="meta-key">{k}:</span> {v}
            </button>
          )}
        </For>
      </div>

      <Show when={props.path}>
        {(path) => (
          <a
            href={pathToRoute(path())}
            class={`${cellTextClass} ${pathLinkClass}`}
            title={path()}
          >
            <Show when={props.query} fallback={path()}>
              {(query) => renderHighlighted(path(), query())}
            </Show>
          </a>
        )}
      </Show>

      <span
        class={`${cellTextClass} ${timeClass}`}
        title={`Updated ${formatAbsoluteTime(props.updatedAt)}`}
      >
        {formatRelativeTime(props.updatedAt)}
      </span>

      <Show when={snippet()}>
        {(text) => (
          <Box
            gridArea="snippet"
            fontSize="xs"
            color="fg.muted"
            lineClamp="2"
            minW="0"
          >
            <Show when={props.query} fallback={text()}>
              {(query) => renderHighlighted(text(), query())}
            </Show>
          </Box>
        )}
      </Show>
    </li>
  );
};
