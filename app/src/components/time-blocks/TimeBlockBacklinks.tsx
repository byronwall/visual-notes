import { createAsync } from "@solidjs/router";
import { useNavigate } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { fetchTimeBlockBacklinks } from "~/services/time-blocks/time-blocks.service";
import { formatDateOnly, formatTime12 } from "./date-utils";

type Props = {
  noteId: string;
};

export const TimeBlockBacklinks = (props: Props) => {
  const navigate = useNavigate();
  const blocks = createAsync(() =>
    fetchTimeBlockBacklinks({
      noteId: props.noteId,
      take: 25,
    })
  );

  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="lg" p="3">
      <Stack gap="2.5">
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="semibold">Time Blocks Linked To This Note</Text>
          <Button
            size="xs"
            variant="outline"
            onClick={() =>
              navigate(`/time-blocks?noteId=${encodeURIComponent(props.noteId)}`)
            }
          >
            Open Calendar
          </Button>
        </HStack>

        <Show
          when={(blocks() || []).length > 0}
          fallback={<Text color="fg.muted" fontSize="sm">No linked blocks yet.</Text>}
        >
          <Stack gap="2" maxH="180px" overflow="auto" pr="1">
            <For each={blocks() || []}>
              {(block) => (
                <HStack
                  justifyContent="space-between"
                  alignItems="center"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                  px="2.5"
                  py="2"
                >
                  <Stack gap="0">
                    <Text fontSize="sm" fontWeight="medium">
                      {block.title || "Untitled Block"}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      {formatDateOnly(new Date(block.startTime))} · {formatTime12(new Date(block.startTime))} - {formatTime12(new Date(block.endTime))}
                    </Text>
                  </Stack>
                  <Box
                    w="3"
                    h="3"
                    borderRadius="full"
                    borderWidth="1px"
                    borderColor="border"
                    style={{ "background-color": block.color || "var(--colors-blue-500)" }}
                  />
                </HStack>
              )}
            </For>
          </Stack>
        </Show>
      </Stack>
    </Box>
  );
};
