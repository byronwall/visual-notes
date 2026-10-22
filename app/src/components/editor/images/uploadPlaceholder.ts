import { css } from "styled-system/css";
import type { PlaceholderHandlers, UploadSpec } from "./imagePasteState";

// Plain DOM: ProseMirror widgets render outside Solid. The preview is the
// local file itself, so the image shows the moment it is pasted.

export type PlaceholderStatus = "uploading" | "failed";

const rootClass = css({
  position: "relative",
  display: "block",
  marginTop: "3",
  marginBottom: "3",
  maxWidth: "100%",
  borderRadius: "l2",
  overflow: "hidden",
  bg: "gray.surface.bg",
  borderWidth: "1px",
  borderColor: "gray.outline.border",
  userSelect: "none",
});
const previewClass = css({
  display: "block",
  width: "100%",
  height: "auto",
  maxHeight: "480px",
  objectFit: "contain",
  opacity: "0.55",
});
const barTrackClass = css({
  position: "absolute",
  insetInline: "0",
  bottom: "0",
  height: "3px",
  overflow: "hidden",
  bg: "gray.a3",
});
const barClass = css({
  height: "100%",
  width: "100%",
  bg: "blue.9",
  transformOrigin: "left",
  animation: "route-progress 1.2s ease-in-out infinite",
});
const badgeClass = css({
  position: "absolute",
  top: "2",
  left: "2",
  display: "inline-flex",
  alignItems: "center",
  gap: "2",
  px: "2",
  py: "1",
  borderRadius: "l2",
  bg: "bg.default",
  color: "fg.default",
  fontSize: "xs",
  boxShadow: "sm",
  maxWidth: "calc(100% - token(spacing.4))",
});
const failedTextClass = css({ color: "red.11" });
const buttonClass = css({
  fontSize: "xs",
  fontWeight: "medium",
  px: "1.5",
  py: "0.5",
  borderRadius: "l1",
  cursor: "pointer",
  color: "fg.default",
  _hover: { bg: "gray.a3" },
});

function button(label: string, onClick: () => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = buttonClass;
  el.textContent = label;
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return el;
}

export function renderUploadPlaceholder(
  spec: UploadSpec,
  handlers: PlaceholderHandlers,
): HTMLElement {
  const root = document.createElement("div");
  root.className = rootClass;
  root.contentEditable = "false";
  root.dataset.imageUpload = spec.status;
  root.setAttribute("role", "status");

  const preview = document.createElement("img");
  preview.className = previewClass;
  preview.src = spec.previewUrl;
  preview.alt = "";
  preview.draggable = false;
  if (spec.aspect) preview.style.aspectRatio = String(spec.aspect);
  // Formats the browser cannot draw (TIFF in Chrome) still get a box.
  preview.addEventListener("error", () => {
    preview.style.minHeight = "96px";
    preview.removeAttribute("src");
  });
  root.append(preview);

  const badge = document.createElement("span");
  badge.className = badgeClass;
  if (spec.status === "uploading") {
    badge.textContent = "Uploading image…";
    const track = document.createElement("span");
    track.className = barTrackClass;
    const bar = document.createElement("span");
    bar.className = barClass;
    bar.style.display = "block";
    track.append(bar);
    root.append(track);
  } else {
    const text = document.createElement("span");
    text.className = failedTextClass;
    text.textContent = spec.message || "Upload failed";
    badge.append(text);
    if (spec.retryable !== false) {
      badge.append(button("Retry", () => handlers.retry(spec.id)));
    }
    badge.append(button("Remove", () => handlers.remove(spec.id)));
  }
  root.append(badge);
  return root;
}
