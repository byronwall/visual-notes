import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import { kindLabel, orderedFields } from "~/services/research/research.kinds";
import { byCardOrder } from "~/services/research/research.relations";
import type { ResearchCard } from "~/services/research/research.types";
import { CardGlyph } from "../cardTypeMeta";
import type { TopicData } from "../createTopicData";

const tableClass = css({
  borderCollapse: "collapse",
  fontSize: "sm",
  "& th, & td": {
    px: "2.5",
    py: "1.5",
    textAlign: "left",
    verticalAlign: "top",
    borderBottomWidth: "1px",
    borderColor: "border",
  },
  "& th": {
    fontSize: "xs",
    fontWeight: "medium",
    color: "fg.muted",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    bg: "bg.default",
  },
  "& tbody tr": {
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: "140ms",
  },
  "& tbody tr:hover": { bg: "bg.hover" },
  "& tbody tr[data-selected=true]": { bg: "bg.selected" },
});

type Group = {
  key: string;
  label: string;
  fields: { key: string; label: string }[];
  cards: ResearchCard[];
};

/** Every option in the topic as rows, one table per kind so each gets its own columns. */
export const OptionsTable = (props: {
  data: TopicData;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => {
  const kinds = () => props.data.current()?.topic.kinds ?? [];
  const board = () => props.data.board();
  const streamTitle = (card: ResearchCard) =>
    board().assignment.columns.find(
      (column) => column.id === board().assignment.streamOf.get(card.id),
    )?.title ?? "Unsorted";
  // One value repeated in every row tells the reader nothing.
  const showStream = () =>
    new Set(
      props.data
        .cards()
        .filter((card) => card.type === "option")
        .map(streamTitle),
    ).size > 1;
  const groups = (): Group[] => {
    const options = props.data
      .cards()
      .filter((card) => card.type === "option")
      .sort(byCardOrder);
    const byKind = new Map<string, Group>();
    for (const card of options) {
      const key = card.kind ?? "";
      if (!byKind.has(key)) {
        const kind = kinds().find((entry) => entry.key === card.kind);
        byKind.set(key, {
          key,
          label: kindLabel(kinds(), card.kind) ?? "Options",
          fields: [...(kind?.fields ?? [])],
          cards: [],
        });
      }
      byKind.get(key)!.cards.push(card);
    }
    // Undeclared field keys still get a column.
    for (const group of byKind.values()) {
      const known = new Set(group.fields.map((field) => field.key));
      for (const card of group.cards) {
        for (const key of Object.keys(card.fields)) {
          if (!known.has(key)) {
            known.add(key);
            group.fields.push({ key, label: key });
          }
        }
      }
    }
    return [...byKind.values()];
  };

  return (
    <div
      class={css({
        px: "4",
        py: "3",
        display: "flex",
        flexDirection: "column",
        gap: "6",
      })}
      data-testid="research-options-table"
    >
      <Show
        when={groups().length}
        fallback={
          <p class={css({ fontSize: "sm", color: "fg.muted" })}>
            No options in this topic yet.
          </p>
        }
      >
        <For each={groups()}>
          {(group) => (
            <section>
              <h2
                class={css({
                  fontSize: "md",
                  fontWeight: "semibold",
                  mb: "1.5",
                })}
              >
                {group.label}{" "}
                <span class={css({ color: "fg.subtle", fontWeight: "normal" })}>
                  {group.cards.length}
                </span>
              </h2>
              <div class={css({ overflowX: "auto" })}>
                <table class={tableClass}>
                  <thead>
                    <tr>
                      <th>Option</th>
                      <For each={group.fields}>
                        {(field) => <th>{field.label}</th>}
                      </For>
                      <th>Open blockers</th>
                      <Show when={showStream()}>
                        <th>Stream</th>
                      </Show>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={group.cards}>
                      {(card) => {
                        const fields = () =>
                          new Map(
                            orderedFields(kinds(), card).map((field) => [
                              field.key,
                              field.value,
                            ]),
                          );
                        const blockers = () =>
                          (
                            board().relations.blockers.get(card.id) ?? []
                          ).filter((entry) => entry.card.state === "open");
                        return (
                          <tr
                            tabIndex={0}
                            data-selected={props.selectedId === card.id}
                            onClick={() => props.onSelect(card.id)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ")
                                return;
                              event.preventDefault();
                              props.onSelect(card.id);
                            }}
                          >
                            <td class={css({ minW: "14rem", maxW: "26rem" })}>
                              <div
                                class={css({
                                  display: "flex",
                                  gap: "1.5",
                                  alignItems: "baseline",
                                })}
                              >
                                <CardGlyph card={card} size={13} />
                                <div>
                                  <div class={css({ fontWeight: "medium" })}>
                                    {card.title}
                                  </div>
                                  <Show when={card.gist}>
                                    <div class={css({ color: "fg.muted" })}>
                                      {card.gist}
                                    </div>
                                  </Show>
                                </div>
                              </div>
                            </td>
                            <For each={group.fields}>
                              {(field) => (
                                <td
                                  class={css({
                                    fontVariantNumeric: "tabular-nums",
                                    whiteSpace: "nowrap",
                                  })}
                                >
                                  {fields().get(field.key) ?? ""}
                                </td>
                              )}
                            </For>
                            <td
                              class={css({
                                color: "amber.11",
                                minW: "12rem",
                                maxW: "22rem",
                              })}
                            >
                              <For each={blockers()}>
                                {(entry) => <div>{entry.card.title}</div>}
                              </For>
                            </td>
                            <Show when={showStream()}>
                              <td
                                class={css({
                                  color: "fg.muted",
                                  minW: "8rem",
                                  maxW: "14rem",
                                })}
                              >
                                {streamTitle(card)}
                              </td>
                            </Show>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </For>
      </Show>
    </div>
  );
};
