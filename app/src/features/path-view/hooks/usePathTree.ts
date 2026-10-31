import { createMemo } from "solid-js";
import { fetchPathStats } from "~/services/docs.service";
import { buildPathTree } from "../utils/path-tree";
import { createKeptAsync } from "~/utils/kept-async";

export const usePathTree = () => {
  const stats = createKeptAsync(() => fetchPathStats());
  const tree = createMemo(() => buildPathTree(stats() ?? []));
  return tree;
};
