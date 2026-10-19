import { createAsync, useParams } from "@solidjs/router";
import { Match, Suspense, Switch } from "solid-js";
import { Box } from "styled-system/jsx";
import { ShareNotFound } from "~/components/share/ShareNotFound";
import { SharedDocArticle } from "~/components/share/SharedDocArticle";
import { SharedDocHead } from "~/components/share/SharedDocHead";
import {
  fetchPublicSharedDoc,
  type PublicSharedDoc,
} from "~/services/doc-shares.service";
import { buildShareAbsoluteUrl } from "~/services/doc-shares.shared";
import { getBaseUrl } from "~/utils/base-url";

const fallbackDescription = "Open a shared note from Visual Notes.";
const emptyPreviewText = "No preview available.";

const resolveShareTitle = (doc: PublicSharedDoc) => {
  const title = doc.title.trim();
  return title.length > 0 ? title : "Untitled note";
};

const resolveShareDescription = (doc: PublicSharedDoc) => {
  const preview = doc.previewText.trim();
  if (preview.length > 0 && preview !== emptyPreviewText) return preview;
  return fallbackDescription;
};

export default function SharedDocRoute() {
  const params = useParams();
  const sharedDoc = createAsync(
    (): Promise<PublicSharedDoc | null> => fetchPublicSharedDoc(params.slug || ""),
    { deferStream: true },
  );

  const shareUrlFor = (doc: PublicSharedDoc) =>
    buildShareAbsoluteUrl(getBaseUrl(), doc.share.shareUrl);
  const ogImageUrlFor = (doc: PublicSharedDoc) =>
    `${getBaseUrl()}/share-og/${doc.share.slug}`;

  return (
    <Box as="main" minH="100vh" bg="bg.default" color="fg.default">
      <Suspense fallback={<Box minH="100vh" aria-busy="true" />}>
        <Switch>
          <Match when={sharedDoc()}>
            {(doc) => (
              <>
                <SharedDocHead
                  title={resolveShareTitle(doc())}
                  description={resolveShareDescription(doc())}
                  url={shareUrlFor(doc())}
                  imageUrl={ogImageUrlFor(doc())}
                  modifiedAt={doc().updatedAt}
                />
                <SharedDocArticle
                  doc={doc()}
                  title={resolveShareTitle(doc())}
                  shareUrl={shareUrlFor(doc())}
                />
              </>
            )}
          </Match>
          <Match when={sharedDoc.latest === null}>
            <ShareNotFound />
          </Match>
        </Switch>
      </Suspense>
    </Box>
  );
}
