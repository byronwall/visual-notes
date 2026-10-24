import { useAction } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { formatRelativeShort } from "~/components/doc-header/relative-time";
import { redoResearchBatch, undoResearchBatch } from "~/services/research/research.actions";
import { agentLabel } from "~/services/research/research.graph";
import type { ResearchBatch } from "~/services/research/research.types";
import type { TopicData } from "./createTopicData";

const actionClass = css({
  fontSize: "xs",
  color: "fg.link",
  cursor: "pointer",
  px: "1",
  borderRadius: "l1",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.hover" },
  _disabled: { color: "fg.subtle", cursor: "default" },
  "@media (pointer: coarse)": { minH: "8", px: "2" },
});

const batchName = (batch: ResearchBatch) => batch.summary || batch.batchKey;

/** Agent write history with per-batch undo/redo. */
export const TopicBatchList = (props: { data: TopicData; nowMs: number }) => {
  const runUndo = useAction(undoResearchBatch);
  const runRedo = useAction(redoResearchBatch);
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal<string | null>(null);
  const batches = () => props.data.current()?.batches ?? [];

  const toggle = async (batch: ResearchBatch) => {
    setError(null);
    setBusy(batch.id);
    try {
      const result = batch.undoneAt ? await runRedo({ batchId: batch.id }) : await runUndo({ batchId: batch.id });
      if (!result.ok) {
        const names = result.blockingBatchIds
          .map((id) => batches().find((b) => b.id === id))
          .map((b) => (b ? `“${batchName(b)}”` : "another batch"));
        setError(`${result.reason}${names.length ? ` (${names.join(", ")})` : ""}`);
      }
      props.data.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Batch history">
      <p class={css({ fontSize: "xs", color: "red.11", minH: "4", mb: "1" })} role="status">
        {error() ?? ""}
      </p>
      <ul class={css({ display: "flex", flexDirection: "column", gap: "1.5" })}>
        <For each={batches()}>
          {(batch) => (
            <li
              class={css({ fontSize: "sm", opacity: batch.undoneAt ? 0.55 : 1 })}
              data-testid="research-batch-row"
            >
              <div class={css({ display: "flex", gap: "2", alignItems: "baseline" })}>
                <span class={css({ flex: 1, minW: 0, textDecoration: batch.undoneAt ? "line-through" : undefined })}>
                  {batchName(batch)}
                </span>
                <button type="button" class={actionClass} disabled={busy() === batch.id} onClick={() => toggle(batch)}>
                  {batch.undoneAt ? "Redo" : "Undo"}
                </button>
              </div>
              <div class={css({ fontSize: "xs", color: "fg.muted", fontVariantNumeric: "tabular-nums" })}>
                {agentLabel(batch.agent)} · {batch.cardCount} cards · {formatRelativeShort(props.nowMs, batch.createdAt)}
              </div>
            </li>
          )}
        </For>
      </ul>
      <Show when={!batches().length}>
        <p class={css({ fontSize: "sm", color: "fg.subtle" })}>No agent writes yet.</p>
      </Show>
    </section>
  );
};
