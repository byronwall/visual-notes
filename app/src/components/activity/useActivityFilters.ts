import { useSearchParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import type { ActivityTimelineFilter } from "~/services/activity/activity.types";

export const ADVANCED_FILTER_KEYS = [
  "event",
  "actor",
  "doc",
  "tool",
  "call",
  "from",
  "to",
] as const;
type AdvancedKey = (typeof ADVANCED_FILTER_KEYS)[number];

const read = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || "";

/** Activity filters live in the URL so a refresh or shared link keeps them. */
export const useActivityFilters = () => {
  const [params, setParams] = useSearchParams();

  const domain = () => read(params.type) || "all";
  const pathPrefix = () => read(params.path);
  const advanced = (key: AdvancedKey) => read(params[key]);

  const advancedCount = createMemo(
    () => ADVANCED_FILTER_KEYS.filter((key) => advanced(key).length > 0).length,
  );

  const filter = createMemo((): ActivityTimelineFilter => {
    return {
      eventDomain: domain() === "all" ? undefined : domain(),
      eventType: advanced("event") || undefined,
      actorId: advanced("actor") || undefined,
      relatedDocId: advanced("doc") || undefined,
      ...(advanced("tool")
        ? { entityType: "mcp_tool", entityId: advanced("tool") }
        : {}),
      requestId: advanced("call") || undefined,
      // Connector calls are chatty; they live under the MCP tab.
      excludeDomains: domain() === "all" ? ["mcp"] : undefined,
      docPathPrefix: pathPrefix() || undefined,
      // Passed through as typed (server-interpreted), matching the old filter.
      from: advanced("from") || undefined,
      to: advanced("to") || undefined,
    };
  });

  const setParam = (key: string, value: string) =>
    setParams({ [key]: value.trim() || undefined }, { replace: true });

  const clearAll = () =>
    setParams(
      {
        type: undefined,
        path: undefined,
        ...Object.fromEntries(
          ADVANCED_FILTER_KEYS.map((key) => [key, undefined]),
        ),
      },
      { replace: true },
    );

  const hasAnyFilter = () =>
    domain() !== "all" || pathPrefix().length > 0 || advancedCount() > 0;

  return {
    domain,
    pathPrefix,
    advanced,
    advancedCount,
    filter,
    setParam,
    clearAll,
    hasAnyFilter,
  };
};

export type ActivityFilters = ReturnType<typeof useActivityFilters>;
