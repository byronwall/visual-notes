import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import {
  fetchDateRangeTimeBlockMeta,
  fetchWeeklyTimeBlocks,
  type TimeBlockItem,
} from "~/services/time-blocks/time-blocks.service";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import {
  addDays,
  formatClock,
  isSameDay,
  MS_PER_MINUTE,
  startOfDay,
} from "./date-utils";
import { layoutDayBlocks, type TimeBlockWithPosition } from "./overlap";
import {
  getDayIndexInRange,
  getVisibleSegmentForDay,
  toGridY,
} from "./weekly-geometry";
import {
  normalizeTimeBlockColor,
  randomTimeBlockColor,
  readableTextColor,
} from "./time-block-colors";
import { compactDayBlocks } from "./compact-day";
import { BlockFace } from "./BlockFace";
import { BlockQuickPopover } from "./BlockQuickPopover";
import { DayHeaderRow } from "./DayHeaderRow";
import { DraftBlock, type DraftRange } from "./DraftBlock";
import { blockShell, TimeBlockCard, type BlockGeometry } from "./TimeBlockCard";
import {
  TimeBlockEditorDialog,
  type NewBlockSeed,
} from "./TimeBlockEditorDialog";
import { TimeBlockMetadataSummaryDialog } from "./TimeBlockMetadataSummaryDialog";
import { TimeBlocksListDialog } from "./TimeBlocksListDialog";
import { TimeBlocksToolbar } from "./TimeBlocksToolbar";
import { TimeGutter } from "./TimeGutter";
import { useBlockDrag } from "./useBlockDrag";
import { useCalendarSettings } from "./useCalendarSettings";
import { useTimeBlockMutations } from "./useTimeBlockMutations";

type Props = {
  initialNoteId?: string;
  onClearNoteFilter?: () => void;
};

const GUTTER_PX = 52;
/** Free strip on the right of each day so there is always room to draw. */
const LANE_GUTTER_PX = 10;

const scroller = css({
  position: "relative",
  flex: "1",
  minH: "0",
  overflow: "auto",
  overscrollBehavior: "contain",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "lg",
  bg: "bg.default",
  // Phones get one day per screen and swipe sideways between days.
  scrollSnapType: { base: "x mandatory", md: "none" },
  scrollPaddingLeft: "52px",
  "--tb-day-min": { base: "calc(100vw - 70px)", md: "112px" },
});

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return Boolean(
    el.closest(
      "input, textarea, select, [contenteditable='true'], [role='dialog']",
    ),
  );
};

export const WeeklyTimeBlocksCalendar = (props: Props) => {
  const settings = useCalendarSettings();
  const { startHour, endHour, numberOfDays, snapMinutes, hourHeight } =
    settings;
  const [rangeStart, setRangeStart] = createSignal(startOfDay(new Date()));
  const [now, setNow] = createSignal<Date | null>(null);
  const [refreshNonce, setRefreshNonce] = createSignal(0);
  const refresh = () => setRefreshNonce((value) => value + 1);

  const [listOpen, setListOpen] = createSignal(false);
  const [summaryOpen, setSummaryOpen] = createSignal(false);
  const [editor, setEditor] = createSignal<{
    block: TimeBlockItem | null;
    seed: NewBlockSeed | null;
  } | null>(null);
  const [quick, setQuick] = createSignal<{
    id: string;
    anchor: HTMLElement;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = createSignal<TimeBlockItem | null>(
    null,
  );
  const [draft, setDraft] = createSignal<DraftRange | null>(null);
  const [draftSaving, setDraftSaving] = createSignal<string | null>(null);

  let gridRef: HTMLDivElement | undefined;
  let scrollerRef: HTMLDivElement | undefined;

  const dayDates = createMemo(() =>
    Array.from({ length: numberOfDays() }, (_, index) =>
      addDays(rangeStart(), index),
    ),
  );
  const laneWidth = () => 100 / numberOfDays();
  const pxPerMinute = () => hourHeight() / 60;
  const gridHeight = () => (endHour() - startHour()) * hourHeight();
  const yOf = (date: Date) =>
    toGridY(date, startHour(), endHour(), hourHeight());
  const dayIndexOf = (date: Date) =>
    getDayIndexInRange(date, rangeStart(), numberOfDays());
  const todayIndex = () => {
    const current = now();
    return current ? dayIndexOf(current) : null;
  };

  const [weeklyBlocks] = createResource(
    () => ({
      refresh: refreshNonce(),
      weekStartIso: rangeStart().toISOString(),
      numberOfDays: numberOfDays(),
      noteId: props.initialNoteId || undefined,
    }),
    ({ weekStartIso, numberOfDays: days, noteId }) =>
      fetchWeeklyTimeBlocks({ weekStartIso, numberOfDays: days, noteId }),
  );

  const [dayMeta] = createResource(
    () => ({
      refresh: refreshNonce(),
      startIso: rangeStart().toISOString(),
      endIso: addDays(rangeStart(), numberOfDays()).toISOString(),
    }),
    ({ startIso, endIso }) => fetchDateRangeTimeBlockMeta({ startIso, endIso }),
  );

  const metaByDay = createMemo(() => {
    const byDay: Array<Array<{ key: string; value: string }>> = dayDates().map(
      () => [],
    );
    for (const entry of dayMeta.error ? [] : dayMeta.latest ?? []) {
      const dayIndex = dayIndexOf(new Date(entry.date));
      if (dayIndex !== null)
        byDay[dayIndex].push({ key: entry.key, value: entry.value });
    }
    return byDay;
  });

  const mutations = useTimeBlockMutations(
    () => (weeklyBlocks.error ? undefined : weeklyBlocks.latest),
    refresh,
  );
  const blocks = mutations.blocks;

  const blocksByDay = createMemo(() => {
    const byDay = new Map<number, TimeBlockItem[]>();
    for (const block of blocks()) {
      const dayIndex = dayIndexOf(new Date(block.startTime));
      if (dayIndex === null) continue;
      byDay.set(dayIndex, [...(byDay.get(dayIndex) ?? []), block]);
    }
    return byDay;
  });

  const laidOut = createMemo(() => {
    const byId = new Map<
      string,
      { block: TimeBlockWithPosition; dayIndex: number }
    >();
    for (const [dayIndex, dayBlocks] of blocksByDay().entries()) {
      for (const block of layoutDayBlocks(dayBlocks))
        byId.set(block.id, { block, dayIndex });
    }
    return byId;
  });
  // Render by id (strings compare by value) so cards keep DOM and focus across updates.
  const laidOutIds = createMemo(() => Array.from(laidOut().keys()));

  const plannedMinutesByDay = createMemo(() =>
    dayDates().map((_, index) =>
      (blocksByDay().get(index) ?? []).reduce(
        (sum, block) =>
          sum +
          (new Date(block.endTime).getTime() -
            new Date(block.startTime).getTime()) /
            MS_PER_MINUTE,
        0,
      ),
    ),
  );

  const noteFilterLabel = () => {
    if (!props.initialNoteId) return null;
    const titled = blocks().find((block) => block.noteTitle);
    return titled?.noteTitle ?? "Linked note";
  };

  /** Pixel box for a time range in one day column, clipped to visible hours. */
  const rangeGeometry = (
    start: Date,
    end: Date,
    dayIndex: number,
    lane = { column: 0, columns: 1, span: 1 },
  ): BlockGeometry | null => {
    const segment = getVisibleSegmentForDay(
      start,
      end,
      dayIndex,
      rangeStart(),
      startHour(),
      endHour(),
    );
    if (!segment) return null;
    const top = yOf(segment.visibleStart);
    const usable = `(${laneWidth()}% - ${LANE_GUTTER_PX}px)`;
    return {
      left: `calc(${dayIndex * laneWidth()}% + ${usable} * ${lane.column / lane.columns})`,
      width: `calc(${usable} * ${lane.span / lane.columns} - 1px)`,
      top,
      height: Math.max(pxPerMinute() * 15, yOf(segment.visibleEnd) - top),
    };
  };

  const drag = useBlockDrag({
    grid: () => gridRef,
    scroller: () => scrollerRef,
    headerHeight: () =>
      scrollerRef?.querySelector<HTMLElement>(
        "[data-testid=time-blocks-day-header]",
      )?.offsetHeight ?? 0,
    days: numberOfDays,
    rangeStart,
    startHour,
    endHour,
    snapMinutes,
    pxPerMinute,
    pickColor: randomTimeBlockColor,
    onCreate: (range) => {
      setQuick(null);
      setDraft(range);
    },
    onMove: (block, start, end, duplicate) => {
      if (duplicate) void mutations.duplicate(block, start, end);
      else void mutations.setTimes(block, start, end);
    },
    onResize: (block, start, end) => void mutations.setTimes(block, start, end),
  });

  const dragPreview = createMemo(() => {
    const state = drag.state();
    if (state.type === "create") {
      const range = drag.createRange(state);
      if (!state.didDrag) return null;
      const geometry = rangeGeometry(range.start, range.end, state.dayIndex);
      return (
        geometry && {
          ...range,
          geometry,
          color: state.color,
          title: "New block",
          id: "",
        }
      );
    }
    if (state.type === "move" || state.type === "resize") {
      if (!state.didDrag) return null;
      const dayIndex = dayIndexOf(state.start);
      if (dayIndex === null) return null;
      const geometry = rangeGeometry(state.start, state.end, dayIndex);
      return (
        geometry && {
          start: state.start,
          end: state.end,
          geometry,
          color: normalizeTimeBlockColor(state.block.color),
          title: state.block.title || "Untitled",
          id: state.block.id,
        }
      );
    }
    return null;
  });

  const draggedId = () => dragPreview()?.id || null;

  const draftView = createMemo(() => {
    const current = draft();
    if (!current) return null;
    const dayIndex = dayIndexOf(current.start);
    if (dayIndex === null) return null;
    const geometry = rangeGeometry(current.start, current.end, dayIndex);
    return geometry && { draft: current, geometry };
  });

  // Keep the draft on screen until the block it created arrives from the server.
  createEffect(() => {
    const savingId = draftSaving();
    if (savingId && blocks().some((block) => block.id === savingId)) {
      setDraft(null);
      setDraftSaving(null);
    }
  });

  const commitDraft = async (title: string) => {
    const current = draft();
    if (!current) return;
    if (!title) {
      setDraft(null);
      return;
    }
    setDraftSaving("pending");
    try {
      const id = await mutations.create({
        ...current,
        title,
        noteId: props.initialNoteId,
      });
      setDraftSaving(id);
    } catch (error) {
      console.error("[time-blocks] create failed", error);
      setDraftSaving(null);
      setDraft(null);
    }
  };

  const hoverSlot = createMemo(() => {
    const hover = drag.hover();
    if (!hover || draft() || drag.state().type !== "idle") return null;
    const end = new Date(hover.time.getTime() + snapMinutes() * MS_PER_MINUTE);
    const geometry = rangeGeometry(hover.time, end, hover.dayIndex);
    return geometry && { geometry, label: formatClock(hover.time) };
  });

  const nowLine = createMemo(() => {
    const current = now();
    const dayIndex = todayIndex();
    if (!current || dayIndex === null) return null;
    const minutes = current.getHours() * 60 + current.getMinutes();
    if (minutes < startHour() * 60 || minutes > endHour() * 60) return null;
    return { dayIndex, top: yOf(current), label: formatClock(current) };
  });

  const quickBlock = () => {
    const current = quick();
    return current
      ? blocks().find((block) => block.id === current.id) ?? null
      : null;
  };

  const openQuick = (block: TimeBlockItem, anchor: HTMLElement) => {
    if (drag.consumeClickSuppression()) return;
    if (quick()?.id === block.id) {
      setQuick(null);
      return;
    }
    // Close first so the popover re-anchors to the new block.
    setQuick(null);
    queueMicrotask(() => setQuick({ id: block.id, anchor }));
  };

  const openEditor = (
    block: TimeBlockItem | null,
    seed: NewBlockSeed | null = null,
  ) => {
    setQuick(null);
    setEditor({ block, seed });
  };

  const nudgeBlock = (event: KeyboardEvent, block: TimeBlockItem) => {
    const start = new Date(block.startTime);
    const end = new Date(block.endTime);
    const snapMs = snapMinutes() * MS_PER_MINUTE;
    const step = (sign: number) => sign * snapMs;
    switch (event.key) {
      case "Enter":
      case " ":
        openQuick(block, event.currentTarget as HTMLElement);
        break;
      case "Delete":
      case "Backspace":
        setPendingDelete(block);
        break;
      case "ArrowUp":
      case "ArrowDown": {
        const delta = step(event.key === "ArrowUp" ? -1 : 1);
        if (event.shiftKey) {
          const nextEnd = new Date(
            Math.max(end.getTime() + delta, start.getTime() + snapMs),
          );
          void mutations.setTimes(block, start, nextEnd);
        } else {
          void mutations.setTimes(
            block,
            new Date(start.getTime() + delta),
            new Date(end.getTime() + delta),
          );
        }
        break;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        const days = event.key === "ArrowLeft" ? -1 : 1;
        void mutations.setTimes(
          block,
          addDays(start, days),
          addDays(end, days),
        );
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const scrollToFocus = (behavior: ScrollBehavior = "auto") => {
    if (!scrollerRef) return;
    const line = nowLine();
    const firstBlock = Array.from(laidOut().values())
      .map(({ block }) => new Date(block.startTime))
      .sort(
        (a, b) =>
          a.getHours() * 60 +
          a.getMinutes() -
          (b.getHours() * 60 + b.getMinutes()),
      )[0];
    const focusTop = line
      ? line.top - hourHeight() * 2
      : firstBlock
        ? yOf(firstBlock) - hourHeight() / 2
        : 0;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollerRef.scrollTo({
      top: Math.max(0, focusTop),
      left: 0,
      behavior: reduceMotion ? "auto" : behavior,
    });
  };

  const goToday = () => {
    setRangeStart(startOfDay(new Date()));
    queueMicrotask(() => scrollToFocus("smooth"));
  };

  const navigate = (direction: -1 | 1) =>
    setRangeStart(addDays(rangeStart(), direction * numberOfDays()));

  onMount(() => {
    setNow(new Date());
    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(
      () => {
        setNow(new Date());
        intervalId = window.setInterval(() => setNow(new Date()), 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      if (
        (event.target as HTMLElement | null)?.closest?.(
          "[data-time-block='true']",
        )
      )
        return;
      if (event.key === "ArrowLeft") navigate(-1);
      else if (event.key === "ArrowRight") navigate(1);
      else if (event.key === "t" || event.key === "T") goToday();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
      window.removeEventListener("keydown", onKeyDown);
    });
  });

  // Bring the useful part of the day into view once the first data lands.
  let didInitialScroll = false;
  createEffect(
    on(
      () =>
        [
          weeklyBlocks.error ? undefined : weeklyBlocks.latest,
          settings.hydrated(),
        ] as const,
      ([loaded, hydrated]) => {
        if (didInitialScroll || !loaded || !hydrated) return;
        didInitialScroll = true;
        requestAnimationFrame(() => scrollToFocus());
      },
    ),
  );

  return (
    <Stack gap="0" flex="1" minH="0" overflow="hidden">
      <TimeBlocksToolbar
        rangeStart={rangeStart()}
        settings={settings}
        isAtToday={isSameDay(rangeStart(), now() ?? rangeStart())}
        noteFilterLabel={noteFilterLabel()}
        onNavigate={navigate}
        onToday={goToday}
        onPickDate={(date) => setRangeStart(startOfDay(date))}
        onClearNoteFilter={() => props.onClearNoteFilter?.()}
        onOpenList={() => setListOpen(true)}
        onOpenSummary={() => setSummaryOpen(true)}
      />

      <Show when={weeklyBlocks.error}>
        <HStack
          role="alert"
          gap="2"
          px="3"
          py="1.5"
          mb="2"
          borderRadius="md"
          bg="red.a3"
          color="red.11"
          fontSize="sm"
        >
          Couldn’t load time blocks for this range.
          <Button
            size="2xs"
            variant="outline"
            colorPalette="red"
            onClick={refresh}
          >
            Retry
          </Button>
        </HStack>
      </Show>

      <div
        ref={scrollerRef}
        class={scroller}
        data-testid="time-blocks-scroller"
      >
        <Box
          style={{
            "min-width": `calc(${GUTTER_PX}px + var(--tb-day-min) * ${numberOfDays()})`,
          }}
        >
          <DayHeaderRow
            dates={dayDates()}
            todayIndex={todayIndex()}
            plannedMinutesByDay={plannedMinutesByDay()}
            metaByDay={metaByDay()}
            onOpenMeta={() => setSummaryOpen(true)}
            gutterWidth={GUTTER_PX}
            onCompactDay={(date) =>
              void mutations.setMany(
                compactDayBlocks(
                  blocks().filter((block) =>
                    isSameDay(new Date(block.startTime), date),
                  ),
                ),
              )
            }
          />
          <Box display="flex">
            <TimeGutter
              startHour={startHour()}
              endHour={endHour()}
              hourHeight={hourHeight()}
              width={GUTTER_PX}
              now={nowLine()}
            />
            <Box
              ref={gridRef}
              data-testid="time-blocks-grid"
              position="relative"
              flex="1"
              minW="0"
              onPointerDown={(event) => {
                (document.activeElement as HTMLElement | null)?.blur?.();
                drag.onGridPointerDown(event);
              }}
              onClick={() => drag.onGridClick()}
              style={{
                height: `${gridHeight()}px`,
                cursor: drag.state().type === "idle" ? "default" : "grabbing",
                "user-select": "none",
                "-webkit-user-select": "none",
                "background-image": `linear-gradient(to bottom, var(--colors-gray-a4) 1px, transparent 1px), linear-gradient(to bottom, transparent ${hourHeight() / 2}px, var(--colors-gray-a2) ${hourHeight() / 2}px, var(--colors-gray-a2) ${hourHeight() / 2 + 1}px, transparent ${hourHeight() / 2 + 1}px)`,
                "background-size": `100% ${hourHeight()}px`,
              }}
            >
              <For each={dayDates()}>
                {(date, index) => (
                  <Box
                    position="absolute"
                    top="0"
                    h="full"
                    borderLeftWidth="1px"
                    borderColor="border"
                    pointerEvents="none"
                    scrollSnapAlign="start"
                    bg={
                      date.getDay() === 0 || date.getDay() === 6
                        ? "gray.a2"
                        : undefined
                    }
                    style={{
                      left: `${index() * laneWidth()}%`,
                      width: `${laneWidth()}%`,
                    }}
                  />
                )}
              </For>

              <Show when={hoverSlot()}>
                {(slot) => (
                  <Box
                    data-testid="time-blocks-hover-slot"
                    position="absolute"
                    pointerEvents="none"
                    borderRadius="sm"
                    bg="gray.a3"
                    color="fg.muted"
                    fontSize="11px"
                    lineHeight="1"
                    px="1.5"
                    display="flex"
                    alignItems="center"
                    style={{
                      left: slot().geometry.left,
                      width: slot().geometry.width,
                      top: `${slot().geometry.top}px`,
                      height: `${slot().geometry.height}px`,
                      "font-variant-numeric": "tabular-nums",
                    }}
                  >
                    {slot().label}
                  </Box>
                )}
              </Show>

              <For each={laidOutIds()}>
                {(id) => {
                  const entry = () => laidOut().get(id);
                  const geometry = () => {
                    const current = entry();
                    if (!current) return null;
                    const { block, dayIndex } = current;
                    return rangeGeometry(
                      new Date(block.startTime),
                      new Date(block.endTime),
                      dayIndex,
                      block,
                    );
                  };
                  return (
                    <Show when={entry() && geometry()}>
                      <TimeBlockCard
                        block={entry()!.block}
                        geometry={geometry()!}
                        dimmed={draggedId() === id}
                        selected={quick()?.id === id}
                        onPointerDown={(event, edge) =>
                          drag.onBlockPointerDown(event, entry()!.block, edge)
                        }
                        onActivate={(element) =>
                          openQuick(entry()!.block, element)
                        }
                        onKeyDown={(event) => nudgeBlock(event, entry()!.block)}
                      />
                    </Show>
                  );
                }}
              </For>

              <Show when={nowLine()}>
                {(line) => (
                  <Box
                    data-testid="time-blocks-now-line"
                    position="absolute"
                    pointerEvents="none"
                    h="2px"
                    bg="red.9"
                    zIndex="2"
                    style={{
                      left: `${line().dayIndex * laneWidth()}%`,
                      width: `${laneWidth()}%`,
                      top: `${line().top - 1}px`,
                    }}
                  >
                    <Box
                      position="absolute"
                      left="-1"
                      top="-3px"
                      w="2"
                      h="2"
                      borderRadius="full"
                      bg="red.9"
                    />
                  </Box>
                )}
              </Show>

              <Show when={dragPreview()}>
                {(preview) => (
                  <div
                    class={blockShell}
                    data-testid={
                      preview().id
                        ? "time-block-drag-ghost"
                        : "time-block-create-preview"
                    }
                    style={{
                      "background-color": preview().color,
                      color: readableTextColor(preview().color),
                      "z-index": "3",
                      "pointer-events": "none",
                      "box-shadow":
                        "0 0 0 1px var(--colors-bg-default), 0 8px 20px var(--colors-black-a5)",
                      left: preview().geometry.left,
                      width: preview().geometry.width,
                      top: `${preview().geometry.top}px`,
                      height: `${preview().geometry.height}px`,
                    }}
                  >
                    <BlockFace
                      title={preview().title}
                      start={preview().start}
                      end={preview().end}
                      heightPx={preview().geometry.height}
                      showDuration
                    />
                  </div>
                )}
              </Show>

              <Show when={draftView()} keyed>
                {(view) => (
                  <DraftBlock
                    draft={view.draft}
                    geometry={view.geometry}
                    saving={draftSaving() !== null}
                    onCommit={(title) => void commitDraft(title)}
                    onCancel={() => setDraft(null)}
                    onExpand={(title) => {
                      setDraft(null);
                      openEditor(null, { ...view.draft, title });
                    }}
                  />
                )}
              </Show>
            </Box>
          </Box>
        </Box>
      </div>

      <BlockQuickPopover
        block={quickBlock()}
        anchor={quick()?.anchor ?? null}
        onClose={() => setQuick(null)}
        onRename={(block, title) => void mutations.rename(block, title)}
        onToggleFixed={(block) => void mutations.toggleFixed(block)}
        onDelete={(block) => {
          setQuick(null);
          setPendingDelete(block);
        }}
        onOpenEditor={(block) => openEditor(block)}
      />

      <ConfirmDialog
        open={pendingDelete() !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete time block"
        description={`Delete “${pendingDelete()?.title || "Untitled"}”?`}
        confirmLabel="Delete"
        onConfirm={() => {
          const block = pendingDelete();
          if (block) void mutations.remove(block);
        }}
      />

      <TimeBlockEditorDialog
        open={editor() !== null}
        block={editor()?.block ?? null}
        seed={editor()?.seed ?? null}
        noteId={props.initialNoteId}
        onClose={() => setEditor(null)}
        onSaved={refresh}
      />

      <TimeBlocksListDialog
        open={listOpen()}
        onClose={() => setListOpen(false)}
        weekStart={rangeStart()}
        numberOfDays={numberOfDays()}
        onEdit={(block) => openEditor(block)}
        refreshKey={refreshNonce()}
        onChanged={refresh}
      />

      <TimeBlockMetadataSummaryDialog
        open={summaryOpen()}
        onClose={() => setSummaryOpen(false)}
        weekStart={rangeStart()}
        refreshKey={refreshNonce()}
        onChanged={refresh}
      />
    </Stack>
  );
};
