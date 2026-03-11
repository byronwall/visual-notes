import { Show, type VoidComponent } from "solid-js";
import { Box, Stack } from "styled-system/jsx";
import {
  formatAbsoluteTime,
  formatRelativeTime,
} from "~/features/docs-index/utils/time";
import { countMetaKeys } from "~/features/docs-index/utils/doc-preview";

export type DocPreviewSummaryProps = {
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  previewText?: string | null;
};

export const DocPreviewSummary: VoidComponent<DocPreviewSummaryProps> = (
  props
) => {
  const metaCount = () => countMetaKeys(props.meta);
  const previewText = () => {
    if (!props.previewText || props.previewText.trim().length === 0) {
      return "No preview available.";
    }
    // Strip common markdown artifacts and multiple newlines
    const cleaned = props.previewText
      .replace(/^[=#*-]+$/gm, "") // remove horizontal rules or full lines of symbols
      .replace(/[=#*-]{3,}/g, "") // remove consecutive symbols anywhere
      .replace(/\n{2,}/g, " ") // collapse newlines into spaces
      .trim();
    return cleaned || "No preview available.";
  };

  return (
    <Stack gap="2">
      <Box fontSize="sm" fontWeight="semibold" color="fg.default">
        {props.title}
      </Box>
      <Stack gap="0.5">
        <Box fontSize="xs" color="fg.muted">
          Updated {formatRelativeTime(props.updatedAt)} (
          {formatAbsoluteTime(props.updatedAt)})
        </Box>
        <Show when={props.path}>
          {(value) => (
            <Box
              fontSize="xs"
              color="fg.muted"
              fontFamily="mono"
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
  );
};
