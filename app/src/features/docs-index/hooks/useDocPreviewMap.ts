import { createAsync } from "@solidjs/router";
import { createMemo, type Accessor } from "solid-js";
import { fetchDocPreviews } from "~/services/docs.service";

export const useDocPreviewMap = (ids: Accessor<string[]>) => {
  const docs = createAsync(() => {
    const values = ids();
    const unique = Array.from(new Set(values.filter((id) => id.length > 0)));
    if (unique.length === 0) return Promise.resolve([]);
    const startedAt = Date.now();
    return fetchDocPreviews(unique).then((items) => {
      console.log("[docs-index] preview map loaded", {
        ids: unique.length,
        returned: items.length,
        ms: Date.now() - startedAt,
      });
      return items;
    });
  });

  return createMemo(() => {
    const list = docs() || [];
    return new Map(list.map((doc) => [doc.id, doc]));
  });
};
