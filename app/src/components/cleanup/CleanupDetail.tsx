import { A } from "@solidjs/router";
import { For, Match, Show, Switch, type VoidComponent } from "solid-js";
import { Box, HStack, Stack } from "styled-system/jsx";
import { Badge } from "~/components/ui/badge";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import type { CleanupItemDetail } from "~/server/cleanup/queue";
import type { Placement } from "~/server/cleanup/regroup";
import type { RegroupMember } from "~/server/cleanup/regroup-queue";
import { ArchiveOnlyPanel } from "./ArchiveOnlyPanel";
import { CombinePanel } from "./CombinePanel";
import { MakeTaskPanel } from "./MakeTaskPanel";
import { DistillPanel } from "./DistillPanel";
import { MovePanel } from "./MovePanel";
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
      <Match
        when={props.item.bucket === "post_event" && props.item.evergreen >= 0.4}
      >
        <DistillPanel
          mode="post_event"
          item={props.item}
          onDone={props.onDone}
          onKeep={props.onKeep}
          onSkip={props.onSkip}
        />
      </Match>
      <Match
        when={
          props.item.bucket === "post_event" || props.item.bucket === "delete"
        }
      >
        <ArchiveOnlyPanel
          item={props.item}
          reason={props.item.bucket === "delete" ? "delete" : "post_event"}
          onDone={props.onDone}
          onKeep={props.onKeep}
          onSkip={props.onSkip}
        />
      </Match>
      <Match when={props.item.bucket === "make_task"}>
        <MakeTaskPanel
          item={props.item}
          onDone={props.onDone}
          onKeep={props.onKeep}
          onSkip={props.onSkip}
        />
      </Match>
      <Match
        when={props.item.regroup?.kind === "combine" && props.item.regroup}
      >
        {(regroup) => (
          <CombinePanel
            item={props.item}
            members={(regroup() as { members: RegroupMember[] }).members}
            keeperId={(regroup() as { keeperId: string }).keeperId}
            onDone={props.onDone}
            onKeep={props.onKeep}
            onSkip={props.onSkip}
          />
        )}
      </Match>
      <Match when={props.item.regroup?.kind === "move" && props.item.regroup}>
        {(regroup) => (
          <MovePanel
            docId={props.item.docId}
            placement={(regroup() as { placement: Placement }).placement}
            onDone={props.onDone}
            onKeep={props.onKeep}
            onSkip={props.onSkip}
          />
        )}
      </Match>
    </Switch>
  </Stack>
);
