import { useListCollection } from "@ark-ui/solid/collection";
import { useFilter } from "@ark-ui/solid/locale";
import { For, createEffect, createMemo, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { Box } from "styled-system/jsx";
import * as Combobox from "~/components/ui/combobox";

type GroupItem = {
  label: string;
  value: string;
};

export const ArchiveGroupCombobox = (props: {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}) => {
  const filter = useFilter({ sensitivity: "base" });
  const [inputValue, setInputValue] = createSignal("");
  const listItems = createMemo<GroupItem[]>(() =>
    props.options.map((option) => ({ label: option, value: option })),
  );
  const selectedValue = createMemo(() => (props.value ? [props.value] : []));
  const { collection, filter: applyFilter } = useListCollection<GroupItem>({
    initialItems: [],
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
    filter: filter().contains,
  });

  createEffect(() => {
    setInputValue(props.value);
  });

  createEffect(() => {
    collection().setItems(listItems());
    applyFilter(inputValue());
  });

  return (
    <Combobox.Root
      collection={collection()}
      inputValue={inputValue()}
      value={selectedValue()}
      selectionBehavior="preserve"
      positioning={{ sameWidth: true, gutter: 6 }}
      onInputValueChange={(event) => {
        setInputValue(event.inputValue);
        props.onChange(event.inputValue);
        applyFilter(event.inputValue);
      }}
      onValueChange={(event) => {
        const nextValue = event.value[0] ?? "";
        setInputValue(nextValue);
        props.onChange(nextValue);
      }}
    >
      <Box minW="0">
        <Combobox.Label fontSize="xs" color="fg.muted" mb="1">
          {props.label}
        </Combobox.Label>
        <Combobox.Control>
          <Combobox.Input placeholder={props.placeholder} />
          <Combobox.IndicatorGroup pr="2">
            <Combobox.Trigger aria-label={`Choose ${props.label.toLowerCase()}`} />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
      </Box>

      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            <Combobox.Empty>No groups found</Combobox.Empty>
            <Combobox.List>
              <For each={collection().items}>
                {(item) => (
                  <Combobox.Item item={item}>
                    <Combobox.ItemText>{item.label}</Combobox.ItemText>
                    <Combobox.ItemIndicator />
                  </Combobox.Item>
                )}
              </For>
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
};
