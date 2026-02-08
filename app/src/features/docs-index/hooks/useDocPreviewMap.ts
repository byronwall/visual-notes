import { createAsync } from "@solidjs/router";
import { createMemo, type Accessor } from "solid-js";
import { fetchDoc } from "~/services/docs.service";

export const useDocPreviewMap = (ids: Accessor<string[]>) => {
  const docs = createAsync(() => {
    const values = ids();
    const unique = Array.from(new Set(values.filter((id) => id.length > 0)));
    if (unique.length === 0) return Promise.resolve([]);
    return Promise.allSettled(unique.map((id) => fetchDoc(id))).then(
      (results) => {
        const fulfilled = results.filter(
          (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchDoc>>> =>
            result.status === "fulfilled"
        );
        return fulfilled.map((entry) => entry.value);
      }
    );
  });

  return createMemo(() => {
    const list = docs() || [];
    return new Map(list.map((doc) => [doc.id, doc]));
  });
};
