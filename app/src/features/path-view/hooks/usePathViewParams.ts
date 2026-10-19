import { useSearchParams } from "@solidjs/router";

export type PathNoteSort = "recent" | "title";

const readString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] || "" : value || "";

/** Filter, sort, and grouping for a path page, persisted in the URL. */
export const usePathViewParams = () => {
  const [params, setParams] = useSearchParams();

  const query = () => readString(params.q);
  const sort = (): PathNoteSort =>
    readString(params.sort) === "title" ? "title" : "recent";
  const grouped = () => readString(params.group) === "1";

  return {
    query,
    sort,
    grouped,
    setQuery: (next: string) =>
      setParams({ q: next.trim() ? next : undefined }, { replace: true }),
    setSort: (next: PathNoteSort) =>
      setParams(
        { sort: next === "recent" ? undefined : next },
        { replace: true },
      ),
    setGrouped: (next: boolean) =>
      setParams({ group: next ? "1" : undefined }, { replace: true }),
  };
};
