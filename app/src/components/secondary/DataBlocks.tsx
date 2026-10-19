import { type JSX, For, Show } from "solid-js";
import { Box, Grid, styled } from "styled-system/jsx";
import { Text } from "~/components/ui/text";

/** Light, wrapping monospace block for prompts and payloads. */
export const PlainCodeBlock = (props: { children: JSX.Element; maxH?: string }) => (
  <styled.pre
    fontFamily="mono"
    fontSize="xs"
    lineHeight="1.6"
    bg="bg.subtle"
    borderRadius="l2"
    px="3"
    py="2.5"
    m="0"
    whiteSpace="pre-wrap"
    overflowWrap="anywhere"
    overflowY="auto"
    style={props.maxH ? { "max-height": props.maxH } : undefined}
  >
    {props.children}
  </styled.pre>
);

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/** Key: value rows for small records (input variables, params). */
export const KeyValueList = (props: { record: Record<string, unknown> | null | undefined }) => {
  const entries = () => Object.entries(props.record ?? {});
  return (
    <Show
      when={entries().length > 0}
      fallback={
        <Text fontSize="sm" color="fg.subtle">
          None
        </Text>
      }
    >
      <Grid gridTemplateColumns="max-content minmax(0, 1fr)" columnGap="4" rowGap="1.5">
        <For each={entries()}>
          {([key, value]) => (
            <>
              <Text fontSize="xs" fontFamily="mono" color="fg.muted" pt="0.5">
                {key}
              </Text>
              <Box fontSize="sm" color="fg.default" whiteSpace="pre-wrap" overflowWrap="anywhere">
                {formatValue(value)}
              </Box>
            </>
          )}
        </For>
      </Grid>
    </Show>
  );
};
