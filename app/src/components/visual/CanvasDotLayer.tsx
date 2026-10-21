import {
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
  type VoidComponent,
} from "solid-js";
import { seededPositionFor } from "~/layout/seeded";
import type { DocItem } from "~/types/notes";
import { colorFor } from "~/utils/colors";
import { mixHslColors } from "./regions/region-colors";

type Point = { x: number; y: number; approximate?: true };

/** World-space dots sharing one fill color, drawn as a single path. */
type DotBatch = {
  fill: string;
  /** Alpha multiplier; dots placed by neighbor guess draw faded. */
  alpha: number;
  /** Region tint the batch fades toward at overview zoom, if any. */
  tint?: string;
  ids: string[];
  xs: Float64Array;
  ys: Float64Array;
};

const SPREAD = 1000;
const DOT_STROKE = "rgba(0, 0, 0, 0.12)";
const APPROXIMATE_ALPHA = 0.4;

export type CanvasDotLayerProps = {
  docs: Accessor<DocItem[]>;
  positions: Accessor<Map<string, Point>>;
  scale: Accessor<number>;
  offset: Accessor<Point>;
  /** Dot radius in world units. */
  radius: Accessor<number>;
  opacity: Accessor<number>;
  /** Ids matching the search, or null when no search is active. */
  matchingDocIds: Accessor<Set<string> | null>;
  /** Region tint per note id; dots mix toward it by `tintAmount`. */
  tints?: Accessor<Map<string, string>>;
  /** 0 draws each note's own color, 1 its region's tint. */
  tintAmount?: Accessor<number>;
};

function readCssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/**
 * Note dots for the canvas map, painted on a 2D canvas instead of one SVG
 * node per note. Thousands of SVG circles made every zoom and hover touch
 * thousands of DOM nodes; this layer redraws in a few milliseconds. Hit
 * testing stays in the kd-tree hover logic, so the layer ignores pointers.
 */
export const CanvasDotLayer: VoidComponent<CanvasDotLayerProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined;
  const [size, setSize] = createSignal({ width: 0, height: 0, dpr: 1 });
  // Bumped when the theme changes so CSS-variable colors are re-read.
  const [themeVersion, setThemeVersion] = createSignal(0);

  const batches = createMemo(() => {
    const docs = props.docs();
    const positions = props.positions();
    const tints = props.tints?.();
    const byFill = new Map<
      string,
      {
        fill: string;
        alpha: number;
        tint?: string;
        ids: string[];
        xs: number[];
        ys: number[];
      }
    >();
    docs.forEach((doc, index) => {
      const pos =
        positions.get(doc.id) ?? seededPositionFor(doc.title, index, SPREAD);
      const fill = colorFor(doc.path || doc.title);
      const alpha =
        "approximate" in pos && pos.approximate ? APPROXIMATE_ALPHA : 1;
      const tint = tints?.get(doc.id);
      const key = `${fill}|${alpha}|${tint ?? ""}`;
      let batch = byFill.get(key);
      if (!batch) {
        batch = { fill, alpha, tint, ids: [], xs: [], ys: [] };
        byFill.set(key, batch);
      }
      batch.ids.push(doc.id);
      batch.xs.push(pos.x);
      batch.ys.push(pos.y);
    });
    const result: DotBatch[] = [];
    for (const batch of byFill.values()) {
      result.push({
        fill: batch.fill,
        alpha: batch.alpha,
        tint: batch.tint,
        ids: batch.ids,
        xs: Float64Array.from(batch.xs),
        ys: Float64Array.from(batch.ys),
      });
    }
    return result;
  });

  onMount(() => {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const measure = () => {
      setSize({
        width: parent.clientWidth,
        height: parent.clientHeight,
        dpr: window.devicePixelRatio || 1,
      });
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(parent);
    const themeObserver = new MutationObserver(() =>
      setThemeVersion((v) => v + 1),
    );
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onScheme = () => setThemeVersion((v) => v + 1);
    colorScheme?.addEventListener("change", onScheme);
    onCleanup(() => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      colorScheme?.removeEventListener("change", onScheme);
    });
  });

  // A render effect paints in the same flush as the SVG labels, so dots and
  // labels never drift a frame apart while panning or zooming.
  createRenderEffect(() => {
    const { width, height, dpr } = size();
    const scale = Math.max(0.001, props.scale());
    const offset = props.offset();
    const radius = props.radius();
    const opacity = props.opacity();
    const matching = props.matchingDocIds();
    const list = batches();
    const tintAmount = props.tintAmount?.() ?? 0;
    themeVersion();
    if (!canvas || width <= 0 || height <= 0) return;

    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelWidth, pixelHeight);
    if (opacity <= 0.01 || list.length === 0) return;

    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      dpr * offset.x,
      dpr * offset.y,
    );
    const minX = -offset.x / scale - radius * 2;
    const minY = -offset.y / scale - radius * 2;
    const maxX = (width - offset.x) / scale + radius * 2;
    const maxY = (height - offset.y) / scale + radius * 2;
    // Strokes stay one screen pixel wide at any zoom.
    const hairline = 1 / scale;
    const fillOf = (batch: DotBatch) =>
      batch.tint
        ? mixHslColors(batch.fill, batch.tint, tintAmount)
        : batch.fill;

    const drawBatch = (
      batch: DotBatch,
      r: number,
      include: (id: string) => boolean,
    ) => {
      let drawn = 0;
      ctx.beginPath();
      for (let i = 0; i < batch.xs.length; i++) {
        const x = batch.xs[i]!;
        const y = batch.ys[i]!;
        if (x < minX || x > maxX || y < minY || y > maxY) continue;
        if (!include(batch.ids[i]!)) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
        drawn++;
      }
      return drawn;
    };

    if (!matching) {
      ctx.lineWidth = hairline;
      ctx.strokeStyle = DOT_STROKE;
      for (const batch of list) {
        if (drawBatch(batch, radius, () => true) === 0) continue;
        ctx.globalAlpha = opacity * batch.alpha;
        ctx.fillStyle = fillOf(batch);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      return;
    }

    // Search: non-matches shrink and gray out underneath the matches.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = readCssColor("--colors-gray-8", "#8b8d98");
    ctx.strokeStyle = DOT_STROKE;
    ctx.lineWidth = hairline;
    ctx.beginPath();
    let dimmedCount = 0;
    for (const batch of list) {
      const r = radius * 0.7;
      for (let i = 0; i < batch.xs.length; i++) {
        const x = batch.xs[i]!;
        const y = batch.ys[i]!;
        if (x < minX || x > maxX || y < minY || y > maxY) continue;
        if (matching.has(batch.ids[i]!)) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
        dimmedCount++;
      }
    }
    if (dimmedCount > 0) {
      ctx.fill();
      ctx.stroke();
    }

    ctx.globalAlpha = opacity;
    ctx.lineWidth = hairline * 1.5;
    ctx.strokeStyle = readCssColor("--colors-bg-default", "#ffffff");
    for (const batch of list) {
      if (drawBatch(batch, radius * 1.25, (id) => matching.has(id)) === 0) {
        continue;
      }
      ctx.globalAlpha = opacity * batch.alpha;
      ctx.fillStyle = fillOf(batch);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        "pointer-events": "none",
      }}
    />
  );
};
