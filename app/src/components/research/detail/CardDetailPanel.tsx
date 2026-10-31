import { useAction } from "@solidjs/router";
import { XIcon } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import {
  removeResearchCards,
  setResearchCardState,
} from "~/services/research/research.actions";
import { agentLabel } from "~/services/research/research.graph";
import {
  RESEARCH_CARD_STATES,
  type ResearchCard,
} from "~/services/research/research.types";
import { CardBody } from "../CardBody";
import { CARD_STATE_META, CARD_TYPE_META, CardTypeIcon } from "../cardTypeMeta";
import type { TopicData } from "../createTopicData";
import { CardEditForm } from "./CardEditForm";
import { CardLinkList } from "./CardLinkList";
import { CommentThread } from "./CommentThread";
import { sectionLabelClass, textButtonClass } from "./detailStyles";
import { kindLabel, orderedFields } from "~/services/research/research.kinds";

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
  _hover: { bg: "bg.hover", color: "fg.default" },
  "&[data-active=true]": {
    bg: "bg.selected",
    color: "fg.selected",
    fontWeight: "medium",
  },
  "@media (pointer: coarse)": { h: "9" },
});

/** Everything about one card: content, state, pedigree, links, and summary review. */
export const CardDetailPanel = (props: {
  data: TopicData;
  card: ResearchCard;
  onSelect: (id: string | null) => void;
}) => {
  const runState = useAction(setResearchCardState);
  const runRemove = useAction(removeResearchCards);
  const [editing, setEditing] = createSignal(false);
  const [confirmRemove, setConfirmRemove] = createSignal(false);
  let editButton: HTMLButtonElement | undefined;
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
  const board = () => props.data.board();
  const kinds = () => props.data.current()?.topic.kinds ?? [];
  const fields = () => orderedFields(kinds(), props.card);
  const streamTitle = () => {
    const columnId = board().columnOf.get(props.card.id);
    return (
      board().assignment.columns.find((column) => column.id === columnId)
        ?.title ?? "Unsorted"
    );
  };
  const holdersIn = (map: Map<string, ResearchCard[]>) =>
    [...map.entries()]
      .filter(([, cards]) => cards.some((card) => card.id === props.card.id))
      .map(([id]) => byId().get(id))
      .filter((card): card is ResearchCard => !!card);

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
    let cursor = props.card.parentId
      ? byId().get(props.card.parentId)
      : undefined;
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
      .filter(
        (link) => link.fromId === props.card.id || link.toId === props.card.id,
      )
      .map((link) =>
        byId().get(link.fromId === props.card.id ? link.toId : link.fromId),
      )
      .filter((card): card is ResearchCard => !!card),
  );
  const answers = () => board().relations.answers.get(props.card.id) ?? [];
  const results = () => board().relations.results.get(props.card.id) ?? [];
  const sources = () => board().relations.citations.get(props.card.id) ?? [];
  const blockers = () =>
    (board().relations.blockers.get(props.card.id) ?? []).map(
      (entry) => entry.card,
    );
  const blocks = () =>
    [...board().relations.blockers.entries()]
      .filter(([, entries]) =>
        entries.some((entry) => entry.card.id === props.card.id),
      )
      .map(([id]) => byId().get(id))
      .filter((card): card is ResearchCard => !!card);
  const shown = () =>
    new Set(
      [
        ...answers(),
        ...results(),
        ...sources(),
        ...blockers(),
        ...blocks(),
      ].map((card) => card.id),
    );
  const batch = () =>
    props.data.current()?.batches.find((b) => b.id === props.card.batchId);

  return (
    <article aria-label="Card details" data-testid="research-card-detail">
      <div
        class={css({
          display: "flex",
          alignItems: "center",
          gap: "1.5",
          mb: "1",
        })}
      >
        <CardTypeIcon type={props.card.type} />
        <span class={css({ fontSize: "xs", color: "fg.muted", flex: 1 })}>
          {kindLabel(kinds(), props.card.kind) ??
            CARD_TYPE_META[props.card.type].label}{" "}
          · {streamTitle()}
        </span>
        <button
          type="button"
          aria-label="Close details"
          class={css({
            display: "inline-flex",
            p: "1",
            borderRadius: "l1",
            color: "fg.muted",
            cursor: "pointer",
            _hover: { bg: "bg.hover", color: "fg.default" },
          })}
          onClick={() => props.onSelect(null)}
        >
          <XIcon size={14} />
        </button>
      </div>
      <Show
        when={editing()}
        fallback={
          <h2
            class={css({ fontSize: "md", fontWeight: "semibold", mb: "1.5" })}
          >
            {props.card.title}
          </h2>
        }
      >
        <CardEditForm
          topicId={topicId()}
          kinds={kinds()}
          streams={props.data.current()?.streams ?? []}
          card={props.card}
          onDone={(changed) => {
            setEditing(false);
            editButton?.focus();
            if (changed) props.data.reload();
          }}
        />
      </Show>

      <Show when={props.card.state}>
        <div
          class={css({ display: "flex", gap: "0.5", mb: "2" })}
          role="group"
          aria-label="State"
        >
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
        <Show when={props.card.gist}>
          <p class={css({ fontSize: "sm", color: "fg.default", mb: "1.5" })}>
            {props.card.gist}
          </p>
        </Show>
        <Show when={fields().length}>
          <dl
            class={css({
              display: "grid",
              gridTemplateColumns: "max-content minmax(0, 1fr)",
              columnGap: "3",
              rowGap: "0.5",
              fontSize: "sm",
              mb: "2",
              "& dt": { color: "fg.muted" },
              "& dd": { fontVariantNumeric: "tabular-nums" },
            })}
          >
            <For each={fields()}>
              {(field) => (
                <>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </>
              )}
            </For>
          </dl>
        </Show>
        <div
          class={css({ display: "flex", flexDirection: "column", gap: "1.5" })}
        >
          <CardBody card={props.card} />
        </div>
        <div
          class={css({
            display: "flex",
            gap: "1",
            mt: "1.5",
            flexWrap: "wrap",
          })}
        >
          <button
            ref={editButton}
            type="button"
            class={textButtonClass}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <Show
            when={confirmRemove()}
            fallback={
              <button
                type="button"
                class={textButtonClass}
                data-tone="danger"
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </button>
            }
          >
            <button
              type="button"
              class={textButtonClass}
              data-tone="danger"
              onClick={remove}
            >
              {subtree().length > 1
                ? `Remove with ${subtree().length - 1} below`
                : "Confirm remove"}
            </button>
            <button
              type="button"
              class={textButtonClass}
              onClick={() => setConfirmRemove(false)}
            >
              Keep
            </button>
          </Show>
        </div>
      </Show>

      <Show when={pedigree().length}>
        <h3 class={sectionLabelClass}>Came from</h3>
        <nav
          aria-label="Pedigree"
          class={css({
            display: "flex",
            flexWrap: "wrap",
            columnGap: "1.5",
            fontSize: "sm",
          })}
        >
          <For each={pedigree()}>
            {(card, index) => (
              <span class={css({ display: "inline-flex", gap: "1.5" })}>
                <button
                  type="button"
                  class={css({
                    color: "fg.link",
                    cursor: "pointer",
                    textAlign: "left",
                    _hover: { color: "fg.linkHover" },
                  })}
                  onClick={() => props.onSelect(card.id)}
                >
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
      <CardLinkList
        label="Blocked by"
        cards={blockers()}
        onSelect={props.onSelect}
      />
      <CardLinkList
        label="Answers"
        cards={answers()}
        onSelect={props.onSelect}
      />
      <CardLinkList
        label="Results"
        cards={results()}
        onSelect={props.onSelect}
      />
      <CardLinkList
        label="Sources"
        cards={sources()}
        onSelect={props.onSelect}
      />
      <CardLinkList label="Blocks" cards={blocks()} onSelect={props.onSelect} />
      <CardLinkList
        label="Answers these"
        cards={holdersIn(board().relations.answers)}
        onSelect={props.onSelect}
      />
      <CardLinkList
        label="Backs"
        cards={holdersIn(board().relations.citations)}
        onSelect={props.onSelect}
      />
      <CardLinkList
        label="Led to"
        cards={children().filter((card) => !shown().has(card.id))}
        onSelect={props.onSelect}
      />
      <CardLinkList
        label="Related"
        cards={related().filter((card) => !shown().has(card.id))}
        onSelect={props.onSelect}
      />

      <CommentThread data={props.data} cardId={props.card.id} />

      <div
        class={css({
          mt: "4",
          fontSize: "xs",
          color: "fg.muted",
          display: "flex",
          alignItems: "center",
          gap: "2",
        })}
      >
        <span class={css({ flex: 1 })}>
          {batch()
            ? `Added by ${agentLabel(batch()!.agent)} · ${batch()!.summary || batch()!.batchKey}`
            : "Added in the app"}
        </span>
      </div>
    </article>
  );
};
