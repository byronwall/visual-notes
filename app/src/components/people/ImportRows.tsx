import { A } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { SimpleSelect } from "~/components/ui/simple-select";
import type { RowOutcome, RowPlan } from "~/server/people/import-store";

export const OUTCOME_LABELS: Record<RowOutcome, string> = {
  create: "New person",
  update: "Adds details",
  unchanged: "Unchanged",
  conflict: "Differs",
  candidates: "Needs a choice",
  invalid: "Not imported",
};

const FILTERS: { label: string; outcomes: RowOutcome[] | null }[] = [
  { label: "All", outcomes: null },
  { label: "New", outcomes: ["create"] },
  { label: "Updates", outcomes: ["update", "conflict"] },
  { label: "Needs a choice", outcomes: ["candidates"] },
  { label: "Unchanged", outcomes: ["unchanged"] },
  { label: "Not imported", outcomes: ["invalid"] },
];

const tabs = css({ display: "flex", gap: "1", flexWrap: "wrap", mb: "2" });
const tab = css({
  px: "2.5",
  py: "1",
  fontSize: "sm",
  borderRadius: "l2",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { bg: "bg.subtle", color: "fg.default" },
  "&[aria-pressed=true]": {
    bg: "bg.muted",
    color: "fg.default",
    fontWeight: "medium",
  },
});
const grid = css({
  display: "grid",
  gridTemplateColumns: {
    base: "3rem minmax(0, 1fr)",
    md: "3rem minmax(10rem, 1fr) 8rem minmax(0, 2fr)",
  },
  columnGap: "3",
  rowGap: "1",
  alignItems: "start",
  px: "2",
  py: "2",
  borderBottomWidth: "1px",
  borderColor: "border",
  fontSize: "sm",
});
const muted = css({ color: "fg.muted", fontSize: "xs" });
const outcome = css({
  fontSize: "xs",
  fontWeight: "medium",
  "&[data-outcome=create]": { color: "green.11" },
  "&[data-outcome=update]": { color: "blue.11" },
  "&[data-outcome=conflict]": { color: "amber.11" },
  "&[data-outcome=candidates]": { color: "amber.11" },
  "&[data-outcome=invalid]": { color: "red.11" },
  "&[data-outcome=unchanged]": { color: "fg.subtle" },
});
const detail = css({
  gridColumn: { base: "2", md: "auto" },
  display: "flex",
  flexDirection: "column",
  gap: "1",
});

/** Every planned row with what apply would do, filterable by outcome. */
export function ImportRows(props: {
  rows: RowPlan[];
  choices: Record<number, string>;
  onChoose: (rowIndex: number, value: string) => void;
}) {
  const [filter, setFilter] = createSignal(0);
  const shown = () => {
    const outcomes = FILTERS[filter()].outcomes;
    return outcomes
      ? props.rows.filter((r) => outcomes.includes(r.outcome))
      : props.rows;
  };
  const count = (outcomes: RowOutcome[] | null) =>
    outcomes
      ? props.rows.filter((r) => outcomes.includes(r.outcome)).length
      : props.rows.length;

  return (
    <div>
      <div class={tabs} role="group" aria-label="Filter rows">
        <For each={FILTERS}>
          {(f, i) => (
            <button
              type="button"
              class={tab}
              aria-pressed={filter() === i()}
              onClick={() => setFilter(i())}
            >
              {f.label} ({count(f.outcomes)})
            </button>
          )}
        </For>
      </div>
      <For each={shown().slice(0, 500)}>
        {(r) => (
          <div class={grid} data-import-row={r.rowIndex}>
            <span class={muted}>#{r.rowIndex}</span>
            <div>
              <div>
                {r.record.displayName || <span class={muted}>No name</span>}
              </div>
              <div class={muted}>
                {[r.record.email, r.record.organization]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <span class={outcome} data-outcome={r.outcome}>
              {r.status === "applied"
                ? "Applied"
                : r.status === "failed"
                  ? "Failed"
                  : OUTCOME_LABELS[r.outcome]}
            </span>
            <div class={detail}>
              <Show when={r.person}>
                {(p) => (
                  <span>
                    Matches <A href={`/people/${p().id}`}>{p().displayName}</A>
                  </span>
                )}
              </Show>
              <Show when={r.additions.length}>
                <span class={muted}>Adds {r.additions.join(", ")}</span>
              </Show>
              <For each={r.conflicts}>
                {(c) => (
                  <span class={muted}>
                    Keeps {c.field} “{c.current}”; file says “{c.incoming}”
                  </span>
                )}
              </For>
              <Show when={r.message}>
                <span class={muted}>{r.message}</span>
              </Show>
              <Show
                when={r.outcome === "candidates" || props.choices[r.rowIndex]}
              >
                <SimpleSelect
                  size="xs"
                  skipPortal={false}
                  sameWidth={false}
                  placeholder="Choose…"
                  value={props.choices[r.rowIndex] ?? ""}
                  items={[
                    { label: "Choose…", value: "" },
                    { label: "Create a new person", value: "new" },
                    ...r.candidates.map((c) => ({
                      label: `Same as ${c.displayName} (${c.evidence})`,
                      value: c.id,
                    })),
                    { label: "Skip this row", value: "skip" },
                  ]}
                  onChange={(v) => props.onChoose(r.rowIndex, v)}
                />
              </Show>
            </div>
          </div>
        )}
      </For>
      <Show when={shown().length > 500}>
        <p class={muted}>Showing the first 500 rows of {shown().length}.</p>
      </Show>
    </div>
  );
}
