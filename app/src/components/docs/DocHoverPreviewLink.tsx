import { Show, createSignal, onMount, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { Box, Stack } from "styled-system/jsx";
import { css } from "styled-system/css";
import * as HoverCard from "~/components/ui/hover-card";
import {
  formatAbsoluteTime,
  formatRelativeTime,
} from "~/features/docs-index/utils/time";
import {
  buildDocPreviewText,
  countMetaKeys,
  normalizePreviewText,
} from "~/features/docs-index/utils/doc-preview";

type DocHoverPreviewLinkProps = {
  href: string;
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  snippet?: string | null;
  previewDoc?: {
    markdown?: string | null;
    html?: string | null;
    path?: string | null;
    meta?: Record<string, unknown> | null;
  } | null;
  triggerClass: string;
  onNavigate?: () => void;
  children: JSX.Element;
};

const contentLinkClass = css({
  display: "block",
  color: "inherit",
  textDecorationLine: "none",
});

export const DocHoverPreviewLink = (props: DocHoverPreviewLinkProps) => {
  const [mounted, setMounted] = createSignal(false);

  onMount(() => {
    setMounted(true);
  });

  const previewText = () => {
    const doc = props.previewDoc;
    if (doc) return buildDocPreviewText(doc.markdown, doc.html);
    const snippet = normalizePreviewText(props.snippet || "");
    if (snippet.length > 0) return snippet.slice(0, 240);
    return "No preview available.";
  };

  const path = () => props.previewDoc?.path ?? props.path;
  const metaCount = () => countMetaKeys(props.previewDoc?.meta ?? props.meta);

  return (
    <Show
      when={mounted()}
      fallback={
        <a
          href={props.href}
          class={props.triggerClass}
          onClick={props.onNavigate}
        >
          {props.children}
        </a>
      }
    >
      <HoverCard.Root
        openDelay={100}
        closeDelay={100}
        positioning={{
          placement: "right-start",
          offset: { mainAxis: 8 },
          strategy: "fixed",
        }}
      >
        <HoverCard.Trigger
          asChild={(triggerProps) => (
            <a
              {...triggerProps}
              href={props.href}
              class={props.triggerClass}
              onClick={props.onNavigate}
            >
              {props.children}
            </a>
          )}
        />
        <Portal>
          <HoverCard.Positioner>
            <HoverCard.Content maxW="320px">
              <a
                href={props.href}
                class={contentLinkClass}
                onClick={props.onNavigate}
              >
                <Stack gap="2">
                  <Box fontSize="sm" fontWeight="semibold" color="fg.default">
                    {props.title}
                  </Box>
                  <Stack gap="0.5">
                    <Box fontSize="xs" color="fg.muted">
                      Updated {formatRelativeTime(props.updatedAt)} (
                      {formatAbsoluteTime(props.updatedAt)})
                    </Box>
                    <Show when={path()}>
                      {(value) => (
                        <Box
                          fontSize="xs"
                          color="fg.muted"
                          whiteSpace="nowrap"
                          overflow="hidden"
                          textOverflow="ellipsis"
                        >
                          Path {value()}
                        </Box>
                      )}
                    </Show>
                    <Show when={metaCount() > 0}>
                      <Box fontSize="xs" color="fg.muted">
                        Meta keys {metaCount()}
                      </Box>
                    </Show>
                  </Stack>
                  <Box borderTopWidth="1px" borderColor="border" />
                  <Box
                    fontSize="xs"
                    color="fg.default"
                    style={{
                      display: "-webkit-box",
                      "-webkit-line-clamp": "2",
                      "-webkit-box-orient": "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {previewText()}
                  </Box>
                </Stack>
              </a>
            </HoverCard.Content>
          </HoverCard.Positioner>
        </Portal>
      </HoverCard.Root>
    </Show>
  );
};
