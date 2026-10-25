import { For, Show, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { DestinationOption } from "~/server/cleanup/queue";

export type DestinationChoice =
  | { kind: "new"; title: string; path: string | null }
  | { kind: "existing"; docId: string; title: string };

const option = css({
  display: "flex",
  alignItems: "center",
  gap: "2.5",
  w: "full",
  px: "2.5",
  py: "2",
  borderRadius: "l2",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "sm",
  _hover: { bg: "gray.a2" },
  "&[aria-checked=true]": { bg: "gray.a3" },
});

const Dot: VoidComponent<{ on: boolean }> = (props) => (
  <Box
    w="3.5"
    h="3.5"
    flexShrink="0"
    borderRadius="full"
    borderWidth={props.on ? "4px" : "1px"}
    borderColor={props.on ? "fg.default" : "gray.8"}
  />
);

/** "Send to": a new note in the source's path, or an existing note. */
export const DestinationPicker: VoidComponent<{
  path: string | null;
  options: DestinationOption[];
  value: DestinationChoice;
  onChange: (next: DestinationChoice) => void;
}> = (props) => {
  const isNew = () => props.value.kind === "new";
  const newTitle = () => (props.value.kind === "new" ? props.value.title : "");
  return (
    <Stack gap="1" role="radiogroup" aria-label="Send to">
      <button
        type="button"
        role="radio"
        class={option}
        aria-checked={isNew()}
        onClick={() =>
          props.onChange({ kind: "new", title: newTitle(), path: props.path })
        }
      >
        <Dot on={isNew()} />
        <span>New note{props.path ? ` in ${props.path}` : ""}</span>
      </button>
      <Show when={isNew()}>
        <Box pl="8" pr="2.5" pb="1">
          <Input
            size="sm"
            aria-label="New note title"
            value={newTitle()}
            onInput={(e) =>
              props.onChange({
                kind: "new",
                title: e.currentTarget.value,
                path: props.path,
              })
            }
          />
        </Box>
      </Show>
      <For each={props.options}>
        {(dest) => {
          const on = () =>
            props.value.kind === "existing" && props.value.docId === dest.docId;
          return (
            <button
              type="button"
              role="radio"
              class={option}
              aria-checked={on()}
              onClick={() =>
                props.onChange({
                  kind: "existing",
                  docId: dest.docId,
                  title: dest.title,
                })
              }
            >
              <Dot on={on()} />
              <Box flex="1" minW="0">
                <Text as="span" truncate>
                  Add to {dest.title}
                </Text>
              </Box>
              <Text as="span" fontSize="xs" color="fg.muted" flexShrink="0">
                {dest.path}
              </Text>
            </button>
          );
        }}
      </For>
    </Stack>
  );
};
