import { createMemo, type Accessor } from "solid-js";
import type { UmapRegionItem } from "~/features/umap/region-types";
import { measureCanvasWork } from "./canvas-perf";
import type { Point } from "./labels/label-geometry";
import { assignRegionTones } from "./regions/region-colors";
import { buildRegionShapes } from "./regions/region-shape";

/**
 * Region shapes, tones, and the dot tint per note. All depend only on the
 * regions and note positions, never on the view, so pan, zoom, and view
 * animations do no hull work.
 */
export function useCanvasRegionShapes(args: {
  regions: Accessor<UmapRegionItem[]>;
  positions: Accessor<Map<string, Point>>;
}) {
  const shapes = createMemo(() => {
    const regions = args.regions();
    const positions = args.positions();
    return measureCanvasWork("regionShapes", () =>
      buildRegionShapes(regions, positions),
    );
  });
  const tones = createMemo(() => assignRegionTones([...shapes().values()]));
  const dotTints = createMemo(() => {
    const tintByDoc = new Map<string, string>();
    const toneById = tones();
    for (const region of args.regions()) {
      const tone = toneById.get(region.id);
      if (!tone) continue;
      for (const docId of region.docIds) tintByDoc.set(docId, tone.dot);
    }
    return tintByDoc;
  });
  return { shapes, tones, dotTints };
}
