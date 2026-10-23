import { useAction } from "@solidjs/router";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { setResearchCardState } from "~/services/research/research.actions";
import type { ResearchCard, ResearchCardState } from "~/services/research/research.types";
import { CardBody } from "./CardBody";
import { CARD_STATE_META, CardTypeIcon } from "./cardTypeMeta";
import type { TopicData } from "./createTopicData";

const NEXT_STATE: Record<ResearchCardState, ResearchCardState> = {
  open: "done",
  done: "dropped",
  dropped: "open",
};

const rowClass = css({
  display: "flex",
  alignItems: "flex-start",
  gap: "1.5",
  py: "1",
  pr: "2",
  borderRadius: "l2",
  transitionProperty: "background-color, opacity",
  transitionDuration: "fast",
  _hover: { bg: "bg.hover" },
  "&[data-faded=true]": { opacity: 0.55 },
  "&[data-selected=true]": { bg: "bg.selected" },
});

const stateButtonClass = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "5",
  h: "5",
  flexShrink: 0,
  borderRadius: "l1",
  color: "fg.muted",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "fast",
  _hover: { bg: "gray.a4", color: "fg.default" },
  "&[data-state=open]": { color: "amber.11" },
  "&[data-state=done]": { color: "green.11" },
  "@media (pointer: coarse)": { w: "8", h: "8" },
});

const isFaded = (card: ResearchCard) => card.state === "done" || card.state === "dropped";

type NodeProps = {
  card: ResearchCard;
  depth: number;
  data: TopicData;
  faded: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const OutlineNode = (props: NodeProps) => {
  const runSetState = useAction(setResearchCardState);
  const kids = () => props.data.children().get(props.card.id) ?? [];
  const faded = () => props.faded || isFaded(props.card);

  const cycleState = async () => {
    if (!props.card.state) return;
    await runSetState({ id: props.card.id, state: NEXT_STATE[props.card.state] });
    props.data.reload();
  };

  return (
    <li>
      <div
        class={rowClass}
        style={{ "padding-left": `${props.depth * 20 + 4}px` }}
        data-faded={faded()}
        data-selected={props.selectedId === props.card.id}
        data-testid="research-outline-row"
        data-card-type={props.card.type}
      >
        <span class={css({ display: "inline-flex", w: "5", h: "5", alignItems: "center", justifyContent: "center" })}>
          <Show when={props.card.state} fallback={<CardTypeIcon type={props.card.type} />}>
            {(state) => (
              <button
                type="button"
                class={stateButtonClass}
                data-state={state()}
                title={`${CARD_STATE_META[state()].label} — click for ${CARD_STATE_META[NEXT_STATE[state()]].label.toLowerCase()}`}
                aria-label={`${props.card.type} ${CARD_STATE_META[state()].label}`}
                onClick={cycleState}
              >
                {CARD_STATE_META[state()].icon({ size: 14, strokeWidth: 2 })}
              </button>
            )}
          </Show>
        </span>
        <div class={css({ minW: 0, flex: 1, display: "flex", flexDirection: "column", gap: "0.5" })}>
          <div class={css({ display: "flex", alignItems: "center", gap: "1.5" })}>
            <Show when={props.card.state}>
              <CardTypeIcon type={props.card.type} size={12} />
            </Show>
            <button
              type="button"
              class={css({
                fontSize: "sm",
                textAlign: "left",
                cursor: "pointer",
                textDecoration: props.card.state === "dropped" ? "line-through" : undefined,
                _hover: { color: "fg.link" },
              })}
              onClick={() => props.onSelect(props.card.id)}
            >
              {props.card.title}
            </button>
          </div>
          <CardBody card={props.card} compact />
        </div>
      </div>
      <Show when={kids().length}>
        <ul>
          <For each={kids()}>
            {(child) => (
              <OutlineNode
                card={child}
                depth={props.depth + 1}
                data={props.data}
                faded={faded()}
                selectedId={props.selectedId}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </ul>
      </Show>
    </li>
  );
};

export const TopicOutline = (props: { data: TopicData; selectedId: string | null; onSelect: (id: string) => void }) => {
  const roots = () => props.data.children().get(null) ?? [];
  return (
    <ul class={css({ display: "flex", flexDirection: "column" })} aria-label="Topic outline">
      <For each={roots()}>
        {(card) => (
          <OutlineNode card={card} depth={0} data={props.data} faded={false} selectedId={props.selectedId} onSelect={props.onSelect} />
        )}
      </For>
    </ul>
  );
};
