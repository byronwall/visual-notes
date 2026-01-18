import {
  Show,
  Suspense,
  createResource,
  createSignal,
  type VoidComponent,
} from "solid-js";
import { Box, Flex, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { SidePanel } from "./SidePanel";
import { apiFetch } from "~/utils/base-url";
import DocumentViewer from "./DocumentViewer";
import { TitleEditPopover } from "./TitleEditPopover";
import { extractFirstHeading } from "~/utils/extractHeading";
import { updateDocTitle } from "~/services/docs.service";

type DocDetail = {
  id: string;
  title: string;
  markdown?: string;
  html?: string;
  createdAt?: string;
  updatedAt?: string;
};

async function fetchDoc(id: string): Promise<DocDetail> {
  const res = await apiFetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as DocDetail;
}

export const DocumentSidePanel: VoidComponent<{
  open: boolean;
  docId?: string;
  onClose: (shouldRefetch?: boolean) => void;
}> = (props) => {
  const [doc, { refetch }] = createResource(
    () => props.docId,
    (id) => fetchDoc(id)
  );
  const [editing, setEditing] = createSignal(false);

  const handleCancelEdit = () => setEditing(false);
  const handleConfirmEdit = async (newTitle: string) => {
    if (!props.docId) return;
    try {
      await updateDocTitle(props.docId, newTitle);
      await refetch();
      console.log("[SidePanel] title updated → refetched");
    } catch (e) {
      alert((e as Error).message || "Failed to update title");
    } finally {
      setEditing(false);
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
        borderBottomWidth="1px"
        borderColor="border"
        px="4"
        py="3"
        bg="bg.default"
        style={{
          background: "rgba(255,255,255,0.95)",
          "backdrop-filter": "blur(10px)",
        }}
      >
        <Flex align="center" gap="2">
          <Box minW="0" position="relative">
            <Text fontSize="xs" color="fg.muted">
              Note
            </Text>
            <HStack gap="2" alignItems="center" minW="0">
              <Suspense
                fallback={<Text fontSize="sm">Loading…</Text>}
              >
                <Show when={doc()}>
                  {(d) => {
                    const firstH1 = () =>
                      extractFirstHeading({
                        markdown: d().markdown,
                        html: d().html,
                      }) || "";
                    const showSync = () =>
                      firstH1() && firstH1() !== d().title;
                    const handleSync = async () => {
                      if (!props.docId) return;
                      const newTitle = firstH1();
                      if (!newTitle) return;
                      try {
                        console.log("[SidePanel] sync title to H1:", newTitle);
                      } catch {}
                      try {
                        await updateDocTitle(props.docId, newTitle);
                        await refetch();
                      } catch (e) {
                        alert((e as Error).message || "Failed to sync title");
                      }
                    };
                    return (
                      <>
                        <Text
                          fontSize="sm"
                          fontWeight="medium"
                          color="fg.default"
                          maxW="16rem"
                          overflow="hidden"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                          title={d().title}
                        >
                          {d().title}
                        </Text>
                        <TitleEditPopover
                          open={editing()}
                          onOpenChange={(open) => {
                            if (open) {
                              console.log(
                                "[DocumentSidePanel] open title edit"
                              );
                            }
                            setEditing(open);
                          }}
                          initialTitle={d().title}
                          onConfirm={handleConfirmEdit}
                          onCancel={handleCancelEdit}
                          trigger={
                            <IconButton
                              variant="plain"
                              size="xs"
                              aria-label="Edit title"
                              title="Edit title"
                            >
                              ✏️
                            </IconButton>
                          }
                        />
                        <Show when={showSync()}>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={handleSync}
                            title={`Match H1: ${firstH1()}`}
                          >
                            Match H1
                          </Button>
                        </Show>
                      </>
                    );
                  }}
                </Show>
              </Suspense>
            </HStack>
          </Box>
          <Link
            ml="auto"
            fontSize="xs"
            color="blue.9"
            href={props.docId ? `/docs/${props.docId}` : "#"}
            onClick={(e) => {
              if (!props.docId) e.preventDefault();
            }}
          >
            Open full page
          </Link>
          <IconButton
            variant="plain"
            size="xs"
            aria-label="Close panel"
            onClick={() => props.onClose(false)}
          >
            ✕
          </IconButton>
        </Flex>
      </Box>

      <Box px="4" py="4">
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
                doc={d}
                onDeleted={() => {
                  try {
                    console.log(
                      "[DocumentSidePanel] onDeleted → closing panel"
                    );
                  } catch {}
                  props.onClose(true);
                }}
              />
            )}
          </Show>
        </Suspense>
      </Box>
    </SidePanel>
  );
};
