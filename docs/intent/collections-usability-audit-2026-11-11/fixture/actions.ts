import { action } from "@solidjs/router";
const stub = (name: string) =>
  action(async (...args: any[]) => {
    console.info("[fixture-only]", name);
    return {
      updatedAt: {},
      rank: "a",
      id: "synthetic-new",
      title: "Untitled",
      properties: {},
      createdAt: new Date().toISOString(),
    };
  }, name);
export const createCollection = stub("createCollection"),
  updateCollection = stub("updateCollection"),
  deleteCollection = stub("deleteCollection"),
  createProperty = stub("createProperty"),
  updateProperty = stub("updateProperty"),
  deleteProperty = stub("deleteProperty"),
  reorderProperties = stub("reorderProperties"),
  createSelectOption = stub("createSelectOption"),
  setRowProperties = stub("setRowProperties"),
  setRowTitle = stub("setRowTitle"),
  createRow = stub("createRow"),
  moveRow = stub("moveRow"),
  deleteRows = stub("deleteRows"),
  removeRowsFromCollection = stub("removeRowsFromCollection"),
  createView = stub("createView"),
  updateView = stub("updateView"),
  deleteView = stub("deleteView"),
  reorderViews = stub("reorderViews"),
  changePropertyKind = stub("changePropertyKind");
