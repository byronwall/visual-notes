import type { createDoc, deleteDoc, updateDoc } from "~/services/docs.actions";

type CreateResult = Awaited<ReturnType<typeof createDoc>>;
type UpdateResult = Awaited<ReturnType<typeof updateDoc>>;
type DeleteResult = Awaited<ReturnType<typeof deleteDoc>>;

type MutationActions = {
  create: (...args: Parameters<typeof createDoc>) => Promise<unknown>;
  update: (...args: Parameters<typeof updateDoc>) => Promise<unknown>;
  delete: (...args: Parameters<typeof deleteDoc>) => Promise<unknown>;
};

function isCreateResult(value: unknown): value is CreateResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    value.id.trim().length > 0
  );
}

function isUpdateResult(value: unknown, id: string): value is UpdateResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    value.id === id &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt))
  );
}

function isDeleteResult(value: unknown, id: string): value is DeleteResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true &&
    "id" in value &&
    value.id === id
  );
}

export function createNoteMutations(actions: MutationActions) {
  return {
    create: async (...args: Parameters<typeof createDoc>) => {
      const result = await actions.create(...args);
      if (!isCreateResult(result)) throw new Error("Failed to create note");
      return result;
    },
    update: async (...args: Parameters<typeof updateDoc>) => {
      const result = await actions.update(...args);
      if (!isUpdateResult(result, args[0].id)) {
        throw new Error("Failed to save note");
      }
      return result;
    },
    delete: async (...args: Parameters<typeof deleteDoc>) => {
      const result = await actions.delete(...args);
      if (!isDeleteResult(result, args[0])) {
        throw new Error("Failed to delete note");
      }
      return result;
    },
  };
}
