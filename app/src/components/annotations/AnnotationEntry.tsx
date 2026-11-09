import { useAction } from "@solidjs/router";
import { Trash2Icon } from "lucide-solid";
import { createEffect, createSignal, Show, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Textarea } from "~/components/ui/textarea";
import type { AnnotationView } from "~/lib/annotations/types";
import {
  deleteNoteAnnotation,
  updateNoteAnnotation,
} from "~/services/annotations/annotations.actions";
import { swatchStyle, useAnnotationLayer } from "./annotation-context";
import { RequestStatusBadge, RequestThread } from "./RequestThread";

// One annotation in the rail: its type, the quoted passage (click to jump
// there), and the comment, which edits in place.

const quoteClass = css({
  fontSize: "xs",
  color: "fg.muted",
  fontStyle: "italic",
  lineClamp: "3",
  whiteSpace: "pre-line",
  cursor: "pointer",
  textAlign: "left",
  _hover: { color: "fg.default" },
});

export const AnnotationEntry: VoidComponent<{ annotation: AnnotationView }> = (props) => {
  const layer = useAnnotationLayer();
  const runUpdate = useAction(updateNoteAnnotation);
  const runDelete = useAction(deleteNoteAnnotation);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let el: HTMLDivElement | undefined;

  const type = () => layer.types().find((t) => t.id === props.annotation.typeId);
  const color = () => type()?.color ?? "gray";
  const active = () => layer.activeId() === props.annotation.id;
  const placed = () => layer.ranges().has(props.annotation.id);
  const missing = () => Boolean(props.annotation.blockId) && !placed();

  createEffect(() => {
    if (active()) el?.scrollIntoView({ block: "nearest" });
  });

  const commit = async () => {
    setEditing(false);
    if (draft() === props.annotation.body) return;
    await runUpdate({ id: props.annotation.id, body: draft() });
    layer.refresh();
  };

  const retype = async (typeId: string) => {
    await runUpdate({ id: props.annotation.id, typeId });
    layer.refresh();
  };

  const remove = async () => {
    await runDelete(props.annotation.id);
    layer.refresh();
  };

  return (
    <Box
      ref={el}
      data-testid="annotation-entry"
      data-active={active() ? "true" : undefined}
      position="relative"
      borderWidth="1px"
      borderColor={active() ? "border.emphasized" : "border"}
      borderRadius="l2"
      bg="bg.default"
      pl="3"
      pr="2"
      py="2"
      boxShadow={active() ? "sm" : undefined}
      onClick={() => layer.setActive(props.annotation.id)}
    >
      <Box position="absolute" left="0" top="0" bottom="0" w="1" borderLeftRadius="l2" style={swatchStyle(color())} />
      <HStack gap="1" justify="space-between">
        <SimpleSelect
          size="xs"
          items={layer.types().map((t) => ({ label: t.name, value: t.id }))}
          value={props.annotation.typeId}
          onChange={(typeId) => void retype(typeId)}
        />
        <HStack gap="1" fontSize="xs" color="fg.muted" minW="0">
          <Show when={props.annotation.author !== "you"}>
            <Box truncate>{props.annotation.author}</Box>
          </Show>
          <IconButton
            size="2xs"
            variant="plain"
            aria-label="Delete annotation"
            onClick={(event) => {
              event.stopPropagation();
              void remove();
            }}
          >
            <Trash2Icon />
          </IconButton>
        </HStack>
      </HStack>
      <Show when={props.annotation.status}>
        <Box mt="1">
          <RequestStatusBadge request={props.annotation} />
        </Box>
      </Show>
      <Show when={!props.annotation.blockId}>
        <Box fontSize="xs" color="fg.muted">
          Whole note
        </Box>
      </Show>
      <Show when={props.annotation.quote}>
        {(quote) => (
          <button
            type="button"
            class={quoteClass}
            disabled={!placed()}
            onClick={() => layer.reveal(props.annotation.id)}
          >
            “{quote()}”
          </button>
        )}
      </Show>
      <Show when={missing()}>
        <Box fontSize="xs" color="fg.subtle" data-testid="annotation-missing">
          {props.annotation.detached ? "Passage removed" : "Passage not found"}
        </Box>
      </Show>
      <Show
        when={editing()}
        fallback={
          <Box
            mt="1"
            fontSize="sm"
            whiteSpace="pre-wrap"
            color={props.annotation.body ? "fg.default" : "fg.subtle"}
            cursor="text"
            onClick={() => {
              setDraft(props.annotation.body);
              setEditing(true);
            }}
          >
            {props.annotation.body || "Add a comment"}
          </Box>
        }
      >
        <Textarea
          mt="1"
          size="sm"
          rows={3}
          autofocus
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void commit();
          }}
        />
      </Show>
      <Show when={props.annotation.status}>
        <RequestThread request={props.annotation} onChanged={layer.refresh} />
      </Show>
    </Box>
  );
};
