import { For, Show } from "solid-js";
import { Box } from "styled-system/jsx";

type Props = {
  startHour: number;
  endHour: number;
  hourHeight: number;
  width: number;
  /** Pixel offset and label of the current time, when today is visible. */
  now: { top: number; label: string } | null;
};

/** Hour labels this close to the now label are hidden so they never collide. */
const NOW_LABEL_CLEARANCE_PX = 14;

export const TimeGutter = (props: Props) => {
  const hiddenByNow = (index: number) => {
    const now = props.now;
    if (!now) return false;
    return (
      Math.abs(index * props.hourHeight - now.top) < NOW_LABEL_CLEARANCE_PX
    );
  };

  const hours = () =>
    Array.from(
      { length: props.endHour - props.startHour },
      (_, i) => i + props.startHour,
    );

  return (
    <Box
      position="sticky"
      left="0"
      zIndex="2"
      flexShrink={0}
      bg="bg.default"
      style={{
        width: `${props.width}px`,
        height: `${(props.endHour - props.startHour) * props.hourHeight}px`,
      }}
    >
      <For each={hours()}>
        {(hour, index) => (
          <Box
            data-testid="time-left-scale-row"
            data-hour={String(hour)}
            position="absolute"
            right="2"
            fontSize="xs"
            color="fg.muted"
            lineHeight="1"
            style={{
              top: `${index() * props.hourHeight}px`,
              transform: index() === 0 ? "translateY(3px)" : "translateY(-50%)",
              "font-variant-numeric": "tabular-nums",
              visibility: hiddenByNow(index()) ? "hidden" : undefined,
            }}
          >
            {hour}:00
          </Box>
        )}
      </For>
      <Show when={props.now}>
        {(now) => (
          <Box
            data-testid="time-blocks-now-label"
            position="absolute"
            right="1"
            px="1"
            py="0.5"
            borderRadius="sm"
            bg="red.9"
            color="white"
            fontSize="xs"
            fontWeight="semibold"
            lineHeight="1"
            pointerEvents="none"
            style={{
              top: `${now().top}px`,
              transform: "translateY(-50%)",
              "font-variant-numeric": "tabular-nums",
            }}
          >
            {now().label}
          </Box>
        )}
      </Show>
    </Box>
  );
};
