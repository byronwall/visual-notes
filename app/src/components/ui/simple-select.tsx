import {
  Accessor,
  For,
  Show,
  createMemo,
  createSignal,
  onMount,
  type ComponentProps,
} from "solid-js";
import type { SelectRootProps } from "@ark-ui/solid/select";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
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
  const [isHydrated, setIsHydrated] = createSignal(false);
  onMount(() => setIsHydrated(true));

  const collection = createMemo(() =>
    Select.createListCollection<SimpleSelectItem>({ items: props.items })
  );

  const positioning: Accessor<
    SelectRootProps<SimpleSelectItem>["positioning"]
  > = () => {
    if (props.positioning) return props.positioning;
    if (props.sameWidth === false) return { placement: "bottom-start" };
    return { placement: "bottom-start", sameWidth: true };
  };

  const inlineLabel = () =>
    props.labelPlacement === "inline" ? props.label : undefined;

  const renderControl = () => (
    <Select.Control>
      <Select.Trigger minW={props.minW}>
        <Select.ValueText placeholder={props.placeholder} />
        <Select.Indicator />
      </Select.Trigger>
    </Select.Control>
  );

  const shouldPortal = () => props.skipPortal === false && isHydrated();
  const shouldRenderPositioner = () =>
    props.skipPortal !== false || isHydrated();

  return (
    <Select.Root
      collection={collection()}
      ids={props.triggerId ? { trigger: props.triggerId } : undefined}
      value={props.value ? [props.value] : []}
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
      <Show when={shouldRenderPositioner()}>
        <WrapWhen when={shouldPortal()} component={Portal}>
          <Select.Positioner zIndex="popover">
            <Select.Content class={contentClass} zIndex="popover">
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
      </Show>
      <Select.HiddenSelect />
    </Select.Root>
  );
}

const contentClass = css({
  maxH: "72",
});
