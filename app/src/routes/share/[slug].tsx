import { Meta, Title } from "@solidjs/meta";
import { A, createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Match, Show, Suspense, Switch } from "solid-js";
import { Box, Container, Stack } from "styled-system/jsx";
import { ReadOnlyDocumentContent } from "~/components/ReadOnlyDocumentContent";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import {
  fetchPublicSharedDoc,
  type PublicSharedDoc,
} from "~/services/doc-shares.service";
import { buildShareAbsoluteUrl } from "~/services/doc-shares.shared";
import { getBaseUrl } from "~/utils/base-url";

const loadingTitle = "Shared note • Visual Notes";
const notFoundTitle = "Shared note not found • Visual Notes";
const loadingDescription = "Open a shared note from Visual Notes.";
const notFoundDescription =
  "That shared note no longer exists or is no longer public.";
const emptyPreviewText = "No preview available.";

const resolveShareTitle = (doc: PublicSharedDoc) => {
  const title = doc.title.trim();
  return title.length > 0 ? title : "Untitled note";
};

const resolveShareDescription = (doc: PublicSharedDoc) => {
  const preview = doc.previewText.trim();
  if (preview.length > 0 && preview !== emptyPreviewText) return preview;
  return loadingDescription;
};

export default function SharedDocRoute() {
  const params = useParams();
  const sharedDoc = createAsync(
    (): Promise<PublicSharedDoc | null> => fetchPublicSharedDoc(params.slug || ""),
  );

  const shareUrl = () => {
    const current = sharedDoc();
    if (!current) return "";
    return buildShareAbsoluteUrl(getBaseUrl(), current.share.shareUrl);
  };
  const ogImageUrl = () => {
    const current = sharedDoc();
    if (!current) return `${getBaseUrl()}/og-image.png`;
    return `${getBaseUrl()}/share-og/${current.share.slug}`;
  };

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Title>{loadingTitle}</Title>
      <Meta property="og:title" content={loadingTitle} />
      <Meta name="description" content={loadingDescription} />
      <Meta property="og:description" content={loadingDescription} />
      <Meta property="og:type" content="article" />
      <Meta property="og:image" content={`${getBaseUrl()}/og-image.png`} />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={loadingTitle} />
      <Meta name="twitter:description" content={loadingDescription} />
      <Meta name="twitter:image" content={`${getBaseUrl()}/og-image.png`} />
      <Container pt="4" pb={{ base: "24", md: "32" }} px="4">
        <Suspense
          fallback={
            <Text textStyle="sm" color="fg.muted">
              Loading shared note…
            </Text>
          }
        >
          <Box mx="auto" maxW="900px" position="relative">
            <Switch>
              <Match when={sharedDoc()}>
                {(doc) => (
                  <>
                    <Title>{`${resolveShareTitle(doc())} • Visual Notes`}</Title>
                    <Meta property="og:title" content={resolveShareTitle(doc())} />
                    <Meta
                      name="description"
                      content={resolveShareDescription(doc())}
                    />
                    <Meta
                      property="og:description"
                      content={resolveShareDescription(doc())}
                    />
                    <Meta property="og:type" content="article" />
                    <Meta property="og:url" content={shareUrl()} />
                    <Meta property="og:image" content={ogImageUrl()} />
                    <Meta
                      property="og:image:alt"
                      content={`Preview image for ${resolveShareTitle(doc())}`}
                    />
                    <Meta name="twitter:card" content="summary_large_image" />
                    <Meta
                      name="twitter:title"
                      content={resolveShareTitle(doc())}
                    />
                    <Meta
                      name="twitter:description"
                      content={resolveShareDescription(doc())}
                    />
                    <Meta name="twitter:image" content={ogImageUrl()} />
                    <Meta
                      name="twitter:image:alt"
                      content={`Preview image for ${resolveShareTitle(doc())}`}
                    />

                    <Stack gap="4">
                      <Stack gap="3">
                        <Text
                          fontSize="xs"
                          fontWeight="medium"
                          color="fg.muted"
                        >
                          Shared from Visual Notes
                        </Text>
                        <Text
                          as="h1"
                          fontSize="4xl"
                          lineHeight="1.1"
                          fontWeight="semibold"
                        >
                          {resolveShareTitle(doc())}
                        </Text>
                        <Show when={doc().path}>
                          {(path) => (
                            <Box
                              as="span"
                              w="fit-content"
                              px="3"
                              py="1.5"
                              borderWidth="1px"
                              borderColor="gray.outline.border"
                              borderRadius="full"
                              bg="bg.default"
                              color="fg.default"
                              fontSize="xs"
                              fontFamily="mono"
                              fontWeight="medium"
                            >
                              {path()}
                            </Box>
                          )}
                        </Show>
                      </Stack>
                      <ReadOnlyDocumentContent html={doc().html} />
                    </Stack>
                  </>
                )}
              </Match>
              <Match when={sharedDoc.latest === null}>
                <Stack gap="3" alignItems="flex-start">
                  <HttpStatusCode code={404} />
                  <Title>{notFoundTitle}</Title>
                  <Meta property="og:title" content={notFoundTitle} />
                  <Meta name="description" content={notFoundDescription} />
                  <Meta property="og:description" content={notFoundDescription} />
                  <Meta name="twitter:title" content={notFoundTitle} />
                  <Meta
                    name="twitter:description"
                    content={notFoundDescription}
                  />
                  <Text fontSize="sm" color="fg.muted">
                    This share link is no longer available.
                  </Text>
                  <A href="/login">
                    <Button variant="outline">Open Visual Notes</Button>
                  </A>
                </Stack>
              </Match>
            </Switch>
          </Box>
        </Suspense>
      </Container>
    </Box>
  );
}
