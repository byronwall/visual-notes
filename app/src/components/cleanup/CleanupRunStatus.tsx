import { A, createAsync, revalidate } from "@solidjs/router";
import {
  For,
  Show,
  Suspense,
  onCleanup,
  onMount,
  type VoidComponent,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import type { CleanupStatus } from "~/server/cleanup/status";
import { fetchCleanupStatus } from "~/services/cleanup/cleanup.queries";
import { formatRelativeShort } from "~/components/doc-header/relative-time";

const REFRESH_MS = 20_000;

const PROVIDER_LABELS: Record<string, string> = {
  jev: "Jev",
  openai: "OpenAI",
  heuristic: "Local rules",
};

const compact = (n: number) =>
  n < 1000 ? String(n) : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;

const spend = (w: { calls: number; tokens: number }) =>
  `${w.calls} calls · ${compact(w.tokens)} tokens`;

/** Label and value pairs; dashes hold the rows' space until data arrives. */
function rows(status?: CleanupStatus): Array<[string, string]> {
  const pending = status
    ? `${status.pendingNotes} notes, ${status.pendingPairs} pairs`
    : "–";
  return [
    [
      "Last run",
      status?.lastRunAt ? formatRelativeShort(Date.now(), status.lastRunAt) : "–",
    ],
    ["Pending", pending],
    ["Today", status ? spend(status.today) : "–"],
    ["7 days", status ? spend(status.week) : "–"],
  ];
}

const headline = (status?: CleanupStatus) => {
  if (!status) return "Checking…";
  const name = status.provider
    ? PROVIDER_LABELS[status.provider] ?? status.provider
    : "Sweep off";
  if (status.running) return `${name} · running now`;
  if (!status.provider) return name;
  return `${name} · ${status.sweepPaid ? "paid, idle" : "free, idle"}`;
};

const Body: VoidComponent<{ status?: CleanupStatus; inline?: boolean }> = (
  props,
) => (
  <Show
    when={!props.inline}
    fallback={
      <Text fontSize="xs" color="fg.muted" textAlign="center">
        {[
          headline(props.status),
          ...rows(props.status).map(([label, value]) => `${label} ${value}`),
        ].join(" · ")}{" "}
        · <A href="/ai">Details</A>
      </Text>
    }
  >
    <Stack gap="1" data-testid="cleanup-run-status">
      <HStack gap="1.5">
        <Box
          w="2"
          h="2"
          borderRadius="full"
          flexShrink="0"
          bg={props.status?.running ? "amber.9" : "gray.a6"}
        />
        <Text fontSize="xs" fontWeight="medium">
          {headline(props.status)}
        </Text>
      </HStack>
      <For each={rows(props.status)}>
        {([label, value]) => (
          <Text fontSize="xs" color="fg.muted">
            {label}: {value}
          </Text>
        )}
      </For>
      <Link as={A} href="/ai" fontSize="xs" w="fit-content">
        Paid calls
      </Link>
    </Stack>
  </Show>
);

/** Is cleanup spending money now, and how much has it spent? */
export const CleanupRunStatus: VoidComponent<{ inline?: boolean }> = (
  props,
) => {
  const status = createAsync(() => fetchCleanupStatus());
  onMount(() => {
    const timer = setInterval(() => {
      if (!document.hidden) void revalidate(fetchCleanupStatus.key);
    }, REFRESH_MS);
    onCleanup(() => clearInterval(timer));
  });
  return (
    <Suspense fallback={<Body inline={props.inline} />}>
      <Body status={status.latest} inline={props.inline} />
    </Suspense>
  );
};
