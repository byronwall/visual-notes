import { For, Show, createEffect, createSignal, type Accessor } from "solid-js";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";

type ConsolePrefixFiltersProps = {
  tooltipContentProps: { zIndex: "tooltip" };
  prefixFilter: Accessor<string>;
  setPrefixFilter: (next: string) => void;
  prefixes: Accessor<string[]>;
  prefixCounts: Accessor<Map<string, number>>;
  displayedCount: Accessor<number>;
  overflowDeps: Accessor<number>;
};

export const ConsolePrefixFilters = (props: ConsolePrefixFiltersProps) => {
  let prefixPillsEl: HTMLDivElement | undefined;
  const [hasHiddenPrefixes, setHasHiddenPrefixes] = createSignal(false);

  createEffect(() => {
    props.prefixes();
    props.prefixCounts();
    props.prefixFilter();
    props.overflowDeps();

    queueMicrotask(() => {
      const el = prefixPillsEl;
      if (!el) return;
      setHasHiddenPrefixes(el.scrollHeight > el.clientHeight + 1);
    });
  });

  return (
    <HStack gap="2" alignItems="flex-start" minW="0">
      <HStack
        ref={prefixPillsEl}
        gap="1"
        flexWrap="wrap"
        maxH="4.5rem"
        overflow="hidden"
        flex="1"
        minW="0"
      >
        <Tooltip
          portalled={false}
          contentProps={props.tooltipContentProps}
          content="Show all logs"
          showArrow
        >
          <Button
            size="xs"
            variant={props.prefixFilter() === "all" ? "subtle" : "plain"}
            onClick={() => props.setPrefixFilter("all")}
            fontFamily="mono"
          >
            All ({props.displayedCount()})
          </Button>
        </Tooltip>

        <Show when={(props.prefixCounts().get("untyped") ?? 0) > 0}>
          <Tooltip
            portalled={false}
            contentProps={props.tooltipContentProps}
            content="Show logs without a prefix"
            showArrow
          >
            <Button
              size="xs"
              variant={props.prefixFilter() === "untyped" ? "subtle" : "plain"}
              onClick={() => props.setPrefixFilter("untyped")}
              fontFamily="mono"
            >
              Untyped ({props.prefixCounts().get("untyped") ?? 0})
            </Button>
          </Tooltip>
        </Show>

        <For each={props.prefixes()}>
          {(prefix) => (
            <Tooltip
              portalled={false}
              contentProps={props.tooltipContentProps}
              content={`Filter by [${prefix}]`}
              showArrow
            >
              <Button
                size="xs"
                variant={props.prefixFilter() === prefix ? "subtle" : "plain"}
                onClick={() => props.setPrefixFilter(prefix)}
                fontFamily="mono"
              >
                [{prefix}] ({props.prefixCounts().get(prefix) ?? 0})
              </Button>
            </Tooltip>
          )}
        </For>
      </HStack>

      <Show when={hasHiddenPrefixes()}>
        <Tooltip
          portalled={false}
          contentProps={props.tooltipContentProps}
          content="Some prefix pills are hidden. Use search to find/filter prefixes not shown."
          showArrow
        >
          <Text
            fontSize="lg"
            lineHeight="1"
            color="yellow.10"
            fontWeight="bold"
            flexShrink="0"
            whiteSpace="nowrap"
            mt="1.5"
          >
            *
          </Text>
        </Tooltip>
      </Show>
    </HStack>
  );
};
