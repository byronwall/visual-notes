import { useAction } from "@solidjs/router";
import { MessageSquarePlusIcon } from "lucide-solid";
import {
  createEffect,
  createSignal,
  onCleanup,
  Show,
  type VoidComponent,
} from "solid-js";
import { Portal } from "solid-js/web";
import { css } from "styled-system/css";
import { Box, HStack, Stack } from "styled-system/jsx";
import { selectionPassage } from "~/components/editor/annotations/annotationPlugin";
import { Button } from "~/components/ui/button";
import { SimpleSelect } from "~/components/ui/simple-select";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import { createNoteAnnotation } from "~/services/annotations/annotations.actions";
import { useAnnotationLayer } from "./annotation-context";

// The "Annotate" button that follows a text selection, and the small form
// it opens: pick a type, write a comment, save.

type Passage = NonNullable<ReturnType<typeof selectionPassage>>;
type Spot = { top: number; left: number };

const shortcutLabel = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘⌥M" : "Ctrl+Alt+M";

const floatClass = css({
  position: "absolute",
  zIndex: "popover",
  bg: "bg.default",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "l2",
  boxShadow: "lg",
});

export const AnnotationComposer: VoidComponent = () => {
  const layer = useAnnotationLayer();
  const runCreate = useAction(createNoteAnnotation);
  const [passage, setPassage] = createSignal<Passage | null>(null);
  const [spot, setSpot] = createSignal<Spot | null>(null);
  const [open, setOpen] = createSignal(false);
  const [typeId, setTypeId] = createSignal("");
  const [body, setBody] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  let formEl: HTMLDivElement | undefined;
  let commentEl: HTMLTextAreaElement | undefined;

  const place = () => {
    const ed = layer.editor();
    const found = ed && ed.isFocused ? selectionPassage(ed.state) : null;
    if (open()) return;
    setPassage(found);
    if (!found || !ed) return setSpot(null);
    const end = ed.view.coordsAtPos(found.to);
    setSpot({ top: end.bottom + window.scrollY + 6, left: end.left + window.scrollX });
  };

  createEffect(() => {
    const ed = layer.editor();
    if (!ed) return;
    const onBlur = () => queueMicrotask(place);
    // ⌘⌥M / Ctrl+Alt+M, as in Google Docs, opens the form for the selection.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.altKey || event.code !== "KeyM") return;
      event.preventDefault();
      place();
      if (passage()) return start();
      // A selection made a moment ago reaches the editor on the next frame.
      requestAnimationFrame(() => {
        place();
        if (passage()) start();
      });
    };
    ed.on("selectionUpdate", place);
    ed.on("focus", place);
    ed.on("blur", onBlur);
    ed.view.dom.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      ed.off("selectionUpdate", place);
      ed.off("focus", place);
      ed.off("blur", onBlur);
      ed.view.dom.removeEventListener("keydown", onKeyDown);
    });
  });

  const start = () => {
    const fallback = layer.types().find((t) => t.isDefault) ?? layer.types()[0];
    setTypeId(fallback?.id ?? "");
    setBody("");
    setOpen(true);
    // `autofocus` only works once per page, so focus the comment directly,
    // before the next keystroke can reach the note.
    commentEl?.focus();
    requestAnimationFrame(() => commentEl?.focus());
  };

  // Saving or Cancel puts the caret at the end of the passage, so the
  // button does not come straight back for the same selection. A click
  // elsewhere closes the form and leaves the caret where you clicked.
  const close = (restoreCaret = true) => {
    const end = passage()?.to;
    setOpen(false);
    setPassage(null);
    setSpot(null);
    const ed = layer.editor();
    if (restoreCaret && ed && end !== undefined) ed.chain().setTextSelection(end).focus().run();
  };

  createEffect(() => {
    if (!open()) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      // The type picker's list renders in a portal of its own.
      if (formEl?.contains(target) || target?.closest("[data-scope=select]")) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.target instanceof Element && event.target.closest("[data-scope=select]")) return;
      event.preventDefault();
      close();
    };
    // Capture phase: the editor and dialogs stop Escape before it bubbles.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    onCleanup(() => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    });
  });

  const save = async () => {
    const found = passage();
    if (!found || saving()) return;
    setSaving(true);
    try {
      const created = await runCreate({
        docId: layer.docId,
        typeId: typeId() || undefined,
        body: body(),
        blockId: found.blockId,
        quote: found.quote,
        quoteStart: found.quoteStart,
        endBlockId: found.endBlockId,
        endOffset: found.endOffset,
      });
      layer.refresh();
      layer.setActive(created.id);
      close();
    } catch (error) {
      console.warn("[annotations] create failed", error);
      toaster.create({ title: "Could not save the annotation", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Show when={spot()}>
      {(at) => (
        <Portal>
          <Show
            when={open()}
            fallback={
              <button
                type="button"
                class={floatClass}
                data-testid="annotate-button"
                style={{ top: `${at().top}px`, left: `${at().left}px` }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={start}
              >
                <HStack gap="1.5" px="2.5" py="1" fontSize="sm" fontWeight="medium">
                  <MessageSquarePlusIcon size={14} />
                  Annotate
                  <Box as="span" color="fg.subtle" fontSize="xs" fontFamily="mono">
                    {shortcutLabel()}
                  </Box>
                </HStack>
              </button>
            }
          >
            <Stack
              class={floatClass}
              gap="2"
              p="3"
              w="80"
              maxW="calc(100vw - 32px)"
              data-testid="annotation-composer"
              style={{ top: `${at().top}px`, left: `${Math.min(at().left, window.innerWidth - 340)}px` }}
              ref={formEl}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void save();
              }}
            >
              <SimpleSelect
                size="sm"
                items={layer.types().map((t) => ({ label: t.forAi ? `${t.name} · for AI` : t.name, value: t.id }))}
                value={typeId()}
                onChange={setTypeId}
                sameWidth
              />
              <Textarea
                size="sm"
                rows={3}
                ref={commentEl}
                placeholder="Comment (optional)"
                value={body()}
                onInput={(event) => setBody(event.currentTarget.value)}
              />
              <HStack justify="space-between">
                <Button size="xs" variant="plain" onClick={() => layer.openTypes()}>
                  Edit types
                </Button>
                <HStack gap="2">
                  <Button size="xs" variant="outline" onClick={() => close()}>
                    Cancel
                  </Button>
                  <Button size="xs" loading={saving()} onClick={() => void save()}>
                    Save
                  </Button>
                </HStack>
              </HStack>
            </Stack>
          </Show>
        </Portal>
      )}
    </Show>
  );
};
