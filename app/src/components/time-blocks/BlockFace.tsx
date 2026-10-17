import { type JSX, Show } from "solid-js";
import { css, cx } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { FileTextIcon, LockIcon } from "lucide-solid";
import { formatClock, formatDuration } from "./date-utils";

/** Below this height a block shows title and start time on a single line. */
export const COMPACT_BLOCK_PX = 34;

// Blocks are size containers (see blockShell); narrow overlap lanes drop the
// time and icons and reclaim padding so titles never spill out of the lane.
const faceRoot = css({
  minW: "0",
  "@container (max-width: 56px)": { mx: "-1" },
});
const faceTime = css({ "@container (max-width: 56px)": { display: "none" } });
const faceIcons = css({ "@container (max-width: 44px)": { display: "none" } });

type Props = {
  title: JSX.Element;
  start: Date;
  end: Date;
  heightPx: number;
  isFixedTime?: boolean;
  hasNote?: boolean;
  showDuration?: boolean;
};

export const formatBlockRange = (start: Date, end: Date) =>
  `${formatClock(start)} – ${formatClock(end)}`;

/** Text content shared by blocks, the drag ghost, the create preview and drafts. */
export const BlockFace = (props: Props) => {
  const compact = () => props.heightPx < COMPACT_BLOCK_PX;
  const minutes = () => (props.end.getTime() - props.start.getTime()) / 60_000;
  const timeLabel = () =>
    props.showDuration
      ? `${formatBlockRange(props.start, props.end)} · ${formatDuration(minutes())}`
      : formatBlockRange(props.start, props.end);

  const icons = (
    <Show when={props.isFixedTime || props.hasNote}>
      <Box
        as="span"
        class={faceIcons}
        display="inline-flex"
        gap="1"
        flexShrink={0}
        opacity={0.9}
        pt="0.5"
      >
        <Show when={props.hasNote}>
          <FileTextIcon size={11} aria-label="Linked note" />
        </Show>
        <Show when={props.isFixedTime}>
          <LockIcon size={11} aria-label="Fixed time" />
        </Show>
      </Box>
    </Show>
  );

  return (
    <Show
      when={!compact()}
      fallback={
        <Box
          class={faceRoot}
          display="flex"
          alignItems="center"
          gap="1"
          h="full"
          fontSize="11px"
          lineHeight="1"
          whiteSpace="nowrap"
        >
          <Box as="span" fontWeight="semibold" truncate minW="0">
            {props.title}
          </Box>
          <Box
            as="span"
            class={faceTime}
            opacity={0.85}
            flexShrink={0}
            style={{ "font-variant-numeric": "tabular-nums" }}
          >
            {props.showDuration ? timeLabel() : formatClock(props.start)}
          </Box>
          <Box flex="1" />
          {icons}
        </Box>
      }
    >
      <Box class={faceRoot} display="flex" gap="1">
        <Box
          flex="1"
          minW="0"
          fontSize="xs"
          fontWeight="semibold"
          lineHeight="1.25"
          overflow="hidden"
          style={{
            display: "-webkit-box",
            "-webkit-box-orient": "vertical",
            "-webkit-line-clamp": String(
              Math.max(1, Math.floor((props.heightPx - 20) / 15)),
            ),
            "overflow-wrap": "anywhere",
          }}
        >
          {props.title}
        </Box>
        {icons}
      </Box>
      <Box
        class={cx(faceRoot, faceTime)}
        fontSize="11px"
        lineHeight="1.3"
        opacity={0.85}
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
        style={{ "font-variant-numeric": "tabular-nums" }}
      >
        {timeLabel()}
      </Box>
    </Show>
  );
};
