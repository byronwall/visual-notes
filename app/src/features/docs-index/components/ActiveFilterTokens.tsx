import { For, createMemo } from "solid-js";
import { XIcon } from "lucide-solid";
import { css } from "styled-system/css";
import type { DocsQueryStore } from "../state/docsQuery";
import { activityLabel, updatedLabel } from "./facet-labels";

type Token = {
  key: string;
  label: string;
  value: string;
  mono?: boolean;
  clear: () => void;
};

const tokenClass = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  h: "6",
  pl: "2",
  pr: "1",
  maxW: "16rem",
  borderRadius: "l2",
  bg: "gray.subtle.bg",
  fontSize: "xs",
  color: "fg.default",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transitionProperty: "background-color",
  transitionDuration: "120ms",
  _hover: { bg: "gray.subtle.bg.hover" },
  "& .token-x": { color: "fg.subtle" },
  "&:hover .token-x": { color: "fg.default" },
});

const valueClass = css({ overflow: "hidden", textOverflow: "ellipsis" });
const valueMonoClass = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontFamily: "mono",
});
const keyClass = css({ color: "fg.muted" });

const rangeLabel = (from: string, to: string) =>
  from && to ? `${from} – ${to}` : from ? `≥ ${from}` : `≤ ${to}`;

export const useActiveFilterTokens = (
  q: DocsQueryStore,
  collectionName: (id: string) => string | undefined,
) =>
  createMemo<Token[]>(() => {
    const out: Token[] = [];
    if (q.blankPathOnly())
      out.push({
        key: "blank",
        label: "path",
        value: "none",
        clear: () => q.setBlankPathOnly(false),
      });
    else if (q.pathPrefix().trim())
      out.push({
        key: "path",
        label: "path",
        value: q.pathPrefix(),
        mono: true,
        clear: () => q.setPathPrefix(""),
      });
    if (q.metaKey().trim() || q.metaValue().trim())
      out.push({
        key: "meta",
        label: q.metaKey().trim() || "meta",
        value: q.metaValue().trim() || "any",
        clear: () => q.resetMeta(),
      });
    if (q.activityClass())
      out.push({
        key: "activity",
        label: "activity",
        value: activityLabel(q.activityClass()),
        clear: () => q.setActivityClass(""),
      });
    if (q.collectionId())
      out.push({
        key: "collection",
        label: "collection",
        value: collectionName(q.collectionId()) ?? "Unknown",
        clear: () => q.setCollectionId(""),
      });
    else if (q.collectionRows() === "only")
      out.push({
        key: "collections",
        label: "collection rows",
        value: "only",
        clear: () => q.setCollectionRows(""),
      });
    if (q.source().trim())
      out.push({
        key: "source",
        label: "source",
        value: q.source(),
        clear: () => q.setSource(""),
      });
    if (q.originalContentId().trim())
      out.push({
        key: "oid",
        label: "original ID",
        value: q.originalContentId(),
        mono: true,
        clear: () => q.setOriginalContentId(""),
      });
    if (q.createdFrom() || q.createdTo())
      out.push({
        key: "created",
        label: "created",
        value: rangeLabel(q.createdFrom(), q.createdTo()),
        clear: () => {
          q.setCreatedFrom(undefined);
          q.setCreatedTo(undefined);
        },
      });
    if (q.updatedWithinDays())
      out.push({
        key: "updated-within",
        label: "updated",
        value: updatedLabel(q.updatedWithinDays()).toLowerCase(),
        clear: () => q.setUpdatedWithinDays(0),
      });
    if (q.updatedFrom() || q.updatedTo())
      out.push({
        key: "updated",
        label: "updated",
        value: rangeLabel(q.updatedFrom(), q.updatedTo()),
        clear: () => {
          q.setUpdatedFrom(undefined);
          q.setUpdatedTo(undefined);
        },
      });
    return out;
  });

export const ActiveFilterTokens = (props: { tokens: Token[] }) => (
  <For each={props.tokens}>
    {(t) => (
      <button
        type="button"
        class={tokenClass}
        title={`Remove filter ${t.label}: ${t.value}`}
        onClick={t.clear}
      >
        <span class={keyClass}>{t.label}:</span>
        <span class={t.mono ? valueMonoClass : valueClass}>{t.value}</span>
        <XIcon class="token-x" size={12} />
      </button>
    )}
  </For>
);
