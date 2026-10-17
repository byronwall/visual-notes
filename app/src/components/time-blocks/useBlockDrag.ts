import { createSignal, onCleanup, onMount } from "solid-js";
import type { TimeBlockItem } from "~/services/time-blocks/time-blocks.service";
import { addDays, MS_PER_MINUTE } from "./date-utils";

const DRAG_THRESHOLD_PX = 4;
/** Length of a block created with a click (or tap) instead of a drag. */
export const CLICK_CREATE_MINUTES = 30;

export type DragState =
  | { type: "idle" }
  | {
      type: "create";
      anchor: Date;
      current: Date;
      dayIndex: number;
      startX: number;
      startY: number;
      didDrag: boolean;
      color: string;
    }
  | {
      type: "move";
      block: TimeBlockItem;
      startX: number;
      startY: number;
      start: Date;
      end: Date;
      duplicate: boolean;
      didDrag: boolean;
    }
  | {
      type: "resize";
      edge: "top" | "bottom";
      block: TimeBlockItem;
      startY: number;
      start: Date;
      end: Date;
      didDrag: boolean;
    };

type Options = {
  grid: () => HTMLElement | undefined;
  days: () => number;
  rangeStart: () => Date;
  startHour: () => number;
  endHour: () => number;
  snapMinutes: () => number;
  pxPerMinute: () => number;
  pickColor: () => string;
  onCreate: (range: { start: Date; end: Date; color: string }) => void;
  onMove: (
    block: TimeBlockItem,
    start: Date,
    end: Date,
    duplicate: boolean,
  ) => void;
  onResize: (block: TimeBlockItem, start: Date, end: Date) => void;
};

const original = (block: TimeBlockItem) => ({
  start: new Date(block.startTime),
  end: new Date(block.endTime),
});

const sameRange = (
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
) =>
  a.start.getTime() === b.start.getTime() &&
  a.end.getTime() === b.end.getTime();

/** Pointer handling for drawing, moving and resizing blocks on the grid. */
export const useBlockDrag = (options: Options) => {
  const [state, setState] = createSignal<DragState>({ type: "idle" });
  const [hover, setHover] = createSignal<{
    dayIndex: number;
    time: Date;
  } | null>(null);
  let suppressClick = false;
  let touchTap: { x: number; y: number; dayIndex: number; time: Date } | null =
    null;
  let pendingTap: Date | null = null;

  const snapMs = () => options.snapMinutes() * MS_PER_MINUTE;

  /** Day column and snapped slot start under the pointer. */
  const slotAt = (event: PointerEvent, fixedDay?: number) => {
    const grid = options.grid();
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dayWidth = rect.width / options.days();
    const dayIndex =
      fixedDay ??
      Math.max(0, Math.min(options.days() - 1, Math.floor(x / dayWidth)));
    const totalMinutes = (options.endHour() - options.startHour()) * 60;
    const minutes = Math.max(
      0,
      Math.min(totalMinutes - 1, y / options.pxPerMinute()),
    );
    const snapped =
      Math.floor(minutes / options.snapMinutes()) * options.snapMinutes();
    const time = addDays(options.rangeStart(), dayIndex);
    time.setHours(options.startHour(), snapped, 0, 0);
    const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
    return { dayIndex, time, inside };
  };

  const snappedDelta = (pixels: number) =>
    Math.round(pixels / options.pxPerMinute() / options.snapMinutes()) *
    options.snapMinutes();

  const moved = (event: PointerEvent, x: number, y: number) =>
    Math.abs(event.clientX - x) >= DRAG_THRESHOLD_PX ||
    Math.abs(event.clientY - y) >= DRAG_THRESHOLD_PX;

  const onGridPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-time-block='true']"))
      return;
    const slot = slotAt(event);
    if (!slot?.inside) return;
    if (event.pointerType === "touch") {
      // Let touch scroll the grid; a tap without movement creates a block.
      touchTap = { x: event.clientX, y: event.clientY, ...slot };
      return;
    }
    event.preventDefault();
    setHover(null);
    setState({
      type: "create",
      anchor: slot.time,
      current: slot.time,
      dayIndex: slot.dayIndex,
      startX: event.clientX,
      startY: event.clientY,
      didDrag: false,
      color: options.pickColor(),
    });
  };

  const onBlockPointerDown = (
    event: PointerEvent,
    block: TimeBlockItem,
    edge?: "top" | "bottom",
  ) => {
    event.stopPropagation();
    if (event.button !== 0 || event.pointerType === "touch") return;
    event.preventDefault();
    (event.currentTarget as HTMLElement | null)
      ?.closest<HTMLElement>("[role='button']")
      ?.focus({
        preventScroll: true,
      });
    setHover(null);
    const range = original(block);
    if (edge) {
      setState({
        type: "resize",
        edge,
        block,
        startY: event.clientY,
        ...range,
        didDrag: false,
      });
      return;
    }
    setState({
      type: "move",
      block,
      startX: event.clientX,
      startY: event.clientY,
      ...range,
      duplicate: event.altKey || event.metaKey || event.ctrlKey,
      didDrag: false,
    });
  };

  /** Range a create drag currently covers, slot-inclusive at both ends. */
  const createRange = (s: Extract<DragState, { type: "create" }>) => {
    if (!s.didDrag) {
      const end = new Date(
        s.anchor.getTime() + CLICK_CREATE_MINUTES * MS_PER_MINUTE,
      );
      return { start: s.anchor, end };
    }
    const [lo, hi] =
      s.current.getTime() < s.anchor.getTime()
        ? [s.current, s.anchor]
        : [s.anchor, s.current];
    return { start: lo, end: new Date(hi.getTime() + snapMs()) };
  };

  const handleMove = (event: PointerEvent) => {
    const s = state();
    if (s.type === "idle") {
      if (event.pointerType === "touch") return;
      const target = event.target as HTMLElement | null;
      const slot = slotAt(event);
      const overBlock = Boolean(target?.closest?.("[data-time-block='true']"));
      setHover(
        slot?.inside && !overBlock && options.grid()?.contains(target)
          ? slot
          : null,
      );
      return;
    }
    if (s.type === "create") {
      const slot = slotAt(event, s.dayIndex);
      if (!slot) return;
      setState({
        ...s,
        current: slot.time,
        didDrag: s.didDrag || moved(event, s.startX, s.startY),
      });
      return;
    }
    if (s.type === "move") {
      const grid = options.grid();
      if (!grid) return;
      const dayWidth = grid.getBoundingClientRect().width / options.days();
      const minutes = snappedDelta(event.clientY - s.startY);
      const days = Math.round((event.clientX - s.startX) / dayWidth);
      const base = original(s.block);
      const shift = (date: Date) => {
        const next = addDays(date, days);
        next.setMinutes(next.getMinutes() + minutes);
        return next;
      };
      setState({
        ...s,
        start: shift(base.start),
        end: shift(base.end),
        didDrag: s.didDrag || moved(event, s.startX, s.startY),
      });
      return;
    }
    const base = original(s.block);
    const minutes = snappedDelta(event.clientY - s.startY);
    const minLength = snapMs();
    let { start, end } = base;
    if (s.edge === "top") {
      start = new Date(
        Math.min(
          base.start.getTime() + minutes * MS_PER_MINUTE,
          end.getTime() - minLength,
        ),
      );
    } else {
      end = new Date(
        Math.max(
          base.end.getTime() + minutes * MS_PER_MINUTE,
          start.getTime() + minLength,
        ),
      );
    }
    setState({
      ...s,
      start,
      end,
      didDrag:
        s.didDrag || Math.abs(event.clientY - s.startY) >= DRAG_THRESHOLD_PX,
    });
  };

  const handleUp = (event: PointerEvent) => {
    if (touchTap) {
      const tap = touchTap;
      touchTap = null;
      // Create on the click that follows, after the browser's compatibility
      // mousedown has moved focus; otherwise it would blur the new draft.
      pendingTap = moved(event, tap.x, tap.y) ? null : tap.time;
      return;
    }
    const s = state();
    setState({ type: "idle" });
    if (s.type === "create") {
      options.onCreate({ ...createRange(s), color: s.color });
      return;
    }
    if (s.type === "idle") return;
    if (s.didDrag) suppressClick = true;
    const next = { start: s.start, end: s.end };
    if (s.type === "move") {
      if (!sameRange(next, original(s.block)) || (s.duplicate && s.didDrag)) {
        options.onMove(s.block, next.start, next.end, s.duplicate);
      }
      return;
    }
    if (s.didDrag && !sameRange(next, original(s.block))) {
      options.onResize(s.block, next.start, next.end);
    }
  };

  const onGridClick = () => {
    const time = pendingTap;
    pendingTap = null;
    if (!time) return;
    options.onCreate({
      start: time,
      end: new Date(time.getTime() + CLICK_CREATE_MINUTES * MS_PER_MINUTE),
      color: options.pickColor(),
    });
  };

  const cancel = () => {
    touchTap = null;
    pendingTap = null;
    if (state().type === "idle") return false;
    setState({ type: "idle" });
    suppressClick = false;
    return true;
  };

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && cancel()) event.preventDefault();
    };
    const onLeave = () => setHover(null);
    const onCancel = () => cancel();
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKeyDown);
    document.documentElement.addEventListener("pointerleave", onLeave);
    onCleanup(() => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    });
  });

  return {
    state,
    hover,
    createRange,
    onGridPointerDown,
    onGridClick,
    onBlockPointerDown,
    /** True once if the click that follows a drag should be ignored. */
    consumeClickSuppression: () => {
      const value = suppressClick;
      suppressClick = false;
      return value;
    },
  };
};
