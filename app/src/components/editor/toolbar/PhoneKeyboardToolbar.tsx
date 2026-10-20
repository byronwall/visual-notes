import type { Editor } from "@tiptap/core";
import { Show, Suspense, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { Box } from "styled-system/jsx";
import { ToolbarContents } from "./ToolbarContents";

type Props = {
  editor: Editor;
  noteId?: string;
  showAiPromptsMenu?: boolean;
};

// Matches Panda's `md` breakpoint (48em): below it the inline toolbar hides.
const PHONE_QUERY = "(max-width: 47.99em)";
// A tap on the bar can blur the editor for a moment before the command
// refocuses it; wait this long before hiding so the bar doesn't flicker.
const HIDE_DELAY_MS = 160;

// Keep the caret (and the iOS keyboard) in the editor when a toolbar button
// is pressed. Fields inside the bar still need to take focus.
const keepEditorFocus = (event: Event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select")) return;
  event.preventDefault();
};

/**
 * Phone formatting bar that rides on top of the on-screen keyboard while
 * the note is being edited, and disappears while reading. Client-only: it
 * depends on focus and `matchMedia`, neither of which exists during SSR, and
 * it renders nothing until the editor is focused.
 */
export function PhoneKeyboardToolbar(props: Props) {
  const [isPhone, setIsPhone] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const syncPhone = () => setIsPhone(media.matches);
    syncPhone();
    media.addEventListener("change", syncPhone);

    const onFocus = () => {
      if (hideTimer) clearTimeout(hideTimer);
      setFocused(true);
    };
    const onBlur = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setFocused(false), HIDE_DELAY_MS);
    };
    setFocused(props.editor.isFocused);
    props.editor.on("focus", onFocus);
    props.editor.on("blur", onBlur);

    onCleanup(() => {
      if (hideTimer) clearTimeout(hideTimer);
      media.removeEventListener("change", syncPhone);
      props.editor.off("focus", onFocus);
      props.editor.off("blur", onBlur);
    });
  });

  return (
    // The Portal stays mounted and only its contents toggle: swapping what
    // this component returns would make Solid re-insert the editor's sibling
    // nodes, which blurs the editor the moment it gains focus.
    <Portal>
      <Show when={isPhone() && focused()}>
        <Box
          position="fixed"
          insetX="0"
          // Sit on the bottom edge of the visual viewport, which is the top
          // of the iOS keyboard while it is open (see ~/lib/visual-viewport).
          top="calc(var(--vv-top, 0px) + var(--vv-height, 100dvh))"
          transform="translateY(-100%)"
          zIndex="sticky"
          bg="gray.2"
          borderTopWidth="1px"
          borderColor="border"
          data-phone-keyboard-toolbar
          css={{
            // Thumb-sized targets; the desktop toolbar keeps its compact 28px.
            "& button": { minWidth: "2.5rem", height: "2.5rem" },
          }}
          on:mousedown={keepEditorFocus}
          on:pointerdown={keepEditorFocus}
        >
          {/* Own boundary: the AI prompts menu loads a resource, and letting
              that reach the page's Suspense would swap the note for its
              skeleton and blur the editor. */}
          <Suspense>
            <ToolbarContents
              editor={props.editor}
              noteId={props.noteId}
              showAiPromptsMenu={props.showAiPromptsMenu}
            />
          </Suspense>
        </Box>
      </Show>
    </Portal>
  );
}
