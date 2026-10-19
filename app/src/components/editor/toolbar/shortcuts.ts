const isMac = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** Formats `Mod-Shift-b` as `⌘⇧B` on macOS and `Ctrl+Shift+B` elsewhere. */
export function formatShortcut(shortcut: string) {
  const mac = isMac();
  const parts = shortcut.split("-").map((part) => {
    if (part === "Mod") return mac ? "⌘" : "Ctrl";
    if (part === "Shift") return mac ? "⇧" : "Shift";
    if (part === "Alt") return mac ? "⌥" : "Alt";
    return part.toUpperCase();
  });
  return mac ? parts.join("") : parts.join("+");
}
