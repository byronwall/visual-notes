import { type VoidComponent, createEffect, createSignal } from "solid-js";
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
  const next: MetaRecord = {};
  for (const [key, rawValue] of Object.entries(input)) {
    if (typeof rawValue === "string") {
      next[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number") {
      next[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "boolean") {
      next[key] = rawValue;
      continue;
    }
    if (rawValue === null) {
      next[key] = null;
    }
  }
  return next;
};

export const DocPropertiesCompactEditors: VoidComponent<{
  docId?: string;
  initialPath?: string | null;
  initialMeta?: Record<string, unknown> | null;
  onPathChange?: (path: string) => void;
  onMetaChange?: (meta: MetaRecord) => void;
}> = (props) => {
  const [pathDraft, setPathDraft] = createSignal((props.initialPath || "").trim());
  const [metaDraft, setMetaDraft] = createSignal<MetaRecord>(
    normalizeMetaRecord(props.initialMeta)
  );
  const [pathPopoverOpen, setPathPopoverOpen] = createSignal(false);
  const [metaPopoverOpen, setMetaPopoverOpen] = createSignal(false);

  createEffect(() => {
    setPathDraft((props.initialPath || "").trim());
  });

  createEffect(() => {
    setMetaDraft(normalizeMetaRecord(props.initialMeta));
  });

  const pathSummary = () => {
    const value = pathDraft().trim();
    if (value.length > 0) return value;
    return "Unfiled";
  };

  const metaSummary = () => {
    const entries = Object.entries(metaDraft()).filter(
      ([key]) => key.trim().length > 0
    );
    if (entries.length === 0) return "No details";
    const first = entries[0];
    const firstText = `${first?.[0] || ""}: ${String(first?.[1] || "")}`;
    if (entries.length === 1) return firstText;
    return `${firstText} +${entries.length - 1}`;
  };

  const handlePathChange = (nextPath: string) => {
    setPathDraft(nextPath);
    if (props.onPathChange) props.onPathChange(nextPath);
  };

  const handleMetaChange = (nextMeta: MetaRecord) => {
    setMetaDraft(nextMeta);
    if (props.onMetaChange) props.onMetaChange(nextMeta);
  };

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
