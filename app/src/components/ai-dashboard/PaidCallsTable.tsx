import { createAsync } from "@solidjs/router";
import { For, Show, type VoidComponent } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { fetchPaidCalls } from "~/services/ai/ai-runs.queries";

const triggerLabel = (trigger: string | null) => {
  if (!trigger) return "Prompt or chat";
  const [scope, ...rest] = trigger.split(":");
  if (scope === "sweep") return `Sweep (${rest.join(", ")})`;
  if (scope === "cleanup") return `Cleanup: ${rest.join(" ")}`;
  return trigger[0].toUpperCase() + trigger.slice(1);
};

/** Every recorded paid call, newest first, with what started it. */
export const PaidCallsTable: VoidComponent = () => {
  const calls = createAsync(() => fetchPaidCalls());
  return (
    <Show
      when={calls.latest?.length}
      fallback={
        <Text px="3" py="4" fontSize="sm" color="fg.muted">
          No paid calls recorded yet.
        </Text>
      }
    >
      <Box px="3" data-testid="paid-calls">
        <For each={calls.latest}>
          {(call) => (
            <HStack
              gap="3"
              py="1"
              fontSize="xs"
              borderBottomWidth="1px"
              borderColor="border"
            >
              <Text as="span" fontSize="xs" color="fg.muted" w="36" flexShrink="0">
                {new Date(call.createdAt).toLocaleString("en-US", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "UTC",
                })}{" "}
                UTC
              </Text>
              <Text as="span" fontSize="xs" flex="1" minW="0">
                <Show when={call.noteId} fallback={triggerLabel(call.trigger)}>
                  <Link href={`/docs/${call.noteId}`} fontSize="xs">
                    {triggerLabel(call.trigger)}
                  </Link>
                </Show>
              </Text>
              <Text as="span" fontSize="xs" color="fg.muted">
                {call.model}
              </Text>
              <Text
                as="span"
                fontSize="xs"
                color={call.status === "ERROR" ? "fg.error" : "fg.muted"}
                w="24"
                textAlign="right"
                fontVariantNumeric="tabular-nums"
              >
                {call.status === "ERROR"
                  ? "failed"
                  : `${(call.totalTokens ?? 0).toLocaleString("en-US")} tokens`}
              </Text>
            </HStack>
          )}
        </For>
      </Box>
    </Show>
  );
};
