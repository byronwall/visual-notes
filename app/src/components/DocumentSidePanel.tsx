import { useAction } from "@solidjs/router";
import {
  Show,
  Suspense,
  createResource,
  createEffect,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { Box, Flex } from "styled-system/jsx";
import { CloseButton } from "~/components/ui/close-button";
import { Text } from "~/components/ui/text";
import { SidePanel } from "./SidePanel";
import DocumentViewer from "./DocumentViewer";
import { InPlaceEditableText } from "./InPlaceEditableText";
import { fetchDoc, updateDoc } from "~/services/docs.service";

type DocDetail = {
  id: string;
  title: string;
  markdown?: string;
  html?: string;
  createdAt?: string;
  updatedAt?: string;
};

const fetchDocDetail = (id: string) => fetchDoc(id) as Promise<DocDetail>;

export const DocumentSidePanel: VoidComponent<{
  open: boolean;
  docId?: string;
  onClose: (shouldRefetch?: boolean) => void;
}> = (props) => {
  const [doc] = createResource(
    () => props.docId,
    (id) => fetchDocDetail(id),
  );
  const [title, setTitle] = createSignal("");
  const runUpdateDoc = useAction(updateDoc);

  createEffect(() => {
    const current = doc();
    if (!current) return;
    setTitle(current.title);
  });

  const handleTitleCommit = async (nextTitle: string) => {
    if (!props.docId) return;
    const previous = title();
    const normalized = nextTitle.trim();
    if (!normalized || normalized === previous) return;
    setTitle(normalized);
    try {
      await runUpdateDoc({ id: props.docId, title: normalized });
    } catch (error) {
      setTitle(previous);
      alert((error as Error).message || "Failed to update title");
    }
  };

  return (
    <SidePanel
      open={props.open}
      onClose={() => props.onClose(false)}
      ariaLabel="Document details"
    >
      <Box
        position="sticky"
        top="0"
        zIndex="10"
        px="3"
        pt="3"
        pb="2"
        borderBottomWidth="1px"
        borderColor="border"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0.98), rgba(255,255,255,0.9))",
        }}
      >
        <Flex align="flex-start" justify="space-between" gap="3">
          <Box flex="1" minW="0">
            <InPlaceEditableText
              value={title()}
              placeholder="Untitled note"
              onCommit={handleTitleCommit}
              fontSize="2xl"
              lineHeight="1.05"
              fontWeight="semibold"
              fillWidth
              wrapPreview
            />
          </Box>
          <CloseButton
            size="xs"
            aria-label="Close panel"
            title="Close panel"
            onClick={() => props.onClose(false)}
          />
        </Flex>
      </Box>

      <Box px="3" py="3">
        <Suspense
          fallback={
            <Text fontSize="sm" color="fg.muted">
              Loading…
            </Text>
          }
        >
          <Show when={doc()} keyed>
            {(d) => (
              <DocumentViewer
                doc={{ ...d, title: title() || d.title }}
                panelMode
                fullPageHref={props.docId ? `/docs/${props.docId}` : undefined}
                onDeleted={() => props.onClose(true)}
              />
            )}
          </Show>
        </Suspense>
      </Box>
    </SidePanel>
  );
};
