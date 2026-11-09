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
import { HStack, Stack } from "styled-system/jsx";
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
    ed.on("selectionUpdate", place);
    ed.on("focus", place);
    ed.on("blur", onBlur);
    onCleanup(() => {
      ed.off("selectionUpdate", place);
      ed.off("focus", place);
      ed.off("blur", onBlur);
    });
  });

  const start = () => {
    const fallback = layer.types().find((t) => t.isDefault) ?? layer.types()[0];
    setTypeId(fallback?.id ?? "");
    setBody("");
    setOpen(true);
  };

  // Closing puts the caret at the end of the passage, so the button does
  // not come straight back for the same selection.
  const close = () => {
    const end = passage()?.to;
    setOpen(false);
    setPassage(null);
    setSpot(null);
    const ed = layer.editor();
    if (ed && end !== undefined) ed.chain().setTextSelection(end).focus().run();
  };

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
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
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
                autofocus
                placeholder="Comment (optional)"
                value={body()}
                onInput={(event) => setBody(event.currentTarget.value)}
              />
              <HStack justify="space-between">
                <Button size="xs" variant="plain" onClick={() => layer.openTypes()}>
                  Edit types
                </Button>
                <HStack gap="2">
                  <Button size="xs" variant="outline" onClick={close}>
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
