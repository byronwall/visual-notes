import { revalidate } from "@solidjs/router";
import { BotMessageSquareIcon } from "lucide-solid";
import { createSignal, For, Show, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { fetchTaskAnnotations } from "~/services/annotations/annotations.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";
import { NoteToAiForm } from "./NoteToAiButton";
import { RequestStatusBadge, RequestThread } from "./RequestThread";

/** Notes to AI on one task: each request with its thread, and a way to add one. */
export const TaskRequests: VoidComponent<{ taskId: string }> = (props) => {
  const requests = createKeptAsync(
    () => fetchTaskAnnotations(props.taskId),
    onDemand,
  );
  const [adding, setAdding] = createSignal(false);
  const refresh = () =>
    void revalidate(fetchTaskAnnotations.keyFor(props.taskId));

  return (
    <Stack gap="2" data-testid="task-requests">
      <For each={requests.latest ?? []}>
        {(request) => (
          <Box borderWidth="1px" borderColor="border" borderRadius="l2" p="2">
            <HStack gap="2" justify="space-between">
              <Box fontSize="sm" whiteSpace="pre-wrap">
                {request.body}
              </Box>
              <RequestStatusBadge request={request} />
            </HStack>
            <RequestThread request={request} onChanged={refresh} />
          </Box>
        )}
      </For>
      <Show
        when={adding()}
        fallback={
          <HStack>
            <Button
              size="xs"
              variant="outline"
              data-testid="task-note-to-ai"
              onClick={() => setAdding(true)}
            >
              <BotMessageSquareIcon />
              Note to AI
            </Button>
          </HStack>
        }
      >
        <NoteToAiForm
          target={{ taskId: props.taskId }}
          onDone={() => setAdding(false)}
        />
      </Show>
    </Stack>
  );
};
