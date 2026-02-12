import { For, type Accessor } from "solid-js";
import { Box } from "styled-system/jsx";
import { type TocMarker } from "./types";

type Props = {
  heightPx: Accessor<number>;
  visibleTopRatio: Accessor<number>;
  visibleBottomRatio: Accessor<number>;
  markers: Accessor<TocMarker[]>;
  activeIndex: Accessor<number>;
  minHeadingLevel: Accessor<1 | 2 | 3 | 4 | 5 | 6>;
  onMarkerClick: (marker: TocMarker) => void;
};

export function TocRail(props: Props) {
  function getDisplayDepth(level: 1 | 2 | 3 | 4 | 5 | 6) {
    return Math.max(level - props.minHeadingLevel(), 0);
  }

  function getLineWidth(depth: number) {
    if (depth <= 0) return 14;
    if (depth === 1) return 10;
    if (depth === 2) return 7;
    return 5;
  }

  function getLineHeight(depth: number) {
    if (depth <= 1) return 2;
    return 1;
  }

  const visibleHeightPct = () =>
    Math.max((props.visibleBottomRatio() - props.visibleTopRatio()) * 100, 3.5);

  return (
    <Box
      position="relative"
      w="6"
      style={{
        height: `${props.heightPx()}px`,
        transition: "height 220ms ease",
      }}
    >
      <Box
        position="absolute"
        left="50%"
        top="0"
        bottom="0"
        w="1px"
        bg="border"
        style={{
          transform: "translateX(-50%)",
        }}
      />
      <Box
        position="absolute"
        left="50%"
        w="2px"
        bg="gray.10"
        borderRadius="full"
        style={{
          top: `${(props.visibleTopRatio() * 100).toFixed(1)}%`,
          height: `${visibleHeightPct().toFixed(1)}%`,
          transform: "translateX(-50%)",
          transition: "top 180ms ease, height 180ms ease",
        }}
      />
      <Box position="absolute" top="3" bottom="3" left="1" right="1">
        <For each={props.markers()}>
          {(marker) => {
            const depth = () => getDisplayDepth(marker.item.level);
            const isActive = () => marker.index === props.activeIndex();

            return (
              <Box
                position="absolute"
                left="50%"
                cursor="pointer"
                style={{
                  top: `${(marker.displayTopRatio * 100).toFixed(1)}%`,
                  width: `${getLineWidth(depth())}px`,
                  height: `${getLineHeight(depth())}px`,
                  transform: "translate(-50%, -50%)",
                  "border-radius": "999px",
                }}
                bg={isActive() ? "fg.default" : "fg.subtle"}
                opacity={isActive() ? "0.95" : "0.7"}
                onClick={() => props.onMarkerClick(marker)}
              />
            );
          }}
        </For>
      </Box>
    </Box>
  );
}
