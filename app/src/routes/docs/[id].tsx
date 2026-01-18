import { useNavigate, useParams } from "@solidjs/router";
import {
  type VoidComponent,
  type Accessor,
  Show,
  Suspense,
  createResource,
} from "solid-js";
import { apiFetch } from "~/utils/base-url";
import TableOfContents from "../../components/TableOfContents";
import DocumentViewer from "../../components/DocumentViewer";
import { PathEditor } from "../../components/PathEditor";
import { MetaKeyValueEditor } from "../../components/MetaKeyValueEditor";
import { Text } from "~/components/ui/text";
import { Box, Container, Grid, HStack, Stack } from "styled-system/jsx";

type DocDetail = {
  id: string;
  title: string;
  markdown: string;
  html: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  originalSource?: string | null;
  originalContentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function fetchDoc(id: string) {
  const res = await apiFetch(`/api/docs/${id}`);
  if (!res.ok) throw new Error("Failed to load doc");
  return (await res.json()) as DocDetail;
}

const DocView: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [doc] = createResource(
    () => params.id,
    (id) => fetchDoc(id!)
  );

  const handleDeleted = () => {
    console.log("[DocView] onDeleted → navigating to /");
    navigate("/");
  };

  let articleEl: HTMLElement | undefined;

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="4" px="4">
        <Box mx="auto" maxW="900px" position="relative">
          <Suspense
            fallback={
              <Text textStyle="sm" color="fg.muted">
                Loading…
              </Text>
            }
          >
            <Show when={doc()}>
              {(d: Accessor<DocDetail>) => (
                <Stack gap="4">
                  <Box
                    borderWidth="1px"
                    borderColor="gray.outline.border"
                    borderRadius="l2"
                    p="3"
                  >
                    <Grid
                      gridTemplateColumns={{
                        base: "1fr",
                        md: "repeat(2, minmax(0, 1fr))",
                      }}
                      gap="3"
                    >
                      <Stack gap="1">
                        <Text fontSize="xs" color="black.a7">
                          Path
                        </Text>
                        <PathEditor
                          docId={d().id}
                          initialPath={d().path || undefined}
                        />
                      </Stack>
                      <Stack gap="1">
                        <Text fontSize="xs" color="black.a7">
                          Key/Value metadata
                        </Text>
                        <MetaKeyValueEditor
                          docId={d().id}
                          initialMeta={d().meta as any}
                        />
                      </Stack>
                    </Grid>
                  </Box>
                  <Box as="article" ref={(el) => (articleEl = el)}>
                    <DocumentViewer doc={d()} onDeleted={handleDeleted} />
                    <Show when={d().originalContentId}>
                      {(cid) => (
                        <HStack
                          gap="2"
                          alignItems="center"
                          mt="6"
                          pt="3"
                          borderTopWidth="1px"
                          borderColor="gray.outline.border"
                        >
                          <Text as="span" fontSize="xs" color="black.a7">
                            Original content ID:
                          </Text>
                          <Box
                            as="code"
                            fontSize="xs"
                            color="black.a7"
                            display="inline"
                          >
                            {cid()}
                          </Box>
                        </HStack>
                      )}
                    </Show>
                  </Box>
                </Stack>
              )}
            </Show>
          </Suspense>
          {/* TOC attached to the right edge of the note view */}
          <TableOfContents
            getRootEl={() => {
              const root = articleEl as HTMLElement | undefined;
              if (!root) return null;
              const pm = root.querySelector(
                ".ProseMirror"
              ) as HTMLElement | null;
              return pm || root;
            }}
            maxVh={60}
          />
        </Box>
      </Container>
    </Box>
  );
};

export default DocView;
