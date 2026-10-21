import { For, Show } from "solid-js";
import type { ResearchCard } from "~/services/research/research.types";
import { CardTypeIcon } from "../cardTypeMeta";
import { cardLinkClass, sectionLabelClass } from "./detailStyles";

/** A labelled list of cards that select on click; renders nothing when empty. */
export const CardLinkList = (props: { label: string; cards: ResearchCard[]; onSelect: (id: string) => void }) => (
  <Show when={props.cards.length}>
    <h3 class={sectionLabelClass}>{props.label}</h3>
    <ul>
      <For each={props.cards}>
        {(card) => (
          <li>
            <button type="button" class={cardLinkClass} onClick={() => props.onSelect(card.id)}>
              <CardTypeIcon type={card.type} size={12} />
              <span>{card.title}</span>
            </button>
          </li>
        )}
      </For>
    </ul>
  </Show>
);
