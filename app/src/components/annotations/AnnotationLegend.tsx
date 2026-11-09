import { BotIcon } from "lucide-solid";
import { createMemo, For, Show, type VoidComponent } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { swatchStyle, useAnnotationLayer } from "./annotation-context";

/**
 * What the highlight colors mean in this note: each type used, its color,
 * how many, and a robot mark on types agents act on.
 */
export const AnnotationLegend: VoidComponent<{ wrap?: boolean }> = (props) => {
  const layer = useAnnotationLayer();
  const used = createMemo(() => {
    const counts = new Map<string, number>();
    for (const a of layer.annotations()) counts.set(a.typeId, (counts.get(a.typeId) ?? 0) + 1);
    return layer
      .types()
      .filter((t) => counts.has(t.id))
      .map((t) => ({ ...t, count: counts.get(t.id)! }));
  });

  return (
    <HStack
      gap="2.5"
      rowGap="1"
      flexWrap={props.wrap ? "wrap" : "nowrap"}
      fontSize="xs"
      color="fg.muted"
      data-testid="annotation-legend"
    >
      <For each={used()}>
        {(type) => (
          <HStack gap="1" whiteSpace="nowrap" title={type.forAi ? `${type.name}: agents act on these` : type.name}>
            <Box w="2.5" h="2.5" borderRadius="full" flexShrink="0" style={swatchStyle(type.color)} />
            <Box color="fg.default">{type.name}</Box>
            <Show when={type.forAi}>
              <BotIcon size={12} aria-label="for AI" />
            </Show>
            <Box>{type.count}</Box>
          </HStack>
        )}
      </For>
    </HStack>
  );
};
