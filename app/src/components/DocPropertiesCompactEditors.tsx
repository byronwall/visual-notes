import { type VoidComponent, createEffect, createMemo, createSignal } from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { type MetaRecord } from "~/services/docs.service";
import { MetaKeyValueEditor } from "./MetaKeyValueEditor";
import { PathEditor } from "./PathEditor";

const normalizeMetaRecord = (
  input: Record<string, unknown> | null | undefined
): MetaRecord => {
  if (!input || typeof input !== "object") return {};

  const out: MetaRecord = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (typeof rawValue === "string") {
      out[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number") {
      out[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "boolean") {
      out[key] = rawValue;
      continue;
    }
    if (rawValue === null) {
      out[key] = null;
    }
  }
  return out;
};

const summarizePath = (path: string) => (path.trim().length > 0 ? path : "Unfiled");

const summarizeMeta = (meta: MetaRecord) => {
  const entries = Object.entries(meta).filter(([key]) => key.trim().length > 0);
  if (entries.length === 0) return "No details";

  const first = entries[0];
  const firstText = `${first?.[0] || ""}: ${String(first?.[1] || "")}`;
  if (entries.length === 1) return firstText;
  return `${firstText} +${entries.length - 1}`;
};

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
  let prevIncomingMeta = JSON.stringify(initialMetaValue());

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
    const serialized = JSON.stringify(incoming);
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
    const serialized = JSON.stringify(nextMeta);
    if (serialized === JSON.stringify(metaDraft())) return;
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
