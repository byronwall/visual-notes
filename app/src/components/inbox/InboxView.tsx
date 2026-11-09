import { A } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { RequestStatusBadge } from "~/components/annotations/RequestThread";
import type { UserInbox } from "~/lib/annotations/inbox-types";
import { ago, placeHref } from "./inbox-format";
import { NeedsYouItem } from "./NeedsYouItem";

// The central inbox: "Needs you" first, then requests still with agents,
// then a collapsed log of agent runs.

const sectionTitle = (text: string, count: number) => (
  <HStack gap="2" px="1" alignItems="baseline">
    <Box as="h2" fontSize="sm" fontWeight="semibold">
      {text}
    </Box>
    <Box fontSize="sm" color="fg.subtle">
      {count}
    </Box>
  </HStack>
);

export const InboxView: VoidComponent<{ inbox: UserInbox }> = (props) => {
  // Times start from the server's clock so SSR and hydration match.
  const [nowMs, setNowMs] = createSignal(Date.parse(props.inbox.generatedAt));
  const [runsOpen, setRunsOpen] = createSignal(false);
  onMount(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 60_000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <Stack gap="6">
      <Stack gap="1" data-testid="inbox-needs-you">
        {sectionTitle("Needs you", props.inbox.needsYou.length)}
        <Show
          when={props.inbox.needsYou.length > 0}
          fallback={
            <Box px="1" py="4" fontSize="sm" color="fg.muted">
              Nothing waits on you. Agent replies, suggested edits, and agent notes show up here.
            </Box>
          }
        >
          <Box as="ul" listStyle="none" m="0" p="0" borderTopWidth="1px" borderColor="border">
            <For each={props.inbox.needsYou}>{(item) => <NeedsYouItem item={item} nowMs={nowMs()} />}</For>
          </Box>
        </Show>
      </Stack>

      <Stack gap="1" data-testid="inbox-waiting">
        {sectionTitle("With agents", props.inbox.waiting.length)}
        <Box as="ul" listStyle="none" m="0" p="0">
          <For each={props.inbox.waiting}>
            {(item) => (
              <HStack as="li" gap="2" px="1" py="1.5" fontSize="sm" borderBottomWidth="1px" borderColor="border">
                <Box w="2" h="2" borderRadius="full" flexShrink="0" style={{ "background-color": `var(--colors-${item.color}-9)` }} />
                <Box flex="1" minW="0" truncate>
                  {item.annotation.body || item.annotation.quote || item.typeName}
                </Box>
                <A href={placeHref(item.place)} style={{ color: "var(--colors-fg-muted)" }}>
                  <Box maxW="48" truncate fontSize="xs">
                    {item.place.title}
                  </Box>
                </A>
                <RequestStatusBadge request={item.annotation} />
                <Box fontSize="xs" color="fg.subtle" w="8" textAlign="right">
                  {ago(item.at, nowMs())}
                </Box>
              </HStack>
            )}
          </For>
        </Box>
      </Stack>

      <Stack gap="1" data-testid="inbox-runs">
        <HStack justify="space-between" px="1">
          <button type="button" onClick={() => setRunsOpen((v) => !v)} aria-expanded={runsOpen()}>
            {sectionTitle(`Agent activity ${runsOpen() ? "▾" : "▸"}`, props.inbox.runs.length)}
          </button>
          <A href="/activity?domain=mcp" style={{ "font-size": "var(--font-sizes-xs)", color: "var(--colors-fg-muted)" }}>
            Every call
          </A>
        </HStack>
        <Show when={runsOpen()}>
          <Box as="ul" listStyle="none" m="0" p="0">
            <For each={props.inbox.runs}>
              {(run) => (
                <HStack as="li" gap="2" px="1" py="1.5" fontSize="sm" borderBottomWidth="1px" borderColor="border" data-testid="inbox-run">
                  <Box fontWeight="medium" w="28" truncate>
                    {run.agent}
                  </Box>
                  <Box color="fg.muted" fontSize="xs" flex="1" minW="0" truncate>
                    {run.calls} calls · {run.writes} writes{run.problems ? ` · ${run.problems} refused` : ""} ·{" "}
                    {run.tools.slice(0, 4).map((t) => `${t.tool} ×${t.calls}`).join(", ")}
                  </Box>
                  <Box fontSize="xs" color="fg.subtle">
                    {ago(run.end, nowMs())}
                  </Box>
                </HStack>
              )}
            </For>
          </Box>
        </Show>
      </Stack>
    </Stack>
  );
};
