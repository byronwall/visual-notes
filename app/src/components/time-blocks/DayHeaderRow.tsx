import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { WandSparklesIcon } from "lucide-solid";
import { IconButton } from "~/components/ui/icon-button";
import {
  formatDuration,
  formatMonthDay,
  formatWeekdayShort,
} from "./date-utils";

type Props = {
  dates: Date[];
  todayIndex: number | null;
  plannedMinutesByDay: number[];
  metaByDay: Array<Array<{ key: string; value: string }>>;
  onOpenMeta: () => void;
  gutterWidth: number;
  onCompactDay: (date: Date) => void;
};

const metaLine = css({
  display: "block",
  w: "full",
  h: "5",
  px: "2",
  textAlign: "left",
  fontSize: "xs",
  lineHeight: "5",
  color: "fg.muted",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  cursor: "pointer",
  borderRadius: "sm",
  transition: "color 140ms ease",
  _hover: { color: "fg.default" },
});

const compactButton = css({
  opacity: 0,
  transition: "opacity 140ms ease",
  ".tb-day-header:hover &, .tb-day-header:focus-within &": { opacity: 1 },
  "@media (hover: none)": { display: "none" },
});

export const DayHeaderRow = (props: Props) => (
  <Box
    display="flex"
    position="sticky"
    top="0"
    zIndex="3"
    bg="bg.default"
    borderBottomWidth="1px"
    borderColor="border"
  >
    <Box
      position="sticky"
      left="0"
      zIndex="1"
      bg="bg.default"
      flexShrink={0}
      style={{ width: `${props.gutterWidth}px` }}
    />
    <Box
      flex="1"
      display="grid"
      style={{
        "grid-template-columns": `repeat(${props.dates.length}, minmax(0, 1fr))`,
      }}
    >
      <For each={props.dates}>
        {(date, index) => {
          const isToday = () => props.todayIndex === index();
          const planned = () => props.plannedMinutesByDay[index()] ?? 0;
          const meta = () => props.metaByDay[index()] ?? [];
          // Every header reserves the metadata line once any day has some.
          const hasMeta = () => props.metaByDay.some((day) => day.length > 0);
          return (
            <Box
              class="tb-day-header"
              display="flex"
              flexDirection="column"
              data-testid="time-blocks-day-header"
              data-today={isToday() ? "true" : undefined}
              minW="0"
              pb={hasMeta() ? "1" : "0"}
              borderLeftWidth="1px"
              borderColor="border"
            >
              <HStack gap="1.5" pl="2" pr="1" h="11" minW="0">
                <Box
                  as="span"
                  fontSize="xs"
                  fontWeight="medium"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  color={isToday() ? "red.11" : "fg.muted"}
                >
                  {formatWeekdayShort(date)}
                </Box>
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  minW="7"
                  h="7"
                  px="1"
                  borderRadius="full"
                  fontSize="md"
                  fontWeight="semibold"
                  bg={isToday() ? "red.9" : "transparent"}
                  color={isToday() ? "white" : "fg.default"}
                  style={{ "font-variant-numeric": "tabular-nums" }}
                >
                  {date.getDate()}
                </Box>
                <Show when={date.getDate() === 1 || index() === 0}>
                  <Box
                    as="span"
                    fontSize="xs"
                    color="fg.muted"
                    whiteSpace="nowrap"
                  >
                    {date.toLocaleString("en-US", { month: "short" })}
                  </Box>
                </Show>
                <Box flex="1" />
                <Show when={planned() > 0}>
                  <Box
                    as="span"
                    fontSize="xs"
                    color="fg.muted"
                    whiteSpace="nowrap"
                    title="Planned time"
                    style={{ "font-variant-numeric": "tabular-nums" }}
                  >
                    {formatDuration(planned())}
                  </Box>
                </Show>
                <IconButton
                  class={compactButton}
                  size="2xs"
                  variant="plain"
                  aria-label={`Pack ${formatMonthDay(date)} blocks back to back`}
                  title="Pack movable blocks back to back"
                  onClick={() => props.onCompactDay(date)}
                >
                  <WandSparklesIcon />
                </IconButton>
              </HStack>
              <Show when={hasMeta()}>
                <Show when={meta().length > 0} fallback={<Box h="5" />}>
                  <button
                    type="button"
                    class={metaLine}
                    data-testid="time-blocks-day-meta"
                    title={meta()
                      .map((m) => `${m.key}: ${m.value}`)
                      .join("\n")}
                    onClick={() => props.onOpenMeta()}
                  >
                    <For each={meta()}>
                      {(m, i) => (
                        <>
                          {i() > 0 ? " · " : ""}
                          <span>{m.key}</span>{" "}
                          <Box as="span" color="fg.default">
                            {m.value}
                          </Box>
                        </>
                      )}
                    </For>
                  </button>
                </Show>
              </Show>
            </Box>
          );
        }}
      </For>
    </Box>
  </Box>
);
