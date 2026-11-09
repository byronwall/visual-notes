import { createSignal, Index, Show } from "solid-js";
import { css } from "styled-system/css";
import { ActionButton } from "./ActionButton";
import { AutoText } from "./AutoText";
import { Markdown } from "./Markdown";
import { usePathway } from "./pathway-state";
import { iconX, label, row, section, textButton } from "./styles";

const reading = css({
  position: "relative",
  cursor: "text",
  "&[data-clamped=true]": {
    maxH: "44",
    overflow: "hidden",
    // Fade the last lines so the cut reads as "more below".
    maskImage: "linear-gradient(to bottom, black 70%, transparent)",
  },
});
const question = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "1.5",
  fontSize: "xs",
  fontWeight: "semibold",
  color: "fg.default",
  "&[data-open=true]": { color: "blue.11" },
});

/** Long text gets a "Show all" toggle. Decided from the text, so SSR and client agree. */
const isLong = (t: string) => t.length > 420 || t.split("\n").length > 9;

/**
 * Goals & vibes: reads as formatted text, and turns into a text field on
 * click or Edit. Answers to the agent's questions stay editable in place.
 */
export function GoalsSection() {
  const s = usePathway();
  const ctx = () => s.record().context ?? { notes: "", qa: [] };
  const id = () => s.record().id;
  const [editing, setEditing] = createSignal(false);
  const [all, setAll] = createSignal(false);
  const run = () => s.runAgent("questions", "root");

  return (
    <div class={section}>
      <div class={row}>
        <span class={label} style={{ flex: "1" }}>
          Goals &amp; vibes
        </span>
        <Show when={ctx().notes.trim() && !editing()}>
          <Show when={isLong(ctx().notes)}>
            <button class={textButton} onClick={() => setAll((v) => !v)}>
              {all() ? "Show less" : "Show all"}
            </button>
          </Show>
          <button class={textButton} onClick={() => setEditing(true)}>
            Edit
          </button>
        </Show>
      </div>
      <Show
        when={ctx().notes.trim() && !editing()}
        fallback={
          <AutoText
            key={`${id()}:notes`}
            minRows={3}
            maxHeight={420}
            autofocus={editing()}
            placeholder="What matters to you here? What would a good month look like? What feels heavy?"
            value={ctx().notes}
            onBlur={() => setEditing(false)}
            onSave={(v, k) =>
              k === `${id()}:notes` &&
              s.setContext((c) => (c.notes = v), "notes")
            }
          />
        }
      >
        <div
          class={reading}
          data-clamped={String(isLong(ctx().notes) && !all())}
          title="Click to edit"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("a")) setEditing(true);
          }}
        >
          <Markdown text={ctx().notes} />
        </div>
      </Show>
      <Index each={ctx().qa}>
        {(qa, i) => (
          <div
            class={css({ display: "flex", flexDirection: "column", gap: "1" })}
          >
            <div class={question} data-open={String(!qa().a.trim())}>
              <span style={{ flex: "1" }}>{qa().q}</span>
              <button
                class={iconX}
                title="Remove this question"
                onClick={() => s.setContext((c) => c.qa.splice(i, 1))}
              >
                ×
              </button>
            </div>
            <AutoText
              key={`${id()}:qa:${qa().q}`}
              maxHeight={240}
              placeholder="Your answer"
              value={qa().a}
              onSave={(v, k) =>
                s.setContext((c) => {
                  const hit = c.qa.find((x) => `${id()}:qa:${x.q}` === k);
                  if (hit) hit.a = v;
                }, `qa:${i}`)
              }
            />
          </div>
        )}
      </Index>
      <ActionButton
        label={ctx().qa.length ? "Ask me more" : "Ask me about my goals"}
        what="Adds 3–4 questions about what you want. Every agent action reads your answers."
        disabled={!!s.busy()}
        onClick={run}
      />
    </div>
  );
}
