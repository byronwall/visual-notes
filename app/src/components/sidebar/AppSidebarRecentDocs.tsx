import { For, Show, Suspense } from "solid-js";
import { createAsync, useLocation } from "@solidjs/router";
import { Box, Stack } from "styled-system/jsx";
import { css } from "styled-system/css";
import { fetchDocs } from "~/features/docs-index/data/docs.service";
import { useDocPreviewMap } from "~/features/docs-index/hooks/useDocPreviewMap";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import { sidebarRowClass } from "./SidebarNavLink";

type AppSidebarRecentDocsProps = {
  expanded: boolean;
};

const PLACEHOLDER_ROWS = [0, 1, 2, 3, 4, 5];

const recentDocLinkClass = css({
  gap: "2",
  "&[aria-current=page]": { fontWeight: "normal" },
});

const recentTimeClass = css({
  fontSize: "xs",
  color: "fg.subtle",
  fontVariantNumeric: "tabular-nums",
  flexShrink: "0",
});

const sectionLabelClass = css({
  px: "2.5",
  pb: "1",
  fontSize: "xs",
  fontWeight: "medium",
  color: "fg.subtle",
});

export const AppSidebarRecentDocs = (props: AppSidebarRecentDocsProps) => {
  const location = useLocation();
  const items = createAsync(() =>
    fetchDocs({ sortMode: "relevance", take: 12 })
  );
  const previewDocsById = useDocPreviewMap(() =>
    (items() || []).map((item) => item.id)
  );

  const isCurrentDoc = (id: string) => location.pathname === `/docs/${id}`;

  return (
    <Show when={props.expanded}>
      <Box
        as="section"
        aria-label="Recent edits"
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
                  <Box h="8" px="2.5" display="flex" alignItems="center">
                    <Box h="2.5" w="70%" borderRadius="l1" bg="gray.a3" />
                  </Box>
                )}
              </For>
            </Stack>
          }
        >
          <Show
            when={(items()?.length ?? 0) > 0}
            fallback={
              <Box px="2.5" py="1.5" fontSize="sm" color="fg.subtle">
                No notes yet
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
                {(item) => {
                  const previewDoc = () =>
                    previewDocsById().get(item.id) || null;

                  return (
                    <li>
                      <DocHoverPreviewLink
                        href={`/docs/${item.id}`}
                        title={item.title || "Untitled"}
                        updatedAt={item.updatedAt}
                        path={item.path}
                        meta={item.meta}
                        previewDoc={previewDoc()}
                        ariaCurrent={isCurrentDoc(item.id) ? "page" : undefined}
                        triggerClass={`${sidebarRowClass} ${recentDocLinkClass}`}
                      >
                        <Box
                          as="span"
                          flex="1"
                          minW="0"
                          overflow="hidden"
                          textOverflow="ellipsis"
                        >
                          {item.title || "Untitled"}
                        </Box>
                        <span class={recentTimeClass}>
                          {formatRelativeTime(item.updatedAt).replace(" ago", "")}
                        </span>
                      </DocHoverPreviewLink>
                    </li>
                  );
                }}
              </For>
            </Stack>
          </Show>
        </Suspense>
      </Box>
    </Show>
  );
};
