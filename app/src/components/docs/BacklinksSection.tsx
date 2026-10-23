import { A } from "@solidjs/router";
import { For, Show, createResource, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { fetchBacklinks } from "~/services/note-links.queries";

const rowLink = css({
  display: "block",
  px: "2",
  py: "1.5",
  borderRadius: "l2",
  color: "fg.default",
  textDecorationLine: "none",
  _hover: { bg: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "border.focus" },
});

/** "Linked from" list under a note: every note that links here, with context. */
export const BacklinksSection: VoidComponent<{ docId: string }> = (props) => {
  const [backlinks] = createResource(() => props.docId, fetchBacklinks);
  const items = () => backlinks.latest ?? [];

  return (
    <Show when={items().length > 0}>
      <Box
        as="section"
        aria-label="Backlinks"
        mt="8"
        pt="4"
        borderTopWidth="1px"
        borderColor="gray.outline.border"
        class="not-prose"
      >
        <Text
          as="h2"
          textStyle="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wide"
          mb="2"
        >
          Linked from {items().length} {items().length === 1 ? "note" : "notes"}
        </Text>
        <Stack gap="0.5">
          <For each={items()}>
            {(note) => (
              <Box>
                <A href={`/docs/${note.docId}`} class={rowLink}>
                  <Text textStyle="sm" fontWeight="medium" truncate>
                    {note.title}
                  </Text>
                </A>
                <For each={note.blocks}>
                  {(block) => (
                    <A
                      href={`/docs/${note.docId}#b-${block.blockId}`}
                      class={rowLink}
                    >
                      <Text
                        textStyle="xs"
                        color="fg.muted"
                        pl="3"
                        borderLeftWidth="2px"
                        borderColor="gray.a5"
                        lineClamp="2"
                      >
                        {block.text || "(empty block)"}
                      </Text>
                    </A>
                  )}
                </For>
              </Box>
            )}
          </For>
        </Stack>
      </Box>
    </Show>
  );
};
