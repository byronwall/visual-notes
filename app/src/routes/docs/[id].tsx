import { useNavigate, useParams } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import {
  type VoidComponent,
  type Accessor,
  Match,
  Show,
  Switch,
  Suspense,
  createResource,
} from "solid-js";
import { fetchDoc } from "~/services/docs.service";
import TableOfContents from "../../components/TableOfContents";
import DocumentViewer from "../../components/DocumentViewer";
import { Text } from "~/components/ui/text";
import { Button } from "~/components/ui/button";
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

const isNotFoundError = (error: unknown) => {
  if (!error) return false;
  if (error instanceof Response) return error.status === 404;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("not found");
};

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
            <Switch>
              <Match when={doc.error}>
                {(error) => {
                  const notFound = isNotFoundError(error());
                  return (
                    <Stack gap="3" alignItems="flex-start">
                      <HttpStatusCode code={notFound ? 404 : 500} />
                      <Title>
                        {notFound
                          ? "Note not found • Visual Notes"
                          : "Error loading note • Visual Notes"}
                      </Title>
                      <Meta
                        property="og:title"
                        content={
                          notFound
                            ? "Note not found • Visual Notes"
                            : "Error loading note • Visual Notes"
                        }
                      />
                      <Meta
                        name="description"
                        content={
                          notFound
                            ? "The requested note does not exist."
                            : "There was a problem loading this note."
                        }
                      />
                      <Meta
                        property="og:description"
                        content={
                          notFound
                            ? "The requested note does not exist."
                            : "There was a problem loading this note."
                        }
                      />
                      <Text fontSize="sm" color="fg.muted">
                        {notFound
                          ? "This note could not be found."
                          : "Unable to load this note right now."}
                      </Text>
                      <Button variant="outline" onClick={() => navigate("/")}>
                        Go home
                      </Button>
                    </Stack>
                  );
                }}
              </Match>
              <Match when={doc()}>
                {(d: Accessor<DocDetail>) => (
                  <>
                    <Title>{`${d().title} • Visual Notes`}</Title>
                    <Meta
                      property="og:title"
                      content={`${d().title} • Visual Notes`}
                    />
                    <Meta
                      name="description"
                      content={`Open note: ${d().title}`}
                    />
                    <Meta
                      property="og:description"
                      content={`Open note: ${d().title}`}
                    />
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
                  </>
                )}
              </Match>
            </Switch>
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
