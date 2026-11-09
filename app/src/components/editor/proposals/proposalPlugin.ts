import { DOMSerializer, Fragment } from "@tiptap/pm/model";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditProposalView, ProposalOp } from "~/lib/annotations/types";
import { adaptForParent } from "~/lib/note-content/block-ops";
import { findBlock, isStale } from "./proposalTransaction";
import {
  buttonClass,
  cardActionsClass,
  cardClass,
  cardHeaderClass,
  cardLabelClass,
  oldBlockClass,
  previewClass,
} from "./proposalStyles";

// Draws pending proposed edits inline: the old block struck through and a
// card with the new blocks plus Accept / Reject after it. Nothing here
// changes the document; the host applies an accepted op as a transaction.

export type ProposalHandlers = {
  accept: (proposalId: string, index: number) => void;
  reject: (proposalId: string, index: number) => void;
};

export const proposalKey = new PluginKey<DecorationSet>("vnProposals");
const SET_META = "vnSetProposals";

const LABEL: Record<ProposalOp["op"], string> = {
  replace: "Suggested rewrite",
  insert_after: "Suggested addition",
  delete: "Suggested removal",
};

function button(
  label: string,
  action: "accept" | "reject",
  primary = false,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = buttonClass;
  el.textContent = label;
  el.dataset.action = action;
  if (primary) el.dataset.primary = "true";
  return el;
}

function renderBlocks(schema: Schema, parentType: string, op: ProposalOp) {
  const wrap = document.createElement("div");
  wrap.className = previewClass;
  try {
    const nodes = adaptForParent({ type: parentType }, op.blocks ?? []).map(
      (json) => schema.nodeFromJSON(json),
    );
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      Fragment.fromArray(nodes),
    );
    // List items need a list around them to render as one.
    if (parentType === "bulletList" || parentType === "orderedList") {
      const list = document.createElement(
        parentType === "bulletList" ? "ul" : "ol",
      );
      list.appendChild(fragment);
      wrap.appendChild(list);
    } else {
      wrap.appendChild(fragment);
    }
  } catch (error) {
    console.warn("[proposals] could not render blocks", error);
    wrap.textContent = "(This suggestion could not be shown.)";
  }
  return wrap;
}

function renderCard(
  schema: Schema,
  proposal: EditProposalView,
  index: number,
  parentType: string,
  stale: boolean,
  handlers: ProposalHandlers,
): HTMLElement {
  const op = proposal.ops[index];
  const card = document.createElement("div");
  card.className = cardClass;
  card.contentEditable = "false";
  card.dataset.kind = op.op;
  card.dataset.stale = String(stale);
  card.dataset.proposalId = proposal.id;
  card.dataset.testid = "proposal-card";

  const header = document.createElement("div");
  header.className = cardHeaderClass;
  const label = document.createElement("span");
  label.className = cardLabelClass;
  label.textContent = stale ? "Note changed" : LABEL[op.op];
  header.appendChild(label);
  const meta = document.createElement("span");
  meta.textContent = proposal.summary
    ? `${proposal.author} · ${proposal.summary}`
    : proposal.author;
  header.appendChild(meta);
  const actions = document.createElement("span");
  actions.className = cardActionsClass;
  if (!stale) actions.appendChild(button("Accept", "accept", true));
  actions.appendChild(button(stale ? "Dismiss" : "Reject", "reject"));
  header.appendChild(actions);
  card.appendChild(header);

  if (op.op !== "delete") card.appendChild(renderBlocks(schema, parentType, op));

  card.addEventListener("mousedown", (event) => event.preventDefault());
  card.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    );
    if (!target) return;
    event.preventDefault();
    if (target.dataset.action === "accept") handlers.accept(proposal.id, index);
    else handlers.reject(proposal.id, index);
  });
  return card;
}

function buildDecorations(
  doc: PMNode,
  schema: Schema,
  proposals: EditProposalView[],
  handlers: ProposalHandlers,
): DecorationSet {
  const decorations: Decoration[] = [];
  for (const proposal of proposals) {
    proposal.ops.forEach((op, index) => {
      if (op.state !== "pending") return;
      const block = findBlock(doc, op.blockId);
      if (!block) return;
      const stale = isStale(doc, op);
      const end = block.pos + block.node.nodeSize;
      if (op.op !== "insert_after" && !stale) {
        decorations.push(
          Decoration.node(block.pos, end, { class: oldBlockClass }),
        );
      }
      const key = `${proposal.id}:${index}:${stale}`;
      decorations.push(
        Decoration.widget(
          end,
          () =>
            renderCard(
              schema,
              proposal,
              index,
              block.parent.type.name,
              stale,
              handlers,
            ),
          { key, side: 1, ignoreSelection: true, stopEvent: () => true },
        ),
      );
    });
  }
  return DecorationSet.create(doc, decorations);
}

/**
 * The plugin keeps the proposals it was last given and redraws on every
 * document change, so a card turns to "Note changed" as soon as its block
 * is edited.
 */
export function createProposalPlugin(handlers: ProposalHandlers) {
  let proposals: EditProposalView[] = [];
  return new Plugin<DecorationSet>({
    key: proposalKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, value, _old, state) {
        const next = tr.getMeta(SET_META) as EditProposalView[] | undefined;
        if (next) proposals = next;
        if (!next && !tr.docChanged) return value;
        return buildDecorations(state.doc, state.schema, proposals, handlers);
      },
    },
    props: {
      decorations: (state) => proposalKey.getState(state),
    },
  });
}

/** Meta for a transaction that replaces the drawn proposals. */
export const setProposalsMeta = (proposals: EditProposalView[]) =>
  [SET_META, proposals] as const;
