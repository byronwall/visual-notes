import { Accessor, For, Show, createMemo, type ComponentProps } from "solid-js";
import type { SelectRootProps } from "@ark-ui/solid/select";
import { Portal } from "solid-js/web";
import { HStack } from "styled-system/jsx";
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
  label?: string;
  labelPlacement?: "stacked" | "inline";
  labelProps?: Omit<ComponentProps<typeof Select.Label>, "children">;
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

  const inlineLabel = () =>
    props.labelPlacement === "inline" ? props.label : undefined;

  const renderControl = () => (
    <Select.Control>
      <Select.Trigger id={props.triggerId} minW={props.minW}>
        <Select.ValueText placeholder={props.placeholder} />
        <Select.Indicator />
      </Select.Trigger>
    </Select.Control>
  );

  return (
    <Select.Root
      collection={collection()}
      value={[props.value ?? ""]}
      onValueChange={(details) => props.onChange(details.value[0] || "")}
      size={props.size}
      positioning={positioning()}
    >
      <Show
        when={inlineLabel()}
        fallback={
          <>
            <Show when={props.label}>
              {(label) => (
                <Select.Label {...props.labelProps}>{label()}</Select.Label>
              )}
            </Show>
            {renderControl()}
          </>
        }
      >
        {(label) => (
          <HStack gap="2" alignItems="center">
            <Select.Label {...props.labelProps}>{label()}</Select.Label>
            {renderControl()}
          </HStack>
        )}
      </Show>
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
