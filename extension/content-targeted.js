const OVERLAY_ID = "__vn_archive_overlay__";
const HIGHLIGHT_PRIMARY = "#00e5ff";
const HIGHLIGHT_SECONDARY = "#ff2bd6";
const HIGHLIGHT_SHADOW = "rgba(5, 8, 17, 0.9)";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "archive:start-selection") return;
  startSelection(message.mode)
    .then((selection) => sendResponse({ ok: true, selection }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function startSelection(mode) {
  cleanupOverlay();

  const frame = await createOverlayFrame();
  const surfaceDocument = frame.contentDocument;
  const surfaceWindow = frame.contentWindow;
  if (!surfaceDocument || !surfaceWindow) {
    frame.remove();
    throw new Error("Could not initialize overlay");
  }

  return new Promise((resolve, reject) => {
    const surface = surfaceDocument.body;
    Object.assign(surface.style, {
      margin: "0",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      cursor: "crosshair",
      background: "rgba(5, 8, 17, 0.12)",
      position: "relative",
      userSelect: "none",
    });

    const hint = surfaceDocument.createElement("div");
    hint.textContent =
      mode === "node"
        ? "Move to highlight. SPACE climbs to parent. ENTER or ✓ confirms. Mouse move resets. ESC cancels."
        : "Drag a region, then move/resize it. ENTER or ✓ confirms. ESC cancels.";
    Object.assign(hint.style, {
      position: "fixed",
      top: "16px",
      left: "16px",
      background: "rgba(5, 8, 17, 0.94)",
      color: "white",
      padding: "10px 12px",
      borderRadius: "10px",
      font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
      maxWidth: "320px",
      border: `2px solid ${HIGHLIGHT_PRIMARY}`,
      boxShadow: `0 0 0 4px ${HIGHLIGHT_SHADOW}`,
      pointerEvents: "none",
      transition: "opacity 80ms linear",
      zIndex: "2",
    });
    surface.appendChild(hint);

    const controls = surfaceDocument.createElement("div");
    Object.assign(controls.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      display: "flex",
      gap: "8px",
      zIndex: "3",
    });

    const cancelButton = buildToolbarButton(surfaceDocument, "Cancel");
    const acceptButton = buildToolbarButton(surfaceDocument, "✓");
    controls.append(cancelButton, acceptButton);
    surface.appendChild(controls);

    let startX = 0;
    let startY = 0;
    let pointerState = "idle";
    let regionBox = null;
    let hoveredElement = null;
    let currentElement = null;
    let currentDepth = 0;
    let currentRect = null;
    let handles = [];
    let hintHidden = false;

    const cleanup = () => {
      frame.style.pointerEvents = "none";
      frame.style.opacity = "0";
      frame.remove();
      document.removeEventListener("keydown", onKeyDown, true);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup();
        reject(new Error("Selection cancelled"));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void confirmSelection();
        return;
      }

      if (mode === "node" && event.key === " ") {
        event.preventDefault();
        cycleSelectionUp();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    cancelButton.addEventListener("click", (event) => {
      event.preventDefault();
      cleanup();
      reject(new Error("Selection cancelled"));
    });
    acceptButton.addEventListener("click", (event) => {
      event.preventDefault();
      void confirmSelection();
    });

    if (mode === "node") {
      surface.addEventListener(
        "pointermove",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          setHintHidden(shouldHideHintForPointer(event.clientX, event.clientY));
          const target = pickUnderlyingElement(frame, event.clientX, event.clientY);
          if (!target || target === frame || isInsideOverlay(target)) return;
          hoveredElement = target;
          currentDepth = 0;
          currentElement = hoveredElement;
          updateNodeHighlight();
        },
        true,
      );
      surface.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        true,
      );
    } else {
      surface.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (controls.contains(event.target)) return;
          setHintHidden(shouldHideHintForPointer(event.clientX, event.clientY));
          startX = event.clientX;
          startY = event.clientY;
          const handleName = event.target?.dataset?.handle || "";
          if (handleName && regionBox) {
            pointerState = `resize:${handleName}`;
            return;
          }
          if (regionBox && event.target === regionBox) {
            pointerState = "move";
            return;
          }
          pointerState = "draw";
          currentRect = { x: startX, y: startY, width: 1, height: 1 };
          ensureRegionBox();
          updateRegionBox();
        },
        true,
      );

      surface.addEventListener(
        "pointermove",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          setHintHidden(shouldHideHintForPointer(event.clientX, event.clientY));
          if (!pointerState || pointerState === "idle") return;
          if (!currentRect) return;
          if (pointerState === "draw") {
            currentRect = normalizeRect(startX, startY, event.clientX, event.clientY);
          } else if (pointerState === "move") {
            currentRect = {
              ...currentRect,
              x: currentRect.x + (event.clientX - startX),
              y: currentRect.y + (event.clientY - startY),
            };
            startX = event.clientX;
            startY = event.clientY;
          } else if (pointerState.startsWith("resize:")) {
            currentRect = resizeRect(
              currentRect,
              pointerState.slice("resize:".length),
              event.clientX,
              event.clientY,
            );
          }
          updateRegionBox();
        },
        true,
      );

      surface.addEventListener(
        "pointerup",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          pointerState = "idle";
          setHintHidden(false);
          updateRegionBox();
        },
        true,
      );
    }

    async function confirmSelection() {
      if (mode === "node") {
        if (!currentElement) {
          cleanup();
          reject(new Error("No element selected"));
          return;
        }
        const rect = currentElement.getBoundingClientRect();
        cleanup();
        await waitForCaptureFrame();
        resolve({
          mode: "node",
          selector: buildSelector(currentElement),
          elementText: currentElement.textContent?.trim().slice(0, 800) || "",
          rect: rectToJson(rect),
        });
        return;
      }

      if (!currentRect || currentRect.width < 4 || currentRect.height < 4) {
        cleanup();
        reject(new Error("Selection too small"));
        return;
      }

      cleanup();
      await waitForCaptureFrame();
      resolve({
        mode: "region",
        rect: {
          x: Math.round(currentRect.x),
          y: Math.round(currentRect.y),
          width: Math.round(currentRect.width),
          height: Math.round(currentRect.height),
          devicePixelRatio: window.devicePixelRatio || 1,
        },
      });
    }

    function cycleSelectionUp() {
      if (!hoveredElement) return;
      let next = hoveredElement;
      let depth = currentDepth;
      while (depth > 0 && next?.parentElement) {
        next = next.parentElement;
        depth -= 1;
      }
      if (next?.parentElement) {
        currentDepth += 1;
        currentElement = next.parentElement;
      } else {
        currentElement = next;
      }
      updateNodeHighlight();
    }

    function updateNodeHighlight() {
      if (!currentElement) return;
      const rect = currentElement.getBoundingClientRect();
      ensureRegionBox();
      currentRect = rectToJson(rect);
      Object.assign(regionBox.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: `3px solid ${HIGHLIGHT_PRIMARY}`,
        outline: `2px solid ${HIGHLIGHT_SECONDARY}`,
        outlineOffset: "-7px",
        background: "rgba(0, 229, 255, 0.12)",
        boxShadow: `0 0 0 1px ${HIGHLIGHT_SHADOW}, 0 0 0 5px rgba(255, 43, 214, 0.22)`,
      });
      controls.style.top = `${Math.max(16, rect.top - 44)}px`;
      controls.style.left = `${Math.max(16, rect.left)}px`;
      controls.style.right = "auto";
    }

    function ensureRegionBox() {
      if (regionBox) return;
      regionBox = surfaceDocument.createElement("div");
      Object.assign(regionBox.style, {
        position: "fixed",
        border: `3px solid ${HIGHLIGHT_PRIMARY}`,
        outline: `2px solid ${HIGHLIGHT_SECONDARY}`,
        outlineOffset: "-7px",
        background: "rgba(0, 229, 255, 0.12)",
        boxSizing: "border-box",
        boxShadow: `0 0 0 1px ${HIGHLIGHT_SHADOW}, 0 0 0 5px rgba(255, 43, 214, 0.22)`,
        zIndex: "1",
      });
      surface.appendChild(regionBox);

      if (mode === "region") {
        handles = ["nw", "ne", "sw", "se"].map((name) => {
          const handle = surfaceDocument.createElement("div");
          handle.dataset.handle = name;
          Object.assign(handle.style, {
            position: "absolute",
            width: "12px",
            height: "12px",
            borderRadius: "999px",
            background: HIGHLIGHT_SECONDARY,
            border: `2px solid ${HIGHLIGHT_PRIMARY}`,
            boxShadow: `0 0 0 2px ${HIGHLIGHT_SHADOW}`,
          });
          regionBox.appendChild(handle);
          return handle;
        });
      }
    }

    function updateRegionBox() {
      if (!regionBox || !currentRect) return;
      Object.assign(regionBox.style, {
        left: `${currentRect.x}px`,
        top: `${currentRect.y}px`,
        width: `${currentRect.width}px`,
        height: `${currentRect.height}px`,
      });
      controls.style.left = `${currentRect.x}px`;
      controls.style.top = `${Math.max(16, currentRect.y - 44)}px`;
      controls.style.right = "auto";

      if (handles.length > 0) {
        positionHandle(handles[0], 0, 0);
        positionHandle(handles[1], currentRect.width - 12, 0);
        positionHandle(handles[2], 0, currentRect.height - 12);
        positionHandle(handles[3], currentRect.width - 12, currentRect.height - 12);
      }
    }

    function setHintHidden(nextHidden) {
      if (hintHidden === nextHidden) return;
      hintHidden = nextHidden;
      hint.style.opacity = nextHidden ? "0" : "1";
    }

    function shouldHideHintForPointer(x, y) {
      const rect = hint.getBoundingClientRect();
      const padding = 28;
      return x <= rect.right + padding && y <= rect.bottom + padding;
    }
  });
}

function waitForCaptureFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });
  });
}

async function createOverlayFrame() {
  const frame = document.createElement("iframe");
  frame.id = OVERLAY_ID;
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  Object.assign(frame.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    border: "0",
    margin: "0",
    padding: "0",
    zIndex: "2147483647",
    background: "transparent",
    colorScheme: "light",
  });
  frame.srcdoc =
    "<!doctype html><html><head><meta charset=\"utf-8\"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}</style></head><body></body></html>";
  document.documentElement.appendChild(frame);

  await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("Overlay load timed out")), 1000);
    frame.addEventListener(
      "load",
      () => {
        clearTimeout(timeoutId);
        resolve();
      },
      { once: true },
    );
  });

  return frame;
}

function cleanupOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function rectToJson(rect) {
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

function buildToolbarButton(surfaceDocument, text) {
  const button = surfaceDocument.createElement("button");
  button.type = "button";
  button.textContent = text;
  Object.assign(button.style, {
    background: "rgba(5, 8, 17, 0.96)",
    color: "white",
    border: `2px solid ${HIGHLIGHT_PRIMARY}`,
    borderRadius: "999px",
    padding: "8px 12px",
    font: "600 12px/1 ui-sans-serif, system-ui, sans-serif",
    cursor: "pointer",
    boxShadow: `0 0 0 2px ${HIGHLIGHT_SECONDARY}`,
  });
  return button;
}

function normalizeRect(x1, y1, x2, y2) {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

function resizeRect(rect, handle, x, y) {
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;

  if (handle === "nw") return normalizeRect(x, y, x2, y2);
  if (handle === "ne") return normalizeRect(x1, y, x, y2);
  if (handle === "sw") return normalizeRect(x, y1, x2, y);
  return normalizeRect(x1, y1, x, y);
}

function positionHandle(handle, left, top) {
  Object.assign(handle.style, {
    left: `${left}px`,
    top: `${top}px`,
  });
}

function pickUnderlyingElement(frame, x, y) {
  const previous = frame.style.pointerEvents;
  frame.style.pointerEvents = "none";
  const target = document.elementFromPoint(x, y);
  frame.style.pointerEvents = previous;
  return target;
}

function isInsideOverlay(target) {
  return target instanceof Element && Boolean(target.closest(`#${OVERLAY_ID}`));
}

function buildSelector(element) {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
    let part = current.localName;
    if (!part) break;
    if (current.classList.length > 0) {
      part += `.${Array.from(current.classList)
        .slice(0, 2)
        .map((value) => CSS.escape(value))
        .join(".")}`;
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}
