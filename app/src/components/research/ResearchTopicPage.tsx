import { A, useSearchParams } from "@solidjs/router";
import {
  LayersIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { countOpen } from "~/services/research/research.graph";
import { TopicCanvas } from "./canvas/TopicCanvas";
import { createTopicData } from "./createTopicData";
import { matchingIds } from "./inspector/contents";
import { createReaderWidth } from "./inspector/createReaderWidth";
import { ReaderResizeHandle } from "./inspector/ReaderResizeHandle";
import { TopicInspector, type InspectorTab } from "./inspector/TopicInspector";
import { TopicOutline } from "./TopicOutline";
import { TopicTitle } from "./TopicTitle";

const crumbLinkClass = css({
  color: "fg.link",
  textDecoration: "none",
  _hover: { color: "fg.linkHover" },
});

const tabClass = css({
  px: "2",
  h: "7",
  fontSize: "sm",
  color: "fg.muted",
  borderRadius: "l1",
  cursor: "pointer",
  transitionProperty: "background-color, color",
  transitionDuration: "140ms",
  display: "inline-flex",
  alignItems: "center",
  _hover: { bg: "bg.hover", color: "fg.default" },
  "&[data-active=true]": {
    bg: "bg.selected",
    color: "fg.selected",
    fontWeight: "medium",
  },
});

const INSPECTOR_KEY = "research-inspector";

/** A topic with no cards yet: say how cards arrive, since nothing here adds them by hand. */
const EmptyTopic = (props: { title: string }) => (
  <div
    class={css({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "2",
      h: "full",
      minH: "60",
      px: "6",
      textAlign: "center",
    })}
    data-testid="research-empty"
  >
    <LayersIcon size={28} class={css({ color: "fg.subtle" })} />
    <h2 class={css({ fontSize: "md", fontWeight: "semibold" })}>
      No cards yet
    </h2>
    <p class={css({ maxW: "26rem", fontSize: "sm", color: "fg.muted" })}>
      Ask an agent with the Visual Notes connector to research “{props.title}”.
      Its questions, findings, and sources land here as cards, and each batch
      can be undone.
    </p>
  </div>
);

const VIEWS = [
  { id: "canvas", label: "Canvas" },
  { id: "outline", label: "Outline" },
] as const;

export const ResearchTopicPage = (props: { slug: string }) => {
  const data = createTopicData(() => props.slug);
  const [params, setParams] = useSearchParams<{
    view?: string;
    card?: string;
  }>();
  const view = () => (params.view === "outline" ? "outline" : "canvas");
  const nowMs = () => Date.parse(data.current()?.generatedAt ?? "") || 0;
  const selected = () =>
    params.card ? data.cardsById().get(params.card) ?? null : null;
  const select = (id: string | null) =>
    setParams({ card: id ?? undefined }, { replace: true });
  const plainCount = () =>
    data.cards().filter((card) => card.type !== "summary").length;
  const [query, setQuery] = createSignal("");
  const matches = createMemo(() => matchingIds(data.cards(), query()));
  // Picking a card opens it in the inspector; clearing the pick goes back to Contents.
  const [tab, setTab] = createSignal<InspectorTab>(
    params.card ? "card" : "contents",
  );
  const [inspectorOpen, setInspectorOpen] = createSignal(true);
  const [expanded, setExpanded] = createSignal(false);
  const reader = createReaderWidth();
  let aside: HTMLElement | undefined;
  const asideWidth = () =>
    reader.width() ?? aside?.getBoundingClientRect().width ?? 352;
  createEffect(
    on(
      () => params.card,
      (card) => {
        if (card) {
          setTab("card");
          setInspectorOpen(true);
        } else if (tab() === "card") setTab("contents");
      },
      { defer: true },
    ),
  );
  // Rendered open on the server; a saved "closed" applies after mount.
  // Esc clears the selection unless a field, dialog, or menu has focus.
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!params.card && !expanded())) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable=true], [role=dialog], [role=menu]",
        )
      )
        return;
      // Esc steps back out of the full-width reader before it drops the selection.
      if (expanded()) setExpanded(false);
      else select(null);
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
  onMount(() => {
    try {
      if (localStorage.getItem(INSPECTOR_KEY) === "closed" && !params.card)
        setInspectorOpen(false);
    } catch {
      // Storage can be blocked; stay open.
    }
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
            <div
              role="tablist"
              aria-label="Topic view"
              class={css({ display: "flex", gap: "0.5" })}
            >
              <For each={VIEWS}>
                {(entry) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view() === entry.id}
                    class={tabClass}
                    data-active={view() === entry.id}
                    onClick={() =>
                      setParams(
                        { view: entry.id === "canvas" ? undefined : entry.id },
                        { replace: true },
                      )
                    }
                  >
                    {entry.label}
                  </button>
                )}
              </For>
            </div>
            <button
              type="button"
              class={tabClass}
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
                overflow: view() === "canvas" ? "hidden" : "auto",
              })}
            >
              <Show
                when={data.cards().length}
                fallback={<EmptyTopic title={graph().topic.title} />}
              >
                <Show
                  when={view() === "canvas"}
                  fallback={
                    <div class={css({ px: "3", py: "2" })}>
                      <TopicOutline
                        data={data}
                        selectedId={selected()?.id ?? null}
                        matches={matches()}
                        query={query()}
                        onSelect={select}
                      />
                    </div>
                  }
                >
                  <TopicCanvas
                    data={data}
                    selectedId={selected()?.id ?? null}
                    matches={matches()}
                    onSelect={select}
                  />
                </Show>
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
                onSelect={select}
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
