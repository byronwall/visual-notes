import { A, useAction, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { formatRelativeShort } from "~/components/doc-header/relative-time";
import { useAppChanges } from "~/features/live-sync/NoteLiveSyncProvider";
import { createResearchTopic } from "~/services/research/research.actions";
import { fetchResearchTopics } from "~/services/research/research.queries";

const rowClass = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  rowGap: "1",
  columnGap: "4",
  px: "2",
  py: "2",
  borderBottomWidth: "1px",
  borderColor: "border",
  transitionProperty: "background-color",
  transitionDuration: "fast",
  _hover: { bg: "bg.hover" },
});

const titleLinkClass = css({
  color: "fg.link",
  fontWeight: "medium",
  textDecoration: "none",
  whiteSpace: "nowrap",
  _hover: { color: "fg.linkHover" },
});

const metaClass = css({
  fontSize: "xs",
  color: "fg.muted",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
});

export const ResearchTopicIndex = () => {
  const [refresh, setRefresh] = createSignal(0);
  const [showArchived, setShowArchived] = createSignal(false);
  const [data] = createResource(
    () => ({ refresh: refresh(), includeArchived: showArchived() }),
    (input) => fetchResearchTopics(input),
  );
  useAppChanges("research", () => setRefresh((n) => n + 1));
  const runCreate = useAction(createResearchTopic);
  const navigate = useNavigate();
  const [title, setTitle] = createSignal("");
  const [creating, setCreating] = createSignal(false);

  const topics = () => data.latest?.topics ?? [];
  const nowMs = () => Date.parse(data.latest?.generatedAt ?? "") || 0;

  const create = async (event: SubmitEvent) => {
    event.preventDefault();
    const value = title().trim();
    if (!value || creating()) return;
    setCreating(true);
    try {
      const created = await runCreate({ title: value });
      setTitle("");
      setRefresh((n) => n + 1);
      navigate(`/research/${created.slug}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main class={css({ maxW: "5xl", mx: "auto", w: "full", px: "4", py: "3" })}>
      <div class={css({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "3", mb: "3" })}>
        <h1 class={css({ fontSize: "lg", fontWeight: "semibold", flex: "1" })}>Research</h1>
        <form onSubmit={create} class={css({ display: "flex", gap: "2", minW: 0, flex: { base: "1 1 100%", sm: "0 0 auto" } })}>
          <input
            aria-label="New topic title"
            placeholder="New topic…"
            value={title()}
            onInput={(event) => setTitle(event.currentTarget.value)}
            class={css({
              h: "8",
              w: { base: "full", sm: "64" },
              minW: 0,
              px: "2",
              fontSize: "sm",
              borderWidth: "1px",
              borderColor: "border",
              borderRadius: "l2",
              bg: "bg.default",
              _focusVisible: { outline: "2px solid token(colors.border.focus)", outlineOffset: "-1px" },
            })}
          />
          <Button type="submit" size="sm" variant="outline" disabled={!title().trim()} loading={creating()}>
            Create
          </Button>
        </form>
        <label class={css({ display: "inline-flex", alignItems: "center", gap: "1.5", fontSize: "sm", color: "fg.muted", cursor: "pointer" })}>
          <input
            type="checkbox"
            checked={showArchived()}
            onChange={(event) => setShowArchived(event.currentTarget.checked)}
          />
          Show archived
        </label>
      </div>

      <Show
        when={topics().length > 0}
        fallback={
          <Show when={data.latest}>
            <p class={css({ color: "fg.muted", fontSize: "sm", px: "2", py: "6" })}>
              No topics yet. Create one here, or have an agent call <code>research_create_topic</code> over MCP.
            </p>
          </Show>
        }
      >
        <div class={css({ borderTopWidth: "1px", borderColor: "border" })}>
          <For each={topics()}>
            {(topic) => (
              <div class={rowClass} data-testid="research-topic-row">
                <A href={`/research/${topic.slug}`} class={titleLinkClass}>
                  {topic.title}
                  <Show when={topic.archivedAt}>
                    <span class={css({ ml: "1.5", fontSize: "xs", color: "fg.muted", fontWeight: "normal" })}>archived</span>
                  </Show>
                </A>
                <span class={metaClass}>
                  <Show when={topic.openCount > 0}>
                    <span class={css({ color: "amber.11" })}>{topic.openCount} open</span>
                    {" · "}
                  </Show>
                  {topic.cardCount} cards · {formatRelativeShort(nowMs(), topic.lastActivityAt)}
                </span>
                <p
                  class={css({
                    gridColumn: "1 / -1",
                    fontSize: "sm",
                    color: topic.topSummary ? "fg.default" : "fg.subtle",
                    maxW: "prose",
                  })}
                >
                  {topic.topSummary ?? "No accepted summary yet."}
                </p>
              </div>
            )}
          </For>
        </div>
      </Show>
    </main>
  );
};
