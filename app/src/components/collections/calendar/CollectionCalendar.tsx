import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-solid";
import { For, Index, Show, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import {
  layoutWeek,
  monthGrid,
  moveDate,
  shiftMonth,
} from "~/lib/collections/group";
import { applyView } from "~/lib/collections/query";
import type {
  CollectionProperty,
  CollectionRow,
  CollectionView,
  DateValue,
} from "~/lib/collections/types";
import {
  isComputedKind,
  isDateValue,
  readValue,
} from "~/lib/collections/values";
import { optionColorVars } from "~/lib/collections/colors";
import { useCollection } from "../CollectionContext";
import { startPointerDrag } from "../drag/startPointerDrag";

const LANE_HEIGHT = 24;
const DAY_HEADER = 26;
const MIN_LANES = 3;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const shell = css({ display: "flex", flexDirection: "column", gap: "2" });
const nav = css({ display: "flex", alignItems: "center", gap: "1" });
const monthLabel = css({
  fontSize: "lg",
  fontWeight: "semibold",
  mr: "2",
  minW: "11rem",
});
const navBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  h: "7",
  minW: "7",
  px: "1.5",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const grid = css({
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  overflow: "hidden",
});
const weekdayRow = css({
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  bg: "bg.subtle",
  borderBottomWidth: "1px",
  borderColor: "border",
  "& > span": { px: "2", py: "1", fontSize: "xs", color: "fg.muted" },
});
const week = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  "&:not(:last-child)": { borderBottomWidth: "1px", borderColor: "border" },
});
const day = css({
  position: "relative",
  borderRightWidth: "1px",
  borderColor: "border",
  "&:last-child": { borderRightWidth: "0" },
  "&[data-out]": { bg: "bg.subtle" },
  "&[data-over]": { bg: "blue.a3" },
  "& [data-add]": { opacity: "0" },
  "&:hover [data-add]": { opacity: "1" },
});
const dayNum = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  h: `${DAY_HEADER}px`,
  px: "1.5",
  fontSize: "xs",
  color: "fg.muted",
  "&[data-today] span:first-child": {
    bg: "red.9",
    color: "white",
    borderRadius: "full",
    minW: "5",
    h: "5",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "semibold",
  },
});
const addBtn = css({
  display: "inline-flex",
  p: "0.5",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const bar = css({
  position: "absolute",
  h: `${LANE_HEIGHT - 4}px`,
  display: "flex",
  alignItems: "center",
  gap: "1",
  px: "1.5",
  borderRadius: "l1",
  fontSize: "xs",
  fontWeight: "medium",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  cursor: "pointer",
  touchAction: "none",
  bg: "var(--chip-bg)",
  color: "var(--chip-fg)",
  _dark: { bg: "var(--chip-bg-dark)", color: "var(--chip-fg-dark)" },
  _hover: { filter: "brightness(0.96)" },
  "&[data-clip-start]": { borderLeftRadius: "0" },
  "&[data-clip-end]": { borderRightRadius: "0" },
});
const tray = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  p: "2",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.subtle",
});
const trayItem = css({
  display: "flex",
  alignItems: "center",
  h: "7",
  px: "2",
  borderRadius: "l1",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  fontSize: "sm",
  cursor: "grab",
  touchAction: "none",
});
const hint = css({ fontSize: "xs", color: "fg.subtle" });

const dateProperties = (properties: CollectionProperty[]) =>
  properties.filter(
    (p) =>
      p.kind === "date" ||
      p.kind === "created_time" ||
      p.kind === "updated_time",
  );

/** Month grid placing rows by a date property; ranges span days, drag to reschedule. */
export const CollectionCalendar = (props: { view: CollectionView }) => {
  const { store, openRow } = useCollection();
  const [month, setMonth] = createSignal(
    (store.state.today || new Date().toISOString()).slice(0, 7),
  );
  const [overDay, setOverDay] = createSignal<string | null>(null);
  const [trayOpen, setTrayOpen] = createSignal(false);

  const property = createMemo(() => {
    const all = dateProperties(store.state.properties);
    return (
      all.find((p) => p.id === props.view.config.dateProperty) ??
      all.find((p) => p.kind === "date") ??
      all[0]
    );
  });
  const editable = () =>
    Boolean(property() && !isComputedKind(property()!.kind));
  const rows = createMemo(() =>
    applyView(
      store.state.rows,
      store.state.properties,
      store.effectiveConfig(props.view),
      store.state.today,
    ),
  );
  const undated = createMemo(() => {
    const p = property();
    return p ? rows().filter((r) => !isDateValue(readValue(r, p))) : [];
  });
  const weeks = createMemo(() => monthGrid(month(), store.state.today));
  const label = () => {
    const [y, m] = month().split("-").map(Number);
    return `${MONTHS[(m ?? 1) - 1]} ${y}`;
  };

  const colorFor = (row: CollectionRow) => {
    // Tint bars by the first status/select value so boards and calendars agree.
    const tint = store.state.properties.find(
      (p) => p.kind === "status" || p.kind === "select",
    );
    const option = tint?.config.options?.find(
      (o) => o.id === row.properties[tint.id],
    );
    return optionColorVars(option?.color ?? "blue");
  };

  const dayAt = (x: number, y: number) =>
    document
      .elementsFromPoint(x, y)
      .map((el) =>
        (el as HTMLElement).closest<HTMLElement>(
          `[data-calendar="${props.view.id}"] [data-cal-day]`,
        ),
      )
      .find(Boolean)?.dataset.calDay ?? null;

  const reschedule = (row: CollectionRow, target: string | null) => {
    setOverDay(null);
    const p = property();
    if (!target || !p) return;
    const current = readValue(row, p);
    const next: DateValue = isDateValue(current)
      ? moveDate(current, target)
      : { start: target };
    if (isDateValue(current) && current.start === next.start) return;
    void store.setValues([row.id], { [p.id]: next });
  };

  const drag = (row: CollectionRow) => (e: PointerEvent) => {
    if (!editable()) return;
    startPointerDrag(e, e.currentTarget as HTMLElement, {
      onMove: (x, y) => setOverDay(dayAt(x, y)),
      onDrop: (x, y) => reschedule(row, dayAt(x, y)),
      onCancel: () => setOverDay(null),
    });
  };

  const createOn = async (date: string) => {
    const p = property();
    const row = await store.addRow({
      properties: p && editable() ? { [p.id]: { start: date } } : {},
    });
    if (row) openRow(row.id);
  };

  return (
    <Show
      when={property()}
      fallback={
        <div class={tray}>
          <span class={hint}>
            A calendar places rows by a Date property. This collection has none
            yet.
          </span>
          <button
            type="button"
            class={navBtn}
            style={{ "align-self": "flex-start" }}
            onClick={async () => {
              const created = await store.addProperty("date", "Date");
              if (created)
                store.patchViewConfig(props.view.id, {
                  dateProperty: created.id,
                });
            }}
          >
            <CalendarDaysIcon size={14} /> Add a Date property
          </button>
        </div>
      }
    >
      {(p) => (
        <div class={shell}>
          <div class={nav}>
            <span class={monthLabel}>{label()}</span>
            <button
              type="button"
              class={navBtn}
              aria-label="Previous month"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              type="button"
              class={navBtn}
              onClick={() => setMonth(store.state.today.slice(0, 7))}
            >
              Today
            </button>
            <button
              type="button"
              class={navBtn}
              aria-label="Next month"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
            >
              <ChevronRightIcon size={16} />
            </button>
            <span style={{ flex: "1" }} />
            <button
              type="button"
              class={navBtn}
              aria-expanded={trayOpen()}
              onClick={() => setTrayOpen((v) => !v)}
            >
              No {p().name.toLowerCase()} · {undated().length}
            </button>
          </div>

          <Show when={trayOpen()}>
            <div class={tray}>
              <span class={hint}>
                {editable()
                  ? "Drag a row onto a day to schedule it."
                  : `${p().name} is set automatically.`}
              </span>
              <For
                each={undated().slice(0, 100)}
                fallback={<span class={hint}>Every row has a date.</span>}
              >
                {(row) => (
                  <div
                    class={trayItem}
                    onPointerDown={drag(row)}
                    onClick={() => openRow(row.id)}
                  >
                    {row.title || "Untitled"}
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class={grid} data-calendar={props.view.id}>
            <div class={weekdayRow}>
              <For each={WEEKDAYS}>{(d) => <span>{d}</span>}</For>
            </div>
            <Index each={weeks()}>
              {(w) => {
                const spans = createMemo(() =>
                  layoutWeek(rows(), p(), w()[0]!.date),
                );
                const lanes = () =>
                  Math.max(MIN_LANES, ...spans().map((s) => s.lane + 1));
                return (
                  <div
                    class={week}
                    style={{
                      height: `${DAY_HEADER + lanes() * LANE_HEIGHT + 6}px`,
                    }}
                  >
                    <Index each={w()}>
                      {(d) => (
                        <div
                          class={day}
                          data-cal-day={d().date}
                          data-out={d().inMonth ? undefined : ""}
                          data-over={overDay() === d().date ? "" : undefined}
                        >
                          <div
                            class={dayNum}
                            data-today={d().isToday ? "" : undefined}
                          >
                            <span>{Number(d().date.slice(8, 10))}</span>
                            <button
                              type="button"
                              class={addBtn}
                              data-add
                              aria-label={`New row on ${d().date}`}
                              onClick={() => void createOn(d().date)}
                            >
                              <PlusIcon size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </Index>
                    <For each={spans()}>
                      {(s) => (
                        <div
                          class={bar}
                          role="button"
                          tabIndex={0}
                          title={s.row.title}
                          data-clip-start={s.clippedStart ? "" : undefined}
                          data-clip-end={s.clippedEnd ? "" : undefined}
                          style={{
                            ...colorFor(s.row),
                            left: `calc(${(s.startCol / 7) * 100}% + 3px)`,
                            width: `calc(${(s.span / 7) * 100}% - 6px)`,
                            top: `${DAY_HEADER + s.lane * LANE_HEIGHT}px`,
                          }}
                          onPointerDown={drag(s.row)}
                          onClick={() => openRow(s.row.id)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && openRow(s.row.id)
                          }
                        >
                          {s.row.title || "Untitled"}
                        </div>
                      )}
                    </For>
                  </div>
                );
              }}
            </Index>
          </div>
        </div>
      )}
    </Show>
  );
};

export { dateProperties };
