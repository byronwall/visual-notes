import { type VoidComponent, createEffect, createMemo, createSignal } from "solid-js";
import {
  normalizeMetaRecord,
  serializeMetaRecord,
  summarizeMeta,
  summarizePath,
} from "~/components/doc-properties/meta-draft";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { type MetaRecord } from "~/services/docs.service";
import { MetaKeyValueEditor } from "./MetaKeyValueEditor";
import { PathEditor } from "./PathEditor";

export const DocPropertiesCompactEditors: VoidComponent<{
  docId?: string;
  initialPath?: string | null;
  initialMeta?: Record<string, unknown> | null;
  onPathChange?: (path: string) => void;
  onMetaChange?: (meta: MetaRecord) => void;
}> = (props) => {
  const initialPathValue = () => (props.initialPath || "").trim();
  const initialMetaValue = () => normalizeMetaRecord(props.initialMeta);

  let prevIncomingPath = initialPathValue();
  let prevIncomingMeta = serializeMetaRecord(initialMetaValue());

  const [pathDraft, setPathDraft] = createSignal(initialPathValue());
  const [metaDraft, setMetaDraft] = createSignal<MetaRecord>(initialMetaValue());
  const [pathPopoverOpen, setPathPopoverOpen] = createSignal(false);
  const [metaPopoverOpen, setMetaPopoverOpen] = createSignal(false);

  createEffect(() => {
    const incoming = initialPathValue();
    if (incoming === prevIncomingPath) return;
    prevIncomingPath = incoming;
    setPathDraft(incoming);
  });

  createEffect(() => {
    const incoming = initialMetaValue();
    const serialized = serializeMetaRecord(incoming);
    if (serialized === prevIncomingMeta) return;
    prevIncomingMeta = serialized;
    setMetaDraft(incoming);
  });

  const handlePathChange = (nextPath: string) => {
    if (nextPath === pathDraft()) return;
    setPathDraft(nextPath);
    if (props.onPathChange) props.onPathChange(nextPath);
  };

  const handleMetaChange = (nextMeta: MetaRecord) => {
    const serialized = serializeMetaRecord(nextMeta);
    if (serialized === serializeMetaRecord(metaDraft())) return;
    setMetaDraft(nextMeta);
    if (props.onMetaChange) props.onMetaChange(nextMeta);
  };

  const pathSummary = createMemo(() => summarizePath(pathDraft()));
  const metaSummary = createMemo(() => summarizeMeta(metaDraft()));

  return (
    <HStack gap="2" alignItems="center" flexWrap="wrap">
      <SimplePopover
        open={pathPopoverOpen()}
        onClose={() => setPathPopoverOpen(false)}
        placement="bottom-start"
        offset={8}
        style={{ width: "min(36rem, 92vw)" }}
        anchor={
          <Button
            type="button"
            size="sm"
            variant="plain"
            colorPalette="gray"
            px="3"
            py="1.5"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="gray.outline.border"
            borderRadius="l2"
            bg="bg.default"
            _hover={{ bg: "gray.surface.bg" }}
            onClick={() => setPathPopoverOpen((open) => !open)}
          >
            <Text
              as="span"
              fontSize="xs"
              color={pathDraft().trim().length > 0 ? "fg.default" : "fg.subtle"}
              fontFamily="mono"
              fontWeight="medium"
              maxW="24rem"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {pathSummary()}
            </Text>
          </Button>
        }
      >
        <Stack gap="2" p="3">
          <PathEditor
            docId={props.docId}
            initialPath={pathDraft() || undefined}
            onChange={handlePathChange}
          />
        </Stack>
      </SimplePopover>

      <SimplePopover
        open={metaPopoverOpen()}
        onClose={() => setMetaPopoverOpen(false)}
        placement="bottom-start"
        offset={8}
        style={{ width: "min(36rem, 92vw)" }}
        anchor={
          <Button
            type="button"
            size="sm"
            variant="plain"
            colorPalette="gray"
            px="3"
            py="1.5"
            borderWidth="1px"
            borderStyle="solid"
            borderColor="gray.subtle"
            borderRadius="full"
            bg="gray.surface.bg"
            _hover={{ bg: "gray.surface.bg.hover" }}
            onClick={() => setMetaPopoverOpen((open) => !open)}
          >
            <Text
              as="span"
              fontSize="xs"
              color={Object.keys(metaDraft()).length > 0 ? "fg.default" : "fg.subtle"}
              fontWeight="medium"
              maxW="24rem"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {metaSummary()}
            </Text>
          </Button>
        }
      >
        <Stack gap="2" p="3">
          <MetaKeyValueEditor
            docId={props.docId}
            initialMeta={metaDraft()}
            onChange={handleMetaChange}
          />
        </Stack>
      </SimplePopover>
    </HStack>
  );
};
