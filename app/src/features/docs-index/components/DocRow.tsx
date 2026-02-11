import { formatAbsoluteTime, formatRelativeTime } from "../utils/time";
import { renderHighlighted } from "../utils/highlight";
import { MetaChips } from "./MetaChips";
import { Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { DocHoverPreviewLink } from "~/components/docs/DocHoverPreviewLink";
import { Text } from "~/components/ui/text";
import { Box, Flex, HStack, Stack } from "styled-system/jsx";
import * as Checkbox from "~/components/ui/checkbox";
import { css } from "styled-system/css";

export const DocRow = (props: {
  id: string;
  title: string;
  updatedAt: string;
  path?: string | null;
  meta?: Record<string, unknown> | null;
  snippet?: string | null;
  query?: string;
  onFilterPath?: (p: string) => void;
  onFilterMeta?: (k: string, v: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string, next: boolean) => void;
  previewDoc?: {
    markdown?: string | null;
    html?: string | null;
    path?: string | null;
    meta?: Record<string, unknown> | null;
  } | null;
}) => {
  const titleLinkClass = css({
    display: "block",
    minWidth: "0",
    color: "inherit",
    textDecorationLine: "none",
  });

  const handleToggle = (next: boolean) => {
    try {
      console.log("[DocRow] toggle select id=", props.id, "next=", next);
    } catch {}
    props.onToggleSelect?.(props.id, next);
  };
  return (
    <Box
      as="li"
      borderWidth="1px"
      borderColor="gray.outline.border"
      borderRadius="l2"
      px="0.75rem"
      py="0.65rem"
      bg="white"
      _hover={{ bg: "gray.surface.bg.hover" }}
    >
      <Flex align="center" justify="space-between" gap="0.75rem">
        <HStack gap="0.5rem" minW="0" alignItems="flex-start">
          <Checkbox.Root
            checked={!!props.selected}
            onCheckedChange={(details) =>
              handleToggle(details.checked === true)
            }
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Root>
          <Stack gap="0.15rem" minW="0">
            <DocHoverPreviewLink
              href={`/docs/${props.id}`}
              title={props.title}
              updatedAt={props.updatedAt}
              path={props.path}
              meta={props.meta}
              snippet={props.snippet}
              previewDoc={props.previewDoc}
              triggerClass={titleLinkClass}
            >
              <Show when={props.query}>
                {(query) => (
                  <Text
                    fontSize="sm"
                    fontWeight="medium"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    _hover={{ textDecoration: "underline" }}
                  >
                    {renderHighlighted(props.title, query())}
                  </Text>
                )}
              </Show>
              <Show when={!props.query}>
                <Text
                  fontSize="sm"
                  fontWeight="medium"
                  _hover={{ textDecoration: "underline" }}
                >
                  {props.title}
                </Text>
              </Show>
            </DocHoverPreviewLink>
            <Show when={props.snippet}>
              {(snippet) => (
                <Text fontSize="xs" color="black.a7" lineClamp="2">
                  <Show when={props.query} fallback={snippet()}>
                    {(query) => renderHighlighted(snippet(), query())}
                  </Show>
                </Text>
              )}
            </Show>
          </Stack>
        </HStack>
        <HStack gap="0.5rem" flexWrap="wrap" justifyContent="flex-end">
          <Show when={props.path}>
            {(path) => (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => props.onFilterPath?.(path())}
                title={`Filter by path: ${path()}`}
              >
                <Show when={props.query} fallback={path()}>
                  {(query) => renderHighlighted(path(), query())}
                </Show>
              </Button>
            )}
          </Show>
          <MetaChips meta={props.meta} onClick={props.onFilterMeta} />
          <Text
            fontSize="sm"
            color="black.a7"
            title={`Updated ${formatAbsoluteTime(props.updatedAt)}`}
          >
            {formatRelativeTime(props.updatedAt)}
          </Text>
        </HStack>
      </Flex>
    </Box>
  );
};
