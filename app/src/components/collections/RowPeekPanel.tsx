import { Show } from "solid-js";
import { DocumentSidePanel } from "~/components/DocumentSidePanel";
import { useCollection } from "./CollectionContext";
import { PropertyList } from "./PropertyList";

/** Side panel for one row: its properties above the full note editor. */
export const RowPeekPanel = (props: {
  rowId: string | null;
  onClose: () => void;
}) => {
  const { store, embedded } = useCollection();
  const row = () => store.state.rows.find((r) => r.id === props.rowId);
  return (
    <DocumentSidePanel
      open={Boolean(props.rowId)}
      docId={props.rowId ?? undefined}
      onClose={props.onClose}
      width="min(720px, 100vw)"
      onDeleted={(docId) => {
        store.replaceRows(store.state.rows.filter((r) => r.id !== docId));
        props.onClose();
      }}
      onTitleChange={(docId, title) => store.applyLocalTitle(docId, title)}
      header={
        <Show when={row()} keyed>
          {(r) => <PropertyList row={r} allowAdd={!embedded} />}
        </Show>
      }
    />
  );
};
