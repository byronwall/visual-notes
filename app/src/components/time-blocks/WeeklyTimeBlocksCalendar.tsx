import { useAction } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  Clock4Icon,
  Grid3X3Icon,
  RulerIcon,
  ListIcon,
  LockIcon,
  SettingsIcon,
  TableIcon,
  WandSparklesIcon,
} from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import * as ScrollArea from "~/components/ui/scroll-area";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import {
  bulkUpdateTimeBlocks,
  duplicateTimeBlock,
  fetchWeeklyTimeBlocks,
  updateTimeBlock,
  type TimeBlockItem,
} from "~/services/time-blocks/time-blocks.service";
import {
  addDays,
  formatDateOnly,
  formatMonthDay,
  formatTime24,
  formatWeekdayShort,
  parseDateInput,
  startOfDay,
} from "./date-utils";
import { getOverlappingGroups, type TimeBlockWithPosition } from "./overlap";
import {
  getDayIndexInRange,
  getVisibleSegmentForDay,
  toGridY as toGridYPx,
} from "./weekly-geometry";
import { normalizeTimeBlockColor } from "./time-block-colors";
import { TimeBlockEditorDialog } from "./TimeBlockEditorDialog";
import { TimeBlockMetadataSummaryDialog } from "./TimeBlockMetadataSummaryDialog";
import { TimeBlocksListDialog } from "./TimeBlocksListDialog";

type DragState =
  | {
      type: "idle";
    }
  | {
      type: "create";
      start: Date;
      current: Date;
      initialMouseX: number;
      initialMouseY: number;
      didDrag: boolean;
    }
  | {
      type: "move";
      block: TimeBlockItem;
      initialMouseY: number;
      initialMouseX: number;
      anchorStart: Date;
      anchorEnd: Date;
      currentStart: Date;
      currentEnd: Date;
      duplicate: boolean;
      didDrag: boolean;
    }
  | {
      type: "resize";
      edge: "top" | "bottom";
      block: TimeBlockItem;
      initialStart: Date;
      initialEnd: Date;
      current: Date;
      initialMouseY: number;
      didDrag: boolean;
    };

type Props = {
  initialNoteId?: string;
};

export const WeeklyTimeBlocksCalendar = (props: Props) => {
  const SETTINGS_STORAGE_KEY = "time-blocks-calendar-settings-v1";

  const DRAG_THRESHOLD_PX = 4;
  const LANE_GUTTER_PX = 20;
  const [startHour, setStartHour] = createSignal(6);
  const [endHour, setEndHour] = createSignal(22);
  const [numberOfDays, setNumberOfDays] = createSignal(7);
  const [snapMinutes, setSnapMinutes] = createSignal(15);
  const [hourHeight, setHourHeight] = createSignal(56);
  const [selectedDate, setSelectedDate] = createSignal(startOfDay(new Date()));
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [settingsHydrated, setSettingsHydrated] = createSignal(false);

  const [listOpen, setListOpen] = createSignal(false);
  const [summaryOpen, setSummaryOpen] = createSignal(false);
  const [editorOpen, setEditorOpen] = createSignal(false);
  const [editingBlock, setEditingBlock] = createSignal<TimeBlockItem | null>(
    null,
  );
  const [newRange, setNewRange] = createSignal<{
    start: Date;
    end: Date;
  } | null>(null);

  const [refreshNonce, setRefreshNonce] = createSignal(0);
  const [optimisticTimes, setOptimisticTimes] = createSignal<
    Record<string, { startTime: string; endTime: string }>
  >({});

  const [dragState, setDragState] = createSignal<DragState>({ type: "idle" });
  const [nowTime, setNowTime] = createSignal<Date | null>(null);
  const [hoverTime, setHoverTime] = createSignal<Date | null>(null);
  const [mouseIndicatorSide, setMouseIndicatorSide] = createSignal<
    "left" | "right"
  >("right");
  const [suppressNextBlockClick, setSuppressNextBlockClick] =
    createSignal(false);

  let gridRef: HTMLDivElement | undefined;
  let scrollAreaRef: HTMLDivElement | undefined;

  const weekStart = createMemo(() => startOfDay(selectedDate()));

  const dayDates = createMemo(() =>
    Array.from({ length: numberOfDays() }, (_, index) =>
      addDays(weekStart(), index),
    ),
  );
  const laneWidthPercent = createMemo(() => 100 / numberOfDays());
  const headerGridTemplate = createMemo(
    () => `80px repeat(${numberOfDays()}, minmax(0, 1fr))`,
  );

  const [weeklyBlocks] = createResource(
    () => ({
      refresh: refreshNonce(),
      weekStartIso: weekStart().toISOString(),
      numberOfDays: numberOfDays(),
      noteId: props.initialNoteId || undefined,
    }),
    async ({ weekStartIso, numberOfDays, noteId }) =>
      fetchWeeklyTimeBlocks({
        weekStartIso,
        numberOfDays,
        noteId,
      }),
  );

  const runUpdate = useAction(updateTimeBlock);
  const runDuplicate = useAction(duplicateTimeBlock);
  const runBulkUpdate = useAction(bulkUpdateTimeBlocks);

  const refreshCalendar = () => {
    setRefreshNonce((value) => value + 1);
  };

  const mergedWeeklyBlocks = createMemo<TimeBlockItem[]>(() => {
    const source = weeklyBlocks.latest ?? weeklyBlocks() ?? [];
    const optimistic = optimisticTimes();
    if (Object.keys(optimistic).length === 0) return source;
    return source.map((block) => {
      const next = optimistic[block.id];
      if (!next) return block;
      return {
        ...block,
        startTime: next.startTime,
        endTime: next.endTime,
      };
    });
  });

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const formatDurationForIndicator = (minutesTotal: number) => {
    const total = Math.max(0, Math.floor(minutesTotal));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const roundToSnap = (date: Date) => {
    const rounded = new Date(date);
    const minutes = rounded.getMinutes();
    const snapped = Math.round(minutes / snapMinutes()) * snapMinutes();
    if (snapped >= 60) {
      rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
    } else {
      rounded.setMinutes(snapped, 0, 0);
    }
    return rounded;
  };

  const getTimeFromMouseEvent = (
    event: MouseEvent | PointerEvent,
    fixedDayIndex?: number,
  ) => {
    if (!gridRef || !scrollAreaRef) return null;
    const gridRect = gridRef.getBoundingClientRect();
    const scrollRect = scrollAreaRef.getBoundingClientRect();
    const x = event.clientX - gridRect.left;
    const visibleY = event.clientY - scrollRect.top;
    const y = visibleY + scrollAreaRef.scrollTop;
    const totalHeight = (endHour() - startHour()) * hourHeight();
    if (visibleY < 0 || visibleY > scrollRect.height) return null;
    if (y < 0 || y > totalHeight) return null;
    if (fixedDayIndex === undefined && (x < 0 || x > gridRect.width))
      return null;

    const dayWidth = gridRect.width / numberOfDays();
    const dayIndex =
      fixedDayIndex === undefined
        ? clamp(Math.floor(x / dayWidth), 0, numberOfDays() - 1)
        : clamp(fixedDayIndex, 0, numberOfDays() - 1);
    const rawMinutesFromStart = Math.round(y / pxPerMinute());
    const rawMinutes = startHour() * 60 + rawMinutesFromStart;

    const date = new Date(addDays(weekStart(), dayIndex));
    date.setHours(0, 0, 0, 0);
    date.setMinutes(rawMinutes);

    const snapped = roundToSnap(date);

    const minDate = new Date(addDays(weekStart(), dayIndex));
    minDate.setHours(startHour(), 0, 0, 0);
    const maxDate = new Date(addDays(weekStart(), dayIndex));
    maxDate.setHours(endHour(), 0, 0, 0);

    if (snapped.getTime() < minDate.getTime()) return minDate;
    if (snapped.getTime() > maxDate.getTime()) return maxDate;
    return snapped;
  };

  const getMouseIndicatorSideFromEvent = (
    event: MouseEvent | PointerEvent,
    fixedDayIndex?: number,
  ): "left" | "right" | null => {
    if (!gridRef) return null;
    const rect = gridRef.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x < 0 || x > rect.width) return null;
    const dayWidth = rect.width / numberOfDays();
    const dayIndex =
      fixedDayIndex === undefined
        ? clamp(Math.floor(x / dayWidth), 0, numberOfDays() - 1)
        : clamp(fixedDayIndex, 0, numberOfDays() - 1);
    const laneStart = dayIndex * dayWidth;
    const laneX = x - laneStart;
    // Keep the label on the opposite side of the pointer within the lane.
    return laneX > dayWidth / 2 ? "left" : "right";
  };

  const toGridY = (date: Date) => {
    return toGridYPx(date, startHour(), endHour(), hourHeight());
  };

  const getVisibleSegment = (start: Date, end: Date, dayIndex: number) => {
    return getVisibleSegmentForDay(
      start,
      end,
      dayIndex,
      weekStart(),
      startHour(),
      endHour(),
    );
  };

  const toDayIndex = (date: Date) => {
    return getDayIndexInRange(date, weekStart(), numberOfDays());
  };

  const pxPerMinute = createMemo(() => hourHeight() / 60);

  createEffect(() => {
    if (typeof window === "undefined" || settingsHydrated()) return;
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<{
          startHour: number;
          endHour: number;
          numberOfDays: number;
          snapMinutes: number;
          hourHeight: number;
        }>;
        if (Number.isFinite(parsed.startHour)) {
          setStartHour(clamp(Number(parsed.startHour), 0, 23));
        }
        if (Number.isFinite(parsed.endHour)) {
          setEndHour(clamp(Number(parsed.endHour), 1, 24));
        }
        if (Number.isFinite(parsed.numberOfDays)) {
          setNumberOfDays(clamp(Number(parsed.numberOfDays), 1, 14));
        }
        if (Number.isFinite(parsed.snapMinutes)) {
          setSnapMinutes(clamp(Number(parsed.snapMinutes), 5, 60));
        }
        if (Number.isFinite(parsed.hourHeight)) {
          setHourHeight(clamp(Number(parsed.hourHeight), 30, 140));
        }
      } catch {
        // Ignore invalid localStorage payload and continue with defaults.
      }
    }
    setSettingsHydrated(true);
  });

  createEffect(() => {
    if (typeof window === "undefined" || !settingsHydrated()) return;
    const payload = {
      startHour: startHour(),
      endHour: endHour(),
      numberOfDays: numberOfDays(),
      snapMinutes: snapMinutes(),
      hourHeight: hourHeight(),
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  });

  const groupedBlocksByDay = createMemo(() => {
    const map = new Map<number, TimeBlockWithPosition[]>();
    for (const block of mergedWeeklyBlocks()) {
      const dayIndex = toDayIndex(new Date(block.startTime));
      if (dayIndex === null) continue;
      const existing = map.get(dayIndex) ?? [];
      existing.push(block as TimeBlockWithPosition);
      map.set(dayIndex, existing);
    }

    const flattened = new Map<number, TimeBlockWithPosition[]>();
    for (const [dayIndex, dayBlocks] of map.entries()) {
      const groups = getOverlappingGroups(dayBlocks);
      const merged = groups.flat();
      flattened.set(dayIndex, merged);
    }
    return flattened;
  });

  const openCreateDialog = (start: Date, end: Date) => {
    let s = start;
    let e = end;
    if (e.getTime() < s.getTime()) {
      [s, e] = [e, s];
    }
    if (e.getTime() === s.getTime()) {
      e = new Date(s.getTime() + snapMinutes() * 60_000);
    }
    setEditingBlock(null);
    setNewRange({ start: s, end: e });
    setEditorOpen(true);
  };

  const correctOverlappingBlocksForDay = async (date: Date) => {
    const targetDate = startOfDay(date);
    const blocksForDay = mergedWeeklyBlocks()
      .filter((block) => {
        const blockDate = startOfDay(new Date(block.startTime));
        return blockDate.getTime() === targetDate.getTime();
      })
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );

    const fixedBlocks = blocksForDay
      .filter((block) => block.isFixedTime)
      .map((block) => ({
        block,
        start: new Date(block.startTime),
        end: new Date(block.endTime),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const nonFixedBlocks = blocksForDay
      .filter((block) => !block.isFixedTime)
      .map((block) => ({
        block,
        start: new Date(block.startTime),
        end: new Date(block.endTime),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const updates: Array<{
      id: string;
      startTimeIso: string;
      endTimeIso: string;
    }> = [];
    const optimistic: Record<string, { startTime: string; endTime: string }> =
      {};
    const placedNonFixedIds = new Set<string>();
    let currentTime: Date | null = null;

    const addUpdateIfNeeded = (
      block: TimeBlockItem,
      newStart: Date,
      newEnd: Date,
    ) => {
      const originalStart = new Date(block.startTime);
      const originalEnd = new Date(block.endTime);
      if (
        newStart.getTime() === originalStart.getTime() &&
        newEnd.getTime() === originalEnd.getTime()
      ) {
        return;
      }
      const startTimeIso = newStart.toISOString();
      const endTimeIso = newEnd.toISOString();
      updates.push({
        id: block.id,
        startTimeIso,
        endTimeIso,
      });
      optimistic[block.id] = {
        startTime: startTimeIso,
        endTime: endTimeIso,
      };
    };

    const totalFixedBlocks = fixedBlocks.length;
    for (let i = 0; i <= totalFixedBlocks; i++) {
      const currentFixed = i > 0 ? fixedBlocks[i - 1] : null;
      const nextFixed = i < totalFixedBlocks ? fixedBlocks[i] : null;

      const segmentStart = currentFixed ? currentFixed.end : null;
      const segmentEnd = nextFixed ? nextFixed.start : null;

      if (segmentStart) {
        currentTime =
          currentTime === null
            ? segmentStart
            : new Date(Math.max(currentTime.getTime(), segmentStart.getTime()));
      }

      for (const item of nonFixedBlocks) {
        if (placedNonFixedIds.has(item.block.id)) continue;

        const durationMs = item.end.getTime() - item.start.getTime();
        const potentialStart = currentTime ?? item.start;
        const potentialEnd = new Date(potentialStart.getTime() + durationMs);

        if (!segmentEnd || potentialEnd.getTime() <= segmentEnd.getTime()) {
          addUpdateIfNeeded(item.block, potentialStart, potentialEnd);
          currentTime = potentialEnd;
          placedNonFixedIds.add(item.block.id);
        }
      }

      if (nextFixed) {
        currentTime =
          currentTime === null
            ? nextFixed.start
            : new Date(
                Math.max(currentTime.getTime(), nextFixed.start.getTime()),
              );
      }
    }

    if (updates.length === 0) return;

    setOptimisticTimes((current) => ({
      ...current,
      ...optimistic,
    }));

    try {
      await runBulkUpdate(updates);
      refreshCalendar();
    } catch (error) {
      setOptimisticTimes((current) => {
        const next = { ...current };
        for (const update of updates) {
          delete next[update.id];
        }
        return next;
      });
    }
  };

  const handlePointerDownGrid = (event: PointerEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-time-block='true']")) return;
    if (event.button !== 0) return;
    event.preventDefault();
    const time = getTimeFromMouseEvent(event);
    if (!time) return;
    setDragState({
      type: "create",
      start: time,
      current: time,
      initialMouseX: event.clientX,
      initialMouseY: event.clientY,
      didDrag: false,
    });
  };

  const handlePointerMove = (event: PointerEvent) => {
    const state = dragState();

    if (state.type === "idle") {
      const time = getTimeFromMouseEvent(event);
      setHoverTime(time);
      const side = getMouseIndicatorSideFromEvent(event);
      if (side) setMouseIndicatorSide(side);
      return;
    }

    if (state.type === "create") {
      const time = getTimeFromMouseEvent(event);
      if (!time) return;
      const side = getMouseIndicatorSideFromEvent(event);
      if (side) setMouseIndicatorSide(side);
      const didDrag =
        state.didDrag ||
        Math.abs(event.clientY - state.initialMouseY) >= DRAG_THRESHOLD_PX ||
        Math.abs(event.clientX - state.initialMouseX) >= DRAG_THRESHOLD_PX;
      setDragState({ ...state, current: time, didDrag });
      return;
    }

    if (state.type === "move") {
      if (!gridRef) return;
      const rect = gridRef.getBoundingClientRect();
      const deltaY = event.clientY - state.initialMouseY;
      const deltaX = event.clientX - state.initialMouseX;
      const minutesDelta =
        Math.round(deltaY / pxPerMinute() / snapMinutes()) * snapMinutes();
      const dayDelta = Math.round(deltaX / (rect.width / numberOfDays()));

      const nextStart = new Date(state.anchorStart.getTime());
      nextStart.setDate(nextStart.getDate() + dayDelta);
      nextStart.setMinutes(nextStart.getMinutes() + minutesDelta);
      const nextEnd = new Date(state.anchorEnd.getTime());
      nextEnd.setDate(nextEnd.getDate() + dayDelta);
      nextEnd.setMinutes(nextEnd.getMinutes() + minutesDelta);

      setHoverTime(null);
      setDragState({
        ...state,
        currentStart: nextStart,
        currentEnd: nextEnd,
        didDrag:
          state.didDrag ||
          Math.abs(deltaY) >= DRAG_THRESHOLD_PX ||
          Math.abs(deltaX) >= DRAG_THRESHOLD_PX,
      });
      return;
    }

    if (state.type === "resize") {
      const deltaY = event.clientY - state.initialMouseY;
      const minutesDelta =
        Math.round(deltaY / pxPerMinute() / snapMinutes()) * snapMinutes();
      const anchor =
        state.edge === "top" ? state.initialStart : state.initialEnd;
      const time = new Date(anchor.getTime());
      time.setMinutes(time.getMinutes() + minutesDelta);
      setDragState({
        ...state,
        current: time,
        didDrag:
          state.didDrag ||
          Math.abs(event.clientY - state.initialMouseY) >= DRAG_THRESHOLD_PX,
      });
    }
  };

  const handlePointerUp = async () => {
    const state = dragState();
    setDragState({ type: "idle" });

    if (state.type === "create") {
      if (!state.didDrag) return;
      openCreateDialog(state.start, state.current);
      return;
    }

    if (state.type === "move") {
      const nextStart = state.currentStart;
      const nextEnd = state.currentEnd;
      const unchanged =
        nextStart.getTime() === state.anchorStart.getTime() &&
        nextEnd.getTime() === state.anchorEnd.getTime();

      if (unchanged && !state.duplicate) {
        if (state.didDrag) setSuppressNextBlockClick(true);
        return;
      }

      if (state.didDrag) setSuppressNextBlockClick(true);
      if (state.duplicate) {
        await runDuplicate({
          id: state.block.id,
          startTimeIso: nextStart.toISOString(),
          endTimeIso: nextEnd.toISOString(),
        });
      } else {
        const optimisticStart = nextStart.toISOString();
        const optimisticEnd = nextEnd.toISOString();
        setOptimisticTimes((current) => ({
          ...current,
          [state.block.id]: {
            startTime: optimisticStart,
            endTime: optimisticEnd,
          },
        }));
        try {
          await runUpdate({
            id: state.block.id,
            startTimeIso: optimisticStart,
            endTimeIso: optimisticEnd,
          });
        } catch (error) {
          setOptimisticTimes((current) => {
            const { [state.block.id]: _removed, ...rest } = current;
            return rest;
          });
          return;
        }
      }
      refreshCalendar();
      return;
    }

    if (state.type === "resize") {
      if (!state.didDrag) return;
      let nextStart = state.initialStart;
      let nextEnd = state.initialEnd;
      if (state.edge === "top") {
        nextStart = state.current;
      } else {
        nextEnd = state.current;
      }
      if (nextEnd.getTime() <= nextStart.getTime()) {
        nextEnd = new Date(nextStart.getTime() + snapMinutes() * 60_000);
      }
      setSuppressNextBlockClick(true);
      const optimisticStart = nextStart.toISOString();
      const optimisticEnd = nextEnd.toISOString();
      setOptimisticTimes((current) => ({
        ...current,
        [state.block.id]: {
          startTime: optimisticStart,
          endTime: optimisticEnd,
        },
      }));
      try {
        await runUpdate({
          id: state.block.id,
          startTimeIso: optimisticStart,
          endTimeIso: optimisticEnd,
        });
      } catch (error) {
        setOptimisticTimes((current) => {
          const { [state.block.id]: _removed, ...rest } = current;
          return rest;
        });
        return;
      }
      refreshCalendar();
    }
  };

  const cancelActiveMouseInteraction = () => {
    const state = dragState();
    if (state.type === "idle") return;
    setDragState({ type: "idle" });
    setHoverTime(null);
    setSuppressNextBlockClick(false);
  };

  const handleBlockPointerDown = (
    event: PointerEvent,
    block: TimeBlockItem,
    edge?: "top" | "bottom",
  ) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    event.preventDefault();

    const blockStart = new Date(block.startTime);
    const blockEnd = new Date(block.endTime);

    if (edge) {
      setDragState({
        type: "resize",
        edge,
        block,
        initialStart: blockStart,
        initialEnd: blockEnd,
        current: edge === "top" ? blockStart : blockEnd,
        initialMouseY: event.clientY,
        didDrag: false,
      });
      return;
    }

    setDragState({
      type: "move",
      block,
      initialMouseX: event.clientX,
      initialMouseY: event.clientY,
      anchorStart: blockStart,
      anchorEnd: blockEnd,
      currentStart: blockStart,
      currentEnd: blockEnd,
      duplicate: event.altKey || event.metaKey || event.ctrlKey,
      didDrag: false,
    });
  };

  const handleBlockClick = (block: TimeBlockItem) => {
    if (suppressNextBlockClick()) {
      setSuppressNextBlockClick(false);
      return;
    }
    if (dragState().type !== "idle") return;
    setEditingBlock(block);
    setNewRange(null);
    setEditorOpen(true);
  };

  const previewStyle = createMemo(() => {
    const state = dragState();
    if (state.type !== "create") return null;
    const dayIndex = toDayIndex(state.start);
    if (dayIndex === null) return null;
    const start = state.start;
    const end = state.current;
    const top = Math.min(toGridY(start), toGridY(end));
    const bottom = Math.max(toGridY(start), toGridY(end));
    return {
      dayIndex,
      top,
      height: Math.max(pxPerMinute() * snapMinutes(), bottom - top),
    };
  });

  const draggingBlockId = createMemo(() => {
    const state = dragState();
    if (state.type === "move" || state.type === "resize") return state.block.id;
    return null;
  });

  const dragGhostStyle = createMemo(() => {
    const state = dragState();
    if (state.type !== "move" && state.type !== "resize") return null;
    const start =
      state.type === "move"
        ? state.currentStart
        : state.edge === "top"
          ? state.current
          : state.initialStart;
    const end =
      state.type === "move"
        ? state.currentEnd
        : state.edge === "bottom"
          ? state.current
          : state.initialEnd;
    const dayIndex = toDayIndex(start);
    if (dayIndex === null) return null;
    const segment = getVisibleSegment(start, end, dayIndex);
    if (!segment) return null;
    const laneWidth = 100 / numberOfDays();
    return {
      left: dayIndex * laneWidth,
      width: laneWidth,
      top: toGridY(segment.visibleStart),
      height: Math.max(
        pxPerMinute() * snapMinutes(),
        toGridY(segment.visibleEnd) - toGridY(segment.visibleStart),
      ),
      color: normalizeTimeBlockColor(state.block.color),
      title: state.block.title || "Untitled",
    };
  });

  const nowIndicator = createMemo(() => {
    const now = nowTime();
    if (!now) return null;
    const dayIndex = toDayIndex(now);
    if (dayIndex === null) return null;
    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < startHour() * 60 || minutes > endHour() * 60) return null;
    return {
      dayIndex,
      top: toGridY(now),
      label: formatTime24(now),
    };
  });

  const mouseTimeIndicator = createMemo(() => {
    const state = dragState();
    const sourceTime =
      state.type === "create"
        ? state.current
        : state.type === "idle"
          ? hoverTime()
          : null;
    if (!sourceTime) return null;
    const dayIndex = toDayIndex(sourceTime);
    if (dayIndex === null) return null;
    return {
      dayIndex,
      top: toGridY(sourceTime),
      label: formatTime24(sourceTime),
      side: mouseIndicatorSide(),
    };
  });

  const dragTimeIndicators = createMemo(() => {
    const state = dragState();
    if (state.type !== "move" && state.type !== "resize") return [];

    if (state.type === "move") {
      const dayIndex = toDayIndex(state.currentStart);
      if (dayIndex === null) return [];
      return [
        {
          id: "start",
          dayIndex,
          top: toGridY(state.currentStart),
          label: formatTime24(state.currentStart),
          edge: "top" as const,
        },
        {
          id: "end",
          dayIndex,
          top: toGridY(state.currentEnd),
          label: formatTime24(state.currentEnd),
          edge: "bottom" as const,
        },
      ];
    }

    const blockStart =
      state.edge === "top" ? state.current : state.initialStart;
    const blockEnd = state.edge === "bottom" ? state.current : state.initialEnd;
    let safeStart = blockStart;
    let safeEnd = blockEnd;
    if (safeEnd.getTime() <= safeStart.getTime()) {
      safeEnd = new Date(safeStart.getTime() + snapMinutes() * 60_000);
    }
    const durationMinutes = Math.max(
      snapMinutes(),
      Math.round((safeEnd.getTime() - safeStart.getTime()) / 60_000),
    );
    const dayIndex = toDayIndex(blockStart);
    if (dayIndex === null) return [];
    return [
      {
        id: state.edge,
        dayIndex,
        top: toGridY(state.edge === "top" ? safeStart : safeEnd),
        label: `${formatTime24(
          state.edge === "top" ? safeStart : safeEnd,
        )} (${formatDurationForIndicator(durationMinutes)})`,
        edge: state.edge,
      },
    ];
  });

  createEffect(() => {
    const blocks = weeklyBlocks.latest ?? weeklyBlocks();
    if (!blocks) return;
    const byId = new Map(blocks.map((block) => [block.id, block]));
    setOptimisticTimes((current) => {
      if (Object.keys(current).length === 0) return current;
      const next: Record<string, { startTime: string; endTime: string }> = {};
      for (const [id, optimistic] of Object.entries(current)) {
        const server = byId.get(id);
        if (!server) continue;
        if (
          server.startTime !== optimistic.startTime ||
          server.endTime !== optimistic.endTime
        ) {
          next[id] = optimistic;
        }
      }
      return next;
    });
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    setNowTime(new Date());
    const syncNow = () => setNowTime(new Date());
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      syncNow();
      intervalId = window.setInterval(syncNow, 60_000);
    }, msUntilNextMinute);
    onCleanup(() => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    });
  });

  createEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      void handlePointerMove(event);
    };
    const onPointerUp = () => {
      void handlePointerUp();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cancelActiveMouseInteraction();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    });
  });

  return (
    <Stack gap="4" flex="1" minH="0" overflow="hidden">
      <HStack
        data-testid="time-blocks-header"
        justifyContent="space-between"
        alignItems="center"
        gap="3"
        pb="2"
      >
        <HStack gap="3" alignItems="center" flexShrink={0} minW="0">
          <Heading as="h1" fontSize="2xl" lineHeight="1.1" whiteSpace="nowrap">
            Time Blocks
          </Heading>
          <Button
            size="md"
            variant="plain"
            aria-label="Previous"
            title="Previous"
            onClick={() =>
              setSelectedDate(addDays(selectedDate(), -numberOfDays()))
            }
          >
            <ChevronLeftIcon size={18} />
          </Button>
          <Input
            type="date"
            value={formatDateOnly(selectedDate())}
            w="170px"
            flex="0 0 auto"
            fontSize="lg"
            fontWeight="semibold"
            onInput={(event) => {
              const next = parseDateInput(event.currentTarget.value);
              if (next) setSelectedDate(startOfDay(next));
            }}
          />
          <Button
            size="md"
            variant="plain"
            aria-label="Next"
            title="Next"
            onClick={() =>
              setSelectedDate(addDays(selectedDate(), numberOfDays()))
            }
          >
            <ChevronRightIcon size={18} />
          </Button>
        </HStack>

        <HStack
          gap="2"
          alignItems="center"
          justifyContent="flex-end"
          flex="1"
          minW="0"
        >
          <Button size="md" variant="plain" onClick={() => setListOpen(true)}>
            <ListIcon size={16} />
            List View
          </Button>
          <Button
            size="md"
            variant="plain"
            onClick={() => setSummaryOpen(true)}
          >
            <TableIcon size={16} />
            Summary
          </Button>
          <SimplePopover
            open={settingsOpen()}
            onClose={() => setSettingsOpen(false)}
            anchor={
              <Button
                size="md"
                variant="plain"
                onClick={() => setSettingsOpen((value) => !value)}
              >
                <SettingsIcon size={16} />
              </Button>
            }
            placement="bottom-end"
            offset={8}
          >
            <Stack
              gap="2.5"
              p="3"
              style={{
                width: "fit-content",
                "max-width": "calc(100vw - 32px)",
              }}
            >
              <Text fontWeight="semibold">Calendar Settings</Text>
              <HStack alignItems="center" gap="3">
                <HStack gap="1.5" alignItems="center" w="170px" flexShrink={0}>
                  <Clock3Icon size={14} />
                  <Text fontSize="sm" color="fg.muted">
                    Start Hour
                  </Text>
                </HStack>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  w="96px"
                  minW="96px"
                  value={String(startHour())}
                  onInput={(event) =>
                    setStartHour(
                      clamp(Number(event.currentTarget.value || 0), 0, 23),
                    )
                  }
                />
              </HStack>
              <HStack alignItems="center" gap="3">
                <HStack gap="1.5" alignItems="center" w="170px" flexShrink={0}>
                  <Clock4Icon size={14} />
                  <Text fontSize="sm" color="fg.muted">
                    End Hour
                  </Text>
                </HStack>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  w="96px"
                  minW="96px"
                  value={String(endHour())}
                  onInput={(event) =>
                    setEndHour(
                      clamp(Number(event.currentTarget.value || 24), 1, 24),
                    )
                  }
                />
              </HStack>
              <HStack alignItems="center" gap="3">
                <HStack gap="1.5" alignItems="center" w="170px" flexShrink={0}>
                  <CalendarDaysIcon size={14} />
                  <Text fontSize="sm" color="fg.muted">
                    Days
                  </Text>
                </HStack>
                <Input
                  type="number"
                  min="1"
                  max="14"
                  w="96px"
                  minW="96px"
                  value={String(numberOfDays())}
                  onInput={(event) =>
                    setNumberOfDays(
                      clamp(Number(event.currentTarget.value || 7), 1, 14),
                    )
                  }
                />
              </HStack>
              <HStack alignItems="center" gap="3">
                <HStack gap="1.5" alignItems="center" w="170px" flexShrink={0}>
                  <Grid3X3Icon size={14} />
                  <Text fontSize="sm" color="fg.muted">
                    Snap Minutes
                  </Text>
                </HStack>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  step="5"
                  w="96px"
                  minW="96px"
                  value={String(snapMinutes())}
                  onInput={(event) =>
                    setSnapMinutes(
                      clamp(Number(event.currentTarget.value || 15), 5, 60),
                    )
                  }
                />
              </HStack>
              <HStack alignItems="center" gap="3">
                <HStack gap="1.5" alignItems="center" w="170px" flexShrink={0}>
                  <RulerIcon size={14} />
                  <Text fontSize="sm" color="fg.muted">
                    Hour Height (px)
                  </Text>
                </HStack>
                <Input
                  type="number"
                  min="30"
                  max="140"
                  w="96px"
                  minW="96px"
                  value={String(hourHeight())}
                  onInput={(event) =>
                    setHourHeight(
                      clamp(Number(event.currentTarget.value || 56), 30, 140),
                    )
                  }
                />
              </HStack>
            </Stack>
          </SimplePopover>
        </HStack>
      </HStack>

      <Box
        borderWidth="1px"
        borderColor="border"
        borderRadius="lg"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        flex="1"
        minH="0"
      >
        <Box
          display="grid"
          style={{
            "grid-template-columns": headerGridTemplate(),
          }}
          borderBottomWidth="1px"
          borderColor="border"
          bg="bg.muted"
        >
          <Box px="2" py="2" borderRightWidth="1px" borderColor="border">
            <Text fontSize="xs" color="fg.muted">
              Time
            </Text>
          </Box>
          <For each={dayDates()}>
            {(date, index) => (
              <HStack
                px="3"
                py="3"
                borderLeftWidth={index() === 0 ? "0px" : "1px"}
                borderColor="border"
                alignItems="center"
                justifyContent="space-between"
                minW="0"
                minH="16"
              >
                <Text
                  fontSize="md"
                  fontWeight="semibold"
                  lineHeight="1.2"
                  style={{
                    "white-space": "normal",
                    "word-break": "break-word",
                  }}
                >
                  {formatWeekdayShort(date)} {formatMonthDay(date)}
                </Text>
                <Button
                  size="xs"
                  variant="plain"
                  title={`Compact overlaps for ${formatMonthDay(date)}`}
                  onClick={() => {
                    void correctOverlappingBlocksForDay(date);
                  }}
                >
                  <WandSparklesIcon size={15} />
                </Button>
              </HStack>
            )}
          </For>
        </Box>

        <ScrollArea.Root flex="1" minH="0">
          <ScrollArea.Viewport
            ref={(element) => {
              scrollAreaRef = element;
            }}
          >
            <ScrollArea.Content>
              <Box display="flex" minH="0" w="full">
                <Stack
                  gap="0"
                  w="80px"
                  borderRightWidth="1px"
                  borderColor="border"
                  bg="bg.default"
                  flexShrink={0}
                  style={{
                    height: `${(endHour() - startHour()) * hourHeight()}px`,
                  }}
                >
                  <For
                    each={Array.from(
                      { length: endHour() - startHour() },
                      (_, i) => i + startHour(),
                    )}
                  >
                    {(hour) => (
                      <Box
                        data-testid="time-left-scale-row"
                        data-hour={String(hour)}
                        borderBottomWidth="1px"
                        borderColor="border"
                        style={{
                          height: `${hourHeight()}px`,
                          "min-height": `${hourHeight()}px`,
                          "max-height": `${hourHeight()}px`,
                          "padding-top": "6px",
                          "padding-right": "10px",
                          "padding-bottom": "0px",
                          "padding-left": "0px",
                          display: "flex",
                          "align-items": "flex-start",
                          "justify-content": "flex-end",
                          "box-sizing": "border-box",
                        }}
                      >
                        <Text fontSize="xs" color="fg.muted">
                          {hour}:00
                        </Text>
                      </Box>
                    )}
                  </For>
                </Stack>

                <Box
                  ref={gridRef}
                  data-testid="time-blocks-grid"
                  position="relative"
                  flex="1"
                  minW="0"
                  onPointerDown={(event) => handlePointerDownGrid(event)}
                  style={{
                    height: `${(endHour() - startHour()) * hourHeight()}px`,
                    cursor:
                      dragState().type === "idle" ? "crosshair" : "grabbing",
                    "user-select": "none",
                  }}
                >
                  <For each={dayDates()}>
                    {(_date, index) => (
                      <Box
                        position="absolute"
                        style={{
                          top: "0px",
                          left: `${(index() * 100) / numberOfDays()}%`,
                          width: `${100 / numberOfDays()}%`,
                          height: "100%",
                        }}
                        borderLeftWidth={index() === 0 ? "0px" : "1px"}
                        borderColor="border"
                      >
                        <Box
                          position="absolute"
                          top="0"
                          right="0"
                          h="100%"
                          w={`${LANE_GUTTER_PX}px`}
                          data-testid="time-block-lane-gutter"
                          bg="bg.default"
                          opacity={0.75}
                          pointerEvents="none"
                        />
                        <For
                          each={Array.from(
                            { length: (endHour() - startHour()) * 4 + 1 },
                            (_, q) => q,
                          )}
                        >
                          {(quarterIndex) => (
                            <Box
                              data-testid={
                                quarterIndex % 4 === 0
                                  ? "time-grid-hour-line"
                                  : "time-grid-quarter-line"
                              }
                              position="absolute"
                              left="0"
                              right="0"
                              borderTopWidth="1px"
                              style={{
                                top: `${(quarterIndex * hourHeight()) / 4}px`,
                                "border-top-color":
                                  quarterIndex % 4 === 0
                                    ? "rgba(24, 24, 27, 0.14)"
                                    : "rgba(24, 24, 27, 0.07)",
                              }}
                              pointerEvents="none"
                            />
                          )}
                        </For>
                      </Box>
                    )}
                  </For>

                  <For each={Array.from(groupedBlocksByDay().entries())}>
                    {([dayIndex, blocks]) => (
                      <For each={blocks}>
                        {(block) => {
                          const start = new Date(block.startTime);
                          const end = new Date(block.endTime);
                          const geometry = () => {
                            const segment = getVisibleSegment(
                              start,
                              end,
                              dayIndex,
                            );
                            if (!segment) return null;
                            const laneWidth = laneWidthPercent();
                            const overlapCount = Math.max(
                              1,
                              block.totalOverlaps,
                            );
                            const left = `calc(${dayIndex * laneWidth}% + ((${laneWidth}% - ${LANE_GUTTER_PX}px) / ${overlapCount}) * ${block.index})`;
                            const width = `calc((${laneWidth}% - ${LANE_GUTTER_PX}px) / ${overlapCount})`;
                            return {
                              left,
                              width,
                              top: toGridY(segment.visibleStart),
                              height: Math.max(
                                pxPerMinute() * snapMinutes(),
                                toGridY(segment.visibleEnd) -
                                  toGridY(segment.visibleStart),
                              ),
                              isDraggedBlock: draggingBlockId() === block.id,
                            };
                          };
                          return (
                            <Show when={geometry()}>
                              {(geo) => (
                                <Box
                                  data-time-block="true"
                                  data-testid="time-block-item"
                                  data-time-block-id={block.id}
                                  position="absolute"
                                  px="1"
                                  py="0.5"
                                  borderRadius="sm"
                                  borderWidth="0"
                                  transition="box-shadow 120ms ease, filter 120ms ease"
                                  _hover={{
                                    boxShadow:
                                      "0 10px 24px rgba(0, 0, 0, 0.22), 0 0 0 2px rgba(255, 255, 255, 0.95), 0 0 0 4px rgba(37, 99, 235, 0.45)",
                                    filter: "brightness(1.04)",
                                  }}
                                  style={{
                                    "background-color":
                                      normalizeTimeBlockColor(block.color),
                                    color: "white",
                                    cursor: "grab",
                                    overflow: "hidden",
                                    opacity: geo().isDraggedBlock ? 0.3 : 1,
                                    left: geo().left,
                                    width: geo().width,
                                    top: `${geo().top}px`,
                                    height: `${geo().height}px`,
                                  }}
                                  onPointerDown={(event) =>
                                    handleBlockPointerDown(event, block)
                                  }
                                  onClick={() => handleBlockClick(block)}
                                >
                                  <Box
                                    data-time-block="true"
                                    data-testid="time-block-resize-top"
                                    position="absolute"
                                    top="0"
                                    left="0"
                                    right="0"
                                    h="6px"
                                    cursor="ns-resize"
                                    onPointerDown={(event) =>
                                      handleBlockPointerDown(
                                        event,
                                        block,
                                        "top",
                                      )
                                    }
                                  />
                                  <Stack gap="0" pointerEvents="none">
                                    <Text
                                      fontSize="xs"
                                      fontWeight="semibold"
                                      color="white"
                                      style={{
                                        "white-space": "normal",
                                        overflow: "hidden",
                                        "word-break": "break-word",
                                        "line-height": "1.25",
                                      }}
                                    >
                                      {block.title || "Untitled"}
                                    </Text>
                                  </Stack>
                                  <Show when={block.isFixedTime}>
                                    <Box
                                      position="absolute"
                                      top="4px"
                                      right="4px"
                                      pointerEvents="none"
                                      style={{
                                        "z-index": "2",
                                        display: "flex",
                                        "align-items": "center",
                                        "justify-content": "center",
                                      }}
                                    >
                                      <LockIcon size={12} color="white" />
                                    </Box>
                                  </Show>
                                  <Box
                                    data-time-block="true"
                                    data-testid="time-block-resize-bottom"
                                    position="absolute"
                                    bottom="0"
                                    left="0"
                                    right="0"
                                    h="6px"
                                    cursor="ns-resize"
                                    onPointerDown={(event) =>
                                      handleBlockPointerDown(
                                        event,
                                        block,
                                        "bottom",
                                      )
                                    }
                                  />
                                </Box>
                              )}
                            </Show>
                          );
                        }}
                      </For>
                    )}
                  </For>

                  <Show when={previewStyle()}>
                    {(preview) => {
                      const laneWidth = laneWidthPercent();
                      return (
                        <Box
                          data-testid="time-block-create-preview"
                          position="absolute"
                          opacity={0.85}
                          borderWidth="2px"
                          borderColor="blue.800"
                          borderStyle="solid"
                          boxShadow="0 0 0 1px rgba(255,255,255,0.5) inset, 0 8px 22px rgba(0, 0, 0, 0.18)"
                          pointerEvents="none"
                          style={{
                            "background-color": "rgba(37, 99, 235, 0.45)",
                            left: `${preview().dayIndex * laneWidth}%`,
                            width: `calc(${laneWidth}% - ${LANE_GUTTER_PX}px)`,
                            top: `${preview().top}px`,
                            height: `${preview().height}px`,
                          }}
                        />
                      );
                    }}
                  </Show>

                  <Show when={dragGhostStyle()}>
                    {(ghost) => (
                      <Box
                        data-testid="time-block-drag-ghost"
                        position="absolute"
                        px="1"
                        py="0.5"
                        borderRadius="sm"
                        borderWidth="2px"
                        borderStyle="solid"
                        borderColor="white"
                        style={{
                          "background-color": ghost().color,
                          opacity: 0.88,
                          "box-shadow":
                            "0 0 0 1px rgba(255,255,255,0.45) inset, 0 10px 24px rgba(0,0,0,0.18)",
                          "pointer-events": "none",
                          left: `${ghost().left}%`,
                          width: `calc(${ghost().width}% - ${LANE_GUTTER_PX}px)`,
                          top: `${ghost().top}px`,
                          height: `${ghost().height}px`,
                        }}
                      >
                        <Text
                          fontSize="xs"
                          fontWeight="semibold"
                          color="white"
                          style={{
                            "white-space": "normal",
                            overflow: "hidden",
                            "word-break": "break-word",
                            "line-height": "1.25",
                          }}
                        >
                          {ghost().title}
                        </Text>
                      </Box>
                    )}
                  </Show>

                  <Show when={nowIndicator()}>
                    {(indicator) => {
                      const laneWidth = 100 / numberOfDays();
                      const centerPct =
                        indicator().dayIndex * laneWidth + laneWidth / 2;
                      return (
                        <>
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            style={{
                              left: `${indicator().dayIndex * laneWidth}%`,
                              width: `${laneWidth}%`,
                              top: `${indicator().top}px`,
                              height: "0px",
                              "border-top":
                                "3px solid rgba(255, 255, 255, 0.96)",
                              "z-index": "6",
                            }}
                          />
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            style={{
                              left: `${indicator().dayIndex * laneWidth}%`,
                              width: `${laneWidth}%`,
                              top: `${indicator().top}px`,
                              height: "0px",
                              "border-top": "2px solid rgba(239, 68, 68, 0.98)",
                              "z-index": "7",
                            }}
                          />
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            borderRadius="sm"
                            px="1.5"
                            py="0.5"
                            style={{
                              left: `${centerPct}%`,
                              top: `${indicator().top}px`,
                              transform: "translate(-50%, -50%)",
                              "background-color": "rgba(239, 68, 68, 0.98)",
                              color: "white",
                              "font-size": "10px",
                              "font-weight": "700",
                              "line-height": "1",
                              "letter-spacing": "0.02em",
                              "z-index": "8",
                              "box-shadow": "0 2px 8px rgba(0,0,0,0.24)",
                            }}
                          >
                            Now
                          </Box>
                        </>
                      );
                    }}
                  </Show>

                  <Show when={mouseTimeIndicator()}>
                    {(indicator) => {
                      const laneWidth = 100 / numberOfDays();
                      return (
                        <>
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            style={{
                              left: `${indicator().dayIndex * laneWidth}%`,
                              width: `${laneWidth}%`,
                              top: `${indicator().top}px`,
                              height: "0px",
                              "border-top":
                                "4px solid rgba(255, 255, 255, 0.95)",
                              "z-index": "2",
                            }}
                          />
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            style={{
                              left: `${indicator().dayIndex * laneWidth}%`,
                              width: `${laneWidth}%`,
                              top: `${indicator().top}px`,
                              height: "0px",
                              "border-top": "2px solid rgba(37, 99, 235, 0.9)",
                              "z-index": "3",
                            }}
                          />
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            borderRadius="sm"
                            px="2"
                            py="0.5"
                            style={{
                              left:
                                indicator().side === "left"
                                  ? `calc(${indicator().dayIndex * laneWidth}% + 6px)`
                                  : `calc(${(indicator().dayIndex + 1) * laneWidth}% - 4px)`,
                              top: `${indicator().top}px`,
                              transform:
                                indicator().side === "left"
                                  ? "translate(0, -50%)"
                                  : "translate(-100%, -50%)",
                              "background-color": "rgba(239, 68, 68, 0.95)",
                              color: "white",
                              "font-size": "12px",
                              "font-weight": "700",
                              "line-height": "1",
                              "z-index": "3",
                              "box-shadow": "0 2px 8px rgba(0,0,0,0.2)",
                            }}
                          >
                            {indicator().label}
                          </Box>
                        </>
                      );
                    }}
                  </Show>

                  <For each={dragTimeIndicators()}>
                    {(indicator) => {
                      const laneWidth = 100 / numberOfDays();
                      const centerPct =
                        indicator.dayIndex * laneWidth + laneWidth / 2;
                      return (
                        <>
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            style={{
                              left: `${indicator.dayIndex * laneWidth}%`,
                              width: `${laneWidth}%`,
                              top: `${indicator.top}px`,
                              height: "0px",
                              "border-top": "2px solid rgba(239, 68, 68, 0.85)",
                              "z-index": "3",
                            }}
                          />
                          <Box
                            position="absolute"
                            pointerEvents="none"
                            borderRadius="sm"
                            px="2"
                            py="0.5"
                            style={{
                              left: `${centerPct}%`,
                              top: `${indicator.top}px`,
                              transform:
                                indicator.edge === "top"
                                  ? "translate(-50%, calc(-100% - 6px))"
                                  : "translate(-50%, 6px)",
                              "background-color": "rgba(239, 68, 68, 0.95)",
                              color: "white",
                              "font-size": "12px",
                              "font-weight": "700",
                              "line-height": "1",
                              "z-index": "4",
                              "box-shadow": "0 2px 8px rgba(0,0,0,0.2)",
                            }}
                          >
                            {indicator.label}
                          </Box>
                        </>
                      );
                    }}
                  </For>
                </Box>
              </Box>
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Corner />
        </ScrollArea.Root>
      </Box>

      <TimeBlockEditorDialog
        open={editorOpen()}
        block={editingBlock()}
        newRange={newRange()}
        onClose={() => setEditorOpen(false)}
        onSaved={() => refreshCalendar()}
      />

      <TimeBlocksListDialog
        open={listOpen()}
        onClose={() => setListOpen(false)}
        weekStart={weekStart()}
        numberOfDays={numberOfDays()}
        onEdit={(block) => {
          setEditingBlock(block);
          setNewRange(null);
          setEditorOpen(true);
        }}
        refreshKey={refreshNonce()}
        onChanged={() => refreshCalendar()}
      />

      <TimeBlockMetadataSummaryDialog
        open={summaryOpen()}
        onClose={() => setSummaryOpen(false)}
        weekStart={weekStart()}
        refreshKey={refreshNonce()}
        onChanged={() => refreshCalendar()}
      />
    </Stack>
  );
};
