import { For, Show, type VoidComponent } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";

/** Splits a draft's markdown into bullets and one optional code block. */
export function parseDraft(markdown: string) {
  const code = markdown.match(/```[a-z]*\n([\s\S]*?)```/)?.[1]?.trim() ?? null;
  const bullets = markdown
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .map((line) => line.match(/^\s*[-*]\s+(.*)$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
  return { bullets, code };
}

/** The note itself, for deciding whether a paid draft is worth writing. */
export const NotePreview: VoidComponent<{ markdown: string; note: string }> = (
  props,
) => (
  <Stack gap="2">
    <Text fontSize="xs" color="fg.muted">
      {props.note}
    </Text>
    <Box
      fontSize="sm"
      whiteSpace="pre-wrap"
      overflowWrap="anywhere"
      maxH="18rem"
      overflowY="auto"
      color="fg.muted"
      data-testid="cleanup-note-preview"
    >
      {props.markdown}
    </Box>
  </Stack>
);

export const DraftPreview: VoidComponent<{ markdown: string }> = (props) => {
  const parsed = () => parseDraft(props.markdown);
  return (
    <Stack gap="2">
      <Box
        as="ul"
        pl="5"
        listStyleType="disc"
        display="flex"
        flexDirection="column"
        gap="1"
      >
        <For each={parsed().bullets}>
          {(bullet) => (
            <Text as="li" fontSize="sm">
              {bullet}
            </Text>
          )}
        </For>
      </Box>
      <Show when={parsed().code}>
        {(code) => (
          <Box
            as="pre"
            fontSize="xs"
            fontFamily="mono"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
            borderRadius="l2"
            px="3"
            py="2"
            overflowX="auto"
          >
            {code()}
          </Box>
        )}
      </Show>
    </Stack>
  );
};
