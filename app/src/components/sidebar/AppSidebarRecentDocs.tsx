import { For, Show, Suspense } from "solid-js";
import { createAsync } from "@solidjs/router";
import { Box, Stack } from "styled-system/jsx";
import { Link } from "~/components/ui/link";
import { fetchDocs } from "~/features/docs-index/data/docs.service";

type AppSidebarRecentDocsProps = {
  expanded: boolean;
};

const PLACEHOLDER_ROWS = [0, 1, 2, 3, 4];
const MAX_TITLE_LEN = 32;

const clipTitle = (title: string) => {
  const trimmed = title.trim();
  if (!trimmed) return "Untitled";
  if (trimmed.length <= MAX_TITLE_LEN) return trimmed;
  return `${trimmed.slice(0, MAX_TITLE_LEN - 3)}...`;
};

export const AppSidebarRecentDocs = (props: AppSidebarRecentDocsProps) => {
  const items = createAsync(() => fetchDocs({ take: 10 }));

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
                  const title = () => clipTitle(item.title || "Untitled");

                  return (
                    <Link
                      href={href()}
                      variant="plain"
                      px="3"
                      py="1.5"
                      borderRadius="l2"
                      color="fg.muted"
                      _hover={{ bg: "bg.muted", color: "fg.default" }}
                      title={item.title || "Untitled"}
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
                    </Link>
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
