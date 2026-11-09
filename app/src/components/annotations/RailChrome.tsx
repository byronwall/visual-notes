import {
  MessageSquareTextIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  XIcon,
} from "lucide-solid";
import { For, onCleanup, onMount, Show, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Tooltip } from "~/components/ui/tooltip";
import { AnnotationLegend } from "./AnnotationLegend";
import { useAnnotationLayer } from "./annotation-context";

/** The rail's sticky top: title, legend (click to filter), Types, and collapse. */
export const RailHeader: VoidComponent<{
  onCollapse?: () => void;
  onClose?: () => void;
  onHeight?: (px: number) => void;
}> = (props) => {
  const layer = useAnnotationLayer();
  let el: HTMLDivElement | undefined;
  onMount(() => {
    if (!el || !props.onHeight) return;
    const observer = new ResizeObserver(() =>
      props.onHeight?.(el!.offsetHeight),
    );
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });

  return (
    <Box
      ref={el}
      position="sticky"
      top="0"
      zIndex="1"
      bg="bg.default"
      px="2"
      pt="1"
      pb="1.5"
      data-testid="annotation-rail-header"
    >
      <HStack gap="1" justify="space-between" minH="7">
        <HStack
          gap="1.5"
          fontSize="xs"
          fontWeight="semibold"
          color="fg.default"
        >
          Annotations
          <Box color="fg.subtle" fontWeight="normal">
            {layer.annotations().length}
          </Box>
        </HStack>
        <HStack gap="0">
          <Button
            size="2xs"
            variant="plain"
            color="fg.muted"
            onClick={() => layer.openTypes()}
          >
            Types
          </Button>
          <Show when={props.onCollapse}>
            <Tooltip
              content="Hide annotations"
              showArrow
              portalled={false}
              contentProps={{ zIndex: "tooltip" }}
            >
              <IconButton
                size="2xs"
                variant="plain"
                aria-label="Hide annotations"
                data-testid="annotation-rail-collapse"
                onClick={() => props.onCollapse?.()}
              >
                <PanelLeftCloseIcon />
              </IconButton>
            </Tooltip>
          </Show>
          <Show when={props.onClose}>
            <IconButton
              size="2xs"
              variant="plain"
              aria-label="Close annotations"
              onClick={() => props.onClose?.()}
            >
              <XIcon />
            </IconButton>
          </Show>
        </HStack>
      </HStack>
      <AnnotationLegend wrap filter />
    </Box>
  );
};

const markerClass = css({
  position: "absolute",
  left: "50%",
  w: "1.5",
  h: "4",
  ml: "-0.75",
  borderRadius: "full",
  cursor: "pointer",
  transition: "transform 140ms ease-out",
  _hover: { transform: "scaleX(1.6)" },
});

/**
 * The collapsed rail: a button to bring it back, and a marker beside each
 * passage in its type's color. A marker opens the rail on that annotation.
 */
export const RailStrip: VoidComponent<{
  wants: Map<string, number>;
  onExpand: (id?: string) => void;
}> = (props) => {
  const layer = useAnnotationLayer();
  const color = (typeId: string) =>
    layer.types().find((t) => t.id === typeId)?.color ?? "gray";
  return (
    <Box position="absolute" inset="0" data-testid="annotation-rail-strip">
      <Box position="sticky" top="0" zIndex="1" pt="1">
        <Tooltip
          content="Show annotations"
          showArrow
          portalled={false}
          contentProps={{ zIndex: "tooltip" }}
        >
          <IconButton
            size="2xs"
            variant="plain"
            aria-label="Show annotations"
            data-testid="annotation-rail-expand"
            onClick={() => props.onExpand()}
          >
            <PanelLeftOpenIcon />
          </IconButton>
        </Tooltip>
        <HStack gap="0.5" justify="center" fontSize="2xs" color="fg.muted">
          <MessageSquareTextIcon size={10} />
          {layer.annotations().length}
        </HStack>
      </Box>
      <For each={layer.annotations().filter((a) => props.wants.has(a.id))}>
        {(a) => (
          <button
            type="button"
            class={markerClass}
            aria-label="Open this annotation"
            data-testid="annotation-marker"
            style={{
              top: `${(props.wants.get(a.id) ?? 0) + 4}px`,
              "background-color": `var(--colors-${color(a.typeId)}-9)`,
            }}
            onMouseEnter={() => layer.setHover(a.id)}
            onMouseLeave={() => layer.setHover(null)}
            onClick={() => props.onExpand(a.id)}
          />
        )}
      </For>
    </Box>
  );
};
