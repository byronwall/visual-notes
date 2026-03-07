import { Suspense } from "solid-js";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Flex, HStack } from "styled-system/jsx";
import { DIMS_ITEMS, type SelectItem } from "~/features/umap/types";

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
    <Flex align="center" justify="space-between" gap="4" flexWrap="wrap">
      <Heading as="h1" fontSize="2xl">
        UMAP
      </Heading>

      <Suspense fallback={null}>
        <HStack gap="3" flexWrap="wrap">
          <SimpleSelect
            items={props.embeddingItems}
            value={props.selectedEmbedding}
            onChange={props.onSelectedEmbeddingChange}
            skipPortal
            sameWidth
            minW="260px"
            placeholder="Select embedding run…"
          />

          <SimpleSelect
            items={DIMS_ITEMS}
            value={String(props.dims)}
            onChange={(value) => props.onDimsChange(value === "3" ? 3 : 2)}
            skipPortal
            sameWidth
            minW="96px"
            placeholder="Dims"
          />

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
        </HStack>
      </Suspense>
    </Flex>
  );
}
