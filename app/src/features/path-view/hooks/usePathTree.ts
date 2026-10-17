import { createAsync } from "@solidjs/router";
import { createMemo } from "solid-js";
import { fetchPathStats } from "~/services/docs.service";
import { buildPathTree } from "../utils/path-tree";

export const usePathTree = () => {
  const stats = createAsync(() => fetchPathStats());
  const tree = createMemo(() => buildPathTree(stats() ?? []));
  return tree;
};
