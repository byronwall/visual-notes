import { Show, createMemo, type VoidComponent } from "solid-js";
import { Box } from "styled-system/jsx";
import type { createSelectionStore } from "~/stores/selection.store";

type CanvasBrushRectProps = {
  selection: ReturnType<typeof createSelectionStore>;
};

/** Screen-space rectangle shown while brushing a selection. */
export const CanvasBrushRect: VoidComponent<CanvasBrushRectProps> = (props) => {
  const rect = createMemo(() => props.selection.brushRectScreen());
  return (
    <Show when={props.selection.isBrushing() && rect()}>
      {(() => {
        const brush = rect()!;
        const left = Math.min(brush.minX, brush.maxX);
        const top = Math.min(brush.minY, brush.maxY);
        const width = Math.abs(brush.maxX - brush.minX);
        const height = Math.abs(brush.maxY - brush.minY);
        return (
          <Box
            position="absolute"
            pointerEvents="none"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              border: "1px solid #2563EB",
              background: "rgba(37, 99, 235, 0.08)",
              "box-shadow": "inset 0 0 0 1px rgba(37,99,235,0.15)",
            }}
          />
        );
      })()}
    </Show>
  );
};
