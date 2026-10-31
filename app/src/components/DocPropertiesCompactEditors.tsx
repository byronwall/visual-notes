import {
  type JSX,
  type VoidComponent,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import {
  normalizeMetaRecord,
  shouldSyncMetaDraft,
  serializeMetaRecord,
  summarizeMeta,
} from "~/components/doc-properties/meta-draft";
import { A } from "@solidjs/router";
import { css } from "styled-system/css";
import { FolderIcon, PencilIcon, TagIcon } from "lucide-solid";
import { For, Show } from "solid-js";
import { Box, HStack, Stack, styled } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Link } from "~/components/ui/link";
import { Tooltip } from "~/components/ui/tooltip";
import { buildPathAncestors, pathToRoute } from "~/utils/path-links";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Text } from "~/components/ui/text";
import { type MetaRecord } from "~/services/docs.service";
import { MetaKeyValueEditor } from "./MetaKeyValueEditor";
import { NearbyNodesPopover } from "./NearbyNodesPopover";
import { PathEditor } from "./PathEditor";
import { PathRelatedNotesPopover } from "./PathRelatedNotesPopover";

export const DocPropertiesCompactEditors: VoidComponent<{
  docId?: string;
  initialPath?: string | null;
  initialMeta?: Record<string, unknown> | null;
  onPathChange?: (path: string) => void;
  onMetaChange?: (meta: MetaRecord) => void;
  pathPopoverPortalled?: boolean;
  trailing?: JSX.Element;
}> = (props) => {
  let prevDocId: string | undefined;
  const initialPathValue = () => (props.initialPath || "").trim();
  const initialMetaValue = () => normalizeMetaRecord(props.initialMeta);

  let prevIncomingPath = initialPathValue();
  let prevMetaDocId: string | undefined;
  let prevIncomingMeta = serializeMetaRecord(initialMetaValue());

  const [pathDraft, setPathDraft] = createSignal(initialPathValue());
  const [metaDraft, setMetaDraft] =
    createSignal<MetaRecord>(initialMetaValue());
  const [pathPopoverOpen, setPathPopoverOpen] = createSignal(false);
  const [metaPopoverOpen, setMetaPopoverOpen] = createSignal(false);

  createEffect(() => {
    const incomingDocId = props.docId;
    const incoming = initialPathValue();
    if (incomingDocId === prevDocId && incoming === prevIncomingPath) return;
    const docChanged = incomingDocId !== prevDocId;
    prevDocId = incomingDocId;
    prevIncomingPath = incoming;
    if (!docChanged && incoming === pathDraft()) return;
    setPathDraft(incoming);
    if (docChanged) setPathPopoverOpen(false);
  });

  createEffect(() => {
    const incomingDocId = props.docId;
    const incoming = initialMetaValue();
    const serialized = serializeMetaRecord(incoming);
    if (
      !shouldSyncMetaDraft(
        prevMetaDocId,
        incomingDocId,
        prevIncomingMeta,
        serialized,
      )
    ) {
      return;
    }
    const docChanged = incomingDocId !== prevMetaDocId;
    prevMetaDocId = incomingDocId;
    prevIncomingMeta = serialized;
    setMetaDraft(incoming);
    if (docChanged) setMetaPopoverOpen(false);
  });

  let pathEditorRoot: HTMLDivElement | undefined;

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

  const metaSummary = createMemo(() => summarizeMeta(metaDraft()));

  const hasPath = () => pathDraft().trim().length > 0;
  const hasMeta = () => Object.keys(metaDraft()).length > 0;

  return (
    // On phones the root dissolves (display: contents) so the path can share
    // the first line with the header actions and the rest wraps beneath.
    <HStack
      gap="1"
      alignItems="center"
      flexWrap="wrap"
      minH="7"
      minW="0"
      display={{ base: "contents", md: "flex" }}
    >
      <SimplePopover
        open={pathPopoverOpen()}
        onClose={() => setPathPopoverOpen(false)}
        placement="bottom-start"
        offset={8}
        style={{ width: "min(36rem, 92vw)" }}
        portalled={props.pathPopoverPortalled}
        anchorClass={pathAnchorClass}
        onEscapeKeyDown={keepOpenOnPathInputEscape}
        initialFocusEl={() =>
          pathEditorRoot?.querySelector<HTMLElement>(
            "[data-path-segment-input]",
          ) ?? null
        }
        anchor={
          <HStack gap="0" alignItems="center" minW="0">
            <Show
              when={hasPath()}
              fallback={
                <PlainChip
                  onClick={() => setPathPopoverOpen((open) => !open)}
                  ariaLabel="Set path"
                  muted
                  mono
                >
                  <FolderIcon size={13} />
                  Unfiled
                </PlainChip>
              }
            >
              <PathCrumbs path={pathDraft()} />
              <Tooltip content="Edit path" showArrow openDelay={300}>
                <IconButton
                  size="xs"
                  variant="plain"
                  colorPalette="gray"
                  color="fg.subtle"
                  flexShrink="0"
                  minW="7"
                  w="7"
                  h="7"
                  aria-label="Edit path"
                  onClick={() => setPathPopoverOpen((open) => !open)}
                >
                  <PencilIcon size={12} />
                </IconButton>
              </Tooltip>
            </Show>
          </HStack>
        }
      >
        <Stack ref={pathEditorRoot} gap="2" p="3">
          <PathEditor
            docId={props.docId}
            initialPath={pathDraft() || undefined}
            onChange={handlePathChange}
            onChangeWhenSavedOnly
            onSubmit={() => setPathPopoverOpen(false)}
          />
        </Stack>
      </SimplePopover>
      <HStack
        gap="1"
        alignItems="center"
        minW="0"
        order="2"
        flexBasis={{ base: "100%", md: "auto" }}
        flexWrap="wrap"
      >
        <PathRelatedNotesPopover
          path={pathDraft()}
          currentDocId={props.docId}
        />
        <NearbyNodesPopover docId={props.docId} />

        <Box w="1px" h="4" bg="border" mx="1" aria-hidden="true" />

        <SimplePopover
          open={metaPopoverOpen()}
          onClose={() => setMetaPopoverOpen(false)}
          placement="bottom-start"
          offset={8}
          style={{ width: "min(36rem, 92vw)" }}
          anchorClass={shrinkAnchorClass}
          anchor={
            <PlainChip
              onClick={() => setMetaPopoverOpen((open) => !open)}
              ariaLabel="Edit details"
              muted={!hasMeta()}
            >
              <Show when={!hasMeta()}>
                <TagIcon size={13} />
              </Show>
              <Text
                as="span"
                fontSize="xs"
                maxW={{ base: "full", md: "28rem" }}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {hasMeta() ? metaSummary() : "Add details"}
              </Text>
            </PlainChip>
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

        <>{props.trailing}</>
      </HStack>
    </HStack>
  );
};

// Escape in the path input only dismisses its suggestions (PathEditor blurs
// the input); a second Escape closes the popover.
const keepOpenOnPathInputEscape = (event: KeyboardEvent) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.pathSegmentInput) {
    event.preventDefault();
  }
};

// Popover anchors wrap their trigger in a div; let it shrink so long paths
// and details truncate instead of pushing the header actions aside.
const shrinkAnchorClass = css({ minW: "0", maxW: "full" });
const pathAnchorClass = css({
  minW: "0",
  maxW: "full",
  order: "0",
  flex: { base: "1 1 0", md: "0 1 auto" },
});

/** Each ancestor segment links to its path page, as a breadcrumb should. */
function PathCrumbs(props: { path: string }) {
  const ancestors = () => buildPathAncestors(props.path);
  return (
    <HStack
      as="nav"
      aria-label="Note path"
      gap="0"
      alignItems="center"
      fontFamily="mono"
      fontSize="xs"
      minW="0"
      flexWrap="nowrap"
      overflow="hidden"
    >
      <For each={ancestors()}>
        {(ancestor, index) => (
          <>
            <Show when={index() > 0}>
              <Box as="span" color="fg.subtle" px="0.5" aria-hidden="true">
                /
              </Box>
            </Show>
            <Link
              as={A}
              href={pathToRoute(ancestor)}
              color={
                index() === ancestors().length - 1 ? "fg.default" : "fg.muted"
              }
              textDecoration="none"
              bg="transparent"
              fontWeight="normal"
              display="block"
              px="1"
              py="0.5"
              borderRadius="l1"
              whiteSpace="nowrap"
              // Ancestors give up space first; the note's own folder stays whole.
              flexShrink={index() === ancestors().length - 1 ? 0 : 1}
              minW="0"
              overflow="hidden"
              textOverflow="ellipsis"
              title={ancestor}
              transitionProperty="background-color, color"
              transitionDuration="140ms"
              _hover={{ bg: "gray.plain.bg.hover", color: "fg.default" }}
              focusVisibleRing="outside"
            >
              {ancestor.split(".").pop()}
            </Link>
          </>
        )}
      </For>
    </HStack>
  );
}

function PlainChip(props: {
  onClick: () => void;
  ariaLabel: string;
  muted?: boolean;
  mono?: boolean;
  children: JSX.Element;
}) {
  return (
    <styled.button
      type="button"
      aria-label={props.ariaLabel}
      onClick={() => props.onClick()}
      display="inline-flex"
      alignItems="center"
      gap="1.5"
      h="7"
      px="1.5"
      borderRadius="l2"
      fontSize="xs"
      fontFamily={props.mono ? "mono" : undefined}
      color={props.muted ? "fg.subtle" : "fg.muted"}
      cursor="pointer"
      minW="0"
      maxW="full"
      focusVisibleRing="outside"
      transitionProperty="background-color, color"
      transitionDuration="140ms"
      _hover={{ bg: "gray.plain.bg.hover", color: "fg.default" }}
    >
      {props.children}
    </styled.button>
  );
}
