import { A } from "@solidjs/router";
import { formatRelativeTime } from "../utils/time";
import { renderHighlighted } from "../utils/highlight";
import { MetaChips } from "./MetaChips";
import { Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Box, Flex, HStack, Stack } from "styled-system/jsx";
import * as Checkbox from "~/components/ui/checkbox";

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
}) => {
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
        <HStack gap="0.5rem" minW="0">
          <Checkbox.Root
            checked={!!props.selected}
            onCheckedChange={(details) => handleToggle(details.checked === true)}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Root>
          <Stack gap="0.15rem" minW="0">
            <Box as={A} href={`/docs/${props.id}`} minW="0">
              <Show when={props.query}>
                {(query) => (
                  <Text
                    fontSize="sm"
                    color="black.a7"
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
            </Box>
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
                {path()}
              </Button>
            )}
          </Show>
          <MetaChips meta={props.meta} onClick={props.onFilterMeta} />
          <Text
            fontSize="sm"
            color="black.a7"
            title={`Updated ${new Date(props.updatedAt).toLocaleString()}`}
          >
            {formatRelativeTime(props.updatedAt)}
          </Text>
        </HStack>
      </Flex>
    </Box>
  );
};
