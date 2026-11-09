import { A, useNavigate } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import type { PathwaySummary } from "~/server/pathways/pathway-store";
import { createPathwayFn } from "~/services/pathways/pathways.actions";
import { AutoText } from "./AutoText";
import { cardLink, help, label, smallButton } from "./styles";

const col = css({
  maxW: "760px",
  mx: "auto",
  px: "4",
  py: { base: "4", md: "8" },
  display: "flex",
  flexDirection: "column",
  gap: "5",
});
const form = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  p: "4",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "lg",
});
const list = css({
  listStyle: "none",
  m: "0",
  p: "0",
  borderTopWidth: "1px",
  borderColor: "border",
});
const item = css({
  display: "flex",
  alignItems: "baseline",
  gap: "3",
  py: "2.5",
  borderBottomWidth: "1px",
  borderColor: "border",
});

/** Every decision map, newest first, with a form to start a new one. */
export function PathwaysIndex(props: { pathways: PathwaySummary[] }) {
  const navigate = useNavigate();
  const [question, setQuestion] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  const create = async () => {
    if (!question().trim() || busy()) return;
    setBusy(true);
    setError("");
    try {
      const p = await createPathwayFn({
        title: question().trim(),
        notes: notes().trim() || undefined,
      });
      navigate(`/pathways/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div class={col}>
      <div>
        <h1 class={css({ m: "0", fontSize: "2xl", fontWeight: "bold" })}>
          Pathways
        </h1>
        <p class={css({ m: "0", mt: "1", color: "fg.muted" })}>
          Map a decision: the options, where each one leads, and where different
          choices end up in the same place.
        </p>
      </div>

      <div class={form}>
        <span class={label}>New decision</span>
        <AutoText
          class={css({ fontSize: "md", fontWeight: "semibold" })}
          singleLine
          delay={0}
          value={question()}
          placeholder="What are you deciding?"
          onSave={setQuestion}
          onSubmit={(v) => {
            setQuestion(v);
            void create();
          }}
        />
        <AutoText
          minRows={2}
          maxHeight={320}
          delay={0}
          value={notes()}
          placeholder="Context (optional): what matters to you, what you have tried, what feels stuck. Goes into Goals & vibes."
          onSave={setNotes}
          onSubmit={(v) => {
            setNotes(v);
            void create();
          }}
        />
        <div class={css({ display: "flex", alignItems: "center", gap: "2" })}>
          <span class={help}>⌘↵ to create</span>
          <Show when={error()}>
            <span class={css({ fontSize: "xs", color: "red.11" })}>
              {error()}
            </span>
          </Show>
          <span style={{ flex: "1" }} />
          <button
            class={smallButton}
            data-on="true"
            disabled={!question().trim() || busy()}
            onClick={create}
          >
            {busy() ? "Creating…" : "Create map"}
          </button>
        </div>
      </div>

      <Show
        when={props.pathways.length}
        fallback={<p class={help}>No maps yet.</p>}
      >
        <ul class={list}>
          <For each={props.pathways}>
            {(p) => (
              <li class={item}>
                <A
                  class={cardLink}
                  style={{ flex: "1", "font-size": "15px" }}
                  href={`/pathways/${p.id}`}
                >
                  {p.title}
                </A>
                <span class={help}>
                  {p.cards} cards
                  {p.openTasks ? ` · ${p.openTasks} next steps` : ""} ·{" "}
                  {p.updatedAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
