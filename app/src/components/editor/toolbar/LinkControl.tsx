import type { Editor } from "@tiptap/core";
import { Link2Icon } from "lucide-solid";
import { Show, createSignal } from "solid-js";
import { createEditorTransaction } from "solid-tiptap";
import { HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SimplePopover } from "~/components/ui/simple-popover";
import { Tooltip } from "~/components/ui/tooltip";
import { Toggle } from "./Toggle";

// TODO:AS_ANY, link chain commands come from the StarterKit link extension
type LinkChain = {
  extendMarkRange: (mark: string) => LinkChain;
  setLink: (attrs: { href: string }) => LinkChain;
  unsetLink: () => LinkChain;
  run: () => boolean;
};

const normalizeHref = (raw: string) => {
  const value = raw.trim();
  if (!value) return "";
  if (/^(https?:|mailto:|\/|#)/i.test(value)) return value;
  return `https://${value}`;
};

/** Add, edit, or remove a link on the selection or the link under the caret. */
export function LinkControl(props: { editor: Editor }) {
  const [open, setOpen] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const active = createEditorTransaction(
    () => props.editor,
    (instance) => instance.isActive("link"),
  );

  const chain = () =>
    props.editor
      .chain()
      .focus()
      .extendMarkRange("link") as unknown as LinkChain;

  const openPopover = () => {
    const href = props.editor.getAttributes("link").href;
    setDraft(typeof href === "string" ? href : "");
    setOpen(true);
  };

  const apply = () => {
    const href = normalizeHref(draft());
    if (href) chain().setLink({ href }).run();
    else chain().unsetLink().run();
    setOpen(false);
  };

  const remove = () => {
    chain().unsetLink().run();
    setOpen(false);
  };

  return (
    <SimplePopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-start"
      offset={6}
      anchor={
        <Tooltip content="Link" showArrow openDelay={300}>
          <Toggle
            ariaLabel="Link"
            pressed={active()}
            onPress={() => (open() ? setOpen(false) : openPopover())}
          >
            <Link2Icon size={16} />
          </Toggle>
        </Tooltip>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <HStack gap="1.5" p="2">
          <Input
            ref={(el) => queueMicrotask(() => el.focus())}
            size="sm"
            w="18rem"
            maxW="calc(100vw - 9rem)"
            fontFamily="mono"
            placeholder="https://"
            aria-label="Link URL"
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
          />
          <Button type="submit" size="sm">
            {active() ? "Update" : "Add"}
          </Button>
          <Show when={active()}>
            <Button
              type="button"
              size="sm"
              variant="plain"
              colorPalette="gray"
              onClick={remove}
            >
              Remove
            </Button>
          </Show>
        </HStack>
      </form>
    </SimplePopover>
  );
}
