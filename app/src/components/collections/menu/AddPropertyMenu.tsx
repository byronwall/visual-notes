import { PlusIcon } from "lucide-solid";
import { For, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { SimplePopover } from "~/components/ui/simple-popover";
import type { CollectionProperty } from "~/lib/collections/types";
import { useCollection } from "../CollectionContext";
import { PropertyKindIcon } from "../PropertyKindIcon";
import { MenuItem, menuInput, menuPanel, menuSection } from "./MenuList";
import { PROPERTY_PRESETS } from "./propertyPresets";
import { fitContent } from "../popover-styles";

const trigger = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  h: "full",
  minH: "8",
  w: "full",
  color: "fg.subtle",
  cursor: "pointer",
  _hover: { bg: "bg.muted", color: "fg.default" },
});
const grid = css({ display: "grid", gridTemplateColumns: "1fr 1fr", px: "1" });

/** "+" button that adds a property of a chosen kind or format. */
export const AddPropertyMenu = (props: {
  onAdded?: (property: CollectionProperty) => void;
  label?: string;
  class?: string;
}) => {
  const { store } = useCollection();
  const [open, setOpen] = createSignal(false);
  const [name, setName] = createSignal("");

  const add = async (key: string) => {
    const preset = PROPERTY_PRESETS.find((p) => p.key === key)!;
    const taken = new Set(
      store.state.properties.map((p) => p.name.toLowerCase()),
    );
    let finalName = name().trim() || preset.label;
    for (let i = 2; taken.has(finalName.toLowerCase()); i++)
      finalName = `${name().trim() || preset.label} ${i}`;
    setOpen(false);
    setName("");
    const created = await store.addProperty(
      preset.kind,
      finalName,
      preset.config,
    );
    if (created) props.onAdded?.(created);
  };

  return (
    <SimplePopover
      class={fitContent}
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={4}
      anchor={
        <button
          type="button"
          class={props.class ?? trigger}
          aria-label="Add property"
          onClick={() => setOpen((v) => !v)}
        >
          <PlusIcon size={14} />
          {props.label}
        </button>
      }
    >
      <div class={menuPanel} style={{ width: "22rem" }}>
        <input
          class={menuInput}
          placeholder="Property name"
          aria-label="New property name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          ref={(el) => queueMicrotask(() => el.focus())}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add("text");
          }}
        />
        <div class={menuSection}>Type</div>
        <div class={grid}>
          <For each={PROPERTY_PRESETS}>
            {(preset) => (
              <MenuItem
                icon={
                  <PropertyKindIcon
                    property={{
                      id: preset.key,
                      kind: preset.kind,
                      config: preset.config ?? {},
                    }}
                  />
                }
                onClick={() => void add(preset.key)}
              >
                {preset.label}
              </MenuItem>
            )}
          </For>
        </div>
      </div>
    </SimplePopover>
  );
};
