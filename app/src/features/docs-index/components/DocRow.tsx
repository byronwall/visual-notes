import { For, Show } from "solid-js";
import { GlobeIcon } from "lucide-solid";
import { formatAbsoluteTime, formatRelativeTime } from "../utils/time";
import { renderHighlighted } from "../utils/highlight";
import { getTopMetaEntries } from "../utils/meta";
import { stripLeadingTitle } from "../utils/snippet";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import * as Checkbox from "~/components/ui/checkbox";
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
  /** Server clock, so relative times render the same on server and client. */
  nowMs?: number;
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

/**
 * Row styles live on the list, keyed by short class names, so each of the
 * hundreds of rows does not repeat a long atomic class string in the HTML.
 *
 * Fixed columns so paths and times scan as columns; the title column always
 * keeps room, and meta shows only where there is width for it. From `md` up
 * the checkbox sits in the left gutter, so titles line up with the page
 * heading. Phones have no hover, so there it only appears in selection mode.
 */
export const docRowListClass = css({
  "& > li": {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gridTemplateAreas: `"title title" "path time" "snippet snippet"`,
    columnGap: "3",
    rowGap: "0.5",
    alignItems: "baseline",
    px: "2",
    py: "1.5",
    borderRadius: "l2",
    cursor: "pointer",
    scrollMarginTop: "8rem",
    scrollMarginBottom: "1rem",
    transitionProperty: "background-color",
    transitionDuration: "120ms",
    _hover: { bg: "bg.hover" },
    "&[data-active], &[data-active]:hover": { bg: "bg.hover" },
    "&[data-selected], &[data-selected]:hover": { bg: "bg.selected" },
    "&[data-selected][data-active], &[data-selected][data-active]:hover": {
      bg: "bg.selectedHover",
    },
    sm: {
      gridTemplateColumns: "minmax(0, 1fr) 9rem 3.5rem",
      gridTemplateAreas: `"title path time" "snippet snippet ."`,
    },
    lg: { gridTemplateColumns: "minmax(0, 1fr) 12rem 3.5rem" },
    xl: {
      gridTemplateColumns: "minmax(12rem, 1fr) auto 14rem 3.5rem",
      gridTemplateAreas: `"title meta path time" "snippet snippet . ."`,
    },
  },
  "& > li[data-selection-mode]": {
    smDown: {
      gridTemplateColumns: "1.5rem minmax(0, 1fr) auto",
      gridTemplateAreas: `"check title title" ". path time" ". snippet snippet"`,
    },
    smToMd: {
      gridTemplateColumns: "1.5rem minmax(0, 1fr) 9rem 3.5rem",
      gridTemplateAreas: `"check title path time" ". snippet snippet ."`,
    },
  },
  "& .dr-check": {
    gridArea: "check",
    alignSelf: "center",
    display: "none",
    opacity: 0,
    transitionProperty: "opacity",
    transitionDuration: "120ms",
    // Grow the 18px box to a 26px hit target without moving it.
    "& label": { p: "1", m: "-1", cursor: "pointer" },
    md: {
      display: "flex",
      position: "absolute",
      // Ends 6px before the title text, which sits at the row's 8px padding.
      left: "-4",
      top: "1.5",
    },
  },
  "& > li[data-selection-mode] .dr-check": { display: "flex" },
  "& > li:hover .dr-check, & > li[data-selected] .dr-check, & > li[data-selection-mode] .dr-check, & .dr-check:focus-within":
    { opacity: 1 },
  "& .dr-title": { gridArea: "title", minW: "0" },
  "& .dr-title-link": {
    display: "inline",
    color: "fg.default",
    fontSize: "sm",
    fontWeight: "medium",
    lineHeight: "1.35",
    textDecoration: "none",
    overflowWrap: "break-word",
  },
  "& .dr-shared": {
    display: "inline-flex",
    verticalAlign: "-2px",
    ml: "1.5",
    color: "green.11",
  },
  "& .dr-collection": {
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
  },
  "& .dr-cell": {
    minW: "0",
    fontSize: "xs",
    color: "fg.muted",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  "& .dr-meta": {
    gridArea: "meta",
    display: "none",
    justifyContent: "flex-end",
    gap: "3",
    minW: "0",
    maxW: "16rem",
    overflow: "hidden",
    xl: { display: "flex" },
  },
  "& .dr-meta-button": {
    flexShrink: "1",
    maxW: "10rem",
    cursor: "pointer",
    bg: "transparent",
    borderRadius: "l1",
    px: "1",
    mx: "-1",
    transitionProperty: "color, background-color",
    transitionDuration: "120ms",
    _hover: { color: "fg.default", bg: "bg.hover" },
  },
  "& .dr-meta-key": { color: "fg.subtle" },
  "& .dr-path": {
    gridArea: "path",
    justifySelf: "start",
    maxW: "full",
    fontFamily: "mono",
    textDecoration: "none",
    _hover: { color: "fg.default", textDecoration: "underline" },
  },
  "& .dr-time": {
    gridArea: "time",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  "& .dr-snippet": {
    gridArea: "snippet",
    fontSize: "xs",
    color: "fg.muted",
    lineClamp: "2",
    minW: "0",
  },
});

export const DocRow = (props: DocRowProps) => {
  const snippet = () => stripLeadingTitle(props.snippet, props.title);
  const isInteractive = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest("a, button, input, label, [data-row-control]");

  return (
    <li
      data-doc-id={props.id}
      data-active={props.active ? "" : undefined}
      data-selected={props.selected ? "" : undefined}
      data-selection-mode={props.selectionMode ? "" : undefined}
      aria-selected={props.active ? "true" : undefined}
      // Shift-click extends the selection; keep it from selecting page text.
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        if (isInteractive(e.target)) return;
        if (props.selectionMode) {
          props.onToggleSelect?.(props.id, !props.selected, e.shiftKey);
          return;
        }
        props.onActivate?.(props.id);
      }}
    >
      <div class="dr-check" data-row-control>
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

      <div class="dr-title">
        <DocHoverPreviewLink
          href={`/docs/${props.id}`}
          title={props.title}
          updatedAt={props.updatedAt}
          path={props.path}
          meta={props.meta}
          snippet={props.snippet}
          previewDoc={props.previewDoc}
          previewId={props.id}
          triggerClass="dr-title-link"
          onNavigate={() => props.onResultOpen?.(props.id)}
        >
          <Show when={props.query} fallback={props.title || "Untitled"}>
            {(query) => renderHighlighted(props.title, query())}
          </Show>
        </DocHoverPreviewLink>
        <Show when={props.share}>
          {(share) => (
            <span
              class="dr-shared"
              title={`Shared at ${share().shareUrl}`}
              aria-label="Shared"
            >
              <GlobeIcon size={13} />
            </span>
          )}
        </Show>
        <Show when={props.collection}>
          {(collection) => (
            <a
              href={`/collections/${collection().id}`}
              class="dr-collection"
              title={`Row in ${collection().name}`}
            >
              {collection().icon ? `${collection().icon} ` : ""}
              {collection().name}
            </a>
          )}
        </Show>
      </div>

      <div class="dr-meta">
        <For each={getTopMetaEntries(props.meta as never)}>
          {([k, v]) => (
            <button
              type="button"
              class="dr-cell dr-meta-button"
              title={`Filter by ${k}: ${v}`}
              onClick={() => props.onFilterMeta?.(k, v)}
            >
              <span class="dr-meta-key">{k}:</span> {v}
            </button>
          )}
        </For>
      </div>

      <Show when={props.path}>
        {(path) => (
          <a
            href={pathToRoute(path())}
            class="dr-cell dr-path"
            title={path()}
          >
            <Show when={props.query} fallback={path()}>
              {(query) => renderHighlighted(path(), query())}
            </Show>
          </a>
        )}
      </Show>

      <span
        class="dr-cell dr-time"
        title={`Updated ${formatAbsoluteTime(props.updatedAt)}`}
      >
        {formatRelativeTime(props.updatedAt, props.nowMs)}
      </span>

      <Show when={snippet()}>
        {(text) => (
          <div class="dr-snippet">
            <Show when={props.query} fallback={text()}>
              {(query) => renderHighlighted(text(), query())}
            </Show>
          </div>
        )}
      </Show>
    </li>
  );
};
