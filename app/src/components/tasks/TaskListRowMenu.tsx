import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-solid";
import { Portal } from "solid-js/web";
import { HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";

type Props = {
  listName: string;
  onRename: () => void;
  onDelete: () => void;
};

export const TaskListRowMenu = (props: Props) => (
  <Menu.Root size="sm" positioning={{ placement: "bottom-end" }}>
    <Menu.Trigger
      asChild={(triggerProps) => (
        <IconButton
          {...triggerProps}
          size="2xs"
          variant="plain"
          data-reveal=""
          aria-label={`Actions for list ${props.listName}`}
        >
          <EllipsisIcon size={14} />
        </IconButton>
      )}
    />
    <Portal>
      <Menu.Positioner zIndex="popover">
        <Menu.Content zIndex="popover">
          <Menu.Item value="rename" onSelect={props.onRename}>
            <HStack gap="2">
              <PencilIcon size={14} />
              Rename
            </HStack>
          </Menu.Item>
          <Menu.Item value="delete" color="red.11" onSelect={props.onDelete}>
            <HStack gap="2">
              <Trash2Icon size={14} />
              Delete list
            </HStack>
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  </Menu.Root>
);
