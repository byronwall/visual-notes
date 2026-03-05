import { Trash2Icon } from "lucide-solid";
import { For } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { InPlaceEditableText } from "~/components/InPlaceEditableText";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import type { TaskListItem } from "~/services/tasks/tasks.service";

type Props = {
  lists: TaskListItem[];
  selectedListId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (list: TaskListItem, nextName: string) => Promise<void>;
  onDelete: (list: TaskListItem) => Promise<void>;
};

export const TaskListSelector = (props: Props) => {
  return (
    <Stack gap="2" minH="0" data-testid="task-lists-nav">
      <HStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="semibold">Task Lists</Text>
        <Button size="xs" onClick={props.onCreate} data-testid="task-list-create-button">
          New List
        </Button>
      </HStack>

      <Stack gap="1" overflow="auto" minH="0" pr="1">
        <For each={props.lists}>
          {(list) => (
            <HStack
              data-testid={`task-list-item-${list.id}`}
              borderWidth="1px"
              borderColor={props.selectedListId === list.id ? "blue.500" : "border"}
              borderRadius="md"
              px="2"
              py="2"
              justifyContent="space-between"
              gap="2"
            >
              <HStack
                flex="1"
                minW="0"
                gap="2"
                alignItems="center"
                onClick={() => props.onSelect(list.id)}
              >
                <InPlaceEditableText
                  value={list.name}
                  onCommit={(nextName) => props.onRename(list, nextName)}
                  fontSize="md"
                  fontWeight="medium"
                  fillWidth
                />
                <Text color="fg.muted" fontSize="xs" whiteSpace="nowrap">
                  {list.taskCount}
                </Text>
              </HStack>
              <HStack gap="1">
                <IconButton
                  size="2xs"
                  variant="plain"
                  colorPalette="red"
                  aria-label={`Delete list ${list.name}`}
                  onClick={() => void props.onDelete(list)}
                >
                  <Trash2Icon size={14} />
                </IconButton>
              </HStack>
            </HStack>
          )}
        </For>
      </Stack>
    </Stack>
  );
};
