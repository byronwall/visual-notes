import { useAction } from "@solidjs/router";
import { createDoc, deleteDoc, updateDoc } from "~/services/docs.service";
import { createNoteMutations } from "./noteMutationAcknowledgements";

export function useNoteMutations() {
  return createNoteMutations({
    create: useAction(createDoc),
    update: useAction(updateDoc),
    delete: useAction(deleteDoc),
  });
}
