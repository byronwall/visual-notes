import { ark } from "@ark-ui/solid/factory";
import {
  Select,
  createListCollection,
  useSelectItemContext,
  type SelectRootProps,
  type SelectRootProviderProps,
  type ListCollection,
} from "@ark-ui/solid/select";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-solid";
import { Show, type JSX } from "solid-js";
import { createStyleContext } from "styled-system/jsx";
import { type SelectVariantProps, select } from "styled-system/recipes";
import type { HTMLStyledProps } from "styled-system/types";

const { withProvider, withContext } = createStyleContext(select);

type StyleProps = SelectVariantProps & HTMLStyledProps<"div">;

type RootProps<T> = SelectRootProps<T> & StyleProps;
type RootProviderProps<T> = SelectRootProviderProps<T> & StyleProps;

export const Root = withProvider(Select.Root, "root") as unknown as <T>(
  props: RootProps<T>
) => JSX.Element;
export const RootProvider = withProvider(
  Select.RootProvider,
  "root"
) as unknown as <T>(props: RootProviderProps<T>) => JSX.Element;

export const ClearTrigger = withContext(Select.ClearTrigger, "clearTrigger");
export const Content = withContext(Select.Content, "content");
export const Control = withContext(Select.Control, "control");
export const IndicatorGroup = withContext(ark.div, "indicatorGroup");
export const Item = withContext(Select.Item, "item");
export const ItemGroup = withContext(Select.ItemGroup, "itemGroup");
export const ItemGroupLabel = withContext(
  Select.ItemGroupLabel,
  "itemGroupLabel"
);
export const ItemText = withContext(Select.ItemText, "itemText");
export const Label = withContext(Select.Label, "label");
export const List = withContext(Select.List, "list");
export const Positioner = withContext(Select.Positioner, "positioner");
export const Trigger = withContext(Select.Trigger, "trigger");
export const ValueText = withContext(Select.ValueText, "valueText");
export const Indicator = withContext(Select.Indicator, "indicator", {
  defaultProps: () => ({ children: <ChevronsUpDownIcon /> }),
});
export const HiddenSelect = Select.HiddenSelect;

export {
  SelectContext as Context,
  SelectItemContext as ItemContext,
  createListCollection,
  type ListCollection,
  type SelectValueChangeDetails as ValueChangeDetails,
} from "@ark-ui/solid/select";

const StyledItemIndicator = withContext(Select.ItemIndicator, "itemIndicator");

export const ItemIndicator = (props: HTMLStyledProps<"div">) => {
  const item = useSelectItemContext();

  return (
    <Show when={item().selected} fallback={<svg aria-hidden="true" />}>
      <StyledItemIndicator {...props}>
        <CheckIcon />
      </StyledItemIndicator>
    </Show>
  );
};
