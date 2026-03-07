import { Suspense } from "solid-js";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import * as SegmentGroup from "~/components/ui/segment-group";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Box, HStack, Stack } from "styled-system/jsx";
import { type SelectItem } from "~/features/umap/types";

type UmapCreateToolbarProps = {
  embeddingItems: SelectItem[];
  selectedEmbedding: string;
  dims: 2 | 3;
  creating: boolean;
  onSelectedEmbeddingChange: (value: string) => void;
  onDimsChange: (value: 2 | 3) => void;
  onCreateRun: () => void;
};

export function UmapCreateToolbar(props: UmapCreateToolbarProps) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="l2" bg="bg.default" p="3">
      <Stack gap="3">
        <Heading as="h2" fontSize="sm">
          New UMAP Run
        </Heading>

        <Stack gap="2">
          <Box as="label" fontSize="xs" color="fg.muted">
            Embedding run and dimensions
          </Box>
          <HStack gap="2" alignItems="stretch">
            <Box flex="1">
              <Suspense fallback={null}>
                <SimpleSelect
                  items={props.embeddingItems}
                  value={props.selectedEmbedding}
                  onChange={props.onSelectedEmbeddingChange}
                  skipPortal
                  sameWidth
                  placeholder="Select embedding run…"
                />
              </Suspense>
            </Box>
            <SegmentGroup.Root
              size="sm"
              value={String(props.dims)}
              onValueChange={(details) => props.onDimsChange(details.value === "3" ? 3 : 2)}
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Item value="2">
                <SegmentGroup.ItemText>2D</SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
              <SegmentGroup.Item value="3">
                <SegmentGroup.ItemText>3D</SegmentGroup.ItemText>
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            </SegmentGroup.Root>
          </HStack>
        </Stack>

        <Button
          size="sm"
          variant="solid"
          colorPalette="green"
          loading={props.creating}
          disabled={!props.selectedEmbedding}
          onClick={props.onCreateRun}
        >
          Create Run
        </Button>
      </Stack>
    </Box>
  );
}
