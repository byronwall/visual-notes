import { A, useAction } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { formatDay, todayLocal } from "~/lib/people/dates";
import {
  INTERACTION_KIND_LABELS,
  type Fact,
  type InteractionView,
} from "~/lib/people/types";
import {
  updateFactAction,
  updateInteractionAction,
} from "~/services/people/people.actions";
import { InteractionDialog } from "./InteractionDialog";

type Entry =
  | { type: "interaction"; day: string; item: InteractionView }
  | { type: "fact"; day: string; item: Fact };

const list = css({ display: "flex", flexDirection: "column" });
const entry = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", sm: "7.5rem minmax(0, 1fr) auto" },
  columnGap: "3",
  rowGap: "0.5",
  px: "2",
  py: "2",
  borderRadius: "l2",
  _hover: { bg: "bg.subtle" },
  "&:hover [data-entry-actions]": { opacity: 1 },
  "&:focus-within [data-entry-actions]": { opacity: 1 },
});
const when = css({ fontSize: "xs", color: "fg.muted", pt: "0.5" });
const kindLabel = css({ fontSize: "xs", color: "fg.subtle", display: "block" });
const text = css({
  fontSize: "sm",
  lineHeight: "relaxed",
  whiteSpace: "pre-wrap",
});
const retired = css({ color: "fg.muted", textDecoration: "line-through" });
const meta = css({ fontSize: "xs", color: "fg.subtle", mt: "0.5" });
const personLink = css({
  color: "fg.muted",
  textDecoration: "none",
  _hover: { color: "fg.default", textDecoration: "underline" },
});
const actions = css({
  display: "flex",
  gap: "1",
  alignItems: "flex-start",
  opacity: { base: 1, md: 0 },
});
const empty = css({ fontSize: "sm", color: "fg.muted", px: "2", py: "2" });

const factDay = (f: Fact) => f.learnedOn ?? todayLocal(new Date(f.createdAt));

/** Encounters by their real day and retired facts, newest first. */
export function ProfileHistory(props: {
  personId: string;
  interactions: InteractionView[];
  retiredFacts: Fact[];
}) {
  const [editing, setEditing] = createSignal<InteractionView | null>(null);
  const saveInteraction = useAction(updateInteractionAction);
  const saveFact = useAction(updateFactAction);

  const entries = (): Entry[] =>
    [
      ...props.interactions.map(
        (item): Entry => ({ type: "interaction", day: item.occurredOn, item }),
      ),
      ...props.retiredFacts.map(
        (item): Entry => ({ type: "fact", day: factDay(item), item }),
      ),
    ].sort((a, b) => b.day.localeCompare(a.day));

  const others = (i: InteractionView) =>
    i.participants.filter((p) => p.id !== props.personId);

  return (
    <>
      <Show
        when={entries().length}
        fallback={
          <div class={empty}>
            No recorded contact. Log an interaction to start this history.
          </div>
        }
      >
        <div class={list}>
          <For each={entries()}>
            {(e) =>
              e.type === "interaction" ? (
                <div class={entry} data-interaction={e.item.summary}>
                  <div class={when}>
                    {formatDay(e.day)}
                    <span class={kindLabel}>
                      {INTERACTION_KIND_LABELS[e.item.kind]}
                    </span>
                  </div>
                  <div>
                    <div class={text}>{e.item.summary}</div>
                    <Show when={others(e.item).length}>
                      <div class={meta}>
                        With{" "}
                        <For each={others(e.item)}>
                          {(p, i) => (
                            <>
                              {i() > 0 && ", "}
                              <A href={`/people/${p.id}`} class={personLink}>
                                {p.displayName}
                              </A>
                              {!p.countsAsContact && " (discussed)"}
                            </>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                  <div class={actions} data-entry-actions>
                    <Button
                      size="xs"
                      variant="plain"
                      onClick={() => setEditing(e.item)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="plain"
                      title="Hide from history; contact recency is recomputed"
                      onClick={() =>
                        void saveInteraction({
                          id: e.item.id,
                          patch: { archived: true },
                        })
                      }
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              ) : (
                <div class={entry} data-retired-fact={e.item.text}>
                  <div class={when}>
                    {formatDay(e.day)}
                    <span class={kindLabel}>
                      {e.item.learnedOn ? "Learned" : "Recorded"} · retired
                    </span>
                  </div>
                  <div class={`${text} ${retired}`}>{e.item.text}</div>
                  <div class={actions} data-entry-actions>
                    <Button
                      size="xs"
                      variant="plain"
                      onClick={() =>
                        void saveFact({
                          id: e.item.id,
                          patch: { retired: false },
                        })
                      }
                    >
                      Restore
                    </Button>
                  </div>
                </div>
              )
            }
          </For>
        </div>
      </Show>
      <Show when={editing()} keyed>
        {(i) => (
          <InteractionDialog interaction={i} onClose={() => setEditing(null)} />
        )}
      </Show>
    </>
  );
}
