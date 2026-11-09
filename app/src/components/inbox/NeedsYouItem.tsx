import { A, useAction } from "@solidjs/router";
import { createSignal, Match, Show, Switch, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { RequestThread } from "~/components/annotations/RequestThread";
import { Button } from "~/components/ui/button";
import type { InboxItem } from "~/lib/annotations/inbox-types";
import {
  closeRequestAction,
  dismissInboxItemAction,
} from "~/services/annotations/annotations.actions";
import { ago, placeHref, REASON_LABEL } from "./inbox-format";

// One row in "Needs you": what happened, where, the last word from the agent,
// and the one or two actions that finish it.

const pendingEdits = (n: number) => (n === 1 ? "1 edit" : `${n} edits`);

const titleLinkClass = { "font-weight": "600", color: "var(--colors-fg-default)" };

export const NeedsYouItem: VoidComponent<{ item: InboxItem; nowMs: number }> = (props) => {
  const runDismiss = useAction(dismissInboxItemAction);
  const runClose = useAction(closeRequestAction);
  const [threadOpen, setThreadOpen] = createSignal(false);

  const color = () =>
    props.item.reason === "proposal" ? "green" : props.item.reason === "research" ? "gray" : props.item.color;
  const lastAgentMessage = () => {
    if (props.item.reason === "proposal" || props.item.reason === "research") return null;
    return [...props.item.annotation.messages].reverse().find((m) => m.author !== "you") ?? null;
  };
  const dismiss = (kind: "annotation" | "research", id: string) => void runDismiss({ kind, id });

  return (
    <Box
      as="li"
      data-testid="inbox-item"
      data-reason={props.item.reason}
      position="relative"
      pl="4"
      pr="3"
      py="3"
      borderBottomWidth="1px"
      borderColor="border"
    >
      <Box
        position="absolute"
        left="0"
        top="3"
        bottom="3"
        w="1"
        borderRadius="full"
        style={{ "background-color": `var(--colors-${color()}-9)` }}
      />
      <HStack gap="2" fontSize="xs" color="fg.muted" flexWrap="wrap">
        <Box fontWeight="semibold" color="fg.default">
          {REASON_LABEL[props.item.reason]}
        </Box>
        <Box>·</Box>
        <Switch>
          <Match when={props.item.reason === "research" && props.item}>
            {(item) => (
              <A href={`/research/${item().topicSlug}`} style={titleLinkClass}>
                {item().topicTitle}
              </A>
            )}
          </Match>
          <Match when={props.item.reason !== "research" && props.item}>
            {(item) => (
              <A
                href={placeHref(item().place)}
                style={titleLinkClass}
                onClick={() => {
                  const current = item();
                  if (current.reason === "agent-note" || current.reason === "agent-reply") {
                    dismiss("annotation", current.annotation.id);
                  }
                }}
              >
                {item().place.title}
              </A>
            )}
          </Match>
        </Switch>
        <Box ml="auto">{ago(props.item.at, props.nowMs)}</Box>
      </HStack>

      <Switch>
        <Match when={props.item.reason === "proposal" && props.item}>
          {(item) => (
            <Stack gap="1.5" mt="1">
              <Box fontSize="sm">
                {item().proposal.author} suggested {pendingEdits(item().proposal.ops.filter((op) => op.state === "pending").length)}
                {item().proposal.summary ? `: ${item().proposal.summary}` : ""}
              </Box>
              <HStack>
                <A href={placeHref(item().place)}>
                  <Button size="xs">Review in the note</Button>
                </A>
              </HStack>
            </Stack>
          )}
        </Match>
        <Match when={props.item.reason === "research" && props.item}>
          {(item) => (
            <Stack gap="1" mt="1">
              <Box fontSize="sm" color="fg.muted">
                “{item().body}”{item().cardTitle ? ` on ${item().cardTitle}` : ""}
              </Box>
              <Show when={item().resolution}>
                <Box fontSize="sm" pl="2" borderLeftWidth="2px" borderColor="green.7">
                  {item().resolution}
                </Box>
              </Show>
              <HStack justify="flex-end">
                <Button size="xs" variant="outline" onClick={() => dismiss("research", item().commentId)}>
                  Dismiss
                </Button>
              </HStack>
            </Stack>
          )}
        </Match>
        <Match when={props.item.reason !== "proposal" && props.item.reason !== "research" && props.item}>
          {(item) => (
            <Stack gap="1.5" mt="1">
              <Show when={item().annotation.quote}>
                <Box fontSize="xs" color="fg.muted" fontStyle="italic" lineClamp="2">
                  “{item().annotation.quote}”
                </Box>
              </Show>
              <Box fontSize="sm" whiteSpace="pre-wrap">
                <Show when={item().reason === "agent-note"} fallback={item().annotation.body}>
                  <Box as="span" color="fg.muted">
                    {item().annotation.author}:{" "}
                  </Box>
                  {item().annotation.body}
                </Show>
              </Box>
              <Show when={!threadOpen() && lastAgentMessage()}>
                {(message) => (
                  <Box fontSize="sm" pl="2" borderLeftWidth="2px" borderColor="green.7" whiteSpace="pre-wrap">
                    <Box fontSize="2xs" fontWeight="semibold" color="fg.muted">
                      {message().author}
                    </Box>
                    {message().body}
                  </Box>
                )}
              </Show>
              <Show when={threadOpen()}>
                <RequestThread request={item().annotation} />
              </Show>
              <HStack gap="1.5" justify="flex-end">
                <Show when={item().annotation.status && !threadOpen()}>
                  <Button size="xs" variant="outline" onClick={() => setThreadOpen(true)}>
                    Reply
                  </Button>
                </Show>
                <Show when={item().reason === "ready"}>
                  <Button size="xs" data-testid="inbox-close" onClick={() => void runClose(item().annotation.id)}>
                    Close
                  </Button>
                </Show>
                <Show when={item().reason !== "ready"}>
                  <Button size="xs" variant="outline" onClick={() => dismiss("annotation", item().annotation.id)}>
                    Dismiss
                  </Button>
                </Show>
              </HStack>
            </Stack>
          )}
        </Match>
      </Switch>
    </Box>
  );
};
