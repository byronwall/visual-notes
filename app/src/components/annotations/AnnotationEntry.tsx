import { useAction } from "@solidjs/router";
import { BotIcon, MessageSquareIcon } from "lucide-solid";
import { createSignal, Show, type JSX, type VoidComponent } from "solid-js";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Textarea } from "~/components/ui/textarea";
import type { AnnotationView } from "~/lib/annotations/types";
import {
  deleteNoteAnnotation,
  updateNoteAnnotation,
} from "~/services/annotations/annotations.actions";
import { AnnotationEntryMenu } from "./AnnotationEntryMenu";
import { swatchStyle, useAnnotationLayer } from "./annotation-context";
import { RequestStatusBadge, RequestThread } from "./RequestThread";

// One margin note: a type line, the passage in its highlight color, and the
// comment. Inactive notes stay short; the active one opens its thread and
// lets you edit. Change type and Delete live in the ⋯ menu.

const rowClass = css({
  position: "relative",
  px: "2",
  py: "1.5",
  borderRadius: "l2",
  cursor: "pointer",
  transitionProperty: "background-color, box-shadow",
  transitionDuration: "140ms",
  transitionTimingFunction: "ease-out",
  _motionReduce: { transition: "none" },
  "& [data-reveal]": { opacity: 0, transition: "opacity 140ms ease-out" },
  "&:hover [data-reveal], &[data-active] [data-reveal], &:focus-within [data-reveal]":
    { opacity: 1 },
});

const quoteClass = css({
  fontSize: "xs",
  lineHeight: "1.45",
  whiteSpace: "pre-line",
  borderRadius: "l1",
  px: "1",
  mx: "-1",
  boxDecorationBreak: "clone",
});

export const AnnotationEntry: VoidComponent<{
  annotation: AnnotationView;
  /** Beside its passage in the margin, so the quote would only repeat it. */
  aligned?: boolean;
  ref?: (el: HTMLDivElement) => void;
  style?: JSX.CSSProperties;
}> = (props) => {
  const layer = useAnnotationLayer();
  const runUpdate = useAction(updateNoteAnnotation);
  const runDelete = useAction(deleteNoteAnnotation);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  const type = () =>
    layer.types().find((t) => t.id === props.annotation.typeId);
  const color = () => type()?.color ?? "gray";
  const active = () => layer.activeId() === props.annotation.id;
  const hovered = () => layer.hoverId() === props.annotation.id;
  const placed = () => layer.ranges().has(props.annotation.id);
  const fromAgent = () => props.annotation.author !== "you";
  // In the margin the passage is right beside the note, so its quote shows
  // only when the note is open or has no place in the text.
  const showQuote = () => !props.aligned || active() || !placed();

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
    if (active()) layer.setActive(null);
    await runDelete(props.annotation.id);
    layer.refresh();
  };

  const select = () => {
    if (active()) return;
    if (placed()) layer.reveal(props.annotation.id);
    else layer.setActive(props.annotation.id);
  };

  const startEdit = (event: MouseEvent) => {
    if (!active()) return;
    event.stopPropagation();
    setDraft(props.annotation.body);
    setEditing(true);
  };

  return (
    <div
      ref={props.ref}
      class={rowClass}
      style={{
        ...props.style,
        ...(active()
          ? {
              "background-color": `var(--colors-${color()}-a2)`,
              "box-shadow": `inset 0 0 0 1px var(--colors-${color()}-a6)`,
            }
          : hovered()
            ? { "background-color": "var(--colors-gray-a3)" }
            : {}),
      }}
      data-testid="annotation-entry"
      data-annotation-id={props.annotation.id}
      data-active={active() ? "" : undefined}
      onMouseEnter={() => layer.setHover(props.annotation.id)}
      onMouseLeave={() => layer.setHover(null)}
      onClick={select}
    >
      <HStack gap="1.5" fontSize="xs" minH="5">
        <Box
          w="2"
          h="2"
          borderRadius="full"
          flexShrink="0"
          style={swatchStyle(color())}
        />
        <Box fontWeight="semibold" color="fg.default" whiteSpace="nowrap">
          {type()?.name ?? "Note"}
        </Box>
        <Show when={fromAgent()}>
          <HStack gap="0.5" color="fg.muted" minW="0">
            <BotIcon size={12} />
            <Box truncate>{props.annotation.author}</Box>
          </HStack>
        </Show>
        <Show when={props.annotation.status}>
          <Box minW="0" overflow="hidden">
            <RequestStatusBadge request={props.annotation} short />
          </Box>
        </Show>
        <Box flex="1" />
        <Show when={!active() && props.annotation.messages.length > 0}>
          <HStack gap="0.5" color="fg.muted" flexShrink="0" title="Replies">
            <MessageSquareIcon size={11} />
            {props.annotation.messages.length}
          </HStack>
        </Show>
        <Box data-reveal="">
          <AnnotationEntryMenu
            types={layer.types()}
            typeId={props.annotation.typeId}
            onType={(id) => void retype(id)}
            onDelete={() => void remove()}
            onEditTypes={() => layer.openTypes()}
          />
        </Box>
      </HStack>

      <Show when={showQuote()}>
        <Box mt="1">
          <Show
            when={props.annotation.quote}
            fallback={
              <Box fontSize="xs" color="fg.muted">
                On the whole note
              </Box>
            }
          >
            {(quote) => (
              <Box lineClamp={active() ? undefined : "2"}>
                <span
                  class={quoteClass}
                  style={{ "background-color": `var(--colors-${color()}-a3)` }}
                >
                  {quote()}
                </span>
              </Box>
            )}
          </Show>
          <Show when={props.annotation.blockId && !placed()}>
            <Box
              fontSize="xs"
              color="fg.subtle"
              data-testid="annotation-missing"
            >
              {props.annotation.detached
                ? "Passage removed"
                : "Passage not found"}
            </Box>
          </Show>
        </Box>
      </Show>

      <Show
        when={editing()}
        fallback={
          <Show when={props.annotation.body || active()}>
            <Box
              mt="0.5"
              fontSize="sm"
              lineHeight="1.45"
              whiteSpace="pre-wrap"
              lineClamp={active() ? undefined : "2"}
              color={props.annotation.body ? "fg.default" : "fg.subtle"}
              cursor={active() ? "text" : undefined}
              onClick={startEdit}
            >
              {props.annotation.body || "Add a comment"}
            </Box>
          </Show>
        }
      >
        <Textarea
          mt="1"
          size="sm"
          rows={2}
          autoresize
          ref={(el: HTMLTextAreaElement) =>
            requestAnimationFrame(() => el.focus())
          }
          value={draft()}
          onClick={(event) => event.stopPropagation()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
              void commit();
          }}
        />
      </Show>

      <Show when={props.annotation.status && active()}>
        <RequestThread request={props.annotation} onChanged={layer.refresh} />
      </Show>
    </div>
  );
};
