import {
  ArrowRightLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  ListPlusIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-solid";
import { For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Kbd } from "~/components/ui/kbd";
import * as Menu from "~/components/ui/menu";
import type { TaskStatus } from "~/services/tasks/tasks.service";
import {
  STATUS_META,
  STATUS_ORDER,
  TaskStatusIcon,
  statusColorClass,
} from "./TaskStatusIcon";

type Props = {
  taskLabel: string;
  status: TaskStatus;
  class?: string;
  onStatus: (status: TaskStatus) => void;
  onEditDetails: () => void;
  onAddSubtask: () => void;
  onDelete: () => void;
  /** Lists the task can move to; the submenu hides when there are none. */
  otherLists: { id: string; name: string }[];
  onMoveToList: (listId: string) => void;
};

export const TaskRowMenu = (props: Props) => {
  // Focus moves around until the menu has closed, and an empty draft row cancels
  // when it loses focus, so Add subtask waits for that.
  let afterClose: (() => void) | undefined;

  return (
    <Menu.Root
      size="sm"
      positioning={{ placement: "bottom-end" }}
      onExitComplete={() => {
        afterClose?.();
        afterClose = undefined;
      }}
    >
      <Menu.Trigger
        asChild={(triggerProps) => (
          <IconButton
            {...triggerProps}
            size="2xs"
            variant="plain"
            class={props.class}
            aria-label={`Actions for ${props.taskLabel}`}
            data-reveal=""
          >
            <EllipsisIcon size={14} />
          </IconButton>
        )}
      />
      <Portal>
        <Menu.Positioner zIndex="popover">
          <Menu.Content zIndex="popover">
            <Menu.RadioItemGroup
              value={props.status}
              onValueChange={(details) =>
                props.onStatus(details.value as TaskStatus)
              }
            >
              <For each={STATUS_ORDER}>
                {(status) => (
                  <Menu.RadioItem value={status}>
                    <HStack gap="2" flex="1">
                      <span class={statusColorClass} data-status={status}>
                        <TaskStatusIcon status={status} size={14} />
                      </span>
                      <Menu.ItemText>{STATUS_META[status].label}</Menu.ItemText>
                    </HStack>
                    <Show when={STATUS_META[status].shortcut}>
                      {(key) => <Kbd size="sm">{key()}</Kbd>}
                    </Show>
                    <Menu.ItemIndicator />
                  </Menu.RadioItem>
                )}
              </For>
            </Menu.RadioItemGroup>
            <Menu.Separator />
            <Menu.Item value="details" onSelect={props.onEditDetails}>
              <HStack gap="2" flex="1">
                <SquarePenIcon size={14} />
                Edit details
              </HStack>
              <Kbd size="sm">⌘↵</Kbd>
            </Menu.Item>
            <Menu.Item
              value="subtask"
              onSelect={() => (afterClose = props.onAddSubtask)}
            >
              <HStack gap="2" flex="1">
                <ListPlusIcon size={14} />
                Add subtask
              </HStack>
            </Menu.Item>
            <Show when={props.otherLists.length > 0}>
              <Menu.Root positioning={{ placement: "right-start", gutter: 2 }}>
                <Menu.TriggerItem>
                  <HStack gap="2" flex="1">
                    <ArrowRightLeftIcon size={14} />
                    Move to list
                  </HStack>
                  <ChevronRightIcon size={14} />
                </Menu.TriggerItem>
                <Portal>
                  <Menu.Positioner zIndex="popover">
                    <Menu.Content zIndex="popover" maxH="64" overflowY="auto">
                      <For each={props.otherLists}>
                        {(list) => (
                          <Menu.Item
                            value={`list-${list.id}`}
                            onSelect={() => props.onMoveToList(list.id)}
                          >
                            {list.name}
                          </Menu.Item>
                        )}
                      </For>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </Show>
            <Menu.Separator />
            <Menu.Item value="delete" color="red.11" onSelect={props.onDelete}>
              <HStack gap="2" flex="1">
                <Trash2Icon size={14} />
                Delete task
              </HStack>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
