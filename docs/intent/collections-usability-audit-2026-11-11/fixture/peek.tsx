import { Show } from "solid-js";
import { SidePanel } from "~/components/SidePanel";
import { PropertyList } from "~/components/collections/PropertyList";
import { useCollection } from "~/components/collections/CollectionContext";
export function RowPeekPanel(props: any) {
  const { store } = useCollection();
  return (
    <SidePanel
      open={!!props.rowId}
      onClose={props.onClose}
      width="min(720px, 100vw)"
      ariaLabel="Fixture property panel"
    >
      <div style={{ padding: "20px" }}>
        <button onClick={props.onClose}>Close fixture panel</button>
        <p style={{ "font-size": "12px", "margin-bottom": "20px" }}>
          ISOLATED PROPERTY LIST · note editor not mounted
        </p>
        <Show when={store.state.rows.find((r) => r.id === props.rowId)}>
          {(r) => (
            <>
              <h1>{r().title}</h1>
              <PropertyList row={r()} allowSchemaEdits />
            </>
          )}
        </Show>
      </div>
    </SidePanel>
  );
}
