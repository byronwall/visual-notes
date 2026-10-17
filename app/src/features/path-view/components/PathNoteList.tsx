import { A, useNavigate } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createResource, createSignal, on } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { fetchDocPreviewsBatched } from "~/services/docs.service";
import { pathToRoute } from "~/utils/path-links";
import { usePathKeyboard } from "../hooks/usePathKeyboard";
import { usePathViewParams } from "../hooks/usePathViewParams";
import {
  filterPathNotes,
  groupPathNotes,
  relativeNotePath,
  sortPathNotes,
  type PathNote,
} from "../utils/path-notes";
import { PathNoteRow } from "./PathNoteRow";
import { PathNoteToolbar } from "./PathNoteToolbar";

const PAGE_SIZE = 60;
const NO_PREVIEW = "No preview available.";

const groupHeaderClass = css({
  display: "flex",
  alignItems: "baseline",
  gap: "2",
  pt: "4",
  pb: "1",
  fontSize: "sm",
  color: "fg.muted",
});

const groupLinkClass = css({
  fontFamily: "mono",
  fontWeight: "semibold",
  color: "fg.default",
  textDecoration: "none",
  _hover: { textDecoration: "underline" },
});

export const PathNoteList = (props: {
  path: string;
  notes: PathNote[];
  onCreateNote?: () => void;
}) => {
  const navigate = useNavigate();
  const params = usePathViewParams();
  const [limit, setLimit] = createSignal(PAGE_SIZE);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  let filterInput: HTMLInputElement | undefined;
  // The keyboard cursor yields to the mouse, but only to real pointer movement:
  // Chrome sends a synthetic mousemove (same coordinates) after scrollIntoView.
  let lastPointer = "";
  const onListMouseMove = (event: MouseEvent) => {
    const at = `${event.clientX},${event.clientY}`;
    if (at === lastPointer) return;
    const first = lastPointer === "";
    lastPointer = at;
    if (!first && activeIndex() >= 0) setActiveIndex(-1);
  };

  const hasNestedNotes = createMemo(() =>
    props.notes.some((note) => relativeNotePath(note.path, props.path) !== ""),
  );
  const grouped = () => params.grouped() && hasNestedNotes();

  const ordered = createMemo(() => {
    const filtered = filterPathNotes(props.notes, params.query(), props.path);
    const sorted = sortPathNotes(filtered, params.sort());
    if (!grouped()) return sorted;
    return groupPathNotes(sorted, props.path).flatMap((group) => group.notes);
  });
  const visible = createMemo(() => ordered().slice(0, limit()));
  const groupTotals = createMemo(() => {
    const totals = new Map<string, number>();
    for (const group of groupPathNotes(ordered(), props.path)) {
      totals.set(group.groupPath, group.notes.length);
    }
    return totals;
  });
  const sections = createMemo(() =>
    grouped()
      ? groupPathNotes(visible(), props.path)
      : [{ groupPath: "", notes: visible() }],
  );
  const indexById = createMemo(
    () => new Map(visible().map((note, index) => [note.id, index])),
  );

  const visibleIdsKey = createMemo(() => visible().map((note) => note.id).join(","));
  const [previews] = createResource(visibleIdsKey, (key) =>
    key ? fetchDocPreviewsBatched(key.split(",")) : Promise.resolve([]),
  );
  // Read inside each row's Suspense so slow previews never hold back the list.
  const previewFor = (note: PathNote) => {
    const text = previews.latest?.find((item) => item.id === note.id)?.previewText;
    if (!text || text === NO_PREVIEW) return undefined;
    // Most notes open with their title as an H1; skip it so the snippet adds information.
    const title = (note.title || "").trim();
    const body = title && text.startsWith(title) ? text.slice(title.length).trim() : text;
    return body || undefined;
  };

  createEffect(
    on(
      () => [props.path, params.query(), params.sort(), grouped()],
      () => {
        setActiveIndex(-1);
        setLimit(PAGE_SIZE);
      },
      { defer: true },
    ),
  );

  const scrollActiveIntoView = (index: number) => {
    const note = visible()[index];
    if (!note) return;
    document
      .querySelector(`[data-note-id="${note.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  usePathKeyboard({
    hasActive: () => activeIndex() >= 0,
    move: (delta) => {
      const count = visible().length;
      if (count === 0) return;
      const current = activeIndex();
      const next =
        current < 0 ? (delta > 0 ? 0 : count - 1) : Math.max(0, Math.min(count - 1, current + delta));
      setActiveIndex(next);
      scrollActiveIntoView(next);
    },
    open: (newTab) => {
      const note = visible()[activeIndex()];
      if (!note) return;
      if (newTab) window.open(`/docs/${note.id}`, "_blank");
      else navigate(`/docs/${note.id}`);
    },
    focusFilter: () => filterInput?.focus(),
    createNote: () => props.onCreateNote?.(),
  });

  return (
    <section
      class={css({ display: "flex", flexDirection: "column", gap: "2", p: "0", containerType: "inline-size" })}
      onMouseMove={onListMouseMove}
    >
      <PathNoteToolbar
        query={params.query()}
        onQueryChange={params.setQuery}
        sort={params.sort()}
        onSortChange={params.setSort}
        grouped={grouped()}
        onGroupedChange={params.setGrouped}
        canGroup={hasNestedNotes()}
        shown={ordered().length}
        total={props.notes.length}
        inputRef={(el) => (filterInput = el)}
      />
      <Show
        when={ordered().length > 0}
        fallback={
          <div class={css({ display: "flex", alignItems: "center", gap: "3", py: "6", fontSize: "sm", color: "fg.muted" })}>
            <span>
              No notes match <span class={css({ color: "fg.default" })}>“{params.query().trim()}”</span>
            </span>
            <Button size="xs" variant="outline" onClick={() => params.setQuery("")}>
              Clear filter
            </Button>
          </div>
        }
      >
        <For each={sections()}>
          {(section) => (
            <div>
              <Show when={grouped()}>
                <h3 class={groupHeaderClass}>
                  <Show
                    when={section.groupPath}
                    fallback={<span class={css({ fontWeight: "semibold", color: "fg.default" })}>Filed here</span>}
                  >
                    <A href={pathToRoute(section.groupPath)} class={groupLinkClass}>
                      {relativeNotePath(section.groupPath, props.path)}
                    </A>
                  </Show>
                  <span class={css({ fontVariantNumeric: "tabular-nums" })}>
                    {groupTotals().get(section.groupPath) ?? section.notes.length}
                  </span>
                </h3>
              </Show>
              <ul class={css({ listStyle: "none" })}>
                <For each={section.notes}>
                  {(note) => (
                    <PathNoteRow
                      note={note}
                      basePath={grouped() ? section.groupPath || props.path : props.path}
                      query={params.query().trim()}
                      active={indexById().get(note.id) === activeIndex()}
                      showSubpath={hasNestedNotes()}
                      preview={() => previewFor(note)}
                    />
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>
        <Show when={ordered().length > visible().length}>
          <Button
            size="sm"
            variant="outline"
            alignSelf="flex-start"
            mt="2"
            onClick={() => setLimit((value) => value + PAGE_SIZE * 4)}
          >
            Show {Math.min(PAGE_SIZE * 4, ordered().length - visible().length)} more
          </Button>
        </Show>
      </Show>
    </section>
  );
};
