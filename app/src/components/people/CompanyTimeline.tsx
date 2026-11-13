import { A, useSearchParams } from "@solidjs/router";
import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { css } from "styled-system/css";
import { todayLocal } from "~/lib/people/dates";
import type { OrganizationDetail } from "~/lib/people/types";
import {
  across,
  at,
  buildAxis,
  buildRows,
  fraction,
  roleBar,
  yearTicks,
  type TimelineRow,
} from "./company-timeline-model";
import { OVERLAP_LABELS } from "./OverlapRow";
import { TimelineBar } from "./TimelineBar";

const grid = css({
  display: "grid",
  gridTemplateColumns: {
    base: "8.5rem minmax(0, 1fr)",
    md: "13rem minmax(0, 1fr)",
  },
  columnGap: "3",
  alignItems: "center",
});
const axisRow = css({
  position: "relative",
  h: "5",
  fontSize: "xs",
  color: "fg.subtle",
});
const tick = css({ position: "absolute", top: "0", whiteSpace: "nowrap" });
const row = css({
  py: "1.5",
  borderRadius: "l2",
  cursor: "pointer",
  transition: "background-color 140ms, opacity 140ms",
  _hover: { bg: "bg.subtle" },
  "&[data-match=none], &[data-match=unknown]": { opacity: 0.5 },
  "&[data-match=self]": { cursor: "default", _hover: { bg: "transparent" } },
});
const who = css({
  minW: "0",
  pl: "2",
  fontSize: "sm",
  lineHeight: "1.3",
  "& a": { color: "fg.default" },
  "&[data-self] a": { fontWeight: "semibold" },
});
const roleText = css({
  fontSize: "xs",
  color: "fg.muted",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
const track = css({ position: "relative", h: "6" });
const gridline = css({
  position: "absolute",
  top: "-1.5",
  bottom: "-1.5",
  w: "1px",
  bg: "border",
  opacity: 0.6,
});
const band = css({
  position: "absolute",
  top: "-1.5",
  bottom: "-1.5",
  bg: "amber.4",
  opacity: 0.35,
  pointerEvents: "none",
});
const footer = css({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  columnGap: "4",
  rowGap: "1",
  mt: "3",
  fontSize: "xs",
  color: "fg.muted",
  "& i": {
    display: "inline-block",
    w: "3",
    h: "2",
    mr: "1.5",
    borderRadius: "l1",
    verticalAlign: "middle",
  },
});
const focusLine = css({ fontSize: "sm", color: "fg.muted", mb: "2" });

// Swatch classes are static so Panda can extract them.
const LEGEND = [
  { status: "current", label: "Current", swatch: css({ bg: "green.7" }) },
  { status: "ended", label: "Ended", swatch: css({ bg: "gray.8" }) },
  { status: "unknown", label: "Status unknown", swatch: css({ bg: "blue.5" }) },
] as const;

/**
 * Everyone recorded at one organization, one row per person, on a shared
 * year axis. Clicking a row compares everyone with that person: their time
 * here is shaded and rows fade unless the stated dates overlap.
 */
export function CompanyTimeline(props: {
  members: OrganizationDetail["members"];
}) {
  const today = todayLocal();
  const [params, setParams] = useSearchParams();
  const focusId = () =>
    typeof params.focus === "string" ? params.focus : null;
  const rows = createMemo(() => buildRows(props.members, focusId()));
  const axis = createMemo(() => buildAxis(props.members, today));
  const focused = () => rows().find((r) => r.match === "self") ?? null;

  // Label spacing follows the real track width; the server guesses 600px.
  const [trackPx, setTrackPx] = createSignal(600);
  // Observed whenever the axis mounts, including after dates are added.
  const watchAxis = (el: HTMLDivElement) => {
    const ro = new ResizeObserver(([e]) => setTrackPx(e.contentRect.width));
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  };
  const ticks = createMemo(() => {
    const a = axis();
    return a ? yearTicks(a, trackPx()) : [];
  });
  const bands = createMemo(() => {
    const a = axis();
    if (!a) return [];
    return (focused()?.roles ?? []).flatMap((r) => {
      const b = roleBar(r, today);
      if (!b) return [];
      const to = b.tail && b.tail !== "unknown" ? b.tail : b.to;
      return [{ left: at(a, b.from), width: across(a, b.from, to) }];
    });
  });
  const present = () =>
    LEGEND.filter((l) =>
      props.members.some(
        (m) => m.affiliation.status === l.status && m.affiliation.startOn,
      ),
    );
  const select = (r: TimelineRow) => {
    if (r.match !== "self") setParams({ focus: r.id });
  };

  return (
    <div data-company-timeline>
      <Show when={focused()}>
        {(f) => (
          <p class={focusLine} data-focus-line>
            Comparing everyone with <strong>{f().name}</strong>.{" "}
            <a
              href="?"
              onClick={(e) => {
                e.preventDefault();
                setParams({ focus: undefined });
              }}
            >
              Clear
            </a>
          </p>
        )}
      </Show>
      <Show when={axis()}>
        {(a) => (
          <div class={grid}>
            <span />
            <div class={axisRow} ref={watchAxis}>
              <For each={ticks()}>
                {(y) => {
                  // Centered in its year, but never past either end.
                  const mid = fraction(a(), `${y}-07-01`);
                  const shift =
                    mid < 0.04
                      ? "none"
                      : mid > 0.96
                        ? "translateX(-100%)"
                        : "translateX(-50%)";
                  return (
                    <span
                      class={tick}
                      style={{ left: `${mid * 100}%`, transform: shift }}
                    >
                      {y}
                    </span>
                  );
                }}
              </For>
            </div>
          </div>
        )}
      </Show>
      <For each={rows()}>
        {(r) => (
          <div
            class={`${grid} ${row}`}
            data-member={r.name}
            data-match={r.match ?? undefined}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("a")) select(r);
            }}
          >
            <div class={who} data-self={r.match === "self" ? "" : undefined}>
              <A href={`/people/${r.id}`}>{r.name}</A>
              <Show when={r.archived}>
                <span class={roleText}> (archived)</span>
              </Show>
              <div class={roleText}>
                {[
                  r.roles[0].role,
                  r.roles.length > 1 ? `+${r.roles.length - 1} more` : null,
                  r.match && r.match !== "self"
                    ? OVERLAP_LABELS[r.match]
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Role not recorded"}
              </div>
            </div>
            <div class={track}>
              <Show when={axis()}>
                {(a) => (
                  <>
                    <For each={ticks()}>
                      {(y) => (
                        <span
                          class={gridline}
                          style={{ left: at(a(), `${y}-01-01`) }}
                        />
                      )}
                    </For>
                    <For each={bands()}>
                      {(b) => (
                        <span
                          class={band}
                          style={{ left: b.left, width: b.width }}
                        />
                      )}
                    </For>
                  </>
                )}
              </Show>
              <For each={r.roles}>
                {(role) => (
                  <TimelineBar
                    role={role}
                    person={r.name}
                    axis={axis()}
                    today={today}
                  />
                )}
              </For>
            </div>
          </div>
        )}
      </For>
      <Show when={axis()}>
        <div class={footer} aria-hidden="true">
          <For each={present()}>
            {(l) => (
              <span>
                <i class={l.swatch} />
                {l.label}
              </span>
            )}
          </For>
          <span>Dashes: not seen since, or end unknown</span>
          <Show when={!focused()}>
            <span>Click a person to compare</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
