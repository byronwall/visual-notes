import { useAction } from "@solidjs/router";
import {
  createDoc,
  deleteDoc,
  saveDocContent,
  updateDoc,
} from "~/services/docs.service";
import { createNoteMutations } from "./noteMutationAcknowledgements";

export function useNoteMutations() {
  const create = useAction(createDoc);
  const remove = useAction(deleteDoc);
  const mutations = createNoteMutations({
    create,
    update: useAction(updateDoc),
    delete: remove,
  });
  // Editor saves go through the narrowly revalidating action; the result is
  // checked exactly like a regular update.
  const { update: saveContent } = createNoteMutations({
    create,
    update: useAction(saveDocContent),
    delete: remove,
  });
  return { ...mutations, saveContent };
}
