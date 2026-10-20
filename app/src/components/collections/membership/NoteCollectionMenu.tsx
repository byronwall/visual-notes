import { revalidate, useAction } from "@solidjs/router";
import {
  ArrowRightLeftIcon,
  ChevronDownIcon,
  DatabaseIcon,
  UnlinkIcon,
} from "lucide-solid";
import { For, Show, createResource, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Button } from "~/components/ui/button";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { SimplePopover } from "~/components/ui/simple-popover";
import { useToasts } from "~/components/Toast";
import {
  addNotesToCollection,
  moveNoteToCollection,
  previewMoveNote,
  removeNoteFromCollection,
} from "~/services/collections/collections.membership";
import {
  fetchCollections,
  fetchDocCollection,
} from "~/services/collections/collections.queries";
import { MenuItem, menuPanel, menuSection } from "../menu/MenuList";
import { bumpDocCollection } from "./docCollectionVersion";
import { fitContent } from "../popover-styles";

const list = css({
  display: "flex",
  flexDirection: "column",
  maxH: "18rem",
  overflowY: "auto",
});
const crumbBtn = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxSize: "5",
  borderRadius: "l1",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});

const refresh = async (docId: string) => {
  await revalidate(fetchDocCollection.keyFor(docId));
  bumpDocCollection();
};

/** Note-page menu next to the collection breadcrumb: move or remove. */
export const NoteCollectionMenu = (props: {
  docId: string;
  collectionId: string;
  collectionName: string;
}) => {
  const runMove = useAction(moveNoteToCollection);
  const runRemove = useAction(removeNoteFromCollection);
  const { show } = useToasts();
  const [open, setOpen] = createSignal(false);
  const [target, setTarget] = createSignal<{ id: string; name: string } | null>(
    null,
  );
  const [collections] = createResource(
    () => (open() ? true : false),
    () => fetchCollections(),
  );
  const [preview] = createResource(
    () =>
      target()
        ? { docId: props.docId, targetCollectionId: target()!.id }
        : false,
    (args) => previewMoveNote(args),
  );

  const describe = () => {
    const p = preview.latest;
    if (!p) return "Checking which values carry over…";
    const carried = p.carried.length
      ? `Carries ${p.carried.join(", ")}.`
      : "No values carry over.";
    const dropped = p.dropped.length ? ` Drops ${p.dropped.join(", ")}.` : "";
    return `${carried}${dropped} Note content is unchanged.`;
  };

  return (
    <>
      <SimplePopover
        class={fitContent}
        open={open()}
        onClose={() => setOpen(false)}
        anchor={
          <button
            type="button"
            class={crumbBtn}
            aria-label="Collection options"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDownIcon size={12} />
          </button>
        }
      >
        <div class={menuPanel} style={{ width: "16rem" }}>
          <div class={menuSection}>Move to</div>
          <div class={list}>
            <For
              each={(collections.latest ?? []).filter(
                (c) => c.id !== props.collectionId,
              )}
            >
              {(c) => (
                <MenuItem
                  icon={<ArrowRightLeftIcon size={14} />}
                  onClick={() => {
                    setOpen(false);
                    setTarget({ id: c.id, name: c.name });
                  }}
                >
                  {c.name}
                </MenuItem>
              )}
            </For>
          </div>
          <MenuItem
            icon={<UnlinkIcon size={14} />}
            onClick={async () => {
              setOpen(false);
              try {
                await runRemove(props.docId);
                await refresh(props.docId);
                show({
                  title: `Removed from ${props.collectionName}`,
                  message: "The note's values come back if you add it again.",
                  type: "info",
                });
              } catch (error) {
                show({
                  title: "Couldn't remove the note",
                  message: String((error as Error).message ?? error),
                  type: "error",
                });
              }
            }}
          >
            Remove from collection
          </MenuItem>
        </div>
      </SimplePopover>
      <ConfirmDialog
        open={target() !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Move to ${target()?.name ?? ""}?`}
        description={describe()}
        confirmLabel="Move note"
        cancelLabel="Cancel"
        onConfirm={async () => {
          const t = target();
          setTarget(null);
          if (!t) return;
          try {
            await runMove({ docId: props.docId, targetCollectionId: t.id });
            await refresh(props.docId);
          } catch (error) {
            show({
              title: "Couldn't move the note",
              message: String((error as Error).message ?? error),
              type: "error",
            });
          }
        }}
      />
    </>
  );
};

/** "Add to collection" for a note that isn't in one. */
export const AddToCollectionDialog = (props: {
  open: boolean;
  docId: string;
  onClose: () => void;
}) => {
  const run = useAction(addNotesToCollection);
  const { show } = useToasts();
  const [collections] = createResource(
    () => (props.open ? true : false),
    () => fetchCollections(),
  );
  return (
    <SimpleDialog
      open={props.open}
      onClose={props.onClose}
      title="Add to collection"
      description="The note becomes a row. Meta keys that match property names fill those properties."
      maxW="28rem"
      footer={
        <Button size="sm" variant="outline" onClick={() => props.onClose()}>
          Cancel
        </Button>
      }
    >
      <div class={list}>
        <For
          each={collections.latest ?? []}
          fallback={
            <span style={{ "font-size": "13px" }}>No collections yet.</span>
          }
        >
          {(c) => (
            <MenuItem
              icon={
                <Show when={c.icon} fallback={<DatabaseIcon size={14} />}>
                  {c.icon}
                </Show>
              }
              trailing={`${c.rowCount}`}
              onClick={async () => {
                try {
                  await run({ collectionId: c.id, docIds: [props.docId] });
                  await refresh(props.docId);
                  props.onClose();
                } catch (error) {
                  show({
                    title: "Couldn't add the note",
                    message: String((error as Error).message ?? error),
                    type: "error",
                  });
                }
              }}
            >
              {c.name}
            </MenuItem>
          )}
        </For>
      </div>
    </SimpleDialog>
  );
};
