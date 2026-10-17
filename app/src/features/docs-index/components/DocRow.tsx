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

const rowClass = css({
  display: "grid",
  gridTemplateColumns: "1.5rem minmax(0, 1fr) auto",
  gridTemplateAreas: `"check title side" ". snippet snippet"`,
  columnGap: "2",
  rowGap: "0.5",
  alignItems: "center",
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
  smDown: {
    gridTemplateColumns: "1.5rem minmax(0, 1fr)",
    gridTemplateAreas: `"check title" ". side" ". snippet"`,
  },
});

const titleLinkClass = css({
  display: "inline",
  minW: "0",
  color: "fg.default",
  fontSize: "sm",
  fontWeight: "medium",
  lineHeight: "1.35",
  textDecoration: "none",
  overflowWrap: "anywhere",
  _hover: { textDecoration: "underline", textUnderlineOffset: "2px" },
});

const sideClass = css({
  gridArea: "side",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "3",
  minW: "0",
  fontSize: "xs",
  color: "fg.muted",
  whiteSpace: "nowrap",
  smDown: { justifyContent: "flex-start", flexWrap: "wrap", gap: "2" },
});

const pathLinkClass = css({
  fontFamily: "mono",
  fontSize: "xs",
  color: "fg.muted",
  textDecoration: "none",
  maxW: "18rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  _hover: { color: "fg.default", textDecoration: "underline" },
});

const metaButtonClass = css({
  color: "fg.muted",
  cursor: "pointer",
  bg: "transparent",
  borderRadius: "l1",
  px: "1",
  mx: "-1",
  transitionProperty: "color, background-color",
  transitionDuration: "120ms",
  _hover: { color: "fg.default", bg: "gray.subtle.bg" },
  smDown: { display: "none" },
});

const timeClass = css({
  minW: "3.25rem",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  smDown: { minW: "0", textAlign: "left" },
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
      <Box gridArea="check" display="flex" class="row-check" data-row-control>
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
      </Box>

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
      </Box>

      <div class={sideClass}>
        <Show when={props.share}>
          {(share) => (
            <Box
              as="span"
              display="inline-flex"
              color="green.11"
              title={`Shared at ${share().shareUrl}`}
              aria-label="Shared"
            >
              <GlobeIcon size={13} />
            </Box>
          )}
        </Show>
        <For each={getTopMetaEntries(props.meta as never)}>
          {([k, v]) => (
            <button
              type="button"
              class={metaButtonClass}
              title={`Filter by ${k} = ${v}`}
              onClick={() => props.onFilterMeta?.(k, v)}
            >
              <Box as="span" color="fg.subtle">
                {k}:
              </Box>{" "}
              {v}
            </button>
          )}
        </For>
        <Show when={props.path}>
          {(path) => (
            <a
              href={pathToRoute(path())}
              class={pathLinkClass}
              title={`Open path ${path()}`}
            >
              <Show when={props.query} fallback={path()}>
                {(query) => renderHighlighted(path(), query())}
              </Show>
            </a>
          )}
        </Show>
        <span
          class={timeClass}
          title={`Updated ${formatAbsoluteTime(props.updatedAt)}`}
        >
          {formatRelativeTime(props.updatedAt)}
        </span>
      </div>

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
