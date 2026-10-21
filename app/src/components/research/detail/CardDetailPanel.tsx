import { useAction } from "@solidjs/router";
import { XIcon } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { css } from "styled-system/css";
import {
  removeResearchCards,
  setResearchCardNudge,
  setResearchCardState,
} from "~/services/research/research.actions";
import { RESEARCH_CARD_STATES, type ResearchCard } from "~/services/research/research.types";
import { CardBody } from "../CardBody";
import { CARD_STATE_META, CARD_TYPE_META, CardTypeIcon } from "../cardTypeMeta";
import type { TopicData } from "../createTopicData";
import { CardEditForm } from "./CardEditForm";
import { CardLinkList } from "./CardLinkList";
import { sectionLabelClass, textButtonClass } from "./detailStyles";
import { SummaryReview } from "./SummaryReview";

const stateButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  px: "2",
  h: "7",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  _hover: { bg: "gray.a3", color: "fg.default" },
  "&[data-active=true]": { bg: "gray.a4", color: "fg.default", fontWeight: "medium" },
  "@media (pointer: coarse)": { h: "9" },
});

/** Everything about one card: content, state, pedigree, links, and summary review. */
export const CardDetailPanel = (props: { data: TopicData; card: ResearchCard; onSelect: (id: string | null) => void }) => {
  const runState = useAction(setResearchCardState);
  const runNudge = useAction(setResearchCardNudge);
  const runRemove = useAction(removeResearchCards);
  const [editing, setEditing] = createSignal(false);
  const [confirmRemove, setConfirmRemove] = createSignal(false);
  // Selecting another card closes the editor and any pending remove.
  createEffect(
    on(
      () => props.card.id,
      () => {
        setEditing(false);
        setConfirmRemove(false);
      },
      { defer: true },
    ),
  );
  const byId = () => props.data.cardsById();
  const topicId = () => props.data.current()?.topic.id ?? "";
  const isSummary = () => props.card.type === "summary";

  /** The card and every visible card that came from it. */
  const subtree = () => {
    const ids: string[] = [];
    const walk = (id: string) => {
      ids.push(id);
      for (const child of props.data.children().get(id) ?? []) walk(child.id);
    };
    walk(props.card.id);
    return ids;
  };
  const remove = async () => {
    await runRemove({ topicId: topicId(), ids: subtree() });
    props.onSelect(null);
    props.data.reload();
  };

  const pedigree = createMemo(() => {
    const chain: ResearchCard[] = [];
    let cursor = props.card.parentId ? byId().get(props.card.parentId) : undefined;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      chain.unshift(cursor);
      cursor = cursor.parentId ? byId().get(cursor.parentId) : undefined;
    }
    return chain;
  });
  const children = () => props.data.children().get(props.card.id) ?? [];
  const related = createMemo(() =>
    (props.data.current()?.links ?? [])
      .filter((link) => link.fromId === props.card.id || link.toId === props.card.id)
      .map((link) => byId().get(link.fromId === props.card.id ? link.toId : link.fromId))
      .filter((card): card is ResearchCard => !!card),
  );
  const ownGroup = () => props.data.current()?.groups.find((group) => group.summaryCardId === props.card.id);
  const covers = () => (ownGroup()?.memberIds ?? []).map((id) => byId().get(id)).filter((c): c is ResearchCard => !!c);
  const inSummaries = () =>
    props.data
      .summaries()
      .filter((entry) => entry.group.memberIds.includes(props.card.id))
      .map((entry) => entry.card);
  const batch = () => props.data.current()?.batches.find((b) => b.id === props.card.batchId);

  return (
    <article aria-label="Card details" data-testid="research-card-detail">
      <div class={css({ display: "flex", alignItems: "center", gap: "1.5", mb: "1" })}>
        <CardTypeIcon type={props.card.type} />
        <span class={css({ fontSize: "xs", color: "fg.muted", flex: 1 })}>{CARD_TYPE_META[props.card.type].label}</span>
        <button
          type="button"
          aria-label="Close details"
          class={css({ display: "inline-flex", p: "1", borderRadius: "l1", color: "fg.muted", cursor: "pointer", _hover: { bg: "gray.a3", color: "fg.default" } })}
          onClick={() => props.onSelect(null)}
        >
          <XIcon size={14} />
        </button>
      </div>
      <Show
        when={editing()}
        fallback={
          <h2 class={css({ fontSize: "md", fontWeight: "semibold", mb: "1.5" })}>{props.card.title}</h2>
        }
      >
        <CardEditForm
          topicId={topicId()}
          card={props.card}
          onDone={(changed) => {
            setEditing(false);
            if (changed) props.data.reload();
          }}
        />
      </Show>

      <Show when={props.card.state}>
        <div class={css({ display: "flex", gap: "0.5", mb: "2" })} role="group" aria-label="State">
          <For each={RESEARCH_CARD_STATES}>
            {(state) => (
              <button
                type="button"
                class={stateButtonClass}
                data-active={props.card.state === state}
                onClick={async () => {
                  await runState({ id: props.card.id, state });
                  props.data.reload();
                }}
              >
                {CARD_STATE_META[state].icon({ size: 13, strokeWidth: 2 })}
                {CARD_STATE_META[state].label}
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={!editing()}>
        <div class={css({ display: "flex", flexDirection: "column", gap: "1.5" })}>
          <CardBody card={props.card} />
        </div>
        <Show when={!isSummary()}>
          <div class={css({ display: "flex", gap: "1", mt: "1.5", flexWrap: "wrap" })}>
            <button type="button" class={textButtonClass} onClick={() => setEditing(true)}>
              Edit
            </button>
            <Show
              when={confirmRemove()}
              fallback={
                <button type="button" class={textButtonClass} data-tone="danger" onClick={() => setConfirmRemove(true)}>
                  Remove
                </button>
              }
            >
              <button type="button" class={textButtonClass} data-tone="danger" onClick={remove}>
                {subtree().length > 1 ? `Remove with ${subtree().length - 1} below` : "Confirm remove"}
              </button>
              <button type="button" class={textButtonClass} onClick={() => setConfirmRemove(false)}>
                Keep
              </button>
            </Show>
          </div>
        </Show>
      </Show>

      <Show when={ownGroup()}>
        {(group) => (
          <SummaryReview
            card={props.card}
            group={group()}
            onChanged={() => props.data.reload()}
            onDiscarded={() => {
              props.onSelect(null);
              props.data.reload();
            }}
          />
        )}
      </Show>

      <Show when={pedigree().length}>
        <h3 class={sectionLabelClass}>Came from</h3>
        <nav aria-label="Pedigree" class={css({ display: "flex", flexWrap: "wrap", columnGap: "1.5", fontSize: "sm" })}>
          <For each={pedigree()}>
            {(card, index) => (
              <span class={css({ display: "inline-flex", gap: "1.5" })}>
                <button type="button" class={css({ color: "blue.11", cursor: "pointer", textAlign: "left", _hover: { color: "blue.12" } })} onClick={() => props.onSelect(card.id)}>
                  {card.title}
                </button>
                <Show when={index() < pedigree().length - 1}>
                  <span class={css({ color: "fg.subtle" })}>›</span>
                </Show>
              </span>
            )}
          </For>
        </nav>
      </Show>
      <CardLinkList label="Covers" cards={covers()} onSelect={props.onSelect} />
      <CardLinkList label="Led to" cards={children()} onSelect={props.onSelect} />
      <CardLinkList label="Related" cards={related()} onSelect={props.onSelect} />
      <CardLinkList label="In summaries" cards={inSummaries()} onSelect={props.onSelect} />

      <div class={css({ mt: "4", fontSize: "xs", color: "fg.muted", display: "flex", alignItems: "center", gap: "2" })}>
        <span class={css({ flex: 1 })}>{batch() ? `Added by ${batch()!.agent} · ${batch()!.summary || batch()!.batchKey}` : "Added in the app"}</span>
        <Show when={props.card.nudgeX !== null || props.card.nudgeY !== null}>
          <button
            type="button"
            class={textButtonClass}
            onClick={async () => {
              await runNudge({ id: props.card.id, x: null, y: null });
              props.data.reload();
            }}
          >
            Reset position
          </button>
        </Show>
      </div>
    </article>
  );
};
