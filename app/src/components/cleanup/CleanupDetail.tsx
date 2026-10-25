import { A } from "@solidjs/router";
import { For, Match, Show, Switch, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import { DistillPanel } from "./DistillPanel";
import { PanelSection } from "./PanelSection";

export type DetailHandlers = {
  onDone: () => void;
  onKeep: () => void;
  onSkip: () => void;
};

/** The selected note: why it is here, then the bucket's action panel. */
export const CleanupDetail: VoidComponent<
  DetailHandlers & { item: CleanupItemDetail }
> = (props) => (
  <Stack gap="4" h="full" minH="0" data-testid="cleanup-detail">
    <Stack gap="1.5">
      <Heading as="h2" fontSize="lg" lineHeight="tight">
        <A href={`/docs/${props.item.docId}`}>
          {props.item.title || "Untitled note"}
        </A>
      </Heading>
      <HStack gap="2">
        <Show when={props.item.path}>
          {(path) => (
            <Badge size="sm" variant="outline">
              {path()}
            </Badge>
          )}
        </Show>
        <Text fontSize="xs" color="fg.subtle">
          {props.item.model}
        </Text>
      </HStack>
    </Stack>
    <PanelSection title="Why it is here">
      <HStack gap="1.5" flexWrap="wrap">
        <For each={props.item.signals}>
          {(signal) => (
            <Box
              px="2"
              py="1"
              borderRadius="l2"
              fontSize="xs"
              bg={signal.tone === "strong" ? "amber.a3" : "gray.a3"}
              color={signal.tone === "strong" ? "amber.11" : "fg.default"}
            >
              {signal.label}
            </Box>
          )}
        </For>
      </HStack>
    </PanelSection>
    <Switch>
      <Match when={props.item.bucket === "distill"}>
        <DistillPanel
          item={props.item}
          onDone={props.onDone}
          onKeep={props.onKeep}
          onSkip={props.onSkip}
        />
      </Match>
    </Switch>
  </Stack>
);
