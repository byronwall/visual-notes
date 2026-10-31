import { Show, createEffect, createSignal, on } from "solid-js";
import { DocumentSidePanel } from "~/components/DocumentSidePanel";
import type { DocumentEditorApi } from "~/components/DocumentEditor";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useCollection } from "./CollectionContext";
import { PropertyList } from "./PropertyList";

// How long a close waits for its save before it asks. A working network lands
// well inside this, so a normal close never shows the prompt.
const SAVE_GRACE_MS = 400;

/** Side panel for one row: its properties above the full note editor. */
export const RowPeekPanel = (props: {
  rowId: string | null;
  onClose: () => void;
}) => {
  const { store, embedded } = useCollection();
  const [editor, setEditor] = createSignal<{
    id: string;
    api: DocumentEditorApi;
  }>();
  const [guardOpen, setGuardOpen] = createSignal(false);
  const row = () => store.state.rows.find((r) => r.id === props.rowId);

  const close = () => {
    setGuardOpen(false);
    store.bumpContent();
    props.onClose();
  };

  // Closing unmounts the editor, which cancels its autosave and retries.
  const requestClose = async () => {
    const api = editor()?.api;
    if (!api?.dirty()) return close();
    if (!api.error()) {
      await Promise.race([
        api.save(),
        new Promise((done) => setTimeout(done, SAVE_GRACE_MS)),
      ]);
      if (!api.dirty()) return close();
    }
    setGuardOpen(true);
  };

  // A save can land while the prompt is open. Nothing is at risk any more, so
  // finish the close the user asked for.
  createEffect(() => {
    if (guardOpen() && !editor()?.api.dirty()) close();
  });

  // A new row opens with its name ready to type, as the table does. The title
  // field offers no focus API, so this presses its hidden edit trigger.
  createEffect(
    on(
      () => editor()?.id,
      (id) => {
        if (!id || row()?.title !== "Untitled") return;
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
        onClose={() => void requestClose()}
        width="min(720px, 100vw)"
        onDeleted={(docId) => {
          store.replaceRows(store.state.rows.filter((r) => r.id !== docId));
          props.onClose();
        }}
        onEditorApiChange={(id, api) =>
          setEditor((current) =>
            api ? { id, api } : current?.id === id ? undefined : current,
          )
        }
        onTitleChange={(docId, title) => store.applyLocalTitle(docId, title)}
        header={
          <Show when={row()} keyed>
            {(r) => <PropertyList row={r} allowSchemaEdits={!embedded} />}
          </Show>
        }
      />
      {/* Mounted on demand so its portal lands above the panel's. */}
      <Show when={guardOpen()}>
        <ConfirmDialog
          open
          onOpenChange={setGuardOpen}
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
          onConfirm={close}
        />
      </Show>
    </>
  );
};
