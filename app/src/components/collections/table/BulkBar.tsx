import {
  ChevronLeftIcon,
  PencilIcon,
  Trash2Icon,
  UnlinkIcon,
  XIcon,
} from "lucide-solid";
import { For, Match, Show, Switch, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { SimplePopover } from "~/components/ui/simple-popover";
import type {
  CollectionProperty,
  DateValue,
  PropertyValue,
} from "~/lib/collections/types";
import { isComputedKind, parseLooseText } from "~/lib/collections/values";
import { useCollection } from "../CollectionContext";
import { PropertyKindIcon } from "../PropertyKindIcon";
import { MenuItem, menuInput, menuPanel, menuSection } from "../menu/MenuList";
import { DateEditor } from "../values/DateEditor";
import { OptionPicker } from "../values/OptionPicker";
import { RatingStars } from "../values/RatingStars";
import { fitContent } from "../popover-styles";
import { noAutofill } from "~/components/ui/no-autofill";

// Overlays the toolbar row above the table so selecting never shifts rows.
const bar = css({
  position: "absolute",
  left: "0",
  right: "0",
  bottom: "calc(100% + 2px)",
  zIndex: "5",
  display: "flex",
  alignItems: "center",
  gap: "1",
  h: "9",
  px: "2",
  borderRadius: "l2",
  bg: "blue.3",
  color: "blue.12",
  fontSize: "sm",
});
const btn = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1.5",
  h: "7",
  px: "2",
  borderRadius: "l1",
  cursor: "pointer",
  _hover: { bg: "blue.a4" },
  "&[data-danger]": { color: "fg.error" },
});
const count = css({ fontWeight: "semibold", mr: "2" });
const applyRow = css({ display: "flex", gap: "2", px: "2", pb: "2" });
const applyBtn = css({
  h: "7",
  px: "2.5",
  borderRadius: "l1",
  bg: "fg.default",
  color: "bg.default",
  fontSize: "xs",
  cursor: "pointer",
});

/** One value editor that applies to every selected row at once. */
const BulkValueEditor = (props: {
  property: CollectionProperty;
  onApply: (value: PropertyValue) => void;
  onDone: () => void;
}) => {
  const { store } = useCollection();
  const [draft, setDraft] = createSignal("");
  const [pick, setPick] = createSignal<string | string[] | null>(null);
  return (
    <Switch
      fallback={
        <div>
          <input
            {...noAutofill}
            class={menuInput}
            style={{ width: "calc(100% - 1rem)" }}
            placeholder={`New ${props.property.name.toLowerCase()} (blank clears)`}
            value={draft()}
            ref={(el) => queueMicrotask(() => el.focus())}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                props.onApply(parseLooseText(props.property, draft()).value);
                props.onDone();
              }
            }}
          />
          <div class={applyRow}>
            <button
              type="button"
              class={applyBtn}
              onClick={() => {
                props.onApply(parseLooseText(props.property, draft()).value);
                props.onDone();
              }}
            >
              Apply
            </button>
          </div>
        </div>
      }
    >
      <Match when={props.property.kind === "checkbox"}>
        <MenuItem
          onClick={() => {
            props.onApply(true);
            props.onDone();
          }}
        >
          Check all
        </MenuItem>
        <MenuItem
          onClick={() => {
            props.onApply(null);
            props.onDone();
          }}
        >
          Uncheck all
        </MenuItem>
      </Match>
      <Match
        when={
          props.property.kind === "number" &&
          props.property.config.format === "rating"
        }
      >
        <div style={{ padding: "0.5rem 0.75rem" }}>
          <RatingStars
            value={0}
            max={props.property.config.ratingMax ?? 5}
            onChange={(n) => {
              props.onApply(n);
              props.onDone();
            }}
          />
        </div>
      </Match>
      <Match when={props.property.kind === "date"}>
        <DateEditor
          value={null}
          includeTime={Boolean(props.property.config.includeTime)}
          onChange={(v: DateValue | null) => props.onApply(v)}
          onDone={props.onDone}
        />
      </Match>
      <Match
        when={["select", "status", "multi_select"].includes(
          props.property.kind,
        )}
      >
        <OptionPicker
          property={props.property}
          value={pick()}
          onChange={(v) => {
            setPick(v);
            props.onApply(v);
            if (props.property.kind !== "multi_select") props.onDone();
          }}
          onCreate={(name) => store.createOption(props.property.id, name)}
          onDone={props.onDone}
        />
      </Match>
    </Switch>
  );
};

/** Actions for the selected rows: set a property, remove, or delete. */
export const BulkBar = (props: { selected: string[]; onClear: () => void }) => {
  const { store } = useCollection();
  const [open, setOpen] = createSignal(false);
  const [property, setProperty] = createSignal<CollectionProperty | null>(null);
  const [confirm, setConfirm] = createSignal<"delete" | "remove" | null>(null);
  const editable = () =>
    store.state.properties.filter((p) => !isComputedKind(p.kind));
  const close = () => {
    setOpen(false);
    setProperty(null);
  };

  return (
    <div class={bar} role="toolbar" aria-label="Selected rows">
      <span class={count}>{props.selected.length} selected</span>
      <SimplePopover
        class={fitContent}
        open={open()}
        onClose={close}
        anchor={
          <button type="button" class={btn} onClick={() => setOpen((v) => !v)}>
            <PencilIcon size={13} /> Set property
          </button>
        }
      >
        <div class={menuPanel} style={{ width: "17rem" }}>
          <Show
            when={property()}
            fallback={
              <>
                <div class={menuSection}>
                  Set a value on {props.selected.length} rows
                </div>
                <For each={editable()}>
                  {(p) => (
                    <MenuItem
                      icon={<PropertyKindIcon property={p} />}
                      onClick={() => setProperty(p)}
                    >
                      {p.name}
                    </MenuItem>
                  )}
                </For>
              </>
            }
          >
            {(p) => (
              <>
                <MenuItem
                  icon={<ChevronLeftIcon size={14} />}
                  onClick={() => setProperty(null)}
                >
                  {p().name}
                </MenuItem>
                <BulkValueEditor
                  property={p()}
                  onApply={(value) =>
                    void store.setValues(props.selected, { [p().id]: value })
                  }
                  onDone={close}
                />
              </>
            )}
          </Show>
        </div>
      </SimplePopover>
      <button type="button" class={btn} onClick={() => setConfirm("remove")}>
        <UnlinkIcon size={13} /> Remove from collection
      </button>
      <button
        type="button"
        class={btn}
        data-danger
        onClick={() => setConfirm("delete")}
      >
        <Trash2Icon size={13} /> Delete
      </button>
      <button
        type="button"
        class={btn}
        style={{ "margin-left": "auto" }}
        aria-label="Clear selection"
        onClick={() => props.onClear()}
      >
        <XIcon size={13} />
      </button>
      <ConfirmDialog
        open={confirm() !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm() === "delete"
            ? `Delete ${props.selected.length} notes?`
            : `Remove ${props.selected.length} notes from this collection?`
        }
        description={
          confirm() === "delete"
            ? "Each row is a note. Deleting removes the notes and their content."
            : "The notes stay in your notes list. Their values come back if you add them again."
        }
        confirmLabel={confirm() === "delete" ? "Delete notes" : "Remove"}
        cancelLabel="Cancel"
        destructive={confirm() === "delete"}
        onConfirm={() => {
          const ids = [...props.selected];
          if (confirm() === "delete") void store.deleteRows(ids);
          else void store.removeRows(ids);
          setConfirm(null);
          props.onClear();
        }}
      />
    </div>
  );
};
