import type { Editor } from "@tiptap/core";
import { revalidate, useAction } from "@solidjs/router";
import { createEffect, onCleanup, type VoidComponent } from "solid-js";
import {
  createProposalPlugin,
  proposalKey,
  setProposalsMeta,
} from "~/components/editor/proposals/proposalPlugin";
import { proposalTransaction } from "~/components/editor/proposals/proposalTransaction";
import { toaster } from "~/components/ui/toast";
import type { EditProposalView } from "~/lib/annotations/types";
import { resolveProposal } from "~/services/annotations/annotations.actions";
import { fetchNoteProposals } from "~/services/annotations/annotations.queries";
import { createKeptAsync, onDemand } from "~/utils/kept-async";

// Mounts the proposed-edit layer on a note's editor. Accept applies the op as
// an editor transaction, so autosave writes it as the user's edit; only the
// decision goes to the server.

const LOG_PREFIX = "[proposals]";

export const ProposalLayer: VoidComponent<{
  docId: string;
  editor: Editor | undefined;
}> = (props) => {
  const proposals = createKeptAsync(
    () => fetchNoteProposals(props.docId),
    onDemand,
  );
  const runResolve = useAction(resolveProposal);
  let current: EditProposalView[] = [];

  const decide = async (
    proposalId: string,
    index: number,
    state: "accepted" | "rejected",
  ) => {
    try {
      await runResolve({ proposalId, indexes: [index], state });
    } catch (error) {
      console.warn(`${LOG_PREFIX} resolve failed`, error);
      toaster.create({ title: "Could not record that decision", type: "error" });
    }
    void revalidate(fetchNoteProposals.keyFor(props.docId));
  };

  const handlers = {
    accept: (proposalId: string, index: number) => {
      const ed = props.editor;
      const op = current.find((p) => p.id === proposalId)?.ops[index];
      if (!ed || !op) return;
      const tr = proposalTransaction(ed.state, op);
      if (!tr) {
        toaster.create({
          title: "That part of the note changed, so the suggestion no longer fits",
          type: "info",
        });
        return;
      }
      ed.view.dispatch(tr);
      console.info(`${LOG_PREFIX} accepted`, { proposalId, index });
      void decide(proposalId, index, "accepted");
    },
    reject: (proposalId: string, index: number) => {
      void decide(proposalId, index, "rejected");
    },
  };

  createEffect(() => {
    const ed = props.editor;
    if (!ed || ed.isDestroyed) return;
    ed.registerPlugin(createProposalPlugin(handlers));
    onCleanup(() => {
      if (!ed.isDestroyed) ed.unregisterPlugin(proposalKey);
    });
  });

  createEffect(() => {
    const ed = props.editor;
    const list = proposals.latest ?? [];
    if (!ed || ed.isDestroyed) return;
    current = list;
    const [meta, value] = setProposalsMeta(list);
    ed.view.dispatch(
      ed.state.tr.setMeta(meta, value).setMeta("addToHistory", false),
    );
  });

  return null;
};
