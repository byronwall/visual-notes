import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, Grid, HStack, Stack, styled } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { fetchMcpActivitySummary } from "~/services/activity/activity.queries";
import { mcpToolHref } from "./activity-format";

type McpActivityPanelProps = {
  nowMs: number;
  /** The timeline's zone, so the server and client render the same day. */
  timeZone: string;
};

const WINDOW_DAYS = 7;

const agoLabel = (iso: string | null, nowMs: number) => {
  if (!iso) return "no calls";
  const minutes = Math.floor((nowMs - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / (60 * 24))}d ago`;
};

const dayLabel = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(iso));

const linkClass = css({
  color: "fg.default",
  fontWeight: "medium",
  transitionProperty: "color",
  transitionDuration: "140ms",
  whiteSpace: "nowrap",
  _hover: { color: "fg.link" },
});

const ColumnHeading = (props: { children: string }) => (
  <Text
    fontSize="xs"
    fontWeight="semibold"
    color="fg.subtle"
    textTransform="uppercase"
    letterSpacing="wide"
  >
    {props.children}
  </Text>
);

const Problems = (props: { count: number }) => (
  <Show when={props.count > 0}>
    <styled.span color="red.11" fontSize="xs" fontVariantNumeric="tabular-nums">
      {props.count} {props.count === 1 ? "problem" : "problems"}
    </styled.span>
  </Show>
);

/** Who is connected over MCP and what they use, above the MCP call timeline. */
export const McpActivityPanel = (props: McpActivityPanelProps) => {
  const summary = createAsync(() => fetchMcpActivitySummary(WINDOW_DAYS));
  const maxCalls = () =>
    Math.max(1, ...(summary()?.tools.map((t) => t.calls) ?? []));

  return (
    <Stack
      gap="3"
      px="3"
      pb="2"
      minH="40"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <HStack gap="3" justifyContent="space-between" flexWrap="wrap">
        <Text fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
          <Show
            when={summary() && !summary()!.loggedSinceWindowStart}
            fallback={<>Last {WINDOW_DAYS} days</>}
          >
            <span
              title={`Tool calls are logged only since then, so this covers less than ${WINDOW_DAYS} days.`}
            >
              Since {dayLabel(summary()!.from, props.timeZone)}, when call
              logging began
            </span>
          </Show>
          <Show when={summary()}>
            {(s) => (
              <>
                {" · "}
                {s().calls} tool calls · {s().toolCount} tools
                <Show when={s().problems > 0}>
                  {" · "}
                  <styled.span color="red.11">
                    {s().problems} refused or failed
                  </styled.span>
                </Show>
              </>
            )}
          </Show>
        </Text>
        <styled.a
          href="/admin/connections"
          fontSize="sm"
          color="fg.muted"
          transitionProperty="color"
          transitionDuration="140ms"
          _hover={{ color: "fg.link" }}
        >
          Manage connections
        </styled.a>
      </HStack>

      <Show
        when={summary()}
        fallback={
          <Text fontSize="sm" color="fg.muted">
            Loading connector use…
          </Text>
        }
      >
        {(s) => (
          <Show
            when={s().clients.length > 0}
            fallback={
              <Text fontSize="sm" color="fg.muted" maxW="60ch">
                No agent has connected yet. Add Visual Notes as a connector in
                Claude or ChatGPT; every tool call it makes will show up here.
              </Text>
            }
          >
            <Grid
              gridTemplateColumns={{
                base: "1fr",
                md: "minmax(0, 2fr) minmax(0, 3fr)",
              }}
              columnGap="8"
              rowGap="4"
            >
              <Stack gap="1.5">
                <ColumnHeading>Clients</ColumnHeading>
                <For each={s().clients}>
                  {(client) => (
                    <HStack gap="2" fontSize="sm" alignItems="baseline">
                      <styled.a
                        href={`/activity?type=mcp&actor=${encodeURIComponent(client.actorId)}`}
                        title={client.actorId}
                        class={linkClass}
                      >
                        {client.name}
                      </styled.a>
                      <styled.span
                        color="fg.muted"
                        fontVariantNumeric="tabular-nums"
                        whiteSpace="nowrap"
                      >
                        {client.calls} calls ·{" "}
                        {agoLabel(client.lastCallAt, props.nowMs)}
                      </styled.span>
                      <Problems count={client.problems} />
                      <Show when={!client.connected}>
                        <styled.span color="fg.subtle" fontSize="xs">
                          disconnected
                        </styled.span>
                      </Show>
                    </HStack>
                  )}
                </For>
              </Stack>

              <Stack gap="1.5">
                <ColumnHeading>Top tools</ColumnHeading>
                <Show
                  when={s().tools.length > 0}
                  fallback={
                    <Text fontSize="sm" color="fg.muted">
                      No calls in this window.
                    </Text>
                  }
                >
                  <Grid
                    gridTemplateColumns="minmax(0, max-content) minmax(3rem, 1fr) auto"
                    columnGap="3"
                    rowGap="1"
                    alignItems="center"
                  >
                    <For each={s().tools}>
                      {(tool) => (
                        <>
                          <styled.a
                            href={mcpToolHref(tool.tool)}
                            fontFamily="mono"
                            fontSize="xs"
                            class={linkClass}
                          >
                            {tool.tool}
                          </styled.a>
                          <Box
                            h="1.5"
                            borderRadius="full"
                            bg="bg.muted"
                            overflow="hidden"
                          >
                            <Box
                              h="full"
                              bg="blue.9"
                              style={{
                                width: `${(tool.calls / maxCalls()) * 100}%`,
                              }}
                            />
                          </Box>
                          <HStack gap="2" justifyContent="flex-end">
                            <Problems count={tool.problems} />
                            <styled.span
                              fontSize="xs"
                              color="fg.muted"
                              fontVariantNumeric="tabular-nums"
                            >
                              {tool.calls}
                            </styled.span>
                          </HStack>
                        </>
                      )}
                    </For>
                  </Grid>
                </Show>
              </Stack>
            </Grid>
          </Show>
        )}
      </Show>
    </Stack>
  );
};
