import { KeyboardIcon } from "lucide-solid";
import { createSignal, For } from "solid-js";
import { css } from "styled-system/css";
import { IconButton } from "~/components/ui/icon-button";
import { Kbd } from "~/components/ui/kbd";
import { SimplePopover } from "~/components/ui/simple-popover";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["N"], label: "New task below selection" },
  { keys: ["↑", "↓"], label: "Move selection" },
  { keys: ["←", "→"], label: "Collapse / expand" },
  { keys: ["X"], label: "Toggle done" },
  { keys: ["S"], label: "Toggle in progress" },
  { keys: ["↵"], label: "Edit title" },
  { keys: ["⌘", "↵"], label: "Edit details" },
  { keys: ["⌥", "↑↓"], label: "Reorder" },
  { keys: ["⌥", "←→"], label: "Outdent / indent" },
  { keys: ["Esc"], label: "Clear selection" },
];

const SYNTAX: { token: string; label: string }[] = [
  { token: "#tag", label: "Add a tag" },
  { token: "@fri", label: "Due today, tomorrow, a weekday, or 2026-11-01" },
  { token: "~30m", label: "Estimate 30m, 1h, 1h30m" },
];

const gridClass = css({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  columnGap: "4",
  rowGap: "1.5",
  alignItems: "center",
  fontSize: "sm",
  color: "fg.muted",
});

export const TaskShortcutsPopover = () => {
  const [open, setOpen] = createSignal(false);

  return (
    <SimplePopover
      open={open()}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      offset={6}
      class={css({ p: "3", maxW: "calc(100vw - 2rem)" })}
      anchor={
        <IconButton
          size="xs"
          variant="plain"
          aria-label="Keyboard shortcuts"
          data-testid="task-shortcuts-button"
          onClick={() => setOpen((value) => !value)}
        >
          <KeyboardIcon size={16} />
        </IconButton>
      }
    >
      <div class={css({ display: "flex", flexDirection: "column", gap: "3" })}>
        <div class={gridClass}>
          <For each={SHORTCUTS}>
            {(shortcut) => (
              <>
                <span class={css({ display: "flex", gap: "1" })}>
                  <For each={shortcut.keys}>{(key) => <Kbd size="sm">{key}</Kbd>}</For>
                </span>
                <span>{shortcut.label}</span>
              </>
            )}
          </For>
        </div>
        <div class={gridClass}>
          <For each={SYNTAX}>
            {(item) => (
              <>
                <code class={css({ fontFamily: "mono", fontSize: "xs", color: "fg.default" })}>
                  {item.token}
                </code>
                <span>{item.label}</span>
              </>
            )}
          </For>
        </div>
      </div>
    </SimplePopover>
  );
};
