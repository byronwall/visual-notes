import { BotIcon } from "lucide-solid";
import { createMemo, For, Show, type VoidComponent } from "solid-js";
import { Dynamic } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { swatchStyle, useAnnotationLayer } from "./annotation-context";

const itemClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  whiteSpace: "nowrap",
  borderRadius: "l1",
  px: "1",
  mx: "-1",
  transition: "background-color 140ms ease-out, opacity 140ms ease-out",
  "&:is(button)": { cursor: "pointer", _hover: { bg: "gray.a3" } },
  "&[data-dimmed]": { opacity: 0.45 },
});

/**
 * What the highlight colors mean in this note: each type used, its color,
 * how many, and a robot mark on types agents act on. With `filter`, clicking
 * a type shows only that type in the rail and the note; click it again to
 * show all. A single type has nothing to filter, so it is not a button.
 */
export const AnnotationLegend: VoidComponent<{
  wrap?: boolean;
  filter?: boolean;
}> = (props) => {
  const layer = useAnnotationLayer();
  const used = createMemo(() => {
    const counts = new Map<string, number>();
    for (const a of layer.annotations())
      counts.set(a.typeId, (counts.get(a.typeId) ?? 0) + 1);
    return layer
      .types()
      .filter((t) => counts.has(t.id))
      .map((t) => ({ ...t, count: counts.get(t.id)! }));
  });
  const canFilter = () => props.filter && used().length > 1;

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
          // Plain text when it cannot filter: a disabled button inside the
          // legend pill would swallow the pill's click.
          <Dynamic
            component={canFilter() ? "button" : "span"}
            type={canFilter() ? "button" : undefined}
            class={itemClass}
            aria-pressed={
              canFilter() ? layer.focusType() === type.id : undefined
            }
            data-dimmed={
              layer.focusType() && layer.focusType() !== type.id
                ? ""
                : undefined
            }
            title={type.forAi ? `${type.name}: agents act on these` : type.name}
            onClick={(event: MouseEvent) => {
              if (!canFilter()) return;
              event.stopPropagation();
              layer.setFocusType(
                layer.focusType() === type.id ? null : type.id,
              );
            }}
          >
            <Box
              w="2"
              h="2"
              borderRadius="full"
              flexShrink="0"
              style={swatchStyle(type.color)}
            />
            <Box
              color="fg.default"
              fontWeight={layer.focusType() === type.id ? "semibold" : "normal"}
            >
              {type.name}
            </Box>
            <Show when={type.forAi}>
              <BotIcon size={12} aria-label="for AI" />
            </Show>
            <Box>{type.count}</Box>
          </Dynamic>
        )}
      </For>
    </HStack>
  );
};
