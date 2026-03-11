import { Meta, Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { useParams } from "@solidjs/router";
import { Box, Container, Grid, HStack, Stack, styled } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Link } from "~/components/ui/link";
import { Text } from "~/components/ui/text";
import { Badge } from "~/components/ui/badge";
import { formatRelativeTime } from "~/features/docs-index/utils/time";
import { countMetaKeys } from "~/features/docs-index/utils/doc-preview";
import { fetchUmapRegionDetail } from "~/services/umap/umap.queries";
import {
  For,
  Match,
  Show,
  Suspense,
  Switch,
  createResource,
  type VoidComponent,
} from "solid-js";

const isNotFoundError = (error: unknown) => {
  if (!error) return false;
  if (error instanceof Response) return error.status === 404;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("not found");
};

const UmapGroupDetailRoute: VoidComponent = () => {
  const params = useParams();
  const [detail] = createResource(
    () => ({
      runId: params.id || "",
      regionId: params.groupId || "",
    }),
    (input) => fetchUmapRegionDetail(input)
  );

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Container py="5" px="4" maxW="1280px">
        <Suspense
          fallback={
            <Text textStyle="sm" color="fg.muted">
              Loading group…
            </Text>
          }
        >
          <Switch>
            <Match when={detail.error}>
              {(error) => {
                const notFound = isNotFoundError(error());
                return (
                  <Stack gap="3" alignItems="flex-start">
                    <HttpStatusCode code={notFound ? 404 : 500} />
                    <Title>
                      {notFound
                        ? "UMAP group not found • Visual Notes"
                        : "Error loading UMAP group • Visual Notes"}
                    </Title>
                    <Meta
                      property="og:title"
                      content={
                        notFound
                          ? "UMAP group not found • Visual Notes"
                          : "Error loading UMAP group • Visual Notes"
                      }
                    />
                    <Text textStyle="sm" color="fg.muted">
                      {notFound
                        ? "That group could not be found for this UMAP run."
                        : "Unable to load this group right now."}
                    </Text>
                    <Link href={`/umap/${params.id}`}>Back to run</Link>
                  </Stack>
                );
              }}
            </Match>

            <Match when={!detail()}>
              <Stack gap="3" alignItems="flex-start">
                <HttpStatusCode code={404} />
                <Title>UMAP group not found • Visual Notes</Title>
                <Text textStyle="sm" color="fg.muted">
                  That group could not be found for this UMAP run.
                </Text>
                <Link href={`/umap/${params.id}`}>Back to run</Link>
              </Stack>
            </Match>

            <Match when={detail()}>
              {(result) => {
                const sampleDocIds = () => new Set(result().region.sampleDocs.map((s) => s.docId));
                const sortedDocs = () => {
                  const samples = sampleDocIds();
                  return result().docs.slice().sort((a, b) => {
                    const aSample = samples.has(a.id);
                    const bSample = samples.has(b.id);
                    if (aSample && !bSample) return -1;
                    if (!aSample && bSample) return 1;
                    return 0;
                  });
                };

                return (
                  <>
                    <Title>{`${result().region.title} • UMAP Group • Visual Notes`}</Title>
                  <Meta
                    property="og:title"
                    content={`${result().region.title} • UMAP Group • Visual Notes`}
                  />
                  <Meta name="description" content={result().region.summary} />

                  <Stack gap="5">
                    <Stack gap="2">
                      <HStack gap="3" flexWrap="wrap">
                        <Link href={`/umap/${result().run.id}`}>Back to UMAP run</Link>
                        <Text textStyle="xs" color="fg.muted">
                          Run {result().run.id.slice(0, 8)}
                        </Text>
                      </HStack>
                      <Heading as="h1" fontSize="3xl">
                        {result().region.title}
                      </Heading>
                      <Text textStyle="sm" color="fg.muted" maxW="860px">
                        {result().region.summary}
                      </Text>
                      <HStack gap="3" flexWrap="wrap">
                        <Text textStyle="xs" color="fg.muted">
                          {result().docs.length} notes
                        </Text>
                      </HStack>
                    </Stack>

                    <Stack gap="8">
                      <Grid gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }} gap="6">
                        <For each={sortedDocs()}>
                          {(doc) => {
                            const isSample = sampleDocIds().has(doc.id);
                            return (
                              <styled.a
                                href={`/docs/${doc.id}`}
                                bg="bg.subtle"
                                borderRadius="l3"
                                display="flex"
                                flexDirection="column"
                                h="full"
                                borderWidth="1px"
                                borderColor="border"
                                overflow="hidden"
                                transition="all 0.2s"
                                _hover={{ borderColor: "border.accent", transform: "translateY(-2px)", boxShadow: "sm", cursor: "pointer" }}
                              >
                                {(() => {
                                  const previewRaw = doc.previewText || "";
                                  const previewCleaned = previewRaw
                                    .replace(/^[=#*-]+$/gm, "")
                                    .replace(/[=#*-]{3,}/g, "")
                                    .replace(/\n{2,}/g, " ")
                                    .trim() || "No preview available.";
                                  
                                  return (
                                    <>
                                      <Stack gap="1.5" flex="1" p="4">
                                        <Box fontSize="sm" fontWeight="semibold" color="fg.default">
                                          {doc.title}
                                        </Box>
                                        <Box
                                          fontSize="xs"
                                          color="fg.muted"
                                          style={{
                                            display: "-webkit-box",
                                            "-webkit-line-clamp": "4",
                                            "-webkit-box-orient": "vertical",
                                            overflow: "hidden",
                                          }}
                                        >
                                          {previewCleaned}
                                        </Box>
                                      </Stack>
                                      
                                      <HStack justify="space-between" alignItems="center" px="4" py="2" bg="bg.muted">
                                        <Text textStyle="xs" color="fg.muted">
                                          {formatRelativeTime(doc.updatedAt)}
                                        </Text>
                                        <Show when={isSample}>
                                          <Badge variant="subtle" size="sm" colorPalette="blue">Sample</Badge>
                                        </Show>
                                      </HStack>
                                    </>
                                  );
                                })()}
                              </styled.a>
                            );
                          }}
                        </For>
                      </Grid>

                      <Box bg="bg.subtle" borderRadius="l3" p="5" borderWidth="1px" borderColor="border">
                        <Stack gap="4">
                          <Heading as="h2" fontSize="lg">
                            Sample Notes Context
                          </Heading>
                          <Grid gridTemplateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="4">
                            <For each={result().region.sampleDocs}>
                              {(sample) => (
                                <Stack gap="1" bg="bg.default" p="3" borderRadius="l2" borderWidth="1px" borderColor="border">
                                  <Link href={`/docs/${sample.docId}`}>{sample.title}</Link>
                                  <Text textStyle="xs" color="fg.muted">
                                    {sample.excerpt}
                                  </Text>
                                </Stack>
                              )}
                            </For>
                          </Grid>
                        </Stack>
                      </Box>
                    </Stack>
                  </Stack>
                  </>
                );
              }}
            </Match>
          </Switch>
        </Suspense>
      </Container>
    </Box>
  );
};

export default UmapGroupDetailRoute;
