import { For, Show, Suspense } from "solid-js";
import { createAsync } from "@solidjs/router";
import { Box, Stack } from "styled-system/jsx";
import { css } from "styled-system/css";
import { fetchDocs } from "~/features/docs-index/data/docs.service";
import { clipDocTitle } from "~/features/docs-index/utils/doc-preview";
import { useDocPreviewMap } from "~/features/docs-index/hooks/useDocPreviewMap";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";

type AppSidebarRecentDocsProps = {
  expanded: boolean;
};

const PLACEHOLDER_ROWS = [0, 1, 2, 3, 4];
const recentDocLinkClass = css({
  px: "3",
  py: "1.5",
  borderRadius: "l2",
  color: "fg.muted",
  display: "block",
  w: "full",
  textAlign: "left",
  textDecorationLine: "none",
  _hover: {
    bg: "bg.muted",
    color: "fg.default",
    textDecorationLine: "none",
  },
});

export const AppSidebarRecentDocs = (props: AppSidebarRecentDocsProps) => {
  const items = createAsync(() => fetchDocs({ take: 10 }));
  const previewDocsById = useDocPreviewMap(() =>
    (items() || []).map((item) => item.id)
  );

  return (
    <Show when={props.expanded}>
      <Box display="flex" flexDirection="column" minH="0" h="100%">
        <Box
          px="3"
          fontSize="xs"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="widest"
        >
          Recent edits
        </Box>
        <Suspense
          fallback={
            <Stack gap="1" mt="1" flex="1" minH="0" overflowY="auto">
              <For each={PLACEHOLDER_ROWS}>
                {() => (
                  <Box
                    px="3"
                    py="1.5"
                    borderRadius="l2"
                    bg="bg.muted"
                    opacity="0.35"
                  />
                )}
              </For>
            </Stack>
          }
        >
          <Show
            when={(items()?.length ?? 0) > 0}
            fallback={
              <Box px="3" py="2" fontSize="sm" color="fg.muted">
                No recent docs
              </Box>
            }
          >
            <Stack gap="1" mt="1" flex="1" minH="0" overflowY="auto">
              <For each={items()}>
                {(item) => {
                  const href = () => `/docs/${item.id}`;
                  const title = () => clipDocTitle(item.title || "Untitled");
                  const previewDoc = () => previewDocsById().get(item.id) || null;

                  return (
                    <Box w="full">
                      <DocHoverPreviewLink
                        href={href()}
                        title={item.title || "Untitled"}
                        updatedAt={item.updatedAt}
                        path={item.path}
                        meta={item.meta}
                        previewDoc={previewDoc()}
                        triggerClass={recentDocLinkClass}
                      >
                        <Box
                          as="span"
                          fontSize="sm"
                          whiteSpace="nowrap"
                          overflow="hidden"
                          textOverflow="ellipsis"
                          display="block"
                        >
                          {title()}
                        </Box>
                      </DocHoverPreviewLink>
                    </Box>
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
