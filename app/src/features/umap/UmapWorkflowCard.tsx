import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { Box, Stack } from "styled-system/jsx";

export function UmapWorkflowCard() {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="l2" p="3">
      <Stack gap="2">
        <Heading as="h2" fontSize="sm">
          Projection Workflow
        </Heading>
        <Text textStyle="sm" color="fg.muted">
          1) Pick an embedding run and train UMAP once on this page.
        </Text>
        <Text textStyle="sm" color="fg.muted">
          2) New or updated docs are embedded from the Embedding Run page.
        </Text>
        <Text textStyle="sm" color="fg.muted">
          3) Fresh vectors are projected into trained UMAP models without retraining.
        </Text>
      </Stack>
    </Box>
  );
}
