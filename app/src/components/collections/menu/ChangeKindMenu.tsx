import { useAction } from "@solidjs/router";
import { ChevronRightIcon } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { useToasts } from "~/components/Toast";
import { PROPERTY_KINDS, type CollectionProperty, type PropertyKind } from "~/lib/collections/types";
import { changePropertyKind } from "~/services/collections/collections.actions";
import { useCollection } from "../CollectionContext";
import { KIND_LABELS, PropertyKindIcon } from "../PropertyKindIcon";
import { MenuItem, menuSection } from "./MenuList";

const list = css({ display: "grid", gridTemplateColumns: "1fr 1fr", px: "1", pb: "1" });

/** "Type" row in the property menu; converting values asks for confirmation. */
export const ChangeKindMenu = (props: { property: CollectionProperty; onChanged: () => void }) => {
  const { store } = useCollection();
  const run = useAction(changePropertyKind);
  const { show } = useToasts();
  const [expanded, setExpanded] = createSignal(false);
  const [pending, setPending] = createSignal<{ kind: PropertyKind; converted: number; lost: number } | null>(null);

  const preview = async (kind: PropertyKind) => {
    if (kind === props.property.kind) return;
    try {
      const result = await run({ propertyId: props.property.id, kind, apply: false });
      if (result.converted === 0) await apply(kind);
      else setPending({ kind, converted: result.converted, lost: result.lost });
    } catch (error) {
      show({ title: "Couldn't change the type", message: String((error as Error).message ?? error), type: "error" });
    }
  };

  const apply = async (kind: PropertyKind) => {
    try {
      const result = await run({ propertyId: props.property.id, kind, apply: true });
      if (!result.applied) return;
      store.replaceProperty(result.property);
      const values = result.values;
      store.replaceRows(
        store.state.rows.map((row) => {
          if (!(row.id in values)) return row;
          const properties = { ...row.properties };
          const v = values[row.id];
          if (v === null || v === undefined) delete properties[props.property.id];
          else properties[props.property.id] = v;
          return { ...row, properties };
        }),
      );
      props.onChanged();
    } catch (error) {
      show({ title: "Couldn't change the type", message: String((error as Error).message ?? error), type: "error" });
    }
  };

  return (
    <>
      <MenuItem
        icon={<PropertyKindIcon property={props.property} />}
        trailing={<ChevronRightIcon size={14} style={{ transform: expanded() ? "rotate(90deg)" : undefined }} />}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded()}
      >
        Type: {KIND_LABELS[props.property.kind]}
      </MenuItem>
      <Show when={expanded()}>
        <div class={menuSection}>Change type to</div>
        <div class={list}>
          <For each={PROPERTY_KINDS.filter((k) => k !== props.property.kind)}>
            {(kind) => (
              <MenuItem icon={<PropertyKindIcon property={{ id: kind, kind, config: {} }} />} onClick={() => void preview(kind)}>
                {KIND_LABELS[kind]}
              </MenuItem>
            )}
          </For>
        </div>
      </Show>
      <ConfirmDialog
        open={pending() !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Change "${props.property.name}" to ${pending() ? KIND_LABELS[pending()!.kind] : ""}?`}
        description={
          pending()
            ? pending()!.lost > 0
              ? `${pending()!.converted - pending()!.lost} of ${pending()!.converted} values convert. ${pending()!.lost} can't be converted and will be cleared.`
              : `All ${pending()!.converted} values convert.`
            : ""
        }
        confirmLabel="Change type"
        cancelLabel="Cancel"
        onConfirm={() => {
          const p = pending();
          setPending(null);
          if (p) void apply(p.kind);
        }}
      />
    </>
  );
};
