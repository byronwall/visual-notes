import { For, Match, Show, Suspense, Switch } from "solid-js";
import { createAsync, useLocation } from "@solidjs/router";
import {
  DatabaseIcon,
  FileTextIcon,
  HashIcon,
  TelescopeIcon,
  WaypointsIcon,
} from "lucide-solid";
import { Box, Stack } from "styled-system/jsx";
import { css } from "styled-system/css";
import { useDocPreviewMap } from "~/features/docs-index/hooks/useDocPreviewMap";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import { fetchRecentItems } from "~/services/recents/recents.queries";
import type { RecentItem, RecentKind } from "~/services/recents/recents.types";
import type { SidebarNavIcon } from "./nav-items";
import { sidebarRowClass } from "./SidebarNavLink";

/** A malformed escape in the URL must not take down the sidebar. */
const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const PLACEHOLDER_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

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

const recentRowClass = css({
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

const timeClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  flexShrink: "0",
});

const sectionLabelClass = css({
  px: "2",
  pt: "1",
  pb: "1",
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.subtle",
});

const RecentRowBody = (props: { item: RecentItem }) => {
  const Icon = KIND_ICONS[props.item.kind];
  return (
    <>
      <span class={kindIconClass} aria-label={KIND_LABELS[props.item.kind]} role="img">
        <Show when={props.item.icon} fallback={<Icon size={14} strokeWidth={1.8} />}>
          {props.item.icon}
        </Show>
      </span>
      <span class={titleClass}>{props.item.title}</span>
      <span class={timeClass}>
        {formatRelativeTime(props.item.at).replace(" ago", "")}
      </span>
    </>
  );
};

/**
 * Recently visited or edited things of every kind (notes, collections,
 * research topics, tags, paths), newest first. Fills the rest of the sidebar.
 */
export const AppSidebarRecent = (props: { expanded: boolean }) => {
  const location = useLocation();
  const items = createAsync(() => fetchRecentItems(30));
  const previewDocsById = useDocPreviewMap(() =>
    (items() || []).filter((item) => item.kind === "note").map((item) => item.id)
  );
  const isCurrent = (item: RecentItem) =>
    safeDecode(location.pathname) === safeDecode(item.href);

  return (
    <Show when={props.expanded}>
      <Box
        as="section"
        aria-label="Recent"
        display="flex"
        flexDirection="column"
        minH="0"
        h="100%"
      >
        <Box class={sectionLabelClass}>Recent</Box>
        <Suspense
          fallback={
            <Stack gap="0.5" aria-hidden="true">
              <For each={PLACEHOLDER_ROWS}>
                {() => (
                  <Box h="7" px="2" display="flex" alignItems="center" gap="2">
                    <Box boxSize="3.5" borderRadius="l1" bg="gray.a3" />
                    <Box h="2.5" w="65%" borderRadius="l1" bg="gray.a3" />
                  </Box>
                )}
              </For>
            </Stack>
          }
        >
          <Show
            when={(items()?.length ?? 0) > 0}
            fallback={
              <Box px="2" py="1.5" fontSize="sm" color="fg.subtle">
                Nothing visited yet
              </Box>
            }
          >
            <Stack
              as="ul"
              gap="0.5"
              m="0"
              p="0"
              listStyle="none"
              flex="1"
              minH="0"
              overflowY="auto"
            >
              <For each={items()}>
                {(item) => (
                  <li>
                    <Switch>
                      <Match when={item.kind === "note"}>
                        <DocHoverPreviewLink
                          href={item.href}
                          title={item.title}
                          updatedAt={item.updatedAt ?? item.at}
                          path={item.path}
                          meta={item.meta}
                          previewDoc={previewDocsById().get(item.id) || null}
                          ariaCurrent={isCurrent(item) ? "page" : undefined}
                          triggerClass={`${sidebarRowClass} ${recentRowClass}`}
                          density="compact"
                        >
                          <RecentRowBody item={item} />
                        </DocHoverPreviewLink>
                      </Match>
                      <Match when={item.kind !== "note"}>
                        <a
                          href={item.href}
                          class={`${sidebarRowClass} ${recentRowClass}`}
                          data-density="compact"
                          aria-current={isCurrent(item) ? "page" : undefined}
                        >
                          <RecentRowBody item={item} />
                        </a>
                      </Match>
                    </Switch>
                  </li>
                )}
              </For>
            </Stack>
          </Show>
        </Suspense>
      </Box>
    </Show>
  );
};
