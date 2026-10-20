import { useNavigate, useParams } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import {
  type VoidComponent,
  type Accessor,
  Match,
  Switch,
  Suspense,
  createResource,
} from "solid-js";
import { fetchDoc } from "~/services/docs.service";
import TableOfContents from "../../components/TableOfContents";
import DocumentViewer from "../../components/DocumentViewer";
import { Text } from "~/components/ui/text";
import { Button } from "~/components/ui/button";
import { Box, Container, Stack } from "styled-system/jsx";
import { Skeleton } from "~/components/ui/skeleton";
import { useMobileBarTitleOnScroll } from "~/components/sidebar/useMobileBarTitleOnScroll";

import type { NoteDoc } from "~/lib/note-content/types";

type DocDetail = {
  id: string;
  title: string;
  content: NoteDoc;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  originalSource?: string | null;
  originalContentId?: string | null;
  createdAt: string;
  updatedAt: string;
  share?: {
    id: string;
    slug: string;
    shareUrl: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

const fetchDocDetail = (id: string) => fetchDoc(id) as Promise<DocDetail>;

const isNotFoundError = (error: unknown) => {
  if (!error) return false;
  if (error instanceof Response) return error.status === 404;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("not found");
};

// Comfortable reading measure (~70 characters of body text).
const NOTE_MEASURE = "46rem";
const NoteSkeleton: VoidComponent = () => (
  <Stack gap="4" aria-busy="true" aria-label="Loading note">
    <Skeleton h="5" w="16rem" />
    <Skeleton h="9" w="70%" />
    <Stack gap="2.5">
      <Skeleton h="4" w="full" />
      <Skeleton h="4" w="full" />
      <Skeleton h="4" w="85%" />
    </Stack>
  </Stack>
);

const DocView: VoidComponent = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [doc] = createResource(
    () => params.id,
    (id) => fetchDocDetail(id!),
  );

  const handleDeleted = (deletedDocId: string) => {
    if (params.id !== deletedDocId) return;
    console.log("[DocView] onDeleted → navigating to /");
    navigate("/");
  };

  let articleEl: HTMLElement | undefined;
  useMobileBarTitleOnScroll({
    // Gate on state so this read never suspends the page shell.
    title: () =>
      doc.state === "ready" || doc.state === "refreshing"
        ? doc.latest?.title
        : undefined,
    getHeadingEl: () => articleEl?.querySelector<HTMLElement>("h1"),
  });

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container
        pt={{ base: "3", md: "4" }}
        pb="24"
        px={{ base: "4", md: "6" }}
      >
        <Box position="relative">
          <Suspense
            fallback={
              <Box mx="auto" maxW={NOTE_MEASURE}>
                <NoteSkeleton />
              </Box>
            }
          >
            <Switch>
              <Match when={doc.error}>
                {(error) => {
                  const notFound = isNotFoundError(error());
                  return (
                    <Stack
                      gap="4"
                      alignItems="flex-start"
                      mx="auto"
                      maxW={NOTE_MEASURE}
                      pt="10"
                    >
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
                      <Stack gap="1">
                        <Text fontSize="xl" fontWeight="semibold">
                          {notFound ? "Note not found" : "Couldn't load note"}
                        </Text>
                        <Text fontSize="sm" color="fg.muted">
                          {notFound
                            ? "It may have been deleted, or the link is wrong."
                            : "Something went wrong on our side. Try again in a moment."}
                        </Text>
                      </Stack>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/")}
                      >
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
                    <Box
                      as="article"
                      ref={(el) => (articleEl = el)}
                      mx="auto"
                      maxW={NOTE_MEASURE}
                    >
                      <DocumentViewer doc={d()} onDeleted={handleDeleted} />
                    </Box>
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
                ".ProseMirror",
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
