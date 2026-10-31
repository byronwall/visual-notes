import { A, useSearchParams } from "@solidjs/router";
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Match,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { css } from "styled-system/css";
import { countOpen } from "~/services/research/research.graph";
import { OptionsTable } from "./board/OptionsTable";
import { TopicBoard } from "./board/TopicBoard";
import { createTopicData } from "./createTopicData";
import { EmptyTopic } from "./EmptyTopic";
import { matchingIds } from "./inspector/contents";
import { createReaderWidth } from "./inspector/createReaderWidth";
import { ReaderResizeHandle } from "./inspector/ReaderResizeHandle";
import { TopicInspector, type InspectorTab } from "./inspector/TopicInspector";
import { TopicMap } from "./map/TopicMap";
import { TopicOutline } from "./TopicOutline";
import { TopicTitle } from "./TopicTitle";
import { parseTopicView, topicTabClass, TopicViewTabs } from "./TopicViewTabs";

const crumbLinkClass = css({
  color: "fg.link",
  textDecoration: "none",
  _hover: { color: "fg.linkHover" },
});

const INSPECTOR_KEY = "research-inspector";

const savedInspector = () => {
  try {
    return localStorage.getItem(INSPECTOR_KEY);
  } catch {
    // Storage can be blocked; fall back to the view's default.
    return null;
  }
};

export const ResearchTopicPage = (props: { slug: string }) => {
  const data = createTopicData(() => props.slug);
  const [params, setParams] = useSearchParams<{
    view?: string;
    card?: string;
    stream?: string;
  }>();
  const view = () => parseTopicView(params.view);
  const nowMs = () => Date.parse(data.current()?.generatedAt ?? "") || 0;
  const selected = () =>
    params.card ? data.cardsById().get(params.card) ?? null : null;
  const selectedStream = () =>
    params.stream && !params.card
      ? data.streamsByKey().get(params.stream) ?? null
      : null;
  // A card and a stream share the reader; picking one clears the other.
  const select = (id: string | null) =>
    setParams({ card: id ?? undefined, stream: undefined }, { replace: true });
  const selectStream = (key: string | null) =>
    setParams({ stream: key ?? undefined, card: undefined }, { replace: true });
  const plainCount = () =>
    data.cards().filter((card) => card.type !== "summary").length;
  const [query, setQuery] = createSignal("");
  const matches = createMemo(() => matchingIds(data.cards(), query()));
  // Picking a card opens it in the inspector; clearing the pick goes back to Contents.
  const [tab, setTab] = createSignal<InspectorTab>(
    params.card || params.stream ? "card" : "contents",
  );
  // The map opens on its own, full width; the first pick brings the reader in.
  const [inspectorOpen, setInspectorOpen] = createSignal(
    view() !== "map" || !!params.card || !!params.stream,
  );
  const [expanded, setExpanded] = createSignal(false);
  const reader = createReaderWidth();
  let aside: HTMLElement | undefined;
  const asideWidth = () =>
    reader.width() ?? aside?.getBoundingClientRect().width ?? 352;
  createEffect(
    on(
      () => params.card || params.stream,
      (card) => {
        if (card) {
          setTab("card");
          setInspectorOpen(true);
        } else if (tab() === "card") setTab("contents");
      },
      { defer: true },
    ),
  );
  createEffect(
    on(
      view,
      (next) => {
        if (next !== "map" && savedInspector() !== "closed")
          setInspectorOpen(true);
      },
      { defer: true },
    ),
  );
  // A saved choice applies after mount: only the browser knows it.
  // Esc clears the selection unless a field, dialog, or menu has focus.
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        (!params.card && !params.stream && !expanded())
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable=true], [role=dialog], [role=menu]",
        )
      )
        return;
      // Esc steps back out of the full-width reader before it drops the selection.
      if (expanded()) setExpanded(false);
      else if (params.stream) selectStream(null);
      else select(null);
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
  onMount(() => {
    const saved = savedInspector();
    if (saved === "closed" && !params.card) setInspectorOpen(false);
    if (saved === "open") setInspectorOpen(true);
  });
  const toggleInspector = () => {
    const next = !inspectorOpen();
    setInspectorOpen(next);
    try {
      localStorage.setItem(INSPECTOR_KEY, next ? "open" : "closed");
    } catch {
      // Not saved; the toggle still works for this visit.
    }
  };

  return (
    <Show
      when={data.current()}
      fallback={
        <Show when={data.graph.state === "ready"}>
          <p class={css({ p: "6", color: "fg.muted" })}>
            Topic not found.{" "}
            <A href="/research" class={crumbLinkClass}>
              Back to Research
            </A>
          </p>
        </Show>
      }
    >
      {(graph) => (
        <div
          class={css({
            display: "flex",
            flexDirection: "column",
            h: "100dvh",
            minH: 0,
          })}
        >
          <header
            class={css({
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              rowGap: "1",
              columnGap: "3",
              px: "4",
              py: "1.5",
              borderBottomWidth: "1px",
              borderColor: "border",
            })}
          >
            <nav
              aria-label="Breadcrumb"
              class={css({
                fontSize: "sm",
                display: "flex",
                alignItems: "center",
                gap: "1.5",
                minW: 0,
              })}
            >
              <A href="/research" class={crumbLinkClass}>
                Research
              </A>
              <span class={css({ color: "fg.subtle" })}>/</span>
              <TopicTitle topic={graph().topic} onChanged={data.reload} />
            </nav>
            <span
              class={css({
                fontSize: "xs",
                color: "fg.muted",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                flex: 1,
              })}
            >
              <span
                class={css({
                  color: countOpen(data.cards()) ? "amber.11" : undefined,
                })}
              >
                {countOpen(data.cards())} open
              </span>{" "}
              · {plainCount()} {plainCount() === 1 ? "card" : "cards"}
            </span>
            <TopicViewTabs
              view={view()}
              onView={(next) =>
                setParams(
                  { view: next === "map" ? undefined : next },
                  { replace: true },
                )
              }
            />
            <button
              type="button"
              class={topicTabClass}
              aria-pressed={inspectorOpen()}
              aria-label={inspectorOpen() ? "Hide inspector" : "Show inspector"}
              title={inspectorOpen() ? "Hide inspector" : "Show inspector"}
              onClick={toggleInspector}
            >
              <Show
                when={inspectorOpen()}
                fallback={<PanelRightOpenIcon size={16} />}
              >
                <PanelRightCloseIcon size={16} />
              </Show>
            </button>
          </header>
          <div
            class={css({
              flex: 1,
              minH: 0,
              display: "grid",
              position: "relative",
              gridTemplateColumns: {
                base: "1fr",
                lg: "minmax(0, 1fr) var(--reader-w, 22rem)",
                "2xl": "minmax(0, 1fr) var(--reader-w, 26rem)",
              },
              gridTemplateRows: {
                base: "minmax(0, 1fr) auto",
                lg: "minmax(0, 1fr)",
              },
              "&[data-inspector=closed]": {
                gridTemplateColumns: "1fr",
                gridTemplateRows: "minmax(0, 1fr)",
              },
              "&[data-inspector=closed] > aside": { display: "none" },
            })}
            data-inspector={inspectorOpen() ? "open" : "closed"}
            data-reader={expanded() ? "expanded" : "rail"}
            style={
              reader.width()
                ? { "--reader-w": `${reader.width()}px` }
                : undefined
            }
          >
            <main
              class={css({
                minH: 0,
                isolation: "isolate",
                overflow:
                  view() === "board" || view() === "map" ? "hidden" : "auto",
              })}
            >
              <Show
                when={data.cards().length}
                fallback={<EmptyTopic title={graph().topic.title} />}
              >
                <Switch>
                  <Match when={view() === "map"}>
                    <TopicMap
                      data={data}
                      selectedId={selected()?.id ?? null}
                      selectedStream={selectedStream()?.key ?? null}
                      matches={matches()}
                      query={query()}
                      onQuery={setQuery}
                      onSelect={select}
                      onSelectStream={selectStream}
                    />
                  </Match>
                  <Match when={view() === "board"}>
                    <TopicBoard
                      data={data}
                      selectedId={selected()?.id ?? null}
                      selectedStream={selectedStream()?.key ?? null}
                      matches={matches()}
                      onSelect={select}
                      onSelectStream={selectStream}
                    />
                  </Match>
                  <Match when={view() === "table"}>
                    <OptionsTable
                      data={data}
                      selectedId={selected()?.id ?? null}
                      onSelect={select}
                    />
                  </Match>
                  <Match when={view() === "outline"}>
                    <div class={css({ px: "3", py: "2" })}>
                      <TopicOutline
                        data={data}
                        selectedId={selected()?.id ?? null}
                        matches={matches()}
                        query={query()}
                        onSelect={select}
                      />
                    </div>
                  </Match>
                </Switch>
              </Show>
            </main>
            <aside
              ref={aside}
              class={css({
                position: "relative",
                bg: "bg.default",
                // Expanded, the reader covers the board instead of replacing it, so the
                // board keeps its size and scroll for when the reader closes.
                "[data-reader=expanded] > &": {
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                },
                borderLeftWidth: { lg: "1px" },
                borderTopWidth: { base: "1px", lg: "0" },
                borderColor: "border",
                minH: 0,
                h: { base: "45dvh", lg: "auto" },
              })}
            >
              <Show when={!expanded()}>
                <ReaderResizeHandle
                  width={asideWidth}
                  onDragStart={(event) => reader.startDrag(event, asideWidth())}
                  onStep={(delta) => reader.nudge(delta, asideWidth())}
                  onReset={reader.reset}
                />
              </Show>
              <TopicInspector
                data={data}
                expanded={expanded()}
                onToggleExpand={() => setExpanded((value) => !value)}
                tab={tab()}
                onTab={setTab}
                selected={selected()}
                selectedStream={selectedStream()}
                onSelect={select}
                onSelectStream={selectStream}
                query={query()}
                onQuery={setQuery}
                nowMs={nowMs()}
              />
            </aside>
          </div>
        </div>
      )}
    </Show>
  );
};
