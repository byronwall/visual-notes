import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CheckIcon,
  EyeOffIcon,
  Trash2Icon,
} from "lucide-solid";
import { For, type JSX, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { SimplePopover } from "~/components/ui/simple-popover";
import type {
  CollectionProperty,
  NumberFormat,
  TextFormat,
} from "~/lib/collections/types";
import { TITLE_PROPERTY_ID } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { KIND_LABELS } from "../PropertyKindIcon";
import { ChangeKindMenu } from "./ChangeKindMenu";
import {
  MenuItem,
  menuInput,
  menuPanel,
  menuSection,
  menuSeparator,
} from "./MenuList";
import { NUMBER_FORMAT_LABELS, TEXT_FORMAT_LABELS } from "./propertyPresets";
import { OptionsEditor } from "./OptionsEditor";
import { fitContent } from "../popover-styles";
import { noAutofill } from "~/components/ui/no-autofill";

const scroll = css({ maxH: "min(70vh, 34rem)", overflowY: "auto" });

/** Column header menu: rename, format, options, sort, hide, change type, delete. */
export const PropertyMenu = (props: {
  property: CollectionProperty;
  viewId?: string;
  anchor: (open: () => void) => JSX.Element;
}) => {
  const { store } = useCollection();
  const [open, setOpen] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const isTitle = () => props.property.id === TITLE_PROPERTY_ID;
  const view = () => store.view(props.viewId);

  const rename = (name: string) => {
    const next = name.trim();
    if (!next || next === props.property.name || isTitle()) return;
    void store.updateProperty(props.property.id, { name: next });
  };
  const setConfig = (patch: Partial<CollectionProperty["config"]>) =>
    void store.updateProperty(props.property.id, {
      config: { ...props.property.config, ...patch },
    });

  const sortBy = (direction: "asc" | "desc") => {
    const v = view();
    if (!v) return;
    const others = (v.config.sorts ?? []).filter(
      (s) => s.propertyId !== props.property.id,
    );
    store.patchViewConfig(v.id, {
      sorts: [{ propertyId: props.property.id, direction }, ...others],
    });
    setOpen(false);
  };
  const hide = () => {
    const v = view();
    if (!v) return;
    store.patchViewConfig(v.id, {
      hiddenProperties: [
        ...(v.config.hiddenProperties ?? []),
        props.property.id,
      ],
    });
    setOpen(false);
  };

  return (
    <>
      <SimplePopover
        class={fitContent}
        open={open()}
        onClose={() => setOpen(false)}
        placement="bottom-start"
        offset={2}
        anchor={props.anchor(() => setOpen(true))}
        anchorClass={css({ minW: "0", flex: "1", display: "flex", h: "full" })}
      >
        <div class={`${menuPanel} ${scroll}`} style={{ width: "17rem" }}>
          <Show
            when={!isTitle()}
            fallback={<div class={menuSection}>Name (the note title)</div>}
          >
            <input
              {...noAutofill}
              class={menuInput}
              value={props.property.name}
              aria-label="Property name"
              onChange={(e) => rename(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  rename(e.currentTarget.value);
                  setOpen(false);
                }
              }}
            />
            <ChangeKindMenu
              property={props.property}
              onChanged={() => setOpen(false)}
            />
          </Show>

          <Show when={props.property.kind === "text" && !isTitle()}>
            <div class={menuSection}>Format</div>
            <For
              each={
                Object.entries(TEXT_FORMAT_LABELS) as [TextFormat, string][]
              }
            >
              {([format, label]) => (
                <MenuItem
                  selected={
                    (props.property.config.format ?? "plain") === format
                  }
                  trailing={
                    (props.property.config.format ?? "plain") === format ? (
                      <CheckIcon size={14} />
                    ) : undefined
                  }
                  onClick={() => setConfig({ format })}
                >
                  {label}
                </MenuItem>
              )}
            </For>
          </Show>

          <Show when={props.property.kind === "number"}>
            <div class={menuSection}>Format</div>
            <For
              each={
                Object.entries(NUMBER_FORMAT_LABELS) as [NumberFormat, string][]
              }
            >
              {([format, label]) => (
                <MenuItem
                  trailing={
                    (props.property.config.format ?? "plain") === format ? (
                      <CheckIcon size={14} />
                    ) : undefined
                  }
                  onClick={() =>
                    setConfig({
                      format,
                      ...(format === "rating"
                        ? { ratingMax: props.property.config.ratingMax ?? 5 }
                        : {}),
                    })
                  }
                >
                  {label}
                </MenuItem>
              )}
            </For>
          </Show>

          <Show when={props.property.kind === "date"}>
            <MenuItem
              trailing={
                props.property.config.includeTime ? (
                  <CheckIcon size={14} />
                ) : undefined
              }
              onClick={() =>
                setConfig({ includeTime: !props.property.config.includeTime })
              }
            >
              Include time
            </MenuItem>
          </Show>

          <Show
            when={["select", "status", "multi_select"].includes(
              props.property.kind,
            )}
          >
            <OptionsEditor property={props.property} />
          </Show>

          <Show when={view()}>
            <div class={menuSeparator} />
            <MenuItem
              icon={<ArrowUpNarrowWideIcon size={14} />}
              onClick={() => sortBy("asc")}
            >
              Sort ascending
            </MenuItem>
            <MenuItem
              icon={<ArrowDownWideNarrowIcon size={14} />}
              onClick={() => sortBy("desc")}
            >
              Sort descending
            </MenuItem>
            <Show when={!isTitle()}>
              <MenuItem icon={<EyeOffIcon size={14} />} onClick={hide}>
                Hide in view
              </MenuItem>
            </Show>
          </Show>
          <Show when={!isTitle()}>
            <div class={menuSeparator} />
            <MenuItem
              danger
              icon={<Trash2Icon size={14} />}
              onClick={() => {
                setOpen(false);
                setConfirmDelete(true);
              }}
            >
              Delete property
            </MenuItem>
          </Show>
        </div>
      </SimplePopover>
      <ConfirmDialog
        open={confirmDelete()}
        onOpenChange={setConfirmDelete}
        title={`Delete "${props.property.name}"?`}
        description={`The ${KIND_LABELS[props.property.kind].toLowerCase()} property disappears from every view. Notes are not changed.`}
        confirmLabel="Delete property"
        cancelLabel="Cancel"
        onConfirm={() => void store.deleteProperty(props.property.id)}
      />
    </>
  );
};
