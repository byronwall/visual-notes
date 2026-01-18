import { Accessor, For, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import type { SelectRootProps } from "@ark-ui/solid/select";
import * as Select from "~/components/ui/select";
import { WrapWhen } from "./WrapWhen";

export type SimpleSelectItem = {
  label: string;
  value: string;
  disabled?: boolean;
};

type SimpleSelectProps = {
  items: SimpleSelectItem[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "xs" | "sm" | "md" | "lg";
  minW?: string;
  triggerId?: string;
  positioning?: SelectRootProps<SimpleSelectItem>["positioning"];
  sameWidth?: boolean;
  skipPortal?: boolean;
};

export function SimpleSelect(props: SimpleSelectProps) {
  const collection = createMemo(() =>
    Select.createListCollection<SimpleSelectItem>({ items: props.items })
  );

  const positioning: Accessor<
    SelectRootProps<SimpleSelectItem>["positioning"]
  > = () => {
    if (props.positioning) return props.positioning;
    if (props.sameWidth) return { sameWidth: true };
    return { placement: "bottom-start" };
  };

  return (
    <Select.Root
      collection={collection()}
      value={[props.value ?? ""]}
      onValueChange={(details) => props.onChange(details.value[0] || "")}
      size={props.size}
      positioning={positioning()}
    >
      <Select.Control>
        <Select.Trigger id={props.triggerId} minW={props.minW}>
          <Select.ValueText placeholder={props.placeholder} />
          <Select.Indicator />
        </Select.Trigger>
      </Select.Control>
      <WrapWhen when={props.skipPortal !== true} component={Portal}>
        <Select.Positioner>
          <Select.Content>
            <Select.List>
              <For each={collection().items}>
                {(item) => (
                  <Select.Item item={item}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                    <Select.ItemIndicator />
                  </Select.Item>
                )}
              </For>
            </Select.List>
          </Select.Content>
        </Select.Positioner>
      </WrapWhen>
      <Select.HiddenSelect />
    </Select.Root>
  );
}
