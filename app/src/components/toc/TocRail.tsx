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

  function getWidth(depth: number) {
    if (depth <= 0) return 16;
    if (depth === 1) return 12;
    if (depth === 2) return 9;
    return 7;
  }

  function getHeight(depth: number) {
    if (depth <= 0) return 5;
    if (depth <= 2) return 4;
    return 7;
  }

  return (
    <Box
      position="relative"
      borderWidth="1px"
      borderColor="gray.outline.border"
      bg="bg.default"
      borderRadius="l2"
      p="1"
      boxShadow="sm"
      w="6"
      style={{
        height: `${props.heightPx()}px`,
        transition: "height 220ms ease",
      }}
    >
      <Box
        position="absolute"
        left="1"
        right="1"
        h="2px"
        bg="green.9"
        opacity="1"
        style={{
          top: `${(props.visibleTopRatio() * 100).toFixed(1)}%`,
          transform: "translateY(-50%)",
        }}
      />
      <Box
        position="absolute"
        left="1"
        right="1"
        h="2px"
        bg="red.9"
        opacity="1"
        style={{
          top: `${(props.visibleBottomRatio() * 100).toFixed(1)}%`,
          transform: "translateY(-50%)",
        }}
      />

      <Box position="absolute" top="3" bottom="3" left="1" right="1">
        <For each={props.markers()}>
          {(marker) => {
            const isActive = () => marker.index === props.activeIndex();
            const depth = () => getDisplayDepth(marker.item.level);
            const top = () => `${(marker.displayTopRatio * 100).toFixed(1)}%`;

            return (
              <Box
                position="absolute"
                left="50%"
                transform="translate(-50%, -50%)"
                style={{
                  top: top(),
                  width: `${getWidth(depth())}px`,
                  height: `${getHeight(depth())}px`,
                  "border-radius": "999px",
                }}
                bg={isActive() ? "gray.12" : "gray.10"}
                borderWidth={isActive() ? "0px" : "1px"}
                borderColor="gray.4"
                opacity={isActive() ? "1" : "0.78"}
                cursor="pointer"
                onClick={() => props.onMarkerClick(marker)}
              />
            );
          }}
        </For>
      </Box>
    </Box>
  );
}
