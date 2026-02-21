import type { Accessor } from "solid-js";
import { Show, Suspense } from "solid-js";
import { BotMessageSquareIcon, FilePlusIcon, SearchIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Box, HStack, Stack, VisuallyHidden } from "styled-system/jsx";

type AppSidebarActionsProps = {
  expanded: boolean;
  onChatOpen: () => void;
  onNewNoteOpen: () => void;
  onSearchOpen: () => void;
  hasUnreadAny: Accessor<boolean>;
  hasLoadingAny: Accessor<boolean>;
};

export const AppSidebarActions = (props: AppSidebarActionsProps) => {
  return (
    <Stack gap="1">
      <Button
        variant="plain"
        size="sm"
        w="full"
        justifyContent={props.expanded ? "flex-start" : "center"}
        onClick={props.onNewNoteOpen}
        title="New Note (⌘D)"
        color="fg.muted"
        _hover={{ bg: "bg.muted", color: "fg.default" }}
      >
        <FilePlusIcon size={18} strokeWidth={1.8} aria-hidden="true" />
        <Show when={props.expanded}>
          <HStack w="full" justify="space-between">
            <Box as="span">New Note</Box>
            <Box as="span" fontSize="xs" color="fg.subtle">
              ⌘D
            </Box>
          </HStack>
        </Show>
        <Show when={!props.expanded}>
          <VisuallyHidden>New Note</VisuallyHidden>
        </Show>
      </Button>
      <Button
        variant="plain"
        size="sm"
        w="full"
        justifyContent={props.expanded ? "flex-start" : "center"}
        onClick={props.onSearchOpen}
        title="Search (⌘K)"
        color="fg.muted"
        _hover={{ bg: "bg.muted", color: "fg.default" }}
      >
        <SearchIcon size={18} strokeWidth={1.8} aria-hidden="true" />
        <Show when={props.expanded}>
          <HStack w="full" justify="space-between">
            <Box as="span">Search</Box>
            <Box as="span" fontSize="xs" color="fg.subtle">
              ⌘K
            </Box>
          </HStack>
        </Show>
        <Show when={!props.expanded}>
          <VisuallyHidden>Search</VisuallyHidden>
        </Show>
      </Button>
      <Button
        variant="plain"
        size="sm"
        w="full"
        justifyContent={props.expanded ? "flex-start" : "center"}
        onClick={props.onChatOpen}
        title="Chat (⌘I)"
        color="fg.muted"
        _hover={{ bg: "bg.muted", color: "fg.default" }}
      >
        <BotMessageSquareIcon
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <Show when={props.expanded}>
          <HStack w="full" justify="space-between" minW="0">
            <Box as="span">Chat</Box>
            <HStack gap="2" alignItems="center">
              <Suspense fallback={null}>
                <Box as="span" display="inline-flex" alignItems="center">
                  <VisuallyHidden>Chat status</VisuallyHidden>
                  <Show when={props.hasUnreadAny()}>
                    <Box as="span" boxSize="2" borderRadius="full" bg="blue.9" />
                  </Show>
                  <Show when={!props.hasUnreadAny() && props.hasLoadingAny()}>
                    <Box as="span" boxSize="2" borderRadius="full" bg="amber.9" />
                  </Show>
                </Box>
              </Suspense>
              <Box as="span" fontSize="xs" color="fg.subtle">
                ⌘I
              </Box>
            </HStack>
          </HStack>
        </Show>
        <Show when={!props.expanded}>
          <VisuallyHidden>Chat</VisuallyHidden>
          <Suspense fallback={null}>
            <Box as="span" display="inline-flex" alignItems="center">
              <VisuallyHidden>Chat status</VisuallyHidden>
              <Show when={props.hasUnreadAny()}>
                <Box
                  as="span"
                  ml="1"
                  boxSize="2"
                  borderRadius="full"
                  bg="blue.9"
                />
              </Show>
              <Show when={!props.hasUnreadAny() && props.hasLoadingAny()}>
                <Box
                  as="span"
                  ml="1"
                  boxSize="2"
                  borderRadius="full"
                  bg="amber.9"
                />
              </Show>
            </Box>
          </Suspense>
        </Show>
      </Button>
    </Stack>
  );
};
