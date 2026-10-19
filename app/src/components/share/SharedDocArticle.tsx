import { Show, createMemo } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { documentContentStyles } from "~/components/document-content-styles";
import { Text } from "~/components/ui/text";
import type { PublicSharedDoc } from "~/services/doc-shares.service";
import { ShareCopyLinkButton } from "./ShareCopyLinkButton";
import { ShareOutlineRail } from "./ShareOutlineRail";
import {
  formatShareDate,
  prepareShareHtml,
  readingMinutes,
} from "./share-reading";
import { shareReadingClass } from "./share-reading-styles";

const MIN_OUTLINE_ITEMS = 3;

type SharedDocArticleProps = {
  doc: PublicSharedDoc;
  title: string;
  shareUrl: string;
};

export const SharedDocArticle = (props: SharedDocArticleProps) => {
  const prepared = createMemo(() => prepareShareHtml(props.doc.html, props.title));
  const hasOutline = () => prepared().outline.length >= MIN_OUTLINE_ITEMS;
  const updatedLabel = () => formatShareDate(props.doc.updatedAt);

  return (
    <>
      <HStack
        role="banner"
        justify="space-between"
        maxW={{ base: "720px", xl: "1000px" }}
        mx="auto"
        px={{ base: "4", md: "8" }}
        h="14"
      >
        <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
          Visual Notes
        </Text>
        <ShareCopyLinkButton url={props.shareUrl} />
      </HStack>

      <Box
        display="grid"
        gridTemplateColumns={{
          base: "minmax(0, 1fr)",
          xl: "minmax(0, 1fr) 220px",
        }}
        columnGap="16"
        maxW={{ base: "720px", xl: "1000px" }}
        mx="auto"
        px={{ base: "4", md: "8" }}
        pt={{ base: "6", md: "12" }}
        pb={{ base: "16", md: "24" }}
      >
        <Box as="article" minW="0">
          <Box mb={{ base: "8", md: "10" }}>
            <Show when={props.doc.path}>
              {(path) => (
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  color="fg.subtle"
                  mb="3"
                  overflowWrap="anywhere"
                >
                  {path()}
                </Text>
              )}
            </Show>
            <Text
              as="h1"
              fontSize={{ base: "3xl", md: "5xl" }}
              lineHeight="1.1"
              fontWeight="bold"
              letterSpacing="-0.025em"
              textWrap="balance"
            >
              {props.title}
            </Text>
            <Text fontSize="sm" color="fg.muted" mt="4">
              <Show when={updatedLabel()}>
                {(label) => (
                  <>
                    <time datetime={props.doc.updatedAt}>Updated {label()}</time>
                    {" · "}
                  </>
                )}
              </Show>
              {readingMinutes(prepared().wordCount)} min read
            </Text>
          </Box>

          <Box class={shareReadingClass} css={documentContentStyles}>
            <Box
              class="vn-doc-content vn-share-content"
              innerHTML={prepared().html}
            />
          </Box>

          <Box
            as="footer"
            mt={{ base: "12", md: "16" }}
            pt="6"
            borderTopWidth="1px"
            borderColor="border"
          >
            <Text fontSize="sm" color="fg.muted">
              Shared from Visual Notes
            </Text>
          </Box>
        </Box>

        <Show when={hasOutline()}>
          <Box as="aside" display={{ base: "none", xl: "block" }}>
            <ShareOutlineRail items={prepared().outline} />
          </Box>
        </Show>
      </Box>
    </>
  );
};
