import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-solid";
import { Show, createMemo, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { monthGrid, moveDate, shiftMonth } from "~/lib/collections/group";
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
import { agendaDays } from "./agenda";
import { CalendarAgenda } from "./CalendarAgenda";
import { DateMenu, type DateMenuTarget } from "./DateMenu";
import { MonthGrid } from "./MonthGrid";
import { UndatedTray } from "./UndatedTray";

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
/** Below this container width the month grid becomes an agenda. */
const NARROW = "@container (max-width: 639px)";
const WIDE = "@container (min-width: 640px)";

const shell = css({
  containerType: "inline-size",
  display: "flex",
  flexDirection: "column",
  gap: "2",
});
const nav = css({ display: "flex", alignItems: "center", gap: "1" });
const monthLabel = css({
  fontSize: "lg",
  fontWeight: "semibold",
  mr: "2",
  // Fixed width so the arrows stay put as month names change.
  minW: "11rem",
  whiteSpace: "nowrap",
  [NARROW]: { fontSize: "md", minW: "8.5rem", mr: "0" },
});
const navBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: "0",
  h: "7",
  minW: "7",
  px: "1.5",
  borderRadius: "l2",
  color: "fg.muted",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const undatedPill = css({
  ml: "auto",
  flexShrink: "0",
  h: "7",
  px: "2.5",
  borderRadius: "full",
  bg: "bg.muted",
  color: "fg.muted",
  fontSize: "sm",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transitionProperty: "color, background-color",
  transitionDuration: "140ms",
  _hover: { color: "fg.default", bg: "bg.emphasized" },
  "&[aria-expanded=true]": { bg: "bg.emphasized", color: "fg.default" },
});
// The tray sits beside the grid when there is room, so rows drag onto days.
const body = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "3",
  alignItems: "start",
  [WIDE]: { "&[data-tray]": { gridTemplateColumns: "minmax(0, 1fr) 17rem" } },
});
const trayCell = css({ [WIDE]: { gridColumn: "2", gridRow: "1" } });
const mainCell = css({ minW: "0", [WIDE]: { gridColumn: "1", gridRow: "1" } });
const onlyWide = css({ [NARROW]: { display: "none" } });
const onlyNarrow = css({ [WIDE]: { display: "none" } });
const emptyBox = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  p: "3",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  bg: "bg.subtle",
  fontSize: "xs",
  color: "fg.subtle",
});

const dateProperties = (properties: CollectionProperty[]) =>
  properties.filter(
    (p) =>
      p.kind === "date" ||
      p.kind === "created_time" ||
      p.kind === "updated_time",
  );

/**
 * Rows placed by a date property. Laptop widths show a month grid where
 * ranges span days and rows drag to reschedule; phone widths show an agenda.
 */
export const CollectionCalendar = (props: { view: CollectionView }) => {
  const { store, openRow } = useCollection();
  const [month, setMonth] = createSignal(
    (store.state.today || new Date().toISOString()).slice(0, 7),
  );
  const [overDay, setOverDay] = createSignal<string | null>(null);
  const [trayOpen, setTrayOpen] = createSignal(false);
  const [menu, setMenu] = createSignal<DateMenuTarget | null>(null);

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
  const rows = createMemo(() => store.viewRows(props.view));
  const undated = createMemo(() => {
    const p = property();
    return p ? rows().filter((r) => !isDateValue(readValue(r, p))) : [];
  });
  const weeks = createMemo(() => monthGrid(month(), store.state.today));
  const days = createMemo(() => {
    const p = property();
    return p ? agendaDays(rows(), p, month(), store.state.today) : [];
  });
  const monthName = () => MONTHS[Number(month().slice(5, 7)) - 1] ?? "";
  const label = () => `${monthName()} ${month().slice(0, 4)}`;

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

  const openMenu = (row: CollectionRow, el: HTMLElement) => {
    if (editable()) setMenu({ rowId: row.id, el });
  };

  const drag = (row: CollectionRow, e: PointerEvent) => {
    if (!editable()) return;
    const el = e.currentTarget as HTMLElement;
    startPointerDrag(e, el, {
      onMove: (x, y) => setOverDay(dayAt(x, y)),
      onDrop: (x, y) => reschedule(row, dayAt(x, y)),
      onCancel: () => setOverDay(null),
      onLongPress: () => openMenu(row, el),
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
        <div class={emptyBox}>
          A calendar places rows by a Date property. This collection has none
          yet.
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
            <button
              type="button"
              class={undatedPill}
              aria-expanded={trayOpen()}
              title={`Rows with no ${p().name.toLowerCase()}`}
              onClick={() => setTrayOpen((v) => !v)}
            >
              {undated().length} undated
            </button>
          </div>

          <div class={body} data-tray={trayOpen() ? "" : undefined}>
            <Show when={trayOpen()}>
              <div class={trayCell}>
                <UndatedTray
                  rows={undated()}
                  property={p()}
                  editable={editable()}
                  onPointerDown={drag}
                  onOpen={(row) => openRow(row.id)}
                  onDateMenu={openMenu}
                />
              </div>
            </Show>
            <div class={mainCell}>
              {/* Both render on the server; a container query picks one. */}
              <div class={onlyWide}>
                <MonthGrid
                  viewId={props.view.id}
                  weeks={weeks()}
                  rows={rows()}
                  property={p()}
                  overDay={overDay()}
                  colorFor={colorFor}
                  onEventPointerDown={drag}
                  onEventMenu={openMenu}
                  onOpen={(row) => openRow(row.id)}
                  onCreate={(date) => void createOn(date)}
                />
              </div>
              <div class={onlyNarrow}>
                <CalendarAgenda
                  days={days()}
                  property={p()}
                  monthName={monthName()}
                  today={store.state.today}
                  editable={editable()}
                  colorFor={colorFor}
                  onOpen={(row) => openRow(row.id)}
                  onCreate={(date) => void createOn(date)}
                  onDateMenu={openMenu}
                />
              </div>
            </div>
          </div>
          <DateMenu
            target={menu()}
            property={p()}
            onClose={() => setMenu(null)}
          />
        </div>
      )}
    </Show>
  );
};

export { dateProperties };
