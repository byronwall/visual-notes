import { Show, type JSX, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { DocActivitySummaryPopover } from "../DocActivitySummaryPopover";
import { DocPropertiesCompactEditors } from "../DocPropertiesCompactEditors";
import { DocSharePanel } from "../DocSharePanel";
import { RecordAudioButton } from "../doc-audio/RecordAudioButton";
import { DocActionsMenu } from "./DocActionsMenu";
import { DocSaveStatus, type SaveState } from "./DocSaveStatus";
import { DocVersionsPopover } from "./DocVersionsPopover";

type ShareInfo = {
  id: string;
  slug: string;
  shareUrl: string;
  createdAt: string;
  updatedAt: string;
} | null;

/**
 * The note's top row, shared by the full note page and the side panel:
 * path and properties on the left, then save status and note actions.
 * `trailing` adds host controls such as the panel's close button.
 */
export const DocHeaderBar: VoidComponent<{
  doc: {
    id: string;
    path?: string | null;
    meta?: Record<string, unknown> | null;
    createdAt?: string;
    share?: ShareInfo;
  };
  saveState: SaveState;
  busy?: boolean;
  /**
   * Actions on their own row above the properties, for narrow hosts like a
   * side panel. The page keeps one row and wraps only on phones.
   */
  stacked?: boolean;
  onSave: () => void;
  onBeforeRestore: () => Promise<void>;
  onDelete: () => void;
  onCopyLink: () => void;
  headingTitle?: string;
  onUseHeadingTitle: () => void;
  onAddToCollection: () => void;
  trailing?: JSX.Element;
}> = (props) => {
  const properties = () => (
    <DocPropertiesCompactEditors
      docId={props.doc.id}
      initialPath={props.doc.path}
      initialMeta={props.doc.meta}
    />
  );
  const actions = () => (
    <HStack
      gap="0.5"
      flexShrink="0"
      alignItems="center"
      order={props.stacked ? undefined : "1"}
      ml="auto"
    >
      <RecordAudioButton docId={props.doc.id} />
      <DocVersionsPopover
        docId={props.doc.id}
        onBeforeRestore={props.onBeforeRestore}
        // The editor loads its content once per note, so a restored
        // version needs a fresh load rather than a live patch.
        onRestored={() => window.location.reload()}
      />
      <DocActivitySummaryPopover
        docId={props.doc.id}
        createdAt={props.doc.createdAt}
        updatedAt={props.saveState.updatedAt}
        renderTrigger={(trigger) => (
          <DocSaveStatus
            state={props.saveState}
            onClick={trigger.onClick}
            ariaLabel={trigger.ariaLabel}
            onSave={props.onSave}
            onRetry={props.onSave}
          />
        )}
      />
      <DocSharePanel
        docId={props.doc.id}
        initialShare={props.doc.share}
        iconOnly
      />
      <DocActionsMenu
        disabled={props.busy}
        onDelete={props.onDelete}
        onCopyLink={props.onCopyLink}
        headingTitle={props.headingTitle}
        onUseHeadingTitle={props.onUseHeadingTitle}
        onAddToCollection={props.onAddToCollection}
      />
      {props.trailing}
    </HStack>
  );

  // `not-prose`: the note body's link styling must not reach header controls.
  return (
    <Show
      when={props.stacked}
      fallback={
        <HStack
          class="not-prose"
          gap="2"
          rowGap="1"
          alignItems="flex-start"
          justifyContent="space-between"
          flexWrap={{ base: "wrap", md: "nowrap" }}
        >
          <Box flex="1" minW="0" display={{ base: "contents", md: "block" }}>
            {properties()}
          </Box>
          {actions()}
        </HStack>
      }
    >
      <Stack class="not-prose" gap="1">
        {actions()}
        <Box minW="0">{properties()}</Box>
      </Stack>
    </Show>
  );
};
