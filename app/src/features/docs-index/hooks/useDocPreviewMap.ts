import { createAsync } from "@solidjs/router";
import { createMemo, type Accessor } from "solid-js";
import { fetchDocPreviewsBatched } from "~/services/docs.service";

export const useDocPreviewMap = (ids: Accessor<string[]>) => {
  const docs = createAsync(() => {
    const values = ids();
    return fetchDocPreviewsBatched(values);
  });

  return createMemo(() => {
    const list = docs() || [];
    return new Map(list.map((doc) => [doc.id, doc]));
  });
};
