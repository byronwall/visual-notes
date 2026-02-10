import { useNavigate, useParams } from "@solidjs/router";
import {
  type VoidComponent,
  type Accessor,
  Show,
  Suspense,
  createResource,
} from "solid-js";
import { fetchDoc } from "~/services/docs.service";
import TableOfContents from "../../components/TableOfContents";
import DocumentViewer from "../../components/DocumentViewer";
import { Text } from "~/components/ui/text";
import { Box, Container, HStack, Stack } from "styled-system/jsx";

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

const fetchDocDetail = (id: string) => fetchDoc(id) as Promise<DocDetail>;

const DocView: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [doc] = createResource(
    () => params.id,
    (id) => fetchDocDetail(id!)
  );

  const handleDeleted = () => {
    console.log("[DocView] onDeleted → navigating to /");
    navigate("/");
  };

  let articleEl: HTMLElement | undefined;

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container pt="4" pb={{ base: "24", md: "32" }} px="4">
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
            maxVh={100}
          />
        </Box>
      </Container>
    </Box>
  );
};

export default DocView;
