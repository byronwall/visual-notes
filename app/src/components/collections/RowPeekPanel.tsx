import { Show, createEffect, createSignal, on } from "solid-js";
import { DocumentSidePanel } from "~/components/DocumentSidePanel";
import type { DocumentEditorApi } from "~/components/DocumentEditor";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useCollection } from "./CollectionContext";
import { PropertyList } from "./PropertyList";
import type { CollectionRow } from "~/lib/collections/types";
import { isCoarsePointer } from "./touch";
import { fetchDoc } from "~/services/docs.service";
import { RecordNavBar, RecordNavInline } from "./detail/RecordNav";
import { OutOfViewNotice, RecordPreview } from "./detail/RecordPreview";
import { useRecordGestures } from "./detail/useRecordGestures";
import { useRecordPosition } from "./detail/useRecordPosition";

// How long a move waits for its save before it asks. A working network lands
// well inside this, so a normal close never shows the prompt.
const SAVE_GRACE_MS = 400;

/** Puts focus back on the row's title cell, if the view still renders it. */
const returnFocus = (rowId: string) =>
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        `[data-row-id="${CSS.escape(rowId)}"] [data-property-id="title"]`,
      )
      ?.focus({ preventScroll: true }),
  );

/**
 * Side panel for one row: its properties above the full note editor. The host
 * owns which row is open. Before the panel asks the host to move or close, it
 * gives the note's save a moment to land.
 */
export const RowPeekPanel = (props: {
  rowId: string | null;
  onClose: () => void;
  /** Opens another row in place. */
  onMove?: (rowId: string) => void;
  /**
   * The host moves by router navigation. The editor's own leave guard then
   * asks before unsaved text is lost, on these moves and on browser Back.
   */
  routed?: boolean;
  /** Row ids in the active view's order (filter, sort, search): Previous/Next. */
  order?: () => readonly string[];
}) => {
  const { store, embedded } = useCollection();
  const [editor, setEditor] = createSignal<{
    id: string;
    api: DocumentEditorApi;
  }>();
  // A move that waits on the "Leave without saving?" prompt.
  const [pending, setPending] = createSignal<{ id: string | null }>();
  const row = () => store.state.rows.find((r) => r.id === props.rowId);

  const commit = (id: string | null) => {
    setPending(undefined);
    if (id) props.onMove?.(id);
    else props.onClose();
  };

  // True when nothing unsaved is at risk. Leaving unmounts the editor, which
  // cancels its autosave and retries.
  const settle = async () => {
    const api = editor()?.api;
    if (!api?.dirty()) return true;
    if (!api.error()) {
      await Promise.race([
        api.save(),
        new Promise((done) => setTimeout(done, SAVE_GRACE_MS)),
      ]);
      if (!api.dirty()) return true;
    }
    return false;
  };

  let ticket = 0;
  const go = async (id: string | null) => {
    if (pending() || id === props.rowId) return;
    const mine = ++ticket;
    const safe = await settle();
    // A later move won while this one saved.
    if (mine !== ticket) return;
    if (safe || props.routed) commit(id);
    else setPending({ id });
  };

  const pos = useRecordPosition(
    () => props.rowId,
    () => props.order?.() ?? [],
  );
  const step = (id: string | undefined) => id && void go(id);
  const prev = () => step(pos.prevId());
  const next = () => step(pos.nextId());
  useRecordGestures({
    active: () => Boolean(props.order && props.rowId) && !pending(),
    prev,
    next,
  });

  // Load the neighbors ahead, so the next record's note is ready when asked.
  // Reading the query here also keeps its cached entry alive while open.
  createEffect(() => {
    if (!props.order || !props.rowId) return;
    for (const id of [pos.prevId(), pos.nextId()])
      if (id) void fetchDoc(id).catch(() => undefined);
  });

  const outOfView = () => Boolean(props.order && props.rowId) && !pos.inView();
  const properties = (r: CollectionRow) => (
    <>
      <Show when={outOfView()}>
        <OutOfViewNotice />
      </Show>
      <PropertyList row={r} allowSchemaEdits={!embedded} />
    </>
  );
  const nav = (Nav: typeof RecordNavBar) => (
    <Show when={props.order}>
      <Nav
        label={pos.label()}
        onPrev={pos.prevId() ? prev : undefined}
        onNext={pos.nextId() ? next : undefined}
      />
    </Show>
  );

  // Every row change, whatever started it: refresh the previews of the row
  // that was open, and on close put focus back where the user left the view.
  createEffect(
    on(
      () => props.rowId,
      (id, left) => {
        if (!left) return;
        store.bumpContent();
        if (!id) returnFocus(left);
      },
      { defer: true },
    ),
  );

  // A save can land while the prompt is open. Nothing is at risk any more, so
  // finish the move the user asked for.
  createEffect(() => {
    const move = pending();
    if (move && !editor()?.api.dirty()) commit(move.id);
  });

  // A new row opens with its name ready to type, as the table does. The title
  // field offers no focus API, so this presses its hidden edit trigger. Touch
  // skips it: focus there opens the keyboard over the record.
  createEffect(
    on(
      () => editor()?.id,
      (id) => {
        if (!id || row()?.title !== "Untitled" || isCoarsePointer()) return;
        document
          .querySelector<HTMLElement>(
            '[data-side-panel-scroll] [data-scope="editable"][data-part="edit-trigger"]',
          )
          ?.click();
      },
    ),
  );

  return (
    <>
      <DocumentSidePanel
        open={Boolean(props.rowId)}
        docId={props.rowId ?? undefined}
        onClose={() => void go(null)}
        width="min(720px, 100vw)"
        onDeleted={(docId) => {
          store.replaceRows(store.state.rows.filter((r) => r.id !== docId));
          props.onClose();
        }}
        // A reopen can mount the next editor before the closing panel lets go
        // of the last one. So only the editor that left clears the slot.
        onEditorApiChange={(id, api, gone) =>
          setEditor((current) =>
            api ? { id, api } : current?.api === gone ? undefined : current,
          )
        }
        onTitleChange={(docId, title) => store.applyLocalTitle(docId, title)}
        header={
          <Show when={row()} keyed>
            {(r) => properties(r)}
          </Show>
        }
        preview={(docId) => (
          <Show when={store.state.rows.find((r) => r.id === docId)} keyed>
            {(r) => (
              <RecordPreview name={r.title}>{properties(r)}</RecordPreview>
            )}
          </Show>
        )}
        nav={nav(RecordNavInline)}
        footer={nav(RecordNavBar)}
      />
      {/* Mounted on demand so its portal lands above the panel's. */}
      <Show when={pending()}>
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(undefined)}
          title={
            editor()?.api.error()
              ? "This note didn't save"
              : "Leave without saving?"
          }
          description={
            editor()?.api.error()
              ? "Your latest changes aren't saved. If you stay, this note keeps retrying. If you leave now, they will be lost."
              : "You have unsaved changes. If you leave now, they will be lost."
          }
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={() => commit(pending()?.id ?? null)}
        />
      </Show>
    </>
  );
};
