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

const notFoundTitle = "Shared note not found • Visual Notes";

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
    <Box as="main" minH="100vh" bg="bg.subtle">
      <Container maxW="960px" py={{ base: "8", md: "14" }} px="4">
        <Suspense
          fallback={
            <Text textStyle="sm" color="fg.muted">
              Loading shared note…
            </Text>
          }
        >
          <Switch>
            <Match when={!sharedDoc()}>
              <Stack gap="3" alignItems="flex-start">
                <HttpStatusCode code={404} />
                <Title>{notFoundTitle}</Title>
                <Meta property="og:title" content={notFoundTitle} />
                <Meta
                  name="description"
                  content="That shared note no longer exists or is no longer public."
                />
                <Meta
                  property="og:description"
                  content="That shared note no longer exists or is no longer public."
                />
                <Text fontSize="sm" color="fg.muted">
                  This share link is no longer available.
                </Text>
                <A href="/login">
                  <Button variant="outline">Open Visual Notes</Button>
                </A>
              </Stack>
            </Match>
            <Match when={sharedDoc()}>
              {(doc) => (
                <>
                  <Title>{`${doc().title} • Visual Notes`}</Title>
                  <Meta property="og:title" content={doc().title} />
                  <Meta name="description" content={doc().previewText} />
                  <Meta property="og:description" content={doc().previewText} />
                  <Meta property="og:type" content="article" />
                  <Meta property="og:url" content={shareUrl()} />
                  <Meta property="og:image" content={ogImageUrl()} />
                  <Meta name="twitter:card" content="summary_large_image" />
                  <Meta name="twitter:title" content={doc().title} />
                  <Meta name="twitter:description" content={doc().previewText} />
                  <Meta name="twitter:image" content={ogImageUrl()} />

                  <Stack gap="5">
                    <Stack gap="2">
                      <Text
                        fontSize="xs"
                        letterSpacing="0.14em"
                        textTransform="uppercase"
                        color="fg.muted"
                      >
                        Shared from Visual Notes
                      </Text>
                      <Text
                        as="h1"
                        fontSize={{ base: "3xl", md: "5xl" }}
                        lineHeight="1.05"
                        fontWeight="700"
                      >
                        {doc().title}
                      </Text>
                      <Show when={doc().path}>
                        {(path) => (
                          <Box
                            as="span"
                            w="fit-content"
                            px="2.5"
                            py="1"
                            borderRadius="full"
                            bg="bg.default"
                            color="fg.muted"
                            fontSize="xs"
                            fontFamily="mono"
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
          </Switch>
        </Suspense>
      </Container>
    </Box>
  );
}
