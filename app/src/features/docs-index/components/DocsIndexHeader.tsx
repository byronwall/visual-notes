import { type Accessor } from "solid-js";
import type { SourcesResponse } from "../data/docs.service";
import { ActionsPopover } from "./ActionsPopover";
import { SelectionPopover } from "./SelectionPopover";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { Flex, HStack } from "styled-system/jsx";

export const DocsIndexHeader = (props: {
  visibleCount: number;
  selectedCount: number;
  totalResultsCount: number;
  sources: Accessor<SourcesResponse | undefined>;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => Promise<void>;
  onBulkMeta: () => void;
  onBulkPath: () => void;
  onBulkSetSource: () => Promise<void>;
  onCleanupTitles: () => Promise<void>;
  onProcessPathRound: () => Promise<void>;
  onScanRelativeImages: () => Promise<void>;
  onDeleteBySource: (source: string, count: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}) => {
  return (
    <Flex align="center" justify="space-between" gap="0.75rem" flexWrap="wrap">
      <HStack gap="3" alignItems="center" flexWrap="wrap">
        <Heading as="h1" fontSize="2xl">
          Notes
        </Heading>
        <Text fontSize="sm" color="fg.muted">
          Selected {props.selectedCount} · Visible {props.visibleCount} · Results{" "}
          {props.totalResultsCount}
        </Text>
      </HStack>
      <HStack gap="2" alignItems="center">
        <SelectionPopover
          visibleCount={props.visibleCount}
          selectedCount={props.selectedCount}
          onSelectAll={props.onSelectAll}
          onClearSelection={props.onClearSelection}
          onDeleteSelected={props.onDeleteSelected}
          onBulkMeta={props.onBulkMeta}
          onBulkPath={props.onBulkPath}
        />
        <ActionsPopover
          sources={props.sources}
          onBulkSetSource={props.onBulkSetSource}
          onCleanupTitles={props.onCleanupTitles}
          onProcessPathRound={props.onProcessPathRound}
          onScanRelativeImages={props.onScanRelativeImages}
          onDeleteBySource={props.onDeleteBySource}
          onDeleteAll={props.onDeleteAll}
        />
      </HStack>
    </Flex>
  );
};
