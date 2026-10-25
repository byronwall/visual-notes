import type { VoidComponent } from "solid-js";
import { Box, Grid, Stack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";

/** Side by side: the original (read only) and the editable distilled draft. */
export const DistillReview: VoidComponent<{
  original: string;
  markdown: string;
  onMarkdown: (next: string) => void;
}> = (props) => (
  <Grid
    columns={{ base: 1, lg: 2 }}
    gap="3"
    flex="1"
    minH="0"
    data-testid="distill-review"
  >
    <Stack gap="1.5" minH="0">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
        Original (will be archived)
      </Text>
      <Box
        flex="1"
        minH="48"
        maxH="60vh"
        overflowY="auto"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l2"
        px="3"
        py="2"
        fontSize="sm"
        color="fg.muted"
        whiteSpace="pre-wrap"
        bg="bg.subtle"
      >
        {props.original}
      </Box>
    </Stack>
    <Stack gap="1.5" minH="0">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
        Distilled (markdown)
      </Text>
      <Textarea
        aria-label="Distilled markdown"
        flex="1"
        minH="48"
        fontSize="sm"
        fontFamily="mono"
        value={props.markdown}
        onInput={(e) => props.onMarkdown(e.currentTarget.value)}
      />
    </Stack>
  </Grid>
);
