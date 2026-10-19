import { Show } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  ListIcon,
  TableIcon,
  XIcon,
} from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { css } from "styled-system/css";
import { addDays, formatDateOnly, parseDateInput } from "./date-utils";
import { CalendarSettingsPopover } from "./CalendarSettingsPopover";
import type { CalendarSettings } from "./useCalendarSettings";

type Props = {
  rangeStart: Date;
  /** Day scrolled into view; phones show one day per screen. */
  focusDay: Date;
  settings: CalendarSettings;
  isAtToday: boolean;
  noteFilterLabel: string | null;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onPickDate: (date: Date) => void;
  onClearNoteFilter: () => void;
  onOpenList: () => void;
  onOpenSummary: () => void;
};

// Phones need the toolbar on one row: 32px icon buttons with no padding.
const tightOnNarrow = css({
  "& > button, & button[aria-label='Calendar settings']": {
    minW: { base: "8", md: "9" },
    px: { base: "0", md: "3" },
  },
});

const onlyNarrow = css({ display: { base: "inline", md: "none" } });
const onlyWide = css({ display: { base: "none", md: "inline" } });

// Anchors the native picker under the range label without showing the field.
const visuallyHidden = css({
  position: "absolute",
  left: "0",
  bottom: "0",
  w: "1px",
  h: "1px",
  opacity: 0,
  pointerEvents: "none",
});

const labelOnWide = css({ display: { base: "none", lg: "inline" } });

/** "Oct 17 – 23"; the year only appears when the range leaves this year. */
export const formatRangeLabel = (
  start: Date,
  days: number,
  currentYear = new Date().getFullYear(),
) => {
  const end = addDays(start, days - 1);
  const month = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  const year = end.getFullYear();
  const yearSuffix =
    start.getFullYear() === currentYear && year === currentYear
      ? ""
      : `, ${year}`;
  if (days === 1) {
    return `${start.toLocaleString("en-US", { weekday: "short" })} ${month(start)} ${start.getDate()}${yearSuffix}`;
  }
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === year;
  const startLabel = `${month(start)} ${start.getDate()}${sameYear ? "" : `, ${start.getFullYear()}`}`;
  const endLabel =
    sameMonth && sameYear
      ? `${end.getDate()}`
      : `${month(end)} ${end.getDate()}`;
  return `${startLabel} – ${endLabel}${yearSuffix}`;
};

export const TimeBlocksToolbar = (props: Props) => {
  let dateInputRef: HTMLInputElement | undefined;

  const openDatePicker = () => {
    if (!dateInputRef) return;
    try {
      dateInputRef.showPicker();
    } catch {
      dateInputRef.focus();
    }
  };

  return (
    <HStack
      data-testid="time-blocks-header"
      gap="2"
      rowGap="1"
      flexWrap="wrap"
      alignItems="center"
      pb="2"
    >
      <Heading
        display={{ base: "none", md: "block" }}
        as="h1"
        fontSize="lg"
        fontWeight="semibold"
        whiteSpace="nowrap"
        mr="2"
      >
        Time Blocks
      </Heading>

      <HStack gap="0.5">
        <IconButton
          size="sm"
          variant="plain"
          aria-label="Previous range"
          title="Previous (←)"
          onClick={() => props.onNavigate(-1)}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Button
          size="sm"
          variant="outline"
          disabled={props.isAtToday}
          title="Jump to today (T)"
          onClick={() => props.onToday()}
        >
          Today
        </Button>
        <IconButton
          size="sm"
          variant="plain"
          aria-label="Next range"
          title="Next (→)"
          onClick={() => props.onNavigate(1)}
        >
          <ChevronRightIcon />
        </IconButton>
      </HStack>

      <Box position="relative">
        <Button
          size="sm"
          variant="plain"
          px="2"
          title="Pick a start date"
          onClick={openDatePicker}
        >
          <Text
            as="span"
            fontSize="md"
            fontWeight="semibold"
            style={{ "font-variant-numeric": "tabular-nums" }}
          >
            <span class={onlyNarrow}>
              {formatRangeLabel(props.focusDay, 1)}
            </span>
            <span class={onlyWide}>
              {formatRangeLabel(
                props.rangeStart,
                props.settings.numberOfDays(),
              )}
            </span>
          </Text>
          <CalendarDaysIcon class={onlyWide} />
        </Button>
        <input
          ref={dateInputRef}
          type="date"
          tabIndex={-1}
          aria-label="Start date"
          class={visuallyHidden}
          value={formatDateOnly(props.rangeStart)}
          onInput={(event) => {
            const next = parseDateInput(event.currentTarget.value);
            if (next) props.onPickDate(next);
          }}
        />
      </Box>

      <Show when={props.noteFilterLabel}>
        {(label) => (
          <HStack
            gap="1"
            pl="2"
            pr="0.5"
            h="7"
            borderRadius="md"
            bg="bg.muted"
            fontSize="sm"
            maxW="64"
            data-testid="time-blocks-note-filter"
          >
            <FileTextIcon size={14} />
            <Text as="span" fontSize="sm" truncate title={label()}>
              {label()}
            </Text>
            <IconButton
              size="2xs"
              variant="plain"
              aria-label="Show all blocks"
              title="Show all blocks"
              onClick={() => props.onClearNoteFilter()}
            >
              <XIcon />
            </IconButton>
          </HStack>
        )}
      </Show>

      <HStack gap="0" ml="auto" class={tightOnNarrow}>
        <Button
          size="sm"
          variant="plain"
          onClick={() => props.onOpenList()}
          aria-label="List view"
          title="List view"
        >
          <ListIcon />
          <span class={labelOnWide}>List</span>
        </Button>
        <Button
          size="sm"
          variant="plain"
          onClick={() => props.onOpenSummary()}
          aria-label="Day summary"
          title="Day summary"
        >
          <TableIcon />
          <span class={labelOnWide}>Summary</span>
        </Button>
        <CalendarSettingsPopover settings={props.settings} />
      </HStack>
    </HStack>
  );
};
