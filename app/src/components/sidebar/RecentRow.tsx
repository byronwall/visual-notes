import { Show, createSignal } from "solid-js";
import {
  DatabaseIcon,
  FileTextIcon,
  HashIcon,
  TelescopeIcon,
  WaypointsIcon,
} from "lucide-solid";
import { css } from "styled-system/css";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import { Tooltip } from "~/components/ui/tooltip";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import type { RecentItem, RecentKind } from "~/services/recents/recents.types";
import type { SidebarNavIcon } from "./nav-items";
import { sidebarRowClass } from "./SidebarNavLink";

const KIND_ICONS: Record<RecentKind, SidebarNavIcon> = {
  note: FileTextIcon,
  collection: DatabaseIcon,
  research: TelescopeIcon,
  tag: HashIcon,
  path: WaypointsIcon,
};

const KIND_LABELS: Record<RecentKind, string> = {
  note: "Note",
  collection: "Collection",
  research: "Research topic",
  tag: "Tag",
  path: "Path",
};

const rowClass = css({
  "&[aria-current=page]": { fontWeight: "normal" },
});

const kindIconClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "4",
  flexShrink: "0",
  color: "fg.subtle",
  fontSize: "xs",
  lineHeight: "1",
});

const titleClass = css({
  flex: "1",
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const pathTitleClass = css({
  flex: "1",
  minW: "0",
  display: "flex",
  whiteSpace: "nowrap",
});

// Truncates from the left so the end of the parent path stays next to the leaf.
const pathParentClass = css({
  minW: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  direction: "rtl",
  color: "fg.subtle",
});

const pathLeafClass = css({
  flexShrink: "0",
  maxW: "full",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const timeClass = css({
  minW: "5",
  textAlign: "right",
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  flexShrink: "0",
});

/** "now", "4m", "3h", "2d": the sidebar has no room for "ago". */
export const compactAge = (iso: string, now: number) =>
  now - new Date(iso).getTime() < 60_000
    ? "now"
    : formatRelativeTime(iso, now).replace(" ago", "");

/** Splits "a.b.c" into parent "a.b." and leaf "c" so the leaf never truncates. */
const splitPath = (path: string) => {
  const cut = path.lastIndexOf(".");
  return cut < 0
    ? { leaf: path, parent: "" }
    : { leaf: path.slice(cut + 1), parent: path.slice(0, cut + 1) };
};

const RowBody = (props: {
  item: RecentItem;
  now: number;
  titleRef?: (el: HTMLSpanElement) => void;
}) => {
  const Icon = KIND_ICONS[props.item.kind];
  const path = () => splitPath(props.item.title);
  return (
    <>
      <span class={kindIconClass} aria-label={KIND_LABELS[props.item.kind]} role="img">
        <Show when={props.item.icon} fallback={<Icon size={14} strokeWidth={1.8} />}>
          {props.item.icon}
        </Show>
      </span>
      <Show
        when={props.item.kind === "path"}
        fallback={
          <span class={titleClass} ref={props.titleRef}>
            {props.item.title}
          </span>
        }
      >
        <span class={pathTitleClass} ref={props.titleRef}>
          <Show when={path().parent}>
            {/* LRM marks keep the dots in place inside the rtl box. */}
            <span class={pathParentClass}>{`\u200E${path().parent}\u200E`}</span>
          </Show>
          <span class={pathLeafClass}>{path().leaf}</span>
        </span>
      </Show>
      <span class={timeClass}>{compactAge(props.item.at, props.now)}</span>
    </>
  );
};

/**
 * One Recent row. Notes get the hover preview; other kinds show their full
 * name in a tooltip, but only when the row truncates it.
 */
export const RecentRow = (props: {
  item: RecentItem;
  now: number;
  current: boolean;
  previewDoc?: { previewText?: string } | null;
}) => {
  let titleEl: HTMLSpanElement | undefined;
  const [open, setOpen] = createSignal(false);
  const truncated = () =>
    !!titleEl &&
    [titleEl, ...titleEl.children].some((el) => el.scrollWidth > el.clientWidth);

  return (
    <Show
      when={props.item.kind !== "note"}
      fallback={
        <DocHoverPreviewLink
          href={props.item.href}
          title={props.item.title}
          updatedAt={props.item.updatedAt ?? props.item.at}
          path={props.item.path}
          meta={props.item.meta}
          previewDoc={props.previewDoc ?? null}
          ariaCurrent={props.current ? "page" : undefined}
          triggerClass={`${sidebarRowClass} ${rowClass}`}
          density="compact"
        >
          <RowBody item={props.item} now={props.now} />
        </DocHoverPreviewLink>
      }
    >
      <Tooltip
        content={`${KIND_LABELS[props.item.kind]}: ${props.item.title}`}
        open={open()}
        onOpenChange={(details) => setOpen(details.open && truncated())}
        openDelay={200}
        closeDelay={0}
        positioning={{ placement: "right", gutter: 8 }}
      >
        <a
          href={props.item.href}
          class={`${sidebarRowClass} ${rowClass}`}
          data-density="compact"
          aria-current={props.current ? "page" : undefined}
        >
          <RowBody item={props.item} now={props.now} titleRef={(el) => (titleEl = el)} />
        </a>
      </Tooltip>
    </Show>
  );
};
