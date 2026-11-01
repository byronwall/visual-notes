import { useAction, useNavigate } from "@solidjs/router";
import {
  CheckIcon,
  EllipsisIcon,
  FilePlusIcon,
  HistoryIcon,
  Trash2Icon,
} from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { SimplePopover } from "~/components/ui/simple-popover";
import { useToasts } from "~/components/Toast";
import { deleteCollection } from "~/services/collections/collections.actions";
import { useCollection } from "../CollectionContext";
import { MenuItem, menuPanel, menuSeparator } from "../menu/MenuList";
import { fitContent } from "../popover-styles";
import { AddNotesDialog } from "./AddNotesDialog";

const bar = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  ml: "auto",
});
const btn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "8",
  px: "2.5",
  borderRadius: "l2",
  fontSize: "sm",
  color: "fg.muted",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});

/**
 * Page-level collection actions: add existing notes, always list rows in
 * Recent and on the notes index, delete the collection.
 */
export const CollectionActions = () => {
  const { store } = useCollection();
  const navigate = useNavigate();
  const runDelete = useAction(deleteCollection);
  const { show } = useToasts();
  const [adding, setAdding] = createSignal(false);
  const [menu, setMenu] = createSignal(false);
  const [confirm, setConfirm] = createSignal(false);

  return (
    <div class={bar}>
      <button type="button" class={btn} onClick={() => setAdding(true)}>
        <FilePlusIcon size={14} /> Add notes
      </button>
      <SimplePopover
        class={fitContent}
        open={menu()}
        onClose={() => setMenu(false)}
        placement="bottom-end"
        anchor={
          <button
            type="button"
            class={btn}
            aria-label="Collection actions"
            onClick={() => setMenu((v) => !v)}
          >
            <EllipsisIcon size={16} />
          </button>
        }
      >
        <div class={menuPanel}>
          <MenuItem
            icon={<HistoryIcon size={14} />}
            aria-pressed={store.state.collection.showRowsInRecent}
            trailing={
              <Show when={store.state.collection.showRowsInRecent}>
                <CheckIcon size={14} />
              </Show>
            }
            onClick={() =>
              void store.setShowRowsInRecent(
                !store.state.collection.showRowsInRecent,
              )
            }
          >
            Always show rows in Notes and Recent
          </MenuItem>
          <div class={menuSeparator} />
          <MenuItem
            danger
            icon={<Trash2Icon size={14} />}
            onClick={() => {
              setMenu(false);
              setConfirm(true);
            }}
          >
            Delete collection…
          </MenuItem>
        </div>
      </SimplePopover>
      <AddNotesDialog open={adding()} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={confirm()}
        onOpenChange={setConfirm}
        title={`Delete "${store.state.collection.name}"?`}
        description={`Its ${store.state.rows.length} rows become plain notes. No note content is deleted.`}
        confirmLabel="Delete collection"
        cancelLabel="Cancel"
        destructive
        onConfirm={async () => {
          try {
            await runDelete(store.state.collection.id);
            navigate("/collections");
          } catch (error) {
            show({
              title: "Couldn't delete the collection",
              message: String((error as Error).message ?? error),
              type: "error",
            });
          }
        }}
      />
    </div>
  );
};
