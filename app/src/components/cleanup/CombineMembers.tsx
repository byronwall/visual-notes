import { For, Show, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { RegroupMember } from "~/server/cleanup/regroup-queue";

const row = css({
  display: "flex",
  alignItems: "center",
  gap: "2.5",
  px: "2.5",
  py: "1.5",
  borderRadius: "l2",
  fontSize: "sm",
  _hover: { bg: "gray.a2" },
});

const keepButton = css({
  fontSize: "xs",
  px: "2",
  py: "0.5",
  borderRadius: "l1",
  borderWidth: "1px",
  borderColor: "border",
  color: "fg.muted",
  cursor: "pointer",
  flexShrink: "0",
  _hover: { color: "fg.default" },
  "&[aria-pressed=true]": {
    bg: "fg.default",
    color: "bg.default",
    borderColor: "fg.default",
  },
});

/**
 * The cluster's notes: tick which ones to combine, and pick the one to keep
 * (the rest are archived into it), or a new note.
 */
export const CombineMembers: VoidComponent<{
  members: RegroupMember[];
  included: Set<string>;
  onToggle: (docId: string) => void;
  keepId: string | null;
  onKeep: (docId: string | null) => void;
  newTitle: string;
  onNewTitle: (title: string) => void;
}> = (props) => (
  <Stack gap="0.5" data-testid="combine-members">
    <For each={props.members}>
      {(member) => {
        const included = () => props.included.has(member.docId);
        const keeping = () => props.keepId === member.docId;
        return (
          <label class={row}>
            <input
              type="checkbox"
              checked={included()}
              disabled={keeping()}
              onChange={() => props.onToggle(member.docId)}
            />
            <Stack gap="0" flex="1" minW="0" opacity={included() ? 1 : 0.5}>
              <Text as="span" truncate>
                {member.title || "Untitled note"}
              </Text>
              <Text as="span" fontSize="xs" color="fg.muted">
                {[member.path, `${member.words.toLocaleString()} words`]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </Stack>
            <button
              type="button"
              class={keepButton}
              aria-pressed={keeping()}
              disabled={!included()}
              onClick={(e) => {
                e.preventDefault();
                props.onKeep(member.docId);
              }}
            >
              {keeping() ? "Keeping" : "Keep this"}
            </button>
          </label>
        );
      }}
    </For>
    <HStack class={row} gap="2.5">
      <Box flex="1" color="fg.muted" fontSize="sm">
        Or combine into a new note
      </Box>
      <button
        type="button"
        class={keepButton}
        aria-pressed={props.keepId === null}
        onClick={() => props.onKeep(null)}
      >
        {props.keepId === null ? "Keeping" : "New note"}
      </button>
    </HStack>
    <Show when={props.keepId === null}>
      <Box px="2.5" pb="1">
        <Input
          size="sm"
          aria-label="New note title"
          value={props.newTitle}
          onInput={(e) => props.onNewTitle(e.currentTarget.value)}
        />
      </Box>
    </Show>
  </Stack>
);
