import { EllipsisIcon, Trash2Icon } from "lucide-solid";
import { For, type VoidComponent } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";
import type { AnnotationTypeView } from "~/lib/annotations/types";
import { swatchStyle } from "./annotation-context";

/** The rarely used actions of a rail entry: change its type, or delete it. */
export const AnnotationEntryMenu: VoidComponent<{
  types: AnnotationTypeView[];
  typeId: string;
  onType: (typeId: string) => void;
  onDelete: () => void;
  onEditTypes: () => void;
}> = (props) => (
  <Menu.Root size="sm" positioning={{ placement: "bottom-end" }}>
    <Menu.Trigger
      asChild={(triggerProps) => (
        <IconButton
          {...triggerProps}
          size="2xs"
          variant="plain"
          aria-label="Annotation actions"
          data-testid="annotation-menu"
          onClick={(event: MouseEvent) => event.stopPropagation()}
        >
          <EllipsisIcon size={14} />
        </IconButton>
      )}
    />
    <Portal>
      <Menu.Positioner zIndex="popover">
        <Menu.Content zIndex="popover">
          <Menu.RadioItemGroup
            value={props.typeId}
            onValueChange={(d) => d.value && props.onType(d.value)}
          >
            <Menu.ItemGroupLabel>Type</Menu.ItemGroupLabel>
            <For each={props.types}>
              {(type) => (
                <Menu.RadioItem value={type.id}>
                  <HStack gap="2" flex="1">
                    <Box
                      w="2.5"
                      h="2.5"
                      borderRadius="full"
                      style={swatchStyle(type.color)}
                    />
                    <Menu.ItemText>{type.name}</Menu.ItemText>
                  </HStack>
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              )}
            </For>
          </Menu.RadioItemGroup>
          <Menu.Item value="edit-types" onSelect={props.onEditTypes}>
            Edit types…
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item value="delete" color="red.11" onSelect={props.onDelete}>
            <HStack gap="2" flex="1">
              <Trash2Icon size={14} />
              Delete
            </HStack>
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  </Menu.Root>
);
